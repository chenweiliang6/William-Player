// 联通云盘 wopan 登录流程（移植自 wopan-sdk-go api-user.go）
// 两步链路：PcWebLogin（密码）→ needSmsCode=="1" 时 PcLoginVerifyCode（短信验证码）→ token 对
import { WOPAN_CLIENT_ID, WOPAN_CLIENT_SECRET } from './crypto.js'
import { requestApiUser } from './request.js'

// body 附加字段（对齐 Go JsonClientIDSecret：{clientId, secret: true}）
const CLIENT_ID_SECRET = { clientId: WOPAN_CLIENT_ID, secret: true }

/**
 * 第一步：密码登录（PcWebLogin）
 * 只校验账密并判断是否需要短信验证码，不返回 token
 * @returns {Promise<{needSmsCode: string}>} needSmsCode=="1" 时需要短信验证码
 */
export const wopanPreLogin = (phone, password) =>
  requestApiUser({
    key: 'PcWebLogin',
    param: {
      phone,
      password,
      uuid: '',
      verifyCode: '',
      clientSecret: WOPAN_CLIENT_SECRET,
    },
    other: CLIENT_ID_SECRET,
  })

/**
 * 第二步：短信验证码登录（PcLoginVerifyCode）
 * @returns {Promise<{access_token, refresh_token, expires_in}>}
 */
export const wopanLoginVerifyCode = (phone, password, messageCode) =>
  requestApiUser({
    key: 'PcLoginVerifyCode',
    param: {
      phone,
      messageCode,
      verifyCode: null,
      uuid: null,
      clientSecret: WOPAN_CLIENT_SECRET,
      password,
    },
    other: CLIENT_ID_SECRET,
  })

/**
 * 刷新 token（AppRefreshToken）
 * @param {string} refreshToken
 * @returns {Promise<{accessToken, refreshToken, expiresIn}>}
 */
export const refreshWopanToken = async refreshToken => {
  const data = await requestApiUser({
    key: 'AppRefreshToken',
    param: {
      refreshToken,
      clientSecret: WOPAN_CLIENT_SECRET,
    },
    other: CLIENT_ID_SECRET,
  })
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  }
}

/**
 * 完整登录流程（UI 一次调用）
 * - 未传 messageCode：先 PcWebLogin；needSmsCode != "1" 说明无需验证码（理论上不产生 token，
 *   但对齐 SDK 保守处理：仍走 PcLoginVerifyCode 拿 token，messageCode 传空串可能被服务端拒绝）
 * - 传了 messageCode：直接 PcLoginVerifyCode
 * @returns {Promise<{needSmsCode: true}|{needSmsCode: false, accessToken, refreshToken, expiresIn}>}
 */
export const wopanLogin = async (phone, password, messageCode) => {
  if (messageCode) {
    const token = await wopanLoginVerifyCode(phone, password, messageCode)
    return { needSmsCode: false, accessToken: token.access_token, refreshToken: token.refresh_token, expiresIn: token.expires_in }
  }
  const pre = await wopanPreLogin(phone, password)
  if (String(pre.needSmsCode) === '1') {
    return { needSmsCode: true }
  }
  // 无需验证码：直接尝试验证码接口（部分账号风险低时 messageCode 可为空）
  const token = await wopanLoginVerifyCode(phone, password, '')
  return { needSmsCode: false, accessToken: token.access_token, refreshToken: token.refresh_token, expiresIn: token.expires_in }
}

/**
 * 查询用户信息（AppQueryUser）——登录态校验 + 昵称展示
 * @param {string} accessToken
 * @returns {Promise<{userId, userName, headUrl, ...}>}
 */
export const getWopanUserInfo = accessToken =>
  requestApiUser({
    key: 'AppQueryUser',
    param: { accessToken },
    other: CLIENT_ID_SECRET,
  })
