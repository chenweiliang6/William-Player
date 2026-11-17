/**
 * 小并发池。
 *
 * TMDB 没有批量查询接口，search 端点一次只能查一个片名，
 * 所以提速只能靠并发。TMDB 的上限在「40 请求/秒左右」，
 * 超限返回 429（退避重试在 utils/tmdb.js 里处理）。
 *
 * 这里只负责「同时最多跑 N 个任务」，不做限速。
 *
 * `limit <= 0` 或非法值视为**无上限**：整批一次铺开，不再排队。
 * 这条路要靠两层兜底——worker 自己 catch，以及 tmdb.js 的 429 退避。
 *
 * @param {Array} list               待处理列表
 * @param {number} limit             并发上限，0 表示无上限
 * @param {Function} worker          (item, index) => Promise<any>
 * @param {object} [opts]
 * @param {object} [opts.signal]     { cancelled } 取消标记
 * @returns {Promise<{results: Array, cancelled: boolean}>}
 *          results 与 list 等长且顺序一致，被取消的位置为 undefined
 */
export const mapWithConcurrency = async (list, limit, worker, { signal } = {}) => {
  const items = Array.isArray(list) ? list : []
  const size = items.length
  if (!size) return { results: [], cancelled: false }

  // 并发度不能超过任务数，否则会空转。
  // 0 / 负数 / 非数字 → width = size（无上限）。
  const raw = Number(limit)
  const width = Number.isFinite(raw) && raw > 0
    ? Math.max(1, Math.min(Math.floor(raw), size))
    : size
  const results = new Array(size)
  let cursor = 0
  let cancelled = false

  const run = async () => {
    while (true) {
      if (signal?.cancelled) {
        cancelled = true
        return
      }
      const index = cursor++
      if (index >= size) return

      // 单条失败不影响整批：worker 自己兜错，这里再兜一层
      try {
        results[index] = await worker(items[index], index)
      } catch (e) {
        results[index] = undefined
      }
    }
  }

  await Promise.all(Array.from({ length: width }, run))
  return { results, cancelled: cancelled || !!signal?.cancelled }
}
