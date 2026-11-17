/**
 * 视频扩展名判定。
 *
 * 修掉旧代码 `name.includes('ts')` 这类子串匹配的误判：
 *   'Latest.Story.mp4' 含 'ts' → 旧代码会当成视频（碰巧对）
 *   'Boats.txt'        含 'ts' → 旧代码会当成视频（错）
 *
 * 新实现只看最后一个点之后的扩展名。
 */
import { resolveRules } from '../rules/resolver'

/**
 * 取文件扩展名（小写，不含点）。无扩展名返回 ''。
 */
export const getExtension = name => {
  if (!name) return ''
  const idx = String(name).lastIndexOf('.')
  if (idx < 0 || idx === name.length - 1) return ''
  return String(name).slice(idx + 1).toLowerCase()
}

/**
 * TypeScript 声明/配置文件常见的「代码形态」词干后缀。
 *
 * 这些文件的扩展名恰好是 `ts`，会和 MPEG-TS 视频撞车：
 *   shims-uni.d.ts / env.d.ts / vite.config.ts / x.test.ts / a.min.ts
 *
 * 真实的 `.ts` 视频是 HLS 切片或 TS 流录制（几十 MB 起），
 * 命名里不会出现 `.d` / `.config` / `.test` 这类代码后缀。
 */
const TS_CODE_STEM = /(^|\.)(d|config|test|spec|min|setup)$/i

/** 是否 `ts` 扩展名的 TypeScript 源码/声明文件（而非 MPEG-TS 视频） */
const isTsCodeFile = name => {
  const s = String(name || '')
  // 先确认扩展名确实是 ts，否则 .d.mkv 这种不该走这里
  if (getExtension(s) !== 'ts') return false
  // 去掉末尾的 '.ts'，只看词干的后缀形态
  return TS_CODE_STEM.test(s.slice(0, s.length - 3))
}

/**
 * 判断是否视频文件。
 *
 * `ts` 有歧义：既是 MPEG-TS 视频容器，也是 TypeScript 源码扩展名。
 * 白名单必须保留 `ts`（真实视频要能刮到），所以在白名单之外
 * 额外排除 TypeScript 的代码形态文件名。
 */
export const isVideoFile = name => {
  const ext = getExtension(name)
  if (!ext) return false
  if (ext === 'ts' && isTsCodeFile(name)) return false
  return resolveRules().videoExtensions.includes(ext)
}

/**
 * 判断是否目录。优先用源的原始标记，没有则按无扩展名推断。
 */
export const isFolderEntry = item => {
  if (!item) return false
  if (typeof item.isFolder === 'boolean') return item.isFolder
  return !getExtension(item.name)
}
