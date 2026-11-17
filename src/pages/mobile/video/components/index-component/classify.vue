<template>
  <div class="video-classify">
    <div class="video-classify-title">{{ t('video.category') }}</div>
    <div class="video-classify-list" :style="{ '--line-number': lineNumber, '--line-height': lineHeight }">
      <div
        class="list-item"
        v-for="(item, index) in listData"
        :key="item.id"
        :style="{ background: item.background, marginLeft: index % lineNumber == 0 ? 0 : '24rpx' }"
        @click="toVideoAll(item)"
      >
        <div class="list-item-title">{{ item.label }}</div>
        <div class="list-item-img">
          <div class="img-one"></div>
          <div class="img-two"></div>
          <div class="img-three">
            <image :src="!props.isConnected && !item.loadImg ? emptyBg : item.img" @error="imgError(item)" @load="imgLoad(item)" mode="aspectFill"  />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { getMovieTvData } from '@/utils/scrape'
import { ref, watch } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { classifyList } from '@/utils/scrape'
import emptyBg from '@/static/empty_bg.png'
import { useI18n } from 'vue-i18n'
import { useLocaleStore } from '@/stores/locale'

const { t } = useI18n()
const localeStore = useLocaleStore()
const props = defineProps({
  isConnected: { type: Boolean, default: false }, //手机是否连接网络
  // 库内容版本号：刮削边刮边显示时类型卡片也要跟着增长
  revision: { type: Number, default: 0 },
})

const listData = ref([])

const lineNumber = ref(2)
const lineHeight = ref('')

//获取当前缓存的影片的所有类别
const getGenre = () => {
  let idArr = []
  listData.value = []
  const movieTvData = getMovieTvData() || {}
  // 遍历全部分区的条目：动漫/综艺/纪录片里的片子也有 genre，
  // 只统计 movie/tv 两桶会让「类型」卡片明显偏少
  const allItems = Object.values(movieTvData.byCategory || {}).flat()
  const source = allItems.length
    ? allItems
    : [...(movieTvData.movie || []), ...(movieTvData.tv || [])]
  source.forEach(item => {
    if (Array.isArray(item.genre_ids)) idArr.push(...item.genre_ids)
  })

  idArr = [...new Set(idArr)]
  idArr.forEach(item => {
    let obj = classifyList.find(i => i.id == item)
    if (obj) {
      listData.value.push({ ...obj, label: t(obj.labelKey), loadImg: true })
    }
  })
}

const setItemWidth = () => {
  let sysinfo = uni.getSystemInfoSync() // 获取设备系统对象
  let windowWidth = sysinfo.windowWidth
  if (windowWidth > 700) {
    lineNumber.value = Math.floor((windowWidth - 24) / 169.5)
    let remain = windowWidth - 24 - lineNumber.value * 169.5
    if (remain < (lineNumber.value - 1) * 10) {
      lineNumber.value--
    }
  }
  const scale = uni.upx2px(100) / 100 // 获取1rpx对应的px比例
  lineHeight.value = (((windowWidth - uni.upx2px(24 * lineNumber.value + 24)) / lineNumber.value) * 170) / 339 / scale + 'rpx'
}
setItemWidth()

//跳转到videoAll
const toVideoAll = item => {
  uni.navigateTo({
    url: `/pages/mobile/video/video-all?title=${item.label}&genreId=${item.id}&isConnected=${props.isConnected}`,
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
  getGenre()
})

watch(
  () => localeStore.locale,
  () => {
    getGenre()
  }
)

// 刮削边刮边显示：库增长时重新统计类型卡片
watch(
  () => props.revision,
  () => {
    getGenre()
  }
)
</script>

<style lang="scss" scoped>
.video-classify {
  width: 100%;
  overflow-x: hidden;

  .video-classify-title {
    font-size: 36rpx;
    font-weight: bold;
    color: var(--app-text-primary);
  }

  .video-classify-list {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    // justify-content: space-between;
    box-sizing: border-box;
    width: 100%;
    // gap: 24rpx; //低版本webview不生效
    .list-item {
      flex: 0 0 calc((100% - (var(--line-number) - 1) * 24rpx) / var(--line-number));
      // height: 170rpx;
      // aspect-ratio: 341/170; //webview大于90版本可用
      height: var(--line-height);
      border-radius: 20rpx;
      margin-top: 20rpx;
      position: relative;
      padding: 30rpx;
      box-sizing: border-box;
      margin-left: 24rpx;

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
        right: 0;
        top: 0;

        .img-one {
          background: rgba(255, 255, 255, 0.4);
          border-radius: 16rpx;
          width: 140rpx;
          height: 240rpx;
          position: absolute;
          right: 40rpx;
          top: 40rpx;
          transform: rotate(-7deg);
        }

        .img-two {
          background: rgba(255, 255, 255, 0.4);
          border-radius: 16rpx;
          width: 140rpx;
          height: 240rpx;
          position: absolute;
          right: 30rpx;
          top: 30rpx;
          transform: rotate(7deg);
        }

        .img-three {
          background: rgba(255, 255, 255, 0.4);
          border-radius: 16rpx;
          width: 140rpx;
          height: 240rpx;
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
}
// @media (prefers-color-scheme: dark) {
//   .video-classify {
//     .video-classify-title {
//       color: #fff;
//     }
//   }
// }
</style>
