//该js文件用于下载方法（对接 WilliamDownloader v2 内核）
import { i18n } from '@/i18n/index.js'
import { getWebDAVUrl, get189VideoUrl, getQuarkVideoUrl, getWopanVideoUrl, get139VideoUrl, buildQuarkHeader, build189Header, build189Cookie } from '@/utils/common'

let DownloaderManager = null
let initialized = false //真实初始化成功过才置 true，失败后允许下次重试
let downloadDir = '' //真实下载目录，由 init 回调给出，不要再硬编码
//v2 新增 WAITING（排队中）：不算进运行中就会漏掉限额判断
export const ACTIVE_STATUS = ['DOWNLOADING', 'WAITING', 'CONNECTING', 'PAUSED', 'ERROR']
//同时下载任务上限，与 init 的 maxConcurrentTasks 保持一致
const MAX_CONCURRENT = 3
//m3u8 是播放列表而非媒体文件，下载下来只有几十字节，必须拦截
const HLS_FORMAT = ['m3u8', 'strm']

//原生错误码统一提示，避免 `not initialized, call init() first` 这类英文原文直接弹给用户
const NATIVE_CODE_TEXT = {
    3000: 'toolbox.downloadTaskExists',
    3001: 'toolbox.downloadUrlInvalid',
    3002: 'toolbox.downloadStorageFull',
    3003: 'toolbox.downloadTaskNotFound',
    3004: 'toolbox.downloadTaskFinished',
    3005: 'toolbox.downloadInitFailed',
}
const showNativeError = res => {
    const key = NATIVE_CODE_TEXT[res && res.code]
    uni.showToast({
        title: key ? i18n.global.t(key) : (res && res.msg) || i18n.global.t('toolbox.downloadFailed'),
        icon: 'none',
    })
}

//初始化安卓原生下载器
export const initDownloader = (callback = () => {}) => {
    if (initialized) {
        callback()
        return
    }
    if (!DownloaderManager) {
        DownloaderManager = uni.requireNativePlugin('WilliamDownloader')
    }
    DownloaderManager.init(
        {
            maxConcurrentTasks: 3, // 最大同时下载任务数
            maxSegments: 3, // 单个任务的分片并发数
            autoRecovery: true, // 启动时自动恢复未完成任务
            retryCount: 3, // 分片级重试次数
            retryIntervalMillis: 1000, // 首次重试间隔，之后翻倍
            maxDirBytes: 20 * 1024 * 1024 * 1024, // 下载目录占用上限（20GB）
        },
        res => {
            if (res && res.code === 0) {
                initialized = true
                downloadDir = (res.data && res.data.downloadDir) || ''
            } else {
                uni.showToast({
                    title: i18n.global.t('toolbox.downloadInitFailed'),
                    icon: 'none',
                })
            }
            //无论成败都要回调，否则调用方会永远卡在这里
            callback(res)
        }
    )
}

//真实下载目录（init 之前为空）
export const getDownloadDir = () => downloadDir

//查询所有下载任务
export const queryAll = (callback, selectArr) => {
    const downloadArr = selectArr ? JSON.parse(JSON.stringify(selectArr)) : []
    initDownloader(res => {
        if (res && res.code !== 0) {
            return
        }
        DownloaderManager.queryAll(res => {
            if (res && res.code !== 0) {
                showNativeError(res)
                return
            }
            // v2 的 data 已经是数组，不要再 JSON.parse
            const arr = Array.isArray(res && res.data) ? res.data : []
            const activeList = arr.filter(i => ACTIVE_STATUS.includes(i.status))
            // 原先是 >= 3：0 个任务时选 3 集也会被拒绝，批量实际只能下 2 条
            if (activeList.length + downloadArr.length > MAX_CONCURRENT) {
                uni.showToast({
                    title: i18n.global.t('toolbox.downloadTaskLimit', { count: activeList.length }),
                    icon: 'none',
                })
            } else {
                callback(downloadArr)
            }
        })
    })
}

//判断选择的是webdav还是天翼云盘还是夸克
export const judgeSelect = () => {
    const sourceList = uni.getStorageSync('sourceList') || []
    let selectMedia = {}
    let selectType = {}
    sourceList.find(item => {
        const select = item.list.find(i => i.active)
        if (select) {
            selectMedia = select
            selectType = item
            return true
        }
        return false
    })
    return { selectMedia, selectType }
}

//获取下载链接
export const getDownloadUrl = async (item, selectMedia, selectType) => {
    if (!selectMedia || !selectMedia.name || !selectType) return ''
    if (selectType.type == 'WebDAV') {
        const res = await getWebDAVUrl({ path: item.webdavPath }, selectMedia)
        return res.data.raw_url
    } else if (selectType.type == '天翼云盘') {
        const res = await get189VideoUrl({ folderFileId: item.id }, selectMedia)
        return res.normal.url
    } else if (selectType.type == '夸克网盘') {
        const res = await getQuarkVideoUrl({ folderFileId: item.id }, selectMedia)
        return res.data[0].download_url
    } else if (selectType.type == '联通云盘') {
        const res = await getWopanVideoUrl({ folderFileId: item.id }, selectMedia)
        return res.url
    } else if (selectType.type == '移动云盘') {
        const res = await get139VideoUrl({ folderFileId: item.id }, selectMedia)
        return res.url
    } else if (selectType.type == 'Emby') {
        return `${selectMedia.protocol}://${selectMedia.address}:${selectMedia.port}/emby/Items/${item.id}/Download?api_key=${selectMedia.token}`
    }
    return ''
}

/**
 * 夸克直链的签名域名是 dl-pc-*.quark.cn，不是 drive-pc.quark.cn。
 * buildQuarkHeader 里写死的 Host 一旦透传过去，请求会打到错误的 Host 直接 403，
 * 所以这里只挑出鉴权真正需要的几项，Host 交给 OkHttp 按实际 URL 生成。
 */
const buildDownloadHeaders = (selectMedia, selectType) => {
    if (!selectMedia || !selectType) return undefined
    //天翼 legacy Cookie 账号：直链要校验 Referer，不带头必然 403
    //新账号走 sessionKey/accessToken 签名体系，没有 Cookie，签名直链无需额外头
    if (selectType.type === '天翼云盘' && selectMedia.JSESSIONID) {
        const header = build189Header(build189Cookie(selectMedia), { referer: true })
        //Host 交给 OkHttp 按实际 URL 生成，透传会打到错误域名
        delete header.Host
        delete header.Priority
        return header
    }
    if (selectType.type !== '夸克网盘') return undefined
    if (!selectMedia.Cookie) return undefined
    const quarkHeader = buildQuarkHeader(selectMedia.Cookie)
    return {
        Cookie: quarkHeader.Cookie,
        Referer: quarkHeader.Referer,
        Origin: 'https://pan.quark.cn',
        'User-Agent': quarkHeader['User-Agent'],
    }
}

//创建下载任务时把原生错误码翻译成可读提示
const toastCreateResult = res => {
    const code = res && res.code
    let title
    if (code === 0) {
        title = i18n.global.t('toolbox.startDownload')
    } else if (code === 3000) {
        title = i18n.global.t('toolbox.downloadTaskExists')
    } else if (code === 3001) {
        title = i18n.global.t('toolbox.downloadUrlInvalid')
    } else if (code === 3002) {
        title = i18n.global.t('toolbox.downloadStorageFull')
    } else {
        title = (res && res.msg) || i18n.global.t('toolbox.downloadFailed')
    }
    uni.showToast({ title, icon: 'none' })
}

//创建下载任务
export const createDownload = selectArr => {
    if (!selectArr || !selectArr.length) return
    //m3u8/strm 是播放列表，原生不支持 HLS 拉流，下下来只是无效文本
    const supported = selectArr.filter(i => !HLS_FORMAT.some(f => (i.saveName || '').toLowerCase().endsWith(f)))
    if (supported.length !== selectArr.length) {
        uni.showToast({ title: i18n.global.t('toolbox.downloadHlsUnsupported'), icon: 'none' })
    }
    if (!supported.length) return
    const { selectMedia, selectType } = judgeSelect()
    const headers = buildDownloadHeaders(selectMedia, selectType)
    initDownloader(res => {
        if (res && res.code !== 0) {
            return
        }
        supported.forEach(async i => {
            let url = ''
            try {
                url = await getDownloadUrl(i, selectMedia, selectType)
            } catch (e) {
                url = ''
            }
            if (!url) {
                uni.showToast({ title: i18n.global.t('toolbox.downloadUrlInvalid'), icon: 'none' })
                return
            }
            DownloaderManager.createDownloadTask(
                {
                    url,
                    name: i.saveName,
                    poster: i.poster || i.imgUrl,
                    headers, // 天翼 legacy Cookies / 夸克需要；其余网盘不传，原生会按 URL 兜底
                    dedupe: true, // 同一直链不重复建任务，命中时回 3000
                },
                toastCreateResult
            )
        })
    })
}

// ---------------------------------------------------------------- 批量控制
// 原生 v2 全部支持，统一包一层，避免调用方直接摸原生实例

const callNative = (method, args = [], callback = () => {}) => {
    initDownloader(res => {
        if (res && res.code !== 0) {
            return
        }
        const manager = DownloaderManager
        manager[method](...args, res => {
            if (res && res.code !== 0) {
                showNativeError(res)
            }
            callback(res)
        })
    })
}

//暂停全部任务
export const pauseAll = callback => callNative('pauseAll', [], callback)

//继续全部任务（含上次中断的）
export const resumeAll = callback => callNative('resumeAll', [], callback)

//删除全部任务（含进行中），deleteFile 默认 true
export const deleteAll = (deleteFile = true, callback = () => {}) => callNative('deleteAll', [deleteFile], callback)

//只清已完成的任务
export const clearCompleted = (deleteFile = true, callback = () => {}) => callNative('clearCompleted', [{ deleteFile }], callback)