<template>
  <div class="source-list">
    <wil-title :title="t('navbar.resourceLibrary')">
      <template #right>
        <img src="@/static/jia-black.png" @click="openDialog" />
      </template>
    </wil-title>
    <div class="source-list-container" v-if="show">
      <div class="source-list-item" v-for="item in sourceList" :key="item.type">
        <template v-if="item.list.length && (route.query.isEmby === '1' ? item.type === 'Emby' : item.type !== 'Emby')">
          <div class="source-list-item__title">{{ getSourceTypeLabel(item.type) }}</div>
          <div class="source-list-item__list">
            <div
              :class="['list-item', item.list.length == 1 ? 'list-one' : '', vitem.active ? 'list-active' : '']"
              v-for="vitem in item.list"
              :key="vitem.name"
              @click="handleSelect(item, vitem)"
            >
              <div class="list-item-img">
                <image :src="item.img"></image>
              </div>
              <div class="list-item-name" :class="[vitem.active ? 'list-item-activeName' : '']">{{ vitem.name }}</div>
              <div class="list-item-button">
                <wil-tooltip :content="t('common.modify')" placement="top" trigger="hover">
                  <img src="@/static/bianji-black.png" @click.stop="editSource(item, vitem)" />
                </wil-tooltip>
                <wil-tooltip :content="t('source.setTvDirectory')" placement="top" trigger="hover" v-if="route.query.isEmby !== '1'">
                  <img src="@/static/xsp-black.png" @click.stop="setTvMulu(item, vitem)" />
                </wil-tooltip>
                <wil-tooltip :content="t('source.setMovieDirectory')" placement="top" trigger="hover" v-if="route.query.isEmby !== '1'">
                  <img src="@/static/dy-black.png" @click.stop="setMovieMulu(item, vitem)" />
                </wil-tooltip>
                <wil-tooltip :content="t('common.delete')" placement="top" trigger="hover">
                  <img src="@/static/delete-icon.png" @click.stop="deleteSource(item, vitem)" />
                </wil-tooltip>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>
    <div class="source-list-empty" v-else>
      <img src="@/static/no-data.png" class="source-list-empty__img" />
      <span class="source-list-empty__tip">{{ t('source.resourceTipAfterAdd') }}</span>
      <nut-button custom-color="#090909" @click="openDialog">
        <template #icon>
          <nut-icon name="uploader" custom-color="#fff" size="12"></nut-icon>
        </template>
        <span>{{ t('video.addNewResource') }}</span>
      </nut-button>
    </div>
    <nut-dialog v-model:visible="showDialog" @closed="closedDialog">
      <template #header>
        <div class="header-left" @click="back">
          <img src="@/static/rect-leftblack.png" v-if="showType !== 'fileSource' && dialogMode !== 'edit'" />
          <span>{{ dialogTitle }}</span>
        </div>
        <div class="header-right" @click="cancel">
          <img src="@/static/close-black.png" />
        </div>
      </template>
      <template #default>
        <div class="dialog-content">
          <transition :name="transitionName">
            <file-source v-if="showType === 'fileSource'" @click-item="changeFileSource" :isEmby="route.query.isEmby === '1'"></file-source>
            <wil-form :options="state.options" v-model="state.formData" v-else ref="wil_form"></wil-form>
          </transition>
        </div>
      </template>
      <template #footer>
        <div class="footer-button">
          <nut-button type="default" @click="cancel">{{ t('common.cancel') }}</nut-button>
          <nut-button type="info" @click="confirm">{{ t('common.confirm') }}</nut-button>
        </div>
      </template>
    </nut-dialog>
    <wil-modal ref="wil_modal"></wil-modal>
  </div>
</template>

<script setup>
import { computed, nextTick, reactive, ref } from 'vue'
import wilForm from '@/components/mobile/wil-form/index.vue'
import wilTooltip from '@/components/electron/wil-tooltip/index.vue'
import wilModal from '@/components/mobile/wil-modal/index.vue'
import fileSource from './components/file-source.vue'
import { validateWebdav, validateEmby } from '@/utils/validate'
import { useRoute, useRouter } from 'vue-router'
import { toParse, toStringfy } from '@/pages/mobile/mine/common'
import { loginUser, get189Folder, getQuarkFolder, get189User, getQuarkUser } from '@/utils/common'
import * as CONFIG from '@/utils/config'
import wilTitle from '@/components/electron/wil-title/index.vue'
import { useI18n } from 'vue-i18n'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()

const sourceList = ref([])
const show = ref(false)
const wil_modal = ref(null)

const showDialog = ref(false)
const dialogMode = ref('add')
const showType = ref('fileSource')
const transitionName = ref('slide-left')
const wil_form = ref(null)
const routerParams = ref({})
const state = reactive({
  formData: {
    protocol: 'http',
  },
  oldData: {},
  history: ['fileSource'],
  options: [],
  editObj: {},
})
const providerLabelMap = computed(() => ({
  WebDAV: 'WebDAV',
  Emby: 'Emby',
  天翼云盘: t('source.tianyiCloudDriveLabel'),
  夸克网盘: t('source.quarkCloudDriveLabel'),
}))
const getSourceTypeLabel = type => providerLabelMap.value[type] || type
const dialogTitle = computed(() => {
  if (showType.value === 'fileSource') return t('navbar.addFileSource')
  return dialogMode.value === 'edit'
    ? t('source.modifyProviderTitle', { provider: providerLabelMap.value[showType.value] || showType.value })
    : t('source.addProviderTitle', { provider: providerLabelMap.value[showType.value] || showType.value })
})
const isAddMode = computed(() => dialogMode.value === 'add')
const protocolColumns = [
  { label: 'HTTP', value: 'http' },
  { label: 'HTTPS', value: 'https' },
]
const createWebdavOptions = () => [
  { label: t('source.name'), prop: 'name', type: 'input', formItemProps: { placeholder: t('common.input'), type: 'text' }, rule: [{ required: true, message: t('source.pleaseInputName') }] },
  {
    label: t('source.protocol'),
    prop: 'protocol',
    type: 'radio',
    formItemProps: { placeholder: t('common.input'), type: 'text' },
    rule: [{ required: true, message: t('source.pleaseSelectProtocol') }],
    columns: protocolColumns,
  },

  { label: t('source.address'), prop: 'address', type: 'input', formItemProps: { placeholder: t('source.exampleLocalhost'), type: 'text' }, rule: [{ required: true, message: t('source.pleaseInputAddress') }] },
  { label: t('source.port'), prop: 'port', type: 'input', formItemProps: { placeholder: t('source.examplePort5244'), type: 'number' }, rule: [{ required: true, message: t('source.pleaseInputPort') }] },
  {
    label: t('source.username'),
    prop: 'username',
    type: 'input',
    formItemProps: { placeholder: t('source.alistUsernamePlaceholder'), type: 'text' },
    rule: [{ required: true, message: t('source.pleaseInputUsername') }],
  },
  { label: t('source.password'), prop: 'password', type: 'input', formItemProps: { placeholder: t('source.alistPasswordPlaceholder'), type: 'password' }, rule: [{ required: true, message: t('source.pleaseInputPassword') }] },
]

const createEmbyOptions = () => [
  { label: t('source.name'), prop: 'name', type: 'input', formItemProps: { placeholder: t('source.optionalAutoFetch'), type: 'text' } },
  {
    label: t('source.protocol'),
    prop: 'protocol',
    type: 'radio',
    formItemProps: { placeholder: t('common.input'), type: 'text' },
    rule: [{ required: true, message: t('source.pleaseSelectProtocol') }],
    columns: protocolColumns,
  },

  { label: t('source.address'), prop: 'address', type: 'input', formItemProps: { placeholder: t('source.exampleLocalhost'), type: 'text' }, rule: [{ required: true, message: t('source.pleaseInputAddress') }] },
  { label: t('source.port'), prop: 'port', type: 'input', formItemProps: { placeholder: t('source.examplePort443'), type: 'number' }, rule: [{ required: true, message: t('source.pleaseInputPort') }] },
  {
    label: t('source.username'),
    prop: 'Username',
    type: 'input',
    formItemProps: { placeholder: t('source.required'), type: 'text' },
    rule: [{ required: true, message: t('source.pleaseInputUsername') }],
  },
  { label: t('source.password'), prop: 'Pw', type: 'input', formItemProps: { placeholder: t('source.optional'), type: 'password' } },
]

const createTianyiOptions = () => [
  {
    label: 'Cookie',
    prop: 'cookie',
    type: 'textarea',
    formItemProps: { placeholder: t('source.tianyiCookiePlaceholder'), type: 'text' },
    rule: [{ required: true, message: t('source.pleaseInputCookie') }],
  },
]

const createQuarkOptions = () => [
  {
    label: 'Cookie',
    prop: 'cookie',
    type: 'textarea',
    formItemProps: { placeholder: t('source.quarkCookiePlaceholder'), type: 'text' },
    rule: [{ required: true, message: t('source.pleaseInputCookie') }],
  },
]

const getProviderOptions = provider => {
  if (provider === 'WebDAV') return createWebdavOptions()
  if (provider === 'Emby') return createEmbyOptions()
  if (provider === '天翼云盘') return createTianyiOptions()
  if (provider === '夸克网盘') return createQuarkOptions()
  return []
}

const backRouter = () => {
  router.go(-1)
}

const openDialog = () => {
  showDialog.value = true
  dialogMode.value = 'add'
  showType.value = 'fileSource'
  transitionName.value = 'slide-left'
  state.formData = { protocol: 'http' }
}

const changeFileSource = item => {
  transitionName.value = 'slide-left'
  dialogMode.value = 'add'
  showType.value = item.name
  state.history.push(item.name)
  state.options = getProviderOptions(item.name)
}

const back = () => {
  transitionName.value = 'slide-right'
  if (showType.value !== 'fileSource') {
    state.history.pop()
  }
  console.log(state.history, 'state.histoy')

  setTimeout(() => {
    showType.value = state.history[state.history.length - 1]
  }, 0)
}

const cancel = () => {
  transitionName.value = ''
  showDialog.value = false
  closedDialog()
}

const closedDialog = () => {
  showType.value = 'fileSource'
  dialogMode.value = 'add'
  transitionName.value = 'slide-left'
  state.history = ['fileSource']
}

const confirm = () => {
  const currentDialogMode = dialogMode.value
  const currentValidateActionTitle = isAddMode.value
  if (showType.value === 'WebDAV') {
    wil_form.value.confirmCommit().then(async valid => {
      if (valid) {
        validateWebdav(currentValidateActionTitle, state.formData, state.oldData, { address: state.formData.address, isActive: state.editObj.active ? '1' : '0' }, false).then(
          () => {
            judgeShow()
          }
        ) //校验，抽成一个方法了
        showDialog.value = false
        cancel()
        sourceList.value = uni.getStorageSync('sourceList')
      }
    })
  } else if (showType.value === 'Emby') {
    wil_form.value.confirmCommit().then(async valid => {
      if (valid) {
        validateEmby(isAddMode.value, state.formData, state.oldData, { address: state.formData.address, isActive: state.editObj.active ? '1' : '0' }, false).then(
          () => {
            judgeShow()
          }
        ) //校验，抽成一个方法了
        showDialog.value = false
        cancel()
        sourceList.value = uni.getStorageSync('sourceList')
      }
    })
  } else if (showType.value === '天翼云盘') {
    wil_form.value.confirmCommit().then(async valid => {
      if (valid) {
        let obj = getCookieObject(state.formData.cookie)
        let cloud189 = sourceList.value.find(i => i.type === '天翼云盘')
        try {
          let res = await get189User(obj)
          if (currentDialogMode === 'add') {
            let isHaveData = !sourceList.value.every(item => {
              return !item.list.length
            })
            let tyObj = { name: res.loginName, JSESSIONID: obj.JSESSIONID, COOKIE_LOGIN_USER: obj.COOKIE_LOGIN_USER }
            if (!isHaveData) {
              cloud189.list.push({ ...tyObj, active: true })
              uni.setStorageSync('isreload', true)
            } else {
              cloud189.list.push(tyObj)
            }
          } else if (currentDialogMode === 'edit') {
            let same = cloud189.list.find(i => i.name === state.editObj.name)
            same.name = res.loginName
            same.JSESSIONID = obj.JSESSIONID
            same.COOKIE_LOGIN_USER = obj.COOKIE_LOGIN_USER
            if (state.editObj.active) {
              uni.setStorageSync('isreload', true)
            }
          }
          uni.setStorageSync('sourceList', sourceList.value)
          judgeShow()
        } catch (error) {
          uni.showToast({ title: t('source.invalidCookie'), icon: 'none' })
        }
      }
    })
  } else if (showType.value === '夸克网盘') {
    wil_form.value.confirmCommit().then(async valid => {
      if (valid) {
        let cloudQuark = sourceList.value.find(i => i.type === '夸克网盘')
        try {
          let res = await getQuarkUser({
            Cookie: state.formData.cookie,
          })
          if (currentDialogMode === 'add') {
            let isHaveData = !sourceList.value.every(item => {
              return !item.list.length
            })
            let tyObj = { name: res.data.nickname, Cookie: state.formData.cookie }
            if (!isHaveData) {
              cloudQuark.list.push({ ...tyObj, active: true })
              uni.setStorageSync('isreload', true)
            } else {
              cloudQuark.list.push(tyObj)
            }
          } else if (currentDialogMode === 'edit') {
            let same = cloudQuark.list.find(i => i.name === state.editObj.name)
            same.name = res.data.nickname
            same.Cookie = obj.JSESSIONID
            if (state.editObj.active) {
              uni.setStorageSync('isreload', true)
            }
          }
          uni.setStorageSync('sourceList', sourceList.value)
          judgeShow()
        } catch (error) {
          uni.showToast({ title: t('source.invalidCookie'), icon: 'none' })
        }
      }
    })
  }
  cancel()
}

const getCookieObject = cookie => {
  const cookieString = cookie
  const cookieArray = cookieString.split('; ')
  const cookieObj = {}

  cookieArray.forEach(cookie => {
    // 将每个Cookie分割成名称和值
    const [name, value] = cookie.split('=')
    // 将解码后的值存入对象
    cookieObj[name] = decodeURIComponent(value)
  })

  return cookieObj
}

const clearActive = () => {
  const isEmby = route.query.isEmby === '1'
  sourceList.value
    .filter(item => (isEmby ? item.type === 'Emby' : item.type !== 'Emby'))
    .forEach(item => {
      item.list.forEach(v => {
        v.active = false
      })
    })
}

const resetSelect = vitem => {
  clearActive()
  vitem.active = true
  uni.setStorageSync('isreload', true)
  uni.setStorageSync('sourceList', sourceList.value)
  router.go(-1)
}

const handleSelect = (item, vitem) => {
  wil_modal.value.showModal({
    title: t('modal.warmTip'),
    content: t('source.selectResourceConfirm'),
    confirmColor: '#ff6701',
    confirm: async () => {
      if (item.type == 'WebDAV') {
        await loginUser(vitem)
          .then(res => {
            vitem.token = res.data.token
            resetSelect(vitem)
          })
          .catch(error => {
            uni.showToast({
              title: t('source.pleaseEnableAlist'),
              icon: 'none',
            })
          })
      } else if (item.type == '天翼云盘') {
        await get189Folder({ folderId: '-11' }, { JSESSIONID: vitem.JSESSIONID, COOKIE_LOGIN_USER: vitem.COOKIE_LOGIN_USER })
          .then(res => {
            if (res.res_code == 0) {
              resetSelect(vitem)
            } else {
              uni.showToast({
                title: t('source.reloginTianyiCloudDrive'),
                icon: 'none',
              })
            }
          })
          .catch(error => {
            uni.showToast({
              title: t('source.reloginTianyiCloudDrive'),
              icon: 'none',
            })
          })
      } else if (item.type == '夸克网盘') {
        await getQuarkFolder({ fid: '0' }, vitem)
          .then(res => {
            if (res.status == 200) {
              resetSelect(vitem)
            } else {
              uni.showToast({
                title: t('source.reloginQuarkCloudDrive'),
                icon: 'none',
              })
            }
          })
          .catch(error => {
            uni.showToast({
              title: t('source.reloginQuarkCloudDrive'),
              icon: 'none',
            })
          })
      } else if (item.type == 'Emby') {
        resetSelect(vitem)
      }
    },
  })
}

//修改资源
const editSource = (item, vitem) => {
  state.editObj = vitem
  dialogMode.value = 'edit'
  showType.value = item.type
  state.history = [item.type]
  state.formData = vitem
  if (item.type === 'WebDAV') {
    state.options = createWebdavOptions()
    if (!state.formData.protocol) state.formData.protocol = 'http'
    state.oldData = JSON.parse(JSON.stringify(state.formData))
  } else if (item.type === 'Emby') {
    state.options = createEmbyOptions()
    if (!state.formData.protocol) state.formData.protocol = 'http'
    state.oldData = JSON.parse(JSON.stringify(state.formData))
  } else if (item.type === '天翼云盘') {
    state.options = createTianyiOptions()
    state.formData.cookie = `JSESSIONID=${vitem.JSESSIONID};COOKIE_LOGIN_USER=${vitem.COOKIE_LOGIN_USER}`
  } else if (item.type === '夸克网盘') {
    state.options = createQuarkOptions()
    state.formData.cookie = vitem.Cookie
  }
  showDialog.value = true
}

//设置电视剧目录
const setTvMulu = async (item, vitem) => {
  //后续写完目录设置页面加上路由跳转，跳转到目录设置页面，可以设置所有资源的目录
  router.push({
    path: '/catelog-mulu',
    query: {
      mediaType: 'tv',
    },
  })
}

//设置电影目录
const setMovieMulu = async (item, vitem) => {
  //后续写完目录设置页面加上路由跳转，跳转到目录设置页面，可以设置所有资源的目录
  router.push({
    path: '/catelog-mulu',
    query: {
      mediaType: 'movie',
    },
  })
}

//删除资源
const deleteSource = (item, vitem) => {
  wil_modal.value.showModal({
    title: t('modal.warmTip'),
    content: t('source.deleteSourceConfirm'),
    confirmColor: '#ff6701',
    confirm: async () => {
      item.list = item.list.filter(i => i.name != vitem.name)
      uni.setStorageSync('sourceList', sourceList.value)
      if (vitem.active) {
        uni.removeStorageSync('localMovieTvData')
      }
      let historyPlay = uni.getStorageSync('historyPlay')
      historyPlay = historyPlay.filter(v => v.sourceType != item.type || v.sourceName != vitem.name)
      uni.setStorageSync('historyPlay', historyPlay)
      judgeShow()
    },
  })
}

const judgeShow = () => {
  sourceList.value = uni.getStorageSync('sourceList')
  let embyArr = sourceList.value.filter(i => (route.query.isEmby === '1' ? i.type === 'Emby' : i.type !== 'Emby'))
  show.value = embyArr.some(i => i.list?.length)
}
judgeShow()
</script>

<style lang="scss" scoped>
page {
  width: 100%;
  height: 100%;
}

.source-list {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;

  :deep(.wil-title) {
    .wil-title-right {
      img {
        display: block;
        width: 40rpx;
        height: 40rpx;
      }
    }
  }

  .source-list-container {
    flex: 1;
    overflow: auto;
    padding: 0 24rpx;

    .source-list-item {
      padding-bottom: 16rpx;

      .source-list-item__title {
        font-size: 28rpx;
        color: #6d6d6d;
        padding: 16rpx 0;
      }

      .source-list-item__list {
        background: #fff;
        border-radius: 14rpx;

        .list-item {
          background: #fff;
          padding: 6rpx 24rpx;
          display: flex;
          align-items: center;
          position: relative;
          border: 2prx solid transparent;
          cursor: pointer;

          &::before {
            position: absolute;
            content: '';
            height: 2rpx;
            background: rgb(241, 241, 241);
            width: 100%;
            left: 0;
            top: 0;
          }

          &:hover {
            background: rgb(241, 241, 241);
          }

          &:active {
            background: rgb(223, 223, 223);
          }

          &:first-child {
            border-radius: 14rpx;

            &::before {
              display: none;
            }
          }

          &:last-child {
            border-radius: 14rpx;
          }

          .list-item-img {
            width: 100rpx;
            height: 100rpx;
            background: url('@/static/source-file.png') center no-repeat;
            background-size: 100% 100%;
            // display: flex;
            // align-items: center;
            // justify-content: center;
            position: relative;

            image {
              width: 40rpx;
              height: 40rpx;
              border-radius: 50%;
              position: absolute;
              left: 50%;
              top: 40%;
              transform: translate(-50%, 0);
            }
          }

          .list-item-name {
            padding-left: 10rpx;
            font-size: 32rpx;
            color: #000;
          }

          .list-item-activeName {
            color: #ff6701;
          }

          .list-item-button {
            position: absolute;
            right: 24rpx;
            top: 50%;
            transform: translateY(-50%);
            display: flex;
            align-items: center;
            cursor: auto;

            :deep(.wil-tooltip-container) {
              margin-left: 24rpx;

              &:first-child {
                margin-left: 0;
              }
            }

            img {
              width: 40rpx;
              height: 40rpx;
              display: block;
              // margin-left: 24rpx;
              cursor: pointer;
            }
          }
        }

        .list-one {
          border-radius: 14rpx !important;
          border: 2rpx solid transparent !important;
        }

        .list-active {
          border: 2rpx solid #ff6701 !important;
        }
      }
    }
  }

  .source-list-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;

    .source-list-empty__img {
      width: 400rpx;
      height: 400rpx;
    }

    .source-list-empty__tip {
      text-align: center;
      padding: 0 50rpx;
      padding-bottom: 24rpx;
      color: #000;
    }

    ::v-deep .nut-button {
      border-radius: 12rpx;
    }
  }

  :deep(.nut-popup) {
    overflow: hidden;

    .nut-dialog {
      width: 1000rpx;
      padding: 24rpx 30rpx;

      .nut-dialog__header {
        text-align: left;
        font-weight: bold;
        font-size: 32rpx;
        padding: 16rpx 16rpx 0 16rpx;
        display: flex;
        justify-content: space-between;
        align-items: center;

        .header-left {
          display: flex;
          align-items: center;
          cursor: pointer;

          img {
            width: 40rpx;
            height: 40rpx;
          }

          span {
            padding-left: 10rpx;
          }
        }

        .header-right {
          img {
            cursor: pointer;
            width: 25rpx;
            height: 25rpx;
            display: block;
          }
        }
      }

      .nut-dialog__content {
        max-height: none;
        flex: 0 0 800rpx;

        .dialog-content {
          width: 100%;
          height: 100%;
          display: flex;
          overflow: hidden;

          .base-form {
            .base-form-content {
              .nut-form {
                .nut-cell-group {
                  .nut-cell-group__wrap {
                    .nut-form-item {
                      .nut-form-item__body {
                        .nut-form-item__body__slots {
                          .nut-textarea {
                            .nut-textarea__textarea {
                              height: 700rpx;
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }

        .slide-left-leave-active,
        .slide-left-enter-active {
          transition: all 0.3s;

          &.base-form {
            position: absolute;
          }
        }

        .slide-left-enter-from {
          opacity: 1;
          transform: translateX(100%);
        }

        .slide-left-leave-to {
          opacity: 1;
          transform: translateX(-100%);
        }

        .slide-right-leave-active,
        .slide-right-enter-active {
          transition: all 0.3s;

          &.base-form {
            position: absolute;
          }
        }

        .slide-right-enter-from {
          opacity: 1;
          transform: translateX(-100%);
        }

        .slide-right-leave-to {
          opacity: 1;
          transform: translateX(100%);
        }
      }

      .nut-dialog__footer {
        .footer-button {
          width: 100%;
          display: flex;
          justify-content: flex-end;

          .nut-button--default {
            border: 2rpx solid rgb(204, 204, 204) !important;
          }

          .nut-button--info {
            margin-left: 24rpx;
          }
        }
      }
    }
  }

  :deep(.wil-modal) {
    width: 600rpx;
  }
}
</style>
