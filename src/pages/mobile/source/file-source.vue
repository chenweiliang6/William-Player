<template>
  <div :class="['fileSource', themeClass]">
    <div class="fileSource-item" v-for="item in sourceList" :key="item.type">
      <div class="fileSource-item__title">{{ item.type }}</div>
      <div class="fileSource-item__list">
        <div :class="['list-item', item.list.length == 1 ? 'list-one' : '']" v-for="vitem in item.list" :key="vitem.name" @click="toPath(vitem)">
          <div class="list-item-img">
            <image :src="vitem.img" />
          </div>
          <div class="list-item-name">{{ vitem.name }}</div>
          <image :src="isDark ? icIntoWhite : icIntoBlack" class="list-item-button" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import webdavFileIcon from '@/static/webdav-fileIcon.png'
import icIntoBlack from '@/static/ic-intoblack.png'
import icIntoWhite from '@/static/ic-intowhite.png'
import { toStringfy } from '../mine/common'
import { useThemeNavbar } from '@/hooks/useThemeNavbar'
import { useI18nNavbar } from '@/hooks/useI18nNavbar'
import { useThemeClass } from '@/hooks/useThemeClass'
import { useThemeColors } from '@/hooks/useThemeColors'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
useThemeNavbar()
useI18nNavbar('navbar.addFileSource')
const themeClass = useThemeClass()
const { isDark } = useThemeColors()

const sourceList = computed(() => [
  {
    type: t('source.networkStorage'),
    list: [
      {
        name: 'OpenList/Alist',
        img: webdavFileIcon,
        path: '/pages/mobile/source/add-webdav',
        query: { title: t('navbar.addWebdav') },
      },
      {
        name: 'Emby',
        img: 'https://gimg3.baidu.com/search/src=https%3A%2F%2Ftiebapic.baidu.com%2Fforum%2Fw%253D120%253Bh%253D120%2Fsign%3D44147d7d4e82b2b7a79f3dc60196a3d2%2Fc9fcc3cec3fdfc03771506c1c33f8794a4c2265e.jpg%3Ftbpicau%3D2025-04-08-05_5fe90c457d4356ee146a73914e8a8871&refer=http%3A%2F%2Fwww.baidu.com&app=2021&size=w240&n=0&g=0n&q=75&fmt=auto?sec=1744045200&t=627b5377de1d3107a8a09cb4f65c9fdc',
        path: '/pages/mobile/source/add-emby',
        query: { title: t('navbar.addEmby') },
      },
    ],
  },
  {
    type: t('source.cloudStorage'),
    list: [
      {
        name: t('navbar.tianyiCloudDrive'),
        img: 'https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/8c/87/69/8c8769f2-6bfa-19b2-53a4-9e10a555deb3/AppIcon-0-0-1x_U007emarketing-0-7-0-0-sRGB-85-220.png/350x350.png',
        path: '/pages/mobile/source/add-cloud189',
        query: { title: t('navbar.tianyiCloudDrive') },
      },
      {
        name: t('navbar.quarkCloudDrive'),
        img: 'https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/60/6f/e5/606fe5ab-3bfb-c5e4-5bed-08c9b2b5188f/AppIcon-0-0-1x_U007emarketing-0-7-0-0-85-220.png/350x350.png?',
        path: '/pages/mobile/backend/quark-webview',
        query: {
          url: 'https://pan.quark.cn',
          title: t('navbar.quarkCloudDrive'),
        },
      },
      {
        name: t('source.unicomCloudDrive'),
        img: 'https://is1-ssl.mzstatic.com/image/thumb/Purple126/v4/a1/63/38/a16338a7-ba51-498a-5180-7327b46ca2b7/AppIcon-0-0-1x_U007emarketing-0-0-0-0-85-220.png/350x350.png',
        path: '/pages/mobile/source/add-wopan',
        query: { title: t('source.unicomCloudDrive') },
      },
      {
        name: t('source.cloud139Label'),
        img: 'https://is1-ssl.mzstatic.com/image/thumb/Purple126/v4/a1/63/38/a16338a7-ba51-498a-5180-7327b46ca2b7/AppIcon-0-0-1x_U007emarketing-0-7-0-0-85-220.png/350x350.png',
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
          width: 30rpx;
          height: 30rpx;
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
