/**
 * App / H5 端的存储适配器。
 *
 * 直接用 uni 的同步 storage API，读写都是同步的，无异步成本。
 * 容量上限：App 端 plus.storage 约 10MB，H5 localStorage 约 5MB。
 */
import { STORAGE_KEY } from '../constants'

export const adapterUni = {
  name: 'uni',
  isAsync: false,

  async init() {
    return uni.getStorageSync(STORAGE_KEY) || null
  },

  async flush(data) {
    uni.setStorageSync(STORAGE_KEY, data)
  },

  // 同步版，供需要在同步上下文里立刻拿到的场景
  readSync() {
    return uni.getStorageSync(STORAGE_KEY) || null
  },
}
