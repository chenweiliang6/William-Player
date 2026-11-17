<template>
  <div :class="['source-list', themeClass]">
    <wil-navbar :title="t('navbar.resourceLibrary')" :leftShow="false" :rightShow="true">
      <template #right>
        <div class="navbar-actions">
          <wil-icon name="xiazai" class="navbar-icon" :custom-color="iconColor" @click="toDownload" />
          <nut-icon name="uploader" :custom-color="iconColor" @click="toAddFile"></nut-icon>
        </div>
      </template>
    </wil-navbar>
    <div class="source-list-container" v-if="show">
      <!-- 本地下载卡片 -->
      <div class="download-card" @click="toDownload">
        <div class="download-card__icon">
          <wil-icon name="xiazai" custom-color="var(--app-brand)" />
        </div>
        <span class="download-card__name">{{ t('resourceLibrary.localDownload') }}</span>
        <nut-icon name="right" :custom-color="iconColorMuted"></nut-icon>
      </div>

      <div class="source-list-item" v-for="item in sourceList" :key="item.type">
        <template v-if="item.list.length">
          <div class="source-list-item__title">{{ item.type }}</div>
          <div class="source-list-item__list">
            <div :class="['list-item', 'card-item']"
              v-for="vitem in item.list" :key="vitem.name" @click="openManage(item, vitem)">
              <div class="list-item-img">
                <image v-if="getSourceIcon(item.type).kind === 'image'" :src="getSourceIcon(item.type).value" />
                <wil-icon v-else :name="getSourceIcon(item.type).value" class="list-item-glyph" />
              </div>
              <div class="list-item-name">{{ vitem.name }}</div>
              <wil-icon name="gengduo" class="list-item-button"
                :style="{ color: 'var(--app-icon-strong)' }"
                @click.stop="toShowMoreButton(item, vitem)" />
            </div>
          </div>
        </template>
      </div>
    </div>
    <div class="source-list-empty" v-else>
      <image src="@/static/no-data.png" class="source-list-empty__img"  />
      <span class="source-list-empty__tip">{{ t('resourceLibrary.emptyTip') }}</span>
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
import { clearLibrary } from '@/utils/scrape'
import { clearAccount } from '@/utils/sources/mulu'
import { computed, ref } from "vue";
import wilNavbar from "@/components/mobile/wil-navbar/index.vue";
import wilIcon from "@/components/common/wil-icon/index.vue";
import { getSourceIcon } from '@/utils/sources/sourceIcon';
import { onShow } from "@dcloudio/uni-app";
import { toStringfy } from "../mine/common";
import wilModal from "@/components/mobile/wil-modal/index.vue";
import { useThemeClass } from '@/hooks/useThemeClass'
import { useThemeColors } from '@/hooks/useThemeColors'
import { useThemeTabbar } from '@/hooks/useThemeTabbar'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const sourceList = ref([]);
const selectMedia = ref({});
const themeClass = useThemeClass()
// 资源库是 tabBar 页，主题/语言变化时要同步底部 tab
useThemeTabbar()
const { primaryBtnColor, primaryBtnTextColor, iconColor, iconColorMuted } = useThemeColors()

const show = ref(true);
const wil_modal = ref(null);

const showBottom = ref(false);

const getOperationList = () => [
  // 点卡片进「管理已导入 / 导入新资源」；「...」只放源账号级操作
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
  "联通云盘": {
    path: "/pages/mobile/source/add-wopan",
    query: { title: t('source.unicomCloudDrive') },
  },
  "移动云盘": {
    path: "/pages/mobile/source/add-cloud139",
    query: { title: t('source.cloud139Label') },
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

/**
 * 点源卡片：进入该源的「管理已导入资源 / 导入新资源」页。
 * catelog-mulu 已支持按 type/name 过滤本账号的已导入目录，并提供底部「添加导入目录」。
 */
const openManage = (item, vitem) => {
  // 与移动端既有约定一致。catelog-mulu 的 onLoad 会 decode 一次并按 type/name 精确过滤。
  uni.navigateTo({
    url: `/pages/mobile/media/catelog-mulu?type=${encodeURIComponent(item.type)}&name=${encodeURIComponent(vitem.name || '')}`,
  });
}

const toDownload = () => {
  uni.navigateTo({ url: '/pages/mobile/toolbox/download/index' });
}

const toShowMoreButton = (item, vitem) => {
  operationList.value = item.type == 'Emby' ? getOperationList().filter(i => ['modify', 'delete'].includes(i.key)) : getOperationList()
  selectType = item;
  selectMedia.value = vitem;
  showBottom.value = true;
};

const chooseOperation = (item) => {
  const mapping = getMapping()
  if (item.key == 'modify') {
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
        // 同步清掉该账号的导入目录，否则下次同名账号添加会带出脏目录
        clearAccount({ type: selectType.type, name: selectMedia.value.name });
        if (selectMedia.value.active) {
          clearLibrary();
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

  // 导航栏右侧：下载 + 加号
  .navbar-actions {
    display: flex;
    align-items: center;
    gap: 24rpx;

    .navbar-icon {
      font-size: 40rpx;
    }
  }

  .source-list-container {
    flex: 1;
    overflow: auto;
    padding: 16rpx 24rpx;
    box-sizing: border-box;

    // 本地下载卡片
    .download-card {
      display: flex;
      align-items: center;
      gap: 16rpx;
      background: var(--app-bg-card);
      border-radius: 16rpx;
      padding: 24rpx;
      margin-bottom: 16rpx;

      &:active {
        background: var(--app-bg-secondary);
      }

      &__icon {
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 44rpx;
      }

      &__name {
        flex: 1;
        font-size: 32rpx;
        color: var(--app-text-primary);
      }
    }

    .source-list-item {
      padding-bottom: 8rpx;

      .source-list-item__title {
        font-size: 26rpx;
        color: var(--app-text-tertiary);
        padding: 16rpx 8rpx 12rpx;
      }

      // 每个账号一张独立卡片
      .source-list-item__list {
        background: transparent;
        display: flex;
        flex-direction: column;
        gap: 16rpx;

        .list-item {
          background: var(--app-bg-card);
          border-radius: 16rpx;
          padding: 8rpx 24rpx;
          display: flex;
          align-items: center;
          position: relative;

          &:active {
            background: var(--app-bg-secondary);
          }

          .list-item-img {
            width: 100rpx;
            height: 100rpx;
            background: url("@/static/source-file.png") center no-repeat;
            background-size: 100% 100%;
            position: relative;
            flex-shrink: 0;

            image {
              width: 40rpx;
              height: 40rpx;
              border-radius: 50%;
              position: absolute;
              left: 50%;
              top: 40%;
              transform: translate(-50%, 0);
            }

            .list-item-glyph {
              font-size: 40rpx;
              color: var(--app-icon-strong);
              position: absolute;
              left: 50%;
              top: 40%;
              transform: translate(-50%, 0);
            }
          }

          .list-item-name {
            flex: 1;
            padding-left: 10rpx;
            font-size: 32rpx;
            color: var(--app-text-primary);
          }

          .list-item-button {
            font-size: 42rpx;
            padding-left: 16rpx;
            flex-shrink: 0;
          }
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
