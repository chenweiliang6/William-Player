/**
 * 展示分类（category）派生。
 *
 * TMDB 只有 movie / tv 二分，但媒体库需要 6 个页签：
 *   全部 / 电影 / 电视剧 / 动漫 / 综艺 / 纪录片
 * 所以「动漫 / 综艺 / 纪录片」是在 mediaType 之上按 genre 派生的展示分类。
 *
 * 注意 movie 与 tv 的 genre id 是两套体系，不能混用。
 */

// 电影流派 id
const MOVIE_GENRE = {
  ANIMATION: 16,
  DOCUMENTARY: 99,
}

// 剧集流派 id（10764=Reality 真人秀，10767=Talk 脱口秀）
const TV_GENRE = {
  ANIMATION: 16,
  DOCUMENTARY: 99,
  REALITY: 10764,
  TALK: 10767,
}

// 动画剧集只有东亚产出才归入「动漫」，
// 否则欧美成人动画（如瑞克和莫蒂）会被错误地归到动漫页签。
const ANIME_COUNTRIES = ['JP', 'CN', 'KR', 'TW', 'HK']

/**
 * 分类常量。页签顺序与展示文案由 UI 层决定，这里只给稳定取值。
 */
export const CATEGORY = {
  ALL: 'all',
  MOVIE: 'movie',
  TV: 'tv',
  ANIME: 'anime',
  VARIETY: 'variety',
  DOCUMENTARY: 'documentary',
  // 注意：这不是剧种，而是「识别状态」。
  // 对标爆米花 #2493「未识别」——它和电影/电视剧并列，但收纳的是
  // 片名解析不出来或 TMDB 匹配不可信的条目，避免污染正常分区。
  UNIDENTIFIED: 'unidentified',
}

// 媒体库页签顺序（「全部」在 UI 层单独处理，不在库里落值）
export const CATEGORY_TABS = [
  CATEGORY.MOVIE,
  CATEGORY.TV,
  CATEGORY.ANIME,
  CATEGORY.VARIETY,
  CATEGORY.DOCUMENTARY,
]

const has = (arr, id) => Array.isArray(arr) && arr.includes(id)

/**
 * 由 TMDB 元数据派生出展示分类。
 *
 * 优先级：纪录片 > 综艺 > 动漫 > 基础类型。
 * 纪录片优先是因为爆米花把「记录」「真人秀」「脱口秀」同时列在电视剧的
 * 类型筛选里，但独立的纪录片/综艺页签必须能收到它们；
 * 先判纪录片可避免《我在故宫修文物》这类落进电视剧。
 *
 * @param {object} opts
 * @param {'movie'|'tv'} opts.mediaType
 * @param {number[]} [opts.genres]        TMDB genre id 数组
 * @param {string[]} [opts.originCountry] 出品国家码（仅 /search/tv 返回）
 * @returns {'movie'|'tv'|'anime'|'variety'|'documentary'}
 */
export const deriveCategory = ({ mediaType, genres = [], originCountry = [] }) => {
  if (mediaType === 'movie') {
    // 与剧集分支保持同一优先级：纪录片 > 动漫 > 基础类型
    if (has(genres, MOVIE_GENRE.DOCUMENTARY)) return CATEGORY.DOCUMENTARY
    if (has(genres, MOVIE_GENRE.ANIMATION)) return CATEGORY.ANIME
    return CATEGORY.MOVIE
  }

  if (has(genres, TV_GENRE.DOCUMENTARY)) return CATEGORY.DOCUMENTARY
  if (has(genres, TV_GENRE.REALITY) || has(genres, TV_GENRE.TALK)) return CATEGORY.VARIETY
  if (has(genres, TV_GENRE.ANIMATION)) {
    const cjk = Array.isArray(originCountry) && originCountry.some(c => ANIME_COUNTRIES.includes(c))
    return cjk ? CATEGORY.ANIME : CATEGORY.TV
  }
  return CATEGORY.TV
}

/**
 * 判断某作品的 category 是否落在给定页签下。
 * 「全部」页签恒为 true。
 */
export const inCategory = (category, tab) => !tab || tab === CATEGORY.ALL || category === tab

export { MOVIE_GENRE, TV_GENRE, ANIME_COUNTRIES }
