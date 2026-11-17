/**
 * 库查询层。
 *
 * UI 层只依赖这里，不直接碰 buckets 结构。
 * 提供「跨源合并视图」——这是多源共存后列表页要的东西：
 *   同一个 Work 在多个桶里各有一份，展示时按 workKey 合并成一个条目，
 *   版本列表跨桶拼接。
 */
import { get as getLibrary, set as setLibrary, subscribe, flush, init, isReady, createEmptyLibrary } from '../store'
import { bucketKey } from '../constants'
import { deriveCategory } from '../parse/category'

/**
 * 把整个库拍平成 { movie: [], tv: [] } 的视图，供现有 UI 直接消费。
 *
 * 合并规则：workKey 相同的工作跨桶合并，versions 拼接。
 * 每个 Work 额外带 `sources` 字段（去重后的来源列表），供 UI 展示来源标签。
 */
const flattenLibrary = lib => {
  const byKey = new Map()

  Object.entries(lib.buckets || {}).forEach(([bKey, bucket]) => {
    (bucket.works || []).forEach(work => {
      const existed = byKey.get(work.workKey + '::' + work.mediaType)
      if (!existed) {
        byKey.set(work.workKey + '::' + work.mediaType, {
          ...work,
          versions: [...work.versions],
          buckets: [bKey],
        })
      } else {
        // 跨桶合并版本
        work.versions.forEach(v => {
          if (!existed.versions.find(e => e.versionKey === v.versionKey)) {
            existed.versions.push(v)
          }
        })
        if (!existed.buckets.includes(bKey)) existed.buckets.push(bKey)
      }
    })
  })

  const movie = []
  const tv = []
  const byCategory = { movie: [], tv: [], anime: [], variety: [], documentary: [], unidentified: [] }
  byKey.forEach(work => {
    // 去重来源标签
    const labelSet = new Set()
    work.versions.forEach(v => {
      const label = v.source.displayLabel || v.source.type
      labelSet.add(label)
    })
    work.sourceLabels = Array.from(labelSet)
    const cat = byCategory[work.category] ? work.category : (work.mediaType === 'tv' ? 'tv' : 'movie')
    byCategory[cat].push(work)
    // 未识别条目只进 byCategory.unidentified，不回流到 movie/tv
    if (cat === 'unidentified') return
    if (work.mediaType === 'tv') tv.push(work)
    else movie.push(work)
  })

  // 按标题排序，保证列表稳定
  const sortFn = (a, b) => String(a.title).localeCompare(String(b.title), 'zh-CN')
  movie.sort(sortFn)
  tv.sort(sortFn)
  Object.values(byCategory).forEach(list => list.sort(sortFn))

  return { movie, tv, byCategory }
}

/**
 * 判断库里有没有任何内容。
 *
 * 不能只看 movie/tv 两个键：未识别条目只进 byCategory.unidentified，
 * 永远不回流到 movie/tv（见 flattenLibrary）。若某个库全是未识别条目，
 * 用 `!movie.length && !tv.length` 判断会显示「空媒体库，去添加资源」，
 * 而实际上库里有东西，只是都没识别出来。
 *
 * @param {object} view getMovieTvData() 的返回值
 */
export const hasLibraryContent = view => {
  if (!view) return false
  if (view.movie?.length || view.tv?.length) return true
  return Object.values(view.byCategory || {}).some(list => list?.length)
}

/**
 * 兼容旧 UI 的读取：返回 { movie: [], tv: [] }
 * 这是 164 处引用主要要用的接口。
 */
export const getMovieTvData = () => {
  const lib = getLibrary()
  return flattenLibrary(lib)
}

/**
 * 只取当前激活源的视图（保留旧行为，供"只看这个源"的场景）
 */
export const getMovieTvDataBySource = (type, accountName) => {
  const lib = getLibrary()
  const key = bucketKey(type, accountName)
  const bucket = lib.buckets?.[key]
  if (!bucket) return { movie: [], tv: [] }

  const temp = { buckets: { [key]: bucket } }
  return flattenLibrary(temp)
}

/**
 * 按 workKey 精确取一个作品（详情页用）
 */
export const findWork = workKey => {
  const lib = getLibrary()
  for (const bucket of Object.values(lib.buckets || {})) {
    const w = (bucket.works || []).find(x => x.workKey === workKey)
    if (w) return w
  }
  return null
}

/**
 * 手动指定某条未识别作品的 TMDB 身份。
 *
 * 自动匹配总有覆盖不到的情况（「毒液3」在 TMDB 里叫「毒液：最后一舞」，
 * 两边都不带数字 3，任何算法都关联不上）。爆米花靠「搜不到就让用户自己选」
 * 兜住这类条目，这里提供同样的能力。
 *
 * 与旧 search-match.vue 的 resetMovieTv 机制的区别：
 *   旧机制只写一个临时 storage，等详情页去拿，最终落到旧结构；
 *   这里直接改新库里的 Work，重刮/重启都不会丢。
 *
 * @param {object} opts
 * @param {string} opts.workKey     要修正的 Work（可以是 slug: 前缀的未识别条目）
 * @param {object} opts.tmdbDetail  用户选中的 TMDB 条目（已归一成 detail 形状）
 * @returns {object|null} 更新后的 Work
 */
export const applyManualMatch = ({ workKey, tmdbDetail }) => {
  if (!workKey || !tmdbDetail?.tmdbId) return null

  const lib = getLibrary()
  const mediaType = tmdbDetail.mediaType === 'tv' ? 'tv' : 'movie'
  const targetKey = `tmdb:${mediaType}:${tmdbDetail.tmdbId}`

  let updated = null
  let conflict = null

  const buckets = {}
  Object.entries(lib.buckets || {}).forEach(([key, bucket]) => {
    const works = (bucket.works || []).map(w => {
      if (w.workKey !== workKey) return w

      // ── 目标身份冲突检测 ──
      //
      // 把这条改写成 targetKey 之前，先看**同一桶**里是否已有另一条 Work
      // 占着这个身份（典型场景：同一部片两份拷贝，一份已自动匹配成功，
      // 用户又把另一份的未识别条目匹配到同一 TMDB 条目）。
      // 若无检测：桶里会出现两条同 workId，读取层按 workKey 折叠成一张卡，
      // 用户刚修正的元数据被静默吞掉，详情页来源列表还混入错误文件。
      //
      // 跨桶同 key 属正常合并（多源同一部片），不拦。
      const occupied = (bucket.works || []).find(
        other => other !== w && other.workKey === targetKey && other.mediaType === mediaType,
      )
      if (occupied) {
        conflict = {
          title: occupied.title || '',
          workKey: occupied.workKey,
        }
        return w
      }

      updated = {
        ...w,
        // 换成有 TMDB 身份的新 key，从此不会再被清成未识别
        workKey: targetKey,
        tmdbId: tmdbDetail.tmdbId,
        mediaType,
        title: tmdbDetail.title || w.title,
        originalTitle: tmdbDetail.originalTitle || '',
        year: tmdbDetail.year || '',
        releaseDate: tmdbDetail.releaseDate || '',
        seasonCount: tmdbDetail.seasonCount || 0,
        poster: tmdbDetail.poster || '',
        backdrop: tmdbDetail.backdrop || '',
        overview: tmdbDetail.overview || '',
        voteAverage: tmdbDetail.voteAverage || 0,
        genres: tmdbDetail.genres || [],
        originCountry: tmdbDetail.originCountry || [],
        collectionId: tmdbDetail.collectionId ?? null,
        category: deriveCategory({
          mediaType,
          genres: tmdbDetail.genres || [],
          originCountry: tmdbDetail.originCountry || [],
        }),
        matched: true,
        unidentified: false,
        needsReview: false,
        matchScore: 100,
        // 手动匹配是用户主动选定的身份：固化为「原生」。
        // 否则 scanMediaType 还留着扫描阶段的旧类型、mediaType 已是用户选的，
        // 会被碰撞裁决误判成「跨类型纠正」条目而被降级。
        scanMediaType: mediaType,
        typeCorrected: false,
        // 标记来源，避免下次重刮时被自动匹配覆盖回去
        manualMatched: true,
        lastMatchAttempt: Date.now(),
      }
      return updated
    })
    buckets[key] = { ...bucket, works }
  })

  // 有冲突就不写库，把冲突信息交给调用方弹提示
  if (conflict) return { conflict: true, existing: conflict }
  if (!updated) return null
  setLibrary({ ...lib, buckets })
  return { work: updated }
}

/**
 * 按标题模糊搜索（搜索页用）
 */
export const searchWorks = keyword => {
  const kw = String(keyword || '').trim().toLowerCase()
  if (!kw) return { movie: [], tv: [] }
  const { movie, tv } = getMovieTvData()
  const hit = w =>
    String(w.title || '').toLowerCase().includes(kw) ||
    String(w.originalTitle || '').toLowerCase().includes(kw)
  return {
    movie: movie.filter(hit),
    tv: tv.filter(hit),
  }
}

/**
 * 按 genre 过滤（分类页用）
 */
export const filterByGenre = genreId => {
  const gid = Number(genreId)
  const { movie, tv } = getMovieTvData()
  const hit = w => Array.isArray(w.genres) && w.genres.includes(gid)
  return { movie: movie.filter(hit), tv: tv.filter(hit) }
}

/**
 * 当前库里的来源列表（供"切换源视图"用）
 */
export const listBuckets = () => {
  const lib = getLibrary()
  return Object.entries(lib.buckets || {}).map(([key, b]) => ({
    key,
    type: b.type,
    accountName: b.accountName,
    lastScrapedAt: b.lastScrapedAt || 0,
    workCount: (b.works || []).length,
  }))
}

/**
 * 写入一个桶的结果（单源刮削完成后调用）
 */
export const saveBucket = ({ type, accountName, works }) => {
  const lib = getLibrary()
  const key = bucketKey(type, accountName)
  const next = {
    ...lib,
    buckets: {
      ...lib.buckets,
      [key]: {
        type,
        accountName,
        lastScrapedAt: Date.now(),
        works,
      },
    },
  }
  setLibrary(next)
  return next
}

/**
 * 删除一个桶（移除源时用）
 */
export const removeBucket = key => {
  const lib = getLibrary()
  const buckets = { ...lib.buckets }
  delete buckets[key]
  const next = { ...lib, buckets }
  setLibrary(next)
  return next
}

/**
 * 清空整个库
 */
export const clearLibrary = () => {
  const next = createEmptyLibrary()
  setLibrary(next)
  return next
}

export {
  init as initLibrary,
  flush as flushLibrary,
  subscribe as subscribeLibrary,
  isReady as isLibraryReady,
}
