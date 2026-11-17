<template>
  <div class="video-navbar" :style="{ 'height': navBarHeight }" ref="video_navbar">
    <nut-navbar title="" :style="{ '--content-height': contentHeight }" :left-show="true">
      <template #leftShow>
        <div class="video-navbar-logo"></div>
      </template>
      <template #left>
        <span>William Player</span>
      </template>
      <template #right>
        <nut-icon class="navbar-icon" name="search" custom-color="#fff" @click="toVideoSearch"></nut-icon>
        <nut-icon class="navbar-icon" name="uploader" custom-color="#fff" @click="toAddMedia"></nut-icon>
        <div class="video-navbar-popover">
          <nut-icon name="refresh2" custom-color="#fff" @click="showProgress" class="nut-icon-am-rotate nut-icon-am-infinite navbar-icon" v-show="loading"></nut-icon>
          <nut-icon class="navbar-icon" name="refresh2" custom-color="#fff" @click="showProgress" v-show="!loading"></nut-icon>
          <div
            :class="['video-navbar-popover__arrow', showPopover ? 'show-animation' : 'hide-animation']"
            :style="{ top: Number(navBarHeight.split('px')[0]) - 12 + 'px' }"
            v-show="showPopover"
          >
            <wil-icon name="daosanjiao1" custom-color="var(--app-bg-card)" size="16px" class="video-navbar-popover__arrow-icon" />
          </div>
          <div :class="['video-navbar-popover__container', showPopover ? 'show-animation' : 'hide-animation']" :style="{ top: navBarHeight, right: popoverRight }" v-if="showPopover">
            <div class="popover-title">
              <div class="popover-title-left">
                <span>{{ popoverData.title }}</span>
                <span class="popover-title-left__button" v-if="loading" @click="toCancel">{{ t('video.cancelScan') }}</span>
              </div>
              <div class="popover-title-right" @click="closePopover">
                <nut-icon name="close" custom-color="var(--app-text-tertiary)" size="12"></nut-icon>
              </div>
            </div>
            <div class="popover-list" v-if="initTmdbKey">
              <div class="popover-list-item" v-for="(item, index) in popoverData.list" :key="item.label">
                <span>{{ item.label }}</span>
                <span>{{ item.value }}</span>
                <template v-if="index != popoverData.list.length - 1">，</template>
              </div>
            </div>
            <div class="popover-input" v-else>
              <nut-input v-model="tmdbKey" :placeholder="t('video.inputTmdbApiKey')" />
              <nut-button type="success" @click="confirmApiKey">{{ t('common.confirm') }}</nut-button>
            </div>
          </div>
        </div>
      </template>
    </nut-navbar>
  </div>
</template>

<script setup>
import { onMounted, ref, watch, watchEffect, nextTick, computed } from 'vue'
import { setTmdbKey } from '@/network/apis'
import { useI18n } from 'vue-i18n'
import { findActiveSource } from '@/utils/tools'
import wilIcon from '@/components/common/wil-icon/index.vue'

const { t } = useI18n()
const props = defineProps({
  refreshData: { type: Object, default: {} },
  loading: { type: Boolean, default: false },
  tmdbKey1: { type: String, default: '' },
  isEmpty: { type: Boolean, default: false }, //是否为空状态显示，没有任何影片
  isConnected: { type: Boolean, default: false }, //手机是否连接网络
})

const navBarHeight = ref('')
const contentHeight = ref('')

const video_navbar = ref(null)

const showPopover = ref(false)
const popoverPosition = ref({})
// 弹层右边缘对齐刷新图标中心；量不到时退回原来的固定值，避免弹层贴边或跑出屏幕
const popoverRight = computed(() => (popoverPosition.value.right != null ? `${popoverPosition.value.right}px` : '7.5px'))
const getProgressList = (failed = false) => [
  { key: 'found', label: t('video.found'), value: 0 },
  { key: failed ? 'failed' : 'pendingUpdate', label: failed ? t('video.failed') : t('video.pendingUpdate'), value: 0 },
  { key: 'updated', label: t('video.updated'), value: 0 },
]
const popoverData = ref({
  title: t('video.scanning'),
  list: getProgressList(),
})
const tmdbKey = ref('')

const initTmdbKey = ref(uni.getStorageSync('settingData').tmdbKey || '')
const selectType = ref({})
const selectMedia = ref({})

const loading = ref(false)

const emits = defineEmits(['refresh', 'pause', 'getHeight'])

const showPause = ref(false)

const timer = ref(null)

const windowWidth = ref(1)

//计算设备navBar高度
const getNavHeight = () => {
  // let sysinfo = uni.getSystemInfoSync(); // 获取设备系统对象
  // windowWidth.value = sysinfo.windowWidth;
  // let statusBarHeight = sysinfo.statusBarHeight; // 获取状态栏高度
  // navBarHeight.value = ((statusBarHeight + 54) / sysinfo.windowWidth) * 750 + "rpx"; //计算nav导航栏的高度
  // contentHeight.value = "108rpx";
  let sysinfo = uni.getSystemInfoSync() // 获取设备系统对象
  let statusBarHeight = sysinfo.statusBarHeight // 获取状态栏高度
  navBarHeight.value = statusBarHeight + 44 + 'px' //计算nav导航栏的高度
  contentHeight.value = '44px'
  emits('getHeight', navBarHeight.value)
}

//计算h5的navBar高度
const getH5NavbarHeight = () => {
  let sysinfo = uni.getSystemInfoSync() // 获取设备系统对象
  windowWidth.value = sysinfo.windowWidth
  navBarHeight.value = '44px'
  contentHeight.value = '44px'
  emits('getHeight', navBarHeight.value)
}

// #ifdef APP-PLUS
getNavHeight()
// #endif

// #ifdef H5
getH5NavbarHeight()
// #endif

const toVideoSearch = () => {
  if (!props.isConnected) {
    uni.showToast({
      title: t('common.networkDisconnected'),
      icon: 'none',
    })
    return
  }
  if (loading.value) {
    uni.showToast({
      title: t('video.syncingVideoSearchTip'),
      icon: 'none',
    })
    return
  }
  uni.navigateTo({
    url: `/pages/mobile/video/search`,
  })
}

const toAddMedia = () => {
  if (!props.isConnected) {
    uni.showToast({
      title: t('common.networkDisconnected'),
      icon: 'none',
    })
    return
  }
  if (loading.value) {
    uni.showToast({
      title: t('video.syncingVideoManageTip'),
      icon: 'none',
    })
    return
  }
  // 资源库已是 tabBar 页，必须用 switchTab
  uni.switchTab({
    url: '/pages/mobile/source/source-list',
  })
  // let webdavInfo = uni.getStorageSync('webdavInfo')
  // if (!webdavInfo) {
  //   uni.navigateTo({
  //     url: '/pages/mobile/video/add-webdav?title=添加Openlist/Alist'
  //   })
  // } else {
  //   uni.navigateTo({
  //     url: '/pages/mobile/video/add-webdav?title=修改Openlist/Alist'
  //   })
  // }
}

//判断选择的是webdav还是天翼云盘还是夸克还是Emby
const judgeSelect = () => {
  let sourceList = uni.getStorageSync('sourceList')
  selectType.value = sourceList.find(item => {
    let select = findActiveSource(item.list)
    if (select) {
      selectMedia.value = select
      return true
    } else {
      return false
    }
  })
}

const showProgress = () => {
  if (!props.isConnected) {
    uni.showToast({
      title: t('common.networkDisconnected'),
      icon: 'none',
    })
    return
  }
  // 刮削进行中：直接展开弹层，取消按钮此时一定可见
  if (loading.value) {
    showPopover.value = true
    return
  }
  if (!uni.getStorageSync('settingData').tmdbKey) {
    popoverData.value.title = t('video.inputTmdbApiKey')
    showPopover.value = true
    return
  }
  judgeSelect()
  // 没有启用的源时 selectType 为 undefined，继续走下去会在下面 selectType.value.type 抛错
  if (!selectType.value?.type) {
    uni.showToast({ title: t('video.noActiveSource'), icon: 'none' })
    return
  }
  popoverData.value.title = t('video.scanning')
  popoverData.value.list = getProgressList()
  showPopover.value = true
  if (selectType.value.type == 'Emby') {
    showPopover.value = false
  }
  emits('refresh')
}

//取消本次刮削。取消后编排层不会落库，海报墙保持取消前的样子。
//标题不在这里改：真实完成时间由父组件决定，统一交给 props.loading 的 watch 处理。
const toCancel = () => {
  emits('pause')
}

const closePopover = () => {
  showPopover.value = false
}

const getRefreshPosition = () => {
  let selectorQuery = uni.createSelectorQuery()
  let sysinfo = uni.getSystemInfoSync()
  selectorQuery
    .select('.video-navbar-popover')
    .boundingClientRect(rect => {
      popoverPosition.value.top = rect.top + rect.height
      popoverPosition.value.right = sysinfo.screenWidth - rect.left - rect.width / 2
    })
    .exec()
}

const confirmApiKey = async () => {
  initTmdbKey.value = tmdbKey.value
  uni.setStorageSync('tmdbKey', tmdbKey.value)
  let settingData = uni.getStorageSync('settingData')
  if (settingData) {
    settingData.tmdbKey = tmdbKey.value
    uni.setStorageSync('settingData', settingData)
  } else {
    uni.setStorageSync('settingData', { tmdbKey: tmdbKey.value, showProgress: true, playercodec: 'exoplayer', showRecommend: true })
  }
  showPopover.value = false
  await setTmdbKey({ tmdbKey: tmdbKey.value })
}

watch(
  () => props.refreshData,
  val => {
    if (props.loading) {
      popoverData.value.list = getProgressList()
      popoverData.value.list.find(i => i.key == 'pendingUpdate').value = val.toupdate || 0
    } else {
      popoverData.value.list = getProgressList(true)
      popoverData.value.list.find(i => i.key == 'failed').value = val.fail || 0
    }
    popoverData.value.list.find(i => i.key == 'found').value = val.found || 0
    popoverData.value.list.find(i => i.key == 'updated').value = val.updated || 0
  },
  { deep: true }
)

watch(
  () => props.loading,
  val => {
    loading.value = val
    if (!val) {
      // 取消结束时，标题要说明是哪种结束，而不是一律报「已完成」
      const reason = props.refreshData?.cancelReason
      if (reason === 'user') {
        // 取消后已刮到的批次会保留，文案要说清楚
        popoverData.value.title = t('video.scanCancelledKeepPartial')
      } else if (reason === 'tmdb') {
        popoverData.value.title = t('video.tmdbUnavailable')
      } else {
        popoverData.value.title = t('video.scanCompleted')
      }
      clearTimeout(timer.value)
      timer.value = null
    }
  },
  { deep: true }
)

watch(
  () => props.tmdbKey1,
  val => {
    initTmdbKey.value = val
    tmdbKey.value = val
  },
  { immediate: true }
)

defineExpose({
  showProgress,
})

onMounted(() => {
  getRefreshPosition()
})
</script>

<style lang="scss" scoped>
@keyframes opacity1 {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

@keyframes opacity2 {
  from {
    opacity: 1;
  }

  to {
    opacity: 0;
  }
}

.video-navbar {
  width: 100%;
  position: fixed;
  background: transparent;
  z-index: 99;
  top: 0;
  // border-bottom: 2rpx solid #f6f7f8;
  border-bottom: 2rpx solid transparent;
  box-sizing: border-box;

  ::v-deep .nut-navbar {
    position: absolute;
    width: 100%;
    bottom: 0;
    height: var(--content-height);
    background: transparent;
    border: none;
    box-shadow: none;
    z-index: 99;
    margin-bottom: 0;

    .nut-navbar__left {
      position: absolute;
      left: 0;

      .video-navbar-logo {
        width: 35px;
        height: 35px;
        // border: 2rpx solid gray;
        border-radius: 20rpx;
        box-sizing: border-box;
        background: url('@/static/app-logo1.png') center no-repeat;
        background-size: 100% 100%;
      }

      span {
        font-size: 20px;
        font-weight: bold;
        color: #fff;
        padding-left: 5px;
      }
    }

    .nut-navbar__title {
      display: none;

      .title {
        color: var(--app-text-primary);
        font-size: 34rpx;
        font-weight: bold;
      }
    }

    .nut-navbar__right {
      right: 0;
      position: absolute;

      // padding: 0 32rpx;
      .nut-icon-uploader {
        margin-left: 15px;
      }

      // .nutui-iconfont {
      //   font-size: 16px;
      //   width: 20px;
      //   height: 20px;
      // }
      .video-navbar-popover {
        margin-left: 15px;
        line-height: initial;

        .video-navbar-popover__arrow {
          width: 16px;
          height: 16px;
          position: fixed;
          right: 18px;
        }

        // 气泡箭头：字体里的正三角朝上，转 180 度让它指向下方气泡
        .video-navbar-popover__arrow-icon {
          display: inline-block;
          transform: rotate(180deg);
        }

        .show-animation {
          animation: opacity1 0.2s ease;
        }

        .hide-animation {
          animation: opacity2 0.2s ease;
        }

        .video-navbar-popover__container {
          position: fixed;
          min-width: 100px;
          background: var(--app-bg-card);
          border: 1px solid var(--app-border);
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.16);
          z-index: 100;
          padding: 12px;
          border-radius: 10px;
          right: 7.5px;

          .popover-title {
            display: flex;
            align-items: center;
            justify-content: space-between;

            .popover-title-left {
              font-size: 15px;
              color: var(--app-text-primary);

              .popover-title-left__button {
                display: inline-block;
                border: 1px solid var(--app-text-primary);
                border-radius: 4px;
                margin-left: 8px;
                padding: 0 5px;
                font-size: 13px;
                line-height: 1.5;
              }
            }

            .popover-title-right {
              .nut-icon-close {
                font-size: 15px;
                width: 15px;
                height: 15px;
                display: block;
              }
            }
          }

          .popover-list {
            display: flex;
            align-items: center;
            margin-top: 10px;

            .popover-list-item {
              display: flex;
              align-items: baseline;

              span:first-child {
                font-size: 14px;
                color: var(--app-text-tertiary);
              }

              span:last-child {
                font-size: 14px;
                padding-left: 3px;
                color: var(--app-text-primary);
                font-weight: bold;
              }
            }
          }

          .popover-input {
            margin-top: 12px;
            display: flex;
            flex-direction: column;
            align-items: flex-end;

            .nut-input {
              padding: 10px 15px;
              background: var(--app-bg-input);

              .nut-input-value {
                .nut-input-inner {
                  .nut-input-box {
                    .uni-input-input {
                      color: var(--app-text-primary);
                    }

                    .uni-input-placeholder {
                      color: var(--app-text-placeholder);
                    }
                  }
                }
              }
            }

            .nut-button {
              margin-top: 24rpx;
            }
          }
        }
      }

      .nut-icon-refresh2 {
        display: block;
      }
    }
  }
}

// @media (prefers-color-scheme: dark) {
//   .video-navbar {
//     background: #1e1e20;
//     border-bottom: 2rpx solid #1e1e20;
//     ::v-deep .nut-navbar {
//       background-color: #1e1e20;
//       .nut-navbar__left {
//         span {
//           color: #fff;
//         }
//       }
//       .nut-navbar__title {
//         .title {
//           color: #fff;
//         }
//       }
//       .nut-navbar__right {
//         .nut-icon-search {
//           color: #fff !important;
//         }
//         .nut-icon-uploader {
//           color: #fff !important;
//         }
//         .video-navbar-popover {
//           .nut-icon-refresh2 {
//             color: #fff !important;
//           }
//         }
//       }
//     }
//   }
// }
</style>
