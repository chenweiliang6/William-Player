/**
 * 各来源列表响应的归一化。
 *
 * 现状有三种互不兼容的信封，调用方各自归一了 4 遍：
 *   - alist:   { data: { content: [], total, provider } }        (WebDAV)
 *   - fileListAO: { fileListAO: { fileList, folderList, count } } (天翼/联通/移动)
 *   - quark:   { data: { list: [] }, metadata: { _total } }       (夸克)
 *
 * 这里统一成：
 *   { list: [{ id, name, isFolder, size, createTime, updateTime, thumb, path }], total, provider }
 */

// 各来源的「信封里带错误」判定。
// 这些源即使业务失败也返回 HTTP 200，错误藏在 body 里，
// 不识别就会把「登录失效」当成「空目录」。
const detectEnvelopeError = (envelope, res) => {
  if (!res || typeof res !== 'object') return '响应为空'

  if (envelope === 'alist') {
    if (res.code !== 200) return res.message || `code ${res.code}`
    return null
  }
  if (envelope === 'fileListAO') {
    // 天翼 189：res_code 非 0 即失败（成功恒定注入 0）
    if (res.res_code !== undefined && res.res_code !== 0) {
      return res.res_message || `res_code ${res.res_code}`
    }
    // 联通/移动在 request 层已抛错，走到这里的 fileListAO 缺失才算异常
    if (!res.fileListAO) return '响应缺少 fileListAO'
    return null
  }
  if (envelope === 'quark') {
    if (!res.data && res.message) return res.message
    if (!res.data?.list && res.code && res.code !== 0) return res.message || `code ${res.code}`
    return null
  }
  return null
}

//alist 的 type 是字符串 '1'(目录) / '0'(文件)
const normalizeAlist = res => {
  const content = res?.data?.content || []
  const list = content.map(v => ({
    id: v.id,
    name: v.name,
    isFolder: v.type == '1',
    size: v.size,
    createTime: v.modified || v.created,
    updateTime: v.modified,
    thumb: v.thumb,
  }))
  return { list, total: res?.data?.total || list.length, provider: res?.data?.provider }
}

//天翼/联通/移动：folderList 与 fileList 分开返回，字段名各家略有差异
const normalizeFileListAO = (res, thumbField = 'thumbUrl') => {
  const ao = res?.fileListAO || {}
  const folders = (ao.folderList || []).map(v => ({
    id: v.id,
    name: v.name,
    isFolder: true,
    size: v.size,
    createTime: v.createTime || v.createDate,
    updateTime: v.updateTime || v.lastOpTime,
    thumb: thumbField ? v[thumbField] : undefined,
  }))
  const files = (ao.fileList || []).map(v => ({
    id: v.id,
    name: v.name,
    isFolder: false,
    size: v.size,
    createTime: v.createTime || v.createDate,
    updateTime: v.updateTime || v.lastOpTime,
    //天翼的缩略图藏在 icon.largeUrl 里
    thumb: thumbField ? v[thumbField] || v?.icon?.largeUrl : v?.icon?.largeUrl,
  }))
  return { list: [...folders, ...files], total: ao.count ?? folders.length + files.length }
}

//夸克：混合列表，file_type '0' 是目录
const normalizeQuark = res => {
  const items = res?.data?.list || []
  const list = items.map(v => ({
    id: v.fid,
    name: v.file_name,
    isFolder: v.file_type == '0',
    size: v.size,
    createTime: v.created_at,
    updateTime: v.updated_at,
    thumb: v.big_thumbnail,
  }))
  return { list, total: res?.metadata?._total ?? list.length }
}

const NORMALIZERS = {
  alist: normalizeAlist,
  fileListAO: normalizeFileListAO,
  quark: normalizeQuark,
}

/**
 * 按来源声明的 envelope 类型归一。
 * @param {string} envelope 'alist' | 'fileListAO' | 'quark'
 * @param {object} res 原始响应
 * @param {object} opts 各来源的细微差异配置，如 { thumbField }
 */
export const normalizeList = (envelope, res, opts = {}) => {
  const fn = NORMALIZERS[envelope]
  if (!fn) {
    throw new Error(`未知的列表信封类型: ${envelope}`)
  }
  const errMessage = detectEnvelopeError(envelope, res)
  if (errMessage) {
    const err = new Error(errMessage)
    err.isEnvelopeError = true
    err.code = res?.code ?? res?.res_code
    err.tokenExpired = err.code === 401
    throw err
  }
  return fn(res, opts)
}

export { normalizeAlist, normalizeFileListAO, normalizeQuark }
