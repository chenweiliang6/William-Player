<template>
  <div class="catelog-mulu">
    <div class="catelog-mulu-title">{{ t('folderPicker.manage') }}</div>
    <div class="catelog-mulu-container">
      <!-- 复用扁平列表：媒体库条目在前，仅资源库在后，用 group 标记区分 -->
      <nut-swipe v-for="(item, index) in listData" :key="item.type ? item.name + item.path : 'add'" :ref="el => setRefs(el, index)">
        <!-- 分组标题（新增按钮也走这里） -->
        <div v-if="item.isGroup" class="group-title">{{ item.label }}</div>
        <div v-else-if="item.isAdd" :class="['catelog-mulu-add', index === tabIndex ? 'catelog-mulu-add_active' : '']" @click="toSelectMulu">
          <wil-icon name="jia"></wil-icon>
        </div>
        <div v-else :class="['list-item', index === tabIndex ? 'list-active' : '']">
          <div class="item-left">
            <div class="item-left-icon">
              <image v-if="getSourceIcon(item.type).kind === 'image'" :src="getSourceIcon(item.type).value"></image>
              <wil-icon v-else :name="getSourceIcon(item.type).value" class="item-left-glyph"></wil-icon>
            </div>
            <div class="item-left-text">
              <span>{{ item.name }}</span>
              <span>{{ item.path }}</span>
              <span v-if="item.inheritChildren" class="badge">{{ t('folderPicker.inheritBadge') }}</span>
            </div>
          </div>
          <div class="item-right">
            <wil-icon name="sx-gd-copy"></wil-icon>
          </div>
        </div>
        <template #right>
          <div class="swipe-button">
            <div :class="['swipe-button-delete', iconIndex === 0 ? 'swipe-button-active' : '']">
              <wil-icon name="wenjianjia" custom-color="#c5c6d0"></wil-icon>
            </div>
            <div :class="['swipe-button-delete', iconIndex === 1 ? 'swipe-button-active' : '']">
              <wil-icon name="shanchu" custom-color="#c5c6d0"></wil-icon>
            </div>
          </div>
        </template>
      </nut-swipe>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import wilIcon from '@/components/common/wil-icon/index.vue'
import { getSourceIcon } from '@/utils/sources/sourceIcon'
import { onShow } from '@dcloudio/uni-app'
import { readMulu, removeEntry, addEntries, TARGET } from '@/utils/sources/mulu'

const { t } = useI18n()

const emits = defineEmits(['changeShowType'])


const tabIndex = ref(0)
const entries = ref([])
const itemRefs = ref([])
const isSwipe = ref(false) //标识当前是否有swipe被打开
const iconIndex = ref(-1) //表示swipe右侧的那些图标的索引

/**
 * 扁平化成「分组标题 + 条目 + 新增按钮」的列表，
 * 让遥控器只需在一维数组上上下移动，不用处理二维分组导航。
 */
const listData = computed(() => {
  const media = entries.value.filter(e => (e.target || TARGET.MEDIA) === TARGET.MEDIA)
  const resource = entries.value.filter(e => e.target === TARGET.RESOURCE)
  const rows = []
  if (media.length) {
    rows.push({ isGroup: true, label: t('folderPicker.mediaGroup') })
    rows.push(...media)
  }
  if (resource.length) {
    rows.push({ isGroup: true, label: t('folderPicker.resourceGroup') })
    rows.push(...resource)
  }
  if (!rows.length) rows.push({ isGroup: true, label: t('folderPicker.noImport') })
  rows.push({ isAdd: true })
  return rows
})

const getMuluData = () => {
  entries.value = readMulu().entries || []
}

//为每个swipe设置ref
const setRefs = (el, index) => {
  itemRefs.value[index] = el
}

// TV 端没有「当前账号」上下文，跳导入页时由用户在页面内自行选择源账号。
// 这里同样是调整既有目录，用 edit 模式回填，才能取消已导入目录。
const toSelectMulu = () => {
  uni.navigateTo({
    url: '/pages/tv/source/folder-picker?mode=edit',
  })
}

const currentRow = () => listData.value[tabIndex.value]

/**
 * 在「媒体库」与「仅资源库」之间切换。
 * 不走 removeEntry：条目要留着供资源库浏览，也不能冲掉播放历史。
 */
const switchTarget = row => {
  const isMedia = (row.target || TARGET.MEDIA) === TARGET.MEDIA
  const next = isMedia ? TARGET.RESOURCE : TARGET.MEDIA
  addEntries({
    type: row.type,
    name: row.name,
    picked: [{ path: row.path, folderFileId: row.folderFileId, inheritChildren: row.inheritChildren }],
    target: next,
  })
  uni.setStorageSync('isreload', true)
  uni.showToast({
    title: isMedia ? t('folderPicker.switchedToResource') : t('folderPicker.switchedToMedia'),
    icon: 'none',
  })
  isSwipe.value = false
  iconIndex.value = -1
  getMuluData()
}

/** 移动焦点时跳过不可选的分组标题 */
const moveTo = delta => {
  let next = tabIndex.value + delta
  const max = listData.value.length - 1
  next = Math.max(0, Math.min(max, next))
  // 分组标题不可聚焦
  while (next > 0 && next < max && listData.value[next]?.isGroup) {
    next += delta
  }
  tabIndex.value = Math.max(0, Math.min(max, next))
}

//遥控器按键事件
const evtMove = keyCode => {
  if (keyCode === 'KeyUp') {
    itemRefs.value[tabIndex.value]?.close?.()
    isSwipe.value = false
    iconIndex.value = -1
    moveTo(-1)
  } else if (keyCode === 'KeyDown') {
    itemRefs.value[tabIndex.value]?.close?.()
    isSwipe.value = false
    iconIndex.value = -1
    moveTo(1)
  } else if (keyCode === 'KeyLeft') {
    if (isSwipe.value) {
      // 侧滑已打开：在「切换 / 删除」两个按钮之间移动
      iconIndex.value = Math.max(0, iconIndex.value - 1)
    } else {
      emits('changeShowType', 'settings')
    }
  } else if (keyCode === 'KeyRight') {
    const row = currentRow()
    if (!row || row.isGroup || row.isAdd) return
    if (isSwipe.value) {
      iconIndex.value = Math.min(1, iconIndex.value + 1)
      return
    }
    isSwipe.value = true
    itemRefs.value[tabIndex.value]?.open?.('left')
    iconIndex.value = 0
  } else if (keyCode === 'KeyEnter') {
    const row = currentRow()
    if (!row) return
    if (row.isAdd) {
      toSelectMulu()
      return
    }
    if (row.isGroup) return
    if (!isSwipe.value) return
    if (iconIndex.value === 0) {
      // 切换「媒体库 / 仅资源库」
      switchTarget(row)
    } else if (iconIndex.value === 1) {
      // 删除
      removeEntry({ type: row.type, name: row.name, path: row.path })
      if ((row.target || TARGET.MEDIA) === TARGET.MEDIA) uni.setStorageSync('isreload', true)
      isSwipe.value = false
      iconIndex.value = -1
      getMuluData()
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

    .group-title {
      font-size: 26rpx;
      color: #8a8a8a;
      padding: 20rpx 8rpx 10rpx;
    }

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

              .item-left-glyph {
                font-size: 80rpx;
                color: #fff;
              }
            }

            .item-left-text {
              display: flex;
              flex-direction: column;
              padding-left: 20rpx;
              color: #fff;

              .badge {
                font-size: 22rpx;
                color: #ff6701;
              }
            }
          }
        }

        .list-active {
          outline: 4rpx solid #ff6701;
        }
      }
    }
  }

  .catelog-mulu-add {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 30rpx;

    &_active {
      outline: 4rpx solid #ff6701;
    }

    .iconfont {
      font-size: 60rpx;
    }
  }
}
</style>