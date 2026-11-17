<template>
  <div class="home-all">
    <wil-title :title="route.query.title"></wil-title>
    <div class="home-all-list">
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
          <div class="home-all-list__item" @click="toDetail(item)">
            <div class="item-poster">
              <img
                :src="!routerParams.isConnected && !item.loadImg ? posterEmpty : setEmptyImg(item.poster)"
                class="item-poster-image"
                mode="aspectFill"
                @error="imgError(item)"
                @load="imgLoad(item)"
              />
              <!-- 评分徽标：对齐爆米花，贴在海报右下角 -->
              <span v-if="showVote(item)" class="item-vote">{{ voteText(item) }}</span>
            </div>
            <span class="item-name">{{ removeExtension(item) }}</span>
            <span class="item-time" v-if="!item.notShowTime">{{ cardSubText(item, t) }}</span>
          </div>
        </template>
      </wil-list>
    </div>
  </div>
</template>

<script setup>
import wilTitle from '@/components/electron/wil-title/index.vue'
import wilList from '@/components/mobile/wil-list/index.vue'
import { useVideoAll } from '@/hooks/useVideoAll'
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { handleSeasonName } from '@/utils/scrape'
import { showVote, voteText, cardSubText } from '@/utils/card-meta'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const wil_list = ref(null)

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
} = useVideoAll({ wil_list, route })

const toDetail = item => {
  router.push({
    path: '/homeDetail',
    query: { name: handleSeasonName(item.name, true), type: item.type == '1' ? 'tv' : 'movie', source: JSON.stringify(item.source), movieTvId: item.movieTvId, workKey: item.workKey || '' },
  })
}
</script>

<style lang="scss" scoped>
.home-all {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;

  .home-all-list {
    flex: 1;
    overflow: hidden;

    :deep(.load-list) {
      height: 100%;
      overflow: hidden;

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

          .home-all-list__item {
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

            // 评分徽标：贴在海报右下角（.item-poster 已是 position: relative）
            .item-vote {
              position: absolute;
              right: 8rpx;
              bottom: 8rpx;
              padding: 0 10rpx;
              height: 34rpx;
              line-height: 34rpx;
              border-radius: 8rpx;
              background: rgba(0, 0, 0, 0.6);
              color: #ffc93c;
              font-size: 22rpx;
              font-weight: bold;
            }
          }
          &:nth-child(8n + 1) {
            margin-left: 0;
          }
        }
      }
    }
  }
}
</style>
