<template>
  <tv-page @keyCodeClick="keyCodeClick">
    <div class="tv-folder-picker">
      <!-- 面包屑：焦点在最上方时可左右切换到上级 -->
      <div :class="['picker-crumb', focusArea === 'crumb' ? 'crumb-active' : '']">
        <span v-if="canGoBack" class="crumb-back" @click="onBack">←</span>
        <span class="crumb-path">{{ currentPath === '/' ? t('folderPicker.root') : currentPath }}</span>
      </div>

      <!-- 编辑模式：已导入目录提示（含不在当前层的深层目录，防止误以为丢失） -->
      <div v-if="isEditMode && initialStats.total" class="picker-hint">
        {{ t('folderPicker.keepHint', { total: initialStats.total, hidden: initialStats.hidden }) }}
      </div>

      <!-- 目录列表 -->
      <div class="picker-list">
        <div
          v-for="(item, index) in list"
          :key="item.name"
          :class="['picker-row', focusArea === 'list' && rowIndex === index ? 'row-active' : '']"
          @click="onRowClick(item)"
        >
          <!-- 左区：勾选框；右区：进入箭头 -->
          <span :class="['row-check', focusArea === 'list' && rowIndex === index && colIndex === 0 ? 'cell-active' : '']">
            <nut-icon
              :name="isChecked(item) ? 'checked' : 'check-normal'"
              :custom-color="isChecked(item) ? '#00c286' : '#8a8a8a'"
            ></nut-icon>
          </span>
          <image v-if="fileIconOf(item).kind === 'image'" class="row-icon" :src="fileIconOf(item).value" />
          <wil-icon v-else :name="fileIconOf(item).value" :custom-color="fileIconOf(item).color" class="row-icon row-glyph" />
          <span class="row-name">{{ item.name }}</span>
          <span v-if="isAdded(item)" class="row-added">{{ t('folderPicker.addedBadge') }}</span>
          <span
            v-if="item.isFolder"
            :class="['row-enter', focusArea === 'list' && rowIndex === index && colIndex === 1 ? 'cell-active' : '']"
          >
            <nut-icon name="right" custom-color="#8a8a8a"></nut-icon>
          </span>
        </div>

        <div v-if="loading" class="list-tip">{{ t('common.loading') }}</div>
        <div v-else-if="error" class="list-tip">{{ error }}</div>
        <div v-else-if="!list.length" class="list-tip">{{ t('folderPicker.emptyFolder') }}</div>
      </div>

      <!-- 底部操作条 -->
      <div :class="['picker-footer', focusArea === 'footer' ? 'footer-active' : '']">
        <span :class="['footer-btn', footerIndex === 0 ? 'btn-active' : '']" @click="toggleAllInCurrent">
          {{ allCheckedInCurrent ? t('folderPicker.unselectAll') : t('folderPicker.selectAll') }}
        </span>
        <span class="footer-count">{{ t('folderPicker.selectedCount', { count: checkedList.length }) }}</span>
        <span :class="['footer-btn', footerIndex === 1 ? 'btn-active' : '']" @click="onConfirm">{{ t('folderPicker.importBtn') }}</span>
      </div>
    </div>

    <!-- 导入目标选择（两项，遥控器上下切换） -->
    <div v-if="showTarget" class="target-mask">
      <div class="target-box">
        <div class="target-title">{{ t('folderPicker.selectTarget') }}</div>
        <div
          v-for="(opt, i) in targetOptions"
          :key="opt.value"
          :class="['target-opt', targetIndex === i ? 'opt-active' : '']"
          @click="doImport(opt.value)"
        >
          <div class="opt-name">{{ opt.name }}</div>
          <div class="opt-desc">{{ opt.desc }}</div>
        </div>
        <div :class="['target-cancel', targetIndex === targetOptions.length ? 'opt-active' : '']" @click="showTarget = false">
          {{ t('common.cancel') }}
        </div>
      </div>
    </div>

    <!-- 勾父级询问 -->
    <tv-modal
      ref="tv_modal"
      :title="t('modal.warmTip')"
      :message="parentAskMessage"
      v-model:visible="showParentAsk"
      @cancel="onParentReject"
      @confirm="onParentAccept"
    ></tv-modal>
  </tv-page>
</template>

<script setup>
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import tvPage from '@/components/tv/tv-page/index.vue'
import tvModal from '@/components/tv/tv-modal/index.vue'
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

const routerParams = ref({})
const sourceType = ref('')
const sourceName = ref('')
// add = 新增源后首次勾选；edit = 修改源后调整已导入目录
const pickerMode = ref('add')
const isEditMode = computed(() => pickerMode.value === 'edit')

const picker = useFolderPicker({ type: '', cred: {} })
const {
  currentPath, breadcrumb, list, loading, error, checkedList, allCheckedInCurrent, initialStats,
  listCurrent, setSource, setInitialEntries, enter, back, isChecked, isAdded, toggle, toggleAllInCurrent, resolvePicked, currentName,
} = picker

// 焦点区域：crumb / list / footer
const focusArea = ref('list')
const rowIndex = ref(0)
const colIndex = ref(0) // 0=勾选框，1=进入箭头
const footerIndex = ref(1) // 0=全选，1=导入

const showTarget = ref(false)
const targetIndex = ref(0)
const showParentAsk = ref(false)
const parentAskMessage = ref('')
const pendingParent = ref(false)
const tv_modal = ref(null)

const canGoBack = computed(() => currentPath.value !== '/')

const targetOptions = computed(() => [
  { value: TARGET.MEDIA, name: t('video.importToMediaLibrary'), desc: t('video.importToMediaLibraryDesc') },
  { value: TARGET.RESOURCE, name: t('video.importToResourceLibrary'), desc: t('video.importToResourceLibraryDesc') },
])

const clampRow = () => {
  if (rowIndex.value > list.value.length - 1) rowIndex.value = Math.max(0, list.value.length - 1)
}

const onRowClick = item => {
  toggle(item)
}

const onBack = async () => {
  const moved = await back()
  if (!moved) uni.navigateBack()
  rowIndex.value = 0
  colIndex.value = 0
}

const onConfirm = () => {
  if (!checkedList.value.length) return
  if (allCheckedInCurrent.value && currentPath.value !== '/') {
    parentAskMessage.value = t('video.importParentConfirm', { name: currentName.value })
    showParentAsk.value = true
    return
  }
  pendingParent.value = false
  openTarget()
}

const onParentAccept = () => {
  pendingParent.value = true
  openTarget()
}
const onParentReject = () => {
  pendingParent.value = false
  openTarget()
}

const openTarget = () => {
  targetIndex.value = 0
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
    uni.navigateBack()
  }, 700)
}

/** 列表区上下移动 */
const moveRow = delta => {
  const next = rowIndex.value + delta
  if (next < 0) {
    // 到顶继续上 → 面包屑
    focusArea.value = canGoBack.value ? 'crumb' : 'list'
    return
  }
  if (next > list.value.length - 1) {
    // 到底继续下 → 底部操作条
    focusArea.value = 'footer'
    footerIndex.value = 1
    return
  }
  rowIndex.value = next
  colIndex.value = 0
}

const keyCodeClick = async keyCode => {
  // 导入目标弹层优先接管按键
  if (showTarget.value) {
    if (keyCode === 'KeyUp') targetIndex.value = Math.max(0, targetIndex.value - 1)
    else if (keyCode === 'KeyDown') targetIndex.value = Math.min(targetOptions.value.length, targetIndex.value + 1)
    else if (keyCode === 'KeyEnter') {
      if (targetIndex.value >= targetOptions.value.length) showTarget.value = false
      else doImport(targetOptions.value[targetIndex.value].value)
    } else if (keyCode === 'KeyBack') showTarget.value = false
    return
  }
  if (showParentAsk.value) {
    tv_modal.value?.evtMove?.(keyCode)
    return
  }

  if (focusArea.value === 'crumb') {
    if (keyCode === 'KeyDown') focusArea.value = 'list'
    else if (keyCode === 'KeyEnter') await onBack()
    else if (keyCode === 'KeyBack') uni.navigateBack()
    return
  }

  if (focusArea.value === 'footer') {
    if (keyCode === 'KeyUp') {
      if (list.value.length) focusArea.value = 'list'
      else focusArea.value = canGoBack.value ? 'crumb' : 'footer'
    } else if (keyCode === 'KeyLeft') footerIndex.value = Math.max(0, footerIndex.value - 1)
    else if (keyCode === 'KeyRight') footerIndex.value = Math.min(1, footerIndex.value + 1)
    else if (keyCode === 'KeyEnter') {
      if (footerIndex.value === 0) toggleAllInCurrent()
      else onConfirm()
    } else if (keyCode === 'KeyBack') await onBack()
    return
  }

  // list
  if (keyCode === 'KeyUp') moveRow(-1)
  else if (keyCode === 'KeyDown') moveRow(1)
  else if (keyCode === 'KeyLeft') colIndex.value = 0
  else if (keyCode === 'KeyRight') {
    const item = list.value[rowIndex.value]
    colIndex.value = item?.isFolder ? 1 : 0
  } else if (keyCode === 'KeyEnter') {
    const item = list.value[rowIndex.value]
    if (!item) return
    if (item.isFolder && colIndex.value === 1) {
      await enter(item)
      rowIndex.value = 0
      colIndex.value = 0
    } else {
      toggle(item)
    }
  } else if (keyCode === 'KeyBack') {
    await onBack()
  }
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

onLoad(async options => {
  routerParams.value = options || {}
  sourceType.value = decodeURIComponent(options?.type || '')
  sourceName.value = decodeURIComponent(options?.name || '')
  pickerMode.value = decodeURIComponent(options?.mode || 'add')

  const sourceList = uni.getStorageSync('sourceList') || []
  let group = sourceList.find(g => g.type === sourceType.value)
  let cred = group?.list?.find(i => i.name === sourceName.value)

  // 未指定账号时（TV 的「导入目录管理」就属于这种）回退到第一个目录型源
  if (!cred) {
    for (const g of sourceList) {
      if (!g.list?.length || g.type === 'Emby') continue
      group = g
      cred = g.list[0]
      sourceType.value = g.type
      sourceName.value = cred.name
      break
    }
  }
  if (!cred) {
    uni.showToast({ title: t('source.pleaseAddSourceFirst'), icon: 'none' })
    setTimeout(() => uni.navigateBack(), 800)
    return
  }

  uni.showLoading({ title: t('common.loading') })
  try {
    const effective = await prepareSource(sourceType.value, cred)
    setSource(sourceType.value, effective)
    // 回填必须在 setSource 之后：setSource 会清空勾选表
    if (isEditMode.value) setInitialEntries(getEntries(sourceType.value, sourceName.value))
    await listCurrent()
    clampRow()
  } catch (e) {
    uni.showToast({ title: e?.message || t('source.authCheckFailed'), icon: 'none' })
  } finally {
    uni.hideLoading()
  }
})
</script>

<style lang="scss" scoped>
.tv-folder-picker {
  width: 100%;
  height: 100%;
  padding: 40rpx 60rpx;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  color: #fff;
}

.picker-crumb {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 16rpx 24rpx;
  border-radius: 12rpx;
  font-size: 32rpx;
  color: #b9b9b9;

  &.crumb-active {
    outline: 4rpx solid #ff6701;
    color: #fff;
  }

  .crumb-back {
    color: #ff6701;
  }
}

.picker-list {
  flex: 1;
  overflow: hidden;
  margin-top: 24rpx;
}

.picker-row {
  display: flex;
  align-items: center;
  padding: 20rpx 24rpx;
  border-radius: 12rpx;
  font-size: 32rpx;

  &.row-active {
    background: rgba(255, 103, 1, 0.12);
  }

  .row-check,
  .row-enter {
    padding: 6rpx;
    border-radius: 8rpx;

    &.cell-active {
      outline: 4rpx solid #ff6701;
    }
  }

  .row-icon {
    width: 48rpx;
    height: 48rpx;
    margin: 0 20rpx;
  }

  .row-glyph {
    width: auto;
    height: auto;
    font-size: 48rpx;
  }

  .row-name {
    flex: 1;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .row-added {
    flex-shrink: 0;
    margin-left: 16rpx;
    font-size: 22rpx;
    color: #ff6701;
    border: 2rpx solid #ff6701;
    border-radius: 8rpx;
    padding: 0 8rpx;
  }
}

.picker-hint {
  padding: 12rpx 24rpx;
  font-size: 24rpx;
  line-height: 1.5;
  color: #8a8a8a;
}

.list-tip {
  text-align: center;
  padding: 80rpx 0;
  color: #8a8a8a;
  font-size: 30rpx;
}

.picker-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 24rpx;
  border-top: 2rpx solid #2a2a2a;

  &.footer-active {
    background: rgba(255, 255, 255, 0.04);
  }

  .footer-btn {
    padding: 10rpx 28rpx;
    border-radius: 10rpx;
    font-size: 30rpx;

    &.btn-active {
      outline: 4rpx solid #ff6701;
      color: #ff6701;
    }
  }

  .footer-count {
    color: #8a8a8a;
    font-size: 28rpx;
  }
}

.target-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}

.target-box {
  width: 720rpx;
  background: #1c1c1c;
  border-radius: 20rpx;
  padding: 32rpx;

  .target-title {
    text-align: center;
    font-size: 34rpx;
    padding-bottom: 24rpx;
    color: #fff;
  }

  .target-opt,
  .target-cancel {
    padding: 24rpx;
    border-radius: 12rpx;
    margin-bottom: 16rpx;

    &.opt-active {
      outline: 4rpx solid #ff6701;
      background: rgba(255, 103, 1, 0.12);
    }
  }

  .opt-name {
    font-size: 32rpx;
    color: #fff;
  }

  .opt-desc {
    font-size: 26rpx;
    color: #8a8a8a;
    margin-top: 8rpx;
  }

  .target-cancel {
    text-align: center;
    font-size: 30rpx;
    color: #b9b9b9;
    margin-bottom: 0;
  }
}
</style>