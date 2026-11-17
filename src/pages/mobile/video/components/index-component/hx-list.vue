<template>
  <div class="hxList" ref="hx_list">
    <div class="hxList-title">
      <div class="hxList-title-left">
        <image
          v-if="props.type == 'emby'"
          src="https://gimg3.baidu.com/search/src=https%3A%2F%2Ftiebapic.baidu.com%2Fforum%2Fw%253D120%253Bh%253D120%2Fsign%3D44147d7d4e82b2b7a79f3dc60196a3d2%2Fc9fcc3cec3fdfc03771506c1c33f8794a4c2265e.jpg%3Ftbpicau%3D2025-04-08-05_5fe90c457d4356ee146a73914e8a8871&refer=http%3A%2F%2Fwww.baidu.com&app=2021&size=w240&n=0&g=0n&q=75&fmt=auto?sec=1744045200&t=627b5377de1d3107a8a09cb4f65c9fdc"
        />
        <span>{{ props.title }}</span>
      </div>
      <div class="hxList-title-right" @click="toVideoAll">
        <span :style="{ color: props.type == 'emby' ? '#52b54b' : 'var(--app-text-tertiary)' }">{{ t('common.all') }}</span>
        <span v-if="props.type != 'emby'">{{ props.listData.length }}</span>
        <nut-icon name="rect-right" size="10" :custom-color="props.type == 'emby' ? '#52b54b' : 'var(--app-text-tertiary)'"></nut-icon>
      </div>
    </div>
    <div class="hxList-list">
      <scroll-view class="hxList-list-scroll" :scroll-x="true" style="width: 100%" :enhanced="true" :showScrollbar="false">
        <div class="hxList-list-movie">
          <div class="hxList-list-movie__item" v-for="item in listData1" :key="item.workKey || (item.name + (item.type || ''))" @click="toVideoDetail(item)">
            <div class="hxList-list-movie__poster">
              <image
                :src="!props.isConnected && !item.loadImg ? emptyBg : setEmptyImg(item.poster)"
                style="object-fit: cover"
                @error="imgError(item)"
                @load="imgLoad(item)"
                mode="aspectFill"
              />
              <!-- 评分徽标：对齐爆米花，贴在海报右下角 -->
              <span v-if="showVote(item)" class="hxList-list-movie__vote">{{ voteText(item) }}</span>
            </div>
            <span class="hxList-list-movie__item-name">{{ removeExtension(item.name) }}</span>
            <span class="hxList-list-movie__item-time">{{ cardSubText(item, t) }}</span>
          </div>
        </div>
      </scroll-view>
    </div>
  </div>
</template>
<script setup>
import { ref, nextTick, watch } from 'vue'
import emptyBg from '@/static/empty_bg.png'
import posterEmpty from '@/static/poster-empty.png'
import { onShow } from '@dcloudio/uni-app'
import { handleSeasonName } from '@/utils/scrape'
import { showVote, voteText, cardSubText } from '@/utils/card-meta'
import * as CONFIG from '@/utils/config'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const props = defineProps({
  title: { type: String, default: '' },
  type: { type: String, default: '' },
  // 展示分类（movie/tv/anime/variety/documentary），用于「查看全部」带参
  category: { type: String, default: '' },
  listData: { type: Array, default: [] },
  // 库内容版本号。刮削边刮边显示时，列表会在页面不重新挂载的情况下增长，
  // 而 listData1 是从 props 复制出来的快照，必须靠它触发重建。
  revision: { type: Number, default: 0 },
  isConnected: { type: Boolean, default: false }, //手机是否连接网络
})

const emits = defineEmits(['clickAll'])

// 只取前 30 条做展示。注意顺序：**先 slice 再构造新对象**。
// 早期写法是 JSON.parse(JSON.stringify(props.listData)).slice(0, 30)，
// 先把整个数组序列化+反序列化一遍才截断——某个分区上万条时，
// 这是首页首屏最大的一笔开销（onShow 每个分区都要重跑一次）。
const takeTop = list => (list || []).slice(0, 30).map(item => ({ ...item, loadImg: true }))
const listData1 = ref(takeTop(props.listData))

const removeExtension = filename => {
  let name = handleSeasonName(filename, true)
  if (name.length > 7) {
    name = name.slice(0, 6) + '...'
  }
  return name
}

const embyTypeMapping = {
  'Series': 'tv',
  'Movie': 'movie',
}
// 详情页需要的是媒体类型（movie/tv），不是展示分类。
// 优先用条目自带的 type（'1'=剧集，'2'=电影），它始终反映真实媒体类型；
// 分类页签只能表达展示分组（动漫里既有电影也有剧集）。
const getItemMediaType = item => {
  if (item?.type === '1' || item?.type === 1) return 'tv'
  if (item?.type === '2' || item?.type === 2) return 'movie'
  // 兜底：按展示分类猜
  if (props.category === 'movie') return 'movie'
  if (['tv', 'anime', 'variety', 'documentary'].includes(props.category)) return 'tv'
  const typeMapping = {
    [t('video.movie')]: 'movie',
    [t('video.tv')]: 'tv',
    电影: 'movie',
    电视剧: 'tv',
  }
  return typeMapping[props.title]
}
const toVideoDetail = item => {
  if (props.type == 'emby') {
    uni.navigateTo({
      url: `/pages/mobile/video/emby/emby-detail?name=${handleSeasonName(item.name, true)}&type=${embyTypeMapping[item.type]}&movieTvId=${item.id}`,
    })
  } else {
    uni.navigateTo({
      url: `/pages/mobile/video/video-detail?path=${item.path}&name=${handleSeasonName(item.name, true)}&type=${getItemMediaType(item)}&source=${JSON.stringify(item.source)}&movieTvId=${item.movieTvId}&workKey=${encodeURIComponent(item.workKey || '')}`,
    })
  }
}

const toVideoAll = () => {
  if (props.type == 'emby') {
    emits('clickAll')
  } else {
    uni.navigateTo({
      url: `/pages/mobile/video/video-all?title=${props.title}&category=${props.category}&isConnected1=${props.isConnected}`,
    })
  }
}

const imgError = item => {
  item.loadImg = false
}

const imgLoad = item => {
  if (!props.isConnected && !item.loadImg) return
  item.loadImg = true
}

const setEmptyImg = poster => {
  if (poster) {
    if (props.type == 'emby') {
      return poster
    } else {
      return CONFIG.IMG_DOMAIN + '/t/p/w300_and_h450_bestv2' + poster
    }
  } else {
    return posterEmpty
  }
}

const rebuild = () => {
  nextTick(() => {
    listData1.value = takeTop(props.listData)
  })
}

onShow(rebuild)

// 刮削边刮边显示：库增长时父组件会递增 revision，这里必须重建快照，
// 否则列表会停在页面首次挂载时的内容上（老流程靠 refreshLoading 的
// v-if/v-else 切换重新挂载子树来达成，新流程不再整页重挂）。
watch(
  () => [props.revision, props.listData],
  rebuild,
)
</script>
<style lang="scss" scoped>
.hxList {
  width: 100%;
  margin-bottom: 50rpx;
  overflow-x: hidden;

  .hxList-title {
    display: flex;
    align-items: center;
    justify-content: space-between;

    .hxList-title-left {
      display: flex;
      align-items: center;

      image {
        width: 30rpx;
        height: 30rpx;
      }

      span {
        font-size: 36rpx;
        font-weight: bold;
        color: var(--app-text-primary);
      }
    }

    .hxList-title-right {
      display: flex;
      align-items: center;

      span {
        font-size: 30rpx;
        line-height: 30rpx;
        color: var(--app-text-tertiary);
      }

      span:nth-child(2) {
        padding-left: 6rpx;
      }
    }
  }

  .hxList-list {
    margin-top: 24rpx;

    .hxList-list-scroll {
      width: 100%;

      .hxList-list-movie {
        display: flex;
        flex-wrap: nowrap;
        align-items: center;

        .hxList-list-movie__item {
          margin-left: 24rpx;
          flex: 0 0 214rpx;
          position: relative;
          transition: opacity var(--app-duration-fast) var(--app-ease);

          // 按压反馈：整卡压一层暗色，不改变尺寸，避免影响横向排列宽度计算
          &::after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            border-radius: 20rpx;
            background: rgba(0, 0, 0, 0.18);
            opacity: 0;
            transition: opacity var(--app-duration-fast) var(--app-ease);
            pointer-events: none;
          }

          &:active::after {
            opacity: 1;
          }

          &:active {
            opacity: 0.92;
          }

          &-name {
            font-size: 28rpx;
            font-weight: bold;
            color: var(--app-text-primary);
            display: block;
          }

          &-time {
            font-size: 24rpx;
            color: var(--app-text-tertiary);
            padding-top: 6rpx;
            display: block;
          }

          &:first-child {
            margin-left: 0;
          }

          // 海报容器与评分徽标放在 &:active 之后单独写完整选择器。
          // 写在 &-name 之后用 & 组合会接续 &:active 的组合器，导致
          // position:absolute 失效、徽标退回文档流左上角。
          .hxList-list-movie__poster {
            position: relative;
            width: 100%;
            height: 320rpx;
          }

          .hxList-list-movie__poster image {
            object-fit: cover;
            width: 100%;
            height: 320rpx;
            border-radius: 20rpx;
          }

          .hxList-list-movie__vote {
            position: absolute;
            right: 8rpx;
            bottom: 8rpx;
            padding: 0 10rpx;
            height: 34rpx;
            line-height: 34rpx;
            border-radius: 8rpx;
            background: rgba(0, 0, 0, 0.6);
            color: #ffc93c;
            font-size: 22rpx;
            font-weight: bold;
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
