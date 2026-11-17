<template>
  <div class="hxList" ref="hx_list" :style="{ '--line-height': lineHeight }">
    <div class="hxList-title">
      <div class="hxList-title-left">{{ props.title }}</div>
    </div>
    <div class="hxList-list">
      <tv-scroll class="hxList-list-scroll" :scroll-x="true" style="width: 100%" :enhanced="true" :showScrollbar="false" :scrollIntoView="scrollIntoView">
        <div class="hxList-list-movie__item" v-for="(item, index) in listData1" :id="'name' + (index + 1)" :key="item.workKey || (item.name + (item.type || ''))" @click="toVideoDetail(item)">
          <template v-if="item.isMore">
            <div :class="['hxList-list-movie__more-img', tabIndex == index ? 'hxList-list-movie__more-active' : '']">
              <div class="img-icon">
                <wil-icon name="arrow-right" :custom-color="tabIndex == index ? '#000000' : '#ffffff'"></wil-icon>
              </div>
              <span class="img-all">{{ t('video.viewAll') }}</span>
              <span class="img-number">{{ t('video.totalCount', { count: props.listData.length }) }}</span>
            </div>
            <span class="hxList-list-movie__item-name" style="opacity: 0">{{ props.title }}</span>
            <span class="hxList-list-movie__item-time" style="opacity: 0">{{ t('common.none') }}</span>
          </template>
          <template v-else>
            <!-- 海报容器：只为承载右下角评分徽标。
                 三个 __img-* class 必须继续挂在 <image> 上——
                 onShow 里的滚动定位用 select('.hxList-list-movie__img-active,
                 .hxList-list-movie__img-movie, .hxList-list-movie__img-tv') 取海报，
                 挂到容器上会让那三个选择器全部落空。 -->
            <div class="hxList-list-movie__poster">
              <image
                :src="setEmptyImg(item.poster)"
                mode="aspectFill"
                :class="[
                  props.mediaType == 'movie' ? 'hxList-list-movie__img-movie' : 'hxList-list-movie__img-tv',
                  tabIndex == index ? 'hxList-list-movie__img-active' : 'hxList-list-movie__item-img',
                ]">
              </image>
              <span v-if="showVote(item)" class="hxList-list-movie__vote">{{ voteText(item) }}</span>
            </div>
            <span class="hxList-list-movie__item-name">{{ removeExtension(item.name) }}</span>
            <span class="hxList-list-movie__item-time">{{ cardSubText(item, t) }}</span>
          </template>
        </div>
      </tv-scroll>
    </div>
  </div>
</template>
<script setup>
import { ref, nextTick, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import posterEmpty from '@/static/poster-empty.png'
import { onShow } from '@dcloudio/uni-app'
import { handleSeasonName, throttle, debounce } from '@/utils/scrape'
import { showVote, voteText, cardSubText } from '@/utils/card-meta'
import * as CONFIG from '@/utils/config'
import tvScroll from '@/components/tv/tv-scroll/index.vue'
import wilIcon from '@/components/common/wil-icon/index.vue'

const { t } = useI18n()

const props = defineProps({
  title: { type: String, default: '' },
  // 媒体类型（movie/tv），详情页跳转需要；展示分类由 title/category 决定
  mediaType: { type: String, default: 'movie' },
  // 展示分类（movie/tv/anime/variety/documentary），「查看全部」带参用
  category: { type: String, default: '' },
  number: { type: String, default: '0' },
  listData: { type: Array, default: [] },
  // 库内容版本号。刮削边刮边显示时列表会原地增长，
  // listData1 是 props 的快照，必须靠它触发重建。
  revision: { type: Number, default: 0 },
  isFocus: { type: Boolean, default: false },
  focusModel: { type: String, default: '' },
  historyPlay: { type: Array, default: [] },
  offsetTop: { type: Number, default: 0 },
  // 上下邻居由父组件按焦点序列算好传入。
  // 原先这里写死 hxMovie/hxTv 互为邻居，分类变成 5 个后无法维护。
  prevFocus: { type: String, default: '' },
  nextFocus: { type: String, default: '' },
})

const emits = defineEmits(['setFocus'])

const tabIndex = ref(-1)
const lineHeight = ref('')
const scrollIntoView = ref('')

const scrollTop = ref(0)

// **先 slice 再浅拷贝**。早期是整表 JSON 往返后再截断，分区上万条时
// 每次重建都要全量序列化一遍；边刮边显示后重建频率提高，必须改掉。
const takeTop = list => [
  ...(list || []).slice(0, 10).map(item => ({ ...item, loadImg: true })),
  { isMore: true },
]
const listData1 = ref(takeTop(props.listData))

// 上下邻居由父组件按当前可见的分类分区序列算好传入。
// 空分类不渲染，邻居会自动跨过去，不会出现「按一下没反应」。
const getUpDown = direction => (direction === 'up' ? props.prevFocus : props.nextFocus)

const removeExtension = filename => {
  let name = handleSeasonName(filename, true)
  if (name.length > 7) {
    name = name.slice(0, 6) + '...'
  }
  return name
}
let nowTime = 0
const evtMove = keyCode => {
  if (keyCode === 'KeyRight') {
    if (tabIndex.value != listData1.value.length - 1) {
      tabIndex.value++
    }
  } else if (keyCode === 'KeyLeft') {
    if (tabIndex.value > 0) {
      tabIndex.value--
    }
  } else if (keyCode === 'KeyUp') {
    emits('setFocus', getUpDown('up'), 'KeyUp')
  } else if (keyCode === 'KeyDown') {
    emits('setFocus', getUpDown('down'), 'KeyDown')
  } else if (keyCode === 'KeyEnter') {
    if (tabIndex.value == listData1.value.length - 1) {
      toVideoAll()
    } else {
      toVideoDetail(listData1.value[tabIndex.value])
    }
  }
  let time = Date.now()
  if (time - nowTime > 300) {
    if (tabIndex.value >= 3) {
      scrollIntoView.value = 'name' + (tabIndex.value - 1)
    } else {
      scrollIntoView.value = 'name1'
    }
  } else {
    setScrollIntoView()
  }
  nowTime = time
}

const setScrollIntoView = debounce(() => {
  if (tabIndex.value >= 3) {
    scrollIntoView.value = 'name' + (tabIndex.value - 1)
  } else {
    scrollIntoView.value = 'name1'
  }
}, 300)

// 详情页只认 movie/tv。分类页签可能是 anime/variety/documentary，
// 必须从条目自带 type（'1'=剧集 / '2'=电影）推导真实媒体类型。
const getItemMediaType = item => {
  if (item?.type === '1' || item?.type === 1) return 'tv'
  if (item?.type === '2' || item?.type === 2) return 'movie'
  if (props.category === 'movie') return 'movie'
  if (['tv', 'anime', 'variety', 'documentary'].includes(props.category)) return 'tv'
  return props.mediaType
}

const toVideoDetail = item => {
  uni.navigateTo({
    url: `/pages/tv/video/video-detail?path=${item.path}&name=${handleSeasonName(item.name, true)}&type=${getItemMediaType(item)}&source=${JSON.stringify(
      item.source
    )}&movieTvId=${item.movieTvId}&workKey=${encodeURIComponent(item.workKey || '')}`,
  })
}

const toVideoAll = () => {
  // category 必须带上：useVideoAll 优先用它定位分类，
  // 只传已国际化的 title 在部分语言下会落到 undefined 而得到空列表
  uni.navigateTo({
    url: `/pages/tv/video/video-all?title=${encodeURIComponent(props.title)}&category=${props.category}&mediaType=${props.mediaType}`,
  })
}

const setEmptyImg = poster => {
  if (poster) {
    return CONFIG.IMG_DOMAIN + '/t/p/w300_and_h450_bestv2' + poster
  } else {
    return posterEmpty
  }
}

const setItemWidth = () => {
  let sysinfo = uni.getSystemInfoSync() // 获取设备系统对象
  let windowWidth = sysinfo.windowWidth
  const scale = uni.upx2px(100) / 100 // 获取1rpx对应的px比例
  lineHeight.value = (((windowWidth - uni.upx2px(320)) / 6) * 160) / 107 / scale + 'rpx'
}
setItemWidth()

const rebuild = () => {
  nextTick(() => {
    listData1.value = takeTop(props.listData)
    // 列表变短时焦点可能越界（指向已不存在的下标），复位到「更多」占位上。
    // 边刮边显示会让列表在用户浏览期间增长/重排，这一条必须补。
    if (tabIndex.value > listData1.value.length - 1) {
      tabIndex.value = -1
    }
  })
}

onShow(() => {
  rebuild()
  setTimeout(() => {
    const windowHeight = uni.getSystemInfoSync().windowHeight
    const query = uni.createSelectorQuery()
    // 用两个 select 并集取第一个海报中心，避免按 mediaType 分支——
    // 分类扩到动漫/综艺/纪录片后，原先只认 movie/tv 的两个分支都不命中，
    // 会导致 scrollTop 恒为 0、整页滚动定位完全失效。
    query
      .select('.hxList-list-movie__img-active, .hxList-list-movie__img-movie, .hxList-list-movie__img-tv')
      .fields({ rect: true, size: true }, res => {
        if (!res) return
        const center = props.offsetTop + res.top - windowHeight / 2 + res.height / 2
        scrollTop.value = center < 0 ? 0 : center
      })
      .exec()
  }, 0)
})

watch(
  () => props.isFocus,
  val => {
    if (val) {
      tabIndex.value = 0
    } else {
      tabIndex.value = -1
    }
  }
)

// 刮削边刮边显示：库增长时父组件递增 revision，这里重建快照让新卡片出现。
watch(
  () => [props.revision, props.listData],
  rebuild,
)

const getScrollTop = () => {
  return scrollTop.value
}

defineExpose({
  evtMove,
  getScrollTop,
})
</script>
<style lang="scss" scoped>
.hxList {
  width: 100%;
  margin-bottom: 50rpx;
  overflow-x: hidden;
  box-sizing: border-box;
  padding: 0 80rpx;

  .hxList-title {
    display: flex;
    align-items: center;
    justify-content: space-between;

    .hxList-title-left {
      font-size: 36rpx;
      font-weight: bold;
      color: #000;
    }

    .hxList-title-right {
      display: flex;
      align-items: center;

      span {
        font-size: 30rpx;
        line-height: 30rpx;
        color: gray;
      }

      span:nth-child(2) {
        padding-left: 6rpx;
      }
    }
  }

  .hxList-list {
    margin-top: 24rpx;

    ::v-deep .hxList-list-scroll {
      width: 100%;

      .uni-scroll-view-content {
        display: flex;
        flex-direction: row;
        align-items: center;
        flex-wrap: nowrap;
        width: 100%;

        .hxList-list-movie__item {
          margin-left: 32rpx;
          flex: 0 0 calc((100% - 160rpx) / 6);
          // width: calc((100% - 160rpx) / 6);
          box-sizing: border-box;

          image {
            width: 100%;
            // height: 320rpx;
            // height: var(--line-height);
            aspect-ratio: 107/160;
            border-radius: 20rpx;
            box-sizing: border-box;
            display: block;
            height: auto;
          }

          // 海报容器：给评分徽标提供定位上下文。
          // 必须写完整类名——用 `&-poster` 会接续上面的选择器组合。
          .hxList-list-movie__poster {
            position: relative;
            width: 100%;
          }

          // 徽标用 px 而不是 rpx：TV 端 rpxCalcMaxDeviceWidth 是 700，
          // 34rpx 会被缩到很小、看不清。这里的数值按 1080p 电视的观感定。
          .hxList-list-movie__vote {
            position: absolute;
            right: 10px;
            bottom: 10px;
            padding: 0 6px;
            height: 22px;
            line-height: 22px;
            border-radius: 5px;
            background: rgba(0, 0, 0, 0.6);
            color: #ffc93c;
            font-size: 14px;
            font-weight: bold;
          }

          .hxList-list-movie__img-active {
            border: 6rpx solid #ff6701;
          }

          .hxList-list-movie__more-img {
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            height: var(--line-height);
            background: #2f2f30;
            border-radius: 20rpx;
            border: 6rpx solid transparent;

            .img-icon {
              width: 70rpx;
              height: 70rpx;
              background: #6a6a6d;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;

              .iconfont {
                font-size: 30rpx;
              }
            }

            .img-all {
              margin-top: 40rpx;
              font-size: 36rpx;
              color: #fff;
              font-weight: bold;
            }

            .img-number {
              margin-top: 20rpx;
              font-size: 28rpx;
              color: #a8a8a8;
            }
          }

          .hxList-list-movie__more-active {
            border: 6rpx solid #ff6701;

            .img-icon {
              background: #fff;
            }
          }

          &-img {
            border: 6rpx solid transparent;
          }

          &-name {
            font-size: 28rpx;
            font-weight: bold;
            color: #fff;
            display: block;
          }

          &-time {
            font-size: 24rpx;
            color: #c3c6cf;
            padding-top: 6rpx;
            display: block;
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
//   .hxList {
//     .hxList-title {
//       .hxList-title-left {
//         color: #fff;
//       }

//       .hxList-title-right {
//         display: flex;
//         align-items: center;

//         span {
//           font-size: 30rpx;
//           line-height: 30rpx;
//           color: rgb(154, 154, 154);
//         }
//       }
//     }

//     .hxList-list {
//       .hxList-list-scroll {
//         .hxList-list-movie {
//           .hxList-list-movie__item {
//             &-name {
//               color: #fff;
//             }

//             &-time {
//               color: rgb(154, 154, 154);
//             }
//           }
//         }
//       }
//     }
//   }
// }
</style>