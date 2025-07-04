import * as CONFIG from '@/utils/config.js'
import { loginByPhone } from './apis'
import { encrypt } from "../utils/jsencrypt.js";
import { getUserByopenId } from '../pages/mobile/mine/common.js'
// 全局请求封装
const base_url = CONFIG.BASE_URL
// const base_url = 'http://192.168.31.15:4040/ruoyi'
// 请求超出时间
const timeout = 3000

const noToastUrl = ['/phone/login']

// 需要修改token，和根据实际修改请求头
export default (params) => {
  let url = params.url;
  let method = params.method || "get";
  let data = params.data || {};
  let header = {
    'Content-Type': 'application/json;charset=UTF-8',
    'Authorization': 'Bearer ' + uni.getStorageSync('Authorization'),
    'Tenant-Id': uni.getStorageSync('tenantId') || 'xxx', // avue配置相关
    ...params.header
  }
  if (method == "post") {
    data = data ? JSON.stringify(data) : data;
    header = {
      'Content-Type': 'application/json', // 自定义，跟后台约定好传什么格式的
      'Authorization': 'Bearer ' + uni.getStorageSync('Authorization'),
    };
  }
  return new Promise((resolve, reject) => {
    uni.request({
      url: base_url + url,
      method: method,
      header: header,
      data: data,
      timeout: noToastUrl.indexOf(url) > -1 ? 8000 : timeout,
      success: async (response) => {
        const res = response
        // 根据返回的状态码做出对应的操作
        //获取成功
        // console.log(res.statusCode);
        if (res.statusCode == 200) {
          if (res.data?.code == 0 || res.data?.code == 200) {
            resolve(res.data);
          } else {
            let code = res.data?.code
            // uni.clearStorageSync()
            if (code == 401) {
              // uni.showModal({
              //   title: "提示",
              //   content: "请登录",
              //   showCancel: false,
              //   success: () => {
              //     uni.navigateTo({
              //       url: "/pages/mobile/mine/login",
              //     })
              //   },
              // });
              let userPassword = uni.getStorageSync('userPassword')
              if (!userPassword) return
              let res = await loginByPhone({ phone: userPassword.phone, password: encrypt(userPassword.password) });
              uni.setStorageSync(CONFIG.OPEN_ID, res.openId);
              getUserByopenId();
            } else if (code == 404) {
              uni.showToast({
                title: '请求地址不存在...',
                duration: 2000,
              })
            } else {
              uni.showToast({
                title: res.data.msg,
                icon: 'none',
                duration: 2000,
              })
            }
            reject("接口请求错误")
          }
        } else {
          // uni.clearStorageSync()
          switch (res.statusCode) {
            case 401:
              // uni.showModal({
              //   title: "提示",
              //   content: "请登录",
              //   showCancel: false,
              //   success() {
              //     setTimeout(() => {
              //       uni.navigateTo({
              //         url: "/pages/mobile/mine/login",
              //       })
              //     }, 1000);
              //   },
              // });
              let userPassword = uni.getStorageSync('userPassword')
              if (!userPassword) return
              let res = await loginByPhone({ phone: userPassword.phone, password: encrypt(userPassword.password) });
              uni.setStorageSync(CONFIG.OPEN_ID, res.openId);
              getUserByopenId();
              break;
            case 404:
              uni.showToast({
                title: '请求地址不存在...',
                duration: 2000,
              })
              break;
            default:
              uni.showToast({
                title: '请重试...',
                icon: 'none',
                duration: 2000,
              })
              break;
          }
          reject()
        }
      },
      fail: async (err) => {
        // let userPassword = uni.getStorageSync('userPassword')
        // let res = await loginByPhone({ phone: userPassword.phone, password: encrypt(userPassword.password) });
        // uni.setStorageSync(CONFIG.OPEN_ID, res.openId);
        // getUserByopenId();

        
        // if (err.errMsg.indexOf('request:fail') !== -1) {
        //   if (noToastUrl.indexOf(params.url) < 0) {
        //     uni.showToast({
        //       title: '网络异常',
        //       icon: "error",
        //       duration: 2000
        //     })
        //   }
        // } else {
        //   uni.showToast({
        //     title: '未知异常',
        //     duration: 2000
        //   })
        // }
        reject(err);
      },
      complete() {
        // 不管成功还是失败都会执行
        // uni.hideLoading();
        // uni.hideToast();
      }
    });
  });
};