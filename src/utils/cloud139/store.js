// 移动云盘 139 凭据存储：authorization 落库 sourceList + 账密独立存储（参照 cloud189/store.js 模式）
import { addOperLog } from '@/network/apis'

export const CLOUD139_SOURCE_TYPE = '移动云盘'

const CREDENTIAL_KEY = 'cloud139Credentials'
// 注：账号密码明文存储于 uni storage（与现有 Cookie 明文存储风险等级相同）；
// 该 storage key 不在 data-sync/TCP 同步清单内，不会被同步到其他设备

// 保存账号密码（按 loginName 索引；独立 storage key，data-sync/TCP 同步清单不含此 key）
export const save139Password = (loginName, username, password) => {
  const store = uni.getStorageSync(CREDENTIAL_KEY) || {}
  store[loginName] = { username, password }
  uni.setStorageSync(CREDENTIAL_KEY, store)
}

export const get139Password = loginName => {
  const store = uni.getStorageSync(CREDENTIAL_KEY) || {}
  return store[loginName] || null
}

export const remove139Password = loginName => {
  const store = uni.getStorageSync(CREDENTIAL_KEY) || {}
  delete store[loginName]
  uni.setStorageSync(CREDENTIAL_KEY, store)
}

/**
 * 登录成功后统一落库（参照 persistWopanToken 模式）
 * @param {object} tokenInfo { phone, authorization, account }
 * @param {object} opts { isActive } 登录后是否激活该源
 * @returns {{ isNew: boolean, loginName: string }}
 */
export const persist139Token = (tokenInfo, { isActive } = {}) => {
  const loginName = tokenInfo.phone || tokenInfo.account
  const sourceList = uni.getStorageSync('sourceList') || []
  const cloud139 = sourceList.find(item => item.type == CLOUD139_SOURCE_TYPE)
  if (!cloud139) return { isNew: false, loginName }

  let isNew = false

  if (cloud139.list.length) {
    // 修改：同名改写，不同名清理历史与目录（对齐 persistWopanToken）
    const oldName = cloud139.list[0].name
    if (oldName != loginName) {
      let historyArr = uni.getStorageSync('historyPlay') || []
      historyArr = historyArr.filter(v => v.sourceType != CLOUD139_SOURCE_TYPE || v.sourceName != oldName)
      uni.setStorageSync('historyPlay', historyArr)
      const muluData = uni.getStorageSync('muluData')
      if (muluData) {
        muluData.movie?.forEach(v => {
          v.list = v.list?.filter(m => m.sourceName != oldName || m.sourceType != CLOUD139_SOURCE_TYPE)
        })
        muluData.tv?.forEach(v => {
          v.list = v.list?.filter(m => m.sourceName != oldName || m.sourceType != CLOUD139_SOURCE_TYPE)
        })
        uni.setStorageSync('muluData', muluData)
      }
    }
    cloud139.list = [
      {
        ...cloud139.list[0],
        name: loginName,
        authorization: tokenInfo.authorization,
      },
    ]
  } else {
    // 新增账号
    isNew = true
    cloud139.list = [
      {
        name: loginName,
        authorization: tokenInfo.authorization,
        active: isActive ? '1' : '0',
      },
    ]
    addOperLog({ title: '登录移动云盘', businessType: 12, operatorType: 2, operUrl: '' })
  }
  uni.setStorageSync('sourceList', sourceList)
  // 标记源变更，回首页触发刷新
  uni.setStorageSync('isreload', true)
  return { isNew, loginName }
}

/**
 * token 刷新后回写 sourceList（按当前登录名）
 */
export const update139TokenInStorage = (loginName, authorization) => {
  const sourceList = uni.getStorageSync('sourceList') || []
  const cloud139 = sourceList.find(item => item.type == CLOUD139_SOURCE_TYPE)
  if (!cloud139 || !cloud139.list.length) return
  const entry = cloud139.list.find(v => v.name == loginName) || cloud139.list[0]
  entry.authorization = authorization
  uni.setStorageSync('sourceList', sourceList)
}

/**
 * 取当前激活的移动云盘凭据（selectMedia 等价结构）
 */
export const extract139Credential = credential => ({
  name: credential.name,
  authorization: credential.authorization,
})
