/**
 * 源类型图标。
 *
 * 原来「天翼云盘 / 夸克网盘 …」的 App Icon 映射在 mobile / tv / electron 各写了一遍，
 * 内容完全相同，这里统一收敛。
 *
 * 云盘用的是各 App 的官方图标（品牌辨识度），WebDAV / Emby 这类没有品牌图的
 * 走 iconfont 字形，由调用方按 kind 区分渲染方式。
 */

// 云盘品牌 App Icon：保持原样，不做字形替换
export const SOURCE_BRAND_ICON = {
  天翼云盘:
    'https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/8c/87/69/8c8769f2-6bfa-19b2-53a4-9e10a555deb3/AppIcon-0-0-1x_U007emarketing-0-7-0-0-sRGB-85-220.png/350x350.png',
  夸克网盘:
    'https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/60/6f/e5/606fe5ab-3bfb-c5e4-5bed-08c9b2b5188f/AppIcon-0-0-1x_U007emarketing-0-7-0-0-85-220.png/350x350.png?',
  联通云盘:
    'https://is1-ssl.mzstatic.com/image/thumb/Purple126/v4/a1/63/38/a16338a7-ba51-498a-5180-7327b46ca2b7/AppIcon-0-0-1x_U007emarketing-0-0-0-0-85-220.png/350x350.png',
  移动云盘:
    'https://is1-ssl.mzstatic.com/image/thumb/Purple126/v4/a1/63/38/a16338a7-ba51-498a-5180-7327b46ca2b7/AppIcon-0-0-1x_U007emarketing-0-7-0-0-85-220.png/350x350.png',
}

// 无品牌图的源类型：用 iconfont 字形
const SOURCE_GLYPH = {
  WebDAV: 'ziyuanku',
  Emby: 'emby',
}

/**
 * 取源类型图标描述。
 *
 * 注意：type 必须是 registry.js 里 SOURCE_REGISTRY 的稳定标识（WebDAV / Emby /
 * 天翼云盘 / 夸克网盘 / 联通云盘 / 移动云盘），不要传 t('...') 翻译后的展示文案。
 * 查表 key 是中文常量，传翻译文案会在英/日/韩语下全部不命中，退化成 WebDAV 字形。
 * 需要展示文案时，在数据里另设 label 字段。
 *
 * @param {string} type 源类型，如 '天翼云盘' / 'WebDAV' / 'Emby'
 * @returns {{ kind: 'image'|'glyph', value: string }}
 *   kind 为 image 时 value 是图片地址；为 glyph 时 value 是 wil-icon 的字形名
 */
export const getSourceIcon = type => {
  if (SOURCE_BRAND_ICON[type]) return { kind: 'image', value: SOURCE_BRAND_ICON[type] }
  return { kind: 'glyph', value: SOURCE_GLYPH[type] || SOURCE_GLYPH.WebDAV }
}
