<template>
  <div class="entry"></div>
</template>

<script setup>
import { onBeforeMount } from "vue";
import { loginByPhone, getWeUserByopenId } from "@/network/apis";
import { encrypt } from "@/utils/jsencrypt.js";
import * as CONFIG from "@/utils/config";
import { getUserByopenId } from "./common.js";

onBeforeMount(async () => {
  if (!uni.getStorageSync("historyPlay")) {
    uni.setStorageSync("historyPlay", []);
  }
  if (CONFIG.PLATFORM === 'TV') { //tv端跳转到tv的首页
    let localMovieTvData = uni.getStorageSync('localMovieTvData')
    if (!localMovieTvData?.movie?.length && !localMovieTvData?.tv?.length) {
      uni.reLaunch({
        url: "/pages/tv/mine/data-sync",
      });
    } else {
      uni.reLaunch({
        url: "/pages/tv/video/index",
      });
    }
  } else {//手机端跳转到手机端首页
    if (uni.getStorageSync("Authorization")) {
      uni.reLaunch({
        url: "/pages/mobile/video/index",
      });
    } else {
      uni.setStorageSync("userPassword", { phone: "19994658532", password: "123456789" });
      await loginByPhone({ phone: "19994658532", password: encrypt("123456789") })
        .then((res) => {
          uni.setStorageSync(CONFIG.OPEN_ID, res.openId);
          getUserByopenId();
          uni.reLaunch({
            url: "/pages/mobile/video/index",
          });
        })
        .catch((error) => {
          uni.reLaunch({
            url: "/pages/mobile/video/index",
          });
          let settingData = uni.getStorageSync("settingData");
          if (settingData) {
            settingData.tmdbKey = "9e0add7c02b66868ab0a368df820a335";
            uni.setStorageSync("settingData", settingData);
          } else {
            uni.setStorageSync("settingData", { tmdbKey: res.data.wuser.tmdbKey, showProgress: true, playercodec: "exoplayer", showRecommend: true });
          }
        });
      // uni.reLaunch({
      //   url: "/pages/mobile/mine/login",
      // });
    }
  }

});
</script>

<style lang="scss" scoped></style>
