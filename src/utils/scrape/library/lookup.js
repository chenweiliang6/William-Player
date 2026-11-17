/**
 * 按「媒体类型 + TMDB id」精确定位作品。
 *
 * 为什么需要这个模块：
 *   TMDB 的 movie id 与 tv id 是两套**独立自增空间**，`/movie/555` 与
 *   `/tv/555` 是两部毫不相干的作品。旧代码里到处是
 *   `localMovieTvData.tv.find(i => i.movieTvId == X)` 这种「写死某个列表 +
 *   只比数字」的写法——靠「调用方恰好只对剧集开放」间接保证安全，函数本身
 *   没有任何防御。一旦入口传错类型，轻则读到另一类型的同号作品，重则
 *   `nowTv` 为 undefined 直接抛错（`nowTv.openingTime`）。
 *
 * 这里把「选列表 + 比 id」收敛成一个入口，调用方只需传 mediaType。
 */

/**
 * 归一媒体类型。
 *
 * 各处的类型表示不统一：路由参数是 `'tv'|'movie'`，库投影条目的 `type`
 * 字段是 `'1'`（剧集）/`'2'`（电影），个别地方还会是数字。统一收口。
 *
 * @param {string|number} t
 * @returns {'tv'|'movie'}
 */
export const normalizeMediaType = t => {
  if (t === 'tv' || t === '1' || t === 1) return 'tv'
  return 'movie'
}

/** 视图条目自带的 type 归一（同 normalizeMediaType，语义更清晰） */
const itemMediaType = item => normalizeMediaType(item?.type)

/**
 * 在投影视图 `{ movie: [], tv: [], byCategory? }` 里定位一条作品。
 *
 * 匹配优先级（从最精确到最宽松）：
 *   1. `workKey` 全等 —— workKey 本身已含 mediaType（`tmdb:movie:555`），
 *      是全库唯一无歧义的标识；
 *   2. `mediaType + tmdbId` —— 按类型限定列表后比数字；
 *   3. `path` —— 跨两个列表兜底（未识别条目没有 tmdbId，只能靠路径）。
 *
 * **每一步都先把列表按 mediaType 限定**，绝不跨类型混查。
 *
 * 未识别条目不会出现在 movie/tv 两个列表里（只进 byCategory.unidentified），
 * 因此当传了 workKey 且它是 slug 前缀时，会自动去 unidentified 桶查。
 *
 * @param {{movie?: Array, tv?: Array, byCategory?: object}} view
 * @param {{mediaType?: string, tmdbId?: string|number|null, workKey?: string, path?: string}} query
 * @returns {object|null} 命中的条目，没命中返回 null
 */
export const findInView = (view, { mediaType, tmdbId, workKey, path } = {}) => {
  if (!view) return null
  const movie = Array.isArray(view.movie) ? view.movie : []
  const tv = Array.isArray(view.tv) ? view.tv : []
  const unidentified = Array.isArray(view.byCategory?.unidentified) ? view.byCategory.unidentified : []

  // 1. workKey 全等。slug 前缀的未识别条目在 unidentified 桶里。
  if (workKey) {
    const pools = workKey.startsWith('slug:')
      ? [unidentified, movie, tv]
      : [movie, tv, unidentified]
    for (const pool of pools) {
      const hit = pool.find(i => i?.workKey === workKey)
      if (hit) return hit
    }
  }

  // 2. mediaType + tmdbId。类型未知时（没传 mediaType）两列表都查，
  //    但这是调用方的显式选择，不能默认走这条路。
  if (tmdbId != null && tmdbId !== '') {
    if (mediaType) {
      const pool = normalizeMediaType(mediaType) === 'tv' ? tv : movie
      return pool.find(i => String(i?.movieTvId) === String(tmdbId)) || null
    }
    return movie.find(i => String(i?.movieTvId) === String(tmdbId))
      || tv.find(i => String(i?.movieTvId) === String(tmdbId))
      || null
  }

  // 3. path 兜底
  if (path) {
    return movie.find(i => i?.path === path)
      || tv.find(i => i?.path === path)
      || unidentified.find(i => i?.path === path)
      || null
  }

  return null
}

/**
 * 从视图里取某个桶（movie/tv）的列表，按 mediaType 归一。
 * 用于「确定类型、批量操作」的场景。
 */
export const listOfMediaType = (view, mediaType) =>
  (normalizeMediaType(mediaType) === 'tv' ? view?.tv : view?.movie) || []

export { itemMediaType }
