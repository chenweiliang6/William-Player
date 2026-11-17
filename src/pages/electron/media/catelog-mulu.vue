<template>
  <div class="cm">
    <div class="cm-title" @click="back">
      <wil-icon name="arrow-left-copy" custom-color="#000000" class="cm-back" />
      <span>{{ t('folderPicker.manage') }}</span>
    </div>

    <div class="cm-body">
      <!-- 媒体库 -->
      <div class="cm-group">
        <div class="cm-group__title">{{ t('folderPicker.mediaGroup') }}</div>
        <div v-if="mediaList.length" class="cm-list">
          <div class="cm-item" v-for="item in mediaList" :key="item.type + item.name + item.path" @click="event => clickItem(event, item)">
            <image v-if="getSourceIcon(item.type).kind === 'image'" class="cm-item__icon" :src="getSourceIcon(item.type).value" />
            <wil-icon v-else :name="getSourceIcon(item.type).value" class="cm-item__icon cm-item__glyph" />
            <div class="cm-item__text">
              <span class="cm-item__name">{{ item.name }}</span>
              <span class="cm-item__path">{{ item.path }}</span>
            </div>
            <span v-if="item.inheritChildren" class="cm-item__badge">{{ t('folderPicker.inheritBadge') }}</span>
          </div>
        </div>
        <div v-else class="cm-empty">{{ t('folderPicker.noImport') }}</div>
      </div>

      <!-- 仅资源库 -->
      <div class="cm-group">
        <div class="cm-group__title">{{ t('folderPicker.resourceGroup') }}</div>
        <div v-if="resourceList.length" class="cm-list">
          <div class="cm-item" v-for="item in resourceList" :key="item.type + item.name + item.path" @click="event => clickItem(event, item)">
            <image v-if="getSourceIcon(item.type).kind === 'image'" class="cm-item__icon" :src="getSourceIcon(item.type).value" />
            <wil-icon v-else :name="getSourceIcon(item.type).value" class="cm-item__icon cm-item__glyph" />
            <div class="cm-item__text">
              <span class="cm-item__name">{{ item.name }}</span>
              <span class="cm-item__path">{{ item.path }}</span>
            </div>
          </div>
        </div>
        <div v-else class="cm-empty">{{ t('folderPicker.noImport') }}</div>
      </div>

      <!-- 添加 -->
      <div class="cm-add" @click="toPicker">
        <nut-icon name="uploader" custom-color="#94939a"></nut-icon>
        <span>{{ t('folderPicker.addImport') }}</span>
      </div>
    </div>

    <Popover v-model:visible="showPopover" :options="popoverOptions" :position="position"></Popover>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Popover from '@/pages/mobile/media/components/popover.vue'
import wilIcon from '@/components/common/wil-icon/index.vue'
import { getSourceIcon } from '@/utils/sources/sourceIcon'
import { readMulu, removeEntry, addEntries, TARGET } from '@/utils/sources/mulu'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()

// 从资源库点某个源进来时只展示该源的条目；不带参数则展示全部
const filterType = computed(() => route.query.type || '')
const filterName = computed(() => route.query.name || '')

const entries = ref(readMulu().entries || [])
const showPopover = ref(false)
const selectItem = ref({})
const position = ref({})


const accountEntries = computed(() => {
  const all = entries.value || []
  if (!filterType.value) return all
  return all.filter(e => e.type === filterType.value && (!filterName.value || e.name === filterName.value))
})

const mediaList = computed(() => accountEntries.value.filter(e => (e.target || TARGET.MEDIA) === TARGET.MEDIA))
const resourceList = computed(() => accountEntries.value.filter(e => e.target === TARGET.RESOURCE))

const reload = () => {
  entries.value = readMulu().entries || []
}

const popoverOptions = computed(() => {
  const item = selectItem.value || {}
  const isMedia = (item.target || TARGET.MEDIA) === TARGET.MEDIA
  // 课程/教程这类非影视目录不用删除，改成「仅资源库」即可
  // （对齐爆米花的「仅在资源库展示」）。
  const switchOpt = isMedia
    ? { icon: 'wenjianjia', label: t('folderPicker.switchToResource'), func: handleSwitchTarget }
    : { icon: 'wenjianjia', label: t('folderPicker.switchToMedia'), func: handleSwitchTarget }
  return [switchOpt, { icon: 'shanchu', iconColor: '#FE4344', label: t('common.delete'), color: '#FE4344', func: handleDelete }]
})

const clickItem = (event, item) => {
  selectItem.value = item
  showPopover.value = true
  position.value.clientX = event.clientX || event.touches?.[0]?.clientX || 0
  position.value.clientY = event.clientY || event.touches?.[0]?.clientY || 0
}

const handleDelete = () => {
  const item = selectItem.value
  if (!item) return
  removeEntry({ type: item.type, name: item.name, path: item.path })
  if ((item.target || TARGET.MEDIA) === TARGET.MEDIA) uni.setStorageSync('isreload', true)
  reload()
}

/**
 * 在「媒体库」与「仅资源库」之间切换。
 * 不走 removeEntry：条目要留着供资源库浏览，也不能冲掉播放历史。
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
  uni.setStorageSync('isreload', true)
  uni.showToast({
    title: isMedia ? t('folderPicker.switchedToResource') : t('folderPicker.switchedToMedia'),
    icon: 'none',
  })
  reload()
}

const toPicker = () => {
  // 与移动端一致：带上 type/name，目录树直接定位到该源账号；仍是调整既有目录，用 edit 模式
  const query = { mode: 'edit' }
  if (filterType.value) query.type = filterType.value
  if (filterName.value) query.name = filterName.value
  router.push({ path: '/folder-picker', query })
}

const back = () => {
  router.go(-1)
}
</script>

<style lang="scss" scoped>
.cm {
  height: 100%;
  background: #fff;
  color: #090909;
  overflow-y: auto;
}

.cm-title {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px 20px;
  font-size: 16px;
  font-weight: bold;
  border-bottom: 1px solid #eee;
  cursor: pointer;

  .cm-back {
    font-size: 20px;
  }
}

.cm-body {
  padding: 12px 20px 30px;
}

.cm-group {
  margin-bottom: 18px;

  &__title {
    font-size: 13px;
    color: #999;
    padding: 10px 0 8px;
  }
}

.cm-list {
  border: 1px solid #eee;
  border-radius: 8px;
  overflow: hidden;
}

.cm-item {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  border-bottom: 1px solid #eee;
  cursor: pointer;

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background: #f6f7f8;
  }

  &__icon {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    margin-right: 10px;
  }

  &__glyph {
    width: auto;
    height: auto;
    border-radius: 0;
    font-size: 24px;
    color: #666;
  }

  &__text {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  &__name {
    font-size: 14px;
  }

  &__path {
    font-size: 12px;
    color: #999;
    word-break: break-all;
  }

  &__badge {
    font-size: 11px;
    color: #ff6701;
    border: 1px solid #ff6701;
    border-radius: 4px;
    padding: 0 4px;
  }
}

.cm-empty {
  padding: 16px;
  text-align: center;
  font-size: 13px;
  color: #999;
  border: 1px dashed #eee;
  border-radius: 8px;
}

.cm-add {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 14px;
  border: 1px dashed #ddd;
  border-radius: 8px;
  cursor: pointer;
  color: #94939a;
  font-size: 14px;

  &:hover {
    background: #f6f7f8;
  }
}
</style>