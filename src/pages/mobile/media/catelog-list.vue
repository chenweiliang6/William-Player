<template>
  <div :class="['video-list', themeClass]">
    <wil-list
      :requestFn="getFileList"
      ref="load_list"
      idKey="name"
      :pageSize="20"
      :responseAdapter="responseAdapter"
      @currentData="handleData"
      :refresher-enabled="false"
      type="virtual"
    >
      <template #default="item">
        <nut-cell is-link :class="[item.$index == data.total - 1 ? 'last-cell' : '']" @click="clickCell(item)">
          <template #title>
            {{ item.name.length > 12 ? item.name.slice(0, 12) + '...' : item.name }}
          </template>
          <template #icon>
            <image :src="setImg(item)"  />
          </template>
          <template #link>
            <span v-if="item.type != '1'">{{ handleSize(item.size) }}</span>
            <span v-else></span>
          </template>
        </nut-cell>
      </template>
    </wil-list>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import wilList from '@/components/mobile/wil-list/index.vue'
import Folder from '@/static/folder.png'
import videoPlayer from '@/static/video-player.png'
import photoIcon from '@/static/photo-icon.png'
import { get189Folder, getQuarkFolder, getWopanFolder, getWebDAVUrl, get189DownloadUrl, getQuarkVideoUrl, getWopanVideoUrl } from '@/utils/common.js'
import { onShow, onLoad } from '@dcloudio/uni-app'
import { useThemeNavbar } from '@/hooks/useThemeNavbar'
import { useThemeClass } from '@/hooks/useThemeClass'

const { t } = useI18n()
useThemeNavbar()
const themeClass = useThemeClass()
const webdavInfo = ref({})
const data = ref({})
const load_list = ref(null)

const routerParams = ref({})
const sourceList = ref([])
const selectType = ref({})
const selectMedia = ref({})
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
const setImg = item => {
  if (item.type == '1') {
    return Folder
  } else {
    let videoFormat = ['mp4', 'mkv', 'm2ts', 'avi', 'mov', 'ts', 'm3u8', 'iso']
    let imgFormat = ['jpg', 'png', 'jpeg', 'raw', 'webp', 'gif']
    if (videoFormat.some(i => item.name.includes(i))) {
      return videoPlayer
    } else if (imgFormat.some(i => item.name.includes(i))) {
      if (item.thumbnail) {
        return item.thumbnail
      } else {
        return photoIcon
      }
    }
  }
}
const judgeSelect = () => {
  sourceList.value = uni.getStorageSync('sourceList')
  selectType.value =
    sourceList.value.find(item => {
      let select = item.list.find(i => i.active)
      if (select) {
        selectMedia.value = select
        return true
      } else {
        return false
      }
    }) || {}
}
const getFileList = async data => {
  judgeSelect()
  if (selectType.value.type == 'WebDAV') {
    webdavInfo.value = uni.getStorageSync('webdavInfo')
    let path = ''
    path = decodeURIComponent(routerParams.value.path)
    return new Promise(resolve => {
      uni.request({
        url: webdavInfo.value.protocol + '://' + webdavInfo.value.address + ':' + webdavInfo.value.port + '/api/fs/list',
        data: JSON.stringify({ path: '/' + path, page: data.pageNum, per_page: data.pageSize, refresh: false }),
        method: 'POST',
        header: { Authorization: webdavInfo.value.token, 'Content-Type': 'application/json' },
        success: res => {
          resolve(res.data)
        },
      })
    })
  } else if (selectType.value.type == '天翼云盘') {
    let res = await get189Folder({ ...data, folderId: routerParams.value.folderFileId }, selectMedia.value)
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
  } else if (selectType.value.type == '夸克网盘') {
    let res = await getQuarkFolder({ ...data, fid: routerParams.value.folderFileId }, selectMedia.value)
    res.data.list.forEach(v => {
      v.file_type == 0 ? (v.type = 1) : (v.type = 0)
      v.name = v.file_name
      if (v.big_thumbnail) v.thumb = v.big_thumbnail
      v.folderFileId = v.fid
    })
    return { data: { content: res.data.list, total: res.metadata._total } }
  } else if (selectType.value.type == '联通云盘') {
    let res = await getWopanFolder({ folderId: routerParams.value.folderFileId }, selectMedia.value)
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

//处理内存大小
const handleSize = size => {
  if (size == 0) return '0'
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(size) / Math.log(1024))
  const formatted = parseFloat((size / Math.pow(1024, i)).toFixed(2))
  return formatted + ' ' + sizes[i]
}

const handleData = val => {
  data.value = val
}

const clickCell = async item => {
  let path = ''
  path = decodeURIComponent(routerParams.value.path)
  if (item.type == '1') {
    if (selectType.value.type == 'WebDAV') {
      uni.navigateTo({
        url: `/pages/mobile/media/catelog-list?path=${encodeURIComponent(path + '/' + item.name)}`,
      })
    } else if (selectType.value.type == '天翼云盘') {
      uni.navigateTo({
        url: `/pages/mobile/media/catelog-list?path=${encodeURIComponent(path + '/' + item.name)}&folderFileId=${item.folderFileId}`,
      })
    } else if (selectType.value.type == '夸克网盘') {
      uni.navigateTo({
        url: `/pages/mobile/media/catelog-list?path=${encodeURIComponent(path + '/' + item.name)}&folderFileId=${item.folderFileId}`,
      })
    } else if (selectType.value.type == '联通云盘') {
      uni.navigateTo({
        url: `/pages/mobile/media/catelog-list?path=${encodeURIComponent(path + '/' + item.name)}&folderFileId=${item.folderFileId}`,
      })
    }
  } else {
    let videoFormat = ['mp4', 'mkv', 'm2ts', 'avi', 'mov', 'ts', 'm3u8', 'iso']
    let imgFormat = ['jpg', 'png', 'jpeg', 'raw', 'webp', 'gif']
    if (videoFormat.some(i => item.name.includes(i))) {
      uni.navigateTo({
        url: `/pages/mobile/video/video-player?path=${encodeURIComponent(path + '/' + item.name)}&noSetHistory=0&folderFileId=${item.folderFileId}`, //noSetHistory为0表示不缓存历史播放记录
      })
    } else if (imgFormat.some(i => item.name.includes(i))) {
      if (selectType.value.type == 'WebDAV') {
        let res = await getWebDAVUrl({ path: decodeURIComponent(routerParams.value.path) + '/' + item.name }, selectMedia.value)
        uni.previewImage({
          urls: [res.data.raw_url],
          indicator: 'none',
        })
      } else if (selectType.value.type == '天翼云盘') {
        let res = await get189DownloadUrl({ folderFileId: item.folderFileId }, selectMedia.value)
        uni.previewImage({
          urls: [res.fileDownloadUrl],
          indicator: 'none',
        })
      } else if (selectType.value.type == '夸克网盘') {
        let res = await getQuarkVideoUrl({ folderFileId: item.folderFileId }, selectMedia.value)
        uni.previewImage({
          urls: [res.data[0].download_url],
          indicator: 'none',
        })
      } else if (selectType.value.type == '联通云盘') {
        let res = await getWopanVideoUrl({ folderFileId: item.folderFileId }, selectMedia.value)
        uni.previewImage({
          urls: [res.url],
          indicator: 'none',
        })
      }
    } else {
      uni.showToast({
        title: t('media.unableOpenFileType'),
        icon: 'none',
      })
    }
  }
}

onLoad(options => {
  routerParams.value = options
  let arr = decodeURIComponent(routerParams.value.path).split('/')
  setTimeout(() => {
    uni.setNavigationBarTitle({
      title: arr[arr.length - 1],
    })
  }, 40)
})
</script>

<style lang="scss" scoped>
page {
  width: 100%;
  height: 100%;
}

.video-list {
  width: 100%;
  height: 100%;
  background: var(--app-bg);
  box-sizing: border-box;
  margin-top: 0;
  display: flex;
  flex-direction: column;

  ::v-deep .wil-virtual-list {
    padding: 0 24rpx;
    padding-top: 24rpx;
    box-sizing: border-box;
    overflow: hidden;

    .nut-list {
      height: 100% !important;

      .uni-scroll-view {
        .uni-scroll-view {
          .uni-scroll-view-content {
            .nut-list-container {
              .nut-list-item {
                height: auto !important;

                &:first-child {
                  .nut-cell {
                    // border-radius: 24rpx 24rpx 0 0;
                    border-top-left-radius: 24rpx;
                    border-top-right-radius: 24rpx;
                  }
                }

                .nut-cell {
                  margin: 0;
                  padding: 24rpx;
                  background: var(--app-bg-card);
                  align-items: center;
                  box-shadow: none;
                  border-radius: 0;

                  &::after {
                    border-bottom: 2rpx solid var(--app-border) !important;
                    /* position: absolute !important;
          box-sizing: border-box !important;
          content: " " !important;
          pointer-events: none !important;
          right: 32rpx !important;
          bottom: 0 !important;
          left: 32rpx !important;
          -webkit-transform: scaleY(0.5) !important;
          -ms-transform: scaleY(0.5) !important;
          transform: scaleY(0.5) !important; */
                  }

                  .nut-cell__icon {
                    margin-right: 16rpx;

                    uni-image {
                      div {
                        background-size: cover !important;
                      }
                    }

                    image {
                      width: 60rpx;
                      height: 60rpx;
                      object-fit: cover;
                    }

                    img {
                      width: 60rpx;
                      height: 60rpx;
                      object-fit: cover;
                    }
                  }

                  .nut-cell__title {
                    justify-content: center;
                    font-size: 30rpx;
                    color: var(--app-text-primary);
                    line-height: normal;

                    .wil-cell__title {
                      display: flex;
                      align-items: center;

                      span:last-child {
                        padding-left: 24rpx;
                      }
                    }

                    // font-weight: bold;
                  }
                }

                .last-cell {
                  // border-radius: 0 0 24rpx 24rpx;
                  border-bottom-right-radius: 24rpx;
                  border-bottom-left-radius: 24rpx;

                  &::after {
                    display: none;
                  }
                }
              }
            }
          }
        }
      }
    }

    .load-list__finished-text {
      margin-top: 24rpx;
    }
  }
}

// @media (prefers-color-scheme: dark) {
//   .video-list {
//     background: #1e1e20;

//     ::v-deep .load-list {
//       .list-item {
//         .nut-cell {
//           background-color: #2f2f2f;
//           align-items: center;
//           box-shadow: none;

//           &::after {
//             border-bottom: 2rpx solid rgb(73, 73, 73) !important;
//           }

//           .nut-cell__title {
//             color: #fff;
//           }

//           span {
//             color: rgb(154, 154, 154);
//           }
//         }
//       }
//     }
//   }
// }
</style>
