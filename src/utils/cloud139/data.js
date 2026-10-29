// 移动云盘 139 数据层（移植自 AlistGo drivers/139/util.go personalGetFiles/personalGetLink/ensurePersonalCloudHost/refreshToken）
// 走 personal_new 新个人云 API：qryRoutePolicy 探测动态 host → /file/list → /file/getDownloadUrl
// 响应映射为 fileListAO 结构，供上层零改动复用
import { request139Cloud, http139 } from './request.js'
import { parseAuthorization, buildAuthorization } from './crypto.js'
import { login139 } from './login.js'
import { update139TokenInStorage, get139Password } from './store.js'

// 会话保障：Promise 去重，防止扫库并发失效时触发刷新风暴（参照 ensureSession189）
let ensureSessionPromise = null

/**
 * Authorization 临期刷新（对齐 Go refreshToken）：
 * 剩余有效期 >15 天直接复用；过期抛错；临期走 authTokenRefresh.do 换新 token
 */
export const refreshAuthorization139 = async credential => {
  const parsed = parseAuthorization(credential.authorization)
  const remainMs = parsed.expireMs - Date.now()
  if (remainMs > 1000 * 60 * 60 * 24 * 15) {
    return credential
  }
  if (remainMs < 0) {
    throw { code: 'NEED_FULL_LOGIN' }
  }

  // 刷新（对齐 Go：XML 协议）
  const url = 'https://aas.caiyun.feixin.10086.cn:443/tellin/authTokenRefresh.do'
  const xmlBody = `<root><token>${parsed.token}</token><account>${parsed.account}</account><clienttype>656</clienttype></root>`
  const res = await http139(url, {
    method: 'POST',
    data: xmlBody,
    header: { 'Content-Type': 'application/xml' },
  })
  // 响应为 XML（对齐 Go RefreshTokenResp 的 xml 标签解析），正则提取不引 xml 库
  const xmlStr = typeof res.data === 'string' ? res.data : String(res.data)
  const xmlTag = name => {
    const m = xmlStr.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))
    return m ? m[1].trim() : ''
  }
  const body = { Return: xmlTag('return'), Token: xmlTag('token'), Desc: xmlTag('desc') }
  if (body.Return !== '0') {
    throw { code: 'NEED_FULL_LOGIN', message: body.Desc || 'failed to refresh token' }
  }

  // 重组 authorization（对齐 Go util.go:165：base64(prefix:account:newToken)，丢弃原第三段 token 之后的 | 各段）
  // 注：若真实响应的 token 不自带 | 分段，Go 同样会在下次解析时 strs<4 报错，此处镜像 Go 行为，真机验证时确认
  const authorization = buildAuthorization(parsed.prefix, parsed.account, body.Token)
  return { ...credential, authorization }
}

/**
 * 会话保障：Authorization 校验 + 临期刷新 + 失效后用存储账密重登
 * @param {object} credential { authorization, name }
 */
export const ensureSession139 = async credential => {
  if (!ensureSessionPromise) {
    ensureSessionPromise = (async () => {
      try {
        return await refreshAuthorization139(credential)
      } catch (e) {
        if (e && e.code === 'NEED_FULL_LOGIN') {
          const cred = get139Password(credential.name)
          if (!cred) {
            throw { code: 'NEED_MANUAL_LOGIN' }
          }
          try {
            const result = await login139(cred.username, cred.password)
            update139TokenInStorage(credential.name, result.authorization)
            return { ...credential, authorization: result.authorization }
          } catch (e2) {
            throw e2.code === 'CLOUD139_RISK_CONTROL' || e2.code === 'CLOUD139_AUTH_FAILED'
              ? e2
              : { code: 'NEED_MANUAL_LOGIN', message: e2.message }
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

// 模块级 host 缓存（对齐 Go d.PersonalCloudHost）
let personalCloudHost = ''

/**
 * 路由探测拿新个人云 host（对齐 Go ensurePersonalCloudHost）
 */
export const ensurePersonalCloudHost = async credential => {
  if (personalCloudHost) return personalCloudHost
  const parsed = parseAuthorization(credential.authorization)
  const body = await request139Cloud({
    pathname: '/user/route/qryRoutePolicy',
    data: {
      userInfo: { userType: 1, accountType: 1, accountName: parsed.account },
      modAddrType: 1,
    },
    authorization: credential.authorization,
    personalHost: 'https://user-njs.yun.139.com',
  })
  const list = body?.data?.routePolicyList || []
  for (const item of list) {
    if (item.modName === 'personal' && item.httpsUrl) {
      personalCloudHost = item.httpsUrl.replace(/\/$/, '')
      return personalCloudHost
    }
  }
  throw { code: 'CLOUD139_HOST_EMPTY', message: 'personal cloud host is empty' }
}

/**
 * 个人云签名请求（host 就绪 + Authorization + mcloud-sign）
 */
export const personalPost139 = async (credential, pathname, data) => {
  const host = await ensurePersonalCloudHost(credential)
  return request139Cloud({
    pathname,
    data,
    authorization: credential.authorization,
    personalHost: host,
  })
}

/**
 * 文件列表（对齐 Go personalGetFiles：/file/list 游标分页）
 * 映射为 fileListAO 结构（对齐天翼云盘/联通云盘，上层零改动）
 * @param {string} fileId 目录 id（根目录传 'root'）
 */
export const list139Files = async (fileId, credential) => {
  const valid = await ensureSession139(credential)
  let pageCursor = ''
  const all = []
  for (;;) {
    const body = await personalPost139(valid, '/file/list', {
      imageThumbnailStyleList: ['Small', 'Large'],
      orderBy: 'updated_at',
      orderDirection: 'DESC',
      pageInfo: { pageCursor, pageSize: 100 },
      parentFileId: fileId,
    })
    const items = body?.data?.items || []
    all.push(...items)
    pageCursor = body?.data?.nextPageCursor || ''
    if (!pageCursor) break
  }

  const folderList = all
    .filter(v => v.type === 'folder')
    .map(v => ({
      id: v.fileId,
      name: v.name,
      createTime: v.createdAt,
      updateTime: v.updatedAt,
    }))
  const fileList = all
    .filter(v => v.type !== 'folder')
    .map(v => ({
      id: v.fileId,
      name: v.name,
      size: Number(v.size || 0),
      createTime: v.createdAt,
      updateTime: v.updatedAt,
      thumbUrl: pickThumb(v),
    }))
  return {
    fileListAO: {
      fileList,
      folderList,
      count: all.length,
    },
  }
}

// 缩略图选择（对齐 Go：优先 Large）
const pickThumb = item => {
  const thumbs = item?.thumbnails || []
  const large = thumbs.find(t => (t.style || '').includes('Large'))
  if (large) return large.url
  if (thumbs.length) return thumbs[thumbs.length - 1].url
  return ''
}

/**
 * 获取下载/播放直链（对齐 Go personalGetLink：/file/getDownloadUrl，优先 cdnUrl）
 * @returns {Promise<{url: string}>}
 */
export const get139DownloadUrl = async (fileId, credential) => {
  const valid = await ensureSession139(credential)
  const body = await personalPost139(valid, '/file/getDownloadUrl', { fileId })
  const data = body?.data || {}
  const url = data.cdnUrl || data.url || ''
  if (!url) {
    throw { code: 'CLOUD139_NO_DOWNLOAD_URL', message: 'download url not found' }
  }
  return { url }
}
