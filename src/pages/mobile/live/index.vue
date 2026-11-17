<template>
  <div :class="['live', themeClass]">
    <nut-cell-group>
      <nut-swipe v-for="(item, index) in liveList" :key="item.name" :disabled="item.isDefault || item.name === '默认直播源'">
        <nut-cell :title="getLiveName(item)" is-link @click="toLiveList(item)"></nut-cell>
        <template #right>
          <nut-button style="height: 100%" type="danger" shape="square" @click="deleteLive(index)">{{ t('common.delete') }}</nut-button>
        </template>
      </nut-swipe>
    </nut-cell-group>
    <wil-modal ref="wil_modal">
      <wil-form v-model="state.formData" :options="options" ref="base_form"></wil-form>
    </wil-modal>
    <div class="live-add" @click="openForm">
      <wil-icon name="jia" />
    </div>
    <share-dialog v-model:visible="showShareModal" :shareUrl="shareUrl"></share-dialog>
  </div>
</template>

<script setup>
import { computed, onBeforeMount, ref, reactive } from 'vue'
import wilForm from '@/components/mobile/wil-form/index.vue'
import wilModal from '@/components/mobile/wil-modal/index.vue'
import wilIcon from '@/components/common/wil-icon/index.vue'
import shareDialog from '../video/components/index-component/share-dialog.vue'
import { parseM3UToArray, groupByGroupTitle } from '@/utils/tools.js'
import { getCutContent } from '@/utils/common'
import { onShow } from '@dcloudio/uni-app'
import { useThemeClass } from '@/hooks/useThemeClass'
import { useThemeTabbar } from '@/hooks/useThemeTabbar'
import { useThemeNavbar } from '@/hooks/useThemeNavbar'
import { useI18nNavbar } from '@/hooks/useI18nNavbar'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const themeClass = useThemeClass()
useThemeNavbar()
useI18nNavbar('navbar.live')
useThemeTabbar()
const liveList = ref([])
const wil_modal = ref(null)
const base_form = ref(null)
const showShareModal = ref(false)
const shareUrl = ref('')

const state = reactive({
  formData: {},
})

let subPlayerNvue = null

//m3u校验
const validatorUrl = val => {
  if (!val) {
    return false
  } else {
    const reg = /^https?:\/\/([\w-]+\.)+[\w-]+(\/[\w-./?%&=]*)?$/i
    if (!reg.test(val)) {
      return false
    } else {
      return true
    }
  }
}

const options = computed(() => [
  {
    label: t('live.liveSourceName'),
    prop: 'name',
    type: 'input',
    required: false,
    formItemProps: { placeholder: t('common.input'), type: 'text' },
    rule: [{ required: true, message: t('live.pleaseInputLiveSourceName') }],
  },
  {
    label: t('live.liveSourceAddress'),
    prop: 'url',
    type: 'input',
    formItemProps: { placeholder: t('common.input'), type: 'text' },
    rule: [{ validator: validatorUrl, message: t('live.pleaseInputValidLiveSourceAddress') }],
  },
])

//获取iptv
const getIptv = url => {
  return new Promise((resolve, reject) => {
    uni.request({
      url: url,
      method: 'GET',
      success: res => {
        resolve(parseM3UToArray(res.data))
      },
      fail: error => {
        reject(error)
      },
    })
  })
}

const getLiveName = item => {
  return item.isDefault || item.name === '默认直播源' ? t('live.defaultLiveSource') : item.name
}

const openForm = () => {
  wil_modal.value.showModal({
    title: t('common.add'),
    confirmColor: '#ff6701',
    confirm: async () => {
      if (!state.formData.name || !state.formData.url) {
        uni.showToast({
          title: t('live.pleaseInputCompleteLiveSource'),
          icon: 'none',
        })
        return
      }
      if (liveList.value.some(v => getLiveName(v) == state.formData.name)) {
        uni.showToast({
          title: t('live.duplicateLiveSourceName'),
          icon: 'none',
        })
        return
      }
      if (liveList.value.some(v => v.url == state.formData.url)) {
        uni.showToast({
          title: t('live.duplicateLiveSourceUrl'),
          icon: 'none',
        })
        return
      }
      let res = await getIptv(state.formData.url)
      if (!res[0].groupTitle) {
        uni.showToast({
          title: t('live.checkFileFormat'),
          icon: 'error',
        })
      } else {
        liveList.value.push(state.formData)
        uni.setStorageSync('liveList', liveList.value)
      }
      state.formData = {}
    },
    cancel: () => {
      state.formData = {}
    },
  })
}

const deleteLive = index => {
  liveList.value.splice(index, 1)
  uni.setStorageSync('liveList', liveList.value)
}

const toLiveList = item => {
  uni.navigateTo({
    url: '/pages/mobile/live/list?name=' + encodeURIComponent(item.name),
  })
}

//显示原生的视频播放器窗体
const showNvuePlayer = () => {
  subPlayerNvue.show('auto', 200, function () {
    uni.$emit('updatePlayerNvue', {
      pipStatus: false,
      noSetHistory: 0,
    })
  })
}

onBeforeMount(() => {
  liveList.value = uni.getStorageSync('liveList')
  if (!liveList.value) {
    liveList.value = [
      {
        name: 'defaultLiveSource',
        isDefault: true,
        url: 'https://storage.7x24cc.com/storage-server/presigned/ss1/a6-online-fileupload/newMediaImage/1674C67_427A_iptv_20250411082147720newMediaImage.m3u',
      },
    ]
    uni.setStorageSync('liveList', liveList.value)
  }
  // subPlayerNvue = uni.getSubNVueById('live_video')
  // showNvuePlayer()
})

onShow(async () => {
  let shareUrl1 = await getCutContent()
  if (shareUrl1) {
    shareUrl.value = shareUrl1
    showShareModal.value = true
  }
})
</script>

<style lang="scss" scoped>
page {
  width: 100%;
  height: 100%;
}

.live {
  width: 100%;
  height: 100%;
  background: var(--app-bg-secondary);
  box-sizing: border-box;
  border-top: 2rpx solid var(--app-bg-secondary);

  ::v-deep .nut-cell-group {
    .nut-cell-group__wrap {
      background-color: transparent;
      box-shadow: none;

      .nut-swipe {
        .nut-swipe__content {
          .nut-cell {
            margin: 0;
            background-color: var(--app-bg-card);
            box-shadow: none;
            border-radius: 0;

            .nut-cell__title {
              color: var(--app-text-primary);
            }

            .nut-icon {
              color: var(--app-icon);
            }

            &::after {
              border-bottom: 2rpx solid var(--app-border);
            }
          }
        }
      }
    }
  }

  ::v-deep .nut-transition {
    .wil-modal {
      .wil-modal-top {
        padding-bottom: 0;

        .base-form {
          .base-form-content {
            .nut-form {
              .nut-cell-group {
                .nut-cell-group__wrap {
                  .nut-form-item {
                    .nut-form-item__label {
                      min-width: 170rpx;
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

  .live-add {
    width: 120rpx;
    height: 120rpx;
    background: #ff6701;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    position: fixed;
    bottom: 180rpx;
    right: 24rpx;
    box-shadow: 0 8rpx 12rpx #5b73a01a;

    .iconfont {
      font-size: 50rpx;
      color: #ffffff;
    }
  }
}
</style>
