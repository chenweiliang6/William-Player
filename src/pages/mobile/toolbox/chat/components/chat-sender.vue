<template>
  <t-chat-sender
    ref="chatSenderRef"
    v-bind="$attrs"
    v-model:value="inputValue"
    class="chat-sender"
    :loading="props.loading"
    :fileList="attachmentsProps.items"
    :attachmentsProps="attachmentsProps"
    @fileChange="onFileChange"
    @send="sendMessage"
    @stop="stopMessage"
  >
    <template #footer-prefix>
      <template v-if="!abilityType">
        <div :class="['deep-think', deepThinkActive ? 'deep-think-active' : '']" @click="deepThinkActive = !deepThinkActive">
          <t-icon name="system-sum" size="32rpx" :color="deepThinkActive ? activeIconColor : iconColor" />
        </div>
        <div :class="['internet-search', netSearchActive ? 'internet-search-active' : '']" @click="netSearchActive = !netSearchActive">
          <t-icon name="internet" size="32rpx" :color="netSearchActive ? activeIconColor : iconColor" />
        </div>
        <t-popover v-model:visible="showMorePopover" placement="top" :theme="popoverTheme" :data-target="popoverTheme">
          <div class="more-button" @click="showMorePopover = true">
            <t-icon name="ai-tool" size="32rpx" :color="iconColor" />
            <span>{{ t('common.more') }}</span>
          </div>
          <template #content>
            <div class="popover-content-list">
              <div class="popover-content-item" v-for="item in moreOptions" :key="item.key" @click="selectMore(item)">
                <wil-icon :name="item.icon" class="popover-content-icon" :custom-color="item.key === 'image' ? '#0052d9' : '#31c27c'" />
                <span>{{ item.name }}</span>
              </div>
            </div>
          </template>
        </t-popover>
      </template>
      <div class="ability-item" v-else @click="closeAbility">
        <wil-icon :name="moreOptions.find(i => i.key === abilityType).icon" class="ability-icon" custom-color="#0052d9" />
        <span>{{ abilityType }}</span>
        <t-icon name="close" size="32rpx" :color="activeIconColor" />
      </div>
    </template>
    <template #suffix>
      <div class="suffix-button">
        <wil-uploader
          ref="wilUploaderRef"
          :source-type="sourceType"
          @start="uploadStart"
          @success="uploadeSuccess"
          style="width: 0; height: 0; opacity: 0; display: none"
        ></wil-uploader>
        <t-popover v-model:visible="showPopover" placement="top" :theme="popoverTheme" :data-target="popoverTheme" v-if="!abilityType">
          <div class="upload-btn-icon" @click="openPopover">
            <t-icon name="attach" size="32rpx" :color="iconColor" />
          </div>
          <template #content>
            <div class="popover-content-list">
              <div class="popover-content-item" v-for="item in popoverOptions" :key="item.key" :source-type="item.sourceType" @click="chooseImage(item)">
                <wil-icon :name="item.icon" class="popover-content-icon" custom-color="var(--app-text-primary)" />
                <span>{{ item.name }}</span>
              </div>
            </div>
          </template>
        </t-popover>
        <div :class="'send-btn-icon' + ' ' + (inputValue || props.loading ? 'active' : 'disabled') + ' ' + (props.loading ? 'stop' : '')" @click.stop="handleSend">
          <template v-if="!props.loading">
            <t-icon name="send-filled" size="32rpx" :color="primaryBtnTextColor" />
          </template>
          <template v-else>
            <view class="stop-icon" />
          </template>
        </div>
      </div>
    </template>
  </t-chat-sender>
</template>

<script setup>
import TChatSender from '@tdesign/uniapp-chat/chat-sender/chat-sender.vue'
import TIcon from '@tdesign/uniapp/icon/icon.vue'
import TPopover from '@tdesign/uniapp/popover/popover.vue'
import wilUploader from '@/components/mobile/wil-uploader/index.vue'
import * as CONFIG from '@/utils/config.js'
import { computed, nextTick, ref } from 'vue'
import { useThemeColors } from '@/hooks/useThemeColors'
import { useI18n } from 'vue-i18n'
import wilIcon from '@/components/common/wil-icon/index.vue'

const props = defineProps({
  loading: {
    type: Boolean,
    default: false,
  },
})

const emits = defineEmits(['send', 'stop'])
const { isDark, iconColor, primaryBtnTextColor } = useThemeColors()
const { t } = useI18n()
const popoverTheme = computed(() => (isDark.value ? 'dark' : 'light'))
const activeIconColor = computed(() => (isDark.value ? '#6f9cff' : '#0052d9'))
const chatSenderRef = ref(null)
const wilUploaderRef = ref(null)
const inputValue = defineModel('value')
const showPopover = ref(false)
const showMorePopover = ref(false)
const sourceType = ref([])
const deepThinkActive = ref(false)
const netSearchActive = ref(false)
const abilityType = ref('')

const attachmentsProps = ref({
  items: [],
  removable: true,
  imageViewer: true,
})

const popoverOptions = computed(() => [
  { key: 'uploadDocument', name: t('toolbox.uploadDocument'), icon: 'wenjianshangchuan', sourceType: ['album'] },
  { key: 'uploadImage', name: t('toolbox.uploadImage'), icon: 'tupianshangchuan', sourceType: ['album'] },
  { key: 'takePhoto', name: t('toolbox.takePhoto'), icon: 'zhaoxiangji', sourceType: ['camera'] },
])

const moreOptions = computed(() => [
  { key: 'image', name: t('toolbox.imageGeneration'), icon: 'tupian1', className: 'image' },
  { key: 'video', name: t('toolbox.videoGeneration'), icon: 'video', className: 'video' },
])

let uploadFileId = 0

const openPopover = () => {
  showPopover.value = true
}

const onFileChange = event => {
  attachmentsProps.value = {
    ...attachmentsProps.value,
    items: event.files,
  }
}

const selectMore = item => {
  abilityType.value = item.key
  showMorePopover.value = false
}

const closeAbility = () => {
  abilityType.value = ''
}

const chooseFile = () => {
  let id = ++uploadFileId
  plus.io.chooseFile(
    {
      filter: 'all',
      multiple: false,
    },
    async res => {
      const fileUri = res.files[0]
      plus.io.getFileInfo({
        filePath: fileUri,
        success: fileInfo => {
          const fileSize = fileInfo.size // 这里就得到了文件的大小，单位是字节(B)
          console.log('文件大小:', fileSize, 'bytes', fileUri.type)
          attachmentsProps.value.items.push({
            fileType: 'file',
            name: '',
            url: '',
            status: 'pending',
            size: fileSize,
            id: id,
          })
          // 然后继续执行上传逻辑
          const uploadTask = uni.uploadFile({
            url: CONFIG.BASE_URL + '/file/upload',
            filePath: fileUri,
            name: 'file',
            header: {
              Authorization: 'Bearer ' + uni.getStorageSync('Authorization'),
            },
            success: res => {
              let result = JSON.parse(res.data)
              const lastDotIndex = result.data.originalname.lastIndexOf('.')
              let format = result.data.originalname.substring(lastDotIndex + 1)
              let exitIndex = attachmentsProps.value.items.findIndex(item => item.id === id)
              attachmentsProps.value.items[exitIndex] = {
                fileType: format,
                name: result.data.originalname,
                url: result.data.url,
                status: 'complete',
                size: fileSize,
                id: id,
              }
            },
          })
          uploadTask.onProgressUpdate(res => {
            attachmentsProps.value.items.find(item => item.id === id).progress = res.progress + '%'
          })
        },
        fail: e => {
          console.log('获取文件信息失败:', e)
        },
      })
    }
  )
}

//手动调用wil-uploader的选择文件
const chooseImage = item => {
  if (item.key === 'uploadDocument') {
    chooseFile()
  } else {
    sourceType.value = item.sourceType
    nextTick(() => {
      wilUploaderRef.value.chooseImage()
    })
  }
  showPopover.value = false
}
//上传开始
const uploadStart = data => {
  showPopover.value = false
  attachmentsProps.value.items.push({
    fileType: 'image',
    name: data.file.name,
    url: data.filePath,
    status: 'pending',
    id: data.file.uid,
  })
}

const uploadeSuccess = (result, event) => {
  let exitFile = attachmentsProps.value.items.find(item => item.id === event.fileItem.uid)
  exitFile.url = result.data.url
  exitFile.status = 'complete'
}
//点击发送
const handleSend = e => {
  chatSenderRef.value.handleSendClick(e)
}
const sendMessage = value => {
  if (value.value.trim() === '') {
    uni.showToast({
      title: t('common.pleaseInputMessage'),
      icon: 'none',
    })
    return
  }
  attachmentsProps.value.items.forEach(item => {
    item.width = '200rpx'
    item.height = '200rpx'
  })
  emits('send', value.value, attachmentsProps.value.items, { abilityType: abilityType.value ? moreOptions.value.find(i => i.key === abilityType.value).className : '' })
  attachmentsProps.value.items = []
}

const stopMessage = () => {
  emits('stop')
}
</script>

<style lang="scss" scoped>
.chat-sender {
  :deep(.t-chat-sender) {
    margin-bottom: 24rpx;
    background-color: var(--app-bg-card);
    border-color: var(--app-border-strong);
    box-shadow: none;
    .t-chat-sender__textarea {
      color: var(--app-text-primary);

      .t-chat-sender__textarea--control {
        overflow: auto;
        color: var(--app-text-primary);
        background: transparent;
      }

      .t-chat-sender__textarea--placeholder {
        color: var(--app-text-placeholder);
      }
    }
    .t-chat-sender__footer {
      .t-chat-sender__mode {
        display: flex;
        align-items: center;
        .deep-think {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 64rpx;
          height: 64rpx;
          border-radius: 50%;
          border: 2rpx solid var(--app-border-strong);
        }
        .deep-think-active {
          background: var(--app-link-soft);
          color: #0052d9;
          border: 2rpx solid var(--app-link-soft);
        }
        .internet-search {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 64rpx;
          height: 64rpx;
          border-radius: 50%;
          margin-left: 12rpx;
          border: 2rpx solid var(--app-border-strong);
        }
        .internet-search-active {
          background: var(--app-link-soft);
          color: #0052d9;
          border: 2rpx solid var(--app-link-soft);
        }
        .ability-item {
          display: flex;
          align-items: center;
          background: var(--app-link-soft);
          color: #0052d9;
          border: 2rpx solid var(--app-link-soft);
          height: 64rpx;
          padding: 0 16rpx;
          border-radius: 16rpx;

          .ability-icon {
            font-size: 36rpx;
            display: block;
            margin-right: 12rpx;
          }
          span {
            font-size: 28rpx;
            color: #0052d9;
            padding-right: 10rpx;
          }
        }
        .t-popover__wrapper {
          .more-button {
            display: flex;
            align-items: center;
            border: 2rpx solid var(--app-border-strong);
            border-radius: 16rpx;
            height: 64rpx;
            padding: 0 16rpx;
            margin-left: 12rpx;
            span {
              font-size: 28rpx;
              padding-left: 10rpx;
              color: var(--app-text-primary);
            }
          }
        }
        .t-popover {
          position: fixed;
          .t-popover__content {
            background: var(--app-bg-card);
            color: var(--app-text-primary);
            border: 2rpx solid var(--app-border-strong);

            .popover-content-list {
              .popover-content-item {
                display: flex;
                align-items: center;
                padding: 12rpx 0;
                cursor: pointer;
                .popover-content-icon {
                  font-size: 36rpx;
                  display: block;
                  margin-right: 12rpx;
                }
                span {
                  font-size: 28rpx;
                }
                &:first-child {
                  padding-top: 0;
                }
                &:last-child {
                  padding-bottom: 0;
                }
              }
            }
          }
        }
      }
    }
    .t-attachments__file {
      background-color: var(--app-bg-secondary);
    }

    .t-attachments__title {
      color: var(--app-text-primary);
    }

    .t-attachments__desc {
      color: var(--app-text-tertiary);
    }

    .t-attachments__remove {
      background-color: var(--app-text-primary);
      color: var(--app-bg);
    }

    .t-chat-sender__sendbtn {
      .suffix-button {
        display: flex;
        align-items: center;
        .t-popover {
          position: fixed;
          .t-popover__content {
            background: var(--app-bg-card);
            color: var(--app-text-primary);
            border: 2rpx solid var(--app-border-strong);
            .popover-content-list {
              .popover-content-item {
                display: flex;
                align-items: center;
                padding: 12rpx 0;
                cursor: pointer;
                .popover-content-icon {
                  font-size: 36rpx;
                  display: block;
                  margin-right: 12rpx;
                }
                span {
                  font-size: 28rpx;
                }
                &:first-child {
                  padding-top: 0;
                }
                &:last-child {
                  padding-bottom: 0;
                }
              }
            }
          }
        }
        .upload-btn-icon {
          width: 64rpx;
          height: 64rpx;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 16rpx;
          border: 1px solid var(--app-border-strong);
        }
        .send-btn-icon {
          width: 64rpx;
          height: 64rpx;
          margin-left: 16rpx;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          transform: rotate(-90deg);
          transition: all 0.3s ease;
          &.disabled {
            background-color: var(--app-text-placeholder);
            color: var(--app-text-inverse);
          }
          &.active {
            background-color: var(--app-link);
            color: var(--app-text-inverse);
          }
          .stop-icon {
            width: 24rpx;
            height: 24rpx;
            background-color: var(--app-text-inverse);
          }
        }
      }
    }
  }
}
</style>
