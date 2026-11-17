// 海报主色提取工具：零依赖，canvas 缩小采样 + 加权直方图量化

// 把图片 URL 换成小尺寸采样图：TMDB 换尺寸段，Emby 追加 maxWidth，其余原样返回
export const toSampleUrl = url => {
  if (typeof url !== 'string') return url
  // Emby 图片接口：让服务端返回缩略图，避免为取色下载整张 backdrop
  if (/\/emby\/Items\/[^/]+\/Images\//.test(url)) {
    return url.includes('?') ? `${url}&maxWidth=300` : `${url}?maxWidth=300`
  }
  return url.replace(
    /\/t\/p\/w1920_and_h1080_bestv2|\/t\/p\/w533_and_h300_bestv2|\/t\/p\/w300_and_h450_bestv2/,
    '/t/p/w300'
  )
}

const loadHtmlImage = (url, useCrossOrigin) =>
  new Promise(resolve => {
    const img = new Image()
    if (useCrossOrigin) img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url
  })

// app 壳内：下载到本地再读文件转 base64 dataURL（dataURL 画 canvas 永不 tainted）
const loadViaPlusFile = tempFilePath =>
  new Promise(resolve => {
    try {
      plus.io.resolveLocalFileSystemURL(
        tempFilePath,
        entry => {
          entry.file(file => {
            const reader = new plus.io.FileReader()
            reader.onloadend = evt => resolve(evt.target.result ? loadHtmlImage(evt.target.result, false) : null)
            reader.onerror = () => resolve(null)
            reader.readAsDataURL(file)
          }, () => resolve(null))
        },
        () => resolve(null)
      )
    } catch (e) {
      resolve(null)
    }
  })

// app 壳内：先下载到本地临时文件再加载
const loadViaDownloadFile = url =>
  new Promise(resolve => {
    uni.downloadFile({
      url,
      success: async res => {
        if (res.statusCode === 200 && res.tempFilePath) {
          // file:// 路径个别 webview 下 img 加载失败，再降级 base64
          const img = await loadHtmlImage(res.tempFilePath, false)
          resolve(img || (await loadViaPlusFile(res.tempFilePath)))
        } else {
          resolve(null)
        }
      },
      fail: () => resolve(null),
    })
  })

// PC/Electron：fetch 转 blob 再加载（webSecurity 关闭时可行）
const loadViaFetchBlob = async url => {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const blob = await res.blob()
    const objectUrl = URL.createObjectURL(blob)
    const img = await loadHtmlImage(objectUrl, false)
    if (img && objectUrl.startsWith('blob:')) {
      // 画完 canvas 释放，挂在 img 上延迟释放不可靠，这里同步取色场景下直接释放
      URL.revokeObjectURL(objectUrl)
    }
    return img
  } catch (e) {
    return null
  }
}

// 加载采样图，任何一步失败都返回 null，永不 reject
export const loadImageForSampling = async url => {
  if (!url) return null
  // 1. 先尝试带 crossOrigin 直连（image.tmdb.org 若返回 ACAO 头则三端都走这条最快路径）
  let img = await loadHtmlImage(url, true)
  if (img) return img
  // 2. 按宿主环境降级。注意 CONFIG.IS_MOBILE/IS_TV 在 H5 dev server 下仍为 true，
  //    判断是否真在 app 壳必须用 typeof plus
  try {
    if (typeof plus !== 'undefined') {
      return await loadViaDownloadFile(url)
    }
    if (typeof window !== 'undefined' && typeof fetch === 'function' && typeof URL?.createObjectURL === 'function') {
      return await loadViaFetchBlob(url)
    }
  } catch (e) {
    return null
  }
  return null
}

// 画布采样尺寸：50×28，1400 像素足够量化且开销 <1ms
const SAMPLE_W = 50
const SAMPLE_H = 28

// 提取主色：加权直方图量化，失败返回 null
export const extractDominantColor = img => {
  try {
    const canvas = document.createElement('canvas')
    canvas.width = SAMPLE_W
    canvas.height = SAMPLE_H
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return null
    ctx.drawImage(img, 0, 0, SAMPLE_W, SAMPLE_H)
    const data = ctx.getImageData(0, 0, SAMPLE_W, SAMPLE_H).data
    return pickFromPixels(data)
  } catch (e) {
    // tainted canvas（SecurityError）等
    return null
  }
}

// rgb → hsl
const rgbToHsl = (r, g, b) => {
  const rr = r / 255
  const gg = g / 255
  const bb = b / 255
  const max = Math.max(rr, gg, bb)
  const min = Math.min(rr, gg, bb)
  const l = (max + min) / 2
  let h = 0
  let s = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === rr) h = ((gg - bb) / d + (gg < bb ? 6 : 0)) / 6
    else if (max === gg) h = ((bb - rr) / d + 2) / 6
    else h = ((rr - gg) / d + 4) / 6
  }
  return { h, s, l }
}

// 加权直方图：4-bit/通道共 4096 桶
// 权重策略：避开纯黑（海报黑边）/纯白（高光天空），压低低饱和度灰色
const pickFromPixels = data => {
  const buckets = new Map() // key → { r, g, b, weight }
  let totalR = 0
  let totalG = 0
  let totalB = 0
  let count = 0
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const a = data[i + 3]
    if (a < 128) continue
    totalR += r
    totalG += g
    totalB += b
    count++
    const { s, l } = rgbToHsl(r, g, b)
    let w = 1
    if (l < 0.12 || l > 0.92) w *= 0.15
    if (s < 0.15) w *= 0.3
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)
    const bucket = buckets.get(key)
    if (bucket) {
      bucket.r += r * w
      bucket.g += g * w
      bucket.b += b * w
      bucket.weight += w
    } else {
      buckets.set(key, { r: r * w, g: g * w, b: b * w, weight: w })
    }
  }
  if (!count) return null
  // 取权重最高的桶
  let best = null
  for (const bucket of buckets.values()) {
    if (!best || bucket.weight > best.weight) best = bucket
  }
  if (!best) return null
  // 该桶权重若集中在无效像素（全黑/全白海报），回退整图均值
  const avgL = rgbToHsl(totalR / count, totalG / count, totalB / count).l
  if (best.weight < count * 0.02 || avgL < 0.08 || avgL > 0.95) {
    return { r: Math.round(totalR / count), g: Math.round(totalG / count), b: Math.round(totalB / count) }
  }
  return {
    r: Math.round(best.r / best.weight),
    g: Math.round(best.g / best.weight),
    b: Math.round(best.b / best.weight),
  }
}

const hslToRgb = (h, s, l) => {
  const hue2rgb = (p, q, t) => {
    let tt = t
    if (tt < 0) tt += 1
    if (tt > 1) tt -= 1
    if (tt < 1 / 6) return p + (q - p) * 6 * tt
    if (tt < 1 / 2) return q
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6
    return p
  }
  let r
  let g
  let b
  if (s === 0) {
    r = g = b = l
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1 / 3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1 / 3)
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) }
}

const clamp = (v, min, max) => Math.min(max, Math.max(min, v))

// 按场景调整主色：dark=深色主题氛围色（压暗），light=浅色主题氛围色（提亮混白），tv=压暗到基色，pcOverlay=提亮蒙层色
export const adjustColor = ({ r, g, b }, mode) => {
  if (!mode) return { r, g, b }
  if (mode === 'tv') {
    return { r: Math.round(r * 0.15), g: Math.round(g * 0.15), b: Math.round(b * 0.15) }
  }
  const { h, s, l } = rgbToHsl(r, g, b)
  if (mode === 'dark') {
    return hslToRgb(h, s * 0.8, clamp(l * 0.45, 0.1, 0.22))
  }
  if (mode === 'light') {
    // 提亮后与白混合，保证浅色主题下深色文字可读
    const bright = hslToRgb(h, s * 0.75, Math.max(l, 0.55))
    return mixWithWhite(bright, 0.55)
  }
  if (mode === 'pcOverlay') {
    return mixWithWhite({ r, g, b }, 0.85)
  }
  return { r, g, b }
}

// 与白色混合，ratio 为白色占比
const mixWithWhite = ({ r, g, b }, ratio) => ({
  r: Math.round(r + (255 - r) * ratio),
  g: Math.round(g + (255 - g) * ratio),
  b: Math.round(b + (255 - b) * ratio),
})

// WCAG 相对亮度：判定该色作背景时是否应配浅色文字
export const isDarkColor = ({ r, g, b }) => {
  const lin = v => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b) < 0.5
}

export const rgbToString = ({ r, g, b }) => `#${[r, g, b].map(v => clamp(v, 0, 255).toString(16).padStart(2, '0')).join('')}`

export const rgbaToString = ({ r, g, b }, alpha) =>
  `rgba(${Math.round(clamp(r, 0, 255))}, ${Math.round(clamp(g, 0, 255))}, ${Math.round(clamp(b, 0, 255))}, ${alpha})`

// 主色作页面背景时的成对配色：背景用原色，文字按明暗自动反色
export const posterPalette = rgb => {
  if (!rgb) return null
  const dark = isDarkColor(rgb)
  return {
    bg: rgbToString(rgb),
    dark,
    text: dark ? '#ffffff' : '#000000',
    textSecondary: dark ? 'rgba(255, 255, 255, 0.72)' : 'rgba(0, 0, 0, 0.62)',
    textTertiary: dark ? 'rgba(255, 255, 255, 0.56)' : 'rgba(0, 0, 0, 0.45)',
    border: dark ? 'rgba(255, 255, 255, 0.28)' : 'rgba(0, 0, 0, 0.18)',
    // 按钮/选中块：深色背景上抬高亮度做块，浅色背景上压暗做块
    surface: dark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.06)',
    surfaceStrong: dark ? 'rgba(255, 255, 255, 0.24)' : 'rgba(0, 0, 0, 0.1)',
    // 深色背景配浅色图标，浅色背景配深色图标
    iconTone: dark ? 'white' : 'black',
  }
}
