<template>
  <div :class="['tmdb-key', themeClass]">
    <!-- <div class="tmdb-key-title">请输入要修改的tmdbKey</div>
<nut-input v-model="settingData.tmdbKey" placeholder="请输入tmdbKey" @blur="inputTmdb" class="tmdb-key-input"></nut-input> -->
    <div class="tmdb-key-title">{{ t('settings.playSettings') }}</div>
    <wil-form :options="settings1" :show-button="true" ref="base_form1" v-model="formData" :showButton="false">
      <template #showProgress>
        <nut-switch v-model="settingData.showProgress" active-color="#ff6701" @change="val => changeSwitch(val, 'showProgress')" />
      </template>
      <template #zoomMode>
        <nut-cell :title="t('settings.zoomMode')" is-link :desc="zoomModeText" @click="showZoomPopover = true">
          <template #icon>
            <nut-icon name="image"></nut-icon>
          </template>
        </nut-cell>
      </template>
      <!-- <template #playercodec>
        <nut-radio-group v-model="settingData.playercodec" direction="horizontal" @change="(val)=>changeSwitch(val,'解码器')">
          <nut-radio label="exoplayer">ExoPlayer</nut-radio>
          <nut-radio label="ijkplayer">IjkPlayer</nut-radio>
        </nut-radio-group>
      </template> -->
    </wil-form>
    <div class="tmdb-key-title">{{ t('settings.playCache') }}</div>
    <wil-form :options="cacheSettings" :show-button="true" ref="base_form3" v-model="formData" :showButton="false">
      <template #cacheSize>
        <nut-cell :title="t('settings.cacheSize')" is-link :desc="cacheSizeText" @click="showCachePopover = true">
          <template #icon>
            <nut-icon name="del"></nut-icon>
          </template>
        </nut-cell>
      </template>
      <template #cacheUsed>
        <nut-cell :title="t('settings.cacheUsed')" :desc="cacheUsedText">
          <template #icon>
            <nut-icon name="order"></nut-icon>
          </template>
        </nut-cell>
      </template>
      <template #clearCache>
        <nut-cell :title="t('settings.clearCache')" is-link @click="clearPlayCache">
          <template #icon>
            <nut-icon name="del"></nut-icon>
          </template>
        </nut-cell>
      </template>
    </wil-form>
    <div class="tmdb-key-title">{{ t('settings.displaySettings') }}</div>
    <wil-form :options="settings2" :show-button="true" ref="base_form2" v-model="formData" :showButton="false">
      <template #showRecommend>
        <nut-switch v-model="settingData.showRecommend" active-color="#ff6701" @change="val => changeSwitch(val, 'showRecommend')" />
      </template>
      <template #scrapeRules>
        <nut-cell :title="t('settings.scrapeRules')" is-link :desc="scrapeRuleCountText" @click="toScrapeRules">
          <template #icon>
            <nut-icon name="setting"></nut-icon>
          </template>
        </nut-cell>
      </template>
      <template #resetData>
        <nut-cell :title="t('settings.resetData')" is-link @click="resetMtData">
          <template #icon>
            <nut-icon name="refresh2"></nut-icon>
          </template>
        </nut-cell>
      </template>
      <template #theme>
        <nut-cell :title="t('settings.theme')" is-link :desc="themeText" @click="showPopover = true">
          <template #icon>
            <wil-icon :name="setThemeIcon()" class="icon-theme" />
          </template>
        </nut-cell>
      </template>
      <template #language>
        <nut-cell :title="t('settings.language')" is-link :desc="languageText" @click="showLanguagePopover = true">
          <template #icon>
            <wil-icon name="language_en" class="icon-theme" />
          </template>
        </nut-cell>
      </template>
    </wil-form>
    <nut-popup v-model:visible="showPopover" round position="bottom" safe-area-inset-bottom>
      <div :class="themeClass">
        <nut-picker :modelValue="status" :columns="popoverList" :title="t('settings.theme')" @confirm="confirmPicker" @cancel="showPopover = false" />
      </div>
    </nut-popup>
    <nut-popup v-model:visible="showZoomPopover" round position="bottom" safe-area-inset-bottom>
      <div :class="themeClass">
        <nut-picker
          v-model="zoomStatus"
          :columns="zoomOptions"
          :title="t('settings.zoomMode')"
          @confirm="confirmZoomPicker"
          @cancel="showZoomPopover = false"
        />
      </div>
    </nut-popup>
    <nut-popup v-model:visible="showCachePopover" round position="bottom" safe-area-inset-bottom>
      <div :class="themeClass">
        <nut-picker
          v-model="cacheStatus"
          :columns="cacheOptions"
          :title="t('settings.cacheSize')"
          @confirm="confirmCachePicker"
          @cancel="showCachePopover = false"
        />
      </div>
    </nut-popup>
    <nut-popup v-model:visible="showLanguagePopover" round position="bottom" safe-area-inset-bottom>
      <div :class="themeClass">
        <nut-picker
          v-model="languageStatus"
          :columns="languageList"
          :title="t('settings.language')"
          @confirm="confirmLanguagePicker"
          @cancel="showLanguagePopover = false"
        />
      </div>
    </nut-popup>
    <wil-modal ref="wil_modal"></wil-modal>
    <!-- <nut-button custom-color="#090909" @click="confirmSet">确认设置</nut-button> -->
  </div>
</template>

<script setup>
import { clearLibrary, getUserRules } from '@/utils/scrape'
import { ref, onBeforeMount, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import wilForm from '@/components/mobile/wil-form/index.vue'
import wilModal from '@/components/mobile/wil-modal/index.vue'
import wilIcon from '@/components/common/wil-icon/index.vue'
import { useThemeStore } from '@/stores/theme'
import { useLocaleStore } from '@/stores/locale'
import { useThemeClass } from '@/hooks/useThemeClass'
import { useThemeNavbar } from '@/hooks/useThemeNavbar'
import { useI18nNavbar } from '@/hooks/useI18nNavbar'
import { getCacheInfo, setCacheSize, clearCache, formatCacheSize } from '@/utils/player-cache'

useThemeNavbar()
useI18nNavbar('navbar.settings')
const { t } = useI18n()
const themeStore = useThemeStore()
const localeStore = useLocaleStore()
const themeClass = useThemeClass()

const settingData = ref({
  tmdbKey: '',
  showProgress: true,
  playercodec: 'exoplayer',
  showRecommend: true,
})

const wil_modal = ref(null)
const settings1 = computed(() => [
  { label: t('settings.showBottomProgress'), prop: 'showProgress' },
  { label: '', prop: 'zoomMode' },
  // { label: t('settings.videoDecoder'), prop: "playercodec" },
])
// 画面模式:0 适应(留黑边) / 1 铺满裁剪 / 2 拉伸
const showZoomPopover = ref(false)
const zoomOptions = computed(() => [
  {
    text: t('settings.zoomMode'),
    values: [
      { text: t('settings.zoomFit'), value: 0 },
      { text: t('settings.zoomFill'), value: 1 },
      { text: t('settings.zoomStretch'), value: 2 },
    ],
  },
])
const zoomStatus = ref([0])
const zoomModeText = computed(() => zoomOptions.value[0].values.find(i => i.value === zoomStatus.value[0])?.text || t('settings.zoomFit'))
const settings2 = computed(() => [
  { label: t('settings.showHomeRecommend'), prop: 'showRecommend' },
  { label: '', prop: 'scrapeRules' },
  { label: '', prop: 'resetData' },
  { label: '', prop: 'theme' },
  { label: '', prop: 'language' },
])

// 刮削解析规则自定义：显示当前自定义条数，点击进规则页
const scrapeRuleCountText = computed(() => {
  const rules = getUserRules() || {}
  const n = Object.values(rules).reduce((acc, v) => acc + (Array.isArray(v) ? v.length : 0), 0)
  return n > 0 ? t('settings.scrapeRulesCustomCount', { count: n }) : t('settings.scrapeRulesDefault')
})

const toScrapeRules = () => {
  uni.navigateTo({ url: '/pages/mobile/mine/scrape-rules' })
}

const showPopover = ref(false)
const popoverList = computed(() => [
  { text: t('settings.followSystem'), value: 'auto' },
  { text: t('settings.lightMode'), value: 'light' },
  { text: t('settings.darkMode'), value: 'dark' },
])
const status = ref(['auto'])
const themeText = computed(() => popoverList.value.find(i => i.value == status.value[0])?.text || t('settings.followSystem'))
const showLanguagePopover = ref(false)
const languageList = computed(() => localeStore.supportedLocales.map(item => ({ text: item.label, value: item.value })))
const languageStatus = ref([localeStore.locale])
const languageText = ref(t('settings.chinese'))

// 播放缓存：原生侧是进程级共享池，容量为全局设置
const showCachePopover = ref(false)
const CACHE_SIZE_OPTIONS = [256, 512, 1024, 2048, 4096]
const cacheOptions = computed(() => [{ text: t('settings.cacheSize'), values: CACHE_SIZE_OPTIONS.map(v => ({ text: `${v} MB`, value: v })) }])
const cacheStatus = ref([Number(uni.getStorageSync('cacheSizeMB')) || 512])
const cacheSizeText = computed(() => `${cacheStatus.value[0]} MB`)
const cacheUsedText = ref('—')
const cacheSettings = computed(() => [
  { label: '', prop: 'cacheSize' },
  { label: '', prop: 'cacheUsed' },
  { label: '', prop: 'clearCache' },
])

const refreshCacheInfo = () => {
  getCacheInfo(res => {
    if (res.success) {
      cacheUsedText.value = `${formatCacheSize(res.usedBytes)} / ${formatCacheSize(res.maxBytes)}`
      // 以原生实际容量回填，避免本地记录与实际不一致
      const actualMB = Math.round(res.maxBytes / 1024 / 1024)
      if (actualMB > 0) cacheStatus.value[0] = actualMB
    } else {
      cacheUsedText.value = '—'
    }
  })
}

const confirmZoomPicker = ({ selectedValue }) => {
  showZoomPopover.value = false
  zoomStatus.value[0] = Number(selectedValue[0])
  settingData.value.zoomMode = zoomStatus.value[0]
  uni.setStorageSync('settingData', settingData.value)
}

const confirmCachePicker = ({ selectedValue }) => {
  showCachePopover.value = false
  const sizeMB = Number(selectedValue[0])
  if (!sizeMB) return
  setCacheSize(sizeMB, res => {
    if (res.success) {
      cacheStatus.value[0] = sizeMB
      uni.setStorageSync('cacheSizeMB', sizeMB)
      refreshCacheInfo()
    } else {
      uni.showToast({ title: res.errMsg || t('settings.cacheSetFailed'), icon: 'none' })
    }
  })
}

const clearPlayCache = () => {
  wil_modal.value.showModal({
    title: t('modal.warmTip'),
    content: t('settings.clearCacheConfirm'),
    confirmColor: '#ff6701',
    confirm: () => {
      clearCache(res => {
        if (res.success) {
          uni.showToast({ title: t('settings.cacheCleared'), icon: 'none' })
          cacheUsedText.value = '0 MB'
        } else {
          uni.showToast({ title: res.errMsg || t('settings.cacheClearFailed'), icon: 'none' })
        }
        refreshCacheInfo()
      })
    },
  })
}

watch(
  () => localeStore.locale,
  locale => {
    languageStatus.value[0] = locale
    languageText.value = languageList.value.find(i => i.value == locale)?.text || t('settings.chinese')
  }
)

// 只返回字形名，颜色由模板上固定的 .icon-theme 统一跟随主题
const setThemeIcon = () => {
  if (status.value[0] === 'auto') {
    return themeStore.getResolvedTheme() === 'light' ? 'zhutiqiehuan' : 'anheimoshi'
  } else if (status.value[0] === 'light') {
    return 'qiansemoshi'
  } else if (status.value[0] === 'dark') {
    return 'anheimoshi'
  }
}

const changeSwitch = (val, type) => {
  if (type == 'showProgress') {
    settingData.value.showProgress = val
  } else if (type == 'showRecommend') {
    settingData.value.showRecommend = val
  } else if (type == 'playercodec') {
    settingData.value.playercodec = val
  }
  uni.setStorageSync('settingData', settingData.value)
}

const resetMtData = () => {
  wil_modal.value.showModal({
    title: t('modal.warmTip'),
    content: t('settings.resetDataConfirm'),
    confirmColor: '#ff6701',
    confirm: async () => {
      clearLibrary()
      uni.removeStorageSync('historyPlay')
    },
  })
}

const confirmPicker = ({ selectedValue, selectedOptions }) => {
  showPopover.value = false
  status.value[0] = selectedValue[0]
  // 通过 store 统一设置主题，支持 light/dark/auto 三种模式
  themeStore.setThemeUi(selectedValue[0])
}

const confirmLanguagePicker = ({ selectedValue }) => {
  showLanguagePopover.value = false
  languageStatus.value[0] = selectedValue[0]
  languageText.value = languageList.value.find(i => i.value == selectedValue[0])?.text || t('settings.chinese')
  localeStore.setLocale(selectedValue[0], { syncUniLocale: false })
}

onBeforeMount(() => {
  let settingData1 = uni.getStorageSync('settingData')
  if (settingData1) {
    settingData.value = settingData1
  }
  // 从 store 读取当前主题模式
  const mode = themeStore.getThemeUi()
  status.value[0] = mode
  languageStatus.value[0] = localeStore.locale
  languageText.value = languageList.value.find(i => i.value == languageStatus.value[0])?.text || t('settings.chinese')
  zoomStatus.value[0] = Number(settingData.value.zoomMode) || 0
  // 把本地记录的缓存上限同步给原生层，再拉一次真实占用
  const savedCacheMB = Number(uni.getStorageSync('cacheSizeMB'))
  if (savedCacheMB > 0) setCacheSize(savedCacheMB, () => refreshCacheInfo())
  else refreshCacheInfo()
})
</script>

<style lang="scss" scoped>
page {
  width: 100%;
  height: 100%;
}
.tmdb-key {
  background: var(--app-bg-secondary);
  width: 100%;
  height: 100%;
  padding: 36rpx 24rpx 0 24rpx;
  box-sizing: border-box;
  .tmdb-key-title {
    font-size: 36rpx;
    color: var(--app-text-primary);
    font-weight: bold;
    margin-top: 24rpx;
  }
  ::v-deep .nut-input {
    padding-left: 20rpx;
    margin-top: 30rpx;
  }
  ::v-deep .nut-button {
    width: 100%;
    margin-top: 30rpx;
    height: 80rpx;
    border-radius: 16rpx;
  }
  ::v-deep .base-form {
    background: transparent;
    .base-form-content {
      .nut-form {
        .nut-cell-group__wrap {
          margin-bottom: 0;
          background: transparent;
          .nut-form-item {
            background: transparent;
            padding-top: 0;
            .nut-form-item__label {
              font-size: 32rpx;
              color: var(--app-text-secondary);
            }
            .nut-form-item__body {
              align-items: flex-end;
              .nut-form-item__body__slots {
                display: flex;
                width: 100%;
                justify-content: flex-end;
                .nut-radio-group {
                  .nut-radio {
                    .nut-icon-check-checked {
                      color: #ff6701;
                    }
                  }
                }
                .nut-cell {
                  width: 100%;
                  margin: 0;
                  padding: 26rpx 0;
                  box-shadow: none;
                  background: transparent;
                  .nut-cell__icon {
                    .nutui-icon {
                      width: 40rpx;
                      height: 40rpx;
                      line-height: 40rpx;
                      font-size: 32rpx;
                    }
                    .iconfont {
                      font-size: 40rpx;
                    }
                  }
                  .nut-cell__title {
                    color: var(--app-text-secondary);
                    font-size: 32rpx;
                  }
                  .nut-cell__link {
                    // display: none;
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
</style>
