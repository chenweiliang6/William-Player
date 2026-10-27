<template>
  <div :class="['add-cloud189', themeClass]">
    <wil-navbar :title="t('navbar.tianyiCloudDrive')"></wil-navbar>
    <div class="add-cloud189__container">
      <wil-form v-model="state.formData" :options="formOptions" ref="base_form">
        <template #captcha>
          <div class="captcha-slot">
            <image v-if="state.captchaImage" class="captcha-slot__img" :src="state.captchaImage" mode="aspectFit" @click="refreshCaptcha"></image>
            <div v-else class="captcha-slot__loading">{{ t('source.captchaLoading') }}</div>
            <div class="captcha-slot__refresh" @click="refreshCaptcha">{{ t('source.refreshCaptcha') }}</div>
          </div>
        </template>
      </wil-form>
      <nut-button :custom-color="primaryBtnColor" :loading="state.loading" @click="confirmSubmit">
        <span :style="{ color: primaryBtnTextColor }">{{ t('source.accountLogin') }}</span>
      </nut-button>
      <div class="add-cloud189__fallback" @click="goWebview">{{ t('source.webLoginFallback') }}</div>
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import wilForm from '@/components/mobile/wil-form/index.vue'
import wilNavbar from '@/components/mobile/wil-navbar/index.vue'
import { onLoad } from '@dcloudio/uni-app'
import { useThemeClass } from '@/hooks/useThemeClass'
import { useThemeColors } from '@/hooks/useThemeColors'
import { useI18n } from 'vue-i18n'
import { initLoginParam, login189 } from '@/utils/cloud189/login.js'
import { persist189Token, save189Password } from '@/utils/cloud189/store.js'

const { t } = useI18n()
const themeClass = useThemeClass()
const { primaryBtnColor, primaryBtnTextColor } = useThemeColors()

const state = reactive({
  formData: {},
  loginParam: null,
  captchaImage: '',
  needCaptcha: false,
  loading: false,
})

const base_form = ref(null)
const routerParams = ref({})

const formOptions = computed(() => {
  const opts = [
    {
      label: t('source.username'),
      prop: 'username',
      type: 'input',
      formItemProps: { placeholder: t('source.accountPlaceholder'), type: 'text' },
      rule: [{ required: true, message: t('source.pleaseInputUsername') }],
    },
    {
      label: t('source.password'),
      prop: 'password',
      type: 'input',
      formItemProps: { placeholder: t('source.tianyiPasswordPlaceholder'), type: 'password' },
      rule: [{ required: true, message: t('source.pleaseInputPassword') }],
    },
  ]
  if (state.needCaptcha) {
    opts.push({
      label: t('source.captchaLabel'),
      prop: 'captcha',
      type: 'input',
      formItemProps: { placeholder: t('source.captchaPlaceholder'), type: 'text' },
      rule: [{ required: true, message: t('source.captchaPlaceholder') }],
    })
  }
  return opts
})

// 拉起登录参数（含验证码图片）
const prepareLogin = async () => {
  const { username, password } = state.formData
  state.loading = true
  try {
    const param = await initLoginParam(username, password)
    state.loginParam = param
    state.needCaptcha = !!param.needCaptcha
    state.captchaImage = param.captchaImage || ''
    if (!state.needCaptcha) {
      await doLogin('')
    }
  } catch (e) {
    uni.showToast({ title: e.message || t('source.loginFailed'), icon: 'none' })
  } finally {
    state.loading = false
  }
}

const doLogin = async validateCode => {
  state.loading = true
  try {
    const tokenInfo = await login189({ validateCode })
    const { isNew } = persist189Token(tokenInfo, routerParams.value)
    save189Password(tokenInfo.loginName, state.formData.username, state.formData.password)
    uni.showToast({ title: isNew ? t('source.addAccountSuccess') : t('source.modifyAccountSuccess'), icon: 'none' })
    if (isNew) {
      setTimeout(() => {
        uni.navigateTo({ url: '/pages/mobile/media/catelog-setting' })
      }, 1800)
    } else {
      setTimeout(() => {
        uni.navigateBack({ delta: 2 })
      }, 1500)
    }
  } catch (e) {
    uni.showToast({ title: e.message || t('source.loginFailed'), icon: 'none' })
    // 登录失败刷新登录参数（对齐 AlistGo：销毁并重新初始化以刷新验证码）
    if (state.needCaptcha) {
      try {
        const param = await initLoginParam(state.formData.username, state.formData.password)
        state.loginParam = param
        state.captchaImage = param.captchaImage || ''
        state.formData.captcha = ''
      } catch (e2) {
        // 静默：保留旧验证码
      }
    }
  } finally {
    state.loading = false
  }
}

const confirmSubmit = () => {
  base_form.value.confirmCommit().then(async valid => {
    if (!valid) return
    if (state.needCaptcha) {
      await doLogin(state.formData.captcha || '')
    } else {
      await prepareLogin()
    }
  })
}

const refreshCaptcha = () => {
  if (!state.formData.username || !state.formData.password) {
    uni.showToast({ title: t('source.pleaseInputUsernameAndPassword'), icon: 'none' })
    return
  }
  prepareLogin()
}

const goWebview = () => {
  uni.navigateTo({
    url: `/pages/mobile/backend/cloud189-webview?url=${encodeURIComponent('https://cloud.189.cn')}`,
  })
}

onLoad(options => {
  routerParams.value = options
})
</script>

<style lang="scss" scoped>
page {
  width: 100%;
  height: 100%;
}

.add-cloud189 {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  background: var(--app-gradient-mine);
  background-size: 100% 100%;
  box-sizing: border-box;

  &__container {
    padding: 0 24rpx;
    padding-top: 24rpx;
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow: auto;
  }

  &__fallback {
    margin-top: 40rpx;
    text-align: center;
    color: var(--app-text-secondary);
    font-size: 26rpx;
    padding: 20rpx;
  }

  :deep(.nut-button) {
    margin-top: 80rpx;
  }
}

.captcha-slot {
  display: flex;
  align-items: center;

  &__img {
    width: 200rpx;
    height: 80rpx;
  }

  &__loading {
    color: var(--app-text-secondary);
    font-size: 26rpx;
  }

  &__refresh {
    margin-left: 24rpx;
    color: var(--app-primary);
    font-size: 26rpx;
  }
}
</style>
