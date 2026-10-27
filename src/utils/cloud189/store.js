// 天翼云盘凭据存储：token 落库（sourceList）+ 账密独立存储（cloud189Credentials，不进同步路径）
import { addOperLog } from '@/network/apis'

const CREDENTIAL_KEY = 'cloud189Credentials'
// 注：账号密码明文存储于 uni storage（与现有 Cookie 明文存储风险等级相同）；
// 该 storage key 不在 data-sync/TCP 同步清单内，不会被同步到其他设备

// 保存账号密码（按 loginName 索引；独立 storage key，data-sync/TCP 同步清单不含此 key）
export const save189Password = (loginName, username, password) => {
  const store = uni.getStorageSync(CREDENTIAL_KEY) || {}
  store[loginName] = { username, password }
  uni.setStorageSync(CREDENTIAL_KEY, store)
}

export const get189Password = loginName => {
  const store = uni.getStorageSync(CREDENTIAL_KEY) || {}
  return store[loginName] || null
}

export const remove189Password = loginName => {
  const store = uni.getStorageSync(CREDENTIAL_KEY) || {}
  delete store[loginName]
  uni.setStorageSync(CREDENTIAL_KEY, store)
}

// 从 token 响应中提取 sourceList 条目字段（不含账号密码）
export const extract189TokenFields = tokenInfo => ({
  sessionKey: tokenInfo.sessionKey,
  sessionSecret: tokenInfo.sessionSecret,
  accessToken: tokenInfo.accessToken,
  refreshToken: tokenInfo.refreshToken,
  familySessionKey: tokenInfo.familySessionKey,
  familySessionSecret: tokenInfo.familySessionSecret,
})

/**
 * 登录成功后统一落库（逻辑抽取自 cloud189-webview.nvue handleConfirm）
 * @param {object} tokenInfo login189 返回的会话 token
 * @param {object} opts { isActive: '1'|'0' } 路由参数，对齐 webview 页行为
 * @returns {{ isNew: boolean, loginName: string }}
 */
export const persist189Token = (tokenInfo, { isActive } = {}) => {
  const loginName = tokenInfo.loginName
  const sourceList = uni.getStorageSync('sourceList') || []
  const cloud189 = sourceList.find(item => item.type == '天翼云盘')
  if (!cloud189) return { isNew: false, loginName }

  const tokenFields = extract189TokenFields(tokenInfo)
  let isNew = false

  if (cloud189.list.length) {
    // 修改：同名改写，不同名清理历史与目录
    const oldName = cloud189.list[0].name
    if (oldName != loginName) {
      let historyArr = uni.getStorageSync('historyPlay') || []
      historyArr = historyArr.filter(v => v.sourceType != '天翼云盘' || v.sourceName != oldName)
      uni.setStorageSync('historyPlay', historyArr)
      const muluData = uni.getStorageSync('muluData')
      if (muluData) {
        muluData.movie?.forEach(v => {
          if (v.name == oldName) v.name = loginName
        })
        muluData.tv?.forEach(v => {
          if (v.name == oldName) v.name = loginName
        })
        uni.setStorageSync('muluData', muluData)
      }
    }
    // 清除旧 Cookie 字段，写入 token 字段
    delete cloud189.list[0].JSESSIONID
    delete cloud189.list[0].COOKIE_LOGIN_USER
    Object.assign(cloud189.list[0], tokenFields, { name: loginName })
  } else {
    // 添加
    isNew = true
    const isHaveData = !sourceList.every(item => !item.list.length)
    const obj = { name: loginName, ...tokenFields }
    if (!isHaveData) {
      obj.active = true
      uni.setStorageSync('isreload', true)
    }
    cloud189.list.push(obj)
    addOperLog({ title: '登录天翼云盘', businessType: 12, operatorType: 2, operUrl: '' })
  }

  uni.setStorageSync('sourceList', sourceList)
  return { isNew, loginName }
}

// 更新 sourceList 中指定账号的 token 字段（会话刷新后回写）
export const update189TokenInStorage = (loginName, tokenInfo) => {
  const sourceList = uni.getStorageSync('sourceList') || []
  const cloud189 = sourceList.find(item => item.type == '天翼云盘')
  const entry = cloud189?.list.find(v => v.name == loginName)
  if (entry) {
    Object.assign(entry, extract189TokenFields(tokenInfo))
    uni.setStorageSync('sourceList', sourceList)
  }
}
