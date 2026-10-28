<template>
  <div :class="['add-wopan', themeClass]">
    <wil-navbar :title="t('source.unicomCloudDrive')"></wil-navbar>
    <div class="add-wopan__container">
      <wil-form v-model="state.formData" :options="formOptions" ref="base_form"></wil-form>
      <div v-if="state.needSmsCode" class="add-wopan__sms-tip">{{ t('source.wopanSmsTip') }}</div>
      <nut-button :custom-color="primaryBtnColor" :loading="state.loading" @click="confirmSubmit">
        <span :style="{ color: primaryBtnTextColor }">{{ t('source.accountLogin') }}</span>
      </nut-button>
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
import { wopanLogin } from '@/utils/wopan/login.js'
import { persistWopanToken } from '@/utils/wopan/store.js'

const { t } = useI18n()
const themeClass = useThemeClass()
const { primaryBtnColor, primaryBtnTextColor } = useThemeColors()

const state = reactive({
  formData: {},
  needSmsCode: false,
  loading: false,
})

const base_form = ref(null)
const routerParams = ref({})

const formOptions = computed(() => {
  const opts = [
    {
      label: t('source.wopanPhone'),
      prop: 'phone',
      type: 'input',
      formItemProps: { placeholder: t('source.wopanPhonePlaceholder'), type: 'text' },
      rule: [{ required: true, message: t('source.wopanPhonePlaceholder') }],
    },
    {
      label: t('source.password'),
      prop: 'password',
      type: 'input',
      formItemProps: { placeholder: t('source.wopanPasswordPlaceholder'), type: 'password' },
      rule: [{ required: true, message: t('source.pleaseInputPassword') }],
    },
  ]
  // 第一步 PcWebLogin 返回 needSmsCode=="1" 后，动态显示短信验证码输入框
  if (state.needSmsCode) {
    opts.push({
      label: t('source.wopanSmsCode'),
      prop: 'smsCode',
      type: 'input',
      formItemProps: { placeholder: t('source.wopanSmsCodePlaceholder'), type: 'number' },
      rule: [{ required: true, message: t('source.wopanSmsCodePlaceholder') }],
    })
  }
  return opts
})

// 登录成功后的统一跳转（对齐 add-cloud189）
const afterLoginSuccess = isNew => {
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
}

const doLogin = async () => {
  state.loading = true
  try {
    const { phone, password, smsCode } = state.formData
    const result = await wopanLogin(phone, password, state.needSmsCode ? smsCode : '')
    if (result.needSmsCode) {
      // 第一步完成：需要短信验证码，服务端已下发短信
      state.needSmsCode = true
      uni.showToast({ title: t('source.wopanSmsSent'), icon: 'none' })
      return
    }
    const { isNew } = persistWopanToken(
      { phone, accessToken: result.accessToken, refreshToken: result.refreshToken },
      routerParams.value
    )
    afterLoginSuccess(isNew)
  } catch (e) {
    uni.showToast({ title: e.message || t('source.loginFailed'), icon: 'none' })
  } finally {
    state.loading = false
  }
}

const confirmSubmit = () => {
  base_form.value.confirmCommit().then(async valid => {
    if (!valid) return
    await doLogin()
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

.add-wopan {
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

  &__sms-tip {
    margin-top: 20rpx;
    color: var(--app-text-secondary);
    font-size: 26rpx;
  }

  :deep(.nut-button) {
    margin-top: 80rpx;
  }
}
</style>
