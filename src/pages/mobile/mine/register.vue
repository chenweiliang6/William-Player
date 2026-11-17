<template>
  <div :class="['register', themeClass]">
    <wil-navbar @getHeight="getHeight"></wil-navbar>
    <div class="register-container">
      <div class="register-title">
        <div class="register-title-top">
          <span>HI</span>
          <div>{{ t('auth.pleaseRegister') }}</div>
        </div>
        <div class="register-title-bottom">{{ t('auth.welcomeUseWilliamPlayer') }}</div>
      </div>
      <div class="register-form">
        <wil-form :options="settings" :show-button="false" ref="base_form" v-model="formData">
          <template #authCode="item">
            <div class="authcode">
              <input v-bind="item" v-model="formData.authCode" :maxlength="6" />
              <span class="authcode-button" :style="{ color: countDown < 61 ? 'rgba(204,204,204,1)' : 'rgb(255, 103, 1)' }" @click="toSendEmail">
                {{ countDown > 60 ? t('auth.sendVerificationCode') : t('auth.resendAfterSeconds', { seconds: countDown }) }}
              </span>
            </div>
          </template>
        </wil-form>
        <div class="register-form-button">
          <nut-button :custom-color="primaryBtnColor" @click="confirmCommit" v-if="userAgree"><span :style="{ color: primaryBtnTextColor }">{{ t('auth.registerAndLogin') }}</span></nut-button>
          <nut-button :custom-color="disabledBtnColor" v-else @click="clickNoAgree" class="no-agree"><span :style="{ color: disabledBtnTextColor }">{{ t('auth.registerAndLogin') }}</span></nut-button>
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
import { computed, onMounted, ref, watch } from 'vue'
import wilForm from '@/components/mobile/wil-form/index.vue'
import wilNavbar from '@/components/mobile/wil-navbar/index.vue'
import wilIcon from '@/components/common/wil-icon/index.vue'
import { registerUser, getWeUserByopenId, loginByPhone, sendEmail } from '@/network/apis'
import * as CONFIG from '@/utils/config'
import { encrypt } from '@/utils/jsencrypt.js'
import { getUserByopenId } from './common.js'
import { useThemeClass } from '@/hooks/useThemeClass'
import { useThemeColors } from '@/hooks/useThemeColors'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const codeEncrypt = ref('')
const themeClass = useThemeClass()
const { primaryBtnColor, primaryBtnTextColor, disabledBtnTextColor, isDark } = useThemeColors()
const disabledBtnColor = computed(() => (isDark.value ? '#3a3a3d' : '#C9CDD4'))
const navbarHeight = ref('')
const countDown = ref(61) //是否展示验证码倒计时,61为不展示
let timer = null
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
//校验验证码
const validatorCode = val => {
  return new Promise((resolve, reject) => {
    if (!val) {
      reject(t('auth.codeRequired'))
    }
    if (val.length < 6) {
      reject(t('auth.codeInvalidSixDigits'))
    }
    resolve()
  })
}
const settings = computed(() => [
  {
    label: t('auth.phoneNumber'),
    type: 'input',
    prop: 'phonenumber',
    formItemProps: { placeholder: t('auth.pleaseInputPhone'), type: 'number' },
    rule: [{ validator: validatorPhone }],
  },
  {
    label: t('auth.account'),
    type: 'input',
    prop: 'userName',
    formItemProps: { placeholder: t('auth.pleaseInputAccount'), type: 'text' },
    rule: [{ required: true, message: t('auth.pleaseInputAccount') }],
  },
  {
    label: t('auth.password'),
    type: 'input',
    prop: 'password',
    formItemProps: { placeholder: t('auth.pleaseInputPassword'), type: 'password' },
    rule: [{ required: true, message: t('auth.pleaseInputPassword') }],
  },
  {
    label: t('auth.email'),
    type: 'input',
    prop: 'email',
    formItemProps: { placeholder: t('auth.pleaseInputEmail'), type: 'text' },
    rule: [{ validator: validatorEmail }],
  },
  {
    label: t('auth.verificationCode'),
    prop: 'authCode',
    formItemProps: { placeholder: t('auth.pleaseInputCode'), type: 'number', maxlength: 6 },
    rule: [{ validator: validatorCode }],
  },
])

const base_form = ref(null)
const formData = ref({})
const userAgree = ref(false)

const checkAgree = () => {
  userAgree.value = !userAgree.value
}

const confirmCommit = async () => {
  base_form.value.confirmCommit().then(async valid => {
    if (valid) {
      try {
        let params = {
          nickName: formData.value.userName,
          phonenumber: formData.value.phonenumber,
          userName: formData.value.userName,
          password: encrypt(formData.value.password),
          email: formData.value.email,
          codeEncrypt: codeEncrypt.value,
          authCode: formData.value.authCode,
        }
        let res = await registerUser(params)
        uni.setStorageSync(CONFIG.OPEN_ID, res.openId)
        uni.setStorageSync('Authorization', res.accessToken)
        uni.setStorageSync('refreshToken', res.refreshToken)
        getUserByopenId()
        uni.reLaunch({
          url: '/pages/mobile/video/index',
        })
      } catch (error) {
        uni.showToast({
          title: error.msg,
          icon: 'none',
        })
      }
    }
  })
}

const getHeight = val => {
  navbarHeight.value = val
}

const clickNoAgree = () => {
  uni.showToast({
    title: t('auth.pleaseCheckAgreement'),
    icon: 'none',
    duration: 2000,
  })
}

//发送邮箱验证码
const toSendEmail = async () => {
  if (countDown.value < 61) return
  if (formData.value.email) {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
    if (!emailRegex.test(formData.value.email)) {
      uni.showToast({
        title: t('auth.emailInvalid'),
        icon: 'none',
      })
    } else {
      timer = setInterval(() => {
        countDown.value--
        if (countDown.value === -1) {
          countDown.value = 61
          clearInterval(timer)
          timer = null
        }
      }, 1000)
      let res = await sendEmail({ email: formData.value.email })
      codeEncrypt.value = res.codeEncrypt
    }
  } else {
    uni.showToast({
      title: t('auth.pleaseInputEmailFirst'),
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

.register {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  background: var(--app-gradient-mine);
  background-size: 100% 100%;

  &-title {
    font-weight: bold;
    color: var(--app-text-primary);
    margin-bottom: 64rpx;
    padding: 0 48rpx;

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

  .register-container {
    flex: 1;
    padding: 0 0 68rpx 0;
    padding-top: calc(150rpx - v-bind(navbarHeight));
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    overflow: hidden;

    .register-form {
      flex: 1;
      overflow: auto;
      padding: 0 48rpx;
      padding-bottom: 20rpx;

      :deep(.base-form) {
        padding: 48rpx 40rpx;
        background: var(--app-bg-card);
        border-radius: 30rpx;

        .nut-cell-group {
          .nut-cell-group__wrap {
            background: transparent;
            border-radius: 20rpx;
            margin-bottom: 0;

            .nut-form-item {
              padding: 28rpx;
              padding-right: 36rpx;
              border-radius: 20rpx !important;
              margin-bottom: 24rpx;
              align-items: center;

              &:last-child {
                margin-bottom: 0;
              }

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

                  .authcode {
                    display: flex;
                    align-items: center;

                    .authcode-button {
                      white-space: nowrap;
                      font-size: 14px;
                      color: rgb(255, 103, 1);
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

    .base-form-bottom {
      margin-top: 100rpx;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding-bottom: 0;

      .nut-button {
        width: 100%;
        height: 80rpx;
      }
    }
  }

  .register-form-button {
    margin-top: 100rpx;
    display: flex;
    flex-direction: column;
    align-items: center;

    .nut-button {
      width: 100%;
      height: 80rpx;
    }
  }

  .user-agreement {
    display: flex;
    width: 100%;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    bottom: 68rpx;
    left: 0;
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
        color: #4080ff;
      }

      span:nth-child(4) {
        color: #4080ff;
      }
    }
  }
}
</style>
