/**
 * 用户自定义规则的读写。
 *
 * 存在 settingData.scrapeRules 下，结构：
 * {
 *   videoExtensions: ['mts'],            // 追加到内置白名单
 *   pathBlacklist:   ['/我的收藏夹'],      // 追加路径黑名单（字符串，按子串匹配）
 *   releaseTags:     ['某某组'],           // 追加发行标记
 *   seasonPatterns:  [{ re: '第(.+)部', group: 1, type: 'cn' }],  // 追加到最前，优先匹配
 *   minVideoSize:    20 * 1024 * 1024,   // 视频最小体积（字节），0 不过滤
 *   scanConcurrency: 0,                  // 目录扫描并发，0 = 无上限
 *   matchConcurrency: 0,                 // TMDB 匹配并发，0 = 无上限
 * }
 *
 * 因为 JSON 存不下 RegExp，用户写的正则是字符串，读取时再编译。
 */

const SETTING_KEY = 'settingData'
const RULE_FIELD = 'scrapeRules'

const readSettingData = () => {
  try {
    return uni.getStorageSync(SETTING_KEY) || {}
  } catch {
    return {}
  }
}

/**
 * 读取用户规则原始对象
 */
export const getUserRules = () => {
  const data = readSettingData()
  return data[RULE_FIELD] || {}
}

/**
 * 写入用户规则（整体替换）
 */
export const setUserRules = rules => {
  const data = readSettingData()
  data[RULE_FIELD] = rules || {}
  uni.setStorageSync(SETTING_KEY, data)
  return data[RULE_FIELD]
}

/**
 * 局部更新用户规则（浅合并）
 */
export const patchUserRules = patch => {
  return setUserRules({ ...getUserRules(), ...(patch || {}) })
}

/**
 * 清空用户规则，回到纯内置
 */
export const clearUserRules = () => setUserRules({})
