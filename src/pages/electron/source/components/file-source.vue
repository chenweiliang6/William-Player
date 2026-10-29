<template>
  <div class="fileSource">
    <div class="fileSource-item" v-for="item in sourceList" :key="item.type">
      <template v-if="props.isEmby ? item.type === 'network' : true">
        <div class="fileSource-item__title">{{ item.title }}</div>
        <div class="fileSource-item__list">
          <template v-for="vitem in item.list" :key="vitem.name">
            <div :class="['list-item', item.list.length == 1 ? 'list-one' : '']" @click="toPath(vitem)" v-if="(vitem.name === 'Emby') === props.isEmby">
              <div class="list-item-img">
                <img :src="vitem.img" />
              </div>
              <div class="list-item-name">{{ vitem.label }}</div>
              <img :src="theme == 'dark' ? icIntoWhite : icIntoBlack" class="list-item-button" />
            </div>
          </template>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import webdavFileIcon from '@/static/webdav-fileIcon.png'
import icIntoBlack from '@/static/ic-intoblack.png'
import icIntoWhite from '@/static/ic-intowhite.png'
import { onUnload } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'

const props = defineProps({
  isEmby: { type: Boolean, default: false },
})
const theme = ref(uni.getSystemInfoSync().theme)
const emits = defineEmits(['clickItem'])
const { t } = useI18n()

const sourceList = computed(() => [
  {
    type: 'network',
    title: t('source.networkStorage'),
    list: [
      {
        name: 'WebDAV',
        label: 'WebDAV',
        img: webdavFileIcon,
      },
      {
        name: 'Emby',
        label: 'Emby',
        img: 'https://gimg3.baidu.com/search/src=https%3A%2F%2Ftiebapic.baidu.com%2Fforum%2Fw%253D120%253Bh%253D120%2Fsign%3D44147d7d4e82b2b7a79f3dc60196a3d2%2Fc9fcc3cec3fdfc03771506c1c33f8794a4c2265e.jpg%3Ftbpicau%3D2025-04-08-05_5fe90c457d4356ee146a73914e8a8871&refer=http%3A%2F%2Fwww.baidu.com&app=2021&size=w240&n=0&g=0n&q=75&fmt=auto?sec=1744045200&t=627b5377de1d3107a8a09cb4f65c9fdc',
      },
    ],
  },
  {
    type: 'cloud',
    title: t('source.cloudStorage'),
    list: [
      {
        name: '天翼云盘',
        label: t('source.tianyiCloudDriveLabel'),
        img: 'https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/8c/87/69/8c8769f2-6bfa-19b2-53a4-9e10a555deb3/AppIcon-0-0-1x_U007emarketing-0-7-0-0-sRGB-85-220.png/350x350.png',
      },
      {
        name: '夸克网盘',
        label: t('source.quarkCloudDriveLabel'),
        img: 'https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/60/6f/e5/606fe5ab-3bfb-c5e4-5bed-08c9b2b5188f/AppIcon-0-0-1x_U007emarketing-0-7-0-0-85-220.png/350x350.png?',
      },
      {
        name: '联通云盘',
        label: t('source.unicomCloudDriveLabel'),
        img: 'https://is1-ssl.mzstatic.com/image/thumb/Purple126/v4/a1/63/38/a16338a7-ba51-498a-5180-7327b46ca2b7/AppIcon-0-0-1x_U007emarketing-0-0-0-0-85-220.png/350x350.png',
      },
      {
        name: '移动云盘',
        label: t('source.cloud139Label'),
        img: 'https://is1-ssl.mzstatic.com/image/thumb/Purple126/v4/a1/63/38/a16338a7-ba51-498a-5180-7327b46ca2b7/AppIcon-0-0-1x_U007emarketing-0-0-0-0-85-220.png/350x350.png',
      },
    ],
  },
])

const toPath = vitem => {
  emits('clickItem', vitem)
}
const changeTheme = () => {
  theme.value = uni.getSystemInfoSync().theme
}
uni.onThemeChange(changeTheme)

onUnload(() => {
  uni.offThemeChange(changeTheme)
})
</script>

<style lang="scss" scoped>
page {
  width: 100%;
  height: 100%;
}

.fileSource {
  // background: #f6f7f8;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  overflow: auto;
  // padding: 0 24rpx;

  .fileSource-item {
    padding-bottom: 16rpx;

    .fileSource-item__title {
      font-size: 28rpx;
      color: #6d6d6d;
      padding: 16rpx 0;
      text-align: left;
    }

    .fileSource-item__list {
      background: #fff;
      border-radius: 14rpx;

      .list-item {
        background: #fff;
        padding: 10rpx 24rpx;
        display: flex;
        align-items: center;
        position: relative;
        border-top: 2rpx solid rgb(241, 241, 241);
        cursor: pointer;

        .list-item-name {
          color: #000;
        }

        &:active {
          background: rgb(241, 241, 241);
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

          img {
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
