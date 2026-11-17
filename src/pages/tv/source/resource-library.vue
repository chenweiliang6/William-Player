<template>
  <tv-page @keyCodeClick="keyCodeClick">
    <div class="tv-resource-lib">
      <div class="rl-title">{{ t('navbar.resourceLibrary') }}</div>

      <!-- 源卡片列表 -->
      <template v-if="view === 'sources'">
        <div v-if="flatSources.length" class="rl-list">
          <div
            v-for="(item, index) in flatSources"
            :key="item.key"
            :class="['rl-row', index === tabIndex ? 'row-active' : '']"
            @click="enterSource(item)"
          >
            <image v-if="getSourceIcon(item.type).kind === 'image'" class="row-icon" :src="getSourceIcon(item.type).value"></image>
            <wil-icon v-else :name="getSourceIcon(item.type).value" class="row-icon row-glyph"></wil-icon>
            <div class="row-text">
              <span class="row-source">{{ item.label }}</span>
              <span class="row-path">{{ item.name }}</span>
            </div>
            <nut-icon name="right" custom-color="#8a8a8a"></nut-icon>
          </div>
        </div>
        <div v-else class="rl-empty">{{ t('resourceLibrary.emptyTip') }}</div>
      </template>

      <!-- 该源的已导入目录 -->
      <template v-else>
        <div class="rl-sub">
          <span class="rl-sub-back">←</span>
          <span class="rl-sub-title">{{ activeLabel }}</span>
        </div>
        <div v-if="activeEntries.length" class="rl-list">
          <div
            v-for="(entry, index) in activeEntries"
            :key="entry.path"
            :class="['rl-row', index === tabIndex ? 'row-active' : '']"
            @click="openEntry(entry)"
          >
            <wil-icon name="wenjianjia" class="row-icon row-glyph"></wil-icon>
            <div class="row-text">
              <span class="row-source">{{ entry.path }}</span>
              <span class="row-path">{{ entry.target === TARGET.RESOURCE ? t('video.importToResourceLibrary') : t('video.importToMediaLibrary') }}</span>
            </div>
            <nut-icon name="right" custom-color="#8a8a8a"></nut-icon>
          </div>
        </div>
        <div v-else class="rl-empty">{{ t('folderPicker.noImport') }}</div>
      </template>
    </div>
  </tv-page>
</template>

<script setup>
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import tvPage from '@/components/tv/tv-page/index.vue'
import wilIcon from '@/components/common/wil-icon/index.vue'
import { getSourceIcon } from '@/utils/sources/sourceIcon'
import { readMulu, TARGET } from '@/utils/sources/mulu'

const { t } = useI18n()

const SOURCE_LABEL = {
  WebDAV: 'WebDAV',
  Emby: 'Emby',
  天翼云盘: t('source.tianyiCloudDriveLabel'),
  夸克网盘: t('source.quarkCloudDriveLabel'),
  联通云盘: t('source.unicomCloudDriveLabel'),
  移动云盘: t('source.cloud139Label'),
}

const view = ref('sources')
const tabIndex = ref(0)
const sourceList = ref([])
const entries = ref([])
const active = ref(null) // { type, name, label }

// 源账号拍平为可聚焦列表
const flatSources = computed(() => {
  const out = []
  ;(sourceList.value || []).forEach(item => {
    if (!item.list?.length) return
    const label = SOURCE_LABEL[item.type] || item.type
    item.list.forEach(v => out.push({ key: `${item.type}::${v.name}`, type: item.type, name: v.name, label }))
  })
  return out
})

const activeLabel = computed(() => (active.value ? `${active.value.label} · ${active.value.name}` : ''))

const activeEntries = computed(() => {
  if (!active.value) return []
  return (entries.value || []).filter(e => e.type === active.value.type && e.name === active.value.name)
})

const reload = () => {
  sourceList.value = uni.getStorageSync('sourceList') || []
  entries.value = readMulu().entries || []
}

const enterSource = item => {
  active.value = { type: item.type, name: item.name, label: item.label }
  view.value = 'entries'
  tabIndex.value = 0
}

const openEntry = entry => {
  uni.navigateTo({
    url: `/pages/tv/source/resource-browse?type=${encodeURIComponent(entry.type)}&name=${encodeURIComponent(entry.name)}&path=${encodeURIComponent(entry.path)}${entry.folderFileId ? `&folderFileId=${encodeURIComponent(entry.folderFileId)}` : ''}`,
  })
}

const currentList = () => (view.value === 'sources' ? flatSources.value : activeEntries.value)

const keyCodeClick = keyCode => {
  const listLen = currentList().length
  if (keyCode === 'KeyUp') {
    if (tabIndex.value > 0) tabIndex.value--
    else if (view.value === 'entries') {
      // 在目录列表最顶再按上，回源列表
      view.value = 'sources'
      tabIndex.value = 0
      return
    }
  } else if (keyCode === 'KeyDown') {
    if (tabIndex.value < listLen - 1) tabIndex.value++
  } else if (keyCode === 'KeyEnter' || keyCode === 'KeyRight') {
    const item = currentList()[tabIndex.value]
    if (!item) return
    if (view.value === 'sources') enterSource(item)
    else openEntry(item)
  } else if (keyCode === 'KeyBack' || keyCode === 'KeyLeft') {
    if (view.value === 'entries') {
      view.value = 'sources'
      tabIndex.value = 0
    } else {
      uni.navigateBack()
    }
  }
}

onShow(reload)
</script>

<style lang="scss" scoped>
.tv-resource-lib {
  width: 100%;
  height: 100%;
  padding: 40rpx 60rpx;
  box-sizing: border-box;
  color: #fff;
}

.rl-title {
  font-size: 44rpx;
  font-weight: bold;
  padding-bottom: 24rpx;
}

.rl-sub {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding-bottom: 20rpx;
  font-size: 30rpx;
  color: #8a8a8a;

  .rl-sub-title {
    color: #fff;
  }
}

.rl-row {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 22rpx 24rpx;
  border-radius: 12rpx;
  font-size: 32rpx;

  &.row-active {
    background: rgba(255, 103, 1, 0.16);
    outline: 4rpx solid #ff6701;
  }

  .row-icon {
    width: 52rpx;
    height: 52rpx;
    border-radius: 50%;
  }

  .row-glyph {
    width: auto;
    height: auto;
    border-radius: 0;
    font-size: 52rpx;
    color: #c5c6d0;
  }

  .row-text {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6rpx;
  }

  .row-source {
    color: #fff;
  }

  .row-path {
    font-size: 26rpx;
    color: #8a8a8a;
    word-break: break-all;
  }
}

.rl-empty {
  padding: 120rpx 0;
  text-align: center;
  font-size: 30rpx;
  color: #8a8a8a;
}
</style>
