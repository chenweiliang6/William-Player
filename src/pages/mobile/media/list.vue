<template>
  <div :class="['video', themeClass]">
    <div class="video-refresh" @click="refreshModule">
      <span>{{ isRefresh ? t('media.syncing') : t('media.recentUpdate') }}</span>
      <span :class="['video-refresh-time',isRefresh?'hide-span':'show-span']" :style="{width:refreshWidth>=0?refreshWidth+'px':'auto'}">{{ date }}</span>
      <span class="video-refresh-timefixed">{{ date }}</span>
      <nut-icon name="refresh2" size="14" :class="[isRefresh ? 'icon-refresh' : '']"></nut-icon>
    </div>
    <div class="video-module">
      <div class="video-module-item" v-for="item in moduleList" :key="item.name">
        <div class="video-module-item__value">{{ item.value }}</div>
        <div class="video-module-item__name">{{ item.name }}</div>
      </div>
    </div>
    <div class="video-list1">
      <div class="video-list1-title">{{ t('media.myFiles') }}</div>
      <div class="video-list1-container" v-if="listData.length">
        <wil-cell :options="listData" @click-item="clickCell" :defaultProps="{title:'name',leftIcon:'leftIcon'}"></wil-cell>
      </div>
      <wil-empty v-else :text="t('media.noFilesCheckSource')" class="video-list1-tip"></wil-empty>
    </div>
    <div class="video-link" @click="openModal">
      <wil-icon name="link-icon" />
    </div>
    <wil-modal ref="wil_modal">
      <wil-form v-model="state.formData" :options="options" ref="base_form">
      </wil-form>
    </wil-modal>
  </div>
</template>
  
  <script setup>
import { computed, reactive, ref, nextTick } from "vue";
import wilCell from "@/components/mobile/wil-cell/index.vue";
import Folder from "@/static/folder.png";
import dayjs from 'dayjs';
import { getFolder, get189Folder, getQuarkFolder } from "@/utils/common.js";
import { onShow } from "@dcloudio/uni-app";
import { useThemeNavbar } from '@/hooks/useThemeNavbar'
import { useI18nNavbar } from '@/hooks/useI18nNavbar'
import { useThemeClass } from '@/hooks/useThemeClass'
import wilEmpty from "@/components/mobile/wil-empty/index.vue";
import wilModal from "@/components/mobile/wil-modal/index.vue";
import wilForm from "@/components/mobile/wil-form/index.vue";
import wilIcon from "@/components/common/wil-icon/index.vue";
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
useThemeNavbar()
useI18nNavbar('navbar.mediaLibrary')
const themeClass = useThemeClass()
const refreshDate = ref('');
const date = computed(() => {
  if (!refreshDate.value) return t('media.notUpdatedYet')
  return refreshDate.value.split(" ")[0] == dayjs().format("MM-DD") ? t('common.today') + ' ' + refreshDate.value.split(" ")[1] : refreshDate.value
});

const moduleList = computed(() => [
  { key: 'movie', name: t('video.movie'), value: moduleData.value.movie },
  { key: 'tv', name: t('video.tv'), value: moduleData.value.tv },
  { key: 'other', name: t('media.other'), value: moduleData.value.other },
]);
const moduleData = ref({ movie: 0, tv: 0, other: 0 })

const listData = ref([]);
const isRefresh = ref(false);
const refreshWidth = ref(0);

const sourceList = ref([]);
const selectType = ref({});
const selectMedia = ref({});

const wil_modal = ref(null);

const state = reactive({
  formData: {},
});

const options = computed(() => [{ label: "", prop: "url", type: "input", formItemProps: { placeholder: t('media.pleaseInputUrl'), type: "text", maxlength: -1 } }]);

const loginUser = () => {
  return new Promise((resolve) => {
    uni.request({
      url: selectMedia.value.protocol + "://" + selectMedia.value.address + ":" + selectMedia.value.port + "/api/auth/login",
      data: JSON.stringify({ username: selectMedia.value.username, password: selectMedia.value.password }),
      timeout: 3000,
      method: "POST",
      header: { "Content-Type": "application/json" },
      success: (res) => {
        uni.setStorageSync("webdavInfo", { ...selectMedia.value, token: res.data.data.token });
        selectMedia.value.token = res.data.data.token
        resolve(res.data);
      },
    });
  });
};

const clickCell = (item) => {
  if (selectType.value.type == "WebDAV") {
    uni.navigateTo({
      url: "/pages/mobile/media/catelog-list?path=" + item.name,
    });
  } else if (selectType.value.type == "天翼云盘") {
    uni.navigateTo({
      url: `/pages/mobile/media/catelog-list?path=${item.name}&folderFileId=${item.id}`,
    });
  } else if (selectType.value.type == "夸克网盘") {
    uni.navigateTo({
      url: `/pages/mobile/media/catelog-list?path=${item.name}&folderFileId=${item.fid}`,
    });
  }
};

const refreshWebDAVModule = async () => {
  if (!listData.value.length) {
    uni.showToast({
      title: t('source.pleaseEnableAlist'),
      icon: "none",
    });
    isRefresh.value = false;
    return;
  }
  let num1 = 0;
  let num2 = 0;
  let num3 = 0;
  // alist 会在 token 过期/目录不可用时抛错，单个目录失败不该让整次统计挂掉
  await Promise.all(
    listData.value.map(async (item) => {
      try {
        let res = await getFolder({ path: "/" + item.name }, selectMedia.value);
        let movie = res.data.content.find((i) => i.name == "电影");
        let tv = res.data.content.find((i) => i.name == "电视剧");
        let other = res.data.content.find((i) => i.name == "其他");
        if (movie) {
          let resmovie = await getFolder({ path: "/" + item.name + "/电影" }, selectMedia.value);
          num1 += resmovie.data.total;
        }
        if (tv) {
          let restv = await getFolder({ path: "/" + item.name + "/电视剧" }, selectMedia.value);
          num2 += restv.data.total;
        }
        if (other) {
          let resother = await getFolder({ path: "/" + item.name + "/其他" }, selectMedia.value);
          num3 += resother.data.total;
        }
      } catch (e) {
        console.warn("[media/list] 统计目录失败:", item.name, e?.message);
      }
    })
  ).then(() => {
    setTimeout(() => {
      moduleData.value = { movie: num1, tv: num2, other: num3 };
      selectMedia.value.moduleData = { movie: num1, tv: num2, other: num3 };
      selectMedia.value.refreshDate = dayjs().format("MM-DD HH:mm");
      refreshDate.value = selectMedia.value.refreshDate;
      uni.setStorageSync("webdavInfo", selectMedia.value);
      nextTick(async () => {
        isRefresh.value = false;
        await setTimeWidth();
      });
    }, 2000);
  });
};

//天翼云盘的刷新方法
const refresh189Module = async () => {
  let num1 = 0;
  let num2 = 0;
  let num3 = 0;
  await Promise.all(
    listData.value.map(async (item) => {
      let res = {};
      if (item.name == "我的视频") {
        res = await get189Folder({ folderId: item.id }, selectMedia.value);
        let movie = res.fileListAO.folderList.find((i) => i.name == "电影");
        let tv = res.fileListAO.folderList.find((i) => i.name == "电视剧");
        let other = res.fileListAO.folderList.find((i) => i.name == "其他");
        if (movie) {
          let resmovie = await get189Folder({ folderId: movie.id }, selectMedia.value);
          num1 += resmovie.fileListAO.count;
        }
        if (tv) {
          let restv = await get189Folder({ folderId: tv.id }, selectMedia.value);
          num2 += restv.fileListAO.count;
        }
        if (other) {
          let resother = await get189Folder({ folderId: other.id }, selectMedia.value);
          num3 += resother.fileListAO.count;
        }
      }
    })
  ).then(() => {
    setTimeout(() => {
      moduleData.value = { movie: num1, tv: num2, other: num3 };
      selectMedia.value.moduleData = { movie: num1, tv: num2, other: num3 };
      selectMedia.value.refreshDate = dayjs().format("MM-DD HH:mm");
      refreshDate.value = selectMedia.value.refreshDate;
      nextTick(async () => {
        isRefresh.value = false;
        await setTimeWidth();
      });
    }, 2000);
  });
};

//夸克网盘刷新方法
const refreshQuarkModule = async () => {
  let num1 = 0;
  let num2 = 0;
  let num3 = 0;
  await Promise.all(
    listData.value.map(async (item) => {
      let res = {};
      if (item.name == "我的视频") {
        res = await getQuarkFolder({ fid: item.fid }, selectMedia.value);

        let movie = res.data.list.find((i) => i.file_name == "电影");
        let tv = res.data.list.find((i) => i.file_name == "电视剧");
        let other = res.data.list.find((i) => i.file_name == "其他");
        if (movie) {
          let resmovie = await getQuarkFolder({ fid: movie.fid }, selectMedia.value);
          num1 += resmovie.data.list.length;
        }
        if (tv) {
          let restv = await getQuarkFolder({ fid: tv.fid }, selectMedia.value);
          num2 += restv.data.list.length;
        }
        if (other) {
          let resother = await getQuarkFolder({ fid: other.fid }, selectMedia.value);
          num3 += resother.data.list.length;
        }
      }
    })
  ).then(() => {
    setTimeout(() => {
      moduleData.value = { movie: num1, tv: num2, other: num3 };
      selectMedia.value.moduleData = { movie: num1, tv: num2, other: num3 };
      selectMedia.value.refreshDate = dayjs().format("MM-DD HH:mm");
      refreshDate.value = selectMedia.value.refreshDate;
      nextTick(async () => {
        isRefresh.value = false;
        await setTimeWidth();
      });
    }, 2000);
  });
};

const refreshModule = () => {
  if (!selectMedia.value.name) {
    uni.showToast({
      title: t('media.pleaseAddResourceFirst'),
      icon: "none",
    });
    return;
  }
  if (isRefresh.value) return;
  isRefresh.value = true;

  setTimeout(() => {
    refreshWidth.value = 0;
  }, 1000);
  if (selectType.value.type == "WebDAV") {
    refreshWebDAVModule();
  } else if (selectType.value.type == "天翼云盘") {
    refresh189Module();
  } else if (selectType.value.type == "夸克网盘") {
    refreshQuarkModule();
  }
};

const setTimeWidth = () => {
  return new Promise((resolve) => {
    const query = uni.createSelectorQuery();
    query
      .select(".video-refresh-timefixed")
      .fields(
        {
          size: true,
        },
        (res) => {
          if (!res) {
            return;
          }
          refreshWidth.value = res.width;
          resolve();
        }
      )
      .exec();
  });
};

const judgeSelect = () => {
  sourceList.value = uni.getStorageSync("sourceList");
  selectType.value =
    sourceList.value.find((item) => {
      let select = item.list.find((i) => i.active);
      if (select) {
        selectMedia.value = select;
        return true;
      } else {
        return false;
      }
    }) || {};
};

const openModal = () => {
  wil_modal.value.showModal({
    title: t('media.playCustomLink'),
    confirmColor: "#ff6701",
    confirm: async () => {
      if (!state.formData.url) {
        uni.showToast({
          title: t('media.pleaseInputLink'),
          icon: "none",
        });
      } else {
        if (!state.formData.url.startsWith("http://") && !state.formData.url.startsWith("https://")) {
          uni.showToast({
            title: t('media.linkFormatInvalid'),
            icon: "none",
          });
        } else {
          uni.navigateTo({
            url: `/pages/mobile/video/video-player?noSetHistory=0&videoUrl=${encodeURIComponent(state.formData.url)}&liveTitle=${t('media.customLink')}`,
          });
        }
      }
      state.formData = {};
    },
    cancel: () => {
      state.formData = {};
    },
  });
};

onShow(async () => {
  judgeSelect();
  if (selectType.value.type == "WebDAV") {
    if (selectMedia.value.name) {
      try {
        await loginUser();
        let res = await getFolder({}, selectMedia.value);
        listData.value = res.data.content.map((item) => {
          if (item.type == "1") {
            item.leftIcon = Folder;
          }
          delete item.size;
          return item;
        });
      } catch (e) {
        // alist 未开启 / 地址不通 / token 拿不到：留着空列表并提示，避免白屏
        console.warn("[media/list] 读取 WebDAV 根目录失败:", e?.message);
        listData.value = [];
        uni.showToast({ title: t('source.scanFailedCheckLogin'), icon: "none" });
      }
    }
  } else if (selectType.value.type == "天翼云盘") {
    if (selectMedia.value.name) {
      let res = await get189Folder({ folderId: "-11" }, selectMedia.value);
      listData.value = res.fileListAO.folderList.map((item) => {
        item.leftIcon = Folder;
        return item;
      });
    }
  } else if (selectType.value.type == "夸克网盘") {
    if (selectMedia.value.name) {
      let res = await getQuarkFolder({ fid: "0" }, selectMedia.value);
      listData.value = res.data.list
        .filter((item) => item.file_type == 0)
        .map((item) => {
          item.name = item.file_name;
          item.leftIcon = Folder;
          return item;
        });
    }
  }
  // moduleList.value.find((i) => i.name == "电影").value = selectMedia.value.moduleData?.movie || 0;
  // moduleList.value.find((i) => i.name == "电视剧").value = selectMedia.value.moduleData?.tv || 0;
  // moduleList.value.find((i) => i.name == "其他").value = selectMedia.value.moduleData?.other || 0;
  if (selectMedia.value.refreshDate) {
    if (selectMedia.value.refreshDate?.split(" ")[0] == dayjs().format("MM-DD")) {
      refreshDate.value = selectMedia.value.refreshDate;
    } else {
      refreshDate.value = selectMedia.value.refreshDate;
    }
  }
  nextTick(() => {
    setTimeWidth();
  });
});
</script>
  
  <style lang="scss" scoped>
@keyframes rotate1 {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

@keyframes widthchange1 {
  0% {
    width: 0;
  }
  100% {
  }
}
@keyframes widthchange2 {
  0% {
  }
  100% {
    width: 0;
  }
}
page {
  width: 100%;
  height: 100%;
}
.video {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: var(--app-bg);
  box-sizing: border-box;
  &-refresh {
    display: inline-flex;
    align-items: center;
    font-size: 28rpx;
    background: rgba(255, 103, 1, 0.1);
    color: #ff6701;
    border-radius: 16rpx;
    padding: 16rpx;
    margin-top: 24rpx;
    &-time {
      overflow: hidden;
      white-space: nowrap;
    }
    &-timefixed {
      position: fixed;
      color: transparent;
    }
    .nut-icon {
      margin-left: 16rpx;
    }
    .show-span {
      animation: widthchange1 1s ease;
    }
    .hide-span {
      animation: widthchange2 1s ease;
    }
    .icon-refresh {
      animation-duration: 0.5s;
      animation-name: rotate1;
      animation-timing-function: linear;
      animation-iteration-count: infinite;
    }
  }
  &-module {
    margin-top: 24rpx;
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 0 24rpx;
    box-sizing: border-box;
    &-item {
      flex: 1;
      background: var(--app-bg-card);
      border-radius: 12rpx;
      margin-left: 24rpx;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24rpx 0;
      &:first-child {
        margin-left: 0;
      }
      &__value {
        font-weight: bold;
        padding-bottom: 8rpx;
        font-size: 32rpx;
        color: var(--app-text-primary);
      }
      &__name {
        font-size: 26rpx;
        color: var(--app-text-tertiary);
      }
    }
  }
  &-list1 {
    width: 100%;
    margin-top: 24rpx;
    padding: 0 24rpx;
    box-sizing: border-box;
    &-title {
      color: var(--app-text-tertiary);
      font-size: 28rpx;
    }
    &-container {
      :deep(.wil-cell) {
        .nut-cell-group__wrap {
          .nut-cell {
            .right-icon {
              display: none;
            }
          }
        }
      }
    }
    &-tip {
      margin-top: 24rpx;
      text-align: center;
      font-size: 28rpx;
      display: flex;
      flex-direction: column;
      align-items: center;
      image {
        width: 400rpx;
        height: 400rpx;
      }
    }
  }
  &-addbutton {
    position: fixed;
    width: 136rpx;
    height: 136rpx;
    background: #ff6701;
    right: 24rpx;
    bottom: 148rpx;
    border-radius: 50%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    image {
      width: 64rpx;
      height: 64rpx;
    }
    span {
      font-size: 24rpx;
      color: #ffffff;
    }
  }
  .video-link {
    border-radius: 25rpx;
    background: var(--app-brand);
    width: 100rpx;
    height: 100rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    position: fixed;
    bottom: 90rpx;
    right: 30rpx;
    box-shadow: 0 8rpx 12rpx #5b73a01a;
    .iconfont {
      font-size: 60rpx;
      color: #ffffff;
    }
  }
  ::v-deep .nut-popup {
    background: var(--app-bg-secondary);
    .video-popup-title {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24rpx 0;
      span {
        font-size: 32rpx;
      }
      .nut-icon {
        position: absolute;
        right: 30rpx;
      }
    }
    .video-popup-container {
      padding: 0 24rpx;
      &__webdav {
        background: var(--app-bg-card);
        border-radius: 16rpx;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 20rpx 24rpx;
        &:active {
          background: rgba(0, 0, 0, 0.2);
        }
        .webdav-left {
          display: flex;
          align-items: center;
          image {
            width: 80rpx;
            height: 70rpx;
            border-radius: 50%;
          }
          span {
            padding-left: 20rpx;
            font-size: 28rpx;
            color: var(--app-text-primary);
          }
        }
      }
      &__add {
        background: var(--app-bg-card);
        border-radius: 16rpx;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 20rpx 24rpx;
        margin-top: 20rpx;
        margin-bottom: 20rpx;
        &:active {
          background: rgba(0, 0, 0, 0.2);
        }
        .add-left {
          display: flex;
          align-items: center;
          image {
            width: 70rpx;
            height: 70rpx;
            border-radius: 50%;
          }
          span {
            padding-left: 30rpx;
            font-size: 28rpx;
            color: var(--app-text-primary);
          }
        }
      }
    }
  }
  ::v-deep .nut-transition {
    .wil-modal {
      .wil-modal-top {
        padding-bottom: 14rpx;
        .base-form {
          .base-form-content {
            .nut-form {
              .nut-cell-group {
                .nut-cell-group__wrap {
                  margin-bottom: 0;
                  .nut-form-item {
                    padding-bottom: 0;
                    .nut-form-item__body {
                      .nut-form-item__body__slots {
                        input {
                          height: 90rpx;
                          border: 2rpx solid var(--app-border-strong);
                          border-radius: 10rpx;
                          padding: 0 24rpx;
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
// @media (prefers-color-scheme: dark) {
//   .video {
//     background: #1e1e20;
//     &-module {
//       &-item {
//         background: #2f2f2f;
//         &__value {
//           color: #fff;
//         }
//         &__name {
//           color: rgb(154, 154, 154);
//         }
//       }
//     }
//     &-list1 {
//       &-title {
//         color: rgb(154, 154, 154);
//       }
//     }
//   }
// }
</style>
  