<template>
  <div class="rl">
    <div class="rl-title" @click="back">
      <wil-icon name="arrow-left-copy" custom-color="#000000" class="rl-back" />
      <span>{{ t('navbar.resourceLibrary') }}</span>
      <span class="rl-add" @click.stop="toAddSource">
        <wil-icon name="jia" custom-color="#000015" />
        <span>{{ t('resourceLibrary.addSource') }}</span>
      </span>
    </div>

    <div class="rl-body">
      <!-- 按源类型分组 -->
      <template v-if="groups.length">
        <div class="rl-group" v-for="group in groups" :key="group.type">
          <div class="rl-group__title">{{ group.label }}</div>
          <div class="rl-group__list">
            <div class="rl-card rl-card--source" v-for="vitem in group.list" :key="vitem.name" @click="openManage(group.type, vitem)">
              <div class="rl-card__icon">
                <image v-if="getSourceIcon(group.type).kind === 'image'" class="rl-icon-img" :src="getSourceIcon(group.type).value" />
                <wil-icon v-else :name="getSourceIcon(group.type).value" custom-color="#666" />
              </div>
              <span class="rl-card__name">{{ vitem.name }}</span>
              <wil-icon name="gengduo" class="rl-card__more" @click.stop="openSourceList" />
            </div>
          </div>
        </div>
      </template>
      <div v-else class="rl-empty">{{ t('resourceLibrary.emptyTip') }}</div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import wilIcon from '@/components/common/wil-icon/index.vue'
import { getSourceIcon } from '@/utils/sources/sourceIcon'

const { t } = useI18n()
const router = useRouter()

const SOURCE_LABEL = {
  WebDAV: 'WebDAV',
  Emby: 'Emby',
  天翼云盘: t('source.tianyiCloudDriveLabel'),
  夸克网盘: t('source.quarkCloudDriveLabel'),
  联通云盘: t('source.unicomCloudDriveLabel'),
  移动云盘: t('source.cloud139Label'),
}

const sourceList = ref(uni.getStorageSync('sourceList') || [])

// 只保留有账号的分组
const groups = computed(() =>
  (sourceList.value || [])
    .filter(item => item.list?.length)
    .map(item => ({ type: item.type, label: SOURCE_LABEL[item.type] || item.type, list: item.list }))
)

/** 点源卡片：进入该源的「管理已导入 / 导入新资源」页，只显示该源条目 */
const openManage = (type, vitem) => {
  router.push({ path: '/catelog-mulu', query: { type, name: vitem.name || '' } })
}

/** 「...」进文件源管理（编辑/删除/新增） */
const openSourceList = () => {
  router.push({ path: '/sourceList' })
}

const toAddSource = () => {
  router.push({ path: '/sourceList' })
}

const back = () => {
  router.go(-1)
}
</script>

<style lang="scss" scoped>
.rl {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #fff;
  color: #090909;
}

.rl-title {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px 20px;
  font-size: 16px;
  font-weight: bold;
  border-bottom: 1px solid #eee;
  cursor: pointer;

  .rl-back {
    font-size: 20px;
  }

  .rl-add {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 13px;
    font-weight: normal;
    color: #ff6701;
  }
}

.rl-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
  box-sizing: border-box;
}

.rl-card {
  display: flex;
  align-items: center;
  gap: 12px;
  background: #f6f7f8;
  border-radius: 10px;
  padding: 14px 18px;
  margin-bottom: 12px;
  cursor: pointer;

  &:hover {
    background: #eef0f2;
  }

  &__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    font-size: 22px;
    color: #666;
  }

  .rl-icon-img {
    width: 22px;
    height: 22px;
    border-radius: 50%;
  }

  &__name {
    flex: 1;
    font-size: 14px;
  }

  &__arrow {
    font-size: 14px;
    color: #bbb;
  }

  &__more {
    font-size: 20px;
    color: #999;
  }
}

.rl-group {
  margin-top: 8px;

  &__title {
    font-size: 12px;
    color: #999;
    padding: 8px 4px;
  }

  &__list {
    display: flex;
    flex-direction: column;
  }
}

.rl-empty {
  padding: 60px 0;
  text-align: center;
  color: #999;
  font-size: 13px;
}
</style>
