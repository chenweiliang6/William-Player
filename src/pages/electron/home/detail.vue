<template>
  <div class="detail">
    <!-- 详情数据未就绪时展示骨架屏，避免进入详情页时空白 -->
    <video-detail-skeleton v-if="!hasDetail" />
    <template v-else>
    <div class="detail-background">
      <img :src="imgData.img" />
      <div class="detail-background-overlay" :style="overlayStyle"></div>
    </div>
    <div class="detail-content" :style="contentVars">
      <wil-title :title="route.query.title"></wil-title>
      <div class="detail-info">
        <div class="detail-info-img">
          <img :src="CONFIG.IMG_DOMAIN + '/t/p/w300_and_h450_bestv2' + nowMovieTv.poster" />
        </div>
        <div class="detail-info-right">
          <div class="detail-info-right__name">{{ imgData.title }}</div>
          <div class="detail-info-right__mid">
            <div class="mid-score">
              <wil-icon name="shoucang" custom-color="#f4bc22" />
              <span>{{ imgData.score }}</span>
            </div>
            <div class="mid-date">
              <wil-icon name="rili" :custom-color="palette?.dark ? '#ffffff' : '#000000'" />
              <span>{{ imgData.releaseTime }}</span>
            </div>
            <div class="mid-runtime">
              <wil-icon name="shijian" :custom-color="palette?.dark ? '#ffffff' : '#000000'" v-if="routerParams.type == 'movie'" />
              <span>{{ imgData.runtime }}</span>
            </div>
          </div>
          <div class="detail-info-right__genre">
            <div class="genre-value" v-for="item in imgData.genres?.split(' ') || []">
              {{ item }}
            </div>
            <span v-if="routerParams.type == 'movie'" class="genre-size">{{ selectSource.size }}</span>
          </div>
          <div class="detail-info-right__button">
            <nut-button :custom-color="palette?.text || '#090909'" @click="clickPlayButton">
              <template #icon>
                <wil-icon name="icon_play" :custom-color="palette?.dark ? '#000000' : '#ffffff'" />
              </template>
              <span :style="{ color: palette?.bg || '#ffffff' }">{{ buttonText }}</span>
            </nut-button>
            <div class="button-more" @click="toSearchMatch">
              <wil-icon name="gengduo" :custom-color="palette?.dark ? '#ffffff' : '#000000'" />
            </div>
          </div>
          <div class="detail-info-right__overview">
            {{ overview }}
          </div>
          <div class="detail-info-right__platform">
            <div class="platform-list">
              <div class="platform-list-item" v-for="item in imgData.networks" :key="item.id">
                <img :src="IMG_DOMAIN + '/t/p/h30' + item.logo_path" v-if="item.logo_path" class="container-item-img" mode="heightFix" />
                <text v-else :style="{ fontSize: setSize('32rpx'), color: palette?.text || '#000' }">{{ item.name }}</text>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="detail-container">
        <div class="detail-container-source">
          <div
            :class="['source-item', item.provider + item.name == selectSource.provider + selectSource.name ? 'source-active' : '']"
            v-for="item in sourceList"
            :key="item.provider + item.name"
            @click="changeSource(item)"
          >
            {{ item.sourceName }}
          </div>
        </div>
        <div class="detail-container-tabs" v-if="route.query.type === 'tv'">
          <div class="detail-container-tabs__list">
            <nut-tabs v-model="activeSeason.season" :title-scroll="true" :custom-color="palette?.text || '#090909'" :background="palette?.bg || '#fff'" @change="changeTvSeason">
              <nut-tab-pane :title="item.name" :pane-key="item.season" v-for="item in selectSource.seasonArr" :key="item.season"></nut-tab-pane>
            </nut-tabs>
          </div>
          <div class="detail-container-tabs__arrow">
            <div class="arrow-left" @click="slideTv('left')">
              <wil-icon name="arrow-left-copy" :custom-color="palette?.dark ? '#ffffff' : '#000000'" />
            </div>
            <div class="arrow-right" @click="slideTv('right')">
              <wil-icon name="arrow-right" :custom-color="palette?.dark ? '#ffffff' : '#000000'" />
            </div>
          </div>
        </div>
        <div class="detail-container-tv">
          <scroll-view
            class="tv-list"
            :scroll-with-animation="true"
            :scroll-into-view="scrollIntoView"
            :scroll-x="true"
            style="width: 100%"
            :enhanced="true"
            :showScrollbar="false"
            v-if="tvList.length"
          >
            <div class="tv-list-item" v-for="(item, index) in tvList" :id="'name' + (index + 1)" :key="item.name" @click="toPlayVideo(item, index)">
              <div class="item-img" :style="{ backgroundImage: `url(${item.poster})` }">
                <wil-icon name="icon_play" custom-color="#ffffff" class="item-img-play" />
                <span class="item-img-runtime" v-if="item.runtime">{{ item.runtime }}</span>
                <div
                  class="item-img-process"
                  :style="{ width: Number(historyTv.initialTime) / (Number(parseTime(item.runtime)) * 0.6) + '%' }"
                  v-if="index + 1 == historyTv.ji && item.runtime && activeSeason.path + '/' + historyTv.name == '/' + historyTv.path"
                ></div>
              </div>
              <div class="item-title">{{ index + 1 + '.' + (item.title || t('video.episodeTitle', { episode: index + 1 })) }}</div>
            </div>
          </scroll-view>
        </div>
        <actor-list
          ref="actor_list"
          :routerParams="routerParams"
          :selectSource="{ ...selectSource, size: routerParams.type == 'movie' ? selectSource.size : tvList[0]?.size }"
          :imgData="imgData"
          :iconTone="palette?.iconTone || 'black'"
        ></actor-list>
      </div>
    </div>
    </template>
  </div>
</template>

<script setup>
import { useRoute, useRouter } from 'vue-router'
import { useVideoDetail } from '@/hooks/useVideoDetail'
import { onBeforeMount } from 'vue'
import * as CONFIG from '@/utils/config'
import { ref, computed } from 'vue'
import { useDominantColor } from '@/hooks/useDominantColor'
import { posterPalette } from '@/utils/dominantColor'
import { debounce, parseTime, getMovieTvData, findInView } from '@/utils/scrape'
import actorList from './components/actor-list.vue'
import VideoDetailSkeleton from '@/components/common/video-detail-skeleton.vue'
import wilTitle from '@/components/electron/wil-title/index.vue'
import wilIcon from '@/components/common/wil-icon/index.vue'
import { IMG_DOMAIN } from '@/utils/config'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const nowMovieTv = ref({})
let nowTime = 0

const {
  showPopover,
  popoverArr,
  showTimePicker,
  pickerTitle,
  pickerVal,
  pickerColumns,
  imgData,
  overview,
  hasDetail,
  seasonSwitching,
  sourceList,
  selectSource,
  activeSeason,
  tvList,
  buttonText,
  routerParams,
  showRehandleButton,
  historyTv,
  scrollIntoView,
  lineNumber,
  lineHeight,
  toSelect,
  confirmPicker,
  changeSource,
  changeTvSource,
  changeTvSeason,
  disabledTip,
  clickPlayButton,
  toPlayVideo,
  reHandleTv,
} = useVideoDetail({ route, router })

// 背景蒙层用海报主色纯色，文字/按钮按主色明暗自动反色
const { rawColor } = useDominantColor(computed(() => imgData.value.img))
const palette = computed(() => posterPalette(rawColor.value))
const overlayStyle = computed(() => (palette.value ? { background: palette.value.bg } : undefined))
const contentVars = computed(() => {
  const p = palette.value
  return p
    ? {
        '--content-text': p.text,
        '--content-text-secondary': p.textSecondary,
        '--content-text-tertiary': p.textTertiary,
        '--content-border': p.border,
        '--content-surface': p.surface,
        '--content-surface-strong': p.surfaceStrong,
      }
    : {}
})

const setScrollIntoView = debounce(direction => {
  handleSilde(direction)
}, 300)

const handleSilde = direction => {
  if (direction === 'left') {
    let number = +scrollIntoView.value.split('name')[1]
    if (number > 3) {
      scrollIntoView.value = 'name' + (number - 3)
    } else {
      scrollIntoView.value = 'name1'
    }
  } else if (direction === 'right') {
    let number = +scrollIntoView.value.split('name')[1]
    if (number < tvList.value.length - 4) {
      if (number + 3 >= tvList.value.length - 4) {
        scrollIntoView.value = 'name' + (tvList.value.length - 4)
      } else {
        scrollIntoView.value = 'name' + (number + 3)
      }
    } else {
      scrollIntoView.value = 'name' + (tvList.value.length - 4)
    }
  }
}

const slideTv = direction => {
  let time = Date.now()
  if (time - nowTime > 300) {
    handleSilde(direction)
  } else {
    setScrollIntoView(direction)
  }
  nowTime = time
}

// 手动修正匹配：带 workKey + 类型 + 片名进搜索匹配页
const toSearchMatch = () => {
  router.push({
    path: '/searchMatch',
    query: {
      type: route.query.type,
      workKey: route.query.workKey || '',
      query: encodeURIComponent(imgData.value.title || route.query.name || ''),
    },
  })
}

onBeforeMount(() => {
  const localMovieTvData = getMovieTvData() || {}
  if (route.query.type === 'tv') scrollIntoView.value = 'name1'
  // 走统一 helper：按类型选列表 + workKey 优先 + 判空
  nowMovieTv.value = findInView(localMovieTvData, {
    mediaType: route.query.type,
    tmdbId: route.query.movieTvId,
    workKey: route.query.workKey,
    path: route.query.path,
  }) || {}
})
</script>

<style lang="scss" scoped>
.detail {
  width: 100%;
  height: 100%;
  position: relative;

  .detail-background {
    position: absolute;
    width: 100%;
    height: 100%;
    top: 0;
    left: 0;
    z-index: 1;
    background-position: center;
    background-repeat: no-repeat;
    background-size: cover;
    overflow: hidden;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      position: absolute;
      left: 0;
      top: 0;
      z-index: 1;
    }

    // 蒙层默认白色半透明，取色成功后由行内样式覆盖为海报主色
    .detail-background-overlay {
      width: 100%;
      height: 100%;
      background: rgba(255, 255, 255, 0.7);
      position: absolute;
      left: 0;
      top: 0;
      z-index: 2;
    }
  }

  .detail-content {
    width: 100%;
    height: 100%;
    overflow: auto;
    position: relative;
    z-index: 2;
    padding-bottom: 60rpx;
    color: var(--content-text, #000);

    .detail-info {
      z-index: 2;
      position: relative;
      padding: 0 100rpx;
      margin-top: 24rpx;
      display: flex;

      .detail-info-img {
        width: 600rpx;
        height: 900rpx;

        img {
          width: 100%;
          height: 100%;
          border-radius: 40rpx;
        }
      }

      .detail-info-right {
        margin-left: 48rpx;
        flex: 1;

        .detail-info-right__name {
          font-size: 60rpx;
          font-weight: bold;
        }

        .detail-info-right__mid {
          display: flex;
          align-items: center;
          margin-top: 24rpx;

          .mid-score {
            display: flex;
            align-items: center;
            font-size: 30rpx;
            color: var(--content-text, #000);

            .iconfont {
              font-size: 40rpx;
            }
          }

          .mid-date {
            display: flex;
            align-items: center;
            font-size: 30rpx;
            color: var(--content-text, #000);
            margin-left: 24rpx;

            .iconfont {
              font-size: 40rpx;
            }
          }

          .mid-runtime {
            margin-left: 24rpx;
            font-size: 30rpx;
            color: var(--content-text, #000);
            display: flex;
            align-items: center;

            .iconfont {
              font-size: 40rpx;
            }
          }
        }

        .detail-info-right__genre {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          font-size: 30rpx;
          margin-top: 24rpx;

          .genre-size {
            margin-left: 14rpx;
          }
          .genre-value {
            background: var(--content-surface, rgb(240, 240, 240));
            color: var(--content-text, #000);
            padding: 10rpx 24rpx;
            border-radius: 16rpx;
            margin-left: 24rpx;
            &:first-child {
              margin-left: 0;
            }
          }
        }

        .detail-info-right__button {
          display: flex;
          align-items: center;
          margin-top: 24rpx;

          :deep(.nut-button) {
            border-radius: 16rpx;
            height: 80rpx;

            .nut-button__wrap {
              image {
                width: 30rpx;
                height: 30rpx;
              }

              .nut-button__text {
                margin-left: 16rpx;
              }
            }
          }

          .button-more {
            width: 80rpx;
            height: 80rpx;
            border-radius: 50%;
            background: var(--content-surface-strong, #090909);
            display: flex;
            align-items: center;
            justify-content: center;
            margin-left: 24rpx;
            cursor: pointer;

            img {
              width: 50rpx;
              height: 50rpx;
            }
          }
        }

        .detail-info-right__overview {
          display: -webkit-box;
          -webkit-line-clamp: 3;
          /* 限制显示的行数 */
          -webkit-box-orient: vertical;
          overflow: hidden;
          text-overflow: ellipsis;
          font-size: 32rpx;
          margin-top: 24rpx;
          line-height: 50rpx;
        }
        .detail-info-right__platform {
          margin-top: 24rpx;
          width: 100%;
          .platform-title {
            font-size: 32rpx;
          }
          .platform-list {
            display: flex;
            align-items: center;
            flex-wrap: wrap;
            width: 100%;
            .platform-list-item {
              background: var(--content-surface, rgb(240, 240, 240));
              color: var(--content-text, #000);
              width: auto;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 10rpx 16rpx;
              border-radius: 16rpx;
              font-size: 24rpx;
              margin-left: 24rpx;
              margin-bottom: 24rpx;
              &:first-child {
                margin-left: 0;
              }
              img {
                height: 40rpx;
              }
            }
          }
        }
      }
    }

    .detail-container {
      position: relative;
      z-index: 2;
      margin-top: 50rpx;
      padding: 0 100rpx;

      .detail-container-source {
        display: flex;
        align-items: center;

        .source-item {
          font-size: 28rpx;
          color: var(--content-text, #000);
          font-weight: bold;
          padding: 12rpx 24rpx;
          border-radius: 8rpx;
          border: 2rpx solid var(--content-border, #000);
          margin-left: 12rpx;
          white-space: nowrap;
          cursor: pointer;

          &:first-child {
            margin-left: 0;
          }
        }

        .source-active {
          color: var(--app-brand);
          border: 2rpx solid var(--app-brand);
        }
      }

      .detail-container-tabs {
        display: flex;
        justify-content: space-between;
        align-items: center;

        .detail-container-tabs__list {
          flex: 0 0 50%;

          :deep(.nut-tabs) {
            .nut-tabs__titles {
              background-color: transparent !important;

              .nut-tabs__list {
                .nut-tabs__titles-item {
                  // width: 92px;
                  // flex: 0 0 92px;
                  flex: 0 0 auto;
                  min-width: auto;
                  width: auto;
                  margin-left: 30rpx;
                  cursor: pointer;

                  &:first-child {
                    margin-left: 0;
                  }
                }

                .nut-tabs-active {
                  color: var(--content-text, #090909);

                  .nut-tabs__titles-item__line {
                    width: 100%;
                    border-radius: 8rpx;
                    bottom: 12%;
                  }
                }
              }
            }

            .nut-tabs__content {
              display: none;
            }
          }
        }

        .detail-container-tabs__arrow {
          display: flex;
          align-items: center;

          .arrow-left {
            width: 56rpx;
            height: 56rpx;
            border-radius: 50%;
            border: 2rpx solid #000;
            padding: 10rpx;
            cursor: pointer;
            box-sizing: border-box;
            display: flex;
            align-items: center;
            justify-content: center;

            img {
              width: 100%;
              height: 100%;
            }
          }

          .arrow-right {
            width: 56rpx;
            height: 56rpx;
            border-radius: 50%;
            border: 2rpx solid #000;
            padding: 10rpx;
            margin-left: 24rpx;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;

            img {
              width: 100%;
              height: 100%;
              transform: rotate(180deg);
            }
          }
        }
      }

      .detail-container-tv {
        .tv-list {
          width: 100%;
          height: 100%;
          overflow: hidden;

          ::v-deep .uni-scroll-view-content {
            display: flex;
            flex-direction: row;
            align-items: center;
            flex-wrap: nowrap;
            width: 100%;
            // height: 250rpx;
          }

          .tv-list-item {
            margin-left: 24rpx;
            flex: 0 0 calc((100% - 96rpx) / 5);
            overflow: hidden;
            cursor: pointer;

            &:first-child {
              margin-left: 0;
            }

            .item-img {
              width: 100%;
              aspect-ratio: 169.5/90;
              background: rgb(212, 212, 212);
              background-position: center;
              background-repeat: no-repeat;
              background-size: cover;
              border-radius: 16rpx;
              position: relative;
              overflow: hidden;

              .item-img-play {
                font-size: 60rpx;
                position: absolute;
                left: 50%;
                top: 50%;
                transform: translate(-50%, -50%);
              }

              .item-img-runtime {
                position: absolute;
                right: 10rpx;
                bottom: 10rpx;
                background: rgba(0, 0, 0, 0.5);
                color: #fff;
                font-size: 24rpx;
                border-radius: 8rpx;
                padding: 4rpx 8rpx;
              }

              .item-img-process {
                height: 7rpx;
                background: #ff6701;
                position: absolute;
                bottom: 0;
                left: 0;
              }
            }

            .item-title {
              font-size: 28rpx;
              color: var(--content-text, #000);
              font-weight: bold;
              padding-top: 12rpx;
              width: 100%;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
          }
        }
      }
    }
  }
}
</style>
