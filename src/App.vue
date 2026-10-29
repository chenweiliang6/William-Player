<script>
import { useThemeStore } from '@/stores/theme'
import { useLocaleStore } from '@/stores/locale'
import i18n from '@/i18n'

export default {
  onLaunch: function () {
    console.log('App Launch')
    const themeStore = useThemeStore()
    themeStore.init()
    const localeStore = useLocaleStore()
    localeStore.init(i18n)

    if (uni.onThemeChange) {
      uni.onThemeChange(res => {
        themeStore.onSystemThemeChange(res.theme)
      })
    }

    // #ifdef APP-PLUS
    plus.screen.lockOrientation("portrait-primary");
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
    font-size: var(--tv-fontsize) !important;
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
