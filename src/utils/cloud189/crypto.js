// 天翼云盘 189pc 协议加密工具（移植自 AlistGo drivers/189pc/help.go）
import CryptoES from 'crypto-es'
import JSEncrypt from '@/utils/jsencrypt.min.js'

// RFC4122 v4 随机 UUID
export const uuid = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// HTTP 规范时间（RFC1123 GMT，等价 Go http.TimeFormat）
export const getHttpDateStr = () => new Date().toUTCString()

// 毫秒时间戳
export const timestamp = () => Date.now()

const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

// 纯 JS base64 解码（nvue/App 端无 atob）
const b64Decode = b64 => {
  let str = b64.replace(/=+$/, '')
  let bytes = []
  for (let i = 0; i < str.length; i += 4) {
    let bits = 0
    let valid = 0
    for (let j = 0; j < 4 && i + j < str.length; j++) {
      const idx = B64_CHARS.indexOf(str[i + j])
      if (idx === -1) continue
      bits = (bits << 6) | idx
      valid++
    }
    // valid 个字符共 valid*6 位，从最高字节起每 8 位取一个
    const byteCount = valid >= 2 ? valid - 1 : 0
    for (let b = 0; b < byteCount; b++) {
      bytes.push((bits >> (valid * 6 - 8 - b * 8)) & 0xff)
    }
  }
  return bytes
}

const byteToHex = bytes =>
  bytes.map(b => b.toString(16).padStart(2, '0')).join('')

// base64 → 大写 hex（对齐 Go: strings.ToUpper(hex.EncodeToString(...))）
export const b64ToUppercaseHex = b64 => byteToHex(b64Decode(b64)).toUpperCase()

// RSA 加密用户名密码：PKCS1v15 → base64 → 大写 hex
export const rsaEncryptToHex = (pubKeyB64, text) => {
  const jse = new JSEncrypt()
  jse.setPublicKey(`-----BEGIN PUBLIC KEY-----\n${pubKeyB64}\n-----END PUBLIC KEY-----`)
  const b64 = jse.encrypt(text)
  if (!b64) throw new Error('189pc rsa encrypt failed')
  return b64ToUppercaseHex(b64)
}

// HMAC-SHA1 签名 → 大写 hex
export const hmacSha1UpperHex = (secret, data) =>
  CryptoES.HmacSHA1(data, secret).toString(CryptoES.enc.Hex).toUpperCase()

// AES-ECB(PKCS7) 加密 params → 大写 hex
export const aesEcbUpperHex = (plain, key16) => {
  const key = CryptoES.enc.Utf8.parse(key16)
  const enc = CryptoES.AES.encrypt(CryptoES.enc.Utf8.parse(plain), key, {
    mode: CryptoES.mode.ECB,
    padding: CryptoES.pad.Pkcs7,
  })
  return enc.ciphertext.toString(CryptoES.enc.Hex).toUpperCase()
}

// 业务参数按 key 字典序拼 k=v&k=v（不 url encode，对齐 Go Params.Encode）
export const encodeParams = params =>
  Object.keys(params)
    .sort()
    .map(k => `${k}=${params[k]}`)
    .join('&')

// HMAC 签名（对齐 Go signatureOfHmac）
export const signatureOfHmac = (sessionSecret, sessionKey, operate, fullUrl, dateOfGmt, param) => {
  const match = fullUrl.match(/:\/\/[^/]+((\/[^/\s?#]+)*)/)
  const urlpath = match ? match[1] : '/'
  let data = `SessionKey=${sessionKey}&Operate=${operate}&RequestURI=${urlpath}&Date=${dateOfGmt}`
  if (param) {
    data += `&params=${param}`
  }
  return hmacSha1UpperHex(sessionSecret, data)
}

// 签名请求头（对齐 Go SignatureHeader）
export const signatureHeader = (token, method, fullUrl, paramsHex, isFamily = false) => {
  const dateOfGmt = getHttpDateStr()
  const sessionKey = isFamily ? token.familySessionKey : token.sessionKey
  const sessionSecret = isFamily ? token.familySessionSecret : token.sessionSecret
  return {
    Date: dateOfGmt,
    SessionKey: sessionKey,
    'X-Request-ID': uuid(),
    Signature: signatureOfHmac(sessionSecret, sessionKey, method, fullUrl, dateOfGmt, paramsHex),
  }
}

// 客户端后缀 query 参数（对齐 Go clientSuffix）
export const clientSuffix = () => ({
  clientType: 'TELEPC',
  version: '6.2',
  channelId: 'web_cloud.189.cn',
  rand: `${Math.floor(Math.random() * 1e5)}_${Math.floor(Math.random() * 1e10)}`,
})
