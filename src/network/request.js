import * as CONFIG from '@/utils/config.js'
import { encrypt } from '@/utils/jsencrypt.js'
import { i18n } from '@/i18n/index.js'

// 全局请求封装
const base_url = CONFIG.BASE_URL
// const base_url = 'http://192.168.31.15:4040/ruoyi'
// 请求超出时间
const timeout = 10000

// const noToastUrl = ['/phone/login']
const noToastUrl = []

//登录游客账号
const loginTour = () => {
  return new Promise((resolve, reject) => {
    uni.request({
      url: base_url + '/phone/login',
      method: 'post',
      header: { 'Content-Type': 'application/json' },
      data: { phone: '19994658532', password: encrypt('123456789') },
      timeout: timeout,
      success: res => {
        uni.setStorageSync(CONFIG.OPEN_ID, res.data.openId)
        uni.setStorageSync('Authorization', res.data.accessToken)
        uni.setStorageSync('refreshToken', res.data.refreshToken)
        getUserByopenId(res.data.openId)
          .then(() => resolve(res.data))
          .catch(() => resolve(res.data))
      },
      fail: err => {
        reject(err)
      },
    })
  })
}

//根据openId获取用户信息
const getUserByopenId = async openId => {
  let result = await uni.request({
    url: base_url + '/we/getWuserByopenId',
    method: 'get',
    data: { openId },
    timeout: timeout,
  })
  let res = result.data
  uni.setStorageSync(CONFIG.USER_ID, res.data.userId)
  uni.setStorageSync(CONFIG.USER_KEY, { roleKey: res.data.roleKey, avatar: res.data.avatar, ...res.data.wuser })
  let settingData = uni.getStorageSync('settingData')
  if (settingData) {
    settingData.tmdbKey = res.data.wuser.tmdbKey
    uni.setStorageSync('settingData', settingData)
  } else {
    uni.setStorageSync('settingData', { tmdbKey: res.data.wuser.tmdbKey, showProgress: true, playercodec: 'exoplayer', showRecommend: true })
  }
}

//并发401时只触发一次token刷新，其余请求等待同一次刷新完成后重试
let refreshInFlight = null

//刷新token的方法
const refreshAccess = params => {
  if (refreshInFlight) {
    return refreshInFlight.then(() => retryFail(params))
  }
  refreshInFlight = new Promise((resolve, reject) => {
    uni.request({
      url: base_url + '/refresh',
      method: 'post',
      header: { 'Content-Type': 'application/json' },
      data: { refreshToken: uni.getStorageSync('refreshToken') },
      timeout: timeout,
      success: res => {
        if (res.statusCode === 200) {
          if (res.data?.code === 0 || res.data?.code === 200) {
            uni.setStorageSync('Authorization', res.data.accessToken)
            uni.setStorageSync('refreshToken', res.data.refreshToken)
            resolve()
          } else if (res.data?.code === 401) {
            //此时的情况是刷新token也过期了，登录游客账号后重试原请求
            loginTour()
              .then(() => resolve())
              .catch(err => reject(err))
          } else {
            reject(res.data)
          }
        } else {
          reject(res.data)
        }
      },
      fail: err => {
        reject(err)
      },
    })
  }).finally(() => {
    refreshInFlight = null
  })
  return refreshInFlight.then(() => retryFail(params))
}

//统一的无图标toast
const toast = title => {
  uni.showToast({
    title,
    icon: 'none',
    duration: 2000,
  })
}

//HTTP 200但业务码非成功时的公共处理（不含401，401由调用方处理）
const handleBizError = (res, reject) => {
  let code = res.data?.code
  if (code == 404) {
    toast(i18n.global.t('request.requestAddressNotFound'))
  } else {
    toast(res.data.msg)
  }
  reject(res.data)
}

//刷新token之后，重新执行一遍401失败的接口
const retryFail = params => {
  let url = params.url
  let method = params.method || 'get'
  let data = params.data || {}
  let header = params.header
  header.Authorization = 'Bearer ' + uni.getStorageSync('Authorization')
  if (method == 'post') {
    data = data ? JSON.stringify(data) : data
  }
  return new Promise((resolve, reject) => {
    uni.request({
      url: base_url + url,
      method: method,
      header: header,
      data: data,
      timeout: params.timeout || timeout,
      success: res => {
        if (res.statusCode == 200) {
          if (res.data?.code == 0 || res.data?.code == 200) {
            resolve(res.data)
          } else {
            handleBizError(res, reject)
          }
        } else {
          switch (res.statusCode) {
            case 404:
              toast(i18n.global.t('request.requestAddressNotFound'))
              break
            default:
              if (res.statusCode !== 403) {
                toast(i18n.global.t('request.pleaseRetry'))
              }
              break
          }
          reject(res.data)
        }
      },
      fail: err => {
        reject(err)
      },
    })
  })
}

// 需要修改token，和根据实际修改请求头
export default params => {
  let url = params.url
  let method = params.method || 'get'
  let data = params.data || {}
  let header = {
    'Content-Type': 'application/json;charset=UTF-8',
    'Authorization': 'Bearer ' + uni.getStorageSync('Authorization'),
    'Tenant-Id': uni.getStorageSync('tenantId') || 'xxx', // avue配置相关
    // 'Host': '127.0.0.1', //用于修复请求域名接口时，被拦截的问题。
    ...(params.header || {}),
  }
  if (method == 'post') {
    data = data ? JSON.stringify(data) : data
    header = {
      'Content-Type': 'application/json', // 自定义，跟后台约定好传什么格式的
      'Authorization': 'Bearer ' + uni.getStorageSync('Authorization'),
      // 'Host': '127.0.0.1', //用于修复请求域名接口时，被拦截的问题。
    }
  }
  let requestTask = null
  const promise = new Promise((resolve, reject) => {
    // let isProxy = plus.networkinfo.isSetProxy()
    // if (isProxy) {
    //   reject({ code: 404, msg: '请检查代理设置' })
    //   return
    // }
    requestTask = uni.request({
      url: base_url + url,
      method: method,
      header: header,
      data: data,
      timeout: params.timeout || timeout,
      success: async response => {
        const res = response
        // 根据返回的状态码做出对应的操作
        //获取成功
        if (res.statusCode == 200) {
          if (res.data?.code == 0 || res.data?.code == 200) {
            resolve(res.data)
          } else {
            let code = res.data?.code
            if (code == 401) {
              //token过期，刷新后重试原请求
              refreshAccess({ ...params, header })
                .then(res11 => {
                  resolve(res11)
                })
                .catch(err => {
                  reject(err)
                })
            } else {
              handleBizError(res, reject)
            }
          }
        } else {
          switch (res.statusCode) {
            case 401:
              //token过期，刷新后重试原请求
              refreshAccess({ ...params, header })
                .then(res11 => {
                  resolve(res11)
                })
                .catch(err => {
                  reject(err)
                })
              break
            case 404:
              toast(i18n.global.t('request.requestAddressNotFound'))
              reject(i18n.global.t('request.apiRequestError'))
              break
            case 403:
              uni.navigateTo({
                url: '/pages/mobile/mine/no-permission',
              })
              break
            default:
              toast(i18n.global.t('request.pleaseRetry'))
              reject(res.data)
              break
          }
        }
      },
      fail: async err => {
        reject(err)
      },
      complete() {
        // 不管成功还是失败都会执行
        // uni.hideLoading();
        // uni.hideToast();
      },
    })
  })
  promise.abort = () => {
    if (requestTask) {
      requestTask.abort()
    }
  }
  return promise
}
