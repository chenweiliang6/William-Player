// 移动云盘 139 协议加密工具（移植自 AlistGo drivers/139/util.go）
// calSign 签名 + 排序 JSON 两层 AES（CBC→ECB）+ SHA1 密码散列
import CryptoES from 'crypto-es'

// step3 thirdlogin 两层固定 AES 密钥（hex，对齐 Go KEY_HEX_1/KEY_HEX_2）
const KEY_HEX_1 = '73634235495062495331515373756c734e7253306c673d3d'
const KEY_HEX_2 = '7150714477323633586746674c337538'

// hex → WordArray（对齐 Go hex.DecodeString）
const hexToWordArray = hex => {
  const bytes = []
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.substr(i, 2), 16))
  }
  return CryptoES.lib.WordArray.create(new Uint8Array(bytes))
}

// sha1 散列 → 小写 hex（对齐 Go sha1Hash）
export const sha1Hash = data => CryptoES.SHA1(data).toString(CryptoES.enc.Hex)

// sha1 散列 → 大写 hex（对齐 Go step3 secinfo: strings.ToUpper(sha1Hash(...))）
export const sha1UpperHash = data => sha1Hash(data).toUpperCase()

/**
 * encodeURIComponent（对齐 Go encodeURIComponent：queryEscape + 还原 ! ' ( ) * ）
 */
export const encodeURIComponent139 = str => {
  return encodeURIComponent(str)
    .replace(/\+/g, '%20')
    .replace(/%21/g, '!')
    .replace(/%27/g, "'")
    .replace(/%28/g, '(')
    .replace(/%29/g, ')')
    .replace(/%2A/g, '*')
}

/**
 * mcloud-sign 签名（对齐 Go calSign）：
 * sortChars(encodeURIComponent(body)) → base64 → md5；
 * 加 md5(ts + ':' + randStr) → 再 md5 取大写
 */
export const calSign = (body, ts, randStr) => {
  const encoded = encodeURIComponent139(body)
  // 按字符排序后拼接（对齐 Go strings.Split + sort.Strings + Join）
  const sorted = encoded.split('').sort().join('')
  const sortedB64 = CryptoES.enc.Base64.stringify(CryptoES.enc.Utf8.parse(sorted))
  const md5 = str => CryptoES.MD5(str).toString()
  const res = md5(sortedB64) + md5(`${ts}:${randStr}`)
  return md5(res).toUpperCase()
}

/**
 * 排序 JSON 序列化（对齐 Go sortedJsonStringify）：
 * 对象 key 字典序、无空格分隔；数组保序；数字/布尔原样输出
 */
export const sortedJsonStringify = obj => {
  if (obj == null) return 'null'
  if (typeof obj === 'string') {
    // 字符串本身是 JSON 时解析后递归（对齐 Go 行为）
    try {
      return sortedJsonStringify(JSON.parse(obj))
    } catch (e) {
      return JSON.stringify(obj)
    }
  }
  if (typeof obj === 'number' || typeof obj === 'boolean') return String(obj)
  if (Array.isArray(obj)) {
    return `[${obj.map(v => sortedJsonStringify(v)).join(',')}]`
  }
  if (typeof obj === 'object') {
    const keys = Object.keys(obj).sort()
    return `{${keys.map(k => `${JSON.stringify(k)}:${sortedJsonStringify(obj[k])}`).join(',')}}`
  }
  return JSON.stringify(obj)
}

// AES-CBC(PKCS7) 加密 → base64(IV + ciphertext)（对齐 Go aesCbcEncrypt + yun139EncryptedRequest 拼接）
const aesCbcEncryptIvPrepended = (plainWordArray, keyWordArray) => {
  const iv = CryptoES.lib.WordArray.random(16)
  const enc = CryptoES.AES.encrypt(plainWordArray, keyWordArray, {
    mode: CryptoES.mode.CBC,
    padding: CryptoES.pad.Pkcs7,
    iv,
  })
  return iv.concat(enc.ciphertext).toString(CryptoES.enc.Base64)
}

// base64(IV + ciphertext) → AES-CBC(PKCS7) 解密（对齐 Go aesCbcDecrypt：前 16 字节为 IV）
const aesCbcDecryptIvPrepended = (b64, keyWordArray) => {
  const raw = CryptoES.enc.Base64.parse(b64)
  // WordArray 前 16 字节作 IV
  const iv = CryptoES.lib.WordArray.create(raw.words.slice(0, 4), 16)
  const ciphertext = CryptoES.lib.WordArray.create(
    raw.words.slice(4),
    raw.sigBytes - 16
  )
  const dec = CryptoES.AES.decrypt({ ciphertext } , keyWordArray, {
    mode: CryptoES.mode.CBC,
    padding: CryptoES.pad.Pkcs7,
    iv,
  })
  return dec.toString(CryptoES.enc.Utf8)
}

// AES-ECB(PKCS7) 解密（对齐 Go aesEcbDecrypt）
export const aesEcbDecrypt = (b64Cipher, keyHex) => {
  const key = hexToWordArray(keyHex)
  const dec = CryptoES.AES.decrypt(b64Cipher, key, {
    mode: CryptoES.mode.ECB,
    padding: CryptoES.pad.Pkcs7,
  })
  return dec.toString(CryptoES.enc.Utf8)
}

/**
 * step3 thirdlogin 第一层加密请求体（对齐 Go yun139EncryptedRequest）：
 * sortedJsonStringify(body) → AES-CBC(随机 IV 前置) → base64
 */
export const buildThirdLoginPayload = body =>
  aesCbcEncryptIvPrepended(CryptoES.enc.Utf8.parse(sortedJsonStringify(body)), hexToWordArray(KEY_HEX_1))

/**
 * step3 第一层响应解密：base64 → IV 前置 CBC 解密 → JSON（对齐 Go yun139EncryptedRequest 解密逻辑；
 * 响应以 '{' 开头时为明文 JSON 直接透传）
 */
export const decryptThirdLoginLayer1 = rawBody => {
  const str = typeof rawBody === 'string' ? rawBody.trim() : String(rawBody).trim()
  if (str.startsWith('{')) {
    // 明文 JSON 响应（对齐 Go 告警分支）
    return JSON.parse(str)
  }
  const jsonStr = aesCbcDecryptIvPrepended(str, hexToWordArray(KEY_HEX_1))
  return JSON.parse(jsonStr)
}

/**
 * step3 第二层解密：data 字段为 hex(密文)，AES-ECB(KEY_HEX_2) 解密 → JSON
 * （对齐 Go step3：hex decode → aesEcbDecrypt → 取 authToken/account/userDomainId）
 */
export const decryptThirdLoginLayer2 = hexInner => {
  const key = hexToWordArray(KEY_HEX_2)
  const rawBytes = new Uint8Array(hexInner.length / 2)
  for (let i = 0; i < hexInner.length; i += 2) {
    rawBytes[i / 2] = parseInt(hexInner.substr(i, 2), 16)
  }
  // ECB 解密需要 CipherParams；先转 base64 复用 aesEcbDecrypt
  const b64 = CryptoES.enc.Base64.stringify(CryptoES.lib.WordArray.create(rawBytes))
  return JSON.parse(aesEcbDecrypt(b64, KEY_HEX_2))
}

// 纯 JS base64 编码（nvue/App 端无 btoa）
const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
export const utf8ToBase64 = str => {
  const bytes = []
  // 手动 UTF-8 编码（unescape 已废弃）
  for (let i = 0; i < str.length; i++) {
    let code = str.codePointAt(i)
    if (code > 0xffff) i++ // 代理对占两个 char
    if (code < 0x80) {
      bytes.push(code)
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f))
    } else if (code < 0x10000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f))
    } else {
      bytes.push(0xf0 | (code >> 18), 0x80 | ((code >> 12) & 0x3f), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f))
    }
  }
  let binary = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0
    binary += B64_CHARS[b0 >> 2]
    binary += B64_CHARS[((b0 & 3) << 4) | (b1 >> 4)]
    binary += i + 1 < bytes.length ? B64_CHARS[((b1 & 15) << 2) | (b2 >> 6)] : '='
    binary += i + 2 < bytes.length ? B64_CHARS[b2 & 63] : '='
  }
  return binary
}

// base64 解码为 UTF-8 字符串
export const base64ToUtf8 = b64 => {
  let str = b64.replace(/=+$/, '')
  const bytes = []
  for (let i = 0; i < str.length; i += 4) {
    let bits = 0
    let valid = 0
    for (let j = 0; j < 4 && i + j < str.length; j++) {
      const idx = B64_CHARS.indexOf(str[i + j])
      if (idx === -1) continue
      bits = (bits << 6) | idx
      valid++
    }
    const byteCount = valid >= 2 ? valid - 1 : 0
    for (let b = 0; b < byteCount; b++) {
      bytes.push((bits >> (valid * 6 - 8 - b * 8)) & 0xff)
    }
  }
  // UTF-8 解码
  let out = ''
  let cp = 0
  for (let i = 0; i < bytes.length; ) {
    const b0 = bytes[i]
    if (b0 < 0x80) {
      cp = b0
      i += 1
    } else if (b0 < 0xe0) {
      cp = ((b0 & 0x1f) << 6) | (bytes[i + 1] & 0x3f)
      i += 2
    } else if (b0 < 0xf0) {
      cp = ((b0 & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f)
      i += 3
    } else {
      cp = ((b0 & 0x07) << 18) | ((bytes[i + 1] & 0x3f) << 12) | ((bytes[i + 2] & 0x3f) << 6) | (bytes[i + 3] & 0x3f)
      i += 4
    }
    out += String.fromCodePoint(cp)
  }
  return out
}

/**
 * Authorization 解析（对齐 Go refreshToken 的解析逻辑）：
 * base64 → "pc:account:token|...|过期毫秒时间戳"
 */
export const parseAuthorization = authorization => {
  const decoded = base64ToUtf8(authorization)
  const splits = decoded.split(':')
  if (splits.length < 3) throw { code: 'CLOUD139_AUTH_INVALID', message: 'authorization is invalid, splits < 3' }
  const account = splits[1]
  const strs = splits[2].split('|')
  if (strs.length < 4) throw { code: 'CLOUD139_AUTH_INVALID', message: 'authorization is invalid, strs < 4' }
  return { prefix: splits[0], account, token: strs[0], expireMs: Number(strs[3]) }
}

/**
 * 重新拼装 Authorization（对齐 Go：base64(prefix:account:newToken|...)）
 * 保留原 token 段以外的其他段
 */
export const buildAuthorization = (prefix, account, newToken, restSegments) =>
  utf8ToBase64(`${prefix}:${account}:${[newToken, ...restSegments].join('|')}`)

// 随机字符串（对齐 Go pkg/utils/random.String(16)：小写字母+数字）
export const randomString = (len = 16) => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let out = ''
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}
