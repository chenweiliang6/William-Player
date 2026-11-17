/**
 * 刮削模块共享常量。
 */

// 新库的 storage key（PC 端同时是 IPC cache key）
export const STORAGE_KEY = 'movieTvLibrary'

// 旧库的 storage key，仅用于一次性迁移后读取
export const LEGACY_STORAGE_KEY = 'localMovieTvData'

// 数据结构版本，结构变更时递增，迁移逻辑据此分支
//   v2 → v3：Work 新增 category / originCountry（展示分类）
//   v3 → v4：Work 新增 releaseDate / seasonCount；并重判旧库的脏分类
//   v4 → v5：按原始文件名重解析片名，清理旧链路遗留的脏匹配并改写 workKey
//   v5 → v6：无 tmdbId 的 Work 按路径拆分，避免不同目录的同名文件塌缩成一张卡
export const LIBRARY_VERSION = 6

// 库结构
export const MEDIA_TYPE = {
  MOVIE: 'movie',
  TV: 'tv',
}

// 资源库（原始目录树浏览，不识别）独立存储，不混进媒体库
export const RESOURCE_LIBRARY_KEY = 'resourceLibrary'

/**
 * 刮削阶段「不设超时」的实际取值。
 *
 * **不能传 0，也不能传 Infinity**，因为 uni.request 各端对 0 的解释不一致：
 *   - H5：`timeout` 会被直接塞进 setTimeout，传 0 等于「立刻 abort」；
 *   - App-Plus：JS 层 `if (timeout)` 才设计时器，但原生层会回落成
 *     `timeout || 6e5`（10 分钟），传 0 反而是最短的那个；
 *   - PC(Electron/axios)：0 与 undefined 都是「永不超时」。
 *
 * 再往上报 `2147483647 + 200` 也不行——App-Plus 会给 timeout 加 200 再进
 * setTimeout，溢出成负数后立即触发。所以取 24 小时：对拖库等同于无限，
 * 又远在 32 位毫秒计时器的安全范围内。
 *
 * 这个常量只在刮削侧引用（scan/tree.js），底层请求函数只接收普通 number，
 * 避免 utils/common.js 反向依赖 scrape/ 造成层级倒置。
 */
export const SCRAPE_UNBOUNDED_TIMEOUT = 24 * 60 * 60 * 1000

/**
 * 源桶键：type + 账号名。
 * 例：'天翼云盘::账号A'
 */
export const bucketKey = (type, accountName) => `${type}::${accountName}`

/**
 * 解析桶键，返回 { type, accountName }。
 * 账号名里可能含 '::'，所以只切第一个分隔符。
 */
export const parseBucketKey = key => {
  const idx = String(key).indexOf('::')
  if (idx < 0) return { type: key, accountName: '' }
  return {
    type: key.slice(0, idx),
    accountName: key.slice(idx + 2),
  }
}
