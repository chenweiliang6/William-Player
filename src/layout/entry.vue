<template>
  <router-view />
</template>

<script setup>
import { loginByPhone, getWeUserByopenId } from "@/network/apis";
import { encrypt } from "@/utils/jsencrypt.js";
import * as CONFIG from "@/utils/config";
import { getUserByopenId } from "@/pages/mobile/mine/common.js";
import { initLibrary } from "@/utils/scrape";
import { onBeforeMount } from "vue";
onBeforeMount(async () => {
  // PC 端的刮削库存在主进程 jdb（通过 IPC 读），必须先加载完再渲染首页，
  // 否则首屏会读到空库。App/移动端已在 App.vue 里初始化过，幂等。
  await initLibrary().catch(e => console.warn('[entry] 影视库初始化失败:', e))

  if (!uni.getStorageSync("Authorization")) {
    await loginByPhone({ phone: "19994658532", password: encrypt("123456789") })
      .then((res) => {
        uni.setStorageSync(CONFIG.OPEN_ID, res.openId);
        uni.setStorageSync("Authorization", res.accessToken);
        uni.setStorageSync("refreshToken", res.refreshToken);
        getUserByopenId();
      })
      .catch(() => {
        let settingData = uni.getStorageSync("settingData");
        if (settingData) {
          settingData.tmdbKey = "9e0add7c02b66868ab0a368df820a335";
          uni.setStorageSync("settingData", settingData);
        } else {
          uni.setStorageSync("settingData", { tmdbKey: "9e0add7c02b66868ab0a368df820a335", showProgress: true, playercodec: "exoplayer", showRecommend: true });
        }
      });
  }
})

</script>

<style lang="scss" scoped>
page {
  width: 100%;
  height: 100%;
}
</style>