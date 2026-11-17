<template>
  <tv-page @keyCodeClick="keyCodeClick">
    <div class="tv-browse">
      <!-- 面包屑 -->
      <div class="browse-crumb">
        <span v-if="canGoBack" class="crumb-back">←</span>
        <span class="crumb-path">{{ currentPath === '/' ? t('folderPicker.root') : currentPath }}</span>
      </div>

      <!-- 列表 -->
      <div class="browse-list">
        <div
          v-for="(item, index) in list"
          :key="item.name"
          :class="['browse-row', index === tabIndex ? 'row-active' : '']"
          @click="onRowClick(item)"
        >
          <image v-if="fileIconOf(item).kind === 'image'" class="row-icon" :src="fileIconOf(item).value"></image>
          <wil-icon v-else :name="fileIconOf(item).value" :custom-color="fileIconOf(item).color" class="row-icon row-glyph"></wil-icon>
          <span class="row-name">{{ item.name }}</span>
          <span v-if="item.isFolder" class="row-arrow">
            <nut-icon name="right" custom-color="#8a8a8a"></nut-icon>
          </span>
          <span v-else class="row-size">{{ formatSize(item.size) }}</span>
        </div>

        <div v-if="loading" class="list-tip">{{ t('common.loading') }}</div>
        <div v-else-if="error" class="list-tip">{{ error }}</div>
        <div v-else-if="!list.length" class="list-tip">{{ t('folderPicker.emptyFolder') }}</div>
      </div>
    </div>
  </tv-page>
</template>

<script setup>
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import tvPage from '@/components/tv/tv-page/index.vue'
import { useFolderPicker } from '@/hooks/useFolderPicker'
import { getFileIcon, getFileIconName } from '@/utils/sources/fileIcon'
import wilIcon from '@/components/common/wil-icon/index.vue'
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
const tabIndex = ref(0)

const picker = useFolderPicker({ type: '', cred: {} })
const { currentPath, list, loading, error, listCurrent, setSource, enter, back } = picker

const canGoBack = computed(() => currentPath.value !== '/')

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

const onRowClick = item => {
  if (item.isFolder) toEnter(item)
  else playFile(item)
}

const toEnter = async item => {
  await enter(item)
  tabIndex.value = 0
}

/**
 * 播放：跳 TV 播放器并带上 srcType/srcAccount。
 * 播放器的 judgeSelect 优先用这两个参数，否则资源库里的非激活账号取不到流。
 */
const playFile = item => {
  const childPath = `${currentPath.value.replace(/\/+$/, '')}/${item.name}`
  const folderQuery = item.id ? `&folderFileId=${encodeURIComponent(item.id)}` : ''
  uni.navigateTo({
    url: `/pages/tv/video/video-player?path=${encodeURIComponent(childPath)}&noSetHistory=0${folderQuery}&srcType=${encodeURIComponent(sourceType.value)}&srcAccount=${encodeURIComponent(sourceName.value)}`,
  })
}

const goBack = async () => {
  const moved = await back()
  tabIndex.value = 0
  if (!moved) uni.navigateBack()
}

const keyCodeClick = async keyCode => {
  if (keyCode === 'KeyUp') {
    if (tabIndex.value > 0) tabIndex.value--
  } else if (keyCode === 'KeyDown') {
    if (tabIndex.value < list.value.length - 1) tabIndex.value++
  } else if (keyCode === 'KeyRight') {
    const item = list.value[tabIndex.value]
    if (item?.isFolder) toEnter(item)
  } else if (keyCode === 'KeyEnter') {
    const item = list.value[tabIndex.value]
    if (!item) return
    onRowClick(item)
  } else if (keyCode === 'KeyBack') {
    // 返回键在目录树内表示「回上级目录」，已在根目录才退出页面
    await goBack()
  } else if (keyCode === 'KeyLeft') {
    await goBack()
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

  const sourceList = uni.getStorageSync('sourceList') || []
  const group = sourceList.find(g => g.type === sourceType.value)
  const cred = group?.list?.find(i => i.name === sourceName.value)
  if (!cred) {
    uni.showToast({ title: t('source.pleaseAddSourceFirst'), icon: 'none' })
    setTimeout(() => uni.navigateBack(), 800)
    return
  }

  uni.showLoading({ title: t('common.loading') })
  try {
    const effective = await prepareSource(sourceType.value, cred)
    setSource(sourceType.value, effective)
    // 从导入条目指定的起点开始，而不是根目录
    if (options?.path) picker.currentPath.value = decodeURIComponent(options.path)
    if (options?.folderFileId) picker.currentFolderId.value = decodeURIComponent(options.folderFileId)
    await listCurrent()
  } catch (e) {
    uni.showToast({ title: e?.message || t('source.authCheckFailed'), icon: 'none' })
  } finally {
    uni.hideLoading()
  }
})
</script>

<style lang="scss" scoped>
.tv-browse {
  width: 100%;
  height: 100%;
  padding: 40rpx 60rpx;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  color: #fff;
}

.browse-crumb {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 14rpx 24rpx;
  font-size: 32rpx;
  color: #b9b9b9;

  .crumb-back {
    color: #ff6701;
  }
}

.browse-list {
  flex: 1;
  overflow: hidden;
  margin-top: 16rpx;
}

.browse-row {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 20rpx 24rpx;
  border-radius: 12rpx;
  font-size: 32rpx;

  &.row-active {
    background: rgba(255, 103, 1, 0.16);
    outline: 4rpx solid #ff6701;
  }

  .row-icon {
    width: 48rpx;
    height: 48rpx;
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

  .row-size {
    font-size: 26rpx;
    color: #8a8a8a;
  }
}

.list-tip {
  text-align: center;
  padding: 100rpx 0;
  color: #8a8a8a;
  font-size: 30rpx;
}
</style>