// 移动云盘 139 传输层（移植自 AlistGo drivers/139/util.go request/requestRoute/personalRequest）
// PC 走 Electron IPC（同 cloud189/wopan 模式），其余平台 uni.request；手动 cookie jar
import * as CONFIG from '@/utils/config.js'
// import { ipc } from '@/utils/ipcRenderer'
// import { ipcApiRoute } from '@/utils/ipcApiRoute'
// 注：上方 ipc/ipcApiRoute 的 import 由 build/build.js 按平台自动取消注释（PC 分支）
import { calSign, randomString } from './crypto.js'

const UA_139 =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

// step3 thirdlogin 用的 android 端 UA（对齐 Go okhttp/3.12.2）
const UA_139_SDK = 'okhttp/3.12.2'

// 按 host 维护的手动 cookie jar（登录链两域：mail.10086.cn / smsrebuild1.mail.10086.cn）
const cookieJar = {}

const getHost = url => {
  const match = url.match(/:\/\/([^/]+)/)
  return match ? match[1] : ''
}

// 兼容 Set-Cookie 的 string / 数组 / 逗号拼接三种形态（各端 res.header 不一致）
const normalizeSetCookies = value => {
  if (!value) return []
  if (Array.isArray(value)) return value
  return String(value)
    .split(/,(?=[^;]*?=)/)
    .map(s => s.trim())
    .filter(Boolean)
}

export const clearCookieJar139 = () => {
  Object.keys(cookieJar).forEach(k => delete cookieJar[k])
}

const mergeSetCookies = (host, setCookieValue) => {
  if (!host || !cookieJar[host]) return
  normalizeSetCookies(setCookieValue).forEach(item => {
    const pair = item.split(';')[0]
    const eq = pair.indexOf('=')
    if (eq > 0) cookieJar[host][pair.slice(0, eq)] = pair.slice(eq + 1)
  })
}

export const getCookieHeader139 = url => {
  const jar = cookieJar[getHost(url)]
  if (!jar) return ''
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ')
}

export const getCookieValue139 = (url, name) => {
  const jar = cookieJar[getHost(url)]
  return jar ? jar[name] || '' : ''
}

const initHostJar = url => {
  const host = getHost(url)
  if (host && !cookieJar[host]) cookieJar[host] = {}
  return host
}

/**
 * 底层 HTTP：PC 走 Electron IPC，其余 uni.request
 * @param {object} opts { method, data, header, timeout, followRedirect(PC 端默认 false，登录链需读 302 Location) }
 * @returns {Promise<{statusCode, headers, data}>}
 */
export const http139 = (url, { method = 'GET', data, header = {}, timeout = 20000, followRedirect = false } = {}) => {
  const host = initHostJar(url)
  const cookie = getCookieHeader139(url)
  const finalHeader = { ...header }
  if (cookie) finalHeader.Cookie = cookie

  return new Promise((resolve, reject) => {
    if (CONFIG.IS_PC) {
      ipc
        .invoke(ipcApiRoute.httpRequest, {
          url,
          method,
          data,
          header: finalHeader,
          options: {
            timeout,
            responseType: 'text',
            withHeaders: true,
            // 登录链第一步需要拿 302 的 Location 头，默认不跟随重定向
            followRedirect,
          },
        })
        .then(res => {
          if (res.code === 200) {
            const payload = res.data
            if (payload && typeof payload === 'object' && 'headers' in payload) {
              mergeSetCookies(host, payload.headers['set-cookie'] || payload.headers['Set-Cookie'])
              resolve({ statusCode: payload.statusCode, headers: payload.headers, data: payload.body })
            } else {
              resolve({ statusCode: 200, headers: {}, data: payload })
            }
          } else {
            reject(res)
          }
        })
        .catch(reject)
    } else {
      uni.request({
        url,
        method,
        data,
        header: finalHeader,
        timeout,
        success: res => {
          const headers = res.header || {}
          mergeSetCookies(host, headers['Set-Cookie'] || headers['set-cookie'])
          resolve({ statusCode: res.statusCode, headers, data: res.data })
        },
        fail: reject,
      })
    }
  })
}

/**
 * yun.139.com 域 mcloud-sign 签名请求（对齐 Go request/personalRequest 的头部组装）
 * @param {object} opts { pathname, data, authorization, personalHost, svcType }
 * @returns {Promise<object>} JSON 响应
 */
export const request139Cloud = async ({ pathname, data, authorization, personalHost, svcType = '1' }) => {
  const url = `${personalHost || 'https://yun.139.com'}${pathname}`
  const ts = formatCloudTs(new Date())
  const randStr = randomString(16)
  const bodyStr = JSON.stringify(data || {})
  const sign = calSign(bodyStr, ts, randStr)

  const header = {
    Accept: 'application/json, text/plain, */*',
    'CMS-DEVICE': 'default',
    Authorization: `Basic ${authorization}`,
    'mcloud-channel': '1000101',
    'mcloud-client': '10701',
    'mcloud-sign': `${ts},${randStr},${sign}`,
    'mcloud-version': '7.14.0',
    Origin: 'https://yun.139.com',
    Referer: 'https://yun.139.com/w/',
    'x-DeviceInfo': '||9|7.14.0|chrome|120.0.0.0|||windows 10||zh-CN|||',
    'x-huawei-channelSrc': '10000034',
    'x-inner-ntwk': '2',
    'x-m4c-caller': 'PC',
    'x-m4c-src': '10002',
    'x-SvcType': svcType,
    'Inner-Hcy-Router-Https': '1',
    'User-Agent': UA_139,
    'Content-Type': 'application/json;charset=UTF-8',
  }

  const res = await http139(url, { method: 'POST', data: bodyStr, header })
  const body = typeof res.data === 'string' ? JSON.parse(res.data) : res.data
  if (!body.success) {
    throw { code: body.code || 'CLOUD139_RSP_FAIL', message: body.message || '139 cloud request failed' }
  }
  return body
}

// 云盘域时间戳格式（对齐 Go "2006-01-02 15:04:05"，本地时区）
export const formatCloudTs = date => {
  const p = n => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())} ${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`
}

export { UA_139, UA_139_SDK }
