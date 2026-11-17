/**
 * 统一存储接口：同步外观 + 异步底层。
 *
 * 为什么这样设计：
 *   现有 164 处代码用的是 `uni.getStorageSync('localMovieTvData')` 这种同步调用，
 *   而 PC 端主进程只能走 async 的 ipc.invoke。不可能让所有调用方都改成 await。
 *
 * 解法：
 *   1. 启动时 await library.init() 一次性把数据加载进内存
 *   2. 此后 get() 同步读内存，set() 同步改内存 + 标脏
 *   3. 落盘异步/防抖进行，不阻塞调用方
 *
 * init 未完成时 get() 返回空库并置 ready=false，避免崩溃。
 */
import * as CONFIG from '@/utils/config'
import { adapterIpc } from './adapter-ipc'
import { adapterUni } from './adapter-uni'
import { LIBRARY_VERSION, STORAGE_KEY } from '../constants'
import { upgradeLibrary } from '../library/upgrade'

// PC 端走 IPC（主进程 jdb），其余端走 uni storage
const adapter = CONFIG.IS_PC ? adapterIpc : adapterUni

// 空库工厂
export const createEmptyLibrary = () => ({
  version: LIBRARY_VERSION,
  updatedAt: 0,
  buckets: {},
})

// 内存镜像
let memory = null
let ready = false
let dirty = false
let flushTimer = null
let flushing = null
const listeners = new Set()

const FLUSH_DEBOUNCE_MS = 800

const notify = () => {
  listeners.forEach(fn => {
    try {
      fn(memory)
    } catch (e) {
      console.warn('[scrape/store] 订阅回调异常:', e)
    }
  })
}

const scheduleFlush = () => {
  if (flushTimer) clearTimeout(flushTimer)
  flushTimer = setTimeout(() => {
    flushTimer = null
    flush()
  }, FLUSH_DEBOUNCE_MS)
}

/**
 * 初始化：从落盘加载到内存。各端启动时 await 一次即可。
 * 重复调用是安全的（幂等）。
 */
export const init = async () => {
  if (ready) return memory
  try {
    const raw = await adapter.init()
    // 落盘里可能存的是 JSON 字符串（uni storage 会自己序列化，IPC 不会）
    let data = raw
    if (typeof raw === 'string') {
      try {
        data = JSON.parse(raw)
      } catch {
        data = null
      }
    }
    memory = data && typeof data === 'object' && data.buckets ? data : createEmptyLibrary()
  } catch (e) {
    console.warn('[scrape/store] 初始化失败，使用空库:', e)
    memory = createEmptyLibrary()
  }

  // 结构升级：v2 → v3 补齐 category / originCountry。
  // 纯内存补齐，不重刮；changed 时标脏，随后落盘。
  try {
    const { library, changed } = upgradeLibrary(memory)
    if (changed) {
      memory = library
      dirty = true
    }
  } catch (e) {
    console.warn('[scrape/store] 库结构升级失败，继续用原库:', e)
  }

  ready = true
  notify()
  if (dirty) scheduleFlush()
  return memory
}

/**
 * 同步读取当前库。init 未完成时返回内存里的空库（不会崩）。
 */
export const get = () => {
  if (!memory) memory = createEmptyLibrary()
  return memory
}

/**
 * 同步替换整个库。会触发防抖落盘与订阅通知。
 */
export const set = data => {
  memory = data && typeof data === 'object' && data.buckets ? data : createEmptyLibrary()
  memory.updatedAt = Date.now()
  dirty = true
  notify()
  scheduleFlush()
}

/**
 * 强制落盘。await 后保证已写入。
 */
export const flush = async () => {
  if (flushTimer) {
    clearTimeout(flushTimer)
    flushTimer = null
  }
  // 已有落盘在进行时复用，避免并发写
  if (flushing) return flushing
  if (!dirty || !memory) return
  dirty = false
  const snapshot = memory
  flushing = (async () => {
    try {
      await adapter.flush(snapshot)
    } catch (e) {
      // 落盘失败时恢复脏标记，下次再试，避免数据丢失
      dirty = true
      console.warn('[scrape/store] 落盘失败:', e)
    } finally {
      flushing = null
    }
  })()
  return flushing
}

/**
 * 订阅库变更。返回取消订阅函数。
 */
export const subscribe = fn => {
  listeners.add(fn)
  // 已就绪则立刻推一次当前值，方便订阅方拿到初始状态
  if (ready) fn(memory)
  return () => listeners.delete(fn)
}

export const isReady = () => ready

/**
 * 重置内存状态（仅测试与账号切换场景使用）
 */
export const reset = () => {
  if (flushTimer) clearTimeout(flushTimer)
  flushTimer = null
  memory = createEmptyLibrary()
  dirty = false
  ready = false
  notify()
}

export const storeAdapterName = () => adapter.name
export { STORAGE_KEY }
