<template>
  <div :class="['mine', themeClass]">
    <wil-navbar :title="t('navbar.mine')" :leftShow="false" :rightShow="true">
      <template #right>
        <nut-icon name="scan" custom-color="#ff6701" size="16" @click="openUrl"></nut-icon>
      </template>
    </wil-navbar>
    <div class="mine-container">
      <div class="mine-notLog" v-if="!isLogin">
        <div class="mine-notLog__left">
          <wil-image
            backgroundColor="var(--app-bg-secondary)"
            src="https://storage.7x24cc.com/storage-server/presigned/ss1/a6-online-fileupload/newMediaImage/2AFA742_427A_user-avatar_20241225150546694newMediaImage.png"
          ></wil-image>
          <div class="mine-notLog__left-info">
            <span>{{ t('mine.touristUser') }}</span>
            <span>{{ t('mine.touristDescription') }}</span>
          </div>
        </div>
        <nut-button custom-color="#ff6701" class="mine-notLog__right" @click="toLogin">{{ t('mine.goLogin') }}</nut-button>
      </div>
      <div class="mine-loged" v-else>
        <div class="mine-loged__left">
          <div class="left-img" @click="enterUserInfo">
            <wil-image
              backgroundColor="var(--app-bg-secondary)"
              :src="
                userInfo.avatar ||
                'https://storage.7x24cc.com/storage-server/presigned/ss1/a6-online-fileupload/newMediaImage/2AFA742_427A_user-avatar_20241225150546694newMediaImage.png'
              "
            ></wil-image>
          </div>
          <div class="left-info">
            <div class="left-info-name">
              <span>{{ userInfo.name }}</span>
            </div>
            <div class="left-info-phone">{{ userInfo.phonenumber }}</div>
          </div>
        </div>
        <nut-button custom-color="#ff6701" class="mine-loged__right" @click="enterUserInfo">{{ t('mine.personalCenter') }}</nut-button>
      </div>
      <div class="mine-cell">
        <wil-cell :options="item" v-for="(item, index) in cellOptions" :key="index" @click-item="clickCell" @toLogin="openLoginPopup"></wil-cell>
        <wil-cell
          :options="[{ title: t('mine.logout'), key: 'logout', leftIcon: logOut }]"
          @click-item="clickCell"
          v-if="Authorization && userInfo.phonenumber != '19994658532'"
        ></wil-cell>
      </div>
    </div>
    <wil-modal ref="wil_modal"></wil-modal>
    <share-dialog v-model:visible="showShareModal" :shareUrl="shareUrl"></share-dialog>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import wilCell from '@/components/mobile/wil-cell/index.vue'
import shareDialog from '../video/components/index-component/share-dialog.vue'
import wilNavbar from '@/components/mobile/wil-navbar/index.vue'
import userImg from '@/static/user-img.png'
import * as CONFIG from '@/utils/config'
import logOut from '@/static/log-out.png'
import iconMedia from '@/static/icon-media.png'
import iconTb from '@/static/icon-tb.png'
import iconMulu from '@/static/icon-mulu.png'
import iconDeepseek from '@/static/icon-deepseek.png'
import iconToolbox from '@/static/icon-toolbox.png'
import iconFeedback from '@/static/icon-feedback.png'
import iconGift from '@/static/icon-gift.png'
import iconSetting from '@/static/icon-setting.png'
import iconAbout from '@/static/icon-about.png'
import { onShow } from '@dcloudio/uni-app'
import { toParse, toStringfy } from './common'
import { getCutContent } from '@/utils/common'
import showModal from '@/components/mobile/wil-modal/modal.js'
import wilModal from '@/components/mobile/wil-modal/index.vue'
import wilImage from '@/components/mobile/wil-image/index.vue'
import { setShareData, doLogout } from '@/network/apis'
import { useThemeClass } from '@/hooks/useThemeClass'
import { useThemeTabbar } from '@/hooks/useThemeTabbar'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
console.log(t('navbar.dataSync'), 'tttttttt')

const themeClass = useThemeClass()
useThemeTabbar()
const userInfo = ref(uni.getStorageSync(CONFIG.USER_KEY))
const Authorization = ref(uni.getStorageSync('Authorization'))
const isLogin = ref(false)

const name = ref('')

const showLoginPopup = ref(false)
const wil_modal = ref(null)
const showShareModal = ref(false)
const shareUrl = ref('')

// #ifdef APP-PLUS
let TcpModule = uni.requireNativePlugin('TcpModule')
// #endif

const cellOptions = computed(() => [
  [
    {
      key: 'mediaLibraryList',
      title: t('navbar.mediaLibraryList'),
      leftIcon: iconMedia,
      path: '/pages/mobile/media/list',
    },
    {
      // 资源库已成为底部 tabBar 页，入口走 switchTab（tabBar 页不能用 navigateTo）
      key: 'resourceLibrary',
      title: t('navbar.resourceLibrary'),
      leftIcon: iconMedia,
    },
    {
      key: 'dataSync',
      title: t('navbar.dataSync'),
      leftIcon: iconTb,
      path: '/pages/mobile/backend/data-sync',
      tip: t('common.comingSoon'),
    },
    {
      key: 'catelogSetting',
      title: t('navbar.catelogSetting'),
      leftIcon: iconMulu,
      path: '/pages/mobile/media/catelog-setting',
      tip: t('common.comingSoon'),
    },
    {
      key: 'toolbox',
      title: t('navbar.toolbox'),
      leftIcon: iconToolbox,
      path: '/pages/mobile/toolbox/index',
    },
  ],
  [
    {
      key: 'feedback',
      title: t('navbar.feedback'),
      leftIcon: iconFeedback,
      path: '/pages/mobile/backend/index',
      query: {
        url: CONFIG.BASE_URL.split(':4040')[0] + ':8443/app-webview/#/question',
        title: t('navbar.feedback'),
      },
    },
    {
      key: 'appreciate',
      title: t('navbar.appreciate'),
      leftIcon: iconGift,
      path: '/pages/mobile/backend/appreciate',
    },
    {
      key: 'settings',
      title: t('navbar.settings'),
      leftIcon: iconSetting,
      path: '/pages/mobile/mine/settings',
    },
    {
      key: 'about',
      title: t('navbar.about'),
      leftIcon: iconAbout,
      path: '/pages/mobile/backend/about-version',
    },
  ],
])

const openUrl = () => {
  uni.scanCode({
    success: async res => {
      if (res.result.startsWith('http://') || res.result.startsWith('https://')) {
        uni.navigateTo({
          url: `/pages/mobile/backend/index?url=${res.result}`,
        })
      } else {
        let result = JSON.parse(res.result)
        if (result.type == 'dataSync') {
          let obj = {
            userInfo: {
              userKey: uni.getStorageSync(CONFIG.USER_KEY),
              userId: uni.getStorageSync(CONFIG.USER_ID),
              Authorization: uni.getStorageSync('Authorization'),
              refreshToken: uni.getStorageSync('refreshToken'),
            },
            muluData: uni.getStorageSync('muluData') || {},
            sourceList: uni.getStorageSync('sourceList'),
            historyPlay: uni.getStorageSync('historyPlay'),
          }
          if (init) {
            uni.showToast({
              title: t('common.startConnect'),
              icon: 'none',
            })
            TcpModule.connectAsClient(result.port.split(':')[0], 1025, res => {
              uni.showToast({
                title: res,
                icon: 'none',
              })
              let result = JSON.parse(res)
              if (result.code == 500) {
                setShareData({ port: result.port.split(':')[1], data: obj }).then(() => {
                  uni.showToast({
                    title: t('common.syncSuccess'),
                    icon: 'none',
                  })
                })
              } else {
                init = false
                TcpModule.send(JSON.stringify(obj), res1 => {
                  let res2 = JSON.parse(res1)
                  if (res2.code == 500) {
                    uni.showToast({
                      title: t('common.syncFailedRescan'),
                      icon: 'none',
                    })
                  } else {
                    uni.showToast({
                      title: t('common.syncSuccess'),
                      icon: 'none',
                    })
                  }
                })
              }
            })
          } else {
            TcpModule.send(JSON.stringify(obj), res1 => {
              let res2 = JSON.parse(res1)
              if (res2.code == 500) {
                uni.showToast({
                  title: t('common.syncFailedRescan'),
                  icon: 'none',
                })
              } else {
                uni.showToast({
                  title: t('common.syncSuccess'),
                  icon: 'none',
                })
              }
            })
          }
        } else {
          uni.showToast({
            title: t('common.invalidQrCode'),
            icon: 'none',
          })
        }
      }
    },
  })
}

//进入个人资料页，进行编辑个人信息
const enterUserInfo = () => {
  uni.navigateTo({
    url: '/pages/mobile/mine/userInfo/index',
  })
}

//退出登录
const toLogout = () => {
  wil_modal.value.showModal({
    title: t('modal.warmTip'),
    content: t('modal.defaultLogoutContent'),
    confirmColor: '#ff6701',
    confirm: async () => {
      uni.removeStorageSync(CONFIG.USER_ID)
      uni.removeStorageSync(CONFIG.OPEN_ID)
      uni.removeStorageSync(CONFIG.USER_KEY)
      uni.removeStorageSync('refreshToken')
      doLogout()
      uni.removeStorageSync('Authorization')
      uni.reLaunch({
        url: '/pages/mobile/mine/login',
      })
    },
  })
}

//判断是否为登录状态
const judgeLogin = () => {
  userInfo.value = uni.getStorageSync(CONFIG.USER_KEY)
  Authorization.value = uni.getStorageSync('Authorization')
  if (Authorization.value) {
    isLogin.value = userInfo.value.phonenumber == '19994658532' ? false : true
  } else {
    isLogin.value = false
  }
}

const clickCell = item => {
  if (item.key === 'logout') {
    toLogout()
  }
  if (item.key === 'resourceLibrary') {
    // 资源库是 tabBar 页，必须用 switchTab
    uni.switchTab({ url: '/pages/mobile/source/source-list' })
    return
  }
  if (item.tip) {
    uni.showToast({
      title: item.tip,
      icon: 'none',
    })
  }
  if (item.outside) {
    plus.runtime.openURL(item.outsideUrl, error => {
      if (error) {
        uni.showToast({ title: t('common.openBrowserFailed'), icon: 'none' })
      }
    })
  }
}

const toLogin = () => {
  uni.removeStorageSync(CONFIG.USER_ID)
  uni.removeStorageSync(CONFIG.OPEN_ID)
  uni.removeStorageSync(CONFIG.USER_KEY)
  uni.removeStorageSync('Authorization')
  uni.reLaunch({
    url: '/pages/mobile/mine/login',
  })
}

const openLoginPopup = item => {
  const whiteListKeys = ['backendManagement', 'wallpaper']
  if (whiteListKeys.includes(item.key)) {
    uni.navigateTo({
      url: item.path + '?' + toStringfy(item.query),
    })
    return
  }
  showLoginPopup.value = true
}

onShow(async () => {
  judgeLogin()
  let shareUrl1 = await getCutContent()
  if (shareUrl1) {
    shareUrl.value = shareUrl1
    showShareModal.value = true
  }
})
</script>

<style lang="scss">
page {
  width: 100%;
  height: 100%;
}

.mine {
  width: 100%;
  height: 100%;
  background: var(--app-gradient-mine);
  display: flex;
  flex-direction: column;
  position: relative;
  box-sizing: border-box;

  ::v-deep .wil-navbar {
    .nut-navbar {
      .nut-navbar__right {
        position: absolute;
        right: 0;
      }
    }
  }

  &-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 0 24rpx;
    overflow: auto;
  }

  .mine-notLog {
    padding: 24rpx 30rpx 24rpx 24rpx;
    background-color: var(--app-bg-card);
    border-radius: 16rpx;
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 0;

    .mine-notLog__left {
      display: flex;
      align-items: center;

      ::v-deep .wil-image {
        width: 136rpx;
        height: 136rpx;
        flex: 0 0 136rpx;
        border-radius: 50%;
      }

      .mine-notLog__left-info {
        padding-left: 24rpx;

        span:first-child {
          display: block;
          font-size: 32rpx;
          color: var(--app-text-primary);
          font-weight: bold;
        }

        span:last-child {
          display: block;
          font-size: 24rpx;
          color: var(--app-text-tertiary);
          padding-top: 10rpx;
        }
      }
    }

    &__right {
      height: 32px;
    }
  }

  &-loged {
    padding: 24rpx 44rpx 24rpx 24rpx;
    background-color: var(--app-bg-card);
    border-radius: 16rpx;
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 0;

    &__left {
      display: flex;
      align-items: center;

      .left-img {
        width: 136rpx;
        height: 136rpx;

        ::v-deep .wil-image {
          border-radius: 50%;
          width: 100%;
          height: 100%;
        }
      }

      .left-info {
        padding-left: 24rpx;

        .left-info-name {
          font-weight: bold;
          font-size: 32rpx;
          color: var(--app-text-primary);
          display: flex;
          align-items: center;

          .auth-status {
            padding: 8rpx 20rpx;
            font-size: 26rpx;
            border-radius: 8rpx;
            font-weight: 400;
            margin-left: 20rpx;
          }

          .noAuth {
            border: 2rpx solid #ff3838;
            color: #ff3838;
          }

          .isAuth {
            border: 2rpx solid #ff6701;
            color: #ff6701;
          }
        }

        .left-info-phone {
          font-size: 28rpx;
          color: var(--app-text-placeholder);
          margin-top: 6rpx;
        }
      }
    }

    &__right {
      height: 32px;
    }
  }
  .mine-cell {
    :deep(.wil-cell) {
      margin-top: 24rpx;
    }
  }
}
</style>
