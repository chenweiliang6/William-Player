/**
 * 季号归一化。
 *
 * 修掉旧 extractSeasonNumber 返回类型不一致的问题（字符串/数字混用）。
 * 这里统一返回字符串，'0' 表示特别篇/OVA。
 */
import { resolveRules } from '../rules/resolver'

/**
 * 从目录名/文件名解析季号。
 * 无匹配返回 null（由调用方决定默认值），不在这一层猜。
 *
 * @param {string} str 目录名或文件名
 * @returns {string|null} 季号字符串，如 '1' / '2' / '0'
 */
export const extractSeason = str => {
  if (!str) return null
  const rules = resolveRules()
  const text = String(str)

  // 特别篇优先：OVA / SP / 特别篇 统一归到第 0 季
  if (rules.seasonSpecials.some(re => re.test(text))) return '0'

  for (const p of rules.seasonPatterns) {
    const m = text.match(p.re)
    if (!m) continue
    const raw = m[p.group]
    if (raw == null) continue
    if (p.type === 'cn') {
      const mapped = rules.chineseNumbers[raw]
      if (mapped != null) return String(mapped)
      // 「十二」这种没在表里的，尝试数字解析
      const num = parseInt(raw, 10)
      if (!Number.isNaN(num)) return String(num)
      continue
    }
    const num = parseInt(raw, 10)
    if (!Number.isNaN(num)) return String(num)
  }
  return null
}

/**
 * 判断目录名是否是「季目录」
 */
export const isSeasonDir = str => extractSeason(str) != null

/**
 * 提取集号。无匹配返回 null。
 *
 * @param {string} str 文件名
 * @returns {string|null} 集号字符串
 */
export const extractEpisode = str => {
  if (!str) return null
  const rules = resolveRules()
  const text = String(str)
  for (const p of rules.episodePatterns) {
    const m = text.match(p.re)
    if (!m) continue
    const raw = m[p.group]
    if (raw == null) continue
    const num = parseInt(raw, 10)
    if (!Number.isNaN(num)) return String(num)
  }
  return null
}

/**
 * 季号展示名。'0' 显示为「特别篇」。
 */
export const seasonDisplayName = season => {
  const s = String(season)
  if (s === '0') return '特别篇'
  return `第${s}季`
}
