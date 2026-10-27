<template>
  <div class="detail">
    <div class="detail-background">
      <img :src="imgData.img" />
      <div class="detail-background-overlay"></div>
    </div>
    <div class="detail-content">
      <wil-title :title="route.query.title"></wil-title>
      <div class="detail-info">
        <div class="detail-info-img">
          <img :src="CONFIG.IMG_DOMAIN + '/t/p/w300_and_h450_bestv2' + nowMovieTv.poster" />
        </div>
        <div class="detail-info-right">
          <div class="detail-info-right__name">{{ imgData.title }}</div>
          <div class="detail-info-right__mid">
            <div class="mid-score">
              <img src="@/static/star-fill.png" />
              <span>{{ imgData.score }}</span>
            </div>
            <div class="mid-date">
              <img src="@/static/date-icon.png" />
              <span>{{ imgData.releaseTime }}</span>
            </div>
            <div class="mid-runtime">
              <img src="@/static/clock-icon.png" v-if="routerParams.type == 'movie'" />
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
            <nut-button custom-color="#090909" @click="clickPlayButton">
              <template #icon>
                <image src="@/static/play.png" />
              </template>
              <span>{{ buttonText }}</span>
            </nut-button>
            <div class="button-more">
              <img src="@/static/gengduo-white.png" />
            </div>
          </div>
          <div class="detail-info-right__overview">
            {{ overview }}
          </div>
          <div class="detail-info-right__platform">
            <div class="platform-list">
              <div class="platform-list-item" v-for="item in imgData.networks" :key="item.id">
                <img :src="IMG_DOMAIN + '/t/p/h30' + item.logo_path" v-if="item.logo_path" class="container-item-img" mode="heightFix" />
                <text v-else :style="{ fontSize: setSize('32rpx'), color: '#000' }">{{ item.name }}</text>
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
            <nut-tabs v-model="activeSeason.season" :title-scroll="true" custom-color="#090909" background="#fff" @change="changeTvSeason">
              <nut-tab-pane :title="item.name" :pane-key="item.season" v-for="item in selectSource.seasonArr" :key="item.season"></nut-tab-pane>
            </nut-tabs>
          </div>
          <div class="detail-container-tabs__arrow">
            <div class="arrow-left" @click="slideTv('left')">
              <img src="@/static/rect-leftblack.png" />
            </div>
            <div class="arrow-right" @click="slideTv('right')">
              <img src="@/static/rect-leftblack.png" />
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
                <img src="@/static/playVideo-button.png" />
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
        ></actor-list>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useRoute, useRouter } from 'vue-router'
import { useVideoDetail } from '@/hooks/useVideoDetail'
import { onBeforeMount } from 'vue'
import * as CONFIG from '@/utils/config'
import { ref } from 'vue'
import { debounce, parseTime } from '@/utils/scrape'
import actorList from './components/actor-list.vue'
import wilTitle from '@/components/electron/wil-title/index.vue'
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

onBeforeMount(() => {
  const localMovieTvData = uni.getStorageSync('localMovieTvData') || {}
  if (route.query.type === 'tv') {
    scrollIntoView.value = 'name1'
    nowMovieTv.value = localMovieTvData.tv.find(i => i.movieTvId == route.query.movieTvId)
  } else if (route.query.type === 'movie') {
    nowMovieTv.value = localMovieTvData.movie.find(i => i.movieTvId == route.query.movieTvId)
  }
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

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      position: absolute;
      left: 0;
      top: 0;
      z-index: 1;
    }

    .detail-background-overlay {
      width: 100%;
      height: 100%;
      // background: rgba(0, 0, 0, 0.8);
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
            color: #000;

            img {
              width: 40rpx;
              height: 40rpx;
            }
          }

          .mid-date {
            display: flex;
            align-items: center;
            font-size: 30rpx;
            color: #000;
            margin-left: 24rpx;

            img {
              width: 40rpx;
              height: 40rpx;
            }
          }

          .mid-runtime {
            margin-left: 24rpx;
            font-size: 30rpx;
            color: #000;
            display: flex;
            align-items: center;

            img {
              width: 40rpx;
              height: 40rpx;
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
            background: rgb(240, 240, 240);
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
            background: #090909;
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
              background: rgb(240, 240, 240);
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
          color: #000;
          font-weight: bold;
          padding: 12rpx 24rpx;
          border-radius: 8rpx;
          border: 2rpx solid #000;
          margin-left: 12rpx;
          white-space: nowrap;
          cursor: pointer;

          &:first-child {
            margin-left: 0;
          }
        }

        .source-active {
          color: #315ffd;
          border: 2rpx solid #315ffd;
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
                  color: #090909;

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

              img {
                width: 60rpx;
                height: 60rpx;
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
              color: #000;
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
