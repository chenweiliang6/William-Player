<template>
  <div :class="['history-played', themeClass]">
    <wil-navbar :title="getTitleText()" :leftShow="true">
      <template #right>
        <span style="color: #2457fd; font-weight: bold" @click="editHistory()">{{ isSelect ? t('common.cancel') : t('common.edit') }}</span>
      </template>
    </wil-navbar>
    <div class="history-played-list" v-if="!isClearAll">
      <wil-list
        :requestFn="getHistoryList"
        :request-params="requestParams"
        ref="wil_list"
        :refresherEnabled="false"
        idKey="path"
        listContainerClass="list-recent"
        :pageSize="windowWidth > 700 ? 50 : 12"
        :changeItemFn="changeItemFn"
        :listItemStyle="listItemStyle"
        :style="{ '--line-number': lineNumber, '--line-height': lineHeight }"
      >
        <template #default="item">
          <div class="history-played-list__item" @click="toPlayHistory(item)" @longpress="longPress(item)">
            <div class="item-poster">
              <image
                :src="!routerParams.isConnected && !item.loadImg ? posterEmpty : setRecentImg(item.poster)"
                class="item-poster-image"
                mode="aspectFill"
                @error="imgError(item)"
                @load="imgLoad(item)"
              />
              <div :class="[item.select ? 'item-poster-check' : 'item-poster-nocheck']" v-if="isSelect">
                <wil-icon name="bangdingchenggong" custom-color="#ff6701" size="30rpx" />
              </div>
            </div>
            <span class="item-name">{{ removeExtension(item) }}</span>
          </div>
        </template>
      </wil-list>
    </div>
    <wil-empty v-else :text="t('common.noMore')"></wil-empty>
    <div class="history-played-bottom" v-if="isSelect">
      <div class="history-played-bottom__left" @click="clearAll">{{ t('common.clearAll') }}</div>
      <div class="history-played-bottom__right" :style="{ color: recentSelect.length ? 'var(--app-danger)' : 'var(--app-text-tertiary)' }" @click="clearPart">
        {{ recentSelect.length ? t('common.delete') : t('common.cancel') }}
      </div>
    </div>
    <wil-modal ref="wil_modal"></wil-modal>
  </div>
</template>

<script setup>
import wilList from '@/components/mobile/wil-list/index.vue'
// import emptyBg from "@/static/empty_bg.png";
import posterEmpty from '@/static/poster-empty.png'
import wilNavbar from '@/components/mobile/wil-navbar/index.vue'
import wilModal from '@/components/mobile/wil-modal/index.vue'
import wilEmpty from '@/components/mobile/wil-empty/index.vue'
import wilIcon from '@/components/common/wil-icon/index.vue'
import { useHistoryPlayed } from '@/hooks/useHistoryPlayed'
import { ref } from 'vue'
import { useThemeClass } from '@/hooks/useThemeClass'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const wil_list = ref(null)
const wil_modal = ref(null)
const themeClass = useThemeClass()

const {
  requestParams,
  isClearAll,
  routerParams,
  getTitleText,
  lineNumber,
  lineHeight,
  changeItemFn,
  isSelect,
  windowWidth,
  recentSelect,
  editHistory,
  getHistoryList,
  listItemStyle,
  toPlayHistory,
  longPress,
  setRecentImg,
  imgError,
  imgLoad,
  removeExtension,
  clearAll,
  clearPart,
} = useHistoryPlayed({ wil_list, wil_modal })
</script>

<style lang="scss" scoped>
page {
  width: 100%;
  height: 100%;
}

.history-played {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  ::v-deep .wil-navbar {
    .nut-navbar {
      overflow: visible;

      .nut-navbar__right {
        display: block;
        position: absolute;
        right: 0;
        display: flex;
        align-items: center;
      }
    }
  }

  .history-played-list {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;

    // padding-top: 16px;
    ::v-deep .load-list {
      flex: 1;
      overflow: hidden;

      .list-recent {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        padding: 0 24rpx;
        padding-top: 32rpx;

        // gap: 24rpx;
        .list-item {
          margin-bottom: 24rpx;
          // flex: 1 1 218rpx;
          min-width: 218rpx;
          /* 确保最小宽度 */
          flex: 0 0 calc((100% - (var(--line-number) - 1) * 24rpx) / var(--line-number));

          .history-played-list__item {
            .item-poster {
              width: 100%;
              height: var(--line-height);
              // aspect-ratio: 169.5/90; /* 高度 = (109/160) × 宽度 */
              // height: 180rpx;
              border-radius: 20rpx;
              position: relative;

              .item-poster-image {
                width: 100%;
                height: 100%;
                border-radius: 20rpx;
                object-fit: cover;
              }

              .item-poster-runtime {
                position: absolute;
                right: 10rpx;
                bottom: 10rpx;
                background: rgba(0, 0, 0, 0.5);
                color: #fff;
                font-size: 24rpx;
                border-radius: 8rpx;
                padding: 4rpx 8rpx;
              }

              .item-poster-process {
                height: 3.5rpx;
                background: #ff6701;
                position: absolute;
                bottom: 0;
                left: 0;
              }

              .item-poster-check {
                width: 30rpx;
                height: 30rpx;
                box-sizing: border-box;
                // border: 2rpx solid #ff6701;
                background: #ff6701;
                position: absolute;
                top: 20rpx;
                right: 20rpx;
                border-radius: 8rpx;

                image {
                  display: block;
                  width: 100%;
                  height: 100%;
                }
              }

              .item-poster-nocheck {
                width: 30rpx;
                height: 30rpx;
                box-sizing: border-box;
                border: 2rpx solid #ff6701;
                background: var(--app-bg-card);
                position: absolute;
                top: 20rpx;
                right: 20rpx;
                border-radius: 8rpx;
              }
            }

            .item-name {
              font-size: 28rpx;
              font-weight: bold;
              color: var(--app-text-primary);
            }

            .item-time {
              font-size: 24rpx;
              color: gray;
              padding-top: 6rpx;
            }
          }

          &:nth-child(2n + 1) {
            margin-left: 0;
          }
        }
      }
    }
  }

  .history-played-bottom {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 24rpx;
    font-size: 32rpx;
    font-weight: bold;
    height: 120rpx;
    border-top: 2rpx solid var(--app-border);
    box-shadow: 0px 4px 10px 0px rgba(0, 0, 0, 0.3);

    &__left {
      color: #2457fd;
    }

    &__right {
      color: var(--app-text-tertiary);
    }
  }
}
</style>
