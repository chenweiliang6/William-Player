<template>
  <div :class="['folder-picker', themeClass]">
    <!-- 面包屑：显示当前所在层级，可回退 -->
    <div class="folder-picker__crumb">
      <nut-icon name="rect-left" :custom-color="iconColor" @click="onBack"></nut-icon>
      <scroll-view scroll-x class="crumb-scroll">
        <div class="crumb-list">
          <span
            v-for="(c, i) in breadcrumb"
            :key="c.path"
            :class="['crumb-item', i === breadcrumb.length - 1 ? 'crumb-active' : '']"
            @click="onJump(c.path)">{{ c.name === '/' ? t('folderPicker.root') : c.name }}</span>
        </div>
      </scroll-view>
    </div>

    <!-- 操作栏 -->
    <div class="folder-picker__ops">
      <span class="ops-all" @click="toggleAllInCurrent">
        {{ allCheckedInCurrent ? t('folderPicker.unselectAll') : t('folderPicker.selectAll') }}
      </span>
      <span class="ops-count">{{ t('folderPicker.selectedCount', { count: checkedList.length }) }}</span>
    </div>

    <!-- 编辑模式：已导入目录提示（含不在当前层的深层目录，防止误以为丢失） -->
    <div v-if="isEditMode && initialStats.total" class="folder-picker__hint">
      {{ t('folderPicker.keepHint', { total: initialStats.total, hidden: initialStats.hidden }) }}
    </div>

    <!-- 目录列表 -->
    <scroll-view scroll-y class="folder-picker__list" @scrolltolower="noop">
      <div v-if="loading" class="list-tip">{{ t('common.loading') }}</div>
      <div v-else-if="error" class="list-tip list-error">{{ error }}</div>
      <div v-else-if="!list.length" class="list-tip">{{ t('folderPicker.emptyFolder') }}</div>
      <template v-else>
        <div
          v-for="item in list"
          :key="item.name"
          class="list-row"
          @click="onRowClick(item)"
        >
          <!-- 勾选圈：用 successColor 表示已选，弱化灰表示未选 -->
          <nut-icon
            class="row-check"
            :name="isChecked(item) ? 'checked' : 'check-normal'"
            :custom-color="isChecked(item) ? successColor : iconColorMuted"
          ></nut-icon>
          <image v-if="fileIconOf(item).kind === 'image'" class="row-icon" :src="fileIconOf(item).value" />
          <wil-icon v-else :name="fileIconOf(item).value" :custom-color="fileIconOf(item).color" class="row-icon row-glyph" />
          <div class="row-main">
            <span class="row-name">{{ item.name }}</span>
            <span v-if="isAdded(item)" class="row-added">{{ t('folderPicker.addedBadge') }}</span>
          </div>
          <span v-if="item.isFolder" class="row-enter" @click.stop="onEnter(item)">
            <nut-icon name="right" :custom-color="iconColorMuted"></nut-icon>
          </span>
          <span v-else class="row-size">{{ formatSize(item.size) }}</span>
        </div>
      </template>
    </scroll-view>

    <!-- 底部确认 -->
    <div class="folder-picker__footer">
      <nut-button :custom-color="primaryBtnColor" :disabled="!checkedList.length" @click="onConfirm">
        <span :style="{ color: primaryBtnTextColor }">{{ t('folderPicker.importBtn') }}</span>
      </nut-button>
    </div>

    <!-- 导入目标选择 -->
    <nut-popup v-model:visible="showTarget" position="bottom" round safe-area-inset-bottom>
      <div class="target-popup">
        <div class="target-title">{{ t('folderPicker.selectTarget') }}</div>
        <div class="target-item" @click="doImport(TARGET.MEDIA)">
          <div class="target-item__main">
            <span class="target-item__name">{{ t('video.importToMediaLibrary') }}</span>
            <span class="target-item__desc">{{ t('video.importToMediaLibraryDesc') }}</span>
          </div>
          <nut-icon name="right" :custom-color="iconColorMuted"></nut-icon>
        </div>
        <div class="target-item" @click="doImport(TARGET.RESOURCE)">
          <div class="target-item__main">
            <span class="target-item__name">{{ t('video.importToResourceLibrary') }}</span>
            <span class="target-item__desc">{{ t('video.importToResourceLibraryDesc') }}</span>
          </div>
          <nut-icon name="right" :custom-color="iconColorMuted"></nut-icon>
        </div>
      </div>
    </nut-popup>

    <wil-modal ref="wil_modal"></wil-modal>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import { useThemeClass } from '@/hooks/useThemeClass'
import { useThemeColors } from '@/hooks/useThemeColors'
import { useFolderPicker } from '@/hooks/useFolderPicker'
import { getFileIcon, getFileIconName } from '@/utils/sources/fileIcon'
import wilIcon from '@/components/common/wil-icon/index.vue'
import { addEntries, syncEntries, getEntries, TARGET } from '@/utils/sources/mulu'
import { loginUser, get189Folder, getQuarkFolder, getWopanFolder, get139Folder } from '@/utils/common'
import wilModal from '@/components/mobile/wil-modal/index.vue'

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
const themeClass = useThemeClass()
const { primaryBtnColor, primaryBtnTextColor, iconColor, iconColorMuted, successColor } = useThemeColors()

const wil_modal = ref(null)
const routerParams = ref({})
const showTarget = ref(false)
const sourceType = ref('')
const sourceName = ref('')
// add = 新增源后首次勾选；edit = 修改源后调整已导入目录
const pickerMode = ref('add')
const isEditMode = computed(() => pickerMode.value === 'edit')

// 先用空凭据初始化，onLoad 拿到账号、刷新 token 后调 setSource 换掉
const picker = useFolderPicker({ type: '', cred: {} })
const {
  breadcrumb, list, loading, error, checkedList, allCheckedInCurrent, initialStats,
  listCurrent, setSource, setInitialEntries, enter, back, jumpTo, isChecked, isAdded, toggle, toggleAllInCurrent, resolvePicked,
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

const noop = () => {}

const onRowClick = item => {
  // 点整行 = 勾选；点右侧箭头 = 下钻
  toggle(item)
}

const onEnter = item => {
  enter(item)
}

const onBack = async () => {
  const moved = await back()
  if (!moved) uni.navigateBack()
}

const onJump = path => {
  jumpTo(path)
}

/**
 * 点击导入：先判断是否需要询问「导入父级」。
 * 当前层全选时，导入父级能自动同步后续新增/删除的视频。
 */
const onConfirm = () => {
  if (!checkedList.value.length) return
  if (allCheckedInCurrent.value && picker.currentPath.value !== '/') {
    wil_modal.value.showModal({
      title: t('modal.warmTip'),
      content: t('video.importParentConfirm', { name: picker.currentName.value }),
      confirmColor: '#ff6701',
      confirm: () => {
        showTarget.value = true
        pendingParent.value = true
      },
      cancel: () => {
        showTarget.value = true
        pendingParent.value = false
      },
    })
    return
  }
  pendingParent.value = false
  showTarget.value = true
}

const pendingParent = ref(false)

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

  uni.showToast({ title: t('folderPicker.imported'), icon: 'success' })
  setTimeout(() => {
    // 导入到媒体库（或改动涉及媒体库目录）后需要重新刮削
    if (needRescrape) uni.setStorageSync('isreload', true)
    uni.navigateBack()
  }, 700)
}

/**
 * 按源类型取根目录，验证凭据可用后再放开列表。
 * 与 select-source.vue 的做法保持一致，避免两套登录逻辑。
 */
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

  // 未指定账号时（如从「导入目录管理」进入）回退到第一个目录型源，与 PC 端行为一致
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
    // 校验/刷新凭据（alist 的 token 有有效期，添加后存的可能已过期）
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
})
</script>

<style lang="scss" scoped>
.folder-picker {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--app-bg);
  color: var(--app-text-primary);

  &__crumb {
    display: flex;
    align-items: center;
    padding: 20rpx 24rpx;
    gap: 12rpx;
    border-bottom: 2rpx solid var(--app-border);
  }

  &__ops {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16rpx 24rpx;
    font-size: 28rpx;

    .ops-all {
      color: var(--app-brand);
    }

    .ops-count {
      color: var(--app-text-tertiary);
    }
  }

  &__hint {
    padding: 12rpx 24rpx;
    font-size: 24rpx;
    line-height: 1.5;
    color: var(--app-text-tertiary);
    background: var(--app-bg-card);
    border-bottom: 2rpx solid var(--app-border);
  }

  &__list {
    flex: 1;
    overflow: hidden;
  }

  &__footer {
    padding: 20rpx 24rpx calc(20rpx + env(safe-area-inset-bottom));
    border-top: 2rpx solid var(--app-border);
  }
}

.crumb-scroll {
  flex: 1;
  white-space: nowrap;
}

.crumb-list {
  display: inline-flex;
  align-items: center;

  .crumb-item {
    font-size: 28rpx;
    color: var(--app-text-tertiary);
    padding: 0 8rpx;
  }

  .crumb-active {
    color: var(--app-text-primary);
    font-weight: bold;
  }
}

.list-tip {
  text-align: center;
  padding: 80rpx 0;
  color: var(--app-text-tertiary);
  font-size: 28rpx;
}

.list-error {
  color: var(--app-danger, #fe4344);
}

.list-row {
  display: flex;
  align-items: center;
  padding: 24rpx;
  background: var(--app-bg-card);
  border-bottom: 2rpx solid var(--app-border);

  .row-check {
    margin-right: 20rpx;
  }

  .row-icon {
    width: 56rpx;
    height: 56rpx;
    margin-right: 20rpx;
  }

  .row-glyph {
    width: auto;
    height: auto;
    font-size: 56rpx;
  }

  .row-main {
    flex: 1;
    overflow: hidden;
    display: flex;
    align-items: center;
    gap: 12rpx;

    .row-name {
      font-size: 30rpx;
      color: var(--app-text-primary);
      word-break: break-all;
    }

    .row-added {
      flex-shrink: 0;
      font-size: 22rpx;
      color: var(--app-brand);
      border: 2rpx solid var(--app-brand);
      border-radius: 8rpx;
      padding: 0 8rpx;
    }
  }

  .row-enter {
    padding: 0 8rpx;
  }

  .row-size {
    font-size: 26rpx;
    color: var(--app-text-tertiary);
  }
}

.target-popup {
  padding: 32rpx 24rpx calc(32rpx + env(safe-area-inset-bottom));

  .target-title {
    text-align: center;
    font-size: 32rpx;
    font-weight: bold;
    padding-bottom: 24rpx;
    color: var(--app-text-primary);
  }

  .target-item {
    display: flex;
    align-items: center;
    padding: 24rpx;
    margin-bottom: 16rpx;
    border-radius: 16rpx;
    background: var(--app-bg-card);

    &__main {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 8rpx;
    }

    &__name {
      font-size: 30rpx;
      color: var(--app-text-primary);
    }

    &__desc {
      font-size: 24rpx;
      color: var(--app-text-tertiary);
      line-height: 1.4;
    }
  }
}
</style>
