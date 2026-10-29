// 移动云盘 139 登录三步链（移植自 AlistGo drivers/139/util.go step1~step3）
// step1 mail.10086.cn 密码登录（302 Location 提 sid/cguid）
// → step2 smsrebuild1 换 artifact(dycpwd)
// → step3 user-njs.yun.139.com thirdlogin 两层 AES 解密取 authToken
import { http139, clearCookieJar139, getCookieValue139 } from './request.js'
import {
  sha1Hash,
  sha1UpperHash,
  buildThirdLoginPayload,
  decryptThirdLoginLayer1,
  decryptThirdLoginLayer2,
  utf8ToBase64,
} from './crypto.js'

// 从 Location / Set-Cookie 里提参数
const matchParam = (location, name) => {
  const m = location.match(new RegExp(`${name}=([^&]+)`))
  return m ? m[1] : ''
}

// headers 取值兼容单值/数组（各端 set-cookie 形态不一）
const normalizeHeadersToArray = (headers, name) => {
  if (!headers) return []
  const raw = headers[name] ?? headers[name.toLowerCase()] ?? headers[name.toUpperCase()]
  if (!raw) return []
  return Array.isArray(raw) ? raw : [raw]
}

/**
 * step1：mail.10086.cn 密码登录（对齐 Go step1_password_login）
 * 密码 = sha1("fetion.com.cn:" + password)；必须拿 302 Location 里的 sid
 * @param {string} username 手机号
 * @param {string} password 明文密码
 * @returns {Promise<{sid: string}>}
 */
export const step1PasswordLogin = async (username, password) => {
  const loginUrl = 'https://mail.10086.cn/Login/Login.ashx'

  // 1. GET 拿 JSESSIONID（cookie jar 自动记录）
  await http139(loginUrl, { method: 'GET' })

  // 2. 密码 sha1 散列 + 组装表单（对齐 Go loginData）
  const hashedPassword = sha1Hash(`fetion.com.cn:${password}`)
  const cguid = String(Date.now())
  const formData = {
    UserName: username,
    passOld: '',
    auto: 'on',
    Password: hashedPassword,
    webIndexPagePwdLogin: '1',
    pwdType: '1',
    clientId: '1003',
    authType: '2',
  }

  const res = await http139(loginUrl, {
    method: 'POST',
    data: Object.entries(formData)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&'),
    header: {
      'Content-Type': 'application/x-www-form-urlencoded',
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'accept-language': 'zh-CN,zh;q=0.9',
      origin: 'https://mail.10086.cn',
      referer: `https://mail.10086.cn/default.html?&s=1&v=0&u=${encodeURIComponent(utf8ToBase64(username))}&m=1&ec=S001&resource=indexLogin&clientid=1003&auto=on&cguid=${cguid}&mtime=45`,
    },
  })

  // 3. 302 Location 提取 sid / cguid（对齐 Go：ec= 出现即风控失败）
  const statusCode = Number(res.statusCode)
  const location = (res.headers && (res.headers.Location || res.headers.location)) || ''

  if (location) {
    const ec = matchParam(location, 'ec')
    if (ec) {
      throw { code: 'CLOUD139_RISK_CONTROL', message: `risk control triggered: ec=${ec}` }
    }
  }

  let sid = matchParam(location, 'sid')
  let extractedCguid = matchParam(location, 'cguid')

  // Location 里没有时，从 Set-Cookie 兜底（对齐 Go）
  if (!sid || !extractedCguid) {
    const setCookies = normalizeHeadersToArray(res.headers, 'set-cookie')
    for (const item of setCookies) {
      if (!sid) {
        const m = item.match(/Os_SSo_Sid=([^;]+)/)
        if (m) sid = m[1]
      }
      if (!extractedCguid) {
        const m = item.match(/cguid=([^;]+)/)
        if (m) extractedCguid = m[1]
      }
    }
  }

  if (!sid || !extractedCguid) {
    // 302 落回 default.html 说明账密错误
    if (location.includes('default.html')) {
      throw { code: 'CLOUD139_AUTH_FAILED', message: 'authentication failed: sid is missing in default.html redirect' }
    }
    throw { code: 'CLOUD139_LOGIN_FAILED', message: `failed to extract sid or cguid (status ${statusCode})` }
  }

  return { sid }
}

/**
 * step2：换 artifact 单令牌（对齐 Go step2_get_single_token）
 * @returns {Promise<string>} dycpwd
 */
export const step2GetSingleToken = async sid => {
  const cguid = String(Date.now())
  const exchangeUrl = `https://smsrebuild1.mail.10086.cn/setting/s?func=${encodeURIComponent('umc:getArtifact')}&sid=${sid}&cguid=${cguid}`

  // RMKEY 从 step1 落下的 cookie jar 里取（mail.10086.cn 域）
  const rmkey = getCookieValue139('https://mail.10086.cn/', 'RMKEY')
  if (!rmkey) {
    throw { code: 'CLOUD139_RMKEY_MISSING', message: 'RMKEY not found in mail cookies' }
  }

  const res = await http139(exchangeUrl, {
    method: 'POST',
    header: {
      Cookie: `RMKEY=${rmkey}`,
      'Content-Type': 'text/xml; charset=utf-8',
      'User-Agent': 'okhttp/4.12.0',
    },
  })

  const body = typeof res.data === 'string' ? JSON.parse(res.data) : res.data
  const dycpwd = body?.var?.artifact
  if (!dycpwd) {
    throw {
      code: body?.code || 'CLOUD139_ARTIFACT_MISSING',
      message: body?.summary || 'failed to extract dycpwd from artifact exchange response',
    }
  }
  return dycpwd
}

/**
 * step3：第三方单点登录（对齐 Go step3_third_party_login）
 * 请求体两层 AES 加密；响应两层解密取 authToken
 * @returns {Promise<{authorization, account, userDomainId}>} authorization = base64("pc:account:authToken")
 */
export const step3ThirdPartyLogin = async (dycpwd, username) => {
  const ssoLoginUrl = 'https://user-njs.yun.139.com/user/thirdlogin'

  const payload = buildThirdLoginPayload({
    clientkey_decrypt: 'l3TryM&Q+X7@dzwk)qP',
    clienttype: '886',
    cpid: '507',
    dycpwd,
    extInfo: { ifOpenAccount: '0' },
    loginMode: '0',
    msisdn: username,
    pintype: '13',
    secinfo: sha1UpperHash(`fetion.com.cn:${dycpwd}`),
    version: '20250901',
  })

  const res = await http139(ssoLoginUrl, {
    method: 'POST',
    data: payload,
    header: {
      'hcy-cool-flag': '1',
      'x-huawei-channelSrc': '10246600',
      'x-sdk-channelSrc': '',
      'x-MM-Source': '0',
      'x-UserAgent': 'android|23116PN5BC|android15|1.2.6|||1440x3200|10246600',
      'x-DeviceInfo': '4|127.0.0.1|5|1.2.6|Xiaomi|23116PN5BC||02-00-00-00-00-00|android 15|1440x3200|android|||',
      'Content-Type': 'text/plain;charset=UTF-8',
      'Accept-Encoding': 'gzip',
      'User-Agent': 'okhttp/3.12.2',
    },
  })

  // 第一层解密：base64(IV+ciphertext) → JSON，取 data 字段（hex 密文）
  const layer1 = decryptThirdLoginLayer1(res.data)
  const hexInner = layer1?.data
  if (!hexInner) {
    throw { code: 'CLOUD139_LAYER1_MISSING', message: 'missing data field in first layer decryption result' }
  }

  // 第二层解密：hex → AES-ECB → JSON，取 authToken
  const layer2 = decryptThirdLoginLayer2(hexInner)
  const authToken = layer2?.authToken
  const account = layer2?.account
  const userDomainId = layer2?.userDomainId
  if (!authToken || !account || !userDomainId) {
    throw { code: 'CLOUD139_TOKEN_MISSING', message: 'failed to extract authToken/account/userDomainId' }
  }

  // authorization = base64("pc:account:authToken")（对齐 Go）
  const authorization = utf8ToBase64(`pc:${account}:${authToken}`)
  return { authorization, account, userDomainId }
}

/**
 * 完整登录流程（UI 一次调用）
 * @returns {Promise<{authorization, account, userDomainId}>}
 */
export const login139 = async (username, password) => {
  clearCookieJar139()
  const { sid } = await step1PasswordLogin(username, password)
  const dycpwd = await step2GetSingleToken(sid)
  return step3ThirdPartyLogin(dycpwd, username)
}
