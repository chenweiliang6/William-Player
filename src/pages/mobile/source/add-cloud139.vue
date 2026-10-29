<template>
  <div :class="['add-cloud139', themeClass]">
    <wil-navbar :title="t('source.cloud139Label')"></wil-navbar>
    <div class="add-cloud139__container">
      <wil-form v-model="state.formData" :options="formOptions" ref="base_form"></wil-form>
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
import { login139 } from '@/utils/cloud139/login.js'
import { persist139Token, save139Password } from '@/utils/cloud139/store.js'

const { t } = useI18n()
const themeClass = useThemeClass()
const { primaryBtnColor, primaryBtnTextColor } = useThemeColors()

const state = reactive({
  formData: {},
  loading: false,
})

const base_form = ref(null)
const routerParams = ref({})

const formOptions = computed(() => [
  {
    label: t('source.cloud139Phone'),
    prop: 'phone',
    type: 'input',
    formItemProps: { placeholder: t('source.cloud139PhonePlaceholder'), type: 'text' },
    rule: [{ required: true, message: t('source.cloud139PhonePlaceholder') }],
  },
  {
    label: t('source.password'),
    prop: 'password',
    type: 'input',
    formItemProps: { placeholder: t('source.cloud139PasswordPlaceholder'), type: 'password' },
    rule: [{ required: true, message: t('source.pleaseInputPassword') }],
  },
])

// 登录成功后的统一跳转（对齐 add-wopan）
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
    const { phone, password } = state.formData
    const result = await login139(phone, password)
    save139Password(phone, phone, password)
    const { isNew } = persist139Token(
      { phone, authorization: result.authorization, account: result.account },
      routerParams.value
    )
    afterLoginSuccess(isNew)
  } catch (e) {
    // 风控/账密错误映射为专用提示，其余按 message 兜底
    let title = e.message || t('source.loginFailed')
    if (e.code == 'CLOUD139_RISK_CONTROL') title = t('source.cloud139RiskControl')
    if (e.code == 'CLOUD139_AUTH_FAILED') title = t('source.cloud139AuthFailed')
    uni.showToast({ title, icon: 'none' })
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

.add-cloud139 {
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

  :deep(.nut-button) {
    margin-top: 80rpx;
  }
}
</style>
