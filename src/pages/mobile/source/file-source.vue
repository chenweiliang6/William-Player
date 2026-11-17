<template>
  <div :class="['fileSource', themeClass]">
    <div class="fileSource-item" v-for="item in sourceList" :key="item.title">
      <div class="fileSource-item__title">{{ item.title }}</div>
      <div class="fileSource-item__list">
        <div :class="['list-item', item.list.length == 1 ? 'list-one' : '']" v-for="vitem in item.list" :key="vitem.type" @click="toPath(vitem)">
          <div class="list-item-img">
            <image v-if="getSourceIcon(vitem.type).kind === 'image'" :src="getSourceIcon(vitem.type).value" />
            <wil-icon v-else :name="getSourceIcon(vitem.type).value" class="list-item-glyph" />
          </div>
          <div class="list-item-name">{{ vitem.label }}</div>
          <wil-icon name="arrow-right" class="list-item-button icon-theme" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import wilIcon from '@/components/common/wil-icon/index.vue'
import { getSourceIcon } from '@/utils/sources/sourceIcon'
import { toStringfy } from '../mine/common'
import { useThemeNavbar } from '@/hooks/useThemeNavbar'
import { useI18nNavbar } from '@/hooks/useI18nNavbar'
import { useThemeClass } from '@/hooks/useThemeClass'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
useThemeNavbar()
useI18nNavbar('navbar.addFileSource')
const themeClass = useThemeClass()

const sourceList = computed(() => [
  {
    title: t('source.networkStorage'),
    list: [
      {
        // 条目上的 type 用 registry 里的稳定标识，label 才是展示文案：
        // 图标查表要稳定 key，多语言下才能命中品牌图
        type: 'WebDAV',
        label: 'OpenList/Alist',
        path: '/pages/mobile/source/add-webdav',
        query: { title: t('navbar.addWebdav') },
      },
      {
        type: 'Emby',
        label: 'Emby',
        path: '/pages/mobile/source/add-emby',
        query: { title: t('navbar.addEmby') },
      },
    ],
  },
  {
    title: t('source.cloudStorage'),
    list: [
      {
        type: '天翼云盘',
        label: t('navbar.tianyiCloudDrive'),
        path: '/pages/mobile/source/add-cloud189',
        query: { title: t('navbar.tianyiCloudDrive') },
      },
      {
        type: '夸克网盘',
        label: t('navbar.quarkCloudDrive'),
        path: '/pages/mobile/backend/quark-webview',
        query: {
          url: 'https://pan.quark.cn',
          title: t('navbar.quarkCloudDrive'),
        },
      },
      {
        type: '联通云盘',
        label: t('source.unicomCloudDrive'),
        path: '/pages/mobile/source/add-wopan',
        query: { title: t('source.unicomCloudDrive') },
      },
      {
        type: '移动云盘',
        label: t('source.cloud139Label'),
        path: '/pages/mobile/source/add-cloud139',
        query: { title: t('source.cloud139Label') },
      },
    ],
  },
])

const toPath = vitem => {
  if (vitem.path) {
    uni.navigateTo({
      url: vitem.path + '?' + toStringfy(vitem.query),
    })
  } else {
    uni.showToast({
      title: t('common.comingSoon'),
      icon: 'none',
    })
  }
}
</script>

<style lang="scss" scoped>
page {
  width: 100%;
  height: 100%;
}

.fileSource {
  background: var(--app-bg);
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  overflow: auto;
  padding: 0 24rpx;

  .fileSource-item {
    padding-bottom: 16rpx;

    .fileSource-item__title {
      font-size: 28rpx;
      color: var(--app-text-tertiary);
      padding: 16rpx 0;
    }

    .fileSource-item__list {
      background: var(--app-bg-card);
      border-radius: 14rpx;

      .list-item {
        background: var(--app-bg-card);
        padding: 10rpx 24rpx;
        display: flex;
        align-items: center;
        position: relative;
        border-top: 2rpx solid var(--app-border);
        .list-item-name {
          color: var(--app-text-primary);
        }
        &:active {
          background: var(--app-bg-secondary);
        }
        &:first-child {
          border-radius: 14rpx 14rpx 0 0;
          border-top: none;
        }
        &:last-child {
          border-radius: 0 0 14rpx 14rpx;
        }

        .list-item-img {
          width: 90rpx;
          height: 90rpx;
          position: relative;

          .list-item-glyph {
            font-size: 70rpx;
            color: var(--app-icon-strong);
          }

          image {
            width: 90rpx;
            height: 90rpx;
            border-radius: 50%;
          }
        }

        .list-item-name {
          padding-left: 20rpx;
          font-size: 32rpx;
        }

        .list-item-button {
          position: absolute;
          right: 24rpx;
          top: 50%;
          transform: translateY(-50%);
          font-size: 30rpx;
        }
      }

      .list-one {
        border-radius: 14rpx !important;
        border: none !important;
      }
    }
  }
}
// @media (prefers-color-scheme: dark) {
//   .fileSource {
//     background: #1e1e20;
//     .fileSource-item {
//       .fileSource-item__title {
//         color: rgb(154, 154, 154);
//       }
//       .fileSource-item__list {
//         background: #2f2f2f;
//         .list-item {
//           background: #2f2f2f;
//           border-top: 2rpx solid rgb(73, 73, 73);
//           .list-item-name {
//             color: #fff;
//           }
//           &:active {
//             background: rgb(73, 73, 73);
//           }
//         }
//       }
//     }
//   }
// }
</style>
