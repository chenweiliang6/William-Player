/**
 * 替换 nutui-uniapp/components/_utils/raf.ts 的垫片。
 *
 * 原实现在**模块顶层**无条件执行 `const _window = window`：
 *   const _window = window as any
 *   export default requestAniFrame()
 *
 * uni-app App 端（App-Plus）的 JS 逻辑层跑在 v8 里，没有 window / document，
 * 框架自己也是用 `typeof window === 'object'` 判定当前是 webview 还是 v8。
 * 所以只要 nut-swiper / nut-tabs / nut-animate / nut-countdown /
 * nut-calendaritem / nut-address 中任意一个被页面静态引入，打包后的
 * app-service.js 在加载期就会抛 `ReferenceError: window is not defined`，
 * 页面注册全部中断 —— 表现为启动图一直不消失、白屏，控制台还不一定有红字。
 *
 * nutui 从 1.9.x 到 1.11.x 都未修复该写法，因此这里用 vite alias
 * 把这个模块整体换成等价的安全实现（行为与 nutui 自己的 else 降级分支一致）。
 *
 * 通过 vite.config.js 的 alias 生效，见 build/build.js。
 */

export const inBrowser = typeof window !== 'undefined'

// raf 只被当作函数调用，与 nutui 原实现 else 分支完全一致
export const requestAniFrame = callback => {
  return setTimeout(callback, 1000 / 60)
}

export function cancelRaf(id) {
  clearTimeout(id)
}

export default requestAniFrame
