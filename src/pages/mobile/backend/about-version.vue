<template>
  <div :class="['about-version', themeClass]">
    <wil-navbar :title="t('navbar.about')" :rightShow="true">
      <template #right>
        <nut-icon name="share" :custom-color="iconColor" @click="showShare = true"></nut-icon>
      </template>
    </wil-navbar>
    <div class="about-version-wrapper">
      <div class="about-version-container">
        <div class="about-version-container__main">
          <image src="@/static/app-logo1.png" @click="toLogin" />
          <div class="main-name">
            <span>William Player</span>
            <span>{{ appVersion }}</span>
          </div>
          <div class="main-time">{{ CONFIG.updateTime }}</div>
        </div>
        <nut-cell :title="t('backend.autoCheckUpdate')" :desc="status[0]" :is-link="true" @click="showPopover = true"></nut-cell>
      </div>
      <div class="about-version-protocol">
        <image src="@/static/tmdb-xy.png" />
        <div class="about-version-protocol__button" @click="toQQpage">{{ t('backend.contactUs') }}</div>
        <div class="about-version-protocol__other" @click="toOtherPage">{{ t('backend.downloadOtherPlatformVersion') }}</div>
        <!-- <div class="about-version-protocol__tip">@2024-至今，由chenweiliang6开发并开源，仅用于学习和使用，不可用于商用</div> -->
      </div>
      <div class="about-version-button">
        <nut-button :disabled="isLoading" custom-color="#ff6701" @click="checkUpdate" v-if="showButton">
          <template #icon>
            <nut-icon name="refresh2" class="nut-icon-am-rotate nut-icon-am-infinite" v-if="isLoading"></nut-icon>
          </template>
          {{ t('backend.checkUpdate') }}
        </nut-button>
        <nut-button disabled :custom-color="isDark ? '#3a3a3d' : '#dedde3'" v-else>
          <span :style="{ color: disabledBtnTextColor }">{{ t('backend.currentLatestVersion') }}</span>
        </nut-button>
      </div>
      <nut-popup v-model:visible="showPopover" round position="bottom" safe-area-inset-bottom>
        <nut-picker v-model="status" :columns="popoverList" title="" @confirm="confirm" @cancel="showPopover = false" />
      </nut-popup>
      <wil-upgrade
        :updateFunction="backInfo"
        :logo="upgradeInfo.logo"
        :app-name="upgradeInfo.appName"
        :appVersion="appVersion"
        @closed="closedPopup"
        v-model:visible="showUpgrade"
      ></wil-upgrade>
      <wil-share-sheet v-model:show="showShare" :title="t('backend.shareTo')" :options="options" @select="handleSelect" :wrap="true"></wil-share-sheet>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import wilUpgrade from '@/components/mobile/wil-upgrade/index.vue'
import { getUntokenDicts } from '@/network/apis'
import appLogo from '@/static/app-logo1.png'
import * as CONFIG from '@/utils/config'
import { toParse, toStringfy } from '../mine/common'
import { getAppLatestVersion } from '@/utils/common'
import wilNavbar from '@/components/mobile/wil-navbar/index.vue'
import { useThemeClass } from '@/hooks/useThemeClass'
import { useThemeColors } from '@/hooks/useThemeColors'
import wilShareSheet from '@/components/mobile/wil-share-sheet/index.vue'
import saveImage from '@/static/save-image.png'
import { useI18n } from 'vue-i18n'
import { useI18nNavbar } from '@/hooks/useI18nNavbar'

const { t } = useI18n()
useI18nNavbar('navbar.about')

const url = ref('')
const themeClass = useThemeClass()
const { iconColor, isDark, disabledBtnTextColor } = useThemeColors()

const status = ref(['总是'])
const showShare = ref(false)
const showPopover = ref(false)
const popoverList = computed(() => [
  { text: t('backend.always'), value: '总是', key: 'always' },
  { text: t('backend.everyDay'), value: '每天', key: 'daily' },
  { text: t('backend.everyWeek'), value: '每周', key: 'weekly' },
  { text: t('backend.never'), value: '从不', key: 'never' },
])
const isLoading = ref(false)
const showButton = ref(true)
const showUpgrade = ref(false)
const versionData = ref({})

const options = computed(() => [
  {
    delay: '0.1s',
    name: t('mine.wechat'),
    key: 'wechat',
    icon: 'https://q-learning.quectel.com/train-uniapp/assets/wechat-friends-DbSOyenR.png',
  },
  {
    delay: '0.15s',
    name: t('backend.moments'),
    key: 'moments',
    icon: 'https://q-learning.quectel.com/train-uniapp/assets/wechat-moments-Cf8Tr5vB.png',
  },
  {
    delay: '0.2s',
    name: 'QQ',
    key: 'qq',
    icon: 'https://q-learning.quectel.com/train-uniapp/assets/qq-friends-D5XyRct4.png',
  },
  {
    delay: '0.25s',
    name: t('backend.weibo'),
    key: 'weibo',
    icon: 'https://szrcapi.mouldsdata.com/minio/tzgcs/2026/03/13/bcebd0a5a29d4a559d1a94c28aed5261.png',
  },
  {
    delay: '0.3s',
    name: t('backend.copyLink'),
    key: 'copyLink',
    icon: 'https://szrcapi.mouldsdata.com/minio/tzgcs/2026/03/13/f7349231fa5944c5b6873fd0461452f0.png',
  },
  {
    delay: '0.1s',
    name: t('backend.poster'),
    key: 'poster',
    icon: saveImage,
  },
  {
    delay: '0.15s',
    name: t('common.more'),
    key: 'more',
    icon: 'https://szrcapi.mouldsdata.com/minio/tzgcs/2026/03/13/3e6732cec150494c975df84aae3c42ee.png',
  },
])
const appVersion = ref(CONFIG.VERSION)

let num = 0

const upgradeInfo = ref({
  logo: appLogo,
  appName: 'William Player',
})

const checkUpdate = async () => {
  isLoading.value = true
  await getAppUpdateInfo()
}

const confirm = ({ selectedValue, selectedOptions }) => {
  const selectedKey = selectedOptions[0]?.key || 'always'
  uni.setStorageSync('remindTime', { type: selectedValue[0], key: selectedKey })
  showPopover.value = false
}

const toQQpage = () => {
  let query = {
    url: CONFIG.BASE_URL.split(':4040')[0] + ':8443/app-webview/#/qqTalk',
    title: t('navbar.feedback'),
  }
  uni.navigateTo({
    url: '/pages/mobile/backend/index' + '?' + toStringfy(query),
  })
}

//跳转到下载页
const toOtherPage = () => {
  let query = {
    url: CONFIG.BASE_URL.split(':4040')[0] + ':8443/app-webview/#/download-center',
    title: t('navbar.downloadCenter'),
  }
  uni.navigateTo({
    url: '/pages/mobile/backend/index' + '?' + toStringfy(query),
  })
}

//分享
const handleSelect = item => {
  const shareDescription = t('backend.appShareDescription')
  if (item.key === 'wechat') {
    uni.share({
      provider: 'weixin',
      type: 0,
      title: 'William Player',
      scene: 'WXSceneSession',
      summary: shareDescription,
      href: 'https://chenweiliang6.github.io/app-webview/#/download-center',
      imageUrl: 'https://gitee.com/waylon-chen/William-Player/raw/master/src/static/app-logo1.png',
    })
  } else if (item.key === 'moments') {
    uni.share({
      provider: 'weixin',
      type: 0,
      title: 'William Player',
      scene: 'WXSceneTimeline',
      summary: shareDescription,
      href: 'https://chenweiliang6.github.io/app-webview/#/download-center',
      imageUrl: 'https://gitee.com/waylon-chen/William-Player/raw/master/src/static/app-logo1.png',
    })
  } else if (item.key === 'qq') {
    uni.share({
      provider: 'qq',
      type: 1,
      title: 'William Player',
      summary: shareDescription,
      href: 'https://chenweiliang6.github.io/app-webview/#/download-center',
    })
  } else if (item.key === 'weibo') {
    uni.shareWithSystem({
      summary: shareDescription,
      href: 'https://chenweiliang6.github.io/app-webview/#/download-center',
    })
  } else if (item.key === 'copyLink') {
    uni.setClipboardData({
      data: 'https://chenweiliang6.github.io/app-webview/#/download-center',
      success: function () {
        uni.showToast({
          title: t('common.copySuccess'),
          icon: 'none',
        })
      },
    })
  } else if (item.key === 'poster') {
    uni.previewImage({
      urls: [
        'https://storage.7x24cc.com/storage-server/presigned/ss1/a6-online-fileupload/newMediaImage/3D7CAC0_427A_haibao1_20260314190031837newMediaImage.png',
        'https://storage.7x24cc.com/storage-server/presigned/ss1/a6-online-fileupload/newMediaImage/1C3CDC3_427A_haibao_20260314172030157newMediaImage.png',
      ],
    })
  } else if (item.key === 'more') {
    uni.shareWithSystem({
      summary: shareDescription,
      href: 'https://chenweiliang6.github.io/app-webview/#/download-center',
    })
  }
}

const toLogin = () => {
  // if (num == 5) {
  //   uni.removeStorageSync(CONFIG.USER_ID);
  //   uni.removeStorageSync(CONFIG.OPEN_ID);
  //   uni.removeStorageSync(CONFIG.USER_KEY);
  //   uni.removeStorageSync("Authorization");
  //   uni.reLaunch({
  //     url: "/pages/mobile/mine/login",
  //   });
  // } else {
  //   num++;
  // }
}

const compareVersions = (newBb, oldBb) => {
  if (newBb) {
    const v1 = newBb?.split('.').map(Number) // 将版本号拆分成数字
    const v2 = oldBb?.split('.').map(Number) // 同样拆分另一个版本号

    for (let i = 0; i < Math.max(v1.length, v2.length); i++) {
      // 如果 v1 的当前部分小于 v2 对应的部分，返回 -1
      if ((v1[i] || 0) < (v2[i] || 0)) {
        return -1
      }
      // 如果 v1 的当前部分大于 v2 对应的部分，返回 1
      if ((v1[i] || 0) > (v2[i] || 0)) {
        return 1
      }
    }
  }
  return 0 // 如果两个版本号完全相同，返回 0
}

const getAppUpdateInfo = async () => {
  // let res = await getUntokenDicts("app_version");
  let res = await getAppLatestVersion()
  isLoading.value = false
  versionData.value = res
  versionData.value.downloadUrl = res.assets.find(i => i.name === 'app-mobile.apk')?.browser_download_url || null
  if (compareVersions(res.tag_name, appVersion.value) == 1) {
    //此时后台设置已有新版本
    showUpgrade.value = true
  } else {
    showButton.value = false
  }
}

const backInfo = async () => {
  return versionData.value
}

const closedPopup = () => {
  showUpgrade.value = false
}

onLoad(options => {
  status.value = uni.getStorageSync('remindTime').type ? [uni.getStorageSync('remindTime').type] : ['总是']
  url.value = decodeURIComponent(options.url)
})
</script>

<style lang="scss" scoped>
page {
  width: 100%;
  height: 100%;
}

.about-version {
  width: 100%;
  height: 100%;
  background: var(--app-bg);
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  .about-version-wrapper {
    padding-top: 250rpx;
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    box-sizing: border-box;
    flex: 1;
    overflow: hidden;
    .about-version-container {
      width: 100%;

      .about-version-container__main {
        display: flex;
        flex-direction: column;
        align-items: center;

        image {
          width: 240rpx;
          height: 240rpx;
          border-radius: 60rpx;
        }

        .main-name {
          margin-top: 40rpx;
          position: relative;

          span:first-child {
            font-weight: bold;
            font-size: 36rpx;
            color: var(--app-text-primary);
          }

          span:last-child {
            position: absolute;
            display: block;
            background: #cc1118;
            color: #fff;
            border-radius: 20rpx;
            padding: 4rpx 8rpx;
            font-size: 28rpx;
            top: -20rpx;
            right: 0;
            transform: translateX(100%);
          }
        }

        .main-time {
          font-size: 28rpx;
          margin-top: 20rpx;
        }
      }

      ::v-deep .nut-popover-wrapper {
        width: 100%;
      }

      ::v-deep .nut-cell {
        width: 100%;
        background: transparent;
        box-shadow: none;
        margin-top: 72rpx;

        .nut-cell__title {
          font-size: 32rpx;
          color: var(--app-text-primary);
        }

        .nut-cell__value {
          font-size: 32rpx;
          color: var(--app-text-primary);
        }

        .nut-cell__link {
          display: none;
        }
      }
    }

    .about-version-protocol {
      margin-top: 24rpx;
      display: flex;
      flex-direction: column;
      align-items: center;

      image {
        width: 526.5rpx;
        height: 178.5rpx;
      }

      .about-version-protocol__button {
        margin-top: 50rpx;
        font-weight: bold;
        font-size: 28rpx;
        color: #68c6b3;
      }
      .about-version-protocol__other {
        margin-top: 50rpx;
        font-size: 28rpx;
        color: #1e6efa;
      }

      // .about-version-protocol__tip{
      //   padding: 0 100rpx;
      //   margin-top: 24px;
      //   text-align: center;
      //   font-size: 24rpx;
      //   line-height: 35rpx;
      // }
    }

    .about-version-button {
      position: absolute;
      bottom: 50rpx;

      ::v-deep .nut-button {
        .nut-button__wrap {
          flex-direction: row-reverse;

          .nut-button__text {
            margin-left: 0;
          }

          .nut-icon {
            margin-left: 10rpx;
          }
        }
      }
    }
  }
}

// @media (prefers-color-scheme: dark) {
//   .about-version {
//     background: #1e1e20;

//     .about-version-container {
//       .about-version-container__main {
//         .main-name {
//           span:first-child {
//             color: #fff;
//           }
//         }
//       }

//       ::v-deep .nut-cell {
//         .nut-cell__title {
//           color: #fff;
//         }

//         .nut-cell__value {
//           color: #fff;
//         }
//       }
//     }
//   }
// }
</style>
