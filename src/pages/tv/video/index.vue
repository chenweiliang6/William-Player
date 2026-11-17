<template>
  <div class="tv-index" ref="tv_index" :tabindex="-1">
    <tv-navbar
      ref="video_navbar"
      :isFocus="focusModel == 'tvNavbar'"
      :loading="refreshLoading"
      :refreshData="refreshData"
      :focusModel="focusModel"
      :isEmpty="Boolean(selectType.type == 'Emby' ? !embyMovieTvList?.length : !hasLibraryContent(localMovieTvData))"
      @setFocus="setFocus"
      @changeSetting="changeSetting"
      @refresh="refreshVideoData"
      @pause="pauseRefresh"></tv-navbar>
    <!-- <span style="font-size: 38rpx;color: #fff;">{{ scrollTop }}</span> -->
    <!-- <span style="font-size: 38rpx;color: #fff;">{{ historyPlay }}</span> -->
    <tv-page @keyCodeClick="keyCodeClick" style="width: 100%; height: 100%; z-index: 999; position: relative" :scrollTop="scrollTop">
      <!-- 全屏转圈只在「库里还没有内容」时遮住整页。
           库非空时露出海报墙让卡片就地增长，改用右上角的小角标提示后台仍在刮。 -->
      <div class="refresh-icon" v-if="refreshLoading && !hasLibraryContent(localMovieTvData)">
        <nut-icon class="nut-icon-am-rotate nut-icon-am-infinite" name="refresh2" custom-color="#fff"></nut-icon>
      </div>
      <div class="refresh-badge" v-if="refreshLoading && hasLibraryContent(localMovieTvData)">
        <nut-icon class="nut-icon-am-rotate nut-icon-am-infinite" name="refresh2" custom-color="#fff"></nut-icon>
      </div>
      <template v-if="!refreshLoading || hasLibraryContent(localMovieTvData)">
        <video-empty
          v-if="selectType.type == 'Emby' ? !embyMovieTvList?.length : !hasLibraryContent(localMovieTvData)"
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
            :nextFocus="focusChain[firstCategoryIndex] || 'videoClassify'"
            ref="star_recommend"></star-recommend>
          <recent-played
            v-if="historyPlay.length"
            :listData="historyPlay"
            ref="recent_played"
            @setFocus="setFocus"
            :isFocus="focusModel == 'recentPlayed'"
            :nextFocus="focusChain[firstCategoryIndex] || 'videoClassify'"
            :offsetTop="scrollTop"></recent-played>
          <!-- 5 个分类分区：电影/电视剧/动漫/综艺/纪录片，空分类不渲染 -->
          <hx-list
            v-for="(tab, i) in categorySections"
            :key="tab.key"
            :ref="el => setHxRef(tab.key, el)"
            :title="tab.label"
            :mediaType="tab.mediaType"
            :category="tab.key"
            :listData="tab.list"
            :revision="libraryRevision"
            :isFocus="focusModel == 'hx_' + tab.key"
            :focusModel="focusModel"
            :prevFocus="hxNeighbors(tab.key).prev"
            :nextFocus="hxNeighbors(tab.key).next"
            :historyPlay="historyPlay"
            :offsetTop="scrollTop"
            :style="i === 0 ? 'margin-top: 50rpx' : ''"
            @setFocus="setFocus"></hx-list>
          <video-classify
            ref="video_classify"
            :revision="libraryRevision"
            :isFocus="focusModel == 'videoClassify'"
            :focusModel="focusModel"
            :prevFocus="focusChain[focusChain.length - 2] || 'starRecommend'"
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
import { computed, ref, nextTick, watchEffect } from 'vue'
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
import { debounce, hasLibraryContent } from '@/utils/scrape'
import videoEmpty from './components/index-component/video-empty.vue'

const { t } = useI18n()
const wil_modal = ref(null)

const { video_navbar, refreshData, refreshLoading, movieTvData, localMovieTvData, tmdbKey, historyPlay, settingData, refreshVideo, selectType, cancelRefresh, libraryRevision } = useVideoIndex({
  wil_modal,
})
const embyMovieTvList = ref(uni.getStorageSync('embyMovieTvList'))
const video_empty = ref(null)
const star_recommend = ref(null)
const recent_played = ref(null)
const video_classify = ref(null)
const settings_popup = ref(null)
const tv_modal = ref(null)

const showModal = ref(false)

const underImgArr = ref([])
const swipeIndex = ref(0)
const leave = ref(false)

const focusModel = ref('') //焦点所在的组件
const scrollTop = ref(1)

// ── 分类分区 ──
const CATEGORY_LABEL = {
  movie: 'video.movie',
  tv: 'video.tv',
  anime: 'video.anime',
  variety: 'video.variety',
  documentary: 'video.documentary',
  // 收纳未识别条目，展示为「其他」，排在最后。空时自动隐藏。
  unidentified: 'video.other',
}
// 详情页跳转需要真实媒体类型：动漫/综艺/纪录片在 TMDB 里仍是 tv 或 movie
const CATEGORY_MEDIA_TYPE = {
  movie: 'movie',
  tv: 'tv',
  anime: 'tv',
  variety: 'tv',
  documentary: 'tv',
  // 未识别条目没有 TMDB 身份，退回 movie 只用于详情页兜底展示
  unidentified: 'movie',
}

const CATEGORY_ORDER = ['movie', 'tv', 'anime', 'variety', 'documentary', 'unidentified']

const categorySections = computed(() => {
  const data = localMovieTvData.value || {}
  const byCategory = data.byCategory || {}
  return CATEGORY_ORDER
    .map(key => {
      // 兼容：byCategory 缺失时回退到旧的 movie/tv 两桶
      const fallback = key === 'movie' ? data.movie : key === 'tv' ? data.tv : []
      const list = byCategory[key]?.length ? byCategory[key] : (fallback || [])
      return { key, label: t(CATEGORY_LABEL[key]), mediaType: CATEGORY_MEDIA_TYPE[key], list }
    })
    .filter(sec => sec.list?.length)
})

/**
 * 焦点序列。分类分区在中间，前后各固定为轮播与分类广场。
 * hx-list 的上下邻居直接从这个序列取，空分类会被自动跳过。
 */
const focusChain = computed(() => [
  'starRecommend',
  ...(historyPlay.value.length ? ['recentPlayed'] : []),
  ...categorySections.value.map(s => `hx_${s.key}`),
  'videoClassify',
])

// 第一个分类分区在 focusChain 里的下标（有无「最近观看」会改变偏移）
const firstCategoryIndex = computed(() => focusChain.value.findIndex(k => k.startsWith('hx_')))

/**
 * 某个分类分区的上下邻居。
 *
 * 必须按 focusChain 的下标算，不能用 v-for 的 i —— 没有「最近观看」时
 * 分类在 chain 里会前移一位，直接用 i 会错位。
 */
const hxNeighbors = category => {
  const chain = focusChain.value
  const idx = chain.indexOf(`hx_${category}`)
  if (idx < 0) return { prev: '', next: '' }
  return { prev: chain[idx - 1] || '', next: chain[idx + 1] || '' }
}

// 动态收集每个分区的组件 ref，供 keyCodeClick / setFocus 分发
const hxRefs = ref({})
const setHxRef = (key, el) => {
  if (el) hxRefs.value[key] = el
  else delete hxRefs.value[key]
}

const showSettings = ref(false)
const modalMessage = ref({}) //tv-modal的配置参数

const keyCodeClick = keyCode => {
  console.log(video_navbar.value, 'adasdas')

  if (!video_navbar.value) return //用于保证dom已加载完成
  const mapping = focusMapping()
  const target = mapping[focusModel.value]
  // 分类分区是动态的，切源/重刮后当前焦点可能已不存在，避免访问 undefined
  if (!target || typeof target.evtMove !== 'function') return
  target.evtMove(keyCode)
}

/**
 * 焦点键 → 组件实例。
 * 分类分区用 hx_${category}，从 hxRefs 动态展开，不再写死两个键。
 */
const focusMapping = () => ({
  videoEmpty: video_empty.value,
  tvNavbar: video_navbar.value,
  starRecommend: star_recommend.value,
  recentPlayed: recent_played.value,
  videoClassify: video_classify.value,
  settingsPopup: settings_popup.value,
  tvModal: tv_modal.value,
  ...Object.fromEntries(Object.entries(hxRefs.value).map(([k, v]) => [`hx_${k}`, v])),
})

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
  const mapping = focusMapping()
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
  let isTrue = selectType.type == 'Emby' ? !embyMovieTvList.value?.length : !hasLibraryContent(localMovieTvData.value)
  if (isTrue) {
    //此时不存在任何数据，焦点在添加新资源按钮上
    if (!focusModel.value) focusModel.value = 'videoEmpty'
    return
  }
  if (focusModel.value === 'videoEmpty') {
    focusModel.value = 'starRecommend'
    return
  }
  // 分类分区是动态的：重刮后当前焦点所在的分区可能已消失
  // （例如原来有动漫、重刮后没了），此时退回第一个分区，避免遥控器失效
  if (focusModel.value.startsWith('hx_') && !focusChain.value.includes(focusModel.value)) {
    focusModel.value = focusChain.value[0] || 'starRecommend'
  }
}

const refreshVideoData = async () => {
  await refreshVideo()
  // focusModel.value = 'starRecommend'
}

// 取消刮削：置取消标记，收尾统一由 useVideoIndex 的 finally 处理
const pauseRefresh = () => {
  cancelRefresh('user')
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
  // 库非空时的后台刮削提示：右上角小角标，不遮挡列表。
  // 不能沿用 .refresh-icon 的 100%×100% —— 那会整页盖住海报墙。
  // TV 端用 px 而非 rpx：pages.json 的 rpxCalcMaxDeviceWidth 会把它缩得看不清。
  .refresh-badge {
    position: fixed;
    top: 24px;
    right: 32px;
    z-index: 1000;
    :deep(.nut-icon-refresh2) {
      width: 28px;
      height: 28px;
      font-size: 28px;
    }
  }
}
</style>
