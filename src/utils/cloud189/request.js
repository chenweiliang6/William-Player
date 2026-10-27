// 天翼云盘 189pc 传输层：跨平台请求封装 + 手动 cookie jar
// PC 走 Electron IPC（壳工程需透出 headers/statusCode 才能支持账密登录链），其余平台 uni.request
import * as CONFIG from '@/utils/config.js'
// import { ipc } from '@/utils/ipcRenderer'
// import { ipcApiRoute } from '@/utils/ipcApiRoute'
// 注：上方 ipc/ipcApiRoute 的 import 由 build/build.js 按平台自动取消注释（PC 分支）
import { timestamp } from './crypto.js'

const UA_189PC =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.88 Safari/537.36'

// 按 host 维护的手动 cookie jar（登录链三域：cloud.189.cn / open.e.189.cn / api.cloud.189.cn）
const cookieJar = {}

const getHost = url => {
  const match = url.match(/:\/\/([^/]+)/)
  return match ? match[1] : ''
}

// 兼容 Set-Cookie 的 string / 数组 / 逗号拼接三种形态（各端 res.header 不一致）
const normalizeSetCookies = value => {
  if (!value) return []
  if (Array.isArray(value)) return value
  // 多个 Set-Cookie 可能被拼成一个字符串（uni.request Android 行为），按 "xx=yy; Path=/, name=val" 逗号切分
  return String(value)
    .split(/,(?=[^;]*?=)/)
    .map(s => s.trim())
    .filter(Boolean)
}

export const clearCookieJar = () => {
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

export const getCookieHeader = url => {
  const host = getHost(url)
  const jar = cookieJar[host]
  if (!jar) return ''
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ')
}

const initHostJar = url => {
  const host = getHost(url)
  if (host && !cookieJar[host]) cookieJar[host] = {}
  return host
}

/**
 * 189pc 专用请求
 * @param {string} url
 * @param {object} opts { method, data(form/query), header, responseType('arraybuffer'|'text'), timeout }
 * @returns {Promise<{statusCode, headers, data}>}
 */
export const request189 = (url, { method = 'GET', data, header = {}, responseType, timeout = 15000 } = {}) => {
  const host = initHostJar(url)
  const cookie = getCookieHeader(url)
  const finalHeader = { 'User-Agent': UA_189PC, ...header }
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
            responseType: responseType || 'text',
            withHeaders: true,
          },
        })
        .then(res => {
          if (res.code === 200) {
            const body = res.data
            // 新壳返回 { statusCode, headers, body }；旧壳只返回 body 本身 → 登录链不可用
            if (body && typeof body === 'object' && 'headers' in body) {
              mergeSetCookies(host, body.headers['set-cookie'] || body.headers['Set-Cookie'])
              resolve({ statusCode: body.statusCode, headers: body.headers, data: body.body })
            } else {
              resolve({ statusCode: 200, headers: {}, data: body })
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
        responseType: responseType === 'arraybuffer' ? 'arraybuffer' : undefined,
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

// arraybuffer → base64（验证码图片展示用）
export const arrayBufferToBase64 = buffer => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0
    binary += chars[b0 >> 2]
    binary += chars[((b0 & 3) << 4) | (b1 >> 4)]
    binary += i + 1 < bytes.length ? chars[((b1 & 15) << 2) | (b2 >> 6)] : '='
    binary += i + 2 < bytes.length ? chars[b2 & 63] : '='
  }
  return binary
}
