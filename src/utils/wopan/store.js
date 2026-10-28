// 联通云盘凭据存储：token 落库 sourceList（参照 cloud189/store.js 的 persist189Token 模式）
import { addOperLog } from '@/network/apis'

export const WOPAN_SOURCE_TYPE = '联通云盘'

/**
 * 登录成功后统一落库
 * @param {object} tokenInfo { phone, accessToken, refreshToken }
 * @param {object} opts { isActive } 登录后是否激活该源
 * @returns {{ isNew: boolean, loginName: string }}
 */
export const persistWopanToken = (tokenInfo, { isActive } = {}) => {
  const loginName = tokenInfo.phone
  const sourceList = uni.getStorageSync('sourceList') || []
  const wopan = sourceList.find(item => item.type == WOPAN_SOURCE_TYPE)
  if (!wopan) return { isNew: false, loginName }

  let isNew = false

  if (wopan.list.length) {
    // 修改：同名改写，不同名清理历史与目录（对齐 persist189Token）
    const oldName = wopan.list[0].name
    if (oldName != loginName) {
      let historyArr = uni.getStorageSync('historyPlay') || []
      historyArr = historyArr.filter(v => v.sourceType != WOPAN_SOURCE_TYPE || v.sourceName != oldName)
      uni.setStorageSync('historyPlay', historyArr)
      const muluData = uni.getStorageSync('muluData')
      if (muluData) {
        muluData.movie?.forEach(v => { v.list = v.list?.filter(m => m.sourceName != oldName || m.sourceType != WOPAN_SOURCE_TYPE) })
        muluData.tv?.forEach(v => { v.list = v.list?.filter(m => m.sourceName != oldName || m.sourceType != WOPAN_SOURCE_TYPE) })
        uni.setStorageSync('muluData', muluData)
      }
    }
    wopan.list = [
      {
        ...wopan.list[0],
        name: loginName,
        accessToken: tokenInfo.accessToken,
        refreshToken: tokenInfo.refreshToken,
      },
    ]
  } else {
    // 新增账号
    isNew = true
    wopan.list = [
      {
        name: loginName,
        accessToken: tokenInfo.accessToken,
        refreshToken: tokenInfo.refreshToken,
        active: isActive ? '1' : '0',
      },
    ]
  }
  uni.setStorageSync('sourceList', sourceList)
  // 标记源变更，回首页触发刷新
  uni.setStorageSync('isreload', true)
  return { isNew, loginName }
}

/**
 * token 刷新后回写 sourceList（按当前登录名或条目索引）
 */
export const updateWopanTokenInStorage = (accessToken, refreshToken) => {
  const sourceList = uni.getStorageSync('sourceList') || []
  const wopan = sourceList.find(item => item.type == WOPAN_SOURCE_TYPE)
  if (!wopan || !wopan.list.length) return
  wopan.list[0].accessToken = accessToken
  if (refreshToken) wopan.list[0].refreshToken = refreshToken
  uni.setStorageSync('sourceList', sourceList)
}

/**
 * 取当前激活的联通云盘凭据（selectMedia 等价结构）
 * @param {object} credential sourceList 条目 {name, accessToken, refreshToken, ...}
 */
export const extractWopanCredential = credential => ({
  name: credential.name,
  accessToken: credential.accessToken,
  refreshToken: credential.refreshToken,
})
