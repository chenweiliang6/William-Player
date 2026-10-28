<template>
  <div ref="playerRef" class="mpv-player">
    <embed ref="mpvRef" id="mpvjs" type="application/x-mpvjs" wmode="transparent" class="mpv-player-embed" />
    <player-control
      :nowTime="mpvData.timePos"
      :time-length="mpvData.duration"
      :paused="mpvData.paused"
      :mpv="mpv"
      :audioTrack="audioTrack"
      :subTitleTrack="subTitleTrack"
      :fullScreen="mpvData.fullScreen"
      @onPause="onPause"
      @onFullscreen="onFullscreen"
      @change="changeSlide"
      @getTrackList="getTrackList"
    ></player-control>
    <div class="mpv-player-loading" v-if="mpvData.loading">
      <img src="@/static/loading-white.png" />
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick, onBeforeUnmount, reactive, onMounted } from 'vue'
import Mpv from './mpv.js'
import playerControl from './player-control.vue'
import NoSleep from 'nosleep.js'
import { ipc } from '@/utils/ipcRenderer'
import { ipcApiRoute } from '@/utils/ipcApiRoute'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const props = defineProps({
  videoUrl: { type: String, default: '' },
  title: { type: String, default: '' },
})

const route = useRoute()
let noSleep = new NoSleep()
const mpvRef = ref(null)
const playerRef = ref(null)
const audioTrack = ref(null)
const subTitleTrack = ref(null)
const config = ref({})
const mpvData = reactive({
  timePos: 0,
  duration: 0,
  paused: false,
  loading: false,
  fullScreen: false,
})
let timer
let mpv
let historyObj = {}
let historyIndex = -1
let selectType = {}
let selectMedia = {}

const langMapping = () => ({
  chi: t('video.languageChinese'),
  eng: t('video.languageEnglish'),
  kor: t('video.languageKorean'),
  jap: t('video.languageJapanese'),
  fre: t('video.languageFrench'),
  spa: t('video.languageSpanish'),
  rus: t('video.languageRussian'),
  por: t('video.languagePortuguese'),
  ara: t('video.languageArabic'),
})

//在视频开始播放之后获取音轨列表和字幕列表
const getTrackListData = async () => {
  if (!audioTrack.value) {
    audioTrack.value = []
    await ipc.invoke(ipcApiRoute.mpvConnect, {})
    await ipc.invoke(ipcApiRoute.mpvTrackList)
  }
}

const playFile = src => {
  mpvData.loading = true
  mpv.loadFile(src)
  mpv.goPlay(true)
  // mps.paused = false;
  noSleep.enable()
}
//判断选择的是哪个emby
const judgeSelect = () => {
  let sourceList = uni.getStorageSync('sourceList') || []
  const embySource = sourceList.find(item => (route.query.isEmby === 'true') === (item.type === 'Emby'))
  if (!embySource?.list) {
    selectType = {}
    return
  }
  const activeItem = embySource.list.find(item => item.active)
  if (activeItem) {
    selectMedia = activeItem
    selectType = embySource
  } else {
    selectType = {}
  }
}

//初始化获取当前的historyObj
const initHistoryObj = () => {
  judgeSelect()
  const historyPlay = uni.getStorageSync('historyPlay')
  const lastIndex = decodeURIComponent(route.query.path).lastIndexOf('/')
  let name = decodeURIComponent(route.query.path).substring(lastIndex + 1)
  if (route.query.type) {
    if (route.query.type === 'movie') {
      historyIndex = historyPlay.findIndex(i => i.name === name && i.sourceName === selectMedia.name)
      historyObj = historyIndex > -1 ? historyPlay[historyIndex] : {}
    } else if (route.query.type === 'tv') {
      historyIndex = historyPlay.findIndex(i => i.name == name && i.path == route.query.path && i.sourceName === selectMedia.name)
      historyObj = historyIndex > -1 ? historyPlay[historyIndex] : {}
      config.value.title = historyObj.titlePlay
        ? (config.value.title = historyObj.titlePlay + ' ' + t('video.episodeTitle', { episode: historyObj.ji }) + ' ' + historyObj.title)
        : decodeURIComponent(route.query.path).substring(lastIndex + 1)
    }
  } else {
    // config.value.initialTime = 0
    config.value.title = decodeURIComponent(route.query.path).substring(lastIndex + 1)
    historyObj = {}
    return
  }
}

//往historyPlay历史数据中更改item
const updateHistoryPlay = () => {
  historyObj.initialTime = mpvData.timePos
  const historyPlay = uni.getStorageSync('historyPlay')
  historyPlay[historyIndex] = historyObj
  uni.setStorageSync('historyPlay', historyPlay)
}

//从mpv获取一些数据
const onMessage = e => {
  const msg = e.data
  const { type, data } = msg
  // console.log(msg, 'msg');

  if (data?.name) {
    switch (data.name) {
      case 'time-pos':
        // autoTime();
        if (data.value > 0 && data.value < 1) {
          getTrackListData()
        }
        mpvData.loading = false
        mpvData.timePos = Math.round(data.value)
        break
      case 'duration':
        mpvData.duration = Math.round(data.value)
        break
    }
  }
}

const onVideoSrcChange = newVal => {
  if (mpv) {
    playFile(newVal)
    mpvRef.value.addEventListener('message', onMessage, false)
    return
  }
  nextTick(() => {
    mpvRef.value.removeEventListener('message', onMessage, false) // 先移除旧监听（若有）
    setTimeout(() => {
      mpv = new Mpv(document.getElementById('mpvjs'))
      mpv.playerReady()
      playFile(newVal)
      mpvRef.value.addEventListener('message', onMessage, false)
    }, 1000)
  })
}
//控制暂停与播放
const onPause = () => {
  if (mpvData.paused === true) {
    // 暂停了，那就播放
    mpv.goPlay(true)
    noSleep.enable()
  } else {
    // 暂停
    //在暂停的时候，存一下播放进度
    updateHistoryPlay()
    mpv.goPlay(false)
    noSleep.disable()
  }
  mpvData.paused = !mpvData.paused
}

//全屏与退出全屏
const onFullscreen = () => {
  mpvData.fullScreen = !mpvData.fullScreen
  if (mpvData.fullScreen) {
    playerRef.value.requestFullscreen()
  } else {
    document.exitFullscreen()
  }
}

//获取音轨列表
const getTrackList = async () => {
  await ipc.invoke(ipcApiRoute.mpvConnect, {})
  await ipc.invoke(ipcApiRoute.mpvTrackList)
}

//拖动进度条
const changeSlide = val => {
  mpvData.loading = true
  mpv.seek(val)
}

initHistoryObj()
onBeforeUnmount(() => {
  //在销毁之前，存一下播放进度
  updateHistoryPlay()
  mpvRef.value.removeEventListener('message', onMessage, false)
  ipc.removeAllListeners()
})

onMounted(() => {
  // 监听 MPV 数据
  ipc.on('mpv-track-list', (event, res) => {
    console.log(res.data.data, 'audioTrack.value')
    if (res.data.request_id) {
      mpvData.loading = false
      if (res.data.data) {
        audioTrack.value = res.data.data.filter(v => v.type === 'audio')
        subTitleTrack.value = res.data.data.filter(v => v.type === 'sub')
        //初始化的时候设置音轨为第一个，字幕为中文轨道，不保证一定是简体，因为简体繁体都是chi
        if (audioTrack.value.length) {
          mpv.setAudioTrack(audioTrack.value[0].id)
        }
        if (subTitleTrack.value.length) {
          let hanyu = subTitleTrack.value.find(i => i.lang === 'chi')
          if (hanyu) {
            mpv.setSubtitleTrack(hanyu.id)
          } else {
            mpv.setSubtitleTrack(subTitleTrack.value[0].id)
          }
        }
      } else {
        audioTrack.value = []
        subTitleTrack.value = []
      }
      audioTrack.value.forEach((item, index) => {
        item.language = langMapping()[item.lang] || t('video.audioTrack', { index })
      })
      subTitleTrack.value.forEach((item, index) => {
        item.language = langMapping()[item.lang] || t('video.subtitleTrack', { index })
      })
    } else {
      switch (res.data.event) {
        case 'playback-restart': //跳转进度之后重新开始播放
          mpvData.loading = false
          break
        default:
          break
      }
    }
  })
  setTimeout(() => {
    mpv = new Mpv(document.getElementById('mpvjs'))
    mpv.playerReady()
    if (props.videoUrl) {
      onVideoSrcChange(props.videoUrl)
    }
  }, 0)
})

watch(
  () => props.videoUrl,
  val => {
    onVideoSrcChange(val)
  },
  { immediate: false }
)
</script>

<style lang="scss" scoped>
@keyframes spin-reverse {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(-360deg);
  }
}

.mpv-player {
  width: 100%;
  height: 100%;

  .mpv-player-embed {
    width: 100%;
    height: 100%;
  }

  .mpv-player-loading {
    position: absolute;
    width: 100%;
    height: 100%;
    background: transparent;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 99;
    left: 0;
    top: 0;

    img {
      width: 80rpx;
      height: 80rpx;
      animation: spin-reverse 1s linear infinite reverse;
    }
  }
}
</style>
