<template>
  <div class="home">
    <home-navbar @refresh="refreshVideo" @pause="pauseRefresh" :refreshData="refreshData" :loading="refreshLoading" ref="video_navbar"></home-navbar>
    <!-- <span @click="openVideo">调试用</span> -->
    <!-- 骨架屏只在库里还没有内容时遮挡：刮削改为边刮边显示后，
         库非空要直接露出海报墙，新卡片就地插入。 -->
    <template v-if="!refreshLoading || hasLibraryContent(localMovieTvData)">
      <under-img :imgArr="underImgArr" :swipeIndex="swipeIndex" :leave="leave"></under-img>
      <div class="home-container" v-if="hasLibraryContent(localMovieTvData)">
        <star-recommend @getStarList="getStarList" @change="changeSwiper" ref="star_recommend" :showSwiper="showSwiper"></star-recommend>
        <div class="home-container-list">
          <recent-played v-if="historyPlay.length" :listData="historyPlay"></recent-played>
          <!-- 6 个分类分区：电影/电视剧/动漫/综艺/纪录片，空分类不渲染 -->
          <hx-list
            v-for="tab in categorySections"
            :key="tab.key"
            :title="tab.label"
            :category="tab.key"
            :listData="tab.list"
            :revision="libraryRevision"
          ></hx-list>
          <Classify :revision="libraryRevision"></Classify>
        </div>
      </div>
      <div class="home-empty" v-else>
        <wil-empty type="data" :text="t('video.noTitle')"></wil-empty>
      </div>
    </template>
    <Skeleton v-else></Skeleton>
    <!-- 使用teleport挂载到body去 -->
    <wil-modal ref="wil_modal"></wil-modal>
  </div>
</template>

<script setup>
import { setMovieTvData, hasLibraryContent } from '@/utils/scrape'
import underImg from '../components/under-img.vue'
import homeNavbar from './components/navbar.vue'
import starRecommend from '../components/star-recommend.vue'
import recentPlayed from './components/recent-played.vue'
import hxList from './components/hx-list.vue'
import Classify from './components/classify.vue'
import wilModal from '@/components/mobile/wil-modal/index.vue'
import wilEmpty from '@/components/mobile/wil-empty/index.vue'
import { ipc } from '@/utils/ipcRenderer'
import { ipcApiRoute } from '@/utils/ipcApiRoute'
import { computed, nextTick, onActivated, onDeactivated, onMounted, onUnmounted, ref } from 'vue'
import * as CONFIG from '@/utils/config'
import { useVideoIndex } from '@/hooks/useVideoIndex'
import { defineOptions } from 'vue'
import { useRouter } from 'vue-router'
import Skeleton from './components/skeleton.vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
defineOptions({
  name: 'Home',
})

const router = useRouter()
const underImgArr = ref([])
const swipeIndex = ref(0)
const leave = ref(false)
const wil_modal = ref(null)
const showSwiper = ref(true)

let scrollTop = 0
console.log(uni.getStorageSync('historyPlay'))

const { video_navbar, refreshData, refreshLoading, movieTvData, localMovieTvData, tmdbKey, historyPlay, settingData, selectType, refreshVideo, showPage, cancelRefresh, libraryRevision } = useVideoIndex(
  { wil_modal }
)

// 分类分区。对齐爆米花的首页结构：识别失败的条目并入「其他」，
// 不再单列「未识别」分区。
const CATEGORY_LABEL = {
  movie: 'video.movie',
  tv: 'video.tv',
  anime: 'video.anime',
  variety: 'video.variety',
  documentary: 'video.documentary',
  // 收纳未识别条目，展示为「其他」，排在最后
  unidentified: 'video.other',
}
const CATEGORY_ORDER = ['movie', 'tv', 'anime', 'variety', 'documentary', 'unidentified']

const categorySections = computed(() => {
  const data = localMovieTvData.value || {}
  const byCategory = data.byCategory || {}
  return CATEGORY_ORDER
    .map(key => {
      const fallback = key === 'movie' ? data.movie : key === 'tv' ? data.tv : []
      const list = byCategory[key]?.length ? byCategory[key] : (fallback || [])
      return { key, label: t(CATEGORY_LABEL[key]), list }
    })
    .filter(sec => sec.list?.length)
})

const getStarList = arr => {
  underImgArr.value = arr.map(item => {
    return CONFIG.IMG_DOMAIN + '/t/p/w1920_and_h1080_bestv2' + item.backdrop
  })
}
const changeSwiper = index => {
  leave.value = true
  setTimeout(() => {
    swipeIndex.value = index
    leave.value = false
  }, 350)
}

// 取消刮削：只置取消标记，由 useVideoIndex 的 finally 收尾。
// 不要在这里清空 localMovieTvData —— 取消意味着「放弃本次」，
// 海报墙应当保持取消前的样子，而不是被打成空状态。
const pauseRefresh = () => {
  cancelRefresh('user')
}

const openVideo = () => {
  // ipc.invoke(ipcApiRoute.changeWindowSize, { width: 400, height: 500 })
  // router.replace({
  //   path: '/login',
  // })
  let args = {
    type: 'vue',
    content: '/video',
    windowName: 'Video',
    windowTitle: t('video.nowPlaying'),
    opusId: '1',
    windowsOption: {
      frame: false,
      width: 1358,
      height: 841,
      backgroundColor: '#000000',
    },
    query: {
      videoUrl:
        'https://cloudcube.telecomjs.com/cloudcube-gslzfy-js-person/PERSONCLOUD/f0b2b9e8-c44f-420c-9482-3abc8d1e426f.mkv?x-obs-traffic-limit=409600&X-Amz-Date=20251207T112101Z&X-Amz-Algorithm=AWS4-HMAC-SHA256&x-amz-CLIENTTYPEIN=PC&x-amz-userLevel=0&X-Amz-Credential=SZshenghuo/20251207/us-east-1/s3/aws4_request&x-amz-UID=64784934&response-content-disposition=attachment%3Bfilename%3DSee.Her.Again.S01E01.2024.1080p.NF.x264.DDP5.1.mkv&x-amz-CLIENTNETWORK=UNKNOWN&x-amz-CLOUDTYPEIN=PERSON&X-Amz-SignedHeaders=host&X-Amz-Expires=7860&x-amz-FSIZE=2056482719&x-amz-UFID=225143168989469276&X-Amz-Signature=c4dc92aabfd89c35fe484dd1e546f7eb5895a39ff3aa6e977cefd63212e8ed62',
    },
  }
  ipc.invoke(ipcApiRoute.createMpv, args).then(id => {
    console.log('[createWindow] id:', id)
  })
}

const handleResize = () => {
  showSwiper.value = false
  nextTick(() => {
    showSwiper.value = true
  })
}

onMounted(() => {
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
})

onActivated(() => {
  let element = document.querySelector('.home-container')
  if (element) {
    element.scrollTop = scrollTop
  }
  // setTimeout(() => {
  showPage()
  // }, 300);
})
onDeactivated(() => {
  let element = document.querySelector('.home-container')
  if (element) {
    scrollTop = element.scrollTop
  }
})
</script>

<style lang="scss" scoped>
.home {
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative;
  z-index: 1;

  .home-container {
    width: 100%;
    height: 100%;
    overflow: auto;
    position: relative;
    z-index: 999;

    .home-container-list {
      padding: 0 100rpx;
      padding-bottom: 100rpx;
    }
  }
  .home-empty {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }
}
</style>
