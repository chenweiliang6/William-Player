<template>
  <tv-page @keyCodeClick="evtMove">
    <div class="tv-search-match">
      <div class="tv-search-match-title">{{ t('navbar.searchAndMatchVideo') }}</div>
      <!-- TV 端没有好用的文字输入（遥控器打字体验差），沿用「从详情页带片名过来直接搜」
           的模式：进入即按 query 请求一次，用户只需上下选 + 确认。 -->
      <div class="tv-search-match-query" v-if="requestParams.query">
        <span class="label">{{ t('video.inputVideoNameSearch') }}：</span>
        <span class="value">{{ requestParams.query }}</span>
      </div>
      <div class="tv-search-match-list">
        <wil-list
          :requestFn="searchMovieTv"
          :request-params="requestParams"
          :responseAdapter="responseAdapter"
          ref="wil_list"
          :refresherEnabled="false"
          idKey="id"
          :pageSize="12"
          pageNumKey="page"
          listContainerClass="list-container"
          :style="{ '--line-height': lineHeight }"
          :scrollIntoView="scrollIntoView"
          :scroll-with-animation="true"
          :changeItemFn="changeItemFn"
          @currentData="currentData"
          v-if="requestParams.query"
        >
          <template #default="item">
            <div :class="['tv-search-match-list__item', tabIndex === item.$index ? 'tv-search-match-list__active' : '']"
              @click="handleSelect(item, item.$index)">
              <div class="item-poster">
                <image
                  v-if="item.poster_path"
                  :src="CONFIG.IMG_DOMAIN + '/t/p/w300_and_h450_bestv2' + item.poster_path"
                  class="item-poster-image" mode="aspectFill">
                </image>
                <span class="item-type">{{ normalizeMediaType(item.media_type) === 'tv' ? t('video.tv') : t('video.movie') }}</span>
              </div>
              <span class="item-name">{{ item.name || item.title }}</span>
              <span class="item-date">{{ (item.release_date || item.first_air_date || '').slice(0, 4) }}</span>
            </div>
          </template>
        </wil-list>
        <div v-else class="tv-search-match-empty">{{ t('video.onlySearchVideoName') }}</div>
      </div>
    </div>
  </tv-page>
</template>

<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import tvPage from '@/components/tv/tv-page/index.vue'
import wilList from '@/components/mobile/wil-list/index.vue'
import { onLoad } from '@dcloudio/uni-app'
import * as CONFIG from '@/utils/config'
import { debounce } from '@/utils/scrape'
import { searchMovieTvMulti } from '@/utils/tmdb'
import {
  getMovieTvData, normalizeMediaType, resolveManualMatch, MATCH_RESULT,
} from '@/utils/scrape'

const { t } = useI18n()
const wil_list = ref(null)
const scrollIntoView = ref('')
const lineHeight = ref('')
const tabIndex = ref(0)
const listData = ref([])
const requestParams = ref({})
const routerParams = ref({})

const responseAdapter = result => {
  if (!result) return { listData: [], listTotal: 0 }
  return { listData: result.results || [], listTotal: +result.total_results }
}

const searchMovieTv = data => searchMovieTvMulti(data)

const currentData = data => {
  listData.value = JSON.parse(JSON.stringify(data.list || []))
}

const setItemWidth = () => {
  const sysinfo = uni.getSystemInfoSync()
  const windowWidth = sysinfo.windowWidth
  const scale = uni.upx2px(100) / 100
  lineHeight.value = (((windowWidth - uni.upx2px(224)) / 6) * 160) / 109 / scale + 'rpx'
}

const setScrollIntoView = debounce(() => {
  scrollIntoView.value = `name${Math.floor(tabIndex.value / 6) * 6 + 1}`
}, 300)

let nowTime = 0
const evtMove = keyCode => {
  if (keyCode === 'KeyUp') {
    if (tabIndex.value > 5) tabIndex.value = tabIndex.value - 6
  } else if (keyCode === 'KeyDown') {
    if (tabIndex.value < listData.value.length - 6) tabIndex.value = tabIndex.value + 6
  } else if (keyCode === 'KeyLeft') {
    if (tabIndex.value > 0) tabIndex.value--
  } else if (keyCode === 'KeyRight') {
    if (tabIndex.value < listData.value.length - 1) tabIndex.value++
  } else if (keyCode === 'KeyEnter') {
    handleSelect(listData.value[tabIndex.value], tabIndex.value)
  }
  const time = Date.now()
  if (time - nowTime > 300) {
    scrollIntoView.value = `name${Math.floor(tabIndex.value / 6) * 6 + 1}`
  } else {
    setScrollIntoView()
  }
  nowTime = time
}
defineExpose({ evtMove })

const changeItemFn = index => {
  tabIndex.value = index
}

const toast = title => uni.showToast({ title, icon: 'none' })

const handleSelect = async (item, index) => {
  if (!item) return
  tabIndex.value = index
  const result = await resolveManualMatch({
    item,
    workKey: routerParams.value.workKey,
    currentType: routerParams.value.type,
    view: getMovieTvData(),
  })
  if (result.code === MATCH_RESULT.TYPE_MISMATCH) {
    const mapping = { tv: t('video.tv'), movie: t('video.movie') }
    toast(t('video.currentVideoTypeMismatch', {
      currentType: mapping[result.currentType],
      selectedType: mapping[result.selectedType],
    }))
    return
  }
  if (result.code === MATCH_RESULT.CONFLICT) {
    toast(t('video.duplicateVideoInLibrary'))
    return
  }
  if (result.code === MATCH_RESULT.DUPLICATE) {
    toast(t('video.duplicateVideoInLibrary'))
    return
  }
  if (result.code === MATCH_RESULT.FAILED) {
    toast(t('video.matchFailed'))
    return
  }
  // 旧模式（无 workKey）：写 resetMovieTv 缓存，由详情页 onShow 消费
  if (!routerParams.value.workKey && result.type) {
    uni.setStorageSync('resetMovieTv', { type: result.type, movieTvId: result.tmdbId, name: result.name })
  }
  toast(t('video.matchSuccess'))
  setTimeout(() => uni.navigateBack(), 600)
}

onLoad(options => {
  routerParams.value = options || {}
  setItemWidth()
  // 从详情页带片名过来时直接搜一次
  if (options?.query) {
    let q = options.query
    try { q = decodeURIComponent(q) } catch { /* 已是解码后的值 */ }
    requestParams.value = { query: q }
  }
})
</script>

<style lang="scss" scoped>
page {
  width: 100%;
  height: 100%;
}
.tv-search-match {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #1b1b20;
  padding: 24rpx 32rpx;
  box-sizing: border-box;

  &-title {
    font-size: 40rpx;
    color: #ffffff;
    padding-bottom: 16rpx;
  }
  &-query {
    font-size: 26rpx;
    color: #a0a0a8;
    padding-bottom: 16rpx;
    .value { color: #ff6701; }
  }
  &-list {
    flex: 1;
    overflow: hidden;
  }
  &-empty {
    color: #808088;
    font-size: 28rpx;
    padding: 40rpx 0;
  }
  &-list__item {
    padding: 12rpx;
    border-radius: 12rpx;
    border: 4rpx solid transparent;
    .item-poster {
      position: relative;
      width: 100%;
      aspect-ratio: 2 / 3;
      border-radius: 8rpx;
      overflow: hidden;
      background: #26262c;
    }
    .item-poster-image {
      width: 100%;
      height: 100%;
    }
    .item-type {
      position: absolute;
      right: 8px;
      bottom: 8px;
      height: 22px;
      line-height: 22px;
      padding: 0 8px;
      font-size: 14px;
      color: #fff;
      background: rgba(0, 0, 0, 0.6);
      border-radius: 4px;
    }
    .item-name {
      display: block;
      margin-top: 8rpx;
      color: #ffffff;
      font-size: 26rpx;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .item-date {
      display: block;
      color: #808088;
      font-size: 22rpx;
    }
  }
  &-list__active {
    border-color: #ff6701;
    background: rgba(255, 103, 1, 0.12);
  }
}
</style>
