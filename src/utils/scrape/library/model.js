/**
 * 库模型：把扫描出的原始媒体项聚合成 Work + Version 结构。
 *
 * 核心概念：
 *   Work    = 一部作品（有身份：tmdbId 或 标题+年份）
 *   Version = 某个源上的一份拷贝
 *   Season  = 剧集版本下的季
 *
 * 与旧 groupBySource 的关键差异：
 *   旧：按 handleSeasonName(name, true) 合并，年份被剥掉 → 复联.2012/1994 被合并
 *   新：workKey 优先 tmdbId，无则用 title+year，同名不同年是两个 Work
 */
import { parseFilename, workSlug, isMeaninglessTitle, basenameOfPath } from '../parse/filename'
import { seasonDisplayName } from '../parse/season'
import { bucketKey } from '../constants'
import { matchOnTmdb, createMatchMemo } from '../match/tmdb'
import { mapWithConcurrency } from '../match/pool'
import { deriveCategory, CATEGORY } from '../parse/category'
import { isGenericDirName, isNonMediaDir } from '../scan/shape'
import { resolveRules } from '../rules/resolver'

/**
 * 生成 works 的容器：按 workKey 归并的 Map
 */
const createWorkMap = () => new Map()

/**
 * 作品键。
 * 有 tmdbId 用 tmdb 身份；否则用「标题.年份」兜底。
 */
/**
 * 作品键。
 *
 * 有 tmdbId 用 tmdb 身份；否则用「标题.年份」兜底。
 *
 * 未识别条目的键**必须带上首版本路径**：不同目录下两个都叫「01」的文件
 * 是两部不同的片，只按标题做键会把它们合并成一张卡（用户看到「少了一部」）。
 * 带路径后它们各自独立。路径只在 title 为空或纯编号时才需要——
 * 正常的同名影片（比如两个不同源的同部电影）仍应按标题合并。
 */
export const makeWorkKey = (tmdbId, mediaType, title, year, fallbackPath) => {
  if (tmdbId) return `tmdb:${mediaType}:${tmdbId}`
  const slug = year ? `${title}.${year}` : title
  // 片名是纯编号/空时，标题没有辨识度，必须靠路径区分
  if (fallbackPath && (!title || isMeaninglessTitle(title))) {
    return `slug:${mediaType}:${slug}::${fallbackPath}`
  }
  return `slug:${mediaType}:${slug}`
}

/**
 * 把一条原始媒体项转成 Version。
 *
 * 剧集的关键点：同一部剧的不同「季目录」属于同一个版本，只是 seasons 不同。
 * 所以 versionKey 对剧集用「源 + 剧目录」，对电影用「源 + 文件路径」。
 */
const toVersion = item => {
  const displayLabel = item.type

  // 剧集：versionKey 落在剧目录层级，季差异体现在 seasons 里
  const versionPath = item.isSeasonDir
    ? (item.parentPath || item.seasonPath || item.path)
    : item.path

  return {
    versionKey: `${bucketKey(item.type, item.accountName)}::${versionPath}`,
    source: {
      type: item.type,
      accountName: item.accountName,
      provider: item.provider || item.type,
      displayLabel,
    },
    ref: {
      path: versionPath,
      fileId: item.isSeasonDir ? null : (item.fileId || null),
      folderFileId: item.isSeasonDir ? null : (item.folderFileId || null),
    },
    file: {
      name: item.name,
      size: item.size || 0,
      sizeText: formatSize(item.size),
      resolution: '',
      duration: 0,
    },
    seasons: item.season != null
      ? [{
          season: String(item.season),
          name: seasonDisplayName(item.season),
          ref: { path: item.seasonPath, folderFileId: item.folderFileId || null },
        }]
      : [],
  }
}

// 字节 → 可读大小
export const formatSize = bytes => {
  const n = Number(bytes) || 0
  if (n <= 0) return ''
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let v = n
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(i === 0 ? 0 : 2)} ${units[i]}`
}

/**
 * 合并 Version 到 Work。同一版本（versionKey 相同）时合并季列表。
 */
const mergeVersion = (work, version) => {
  const existed = work.versions.find(v => v.versionKey === version.versionKey)
  if (!existed) {
    work.versions.push(version)
    return
  }
  // 同一目录的不同季 → 合并 seasons
  version.seasons.forEach(s => {
    if (!existed.seasons.find(e => e.season === s.season)) {
      existed.seasons.push(s)
    }
  })
  existed.seasons.sort((a, b) => Number(a.season) - Number(b.season))
}

/**
 * 构造一个新 Work 的元数据骨架（versions 为空）。
 *
 * 抽出来是为了让「正常命中」和「跨类型纠正后降级」共用同一份字段表，
 * 避免两处各写一遍、后续加字段时漏掉其中一处。
 */
const createWorkBody = ({ key, tmdbId, finalType, scanType, typeCorrected, title, year, item, detail, unidentified, matchResult }) => {
  const genres = detail?.genres || []
  const originCountry = detail?.originCountry || []
  return {
    workKey: key,
    tmdbId,
    mediaType: finalType,
    // 扫描阶段的原始类型判定。降级时据此回退，
    // 也是「这条是不是跨类型纠正来的」的唯一留存依据。
    scanMediaType: scanType,
    // 跨类型兜底（/search/multi）把类型改写过。
    // 合并层靠它与 typeCorrected === false 的原生命中做碰撞裁决。
    typeCorrected,
    // 展示分类。未识别条目单独归入 unidentified 桶——
    // 对标爆米花 #2493「未识别」，不进电影/电视剧分区。
    // 其余未匹配条目退回基础类型（爆米花的「其他」是资源库目录名，不是分类）
    category: unidentified
      ? CATEGORY.UNIDENTIFIED
      : (tmdbId
        ? deriveCategory({ mediaType: finalType, genres, originCountry })
        : (finalType === 'tv' ? 'tv' : 'movie')),
    title,
    originalTitle: detail?.originalTitle || '',
    year,
    // 完整上映日期（YYYY-MM-DD），首页卡片第二行用
    releaseDate: detail?.releaseDate || '',
    // 季数：来自 TMDB 详情，爆米花卡片「共N季」用
    seasonCount: detail?.seasonCount || 0,
    titleSlug: workSlug(item.name) || `${title}${year ? '.' + year : ''}`,
    poster: detail?.poster || '',
    backdrop: detail?.backdrop || '',
    overview: detail?.overview || '',
    voteAverage: detail?.voteAverage || 0,
    genres,
    originCountry,
    collectionId: detail?.collectionId || null,
    matched: !!tmdbId,
    unidentified,
    needsReview: matchResult?.needsReview || false,
    matchScore: matchResult?.score || 0,
    lastMatchAttempt: Date.now(),
    versions: [],
  }
}

/**
 * 把一条「靠跨类型兜底纠正来的」Work 降级为未识别。
 *
 * **为什么需要它**：纠正后 workKey 是 `tmdb:{纠正后类型}:{tmdbId}`。
 * 若库里同时存在一部真同名作品（扫描原生就命中同一 tmdbId），两者的
 * workKey 完全相同，直接合并会造出一部「既有无季单文件版本、又有季目录
 * 版本」的畸形 Work —— 播放时 `versions[0]` 可能指到电影文件却按剧集播。
 *
 * 降级后：类型回退到扫描阶段的判定（scanMediaType），清空全部 TMDB
 * 元数据（那些属于被纠正到的那个作品，不是这条的），归入「其他」分区，
 * 用户可通过「修正匹配」手动指定。
 *
 * 纯函数，不修改入参。
 */
export const demoteWork = work => {
  const scanType = work.scanMediaType === 'tv' || work.scanMediaType === 'movie'
    ? work.scanMediaType
    : work.mediaType
  const title = work.title || ''
  const year = work.year || ''
  // 未识别条目的 key 在片名无辨识度时依赖路径，取首版本路径
  const fallbackPath = (work.versions || [])[0]?.ref?.path || ''
  return {
    ...work,
    workKey: makeWorkKey(null, scanType, title, year, fallbackPath),
    tmdbId: null,
    mediaType: scanType,
    typeCorrected: false,
    category: CATEGORY.UNIDENTIFIED,
    originalTitle: '',
    releaseDate: '',
    seasonCount: 0,
    poster: '',
    backdrop: '',
    overview: '',
    voteAverage: 0,
    genres: [],
    originCountry: [],
    collectionId: null,
    matched: false,
    unidentified: true,
    needsReview: true,
    matchScore: 0,
  }
}

/**
 * 把降级后的 Work 放回 map。
 *
 * 降级后 workKey 变成 slug 形态，可能与别的未识别条目同 key，
 * 此时合并版本而不是覆盖（不同目录的「01」按路径区分，不会误合）。
 */
const insertDemoted = (map, demoted) => {
  const existed = map.get(demoted.workKey)
  if (!existed) {
    map.set(demoted.workKey, demoted)
    return demoted
  }
  ;(demoted.versions || []).forEach(v => mergeVersion(existed, v))
  return existed
}

/**
 * 用一个原始媒体项创建或更新 Work。
 */
const upsertWork = (map, item, parsed, matchResult, mediaType) => {
  const detail = matchResult?.detail
  const tmdbId = detail?.tmdbId || null
  // 未识别条目没有可用片名（parsed.title 为空），必须给一个可读的展示名，
  // 否则海报墙上是空白卡片。用原始文件名，去掉扩展名。
  const title = detail?.title || parsed.title || String(item.name || '').replace(/\.[^.]+$/, '')
  const year = detail?.year || parsed.year
  // 扫描阶段判定的类型 vs TMDB 最终类型。
  // 兜底搜索（/search/multi）可能纠正扫描阶段的判定，以 TMDB 为准。
  const scanType = mediaType
  const finalType = detail?.mediaType || mediaType
  const typeCorrected = finalType !== scanType
  // 未识别 = 没拿到 TMDB 身份（片名解析不出，或匹配不可信）
  const unidentified = !tmdbId && !!matchResult?.needsReview
  // 未识别条目用路径做键的一部分，避免不同目录的同名/纯编号文件塌缩
  const fallbackPath = unidentified ? (item.path || '') : ''
  const key = makeWorkKey(tmdbId, finalType, title, year, fallbackPath)

  const buildBody = () => createWorkBody({
    key, tmdbId, finalType, scanType, typeCorrected, title, year,
    item, detail, unidentified, matchResult,
  })

  let work = map.get(key)

  // ── 跨类型碰撞裁决 ──
  //
  // 同 workId 下如果一条来自扫描原生命中、一条来自跨类型纠正，
  // 说明「纠正」把一部电影错并到了同名剧集（或反之）。裁决：原生优先，
  // 纠正的那条降级为未识别。
  //
  // 判据必须是「同一 workId + 来源不同」，**不能**用「同 tmdbId 不同
  // mediaType」—— TMDB 的 movie id 与 tv id 是两套独立自增空间，
  // /movie/555 与 /tv/555 是两部毫不相干的作品，同号完全合法。
  if (work && !!work.typeCorrected !== typeCorrected) {
    if (work.typeCorrected) {
      // 先到的纠正条目让位给本条原生命中：摘出并降级
      map.delete(key)
      insertDemoted(map, demoteWork(work))
      work = undefined
    } else {
      // 本条是纠正来的，不能并入原生 Work：整条降级后单独存放
      const demoted = insertDemoted(map, demoteWork(buildBody()))
      mergeVersion(demoted, toVersion(item))
      return demoted
    }
  }

  if (!work) {
    work = buildBody()
    map.set(key, work)
  }
  mergeVersion(work, toVersion(item))
  return work
}

/**
 * 构建一个「源桶」的 works。
 *
 * @param {object} opts
 * @param {object} opts.source   { type, name }
 * @param {Array}  opts.items    扫描产出的原始媒体项
 * @param {'movie'|'tv'} [opts.kind] 旧调用方式：整批统一类型。
 *        不传时改用每项自带的 mediaType（阶段 2 之后的新扫描链路）。
 * @param {object} [opts.signal] { cancelled }
 * @param {Function} [opts.onProgress]
 * @returns {Promise<{works: Array, stats: object}>}
 */
/**
 * 为一条扫描项解析出「可用于 TMDB 搜索」的标题。
 *
 * 文件名本身往往只是编号（第01集.mkv / 01.mp4 / CD1.mkv），
 * 这时必须回头用父目录名——那才是真正的片名。
 * 两者都解析不出时返回空 title，调用方据此把条目归入「未识别」。
 *
 * @param {object} item 扫描项 { name, parentPath, isSeasonDir }
 * @returns {{title: string, year: string, fromDir: boolean}}
 */
const resolveSearchTitle = item => {
  const parsed = parseFilename(item.name)

  // 祖先链落在课程/教程目录下（扫描期由 tree.js 判定并写入 item.nonMedia）：
  // 这些视频不是影视作品，一律不查 TMDB，直接归未识别。
  //
  // 必须放在 isSeasonDir 之前：课程目录里的 `ms-00/ms-01/ms-02` 会被
  // classifyShape 判成 show（title=ms + 集号），如果只挡文件级条目，
  // 剧集条目仍会拿课程目录名去搜，刮出 documentary「MS」那种脏卡。
  //
  // 只判「直接父目录」的旧逻辑（下面那段 isNonMediaDir）仍在，两者互补：
  // 旧逻辑管当前层，这条管更上层的祖先。
  if (item.nonMedia) {
    return { title: '', year: parsed.year, fromDir: false }
  }

  // 剧集条目（isSeasonDir）的 name 就是剧名本身，parentPath 反而是承载层，
  // 所以它没有「从父目录取片名」这条路。
  if (item.isSeasonDir) {
    return { title: parsed.title, year: parsed.year, fromDir: false }
  }

  const dirName = basenameOfPath(item.parentPath)
  const dirIsGeneric = isGenericDirName(dirName)

  // 落在「课程/教程/素材」这类目录里的视频，本身不是影视作品。
  // 就算文件名解析出了片名（`10-【Agent框架开发篇】10.Langchain...`），
  // 也不能拿去搜 TMDB——否则会刮出一堆无关条目。
  // 这类条目直接归入未识别，既能被用户看到，又不会污染海报墙。
  if (dirIsGeneric && !isMeaninglessTitle(dirName)) {
    // 只针对「非影视目录」：`电影`/`电视剧` 这类承载层不放走，
    // 它们下面的文件仍要靠文件名解析出片名。
    const nonMedia = isNonMediaDir(dirName)
    if (nonMedia) return { title: '', year: parsed.year, fromDir: false }
  }

  if (parsed.title) return { title: parsed.title, year: parsed.year, fromDir: false }

  // 文件名无片名（纯编号/集号）→ 退到父目录名。
  const dirParsed = parseFilename(dirName)
  // 父目录名不能是「电影」「下载」「tmp」这类承载/临时目录名
  if (dirParsed.title && !isMeaninglessTitle(dirParsed.title) && !dirIsGeneric) {
    return {
      title: dirParsed.title,
      // 年份优先用文件名里的（更精确），目录名补位
      year: parsed.year || dirParsed.year,
      fromDir: true,
    }
  }
  return { title: '', year: parsed.year, fromDir: false }
}

/**
 * 构建一个「源桶」的 works。
 *
 * @param {object} opts
 * @param {object} opts.source   { type, name }
 * @param {Array}  opts.items    扫描产出的原始媒体项
 * @param {'movie'|'tv'} [opts.kind] 旧调用方式：整批统一类型。
 *        不传时改用每项自带的 mediaType（阶段 2 之后的新扫描链路）。
 * @param {object} [opts.signal] { cancelled }
 * @param {Function} [opts.onProgress] 每块匹配完成的进度
 * @param {Function} [opts.onPartial]  每块并入后的累积 works 快照
 * @param {object} [opts.memo] 外部 TMDB 匹配缓存。流式刮削时整轮共用一个，
 *        保证同一片名被切到不同批时拿到同一个结果 → 同一个 tmdbId → 同一张卡。
 * @returns {Promise<{works: Array, stats: object, cancelled: boolean}>}
 */
export const buildBucketWorks = async ({ source, items, kind, signal, onProgress, onPartial, memo: externalMemo }) => {
  // 兼容两种调用：旧的分桶 kind，或每项自带的 mediaType
  const kindOf = item => item.mediaType || (kind === 'tv' ? 'tv' : 'movie')
  const map = createWorkMap()
  const memo = externalMemo || createMatchMemo()

  // 先按「解析后的标题+年份+类型」分组，同一部片只查一次 TMDB。
  // 类型进分组键：同名作品可能一部是电影一部是剧，不能合并查询。
  const groups = new Map()
  for (const item of items) {
    const { title, year } = resolveSearchTitle(item)
    const mediaType = kindOf(item)

    // 片名解析不出来 → 归入「未识别」，不查 TMDB。
    // 这些正是「第01集 / 01 / CD1」这类垃圾查询词的来源。
    if (!title) {
      const key = `unidentified::${item.path || item.name}`
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          parsed: { title: '', year, original: item.name },
          mediaType,
          unidentified: true,
          items: [],
        })
      }
      groups.get(key).items.push(item)
      continue
    }

    // 剧集的片名来自剧目录名；季目录名本身就带季号，标题应去掉季。
    //
    // 片名是纯编号/无意义时，标题没有辨识度：不同目录的 01.mkv 会被并进
    // 同一组、只查一次 TMDB，最终还合并成一张卡。这类条目按路径分组。
    const ambiguous = !title || isMeaninglessTitle(title)
    const groupKey = ambiguous
      ? `ambiguous::${mediaType}::${item.path || item.name}`
      : `${mediaType}::${title}::${year || ''}`
    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        key: groupKey,
        parsed: { title, year, original: item.name },
        mediaType,
        unidentified: false,
        items: [],
      })
    }
    groups.get(groupKey).items.push(item)
  }

  const groupArr = Array.from(groups.values())
  const total = groupArr.length

  let processed = 0
  let matchedCount = 0
  let unidentifiedCount = 0
  // workId → 分组查询键。供上层做跨批身份收敛（见 orchestrator 的 reconcileIdentity）
  const workQueries = new Map()

  // TMDB 查询并发、入库串行。
  //
  // 并发度从配置读（settingData.scrapeRules.matchConcurrency），0 = 无上限。
  // 上限的取值依据：TMDB 官方约 40 请求/秒，单条查询最多触发 5 次请求
  // （搜索 + 3 次降级 + multi 兜底），所以 10 左右贴着上限仍在范围内。
  //
  // 分块推进：每块（CHUNK 组）跑完后就 upsert 并回调 onPartial，
  // 让上层的「边刮边显示」能拿到中间结果。
  //
  // 早期是一次 mapWithConcurrency 跑完整个 groupArr —— 它内部是
  // Promise.all，必须等所有查询返回才进入入库循环，于是：
  //   ① 进度条在匹配阶段看着像卡住（数字从 0 直接跳到 total）；
  //   ② 上层拿不到任何中间态，只能等全部刮完才写库。
  // 改成块之后，一个块内的 upsert 是同步的，不存在「同一部剧的多个季目录
  // 并发写同一个 Work」的竞争（真正的竞争只可能来自 await 交错）。
  //
  // 无上限时不再按 4 倍算块——否则「说好无上限」实际会被 40 卡住。
  // 但仍然要分块，不能一次把整批（扫描批上限 60 条）全铺开：
  // 单条查询最多 5 个请求，60 条并发就是 300 个在飞请求，
  // 会把 tmdb.js 的 1s/2s/4s 退避打穿，耗时反而更差。
  // 所以 0 走一个软上限，和扫描端的「由原生层排队」是同一个思路。
  const MATCH_UNLIMITED_WIDTH = 32
  const rawLimit = resolveRules().matchConcurrency
  const matchLimit = rawLimit > 0
    ? Math.min(rawLimit, total || 1)
    : Math.min(total || 1, MATCH_UNLIMITED_WIDTH)
  const CHUNK = Math.max(1, matchLimit * 4)
  let cancelled = false

  for (let start = 0; start < groupArr.length; start += CHUNK) {
    if (signal?.cancelled) {
      cancelled = true
      break
    }
    const chunk = groupArr.slice(start, start + CHUNK)

    const res = await mapWithConcurrency(
      chunk,
      matchLimit,
      async group => {
        // 未识别条目（片名解析不出来）不占 TMDB 请求
        if (group.unidentified) {
          return { matched: false, detail: null, needsReview: true, score: 0 }
        }
        try {
          return await matchOnTmdb(group.parsed, group.mediaType, memo)
        } catch (e) {
          return { matched: false, detail: null, needsReview: true, score: 0, error: e }
        }
      },
      { signal },
    )

    // 串行入库，并统计
    res.results.forEach((matchResult, i) => {
      // 被取消的位置没有结果，跳过（库里不写半截数据）
      if (!matchResult) return

      if (matchResult.matched) matchedCount++
      else unidentifiedCount++

      const group = chunk[i]
      for (const item of group.items) {
        const work = upsertWork(map, item, group.parsed, matchResult, group.mediaType)
        // 记录「这条 Work 是由哪个查询身份得出的」。
        // 上层用它做跨批身份收敛：同一查询在另一批里得出了不同 workKey
        // （TMDB 瞬时失败 → slug，重试成功 → tmdb）时要把旧卡片收掉，
        // 否则同一部剧会同时挂两张卡。
        if (work) workQueries.set(`${work.workKey}::${work.mediaType}`, group.key)
      }
      processed++
    })

    onProgress?.({ processed, total, matched: matchedCount })
    // 回调的是**累积快照**：调用方（编排层）据此增量落库
    onPartial?.(Array.from(map.values()))

    if (res.cancelled) {
      cancelled = true
      break
    }
  }

  return {
    works: Array.from(map.values()),
    stats: {
      total,
      processed,
      matched: matchedCount,
      unmatched: unidentifiedCount,
    },
    queries: workQueries,
    cancelled,
  }
}
