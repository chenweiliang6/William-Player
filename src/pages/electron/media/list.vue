<template>
  <div class="media-list">
    <div class="media-list-title" @click="back">
      <img src="@/static/rect-leftblack.png" />
      <span>{{ t('navbar.mediaLibraryList') }}</span>
    </div>
    <div class="media-list-breadcrumb">
      <div class="media-list-breadcrumb__item">
        <span @click="changeBreadcrumb(0)" class="item-name">{{ t('navbar.mediaLibrary') }}</span>
        <span v-if="state.historyPath.length" class="item-icon">/</span>
      </div>
      <div class="media-list-breadcrumb__item" v-for="(item, index) in state.historyPath" :key="item.path">
        <span @click="changeBreadcrumb(index + 1)" class="item-name">{{ item.name }}</span>
        <span v-if="index !== state.historyPath.length - 1" class="item-icon">/</span>
      </div>
    </div>
    <div class="media-list-container">
      <wil-list
        :requestFn="getFileList"
        ref="load_list"
        idKey="name"
        :pageSize="50"
        :responseAdapter="responseAdapter"
        :refresher-enabled="false"
        type="normal"
        listContainerClass="media-item-container"
      >
        <template #default="item">
          <div class="media-list-item" @click="clickMedia(item)">
            <img :src="setFolderImg(item)" />
            <div>{{ item.name }}</div>
          </div>
        </template>
      </wil-list>
    </div>
    <el-image ref="imageRef" style="width: 0; height: 0" :preview-src-list="previewList" show-progress fit="cover"></el-image>
  </div>
</template>

<script setup>
import { nextTick, reactive, ref } from 'vue'
import wilList from '@/components/mobile/wil-list/index.vue'
import { loginUser, get189Folder, getQuarkFolder, getWopanFolder, get139Folder, getWebDAVUrl, get189DownloadUrl, getQuarkVideoUrl, getWopanVideoUrl, get139VideoUrl } from '@/utils/common.js'
import mediaFolder from '@/static/media-folder.png'
import { useRouter } from 'vue-router'
import { ipc } from '@/utils/ipcRenderer'
import { ipcApiRoute } from '@/utils/ipcApiRoute'
import { ElImage } from 'element-plus'
import fileIcon from '@/static/file-icon.png'
import { getFormatIcon } from '@/utils/tools'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const router = useRouter()
const title = ref(t('navbar.mediaLibraryList'))
const imageRef = ref(null)
const load_list = ref(null)
const previewList = ref([])

const state = reactive({
  folderFileList: [],
  historyPath: [],
  selectMedia: {},
})

const back = () => {
  router.go(-1)
}

const initData = () => {
  let sourceList = uni.getStorageSync('sourceList')
  state.folderFileList = []
  sourceList.forEach(item => {
    item.list.forEach(v => {
      if (item.type !== 'Emby') {
        state.folderFileList.push({ type: item.type, id: v.name, ...v })
      }
    })
  })
}

//点击面包屑切换路径
const changeBreadcrumb = index => {
  if (index !== 0) {
    state.historyPath = state.historyPath.slice(0, index)
  } else {
    state.selectMedia = {}
    state.historyPath = []
  }
  load_list.value.reload()
}

//点击文件夹或者文件
const clickMedia = async item => {
  const typeArr = ['WebDAV', 'Emby', '天翼云盘', '夸克网盘', '联通云盘', '移动云盘']
  if (typeArr.includes(item.type)) state.selectMedia = item
  if (item.type === 'WebDAV') {
    let res = await loginUser(state.selectMedia)
    state.selectMedia.token = res.data.token
  }
  if (state.selectMedia.type === 'WebDAV') {
    let path = ''
    state.historyPath.forEach((v, vindex) => {
      if (vindex !== 0) {
        path += '/' + v.name
      }
    })
    state.historyPath.push({ name: item.name, path: state.historyPath.length >= 1 ? path + '/' + item.name : '' }) //将当前点击的文件夹加入历史路径
    load_list.value.reload()
  } else if (state.selectMedia.type === '天翼云盘') {
    handleCloudDiskItem(item)
  } else if (state.selectMedia.type === '夸克网盘') {
    handleCloudDiskItem(item)
  } else if (state.selectMedia.type === '联通云盘') {
    handleCloudDiskItem(item)
  } else if (state.selectMedia.type === '移动云盘') {
    handleCloudDiskItem(item)
  }
}

// 通用处理方法
const handleCloudDiskItem = async item => {
  // 定义网盘策略配置
  const cloudDiskStrategies = {
    '天翼云盘': {
      initialFolderId: '-11',
      getMediaUrl: get189DownloadUrl,
      parseImageUrl: res => res.fileDownloadUrl,
    },
    '夸克网盘': {
      initialFolderId: '0',
      getMediaUrl: getQuarkVideoUrl,
      parseImageUrl: res => res.data[0].download_url,
    },
    '联通云盘': {
      initialFolderId: '0',
      getMediaUrl: getWopanVideoUrl,
      parseImageUrl: res => res.url,
    },
    '移动云盘': {
      initialFolderId: 'root',
      getMediaUrl: get139VideoUrl,
      parseImageUrl: res => res.url,
    },
  }
  if (!state.selectMedia.name) return

  const strategy = cloudDiskStrategies[state.selectMedia.type]
  if (!strategy) return

  // 公共变量
  const videoFormat = ['mp4', 'mkv', 'm2ts', 'avi', 'mov', 'ts', 'm3u8', 'iso']
  const imgFormat = ['jpg', 'png', 'jpeg', 'raw', 'webp', 'gif']
  // 处理文件夹
  if (item.type === 1 || item.type === state.selectMedia.type) {
    handleFolder(item, strategy.initialFolderId)
    load_list.value.reload()
  }
  // 处理文件
  else {
    if (videoFormat.some(i => item.name.includes(i))) {
      handleVideoFile(item)
    } else if (imgFormat.some(i => item.name.includes(i))) {
      await handleImageFile(item, strategy)
    }
  }
}

// 处理文件夹
const handleFolder = (item, initialFolderId) => {
  let path = ''
  state.historyPath.forEach((v, vindex) => {
    if (vindex !== 0) {
      path += '/' + v.name
    }
  })

  state.historyPath.push({
    name: item.name,
    folderFileId: state.historyPath.length >= 1 ? item.folderFileId : initialFolderId,
    path: state.historyPath.length >= 1 ? path + '/' + item.name : '',
  })
}

// 处理视频文件
const handleVideoFile = item => {
  let path = ''
  state.historyPath.forEach((v, vindex) => {
    if (vindex !== 0) {
      path += '/' + v.name
    }
  })

  const args = {
    type: 'vue',
    content: '/video',
    windowName: 'Video',
    windowTitle: 'William Player',
    query: {
      path: encodeURIComponent(path + '/' + item.name),
      noSetHistory: '0',
      folderFileId: item.folderFileId,
      selectMedia: encodeURIComponent(JSON.stringify(state.selectMedia)),
    },
  }

  ipc.invoke(ipcApiRoute.createMpv, args).then(id => {
    console.log('[createWindow] id:', id)
  })
}

// 处理图片文件
const handleImageFile = async (item, strategy) => {
  const res = await strategy.getMediaUrl({ folderFileId: item.folderFileId }, state.selectMedia)
  previewList.value = [strategy.parseImageUrl(res)]
  nextTick(() => {
    imageRef.value.showPreview()
  })
}
const responseAdapter = result => {
  if (!result) {
    return {
      listData: [],
      listTotal: 0,
    }
  }
  return {
    listData: result.data.content || [],
    listTotal: +result.data.total,
  }
}
const getFileList = async data => {
  if (state.selectMedia.type == 'WebDAV') {
    let path = ''
    path = state.historyPath[state.historyPath.length - 1]?.path
    return new Promise(resolve => {
      uni.request({
        url: state.selectMedia.protocol + '://' + state.selectMedia.address + ':' + state.selectMedia.port + '/api/fs/list',
        data: JSON.stringify({ path: '/' + path, page: data.pageNum, per_page: data.pageSize, refresh: false }),
        method: 'POST',
        header: { Authorization: state.selectMedia.token, 'Content-Type': 'application/json' },
        success: res => {
          resolve(res.data)
        },
      })
    })
  } else if (state.selectMedia.type == '天翼云盘') {
    let res = await get189Folder({ ...data, folderId: state.historyPath[state.historyPath.length - 1]?.folderFileId }, state.selectMedia)
    res.fileListAO.fileList.forEach(v => {
      const lastIndex = v.name.lastIndexOf('.')
      const format = v.name.substring(lastIndex + 1)
      v.thumb = v?.icon?.largeUrl ? v.icon.largeUrl : getFormatIcon(format)
      //type为0表示不是文件夹，是文件
      v.type = 0
      v.folderFileId = v.id
    })
    res.fileListAO.folderList.forEach(v => {
      v.type = 1
      v.folderFileId = v.id
    })
    return { data: { content: [...res.fileListAO.folderList, ...res.fileListAO.fileList], total: res.fileListAO.count } }
  } else if (state.selectMedia.type == '夸克网盘') {
    let res = await getQuarkFolder({ ...data, fid: state.historyPath[state.historyPath.length - 1]?.folderFileId }, state.selectMedia)
    res.data.list.forEach(v => {
      if (v.file_type == 0) {
        v.type = 1
      } else {
        //type为0表示不是文件夹，是文件
        v.type = 0
        const lastIndex = v.file_name.lastIndexOf('.')
        const format = v.file_name.substring(lastIndex + 1)
        v.thumb = getFormatIcon(format)
      }
      v.name = v.file_name
      v.folderFileId = v.fid
    })
    return { data: { content: res.data.list, total: res.metadata._total } }
  } else if (state.selectMedia.type == '联通云盘') {
    let res = await getWopanFolder({ folderId: state.historyPath[state.historyPath.length - 1]?.folderFileId || '0' }, state.selectMedia)
    res.fileListAO.fileList.forEach(v => {
      const lastIndex = v.name.lastIndexOf('.')
      const format = v.name.substring(lastIndex + 1)
      v.thumb = v.thumbUrl ? v.thumbUrl : getFormatIcon(format)
      //type为0表示不是文件夹，是文件
      v.type = 0
      v.folderFileId = v.id
    })
    res.fileListAO.folderList.forEach(v => {
      v.type = 1
      v.folderFileId = v.id
    })
    return { data: { content: [...res.fileListAO.folderList, ...res.fileListAO.fileList], total: res.fileListAO.count } }
  } else if (state.selectMedia.type == '移动云盘') {
    let res = await get139Folder({ folderId: state.historyPath[state.historyPath.length - 1]?.folderFileId || 'root' }, state.selectMedia)
    res.fileListAO.fileList.forEach(v => {
      const lastIndex = v.name.lastIndexOf('.')
      const format = v.name.substring(lastIndex + 1)
      v.thumb = v.thumbUrl ? v.thumbUrl : getFormatIcon(format)
      //type为0表示不是文件夹，是文件
      v.type = 0
      v.folderFileId = v.id
    })
    res.fileListAO.folderList.forEach(v => {
      v.type = 1
      v.folderFileId = v.id
    })
    return { data: { content: [...res.fileListAO.folderList, ...res.fileListAO.fileList], total: res.fileListAO.count } }
  } else {
    //初始化展示的时候
    let sourceList = uni.getStorageSync('sourceList')
    state.folderFileList = []
    sourceList.forEach(item => {
      item.list.forEach(v => {
        if (item.type !== 'Emby') {
          state.folderFileList.push({ type: item.type, id: v.name, ...v })
        }
      })
    })
    return { data: { content: state.folderFileList, total: state.folderFileList.length } }
  }
}

//设置文件照片
const setFolderImg = item => {
  if (item.thumb) {
    return item.thumb
  } else {
    return mediaFolder
  }
}

initData()
</script>

<style lang="scss" scoped>
page {
  width: 100%;
  height: 100%;
}

.media-list {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 0;
  position: relative;
  .media-list-title {
    display: flex;
    align-items: center;
    cursor: pointer;
    padding: 24rpx;

    img {
      width: 40rpx;
      height: 40rpx;
    }

    span {
      margin-left: 12rpx;
      font-weight: bold;
    }
  }

  .media-list-breadcrumb {
    display: flex;
    padding: 0 0 0 36rpx;

    .media-list-breadcrumb__item {
      font-weight: bold;
      font-size: 32rpx;

      .item-name {
        cursor: pointer;

        &:hover {
          color: #fa851e;
        }
      }

      .item-icon {
        padding: 0 12rpx;
      }
    }
  }

  .media-list-container {
    display: flex;
    align-items: flex-start;
    flex-wrap: wrap;
    flex: 1;
    padding: 24rpx;

    :deep(.load-list) {
      .uni-scroll-view-content {
        .media-item-container {
          display: flex;
          align-items: flex-start;
          flex-wrap: wrap;
          align-content: flex-start;
          width: 100%;
          height: 100%;
          gap: 24rpx;

          .list-item {
            flex: 0 0 250rpx;
            overflow: hidden;
            padding: 20rpx 0;

            &:hover {
              background: #f0f0f0;
              border-radius: 16rpx;
            }

            .media-list-item {
              display: flex;
              flex-direction: column;
              align-items: center;
              cursor: pointer;
              width: 100%;

              img {
                width: 160rpx;
                height: 160rpx;
                object-fit: cover;
              }

              div {
                font-size: 28rpx;
                color: #000;
                width: 100%;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                text-align: center;
              }
            }
          }
        }
      }
    }
  }
  :deep(.el-image) {
    position: static;
    .el-image-viewer__wrapper {
      position: absolute;
    }
  }
}
</style>
