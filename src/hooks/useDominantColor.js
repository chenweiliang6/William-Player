import { ref, computed, watch, unref } from 'vue'
import { toSampleUrl, loadImageForSampling, extractDominantColor, adjustColor, rgbToString } from '@/utils/dominantColor'

// 模块级缓存：url → {r,g,b} | null（失败也缓存，避免重复请求），上限 100 条
const colorCache = new Map()
const CACHE_MAX = 100

const cacheGet = url => {
  if (colorCache.has(url)) return colorCache.get(url)
  return undefined
}

const cacheSet = (url, value) => {
  if (colorCache.size >= CACHE_MAX) {
    const firstKey = colorCache.keys().next().value
    colorCache.delete(firstKey)
  }
  colorCache.set(url, value)
}

/**
 * 海报主色 hook：watch 海报 URL 变化自动取色，输出主题感知的 CSS 色值
 * @param {import('vue').Ref<string>} urlRef 海报图 URL（ref/computed）
 * @param {import('vue').Ref<string>} modeRef 场景模式（'dark'|'light'|'tv'|'pcOverlay'，可为 ref/computed 或固定值）
 * @returns {{ rawColor: Ref, toneColor: Ref }}
 */
export const useDominantColor = (urlRef, modeRef) => {
  const rawColor = ref(null)
  // 竞态防护：快速切季时只有最后一次请求生效
  let requestToken = 0

  watch(
    () => unref(urlRef),
    async url => {
      if (!url) {
        rawColor.value = null
        return
      }
      const cached = cacheGet(url)
      if (cached !== undefined) {
        rawColor.value = cached
        return
      }
      const token = ++requestToken
      const img = await loadImageForSampling(toSampleUrl(url))
      if (token !== requestToken) return
      const rgb = img ? extractDominantColor(img) : null
      cacheSet(url, rgb)
      rawColor.value = rgb
    },
    { immediate: true }
  )

  // 缓存存原始 rgb，主题切换在 computed 层重算，零额外请求
  const toneColor = computed(() => {
    if (!rawColor.value) return null
    return rgbToString(adjustColor(rawColor.value, unref(modeRef)))
  })

  return { rawColor, toneColor }
}
