<template>
  <div :class="['login', themeClass]">
    <div class="login-title">
      <div class="login-title-top">
        <span>HI</span>
        <div>{{ t('auth.pleaseLogin') }}</div>
      </div>
      <div class="login-title-bottom">{{ t('auth.welcomeUseWilliamPlayer') }}</div>
    </div>
    <div class="login-tabs">
      <nut-tabs v-model="tabValue" @change="changeTabs">
        <nut-tab-pane :title="t('auth.phoneLogin')" pane-key="1">
          <base-form :options="settings1" :show-button="false" ref="base_form1" v-model="formData1"></base-form>
          <div class="forget" @click="toForget">{{ t('auth.forgotPassword') }}</div>
        </nut-tab-pane>
        <nut-tab-pane :title="t('auth.emailLogin')" pane-key="2">
          <base-form :options="settings2" :show-button="false" ref="base_form2" v-model="formData2"></base-form>
          <div class="forget" @click="toForget">{{ t('auth.forgotPassword') }}</div>
        </nut-tab-pane>
      </nut-tabs>
    </div>
    <div class="login-button">
      <nut-button :custom-color="primaryBtnColor" @click="confirmCommit" v-if="userAgree" style="filter: invert(1) invert(1)">
        <span :style="{ color: primaryBtnTextColor }">{{ t('auth.login') }}</span>
      </nut-button>
      <nut-button :custom-color="disabledBtnColor" v-else @click="clickNoAgree" class="no-agree">
        <span :style="{ color: disabledBtnTextColor }">{{ t('auth.login') }}</span>
      </nut-button>
      <div class="register-button">
        <div @click="touristEnter">{{ t('auth.touristEnter') }}</div>
        <div class="register-button-line"></div>
        <div @click="toRegister">{{ t('auth.register') }}</div>
      </div>
    </div>
    <div class="login-other">
      <div class="login-other-way">
        <div class="login-other-way__title">{{ t('auth.otherLoginMethods') }}</div>
        <div class="login-other-way__list">
          <image
            src="https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/2f/dc/81/2fdc81e4-4c1d-1706-ce9d-ee4932e4dd97/AppIcon-0-0-1x_U007epad-0-1-0-sRGB-0-85-220.png/350x350.png"
            @click="loginWx"
          />
          <image src="https://q7.itc.cn/q_70/images03/20241111/8b6a53a12a58457d87ceea336014303d.jpeg" @click="loginAlipay" />
          <image src="https://appstoreimg-ipv6.vivo.com.cn/appstore/developer/icon/20211029/202110291634000wqez.webp" @click="loginQQ" />
        </div>
      </div>
      <div class="user-agreement" @click="checkAgree">
        <wil-icon name="kqxz" :custom-color="userAgree ? '#ff6701' : '#c8c9cc'" class="user-agreement-icon" />
        <div class="user-agreement-word">
          <span>{{ t('auth.readAndAgree') }}</span>
          <span>{{ t('auth.userAgreement') }}</span>
          <span>{{ t('auth.and') }}</span>
          <span>{{ t('auth.privacyPolicy') }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import baseForm from '@/components/mobile/wil-form/index.vue'
import wilIcon from '@/components/common/wil-icon/index.vue'
import { loginByPhone, loginByEmail, loginByWechat, loginByAlipay, loginByQQ, getWeUserByopenId } from '@/network/apis'
import { encrypt } from '@/utils/jsencrypt.js'
import * as CONFIG from '@/utils/config'
import { getUserByopenId } from './common.js'
import tabsLeft from '@/static/tabs-left.png'
import tabsRight from '@/static/tabs-right.png'
import { useThemeClass } from '@/hooks/useThemeClass'
import { useThemeColors } from '@/hooks/useThemeColors'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const tabValue = ref('1')
const themeClass = useThemeClass()
const { primaryBtnColor, primaryBtnTextColor, disabledBtnTextColor, isDark } = useThemeColors()
const disabledBtnColor = computed(() => (isDark.value ? '#3a3a3d' : '#C9CDD4'))

const tabBg = computed(() => {
  if (tabValue.value === '1') {
    return `url(${tabsLeft})`
  } else {
    return `url(${tabsRight})`
  }
})

//手机号校验
const validatorPhone = val => {
  return new Promise((resolve, reject) => {
    if (!val) {
      reject(t('auth.phoneRequired'))
    } else {
      const reg = /^1[3-9][0-9]\d{8}$/
      if (!reg.test(val)) {
        reject(t('auth.phoneInvalid'))
      } else {
        resolve()
      }
    }
  })
}
//校验邮箱
const validatorEmail = val => {
  return new Promise((resolve, reject) => {
    if (!val) {
      reject(t('auth.emailRequired'))
    } else {
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
      if (!emailRegex.test(val)) {
        reject(t('auth.emailInvalid'))
      } else {
        resolve()
      }
    }
  })
}
const settings1 = computed(() => [
  {
    label: t('auth.phoneNumber'),
    type: 'input',
    prop: 'phone',
    formItemProps: { placeholder: t('auth.pleaseInputPhone'), type: 'number', inputmode: 'numeric' },
    rule: [{ validator: validatorPhone }],
  },
  {
    label: t('auth.password'),
    type: 'input',
    prop: 'password',
    formItemProps: { placeholder: t('auth.pleaseInputPassword'), type: 'password' },
    rule: [{ required: true, message: t('auth.pleaseInputPassword') }],
  },
])
const settings2 = computed(() => [
  {
    label: t('auth.email'),
    type: 'input',
    prop: 'email',
    formItemProps: { placeholder: t('auth.pleaseInputEmail'), type: 'text', inputmode: 'numeric' },
    rule: [{ validator: validatorEmail }],
  },
  {
    label: t('auth.password'),
    type: 'input',
    prop: 'password',
    formItemProps: { placeholder: t('auth.pleaseInputPassword'), type: 'password' },
    rule: [{ required: true, message: t('auth.pleaseInputPassword') }],
  },
])

const base_form1 = ref(null)
const base_form2 = ref(null)
const formData1 = ref({})
const formData2 = ref({})
const userAgree = ref(false)

const checkAgree = () => {
  userAgree.value = !userAgree.value
}

const changeTabs = obj => {
  if (obj.paneKey === '1') {
    formData2.value = {}
    base_form2.value.formRef.reset()
  } else if (obj.paneKey === '2') {
    formData1.value = {}
    base_form1.value.formRef.reset()
  }
}

const confirmCommit = async () => {
  if (tabValue.value === '1') {
    base_form1.value.confirmCommit().then(async valid => {
      if (valid) {
        let res = await loginByPhone({ phone: formData1.value.phone, password: encrypt(formData1.value.password) })
        uni.setStorageSync(CONFIG.OPEN_ID, res.openId)
        uni.setStorageSync('Authorization', res.accessToken)
        uni.setStorageSync('refreshToken', res.refreshToken)
        getUserByopenId()
        uni.reLaunch({
          url: '/pages/mobile/video/index',
        })
      }
    })
  } else if (tabValue.value === '2') {
    base_form2.value.confirmCommit().then(async valid => {
      if (valid) {
        let res = await loginByEmail({ email: formData2.value.email, password: encrypt(formData2.value.password) })
        uni.setStorageSync(CONFIG.OPEN_ID, res.openId)
        uni.setStorageSync('Authorization', res.accessToken)
        uni.setStorageSync('refreshToken', res.refreshToken)
        getUserByopenId()
        uni.reLaunch({
          url: '/pages/mobile/video/index',
        })
      }
    })
  }
}

const touristEnter = async () => {
  await loginByPhone({ phone: '19994658532', password: encrypt('123456789') })
    .then(res => {
      uni.setStorageSync(CONFIG.OPEN_ID, res.openId)
      uni.setStorageSync('Authorization', res.accessToken)
      uni.setStorageSync('refreshToken', res.refreshToken)
      getUserByopenId()
      uni.reLaunch({
        url: '/pages/mobile/video/index',
      })
    })
    .catch(error => {
      uni.reLaunch({
        url: '/pages/mobile/video/index',
      })
      let settingData = uni.getStorageSync('settingData')
      if (settingData) {
        settingData.tmdbKey = '9e0add7c02b66868ab0a368df820a335'
        uni.setStorageSync('settingData', settingData)
      } else {
        uni.setStorageSync('settingData', { tmdbKey: res.data.wuser.tmdbKey, showProgress: true, playercodec: 'exoplayer', showRecommend: true })
      }
    })
}

const toForget = () => {
  uni.navigateTo({
    url: '/pages/mobile/mine/forget',
  })
}

const toRegister = () => {
  uni.navigateTo({
    url: '/pages/mobile/mine/register',
  })
}

const clickNoAgree = () => {
  uni.showToast({
    title: t('auth.pleaseCheckAgreement'),
    icon: 'none',
    duration: 2000,
  })
}

//使用微信登录
const loginWx = () => {
  uni.login({
    provider: 'weixin',
    onlyAuthorize: true,
    success: async loginRes => {
      let result = await loginByWechat({ code: loginRes.code })
      uni.setStorageSync(CONFIG.OPEN_ID, result.openId)
      uni.setStorageSync('Authorization', result.accessToken)
      uni.setStorageSync('refreshToken', result.refreshToken)
      getUserByopenId()
      uni.reLaunch({
        url: '/pages/mobile/video/index',
      })
    },
  })
}

//使用支付宝快捷登录
const loginAlipay = () => {
  const Alipay = uni.requireNativePlugin('AlipayModule')
  Alipay.openAuthScheme(
    {
      appId: '2021006126672664',
      scheme: 'WilliamPlayer',
    },
    res => {
      loginByAlipay({ alipayCode: res.auth_code }).then(result => {
        uni.setStorageSync(CONFIG.OPEN_ID, result.openId)
        uni.setStorageSync('Authorization', result.accessToken)
        uni.setStorageSync('refreshToken', result.refreshToken)
        getUserByopenId()
        uni.reLaunch({
          url: '/pages/mobile/video/index',
        })
      })
    }
  )
}
//使用QQ快捷登录
const loginQQ = () => {
  uni.login({
    provider: 'qq',
    success: loginRes => {
      uni.getUserInfo({
        provider: 'qq',
        success: async res => {
          let result = await loginByQQ({ qqId: res.userInfo.openId })
          uni.setStorageSync(CONFIG.OPEN_ID, result.openId)
          uni.setStorageSync('Authorization', result.accessToken)
          uni.setStorageSync('refreshToken', result.refreshToken)
          getUserByopenId()
          uni.reLaunch({
            url: '/pages/mobile/video/index',
          })
        },
      })
    },
  })
}
</script>

<style lang="scss" scoped>
page {
  width: 100%;
  height: 100%;
}

.login {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  background: var(--app-gradient-mine);
  background-size: 100% 100%;
  padding: 150rpx 48rpx 68rpx 48rpx;
  position: relative;

  &-title {
    font-weight: bold;
    color: var(--app-text-primary);
    margin-bottom: 64rpx;

    &-top {
      display: flex;
      align-items: center;

      span {
        font-size: 72rpx;
        color: #fff;
      }

      div {
        width: 160rpx;
        height: 80rpx;
        background: url('@/static/zk-qp.png') center no-repeat;
        background-size: 100% 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 32rpx;
        color: #fff;
        padding-left: 14rpx;
      }
    }

    &-bottom {
      font-size: 48rpx;
      color: #ffffff;
      margin-top: 18rpx;
    }
  }

  &-tabs {
    :deep(.nut-tabs) {
      .nut-tabs__titles {
        background: v-bind(tabBg) center no-repeat;
        background-size: 100% 100%;
      }

      .nut-tabs__content {
        background: transparent;

        .nut-tab-pane {
          background: var(--app-bg-card);
          border-radius: 0 0 30rpx 30rpx;
          padding: 48rpx 40rpx;
          padding-bottom: 32rpx;

          .base-form {
            background: transparent;
            padding: 0;

            .nut-cell-group {
              .nut-cell-group__wrap {
                background: transparent;
                border-radius: 20rpx;

                .nut-form-item {
                  padding: 28rpx;
                  padding-right: 36rpx;
                  border-radius: 20rpx !important;
                  margin-bottom: 24rpx;
                  align-items: center;

                  &__label {
                    min-width: 160rpx;

                    &::before {
                      display: none;
                    }
                  }

                  &__body {
                    &__slots {
                      .nut-input {
                        &-value {
                          .nut-input-inner {
                            .nut-input-right-box {
                              img {
                                height: 50rpx;
                                width: 150rpx;
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }

              .remember-password {
                display: flex;
                align-items: center;
                justify-content: flex-start;

                span {
                  color: var(--app-text-secondary);
                  font-size: 28rpx;
                  padding-left: 20rpx;
                }
              }
            }
          }
        }

        .forget {
          font-size: 26rpx;
          color: #1492ff;
          text-align: right;
        }
      }
    }
  }

  &-button {
    margin-top: 50rpx;
    display: flex;
    flex-direction: column;
    align-items: center;

    .register-button {
      font-size: 28rpx;
      color: #1492ff;
      display: inline;
      margin-top: 30rpx;
      display: flex;
      align-items: center;

      .register-button-line {
        width: 2rpx;
        height: 34rpx;
        margin: 0 24rpx;
        background: #1492ff;
      }
    }

    .nut-button {
      width: 100%;
      height: 80rpx;
    }
  }
  &-other {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    position: absolute;
    bottom: 68rpx;
    left: 0;
    &-way {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 100%;
      margin-bottom: 36rpx;
      .login-other-way__title {
        color: var(--app-text-tertiary);
        font-size: 22rpx;
        margin-bottom: 24rpx;
      }
      .login-other-way__list {
        display: flex;
        align-items: center;
        image {
          display: block;
          width: 70rpx;
          height: 70rpx;
          border-radius: 50%;
          cursor: pointer;
          margin-left: 24rpx;
          &:first-child {
            margin-left: 0;
          }
        }
      }
    }

    .user-agreement {
      display: flex;
      width: 100%;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;

      .user-agreement-icon {
        font-size: 28rpx;
        display: block;
      }

      &-word {
        padding-left: 4rpx;
        display: flex;
        align-items: center;

        span {
          display: inline;
          color: var(--app-text-tertiary);
          font-size: 26rpx;
        }

        span:nth-child(2) {
          color: #1492ff;
        }

        span:nth-child(4) {
          color: #1492ff;
        }
      }
    }
  }
}
</style>
