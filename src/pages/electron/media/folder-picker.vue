<template>
  <div class="efp">
    <!-- 面包屑 -->
    <div class="efp-head">
      <span class="head-back" @click="onBack">←</span>
      <span class="head-path">{{ currentPath === '/' ? t('folderPicker.root') : currentPath }}</span>
    </div>

    <!-- 操作条 -->
    <div class="efp-ops">
      <nut-button size="small" @click="toggleAllInCurrent">
        {{ allCheckedInCurrent ? t('folderPicker.unselectAll') : t('folderPicker.selectAll') }}
      </nut-button>
      <span class="ops-count">{{ t('folderPicker.selectedCount', { count: checkedList.length }) }}</span>
    </div>

    <!-- 编辑模式：已导入目录提示（含不在当前层的深层目录，防止误以为丢失） -->
    <div v-if="isEditMode && initialStats.total" class="efp-hint">
      {{ t('folderPicker.keepHint', { total: initialStats.total, hidden: initialStats.hidden }) }}
    </div>

    <!-- 列表：单击勾选、双击下钻、Shift 范围选 -->
    <div class="efp-list" @click.self="clearLastIndex">
      <div v-if="loading" class="list-tip">{{ t('common.loading') }}</div>
      <div v-else-if="error" class="list-tip list-error">{{ error }}</div>
      <div v-else-if="!list.length" class="list-tip">{{ t('folderPicker.emptyFolder') }}</div>
      <template v-else>
        <div
          v-for="(item, index) in list"
          :key="item.name"
          :class="['efp-row', isChecked(item) ? 'row-checked' : '']"
          @click="onRowClick($event, item, index)"
          @dblclick="onRowDblClick(item)"
        >
          <nut-icon
            class="row-check"
            :name="isChecked(item) ? 'checked' : 'check-normal'"
            :custom-color="isChecked(item) ? '#00c286' : '#bbbbbb'"
          ></nut-icon>
          <image v-if="fileIconOf(item).kind === 'image'" class="row-icon" :src="fileIconOf(item).value" />
          <wil-icon v-else :name="fileIconOf(item).value" :custom-color="fileIconOf(item).color" class="row-icon row-glyph" />
          <span class="row-name">{{ item.name }}</span>
          <span v-if="isAdded(item)" class="row-added">{{ t('folderPicker.addedBadge') }}</span>
          <span v-if="item.isFolder" class="row-enter" @click.stop="onEnter(item)">
            <nut-icon name="right" custom-color="#bbbbbb"></nut-icon>
          </span>
          <span v-else class="row-size">{{ formatSize(item.size) }}</span>
        </div>
      </template>
    </div>

    <!-- 底部 -->
    <div class="efp-footer">
      <nut-button type="default" @click="back">{{ t('common.cancel') }}</nut-button>
      <nut-button type="info" :disabled="!checkedList.length" @click="onConfirm">{{ t('folderPicker.importBtn') }}</nut-button>
    </div>

    <!-- 导入目标 -->
    <nut-dialog v-model:visible="showTarget" :title="t('folderPicker.selectTarget')" :footer="null">
      <div class="target-list">
        <div class="target-item" @click="doImport(TARGET.MEDIA)">
          <div class="target-item__name">{{ t('video.importToMediaLibrary') }}</div>
          <div class="target-item__desc">{{ t('video.importToMediaLibraryDesc') }}</div>
        </div>
        <div class="target-item" @click="doImport(TARGET.RESOURCE)">
          <div class="target-item__name">{{ t('video.importToResourceLibrary') }}</div>
          <div class="target-item__desc">{{ t('video.importToResourceLibraryDesc') }}</div>
        </div>
      </div>
    </nut-dialog>

    <!-- 勾父级询问 -->
    <nut-dialog
      v-model:visible="showParentAsk"
      :title="t('modal.warmTip')"
      :content="parentAskMessage"
      :ok-text="t('common.confirm')"
      :cancel-text="t('common.cancel')"
      @ok="onParentAccept"
      @cancel="onParentReject"
    ></nut-dialog>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useFolderPicker } from '@/hooks/useFolderPicker'
import { getFileIcon, getFileIconName } from '@/utils/sources/fileIcon'
import wilIcon from '@/components/common/wil-icon/index.vue'
import { addEntries, syncEntries, getEntries, TARGET } from '@/utils/sources/mulu'
import { loginUser, get189Folder, getQuarkFolder, getWopanFolder, get139Folder } from '@/utils/common'

const { t } = useI18n()

/**
 * 文件图标：带缩略图的图片文件仍用 <image> 显示缩略图，其余走字形。
 * 字形自带颜色（文件夹橙 / 视频蓝灰 / 图片蓝 / 文件黑），与原 png 一致。
 */
const fileIconOf = item => {
  const info = getFileIconName(item)
  if (!info) return { kind: 'image', value: getFileIcon(item) }
  return { kind: 'glyph', value: info.glyph, color: info.color }
}
const route = useRoute()
const router = useRouter()

const showTarget = ref(false)
const showParentAsk = ref(false)
const parentAskMessage = ref('')
const pendingParent = ref(false)
const lastIndex = ref(-1)

const sourceType = ref('')
const sourceName = ref('')
// add = 新增源后首次勾选；edit = 修改源后调整已导入目录
const pickerMode = ref('add')
const isEditMode = computed(() => pickerMode.value === 'edit')

const picker = useFolderPicker({ type: '', cred: {} })
const {
  currentPath, list, loading, error, checkedList, allCheckedInCurrent, initialStats,
  listCurrent, setSource, setInitialEntries, enter, back, isChecked, isAdded, toggle, toggleAllInCurrent, resolvePicked, currentName,
} = picker

const formatSize = size => {
  if (!size) return ''
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let v = Number(size)
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

const clearLastIndex = () => {
  lastIndex.value = -1
}

/** 单击勾选；Shift 点击做范围选 */
const onRowClick = (event, item, index) => {
  if (event.shiftKey && lastIndex.value >= 0 && lastIndex.value !== index) {
    const [a, b] = [lastIndex.value, index].sort((x, y) => x - y)
    for (let i = a; i <= b; i++) {
      const row = list.value[i]
      if (row && !isChecked(row)) toggle(row)
    }
  } else {
    toggle(item)
  }
  lastIndex.value = index
}

const onRowDblClick = item => {
  if (item.isFolder) enter(item)
}

const onEnter = item => {
  enter(item)
}

const onBack = async () => {
  const moved = await back()
  if (!moved) router.back()
}

const onConfirm = () => {
  if (!checkedList.value.length) return
  if (allCheckedInCurrent.value && currentPath.value !== '/') {
    parentAskMessage.value = t('video.importParentConfirm', { name: currentName.value })
    showParentAsk.value = true
    return
  }
  pendingParent.value = false
  showTarget.value = true
}

const onParentAccept = () => {
  pendingParent.value = true
  showTarget.value = true
}
const onParentReject = () => {
  pendingParent.value = false
  showTarget.value = true
}

const doImport = target => {
  showTarget.value = false
  const picked = resolvePicked(pendingParent.value)
  if (!picked.length) return

  let needRescrape = target === TARGET.MEDIA
  if (isEditMode.value) {
    // 编辑模式：以本次勾选为准整体同步（未勾选 = 用户取消导入）
    const res = syncEntries({ type: sourceType.value, name: sourceName.value, picked, target })
    needRescrape = needRescrape || res.mediaTouched
  } else {
    addEntries({ type: sourceType.value, name: sourceName.value, picked, target })
  }

  uni.showToast({ title: t('folderPicker.imported'), icon: 'none' })
  setTimeout(() => {
    if (needRescrape) uni.setStorageSync('isreload', true)
    router.back()
  }, 600)
}

const prepareSource = async (type, cred) => {
  if (type === 'WebDAV') {
    const res = await loginUser(cred)
    if (!res?.data?.token) throw new Error(t('source.authCheckFailed'))
    return { ...cred, token: res.data.token }
  }
  if (type === '天翼云盘') {
    const res = await get189Folder({ folderId: '-11' }, cred)
    if (res?.res_code && res.res_code !== 0) throw new Error(t('source.reloginTianyiCloudDrive'))
    return cred
  }
  if (type === '夸克网盘') {
    const res = await getQuarkFolder({ fid: '0' }, cred)
    if (res?.status && res.status !== 200) throw new Error(t('source.reloginQuarkCloudDrive'))
    return cred
  }
  if (type === '联通云盘') {
    await getWopanFolder({ folderId: '0' }, cred)
    return cred
  }
  if (type === '移动云盘') {
    await get139Folder({ folderId: 'root' }, cred)
    return cred
  }
  return cred
}

/**
 * 进入页面时准备源账号。
 * 优先用路由参数；PC 端从资源库某一行进来时会带上 type/name。
 */
const init = async () => {
  sourceType.value = String(route.query.type || '')
  sourceName.value = String(route.query.name || '')
  pickerMode.value = String(route.query.mode || 'add')

  const sourceList = uni.getStorageSync('sourceList') || []
  let group = sourceList.find(g => g.type === sourceType.value)
  let cred = group?.list?.find(i => i.name === sourceName.value)

  // 未指定账号时，回退到第一个有账号的目录型源
  if (!cred) {
    for (const g of sourceList) {
      if (!g.list?.length) continue
      if (g.type === 'Emby') continue
      group = g
      cred = g.list[0]
      sourceType.value = g.type
      sourceName.value = cred.name
      break
    }
  }
  if (!cred) {
    uni.showToast({ title: t('source.pleaseAddSourceFirst'), icon: 'none' })
    router.back()
    return
  }

  uni.showLoading({ title: t('common.loading') })
  try {
    const effective = await prepareSource(sourceType.value, cred)
    setSource(sourceType.value, effective)
    // 回填必须在 setSource 之后：setSource 会清空勾选表
    if (isEditMode.value) setInitialEntries(getEntries(sourceType.value, sourceName.value))
    await listCurrent()
  } catch (e) {
    uni.showToast({ title: e?.message || t('source.authCheckFailed'), icon: 'none' })
  } finally {
    uni.hideLoading()
  }
}

init()
</script>

<style lang="scss" scoped>
.efp {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #fff;
  color: #090909;
  padding: 16px 20px;
  box-sizing: border-box;
}

.efp-head {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  padding-bottom: 10px;
  border-bottom: 1px solid #eee;

  .head-back {
    cursor: pointer;
    color: #ff6701;
  }

  .head-path {
    color: #666;
    word-break: break-all;
  }
}

.efp-ops {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 0;
  font-size: 13px;

  .ops-count {
    color: #999;
  }
}

.efp-hint {
  padding: 6px 10px;
  font-size: 12px;
  line-height: 1.5;
  color: #999;
  background: #f6f7f8;
  border-radius: 6px;
}

.efp-list {
  flex: 1;
  overflow-y: auto;
}

.list-tip {
  text-align: center;
  padding: 60px 0;
  color: #999;
}

.list-error {
  color: #fe4344;
}

.efp-row {
  display: flex;
  align-items: center;
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;

  &:hover {
    background: #f6f7f8;
  }

  &.row-checked {
    background: #f0fbf7;
  }

  .row-check {
    margin-right: 10px;
  }

  .row-icon {
    width: 24px;
    height: 24px;
    margin-right: 10px;
  }

  .row-glyph {
    width: auto;
    height: auto;
    font-size: 24px;
  }

  .row-name {
    flex: 1;
    font-size: 14px;
    word-break: break-all;
  }

  .row-added {
    flex-shrink: 0;
    margin-right: 8px;
    font-size: 11px;
    color: #ff6701;
    border: 1px solid #ff6701;
    border-radius: 4px;
    padding: 0 4px;
  }

  .row-enter {
    padding: 0 6px;
  }

  .row-size {
    font-size: 12px;
    color: #999;
  }
}

.efp-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 12px;
  border-top: 1px solid #eee;
}

.target-list {
  .target-item {
    padding: 12px;
    border-radius: 8px;
    cursor: pointer;
    margin-bottom: 8px;
    border: 1px solid #eee;

    &:hover {
      background: #f6f7f8;
    }

    &__name {
      font-size: 14px;
      color: #090909;
    }

    &__desc {
      font-size: 12px;
      color: #999;
      margin-top: 4px;
    }
  }
}
</style>