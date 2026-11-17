<template>
  <div class="fileSource">
    <div class="fileSource-item" v-for="item in sourceList" :key="item.type">
      <template v-if="props.isEmby ? item.type === 'network' : true">
        <div class="fileSource-item__title">{{ item.title }}</div>
        <div class="fileSource-item__list">
          <template v-for="vitem in item.list" :key="vitem.name">
            <div :class="['list-item', item.list.length == 1 ? 'list-one' : '']" @click="toPath(vitem)" v-if="(vitem.name === 'Emby') === props.isEmby">
              <div class="list-item-img">
                <image v-if="vitem.img" :src="vitem.img" />
                <wil-icon v-else :name="vitem.glyph" class="list-item-glyph" />
              </div>
              <div class="list-item-name">{{ vitem.label }}</div>
              <wil-icon name="arrow-right" :custom-color="theme == 'dark' ? '#ffffff' : '#000000'" class="list-item-button" />
            </div>
          </template>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import wilIcon from '@/components/common/wil-icon/index.vue'
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
        glyph: 'ziyuanku',
      },
      {
        name: 'Emby',
        label: 'Emby',
        glyph: 'emby',
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

          .list-item-glyph {
            font-size: 70rpx;
            color: #666;
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
