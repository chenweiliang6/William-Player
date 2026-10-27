import { watch, ref } from 'vue';
import { useThemeStore } from '@/stores/theme';
import { useLocaleStore } from '@/stores/locale';
import { onShow } from '@dcloudio/uni-app';
import { PLATFORM, IS_MOBILE } from '@/utils/config.js';

export function useThemeTabbar(options) {
  const themeStore = useThemeStore();
  const localeStore = useLocaleStore();
  const currentTheme = ref(themeStore.getResolvedTheme());
  const options1 = options || { customNav: false };

  const applyTabbar = () => {
    const theme = themeStore.getResolvedTheme();
    currentTheme.value = theme;

    if (theme === 'dark') {
      if (options1.customNav) {
        themeStore.applyNavigationBar('transparentDark');
      }

      if (IS_MOBILE) {
        try {
          Promise.resolve(
            uni.setTabBarStyle({
              backgroundColor: '#1e1e20',
              borderStyle: 'black',
            })
          ).catch(() => {})
        } catch (error) {
          //低版本运行环境不支持该API，失败可忽略
        }
      }
    } else {
      if (options1.customNav) {
        themeStore.applyNavigationBar('transparentLight');
      }

      if (IS_MOBILE) {
        try {
          Promise.resolve(
            uni.setTabBarStyle({
              backgroundColor: '#ffffff',
              borderStyle: 'white',
            })
          ).catch(() => {})
        } catch (error) {
          //低版本运行环境不支持该API，失败可忽略
        }
      }
    }

    if (IS_MOBILE && localeStore.tabBarTextDirty) {
      localeStore.applyTabBarText();
    }
  };

  onShow(applyTabbar);

  watch(
    () => themeStore.resolvedTheme,
    applyTabbar,
    { immediate: true }
  );

  return { currentTheme };
}
