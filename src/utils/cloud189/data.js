// 天翼云盘 189pc 签名数据层（移植自 AlistGo drivers/189pc request/getFilesWithPage/Link）
// 响应统一映射回旧 Cookie 体系结构，保证 15 处调用方零改动
import { request189 } from './request.js'
import { signatureHeader, aesEcbUpperHex, encodeParams, clientSuffix } from './crypto.js'
import { refreshSession189, initLoginParam, login189 } from './login.js'
import { get189Password, update189TokenInStorage } from './store.js'

const API_URL = 'https://api.cloud.189.cn'

// 会话保障：Promise 去重，防止扫库并发失效时触发刷新风暴
let ensureSessionPromise = null

/**
 * 失效时恢复会话：先 refresh（AccessToken），失败且是 NEED_FULL_LOGIN 时用存储的账密完整重登。
 * 重登遇验证码或无账密 → 抛 NEED_MANUAL_LOGIN（由调用方 toast reloginTianyiCloudDrive 兜底）。
 */
export const ensureSession = async token => {
  if (!ensureSessionPromise) {
    ensureSessionPromise = (async () => {
      try {
        const newSession = await refreshSession189(token.accessToken)
        const newToken = { ...token, ...newSession }
        update189TokenInStorage(token.loginName, newToken)
        return newToken
      } catch (e) {
        if (e && e.code === 'NEED_FULL_LOGIN') {
          const cred = get189Password(token.loginName)
          if (!cred) {
            throw { code: 'NEED_MANUAL_LOGIN' }
          }
          try {
            const param = await initLoginParam(cred.username, cred.password)
            if (param.needCaptcha) throw { code: 'NEED_MANUAL_LOGIN' }
            const tokenInfo = await login189()
            const newToken = { ...token, ...tokenInfo }
            update189TokenInStorage(tokenInfo.loginName, newToken)
            return newToken
          } catch (e2) {
            if (e2 && e2.code === 'NEED_MANUAL_LOGIN') throw e2
            throw e2
          }
        }
        throw e
      }
    })().finally(() => {
      ensureSessionPromise = null
    })
  }
  return ensureSessionPromise
}

// 判断响应是否为会话失效（对齐 Go：contains "userSessionBO is null" / "InvalidSessionKey"）
const isSessionInvalid = bodyText =>
  typeof bodyText === 'string' && (bodyText.includes('userSessionBO is null') || bodyText.includes('InvalidSessionKey'))

// 错误检测（对齐 Go RespErr.HasError 四形态）
const hasRespError = body =>
  body &&
  ((typeof body.res_code === 'number' && body.res_code !== 0) ||
    (typeof body.res_code === 'string' && body.res_code !== '') ||
    (body.code && body.code !== 'SUCCESS') ||
    body.errorCode ||
    body.error)

/**
 * 签名请求封装（对齐 Go request()：clientSuffix + params 加密 + HMAC 签名头 + 失效刷新重试一次）
 * @returns 映射后的旧结构响应（成功强制注入 res_code: 0）
 */
const signedRequest = async (token, { operate = 'GET', url, params, isRetry = false } = {}) => {
  const suffix = clientSuffix()
  const query = { ...suffix }
  let paramsHex = ''
  if (params) {
    paramsHex = aesEcbUpperHex(encodeParams(params), token.sessionSecret.slice(0, 16))
    query.params = paramsHex
  }
  const queryString = Object.entries(query)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&')
  const fullUrl = `${url}?${queryString}`

  const res = await request189(fullUrl, {
    method: operate,
    header: {
      ...signatureHeader(token, operate, url, paramsHex),
      Accept: 'application/json;charset=UTF-8',
      Referer: 'https://cloud.189.cn',
    },
    responseType: 'text',
  })

  const rawText = typeof res.data === 'string' ? res.data : JSON.stringify(res.data)
  if (isSessionInvalid(rawText) && !isRetry) {
    const newToken = await ensureSession(token)
    return signedRequest(newToken, { operate, url, params, isRetry: true })
  }

  let body
  try {
    body = typeof res.data === 'string' ? JSON.parse(res.data) : res.data
  } catch (e) {
    return { res_code: 1, res_message: `189pc 响应解析失败: ${String(res.data).slice(0, 100)}` }
  }
  if (hasRespError(body)) {
    return { res_code: body.res_code !== undefined ? body.res_code : 1, res_message: body.res_message || body.msg || body.message || body.errorMsg || body.code || '请求失败' }
  }
  if (body.res_code === undefined) body.res_code = 0
  return body
}

/**
 * 文件列表（对齐 Go getFilesWithPage 个人云分支）
 * 响应 fileListAO.fileList/folderList/count 与网页版同构，恒等透传
 */
export const list189Files = async (data, token) => {
  return signedRequest(token, {
    url: `${API_URL}/listFiles.action`,
    params: {
      folderId: data.folderId,
      fileType: '0',
      mediaAttr: '0',
      iconOption: '5',
      pageNum: String(data.pageNum || 1),
      pageSize: String(data.pageSize || 1000),
      recursive: '0',
      orderBy: 'filename',
      descending: 'false',
    },
  })
}

/**
 * 获取下载/播放链接（对齐 Go Link 个人云分支）
 * 映射为旧结构：播放取 normal.url，下载取 fileDownloadUrl
 */
export const get189DownloadUrlNew = async (data, token) => {
  const body = await signedRequest(token, {
    url: `${API_URL}/getFileDownloadUrl.action`,
    params: { fileId: data.folderFileId, dt: '3', flag: '1' },
  })
  if (body.res_code != 0) return body
  let url = body.fileDownloadUrl || ''
  url = url.split('&').join('&').replace('http://', 'https://')
  return { ...body, fileDownloadUrl: url, normal: { url } }
}

// 用户信息（对齐 Go isLogin 的 getUserInfo.action；loginName 以会话为准兜底）
export const get189UserInfo = async token => {
  const body = await signedRequest(token, { url: `${API_URL}/getUserInfo.action` })
  if (body.res_code != 0) return body
  return { ...body, loginName: body.loginName || body.accountName || token.loginName }
}
