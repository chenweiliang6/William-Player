<template>
  <div :class="['ai-chat', themeClass]">
    <wil-navbar :title="t('navbar.aiQa')" :right-show="true">
      <template #right>
        <image src="@/static/add-conversation.png" @click="addNew"  />
      </template>
    </wil-navbar>
    <view class="chat-box">
      <!-- 想要使用虚拟列表的话，就不能在chat-list里面使用chat-message，直接在chat-list中通过data属性传值 -->
      <t-chat-list id="chatList" ref="tChatListRef">
        <div class="chat-empty" v-if="!chatList?.length">
          <span>{{ t('toolbox.helloUser', { name: userInfo.name }) }}</span>
          <span>{{ t('toolbox.aiGreeting') }}</span>
        </div>
        <t-chat-message
          :chat-id="item.chatId"
          :avatar="item.avatar || ''"
          :name="item.name || ''"
          :datetime="item.datetime || ''"
          :content="item.content.some(i => i.type === 'image' || i.type === 'video') ? [] : item.content"
          :role="item.role"
          :placement="item.role === 'user' ? 'right' : 'left'"
          :status="item.status || ''"
          @message-longpress="showPopover"
          v-for="(item, index) in chatList"
          :key="item.chatId"
        >
          <!-- 只在content的内容是图片或者视频的时候，才显示图片和视频的预览 -->
          <template #content>
            <div class="content-text">{{ item.content[0]?.data || '' }}</div>
            <div class="content-image" v-if="item.content[1].type === 'image'">
              <image v-if="!item.content[1].data?.length && item.status === 'loading'"  />
              <image
                v-for="vitem in item.content[1].data || []"
                :key="vitem.url"
                :src="vitem.url"
                mode="aspectFill"
                @click="previewImage(vitem, item.content[1].data)"
               />
            </div>
            <div class="content-video" v-if="item.content[1].type === 'video'">
              <div class="content-video-empty" v-if="!item.content[1].data?.length && item.status === 'loading'"></div>
              <h5-video v-for="vitem in item.content[1].data || []" :key="vitem.url" :videoSrc="vitem.url" :poster="item.cover_image_url"></h5-video>
            </div>
          </template>
          <!-- <template #actionbar>
            <t-chat-actionbar
              v-if="index !== chatList.length - 1 && item.status === 'complete' && item.role === 'assistant'"
              :ref="`actionbar-${item.chatId}`"
              :chat-id="`actionbar-${item.chatId}`"
              :comment="item.comment"
              @actions="handleAction"
            />
          </template> -->
        </t-chat-message>
        <!-- <div @click="sendMessage">点击发送</div> -->
        <template #footer>
          <chat-sender
            v-model:value="inputValue"
            :loading="sendLoading"
            :disabled="disabledInput"
            :auto-rise-with-keyboard="true"
            :render-presets="renderPresets"
            :placeholder="t('toolbox.inputQuestion')"
            @send="sendMessage"
            @stop="stopMessage"
          ></chat-sender>
        </template>
      </t-chat-list>
      <!-- 长按弹出操作栏 -->
      <t-chat-actionbar ref="popoverActionbar" class="popover-actionbar" placement="longpress" :action-bar="['quote', 'copy', 'share']" @actions="handlePopoverAction" />
    </view>
    <!-- 通过renderjs用于接收sse的消息 -->
    <wil-sse
      ref="wil_sse"
      :responseAdapter="responseAdapter"
      @connecting="handleConnecting"
      @connected="handleConnected"
      @message="handleMessage"
      @error="handleError"
      @disconnected="handleDisconnected"
      @connectionCreated="handleConnectionCreated"
      @connectionDeleted="handleConnectionDeleted"
    />
  </div>
</template>

<script setup>
import TChatMessage from '@tdesign/uniapp-chat/chat-message/chat-message.vue'
import TChatList from '@tdesign/uniapp-chat/chat-list/chat-list.vue'
import TChatSender from '@tdesign/uniapp-chat/chat-sender/chat-sender.vue'
import TChatActionbar from '@tdesign/uniapp-chat/chat-actionbar/chat-actionbar.vue'
import TIcon from '@tdesign/uniapp/icon/icon.vue'
import wilSse from '@/components/mobile/wil-sse/index.vue'
import chatSender from './components/chat-sender.vue'
import h5Video from './components/h5-video.vue'
import { ref } from 'vue'
import * as CONFIG from '@/utils/config.js'
import wilNavbar from '@/components/mobile/wil-navbar/index.vue'
import { generations } from '@/network/apis.js'
import { useThemeClass } from '@/hooks/useThemeClass'
import { useI18n } from 'vue-i18n'
import { useI18nNavbar } from '@/hooks/useI18nNavbar'

const themeClass = useThemeClass()
const { t } = useI18n()
useI18nNavbar('navbar.aiQa')
let uniqueId = 0
const wil_sse = ref(null)
const tChatListRef = ref(null)
const chatList = ref([])
const inputValue = ref('')
const sendLoading = ref(false) //发送按钮是否在加载中
const disabledInput = ref(false) //是否禁用输入框
const userInfo = ref(uni.getStorageSync(CONFIG.USER_KEY) || {})
const connectionConfigs = ref({
  connectionId: 'chat1',
  // url: 'https://apis.iflow.cn/v1/chat/completions',
  url: CONFIG.BASE_URL + '/aiChat/stream',
  headers: {
    Authorization: uni.getStorageSync('Authorization'),
    'Content-Type': 'application/json',
  },
  method: 'POST',
  autoConnect: true,
  autoReconnect: true,
  body: { model: 'glm-4.1v-thinking-flash', thinking: true },
})

const renderPresets = ref(null)

let generationsPromise = null
let abilityType = ''

const responseAdapter = event => {
  if (event) {
    return {
      id: event.data.id,
      content: event.data?.choices?.[0]?.delta?.content || '',
      reasoning_content: event.data?.choices?.[0]?.delta?.reasoning_content || '',
      type: event.data.type || 'markdown',
    }
  } else {
    return {}
  }
}

const addNew = () => {
  sendLoading.value = false
  chatList.value = []
  if (!abilityType) {
    //流式接口调用sse的abort
    wil_sse.value.closeAllConnections()
  } else {
    //生成图片或者视频，调用接口的abort
    generationsPromise && generationsPromise.abort()
  }
}

const previewImage = (item, arr) => {
  uni.previewImage({
    current: item.url,
    urls: arr.map(i => i.url),
    indicator: 'none',
  })
}

const sendMessage = async (value, fileList, abilityObj) => {
  if (!wil_sse.value) return
  abilityType = abilityObj.abilityType || ''
  tChatListRef.value.scrollToBottom()
  // 创建用户消息对象
  const userMessage = {
    role: 'user',
    chatId: getUniqueKey(),
    content: [
      {
        type: 'attachment',
        data: fileList,
      },
      {
        type: 'text',
        data: inputValue.value.trim(),
      },
    ],
  }
  let aiMessage = {}
  if (abilityObj.abilityType) {
    aiMessage =
      abilityObj.abilityType === 'image'
        ? {
            role: 'assistant',
            chatId: getUniqueKey(),
            comment: '',
            status: 'loading',
            avatar: 'https://appstoreimg-ipv6.vivo.com.cn/appstore/developer/icon/20231211/xnof23rl/202312111204047yhfu.webp',
            content: [
              {
                type: 'text',
                data: t('video.generatingImage'),
              },
              {
                type: 'image',
                data: [],
              },
            ],
          }
        : {
            role: 'assistant',
            chatId: getUniqueKey(),
            comment: '',
            status: 'loading',
            avatar: 'https://appstoreimg-ipv6.vivo.com.cn/appstore/developer/icon/20231211/xnof23rl/202312111204047yhfu.webp',
            content: [
              {
                type: 'text',
                data: t('video.generatingVideo'),
              },
              {
                type: 'video',
                data: [],
              },
            ],
          }
    chatList.value = [aiMessage, userMessage, ...chatList.value]
    let content = inputValue.value.trim()
    inputValue.value = ''
    sendLoading.value = true //此时ai正在输出中，所以按钮加载中
    try {
      generationsPromise = generations({ content: content, type: abilityObj.abilityType })
      let res = await generationsPromise
      chatList.value[0].content[0].data = abilityObj.abilityType === 'image' ? t('video.imageGenerated') : t('video.videoGenerated')
      abilityObj.abilityType === 'image' ? (chatList.value[0].content[1].data = res.data.data) : (chatList.value[0].content[1].data = res.data.video_result)
      chatList.value[0].status = 'complete'
    } catch (error) {
      //异常情况处理
      chatList.value[0].content[0].data = t('video.generationFailedRetry')
      chatList.value[0].content[1].data = []
      chatList.value[0].status = 'fail'
    }
    sendLoading.value = false
  } else {
    aiMessage = {
      role: 'assistant',
      chatId: getUniqueKey(),
      comment: '',
      content: [
        {
          type: 'markdown',
          data: '',
        },
      ],
      avatar: 'https://appstoreimg-ipv6.vivo.com.cn/appstore/developer/icon/20231211/xnof23rl/202312111204047yhfu.webp',
      status: 'pending',
    }
    // 将用户消息插入到chatList的开头（因为reverse为true，所以用unshift）
    chatList.value = [aiMessage, userMessage, ...chatList.value]
    connectionConfigs.value.body.content = inputValue.value.trim()
    connectionConfigs.value.body.fileList = fileList.map(i => i.url)
    wil_sse.value.createConnection(connectionConfigs.value)
    inputValue.value = ''
    sendLoading.value = true //此时ai正在输出中，所以按钮加载中
  }
}

const stopMessage = () => {
  if (!abilityType) {
    //流式接口调用sse的abort
    wil_sse.value.closeAllConnections()
  } else {
    //生成图片或者视频，调用接口的abort
    generationsPromise && generationsPromise.abort()
  }
  sendLoading.value = false
}
const getUniqueKey = () => {
  uniqueId += 1
  console.log(`key-${uniqueId}`)
  return `key-${uniqueId}`
}

const handleMessage = message => {
  console.log(message, 'handleMessage')

  chatList.value[0].status = 'streaming'
  if (!sendLoading.value) return
  if (message.reasoning_content) {
    if (chatList.value[0].content.some(i => i.type === 'thinking')) {
      chatList.value[0].content[0].data.text += message.reasoning_content
    } else {
      chatList.value[0].content.unshift({
        type: 'thinking',
        data: {
          title: t('video.thinking'),
          text: message.reasoning_content,
        },
      })
    }
  } else {
    if (chatList.value[0].content.some(i => i.type === 'thinking')) {
      chatList.value[0].status = 'complete'
      chatList.value[0].content[0].data.title = t('video.thinkingCompleted')
      if (message.content) chatList.value[0].content[1].data += message.content
    } else {
      if (message.content) chatList.value[0].content[0].data += message.content
    }
  }
}

//关闭连接，也就是ai回答完成
const handleDisconnected = () => {
  console.log('sendLoadng')
  console.log('代断块了')
  chatList.value[0].status = 'complete'
  sendLoading.value = false
}
</script>
<style lang="scss" scoped>
page {
  width: 100%;
  height: 100%;
}
.ai-chat {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--app-bg);
  color: var(--app-text-primary);
  :deep(.wil-navbar) {
    .nut-navbar--placeholder {
      .nut-navbar {
        .nut-navbar__right {
          image {
            width: 40rpx;
            height: 40rpx;
            display: block;
          }
        }
      }
    }
  }

  .chat-box {
    flex: 1;
    padding-top: 32rpx;
    box-sizing: border-box;
    overflow: hidden;
    :deep(.t-chat-list) {
      box-sizing: border-box;
      .t-chat-list__content {
        .chat-empty {
          transform: rotateX(180deg);
          display: flex;
          flex-direction: column;
          padding-left: 48rpx;
          padding-top: 200rpx;
          span:first-child {
            font-size: 60rpx;
            font-weight: bold;
            color: var(--app-link);
          }
          span:last-child {
            font-size: 32rpx;
            color: var(--app-text-tertiary);
            padding-top: 24rpx;
          }
        }
      }
      .t-chat-message {
        padding: 0 32rpx;
        .t-chat-message__content {
          .t-chat-message__detail {
            .content-text {
              margin-bottom: 24rpx;
            }
            .content-image {
              display: flex;
              align-items: center;
              flex-wrap: nowrap;
              width: 100%;
              overflow: auto;
              scrollbar-width: none;
              image {
                flex: 0 0 256rpx;
                height: 256rpx;
                border-radius: 24rpx;
                margin-left: 24rpx;
                background: var(--app-bg-secondary);
                &:first-child {
                  margin-left: 0;
                }
              }
            }
            .content-video {
              display: flex;
              align-items: center;
              flex-wrap: nowrap;
              width: 100%;
              overflow: auto;
              scrollbar-width: none;
              .content-video-empty {
                flex: 0 0 500rpx;
                height: 300rpx;
                border-radius: 24rpx;
                background: var(--app-bg-secondary);
              }
            }
          }
        }
        .t-chat-content {
          // width: 100%;
          max-width: 100%;
        }
      }
    }
  }
}
</style>
