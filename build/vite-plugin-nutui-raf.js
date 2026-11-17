import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SHIM = path.resolve(__dirname, '../src/shims/nutui-raf.js').replace(/\\/g, '/')

/**
 * 把 nutui-uniapp 的 components/_utils/raf.ts 换成安全实现。
 *
 * 原文件在模块顶层无条件执行 `const _window = window`，App-Plus 逻辑层
 * 没有 window（框架自己用 typeof window === 'object' 区分 webview / v8），
 * 会让打包后的 app-service.js 加载期直接抛 ReferenceError，
 * 所有页面注册中断 —— 现象是启动图一直不消失、白屏。
 *
 * 为什么用 resolveId 而不是 resolve.alias：
 *   组件内部是相对导入 `../_utils/raf`，chunk 不在依赖图里，
 *   顶层 alias 匹配不到这个相对路径。
 */
export function nutuiRafShim() {
  return {
    name: 'nutui-raf-shim',
    enforce: 'pre',
    resolveId(source, importer) {
      // 只拦 nutui 组件内部的相对引用，避免误伤
      if (
        (source === '../_utils/raf' || source === './raf' || /_utils\/raf(\.ts)?$/.test(source)) &&
        importer &&
        importer.replace(/\\/g, '/').includes('nutui-uniapp/components/')
      ) {
        return SHIM
      }
      return null
    },
  }
}
