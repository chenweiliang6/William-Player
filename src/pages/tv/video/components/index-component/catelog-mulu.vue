<template>
  <div class="catelog-mulu">
    <div class="catelog-mulu-title">{{ t('source.directorySettingTitle', { title: catalogTypeLabel }) }}</div>
    <div class="catelog-mulu-container">
      <nut-swipe v-for="(item, index) in listData" :key="item.name" :ref="el => setRefs(el, index)">
        <div :class="['list-item', index === tabIndex ? 'list-active' : '']">
          <div class="item-left">
            <div class="item-left-icon">
              <image :src="mapping[item.type]"></image>
            </div>
            <div class="item-left-text">
              <span>{{ item.name }}</span>
              <span>{{ item.path }}</span>
            </div>
          </div>
          <div class="item-right">
            <image src="@/static/sx-gd.png"></image>
          </div>
        </div>
        <template #right>
          <div class="swipe-button">
            <div :class="['swipe-button-delete', iconIndex === 0 ? 'swipe-button-active' : '']">
              <image src="@/static/swipe-sc.png"></image>
            </div>
          </div>
        </template>
      </nut-swipe>
    </div>
    <div :class="['catelog-mulu-add', tabIndex === listData.length ? 'catelog-mulu-add_active' : '']" @click="toSelectMulu">
      <image src="@/static/jia-hao.png"></image>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import webdavFileIcon from '@/static/webdav-fileIcon.png'
import { onShow } from '@dcloudio/uni-app'

const props = defineProps({
  title: { type: String, default: '' },
  catalogType: { type: String, default: 'tv' },
})
const { t } = useI18n()

const emits = defineEmits(['changeShowType'])

const mapping = {
  'WebDAV': webdavFileIcon,
  '天翼云盘':
    'https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/8c/87/69/8c8769f2-6bfa-19b2-53a4-9e10a555deb3/AppIcon-0-0-1x_U007emarketing-0-7-0-0-sRGB-85-220.png/350x350.png',
  '夸克网盘':
    'https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/60/6f/e5/606fe5ab-3bfb-c5e4-5bed-08c9b2b5188f/AppIcon-0-0-1x_U007emarketing-0-7-0-0-85-220.png/350x350.png?',
}
const getCatalogType = value => {
  if (['tv', '电视剧', t('video.tv'), t('navbar.tvCatelogSetting')].includes(value)) return 'tv'
  if (['movie', '电影', t('video.movie'), t('navbar.movieCatelogSetting')].includes(value)) return 'movie'
  return 'tv'
}
const catalogType = computed(() => getCatalogType(props.catalogType || props.title))
const catalogTypeLabel = computed(() => (catalogType.value === 'tv' ? t('video.tv') : t('video.movie')))

const tabIndex = ref(0)
const muluData = ref({})
const listData = ref([])
const itemRefs = ref([])
const isSwipe = ref(false) //标识当前是否有swipe被打开
const iconIndex = ref(-1) //表示swipe右侧的那些图标的索引

//获取存在本地的目录数据
const getMuluData = () => {
  muluData.value = uni.getStorageSync('muluData') || {}
  if (!muluData.value.tv) muluData.value.tv = []
  if (!muluData.value.movie) muluData.value.movie = []
  listData.value = muluData.value[catalogType.value]
}

//为每个swipe设置ref
const setRefs = (el, index) => {
  itemRefs.value[index] = el
}

const toSelectMulu = () => {
  uni.navigateTo({
    url: `/pages/tv/source/catelog-settings?catalogType=${catalogType.value}`,
  })
}

//遥控器按键事件
const evtMove = keyCode => {
  if (keyCode === 'KeyUp') {
    if (tabIndex.value > 0) {
      tabIndex.value < listData.value.length ? itemRefs.value[tabIndex.value].close() : ''
      tabIndex.value--
      isSwipe.value = false
      iconIndex.value = -1
    }
  } else if (keyCode === 'KeyDown') {
    if (tabIndex.value < listData.value.length) {
      itemRefs.value[tabIndex.value].close()
      tabIndex.value++
      isSwipe.value = false
      iconIndex.value = -1
    }
  } else if (keyCode === 'KeyLeft') {
    // if (tabIndex.value === listData.value.length) return
    if (isSwipe.value) {
      if (iconIndex.value > 0) {
        iconIndex.value--
      } else {
        isSwipe.value = false
        itemRefs.value[tabIndex.value].close()
        iconIndex.value--
      }
    } else {
      emits('changeShowType', 'settings')
    }
  } else if (keyCode === 'KeyRight') {
    if (tabIndex.value === listData.value.length) return
    if (!isSwipe.value) {
      isSwipe.value = true
      itemRefs.value[tabIndex.value].open('left')
    } else {
      iconIndex.value < 0 ? iconIndex.value++ : ''
    }
  } else if (keyCode === 'KeyEnter') {
    if (tabIndex.value === listData.value.length) {
      toSelectMulu()
    } else {
      if (iconIndex.value == 0) {
        //删除目录
        listData.value = listData.value.filter(item => item.name !== listData.value[tabIndex.value].name||item.path !== listData.value[tabIndex.value].path)
        muluData.value[catalogType.value] = listData.value
        uni.setStorageSync('muluData', muluData.value)
      }
    }
  }
}

onShow(() => {
  getMuluData()
})

defineExpose({
  evtMove,
})
</script>

<style lang="scss" scoped>
.catelog-mulu {
  width: 100%;
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;

  .catelog-mulu-title {
    background: #272a2f;
    height: 150rpx;
    color: #fff;
    font-size: 44rpx;
    font-weight: bold;
    padding-left: 40rpx;
    padding-top: 60rpx;
    width: 100%;
  }

  .catelog-mulu-container {
    padding: 24rpx;
    width: 100%;

    :deep(.nut-swipe) {
      .nut-swipe__content {
        .list-item {
          width: 100%;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20rpx 24rpx;
          border-radius: 16rpx;

          .item-left {
            display: flex;
            align-items: center;

            .item-left-icon {
              image {
                width: 80rpx;
                height: 80rpx;
                border-radius: 50%;
              }
            }

            .item-left-text {
              margin-left: 24rpx;
              color: #c5c6d0;
              font-weight: bold;
              font-size: 34rpx;
              display: flex;
              flex-direction: column;

              span:last-child {
                margin-top: 12rpx;
                display: block;
                font-size: 26rpx;
                color: #707070;
              }
            }
          }

          .item-right {
            width: 30rpx;
            height: 30rpx;

            image {
              width: 30rpx;
              height: 30rpx;
            }
          }
        }

        .list-active {
          background: #e5e6ec;

          .item-left {
            .item-left-text {
              color: #000015;
            }
          }
        }
      }

      .nut-swipe__right {
        .swipe-button {
          display: flex;
          align-items: center;
          justify-content: space-around;
          height: 100%;
          width: 150rpx;

          .swipe-button-edit {
            padding: 10rpx;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 4rpx solid transparent;

            image {
              width: 40rpx;
              height: 40rpx;
            }
          }

          .swipe-button-delete {
            padding: 10rpx;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 4rpx solid transparent;

            image {
              width: 40rpx;
              height: 40rpx;
            }
          }

          .swipe-button-active {
            border: 4rpx solid #e5e6ec;
            border-radius: 50%;
          }
        }
      }
    }
  }

  .catelog-mulu-add {
    background: #3d4758;
    border-radius: 50%;
    width: 80rpx;
    height: 80rpx;
    flex: 0 0 80rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    border: 4rpx solid transparent;

    image {
      width: 30rpx;
      height: 30rpx;
    }
  }

  .catelog-mulu-add_active {
    border: 4rpx solid #e5e6ec;
  }
}
</style>
