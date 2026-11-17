// 播放缓存管理（对接原生 PlayerCacheModule）
// 缓存是进程级共享池，所有 video-view 共用一个 SimpleCache，容量为全局设置
import { i18n } from '@/i18n/index.js'

let CacheManager = null

// 原生模块只在 App 端存在，H5/PC 端调用会失败，这里统一挡掉
const getManager = () => {
  if (CacheManager) return CacheManager
  // #ifdef APP-PLUS
  CacheManager = uni.requireNativePlugin('PlayerCacheModule')
  // #endif
  return CacheManager
}

// 设置缓存容量上限，改小会立即按 LRU 淘汰超出部分
export const setCacheSize = (sizeMB, callback = () => {}) => {
  const manager = getManager()
  if (!manager) {
    callback({ success: false, errMsg: 'not supported on this platform' })
    return
  }
  manager.setCacheSize({ sizeMB }, res => callback(res || { success: false }))
}

// 查询缓存状态：{ success, usedBytes, maxBytes, usedMB, maxMB, keyCount }
export const getCacheInfo = (callback = () => {}) => {
  const manager = getManager()
  if (!manager) {
    callback({ success: false, errMsg: 'not supported on this platform' })
    return
  }
  manager.getCacheInfo(res => callback(res || { success: false }))
}

// 清空全部磁盘缓存，回调返回清理后的占用
export const clearCache = (callback = () => {}) => {
  const manager = getManager()
  if (!manager) {
    callback({ success: false, errMsg: 'not supported on this platform' })
    return
  }
  manager.clearCache(res => callback(res || { success: false }))
}

// 字节数转可读文本，供设置页展示
export const formatCacheSize = bytes => {
  const num = Number(bytes) || 0
  if (num <= 0) return '0 MB'
  const gb = num / 1024 / 1024 / 1024
  if (gb >= 1) return `${gb.toFixed(2)} GB`
  return `${(num / 1024 / 1024).toFixed(1)} MB`
}
