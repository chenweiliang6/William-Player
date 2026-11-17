<template>
  <div :class="['select-folder', themeClass]">
    <div class="select-folder-title">
      <nut-icon name="rect-left" :custom-color="iconColor" @click="toBack(false)"></nut-icon>
      <span>{{ t('source.addMovieDirectory', { title: props.title }) }}</span>
      <span class="title-right" @click="confirm">{{ t('common.confirm') }}</span>
    </div>
    <wil-list
      :requestFn="getFileList"
      ref="load_list"
      idKey="name"
      :pageSize="60"
      :key="key"
      :responseAdapter="responseAdapter"
      @currentData="handleData"
      :refresher-enabled="false"
    >
      <template #default="item">
        <nut-cell is-link :class="[item.$index == data.total - 1 ? 'last-cell' : '']" @click="clickCell(item)">
          <template #title>
            {{ item.name.length > 12 ? item.name.slice(0, 12) + '...' : item.name }}
          </template>
          <template #icon>
            <div class="cell-icon">
              <wil-icon
                name="kqxz"
                :custom-color="selectName == item.name ? '#ff6701' : 'var(--app-icon-disabled)'"
                class="cell-check"
                @click.stop="chooseName(item)"
                v-if="item.type == '1'"
              />
              <image v-if="fileIconOf(item).kind === 'image'" :src="fileIconOf(item).value" />
              <wil-icon v-else :name="fileIconOf(item).value" :custom-color="fileIconOf(item).color" class="cell-glyph" />
            </div>
          </template>
          <template #link>
            <span v-if="item.type != '1'">{{ handleSize(item.size) }}</span>
            <span v-else></span>
          </template>
        </nut-cell>
      </template>
    </wil-list>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import wilList from '@/components/mobile/wil-list/index.vue'
import wilIcon from '@/components/common/wil-icon/index.vue'
import { useSelectFolder } from '@/hooks/useSelectFolder'
import { useThemeColors } from '@/hooks/useThemeColors'
import { useThemeClass } from '@/hooks/useThemeClass'

const { t } = useI18n()
const themeClass = useThemeClass()
const props = defineProps({
  selectType: { type: Object, default: {} },
  selectMedia: { type: Object, default: {} },
  result: { type: Object, default: {} },
  title: { type: String, default: '' },
})

const emits = defineEmits(['openSource', 'confirm'])

const { data, key, selectName, responseAdapter, handleData, handleSize, chooseName, toBack, getFileList, clickCell, fileIconOf, confirm } = useSelectFolder({
  selectType: props.selectType,
  selectMedia: props.selectMedia,
  result: props.result,
  title: props.title,
  emits: emits,
})
const { iconColor } = useThemeColors()
</script>

<style lang="scss" scoped>
.select-folder {
  width: 100%;
  height: 100%;
  background: var(--app-bg);
  color: var(--app-text-primary);
  box-sizing: border-box;
  margin-top: 0;
  display: flex;
  flex-direction: column;

  .select-folder-title {
    width: 100%;
    padding-top: 24rpx;
    font-size: 34rpx;
    font-weight: bold;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--app-text-primary);

    :deep(.nut-icon) {
      position: absolute;
      left: 24rpx;
    }

    .title-right {
      color: var(--app-brand);
      font-size: 32rpx;
      position: absolute;
      right: 24rpx;
    }
  }

  ::v-deep .load-list {
    flex: 1;
    padding: 0 24rpx;
    padding-top: 24rpx;
    box-sizing: border-box;
    overflow: hidden;

    .list-item {
      &:first-child {
        .nut-cell {
          // border-radius: 24rpx 24rpx 0 0;
          border-top-left-radius: 24rpx;
          border-top-right-radius: 24rpx;
        }
      }

      .nut-cell {
        margin: 0;
        padding: 24rpx;
        background: var(--app-bg-card);
        align-items: center;
        box-shadow: none;
        border-radius: 0;

        &::after {
          border-bottom: 2rpx solid var(--app-border) !important;
          /* position: absolute !important;
          box-sizing: border-box !important;
          content: " " !important;
          pointer-events: none !important;
          right: 32rpx !important;
          bottom: 0 !important;
          left: 32rpx !important;
          -webkit-transform: scaleY(0.5) !important;
          -ms-transform: scaleY(0.5) !important;
          transform: scaleY(0.5) !important; */
        }

        .nut-cell__icon {
          margin-right: 16rpx;

          .cell-icon {
            display: flex;
            align-items: center;

            image {
              width: 60rpx;
              height: 60rpx;
              object-fit: cover;
            }

            .cell-check {
              font-size: 40rpx;
              margin-right: 20rpx;
            }

            .cell-glyph {
              font-size: 60rpx;
            }
          }
        }

        .nut-cell__value {
          color: var(--app-text-tertiary);
        }

        .nut-cell__title {
          justify-content: center;
          font-size: 30rpx;
          color: var(--app-text-primary);
          line-height: normal;

          .wil-cell__title {
            display: flex;
            align-items: center;

            span:last-child {
              padding-left: 24rpx;
            }
          }

          // font-weight: bold;
        }
      }

      .last-cell {
        // border-radius: 0 0 24rpx 24rpx;
        border-bottom-right-radius: 24rpx;
        border-bottom-left-radius: 24rpx;

        &::after {
          display: none;
        }
      }
    }

    .load-list__finished-text {
      margin-top: 24rpx;
      color: var(--app-text-tertiary);
    }
  }
}
</style>
