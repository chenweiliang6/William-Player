<template>
  <div :class="['source-list', themeClass]">
    <wil-navbar :title="t('navbar.resourceLibrary')" :leftShow="true">
      <template #right>
        <nut-icon name="uploader" :custom-color="iconColor" @click="toAddFile"></nut-icon>
      </template>
    </wil-navbar>
    <div class="source-list-container" v-if="show">
      <div class="source-list-item" v-for="item in sourceList" :key="item.type">
        <template v-if="item.list.length">
          <div class="source-list-item__title">{{ item.type }}</div>
          <div class="source-list-item__list">
            <div :class="['list-item', item.list.length == 1 ? 'list-one' : '', vitem.active ? 'list-active' : '']"
              v-for="vitem in item.list" :key="vitem.name" @click="handleSelect(item, vitem)">
              <div class="list-item-img">
                <image :src="item.img"  />
              </div>
              <div class="list-item-name" :class="[vitem.active ? 'list-item-activeName' : '']">{{ vitem.name }}</div>
              <image class="list-item-button"
                :src="vitem.active ? moreOrange : isDark ? moreWhite : moreBlack"
                @click.stop="toShowMoreButton(item, vitem)"  />
            </div>
          </div>
        </template>
      </div>
    </div>
    <div class="source-list-empty" v-else>
      <image src="@/static/no-data.png" class="source-list-empty__img"  />
      <span class="source-list-empty__tip">{{ t('source.resourceTipAfterAdd') }}</span>
      <nut-button :custom-color="primaryBtnColor" @click="toAddFile">
        <template #icon>
          <nut-icon name="uploader" :custom-color="primaryBtnTextColor" size="12"></nut-icon>
        </template>
        <span :style="{ color: primaryBtnTextColor }">{{ t('video.addNewResource') }}</span>
      </nut-button>
    </div>
    <nut-action-sheet v-model:visible="showBottom" :title="selectMedia.name" :menu-items="operationList" :cancel-txt="t('common.cancel')"
      @choose="chooseOperation" />
    <wil-modal ref="wil_modal"></wil-modal>
  </div>
</template>

<script setup>
import { computed, ref } from "vue";
import wilNavbar from "@/components/mobile/wil-navbar/index.vue";
import { onShow, onUnload } from "@dcloudio/uni-app";
import { toParse, toStringfy } from "../mine/common";
import { loginUser, get189Folder, getQuarkFolder } from "@/utils/common";
import showModal from "@/components/mobile/wil-modal/modal.js";
import wilModal from "@/components/mobile/wil-modal/index.vue";
import moreBlack from "@/static/more-black.png";
import moreWhite from "@/static/more-white.png";
import moreOrange from "@/static/more-orange.png";
import { useThemeClass } from '@/hooks/useThemeClass'
import { useThemeColors } from '@/hooks/useThemeColors'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const sourceList = ref([]);
const selectMedia = ref({});
const themeClass = useThemeClass()
const { primaryBtnColor, primaryBtnTextColor, iconColor, isDark } = useThemeColors()

const show = ref(true);
const wil_modal = ref(null);

const showBottom = ref(false);

const getOperationList = () => [
  { key: 'movieDirectory', name: t('source.setMovieDirectory') },
  { key: 'tvDirectory', name: t('source.setTvDirectory') },
  { key: 'modify', name: t('common.modify') },
  { key: 'delete', name: t('common.delete') },
]
const operationList = computed(getOperationList)
let selectType = {};

const getMapping = () => ({
  "WebDAV": {
    path: "/pages/mobile/source/add-webdav",
    query: { title: t('navbar.modifyWebdav') },
  },
  "天翼云盘": {
    path: "/pages/mobile/source/add-cloud189",
    query: { title: t('navbar.tianyiCloudDrive') },
  },
  "夸克网盘": {
    path: "/pages/mobile/backend/quark-webview",
    query: {
      url: "https://pan.quark.cn",
      title: t('navbar.quarkCloudDrive'),
    },
  },
  "Emby": {
    path: "/pages/mobile/source/add-emby",
    query: { title: t('navbar.modifyEmby') },
  }
});

const toAddFile = () => {
  uni.navigateTo({
    url: "/pages/mobile/source/file-source",
  });
};

const clearAcitve = () => {
  sourceList.value.forEach((item) => {
    item.list.forEach((v) => {
      v.active = false;
    });
  });
};

const resetSelect = (vitem) => {
  clearAcitve();
  vitem.active = true;
  uni.setStorageSync("isreload", true);
  uni.setStorageSync("sourceList", sourceList.value);
  uni.navigateBack();
};

const handleSelect = (item, vitem) => {
  wil_modal.value.showModal({
    title: t('modal.warmTip'),
    content: t('source.selectResourceConfirm'),
    confirmColor: "#ff6701",
    confirm: async () => {
      if (item.type == "WebDAV") {
        await loginUser(vitem)
          .then((res) => {
            vitem.token = res.data.token;
            resetSelect(vitem);
          })
          .catch((error) => {
            uni.showToast({
              title: t('source.pleaseEnableAlist'),
              icon: "none",
            });
          });
      } else if (item.type == "天翼云盘") {
        await get189Folder({ folderId: "-11" }, { JSESSIONID: vitem.JSESSIONID, COOKIE_LOGIN_USER: vitem.COOKIE_LOGIN_USER })
          .then((res) => {
            if (res.res_code == 0) {
              resetSelect(vitem);
            } else {
              uni.showToast({
                title: t('source.reloginTianyiCloudDrive'),
                icon: "none",
              });
            }
          })
          .catch((error) => {
            uni.showToast({
              title: t('source.reloginTianyiCloudDrive'),
              icon: "none",
            });
          });
      } else if (item.type == "夸克网盘") {
        await getQuarkFolder({ fid: "0" }, vitem)
          .then((res) => {
            if (res.status == 200) {
              resetSelect(vitem);
            } else {
              uni.showToast({
                title: t('source.reloginQuarkCloudDrive'),
                icon: "none",
              });
            }
          })
          .catch((error) => {
            uni.showToast({
              title: t('source.reloginQuarkCloudDrive'),
              icon: "none",
            });
          });
      } else if (item.type == 'Emby') {
        resetSelect(vitem)
      }
    },
  });
};

const toShowMoreButton = (item, vitem) => {
  operationList.value = item.type == 'Emby' ? getOperationList().filter(i => ['modify', 'delete'].includes(i.key)) : getOperationList()
  selectType = item;
  selectMedia.value = vitem;
  showBottom.value = true;
};

const chooseOperation = (item) => {
  const mapping = getMapping()
  if (item.key == 'movieDirectory') {
    uni.navigateTo({
      url: `/pages/mobile/media/catelog-mulu?title=${t('video.movie')}`
    })
  } else if (item.key == 'tvDirectory') {
    uni.navigateTo({
      url: `/pages/mobile/media/catelog-mulu?title=${t('video.tv')}`
    })
  } else if (item.key == 'modify') {
    if (selectType.type == "WebDAV") {
      uni.navigateTo({
        url: mapping[selectType.type].path + "?" + toStringfy(mapping[selectType.type].query) + `&address=${selectMedia.value.address}&isActive=${selectMedia.value.active ? "1" : "0"}`,
      });
    } else if (selectType.type == "Emby") {
      uni.navigateTo({
        url: mapping[selectType.type].path + "?" + toStringfy(mapping[selectType.type].query) + `&address=${selectMedia.value.address}&isActive=${selectMedia.value.active ? "1" : "0"}`,
      });
    } else {
      uni.navigateTo({
        url: `${mapping[selectType.type].path}?${toStringfy(mapping[selectType.type].query)}&isActive=${selectMedia.value.active ? "1" : "0"}`,
      });
    }
  } else if (item.key == 'delete') {
    wil_modal.value.showModal({
      title: t('modal.warmTip'),
      content: t('source.deleteSourceConfirm'),
      confirmColor: "#ff6701",
      confirm: async () => {
        selectType.list = selectType.list.filter((i) => i.name != selectMedia.value.name);
        uni.setStorageSync("sourceList", sourceList.value);
        if (selectMedia.value.active) {
          uni.removeStorageSync("localMovieTvData");
        }
        let historyPlay = uni.getStorageSync("historyPlay");
        historyPlay = historyPlay.filter((v) => v.sourceType != selectType.type || v.sourceName != selectMedia.value.name);
        uni.setStorageSync("historyPlay", historyPlay);
        judgeShow();
      },
    });
  }
};

const judgeShow = () => {
  sourceList.value = uni.getStorageSync("sourceList");
  show.value = !sourceList.value.every((item) => {
    return !item.list.length;
  });
};

onShow(() => {
  sourceList.value = uni.getStorageSync("sourceList");
  judgeShow();
});
</script>

<style lang="scss" scoped>
page {
  width: 100%;
  height: 100%;
}

.source-list {
  background: var(--app-bg);
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;

  ::v-deep .wil-navbar {
    background-color: var(--app-bg-card);

    .nut-navbar {
      .nut-navbar__right {
        display: flex;
        position: absolute;
        right: 0;
      }
    }
  }

  .source-list-container {
    flex: 1;
    overflow: auto;
    padding: 0 24rpx;

    .source-list-item {
      padding-bottom: 16rpx;

      .source-list-item__title {
        font-size: 28rpx;
        color: var(--app-text-tertiary);
        padding: 16rpx 0;
      }

      .source-list-item__list {
        background: var(--app-bg-card);
        border-radius: 14rpx;

        .list-item {
          background: var(--app-bg-card);
          padding: 6rpx 24rpx;
          display: flex;
          align-items: center;
          position: relative;
          border: 2prx solid transparent;

          &::before {
            position: absolute;
            content: "";
            height: 2rpx;
            background: var(--app-bg-secondary);
            width: 100%;
            left: 0;
            top: 0;
          }

          &:active {
            background: var(--app-bg-secondary);
          }

          &:first-child {
            border-radius: 14rpx;

            &::before {
              display: none;
            }
          }

          &:last-child {
            border-radius: 14rpx;
          }

          .list-item-img {
            width: 100rpx;
            height: 100rpx;
            background: url("@/static/source-file.png") center no-repeat;
            background-size: 100% 100%;
            // display: flex;
            // align-items: center;
            // justify-content: center;
            position: relative;

            image {
              width: 40rpx;
              height: 40rpx;
              border-radius: 50%;
              position: absolute;
              left: 50%;
              top: 40%;
              transform: translate(-50%, 0);
            }
          }

          .list-item-name {
            padding-left: 10rpx;
            font-size: 32rpx;
            color: var(--app-text-primary);
          }

          .list-item-activeName {
            color: #ff6701;
          }

          .list-item-button {
            position: absolute;
            right: 24rpx;
            top: 50%;
            transform: translateY(-50%);
            width: 42rpx;
            height: 42rpx;
          }
        }

        .list-one {
          border-radius: 14rpx !important;
          border: 2rpx solid transparent !important;
        }

        .list-active {
          border: 2rpx solid #ff6701 !important;
        }
      }
    }
  }

  .source-list-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;

    .source-list-empty__img {
      width: 400rpx;
      height: 400rpx;
    }

    .source-list-empty__tip {
      text-align: center;
      padding: 0 50rpx;
      padding-bottom: 24rpx;
      color: var(--app-text-primary);
    }

    ::v-deep .nut-button {
      border-radius: 12rpx;
    }
  }

  ::v-deep .nut-popup {
    .nut-action-sheet {
      .nut-action-sheet__title {
        color: gray;
      }

      .nut-action-sheet__menu {
        .nut-action-sheet__item {
          border-top: 2rpx solid var(--app-border);

          &:first-child {
            border-top: none;
          }
        }
      }

      .nut-action-sheet__cancel {
        border-top: 20rpx solid var(--app-bg-secondary);
      }
    }
  }
}

// @media (prefers-color-scheme: dark) {
//   .source-list {
//     background: #1e1e20;

//     ::v-deep .wil-navbar {
//       .nut-navbar {
//         .nut-navbar__right {
//           .nut-icon-uploader {
//             color: #fff !important;
//           }
//         }
//       }
//     }

//     .source-list-container {
//       .source-list-item {
//         .source-list-item__title {
//           color: #bcbcbc;
//         }

//         .source-list-item__list {
//           background: #2f2f2f;

//           .list-item {
//             background: #2f2f2f;

//             &::before {
//               background: rgb(73, 73, 73);
//             }

//             &:active {
//               background: rgb(73, 73, 73);
//             }

//             .list-item-name {
//               color: #fff;
//             }

//             .list-item-activeName {
//               color: #ff6701;
//             }
//           }

//           .list-one {
//             border: 2rpx solid transparent !important;
//           }

//           .list-active {
//             border: 2rpx solid #ff6701 !important;
//           }
//         }
//       }
//     }

//     .source-list-empty {
//       background: #1e1e20;

//       .source-list-empty__tip {
//         color: #fff;
//       }

//       ::v-deep .nut-button {
//         background-color: #fff !important;

//         .nut-button__wrap {
//           .nut-icon-uploader {
//             color: #000 !important;
//           }

//           .nut-button__text {
//             color: #000 !important;
//           }
//         }

//         &::before {
//           background-color: #fff !important;
//         }
//       }
//     }

//     ::v-deep .nut-popup {
//       background-color: #464646;

//       .nut-action-sheet {
//         background-color: #464646;

//         .nut-action-sheet__title {
//           color: #b7b7b7;
//           background-color: #343437;
//           border-bottom: 2rpx solid #707070;
//           font-weight: bold;
//         }

//         .nut-action-sheet__menu {
//           background-color: #464646;

//           .nut-action-sheet__item {
//             background-color: #464646;
//             border-top: 2rpx solid #707070;
//             color: #fff;
//           }
//         }

//         .nut-action-sheet__cancel {
//           border-top: 20rpx solid #343437;
//           background-color: #464646;
//           color: #fff;
//         }
//       }
//     }
//   }
// }
</style>
