<template>
  <div :class="['download', themeClass]">
    <wil-navbar :title="t('navbar.downloadManagement')" :rightShow="true">
      <template #right>
        <wil-icon name="gengduo" class="navbar-more" @click="showActionPopover = true" />
      </template>
    </wil-navbar>
    <div class="download-container">
      <template v-if="downloadList?.length">
        <div class="download-title">{{ t('toolbox.downloadingCount', { count: downloadList?.length }) }}</div>
        <div class="download-list">
          <list-item
            v-for="item in downloadList"
            :key="item.id"
            :data="item"
            @click="openDocument(item)"
            @pauseById="pauseById"
            @resumeById="resumeById"
            @deleteById="deleteById"></list-item>
        </div>
      </template>
      <template v-if="completedList?.length">
        <div class="completed-title">{{ t('toolbox.completedDownloadCount', { count: completedList?.length }) }}</div>
        <div class="completed-list">
          <list-item
            v-for="item in completedList"
            :key="item.id"
            :data="item"
            @click="openDocument(item)"
            @deleteById="deleteById"></list-item>
        </div>
      </template>
    </div>
    <nut-popup v-model:visible="showActionPopover" position="bottom" round safe-area-inset-bottom>
      <div :class="['download-actions', themeClass]">
        <nut-cell v-if="downloadList?.length" :title="t('toolbox.pauseAllTasks')" @click="handlePauseAll"></nut-cell>
        <nut-cell v-if="pausedCount" :title="t('toolbox.resumeAllTasks')" @click="handleResumeAll"></nut-cell>
        <nut-cell v-if="completedList?.length" :title="t('toolbox.clearCompletedTasks')" @click="handleClearCompleted"></nut-cell>
        <nut-cell v-if="taskList?.length" :title="t('toolbox.deleteAllTasks')" @click="handleDeleteAll"></nut-cell>
      </div>
    </nut-popup>
    <wil-modal ref="wil_modal"></wil-modal>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onUnload } from '@dcloudio/uni-app'
import listItem from './components/list-item.vue'
import { useThemeClass } from '@/hooks/useThemeClass'
import { useI18n } from 'vue-i18n'
import { useI18nNavbar } from '@/hooks/useI18nNavbar'
import { initDownloader, ACTIVE_STATUS, pauseAll, resumeAll, deleteAll, clearCompleted } from '@/utils/download'
import wilModal from '@/components/mobile/wil-modal/index.vue'
import wilIcon from '@/components/common/wil-icon/index.vue'

const themeClass = useThemeClass()
const { t } = useI18n()
useI18nNavbar('navbar.downloadManagement')
const taskList = ref([])
const downloadList = ref([])
const completedList = ref([])
const showActionPopover = ref(false)
const wil_modal = ref(null)
let DownloaderManager = null
let isListener = false //是否正在监听
//暂停中的任务数，决定「全部继续」是否显示
const pausedCount = computed(() => taskList.value.filter(i => i.status === 'PAUSED').length)

//本页自己的模块实例：startListener / stopListener 挂在实例上，
//只在本页内成对调用，避免和 utils/download.js 的实例互相顶掉监听
const getDownloader = () => {
  if (!DownloaderManager) {
    DownloaderManager = uni.requireNativePlugin('WilliamDownloader')
  }
  return DownloaderManager
}

const openDocument = item => {
  // 未完成时磁盘上只有 xxx.part，filePath 指向的正式文件并不存在，点了必然播放失败
  if (item.status !== 'COMPLETED') return
  // v2 的文件落在外置专属目录，路径由原生按数据库给出，不要再自己拼
  if (!item.filePath) return
  uni.navigateTo({
    url: `/pages/mobile/video/video-player?videoUrl=${encodeURIComponent(item.filePath)}&noSetHistory=0`, //noSetHistory为0表示不缓存历史播放记录
  })
}

//监听下载进度
const startListener = () => {
  if (!isListener) {
    isListener = true //此时已经在监听了
    getDownloader().startListener(result => {
      // v2 的 data 已经是对象，不要再 JSON.parse
      const res = result && result.data
      if (res && typeof res === 'object') {
        const obj = {
          id: res.id,
          name: res.name,
          filePath: res.filePath,
          imgUrl: res.poster,
          status: res.status,
          errorCode: res.errorCode,
          errorMsg: res.errorMsg,
          percent: res.percent,
          current_size: res.doneText,
          total_size: res.totalText,
          speedText: res.speedText,
        }
        const exit = taskList.value.find(i => i.id === obj.id)
        if (exit) {
          Object.assign(exit, obj)
        } else {
          taskList.value.unshift(obj)
        }
        refreshLists()
      }
    })
  }
}

//按状态拆分进行中 / 已完成两份列表
const refreshLists = () => {
  downloadList.value = taskList.value.filter(i => ACTIVE_STATUS.includes(i.status))
  completedList.value = taskList.value.filter(i => i.status === 'COMPLETED')
}

//暂停单个下载任务
const pauseById = id => {
  getDownloader().pauseById(id, queryAll)
}
//取消暂停下载任务
const resumeById = id => {
  getDownloader().resumeById(id, queryAll)
}

//通过id删除下载任务
const deleteById = item => {
  // v2 引擎会先 cancel 再删，不需要前端先暂停；第三参是回调，不再是文件名
  getDownloader().deleteById(item.id, true, queryAll)
}

// ------------------------------------------------------------ 批量操作
const closeActions = () => {
  showActionPopover.value = false
}

const handlePauseAll = () => {
  closeActions()
  pauseAll(queryAll)
}

const handleResumeAll = () => {
  closeActions()
  resumeAll(queryAll)
}

const handleClearCompleted = () => {
  closeActions()
  wil_modal.value.showModal({
    title: t('modal.warmTip'),
    content: t('toolbox.clearCompletedConfirm'),
    confirmColor: '#ff6701',
    confirm: () => clearCompleted(true, queryAll),
  })
}

const handleDeleteAll = () => {
  closeActions()
  wil_modal.value.showModal({
    title: t('modal.warmTip'),
    content: t('toolbox.deleteAllConfirm'),
    confirmColor: '#ff6701',
    confirm: () => deleteAll(true, queryAll),
  })
}

//查询所有下载任务
const queryAll = () => {
  initDownloader(() => {
    getDownloader().queryAll(res => {
      // v2 的 data 已经是数组
      taskList.value = Array.isArray(res && res.data) ? res.data : []
      refreshLists()
      startListener()
    })
  })
}

onUnload(() => {
  if (isListener && DownloaderManager) {
    DownloaderManager.stopListener()
  }
  isListener = false
})

queryAll()
</script>

<style lang="scss" scoped>
.navbar-more {
  font-size: 44rpx;
  color: var(--app-icon-strong);
}

.download-actions {
  padding: 12rpx 0;
  background: var(--app-bg-secondary);
}

.download {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--app-bg);
  color: var(--app-text-primary);
  .download-container {
    flex: 1;
    overflow: auto;
    .download-title {
      padding: 0 24rpx;
      font-size: 30rpx;
      font-weight: bold;
    }
    .completed-title {
      padding: 0 24rpx;
      font-size: 30rpx;
      font-weight: bold;
    }
  }
}
</style>
