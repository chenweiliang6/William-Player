/**
 * 来源注册表。
 *
 * 目前只覆盖「扫描 / 刮削」链路所需的能力（阶段 0-A 范围）。
 * 后续阶段会在此补齐 listFolder（目录浏览）、getDownloadUrl（下载）、
 * formOptions/login（三端登录链）等能力。
 *
 * type 字符串必须与 sourceList 分组 type 完全一致，避免存量数据迁移。
 */
import { getFolder, get189Folder, getQuarkFolder, getWopanFolder, get139Folder, loginUser } from '@/utils/common'
import { normalizeList } from './normalize'

/**
 * @typedef {Object} SourceDef
 * @property {string} type          sourceList 分组 type
 * @property {string} providerId    写入 localMovieTvData[].provider；null 表示取自响应
 * @property {'directory'|'server'} kind
 * @property {'path'|'id'} navigateBy       WebDAV 用 path 导航，其余用 folderId
 * @property {string} [rootId]      根目录 id
 * @property {string} envelope      归一化信封类型
 * @property {Function} fetch       取目录列表，返回原始响应。
 *         签名 (ref, cred, opts) —— opts.timeout 用于刮削时覆盖请求超时，
 *         不传则各源保持自己的默认值。
 * @property {string} [thumbField]  缩略图字段名
 */

/** @type {SourceDef[]} */
export const SOURCE_REGISTRY = [
  {
    type: 'WebDAV',
    // alist 的 provider 由服务端 driver 决定，取值不封闭，必须来自响应
    providerId: null,
    kind: 'directory',
    navigateBy: 'path',
    envelope: 'alist',
    fetch: (ref, cred, opts) => getFolder({ path: ref.path }, cred, opts),
    // 扫描前必须重新登录换 token：alist 的 token 有有效期，
    // sourceList 里存的那份可能早已过期（表现为 code 401 / 静默空列表）
    prepare: cred => loginUser(cred),
  },
  {
    type: '天翼云盘',
    providerId: '189CloudPC',
    kind: 'directory',
    navigateBy: 'id',
    rootId: '-11',
    envelope: 'fileListAO',
    fetch: (ref, cred, opts) => get189Folder({ folderId: ref.folderId }, cred, opts),
  },
  {
    type: '夸克网盘',
    providerId: 'Quark',
    kind: 'directory',
    navigateBy: 'id',
    rootId: '0',
    envelope: 'quark',
    fetch: (ref, cred, opts) => getQuarkFolder({ fid: ref.folderId }, cred, opts),
  },
  {
    type: '联通云盘',
    providerId: 'WoPan',
    kind: 'directory',
    navigateBy: 'id',
    rootId: '0',
    envelope: 'fileListAO',
    fetch: (ref, cred, opts) => getWopanFolder({ folderId: ref.folderId }, cred, opts),
  },
  {
    type: '移动云盘',
    providerId: 'Cloud139',
    kind: 'directory',
    navigateBy: 'id',
    rootId: 'root',
    envelope: 'fileListAO',
    fetch: (ref, cred, opts) => get139Folder({ folderId: ref.folderId }, cred, opts),
  },
  {
    type: 'Emby',
    providerId: 'Emby',
    // Emby 是服务端媒体库：一次性 Recursive 拉取，不遍历目录树，不走刮削链路
    kind: 'server',
    navigateBy: 'id',
    envelope: null,
    fetch: null,
  },
]

const BY_TYPE = SOURCE_REGISTRY.reduce((acc, def) => {
  acc[def.type] = def
  return acc
}, {})

export const getSourceDef = type => BY_TYPE[type]

export const isDirectorySource = type => getSourceDef(type)?.kind === 'directory'

export const isServerSource = type => getSourceDef(type)?.kind === 'server'

/**
 * 取来源目录列表并归一。
 * @param {string} type 来源 type
 * @param {object} ref  { path } 或 { folderId }
 * @param {object} cred 该来源的凭据条目（sourceList.list 中的一项）
 * @param {object} [opts] 透传给底层请求的选项，目前只有 timeout。
 *        刮削链路会传一个近似无限的值（见 scrape/constants.js 的
 *        SCRAPE_UNBOUNDED_TIMEOUT），普通目录浏览不传、走各源默认超时。
 * @returns {Promise<{list:Array,total:number,provider?:string}>}
 */
export const listSourceFolder = async (type, ref, cred, opts = {}) => {
  const def = getSourceDef(type)
  if (!def || !def.fetch) {
    throw new Error(`来源 ${type} 不支持目录列举`)
  }
  const res = await def.fetch(ref, cred, opts)
  const normalized = normalizeList(def.envelope, res)
  // WebDAV 的 provider 来自响应，其余用注册表常量
  normalized.provider = def.providerId || normalized.provider
  return normalized
}

/**
 * 扫描前的准备动作。目前只有 WebDAV 需要（换新 token）。
 * 返回可用于后续请求的 cred —— WebDAV 的新 token 必须写回，
 * 否则后续 fetch 仍用旧 token。
 *
 * @returns {Promise<object>} 更新后的 cred（无条件返回新对象，调用方直接替换）
 */
export const prepareSource = async (type, cred) => {
  const def = getSourceDef(type)
  if (!def?.prepare) return cred

  let res
  try {
    res = await def.prepare(cred)
  } catch (e) {
    // 网络层失败（服务没开、地址错）与账号错要分开提示
    const err = new Error('无法连接到服务器，请检查地址、端口和服务是否已启动')
    err.isConnectError = true
    err.cause = e
    throw err
  }

  // alist 登录失败也是 HTTP 200 + body.code != 200，没有 token
  const token = res?.data?.token
  if (!token) {
    const err = new Error(res?.message || '账号或密码不正确，登录失败')
    err.isAuthError = true
    err.code = res?.code
    throw err
  }
  return { ...cred, token }
}
