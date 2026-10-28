<template>
  <div class="emby">
    <home-navbar :showRefresh="false" :isEmby="true" ref="video_navbar"></home-navbar>
    <template v-if="classifyList?.length">
      <under-img :imgArr="underImgArr" :swipeIndex="swipeIndex" :leave="leave"></under-img>
      <div class="emby-list">
        <recent-played v-if="historyPlay.length" :listData="historyPlay" type="emby"></recent-played>
        <div class="emby-media" v-if="classifyList?.length">
          <div class="emby-media-title">
            <img :src="embyIcon" />
            <span>{{ t('video.myMedia') }}</span>
          </div>
          <div class="emby-media-list">
            <div class="emby-media-list__item" v-for="item in classifyList" :key="item.id">
              <img :src="setEmptyImg(item.poster)" />
              <span>{{ item.name }}</span>
            </div>
          </div>
        </div>
        <hx-list :listData="item.list" :title="item.name" v-for="item in showList" :key="item.id" type="emby" @clickAll="clickAll(item)"></hx-list>
      </div>
    </template>
    <wil-empty type="data" v-else :text="t('common.noData')"></wil-empty>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import underImg from '../components/under-img.vue'
import emptyBg from '@/static/poster-empty.png'
import hxList from '../home/components/hx-list.vue'
import homeNavbar from '../home/components/navbar.vue'
import recentPlayed from '../home/components/recent-played.vue'
import wilEmpty from '@/components/mobile/wil-empty/index.vue'
import { useRouter } from 'vue-router'
import { getMainView, getEmbyList, getEmbyNewList, getHistoryList } from '@/utils/emby'
import type { EmbyCollectionItem, ProcessedCollectionItem, EmbyQueryParams, ClassifyItem, SourceList, HistoryItem } from './types'
import { judgeSelect } from '@/utils/tools'
import dayjs from 'dayjs'
import { useI18n } from 'vue-i18n'
import { onShow } from '@dcloudio/uni-app'

const { t } = useI18n()
const router = useRouter()

const underImgArr = ref<string[]>([])
const swipeIndex = ref(0)
const leave = ref(false)
const showList = ref<ClassifyItem[]>([])
const sourceList = ref<SourceList[]>([])
const selectType = ref<Partial<SourceList>>({})
const selectMedia = ref<Record<string, any>>({})
const historyPlay = ref<HistoryItem[]>([])

let timer: ReturnType<typeof setInterval> | null = null

const embyIcon: string = 'https://emby.media/support/images/logo.png'
const classifyList = ref<ClassifyItem[]>(uni.getStorageSync('embyMovieTvList') || [])

const setEmptyImg = (poster: string | null): string => {
  if (poster) {
    return poster
  } else {
    return emptyBg
  }
}

const setUnderImg = (): void => {
  if (classifyList.value?.length) {
    let oneNumber = Math.ceil(6 / classifyList.value.length)
    classifyList.value.forEach((item: ClassifyItem) => {
      const posters = item.list.slice(0, oneNumber).map((i: { poster: string }) => i.poster)
      underImgArr.value.push(...posters)
    })
    startAutoPlay()
  }
}

const setShowList = (): void => {
  const CollectionTypeArr = ['movies', 'tvshows', 'music', 'games', 'books', 'musicvideos', 'homevideos', 'livetv', 'channels']
  showList.value = classifyList.value.filter(i => CollectionTypeArr.includes(i.collectionType))
}

//开始轮播背景图
const startAutoPlay = (): void => {
  if (timer !== null) return
  timer = setInterval(() => {
    leave.value = true
    setTimeout(() => {
      if (swipeIndex.value === underImgArr.value.length - 1) {
        swipeIndex.value = 0
      } else {
        swipeIndex.value++
      }
      leave.value = false
    }, 350)
  }, 5000)
}

//点击全部
const clickAll = (item: ClassifyItem) => {
  const typeMapping = {
    tvshows: 'Series',
    movies: 'Movie',
  }
  router.push({
    path: '/embyAll',
    query: {
      title: item.name,
      type: 'emby',
      embyParentId: item.id,
      embyIncludeItemTypes: typeMapping[item.collectionType as keyof typeof typeMapping],
      isConnected1: 'true',
    },
  })
}
//Emby的refresh
const refreshEmby = async (): Promise<void> => {
  const CollectionTypeArr = ['movies', 'tvshows', 'music', 'games', 'books', 'musicvideos', 'homevideos', 'livetv', 'channels']
  let res1 = await getMainView(selectMedia.value)
  const imgApiKey = selectMedia.value.token ? `&api_key=${selectMedia.value.token}` : ''
  let embyMovieTvList = res1.Items.map((v: EmbyCollectionItem) => {
    return {
      name: v.Name,
      collectionType: v.CollectionType,
      poster: v?.ImageTags?.Primary
        ? `${selectMedia.value.protocol}://${selectMedia.value.address}:${selectMedia.value.port}/emby/Items/${v.Id}/Images/Primary?tag=${v.ImageTags.Primary}${imgApiKey}`
        : emptyBg,
      id: v.Id,
      list: [],
    }
  })
  let embyObj: EmbyQueryParams = {
    EnableImageTypes: 'Primary,Backdrop,Thumb',
    Fields: 'BasicSyncInfo,CanDelete,Container,PrimaryImageAspectRatio,ProductionYear,Status,EndDate,Prefix',
    MediaTypes: 'Video',
    Limit: '20',
    Recursive: true,
    ImageTypeLimit: '1',
  }
  await Promise.all(
    embyMovieTvList.map(async (v: ProcessedCollectionItem) => {
      if (CollectionTypeArr.includes(v.collectionType)) {
        embyObj.ParentId = v.id
        let res2 = await getEmbyNewList(embyObj, selectMedia.value)
        let arr = res2.map((i: EmbyCollectionItem) => {
          return {
            id: i.Id,
            name: i.Name,
            provider: 'Emby',
            releaseTime: dayjs(i.EndDate).format('YYYY-MM-DD'),
            poster: i?.ImageTags?.Primary
              ? `${selectMedia.value.protocol}://${selectMedia.value.address}:${selectMedia.value.port}/emby/Items/${i.Id}/Images/Primary?tag=${i.ImageTags.Primary}${imgApiKey}`
              : emptyBg,
            type: i.Type,
          }
        })
        v.list = arr
      }
    })
  )
  uni.setStorageSync('embyMovieTvList', embyMovieTvList)
  classifyList.value = embyMovieTvList
  underImgArr.value = []
  swipeIndex.value = 0
  setUnderImg()
  setShowList()
}

//获取历史播放记录
const getHistoryEmby = async (): Promise<void> => {
  let embyObj: EmbyQueryParams = {
    EnableImageTypes: 'Primary,Backdrop,Thumb',
    Fields: 'BasicSyncInfo,CanDelete,PrimaryImageAspectRatio,ProductionYear',
    MediaTypes: 'Video',
    Limit: '1000',
    Recursive: true,
    ImageTypeLimit: '1',
  }
  let res = await getHistoryList(embyObj, selectMedia.value)
  historyPlay.value = res.rows
}

const initSelect = () => {
  const { selectMedia: media, selectType: type }: { selectMedia: Record<string, any>; selectType: any } = judgeSelect('emby')
  selectMedia.value = media
  selectType.value = type
}

setUnderImg()
setShowList()
initSelect()
getHistoryEmby()
refreshEmby()
onShow(() => {
  let isreload = uni.getStorageSync('isreload')
  if (isreload) {
    uni.removeStorageSync('isreload')
    refreshEmby()
    getHistoryEmby()
  }
})
</script>

<style lang="scss" scoped>
.emby {
  position: relative;
  width: 100%;
  height: 100%;
  background: #fff;
  overflow: hidden;
  :deep(.under-img) {
    top: 0;
    left: 0;
  }
  .emby-list {
    width: 100%;
    height: 100%;
    overflow: auto;
    padding: 100rpx;
    :deep(.recent-played) {
      position: relative;
      z-index: 99;
      .recent-played-title {
        .recent-played-title-right {
          span {
            color: rgb(82, 181, 75);
          }
        }
      }
    }
    .emby-media {
      position: relative;
      z-index: 99;
      margin-bottom: 50rpx;
      .emby-media-title {
        display: flex;
        align-items: center;

        img {
          display: block;
          width: 44rpx;
          height: 44rpx;
          object-fit: cover;
          object-position: left;
        }

        span {
          font-size: 36rpx;
          font-weight: bold;
          color: #000;
        }
      }

      .emby-media-list {
        display: flex;
        align-items: center;
        flex-wrap: nowrap;
        margin-top: 24rpx;

        .emby-media-list__item {
          margin-left: 24rpx;
          flex: 0 0 calc((100% - 72rpx) / 4);
          cursor: pointer;
          overflow: hidden;

          img {
            width: 100%;
            aspect-ratio: 13/8;
            // display: block;
            object-fit: cover;
            object-position: center;
            border-radius: 20rpx;
          }

          span {
            font-size: 28rpx;
            font-weight: bold;
            color: #000;
            display: block;
            width: 100%;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          &:first-child {
            margin-left: 0;
          }
        }
      }
    }
    :deep(.hxList) {
      position: relative;
      z-index: 99;
    }
  }
  :deep(.wil-empty) {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }
}
</style>
