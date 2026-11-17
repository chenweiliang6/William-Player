/**
 * muluData 统一读写门面。
 *
 * 为什么需要这一层：
 *   旧代码在 20+ 处直接 uni.getStorageSync('muluData') 并手改 movie/tv 两桶，
 *   其中 6 处「账号改名同步」各写了一遍，逻辑还不一致
 *   （wopan/store.js 操作的 v.list 字段根本不存在，是既存 bug）。
 *
 * 结构演进：
 *   旧：{ tv: [{type,name,path,folderFileId?}], movie: [...] }
 *        —— 目录被用户手工声明成「电视剧目录 / 电影目录」，也就是「目录即类型」
 *   新：{ entries: [{type,name,path,folderFileId?,target,inheritChildren,importedAt}] }
 *        —— 目录只是「扫描起点」，类型由扫描器按内容判定；
 *           target 区分「导入到媒体库（刮削）」与「仅资源库（不刮削）」
 *
 * 兼容策略：
 *   - 旧 tv/movie 两桶**保留写入**，老版本 App 回滚后仍能读
 *   - 但 entries 一旦生成就是唯一权威来源，扫描不再读旧桶
 *     （否则用户删掉的导入目录会被旧桶残条复活）
 */
export const MULU_STORAGE_KEY = 'muluData'

// 导入目标
export const TARGET = {
  MEDIA: 'media', // 导入到媒体库：自动识别、进海报墙
  RESOURCE: 'resource', // 仅资源库：不识别，按原始目录结构浏览
}

/**
 * 条目键：同一源账号下的同一路径视为同一条
 */
const entryKey = (type, name, path) => `${type}::${name}::${path || ''}`

const readRaw = () => {
  try {
    return uni.getStorageSync(MULU_STORAGE_KEY) || {}
  } catch {
    return {}
  }
}

/**
 * 旧结构 → 新结构的纯函数迁移。幂等。
 *
 * 迁移规则：旧 tv/movie 两桶里的目录一律视为「导入到媒体库」。
 * 两桶里重复出现的同一路径只保留一条（旧逻辑允许同一目录同时进两桶）。
 *
 * @param {object} mulu 旧的或新的 muluData
 * @returns {object} 带 entries 的新结构（旧桶原样保留）
 */
export const migrateMuluV1toV2 = mulu => {
  const src = mulu && typeof mulu === 'object' ? mulu : {}
  // 已有 entries 就不再派生，避免把用户删掉的条目重新加回来
  if (Array.isArray(src.entries)) return src

  const entries = []
  const seen = new Set()
  const push = v => {
    if (!v?.type || !v?.name || !v?.path) return
    const key = entryKey(v.type, v.name, v.path)
    if (seen.has(key)) return
    seen.add(key)
    entries.push({
      type: v.type,
      name: v.name,
      path: v.path,
      folderFileId: v.folderFileId ?? null,
      target: TARGET.MEDIA,
      inheritChildren: false,
      importedAt: Date.now(),
    })
  }

  ;(src.movie || []).forEach(push)
  ;(src.tv || []).forEach(push)

  return { ...src, entries }
}

/**
 * 读 muluData。若 entries 尚未生成，自动迁移并回写一次。
 */
export const readMulu = () => {
  const raw = readRaw()
  if (Array.isArray(raw.entries)) return raw
  const migrated = migrateMuluV1toV2(raw)
  // 迁移结果只在确实有内容时回写，避免给全新用户塞一个空 entries
  try {
    uni.setStorageSync(MULU_STORAGE_KEY, migrated)
  } catch {
    // 存储失败不影响本次读取
  }
  return migrated
}

/**
 * 写 muluData。写前保证 entries 存在。
 */
export const writeMulu = mulu => {
  const next = Array.isArray(mulu?.entries) ? mulu : migrateMuluV1toV2(mulu)
  try {
    uni.setStorageSync(MULU_STORAGE_KEY, next)
  } catch (e) {
    console.warn('[mulu] 写入失败:', e?.message)
  }
  return next
}

/**
 * 取某个源账号的导入条目。
 *
 * @param {string} type   源类型
 * @param {string} name   账号名
 * @param {'media'|'resource'} [target] 不传则返回全部
 */
export const getEntries = (type, name, target) =>
  (readMulu().entries || []).filter(
    e => e.type === type && e.name === name && (!target || (e.target || TARGET.MEDIA) === target),
  )

/**
 * 添加/更新导入条目。
 *
 * @param {object} opts
 * @param {string} opts.type
 * @param {string} opts.name
 * @param {Array}  opts.picked  [{ path, folderFileId, inheritChildren }]
 * @param {'media'|'resource'} opts.target
 * @returns {object} 新的 muluData
 */
export const addEntries = ({ type, name, picked = [], target = TARGET.MEDIA }) => {
  const mulu = readMulu()
  const entries = [...(mulu.entries || [])]
  const index = new Map(entries.map(e => [entryKey(e.type, e.name, e.path), e]))

  picked.forEach(p => {
    if (!p?.path) return
    const key = entryKey(type, name, p.path)
    const existed = index.get(key)
    if (existed) {
      // 已存在：只更新目标与递归标记，不重复插入
      existed.target = target
      existed.inheritChildren = !!p.inheritChildren
      if (p.folderFileId != null) existed.folderFileId = p.folderFileId
      return
    }
    const entry = {
      type,
      name,
      path: p.path,
      folderFileId: p.folderFileId ?? null,
      target,
      inheritChildren: !!p.inheritChildren,
      importedAt: Date.now(),
    }
    entries.push(entry)
    index.set(key, entry)
  })

  return writeMulu({ ...mulu, entries })
}

/**
 * 编辑模式整体同步：以 picked 为准替换该账号的目录集合。
 *
 * 与 addEntries 的区别：addEntries 只增不删，无法表达「编辑后我取消了某个目录」。
 * 这里按差异同步，用于「修改文件源 → 目录树回填 → 保存」的链路。
 *
 * 判定规则：
 *   - picked 项带 added:true = 进入目录树时回填的既有条目，本次仍勾选 → 保留原 target
 *   - picked 项不带 added = 本次新勾 → 用传入的 target
 *   - 现有条目不在 picked 里 = 用户在树上显式取消 → 删除
 *
 * 关键前提：回填会把该账号**全部** entries（含深层、当前层看不到的）塞进勾选表，
 * 所以 picked 天然包含它们，不会因为「当前目录没显示」而被误删。
 *
 * @param {object} opts
 * @param {string} opts.type
 * @param {string} opts.name
 * @param {Array}  opts.picked  [{ path, folderFileId, inheritChildren, added, target }]
 * @param {'media'|'resource'} opts.target 新勾选目录的导入目标
 * @returns {{ added:number, removed:number, mediaTouched:boolean }}
 */
export const syncEntries = ({ type, name, picked = [], target = TARGET.MEDIA }) => {
  const mulu = readMulu()
  const prevEntries = mulu.entries || []
  // 只处理本账号，其余账号原样保留
  const others = prevEntries.filter(e => !(e.type === type && e.name === name))
  const prevMap = new Map(
    prevEntries.filter(e => e.type === type && e.name === name).map(e => [e.path, e]),
  )

  const nextMine = []
  const seen = new Set()
  let added = 0
  let mediaTouched = false

  picked.forEach(p => {
    if (!p?.path || seen.has(p.path)) return
    seen.add(p.path)
    const prev = prevMap.get(p.path)
    if (prev) {
      // 既有条目：保留原 target，只更新可变的递归标记与 id
      nextMine.push({
        ...prev,
        inheritChildren: p.inheritChildren != null ? !!p.inheritChildren : prev.inheritChildren,
        folderFileId: p.folderFileId ?? prev.folderFileId ?? null,
      })
      return
    }
    added++
    const nextTarget = p.target || target
    if (nextTarget === TARGET.MEDIA) mediaTouched = true
    nextMine.push({
      type,
      name,
      path: p.path,
      folderFileId: p.folderFileId ?? null,
      target: nextTarget,
      inheritChildren: !!p.inheritChildren,
      importedAt: Date.now(),
    })
  })

  let removed = 0
  prevMap.forEach((e, path) => {
    if (seen.has(path)) return
    removed++
    if ((e.target || TARGET.MEDIA) === TARGET.MEDIA) mediaTouched = true
  })

  const entries = [...others, ...nextMine]
  writeMulu({ ...mulu, entries })
  return { added, removed, mediaTouched }
}

/**
 * 移除一个导入条目。
 */
export const removeEntry = ({ type, name, path }) => {
  const mulu = readMulu()
  const key = entryKey(type, name, path)
  const entries = (mulu.entries || []).filter(e => entryKey(e.type, e.name, e.path) !== key)
  return writeMulu({ ...mulu, entries })
}

/**
 * 账号改名时同步所有目录配置。
 *
 * 取代原先 6 处各写一遍的实现（add-webdav / add-emby / cloud189 / wopan /
 * cloud139 / quark-webview），并修掉 wopan 那处操作不存在字段的 bug。
 *
 * @param {string} type
 * @param {string} oldName
 * @param {string} newName
 */
export const renameAccount = (type, oldName, newName) => {
  if (!type || !oldName || !newName || oldName === newName) return readMulu()
  const mulu = readMulu()

  const entries = (mulu.entries || []).map(e =>
    e.type === type && e.name === oldName ? { ...e, name: newName } : e,
  )

  // 旧桶一并改名，保证回滚到老版本时配置仍然对得上
  const renameInBucket = list => (list || []).map(v =>
    v.type === type && v.name === oldName ? { ...v, name: newName } : v,
  )
  const next = {
    ...mulu,
    entries,
    movie: renameInBucket(mulu.movie),
    tv: renameInBucket(mulu.tv),
  }
  return writeMulu(next)
}

/**
 * 数据同步接收端：先迁移再整体写入。
 *
 * 三个同步入口（mobile/tv 的 data-sync、mine/index）都走这里，
 * 避免跨版本同步时把旧结构原样落盘导致 entries 始终缺失。
 */
export const writeMuluFromSync = data => {
  if (!data || typeof data !== 'object') return readMulu()
  return writeMulu(migrateMuluV1toV2(data))
}

/**
 * 清空某个源账号的全部导入配置（删除数据源时调用）。
 */
export const clearAccount = ({ type, name }) => {
  const mulu = readMulu()
  const keepEntry = e => !(e.type === type && e.name === name)
  return writeMulu({
    ...mulu,
    entries: (mulu.entries || []).filter(keepEntry),
    movie: (mulu.movie || []).filter(keepEntry),
    tv: (mulu.tv || []).filter(keepEntry),
  })
}
