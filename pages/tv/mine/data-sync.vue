<template>
    <div class="info-sync">
        <div class="info-sync-title">手机扫码同步William Player</div>
        <wilQrcode ref="wilQrcodeRef" :logo="appLogo"></wilQrcode>
        <div class="scan-text">每隔10秒刷新一次同步状态</div>
        <div class="info-sync-tip">
            <span>请使用手机</span><span>William Player</span><span>扫码同步</span>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import wilQrcode from "@/components/mobile/wil-qrcode/index.vue";
import appLogo from "@/static/app-logo1.png";
import { setShareData, deleteShareData, getShareData } from "@/network/apis";
import { onUnload } from "@dcloudio/uni-app";
import * as CONFIG from '@/utils/config'

const wilQrcodeRef = ref(null);
let port = "";
let timer = null;

const setQrcode = () => {
    port = String(Math.floor(Math.random() * 90000) + 10000);
    let obj = { type: "dataSync", port: port };
    wilQrcodeRef.value.getQRcode(JSON.stringify(obj));
};

//10s刷新一次同步状态
const refreshStatus = () => {
    timer = setInterval(async () => {
        await getShareData({ port: port })
            .then((res) => {
                if (res.data) {
                    uni.setStorageSync(CONFIG.USER_KEY, res.data.userInfo.userKey)
                    uni.setStorageSync(CONFIG.USER_ID, res.data.userInfo.userId)
                    uni.setStorageSync('userPassword', res.data.userInfo.userPassword)
                    uni.setStorageSync('Authorization', res.data.userInfo.Authorization)
                    uni.setStorageSync("localMovieTvData", res.data.localMovieTvData);
                    uni.setStorageSync("sourceList", res.data.sourceList);
                    uni.setStorageSync("historyPlay", res.data.historyPlay);
                    clearInterval(timer);
                    timer = null;
                    deleteShareData({ port: port });
                    uni.showToast({
                        title: "同步成功",
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
onMounted(() => {
    setQrcode();
});
onUnload(() => {
    clearInterval(timer);
    timer = null;
    deleteShareData({ port: port });
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
