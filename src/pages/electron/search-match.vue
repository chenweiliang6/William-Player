<template>
  <div class="search-match">
    <div class="search-match-title">
      <wil-icon name="arrow-left-copy" class="search-match-back" @click="back" />
      <span>{{ t('navbar.searchAndMatchVideo') }}</span>
    </div>
    <div class="search-match-bar">
      <el-input
        v-model="searchValue"
        :placeholder="t('video.inputVideoNameSearch')"
        clearable
        @keydown.enter="toSearch"
        @clear="toCancel"
      >
        <template #prefix>
          <wil-icon name="sousuo" />
        </template>
      </el-input>
      <el-button type="primary" @click="toSearch">{{ t('video.search') }}</el-button>
    </div>
    <div class="search-match-list">
      <wil-list
        v-if="requestParams.query"
        :requestFn="searchMovieTv"
        :request-params="requestParams"
        :responseAdapter="responseAdapter"
        ref="wil_list"
        :refresherEnabled="false"
        idKey="id"
        listContainerClass="list-container"
        :pageSize="50"
        pageNumKey="page"
      >
        <template #default="item">
          <div class="search-match-list__item" @click="handleSelect(item)">
            <div class="item-poster">
              <img
                v-if="item.poster_path"
                :src="CONFIG.IMG_DOMAIN + '/t/p/w300_and_h450_bestv2' + item.poster_path"
                class="item-poster-image"
              />
              <span class="item-type">{{ normalizeMediaType(item.media_type) === 'tv' ? t('video.tv') : t('video.movie') }}</span>
            </div>
            <span class="item-name">{{ item.name || item.title }}</span>
            <span class="item-date">{{ (item.release_date || item.first_air_date || '').slice(0, 4) }}</span>
          </div>
        </template>
      </wil-list>
      <wil-empty v-else :text="t('video.onlySearchVideoName')"></wil-empty>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import wilList from '@/components/mobile/wil-list/index.vue'
import wilEmpty from '@/components/mobile/wil-empty/index.vue'
import wilIcon from '@/components/common/wil-icon/index.vue'
import * as CONFIG from '@/utils/config'
import { searchMovieTvMulti } from '@/utils/tmdb'
import {
  getMovieTvData, normalizeMediaType, resolveManualMatch, MATCH_RESULT,
} from '@/utils/scrape'

const router = useRouter()
const route = useRoute()
const { t } = useI18n()

const searchValue = ref('')
const requestParams = ref({})
const wil_list = ref(null)

const responseAdapter = result => {
  if (!result) return { listData: [], listTotal: 0 }
  return { listData: result.results || [], listTotal: +result.total_results }
}

const searchMovieTv = data => searchMovieTvMulti(data)

const toSearch = () => {
  requestParams.value = { query: searchValue.value }
}
const toCancel = () => {
  searchValue.value = ''
  requestParams.value = {}
}
const back = () => router.back()

const toast = title => uni.showToast({ title, icon: 'none' })

const handleSelect = async item => {
  if (!item) return
  const result = await resolveManualMatch({
    item,
    workKey: route.query.workKey,
    currentType: route.query.type,
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
  if (result.code === MATCH_RESULT.CONFLICT || result.code === MATCH_RESULT.DUPLICATE) {
    toast(t('video.duplicateVideoInLibrary'))
    return
  }
  if (result.code === MATCH_RESULT.FAILED) {
    toast(t('video.matchFailed'))
    return
  }
  // 旧模式（无 workKey）：写 resetMovieTv 缓存，由详情页消费
  if (!route.query.workKey && result.type) {
    uni.setStorageSync('resetMovieTv', { type: result.type, movieTvId: result.tmdbId, name: result.name })
  }
  toast(t('video.matchSuccess'))
  setTimeout(() => router.back(), 600)
}

// 从详情页带片名过来时预填并直接搜一次
if (route.query.query) {
  let q = route.query.query
  try { q = decodeURIComponent(q) } catch { /* 已是解码后的值 */ }
  searchValue.value = q
  requestParams.value = { query: q }
}
</script>

<style lang="scss" scoped>
.search-match {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 24px;
  box-sizing: border-box;

  &-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 20px;
    font-weight: 600;
    padding-bottom: 16px;
  }
  &-back {
    cursor: pointer;
  }
  &-bar {
    display: flex;
    gap: 12px;
    align-items: center;
    padding-bottom: 16px;
  }
  &-list {
    flex: 1;
    overflow: auto;
  }
  &-list__item {
    cursor: pointer;
    .item-poster {
      position: relative;
      width: 100%;
      aspect-ratio: 2 / 3;
      border-radius: 6px;
      overflow: hidden;
      background: #f0f0f0;
    }
    .item-poster-image {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .item-type {
      position: absolute;
      right: 6px;
      bottom: 6px;
      padding: 0 6px;
      font-size: 12px;
      line-height: 20px;
      color: #fff;
      background: rgba(0, 0, 0, 0.6);
      border-radius: 4px;
    }
    .item-name {
      display: block;
      margin-top: 6px;
      font-size: 14px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .item-date {
      display: block;
      color: #999;
      font-size: 12px;
    }
  }
}
</style>
