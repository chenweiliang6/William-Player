<template>
  <div class="tv-index" ref="tv_index" :tabindex="-1">
    <tv-navbar
      ref="video_navbar"
      :isFocus="focusModel == 'tvNavbar'"
      :loading="refreshLoading"
      :refreshData="refreshData"
      :focusModel="focusModel"
      :isEmpty="Boolean(selectType.type == 'Emby' ? !embyMovieTvList?.length : !localMovieTvData?.movie?.length && !localMovieTvData?.tv?.length)"
      @setFocus="setFocus"
      @changeSetting="changeSetting"
      @refresh="refreshVideoData"></tv-navbar>
    <!-- <span style="font-size: 38rpx;color: #fff;">{{ scrollTop }}</span> -->
    <!-- <span style="font-size: 38rpx;color: #fff;">{{ historyPlay }}</span> -->
    <tv-page @keyCodeClick="keyCodeClick" style="width: 100%; height: 100%; z-index: 999; position: relative" :scrollTop="scrollTop">
      <div class="refresh-icon" v-if="refreshLoading">
        <nut-icon class="nut-icon-am-rotate nut-icon-am-infinite" name="refresh2" custom-color="#fff"></nut-icon>
      </div>
      <template v-else>
        <video-empty
          v-if="selectType.type == 'Emby' ? !embyMovieTvList?.length : !localMovieTvData?.movie?.length && !localMovieTvData?.tv?.length"
          ref="video_empty"
          :isFocus="focusModel == 'videoEmpty'"
          @changeSetting="changeSetting"
          @setFocus="setFocus">
        </video-empty>
        <template v-else>
          <under-img :imgArr="underImgArr" :swipeIndex="swipeIndex" :leave="leave"></under-img>
          <star-recommend
            @getStarList="getStarList"
            @change="changeSwiper"
            @setFocus="setFocus"
            :isFocus="focusModel == 'starRecommend'"
            :historyPlay="historyPlay"
            ref="star_recommend"></star-recommend>
          <recent-played
            v-if="historyPlay.length"
            :listData="historyPlay"
            ref="recent_played"
            @setFocus="setFocus"
            :isFocus="focusModel == 'recentPlayed'"
            :offsetTop="scrollTop"></recent-played>
          <hx-list
            :title="t('video.movie')"
            mediaType="movie"
            :listData="localMovieTvData?.movie"
            :isFocus="focusModel == 'hxMovie'"
            v-if="localMovieTvData?.movie?.length"
            style="margin-top: 50rpx"
            ref="hx_movie"
            :focusModel="focusModel"
            :historyPlay="historyPlay"
            :offsetTop="scrollTop"
            @setFocus="setFocus"></hx-list>
          <hx-list
            :title="t('video.tv')"
            mediaType="tv"
            :listData="localMovieTvData?.tv"
            :isFocus="focusModel == 'hxTv'"
            v-if="localMovieTvData?.tv?.length"
            ref="hx_tv"
            :focusModel="focusModel"
            :historyPlay="historyPlay"
            :offsetTop="scrollTop"
            @setFocus="setFocus"></hx-list>
          <video-classify
            ref="video_classify"
            :isFocus="focusModel == 'videoClassify'"
            :focusModel="focusModel"
            :offsetTop="scrollTop"
            @setFocus="setFocus"></video-classify>
        </template>
      </template>
    </tv-page>
    <settings-popup v-model:visible="showSettings" ref="settings_popup" @changeSetting="changeSetting" @openModal="openModal"></settings-popup>
    <tv-modal
      ref="tv_modal"
      :title="modalMessage.title"
      :message="modalMessage.message"
      v-model:visible="showModal"
      @cancel="cancelModal"
      @confirm="confirmModal"></tv-modal>
  </div>
</template>

<script setup>
import { ref, nextTick, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import tvPage from '@/components/tv/tv-page/index.vue'
import recentPlayed from './components/index-component/recent-played.vue'
import hxList from './components/index-component/hx-list.vue'
import tvNavbar from './components/index-component/navbar.vue'
import starRecommend from './components/index-component/star-recommend.vue'
import videoClassify from './components/index-component/classify.vue'
import underImg from './components/index-component/under-img.vue'
import settingsPopup from './components/index-component/settings-popup.vue'
import tvModal from '@/components/tv/tv-modal/index.vue'
import * as CONFIG from '@/utils/config'
import { useVideoIndex } from '@/hooks/useVideoIndex.js'
import { debounce } from '@/utils/scrape'
import videoEmpty from './components/index-component/video-empty.vue'

const { t } = useI18n()
const wil_modal = ref(null)

const { video_navbar, refreshData, refreshLoading, movieTvData, localMovieTvData, tmdbKey, historyPlay, settingData, refreshVideo, selectType } = useVideoIndex({
  wil_modal,
})
const embyMovieTvList = ref(uni.getStorageSync('embyMovieTvList'))
const video_empty = ref(null)
const star_recommend = ref(null)
const recent_played = ref(null)
const hx_movie = ref(null)
const hx_tv = ref(null)
const video_classify = ref(null)
const settings_popup = ref(null)
const tv_modal = ref(null)

const showModal = ref(false)

const underImgArr = ref([])
const swipeIndex = ref(0)
const leave = ref(false)

const focusModel = ref('') //焦点所在的组件
const scrollTop = ref(1)

const showSettings = ref(false)
const modalMessage = ref({}) //tv-modal的配置参数

const keyCodeClick = keyCode => {
  console.log(video_navbar.value, 'adasdas')

  if (!video_navbar.value) return //用于保证dom已加载完成
  let mapping = {
    'videoEmpty': video_empty.value,
    'tvNavbar': video_navbar.value,
    'starRecommend': star_recommend.value,
    'recentPlayed': recent_played.value,
    'hxMovie': hx_movie.value,
    'hxTv': hx_tv.value,
    'videoClassify': video_classify.value,
    'settingsPopup': settings_popup.value,
    'tvModal': tv_modal.value,
  }
  mapping[focusModel.value].evtMove(keyCode)
}

const setScrollTop = debounce(async refValue => {
  nextTick(() => {
    scrollTop.value = refValue?.getScrollTop ? refValue.getScrollTop() : 0
  })
}, 300)

const getStarList = arr => {
  underImgArr.value = arr.map(item => {
    return CONFIG.IMG_DOMAIN + '/t/p/w1920_and_h1080_bestv2' + item.backdrop
  })
  nextTick(() => {
    if (scrollTop.value === 1) scrollTop.value = 0
  })
}
const changeSwiper = index => {
  leave.value = true
  setTimeout(() => {
    swipeIndex.value = index
    leave.value = false
  }, 350)
}

let nowTime = 0
const setFocus = async (val, keyCode) => {
  focusModel.value = val
  // scrollTop.value = offsetTop
  // console.log(offsetTop,'offset');
  let mapping = {
    'videoEmpty': video_empty.value,
    'tvNavbar': video_navbar.value,
    'starRecommend': star_recommend.value,
    'recentPlayed': recent_played.value,
    'hxMovie': hx_movie.value,
    'hxTv': hx_tv.value,
    'videoClassify': video_classify.value,
  }
  if (keyCode === 'KeyUp' || keyCode === 'KeyDown') {
    let time = Date.now()
    if (time - nowTime > 300) {
      nextTick(() => {
        scrollTop.value = mapping[focusModel.value]?.getScrollTop ? mapping[focusModel.value]?.getScrollTop() : 0 //用于设置tv-page页面的滚动，获取模块距离顶部的距离
      })
    } else {
      setScrollTop(mapping[focusModel.value])
    }
    nowTime = time
  }
}

//打开设置
const changeSetting = val => {
  showSettings.value = val
  if (val) {
    focusModel.value = 'settingsPopup'
  } else {
    focusModel.value = 'tvNavbar'
    nextTick(() => {
      video_navbar.value.tabIndex = 4
    })
  }
}

//打开tvModal，进行提示
const openModal = obj => {
  focusModel.value = 'tvModal'
  modalMessage.value = obj
  showModal.value = true
}

//modal点击取消按钮
const cancelModal = () => {
  focusModel.value = 'settingsPopup'
}

//modal点击确定按钮
const confirmModal = () => {
  focusModel.value = 'settingsPopup'
  modalMessage.value.confirmEvent()
  if (modalMessage.value.title === t('source.selectResourceConfirm')) {
    showSettings.value = false
    focusModel.value = 'tvNavbar'
    nextTick(() => {
      video_navbar.value.tabIndex = 4
    })
    video_navbar.value.showProgress()
  }
}

//设置初始化焦点所在的位置
const initFocusModel = () => {
  let isTrue = selectType.type == 'Emby' ? !embyMovieTvList.value?.length : !localMovieTvData.value?.movie?.length && !localMovieTvData.value?.tv?.length
  if (isTrue) {
    //此时不存在任何数据，焦点在添加新资源按钮上
    if (!focusModel.value) focusModel.value = 'videoEmpty'
  } else {
    if (focusModel.value === 'videoEmpty') focusModel.value = 'starRecommend'
  }
  console.log("刮削玩了",focusModel.value);
  
}

const refreshVideoData = async () => {
  await refreshVideo()
  // focusModel.value = 'starRecommend'
}

watchEffect(() => {
  initFocusModel()
})
</script>

<style lang="scss" scoped>
page {
  width: 100%;
  height: 100%;
  background: #020201;
}

.tv-index {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #020201;
  .refresh-icon {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    :deep(.nut-icon-refresh2) {
      width: 80rpx;
      height: 80rpx;
      font-size: 80rpx;
    }
  }
}
</style>
