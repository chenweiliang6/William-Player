/**
 * 库结构升级。
 *
 * v2 → v3：Work 新增 `category`（展示分类）与 `originCountry`。
 *   v2 的 Work 只有 mediaType（movie/tv），媒体库无法分出动漫/综艺/纪录片。
 *   这里用已存的 genres 就地补齐 category，不重新刮削，风险最低。
 *
 * v3 → v4：Work 新增 `releaseDate` / `seasonCount`（详情接口才有，旧数据留空）。
 *
 * v4 → v5：**彻底重判片名，清理旧链路遗留的脏匹配**。
 *   旧链路（scrape/legacy.js + useVideoIndex 里的 searchMovieTv）没有分数阈值，
 *   取 results[0]，纯数字文件名照样拿去查 TMDB。TMDB 里确实有叫《01》《02》
 *   《33》的影片，于是 01.mkv 配上了一张真海报、一个真年份，落在正常分区里。
 *
 *   这些 Work 的 workKey 已经固定成 `tmdb:movie:555`，而新链路对同一文件
 *   匹配失败时生成 `slug:movie:01` —— 两个 key 永远不相等，mergeWorks
 *   走「新增」分支，脏条目原封不动留下来。所以必须在这里把 key 一起改写，
 *   否则重刮多少次都清不掉。
 *
 * 迁移是纯内存操作，幂等：已处理过的 Work 原样返回。
 */
import { LIBRARY_VERSION } from '../constants'
import { deriveCategory, CATEGORY } from '../parse/category'
import { parseFilename, isMeaninglessTitle } from '../parse/filename'

/**
 * 从 Work 各版本的原始文件名里重新解析片名。
 *
 * 不能信任存下来的 `title`：旧链路把清洗后的名字（如 '01'）写进了 title，
 * 而真正的原始文件名在 versions[].file.name 里。只有重新解析原始文件名，
 * 才能判断「这个作品到底有没有可用的片名」。
 *
 * @returns {string} 解析出的第一个有效片名，全部失败返回 ''
 */
const reparseTitle = work => {
  const names = (work.versions || [])
    .map(v => v?.file?.name)
    .filter(Boolean)
  for (const name of names) {
    const parsed = parseFilename(name)
    if (parsed.title) return parsed.title
  }
  return ''
}

/**
 * 判断一个已入库的 Work 是否属于「片名本身就是垃圾」。
 *
 * 两个判据取或：
 *   1. 重新解析原始文件名，全部解析不出片名
 *   2. 存下来的 title 本身就是无意义名
 */
const isDirtyWork = work => {
  const nameHasNoTitle = (work.versions || []).length > 0 && !reparseTitle(work)
  const titleIsJunk = isMeaninglessTitle(work.title)
  return nameHasNoTitle || titleIsJunk
}

/**
 * 把脏 Work 降级为「未识别」。
 *
 * 关键在于同时改写 workKey：脏条目原本挂在 `tmdb:movie:555` 上，
 * 新链路对同一文件会生成 `slug:movie:<标题>`。不改 key 的话两条会并存，
 * 旧的海报和年份会一直显示。
 */
const demoteToUnidentified = work => {
  const baseTitle = reparseTitle(work)
    || String(work.title || '').replace(/\.[^.]+$/, '')
    || String((work.versions || [])[0]?.file?.name || '').replace(/\.[^.]+$/, '')
    || '未识别'

  const mediaType = work.mediaType === 'tv' ? 'tv' : 'movie'
  // 与 library/model.js 的 makeWorkKey 保持一致：
  // 片名无辨识度（纯编号/空）时，key 必须带路径，否则不同目录的同名文件
  // 会被合并成一张卡。重刮时新链路生成的 key 也必须能对上这里的规则。
  const firstPath = (work.versions || [])[0]?.ref?.path || ''
  const ambiguous = !baseTitle || isMeaninglessTitle(baseTitle)
  const nextKey = ambiguous && firstPath
    ? `slug:${mediaType}:${baseTitle}::${firstPath}`
    : `slug:${mediaType}:${baseTitle}`

  return {
    ...work,
    workKey: nextKey,
    tmdbId: null,
    matched: false,
    unidentified: true,
    needsReview: true,
    category: CATEGORY.UNIDENTIFIED,
    // 海报/简介/评分都来自错误匹配，必须清掉，否则脏海报继续展示
    poster: '',
    backdrop: '',
    overview: '',
    originalTitle: '',
    // 年份同样来自错误匹配的影片（01.mkv 被配到 2024 年的《01》），
    // 必须一并清掉，否则卡片第二行还在展示一个假的年份
    year: '',
    voteAverage: 0,
    genres: [],
    originCountry: [],
    collectionId: null,
    releaseDate: '',
    seasonCount: 0,
  }
}

/**
 * 给单个 Work 补齐字段并重判。
 */
const upgradeWork = work => {
  if (!work || typeof work !== 'object') return work

  const mediaType = work.mediaType === 'tv' ? 'tv' : 'movie'
  const genres = Array.isArray(work.genres) ? work.genres : []
  const originCountry = Array.isArray(work.originCountry) ? work.originCountry : []

  let next = work

  // v4：新字段缺省补空
  if (next.releaseDate === undefined) next = { ...next, releaseDate: '' }
  if (next.seasonCount === undefined) next = { ...next, seasonCount: 0 }
  if (next.originCountry === undefined) next = { ...next, originCountry }

  // v5：脏数据降级。只对「曾被 TMDB 认领」的条目动手——
  // 本来就是未识别的条目已经在正确的桶里，不必重复处理。
  //
  // **手动匹配过的必须跳过**：用户已经确认为这条文件选了正确的影片，
  // 文件名是不是纯编号（01.mkv 也可以是一部正经片子）无关紧要。
  if (!next.manualMatched && (next.tmdbId || next.matched)) {
    if (isDirtyWork(next)) return demoteToUnidentified(next)
  }

  // 分类缺失时按 genre 派生
  if (!next.category) {
    return {
      ...next,
      category: next.tmdbId
        ? deriveCategory({ mediaType, genres, originCountry })
        : (mediaType === 'tv' ? 'tv' : 'movie'),
      originCountry,
    }
  }

  // 已匹配条目的分类重算：**只在旧分类明显是旧版本产物时才动手**。
  //
  // 不做无条件重算，因为旧库的 genres 可能是残缺的（旧链路只存
  // genre_ids 的一部分），拿残缺 genre 重算会把「动漫」改成「纪录片」
  // 这类误伤。只有当前分类不在 6 个合法值里（旧版本写死的类型）才重算。
  const VALID_CATEGORIES = ['movie', 'tv', 'anime', 'variety', 'documentary', 'unidentified']
  if (next.tmdbId && !VALID_CATEGORIES.includes(next.category)) {
    return { ...next, category: deriveCategory({ mediaType, genres, originCountry }) }
  }

  return next
}

/**
 * 同一 workKey 降级后可能与已存在的 Work 撞车（比如脏条目和真正的
 * 未识别条目重名）。撞了就合并版本，丢弃重复的元数据。
 */
const dedupeWorks = works => {
  const map = new Map()
  works.forEach(w => {
    const k = `${w.workKey}::${w.mediaType}`
    const existed = map.get(k)
    if (!existed) {
      map.set(k, { ...w, versions: [...(w.versions || [])] })
      return
    }
    ;(w.versions || []).forEach(v => {
      if (!existed.versions.find(e => e.versionKey === v.versionKey)) {
        existed.versions.push(v)
      }
    })
  })
  return Array.from(map.values())
}

/**
 * 升级整个库对象。
 *
 * 注意：v5 的重判**每次都会跑**，即使 version 号已是最新。
 * 原因是旧库可能已被 v4 标过版本号，而 v4 的判据（只看 title 和 file.name）
 * 对「title 被写成清洗后名字」的情况会漏判。重判是幂等的，多跑无副作用。
 *
 * @param {object} lib 库对象 { version, updatedAt, buckets }
 * @returns {{ library: object, changed: boolean }}
 */
export const upgradeLibrary = lib => {
  if (!lib || typeof lib !== 'object' || !lib.buckets) {
    return { library: lib, changed: false }
  }

  const versionStale = (lib.version || 0) < LIBRARY_VERSION
  let changed = versionStale
  const buckets = {}

  Object.entries(lib.buckets).forEach(([key, bucket]) => {
    const works = (bucket.works || []).map(w => {
      const next = upgradeWork(w)
      if (next !== w) changed = true
      return next
    })
    const deduped = dedupeWorks(works)
    if (deduped.length !== works.length) changed = true
    buckets[key] = { ...bucket, works: deduped }
  })

  // v6：已存在的未识别条目按新规则重排 key。
  //
  // 旧规则的 slug key 不含路径，不同目录下两个「01.mkv」会被合并成一个
  // Work。拆开它们等于把合并过的版本再拆回去——只能按版本路径重新分组。
  const rebound = {}
  Object.entries(buckets).forEach(([key, bucket]) => {
    const works = bucket.works || []
    const needsRebind = works.some(
      w => !w.tmdbId && w.workKey.startsWith('slug:') && !w.workKey.includes('::'),
    )
    if (!needsRebind) {
      rebound[key] = bucket
      return
    }
    const fixed = works.map(w => {
      if (w.tmdbId || !w.workKey.startsWith('slug:') || w.workKey.includes('::')) return w
      const firstPath = (w.versions || [])[0]?.ref?.path || ''
      if (!firstPath) return w
      const title = reparseTitle(w) || w.title || ''
      const ambiguous = !title || isMeaninglessTitle(title)
      if (!ambiguous) return w
      const mediaType = w.mediaType === 'tv' ? 'tv' : 'movie'
      const slug = w.year ? `${title}.${w.year}` : title
      return { ...w, workKey: `slug:${mediaType}:${slug}::${firstPath}` }
    })
    const dedupedV6 = dedupeWorks(fixed)
    if (dedupedV6.length !== works.length) changed = true
    if (fixed.some((w, i) => w !== works[i])) changed = true
    rebound[key] = { ...bucket, works: dedupedV6 }
  })

  if (!changed) return { library: lib, changed: false }

  return {
    library: { ...lib, version: LIBRARY_VERSION, buckets: rebound },
    changed: true,
  }
}
