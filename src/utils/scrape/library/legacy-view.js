/**
 * 兼容视图层：把新库（Work + Version）投影成旧 UI 认识的形态。
 *
 * 为什么需要这一层：
 *   164 处 UI 引用消费的是旧字段（name / path / source[].seasonArr / movieTvId ...），
 *   一次性把它们改成新字段风险极高。这里输出「旧字段形态」，但数据源换成多源库。
 *
 * 这样：
 *   - UI 层几乎不用改（只把 getStorageSync 换成 getMovieTvData）
 *   - 多源共存、同名不同年不误合并等特性自动生效
 *   - 版本来源标签通过 source[].displayLabel 透出，UI 稍后加展示即可
 */
import { get as getLibrary, isReady } from '../store'
import { STORAGE_KEY } from '../constants'
import { CATEGORY } from '../parse/category'

/**
 * 取库数据。
 *
 * 防御性回退：store 的内存镜像可能还没初始化（App.vue 的 init 是异步的，
 * 首屏渲染可能早于它完成）。此时直接同步读一次落盘，保证 UI 不会看到空库。
 * uni storage 在 App/H5 是同步的；PC 端 IPC 拿不到，退回空库（PC 已在
 * layout/entry.vue 里 await 过 init，正常不会走到这里）。
 */
const readLibrary = () => {
  if (isReady()) return getLibrary()
  try {
    const raw = uni.getStorageSync(STORAGE_KEY)
    if (raw && typeof raw === 'object' && raw.buckets) return raw
  } catch {
    // 忽略，走空库
  }
  return getLibrary()
}


/**
 * 从 version 里取「播放/详情定位」信息，摊平成旧 UI 期望的 source 项。
 */
const toLegacySource = version => {
  const isTv = Array.isArray(version.seasons) && version.seasons.length > 0
  return {
    // 旧字段
    provider: version.source.provider,
    name: version.file.name,
    path: version.ref.path,
    size: version.file.sizeText || '',
    folderFileId: version.ref.folderFileId || version.ref.fileId || null,
    // 新增字段：来源溯源
    type: version.source.type,
    accountName: version.source.accountName,
    displayLabel: version.source.displayLabel,
    versionKey: version.versionKey,
    // 季：旧结构叫 seasonArr
    seasonArr: (version.seasons || []).map(s => ({
      name: s.name,
      path: s.ref.path,
      season: s.season,
      folderFileId: s.ref.folderFileId,
    })),
  }
}

/**
 * Work → 旧条目形态
 */
const toLegacyWork = work => {
  const sources = (work.versions || []).map(toLegacySource)
  const first = sources[0]

  return {
    // 旧 UI 的核心字段
    name: work.title,
    path: first?.path || '',
    poster: work.poster || '',
    backdrop: work.backdrop || '',
    // type 保持旧语义（1=剧集，2=电影），22 处旧 UI 依赖它，不要改
    type: work.mediaType === 'tv' ? '1' : '2',
    // 新增：展示分类（movie/tv/anime/variety/documentary），
    // 6 个分类页签用它分组，与 type 的二分语义互不干扰
    category: work.category || (work.mediaType === 'tv' ? 'tv' : 'movie'),
    originCountry: work.originCountry || [],
    movieTvId: work.tmdbId,
    genre_ids: work.genres || [],
    overview: work.overview || '',
    voteAverage: work.voteAverage || 0,
    releaseTime: work.year || '',
    // 完整上映日期，卡片第二行优先展示它（爆米花展示 YYYY-MM-DD）
    releaseDate: work.releaseDate || '',
    // 季数：优先 TMDB，缺省时退回本地扫描到的季目录数
    seasonCount: Number(work.seasonCount) || (work.versions || []).reduce(
      (max, v) => Math.max(max, (v.seasons || []).length), 0,
    ),
    season: first?.seasonArr?.[0]?.season || '1',

    // 多版本
    source: sources,

    // 新增：供 UI 展示来源标签、纠错状态
    workKey: work.workKey,
    year: work.year || '',
    sourceLabels: work.sourceLabels || [],
    needsReview: !!work.needsReview,
    matched: !!work.matched,
    unidentified: !!work.unidentified,

    // 兼容：用户手工设置的片头片尾
    openingTime: work.openingTime,
    endTime: work.endTime,
  }
}

/**
 * 把整个库投影成 { movie: [], tv: [] } 的旧形态。
 *
 * 跨桶合并：同一 workKey 在多个源各有一份，这里按 workKey 合并 versions，
 * 因此同一个作品会显示一张卡片、多个来源版本。
 */
export const projectLegacyView = () => {
  const lib = readLibrary()
  const byKey = new Map()

  Object.values(lib.buckets || {}).forEach(bucket => {
    (bucket.works || []).forEach(work => {
      const k = `${work.workKey}::${work.mediaType}`
      const existed = byKey.get(k)
      if (!existed) {
        byKey.set(k, {
          ...work,
          versions: [...(work.versions || [])],
        })
      } else {
        ;(work.versions || []).forEach(v => {
          if (!existed.versions.find(e => e.versionKey === v.versionKey)) {
            existed.versions.push(v)
          }
        })
      }
    })
  })

  // byCategory 是 6 个分类页签的权威视图。
  // movie / tv 两个旧键继续保留（22 处旧 UI 依赖），语义仍是「媒体类型二分」，
  // 因此动漫等分类的作品会同时出现在 movie 或 tv 里——新 UI 只读 byCategory。
  const byCategory = {
    movie: [],
    tv: [],
    anime: [],
    variety: [],
    documentary: [],
    unidentified: [],
  }
  const movie = []
  const tv = []

  byKey.forEach(work => {
    // 计算来源标签（去重）
    const labelSet = new Set()
    work.versions.forEach(v => {
      const label = v.source.displayLabel || v.source.type
      labelSet.add(label)
    })
    // 同 provider 多账号时，标签补账号名以区分
    const labelList = Array.from(labelSet)
    work.sourceLabels = work.versions.length > 1 && labelList.length < work.versions.length
      ? work.versions.map(v => `${v.source.type}(${v.source.accountName})`)
      : labelList

    const legacy = toLegacyWork(work)
    const cat = byCategory[legacy.category] ? legacy.category : (work.mediaType === 'tv' ? 'tv' : 'movie')
    byCategory[cat].push(legacy)

    // movie/tv 两个旧键有 22 处旧 UI 依赖，语义仍是「媒体类型二分」。
    // 未识别条目必须排除在外——否则乱码条目又回流到正常列表里。
    if (legacy.category === CATEGORY.UNIDENTIFIED) return
    if (work.mediaType === 'tv') tv.push(legacy)
    else movie.push(legacy)
  })

  const sortFn = (a, b) => String(a.name).localeCompare(String(b.name), 'zh-CN')
  movie.sort(sortFn)
  tv.sort(sortFn)
  Object.values(byCategory).forEach(list => list.sort(sortFn))

  return { movie, tv, byCategory }
}

/**
 * 只投影某个源桶（相当于旧的「只看当前激活源」行为）
 */
export const projectLegacyViewByBucket = bucketKeyStr => {
  const lib = readLibrary()
  const empty = {
    movie: [],
    tv: [],
    byCategory: { movie: [], tv: [], anime: [], variety: [], documentary: [], unidentified: [] },
  }
  const bucket = lib.buckets?.[bucketKeyStr]
  if (!bucket) return empty

  const movie = []
  const tv = []
  const byCategory = { movie: [], tv: [], anime: [], variety: [], documentary: [], unidentified: [] }
  ;(bucket.works || []).forEach(work => {
    const legacy = toLegacyWork(work)
    legacy.sourceLabels = Array.from(new Set((work.versions || []).map(v => v.source.displayLabel || v.source.type)))
    const cat = byCategory[legacy.category] ? legacy.category : (work.mediaType === 'tv' ? 'tv' : 'movie')
    byCategory[cat].push(legacy)
    if (legacy.category === CATEGORY.UNIDENTIFIED) return
    if (work.mediaType === 'tv') tv.push(legacy)
    else movie.push(legacy)
  })

  const sortFn = (a, b) => String(a.name).localeCompare(String(b.name), 'zh-CN')
  movie.sort(sortFn)
  tv.sort(sortFn)
  Object.values(byCategory).forEach(list => list.sort(sortFn))
  return { movie, tv, byCategory }
}
