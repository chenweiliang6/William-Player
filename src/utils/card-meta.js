/**
 * 媒体卡片展示数据的公共计算。
 *
 * 三端首页卡片（mobile / tv / electron 的 hx-list.vue）和三个列表页
 * （home/all.vue、tv/video-all.vue、mobile/video-all.vue）的卡片结构一致，
 * 第二行文案与评分徽标的规则也应当一致。这段逻辑原先只写在移动端首页卡片里，
 * 其余五处各自显示 `releaseTime`（只有年份），与爆米花的表现不同。
 *
 * 这里做成纯函数，**不 import vue-i18n**：`t` 由调用方传入。
 * 工具文件若自己取 i18n 实例，会和组件生命周期/语言切换的响应式脱钩。
 *
 * 数据来源见 `src/utils/scrape/library/legacy-view.js` 的 `toLegacyWork`：
 *   type        '1' = 剧集，'2' = 电影（旧语义，22 处 UI 依赖）
 *   releaseDate 'YYYY-MM-DD'，可能为空串
 *   releaseTime 年份，如 '2019'
 *   seasonCount TMDB 的季数，缺省时退回本地扫描到的季目录数
 *   voteAverage 0 表示没有评分
 *
 * Emby 条目走另一套构造（`getEmbyNewList` 等），字段只有
 * `type: 'Series' | 'Movie'` + `releaseTime`，没有 releaseDate / seasonCount /
 * voteAverage。下面的判定对它天然安全：`'Series'` 不等于 `'1'`，不会进「共N季」
 * 分支；`showVote` 恒 false，不会渲染空徽标。
 */

/**
 * 是否剧集。
 *
 * 库内条目用旧语义 `type === '1'`（数字 1 也兼容）。
 * Emby 的 `'Series'` 不在这里转换——它没有 seasonCount，走电影分支的结果
 * 与改动前完全一致，不需要为它额外引入映射。
 */
export const isTvItem = item => item?.type === '1' || item?.type === 1

/** 有评分才显示徽标。0 分不显示，避免每张卡都挂一个 0.0。 */
export const showVote = item => Number(item?.voteAverage) > 0

/**
 * 评分保留一位小数，对齐爆米花。
 *
 * `|| 0` 是为了兜住缺字段：`Number(undefined)` 是 NaN，
 * `toFixed` 会得到字符串 'NaN'。虽然调用处都有 `showVote` 挡着，
 * 但公共函数不该把 'NaN' 这种值吐出去。
 */
export const voteText = item => (Number(item?.voteAverage) || 0).toFixed(1)

/**
 * 卡片第二行文案。
 *
 *   剧集     → 「共N季」（N 来自 TMDB，缺省时是本地季目录数）
 *   电影/其他 → 上映日期 YYYY-MM-DD
 *   再退     → 年份
 *   再退     → 「暂无」
 *
 * @param {object} item 卡片条目
 * @param {Function} t  vue-i18n 的 t，由调用方传入
 * @returns {string}
 */
export const cardSubText = (item, t) => {
  const seasons = Number(item?.seasonCount) || 0
  if (isTvItem(item) && seasons > 0) return t('video.seasonCount', { count: seasons })
  if (item?.releaseDate) return item.releaseDate
  return item?.releaseTime || t('video.noReleaseTime')
}
