import * as CONFIG from '@/utils/config.js'
// import { ipc } from "@/utils/ipcRenderer";
// import { ipcApiRoute } from "@/utils/ipcApiRoute";
import { sendEmail } from '@/network/apis'
import { i18n } from '@/i18n/index.js'
import { getTvSeasonDetail, getMovieTvDetailById } from '@/utils/tmdb'
// import { ipc } from '@/utils/ipcRenderer'
// import { ipcApiRoute } from '@/utils/ipcApiRoute'

// 工具函数：构建 Cookie 字符串
const buildCookie = cookieObj => {
  return Object.entries(cookieObj)
    .map(([key, value]) => `${key}=${value}`)
    .join(';')
}

// 统一请求封装：PC 端走 Electron IPC，其余平台走 uni.request
// 注意：ipc / ipcApiRoute 的 import 由 build/build.js 按平台自动注释/取消注释
const httpRequest = (url, { method = 'GET', data, header, timeout = 5000 } = {}) => {
  return new Promise((resolve, reject) => {
    if (CONFIG.IS_PC) {
      ipc
        .invoke(ipcApiRoute.httpRequest, {
          url,
          method,
          data,
          header,
          options: {
            timeout,
          },
        })
        .then(res => {
          if (res.code === 200) {
            resolve(res.data)
          } else {
            reject(res)
          }
        })
        .catch(error => {
          reject(error)
        })
    } else {
      uni.request({
        url,
        method,
        data,
        header,
        timeout,
        success: res => {
          resolve(res.data)
        },
        fail: error => {
          reject(error)
        },
      })
    }
  })
}

const UA_189 = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0'
const UA_QUARK =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) quark-cloud-drive/3.2.7 Chrome/100.0.4896.160 Electron/18.3.5.17-1a44cfa97d Safari/537.36 Channel/pckk_other_ch'

// 天翼云盘通用请求头
const build189Header = (cookieStr, { referer = false, signType = false } = {}) => {
  const header = {
    'Accept': 'application/json;charset=UTF-8',
    'Accept-Language': 'zh-CN,zh;q=0.8,zh-TW;q=0.7,zh-HK;q=0.5,en-US;q=0.3,en;q=0.2',
    Connection: 'keep-alive',
    Cookie: cookieStr,
    Host: 'cloud.189.cn',
    Priority: 'u=0',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
    TE: 'trailers',
    'User-Agent': UA_189,
  }
  if (referer) {
    header.Referer = 'https://cloud.189.cn/web/main/file/folder/-11'
  }
  if (signType) {
    header['Sign-Type'] = '1'
  }
  return header
}

// 夸克网盘通用请求头
const buildQuarkHeader = (cookieStr, { host = 'drive-pc.quark.cn', referer = 'https://pan.quark.cn/', json = false } = {}) => {
  const header = {
    'Accept-Language': 'zh-CN,zh;q=0.8,zh-TW;q=0.7,zh-HK;q=0.5,en-US;q=0.3,en;q=0.2',
    Connection: 'keep-alive',
    Cookie: cookieStr,
    Host: host,
    Referer: referer,
    'User-Agent': UA_QUARK,
  }
  if (json) {
    header['Content-Type'] = 'application/json;charset=utf-8'
  }
  return header
}

const build189Cookie = cookieInfo =>
  buildCookie({
    JSESSIONID: cookieInfo.JSESSIONID,
    COOKIE_LOGIN_USER: cookieInfo.COOKIE_LOGIN_USER,
  })

// 工具函数：生成随机数字字符串
const generateRandomDigits = (length = 16) => {
  return Array.from({ length }, () => Math.floor(Math.random() * 10)).join('')
}

//webdav
const getFolder = (data, webdavInfo) => {
  return new Promise((resolve, reject) => {
    uni.request({
      url: webdavInfo.protocol + '://' + webdavInfo.address + ':' + webdavInfo.port + '/api/fs/list',
      data: JSON.stringify({ ...data, page: 1, per_page: 1000, refresh: false }),
      timeout: 10000,
      method: 'POST',
      header: {
        Authorization: webdavInfo.token,
        'Content-Type': 'application/json',
      },
      success: res => {
        resolve(res.data)
      },
      fail: error => {
        reject(error)
      },
    })
  })
}

//webdav获取视频链接
const getWebDAVUrl = (data, webdavInfo) => {
  let requestUrl = webdavInfo.protocol + '://' + webdavInfo.address + ':' + webdavInfo.port + '/api/fs/get'
  return new Promise((resolve, reject) => {
    uni.request({
      url: requestUrl,
      data: JSON.stringify({
        path: '/' + data.path,
        password: '',
      }),
      timeout: 10000,
      method: 'POST',
      header: {
        Authorization: webdavInfo.token,
        'Content-Type': 'application/json',
      },
      success: res => {
        resolve(res.data)
      },
      fail: error => {
        reject(error)
      },
    })
  })
}

//webdav登录
const loginUser = webdavInfo => {
  return new Promise((resolve, reject) => {
    uni.request({
      url: webdavInfo.protocol + '://' + webdavInfo.address + ':' + webdavInfo.port + '/api/auth/login',
      data: JSON.stringify({
        username: webdavInfo.username,
        password: webdavInfo.password,
      }),
      timeout: 10000,
      method: 'POST',
      header: { 'Content-Type': 'application/json' },
      success: res => {
        resolve(res.data)
      },
      fail: error => {
        reject(error)
      },
    })
  })
}

//天翼云盘
//凭证分流：条目含 sessionKey（189pc 账密登录）走新签名数据层，否则走旧 Cookie 体系
import { list189Files, get189DownloadUrlNew, get189UserInfo } from '@/utils/cloud189/data.js'

const legacyGet189Folder = (data, cookieInfo) => {
  return httpRequest(`${CONFIG.Folder189Url}&folderId=${data.folderId}&pageNum=${data.pageNum || 1}&pageSize=${data.pageSize || 1000}`, {
    method: 'GET',
    header: build189Header(build189Cookie(cookieInfo), { signType: true }),
    timeout: 3000,
  })
}

const legacyGet189VideoUrl = (data, cookieInfo) => {
  const randomDigits = generateRandomDigits()
  return httpRequest(`${CONFIG.Video189Url}?noCache=0.${randomDigits}&fileId=${data.folderFileId}&type=2`, {
    method: 'GET',
    header: build189Header(build189Cookie(cookieInfo), { signType: true }),
    timeout: 5000,
  })
}

const legacyGet189User = obj => {
  const randomDigits = generateRandomDigits()
  return httpRequest(`${CONFIG.User189Url}?noCache=0.${randomDigits}`, {
    method: 'GET',
    header: build189Header(build189Cookie(obj), { referer: true }),
    timeout: 3000,
  })
}

const legacyGet189DownloadUrl = (data, cookieInfo) => {
  const randomDigits = generateRandomDigits()
  return httpRequest(`${CONFIG.Download189Url}?noCache=0.${randomDigits}&fileId=${data.folderFileId}`, {
    method: 'GET',
    header: build189Header(build189Cookie(cookieInfo), { signType: true }),
    timeout: 5000,
  })
}

const get189Folder = (data, credential) =>
  credential.sessionKey ? list189Files(data, credential) : legacyGet189Folder(data, credential)

//天翼云盘获取视频链接
const get189VideoUrl = (data, credential) =>
  credential.sessionKey ? get189DownloadUrlNew(data, credential) : legacyGet189VideoUrl(data, credential)

//天翼云盘获取用户信息
const get189User = credential =>
  credential.sessionKey ? get189UserInfo(credential) : legacyGet189User(credential)

//天翼云盘获取文件下载链接
const get189DownloadUrl = (data, credential) =>
  credential.sessionKey ? get189DownloadUrlNew(data, credential) : legacyGet189DownloadUrl(data, credential)

//夸克网盘
const getQuarkFolder = (data, cookieInfo) => {
  return httpRequest(`${CONFIG.QuarkFolderUrl}&pdir_fid=${data.fid}&_page=${data.pageNum || 1}&_size=${data.pageSize || 1000}`, {
    method: 'GET',
    header: buildQuarkHeader(cookieInfo.Cookie),
    timeout: 3000,
  })
}

//夸克网盘获取视频或者文件下载链接
const getQuarkVideoUrl = (data, cookieInfo) => {
  return httpRequest(CONFIG.QuarkVideoUrl, {
    method: 'POST',
    data: JSON.stringify({ fids: [data.folderFileId], speedup_session: '' }),
    header: buildQuarkHeader(cookieInfo.Cookie, { json: true }),
    timeout: 5000,
  })
}

//夸克网盘获取不同清晰度的视频链接
const getQuarkResolutionUrl = (data, cookieInfo) => {
  return httpRequest(CONFIG.QuarkResolutionUrl, {
    method: 'POST',
    data: JSON.stringify({ fid: data.folderFileId, resolutions: 'normal,low,high,super,2k,4k', supports: 'fmp4,m3u8' }),
    header: buildQuarkHeader(cookieInfo.Cookie, { json: true }),
    timeout: 5000,
  })
}

//夸克网盘获取用户信息
const getQuarkUser = obj => {
  return httpRequest(CONFIG.QuarkUserUrl, {
    method: 'GET',
    header: buildQuarkHeader(obj.Cookie, { host: 'pan.quark.cn', referer: 'https://pan.quark.cn/list' }),
    timeout: 5000,
  })
}

//联通云盘
import { listWopanFiles, getWopanDownloadUrl, getWopanUser } from '@/utils/wopan/data.js'

//联通云盘获取文件列表（fileListAO 结构对齐天翼云盘，上层零改动）
const getWopanFolder = (data, credential) => listWopanFiles(data.folderId, credential)

//联通云盘获取视频播放/下载链接
const getWopanVideoUrl = (data, credential) => getWopanDownloadUrl(data.folderFileId, credential)

//获取第几季的详情
const getTvSeason = data => getTvSeasonDetail(data)
//通过tmdb接口获取更详细的信息
const getMovieTvById = (data, type) => getMovieTvDetailById(data, type)

// //设置tmdb图片的域名
// const setTmdbImgDomain = () => {
//   uni.requireNativePlugin(NetworkModule);
//   NetworkModule.request(
//     {
//       url: 'https://media.themoviedb.org',
//       timeout: 5000,
//       method: "GET",
//     },
//     (res) => {
//       uni.setStorageSync('imgDomain', res.location);
//     },
//     (error) => { }
//   );
// }

//获取剪切板的内容，是否是分享链接，是的话弹窗弹窗，看看是不是要跳到资源保存页面
const getCutContent = () => {
  return new Promise((resolve, reject) => {
    uni.getClipboardData({
      success: res => {
        const urlRegex = /(https?:\/\/[^\s\u4e00-\u9fa5，。；！？、]+)/g
        const urls = res.data.match(urlRegex) // ["https://cloud.189.cn/t/uMfaErJFFrm2"]
        if (urls && (urls[0].startsWith('https://cloud.189.cn/') || urls[0].startsWith('https://pan.quark.cn/'))) {
          if (uni.getStorageSync('shareUrl') === urls[0]) {
            resolve(null)
          } else {
            uni.setStorageSync('shareUrl', urls[0])
            resolve(urls[0])
          }
        } else {
          resolve(null)
        }
      },
      fail: () => {
        resolve(null)
      },
    })
  })
}

let timer = null
//发送邮箱验证码
const toSendEmail = async (codeEncrypt, countDown, email) => {
  if (countDown.value < 61) return //如果正在倒计时，那么点击不进行任何响应
  if (email) {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
    if (!emailRegex.test(email)) {
      uni.showToast({
        title: i18n.global.t('auth.emailInvalid'),
        icon: 'none',
      })
    } else {
      //先清掉可能残留的旧倒计时，避免定时器泄漏
      if (timer) {
        clearInterval(timer)
        timer = null
      }
      timer = setInterval(() => {
        countDown.value--
        if (countDown.value === -1) {
          countDown.value = 61
          clearInterval(timer)
          timer = null
        }
      }, 1000)
      let res = await sendEmail({ email: email })
      codeEncrypt.value = res.codeEncrypt
    }
  } else {
    uni.showToast({
      title: i18n.global.t('auth.pleaseInputEmailFirst'),
      icon: 'none',
    })
  }
}

//页面卸载时调用，清理邮箱验证码倒计时定时器
export const clearEmailTimer = () => {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

//获取gitee的app的最新release版本
const getAppLatestVersion = () => {
  return new Promise(resolve => {
    uni.request({
      url: 'https://gitee.com/api/v5/repos/waylon-chen/William-Player/releases/latest',
      method: 'GET',
      success: res => {
        resolve(res.data)
      },
    })
  })
}

export {
  getFolder,
  getWebDAVUrl,
  loginUser,
  get189Folder,
  get189VideoUrl,
  get189User,
  get189DownloadUrl,
  getQuarkFolder,
  getQuarkVideoUrl,
  getQuarkResolutionUrl,
  getQuarkUser,
  getWopanFolder,
  getWopanVideoUrl,
  getWopanUser,
  getTvSeason,
  getMovieTvById,
  getCutContent,
  toSendEmail,
  getAppLatestVersion,
}
