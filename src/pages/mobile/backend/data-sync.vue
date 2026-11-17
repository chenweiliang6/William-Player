<template>
  <div :class="['data-sync', themeClass]">
    <wilQrcode ref="wilQrcodeRef" :logo="appLogo"></wilQrcode>
    <div class="scan-text">{{ t('backend.refreshSyncStatusEveryTenSeconds') }}</div>
    <div class="scan-tip">{{ t('backend.scanQrCodeSyncTip') }}</div>
    <wil-icon name="saomiaoerweima" custom-color="#ff6701" class="scan-button" @click="scanCode" />
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import wilQrcode from "@/components/mobile/wil-qrcode/index.vue";
import wilIcon from '@/components/common/wil-icon/index.vue';
import appLogo from "@/static/app-logo1.png";
import { setShareData, deleteShareData, getShareData } from "@/network/apis";
import { onUnload } from "@dcloudio/uni-app";
import * as CONFIG from '@/utils/config'
import { writeMuluFromSync } from '@/utils/sources/mulu'
import { useThemeNavbar } from '@/hooks/useThemeNavbar'
import { useThemeClass } from '@/hooks/useThemeClass'
import { initLibrary, initLibraryWithMigration, resetLibraryStore } from '@/utils/scrape'
import { useI18nNavbar } from '@/hooks/useI18nNavbar'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
useThemeNavbar()
useI18nNavbar('navbar.dataSync')
const themeClass = useThemeClass()
const wilQrcodeRef = ref(null);
const port = ref("");
let timer = null;
let init = true
// #ifdef APP-PLUS
let TcpModule = uni.requireNativePlugin("TcpModule");
let lyzmlDLNA = uni.requireNativePlugin("LyzmlDLNAModule");
// #endif

const scanCode = () => {
  uni.scanCode({
    success: async (res) => {
      let result = JSON.parse(res.result);
      if (result.type == "dataSync") {
        let obj = {
          userInfo: {
            userKey: uni.getStorageSync(CONFIG.USER_KEY), userId: uni.getStorageSync(CONFIG.USER_ID),
            Authorization: uni.getStorageSync("Authorization"), refreshToken: uni.getStorageSync('refreshToken')
          },
          // localMovieTvData: uni.getStorageSync("localMovieTvData"),
          muluData: uni.getStorageSync('muluData') || {},
          sourceList: uni.getStorageSync("sourceList"),
          historyPlay: uni.getStorageSync("historyPlay"),
        };
        if (init) {
          uni.showToast({
            title: t('common.startConnect'),
            icon: 'none'
          })
          TcpModule.connectAsClient(result.port.split(':')[0], 1025, (res) => {
            uni.showToast({
              title: res,
              icon: 'none'
            })
            let result = JSON.parse(res)
            if (result.code == 500) { //本地局域网同步失败，走后端接口同步
              setShareData({ port: result.port.split(':')[1], data: obj }).then(() => {
                uni.showToast({
                  title: t('common.syncSuccess'),
                  icon: "none",
                });
              })
            } else { //本机局域网同步成功
              init = false
              TcpModule.send(JSON.stringify(obj), (res1) => {
                let res2 = JSON.parse(res1)
                if (res2.code == 500) {
                  uni.showToast({
                    title: t('common.syncFailedRescan'),
                    icon: 'none'
                  })
                } else {
                  uni.showToast({
                    title: t('common.syncSuccess'),
                    icon: "none",
                  });
                }
              })
            }
          })
        } else {
          TcpModule.send(JSON.stringify(obj), (res1) => {
            let res2 = JSON.parse(res1)
            if (res2.code == 500) {
              uni.showToast({
                title: t('common.syncFailedRescan'),
                icon: 'none'
              })
            } else {
              uni.showToast({
                title: t('common.syncSuccess'),
                icon: "none",
              });
            }
          })
        }
      } else if (result.type == 'sourceInput') { //手机扫码输入资源传到电视

      } else {
        uni.showToast({
          title: t('common.invalidQrCode'),
          icon: "none",
        });
      }
    },
  });
};

const setQrcode = () => {
  let ipAddress = ''
  // #ifdef APP-PLUS
  lyzmlDLNA.getIpAddress(val => {
    ipAddress = val
    port.value = ipAddress + ':' + String(Math.floor(Math.random() * 90000) + 10000);
    // let obj = { type: "dataSync", port: port };
    let obj = { type: "dataSync", port: port.value };
    wilQrcodeRef.value.getQRcode(JSON.stringify(obj));
  })
  // #endif

  // #ifndef APP-PLUS
  port.value = ':' + String(Math.floor(Math.random() * 90000) + 10000);
  let obj = { type: "dataSync", port: port.value };
  wilQrcodeRef.value.getQRcode(JSON.stringify(obj));
  // #endif
};

//10s刷新一次同步状态
const refreshStatus = () => {
  timer = setInterval(async () => {
    await getShareData({ port: port.value.split(':')[1] })
      .then((res) => {
        if (res.data) {
          // 影视库已迁到新结构 movieTvLibrary。
          // 对端若仍传旧的 localMovieTvData，先落到旧 key 再走一次迁移；
          // 若已传新结构，直接写入新 key。
          if (res.data.movieTvLibrary) {
            uni.setStorageSync('movieTvLibrary', res.data.movieTvLibrary)
            resetLibraryStore()
            initLibrary().catch(() => {})
          } else if (res.data.localMovieTvData) {
            uni.setStorageSync('localMovieTvData', res.data.localMovieTvData)
            resetLibraryStore()
            initLibraryWithMigration({ type: 'WebDAV', accountName: '' }).catch(() => {})
          }
          uni.setStorageSync("sourceList", res.data.sourceList);
          uni.setStorageSync("historyPlay", res.data.historyPlay);
          clearInterval(timer);
          timer = null;
          deleteShareData({ port: port.value.split(':')[1] });
          uni.showToast({
            title: t('common.syncSuccess'),
            icon: "none",
          });
          setTimeout(() => {
            uni.switchTab({
              url: "/pages/mobile/video/index",
            });
          }, 1500);
        }
      })
      .catch((error) => {
        clearInterval(timer);
        timer = null;
      });
  }, 10000);
};
refreshStatus();

//作为服务端开启服务
const startServer = () => {
  TcpModule.startServer(1025, (res) => { //接收别的设备发过来的数据
    let result = JSON.parse(res)
    if (result.code == 500) {
      uni.showToast({
        title: t('common.errorOccurred'),
        icon: 'none',
      })
    } else {
      if (result?.code != 501) { //过滤掉发送完消息成功之后中止连接的501报错
        uni.setStorageSync('sourceList', result.sourceList)
        uni.setStorageSync('historyPlay', result.historyPlay)
        // 跨版本同步：对端可能还是旧的 tv/movie 两桶结构，先迁移成 entries
        writeMuluFromSync(result.muluData)
        uni.setStorageSync('isreload', true)
        uni.switchTab({
          url: '/pages/mobile/video/index'
        })
      }
    }
  });
}

onMounted(() => {
  setQrcode();
  // #ifdef APP-PLUS
  startServer()
  // #endif
});
onUnload(() => {
  clearInterval(timer);
  timer = null;
  deleteShareData({ port: port.value.split(':')[1] });
  TcpModule ? TcpModule.closeAllConnections() : ''
  TcpModule = null
});
</script>

<style lang="scss" scoped>
page {
  width: 100%;
  height: 100%;
}

.data-sync {
  width: 100%;
  height: 100%;
  background: var(--app-bg);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 200rpx;
  box-sizing: border-box;

  .scan-text {
    font-size: 32rpx;
    color: var(--app-text-primary);
  }

  .scan-tip {
    margin-top: 100rpx;
    padding: 0 100rpx;
    text-align: center;
    color: #ff6701;
    font-size: 32rpx;
  }

  .scan-button {
    font-size: 100rpx;
    margin-top: 20rpx;
  }
}

// @media (prefers-color-scheme: dark) {
//   .data-sync {
//     background: #1e1e20;

//     .scan-text {
//       color: #fff;
//     }
//   }
// }
</style>