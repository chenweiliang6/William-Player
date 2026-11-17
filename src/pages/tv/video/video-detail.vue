<template>
  <tv-page @keyCodeClick="keyCodeClick">
    <video-detail-skeleton v-if="!hasDetail" />
    <div v-else class="video-detail" :style="{ backgroundImage: `url(${imgData.img})`, ...posterVars }">
      <div class="video-detail-left" :style="{ background: leftBg }">
        <div class="left-title">{{ imgData.title }}</div>
        <div class="left-info">
          <div class="left-info-date">
            <wil-icon name="rili" custom-color="#ffffff"></wil-icon>
            <span>{{ imgData.releaseTime }}</span>
          </div>
          <div class="left-info-score">
            <wil-icon name="shoucang" custom-color="#f4bc22"></wil-icon>
            <span>{{ imgData.score }}</span>
          </div>
          <div class="left-info-runtime">{{ imgData.runtime }}</div>
        </div>
        <div class="left-genres">{{ imgData.genres }}</div>
        <div class="left-overview">{{ overview }}</div>
        <operation-button
          ref="operation_button"
          :focusModel="focusModel"
          :title="buttonText"
          :type="routerParams.type"
          @openPopup="openPopup"
          @toPlay="clickPlayButton"
        ></operation-button>
      </div>
      <div class="video-detail-right" :style="{ backgroundColor: showRightPopup ? 'rgba(0,0,0,0.4)' : 'transparent' }">
        <nut-popup v-model:visible="showRightPopup" :overlay="false" position="right">
          <cloud-list :list="sourceList" @backLeft="backLeft" ref="cloud_list" v-if="focusModel === 'cloudList'"></cloud-list>
          <season-list :list="selectSource.seasonArr" @backLeft="backLeft" v-if="focusModel === 'seasonList'" ref="season_list"></season-list>
          <tv-listd :list="tvList" ref="tv_list" v-if="focusModel === 'tvList'" @backLeft="backLeft" @toPlay="toPlayVideo"></tv-listd>
          <actor-list :routerParams="routerParams" ref="actor_list" v-if="focusModel === 'actorList'" @backLeft="backLeft"></actor-list>
        </nut-popup>
      </div>
    </div>
  </tv-page>
</template>

<script setup>
import { onBeforeMount, ref, computed, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDict } from '@/utils/useDict'
import { loginUser, getFolder, get189Folder, getQuarkFolder, get139Folder, getTvSeason, getMovieTvById } from '@/utils/common'
import { parseTime, calTime, handleSecond, handleSeasonName, extractSeasonNumber, generateChineseNumberMapping, getMovieTvData, findInView } from '@/utils/scrape'
import { onShow, onLoad } from '@dcloudio/uni-app'
import editIcon from '@/static/edit_icon.png'
import timeIcon from '@/static/time_icon.png'
import downloadIcon from '@/static/download-icon.png'
import { toStringfy } from '@/pages/mobile/mine/common'
import * as CONFIG from '@/utils/config'
import operationButton from './components/detail-component/operation-button.vue'
import tvPage from '@/components/tv/tv-page/index.vue'
import { useDominantColor } from '@/hooks/useDominantColor'
import { posterPalette } from '@/utils/dominantColor'
import wilIcon from '@/components/common/wil-icon/index.vue'
import cloudList from './components/detail-component/cloud-list.vue'
import seasonList from './components/detail-component/season-list.vue'
import tvListd from './components/detail-component/tv-list.vue'
import actorList from './components/detail-component/actor-list.vue'
import VideoDetailSkeleton from '@/components/common/video-detail-skeleton.vue'
import { findActiveSource } from '@/utils/tools'

const { t } = useI18n()
const { getUntokenDict } = useDict()
const showPopover = ref(false)
const popoverArr = ref([{ icon: editIcon, text: t('video.manualEdit'), action: 'manualEdit' }])

const showTimePicker = ref(false)
const pickerTitle = ref('')
const pickerAction = ref('')
const pickerVal = ref(['0', '0'])
const pickerColumns = ref([[], []])

const imgData = ref({}) //图片内的信息
const overview = ref('') //剧情简介
// 详情数据未就绪时展示骨架屏，避免进入页面时长时间空白
const detailLoading = ref(true)
const hasDetail = computed(() => !detailLoading.value || !!imgData.value.title)

const sourceList = ref([])
const selectSource = ref({}) //切换选中的来源

const actor_list = ref(null)

const activeSeason = ref('')
const seasonFirst = ref({})

const tvList = ref([]) //目前网盘所拥有的电视集数列表

const historyPlay = ref(uni.getStorageSync('historyPlay') || []) //历史播放
const buttonText = ref(t('video.play'))
const firstEnter = ref(true)

const routerParams = ref({})
const selectMedia = ref({})
const selectType = ref({})
const nowSourceList = ref([])

const showRehandleButton = ref(false)
const historyTv = ref({})

const localMovieTvData = ref({})
const scrollIntoView = ref('')

const lineNumber = ref(2)
const lineHeight = ref(0)

const focusModel = ref('operationButton')
const operation_button = ref(null)
const cloud_list = ref(null)
const season_list = ref(null)
const tv_list = ref(null)
const showRightPopup = ref(false)

// 左栏（文字区）用海报主色纯色铺底，背景大图保持原样清晰显示
const { rawColor: tvRawColor } = useDominantColor(computed(() => imgData.value.img))
const palette = computed(() => posterPalette(tvRawColor.value))
const leftBg = computed(() => {
  if (showRightPopup.value) return 'rgba(0,0,0,0.4)'
  return palette.value?.bg || 'rgba(0, 0, 0, 0.75)'
})
const posterVars = computed(() => {
  const p = palette.value
  return p
    ? {
        '--content-text': p.text,
        '--content-text-secondary': p.textSecondary,
        '--content-text-tertiary': p.textTertiary,
        '--content-border': p.border,
        '--content-surface': p.surface,
        '--content-surface-strong': p.surfaceStrong,
      }
    : {}
})

const toSelect = item => {
  if (item.action == 'manualEdit') {
    showPopover.value = false
    //获取当前源里面的最大季数
    const maxSeasonArrLength = Math.max(...sourceList.value.map(v => (v.seasonArr || []).length))
    const query = encodeURIComponent(imgData.value.title || routerParams.value.name || '')
    uni.navigateTo({
      url: `/pages/tv/video/search-match?type=${routerParams.value.type}&maxSeasonLength=${maxSeasonArrLength}&workKey=${encodeURIComponent(routerParams.value.workKey || '')}&query=${query}`,
    })
  } else if (item.action == 'skipIntro') {
    let localMovieTvData = getMovieTvData()
    // 按类型 + id 精确定位；查不到当作未设置，避免 undefined 取属性抛错
    let nowTv = findInView(localMovieTvData, {
      mediaType: 'tv',
      tmdbId: routerParams.value.movieTvId,
      path: routerParams.value.path,
    })
    if (nowTv?.openingTime) {
      const minutes = String(Math.floor(nowTv.openingTime / 60)) // 取整分钟数
      const remainingSeconds = String(nowTv.openingTime % 60) // 剩余秒数
      pickerVal.value = [minutes, remainingSeconds]
    } else {
      pickerVal.value = ['0', '0']
    }
    showPopover.value = false
    pickerTitle.value = item.text
    pickerAction.value = item.action
    let arr1 = []
    let arr2 = []
    for (let i = 0; i <= 15; i++) {
      arr1.push({ text: t('video.minuteValue', { value: i }), value: String(i) })
    }
    for (let i = 0; i <= 59; i++) {
      arr2.push({ text: t('video.secondValue', { value: i }), value: String(i) })
    }
    pickerColumns.value[0] = arr1
    pickerColumns.value[1] = arr2
    showTimePicker.value = true
  } else if (item.action == 'skipOutro') {
    let localMovieTvData = getMovieTvData()
    let nowTv = findInView(localMovieTvData, {
      mediaType: 'tv',
      tmdbId: routerParams.value.movieTvId,
      path: routerParams.value.path,
    })
    if (nowTv?.endTime) {
      const minutes = String(Math.floor(nowTv.endTime / 60)) // 取整分钟数
      const remainingSeconds = String(nowTv.endTime % 60) // 剩余秒数
      pickerVal.value = [minutes, remainingSeconds]
    } else {
      pickerVal.value = ['0', '0']
    }
    showPopover.value = false
    pickerTitle.value = item.text
    pickerAction.value = item.action
    let arr1 = []
    let arr2 = []
    for (let i = 0; i <= 180; i++) {
      arr1.push({ text: t('video.minuteValue', { value: i }), value: String(i) })
    }
    for (let i = 0; i <= 59; i++) {
      arr2.push({ text: t('video.secondValue', { value: i }), value: String(i) })
    }
    pickerColumns.value[0] = arr1
    pickerColumns.value[1] = arr2
    showTimePicker.value = true
  }
}

const confirmPicker = ({ selectedValue, selectedOptions }) => {
  let time = Number(selectedValue[0]) * 60 + Number(selectedValue[1])
  let localMovieTvData = getMovieTvData()
  let nowTv = findInView(localMovieTvData, {
    mediaType: 'tv',
    tmdbId: routerParams.value.movieTvId,
    path: routerParams.value.path,
  })
  // 查不到目标条目时不写库，只收起选择器
  if (!nowTv) {
    showTimePicker.value = false
    return
  }
  if (pickerAction.value == 'skipIntro') {
    nowTv.openingTime = time
  } else if (pickerAction.value == 'skipOutro') {
    nowTv.endTime = time
  }
  setMovieTvData(localMovieTvData)
  showTimePicker.value = false
}

const getSourceLabel = provider => {
  const mapping = {
    '189CloudPC': t('source.tianyiCloudDriveLabel'),
    Quark: t('source.quarkCloudDriveLabel'),
    WoPan: t('source.unicomCloudDrive'),
    Cloud139: t('source.cloud139Label'),
    unknown: t('common.unknown'),
  }
  return mapping[provider] || provider
}

const buildSourceName = (item, source) => {
  if (source.filter(v => v.provider == item.provider).length > 1) {
    return `${getSourceLabel(item.provider)}(${item.name})`
  }
  return getSourceLabel(item.provider)
}

const keyCodeClick = keyCode => {
  if (!operation_button.value) return //用于保证dom已加载完成
  let mapping = {
    'operationButton': operation_button.value,
    'cloudList': cloud_list.value,
    'seasonList': season_list.value,
    'tvList': tv_list.value,
    'actorList': actor_list.value,
  }
  mapping[focusModel.value].evtMove(keyCode)
}

//处理电视的详情和剧集等
const handleTv = async (seasonData1 = null) => {
  showRehandleButton.value = false
  let season = activeSeason.value.season
  // 首次进入时 localMovieTvData 尚未赋值，旧写法命中 `if (...tv)` 后
  // `.find(...)` 返回 undefined 再取 .season 会抛错。改走 helper 并判空。
  const hit = findInView(localMovieTvData.value, {
    mediaType: 'tv',
    tmdbId: routerParams.value.movieTvId,
    path: routerParams.value.path,
  })
  if (hit?.season) {
    season = hit.season
    season = season != '1' ? season : activeSeason.value.season
  } else {
    season = extractSeasonNumber(imgData.value.title)
    season = season != '1' ? season : activeSeason.value.season
  }
  let result = {}
  let videoFormat = ['mp4', 'mkv', 'm2ts', 'avi', 'mov', 'ts', 'm3u8', 'iso']
  if (selectType.value.type == 'WebDAV') {
    // imgData.value.releaseTime = res1.air_date;
    // imgData.value.runtime ? "" : (imgData.value.runtime = `共${res1?.episodes?.length || 0}集（库中有0集）`);
    try {
      result = await getFolder(
        {
          path: activeSeason.value.path,
        },
        selectMedia.value
      )
    } catch (error) {
      showRehandleButton.value = true
      return
    }
    result.data.content = result.data.content.filter(h => {
      return videoFormat.some(v => h.name.includes(v))
    })
    //对电视进行排序
    tvList.value = result.data.content.sort((a, b) => {
      const regex = /S\d{2}E\d{2}/
      const regex1 = /\d+/
      if (a.name.match(regex) && b.name.match(regex)) {
        let aName = a.name.match(regex)[0]
        let bName = b.name.match(regex)[0]
        const numA = parseInt(aName.slice(-2), 10)
        const numB = parseInt(bName.slice(-2), 10)
        a.ji = numA
        b.ji = numB
        return numA - numB
      } else if (a.name.match(regex1) && b.name.match(regex1)) {
        let aName = a.name.match(regex1)[0]
        let bName = b.name.match(regex1)[0]
        const numA = parseInt(aName.slice(-2), 10)
        const numB = parseInt(bName.slice(-2), 10)
        a.ji = numA
        b.ji = numB
        return numA - numB
      }
      return a - b
    })
    // imgData.value.runtime = `共${res1?.episodes?.length || 0}集（库中有${result?.data?.total || 0}集）`;
  } else if (selectType.value.type == '天翼云盘') {
    // imgData.value.releaseTime = res1.air_date;
    // imgData.value.runtime ? "" : (imgData.value.runtime = `共${res1?.episodes?.length || 0}集（库中有0集）`);
    try {
      result = await get189Folder(
        {
          folderId: activeSeason.value.folderFileId,
        },
        selectMedia.value
      )
    } catch (error) {
      showRehandleButton.value = true
      return
    }
    result.fileListAO.fileList = result.fileListAO.fileList.filter(h => {
      return videoFormat.some(v => h.name.includes(v))
    })
    //对电视进行排序
    tvList.value = result.fileListAO.fileList.sort((a, b) => {
      const regex = /S\d{2}E\d{2}/
      const regex1 = /\d+/
      if (a.name.match(regex) && b.name.match(regex)) {
        let aName = a.name.match(regex)[0]
        let bName = b.name.match(regex)[0]
        const numA = parseInt(aName.slice(-2), 10)
        const numB = parseInt(bName.slice(-2), 10)
        a.ji = numA
        b.ji = numB
        return numA - numB
      } else if (a.name.match(regex1) && b.name.match(regex1)) {
        let aName = a.name.match(regex1)[0]
        let bName = b.name.match(regex1)[0]
        const numA = parseInt(aName.slice(-2), 10)
        const numB = parseInt(bName.slice(-2), 10)
        a.ji = numA
        b.ji = numB
        return numA - numB
      }
      return a - b
    })
    // imgData.value.runtime = `共${res1?.episodes?.length || 0}集（库中有${result.fileListAO.count || 0}集）`;
  } else if (selectType.value.type == '夸克网盘') {
    // imgData.value.releaseTime = res1.air_date;
    // imgData.value.runtime ? "" : (imgData.value.runtime = `共${res1.episodes.length}集（库中有0集）`);
    try {
      result = await getQuarkFolder(
        {
          fid: activeSeason.value.folderFileId,
        },
        selectMedia.value
      )
    } catch (error) {
      showRehandleButton.value = true
      return
    }
    result.data.list = result.data.list.filter(h => {
      return videoFormat.some(v => h.file_name.includes(v))
    })
    //对电视进行排序
    tvList.value = result.data.list
      .sort((a, b) => {
        const regex = /S\d{2}E\d{2}/
        const regex1 = /\d+/
        if (a.file_name.match(regex)) {
          let aName = a.file_name.match(regex)[0]
          let bName = b.file_name.match(regex)[0]
          const numA = parseInt(aName.slice(-2), 10)
          const numB = parseInt(bName.slice(-2), 10)
          a.ji = numA
          b.ji = numB
          return numA - numB
        } else if (a.file_name.match(regex1)) {
          let aName = a.file_name.match(regex1)[0]
          let bName = b.file_name.match(regex1)[0]
          const numA = parseInt(aName.slice(-2), 10)
          const numB = parseInt(bName.slice(-2), 10)
          a.ji = numA
          b.ji = numB
          return numA - numB
        }
      })
      .map(i => {
        return {
          id: i.fid,
          name: i.file_name,
          ji: i.ji,
          // path: "/我的视频/电视剧",
          provider: 'Quark',
        }
      })

    // imgData.value.runtime = `共${res1.episodes.length}集（库中有${result.data.list?.length || 0}集）`;
  } else if (selectType.value.type == '移动云盘') {
    try {
      result = await get139Folder(
        {
          folderId: activeSeason.value.folderFileId,
        },
        selectMedia.value
      )
    } catch (error) {
      showRehandleButton.value = true
      return
    }
    result.fileListAO.fileList = result.fileListAO.fileList.filter(h => {
      return videoFormat.some(v => h.name.includes(v))
    })
    //对电视进行排序
    tvList.value = result.fileListAO.fileList
      .sort((a, b) => {
        const regex = /S\d{2}E\d{2}/
        const regex1 = /\d+/
        if (a.name.match(regex) && b.name.match(regex)) {
          let aName = a.name.match(regex)[0]
          let bName = b.name.match(regex)[0]
          const numA = parseInt(aName.slice(-2), 10)
          const numB = parseInt(bName.slice(-2), 10)
          a.ji = numA
          b.ji = numB
          return numA - numB
        } else if (a.name.match(regex1) && b.name.match(regex1)) {
          let aName = a.name.match(regex1)[0]
          let bName = b.name.match(regex1)[0]
          const numA = parseInt(aName.slice(-2), 10)
          const numB = parseInt(bName.slice(-2), 10)
          a.ji = numA
          b.ji = numB
          return numA - numB
        }
        return a - b
      })
      .map(i => {
        return {
          id: i.id,
          name: i.name,
          ji: i.ji,
          provider: 'Cloud139',
        }
      })
  }
  let res1 = {}
  if (!seasonData1) {
    if (routerParams.value.movieTvId) {
      // 季数据同样可能失败（断网/无效 id），失败时留空继续，不要让整页崩
      try {
        res1 = await getTvSeason({ movieTvId: routerParams.value.movieTvId, season: season })
      } catch (e) {
        console.warn('[tv/video-detail] 获取季数据失败:', e?.message)
        res1 = {}
      }
      if (!res1 || res1.status_code) res1 = {}
    }
  } else {
    res1 = seasonData1
  }
  imgData.value.releaseTime = res1.air_date
  imgData.value.runtime = t('video.totalEpisodesInLibrary', { total: res1?.episodes?.length || 0, count: tvList.value?.length || 0 })
  if (season != '1') {
    imgData.value.img = CONFIG.IMG_DOMAIN + '/t/p/w1920_and_h1080_bestv2' + res1.poster_path
    overview.value = res1.overview
  } else {
    imgData.value.img = seasonFirst.value.img
    overview.value = seasonFirst.value.overview
  }
  let seasonData = {
    _id: res1._id,
    air_date: res1.air_date,
    name: res1.name,
    overview: res1.overview,
    id: res1.id,
    poster_path: res1.poster_path,
    season_number: res1.season_number,
    vote_average: res1.vote_average,
  }
  uni.setStorageSync('seasonData', seasonData)
  if (season != '1' && res1.overview) overview.value = res1.overview
  //处理现有的集数，将tmdb的封面，时长都设置进去，还有每一集的标题
  tvList.value.forEach((v, vindex) => {
    if (res1.episodes) {
      v.title = res1.episodes[vindex]?.name || t('video.noTitle')
      v.poster = res1.episodes[vindex]?.still_path ? CONFIG.IMG_DOMAIN + '/t/p/w533_and_h300_bestv2' + res1.episodes[vindex]?.still_path : imgData.value.img
      v.runtime = res1.episodes[vindex]?.runtime ? calTime(res1.episodes[vindex]?.runtime, 'en') : '00:00'
      v.overview = res1.episodes[vindex]?.overview || t('video.noIntroduction')
    } else {
      v.title = t('video.episodeTitle', { episode: vindex + 1 })
    }
  })
  nextTick(() => {
    if (historyTv.value.name) scrollIntoView.value = 'name' + historyTv.value.ji
  })
}

const getMovieTvDetail = async () => {
  if (!routerParams.value.movieTvId) {
    imgData.value.title = routerParams.value.name
    detailLoading.value = false
    return false
  }
  if (routerParams.value.type == 'tv') {
    if (activeSeason.value.season != '1') {
      imgData.value.title = routerParams.value.name + ' ' + activeSeason.value.name
    } else {
      imgData.value.title = routerParams.value.name
    }
  }
  // TMDB 失败不抛异常而是返回错误体，且断网会抛，两种都要兜住。
  // 兜不住的话 res.vote_average.toFixed 会直接崩掉整个详情页。
  let res
  try {
    res = await getMovieTvById(
      {
        movieTvId: routerParams.value.movieTvId,
      },
      routerParams.value.type
    )
  } catch (e) {
    console.warn('[tv/video-detail] 获取 TMDB 详情失败:', e?.message)
    detailLoading.value = false
    return false
  }
  if (!res || res.status_code || !res.id) {
    console.warn('[tv/video-detail] TMDB 详情无效:', res?.status_message || res)
    detailLoading.value = false
    return false
  }
  detailLoading.value = false
  overview.value = res.overview
  if (routerParams.value.type == 'movie') {
    imgData.value = {
      img: CONFIG.IMG_DOMAIN + '/t/p/w1920_and_h1080_bestv2' + res.backdrop_path,
      score: res.vote_average.toFixed(1),
      releaseTime: res.release_date,
      runtime: calTime(res.runtime),
      runtimeEn: calTime(res.runtime, 'en'),
      genres: res.genres.map(i => i.name).join(' '),
      title: res.title,
    }
  } else if (routerParams.value.type == 'tv') {
    seasonFirst.value.img = imgData.value.img = CONFIG.IMG_DOMAIN + '/t/p/w1920_and_h1080_bestv2' + res.backdrop_path
    seasonFirst.value.overview = res.overview
    imgData.value.score = res.vote_average.toFixed(1)
    imgData.value.genres = res.genres.map(i => i.name).join(' ')
    imgData.value.releaseTime = res.first_air_date
    imgData.value.runtime = t('video.totalEpisodesInLibrary', { total: res.number_of_episodes || 0, count: 0 })
  }
  return res
}

//切换电影视频源
const changeSource = item => {
  selectSource.value = item
  setButtonText()
}

//切换电视视频源
const changeTvSource = async obj => {
  selectSource.value = sourceList.value.find(i => i.provider + i.name == obj.provider + obj.name)
  let obj1 = selectSource.value.seasonArr.find(i => i.season == historyTv.value.season)
  if (obj1) {
    activeSeason.value = { ...obj1 }
  } else {
    activeSeason.value = { ...selectSource.value.seasonArr[0] }
  }
  setButtonText()
  await handleTv()
  nextTick(() => {
    scrollIntoView.value = historyTv.value.name ? 'name' + historyTv.value.ji : 'name1'
  })
}

//切换不同季
const changeTvSeason = async obj => {
  activeSeason.value = { ...selectSource.value.seasonArr.find(i => i.season == obj.paneKey) }
  if (activeSeason.value.season != '1') {
    imgData.value.title = routerParams.value.name + ' ' + activeSeason.value.name
  } else {
    imgData.value.title = routerParams.value.name
  }
  setButtonText()
  await handleTv()
  nextTick(() => {
    scrollIntoView.value = historyTv.value.name ? 'name' + historyTv.value.ji : 'name1'
  })
}

//电视集数还在加载中，点击提示
const disabledTip = () => {
  uni.showToast({
    title: t('video.waitLoadComplete'),
    icon: 'none',
  })
}

//点击播放按钮
const clickPlayButton = () => {
  if (routerParams.value.type == 'movie') {
    const lastIndex = routerParams.value.path.lastIndexOf('/')
    let name = routerParams.value.path.substring(lastIndex + 1)
    let history = historyPlay.value?.find(i => i.name == name)
    if (history && selectSource.value.path == '/' + history.path) {
      if (selectType.value.type == 'WebDAV') {
        uni.navigateTo({
          url: `/pages/tv/video/video-player?path=${selectSource.value.path.slice(1)}&type=movie`,
        })
      } else {
        uni.navigateTo({
          url: `/pages/tv/video/video-player?path=${selectSource.value.path.slice(1)}&folderFileId=${selectSource.value.folderFileId}&type=movie`,
        })
      }
    } else {
      let historyItem = {
        path: `${selectSource.value.path.slice(1)}`,
        poster: imgData.value.img,
        type: 'movie',
        name: selectSource.value.name,
        runtime: imgData.value.runtimeEn,
        title: selectSource.value.name,
        initialTime: '0',
        movieTvId: routerParams.value.movieTvId,
        sourceType: selectType.value.type, //这个播放记录归属于哪个类型，比如webdav，天翼云盘，夸克网盘
        sourceName: selectMedia.value.name, //这个播放记录再具体到某个类型下的哪一个
      }
      const historyArr = uni.getStorageSync('historyPlay') || []
      if (selectType.value.type != 'WebDAV') {
        historyItem.folderFileId = selectSource.value.folderFileId
      }
      uni.setStorageSync('historyPlay', [historyItem, ...historyArr])
      if (selectType.value.type == 'WebDAV') {
        uni.navigateTo({
          url: `/pages/tv/video/video-player?path=${selectSource.value.path.slice(1)}&type=movie`,
        })
      } else {
        uni.navigateTo({
          url: `/pages/tv/video/video-player?path=${selectSource.value.path.slice(1)}&folderFileId=${selectSource.value.folderFileId}&type=movie`,
        })
      }
    }
  } else if (routerParams.value.type == 'tv') {
    if (!tvList.value.length) {
      uni.showToast({
        title: t('video.pleaseCheckCloudOrWebdav'),
        icon: 'none',
      })
      return
    }
    uni.setStorageSync('tvList', tvList.value)
    let localMovieTvData = getMovieTvData()
    // 初值为 {} 而非 undefined：后续 `nowTv.openingTime >= 0` 直接取属性，
    // .find 未命中时若是 undefined 会抛错。空对象上取属性得到 undefined，
    // 与 `>= 0` 比较为 false，语义正确。
    let nowTv = findInView(localMovieTvData, {
      mediaType: 'tv',
      tmdbId: routerParams.value.movieTvId,
      path: routerParams.value.path,
    }) || {}
    let history = historyPlay.value?.find(i => i.titlePlay == imgData.value.title)
    if (history && activeSeason.value.path + '/' + history.name == '/' + history.path) {
      let openEndTime = {}
      if (!routerParams.value.movieTvId) openEndTime.noSetHistory = 0
      if (nowTv.openingTime >= 0) openEndTime.openingTime = nowTv.openingTime
      if (nowTv.endTime >= 0) openEndTime.endTime = nowTv.endTime
      const queryStr = toStringfy(openEndTime) ? '&' + toStringfy(openEndTime) : ''
      if (selectType.value.type == 'WebDAV') {
        uni.navigateTo({
          url: `/pages/tv/video/video-player?path=${activeSeason.value.path.slice(1)}/${history.name}&type=tv`,
        })
      } else {
        uni.navigateTo({
          url: `/pages/tv/video/video-player?path=${activeSeason.value.path.slice(1)}/${history.name}&wjjId=${activeSeason.value.folderFileId}&folderFileId=${
            history.folderFileId
          }&type=tv${queryStr}`,
        })
      }
    } else {
      let historyItem = {
        path: `${activeSeason.value.path.slice(1)}/${tvList.value[0].name}`,
        titlePlay: imgData.value.title,
        ji: '1',
        poster: tvList.value[0].poster || imgData.value.img,
        type: 'tv',
        name: tvList.value[0].name,
        runtime: tvList.value[0].runtime,
        title: tvList.value[0].title,
        initialTime: '0',
        movieTvId: routerParams.value.movieTvId,
        season: activeSeason.value.season,
        sourceType: selectType.value.type, //这个播放记录归属于哪个类型，比如webdav，天翼云盘，夸克网盘
        sourceName: selectMedia.value.name, //这个播放记录再具体到某个类型下的哪一个
      }
      const historyArr = uni.getStorageSync('historyPlay') || []
      if (selectType.value.type != 'WebDAV') {
        historyItem.folderFileId = tvList.value[0].id
      }
      uni.setStorageSync('historyPlay', [historyItem, ...historyArr])
      let openEndTime = {}
      if (!routerParams.value.movieTvId) openEndTime.noSetHistory = 0
      if (nowTv.openingTime >= 0) openEndTime.openingTime = nowTv.openingTime
      if (nowTv.endTime >= 0) openEndTime.endTime = nowTv.endTime
      const queryStr = toStringfy(openEndTime) ? '&' + toStringfy(openEndTime) : ''
      if (selectType.value.type == 'WebDAV') {
        uni.navigateTo({
          url: `/pages/tv/video/video-player?path=${activeSeason.value.path.slice(1)}/${tvList.value[0].name}&type=tv${queryStr}`,
        })
      } else {
        uni.navigateTo({
          url: `/pages/tv/video/video-player?path=${activeSeason.value.path.slice(1)}/${tvList.value[0].name}&wjjId=${activeSeason.value.folderFileId}&folderFileId=${
            tvList.value[0].id
          }&type=tv${queryStr}`,
        })
      }
    }
  }
}

//播放电视
const toPlayVideo = (item, index) => {
  uni.setStorageSync('tvList', tvList.value)
  let localMovieTvData = getMovieTvData()
  let nowTv = findInView(localMovieTvData, {
    mediaType: 'tv',
    tmdbId: routerParams.value.movieTvId,
    path: routerParams.value.path,
  }) || {}
  let history = historyPlay.value?.find(
    i =>
      i.titlePlay == handleSeasonName(selectSource.value.name + (activeSeason.value.name == '第一季' ? '' : ' ' + activeSeason.value.name), true) && item.name == i.name
  )
  if (history && activeSeason.value.path + '/' + history.name == '/' + history.path && activeSeason.value.season == history.season) {
    //存在历史记录，同一路径的片源，同一季
    let openEndTime = {}
    if (!routerParams.value.movieTvId) openEndTime.noSetHistory = 0
    if (nowTv.openingTime >= 0) openEndTime.openingTime = nowTv.openingTime
    if (nowTv.endTime >= 0) openEndTime.endTime = nowTv.endTime
    const queryStr = toStringfy(openEndTime) ? '&' + toStringfy(openEndTime) : ''
    if (selectType.value.type == 'WebDAV') {
      uni.navigateTo({
        url: `/pages/tv/video/video-player?path=${activeSeason.value.path.slice(1)}/${item.name}&type=tv${queryStr}`,
      })
    } else {
      uni.navigateTo({
        url: `/pages/tv/video/video-player?path=${activeSeason.value.path.slice(1)}/${item.name}&wjjId=${activeSeason.value.folderFileId}&folderFileId=${
          item.id
        }&type=tv${queryStr}`,
      })
    }
  } else {
    let historyItem = {
      path: `${activeSeason.value.path.slice(1)}/${item.name}`,
      titlePlay: imgData.value.title,
      ji: String(index + 1),
      poster: item.poster || imgData.value.img,
      type: 'tv',
      name: item.name,
      runtime: item.runtime,
      title: item.title,
      initialTime: '0',
      movieTvId: routerParams.value.movieTvId,
      season: activeSeason.value.season,
      sourceType: selectType.value.type, //这个播放记录归属于哪个类型，比如webdav，天翼云盘，夸克网盘
      sourceName: selectMedia.value.name, //这个播放记录再具体到某个类型下的哪一个
    }
    const historyArr = uni.getStorageSync('historyPlay') || []
    if (selectType.value.type != 'WebDAV') {
      historyItem.folderFileId = item.id
    }
    uni.setStorageSync('historyPlay', [historyItem, ...historyArr])

    let openEndTime = {}
    if (!routerParams.value.movieTvId) openEndTime.noSetHistory = 0
    if (nowTv.openingTime >= 0) openEndTime.openingTime = nowTv.openingTime
    if (nowTv.endTime >= 0) openEndTime.endTime = nowTv.endTime
    const queryStr = toStringfy(openEndTime) ? '&' + toStringfy(openEndTime) : ''
    if (selectType.value.type == 'WebDAV') {
      uni.navigateTo({
        url: `/pages/tv/video/video-player?path=${activeSeason.value.path.slice(1)}/${item.name}&type=tv`,
      })
    } else {
      uni.navigateTo({
        url: `/pages/tv/video/video-player?path=${activeSeason.value.path.slice(1)}/${item.name}&wjjId=${activeSeason.value.folderFileId}&folderFileId=${
          item.id
        }&type=tv${queryStr}`,
      })
    }
  }
}

//设置按钮文字
const setButtonText = () => {
  historyPlay.value = uni.getStorageSync('historyPlay') || []
  historyPlay.value = historyPlay.value.filter(v => v.sourceType == selectType.value.type && v.sourceName == selectMedia.value.name)
  if (routerParams.value.type == 'movie') {
    let history = historyPlay.value?.find(i => handleSeasonName(i.name, true) == handleSeasonName(selectSource.value.name, true))
    if (history && selectSource.value.path == '/' + history.path) {
      buttonText.value = t('video.playWithTime', { time: handleSecond(history.initialTime) })
    } else {
      buttonText.value = t('video.play')
    }
  } else if (routerParams.value.type == 'tv') {
    let history = historyPlay.value?.find(i => {
      if (activeSeason.value.season == '1') {
        return i.titlePlay == handleSeasonName(selectSource.value.name, true)
      } else {
        return i.titlePlay == handleSeasonName(selectSource.value.name, true) + ' ' + activeSeason.value.name
      }
    })
    historyTv.value = history || {}
    if (history && activeSeason.value.path + '/' + history.name == '/' + history.path && history.season == activeSeason.value.season) {
      let time = handleSecond(history.initialTime)
      buttonText.value = t('video.episodeRecordWithTitle', { episode: history.ji, time, title: history.title })
    } else {
      buttonText.value = t('video.noPlayedRecords')
    }
  }
}

//判断选择的是webdav还是天翼云盘还是夸克
const judgeSelect = () => {
  nowSourceList.value = uni.getStorageSync('sourceList')
  selectType.value = nowSourceList.value.find(item => {
    let select = findActiveSource(item.list)
    if (select) {
      selectMedia.value = select
      return true
    } else {
      return false
    }
  })
}

//重新加载电视剧集数
const reHandleTv = async () => {
  if (selectType.value.type == 'WebDAV') {
    let res1 = await loginUser(selectMedia.value)
    selectMedia.value.token = res1.data.token
    uni.setStorageSync('sourceList', nowSourceList.value)
    handleTv()
  } else {
    uni.showToast({
      title: t('video.pleaseReloginCloudDrive'),
      icon: 'none',
    })
  }
}

//重新设置影片信息
const resetMovieTvData = async () => {
  let resetMovieTv = uni.getStorageSync('resetMovieTv')
  if (resetMovieTv) {
    judgeSelect()
    let oldMovieTvId = routerParams.value.movieTvId
    // let oldName = imgData.value.title;
    let oldPath = routerParams.value.path
    routerParams.value.type = resetMovieTv.type
    routerParams.value.movieTvId = resetMovieTv.movieTvId
    routerParams.value.name = resetMovieTv.name
    uni.removeStorageSync('resetMovieTv')
    selectSource.value = sourceList.value[0]
    activeSeason.value = { ...selectSource.value.seasonArr[0] }
    setButtonText()
    nextTick(() => {
      if (historyTv.value.name) scrollIntoView.value = 'name' + historyTv.value.ji
    })
    historyPlay.value = historyPlay.value.filter(i => i.titlePlay != imgData.value.title)
    let historyArr = uni.getStorageSync('historyPlay') || []
    historyArr = historyArr.filter(v => v.sourceType != selectType.value.type || v.sourceName != selectMedia.value.name)
    uni.setStorageSync('historyPlay', [...historyArr, ...historyPlay.value])
    selectSource.value.name = resetMovieTv.name
    localMovieTvData.value = getMovieTvData() || {}

    if (resetMovieTv.type == 'tv') {
      let nowTv = localMovieTvData.value.tv.find(i => i.movieTvId == oldMovieTvId && i.path == oldPath)
      let selectSource1 = nowTv.source.find(i => i.path == selectSource.value.path)
      selectSource1.name = resetMovieTv.name
      nowTv.season = extractSeasonNumber(selectSource.value.name)
      nowTv.movieTvId = routerParams.value.movieTvId
      let res = await getMovieTvDetail()
      nowTv.type = '1'
      nowTv.genre_ids = res.genres.map(i => i.id)
      nowTv.backdrop = res.backdrop_path
      nowTv.voteAverage = res.vote_average //评分
      nowTv.name = resetMovieTv.name
      let res1 = await getTvSeason({ movieTvId: routerParams.value.movieTvId, season: nowTv.season })
      handleTv(res1)
      nowTv.poster = res1.poster_path
      nowTv.releaseTime = res1.air_date
      nowTv.overview = res1.overview
    } else if (resetMovieTv.type == 'movie') {
      // oldMovieTvId 是纠正前的 id，可能属于 tv 空间。只在 movie 列表裸比数字
      // 会命中无关电影并整条覆盖。用 path（纠正前后不变）精确定位，查不到跳过。
      let nowMovie = findInView(localMovieTvData.value, {
        mediaType: 'movie',
        tmdbId: oldMovieTvId,
        path: oldPath,
      })
      if (nowMovie) {
        let res = await getMovieTvDetail()
        nowMovie.poster = CONFIG.IMG_DOMAIN + '/t/p/w300_and_h450_bestv2' + res.poster_path
        nowMovie.releaseTime = res.release_date
        nowMovie.type = '2'
        nowMovie.movieTvId = res.id
        nowMovie.genre_ids = res.genres.map(i => i.id)
        nowMovie.name = res.title
      }
    }
    imgData.value.title = resetMovieTv.name
    setMovieTvData(localMovieTvData.value)
    actor_list.value.getActorList()
  }
}

const setItemWidth = () => {
  let sysinfo = uni.getSystemInfoSync() // 获取设备系统对象
  let windowWidth = sysinfo.windowWidth
  if (windowWidth > 700) {
    lineNumber.value = Math.floor((windowWidth - 24) / 169.5)
    let remain = windowWidth - 24 - lineNumber.value * 169.5
    if (remain < (lineNumber.value - 1) * 10) {
      lineNumber.value--
    }
  }
  const scale = uni.upx2px(100) / 100 // 获取1rpx对应的px比例
  lineHeight.value = (((windowWidth - uni.upx2px(24 * lineNumber.value + 24)) / lineNumber.value) * 170) / 339 / scale + 'rpx'
}
setItemWidth()

//打开右侧弹窗
const openPopup = val => {
  // 「更多」没有对应的右侧面板组件，它的语义是「手动修正匹配」——
  // 直接进搜索匹配页。带 workKey 走新库改写，带 query 预填片名直接搜。
  if (val === 'more') {
    showRightPopup.value = false
    const maxSeasonArrLength = Math.max(...sourceList.value.map(v => (v.seasonArr || []).length))
    const query = encodeURIComponent(imgData.value.title || routerParams.value.name || '')
    uni.navigateTo({
      url: `/pages/tv/video/search-match?type=${routerParams.value.type}&maxSeasonLength=${maxSeasonArrLength}&workKey=${encodeURIComponent(routerParams.value.workKey || '')}&query=${query}`,
    })
    return
  }
  showRightPopup.value = true
  focusModel.value = val
}

//回到左侧按钮
const backLeft = () => {
  showRightPopup.value = false
  focusModel.value = 'operationButton'
}

onBeforeMount(async () => {
  judgeSelect()
  // historyPlay.value = uni.getStorageSync('historyPlay') || []
  historyPlay.value = historyPlay.value.filter(v => v.sourceType == selectType.value.type && v.sourceName == selectMedia.value.name)
  let source = JSON.parse(routerParams.value.source)
  sourceList.value = source.map(i => {
    i.sourceName = buildSourceName(i, source)
    return i
  })
  selectSource.value = sourceList.value[0]
  historyTv.value =
    historyPlay.value?.find(i => {
      if (i.season == '1') {
        let sameSource = sourceList.value.find(v => handleSeasonName(v.name, true) == i.titlePlay && v.seasonArr.find(h => h.path + '/' + i.name == '/' + i.path))
        if (sameSource) {
          selectSource.value = sameSource
          return true
        } else {
          selectSource.value = sourceList.value[0]
          return false
        }
      } else {
        const chineseNumber = generateChineseNumberMapping(40, 'number')
        let sameSource = sourceList.value.find(
          v => i.titlePlay == handleSeasonName(v.name, true) + ` 第${chineseNumber[i.season]}季` && v.seasonArr.find(h => h.path + '/' + i.name == '/' + i.path)
        )
        if (sameSource) {
          selectSource.value = sameSource
          return true
        } else {
          selectSource.value = sourceList.value[0]
          return false
        }
      }
    }) || {}
  let obj1 = selectSource.value.seasonArr.find(i => i.season == historyTv.value.season)
  if (obj1) {
    activeSeason.value = { ...obj1 }
  } else {
    activeSeason.value = { ...selectSource.value.seasonArr[0] }
  }
  setButtonText()
  getMovieTvDetail()
  if (routerParams.value.type == 'tv') {
    await handleTv()
  }
  nextTick(() => {
    if (historyTv.value.name) scrollIntoView.value = 'name' + historyTv.value.ji
  })
})

onShow(() => {
  setTimeout(() => {
    setButtonText()
    if (!firstEnter.value) {
      nextTick(() => {
        if (historyTv.value.name) scrollIntoView.value = 'name' + historyTv.value.ji
      })
    }
    firstEnter.value = false
  }, 800) //为什么加延迟，因为上一个页面setStorageSync的时候，不加延迟返回这个页面获取不到最新的storage
  //重新设置影片信息
  resetMovieTvData()
})

onLoad(options => {
  routerParams.value = options
  if (options.movieTvId == 'undefined') {
    routerParams.value.movieTvId = undefined
  }
  if (routerParams.value.type == 'movie') {
    popoverArr.value = [{ icon: editIcon, text: t('video.manualEdit'), action: 'manualEdit' }]
  } else if (routerParams.value.type == 'tv') {
    popoverArr.value = [
      { icon: editIcon, text: t('video.manualEdit'), action: 'manualEdit' },
      { icon: downloadIcon, text: t('video.download'), action: 'download' },
      { icon: timeIcon, text: t('video.skipIntroTime'), action: 'skipIntro' },
      { icon: timeIcon, text: t('video.skipOutroTime'), action: 'skipOutro' },
    ]
  }
})
</script>

<style lang="scss" scoped>
page {
  width: 100%;
  height: 100%;
}

.video-detail {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  position: relative;
  display: flex;
  align-items: center;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.55);
    z-index: 1;
    /* 半透明黑色遮罩，保证背景原图上的信息可读 */
  }

  .video-detail-left {
    position: relative;
    z-index: 2;
    flex: 0 0 45%;
    height: 100%;
    padding: 30rpx 80rpx 30rpx 80rpx;
    box-sizing: border-box;
    background: linear-gradient(to right, black 0%, rgba(0, 0, 0, 0.7) 80%, rgba(0, 0, 0, 0) 100%);
    transition: background var(--app-duration-slow) var(--app-ease);
    display: flex;
    flex-direction: column;

    .left-title {
      color: var(--content-text, #fff);
      font-size: 70rpx;
    }

    .left-info {
      display: flex;
      align-items: center;
      padding-top: 20rpx;

      .left-info-date {
        display: flex;
        align-items: center;

        .iconfont {
          font-size: 30rpx;
        }

        span {
          font-size: 28rpx;
          color: var(--content-text-secondary, #fff);
          padding-left: 10rpx;
        }
      }

      .left-info-score {
        display: flex;
        align-items: center;
        padding-left: 14rpx;

        .iconfont {
          font-size: 30rpx;
        }

        span {
          font-size: 28rpx;
          color: var(--content-text-secondary, #fff);
          padding-left: 10rpx;
        }
      }

      .left-info-runtime {
        color: var(--content-text-secondary, #fff);
        padding: 0 14rpx;
      }
    }

    .left-genres {
      padding-top: 20rpx;
      color: var(--content-text, #fff);
      font-size: 32rpx;
    }

    .left-overview {
      margin-top: 20rpx;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
      text-overflow: ellipsis;
      color: var(--content-text-tertiary, #c2c5c6);
    }
  }

  .video-detail-right {
    flex: 1;
    height: 100%;
    position: relative;

    ::v-deep .nut-popup {
      width: 100%;
      height: 100%;
      position: absolute;
      background: transparent !important;
      padding: 40rpx;
    }
  }
}
</style>
