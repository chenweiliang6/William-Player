// 联通云盘数据层：文件列表 / 下载地址 / 会话恢复（参照 cloud189/data.js 模式）
import { WOPAN_CLIENT_ID } from './crypto.js'
import { requestWoHome } from './request.js'
import { refreshWopanToken, getWopanUserInfo } from './login.js'
import { updateWopanTokenInStorage } from './store.js'

// 个人云（仅支持个人云，对齐需求决策）
const SPACE_TYPE_PERSONAL = '0'

let ensureSessionPromise = null

/**
 * access token 失效时用 refreshToken 刷新并回写（Promise 去重，参照 ensureSession189）
 * @param {object} credential {accessToken, refreshToken}
 */
export const ensureWopanSession = async credential => {
  if (!ensureSessionPromise) {
    ensureSessionPromise = (async () => {
      try {
        // 先用现有 token 试一次用户信息，可用则直接返回
        if (credential.accessToken) {
          await getWopanUserInfo(credential.accessToken)
          return credential
        }
        throw { code: 'WOPAN_NEED_REFRESH' }
      } catch (e) {
        if (!credential.refreshToken) {
          throw { code: 'NEED_MANUAL_LOGIN' }
        }
        try {
          const newToken = await refreshWopanToken(credential.refreshToken)
          updateWopanTokenInStorage(newToken.accessToken, newToken.refreshToken)
          return { ...credential, accessToken: newToken.accessToken, refreshToken: newToken.refreshToken }
        } catch (e2) {
          throw { code: 'NEED_MANUAL_LOGIN' }
        }
      }
    })().finally(() => {
      ensureSessionPromise = null
    })
  }
  return ensureSessionPromise
}

/**
 * 拉取单页文件列表（QueryAllFiles）
 * @param {string} folderId 目录 id（根目录传 '0'）
 * @param {object} credential {accessToken, refreshToken}
 * @param {number} pageNum 页码（0 起）
 * @param {number} pageSize
 * @param {number} [timeout] 单页请求超时，不传时用 httpPost 的 20000 默认值
 * @returns {Promise<Array>} wopan File 数组
 */
export const queryWopanFilesPage = (folderId, credential, pageNum = 0, pageSize = 100, timeout) =>
  requestWoHome({
    key: 'QueryAllFiles',
    param: {
      spaceType: SPACE_TYPE_PERSONAL,
      parentDirectoryId: String(folderId),
      pageNum,
      pageSize,
      sortRule: 1, // 1 = name_asc（对齐 Go SortNameAsc）
      clientId: WOPAN_CLIENT_ID,
    },
    other: { secret: true },
    accessToken: credential.accessToken,
    refreshToken: credential.refreshToken,
    timeout,
  })

/**
 * 拉取目录全部文件（循环分页，对齐 Alist wopan driver List）
 * 映射为与天翼云盘一致的 fileListAO 结构，供上层零改动复用
 * @param {object} [opts] { timeout } 刮削时用来取消超时限制，每一页都用同一个值
 * @returns {Promise<{fileListAO: {fileList, folderList, count}}>}
 */
export const listWopanFiles = async (folderId, credential, opts = {}) => {
  const pageSize = 100
  let pageNum = 0
  const all = []
  for (;;) {
    const data = await queryWopanFilesPage(folderId, credential, pageNum, pageSize, opts.timeout)
    const files = data.files || []
    all.push(...files)
    if (files.length < pageSize) break
    pageNum++
  }
  //联通接口未返回独立的更新时间，缺失时回退到 createTime，
  //保持与天翼/移动一致的字段契约，避免上层各自兜底
  const pickTime = v => ({
    createTime: v.createTime,
    updateTime: v.updateTime || v.modifyTime || v.createTime,
  })
  const fileList = all
    .filter(v => v.type != 0)
    .map(v => ({
      id: v.id,
      fid: v.fid,
      name: v.name,
      size: Number(v.size || 0),
      ...pickTime(v),
      thumbUrl: v.thumbUrl,
    }))
  const folderList = all
    .filter(v => v.type == 0)
    .map(v => ({
      id: v.id,
      name: v.name,
      ...pickTime(v),
    }))
  return {
    fileListAO: {
      fileList,
      folderList,
      count: all.length,
    },
  }
}

/**
 * 获取下载/播放直链（GetDownloadUrlV2）
 * @param {string} fid 文件 fid（fileListAO.fileList[].fid）
 * @returns {Promise<{url: string}>}
 */
export const getWopanDownloadUrl = async (fid, credential) => {
  const data = await requestWoHome({
    key: 'GetDownloadUrlV2',
    param: {
      type: '1',
      fidList: [fid],
      clientId: WOPAN_CLIENT_ID,
    },
    other: { secret: true },
    accessToken: credential.accessToken,
    refreshToken: credential.refreshToken,
  })
  const list = data.list || []
  if (!list.length || !list[0].downloadUrl) {
    throw { code: 'WOPAN_NO_DOWNLOAD_URL', message: 'download url not found' }
  }
  return { url: list[0].downloadUrl }
}

/**
 * 查询用户信息（含自动会话恢复）
 */
export const getWopanUser = async credential => {
  const valid = await ensureWopanSession(credential)
  return getWopanUserInfo(valid.accessToken)
}
