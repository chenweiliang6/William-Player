/**
 * PC 端（Electron）的存储适配器。
 *
 * 走 IPC 到主进程：
 *   读：ipc.invoke('controller.client.getCache', key)  → jdb.getItem
 *   写：ipc.invoke('controller.client.cache', {key, value}) → jdb.setItem
 *
 * 主进程实现在另一个仓库 pc-player（electron/service/client.js），
 * 底层是 ee-core/storage 的 KV，容量远大于 localStorage。
 *
 * 注意：IPC 是异步的。调用方统一通过 store/index.js 的内存镜像同步访问，
 * 这里只负责真正的读写落盘。
 */
import { ipc, isEE } from '@/utils/ipcRenderer'
import { ipcApiRoute } from '@/utils/ipcApiRoute'
import { STORAGE_KEY } from '../constants'

export const adapterIpc = {
  name: 'ipc',
  isAsync: true,

  // IPC 环境不可用时降级到 uni storage，避免整个库读不出来
  get available() {
    return isEE && !!ipc
  },

  async init() {
    if (!this.available) return null
    try {
      const raw = await ipc.invoke(ipcApiRoute.getCache, STORAGE_KEY)
      // 主进程 getItem 未命中时返回 ''，这里统一成 null
      return raw || null
    } catch (e) {
      console.warn('[scrape/store] IPC 读取失败，降级为空库:', e)
      return null
    }
  },

  async flush(data) {
    if (!this.available) {
      // 降级：写回 uni storage，保证数据不丢
      uni.setStorageSync(STORAGE_KEY, data)
      return
    }
    await ipc.invoke(ipcApiRoute.cache, { key: STORAGE_KEY, value: data })
  },
}
