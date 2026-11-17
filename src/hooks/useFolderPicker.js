/**
 * 目录树多选状态机（跨端共用）。
 *
 * 三端（移动 / TV / PC）的渲染与交互不同，但「浏览目录树 + 勾选 + 勾父级即递归」
 * 的状态逻辑完全一样，抽到这里避免三份实现各自跑偏。
 *
 * 复用的现成能力：
 *   - listSourceFolder(type, ref, cred)  取目录列表（utils/sources/registry）
 *   - getSourceDef(type).navigateBy      决定 ref 形状：path 还是 folderId
 *
 * 勾选键统一用 path：path 在整棵树里唯一，跨层级下钻后依然稳定，
 * 而 folderId 在部分源（alist）是按目录返回的，不适合做跨层标识。
 */
import { computed, ref } from 'vue'
import { getSourceDef, listSourceFolder } from '@/utils/sources/registry'

// 路径拼接，避免出现 // 或首尾斜杠不一致
const joinPath = (parent, name) => {
  const p = String(parent || '').replace(/\/+$/, '')
  const n = String(name || '').replace(/^\/+/, '')
  return (p || '') + '/' + n
}

const parentPath = path => {
  const parts = String(path || '').split('/').filter(Boolean)
  parts.pop()
  return parts.length ? '/' + parts.join('/') : '/'
}

const basename = path => String(path || '').split('/').filter(Boolean).pop() || ''

/**
 * @param {object} opts
 * @param {string} opts.type  源类型
 * @param {object} opts.cred  该源凭据（需已带有效 token / cookie）
 * @param {string} [opts.rootPath] 起始路径，默认根目录
 */
export function useFolderPicker({ type, cred, rootPath = '/' }) {
  const def = getSourceDef(type)
  // WebDAV(alist) 用 path 导航，其余云盘用 folderId
  const navigateByPath = (def?.navigateBy || 'path') === 'path'

  // 凭据与类型用 ref 持有：页面往往先 onLoad 拿到账号、刷新 token 后
  // 才真正可用，若在构造时固化成普通变量，后续换 token 就取不到
  const activeType = ref(type)
  const activeCred = ref(cred || {})

  const currentPath = ref(rootPath)
  // 非 path 导航的源需要记录每一层的 folderId
  const folderIdStack = ref([])
  const currentFolderId = ref(getSourceDef(type)?.rootId || null)

  const list = ref([])
  const loading = ref(false)
  const error = ref('')

  // 勾选表：path -> { path, name, folderId, isFolder, added?, target? }
  //   added  = 进入目录树时该目录已导入（回填出来的），保存时原样保留其 target
  //   target = 既有条目的导入目标，仅供 syncEntries 参考
  const checked = ref({})

  // 回填进来的既有条目（只读快照），用于「已添加」徽标与统计提示
  const initialEntries = ref([])

  const breadcrumb = computed(() => {
    const parts = String(currentPath.value || '/').split('/').filter(Boolean)
    return [{ path: '/', name: '/' }, ...parts.map((p, i) => ({ path: '/' + parts.slice(0, i + 1).join('/'), name: p }))]
  })

  const currentRef = () => {
    if (navigateByPath) return { path: currentPath.value }
    return { folderId: currentFolderId.value, path: currentPath.value }
  }

  /**
   * 切换到某个源账号。通常在页面 onLoad 里换好 token 后调用一次。
   */
  const setSource = (newType, newCred) => {
    activeType.value = newType
    activeCred.value = newCred || {}
    currentFolderId.value = getSourceDef(newType)?.rootId || null
    folderIdStack.value = []
    currentPath.value = rootPath
    list.value = []
    checked.value = {}
    initialEntries.value = []
  }

  /**
   * 回填已导入条目（编辑文件源后的目录树）。
   *
   * 必须在上面的 setSource 之后调用 —— setSource 会清空勾选表。
   * 回填的是该账号**全部** entries（含深层、当前层看不到的），
   * 这样用户只有显式取消才会被 syncEntries 判为删除。
   *
   * @param {Array} entries muluData.entries 中属于本账号的条目
   */
  const setInitialEntries = (entries = []) => {
    initialEntries.value = Array.isArray(entries) ? entries.map(e => ({ ...e })) : []
    const next = { ...checked.value }
    initialEntries.value.forEach(e => {
      if (!e?.path) return
      next[e.path] = {
        path: e.path,
        name: basename(e.path),
        folderId: e.folderFileId ?? null,
        isFolder: true,
        added: true,
        target: e.target,
        inheritChildren: !!e.inheritChildren,
      }
    })
    checked.value = next
  }

  /** 拉取当前层列表 */
  const listCurrent = async () => {
    loading.value = true
    error.value = ''
    try {
      const res = await listSourceFolder(activeType.value, currentRef(), activeCred.value)
      list.value = res?.list || []
    } catch (e) {
      error.value = e?.message || '目录读取失败'
      list.value = []
      throw e
    } finally {
      loading.value = false
    }
  }

  /** 下钻到某个目录 */
  const enter = async folder => {
    if (!folder?.isFolder) return
    const next = joinPath(currentPath.value, folder.name)
    if (!navigateByPath) {
      folderIdStack.value.push(currentFolderId.value)
      currentFolderId.value = folder.id
    }
    currentPath.value = next
    checked.value = { ...checked.value }
    await listCurrent()
  }

  /** 返回上级 */
  const back = async () => {
    if (currentPath.value === '/' || !currentPath.value) return false
    currentPath.value = parentPath(currentPath.value)
    if (!navigateByPath) {
      currentFolderId.value = folderIdStack.value.pop() ?? (getSourceDef(activeType.value)?.rootId || null)
    }
    await listCurrent()
    return true
  }

  /** 跳到面包屑的某一层 */
  const jumpTo = async path => {
    if (navigateByPath) {
      currentPath.value = path || '/'
      await listCurrent()
      return
    }
    // 非 path 导航无法直接按路径跳，逐层回退
    while (currentPath.value !== '/' && currentPath.value.length > String(path || '/').length) {
      if (!(await back())) break
    }
  }

  const itemPath = item => joinPath(currentPath.value, item.name)

  const isChecked = item => !!checked.value[itemPath(item)]

  /** 当前行是否为「进入时就已经导入」的目录（用于列表里的已添加徽标） */
  const isAdded = item => !!checked.value[itemPath(item)]?.added

  /** 构造勾选项；若是回填过的既有目录，重新勾选时恢复其 added/target */
  const makeChecked = (path, name, folderId, isFolder) => {
    const initial = initialEntries.value.find(e => e.path === path)
    return {
      path,
      name,
      folderId: folderId ?? null,
      isFolder: !!isFolder,
      // 既有条目被取消后再勾回来，仍按「原本就有的」处理，不能当成新增而丢掉旧 target
      ...(initial ? { added: true, target: initial.target, inheritChildren: !!initial.inheritChildren } : {}),
    }
  }

  /** 勾选 / 取消 */
  const toggle = item => {
    const p = itemPath(item)
    const next = { ...checked.value }
    if (next[p]) delete next[p]
    else next[p] = makeChecked(p, item.name, item.id, item.isFolder)
    checked.value = next
  }

  /** 当前层是否已全选（空目录视为未全选） */
  const allCheckedInCurrent = computed(() => {
    if (!list.value.length) return false
    return list.value.every(item => !!checked.value[itemPath(item)])
  })

  /** 全选 / 取消全选当前层 */
  const toggleAllInCurrent = () => {
    const next = { ...checked.value }
    if (allCheckedInCurrent.value) {
      list.value.forEach(item => delete next[itemPath(item)])
    } else {
      list.value.forEach(item => {
        const p = itemPath(item)
        next[p] = makeChecked(p, item.name, item.id, item.isFolder)
      })
    }
    checked.value = next
  }

  const checkedList = computed(() => Object.values(checked.value))

  /**
   * 解析出最终要导入的目录列表。
   *
   * 父级覆盖：如果当前层的**全部子项**都被勾选，说明用户想导入整个文件夹，
   * 这时用当前目录替换所有子项并标记 inheritChildren —— 这样该目录内
   * 后续新增/删除的视频会自动同步，不需要重新勾选。
   *
   * @param {boolean} applyParent 是否启用父级覆盖（用户在询问框点「是」）
   * @returns {Array<{path, folderFileId, inheritChildren}>}
   */
  const resolvePicked = (applyParent = false) => {
    const picked = checkedList.value
    // added / target 必须带出去：syncEntries 靠它们区分「既有条目」与「本次新勾」
    const toItem = p => ({
      path: p.path,
      folderFileId: p.folderId,
      // 既有条目带回来的「自动同步」标记要原样保留，否则改个源就把它丢了
      inheritChildren: !!p.inheritChildren,
      added: !!p.added,
      target: p.target,
    })

    if (!applyParent || !allCheckedInCurrent.value || currentPath.value === '/') {
      return picked.map(toItem)
    }

    // 父目录替换子项：当前目录本身若是已导入的，这个替换等于原样保留
    const replacePrefix = currentPath.value + '/'
    const parentInitial = initialEntries.value.find(e => e.path === currentPath.value)
    return [
      ...picked.filter(p => !p.path.startsWith(replacePrefix)).map(toItem),
      {
        path: currentPath.value,
        folderFileId: currentFolderId.value,
        inheritChildren: true,
        added: !!parentInitial,
        target: parentInitial?.target,
      },
    ]
  }

  /**
   * 编辑模式的统计提示用：回填了多少个目录、其中多少个不在当前层之下。
   * 后者的意义是提醒用户「深层目录仍然保留着，别以为丢了」。
   */
  const initialStats = computed(() => {
    const total = initialEntries.value.length
    const cur = currentPath.value
    // 当前层能看到的只有「直接子级」；更深的目录虽然仍被勾着，但用户此刻看不见，
    // 所以要单独计数提醒一句，否则会以为自己的深层目录被清掉了
    const visible = initialEntries.value.filter(e => parentPath(e.path) === cur).length
    return { total, hidden: Math.max(0, total - visible) }
  })

  /** 清空勾选（例如切换源账号时） */
  const reset = () => {
    checked.value = {}
    initialEntries.value = []
    currentPath.value = rootPath
    folderIdStack.value = []
    currentFolderId.value = getSourceDef(activeType.value)?.rootId || null
    list.value = []
  }

  return {
    // 状态
    currentPath,
    currentFolderId,
    breadcrumb,
    list,
    loading,
    error,
    checked,
    checkedList,
    allCheckedInCurrent,
    navigateByPath,
    initialEntries,
    initialStats,
    currentName: computed(() => basename(currentPath.value)),
    // 操作
    listCurrent,
    setSource,
    setInitialEntries,
    enter,
    back,
    jumpTo,
    isChecked,
    isAdded,
    toggle,
    toggleAllInCurrent,
    resolvePicked,
    reset,
    itemPath,
  }
}
