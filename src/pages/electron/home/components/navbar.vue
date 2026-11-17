<template>
  <div class="home-navbar">
    <div class="home-navbar-container">
      <wil-icon name="sousuo" custom-color="#000015" class="navbar-icon" @click="toSearch" />
      <wil-icon name="shuaxin" custom-color="#000015" :class="['navbar-icon', 'home-navbar-container__refresh', loading ? 'refresh-rotate' : '']" @click="showProgress" v-if="props.showRefresh" />
      <wil-icon name="jia" custom-color="#000015" class="navbar-icon" @click="toSourceList" />
    </div>
    <!-- 使用teleport挂载到body去 -->
    <template v-if="showPopover && props.showRefresh">
      <div :class="['home-navbar-arrow', isShowPopover ? 'popover-in' : 'popover-out']" :style="{ left: popoverStyle.left, top: popoverStyle.top }">
        <image src="@/static/rect-san.png" style="width: 100%; height: 100%"></image>
      </div>
      <div
        :class="['home-navbar-popover', , isShowPopover ? 'popover-in' : 'popover-out']"
        :style="{ left: popoverStyle.left, top: +popoverStyle?.top?.split('px')[0] + 12 + 'px' }"
      >
        <div class="popover-title">
          <div class="popover-title-left">
            <span>{{ popoverData.title }}</span>
            <span class="popover-title-left__button" v-if="loading" @click="toCancel">{{ t('video.cancelScan') }}</span>
          </div>
        </div>
        <div class="popover-list">
          <div class="popover-list-item" v-for="(item, index) in popoverData.list" :key="item.label">
            <span>{{ item.label }}</span>
            <span>{{ item.value }}</span>
            <template v-if="index != popoverData.list.length - 1">，</template>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import dayjs from 'dayjs'
import { onUnload } from '@dcloudio/uni-app'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { findActiveSource } from '@/utils/tools'
import wilIcon from '@/components/common/wil-icon/index.vue'

const { t } = useI18n()

const router = useRouter()

const props = defineProps({
  refreshData: { type: Object, default: {} },
  loading: { type: Boolean, default: false },
  showRefresh: { type: Boolean, default: true },
  isEmby: { type: Boolean, default: false },
})
const emits = defineEmits(['refresh', 'pause'])

const loading = ref(false) //是否正在旋转，刮削中
const showPopover = ref(false) //是否显示蓝色的框，用来显示刮削到多少部影片
const popoverData = ref({
  left: '0px',
  top: '0px',
}) //用于存储蓝色框显示的数据
const selectType = ref({}) //被选中资源的type
const selectMedia = ref({}) //被选中资源的media

const timer1 = ref(null)
const timer2 = ref(null)

const popoverStyle = ref({})
const isShowPopover = ref(false)

const toSearch = () => {
  router.push({
    path: '/search',
    query: { isEmby: props.isEmby ? '1' : '0' },
  })
}

const toSourceList = () => {
  router.push({
    path: '/sourceList',
    query: { isEmby: props.isEmby ? '1' : '0' },
  })
}

//判断选择的是webdav还是天翼云盘还是夸克
const judgeSelect = () => {
  let sourceList = uni.getStorageSync('sourceList')
  selectType.value = sourceList.find(item => {
    let select = findActiveSource(item.list)
    if (select) {
      selectMedia.value = select
      return true
    } else {
      return false
    }
  })
}

//父组件调用此方法旋转刷新按钮，触发刮削
const showProgress = () => {
  clearTimeout(timer1.value)
  timer1.value = null
  clearTimeout(timer2.value)
  timer2.value = null
  // 刮削进行中：直接展开弹层，取消按钮此时一定可见
  if (loading.value) {
    showPopover.value = true
    isShowPopover.value = true
    return
  }
  judgeSelect()
  // 没有启用的源时 selectType 为 undefined，继续走下去会在下面 selectType.value.type 抛错
  if (!selectType.value?.type) {
    uni.showToast({ title: t('video.noActiveSource'), icon: 'none' })
    return
  }
  popoverData.value.title = t('video.scanning')
  popoverData.value.list = [
    { label: t('video.found'), value: 0 },
    { label: t('video.pendingUpdate'), value: 0 },
    { label: t('video.updated'), value: 0 },
  ]
  showPopover.value = true
  isShowPopover.value = true
  if (selectType.value.type == 'Emby') {
    showPopover.value = false
    isShowPopover.value = false
  }
  emits('refresh')
  // 原先这里是 60 秒后自动 emits('pause')。自动「暂停」语义不对 ——
  // 取消应该由用户决定，而且现在取消真的能停下，不需要靠超时兜底。
}

//取消本次刮削
const toCancel = () => {
  emits('pause')
}

const getScrollTop = () => {
  return 0
}
watch(
  () => props.refreshData,
  val => {
    if (props.loading) {
      popoverData.value.list = [
        { label: t('video.found'), value: 0 },
        { label: t('video.pendingUpdate'), value: 0 },
        { label: t('video.updated'), value: 0 },
      ]
      popoverData.value.list.find(i => i.label == t('video.pendingUpdate')).value = val.toupdate || 0
    } else {
      popoverData.value.list = [
        { label: t('video.found'), value: 0 },
        { label: t('video.failed'), value: 0 },
        { label: t('video.updated'), value: 0 },
      ]
      popoverData.value.list.find(i => i.label == t('video.failed')).value = val.fail || 0
    }
    popoverData.value.list.find(i => i.label == t('video.found')).value = val.found || 0
    popoverData.value.list.find(i => i.label == t('video.updated')).value = val.updated || 0
  },
  { deep: true }
)
watch(
  () => props.loading,
  val => {
    loading.value = val
    if (!val) {
      // 取消结束时，标题要说明是哪种结束，而不是一律报「已完成」
      const reason = props.refreshData?.cancelReason
      if (reason === 'user') {
        // 取消后已刮到的批次会保留，文案要说清楚
        popoverData.value.title = t('video.scanCancelledKeepPartial')
      } else if (reason === 'tmdb') {
        popoverData.value.title = t('video.tmdbUnavailable')
      } else {
        popoverData.value.title = t('video.scanCompleted')
      }
      timer2.value = setTimeout(() => {
        isShowPopover.value = false
        setTimeout(() => {
          showPopover.value = false
        }, 300)
      }, 6000)
      clearTimeout(timer1.value)
      timer1.value = null
    }
  },
  { deep: true }
)

onMounted(() => {
  const query = uni.createSelectorQuery()
  query
    .select('.home-navbar-container__refresh')
    .fields(
      {
        rect: true,
        size: true,
      },
      res => {
        if (res) {
          popoverStyle.value = { left: res.left + res.width / 2 + 'px', top: res.top + res.height + 'px' }
        }
      }
    )
    .exec()
})
defineExpose({
  getScrollTop,
  showProgress,
})
</script>

<style lang="scss" scoped>
@keyframes spin-reverse {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

.home-navbar {
  position: absolute;
  width: 100%;
  z-index: 1000;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 100rpx;
  top: 50rpx;

  .home-navbar-container {
    .navbar-icon {
      font-size: 40rpx;
      cursor: pointer;
      margin-left: 24rpx;

      &:first-child {
        margin-left: 0;
      }
    }

    .refresh-rotate {
      animation: spin-reverse 1s linear infinite reverse;
    }
  }

  .home-navbar-arrow {
    width: 16px;
    height: 16px;
    position: fixed;
    transform: translateX(-50%);
  }

  .home-navbar-popover {
    position: fixed;
    transform: translateX(-70%);
    background: #315ffd;
    padding: 12px;
    border-radius: 10px;

    .popover-title {
      display: flex;
      align-items: center;
      justify-content: space-between;

      .popover-title-left {
        font-size: 15px;
        color: #fff;

        .popover-title-left__button {
          display: inline-block;
          border: 1px solid #fff;
          margin-left: 5px;
          padding: 0 2px;
        }
      }

      .popover-title-right {
        .nut-icon-close {
          font-size: 15px;
          width: 15px;
          height: 15px;
          display: block;
        }
      }
    }

    .popover-list {
      display: flex;
      align-items: center;
      margin-top: 10px;

      .popover-list-item {
        display: flex;
        align-items: baseline;

        span:first-child {
          font-size: 14px;
          color: #d0d0d0;
          white-space: nowrap;
        }

        span:last-child {
          font-size: 14px;
          padding-left: 3px;
          color: #fff;
          font-weight: bold;
        }
      }
    }
  }

  .popover-in {
    animation: fadeIn 0.3s ease-in-out forwards;
  }

  .popover-out {
    animation: fadeOut 0.3s ease-in-out forwards;
  }
}
</style>
