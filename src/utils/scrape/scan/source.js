/**
 * 数据源扫描入口。
 *
 * 负责把「源账号 + 目录配置」翻译成 scanFolderTree 的调用，
 * 并聚合多根目录的结果。
 */
import { getSourceDef, isDirectorySource, prepareSource } from '@/utils/sources/registry'
import { resolveRules } from '../rules/resolver'
import { scanFolderTree, createGate } from './tree'

/**
 * 取某个源在 muluData 里的扫描目录。
 * 用 type + name 复合键匹配，避免不同源的同名账号串目录（修旧 bug）。
 *
 * 新结构（entries）下不再区分电影/电视剧目录，所有导入到媒体库的目录
 * 都交给内容判定。
 *
 * 重要：entries 一旦存在就是唯一权威来源，旧 movie/tv 两桶完全不参与。
 * 旧桶只是给老版本 App 回滚留的兼容数据，若继续合并扫描，
 * 用户删掉的导入目录会被旧桶里的残条复活。
 * 只有在 entries 尚未生成（迁移未跑）时才回退读旧桶。
 *
 * @param {object} muluData { entries?: [], movie?: [], tv?: [] }
 * @param {'movie'|'tv'} [kind] 兼容旧调用：只取某一桶（仅 entries 缺失时生效）
 * @param {object} source   { type, name }
 */
export const getConfiguredFolders = (muluData, kind, source) => {
  const match = v => v.type === source.type && v.name === source.name

  if (Array.isArray(muluData?.entries)) {
    return muluData.entries
      .filter(match)
      // 只扫「导入到媒体库」的条目；仅资源库的不刮削
      .filter(v => (v.target || 'media') === 'media')
  }

  // 迁移未跑到的旧数据：回退读旧桶，两桶合并去重
  const seen = new Set()
  const out = []
  const buckets = kind ? [muluData?.[kind] || []] : [muluData?.movie || [], muluData?.tv || []]
  buckets.forEach(list => list.filter(match).forEach(v => {
    const key = `${v.path}::${v.folderFileId ?? ''}`
    if (seen.has(key)) return
    seen.add(key)
    out.push(v)
  }))
  return out
}

/**
 * 把刷新后的凭据写回 sourceList。
 * 只改当前源账号那一项，其余原样保留。
 */
const persistCredential = (source, cred) => {
  try {
    const sourceList = uni.getStorageSync('sourceList') || []
    const group = sourceList.find(g => g.type === source.type)
    const entry = group?.list?.find(i => i.name === source.name)
    if (!entry) return
    entry.token = cred.token
    uni.setStorageSync('sourceList', sourceList)
  } catch (e) {
    console.warn('[scrape/scan] 回写 token 失败:', e?.message)
  }
}

/**
 * 扫描一个源的所有配置目录。
 *
 * @param {object} opts
 * @param {object} opts.source      { type, name } 当前源账号
 * @param {object} opts.cred        该源的凭据条目
 * @param {object} opts.muluData    目录配置 { movie: [], tv: [] }
 * @param {'movie'|'tv'} opts.kind
 * @param {object} [opts.signal]    { cancelled } 取消标记
 * @param {Function} [opts.onProgress]
 * @param {Function} [opts.onBatch]  增量交付：扫描途中分批给出新产出的条目。
 *        多根目录是并发扫描的，各自独立切批，批与批之间没有跨目录的顺序保证。
 * @returns {Promise<{items, truncated}>}
 */
export const scanSource = async ({ source, cred, muluData, kind, signal, onProgress, onBatch }) => {
  const def = getSourceDef(source.type)
  if (!def || !isDirectorySource(source.type)) {
    throw new Error(`来源 ${source.type} 不支持目录扫描`)
  }

  const folders = getConfiguredFolders(muluData, kind, source)
  if (!folders.length) return { items: [], failed: 0, errors: [], skipped: [], total: 0, noFolders: true }

  // kind 只在旧调用方式下传；新调用不传，由扫描器按目录内容自动判定类型
  const isTv = kind === 'tv' ? true : kind === 'movie' ? false : undefined

  // WebDAV 的 token 有有效期，扫描前必须换新的。
  // 失败直接抛出去 —— 静默返回空列表会让上层以为「扫完了，没片子」。
  let effectiveCred = cred
  try {
    effectiveCred = await prepareSource(source.type, cred)
  } catch (e) {
    console.warn('[scrape/scan] 扫描前准备失败:', source.type, e?.message)
    // 保留原始错误类型，UI 据此给出「连接失败」或「请重新登录」提示
    const err = new Error(e?.message || `${source.type} 登录失败`)
    err.isAuthError = !!e?.isAuthError
    err.isConnectError = !!e?.isConnectError
    err.cause = e
    throw err
  }

  // 新 token 必须落回 sourceList：播放器/目录浏览直接读 storage 里的那份，
  // 只换内存里的副本会导致「刮削成功了，但点进去还是 401」。
  if (effectiveCred.token && effectiveCred.token !== cred?.token) {
    persistCredential(source, effectiveCred)
  }

  const provider = def.providerId || effectiveCred.provider || source.type

  // 多个导入目录共用一个闸门，否则「并发 4 + 3 个根目录」实际会跑 12 个请求。
  // 0 = 无上限时闸门退化为直通。
  const gate = createGate(resolveRules().scanConcurrency)

  const results = await Promise.allSettled(
    folders.map(folder => {
      // WebDAV 用 path 导航，其余用 folderId
      const ref = def.navigateBy === 'path'
        ? { path: folder.path }
        : { folderId: folder.folderFileId ?? folder.path }
      return scanFolderTree({
        type: source.type,
        accountName: source.name,
        provider,
        cred: effectiveCred,
        ref: { ...ref, path: folder.path },
        isTv,
        signal,
        gate,
        onProgress,
        onBatch,
      })
    })
  )

  const items = []
  const errors = []
  // 根目录内部的子目录/挂载失效被跳过时，由 scanFolderTree 收集到这里。
  // 与 errors 区分：errors 是「整个根目录废掉」，skipped 是「根目录里某个子树没刮成」。
  const skipped = []
  results.forEach(r => {
    if (r.status === 'fulfilled') {
      items.push(...r.value.items)
      if (r.value.skipped?.length) skipped.push(...r.value.skipped)
    } else {
      errors.push(r.reason)
      console.warn('[scrape/scan] 目录扫描失败:', r.reason)
    }
  })

  // 所有目录都失败 → 是错误，不是「空目录」
  if (errors.length && errors.length === results.length) {
    const first = errors[0]
    const err = new Error(first?.message || `${source.type} 扫描失败`)
    err.isAuthError = !!first?.tokenExpired || first?.code === 401
    err.cause = first
    throw err
  }

  // rootPaths 供上层判断「本轮到底扫了哪些范围」。
  // 重刮时只有落在这个范围内的旧条目才允许被判为「已从网盘删除」，
  // 否则用户只是把某个导入目录取消勾选了，其下的片会被误删。
  const rootPaths = folders.map(f => String(f.path || '')).filter(Boolean)

  return { items, failed: errors.length, errors, skipped, total: folders.length, rootPaths }
}
