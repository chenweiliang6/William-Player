<template>
  <div class="list-item">
    <div class="list-item__container">
      <div class="container-left">
        <div class="container-left-img">
          <image :src="props.data.imgUrl" mode="aspectFill"  />
        </div>
        <div class="container-left-info">
          <div class="container-left-info__name">{{ props.data.name }}</div>
          <div class="container-left-info__error" v-if="isError">{{ errorText }}</div>
          <div class="container-left-info__size" v-else>
            <span class="size-value">{{ props.data.status === 'COMPLETED' ? props.data.total_size : props.data.current_size + ' / ' + props.data.total_size }}</span>
            <template v-if="props.data.status !== 'COMPLETED'">
              <span class="size-icon"></span>
              <span class="size-rate">{{ rateText }}</span>
            </template>
          </div>
        </div>
      </div>
      <div class="container-right">
        <wil-icon name="zanting" class="theme-icon" @click.stop="pauseById(props.data.id)" v-if="isRunning" />
        <wil-icon name="icon_play" class="theme-icon" @click.stop="resumeById(props.data.id)" v-if="props.data.status === 'PAUSED'" />
        <!-- 直链过期（3007）重试无解，只保留删除，让用户重新添加 -->
        <wil-icon name="reload" class="theme-icon" @click.stop="resumeById(props.data.id)" v-if="isError && !isLinkExpired" />
        <wil-icon name="shanchu" class="delete-icon" @click.stop="deleteById(props.data)" />
      </div>
    </div>
    <div class="list-item__progress">
      <wil-progress
        v-if="props.data.percent < 100"
        :percentage="props.data.percent"
        strokeWidth="10rpx"
        :showText="false"
        color="linear-gradient(270deg, rgb(18, 126, 255) 0%, rgb(32, 147, 255) 32.8156%, rgb(13, 242, 204) 100%)"></wil-progress>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import wilProgress from '@/components/mobile/wil-progress/index.vue'
import wilIcon from '@/components/common/wil-icon/index.vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const props = defineProps({
  data: { type: Object, default: {} },
})

const emits = defineEmits(['pauseById', 'resumeById', 'deleteById'])

//进行中的状态（v2 的 WAITING/CONNECTING 也要按进行中渲染，否则按钮会消失）
const RUNNING_STATUS = ['DOWNLOADING', 'WAITING', 'CONNECTING']
const isRunning = computed(() => RUNNING_STATUS.includes(props.data.status))
const isError = computed(() => props.data.status === 'ERROR')
//3007 = 云盘直链签名过期，重试无解，只能删除后重新添加
const isLinkExpired = computed(() => props.data.errorCode === 3007)

const errorText = computed(() => (isLinkExpired.value ? t('toolbox.downloadLinkExpired') : props.data.errorMsg || t('toolbox.downloadFailed')))

const rateText = computed(() => {
  if (props.data.status === 'WAITING') return t('toolbox.downloadWaiting')
  return props.data.speedText || '0 B/s'
})

const pauseById = id => {
  emits('pauseById', id)
}
const resumeById = id => {
  emits('resumeById', id)
}
const deleteById = item => {
  emits('deleteById', item)
}
</script>

<style lang="scss" scoped>
.list-item {
  display: flex;
  flex-direction: column;
  &:active {
    background: var(--app-bg-secondary);
  }
  .list-item__container {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 24rpx;
    .container-left {
      display: flex;
      .container-left-img {
        image {
          display: block;
          width: 120rpx;
          height: 120rpx;
          border-radius: 20rpx;
        }
      }
      .container-left-info {
        margin-left: 36rpx;
        .container-left-info__name {
          font-size: 32rpx;
          font-weight: bold;
          color: var(--app-text-primary);
        }
        .container-left-info__size {
          font-size: 28rpx;
          color: var(--app-text-tertiary);
          margin-top: 16rpx;
          display: flex;
          align-items: center;
          span{
            display: block;
          }
          .size-icon{
            width: 8rpx;
            height: 8rpx;
            border-radius: 50%;
            background: var(--app-text-tertiary);
            margin: 0 12rpx;
          }
        }
        .container-left-info__error {
          font-size: 28rpx;
          color: var(--app-danger);
          margin-top: 16rpx;
        }
      }
    }
    .container-right {
      display: flex;
      .iconfont {
        display: block;
        font-size: 40rpx;
        color: var(--app-icon-strong);
        &:last-child {
          margin-left: 24rpx;
        }
      }
      .delete-icon {
        color: var(--app-danger);
      }
    }
  }
  .list-item__progress {
    height: 10rpx;
    :deep(.wil-progress) {
      .wil-progress-outer {
        border-radius: 0;
        background-color: transparent;
        .wil-progress-inner {
          border-radius: 0 24rpx 24rpx 0;
        }
      }
    }
  }
}
</style>
