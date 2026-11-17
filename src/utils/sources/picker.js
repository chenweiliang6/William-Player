/**
 * 目录树页统一入口。
 *
 * 对齐网易爆米花：**加源和改源的最后一步都是「选目录」**，
 * 而不是只有首次添加才让用户勾目录、以后只能去「导入目录管理」里单独改。
 *
 * 两端路径不同（PC 走 vue-router，不经过这里）：
 *   - 手机：/pages/mobile/media/folder-picker
 *   - TV：  /pages/tv/source/folder-picker
 */

export const FOLDER_PICKER_PATH = {
  mobile: '/pages/mobile/media/folder-picker',
  tv: '/pages/tv/source/folder-picker',
  pc: '/folder-picker',
}

/**
 * 表单类页面：从这些页面进入目录树时，需要先退回到它们**下面**那一层。
 *
 * 为什么要退：目录树应当盖在「资源库列表」或「首页」之上，
 * 这样用户从目录树返回时看到的是列表，而不是已经提交完的表单。
 */
const FORM_ROUTES = new Set([
  'pages/mobile/source/file-source',
  'pages/mobile/source/add-webdav',
  'pages/mobile/source/add-emby',
  'pages/mobile/source/add-cloud189',
  'pages/mobile/source/add-cloud139',
  'pages/mobile/source/add-wopan',
  'pages/mobile/backend/quark-webview',
  'pages/tv/source/code-input',
])

/**
 * 按页面栈算出该退几层。
 *
 * 写死 delta 会出错，因为同一页既可能从「来源列表」直达（新增），
 * 也可能经「选择源类型」页进来（修改），两条路径深度不一样。
 */
export const resolveBackDelta = () => {
  if (typeof getCurrentPages !== 'function') return 0
  const pages = getCurrentPages() || []
  let delta = 0
  for (let i = pages.length - 1; i >= 0; i--) {
    if (!FORM_ROUTES.has(pages[i]?.route)) break
    delta++
  }
  // 全栈都是表单页时不退，避免把页面退空
  return delta >= pages.length ? 0 : delta
}

/**
 * @param {object} opts
 * @param {string} opts.type       源类型
 * @param {string} opts.name       账号名
 * @param {'add'|'edit'} [opts.mode] 目录树模式：新增首次勾选 / 修改后回填调整
 * @param {string} [opts.path]     目录树页路径，缺省手机端
 * @param {number} [opts.backDelta] 先回退的层数；不传则按页面栈自动推导
 */
export const openFolderPicker = ({ type, name, mode = 'add', path, backDelta }) => {
  const url = `${path || FOLDER_PICKER_PATH.mobile}?type=${encodeURIComponent(type)}&name=${encodeURIComponent(name)}&mode=${mode}`
  const delta = backDelta == null ? resolveBackDelta() : backDelta
  if (delta > 0) {
    uni.navigateBack({ delta })
    // 等回退动画结束再打开，否则部分机型会把两个导航动作合并成一次
    setTimeout(() => uni.navigateTo({ url }), 300)
  } else {
    uni.navigateTo({ url })
  }
}