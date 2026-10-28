// 联通云盘 wopan 传输层：dispatcher 协议请求封装（跨平台）
// PC 走 Electron IPC（同 request189 模式），其余平台 uni.request；无需 cookie jar
import * as CONFIG from '@/utils/config.js'
// import { ipc } from '@/utils/ipcRenderer'
// import { ipcApiRoute } from '@/utils/ipcApiRoute'
// 注：上方 ipc/ipcApiRoute 的 import 由 build/build.js 按平台自动取消注释（PC 分支）
import {
  calWopanHeader,
  buildWopanBody,
  parseWopanData,
  CHANNEL_API_USER,
  CHANNEL_WOHOME,
} from './crypto.js'
import { refreshWopanToken } from './login.js'

const UA_WOPAN =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36 Edg/114.0.1823.37'

/**
 * 底层 HTTP：POST JSON
 * @returns {Promise<{statusCode, data}>}
 */
const httpPost = (url, header, body, timeout = 20000) => {
  return new Promise((resolve, reject) => {
    if (CONFIG.IS_PC) {
      ipc
        .invoke(ipcApiRoute.httpRequest, {
          url,
          method: 'POST',
          data: body,
          header,
          options: { timeout, responseType: 'text', withHeaders: true },
        })
        .then(res => {
          if (res.code === 200) {
            const payload = res.data
            if (payload && typeof payload === 'object' && 'headers' in payload) {
              resolve({ statusCode: payload.statusCode, data: payload.body })
            } else {
              resolve({ statusCode: 200, data: payload })
            }
          } else {
            reject(res)
          }
        })
        .catch(reject)
    } else {
      uni.request({
        url,
        method: 'POST',
        header,
        data: body,
        timeout,
        success: res => resolve({ statusCode: res.statusCode, data: res.data }),
        fail: reject,
      })
    }
  })
}

/**
 * wopan dispatcher 请求（对齐 wopan-sdk-go request.go）
 * @param {object} opts
 * @param {string} opts.channel api-user / wohome
 * @param {string} opts.key func 名
 * @param {object} opts.param 业务参数（会被 AES 加密进 body.param）
 * @param {object} opts.other body 额外字段（如 clientId、secret）
 * @param {string} opts.accessToken access token（wohome 通道必填：请求头 + 解密密钥）
 * @param {string} opts.refreshToken wohome 失败时自动刷新用
 * @param {boolean} opts.retry 失败自动刷新重试一次（默认 true；api-user 通道不走刷新重试）
 * @returns {Promise<object>} RSP.DATA 解析结果
 */
export const requestWopan = async ({
  channel,
  key,
  param,
  other,
  accessToken = '',
  refreshToken = '',
  retry = true,
}) => {
  const url = `${CONFIG.WopanDispatcherUrl}/${channel}/dispatcher`
  const header = {
    'Content-Type': 'application/json',
    'User-Agent': UA_WOPAN,
    Origin: 'https://pan.wo.cn',
    Referer: 'https://pan.wo.cn/',
  }
  if (accessToken) header.Accesstoken = accessToken

  const payload = {
    header: calWopanHeader(channel, key),
    body: buildWopanBody(channel, param, other, accessToken),
  }

  const { statusCode, data } = await httpPost(url, header, payload)
  const resp = typeof data === 'string' ? JSON.parse(data) : data

  if (Number(statusCode) !== 200) {
    throw {
      code: `WOPAN_HTTP_${statusCode}`,
      message: (resp && (resp.MSG || (resp.RSP && resp.RSP.RSP_DESC))) || `http ${statusCode}`,
    }
  }
  if (resp.STATUS !== '200') {
    throw { code: 'WOPAN_STATUS_FAIL', message: resp.MSG || 'wopan request failed' }
  }
  const rsp = resp.RSP || {}
  if (rsp.RSP_CODE !== '0000') {
    // wohome 通道失败 → 刷新 token 后重试一次（对齐 Go request retry 逻辑）
    if (channel === CHANNEL_WOHOME && retry && refreshToken) {
      const newToken = await refreshWopanToken(refreshToken)
      return requestWopan({ channel, key, param, other, accessToken: newToken.accessToken, refreshToken: newToken.refreshToken, retry: false })
    }
    throw { code: rsp.RSP_CODE || 'WOPAN_RSP_FAIL', message: rsp.RSP_DESC || 'wopan rsp failed' }
  }
  return parseWopanData(rsp.DATA, channel, accessToken)
}

/**
 * api-user 通道请求（登录/用户信息）
 */
export const requestApiUser = ({ key, param, other }) =>
  requestWopan({ channel: CHANNEL_API_USER, key, param, other })

/**
 * wohome 通道请求（文件操作）
 */
export const requestWoHome = ({ key, param, other, accessToken, refreshToken }) =>
  requestWopan({ channel: CHANNEL_WOHOME, key, param, other, accessToken, refreshToken })
