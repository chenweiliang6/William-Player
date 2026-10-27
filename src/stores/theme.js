import { defineStore } from 'pinia'
import { IS_PC, IS_MOBILE } from '@/utils/config.js'

const THEME_MODES = ['light', 'dark', 'auto']

const normalizeMode = mode => (THEME_MODES.includes(mode) ? mode : 'auto')

const normalizeResolvedTheme = theme => (theme === 'dark' ? 'dark' : 'light')

const NAVIGATION_BAR_STYLES = {
  light: {
    default: {
      frontColor: '#000000',
      backgroundColor: '#ffffff',
    },
    secondary: {
      frontColor: '#000000',
      backgroundColor: '#f7f7f7',
    },
    transparentLight: {
      frontColor: '#000000',
      backgroundColor: 'transparent',
    },
    transparentDark: {
      frontColor: '#ffffff',
      backgroundColor: 'transparent',
    },
  },
  dark: {
    default: {
      frontColor: '#ffffff',
      backgroundColor: '#1e1e20',
    },
    secondary: {
      frontColor: '#ffffff',
      backgroundColor: '#1e1e20',
    },
    transparentLight: {
      frontColor: '#000000',
      backgroundColor: 'transparent',
    },
    transparentDark: {
      frontColor: '#ffffff',
      backgroundColor: 'transparent',
    },
  },
}

export const useThemeStore = defineStore('theme', {
  state: () => ({
    mode: '',
    resolvedTheme: '',
  }),
  actions: {
    setThemeUi(mode) {
      this.mode = normalizeMode(mode)
      uni.setStorageSync('theme', this.mode)
      this._resolveAndApply()
    },

    getThemeUi() {
      if (!this.mode) {
        this.mode = normalizeMode(uni.getStorageSync('theme') || 'auto')
      }
      return this.mode
    },

    getResolvedTheme() {
      if (!this.resolvedTheme) {
        this.getThemeUi()
        this._resolveAndApply()
      }
      return this.resolvedTheme || 'light'
    },

    applyTheme() {
      this._applyNativeUi()
      this.applyNavigationBar()
      this._applyTabBar()
    },

    _resolveAndApply() {
      if (this.mode === 'auto') {
        const sysInfo = uni.getSystemInfoSync()
        const theme = sysInfo.osTheme || sysInfo.theme || sysInfo.hostTheme
        this.resolvedTheme = normalizeResolvedTheme(theme)
      } else {
        this.resolvedTheme = normalizeResolvedTheme(this.mode)
      }
      this.applyTheme()
    },

    onSystemThemeChange(sysTheme) {
      if (this.mode === 'auto') {
        this.resolvedTheme = normalizeResolvedTheme(sysTheme)
        this.applyTheme()
      }
    },

    _applyNativeUi() {
      // #ifdef APP-PLUS
      try {
        if (typeof plus !== 'undefined' && plus.nativeUI) {
          this.mode === 'auto' ? plus.nativeUI.setUIStyle('auto') : plus.nativeUI.setUIStyle(this.resolvedTheme)
        }
      } catch (e) {
          //低版本运行环境不支持该API，失败可忽略
        }
      // #endif
    },

    getNavigationBarStyle(variant = 'default') {
      const theme = this.getResolvedTheme()
      const themeStyles = NAVIGATION_BAR_STYLES[theme]
      return themeStyles[variant] || themeStyles.default
    },

    applyNavigationBar(variant = 'default') {
      if (IS_PC || typeof uni.setNavigationBarColor !== 'function') return
      try {
        Promise.resolve(uni.setNavigationBarColor(this.getNavigationBarStyle(variant))).catch(() => {})
      } catch (e) {
          //低版本运行环境不支持该API，失败可忽略
        }
    },

    _applyTabBar() {
      if (!IS_MOBILE || typeof uni.setTabBarStyle !== 'function') return
      const isDark = this.resolvedTheme === 'dark'
      try {
        Promise.resolve(
          uni.setTabBarStyle({
            color: isDark ? '#a0a0a0' : '#86909C',
            selectedColor: '#ff6701',
            backgroundColor: isDark ? '#1e1e20' : '#ffffff',
            borderStyle: isDark ? 'black' : 'white',
          })
        ).catch(() => {})
      } catch (e) {
          //低版本运行环境不支持该API，失败可忽略
        }
    },

    init() {
      this.getThemeUi()
      this._resolveAndApply()
    },
  },
})
