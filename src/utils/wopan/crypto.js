// 联通云盘 wopan 协议加密工具（移植自 wopan-sdk-go crypto.go/aes.go/header.go）
import CryptoES from 'crypto-es'

// Web 端 clientId / clientSecret（对齐 wopan-sdk-go DefaultClientID/DefaultClientSecret）
export const WOPAN_CLIENT_ID = '1001000021'
export const WOPAN_CLIENT_SECRET = 'XFmi9GS2hzk98jGX'

// AES-CBC 固定 IV（对齐 wopan-sdk-go Crypto.iv）
const AES_IV = 'wNSOYIB1k1DjY5lA'

// 通道常量
export const CHANNEL_API_USER = 'api-user'
export const CHANNEL_WOHOME = 'wohome'

// MD5 签名（对齐 Go calHeader：md5(key+resTime+reqSeq+channel+version)）
export const md5Hex = str => CryptoES.MD5(str).toString()

/**
 * 按通道取 AES 密钥（对齐 Go Crypto.EncryptBytes）
 * api-user 通道用 clientSecret；wohome 通道用 access token 前 16 位
 */
export const getAesKey = (channel, accessToken) => {
  if (channel === CHANNEL_API_USER) return WOPAN_CLIENT_SECRET
  if (!accessToken || accessToken.length < 16) {
    throw { code: 'WOPAN_INVALID_ACCESS_TOKEN', message: 'invalid access token' }
  }
  return accessToken.slice(0, 16)
}

// AES-128-CBC(PKCS7) 加密 → base64（对齐 Go AesEncrypt + base64.StdEncoding）
export const aesCbcEncryptBase64 = (plain, key16) => {
  const key = CryptoES.enc.Utf8.parse(key16)
  const iv = CryptoES.enc.Utf8.parse(AES_IV)
  const enc = CryptoES.AES.encrypt(CryptoES.enc.Utf8.parse(plain), key, {
    mode: CryptoES.mode.CBC,
    padding: CryptoES.pad.Pkcs7,
    iv,
  })
  return enc.toString()
}

// AES-128-CBC(PKCS7) 解密 base64 密文（对齐 Go AesDecrypt）
export const aesCbcDecryptBase64 = (cipherB64, key16) => {
  const key = CryptoES.enc.Utf8.parse(key16)
  const iv = CryptoES.enc.Utf8.parse(AES_IV)
  const dec = CryptoES.AES.decrypt(cipherB64, key, {
    mode: CryptoES.mode.CBC,
    padding: CryptoES.pad.Pkcs7,
    iv,
  })
  return dec.toString(CryptoES.enc.Utf8)
}

/**
 * 构造 dispatcher 协议头（对齐 Go calHeader）
 * @param {string} channel api-user / wohome
 * @param {string} key func 名（如 PcWebLogin）
 * @returns {{key, resTime, reqSeq, channel, sign, version}}
 */
export const calWopanHeader = (channel, key) => {
  const resTime = Date.now()
  const reqSeq = Math.floor(Math.random() * 8999) + 100000
  const version = ''
  const sign = md5Hex(`${key}${resTime}${reqSeq}${channel}${version}`)
  return { key, resTime, reqSeq, channel, sign, version }
}

/**
 * 按 wopan-sdk-go NewBody 规则构造 body：param AES 加密后并入 other
 * @returns {{param: string} & object}
 */
export const buildWopanBody = (channel, param, other, accessToken) => {
  if (param == null) return { ...(other || {}) }
  const plain = typeof param === 'string' ? param : JSON.stringify(param)
  const encrypted = aesCbcEncryptBase64(plain, getAesKey(channel, accessToken))
  return { ...(other || {}), param: encrypted }
}

/**
 * 解析 RSP.DATA：被引号包裹的密文先 AES 解密再 JSON.parse（对齐 Go request 解析逻辑）
 * @param {*} data RSP.DATA 字段（字符串密文 / JSON 字符串 / 已是对象）
 */
export const parseWopanData = (data, channel, accessToken) => {
  if (data == null) return null
  // 已经是对象（部分端 uni.request 会把 DATA 里的 JSON 预解析）
  if (typeof data === 'object') return data
  let str = String(data)
  if (str.startsWith('"') && str.endsWith('"') && str.length > 1) {
    // 引号包裹 → 密文，去掉首尾引号解密
    const cipher = JSON.parse(str) // 处理转义
    str = aesCbcDecryptBase64(cipher, getAesKey(channel, accessToken))
  }
  try {
    return JSON.parse(str)
  } catch (e) {
    return str
  }
}
