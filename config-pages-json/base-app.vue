<script>
import { useThemeStore } from '@/stores/theme'
import { useLocaleStore } from '@/stores/locale'
import i18n from '@/i18n'
import { initLibrary } from '@/utils/scrape'

export default {
  onLaunch: function () {
    console.log('App Launch')
    const themeStore = useThemeStore()
    themeStore.init()
    const localeStore = useLocaleStore()
    localeStore.init(i18n)

    // 刮削库初始化：把落盘数据加载进内存。
    // PC 端走 IPC（异步），App/H5 走 uni storage。不 await 也不影响启动，
    // 因为 store 未就绪时读的是空库，UI 订阅后会自动重渲染。
    initLibrary().catch(e => console.warn('[App] 影视库初始化失败:', e))

    if (uni.onThemeChange) {
      uni.onThemeChange(res => {
        themeStore.onSystemThemeChange(res.theme)
      })
    }

    // #ifdef APP-PLUS
    if (process.env.NODE_ENV === 'production') {
      //生产环境 禁用log
      console.log = function () {}
    }
    // #endif
  },
  onShow: function () {
    console.log('App Show')
    const themeStore = useThemeStore()
    themeStore._resolveAndApply()
  },
  onHide: function () {
    console.log('App Hide')
  },
}
</script>

<style lang="scss">
@import 'nutui-uniapp/styles/index.scss';
@import './styles/nutui.scss';
@import './styles/theme-vars.scss';
@import './styles/iconfont.scss';

/*每个页面公共css */
.nut-button {
  border: none !important;
}

div {
  box-sizing: border-box;
}

*:focus {
  outline: none;
}

@media (min-width: 960px) {
  html {
    /* --tv-fontsize 由 tv-page 组件注入；PC 端没有该组件，回退 16px，
       否则 html 字号为 0，所有 rpx 尺寸都会塌成 0 */
    font-size: var(--tv-fontsize, 16px) !important;
  }
}

/* 4K电视 */
@media (min-width: 3820px) {
  html {
    font-size: 32px !important;
  }
}

// @media (prefers-color-scheme: dark) {
//   .nut-popup {
//     // background: #272727 !important;
//   }

//   .nut-picker {
//     background: #272727 !important;

//     .nut-picker__bar {
//       .nut-picker__title {
//         color: #fff;
//       }
//     }

//     .nut-picker__column {
//       .nut-picker__columnitem {
//         .nut-picker__list {
//           .nut-picker-roller {
//             .nut-picker-roller-item-title {
//               color: #fff;
//             }
//           }

//           .nut-picker-roller-mask {
//             background-image: linear-gradient(180deg, rgba(27, 27, 27, 0.9), rgba(27, 27, 27, 0.4)), linear-gradient(0deg, rgba(27, 27, 27, 0.9), rgba(27, 27, 27, 0.4));
//             background-repeat: no-repeat;
//             background-position: top, bottom;
//           }
//         }
//       }
//     }
//   }
// }
</style>
