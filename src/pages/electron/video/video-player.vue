<template>
  <div class="video-player">
    <mpv-player :video-url="config.url"></mpv-player>
  </div>
</template>

<script setup>
import { onBeforeMount, reactive, ref } from 'vue'
import mpvPlayer from './components/mpv-player.vue'
import { useRoute } from 'vue-router'
import { getWebDAVUrl, get189VideoUrl, loginUser, getQuarkResolutionUrl, getQuarkVideoUrl, getWopanVideoUrl, get139VideoUrl, getFolder, getTvSeason, get189Folder, getQuarkFolder } from '@/utils/common'
import { calTime, handleSeasonName, generateChineseNumberMapping } from '@/utils/scrape'
import { addOperLog } from '@/network/apis'
import { IMG_DOMAIN } from '@/utils/config'
import { getEmbyPlayerUrl } from '@/utils/emby'
import { judgeSelect } from '@/utils/tools'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const route = useRoute()

const config = reactive({
  url: '',
  // 是否自动播放
  autoplay: true,
  //播放器预览背景图片，支持网络地址
  poster: '',
  //是否循环播放
  loop: false,
  //开始播放位置，单位：秒
  initialTime: 0,
  //是否是直播
  isLive: false,
  //是否静音播放
  muted: false,
  codec: 'hardware',
  title: '',
  playStrategy: 0,
  cookieStr: '',
})

let selectType = {}
let selectMedia = {}
const getVideoUrl = async () => {
  if (route.query.selectMedia) {
    //此种情况是在文件夹形式中播放，会传一个selectMedia过来
    selectMedia = JSON.parse(decodeURIComponent(route.query.selectMedia))
    selectType = { type: selectMedia.type }
  } else {
    //正常海报墙情况就是获取当前active选择的资源
    const { selectType: type, selectMedia: media } = judgeSelect(route.query.isEmby === 'true' ? 'emby' : 'normal')
    selectMedia = media
    selectType = type
  }
  if (selectType.type == 'WebDAV') {
    if (selectMedia.name) {
      let res = await getWebDAVUrl(
        {
          path: decodeURIComponent(route.query.path),
        },
        selectMedia
      )
      return res
    }
  } else if (selectType.type == '天翼云盘') {
    if (selectMedia.name) {
      let res = await get189VideoUrl(
        {
          folderFileId: route.query.folderFileId,
        },
        selectMedia
      )
      console.log(res, 'res111')

      return res
    }
  } else if (selectType.type == '夸克网盘') {
    if (selectMedia.name) {
      let res = await getQuarkResolutionUrl(
        {
          folderFileId: route.query.folderFileId,
        },
        selectMedia
      )
      // let res = await getQuarkVideoUrl({ folderFileId: route.query.folderFileId }, selectMedia);
      return res
    }
  } else if (selectType.type == '联通云盘') {
    if (selectMedia.name) {
      let res = await getWopanVideoUrl(
        {
          folderFileId: route.query.folderFileId,
        },
        selectMedia
      )
      return res
    }
  } else if (selectType.type == '移动云盘') {
    if (selectMedia.name) {
      let res = await get139VideoUrl(
        {
          folderFileId: route.query.folderFileId,
        },
        selectMedia
      )
      return res
    }
  } else if (selectType.type == 'Emby') {
    if (selectMedia.name) {
      let res = await getEmbyPlayerUrl(
        {
          folderFileId: route.query.folderFileId,
        },
        selectMedia
      )
      // let res = await getQuarkVideoUrl({ folderFileId: route.query.folderFileId }, selectMedia);
      return res
    }
  }
}
const setQuarkUrl = (res, num) => {
  if (num == 5) return
  if (res.data.video_list[num].video_info?.url) {
    config.url = res.data.video_list[num].video_info.url
  } else {
    num++
    setQuarkUrl(res, num)
  }
}
const setUrl = async () => {
  let res = await getVideoUrl()
  if (selectType.type == 'WebDAV') {
    config.url = res.data.raw_url
    addOperLog({
      title: config.title.slice(0, 30),
      businessType: 10,
      operatorType: 2,
      operUrl: config.url,
    })
  } else if (selectType.type == '天翼云盘') {
    config.url = res.normal.url
    // uni.request({
    //   url: res.normal.url,
    //   method: 'HEAD',
    //   success: res => {
    //     resolve(res.data)
    //   },
    // })
  } else if (selectType.type == '联通云盘') {
    config.url = res.url
  } else if (selectType.type == '移动云盘') {
    config.url = res.url
  } else if (selectType.type == '夸克网盘') {
    if (res.data.video_list[0].video_info?.url) {
      config.url = res.data.video_list[0].video_info.url
      addOperLog({
        title: config.title.slice(0, 30),
        businessType: 10,
        operatorType: 2,
        operUrl: config.url,
      })
      // addOperLog({ title: config.title.slice(0, 30), businessType: 10, operatorType: 2, operUrl: res.data[0].download_url });
      // config.url = res.data[0].download_url;
    } else {
      let num = 1
      uni.showToast({
        title: t('video.quarkVipOrLoginExpired'),
        icon: 'none',
      })
      setQuarkUrl(res, num)
    }
  } else if (selectType.type == 'Emby') {
    config.url = selectMedia.protocol + '://' + selectMedia.address + ':' + selectMedia.port + res.MediaSources[0].DirectStreamUrl
    addOperLog({
      title: config.title.slice(0, 30),
      businessType: 10,
      operatorType: 2,
      operUrl: config.url,
    })
  }
}

onBeforeMount(() => {
  const { selectType: type, selectMedia: media } = judgeSelect(route.query.isEmby === 'true' ? 'emby' : 'normal')
  selectMedia = media
  selectType = type
  if (route.query.videoUrl) {
    config.url = decodeURIComponent(route.query.videoUrl)
    config.title = route.query.liveTitle
    return
  }
  setUrl()
})
</script>

<style lang="scss" scoped>
.video-player {
  width: 100%;
  height: 100%;
  background: #000;
  position: relative;
}
</style>
