/**
 * 手动匹配的共享逻辑（三端复用）。
 *
 * 移动端 / TV / PC 的 search-match 页面交互各不相同（搜索框、焦点模型、
 * 列表组件都不一样），但「选中一条 TMDB 结果后怎么处理」是同一套：
 *   1. 把搜索结果补成库里的 detail 形状（季数/完整日期要再查一次详情）
 *   2. 校验类型一致、查重、撞已存在身份时拦截
 *   3. 走 applyManualMatch 改写新库，或回退旧的 resetMovieTv 缓存
 *
 * 把这段抽出来，三端页面只负责「渲染 + 焦点/点击」，避免三份复制。
 */
import { getTvDetail, getMovieDetail } from '@/utils/tmdb'
import { applyManualMatch, findInView, normalizeMediaType } from '@/utils/scrape'

/**
 * 把用户在搜索结果里选中的条目补成库里的 detail 形状。
 * 搜索结果只有 genre_ids 和基础字段，季数/完整日期要再查一次详情。
 * 详情失败时退回搜索结果的字段，不影响手动匹配。
 */
export const fetchDetailForManualMatch = async item => {
  const mediaType = normalizeMediaType(item.media_type)
  let raw = item
  try {
    raw = mediaType === 'tv' ? await getTvDetail(item.id) : await getMovieDetail(item.id)
  } catch {
    // 详情拿不到就用搜索结果兜底
  }
  const releaseDate = String(raw.release_date || raw.first_air_date || item.release_date || item.first_air_date || '')
  const genres = Array.isArray(raw.genres) && raw.genres.length
    ? raw.genres.map(g => (typeof g === 'number' ? g : g.id)).filter(n => n != null)
    : (raw.genre_ids || item.genre_ids || [])
  return {
    tmdbId: item.id,
    mediaType,
    title: raw.title || raw.name || item.title || item.name || '',
    originalTitle: raw.original_title || raw.original_name || '',
    year: releaseDate.slice(0, 4),
    releaseDate,
    poster: raw.poster_path || item.poster_path || '',
    backdrop: raw.backdrop_path || '',
    overview: raw.overview || item.overview || '',
    voteAverage: raw.vote_average || item.vote_average || 0,
    genres,
    originCountry: raw.origin_country || [],
    collectionId: raw.belongs_to_collection?.id || null,
    seasonCount: Number(raw.number_of_seasons) || 0,
  }
}

/** 结果码，供 UI 决定 toast 文案 */
export const MATCH_RESULT = {
  OK: 'ok',
  CONFLICT: 'conflict',     // 目标影片已在库中
  TYPE_MISMATCH: 'type',    // 选中的类型与当前条目不匹配
  DUPLICATE: 'duplicate',   // 旧分支：库里已有同类型同 id
  FAILED: 'failed',         // applyManualMatch 找不到条目
}

/**
 * 处理「用户选中了一条 TMDB 结果」。
 *
 * 两种模式：
 *   - `workKey` 有值 → 新库模式，走 applyManualMatch 直接改写库里的 Work；
 *   - `workKey` 为空 → 旧模式，写 resetMovieTv 缓存，由详情页 onShow 消费。
 *
 * @param {object} opts
 * @param {object} opts.item         选中的 TMDB 搜索结果
 * @param {string} [opts.workKey]    当前要修正的 Work
 * @param {string} [opts.currentType] 当前详情页的类型（'tv'|'movie'|'1'|'2'）
 * @param {object} opts.view         getMovieTvData() 的返回值（查重用）
 * @returns {Promise<{code: string, currentType?: string, selectedType?: string, name?: string, type?: string, tmdbId?: number}>}
 */
export const resolveManualMatch = async ({ item, workKey, currentType, view }) => {
  const type = normalizeMediaType(item.media_type)

  // 禁止跨类型改写（电影↔剧集）：会打乱 seasons 结构，且与碰撞裁决语义冲突
  if (currentType != null && normalizeMediaType(currentType) !== type) {
    return { code: MATCH_RESULT.TYPE_MISMATCH, currentType: normalizeMediaType(currentType), selectedType: type }
  }

  // 新库模式
  if (workKey) {
    const detail = await fetchDetailForManualMatch(item)
    const result = applyManualMatch({ workKey, tmdbDetail: detail })
    if (result?.conflict) return { code: MATCH_RESULT.CONFLICT }
    if (!result?.work) return { code: MATCH_RESULT.FAILED }
    return { code: MATCH_RESULT.OK }
  }

  // 旧模式：按「类型 + id」查重（只比数字会被同号另一类型误挡）
  if (findInView(view, { mediaType: type, tmdbId: item.id })) {
    return { code: MATCH_RESULT.DUPLICATE }
  }
  return {
    code: MATCH_RESULT.OK,
    type,
    tmdbId: item.id,
    name: item.name || item.title || '',
  }
}
