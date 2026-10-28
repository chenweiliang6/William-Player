<template>
  <div class="emby-all">
    <div class="emby-all-title" :style="{ paddingBottom: tabList.length ? '24rpx' : '0' }">
      <wil-title :title="String(route.query.title)" :style="{ position: tabList.length ? 'absolute' : 'static' }"></wil-title>
      <div class="emby-all-tabs" v-if="tabList.length">
        <nut-radio-group v-model="embyActiveTab" direction="horizontal" @change="changeTab">
          <nut-radio :label="item.title" shape="button" v-for="item in tabList" :key="item.title">{{ item.title }}</nut-radio>
        </nut-radio-group>
      </div>
    </div>
    <wil-list
      :requestFn="getMovieTvList"
      :request-params="requestParams"
      ref="wil_list"
      :refresherEnabled="false"
      idKey="path"
      listContainerClass="list-container"
      :pageSize="windowWidth > 700 ? 50 : 12"
      :changeItemFn="changeItemFn"
    >
      <template #default="item">
        <div class="video-all-list__item" @click="handlePushVideoDetail(item)">
          <div class="item-poster">
            <img
              :src="!routerParams.isConnected && !item.loadImg ? posterEmpty : setEmptyImg(item.poster)"
              class="item-poster-image"
              mode="aspectFill"
              @error="imgError(item)"
              @load="imgLoad(item)"
            />
          </div>
          <span class="item-name">{{ removeExtension(item) }}</span>
          <span class="item-time" v-if="!item.notShowTime">{{ item.releaseTime || t('video.noReleaseTime') }}</span>
        </div>
      </template>
    </wil-list>
  </div>
</template>

<script setup lang="ts">
import { onBeforeMount, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import posterEmpty from '@/static/poster-empty.png'
import wilList from '@/components/mobile/wil-list/index.vue'
import { useVideoAll } from '@/hooks/useVideoAll'
import wilTitle from '@/components/electron/wil-title/index.vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const route = useRoute()
const router = useRouter()

const wil_list = ref(null)

type ListItem = {
  loadImg: boolean
  poster: string
  notShowTime: boolean
  releaseTime: string
  name: string
  type: string
  id: number | string
}

const {
  routerParams,
  showPopover,
  mapping,
  changeSort,
  tabList,
  changeTab,
  getMovieTvList,
  requestParams,
  windowWidth,
  changeItemFn,
  listItemStyle,
  lineNumber,
  lineHeight,
  embyActiveTab,
  toVideoDetail,
  setEmptyImg,
  imgError,
  imgLoad,
  removeExtension,
} = useVideoAll({ wil_list, route: route as any }) as any

const handlePushVideoDetail = (item: ListItem) => {
  const path = route.path === '/embyAll' ? '/embyAll-copy' : '/embyAll'
  if (item.type == 'Genre') {
    router.push({
      path: path,
      query: {
        title: item.name,
        embyIncludeItemTypes: 'Genres',
        type: 'emby',
        GenreIds: item.id,
        embyParentId: routerParams.value.embyParentId,
        genreType: routerParams.value.embyIncludeItemTypes,
        isConnected1: 'true',
      },
    })
  } else if (item.type == 'Folder') {
    router.push({
      path: path,
      query: {
        title: item.name,
        embyIncludeItemTypes: 'Folder',
        type: 'emby',
        embyParentId: item.id,
        isConnected1: 'true',
      },
    })
  } else if (item.type == 'Series' || item.type == 'Movie') {
    //直接跳转到剧集或者电影的详情页
    router.push({
      path: '/embyDetail',
      query: {
        name: item.name,
        title: item.name,
        type: item.type == 'Series' ? 'tv' : 'movie',
        movieTvId: item.id,
        isEmby: 'true',
      },
    })
  }
}
onBeforeMount(() => {
  console.log('初始化进入')
})
</script>

<style lang="scss" scoped>
.emby-all {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  .emby-all-title {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    :deep(.wil-title) {
      z-index: 1;
      left: 0;
    }
    .emby-all-tabs {
      // width: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 9;
      :deep(.nut-radio-group) {
        .nut-radio--button {
          margin-bottom: 0;
          .nut-radio__button {
            cursor: pointer;
            padding: 16rpx 46rpx;
            font-size: 32rpx;
            font-weight: bold;
            &::after {
              display: none;
            }
          }
        }
      }
    }
  }

  :deep(.load-list) {
    // height: 100%;
    overflow: hidden;
    flex: 1;

    .list-container {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      padding: 0 24rpx;
      padding-top: 16px;

      .list-item {
        margin-bottom: 24rpx;
        // flex: 1 1 218rpx;
        // min-width: 218rpx;
        /* 确保最小宽度 */
        flex: 0 0 calc((100% - 168rpx) / 8);
        margin-left: 24rpx;

        .video-all-list__item {
          cursor: pointer;

          .item-poster {
            width: 100%;
            aspect-ratio: 109/160;
            /* 高度 = (109/160) × 宽度 */
            border-radius: 20rpx;
            position: relative;
            display: inline-block;

            .item-poster-image {
              width: 100% !important;
              height: 100%;
              border-radius: 20rpx;
              object-fit: cover;
            }
          }

          .item-name {
            font-size: 28rpx;
            font-weight: bold;
            color: #000;
            display: block;
          }

          .item-time {
            font-size: 24rpx;
            color: gray;
            padding-top: 6rpx;
            display: block;
          }
        }
        &:nth-child(8n + 1) {
          margin-left: 0;
        }
      }
    }
  }
}
</style>
