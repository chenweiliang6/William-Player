/**
 * 规则合并：内置默认 + 用户自定义。
 *
 * 合并语义：
 *   - 数组类（videoExtensions / releaseTags / pathBlacklist）：追加 + 去重
 *   - 模式类（seasonPatterns / episodePatterns / yearPatterns）：
 *     用户规则插到最前，优先匹配；内置的保留在后面兜底
 *   - 单个正则编译失败不会让整体崩，跳过并记录
 *
 * 结果做了缓存：同一份用户规则只合并一次，规则变更时调 invalidate() 失效。
 */
import DEFAULT from './default'
import { getUserRules } from './user'

let cache = null
let cacheSignature = ''

/**
 * 编译单条正则，失败返回 null（不让坏规则拖垮整个刮削）
 */
const compileRe = (re, label) => {
  if (re instanceof RegExp) return re
  if (typeof re !== 'string' || !re) return null
  try {
    return new RegExp(re)
  } catch (e) {
    console.warn(`[scrape/rules] 自定义正则编译失败（${label}），已忽略:`, re, e)
    return null
  }
}

const dedupe = arr => Array.from(new Set(arr.filter(v => v != null && v !== '')))

/**
 * 并发度归一化：只接受 >= 0 的有限整数，其余回落默认值。
 *
 * 两个必须显式处理的坑：
 *   1. 0 是**合法值**（无上限），不能用 `||` 判真假，否则会被当成「未配置」。
 *   2. `Number(null)`、`Number('')` 都是 0。若默认值将来不是 0，
 *      靠 Number 兜底会把「没配」错认成「配了无上限」，所以先判空。
 */
const toConcurrency = (v, fallback) => {
  if (v == null || v === '') return fallback
  const n = Number(v)
  if (!Number.isFinite(n) || n < 0) return fallback
  // 上限保护：防止误填 1e9 让闸门宽度失去意义
  return Math.min(Math.floor(n), 9999)
}

/**
 * 把用户提供的模式规则转成内部结构，非法项丢弃
 */
const normalizePatterns = (arr, label) => {
  if (!Array.isArray(arr)) return []
  return arr
    .map(item => {
      if (!item) return null
      const re = compileRe(item.re, label)
      if (!re) return null
      return {
        re,
        group: Number(item.group) || 1,
        type: item.type || 'num',
        score: Number(item.score) || 10,
      }
    })
    .filter(Boolean)
}

/**
 * 字符串黑名单 → 子串匹配用的 RegExp
 */
const compileBlacklist = arr => {
  if (!Array.isArray(arr)) return []
  return arr
    .map(item => {
      if (item instanceof RegExp) return item
      if (typeof item !== 'string' || !item) return null
      try {
        // 当作正则；不是合法正则就退化为转义后的子串匹配
        return new RegExp(item)
      } catch {
        const escaped = item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        return new RegExp(escaped, 'i')
      }
    })
    .filter(Boolean)
}

/**
 * 合并规则。结果带缓存。
 */
export const resolveRules = (force = false) => {
  const user = getUserRules()
  const signature = JSON.stringify(user)
  if (!force && cache && signature === cacheSignature) return cache

  const merged = {
    videoExtensions: dedupe([
      ...DEFAULT.videoExtensions,
      ...(Array.isArray(user.videoExtensions) ? user.videoExtensions : []),
    ]).map(v => String(v).toLowerCase().replace(/^\./, '')),

    pathBlacklist: [
      ...DEFAULT.pathBlacklist,
      ...compileBlacklist(user.pathBlacklist),
    ],

    releaseTags: dedupe([
      ...DEFAULT.releaseTags,
      ...(Array.isArray(user.releaseTags) ? user.releaseTags : []),
    ]).map(v => String(v).toLowerCase()),

    // 用户规则优先
    seasonPatterns: [
      ...normalizePatterns(user.seasonPatterns, 'seasonPatterns'),
      ...DEFAULT.seasonPatterns,
    ],

    episodePatterns: [
      ...normalizePatterns(user.episodePatterns, 'episodePatterns'),
      ...DEFAULT.episodePatterns,
    ],

    yearPatterns: [
      ...normalizePatterns(user.yearPatterns, 'yearPatterns'),
      ...DEFAULT.yearPatterns,
    ],

    seasonSpecials: [
      ...(Array.isArray(user.seasonSpecials) ? user.seasonSpecials.map(r => compileRe(r, 'seasonSpecials')).filter(Boolean) : []),
      ...DEFAULT.seasonSpecials,
    ],

    titleSplitChars: dedupe([
      ...DEFAULT.titleSplitChars,
      ...(Array.isArray(user.titleSplitChars) ? user.titleSplitChars : []),
    ]),

    // 用户规则插到最前；内置的在后兜底
    meaninglessTitlePatterns: [
      ...(Array.isArray(user.meaninglessTitlePatterns)
        ? user.meaninglessTitlePatterns.map(r => compileRe(r, 'meaninglessTitlePatterns')).filter(Boolean)
        : []),
      ...DEFAULT.meaninglessTitlePatterns,
    ],

    // 体积阈值：用户给正数才覆盖内置
    minVideoSize: Number(user.minVideoSize) >= 0 && user.minVideoSize != null
      ? Number(user.minVideoSize)
      : DEFAULT.minVideoSize,

    // 并发度：0 无上限，正整数限流，其余回落默认
    scanConcurrency: toConcurrency(user.scanConcurrency, DEFAULT.scanConcurrency),
    matchConcurrency: toConcurrency(user.matchConcurrency, DEFAULT.matchConcurrency),

    chineseNumbers: { ...DEFAULT.chineseNumbers },
  }

  cache = merged
  cacheSignature = signature
  return merged
}

/**
 * 规则变更后调用，让下一次 resolveRules 重新合并
 */
export const invalidate = () => {
  cache = null
  cacheSignature = ''
}

/**
 * 释放正则对象（用于 JSON 序列化等场景）
 */
export const listRuleSources = () => {
  return Object.keys(DEFAULT).map(key => ({
    key,
    count: Array.isArray(DEFAULT[key]) ? DEFAULT[key].length : 1,
  }))
}

export default resolveRules
