import { defineStore } from 'pinia'
import { Locale as NutUILocale } from 'nutui-uniapp/locale'
import { IS_MOBILE } from '@/utils/config.js'

export const LOCALE_STORAGE_KEY = 'app_locale'

export const SUPPORTED_LOCALES = [
  { value: 'zh-Hans', label: '中文', messageCode: 'zh-CN', tmdbCode: 'zh-CN', nutuiCode: 'zh-CN' },
  { value: 'en', label: 'English', messageCode: 'en-US', tmdbCode: 'en-US', nutuiCode: 'en-US' },
  { value: 'ko', label: '한국어', messageCode: 'ko-KR', tmdbCode: 'ko-KR', nutuiCode: 'zh-CN' },
  { value: 'ja', label: '日本語', messageCode: 'ja-JP', tmdbCode: 'ja-JP', nutuiCode: 'zh-CN' },
]

const LEGACY_LOCALE_MAP = {
  'zh-CN': 'zh-Hans',
  'en-US': 'en',
  'ko-KR': 'ko',
  'ja-JP': 'ja',
}

const DEFAULT_LOCALE = 'zh-Hans'

const hasNativeTabBar = () => IS_MOBILE && typeof uni.setTabBarItem === 'function'

export const getLocaleConfig = locale => {
  return SUPPORTED_LOCALES.find(item => item.value === locale) || SUPPORTED_LOCALES[0]
}

const normalizeLocale = locale => {
  const normalizedLocale = LEGACY_LOCALE_MAP[locale] || locale
  return SUPPORTED_LOCALES.some(item => item.value === normalizedLocale) ? normalizedLocale : DEFAULT_LOCALE
}

const getSavedLocale = () => normalizeLocale(uni.getStorageSync(LOCALE_STORAGE_KEY))

export const useLocaleStore = defineStore('locale', {
  state: () => ({
    locale: DEFAULT_LOCALE,
    i18n: null,
    tabBarTextDirty: false,
  }),
  getters: {
    localeConfig: state => getLocaleConfig(state.locale),
    tmdbLanguage: state => getLocaleConfig(state.locale).tmdbCode,
    nutuiLanguage: state => getLocaleConfig(state.locale).nutuiCode,
    supportedLocales: () => SUPPORTED_LOCALES,
  },
  actions: {
    init(i18n) {
      this.i18n = i18n
      this.locale = getSavedLocale()
      this.applyLocale()
    },
    setLocale(locale, options = {}) {
      this.locale = normalizeLocale(locale)
      uni.setStorageSync(LOCALE_STORAGE_KEY, this.locale)
      this.applyLocale(options)
      this.tabBarTextDirty = true
    },
    applyLocale({ syncUniLocale = false } = {}) {
      if (this.i18n) {
        if (this.i18n.global.locale && typeof this.i18n.global.locale === 'object') {
          this.i18n.global.locale.value = this.locale
        } else {
          this.i18n.global.locale = this.locale
        }
      }
      if (syncUniLocale && typeof uni.setLocale === 'function') {
        uni.setLocale(this.locale)
      }
      NutUILocale.use(this.nutuiLanguage)
      this.applyTabBarText()
    },
    applyTabBarText() {
      if (!this.i18n || !hasNativeTabBar()) return
      const t = this.i18n.global.t
      const items = [
        { index: 0, text: t('tabBar.mediaLibrary') },
        { index: 1, text: t('tabBar.live') },
        { index: 2, text: t('tabBar.mine') },
      ]
      let hasFailed = false
      const tasks = items.map(item => {
        try {
          return Promise.resolve(uni.setTabBarItem(item)).catch(() => {
            hasFailed = true
          })
        } catch (error) {
          hasFailed = true
          return Promise.resolve()
        }
      })

      Promise.all(tasks).then(() => {
        if (!hasFailed) {
          this.tabBarTextDirty = false
        }
      })
    },
  },
})
