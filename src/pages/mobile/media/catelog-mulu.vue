<template>
  <div :class="['catelog-mulu', themeClass]">
    <!-- 媒体库：自动识别、进海报墙 -->
    <div class="group-title">{{ t('folderPicker.mediaGroup') }}</div>
    <div v-if="mediaList.length" class="group-list">
      <div class="catelog-mulu-item" v-for="item in mediaList" :key="item.path" @click="onItemClick(item)">
        <div class="item-top">
          <image v-if="getSourceIcon(item.type).kind === 'image'" :src="getSourceIcon(item.type).value" class="item-top-icon" />
          <wil-icon v-else :name="getSourceIcon(item.type).value" class="item-top-icon item-top-glyph" />
          <span>{{ item.name }}</span>
        </div>
        <div class="item-bottom">
          <div class="item-bottom-right">
            <div class="right-path">{{ item.path }}</div>
            <div v-if="item.inheritChildren" class="right-badge">{{ t('folderPicker.inheritBadge') }}</div>
          </div>
        </div>
      </div>
    </div>
    <div v-else class="group-empty">{{ t('folderPicker.noImport') }}</div>

    <!-- 仅资源库：不识别，按原始目录树浏览 -->
    <div class="group-title">{{ t('folderPicker.resourceGroup') }}</div>
    <div v-if="resourceList.length" class="group-list">
      <div class="catelog-mulu-item" v-for="item in resourceList" :key="item.path" @click="onItemClick(item)">
        <div class="item-top">
          <image v-if="getSourceIcon(item.type).kind === 'image'" :src="getSourceIcon(item.type).value" class="item-top-icon" />
          <wil-icon v-else :name="getSourceIcon(item.type).value" class="item-top-icon item-top-glyph" />
          <span>{{ item.name }}</span>
        </div>
        <div class="item-bottom">
          <div class="item-bottom-right">
            <div class="right-path">{{ item.path }}</div>
          </div>
        </div>
      </div>
    </div>
    <div v-else class="group-empty">{{ t('folderPicker.noImport') }}</div>

    <!-- 添加：跳到目录树多选页 -->
    <div class="catelog-mulu-add catelog-mulu-item" @click="toPicker">
      <div class="catelog-mulu-add__icon">
        <nut-icon name="uploader" :custom-color="iconColorMuted"></nut-icon>
      </div>
      <span class="add-text">{{ t('folderPicker.addImport') }}</span>
    </div>

    <Popover v-model:visible="showPopover" :options="popoverOptions" :position="position"></Popover>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import Popover from './components/popover.vue'
import wilIcon from '@/components/common/wil-icon/index.vue'
import { getSourceIcon } from '@/utils/sources/sourceIcon'
import { useThemeNavbar } from '@/hooks/useThemeNavbar'
import { useThemeClass } from '@/hooks/useThemeClass'
import { useThemeColors } from '@/hooks/useThemeColors'
import { useI18n } from 'vue-i18n'
import { readMulu, removeEntry, addEntries, TARGET } from '@/utils/sources/mulu'

const { t } = useI18n()
useThemeNavbar()
const themeClass = useThemeClass()
const { iconColorMuted } = useThemeColors()

const routerParams = ref({})
const sourceType = ref('')
const sourceName = ref('')
const entries = ref([])

const showPopover = ref(false)
const selectItem = ref({})
const position = ref({})

// 源图标（与 source-list 保持一致）

// 当前源账号的条目；未指定账号时展示全部
const accountEntries = computed(() => {
  const all = entries.value || []
  if (!sourceType.value) return all
  return all.filter(e => e.type === sourceType.value && (!sourceName.value || e.name === sourceName.value))
})

const mediaList = computed(() => accountEntries.value.filter(e => (e.target || TARGET.MEDIA) === TARGET.MEDIA))
const resourceList = computed(() => accountEntries.value.filter(e => e.target === TARGET.RESOURCE))

const reload = () => {
  entries.value = readMulu().entries || []
}

const popoverOptions = computed(() => {
  const item = selectItem.value || {}
  const isMedia = (item.target || TARGET.MEDIA) === TARGET.MEDIA
  // 课程/教程这类非影视目录不用删除，改成「仅资源库」即可：
  // 目录仍在资源库里可浏览，但不再参与刮削（对齐爆米花的「仅在资源库展示」）。
  const switchOpt = isMedia
    ? { icon: 'wenjianjia', label: t('folderPicker.switchToResource'), func: handleSwitchTarget }
    : { icon: 'wenjianjia', label: t('folderPicker.switchToMedia'), func: handleSwitchTarget }
  return [switchOpt, { icon: 'shanchu', iconColor: '#FE4344', label: t('common.delete'), color: '#FE4344', func: handleDelete }]
})

const onItemClick = (event, item) => {
  selectItem.value = item
  showPopover.value = true
  position.value.clientX = event.clientX || event.touches?.[0]?.clientX || 0
  position.value.clientY = (event.clientY || event.touches?.[0]?.clientY || 0) - 44
}

const handleDelete = () => {
  const item = selectItem.value
  if (!item) return
  removeEntry({ type: item.type, name: item.name, path: item.path })
  // 删掉媒体库目录后需要重新刮削，海报墙才会随之更新
  if ((item.target || TARGET.MEDIA) === TARGET.MEDIA) uni.setStorageSync('isreload', true)
  reload()
}

/**
 * 在「媒体库」与「仅资源库」之间切换。
 *
 * 不能走 removeEntry —— 那会把条目删掉（用户还想去资源库里浏览），
 * 而且会让 syncHistoryPlay 把该目录下的播放记录一并过滤掉。
 * addEntries 对已存在的条目只更新 target，正是这里要的语义。
 */
const handleSwitchTarget = () => {
  const item = selectItem.value
  if (!item) return
  const isMedia = (item.target || TARGET.MEDIA) === TARGET.MEDIA
  const next = isMedia ? TARGET.RESOURCE : TARGET.MEDIA
  addEntries({
    type: item.type,
    name: item.name,
    picked: [{ path: item.path, folderFileId: item.folderFileId, inheritChildren: item.inheritChildren }],
    target: next,
  })
  // 两种情况都要重刮：移出媒体库要清掉它刮出来的条目，
  // 移回媒体库要把它加进海报墙。
  uni.setStorageSync('isreload', true)
  uni.showToast({
    title: isMedia ? t('folderPicker.switchedToResource') : t('folderPicker.switchedToMedia'),
    icon: 'none',
  })
  reload()
}

const toPicker = () => {
  if (!sourceType.value || !sourceName.value) {
    uni.showToast({ title: t('source.pleaseAddSourceFirst'), icon: 'none' })
    return
  }
  // 从「导入目录管理」进来同样是调整既有目录，用 edit 模式回填，才能在这里取消已导入目录
  uni.navigateTo({
    url: `/pages/mobile/media/folder-picker?type=${encodeURIComponent(sourceType.value)}&name=${encodeURIComponent(sourceName.value)}&mode=edit`,
  })
}

onLoad(options => {
  routerParams.value = options || {}
  sourceType.value = decodeURIComponent(options?.type || '')
  sourceName.value = decodeURIComponent(options?.name || '')
  setTimeout(() => {
    uni.setNavigationBarTitle({ title: t('folderPicker.manage') })
  }, 40)
})

onShow(reload)
</script>

<style lang="scss" scoped>
page {
  width: 100%;
  height: 100%;
}

.catelog-mulu {
  width: 100%;
  min-height: 100%;
  padding: 24rpx;
  box-sizing: border-box;
  background: var(--app-bg);
  color: var(--app-text-primary);
  display: flex;
  flex-direction: column;
}

.group-title {
  font-size: 26rpx;
  color: var(--app-text-tertiary);
  padding: 24rpx 8rpx 12rpx;
}

.group-list {
  background: var(--app-bg-card);
  border-radius: 16rpx;
  overflow: hidden;
}

.group-empty {
  padding: 32rpx;
  text-align: center;
  font-size: 26rpx;
  color: var(--app-text-tertiary);
  background: var(--app-bg-card);
  border-radius: 16rpx;
}

.catelog-mulu-item {
  padding: 24rpx;
  background: var(--app-bg-card);
  border-bottom: 2rpx solid var(--app-border);

  &:last-child {
    border-bottom: none;
  }
}

.item-top {
  display: flex;
  align-items: center;
  gap: 12rpx;
  font-size: 30rpx;
  color: var(--app-text-primary);

  .item-top-icon {
    width: 40rpx;
    height: 40rpx;
    border-radius: 50%;
  }

  .item-top-glyph {
    width: auto;
    height: auto;
    border-radius: 0;
    font-size: 40rpx;
    color: var(--app-icon-strong);
  }
}

.item-bottom {
  display: flex;
  align-items: center;
  padding-top: 10rpx;
}

.item-bottom-right {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12rpx;

  .right-path {
    font-size: 24rpx;
    color: var(--app-text-tertiary);
    word-break: break-all;
  }

  .right-badge {
    font-size: 22rpx;
    color: var(--app-brand);
    border: 2rpx solid var(--app-brand);
    border-radius: 8rpx;
    padding: 0 8rpx;
    flex-shrink: 0;
  }
}

.catelog-mulu-add {
  margin-top: 32rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  border-radius: 16rpx;
  border: 2rpx dashed var(--app-border);

  .add-text {
    font-size: 28rpx;
    color: var(--app-text-tertiary);
  }
}
</style>
