<template>
  <div class="video-navbar" :style="{ 'height': navBarHeight }" ref="video_navbar">
    <nut-navbar title="" :style="{ '--content-height': contentHeight }" :left-show="true">
      <template #left-show>
        <div class="video-navbar-logo">
        </div>
      </template>
      <template #left>
        <span>William Player</span>
      </template>
      <template #right>
        <nut-icon name="search" custom-color="#000" @click="toVideoSearch"></nut-icon>
        <nut-icon name="uploader" custom-color="#000" @click="toAddMedia"></nut-icon>
        <div class="video-navbar-popover">
          <nut-icon name="refresh2" custom-color="#000" @click="showProgress" class="nut-icon-am-rotate nut-icon-am-infinite" v-show="loading"></nut-icon>
          <nut-icon name="refresh2" custom-color="#000" @click="showProgress" v-show="!loading"></nut-icon>
          <div :class="['video-navbar-popover__arrow',showPopover?'show-animation':'hide-animation']" :style="{top:Number(navBarHeight.split('px')[0])-12+'px'}"
            v-show="showPopover">
            <image src="@/static/rect-san.png" style="width: 100%;height: 100%;"></image>
          </div>
          <div :class="['video-navbar-popover__container',showPopover?'show-animation':'hide-animation']" :style="{top:navBarHeight}" v-if="showPopover">
            <div class="popover-title">
              <div class="popover-title-left">
                <span>{{ popoverData.title }}</span>
                <span class="popover-title-left__button" v-if="popoverData.title=='正在扫描'&&showPause" @click="toCancel">暂停</span>
              </div>
              <div class="popover-title-right" @click="closePopover">
                <nut-icon name="close" custom-color="#fff" size="12"></nut-icon>
              </div>
            </div>
            <div class="popover-list" v-if="initTmdbKey">
              <div class="popover-list-item" v-for="(item,index) in popoverData.list" :key="item.label">
                <span>{{ item.label }}</span>
                <span>{{ item.value }}</span>
                <template v-if="index!=popoverData.list.length-1">，</template>
              </div>
            </div>
            <div class="popover-input" v-else>
              <nut-input v-model="tmdbKey" placeholder="请输入tmdb的api_key" />
              <nut-button type="success" @click="confirmApiKey">确认</nut-button>
            </div>
          </div>
        </div>
      </template>
    </nut-navbar>

  </div>
</template>

<script setup>
import { onMounted, ref, watch, watchEffect, nextTick } from "vue";
import { setTmdbKey } from "@/network/apis";

const props = defineProps({
  refreshData: { type: Object, default: {} },
  loading: { type: Boolean, default: false },
  tmdbKey1: { type: String, default: "" },
});

const navBarHeight = ref("");
const contentHeight = ref("");

const video_navbar = ref(null);

const showPopover = ref(false);
const popoverPosition = ref({});
const popoverData = ref({
  title: "正在扫描",
  list: [
    { label: "已找到", value: 0 },
    { label: "待更新", value: 0 },
    { label: "已更新", value: 0 },
  ],
});
const tmdbKey = ref("");

const initTmdbKey = ref(uni.getStorageSync("settingData").tmdbKey || "");

const loading = ref(false);

const emits = defineEmits(["refresh", "pause"]);

const showPause = ref(false);

const timer = ref(null);

const windowWidth = ref(1);

//计算设备navBar高度
const getNavHeight = () => {
  // let sysinfo = uni.getSystemInfoSync(); // 获取设备系统对象
  // windowWidth.value = sysinfo.windowWidth;
  // let statusBarHeight = sysinfo.statusBarHeight; // 获取状态栏高度
  // navBarHeight.value = ((statusBarHeight + 54) / sysinfo.windowWidth) * 750 + "rpx"; //计算nav导航栏的高度
  // contentHeight.value = "108rpx";
  let sysinfo = uni.getSystemInfoSync(); // 获取设备系统对象
  let statusBarHeight = sysinfo.statusBarHeight; // 获取状态栏高度
  navBarHeight.value = statusBarHeight + 44 + "px"; //计算nav导航栏的高度
  contentHeight.value = "44px";
};

//计算h5的navBar高度
const getH5NavbarHeight = () => {
  let sysinfo = uni.getSystemInfoSync(); // 获取设备系统对象
  windowWidth.value = sysinfo.windowWidth;
  navBarHeight.value = "44px";
  contentHeight.value = "44px";
};

// #ifdef APP-PLUS
getNavHeight();
// #endif

// #ifdef H5
getH5NavbarHeight();
// #endif

const toVideoSearch = () => {
  if (loading.value) {
    uni.showToast({
      title: "正在同步影片，请完成后再搜索",
      icon: "none",
    });
    return;
  }
  uni.navigateTo({
    url: "/pages/mobile/video/search",
  });
};

const toAddMedia = () => {
  if (loading.value) {
    uni.showToast({
      title: "正在同步影片，请完成后再管理资源",
      icon: "none",
    });
    return;
  }
  uni.navigateTo({
    url: "/pages/mobile/source/source-list",
  });
  // let webdavInfo = uni.getStorageSync('webdavInfo')
  // if (!webdavInfo) {
  //   uni.navigateTo({
  //     url: '/pages/mobile/video/add-webdav?title=添加WebDAV'
  //   })
  // } else {
  //   uni.navigateTo({
  //     url: '/pages/mobile/video/add-webdav?title=修改WebDAV'
  //   })
  // }
};

const showProgress = () => {
  if (!uni.getStorageSync("settingData").tmdbKey) {
    popoverData.value.title = "api_key";
    showPopover.value = true;
    return;
  }
  if (loading.value) {
    showPopover.value = true;
    return;
  }
  popoverData.value.title = "正在扫描";
  popoverData.value.list = [
    { label: "已找到", value: 0 },
    { label: "待更新", value: 0 },
    { label: "已更新", value: 0 },
  ];
  showPopover.value = true;
  emits("refresh");
  timer.value = setTimeout(() => {
    showPause.value = true;
  }, 30000);
};

//暂停取消扫描
const toCancel = () => {
  popoverData.value.title == "已暂停";
  showPopover.value = false;
  showPause.value = false;
  clearTimeout(timer.value);
  timer.value = null;
  emits("pause");
};

const closePopover = () => {
  showPopover.value = false;
};

const getRefreshPosition = () => {
  let selectorQuery = uni.createSelectorQuery();
  let sysinfo = uni.getSystemInfoSync();
  selectorQuery
    .select(".video-navbar-popover")
    .boundingClientRect((rect) => {
      popoverPosition.value.top = rect.top + rect.height;
      popoverPosition.value.right = sysinfo.screenWidth - rect.left - rect.width / 2;
    })
    .exec();
};

const confirmApiKey = async () => {
  initTmdbKey.value = tmdbKey.value;
  uni.setStorageSync("tmdbKey", tmdbKey.value);
  let settingData = uni.getStorageSync("settingData");
  if (settingData) {
    settingData.tmdbKey = tmdbKey.value;
    uni.setStorageSync("settingData", settingData);
  } else {
    uni.setStorageSync("settingData", { tmdbKey: tmdbKey.value, showProgress: true, playercodec: "exoplayer", showRecommend: true });
  }
  showPopover.value = false;
  await setTmdbKey({ tmdbKey: tmdbKey.value });
};

watch(
  () => props.refreshData,
  (val) => {
    if (props.loading) {
      popoverData.value.list = [
        { label: "已找到", value: 0 },
        { label: "待更新", value: 0 },
        { label: "已更新", value: 0 },
      ];
      popoverData.value.list.find((i) => i.label == "待更新").value = val.toupdate || 0;
    } else {
      popoverData.value.list = [
        { label: "已找到", value: 0 },
        { label: "已失败", value: 0 },
        { label: "已更新", value: 0 },
      ];
      popoverData.value.list.find((i) => i.label == "已失败").value = val.fail || 0;
    }
    popoverData.value.list.find((i) => i.label == "已找到").value = val.found || 0;
    popoverData.value.list.find((i) => i.label == "已更新").value = val.updated || 0;
  },
  { deep: true }
);

watch(
  () => props.loading,
  (val) => {
    loading.value = val;
    if (!val) {
      popoverData.value.title = `已完成同步${props.refreshData.success || 0}个影片`;
      clearTimeout(timer.value);
      timer.value = null;
      showPause.value = false;
    }
  },
  { deep: true }
);

watch(
  () => props.tmdbKey1,
  (val) => {
    initTmdbKey.value = val;
    tmdbKey.value = val;
  },
  { immediate: true }
);

defineExpose({
  showProgress,
});

onMounted(() => {
  getRefreshPosition();
});
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
  position: relative;
  background: #fff;
  z-index: 99;
  top: 0;
  border-bottom: 2rpx solid #f6f7f8;
  box-sizing: border-box;
  ::v-deep .nut-navbar {
    position: absolute;
    width: 100%;
    bottom: 0;
    height: var(--content-height);
    background: #fff;
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
        background: url("@/static/app-logo1.png") center no-repeat;
        background-size: 100% 100%;
      }

      span {
        font-size: 20px;
        font-weight: bold;
        color: #000;
        padding-left: 5px;
      }
    }

    .nut-navbar__title {
      display: none;
      .title {
        color: #000;
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
        .video-navbar-popover__arrow {
          width: 16px;
          height: 16px;
          position: fixed;
          right: 18px;
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
          background: #315ffd;
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
              color: #fff;
              .popover-title-left__button {
                display: inline-block;
                border: 1px solid #fff;
                margin-left: 5px;
                padding: 0 2px;
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
                color: #d0d0d0;
              }
              span:last-child {
                font-size: 14px;
                padding-left: 3px;
                color: #fff;
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
              .nut-input-value {
                .nut-input-inner {
                  .nut-input-box {
                    .uni-input-input {
                      color: #000;
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
@media (prefers-color-scheme: dark) {
  .video-navbar {
    background: #1e1e20;
    border-bottom: 2rpx solid #1e1e20;
    ::v-deep .nut-navbar {
      background-color: #1e1e20;
      .nut-navbar__left {
        span {
          color: #fff;
        }
      }
      .nut-navbar__title {
        .title {
          color: #fff;
        }
      }
      .nut-navbar__right {
        .nut-icon-search {
          color: #fff !important;
        }
        .nut-icon-uploader {
          color: #fff !important;
        }
        .video-navbar-popover {
          .nut-icon-refresh2 {
            color: #fff !important;
          }
        }
      }
    }
  }
}
</style>