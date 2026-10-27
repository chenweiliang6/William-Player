<template>
  <div :class="['forget', themeClass]">
    <wil-navbar @getHeight="getHeight"></wil-navbar>
    <div class="forget-title">
      <div class="forget-title-top">
        <span>HI</span>
        <div>{{ t('auth.modifyPassword') }}</div>
      </div>
      <div class="forget-title-bottom">{{ t('auth.welcomeUseWilliamPlayer') }}</div>
    </div>
    <div class="forget-form">
      <base-form :options="settings" ref="base_form" v-model="formData">
        <template #authCode="item">
          <div class="authcode">
            <input v-bind="item" v-model="formData.authCode" :maxlength="6" />
            <span class="authcode-button" :style="{ color: countDown < 61 ? 'rgba(204,204,204,1)' : 'rgb(255, 103, 1)' }" @click="toSendEmail">
              {{ countDown > 60 ? t('auth.sendVerificationCode') : t('auth.resendAfterSeconds', { seconds: countDown }) }}
            </span>
          </div>
        </template>
      </base-form>
    </div>
    <div class="forget-button">
      <nut-button :custom-color="primaryBtnColor" @click="confirmEdit"><span :style="{ color: primaryBtnTextColor }">{{ t('auth.confirmModify') }}</span></nut-button>
    </div>
  </div>
</template>

<script setup>
import baseForm from '@/components/mobile/wil-form/index.vue'
import wilNavbar from '@/components/mobile/wil-navbar/index.vue'
import { computed, ref } from 'vue'
import { sendEmail, editPwd } from '@/network/apis'
import { useThemeClass } from '@/hooks/useThemeClass'
import { useThemeColors } from '@/hooks/useThemeColors'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const { primaryBtnColor, primaryBtnTextColor } = useThemeColors()
const navbarHeight = ref('')
const countDown = ref(61) //是否展示验证码倒计时,61为不展示
const themeClass = useThemeClass()
const codeEncrypt = ref('')
let timer = null
const formData = ref({})
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
const settings = computed(() => [
  {
    label: t('auth.phoneNumber'),
    type: 'input',
    prop: 'phone',
    formItemProps: { placeholder: t('auth.pleaseInputPhone'), type: 'number', inputmode: 'numeric' },
    rule: [{ validator: validatorPhone }],
  },
  {
    label: t('auth.email'),
    type: 'input',
    prop: 'email',
    formItemProps: { placeholder: t('auth.pleaseInputEmail'), type: 'text' },
    rule: [{ validator: validatorEmail }],
  },
  {
    label: t('auth.newPassword'),
    type: 'input',
    prop: 'password',
    formItemProps: { placeholder: t('auth.pleaseInputNewPassword'), type: 'password' },
    rule: [{ required: true, message: t('auth.pleaseInputNewPassword') }],
  },
  {
    label: t('auth.verificationCode'),
    prop: 'authCode',
    formItemProps: { placeholder: t('auth.pleaseInputCode'), type: 'number' },
    rule: [{ required: true, message: t('auth.pleaseInputCode') }],
  },
])

const getHeight = val => {
  navbarHeight.value = val
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
      let res = await sendEmail({ email: formData.value.email, type: 'editPwd' })
      timer = setInterval(() => {
        countDown.value--
        if (countDown.value === -1) {
          countDown.value = 61
          clearInterval(timer)
          timer = null
        }
      }, 1000)
      codeEncrypt.value = res.codeEncrypt
    }
  } else {
    uni.showToast({
      title: t('auth.pleaseInputEmailFirst'),
      icon: 'none',
    })
  }
}

const confirmEdit = async () => {
  if (formData.value.authCode) formData.value.authCode = encrypt(formData.value.authCode)
  await editPwd(formData.value)
  uni.navigateBack()
}
</script>

<style lang="scss" scoped>
page {
  width: 100%;
  height: 100%;
}

.forget {
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
    padding-top: calc(150rpx - v-bind(navbarHeight));

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
        font-size: 28rpx;
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

  &-form {
    padding: 0 48rpx;

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
  &-button {
    margin-top: 100rpx;
    padding: 0 48rpx;
    padding-bottom: 68rpx;

    :deep(.nut-button) {
      width: 100%;
      height: 80rpx;
    }
  }
}
</style>
