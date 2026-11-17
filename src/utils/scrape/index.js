/**
 * 刮削模块统一出口。
 *
 * 外部只应该从这里 import，不直接碰子目录。
 */

// ── 存储 ──
export {
  init as initLibrary,
  flush as flushLibrary,
  get as getLibraryRaw,
  set as setLibraryRaw,
  subscribe as subscribeLibrary,
  isReady as isLibraryReady,
  reset as resetLibraryStore,
  storeAdapterName,
} from './store'

// ── 查询（UI 层主要用这些）──
export {
  getMovieTvData as getMovieTvDataNative,
  getMovieTvDataBySource as getMovieTvDataBySourceNative,
  findWork,
  searchWorks,
  filterByGenre,
  listBuckets,
  saveBucket,
  removeBucket,
  clearLibrary,
  applyManualMatch,
  hasLibraryContent,
} from './library/query'

// ── 兼容门面：164 处旧引用迁移到这里 ──
export {
  getMovieTvData,
  setMovieTvData,
  findWorkByKey,
  findWorkByPath,
  updateWork,
  isLibraryEmpty,
  getAvailableSources,
} from './library/facade'

// ── 迁移 ──
export { migrateLegacyLibrary, buildLibraryFromMigration } from './library/migrate'

// ── 按「类型 + id」精确定位（废弃写死 .tv/.movie 的裸 find）──
export { findInView, normalizeMediaType, listOfMediaType } from './library/lookup'

// ── 手动匹配三端共享逻辑 ──
export { fetchDetailForManualMatch, resolveManualMatch, MATCH_RESULT } from './manual-match'

// ── 编排（一次完整刮削）──
export { scrapeSource, initLibraryWithMigration } from './orchestrator'

// ── 解析（各端 UI 也可能用到）──
export { parseFilename, parseTitle, parseYear, workSlug } from './parse/filename'
export { extractSeason, extractEpisode, isSeasonDir, seasonDisplayName } from './parse/season'
export { isVideoFile, getExtension } from './parse/video-ext'
export { CATEGORY, CATEGORY_TABS, deriveCategory, inCategory } from './parse/category'
export {
  classifyShape, extractShowTitle, CONFIDENCE,
  // 形态判据：剧集归属（tree 层）与课程目录祖先链（匹配层）共用
  looksLikeEpisodeFile, isEpisodeNumberName, episodeNumberOf,
  isNonMediaDir, isNonMediaAncestor, isDatedEpisodeName, isEpisodeCountAnnotation,
} from './scan/shape'

// ── 规则 ──
export { resolveRules, invalidate as invalidateRules } from './rules/resolver'
export { getUserRules, setUserRules, patchUserRules, clearUserRules } from './rules/user'

// ── 常量 ──
export { MEDIA_TYPE, STORAGE_KEY, LEGACY_STORAGE_KEY, bucketKey, parseBucketKey } from './constants'

// ── 兼容旧 API（原 src/utils/scrape.js 的导出）──
// 这些函数仍被 90+ 处调用，保留导出避免大面积改动。
// 新代码请优先用上面的 parse/* 与 library/*。
export {
  handleSecond,
  parseTime,
  throttle,
  debounce,
  calTime,
  formatNanoseconds,
  handleSeasonName,
  handleNameYear,
  generateChineseNumberMapping,
  recursionMovie,
  recursionTv,
  formatSecondTime,
  classifyList,
  extractSeasonNumber,
} from './legacy'
