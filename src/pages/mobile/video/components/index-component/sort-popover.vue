<template>
  <div class="sort-popover">
    <nut-transition :show="showPopover" name="fade" :duration="200">
      <div class="more-arrow"></div>
      <div class="more-popover">
        <div class="more-popover-item" v-for="item in popoverArr" :key="item.key">
          <span class="more-popover-item__title">{{ item.title }}</span>
          <div class="more-popover-item__list">
            <div class="list-item" v-for="sitem in item.list" :key="sitem.value" @click="changeTypeOrWay(sitem, item.key)">
              <div class="list-item-bingo">
                <wil-icon
                  name="duihao"
                  custom-color="#ffffff"
                  v-if="item.key == 'type' ? sitem.value == sortWay[props.type]?.type : sitem.value == sortWay[props.type]?.way"
                />
              </div>
              <div class="list-item-name">{{ sitem.name }}</div>
            </div>
          </div>
        </div>
      </div>
    </nut-transition>
    <nut-overlay v-model:visible="showPopover" :z-index="2000" :lock-scroll="true" @click="clickOverlay"></nut-overlay>
  </div>
</template>

<script setup>
import { getMovieTvData, setMovieTvData } from '@/utils/scrape'
import { computed, ref, watch, onBeforeMount } from 'vue'
import dayjs from 'dayjs'
import { chineseToPinYin } from '@/utils/pinyin.js'
import { useI18n } from 'vue-i18n'
import wilIcon from '@/components/common/wil-icon/index.vue'

const { t } = useI18n()
const props = defineProps({
  modelValue: { type: Boolean, default: false },
  type: { type: String, default: 'tv' },
})
const emits = defineEmits(['update:modelValue', 'changeSort'])
const showPopover = ref(false)
const sortWay = ref({})
const popoverArr = computed(() => [
  {
    key: 'type',
    title: t('video.sortBy'),
    list: [
      { name: t('video.videoName'), value: '1' },
      { name: t('video.updateTime'), value: '2' },
      { name: t('video.addTime'), value: '3' },
      { name: t('video.releaseTime'), value: '4' },
    ],
  },
  {
    key: 'way',
    title: t('video.sortWay'),
    list: [
      { name: t('video.ascending'), value: '1' },
      { name: t('video.descending'), value: '2' },
    ],
  },
])

const clickOverlay = () => {
  showPopover.value = false
  emits('update:modelValue', false)
}

const handleSort = (type, way) => {
  let localMovieTvData = getMovieTvData()

  // 排序目标必须兼容分类页签。
  // 旧写法是 localMovieTvData[props.type]：props.type 为 movie/tv 时能取到，
  // 但「动漫」「综艺」「纪录片」「其他」传进来的是 anime/variety/...，
  // 这几个键在顶层不存在 —— 直接 .sort() 会抛 TypeError。
  // 分类页签的数据实际在 byCategory 里。
  const catKey = props.type
  const fromCategory = localMovieTvData.byCategory?.[catKey]
  const sortTarget = ref(fromCategory ? [...fromCategory] : (localMovieTvData[catKey] || []))
  if (type == '1') {
    if (way == '1') {
      sortTarget.value = sortTarget.value.sort((a, b) => {
        const nameA = chineseToPinYin(a.name).toLowerCase().slice(0, 1)
        const nameB = chineseToPinYin(b.name).toLowerCase().slice(0, 1)
        if (nameA < nameB) return -1
        if (nameA > nameB) return 1
        return 0
      })
    } else {
      sortTarget.value = sortTarget.value.sort((a, b) => {
        const nameA = chineseToPinYin(a.name).toLowerCase().slice(0, 1)
        const nameB = chineseToPinYin(b.name).toLowerCase().slice(0, 1)
        if (nameA < nameB) return 1
        if (nameA > nameB) return -1
        return 0
      })
    }
  } else if (type == '2') {
    if (way == '1') {
      sortTarget.value = sortTarget.value.sort((a, b) => {
        if (dayjs(a.updateTime).isBefore(dayjs(b.updateTime))) {
          return -1
        } else {
          return 1
        }
      })
    } else {
      sortTarget.value = sortTarget.value.sort((a, b) => {
        if (dayjs(a.updateTime).isBefore(dayjs(b.updateTime))) {
          return 1
        } else {
          return -1
        }
      })
    }
  } else if (type == '3') {
    if (way == '1') {
      sortTarget.value = sortTarget.value.sort((a, b) => {
        if (dayjs(a.createTime).isBefore(dayjs(b.createTime))) {
          return -1
        } else {
          return 1
        }
      })
    } else {
      sortTarget.value = sortTarget.value.sort((a, b) => {
        if (dayjs(a.createTime).isBefore(dayjs(b.createTime))) {
          return 1
        } else {
          return -1
        }
      })
    }
  } else if (type == '4') {
    if (way == '1') {
      sortTarget.value = sortTarget.value.sort((a, b) => {
        if (dayjs(a.releaseTime).isBefore(dayjs(b.releaseTime))) {
          return -1
        } else {
          return 1
        }
      })
    } else {
      sortTarget.value = sortTarget.value.sort((a, b) => {
        if (dayjs(a.releaseTime).isBefore(dayjs(b.releaseTime))) {
          return 1
        } else {
          return -1
        }
      })
    }
  }
  // 写回：分类页签回 byCategory，movie/tv 回顶层
  if (fromCategory) {
    localMovieTvData.byCategory[catKey] = sortTarget.value
  } else {
    localMovieTvData[catKey] = sortTarget.value
  }
  setMovieTvData(localMovieTvData)
}

const changeTypeOrWay = (item, key) => {
  // 兜底：分类页签若还没初始化排序状态，先补一个默认值
  if (!sortWay.value[props.type]) {
    sortWay.value[props.type] = { type: '1', way: '1' }
  }
  if (key == 'type') {
    sortWay.value[props.type].type = item.value
    handleSort(item.value, sortWay.value[props.type].way)
  } else if (key == 'way') {
    sortWay.value[props.type].way = item.value
    handleSort(sortWay.value[props.type].type, item.value)
  }

  showPopover.value = false
  emits('update:modelValue', false)
  emits('changeSort')
  uni.setStorageSync('sortWay', sortWay.value)
}

watch(
  () => props.modelValue,
  val => {
    showPopover.value = val
  }
)

onBeforeMount(() => {
  const saved = uni.getStorageSync('sortWay') || {}
  // 每个分类页签都要有自己的排序状态。
  // 旧实现只初始化 tv / movie，从「动漫」「综艺」「其他」等页签进来时
  // sortWay[props.type] 是 undefined，模板里读 .type 会直接抛错、整页白屏。
  const keys = ['tv', 'movie', 'anime', 'variety', 'documentary', 'unidentified']
  const next = {}
  keys.forEach(k => {
    next[k] = saved[k] || { type: '1', way: '1' }
  })
  sortWay.value = next
})
</script>

<style lang="scss" scoped>
.sort-popover {
  line-height: initial;
  ::v-deep .nut-transition {
    position: absolute;
    top: 50rpx;
    right: 25%;
    z-index: 3000;
    .more-arrow {
      width: 0;
      height: 0;
      position: absolute;
      right: 14rpx;
      transform: translateY(-100%);
      border-left: 12rpx solid transparent;
      border-right: 12rpx solid transparent;
      border-bottom: 16rpx solid #4d4d4d;
    }
    .more-popover {
      width: 230rpx;
      background: #4d4d4d;
      border-radius: 16rpx;
      box-sizing: border-box;
      padding: 16rpx 24rpx;
      .more-popover-item {
        display: flex;
        flex-direction: column;
        justify-content: center;
        .iconfont {
          font-size: 40rpx;
        }
        .more-popover-item__title {
          flex: 1;
          padding-left: 15rpx;
          color: #bfbfbf;
          font-size: 24rpx;
          margin-bottom: 20rpx;
        }
        .more-popover-item__list {
          .list-item {
            display: flex;
            align-items: center;
            margin-bottom: 20rpx;
            .list-item-bingo {
              width: 34rpx;
              height: 34rpx;
              .iconfont {
                font-size: 34rpx;
              }
            }
            .list-item-name {
              color: #fff;
              margin-left: 14rpx;
            }
          }
        }
      }
    }
  }
  ::v-deep .nut-overlay {
    position: fixed;
    top: 0px;
    left: 0px;
    top: 0;
    left: 0;
    background: transparent;
  }
}
</style>
