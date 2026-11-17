/**
 * 刮削库的统一读写门面。
 *
 * 这是 164 处旧引用要迁移到的目标。设计目标是「最小改动」：
 *   旧：uni.getStorageSync('localMovieTvData') || {}
 *   新：getMovieTvData()
 *
 *   旧：uni.setStorageSync('localMovieTvData', data)
 *   新：setMovieTvData(data)
 *
 * 读：从多源库投影成旧形态，UI 无需改字段
 * 写：用于「局部修改」（如设置片头片尾、手动纠错），会精确回写到对应 Work
 */
import { get as getLibrary } from '../store'
import { projectLegacyView } from './legacy-view'
import { saveBucket } from './query'

/**
 * 读：返回 { movie: [], tv: [] }，跨源合并视图。
 * 语义与旧 `uni.getStorageSync('localMovieTvData')` 一致，但数据更全。
 */
export const getMovieTvData = () => projectLegacyView()

/**
 * 按 workKey 找单个条目的原始 Work（新结构）
 */
export const findWorkByKey = workKey => {
  const lib = getLibrary()
  for (const bucket of Object.values(lib.buckets || {})) {
    const w = (bucket.works || []).find(x => x.workKey === workKey)
    if (w) return w
  }
  return null
}

/**
 * 按 path 找条目（旧缓存命中逻辑用它）
 */
export const findWorkByPath = path => {
  const lib = getLibrary()
  for (const bucket of Object.values(lib.buckets || {})) {
    for (const w of bucket.works || []) {
      if ((w.versions || []).some(v => v.ref?.path === path)) return w
    }
  }
  return null
}

/**
 * 把一个 Work 就地更新回它所在的桶。
 * 用于：手动纠错、设置片头片尾、补海报等局部写。
 */
export const updateWork = work => {
  if (!work?.workKey) return null
  const lib = getLibrary()
  for (const [bKey, bucket] of Object.entries(lib.buckets || {})) {
    const idx = (bucket.works || []).findIndex(w => w.workKey === work.workKey && w.mediaType === work.mediaType)
    if (idx < 0) continue
    const works = [...bucket.works]
    works[idx] = { ...works[idx], ...work }
    saveBucket({ type: bucket.type, accountName: bucket.accountName, works })
    return works[idx]
  }
  return null
}

/**
 * 写：兼容旧的整体写入调用。
 *
 * 注意：旧代码经常整表覆盖（如 useVideoDetail 里改片头片尾）。
 * 这里不能整表覆盖新库（会丢其他源），而是「按 workKey 精准回写」。
 * 为了兼容，接受旧形态的 { movie, tv }，逐条匹配回写。
 */
export const setMovieTvData = data => {
  if (!data) return
  const legacyItems = [...(data.movie || []), ...(data.tv || [])]

  // 按桶分组回写
  const bucketWorks = new Map()
  const lib = getLibrary()
  Object.entries(lib.buckets || {}).forEach(([bKey, bucket]) => {
    bucketWorks.set(bKey, { type: bucket.type, accountName: bucket.accountName, works: [...(bucket.works || [])] })
  })

  legacyItems.forEach(item => {
    const workKey = item.workKey
    if (!workKey) {
      // 没有 workKey 的旧对象，按 tmdbId+name 兜底匹配
      legacyItems.forEach(() => {})
    }
    // 找到它属于哪个桶（看 source 里的 type/accountName）
    const src = item.source?.[0]
    if (!src) return
    const targetKey = `${src.type}::${src.accountName}`
    const entry = bucketWorks.get(targetKey)
    if (!entry) return

    // 兜底条件二必须带 mediaType：TMDB 的 movie id 与 tv id 是两套独立空间，
    // 只比数字会命中另一类型的同号作品。item.type 是旧条目字段（'1'=剧集/'2'=电影）。
    const wantedType = item.type === '1' || item.type === 1 ? 'tv' : 'movie'
    const idx = entry.works.findIndex(w =>
      (workKey && w.workKey === workKey) ||
      (item.movieTvId && w.tmdbId === item.movieTvId && w.mediaType === wantedType) ||
      (w.title === item.name && w.mediaType === wantedType)
    )
    if (idx < 0) return

    // 只回写用户可编辑的字段，不动版本结构
    const patch = {}
    if (item.openingTime !== undefined) patch.openingTime = item.openingTime
    if (item.endTime !== undefined) patch.endTime = item.endTime
    if (item.movieTvId && !entry.works[idx].tmdbId) patch.tmdbId = item.movieTvId
    if (item.poster !== undefined) patch.poster = item.poster
    if (item.backdrop !== undefined) patch.backdrop = item.backdrop
    if (item.overview !== undefined) patch.overview = item.overview
    if (item.voteAverage !== undefined) patch.voteAverage = item.voteAverage
    if (item.releaseTime !== undefined) patch.year = item.releaseTime
    if (item.genre_ids !== undefined) patch.genres = item.genre_ids

    entry.works[idx] = { ...entry.works[idx], ...patch }
  })

  // 落库
  bucketWorks.forEach((entry, bKey) => {
    const bucket = getLibrary().buckets?.[bKey]
    if (!bucket) return
    const changed = JSON.stringify(bucket.works) !== JSON.stringify(entry.works)
    if (changed) saveBucket(entry)
  })
}

/**
 * 库是否有内容（UI 判空用）
 */
export const isLibraryEmpty = () => {
  const { movie, tv } = getMovieTvData()
  return !movie.length && !tv.length
}

/**
 * 当前库里出现过的来源列表（供 UI 做「按源筛选」）
 */
export const getAvailableSources = () => {
  const lib = getLibrary()
  return Object.entries(lib.buckets || {}).map(([key, b]) => ({
    key,
    type: b.type,
    accountName: b.accountName,
    lastScrapedAt: b.lastScrapedAt || 0,
    count: (b.works || []).length,
  }))
}
