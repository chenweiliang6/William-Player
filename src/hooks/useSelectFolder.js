import { ref, defineEmits, unref } from 'vue'
import { get189Folder, getQuarkFolder, getWopanFolder, getWebDAVUrl, get189DownloadUrl, getQuarkVideoUrl } from '@/utils/common.js'
import Folder from '@/static/folder.png'
import videoPlayer from '@/static/video-player.png'
import photoIcon from '@/static/photo-icon.png'
import fileIcon from '@/static/file-icon.png'
import { onBeforeMount } from 'vue'
import { useI18n } from 'vue-i18n'

export function useSelectFolder({ selectType, selectMedia, result, title, catalogType, emits }) {
  const { t } = useI18n()
  const muluData = ref(uni.getStorageSync('muluData') || { tv: [], movie: [] })
  const isInit = ref(true)
  const path = ref('')
  const folderFileId = ref(null)
  const data = ref({})
  const key = ref('1')
  const folderFileIdArr = ref([])
  const selectName = ref('') //选中的文件夹的name

  const getCatalogType = value => {
    if (['tv', '电视剧', t('video.tv'), t('navbar.tvCatelogSetting')].includes(value)) return 'tv'
    if (['movie', '电影', t('video.movie'), t('navbar.movieCatelogSetting')].includes(value)) return 'movie'
    return value || 'tv'
  }

  const responseAdapter = res11 => {
    if (!res11) {
      return {
        listData: [],
        listTotal: 0,
      }
    }
    return {
      listData: res11.data.content || [],
      listTotal: +res11.data.total,
    }
  }
  const handleData = val => {
    data.value = val
  }
  //处理内存大小
  const handleSize = size => {
    if (size == 0) return '0'
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(size) / Math.log(1024))
    const formatted = parseFloat((size / Math.pow(1024, i)).toFixed(2))
    return formatted + ' ' + sizes[i]
  }
  const removeLastSegment = dateStr => {
    if (typeof dateStr !== 'string') return ''
    // 找到最后一个斜杠的位置
    const lastSlashIndex = dateStr.lastIndexOf('/')
    // 无斜杠或斜杠在末尾时返回原字符串
    if (lastSlashIndex === -1) return dateStr
    // 截取最后一个斜杠前的内容
    return dateStr.substring(0, lastSlashIndex)
  }

  const chooseName = item => {
    selectName.value == item.name ? (selectName.value = '') : (selectName.value = item.name)
    folderFileId.value = item.folderFileId
  }

  const toBack = (isTip = false) => {
    if (unref(selectType).type === 'WebDAV') {
      if (path.value) {
        path.value = removeLastSegment(path.value)
        key.value === '1' ? (key.value = '2') : (key.value = '1')
      } else {
        if (isTip) {
          uni.showToast({
            title: t('source.reachedTopDirectory'),
            icon: 'none',
          })
        } else {
          emits('openSource')
        }
      }
    } else {
      //如果是天翼或者夸克
      if (folderFileIdArr.value.length > 1) {
        path.value = removeLastSegment(path.value)
        folderFileIdArr.value.pop()
        folderFileId.value = folderFileIdArr.value[folderFileIdArr.value.length - 1]
        key.value === '1' ? (key.value = '2') : (key.value = '1')
      } else {
        if (isTip) {
          uni.showToast({
            title: t('source.reachedTopDirectory'),
            icon: 'none',
          })
        } else {
          emits('openSource')
        }
      }
    }
  }

  const getFileList = async data => {
    if (unref(selectType).type == 'WebDAV') {
      if (isInit.value) isInit.value = false //webdav需要请求接口，其他两个直接从那边传值过来
      return new Promise(resolve => {
        uni.request({
          url: unref(selectMedia).protocol + '://' + unref(selectMedia).address + ':' + unref(selectMedia).port + '/api/fs/list',
          data: JSON.stringify({ path: path.value ? path.value : '/', page: data.pageNum, per_page: data.pageSize, refresh: false }),
          method: 'POST',
          header: { Authorization: unref(selectMedia).token, 'Content-Type': 'application/json' },
          success: res => {
            resolve(res.data)
          },
        })
      })
    } else if (unref(selectType).type == '天翼云盘') {
      if (isInit.value) {
        //初始化用传过来的res
        isInit.value = false
        folderFileIdArr.value.push('-11')
        let result1 = JSON.parse(JSON.stringify(unref(result)))
        result1.fileListAO.fileList.forEach(v => {
          if (v?.icon?.largeUrl) v.thumb = v.icon.largeUrl
          v.type = 0
          v.folderFileId = v.id
        })
        result1.fileListAO.folderList.forEach(v => {
          v.type = 1
          v.folderFileId = v.id
        })
        return { data: { content: [...result1.fileListAO.folderList, ...result1.fileListAO.fileList], total: result1.fileListAO.count } }
      }
      let res = await get189Folder({ ...data, folderId: folderFileId.value }, unref(selectMedia))
      res.fileListAO.fileList.forEach(v => {
        if (v?.icon?.largeUrl) v.thumb = v.icon.largeUrl
        v.type = 0
        v.folderFileId = v.id
      })
      res.fileListAO.folderList.forEach(v => {
        v.type = 1
        v.folderFileId = v.id
      })
      return { data: { content: [...res.fileListAO.folderList, ...res.fileListAO.fileList], total: res.fileListAO.count } }
    } else if (unref(selectType).type == '夸克网盘') {
      if (isInit.value) {
        //初始化用传过来的res
        isInit.value = false
        folderFileIdArr.value.push('0')
        let result1 = JSON.parse(JSON.stringify(unref(result)))
        result1.data.list.forEach(v => {
          v.file_type == 0 ? (v.type = 1) : (v.type = 0)
          v.name = v.file_name
          if (v.big_thumbnail) v.thumb = v.big_thumbnail
          v.folderFileId = v.fid
        })
        return { data: { content: result1.data.list, total: result1.metadata._total } }
      }
      let res = await getQuarkFolder({ ...data, fid: folderFileId.value }, unref(selectMedia))
      res.data.list.forEach(v => {
        v.file_type == 0 ? (v.type = 1) : (v.type = 0)
        v.name = v.file_name
        if (v.big_thumbnail) v.thumb = v.big_thumbnail
        v.folderFileId = v.fid
      })
      return { data: { content: res.data.list, total: res.metadata._total } }
    } else if (unref(selectType).type == '联通云盘') {
      if (isInit.value) {
        //初始化用传过来的res（wopan 根目录）
        isInit.value = false
        folderFileIdArr.value.push('0')
        let result1 = JSON.parse(JSON.stringify(unref(result)))
        result1.fileListAO.fileList.forEach(v => {
          if (v.thumbUrl) v.thumb = v.thumbUrl
          v.type = 0
          v.folderFileId = v.id
        })
        result1.fileListAO.folderList.forEach(v => {
          v.type = 1
          v.folderFileId = v.id
        })
        return { data: { content: [...result1.fileListAO.folderList, ...result1.fileListAO.fileList], total: result1.fileListAO.count } }
      }
      let res = await getWopanFolder({ folderId: folderFileId.value }, unref(selectMedia))
      res.fileListAO.fileList.forEach(v => {
        if (v.thumbUrl) v.thumb = v.thumbUrl
        v.type = 0
        v.folderFileId = v.id
      })
      res.fileListAO.folderList.forEach(v => {
        v.type = 1
        v.folderFileId = v.id
      })
      return { data: { content: [...res.fileListAO.folderList, ...res.fileListAO.fileList], total: res.fileListAO.count } }
    }
  }
  const clickCell = async item => {
    if (item.type == '1') {
      selectName.value = ''
      path.value = path.value + '/' + item.name
      if (unref(selectType).type == 'WebDAV') {
        key.value === '1' ? (key.value = '2') : (key.value = '1')
      } else if (unref(selectType).type == '天翼云盘') {
        folderFileIdArr.value.push(item.folderFileId)
        folderFileId.value = item.folderFileId
        key.value === '1' ? (key.value = '2') : (key.value = '1')
      } else if (unref(selectType).type == '夸克网盘') {
        folderFileIdArr.value.push(item.folderFileId)
        folderFileId.value = item.folderFileId
        key.value === '1' ? (key.value = '2') : (key.value = '1')
      } else if (unref(selectType).type == '联通云盘') {
        folderFileIdArr.value.push(item.folderFileId)
        folderFileId.value = item.folderFileId
        key.value === '1' ? (key.value = '2') : (key.value = '1')
      }
    } else {
      uni.showToast({
        title: t('source.pleaseSelectFolder'),
        icon: 'none',
      })
    }
  }
  const setImg = item => {
    if (item.type == '1') {
      return Folder
    } else {
      let videoFormat = ['mp4', 'mkv', 'm2ts', 'avi', 'mov', 'ts', 'm3u8', 'iso']
      let imgFormat = ['jpg', 'png', 'jpeg', 'raw', 'webp', 'gif']
      if (videoFormat.some(i => item.name.includes(i))) {
        return videoPlayer
      } else if (imgFormat.some(i => item.name.includes(i))) {
        return photoIcon
      } else {
        return fileIcon
      }
    }
  }
  //确认选择该路径
  const confirm = () => {
    if (!selectName.value) {
      uni.showToast({
        title: t('source.pleaseSelectDirectory'),
        icon: 'none',
      })
      return
    }
    muluData.value = uni.getStorageSync('muluData') || { tv: [], movie: [] }
    if (unref(selectType).type == 'WebDAV') {
      //这块逻辑有问题，不能存在就替换，像webdav可能挂载多个网盘
      const currentCatalogType = getCatalogType(unref(catalogType) || unref(title))
      let exit = muluData.value[currentCatalogType]?.find(
        v => v.type == unref(selectType).type && v.name == unref(selectMedia).name && v.path == path.value + '/' + selectName.value
      )
      if (exit) {
        uni.showToast({
          title: t('source.directoryAlreadyExists'),
          icon: 'none',
        })
      } else {
        muluData.value[currentCatalogType].push({ type: unref(selectType).type, name: unref(selectMedia).name, path: path.value + '/' + selectName.value || '/' })
      }
    } else {
      const currentCatalogType = getCatalogType(unref(catalogType) || unref(title))
      let exit = muluData.value[currentCatalogType]?.find(
        v =>
          v.type == unref(selectType).type && v.name == unref(selectMedia).name && v.path == path.value + '/' + selectName.value && v.folderFileId == folderFileId.value
      )
      if (exit) {
        uni.showToast({
          title: t('source.directoryAlreadyExists'),
          icon: 'none',
        })
      } else {
        let obj = { type: unref(selectType).type, name: unref(selectMedia).name, path: path.value + '/' + selectName.value || '/', folderFileId: folderFileId.value }
        muluData.value[currentCatalogType].push(obj)
      }
    }
    uni.setStorageSync('muluData', muluData.value)
    emits('confirm', muluData.value)
  }
  onBeforeMount(() => {
    muluData.value = uni.getStorageSync('muluData') || {}
    if (!muluData.value.tv) muluData.value.tv = []
    if (!muluData.value.movie) muluData.value.movie = []
  })
  return {
    data,
    key,
    selectName,
    path,
    folderFileId,
    folderFileIdArr,
    muluData,
    removeLastSegment,
    responseAdapter,
    handleData,
    handleSize,
    chooseName,
    toBack,
    getFileList,
    clickCell,
    setImg,
    confirm,
  }
}
