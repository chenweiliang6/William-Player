<template>
  <div class="entry"></div>
</template>

<script setup>
import { onBeforeMount } from 'vue'
import { loginByPhone, getWeUserByopenId } from '@/network/apis'
import { encrypt } from '@/utils/jsencrypt.js'
import * as CONFIG from '@/utils/config'
import { getUserByopenId } from './common.js'

onBeforeMount(async () => {
  if (!uni.getStorageSync('historyPlay')) {
    uni.setStorageSync('historyPlay', [])
  }
  if (CONFIG.IS_TV) {
    //tv端跳转到tv的首页
    let localMovieTvData = uni.getStorageSync('localMovieTvData')
    let settingData = uni.getStorageSync('settingData')
    if (settingData) {
      settingData.tmdbKey = '9e0add7c02b66868ab0a368df820a335'
      uni.setStorageSync('settingData', settingData)
    } else {
      uni.setStorageSync('settingData', { tmdbKey: '9e0add7c02b66868ab0a368df820a335', showProgress: true, playercodec: 'exoplayer', showRecommend: true })
    }
    if (!localMovieTvData?.movie?.length && !localMovieTvData?.tv?.length) {
      // uni.reLaunch({
      //   url: "/pages/tv/mine/data-sync",
      // });
      uni.reLaunch({
        url: '/pages/tv/video/index',
      })
    } else {
      uni.reLaunch({
        url: '/pages/tv/video/index',
      })
    }
  } else {
    //手机端跳转到手机端首页
    if (uni.getStorageSync('Authorization')) {
      uni.reLaunch({
        url: '/pages/mobile/video/index',
      })
    } else {
      //白屏时间久的原因在于此处，接口地址改成本地了，请求超时是10s，所以一直显示白屏
      await loginByPhone({ phone: '19994658532', password: encrypt('123456789') })
        .then(res => {
          uni.setStorageSync(CONFIG.OPEN_ID, res.openId)
          uni.setStorageSync('Authorization', res.accessToken)
          uni.setStorageSync('refreshToken', res.refreshToken)
          getUserByopenId()
          uni.reLaunch({
            url: '/pages/mobile/video/index',
          })
        })
        .catch(error => {
          uni.reLaunch({
            url: '/pages/mobile/video/index',
          })
          let settingData = uni.getStorageSync('settingData')
          if (settingData) {
            settingData.tmdbKey = '9e0add7c02b66868ab0a368df820a335'
            uni.setStorageSync('settingData', settingData)
          } else {
            uni.setStorageSync('settingData', { tmdbKey: '9e0add7c02b66868ab0a368df820a335', showProgress: true, playercodec: 'exoplayer', showRecommend: true })
          }
        })
      // uni.reLaunch({
      //   url: "/pages/mobile/mine/login",
      // });
    }
  }
})
</script>

<style lang="scss" scoped></style>
