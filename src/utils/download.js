//该js文件用于下载方法
import { i18n } from '@/i18n/index.js'
import { getWebDAVUrl, get189VideoUrl, getQuarkVideoUrl, getWopanVideoUrl, get139VideoUrl } from '@/utils/common'

let DownloaderManager = null
let downloadList = [] //下载列表
//初始化安卓原生下载器
export const initDownloader = (callback) => {
    if (!DownloaderManager) {
        DownloaderManager = uni.requireNativePlugin('WilliamDownloader')
        DownloaderManager.init(
            {
                maxDownloadTasks: 3, // 最大同时下载任务数
                downloadDir: '/storage/emulated/0/Android/data/com.android.williamplayer/cache/myDownloader', // 下载文件路径
                maxDownloadThreads: 3, // 最大下载线程数
                autoRecovery: true, // 是否自动恢复下载
                openRetry: true, // 下载失败是否打开重试
                maxRetryCount: 2, // 重试次数
                retryIntervalMillis: 1000, // 每次重试时间间隔（毫秒）
            },
            function (res) {
                if (0 == res.code) {
                    // uni.showToast({
                    //   title: res.msg,
                    //   icon: 'none',
                    // })
                    // 显示下载列表
                    callback()
                }
            }
        )
    }
}

//查询所有下载任务
export const queryAll = (callback, selectArr) => {
    let downloadArr = JSON.parse(JSON.stringify(selectArr))
    initDownloader(() => {
        DownloaderManager.queryAll(res => {
            let arr = res.data ? JSON.parse(res.data) : []
            downloadList = arr.filter(i => i.status === 'DOWNLOADING' || i.status === 'PAUSED' || i.status === 'CONNECTING' || i.status === 'ERROR')
            if (downloadList?.length + downloadArr?.length >= 3) {
                uni.showToast({
                    title: i18n.global.t('toolbox.downloadTaskLimit', { count: downloadList?.length }),
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
    let sourceList = uni.getStorageSync('sourceList')
    let selectMedia = {}
    let selectType = sourceList.find(item => {
        let select = item.list.find(i => i.active)
        if (select) {
            selectMedia = select
            return true
        } else {
            return false
        }
    })
    return { selectMedia, selectType }
}

//获取下载链接
export const getDownloadUrl = async (item) => {
    const { selectMedia, selectType } = judgeSelect()
    if (selectType.type == 'WebDAV') {
        if (selectMedia.name) {
            let res = await getWebDAVUrl(
                {
                    path: item.webdavPath,
                },
                selectMedia
            )
            return res.data.raw_url
        }
    } else if (selectType.type == '天翼云盘') {
        if (selectMedia.name) {
            let res = await get189VideoUrl(
                {
                    folderFileId: item.id,
                },
                selectMedia
            )
            return res.normal.url
        }
    } else if (selectType.type == '夸克网盘') {
        if (selectMedia.name) {
            let res = await getQuarkVideoUrl({ folderFileId: item.id }, selectMedia)
            return res.data[0].download_url
        }
    } else if (selectType.type == '联通云盘') {
        if (selectMedia.name) {
            let res = await getWopanVideoUrl({ folderFileId: item.id }, selectMedia)
            return res.url
        }
    } else if (selectType.type == '移动云盘') {
        if (selectMedia.name) {
            let res = await get139VideoUrl({ folderFileId: item.id }, selectMedia)
            return res.url
        }
    } else if (selectType.type == 'Emby') {
        if (selectMedia.name) {
            return `${selectMedia.protocol}://${selectMedia.address}:${selectMedia.port}/emby/Items/${item.id}/Download?api_key=${selectMedia.token}`
        }
    }
}


//创建下载任务
export const createDownload = (selectArr) => {//第一个参数是要下载的文件列表
    selectArr.forEach(async i => {
        let url = await getDownloadUrl(i)
        DownloaderManager.createDownloadTask(
            {
                downUrl: url,
                saveName: i.saveName, // 此处可改成根据下载地址自动获取文件名及文件格式
                imgUrl: i.poster,
            },
            () => {
                uni.showToast({
                    title: i18n.global.t('toolbox.startDownload'),
                    icon: 'none'
                })
            }
        )
    })
}