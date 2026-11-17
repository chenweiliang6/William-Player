<template>
  <div class="tvlist-popup">
    <nut-popup v-model:visible="visible" position="bottom" :lock-scroll="true">
      <div class="tvlist-popup-wrapper">
        <div class="tvlist-popup-wrapper__title" :style="{ height: navBarHeight }">
          <div class="tvlist-popup-wrapper__title-content" :style="{ height: contentHeight }">
            <nut-icon name="rect-down" @click="close"></nut-icon>
            <span>{{ props.title }}</span>
            <div class="content-right">
              <span class="content-right-download" v-if="!isDownload" @click="openDownload(true)">{{ t('video.download') }}</span>
              <span class="content-right-cancel" v-if="isDownload" @click="openDownload(false)">{{ t('common.cancel') }}</span>
              <span class="content-right-confirm" v-if="isDownload" @click="confirmDownload">{{ t('common.confirm') }}</span>
            </div>
          </div>
        </div>
        <div class="tvlist-popup-wrapper__list">
          <div class="tvlist-popup-wrapper__list-item" v-for="(item, index) in props.tvList" :key="item.name" @click="playVideo(item, index)">
            <div class="item-img">
              <image :src="item.poster" mode="aspectFill" class="item-img-poster" />
              <template v-if="isDownload">
                <wil-icon name="bangdingchenggong" custom-color="#ff6701" v-if="selectArr.some(i => i.id === item.id)" />
                <div class="unselect-icon" v-else></div>
              </template>
            </div>
            <div class="item-info">
              <div class="item-info-title">{{ item.ji + '.' + (item.title || t('video.episodeTitle', { episode: item.ji })) }}</div>
              <div class="item-info-star">
                <wil-icon name="shoucang" custom-color="#f4bc22" />
                <span class="star-score">{{ item.vote_average?.toFixed(1) || 10 }}</span>
                <span class="star-runtime">{{ item.runtimeOrg ? calTime(item.runtimeOrg, 'cn') : t('video.noDuration') }}</span>
              </div>
              <div class="item-info-desc">{{ item.overview || t('video.noIntroduction') }}</div>
            </div>
          </div>
        </div>
      </div>
    </nut-popup>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { calTime } from '@/utils/scrape'
import { getWebDAVUrl, get189VideoUrl, getQuarkResolutionUrl, getQuarkVideoUrl } from '@/utils/common'
import { queryAll, createDownload, judgeSelect } from '@/utils/download'
import { useI18n } from 'vue-i18n'
import wilIcon from '@/components/common/wil-icon/index.vue'

const { t } = useI18n()
const props = defineProps({
  tvList: { type: Array, default: [] },
  title: { type: String, default: '' },
  activeSeason: { type: Object, default: {} },
})

const emits = defineEmits(['playVideo'])
const visible = defineModel('visible')
const navBarHeight = ref('')
const contentHeight = ref('')
const isDownload = ref(false) //是否在下载模式
const selectArr = ref([]) //已选中的需要下载的视频

//计算微信navBar高度
const getNavHeight = () => {
  let sysinfo = uni.getSystemInfoSync() // 获取设备系统对象
  let statusBarHeight = sysinfo.statusBarHeight // 获取状态栏高度
  navBarHeight.value = statusBarHeight + 44 + 'px' //计算nav导航栏的高度
  contentHeight.value = '44px'
}

//计算h5的navBar高度
const getH5NavbarHeight = () => {
  let sysinfo = uni.getSystemInfoSync() // 获取设备系统对象
  navBarHeight.value = '44px'
  contentHeight.value = '44px'
}
const close = () => {
  visible.value = false
}

const openDownload = val => {
  isDownload.value = val
  selectArr.value = []
}
//确认下载
const confirmDownload = () => {
  queryAll(createDownload, selectArr.value)
  close()
  isDownload.value = false
  selectArr.value = []
}

const playVideo = (item, index) => {
  if (isDownload.value) {
    // download.js 的 judgeSelect 会返回 { selectMedia, selectType }
    const { selectType } = judgeSelect()
    const lastDotIndex = item.name.lastIndexOf('.')
    let format = item.name.substring(lastDotIndex + 1)
    if (selectArr.value.some(i => i.id === item.id)) {
      selectArr.value = selectArr.value.filter(i => i.id !== item.id)
    } else {
      selectArr.value.push({ saveName: `${props.title} ${t('video.episodeTitle', { episode: item.ji })}.${format}`, ...item })
      if (selectType?.type === 'WebDAV') {
        // WebDAV 下载要靠 webdavPath 解析直链，必须带上所在的季目录
        selectArr.value.forEach(v => {
          v.webdavPath = decodeURIComponent(props.activeSeason.path.slice(1) + '/' + v.name)
        })
      }
    }
  } else {
    emits('playVideo', item, index)
  }
}

// #ifdef APP-PLUS
getNavHeight()
// #endif

// #ifdef H5
getH5NavbarHeight()
// #endif
</script>

<style lang="scss" scoped>
.tvlist-popup {
  // overscroll-behavior: contain;
  :deep(.nut-popup) {
    width: 100%;
    height: 100%;
    background: var(--app-bg);
    color: var(--app-text-primary);
    .tvlist-popup-wrapper {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
      .tvlist-popup-wrapper__title {
        width: 100%;
        position: relative;
        .tvlist-popup-wrapper__title-content {
          position: absolute;
          display: flex;
          justify-content: center;
          align-items: center;
          width: 100%;
          bottom: 0;
          left: 0;
          padding: 0 32rpx;
          .nut-icon-rect-down {
            width: 40rpx;
            height: 40rpx;
            font-size: 40rpx;
            cursor: pointer;
            position: absolute;
            left: 32rpx;
          }
          span {
            font-size: 32rpx;
            font-weight: bold;
            color: var(--app-text-primary);
          }
          .content-right {
            position: absolute;
            right: 32rpx;
            span {
              font-size: 30rpx;
              color: #ff6701;
            }
            .content-right-cancel {
              color: var(--app-text-primary);
            }
            .content-right-confirm {
              color: var(--app-brand);
              margin-left: 24rpx;
            }
          }
        }
      }
      .tvlist-popup-wrapper__list {
        flex: 1;
        overflow: auto;
        border-top: 2rpx solid var(--app-border);
        .tvlist-popup-wrapper__list-item {
          display: flex;
          padding: 24rpx;
          border-bottom: 1px solid var(--app-border);
          .item-img {
            flex: 0 0 150rpx;
            height: 224rpx;
            position: relative;
            .item-img-poster {
              background: var(--app-bg-secondary);
            }
            image {
              display: block;
              width: 100%;
              height: 100%;
              border-radius: 20rpx;
            }
            .unselect-icon {
              width: 40rpx;
              height: 40rpx;
              border: 2rpx solid gray;
              position: absolute;
              top: 10rpx;
              right: 10rpx;
            }
            .iconfont {
              width: 40rpx;
              height: 40rpx;
              font-size: 40rpx;
              position: absolute;
              top: 10rpx;
              right: 10rpx;
            }
          }
          .item-info {
            padding-left: 24rpx;
            .item-info-title {
              font-size: 32rpx;
              font-weight: bold;
            }
            .item-info-star {
              display: flex;
              align-items: center;
              padding-top: 16rpx;
              .iconfont {
                font-size: 32rpx;
                display: block;
              }
              .star-score {
                color: #f4bc22;
                font-size: 28rpx;
              }
              .star-runtime {
                padding-left: 16rpx;
                font-size: 28rpx;
                color: var(--app-text-primary);
              }
            }
            .item-info-desc {
              padding-top: 16rpx;
              display: -webkit-box;
              -webkit-line-clamp: 3;
              -webkit-box-orient: vertical;
              overflow: hidden;
              text-overflow: ellipsis;
              font-size: 28rpx;
              color: var(--app-text-tertiary);
              line-height: normal;
            }
          }
        }
      }
    }
  }
}
</style>
