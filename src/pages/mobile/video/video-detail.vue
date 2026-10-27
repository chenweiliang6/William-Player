<template>
  <div :class="['video-detail', themeClass]" :style="{ overflow: showPopover || showTvlistPopup ? 'hidden' : 'auto' }">
    <wil-navbar style="position: fixed; z-index: 999" arrow-color="#fff">
      <template #right>
        <nut-icon name="more-x" custom-color="#fff" size="20" @click="showPopover = true"></nut-icon>
        <nut-transition :show="showPopover" name="fade" :duration="200">
          <div class="more-arrow"></div>
          <div class="more-popover">
            <div class="more-popover-item" @click="toSelect(item)" v-for="item in popoverArr" :key="item.text">
              <image :src="item.icon" />
              <span class="more-popover-item__text">{{ item.text }}</span>
            </div>
          </div>
        </nut-transition>
        <nut-overlay v-model:visible="showPopover" :z-index="2000" :lock-scroll="true"></nut-overlay>
      </template>
    </wil-navbar>
    <div class="video-detail-container">
      <div class="video-detail-container__img" :style="{ backgroundImage: `url(${imgData.img})` }">
        <div class="img-container">
          <div class="img-title">{{ imgData.title }}</div>
          <div class="img-mid" v-if="imgData.releaseTime">
            <div class="img-mid-score">
              <image src="@/static/star-fill.png" />
              <span>{{ imgData.score }}</span>
            </div>
            <div class="img-mid-date">
              <image src="@/static/date-icon.png" />
              <span>{{ imgData.releaseTime }}</span>
            </div>
            <div class="img-mid-runtime">
              <image src="@/static/clock-icon.png" v-if="routerParams.type == 'movie'" />
              <span>{{ imgData.runtime }}</span>
            </div>
          </div>
          <div class="img-bottom">
            <span class="img-bottom-genres">{{ imgData.genres }}</span>
            <span v-if="routerParams.type == 'movie'" class="img-bottom-size">{{ selectSource.size }}</span>
          </div>
        </div>
      </div>
      <div class="video-detail-container__content">
        <nut-button :custom-color="primaryBtnColor" @click="clickPlayButton">
          <template #icon>
            <image src="@/static/play.png" />
          </template>
          <span :style="{ color: primaryBtnTextColor }">{{ buttonText }}</span>
        </nut-button>
        <!-- 电影专用 -->
        <div class="movie-version" v-if="routerParams.type == 'movie'">
          <div class="movie-version-title">
            <span>{{ t('video.movieVersion') }}</span>
            <div class="movie-version-title__download" @click="downloadMovie">
              <nut-icon name="download" :custom-color="iconColor" size="18"></nut-icon>
              <span>{{ t('video.download') }}</span>
            </div>
          </div>
          <scroll-view class="movie-version-scroll" :scroll-x="true" style="width: 100%" :enhanced="true" :showScrollbar="false">
            <div class="movie-version-list">
              <div
                :class="['movie-version-list__item', item.provider + item.name == selectSource.provider + selectSource.name ? 'movie-version-list__active' : '']"
                v-for="item in sourceList"
                :key="item.provider + item.name"
                @click="changeSource(item)"
              >
                {{ item.sourceName }}
              </div>
            </div>
          </scroll-view>
        </div>
        <!-- 电视专用 -->
        <div class="tv-version" v-if="routerParams.type == 'tv'">
          <div class="tv-version-tabs">
            <div class="tv-version-tabs__cloud">
              <div
                :class="['tv-version-tabs__cloud-item', item.provider + item.name == selectSource.provider + selectSource.name ? 'tv-version-tabs__cloud-active' : '']"
                v-for="item in sourceList"
                :key="item.provider + item.name"
                @click="changeTvSource(item)"
              >
                {{ item.sourceName }}
              </div>
            </div>
            <div class="tv-version-tabs__season">
              <nut-tabs v-model="activeSeason.season" :title-scroll="true" :custom-color="iconColor" background="var(--app-bg)" @change="changeTvSeason">
                <nut-tab-pane :title="item.name" :pane-key="item.season" v-for="item in selectSource.seasonArr" :key="item.season"></nut-tab-pane>
              </nut-tabs>
              <div class="tv-version-tabs__season-viewAll" @click="openTvListPopup">
                <span>{{ t('video.viewAll') }}</span>
                <nut-icon name="rect-right" :custom-color="iconColor" size="14"></nut-icon>
              </div>
            </div>
            <div class="tv-version-tabs__disabled" v-if="!tvList.length && !showRehandleButton" @click="disabledTip"></div>
          </div>
          <scroll-view
            class="tv-version-scroll"
            :scroll-with-animation="true"
            :scroll-into-view="scrollIntoView"
            :scroll-x="true"
            style="width: 100%"
            :enhanced="true"
            :showScrollbar="false"
            v-if="tvList.length"
            :style="{ '--line-number': lineNumber, '--line-height': lineHeight }"
          >
            <div class="tv-version-list__item" v-for="(item, index) in tvList" :id="'name' + item.ji" :key="item.name" @click="toPlayVideo(item, index)">
              <div class="item-img" :style="{ backgroundImage: `url(${item.poster})` }">
                <image src="@/static/playVideo-button.png" />
                <span class="item-img-runtime" v-if="item.runtime">{{ item.runtime }}</span>
                <div
                  class="item-img-process"
                  :style="{ width: Number(historyTv.initialTime) / (Number(parseTime(item.runtime)) * 0.6) + '%' }"
                  v-if="item.ji == historyTv.ji && item.runtime && activeSeason.path + '/' + historyTv.name == '/' + historyTv.path"
                ></div>
              </div>
              <div class="item-title">{{ item.ji + '.' + (item.title || t('video.episodeTitle', { episode: item.ji })) }}</div>
            </div>
          </scroll-view>
          <div class="tv-version-empty" v-else>
            <nut-button :custom-color="primaryBtnColor" v-if="showRehandleButton" @click="reHandleTv">
              <span :style="{ color: primaryBtnTextColor }">{{ t('video.reload') }}</span>
            </nut-button>
            <span v-else>{{ t('common.loadingEllipsis') }}</span>
          </div>
        </div>
        <actor-list
          ref="actor_list"
          :routerParams="routerParams"
          :selectSource="{ ...selectSource, size: routerParams.type == 'movie' ? selectSource.size : tvList[0]?.size }"
          :imgData="{ ...imgData, overview: overview }"
        ></actor-list>
      </div>
      <nut-popup v-model:visible="showTimePicker" round position="center">
        <nut-picker v-model="pickerVal" :columns="pickerColumns" :title="pickerTitle" @confirm="confirmPicker" @cancel="showTimePicker = false" />
      </nut-popup>
    </div>
    <tvlist-popup
      v-model:visible="showTvlistPopup"
      :title="imgData.title"
      :tv-list="tvList"
      :active-season="activeSeason"
      @playVideo="toPlayVideo"
      v-if="routerParams.type === 'tv'"
    ></tvlist-popup>
  </div>
</template>

<script setup>
import wilNavbar from '@/components/mobile/wil-navbar/index.vue'
import actorList from './components/detail-component/actor-list.vue'
import { useDict } from '@/utils/useDict'
import { parseTime } from '@/utils/scrape'
import { useVideoDetail } from '@/hooks/useVideoDetail'
import tvlistPopup from './components/detail-component/tvlist-popup.vue'
import { ref } from 'vue'
import { useThemeClass } from '@/hooks/useThemeClass'
import { useThemeColors } from '@/hooks/useThemeColors'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const { getUntokenDict } = useDict()
const showTvlistPopup = ref(false)
const themeClass = useThemeClass()
const { primaryBtnColor, primaryBtnTextColor, iconColor, primaryTextColor } = useThemeColors()

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
  downloadMovie,
} = useVideoDetail({})

//打开电视剧集列表popup
const openTvListPopup = () => {
  if (!tvList.value?.length) {
    uni.showToast({
      title: t('video.noEpisodes'),
      icon: 'none',
    })
    return
  } else {
    //打开popup展示剧集列表
    showTvlistPopup.value = true
  }
}
</script>

<style lang="scss" scoped>
page {
  width: 100%;
  height: 100%;
}

@media (min-width: 700px) {
  .video-detail {
    .video-detail-container {
      height: 100%;

      .video-detail-container__img {
        height: 1200rpx !important;
      }
    }
  }
}

.video-detail {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  background: var(--app-bg);

  ::v-deep .wil-navbar {
    .nut-navbar {
      overflow: visible;
      background: transparent;

      .nut-navbar__right {
        display: block;
        position: absolute;
        right: 0;
        display: flex;
        align-items: center;

        .nut-transition {
          position: absolute;
          top: 50rpx;
          right: 25%;
          z-index: 3000;
          line-height: initial;

          .more-arrow {
            width: 0;
            height: 0;
            position: absolute;
            right: 14rpx;
            transform: translateY(-100%);
            border-left: 12rpx solid transparent;
            border-right: 12rpx solid transparent;
            border-bottom: 16rpx solid var(--app-bg-card);
          }

          .more-popover {
            width: 360rpx;
            background: var(--app-bg-card);
            border-radius: 16rpx;

            .more-popover-item {
              display: flex;
              align-items: center;
              padding: 16rpx 24rpx;

              image {
                width: 40rpx;
                height: 40rpx;
              }

              .more-popover-item__text {
                flex: 1;
                padding-left: 15rpx;
                color: var(--app-text-primary);
              }
            }
          }
        }

        .nut-overlay {
          position: fixed;
          top: 0px;
          left: 0px;
          top: 0;
          left: 0;
          background: transparent;
        }
      }
    }
  }

  .video-detail-container {
    height: 100%;

    .video-detail-container__img {
      width: 100%;
      height: 840rpx;
      background-size: cover;
      background-position: center;
      background-repeat: no-repeat;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      box-sizing: border-box;
      position: relative;

      &::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.1);
        z-index: 1;
      }

      .img-container {
        background: linear-gradient(to bottom, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.4) 100%);
        padding: 0 24rpx 30rpx 24rpx;

        .img-title {
          position: relative;
          z-index: 2;
          color: #fff;
          font-size: 42rpx;
          font-weight: bold;
        }

        .img-mid {
          position: relative;
          z-index: 2;
          display: flex;
          align-items: center;
          padding: 30rpx 0 10px 0;

          .img-mid-score {
            display: flex;
            align-items: center;
            padding: 0 14rpx;
            padding-left: 0;
            height: 40rpx;
            position: relative;

            &::after {
              position: absolute;
              content: '';
              width: 2rpx;
              height: 24rpx;
              background-color: #c2c5c6;
              right: 0;
              top: 50%;
              transform: translateY(-50%);
            }

            image {
              width: 32rpx;
              height: 32rpx;
            }

            span {
              font-size: 28rpx;
              line-height: 15px;
              color: #c2c5c6;
              padding-left: 10rpx;
            }
          }

          .img-mid-date {
            display: flex;
            align-items: center;
            padding: 0 14rpx;
            height: 40rpx;
            position: relative;

            &::after {
              position: absolute;
              content: '';
              width: 2rpx;
              height: 24rpx;
              background-color: #c2c5c6;
              right: 0;
              top: 50%;
              transform: translateY(-50%);
            }

            image {
              width: 28rpx;
              height: 28rpx;
            }

            span {
              font-size: 28rpx;
              color: #c2c5c6;
              padding-left: 10rpx;
            }
          }

          .img-mid-runtime {
            display: flex;
            align-items: center;
            padding: 0 14rpx;
            height: 40rpx;

            image {
              width: 28rpx;
              height: 28rpx;
            }

            span {
              font-size: 28rpx;
              color: #c2c5c6;
              padding-left: 10rpx;
            }
          }
        }
      }

      .img-bottom {
        position: relative;
        z-index: 2;
        display: flex;
        align-items: baseline;

        .img-bottom-genres {
          padding: 0 14rpx;
          font-size: 28rpx;
          color: #c2c5c6;
          display: block;
          padding-left: 0;
        }

        .img-bottom-size {
          position: relative;
          padding: 0 14rpx;
          font-size: 28rpx;
          color: #c2c5c6;
          display: block;

          &::before {
            position: absolute;
            display: block;
            content: '';
            width: 3rpx;
            height: 24rpx;
            background-color: #c2c5c6;
            left: 0;
            top: 50%;
            transform: translateY(-50%);
          }
        }
      }
    }

    .video-detail-container__content {
      padding: 24rpx 24rpx 0 24rpx;
      padding-bottom: 100rpx;

      ::v-deep .nut-button {
        width: 100%;
        border-radius: 16rpx;
        height: 100rpx;

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

      .movie-version {
        margin-top: 50rpx;

        .movie-version-title {
          font-size: 32rpx;
          font-weight: bold;
          color: var(--app-text-primary);
          padding-bottom: 20rpx;
          display: flex;
          align-items: center;
          justify-content: space-between;
          .movie-version-title__download {
            display: flex;
            align-items: center;
            image {
              width: 34rpx;
              height: 34rpx;
            }
            span {
              font-size: 28rpx;
              padding-left: 4rpx;
            }
          }
        }

        .movie-version-scroll {
          .movie-version-list {
            display: flex;
            align-items: center;
            flex-wrap: nowrap;

            .movie-version-list__item {
              font-size: 28rpx;
              color: var(--app-text-primary);
              font-weight: bold;
              padding: 12rpx 24rpx;
              border-radius: 8rpx;
              border: 2rpx solid var(--app-border-strong);
              margin-left: 12rpx;
              white-space: nowrap;

              &:first-child {
                margin-left: 0;
              }
            }

            .movie-version-list__active {
              color: var(--app-brand);
              border: 2rpx solid var(--app-brand);
            }
          }
        }
      }

      .tv-version {
        margin-top: 20rpx;

        .tv-version-tabs {
          position: relative;
          .tv-version-tabs__cloud {
            display: flex;
            align-items: center;
            flex-wrap: nowrap;
            width: 100%;
            overflow: auto;

            .tv-version-tabs__cloud-item {
              font-size: 28rpx;
              color: var(--app-text-primary);
              font-weight: bold;
              padding: 12rpx 24rpx;
              border-radius: 8rpx;
              border: 2rpx solid var(--app-border-strong);
              margin-left: 12rpx;
              white-space: nowrap;

              &:first-child {
                margin-left: 0;
              }
            }

            .tv-version-tabs__cloud-active {
              color: var(--app-brand);
              border: 2rpx solid var(--app-brand);
            }
          }
          .tv-version-tabs__season {
            display: flex;
            align-items: center;
            justify-content: space-between;
            :deep(.nut-tabs) {
              .nut-tabs__titles {
                .nut-tabs__list {
                  .nut-tabs__titles-item {
                    // width: 92px;
                    // flex: 0 0 92px;
                    flex: 0 0 auto;
                    min-width: auto;
                    width: auto;
                    margin-left: 30rpx;

                    &:first-child {
                      margin-left: 0;
                    }
                  }

                  .nut-tabs-active {
                    color: var(--app-text-primary);

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
            .tv-version-tabs__season-viewAll {
              display: flex;
              align-items: center;
              span {
                font-size: 28rpx;
                font-weight: bold;
                color: var(--app-text-primary);
              }
              :deep(.nut-icon) {
                font-size: 28rpx;
                width: 28rpx;
                height: 28rpx;
                color: var(--app-text-primary);
                &::before {
                  font-size: 28rpx;
                }
              }
            }
          }
          .tv-version-tabs__disabled {
            position: absolute;
            width: 100%;
            height: 100%;
            left: 0;
            top: 0;
            z-index: 99;
          }

          :deep(.nut-tabs) {
            .nut-tabs__titles {
              height: 92rpx;

              .uni-scroll-view {
                .uni-scroll-view-content {
                  .nut-tabs__list {
                    height: 92rpx;

                    .nut-tabs__titles-item {
                      .nut-tabs__titles-item__line {
                        height: 6rpx;
                      }

                      .nut-tabs__titles-item__text {
                        font-size: 28rpx;
                      }
                    }
                  }
                }
              }
            }
          }
        }

        .tv-version-scroll {
          width: 100%;
          height: 100%;
          overflow: hidden;

          ::v-deep .uni-scroll-view-content {
            display: flex;
            flex-direction: row;
            align-items: center;
            flex-wrap: nowrap;
            width: 100%;
            height: 250rpx;
          }

          .tv-version-list__item {
            margin-left: 24rpx;
            flex: 0 0 calc((100% - (var(--line-number) - 1) * 24rpx) / var(--line-number));
            overflow: hidden;

            &:first-child {
              margin-left: 0;
            }

            .item-img {
              width: 100%;
              // aspect-ratio: 169.5/85;
              height: var(--line-height);
              background: var(--app-bg-secondary);
              background-position: center;
              background-repeat: no-repeat;
              background-size: cover;
              border-radius: 16rpx;
              position: relative;
              overflow: hidden;

              image {
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
              color: var(--app-text-primary);
              font-weight: bold;
              padding-top: 12rpx;
              width: 100%;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
          }
        }

        .tv-version-empty {
          width: 100%;
          height: 250rpx;
          display: flex;
          align-items: center;
          justify-content: center;

          ::v-deep .nut-button {
            height: initial;
            width: initial;
          }
        }
      }
    }
  }
}

// @media (prefers-color-scheme: dark) {
//   .video-detail {
//     .video-detail-container {
//       .video-detail-container__content {
//         background: #1e1e20;

//         ::v-deep .nut-button {
//           background-color: gray !important;
//         }

//         .movie-version {
//           .movie-version-title {
//             color: #fff;
//           }

//           .movie-version-scroll {
//             .movie-version-list {
//               .movie-version-list__item {
//                 color: #fff;
//                 border: 2rpx solid var(--app-border-strong);
//               }

//               .movie-version-list__active {
//                 color: var(--app-brand);
//                 border: 2rpx solid var(--app-brand);
//               }
//             }
//           }
//         }

//         .tv-version {
//           .tv-version-tabs__cloud {
//             .tv-version-tabs__cloud-item {
//               color: #fff;
//               border: 2rpx solid var(--app-border-strong);
//             }

//             .tv-version-tabs__cloud-active {
//               color: var(--app-brand);
//               border: 2rpx solid var(--app-brand);
//             }
//           }

//           ::v-deep .nut-tabs {
//             &__titles {
//               background-color: #1e1e20 !important;

//               .nut-tabs__list {
//                 .nut-tabs-active {
//                   color: #fff;

//                   .nut-tabs__titles-item__line {
//                     background: #fff !important;
//                   }
//                 }
//               }
//             }
//           }

//           .tv-version-scroll {
//             .tv-version-list__item {
//               .item-title {
//                 color: #fff;
//               }
//             }
//           }
//         }
//       }
//     }
//   }
// }
</style>
