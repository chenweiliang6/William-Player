<template>
  <div class="video-classify">
    <div class="video-classify-title">{{ t('video.category') }}</div>
    <div class="video-classify-list" :style="{ '--line-height': lineHeight }">
      <div
        class="list-item"
        :class="[tabIndex === index ? 'list-item-active' : '', index == 4 ? 'list-item4' : '']"
        v-for="(item, index) in listData"
        :key="item.id"
        :style="{ marginLeft: index % 4 == 0 ? 0 : '32rpx' }"
        @click="toVideoAll(item)">
        <div class="list-item-container" :style="{ background: item.background }">
          <div class="list-item-title">{{ item.label }}</div>
          <div class="list-item-img">
            <div class="img-one"></div>
            <div class="img-two"></div>
            <div class="img-three">
              <image :src="item.img" mode="aspectFill" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { getMovieTvData } from '@/utils/scrape'
import { nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { onShow } from '@dcloudio/uni-app'
import { classifyList } from '@/utils/scrape'

const { t } = useI18n()

const props = defineProps({
  focusModel: { type: String, default: '' },
  isFocus: { type: Boolean, default: false },
  offsetTop: { type: Number, default: 0 },
  // 上移目标：最后一个可见的分类分区（父组件按焦点序列算好）
  prevFocus: { type: String, default: '' },
  // 库内容版本号：刮削边刮边显示时类型卡片也要跟着增长
  revision: { type: Number, default: 0 },
})

const emits = defineEmits(['setFocus'])

const listData = ref([])

const classifyList1 = ref(JSON.parse(JSON.stringify(classifyList)))

const lineHeight = ref('')
const scrollTop = ref(0)
const tabIndex = ref(-1)
const gridPx = ref(0)

//获取当前缓存的影片的所有类别
const getGenre = () => {
  let idArr = []
  listData.value = []
  let movieTvData = getMovieTvData() || {}
  // 遍历全部分区的条目：动漫/综艺/纪录片里的片子也有 genre，
  // 只统计 movie/tv 两桶会让「类型」卡片明显偏少
  const allItems = Object.values(movieTvData.byCategory || {}).flat()
  const source = allItems.length
    ? allItems
    : [...(movieTvData.movie || []), ...(movieTvData.tv || [])]
  source.forEach(item => {
    if (Array.isArray(item.genre_ids)) {
      idArr.push(...item.genre_ids)
    }
  })

  idArr = [...new Set(idArr)]
  idArr.forEach(item => {
    let obj = classifyList1.value.find(i => i.id == item)
    if (obj) {
      obj.label = obj.labelKey ? t(obj.labelKey) : obj.label
      obj.loadImg = true
      listData.value.push(obj)
    }
  })
}

// 上移目标：最后一个可见的分类分区（父组件按焦点序列算好），
// 不再按 tv→movie 顺序硬编码
const getUpDown = direction => (direction === 'up' ? props.prevFocus || '' : '')

const evtMove = keyCode => {
  if (keyCode === 'KeyRight') {
    if (tabIndex.value != listData.value.length - 1) {
      tabIndex.value++
    }
  } else if (keyCode === 'KeyLeft') {
    if (tabIndex.value > 0) {
      tabIndex.value--
    }
  } else if (keyCode === 'KeyUp') {
    if (tabIndex.value - 4 < 0) {
      emits('setFocus', getUpDown('up'), 'KeyUp')
      tabIndex.value = -1
    } else {
      tabIndex.value = tabIndex.value - 4
      emits('setFocus', 'videoClassify', 'KeyUp')
    }
  } else if (keyCode === 'KeyDown') {
    if (tabIndex.value + 4 <= listData.value.length - 1) {
      tabIndex.value += 4
      emits('setFocus', 'videoClassify', 'KeyDown')
    }
  } else if (keyCode === 'KeyEnter') {
    toVideoAll(listData.value[tabIndex.value])
  }
  // let time = Date.now();
  // if (time - nowTime > 300) {
  //   if (tabIndex.value >= 3) {
  //     scrollIntoView.value = "name" + (tabIndex.value - 1);
  //   } else {
  //     scrollIntoView.value = "name1";
  //   }
  // } else {
  //   setScrollIntoView();
  // }
  // nowTime = time;
}

const setItemWidth = () => {
  let sysinfo = uni.getSystemInfoSync() // 获取设备系统对象
  let windowWidth = sysinfo.windowWidth
  const scale = uni.upx2px(100) / 100 // 获取1rpx对应的px比例
  lineHeight.value = (((windowWidth - uni.upx2px(280)) / 4) * 170) / 339 / scale + 'rpx'
}
setItemWidth()

//跳转到videoAll
const toVideoAll = item => {
  uni.navigateTo({
    url: `/pages/tv/video/video-all?title=${encodeURIComponent(item.label)}&genreId=${item.id}&genreKey=${item.labelKey || ''}`,
  })
}

const getScrollTop = () => {
  let row = Math.floor(tabIndex.value / 4)
  return scrollTop.value + row * gridPx.value
}

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

// 刮削边刮边显示：库增长时重新统计类型卡片
watch(
  () => props.revision,
  () => {
    getGenre()
    if (tabIndex.value > listData.value.length - 1) tabIndex.value = -1
  }
)
onShow(() => {
  getGenre()
  setTimeout(() => {
    nextTick(() => {
      let windowHeight = uni.getSystemInfoSync().windowHeight
      const query = uni.createSelectorQuery()
      if (listData.value?.length) {
        query
          .select('.list-item')
          .fields(
            {
              rect: true,
              size: true,
            },
            res => {
              scrollTop.value = props.offsetTop + res.top - windowHeight / 2 + res.height / 2 < 0 ? 0 : props.offsetTop + res.top - windowHeight / 2 + res.height / 2
              const query1 = uni.createSelectorQuery()
              query1
                .select('.list-item4')
                .fields(
                  {
                    rect: true,
                    size: true,
                  },
                  res1 => {
                    if (res1?.top) {
                      gridPx.value = res1.top - res.top
                      console.log(res1.top,res.top, '上下距离1')
                      // uni.showToast({
                      //   title:gridPx.value,
                      //   icon:'none'
                      // })
                    }
                  }
                )
                .exec()
            }
          )
          .exec()
      }
    })
  }, 2000)
})

defineExpose({
  evtMove,
  getScrollTop,
})
</script>

<style lang="scss" scoped>
.video-classify {
  width: 100%;
  overflow-x: hidden;
  padding: 0 80rpx;
  padding-bottom: 40rpx;

  .video-classify-title {
    font-size: 36rpx;
    font-weight: bold;
    color: #000;
  }

  .video-classify-list {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    // justify-content: space-between;
    box-sizing: border-box;
    width: 100%;

    // gap: 32rpx; //低版本webview不生效
    .list-item {
      flex: 0 0 calc((100% - 96rpx) / 4);
      // height: 170rpx;
      aspect-ratio: 341/170; //webview大于90版本可用
      // height: var(--line-height);
      margin-top: 20rpx;
      position: relative;
      box-sizing: border-box;
      margin-left: 32rpx;
      border: 6rpx solid transparent;
      border-radius: 20rpx;
      overflow: hidden;

      .list-item-container {
        width: 100%;
        height: 100%;
        padding: 30rpx;

        .list-item-title {
          font-size: 36rpx;
          font-weight: bold;
          color: #fff;
        }

        .list-item-img {
          position: absolute;
          overflow: hidden;
          width: 100%;
          height: 100%;
          top: 0;
          right: 0;

          .img-one {
            background: rgba(255, 255, 255, 0.4);
            width: 41.3%;
            height: 147%;
            position: absolute;
            right: 40rpx;
            top: 40rpx;
            transform: rotate(-7deg);
            border-radius: 16rpx;
          }

          .img-two {
            background: rgba(255, 255, 255, 0.4);
            border-radius: 16rpx;
            width: 41.3%;
            height: 147%;
            position: absolute;
            right: 30rpx;
            top: 30rpx;
            transform: rotate(7deg);
          }

          .img-three {
            background: rgba(255, 255, 255, 0.4);
            border-radius: 16rpx;
            width: 41.3%;
            height: 147%;
            position: absolute;
            right: 16rpx;
            top: 20rpx;
            transform: rotate(15deg);

            image {
              width: 100%;
              height: 100%;
              border-radius: 16rpx;
            }
          }
        }
      }
    }

    .list-item-active {
      border: 6rpx solid #ff6701;
    }
  }
}

// @media (prefers-color-scheme: dark) {
//   .video-classify {
//     .video-classify-title {
//       color: #fff;
//     }
//   }
// }
</style>
