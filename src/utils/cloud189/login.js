// 天翼云盘 189pc 登录流程（移植自 AlistGo drivers/189pc/utils.go）
// initLoginParam → login189 → refreshSession189 三段式
import { request189, clearCookieJar, arrayBufferToBase64 } from './request.js'
import { rsaEncryptToHex, clientSuffix, timestamp, uuid } from './crypto.js'

const ACCOUNT_TYPE = '02'
const APP_ID = '8025431004'
const CLIENT_TYPE = '10020'

const WEB_URL = 'https://cloud.189.cn'
const AUTH_URL = 'https://open.e.189.cn'
const API_URL = 'https://api.cloud.189.cn'

const RETURN_URL = 'https://m.cloud.189.cn/zhuanti/2020/loginErrorPc/index.html'

// 模块级登录参数单例（一次登录流程内共享）
let loginParam = null

const formToQuery = form =>
  Object.entries(form)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&')

const ensureSessionError = { code: 'NEED_FULL_LOGIN' }

/**
 * 初始化登录参数
 * @returns {{captchaToken,lt,paramId,reqId,rsaUsername,rsaPassword,needCaptcha,captchaImage?}}
 */
export const initLoginParam = async (username, password) => {
  clearCookieJar()

  // 1. 拉取 PC 统一登录页，正则提取登录参数
  const timeStamp = String(timestamp())
  const loginPageUrl = `${WEB_URL}/api/portal/unifyLoginForPC.action?appId=${APP_ID}&clientType=${CLIENT_TYPE}&returnURL=${encodeURIComponent(RETURN_URL)}&timeStamp=${timeStamp}`
  const pageRes = await request189(loginPageUrl, { method: 'GET', responseType: 'text' })
  const html = typeof pageRes.data === 'string' ? pageRes.data : String(pageRes.data)

  const extract = (pattern, name) => {
    const m = html.match(pattern)
    if (!m || !m[1]) throw new Error(`189pc 登录页参数提取失败: ${name}`)
    return m[1]
  }
  const captchaToken = extract(/'captchaToken' value='(.+?)'/, 'captchaToken')
  const lt = extract(/lt = "(.+?)"/, 'lt')
  const paramId = extract(/paramId = "(.+?)"/, 'paramId')
  const reqId = extract(/reqId = "(.+?)"/, 'reqId')

  // 2. 获取 RSA 公钥
  const encRes = await request189(`${AUTH_URL}/api/logbox/config/encryptConf.do`, {
    method: 'POST',
    header: { 'Content-Type': 'application/x-www-form-urlencoded' },
    data: { appId: APP_ID },
  })
  const encConf = typeof encRes.data === 'string' ? JSON.parse(encRes.data) : encRes.data
  const { pre, pubKey } = encConf.data

  // 3. RSA 加密账号密码（PKCS1v15 → 大写 hex，拼 pre 前缀）
  const rsaUsername = pre + rsaEncryptToHex(pubKey, username)
  const rsaPassword = pre + rsaEncryptToHex(pubKey, password)

  loginParam = { captchaToken, lt, paramId, reqId, rsaUsername, rsaPassword }

  // 4. 判断是否需要验证码（body 纯文本，"0" 表示不需要）
  const needRes = await request189(`${AUTH_URL}/api/logbox/oauth2/needcaptcha.do`, {
    method: 'POST',
    header: { 'Content-Type': 'application/x-www-form-urlencoded', REQID: reqId },
    data: { appKey: APP_ID, accountType: ACCOUNT_TYPE, userName: rsaUsername },
  })
  const needBody = typeof needRes.data === 'string' ? needRes.data.trim() : String(needRes.data).trim()
  if (needBody === '0') {
    return { ...loginParam, needCaptcha: false }
  }

  // 5. 拉取验证码图片 → base64 data URI
  const imgRes = await request189(`${AUTH_URL}/api/logbox/oauth2/picCaptcha.do`, {
    method: 'GET',
    responseType: 'arraybuffer',
  })
  let captchaImage = ''
  if (imgRes.data && imgRes.data.byteLength > 20) {
    captchaImage = `data:image/png;base64,${arrayBufferToBase64(imgRes.data)}`
  }
  if (!captchaImage) throw new Error('189pc 获取验证码图片失败')
  return { ...loginParam, needCaptcha: true, captchaImage }
}

/**
 * 提交登录，换取 PC 会话 token
 * @param {string} validateCode 用户输入的验证码（无验证码场景传空串）
 * @returns {AppSessionResp} {res_code, res_message, loginName, sessionKey, sessionSecret, accessToken, refreshToken, familySessionKey, familySessionSecret}
 */
export const login189 = async ({ validateCode = '' } = {}) => {
  if (!loginParam) throw new Error('189pc 请先调用 initLoginParam')
  const param = loginParam
  let toUrl = ''
  let errMsg = ''

  try {
    const submitRes = await request189(`${AUTH_URL}/api/logbox/oauth2/loginSubmit.do`, {
      method: 'POST',
      header: {
        'Content-Type': 'application/x-www-form-urlencoded',
        REQID: param.reqId,
        lt: param.lt,
      },
      data: {
        appKey: APP_ID,
        accountType: ACCOUNT_TYPE,
        userName: param.rsaUsername,
        password: param.rsaPassword,
        validateCode,
        captchaToken: param.captchaToken,
        returnUrl: RETURN_URL,
        dynamicCheck: 'FALSE',
        clientType: CLIENT_TYPE,
        cb_SaveName: '1',
        isOauth2: 'false',
        state: '',
        paramId: param.paramId,
      },
    })
    const submitBody = typeof submitRes.data === 'string' ? JSON.parse(submitRes.data) : submitRes.data
    toUrl = submitBody.toUrl || ''
    errMsg = submitBody.msg || ''
  } finally {
    // 对齐 Go：一次提交后销毁登录参数
    loginParam = null
  }

  if (!toUrl) throw new Error(`189pc 登录失败: ${errMsg || '未获取到 toUrl'}`)

  // 换取 PC 会话 token
  const suffix = clientSuffix()
  const sessionUrl =
    `${API_URL}/getSessionForPC.action?redirectURL=${encodeURIComponent(toUrl)}` +
    `&clientType=${suffix.clientType}&version=${suffix.version}&channelId=${encodeURIComponent(suffix.channelId)}&rand=${suffix.rand}`
  const sessionRes = await request189(sessionUrl, { method: 'POST' })
  const tokenInfo = typeof sessionRes.data === 'string' ? JSON.parse(sessionRes.data) : sessionRes.data
  if (tokenInfo.res_code !== 0) {
    throw new Error(`189pc 获取会话失败: ${tokenInfo.res_message || tokenInfo.res_code}`)
  }
  return tokenInfo
}

/**
 * 用 AccessToken 刷新会话（SessionKey/Secret 过期时）
 * @throws NEED_FULL_LOGIN 当 AccessToken 也失效（UserInvalidOpenToken）
 */
export const refreshSession189 = async accessToken => {
  const suffix = clientSuffix()
  const url =
    `${API_URL}/getSessionForPC.action?appId=${APP_ID}&accessToken=${encodeURIComponent(accessToken)}` +
    `&clientType=${suffix.clientType}&version=${suffix.version}&channelId=${encodeURIComponent(suffix.channelId)}&rand=${suffix.rand}`
  const res = await request189(url, { method: 'GET', header: { 'X-Request-ID': uuid() } })
  const body = typeof res.data === 'string' ? JSON.parse(res.data) : res.data

  if (String(body.res_code) === 'UserInvalidOpenToken') {
    throw ensureSessionError
  }
  if (body.res_code !== 0) {
    throw new Error(`189pc 刷新会话失败: ${body.res_message || body.res_code}`)
  }
  return body
}

export const get189PCConstants = () => ({ APP_ID, API_URL })
