<template>
  <tv-page @keyCodeClick="evtMove">
    <div class="video-all">
      <div class="video-all-title">{{ displayTitle }}</div>
      <div class="video-all-list">
        <wil-list :requestFn="getMovieTvList" :request-params="requestParams" ref="wil_list" :refresherEnabled="false"
          idKey="path" :listContainerClass="isRecent ? 'list-recent' : 'list-container'"
          :pageSize="windowWidth > 700 ? 18 : 12" :changeItemFn="changeItemFn" :style="{ '--line-height': lineHeight }"
          :scrollIntoView="scrollIntoView" :scroll-with-animation="true" @currentData="currentData">
          <template #default="item">
            <div :class="['video-all-list__item', tabIndex === item.$index ? 'video-all-list__active' : '']"
              @click="toVideoDetail(item)">
              <div class="item-poster">
                <image
                  :src="(!routerParams.isConnected && !item.loadImg) ? emptyBg : setEmptyImg(item.poster)"
                  class="item-poster-image" mode="aspectFill" @error="imgError(item)" @load="imgLoad(item)">
                </image>
              </div>
              <span class="item-name">{{ removeExtension(item) }}</span>
              <span class="item-time" v-if="!isRecent">{{ item.releaseTime || t('common.none') }}</span>
            </div>
          </template>
        </wil-list>
      </div>
    </div>
  </tv-page>
</template>

<script setup>
import wilList from "@/components/mobile/wil-list/index.vue";
import emptyBg from "@/static/empty_bg.png";
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useVideoAll } from "@/hooks/useVideoAll";
import tvPage from "@/components/tv/tv-page/index.vue";
import { debounce } from "@/utils/scrape";

const wil_list = ref(null);
const wil_modal = ref(null);
const { t } = useI18n()
const lineHeight = ref('')
const tabIndex = ref(0)
const scrollIntoView = ref('')

const listData = ref([])

const { routerParams, isRecent, displayTitle, changeTab, tabList,
  getMovieTvList, requestParams, windowWidth, changeItemFn,
  toVideoDetail, setEmptyImg, imgError, imgLoad, removeExtension, } = useVideoAll({ wil_list, wil_modal })


const setItemWidth = () => {
  let sysinfo = uni.getSystemInfoSync(); // 获取设备系统对象
  let windowWidth = sysinfo.windowWidth;
  const scale = uni.upx2px(100) / 100; // 获取1rpx对应的px比例
  lineHeight.value = (((windowWidth - uni.upx2px(224)) / 6) * 160) / 109 / scale + "rpx";
};
setItemWidth();

const currentData = (data) => {
  listData.value = JSON.parse(JSON.stringify(data.list))
}

let nowTime = 0
const evtMove = (keyCode) => {
  if (keyCode === "KeyUp") {
    if (tabIndex.value > 5) {
      tabIndex.value = tabIndex.value - 6
    }
  } else if (keyCode === "KeyDown") {
    if (tabIndex.value < listData.value.length - 6) {
      tabIndex.value = tabIndex.value + 6
    }
  } else if (keyCode === "KeyLeft") {
    if (tabIndex.value > 0) {
      tabIndex.value--
    }
  } else if (keyCode === 'KeyRight') {
    if (tabIndex.value < listData.value.length - 1) {
      tabIndex.value++
    }
  } else if (keyCode === 'KeyEnter') {
    toVideoDetail(listData.value[tabIndex.value])
  }
  let time = Date.now();
  if (time - nowTime > 300) {
    scrollIntoView.value = `name${Math.floor(tabIndex.value / 6) * 6 + 1}`
  } else {
    setScrollIntoView();
  }

  nowTime = time;
};
const setScrollIntoView = debounce(() => {
  scrollIntoView.value = `name${Math.floor(tabIndex.value / 6) * 6 + 1}`
}, 300);
defineExpose({
  evtMove
})
</script>

<style lang="scss" scoped>
page {
  width: 100%;
  height: 100%;
}

.video-all {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #1b1b20;

  ::v-deep .wil-navbar {
    .nut-navbar {
      overflow: visible;

      .nut-navbar__right {
        display: block;
        position: absolute;
        right: 0;
        display: flex;
        align-items: center;
      }
    }
  }

  .video-all-title {
    padding: 24rpx 32rpx;
    font-size: 40rpx;
    font-weight: bold;
    color: #fff;
  }

  .video-all-list {
    flex: 1;
    overflow: hidden;

    // padding-top: 16px;
    ::v-deep .load-list {
      .list-container {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        padding: 0 32rpx;
        // padding-top: 32rpx;

        // gap: 24rpx;
        .list-item {
          margin-bottom: 32rpx;
          margin-left: 32rpx;
          // flex: 1 1 218rpx;
          min-width: 218rpx;
          /* 确保最小宽度 */
          flex: 0 0 calc((100% - 160rpx) / 6);

          .video-all-list__item {
            .item-poster {
              width: 100%;
              // aspect-ratio: 109/160;
              /* 高度 = (109/160) × 宽度 */
              height: var(--line-height);
              border-radius: 20rpx;
              position: relative;
              border: 6rpx solid transparent;

              .item-poster-image {
                width: 100% !important;
                height: 100%;
                border-radius: 20rpx;
                object-fit: cover;
              }
            }

            .item-name {
              font-size: 28rpx;
              font-weight: bold;
              color: #fff;
              display: block;
            }

            .item-time {
              font-size: 24rpx;
              color: gray;
              padding-top: 6rpx;
              display: block;
            }
          }

          .video-all-list__active {
            .item-poster {
              border: 6rpx solid #ff6701;
            }
          }

          &:nth-child(6n+1) {
            margin-left: 0;
          }
        }
      }

      .list-recent {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        padding: 0 32rpx;
        padding-top: 32rpx;

        // gap: 24rpx;
        .list-item {
          margin-bottom: 32rpx;
          // flex: 1 1 218rpx;
          min-width: 218rpx;
          /* 确保最小宽度 */
          flex: 0 0 calc((100% - (var(--line-number) - 1) * 24rpx) / var(--line-number));

          .video-all-list__item {
            .item-poster {
              width: 100%;
              height: var(--line-height);
              // aspect-ratio: 169.5/90; /* 高度 = (109/160) × 宽度 */
              // height: 180rpx;
              border-radius: 20rpx;
              position: relative;

              .item-poster-image {
                width: 100%;
                height: 100%;
                border-radius: 20rpx;
                object-fit: cover;
              }

              .item-poster-runtime {
                position: absolute;
                right: 10rpx;
                bottom: 10rpx;
                background: rgba(0, 0, 0, 0.5);
                color: #fff;
                font-size: 24rpx;
                border-radius: 8rpx;
                padding: 4rpx 8rpx;
              }

              .item-poster-process {
                height: 3.5rpx;
                background: #ff6701;
                position: absolute;
                bottom: 0;
                left: 0;
              }

              .item-poster-check {
                width: 30rpx;
                height: 30rpx;
                box-sizing: border-box;
                // border: 2rpx solid #ff6701;
                background: #ff6701;
                position: absolute;
                top: 20rpx;
                right: 20rpx;
                border-radius: 8rpx;

                image {
                  width: 100%;
                  height: 100%;
                }
              }

              .item-poster-nocheck {
                width: 30rpx;
                height: 30rpx;
                box-sizing: border-box;
                border: 2rpx solid #ff6701;
                background: #fff;
                position: absolute;
                top: 20rpx;
                right: 20rpx;
                border-radius: 8rpx;
              }
            }

            .item-name {
              font-size: 28rpx;
              font-weight: bold;
              color: #000;
            }

            .item-time {
              font-size: 24rpx;
              color: gray;
              padding-top: 6rpx;
            }
          }

          &:nth-child(2n + 1) {
            margin-left: 0;
          }
        }
      }
    }
  }

  .video-all-bottom {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 24rpx;
    font-size: 32rpx;
    font-weight: bold;
    height: 120rpx;
    border-top: 2rpx solid rgb(227, 227, 227);
    box-shadow: 0px 4px 10px 0px rgba(0, 0, 0, 0.3);

    &__left {
      color: #2457fd;
    }

    &__right {
      color: rgb(188, 188, 188);
    }
  }
}

// @media (prefers-color-scheme: dark) {
//   .video-all {
//     background: #1e1e20;

//     ::v-deep .wil-navbar {
//       .nut-navbar {
//         overflow: visible;

//         .nut-navbar__right {
//           .nut-icon-more-x {
//             color: #fff !important;
//           }
//         }
//       }
//     }

//     .video-all-list {
//       ::v-deep .load-list {
//         .list-container {
//           .list-item {
//             .video-all-list__item {
//               .item-name {
//                 color: #fff;
//               }

//               .item-time {
//                 color: rgb(154, 154, 154);
//               }
//             }
//           }
//         }

//         .list-recent {
//           .list-item {
//             .video-all-list__item {
//               .item-name {
//                 color: #fff;
//               }

//               .item-time {
//                 color: rgb(154, 154, 154);
//               }
//             }
//           }
//         }
//       }
//     }

//     .video-all-bottom {
//       display: flex;
//       align-items: center;
//       justify-content: space-between;
//       padding: 0 24rpx;
//       font-size: 32rpx;
//       font-weight: bold;
//       height: 120rpx;
//       border-top: 2rpx solid rgb(227, 227, 227);
//       box-shadow: 0px 4px 10px 0px rgba(0, 0, 0, 0.3);

//       &__left {
//         color: #2457fd;
//       }

//       &__right {
//         color: rgb(188, 188, 188);
//       }
//     }
//   }
// }
</style>
