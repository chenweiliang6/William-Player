<template>
  <div class="hxList" ref="hx_list">
    <div class="hxList-title">
      <div class="hxList-title-left">
        <img v-if="props.type == 'emby'" src="https://emby.media/support/images/logo.png" draggable="false" />
        <span>{{ displayTitle }}</span>
      </div>
      <div class="hxList-title-right" @click="toVideoAll">
        <span :style="{ color: props.type == 'emby' ? '#52b54b' : 'gray' }">{{ t('common.all') }}</span>
        <span v-if="props.type != 'emby'">{{ props.listData.length }}</span>
        <nut-icon name="rect-right" size="10" :custom-color="props.type == 'emby' ? '#52b54b' : 'gray'"></nut-icon>
      </div>
    </div>
    <div class="hxList-list">
      <scroll-view class="hxList-list-scroll" :scroll-x="true" style="width: 100%" :enhanced="true" :showScrollbar="false">
        <div class="hxList-list-movie">
          <div class="hxList-list-movie__item" v-for="item in listData1" :key="item.workKey || (item.name + (item.type || ''))" @click="toVideoDetail(item)">
            <div class="hxList-list-movie__poster">
              <img
                :src="!props.isConnected && !item.loadImg ? emptyBg : setEmptyImg(item.poster)"
                style="object-fit: cover"
                @error="imgError(item)"
                @load="imgLoad(item)"
                draggable="false"
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
import { computed, ref, nextTick, watch } from 'vue'
import emptyBg from '@/static/empty_bg.png'
import posterEmpty from '@/static/poster-empty.png'
import { onShow } from '@dcloudio/uni-app'
import { handleSeasonName } from '@/utils/scrape'
import { showVote, voteText, cardSubText } from '@/utils/card-meta'
import * as CONFIG from '@/utils/config'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps({
  title: { type: String, default: '' },
  type: { type: String, default: '' },
  // 展示分类（movie/tv/anime/variety/documentary），用于「查看全部」带参
  category: { type: String, default: '' },
  listData: { type: Array, default: [] },
  // 库内容版本号。刮削边刮边显示时列表会在页面不重新挂载的情况下增长，
  // listData1 是 props 的快照，必须靠它触发重建。
  revision: { type: Number, default: 0 },
  isConnected: { type: Boolean, default: false }, //手机是否连接网络
})

const router = useRouter()
const emits = defineEmits(['clickAll'])
const displayTitle = computed(() => props.title || t('video.movie'))

// **先 slice 再浅拷贝**。早期是 JSON.parse(JSON.stringify(props.listData))
// 再 slice：整表序列化+反序列化一遍才截断，某个分区上万条时这是首屏最大开销。
// 边刮边显示后重建频率提高，这个写法会把开销放大。
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
const typeMapping = () => ({
  '电影': 'movie',
  '电视剧': 'tv',
  [t('video.movie')]: 'movie',
  [t('video.tv')]: 'tv',
})
// 详情页需要真实媒体类型（movie/tv），分类页签只能表达展示分组。
// 优先用条目自带 type（'1'=剧集，'2'=电影）。
const getItemMediaType = item => {
  if (item?.type === '1' || item?.type === 1) return 'tv'
  if (item?.type === '2' || item?.type === 2) return 'movie'
  if (props.category === 'movie') return 'movie'
  if (['tv', 'anime', 'variety', 'documentary'].includes(props.category)) return 'tv'
  return typeMapping()[displayTitle.value]
}
const toVideoDetail = item => {
  if (props.type === 'emby') {
    router.push({
      path: `/embyDetail`,
      query: { name: handleSeasonName(item.name, true), type: embyTypeMapping[item.type], source: JSON.stringify(item.source), movieTvId: item.id },
    })
  } else {
    router.push({
      path: `/homeDetail`,
      query: { name: handleSeasonName(item.name, true), type: getItemMediaType(item), source: JSON.stringify(item.source), movieTvId: item.movieTvId, workKey: item.workKey || '' },
    })
  }
}

const toVideoAll = () => {
  if (props.type === 'emby') {
    emits('clickAll')
  } else {
    router.push({
      path: `/homeAll`,
      query: { title: displayTitle.value, category: props.category },
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

// 刮削边刮边显示：库增长时父组件会递增 revision，这里必须重建快照。
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
      img {
        display: block;
        width: 44rpx;
        height: 44rpx;
        object-fit: cover;
        object-position: left;
      }
      span {
        font-size: 36rpx;
        font-weight: bold;
        color: #000;
      }
    }

    .hxList-title-right {
      display: flex;
      align-items: center;
      cursor: pointer;

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

    .hxList-list-scroll {
      width: 100%;

      .hxList-list-movie {
        display: flex;
        flex-wrap: nowrap;
        align-items: center;

        .hxList-list-movie__item {
          margin-left: 24rpx;
          flex: 0 0 calc((100% - 168rpx) / 8);
          cursor: pointer;
          overflow: hidden;

          &-name {
            font-size: 28rpx;
            font-weight: bold;
            color: #000;
            display: block;
            width: 100%;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          &-time {
            font-size: 24rpx;
            color: gray;
            padding-top: 6rpx;
            display: block;
          }

          &:first-child {
            margin-left: 0;
          }

          // 海报容器与评分徽标必须单独写完整类名。
          // 若写成 `&-poster` / `&-vote` 接在 `&:active` 之类的组合后面，
          // `&` 会接续上一段的选择器，规则不生效（移动端踩过这个坑）。
          .hxList-list-movie__poster {
            position: relative;
            width: 100%;
            overflow: hidden;
            border-radius: 20rpx;

            img {
              display: block;
              width: 100%;
              aspect-ratio: 107 / 160;
              height: auto;
              border-radius: 20rpx;
              object-fit: cover;
            }
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
