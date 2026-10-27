<template>
  <div class="recent-played">
    <div class="recent-played-title">
      <div class="recent-played-title-left">
        <img src="https://emby.media/support/images/logo.png" v-if="props.type === 'emby'" />
        <span>{{ t('video.recentPlayed') }}</span>
      </div>
      <div class="recent-played-title-right" @click="toHistoryPlayed">
        <span :style="{ color: props.type == 'emby' ? '#52b54b' : 'gray' }">{{ t('common.all') }}</span>
        <span v-if="props.type != 'emby'">{{ props.listData.length }}</span>
        <nut-icon name="rect-right" size="10" :custom-color="props.type == 'emby' ? '#52b54b' : 'gray'"></nut-icon>
      </div>
    </div>
    <div class="recent-played-list">
      <scroll-view class="recent-played-list-scroll" :scroll-x="true" style="width: 100%" :enhanced="true" :showScrollbar="false">
        <div class="recent-played-list-movie">
          <div class="recent-played-list-movie__item" v-for="item in scrollData" :key="item.name" @click="toVideoPlayer(item)">
            <div class="recent-played-list-movie__item-img">
              <image
                :src="!props.isConnected && !item.loadImg ? emptyBg : setEmptyImg(item.poster)"
                @error="imgError(item)"
                @load="imgLoad(item)"
                style="width: 100%; height: 100%; position: static"
                mode="aspectFill"
              ></image>
              <!-- <span style="color: red;font-size: 30px;">
                {{ item.loadImg }}
              </span> -->
              <image :src="playVideoButton" class="img-button" />
              <span class="img-runtime">{{ handleSecond(item.initialTime) + '/' + (item.runtime || '00:00') }}</span>
              <div class="img-process" :style="{ width: item.runtime ? Number(item.initialTime) / (Number(parseTime(item.runtime)) * 0.6) + '%' : '0' }"></div>
            </div>
            <span class="recent-played-list-movie__item-name" v-if="item.type == 'movie'">{{ handleSeasonName(removeExtension(item.name)) }}</span>
            <span class="recent-played-list-movie__item-name" v-if="item.type == 'tv'">
              {{ removeExtension(`${item.titlePlay} ${t('video.episodeTitle', { episode: item.ji })} ${item.title || t('video.episodeTitle', { episode: item.ji })}`) }}
            </span>
          </div>
        </div>
      </scroll-view>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import playVideoButton from '@/static/playVideo-button.png'
import { handleSecond, parseTime, handleSeasonName } from '@/utils/scrape'
import { onShow } from '@dcloudio/uni-app'
import emptyBg from '@/static/empty_bg.png'
import { toStringfy } from '@/pages/mobile/mine/common'
import { ipc } from '@/utils/ipcRenderer'
import { ipcApiRoute } from '@/utils/ipcApiRoute'
import { judgeSelect } from '@/utils/tools'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps({
  isConnected: { type: Boolean, default: false }, //手机是否连接网络
  listData: { type: Array, default: [] },
  type: { type: String, default: '' },
})

const scrollData = ref([])

const selectType = ref({})
const selectMedia = ref({})

const setEmptyImg = poster => {
  if (poster) {
    return poster
  } else {
    return emptyBg
  }
}
const removeExtension = filename => {
  const firstDotIndex = filename.indexOf('.')
  let name = firstDotIndex === -1 ? filename : filename.substring(0, firstDotIndex)
  if (name.length > 17) {
    name = name.slice(0, 16) + '...'
  }
  return name
}

//裁剪格式获取电影名
const getMovieName = val => {
  const firstDotIndex = val.indexOf('.')
  let name = firstDotIndex === -1 ? val : val.substring(0, firstDotIndex)
  return name
}

//将点击了的视频放置到数组的第一个去
const setItemFirst = item => {
  let index = null
  if (item.type == 'tv') {
    index = scrollData.value.findIndex(i => i.type == item.type && i.titlePlay == item.titlePlay)
  } else if (item.type == 'movie') {
    index = scrollData.value.findIndex(i => i.type == item.type && getMovieName(i.name) == getMovieName(item.name))
  }
  if (index > -1) {
    scrollData.value.splice(index, 1)
    scrollData.value.unshift(item)
  } else {
    scrollData.value.unshift(item)
  }
  let historyArr = uni.getStorageSync('historyPlay') || []
  historyArr = historyArr.filter(v => v.sourceType != selectType.value.type || v.sourceName != selectMedia.value.name)
  uni.setStorageSync('historyPlay', [...historyArr, ...scrollData.value])
}

const toVideoPlayer = async item => {
  uni.setStorageSync('secondPage', 'videoPlayer')
  let args = {
    type: 'vue',
    content: '/video',
    windowName: 'Video',
    windowTitle: t('video.nowPlaying'),
    opusId: '1',
    windowsOption: {
      frame: false,
      width: 1358,
      height: 841,
      backgroundColor: '#000000',
    },
    query: {
      path: item.path,
      type: 'movie',
      isEmby: true,
    },
  }
  if (item.type == 'movie') {
    if (selectType.value.type == 'WebDAV') {
      ipc.invoke(ipcApiRoute.createMpv, args).then(id => {
        setItemFirst(item)
      })
    } else {
      args.query.folderFileId = item.folderFileId
      ipc.invoke(ipcApiRoute.createMpv, args).then(id => {
        if (selectType.value.type !== 'Emby') {
          setItemFirst(item)
        }
      })
    }
  } else if (item.type == 'tv') {
    let localMovieTvData = uni.getStorageSync('localMovieTvData') || {}
    let nowTv = localMovieTvData.tv.find(i => {
      return (
        i.source.some(v => {
          return v.seasonArr.some(h => h.path + '/' + item.name == '/' + item.path)
        }) && i.movieTvId == item.movieTvId
      )
    })
    let openEndTime = {}
    if (nowTv.openingTime >= 0) openEndTime.openingTime = nowTv.openingTime
    if (nowTv.endTime >= 0) openEndTime.endTime = nowTv.endTime
    if (selectType.value.type == 'WebDAV') {
      uni.navigateTo({
        url: `/pages/mobile/video/video-player?path=${item.path}&titlePlay=${item.titlePlay}&type=tv&movieTvId=${item.movieTvId}&${toStringfy(openEndTime)}`,
        success: () => {
          setItemFirst(item)
        },
      })
    } else {
      uni.navigateTo({
        url: `/pages/mobile/video/video-player?path=${item.path}&titlePlay=${item.titlePlay}&wjjId=${item.wjjId}&movieTvId=${item.movieTvId}&folderFileId=${item.folderFileId}&type=tv&${toStringfy(openEndTime)}`,
      })
    }
  }
}

const toHistoryPlayed = () => {
  uni.navigateTo({
    url: `/pages/mobile/video/history-played?title=${t('video.recentPlayed')}&isConnected1=${props.isConnected}`,
  })
}
const imgError = item => {
  item.loadImg = false
}

const imgLoad = item => {
  if (!props.isConnected && !item.loadImg) return
  item.loadImg = true
}

onShow(() => {
  const { selectMedia: media, selectType: type } = judgeSelect(props.type === 'emby' ? 'emby' : 'normal')
  selectMedia.value = media
  selectType.value = type

  scrollData.value = [...props.listData]
  scrollData.value.forEach(item => {
    item.loadImg = true
  })
})

watch(
  () => props.listData,
  val => {
    scrollData.value = [...val]
    scrollData.value.forEach(item => {
      item.loadImg = true
    })
  },
  { immediate: true, deep: true }
)
</script>

<style lang="scss" scoped>
.recent-played {
  width: 100%;
  margin-bottom: 50rpx;

  .recent-played-title {
    display: flex;
    align-items: center;
    justify-content: space-between;

    .recent-played-title-left {
      font-size: 36rpx;
      font-weight: bold;
      color: #000;
      display: flex;
      align-items: center;
      img {
        display: block;
        width: 44rpx;
        height: 44rpx;
        object-fit: cover;
        object-position: left;
      }
    }

    .recent-played-title-right {
      display: flex;
      align-items: center;

      span {
        font-size: 30rpx;
        color: gray;
        line-height: 30rpx;
      }

      span:nth-child(2) {
        padding-left: 6rpx;
      }
    }
  }

  .recent-played-list {
    margin-top: 24rpx;

    .recent-played-list-scroll {
      width: 100%;
      overflow-x: auto;

      .recent-played-list-movie {
        display: flex;
        flex-wrap: nowrap;
        align-items: center;

        .recent-played-list-movie__item {
          margin-left: 24rpx;
          flex: 0 0 calc((100% - 72rpx) / 4);
          cursor: pointer;

          .recent-played-list-movie__item-img {
            background-position: center;
            background-repeat: no-repeat;
            background-size: cover;
            aspect-ratio: 13/8;
            width: 100%;
            border-radius: 20rpx;
            position: relative;
            overflow: hidden;

            .img-button {
              width: 80rpx;
              height: 80rpx;
              position: absolute;
              left: 50%;
              top: 50%;
              transform: translate(-50%, -50%);
              object-fit: cover;
            }

            .img-runtime {
              position: absolute;
              right: 10rpx;
              bottom: 10rpx;
              background: rgba(0, 0, 0, 0.5);
              color: #fff;
              font-size: 24rpx;
              border-radius: 8rpx;
              padding: 4rpx 8rpx;
            }

            .img-process {
              height: 7rpx;
              background: #ff6701;
              position: absolute;
              bottom: 0;
              left: 0;
            }
          }

          &-name {
            font-size: 28rpx;
            font-weight: bold;
            color: #000;
          }

          &:first-child {
            margin-left: 0;
          }
        }
      }
    }
  }
}

// @media (prefers-color-scheme: dark) {
//     .recent-played {
//         .recent-played-title {
//             .recent-played-title-left {
//                 color: #fff;
//             }

//             .recent-played-title-right {
//                 span {
//                     color: rgb(154, 154, 154);
//                 }
//             }
//         }

//         .recent-played-list {
//             .recent-played-list-scroll {
//                 .recent-played-list-movie {
//                     .recent-played-list-movie__item {
//                         &-name {
//                             color: #fff;
//                         }
//                     }
//                 }
//             }
//         }
//     }
// }
</style>
