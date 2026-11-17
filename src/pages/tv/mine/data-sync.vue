<template>
    <div class="info-sync">
        <div class="info-sync-title">{{ t('backend.tvScanSyncTitle') }}</div>
        <!-- <span style="color:#fff">{{ port }}</span> -->
        <wilQrcode ref="wilQrcodeRef" :logo="appLogo"></wilQrcode>
        <div class="scan-text">{{ t('backend.refreshSyncStatusEveryTenSeconds') }}</div>
        <div class="info-sync-tip">
            <span>{{ t('backend.useMobileScanPrefix') }}</span><span>William Player</span><span>{{ t('backend.scanSyncSuffix') }}</span>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useI18n } from 'vue-i18n'
import wilQrcode from "@/components/mobile/wil-qrcode/index.vue";
import appLogo from "@/static/app-logo1.png";
import { setShareData, deleteShareData, getShareData } from "@/network/apis";
import { onUnload } from "@dcloudio/uni-app";
import * as CONFIG from '@/utils/config'
import { writeMuluFromSync } from '@/utils/sources/mulu'

const { t } = useI18n()
const wilQrcodeRef = ref(null);
const port = ref("");
let timer = null;
// #ifdef APP-PLUS
let TcpModule = uni.requireNativePlugin("TcpModule");
let lyzmlDLNA = uni.requireNativePlugin("LyzmlDLNAModule");

// #endif
const setQrcode = () => {
    let ipAddress = ''
    // #ifdef APP-PLUS
    lyzmlDLNA.getIpAddress(val => {
        ipAddress = val
        port.value = ipAddress + ':' + String(Math.floor(Math.random() * 90000) + 10000);
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
        await getShareData({ port: port.value })
            .then((res) => {
                if (res.data) {
                    uni.setStorageSync(CONFIG.USER_KEY, res.data.userInfo.userKey)
                    uni.setStorageSync(CONFIG.USER_ID, res.data.userInfo.userId)
                    uni.setStorageSync('Authorization', res.data.userInfo.Authorization)
                    uni.setStorageSync("sourceList", res.data.sourceList);
                    uni.setStorageSync("historyPlay", res.data.historyPlay);
                    clearInterval(timer);
                    timer = null;
                    deleteShareData({ port: port.value });
                    uni.showToast({
                        title: t('common.syncSuccess'),
                        icon: "none",
                    });
                    setTimeout(() => {
                        uni.reLaunch({
                            url: "/pages/tv/video/index",
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
            if (result?.code != 501) {//过滤掉发送完消息成功之后中止连接的501报错
                uni.setStorageSync('sourceList', result.sourceList)
                uni.setStorageSync('historyPlay', result.historyPlay)
                // 跨版本同步：对端可能还是旧的 tv/movie 两桶结构，先迁移成 entries
                writeMuluFromSync(result.muluData)
                uni.setStorageSync('isreload', true)
                uni.reLaunch({
                    url: '/pages/tv/video/index'
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

.info-sync {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: #1b1b20;

    .info-sync-title {
        font-size: 54rpx;
        color: #fff;
        font-weight: bold;
        margin-bottom: 60rpx;
    }

    .scan-text {
        margin-top: 20rpx;
        color: #d1d1d2;
    }

    .info-sync-tip {
        font-size: 40rpx;
        font-weight: bold;
        margin-top: 30rpx;

        span {
            color: #fff;

            &:nth-child(2) {
                color: #02b8e6;
            }
        }
    }
}
</style>
