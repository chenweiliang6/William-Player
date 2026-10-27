<template>
  <div class="catelog-mulu">
    <div class="catelog-mulu-title" @click="back">
      <img src="@/static/rect-leftblack.png" />
      <span>{{ pageTitle }}</span>
    </div>
    <div class="catelog-mulu-container">
      <div class="catelog-mulu-item" v-for="item in listData" :key="item.name" @click="event => clickItem(event, item)">
        <div class="item-top">
          <img :src="catalogType === 'tv' ? xspBlack : dyBlack" />
          <span>{{ catalogTypeLabel }}</span>
        </div>
        <div class="item-bottom">
          <img :src="mapping[item.type]" />
          <div class="item-bottom-right">
            <div class="right-name">{{ item.name }}</div>
            <div class="right-path">{{ item.path }}</div>
          </div>
        </div>
      </div>
      <div class="catelog-mulu-add catelog-mulu-item" @click="toSelectSource">
        <div class="catelog-mulu-add__icon">
          <nut-icon name="uploader" custom-color="#94939a"></nut-icon>
        </div>
      </div>
    </div>

    <nut-dialog v-model:visible="showDialog" @closed="closedDialog">
      <template #header>
        <div class="header-left" @click="back">
          <span>{{ dialogTitle }}</span>
        </div>
        <div class="header-right" @click="cancel">
          <img src="@/static/close-black.png" />
        </div>
      </template>
      <template #default>
        <div class="dialog-content">
          <div class="dialog-content-left">
            <div class="source-list-item" v-for="item in sourceList" :key="item.type">
              <template v-if="item.list.length && item.type !== 'Emby'">
                <div class="source-list-item__title">{{ getSourceTypeLabel(item.type) }}</div>
                <div class="source-list-item__list">
                  <div
                    :class="['list-item', item.list.length == 1 ? 'list-one' : '', vitem.name === selectMedia.name ? 'list-active' : '']"
                    v-for="vitem in item.list"
                    :key="vitem.name"
                    @click="handleSelect(item, vitem)"
                  >
                    <div class="list-item-img">
                      <img :src="item.img" />
                    </div>
                    <div class="list-item-name">{{ vitem.name }}</div>
                  </div>
                </div>
              </template>
            </div>
          </div>
          <div class="dialog-content-right">
            <div class="right-title" @click="toBack" v-if="path || folderFileIdArr.length">
              <nut-icon name="rect-left" custom-color="#000"></nut-icon>
              <span>{{ t('common.back') }}</span>
            </div>
            <wil-list
              :requestFn="getFileList"
              :request-params="requestParams"
              ref="wil_list"
              :refresherEnabled="false"
              idKey="name"
              :pageSize="20"
              :scroll-with-animation="true"
              :showScrollBar="false"
              :responseAdapter="responseAdapter"
              @currentData="handleData"
              :key="key"
            >
              <template #default="item">
                <div class="mulu-item" @click="clickCell(item)">
                  <div class="mulu-item-left">
                    <div class="mulu-item-left__icon">
                      <img :src="selectName == item.name ? checkActive : checkIcon" @click.stop="chooseName(item)" v-if="item.type == '1'" />
                      <img :src="setImg(item)" />
                    </div>
                    <div class="mulu-item-left__name">{{ item.name }}</div>
                  </div>
                  <div class="mulu-item-right" @click.stop="muluDown(item)">
                    <img src="@/static/arrow-black.png" />
                  </div>
                </div>
              </template>
            </wil-list>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="footer-button">
          <nut-button type="default" @click="cancel">{{ t('common.cancel') }}</nut-button>
          <nut-button type="info" @click="confirmDialog">{{ t('common.confirm') }}</nut-button>
        </div>
      </template>
    </nut-dialog>
    <Popover v-model:visible="showPopover" :options="popoverOptions" :position="position"></Popover>
  </div>
</template>

<script setup>
import { computed, onBeforeMount, ref, toRef } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import xspBlack from '@/static/xsp-black.png'
import dyBlack from '@/static/dy-black.png'
import webdavFileIcon from '@/static/webdav-fileIcon.png'
import Popover from '@/pages/mobile/media/components/popover.vue'
import wilList from '@/components/mobile/wil-list/index.vue'
import tongbuIcon from '@/static/tongbu-icon.png'
import editIcon from '@/static/edit_icon.png'
import checkIcon from '@/static/check.png'
import checkActive from '@/static/check-active.png'
import deleteIcon from '@/static/delete-icon.png'
import { useRoute, useRouter } from 'vue-router'
import { useSelectFolder } from '@/hooks/useSelectFolder.js'
import { loginUser, get189Folder, getQuarkFolder, getWebDAVUrl, get189DownloadUrl, getQuarkVideoUrl } from '@/utils/common.js'
import { useI18n } from 'vue-i18n'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const selectType = ref({})
const selectMedia = ref({})
const result = ref({})
const emits = defineEmits(['confirm', 'openSource'])
const getCatalogType = value => {
  if (value === 'tv' || value === '电视剧' || value === t('video.tv')) return 'tv'
  if (value === 'movie' || value === '电影' || value === t('video.movie')) return 'movie'
  return 'tv'
}
const catalogType = computed(() => getCatalogType(route.query.mediaType || route.query.title))
const catalogTypeLabel = computed(() => (catalogType.value === 'tv' ? t('video.tv') : t('video.movie')))
const pageTitle = computed(() => t('source.directorySettingTitle', { title: catalogTypeLabel.value }))
const providerLabelMap = computed(() => ({
  WebDAV: 'WebDAV',
  Emby: 'Emby',
  天翼云盘: t('source.tianyiCloudDriveLabel'),
  夸克网盘: t('source.quarkCloudDriveLabel'),
}))
const getSourceTypeLabel = type => providerLabelMap.value[type] || type

const {
  data,
  key,
  path,
  folderFileId,
  folderFileIdArr,
  muluData,
  removeLastSegment,
  selectName,
  responseAdapter,
  handleData,
  handleSize,
  chooseName,
  toBack,
  getFileList,
  clickCell,
  setImg,
  confirm,
} = useSelectFolder({ selectType: selectType, selectMedia: selectMedia, result: result, title: toRef(() => catalogType.value), emits: emits })

const listData = ref([])
const showBottom = ref(false)
const showModel = ref('source')

const routerParams = ref({})

const showDialog = ref(false)
const dialogTitle = computed(() => t('source.selectDirectory'))
const sourceList = ref([])
const wil_list = ref(null)
const requestParams = ref(null)

const showPopover = ref(false)
const selectItem = ref({})
const position = ref({})
const mapping1 = {
  tv: 'tv',
  movie: 'movie',
  电视剧: 'tv',
  电影: 'movie',
}

const handleSelect = async (item, vitem) => {
  selectType.value = item
  selectMedia.value = vitem
  uni.showLoading({
    title: t('common.loading'),
  })
  requestParams.value = null
  if (item.type == 'WebDAV') {
    await loginUser(vitem)
      .then(res => {
        uni.hideLoading()
        vitem.token = res.data.token
        result.value = {}
        requestParams.value = {}
        // wil_list.value.reload()
      })
      .catch(error => {
        uni.hideLoading()
        uni.showToast({
          title: t('source.pleaseEnableAlist'),
          icon: 'none',
        })
      })
  } else if (item.type == '天翼云盘') {
    await get189Folder({ folderId: '-11' }, { JSESSIONID: vitem.JSESSIONID, COOKIE_LOGIN_USER: vitem.COOKIE_LOGIN_USER })
      .then(res => {
        uni.hideLoading()
        if (res.res_code == 0) {
          result.value = res
          requestParams.value = {}
        } else {
          uni.showToast({
            title: t('source.reloginTianyiCloudDrive'),
            icon: 'none',
          })
        }
      })
      .catch(error => {
        uni.hideLoading()
        uni.showToast({
          title: t('source.reloginTianyiCloudDrive'),
          icon: 'none',
        })
      })
  } else if (item.type == '夸克网盘') {
    await getQuarkFolder({ fid: '0' }, vitem)
      .then(res => {
        uni.hideLoading()
        if (res.status == 200) {
          result.value = res
          requestParams.value = {}
        } else {
          uni.showToast({
            title: t('source.reloginQuarkCloudDrive'),
            icon: 'none',
          })
        }
      })
      .catch(error => {
        uni.hideLoading()
        uni.showToast({
          title: t('source.reloginQuarkCloudDrive'),
          icon: 'none',
        })
      })
  }
}

// const handleEdit = () => {}

const handleDelete = () => {
  listData.value = listData.value.filter(item => item.name != selectItem.value.name || item.path != selectItem.value.path)
  muluData.value[catalogType.value] = listData.value
  uni.setStorageSync('muluData', muluData.value)
}

const confirmDialog = () => {
  confirm()
  listData.value = muluData.value[catalogType.value]
  showDialog.value = false
}

const popoverOptions = computed(() => [
  { icon: deleteIcon, label: t('common.delete'), color: '#FE4344', func: handleDelete },
])

const mapping = {
  'WebDAV': webdavFileIcon,
  '天翼云盘':
    'https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/8c/87/69/8c8769f2-6bfa-19b2-53a4-9e10a555deb3/AppIcon-0-0-1x_U007emarketing-0-7-0-0-sRGB-85-220.png/350x350.png',
  '夸克网盘':
    'https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/60/6f/e5/606fe5ab-3bfb-c5e4-5bed-08c9b2b5188f/AppIcon-0-0-1x_U007emarketing-0-7-0-0-85-220.png/350x350.png?',
}

const cancel = () => {
  showDialog.value = false
}

const clickItem = (event, item) => {
  selectItem.value = item
  showPopover.value = true
  position.value.clientX = event.clientX || event.touches[0].clientX
  position.value.clientY = event.clientY || event.touches[0].clientY
}

const toSelectSource = () => {
  showDialog.value = true
  showBottom.value = true
}
const back = () => {
  router.go(-1)
}

// const confirm = (data) => {
//     showBottom.value = false
//     showModel.value = 'source'
//     muluData.value = data
//     listData.value = muluData.value[catalogType.value]
// }

onBeforeMount(() => {
  muluData.value = uni.getStorageSync('muluData') || {}
  if (!muluData.value.tv) muluData.value.tv = []
  if (!muluData.value.movie) muluData.value.movie = []
  listData.value = muluData.value[catalogType.value]
})

const judgeShow = () => {
  sourceList.value = uni.getStorageSync('sourceList')
  // show.value = !sourceList.value.every((item) => {
  //     return !item.list.length;
  // });
}
judgeShow()
</script>

<style lang="scss" scoped>
page {
  width: 100%;
  height: 100%;
}

.catelog-mulu {
  display: flex;
  flex-direction: column;
  padding: 24rpx;
  width: 100%;
  height: 100%;
  overflow: hidden;

  .catelog-mulu-title {
    display: flex;
    align-items: center;
    cursor: pointer;
    padding: 24rpx;

    img {
      width: 40rpx;
      height: 40rpx;
    }

    span {
      margin-left: 12rpx;
      font-weight: bold;
    }
  }

  .catelog-mulu-container {
    padding: 24rpx;
    width: 100%;
    height: 100%;
    overflow: hidden;
    display: grid;
    align-content: flex-start;
    /* 关键：auto-fill自动填充，minmax确保每列最小宽度为固定值 */
    grid-template-columns: repeat(auto-fill, 400rpx);
    /* 设置间距：上下10px，左右15px */
    gap: 24rpx 24rpx;

    .catelog-mulu-item {
      flex: 0 0 400rpx;
      overflow: hidden;
      background: #f9f8ff;
      border-radius: 16rpx;
      height: 278rpx;
      display: flex;
      flex-direction: column;
      // margin-top: 24rpx;
      // margin-left: 24rpx;
      cursor: pointer;

      .item-top {
        display: flex;
        align-items: center;
        justify-content: center;
        flex: 0 0 150rpx;
        background: #eae9f0;
        border-radius: 16rpx 16rpx 0 0;

        img {
          width: 70rpx;
          height: 70rpx;
        }

        span {
          font-size: 40rpx;
          font-weight: bold;
          padding-left: 20rpx;
        }
      }

      .item-bottom {
        display: flex;
        align-items: center;
        flex: 1;
        padding-left: 24rpx;
        padding-right: 12rpx;
        overflow: hidden;

        img {
          flex: 0 0 70rpx;
          width: 70rpx;
          height: 70rpx;
          border-radius: 16rpx;
        }

        .item-bottom-right {
          flex: 1;
          margin-left: 24rpx;
          overflow: hidden;

          .right-name {
            font-size: 28rpx;
            display: -webkit-box;
            -webkit-line-clamp: 1;
            -webkit-box-orient: vertical;
            overflow: hidden;
            text-overflow: ellipsis;
            width: 100%;
            word-break: break-all;
          }

          .right-path {
            font-size: 24rpx;
            margin-top: 8rpx;
            display: -webkit-box;
            -webkit-line-clamp: 1;
            -webkit-box-orient: vertical;
            overflow: hidden;
            text-overflow: ellipsis;
            width: 100%;
            word-break: break-all;
          }
        }
      }

      &:first-child {
        margin-top: 0;
      }

      &:nth-child(2) {
        margin-top: 0;
      }

      &:nth-child(2n + 1) {
        margin-left: 0;
      }
    }

    .catelog-mulu-add {
      align-items: center;
      justify-content: center;

      &:active {
        background: #ebe9f0;
      }

      .catelog-mulu-add__icon {
        border-radius: 50%;
        background: #dedde4;
        width: 70rpx;
        height: 70rpx;
        display: flex;
        align-items: center;
        justify-content: center;
      }
    }
  }

  :deep(.nut-overlay) {
    z-index: 98 !important;
  }

  :deep(.nut-popup) {
    overflow: hidden;
    z-index: 99 !important;

    .nut-dialog {
      width: 1600rpx;
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

          .dialog-content-left {
            flex: 0 0 600rpx;
            overflow: auto;
            padding: 0 24rpx;
            border-right: 2rpx solid #e9e9e9;

            .source-list-item {
              padding-bottom: 16rpx;

              .source-list-item__title {
                font-size: 28rpx;
                color: #6d6d6d;
                padding: 16rpx 0;
                text-align: left;
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

                    img {
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

                  .list-item-name {
                    color: #ff6701;
                  }
                }
              }
            }
          }

          .dialog-content-right {
            flex: 1;
            padding: 0 24rpx;

            .right-title {
              width: 100%;
              display: flex;
              align-items: center;
              justify-content: flex-start;
              cursor: pointer;

              span {
                font-size: 30rpx;
                color: #000;
              }
            }

            .mulu-item {
              display: flex;
              align-items: center;
              justify-content: space-between;
              width: 100%;
              cursor: pointer;
              padding: 16rpx 24rpx;
              border-radius: 16rpx;

              &:hover {
                background: rgb(241, 241, 241);
              }

              .mulu-item-left {
                display: flex;
                align-items: center;

                .mulu-item-left__icon {
                  display: flex;
                  align-items: center;

                  img:first-child {
                    width: 50rpx;
                    height: 50rpx;
                    display: block;
                  }

                  img:last-child {
                    width: 75rpx;
                    height: 75rpx;
                    display: block;
                    margin-left: 20rpx;
                  }
                }

                .mulu-item-left__name {
                  font-size: 30rpx;
                  color: #000;
                  margin-left: 20rpx;
                }
              }

              .mulu-item-right {
                img {
                  width: 40rpx;
                  height: 40rpx;
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
}
</style>
