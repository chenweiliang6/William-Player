import { computed, onBeforeMount, ref, nextTick, watch } from 'vue'
import { loginUser, getFolder, get189Folder, getQuarkFolder, getTvSeason, getMovieTvById } from '@/utils/common'
import { parseTime, calTime, handleSecond, handleSeasonName, extractSeasonNumber, generateChineseNumberMapping } from '@/utils/scrape'
import { onShow, onLoad, onUnload } from '@dcloudio/uni-app'
import editIcon from '@/static/edit_icon.png'
import timeIcon from '@/static/time_icon.png'
import downloadIcon from '@/static/download-icon.png'
import { toStringfy } from '@/pages/mobile/mine/common'
import { useSourceSelect } from '@/hooks/useSourceSelect'
import { useHistoryStore } from '@/stores/historyPlay'
import * as CONFIG from '@/utils/config'
import { ipc } from '@/utils/ipcRenderer'
import { ipcApiRoute } from '@/utils/ipcApiRoute'
import { queryAll, createDownload } from '@/utils/download'
import { useI18n } from 'vue-i18n'
import { useLocaleStore } from '@/stores/locale'

// 过滤掉同一部内容的旧历史记录
export function useVideoDetail({ route, router }) {
  const { t } = useI18n()
  const localeStore = useLocaleStore()
  const historyStore = useHistoryStore()
  let onShowTimer = null //返回本页时同步按钮状态的延迟任务，页面卸载时需清理
  const showPopover = ref(false)
  const getPopoverArr = () => {
    const list = [
      { icon: editIcon, key: 'manualEdit', text: t('video.manualEdit') },
      { icon: downloadIcon, key: 'downloadCenter', text: t('navbar.downloadCenter') },
    ]
    if (routerParams.value.type === 'tv') {
      list.push({ icon: timeIcon, key: 'skipIntro', text: t('video.skipIntroTime') }, { icon: timeIcon, key: 'skipOutro', text: t('video.skipOutroTime') })
    }
    return list
  }
  const popoverArr = computed(getPopoverArr)

  const showTimePicker = ref(false)
  const pickerTitle = ref('')
  const pickerType = ref('')
  const pickerVal = ref(['0', '0'])
  const pickerColumns = ref([[], []])

  const imgData = ref({}) //图片内的信息
  const overview = ref('') //剧情简介

  const sourceList = ref([])
  const selectSource = ref({}) //切换选中的来源

  const actor_list = ref(null)

  const activeSeason = ref({})
  const seasonFirst = ref({})

  const tvList = ref([]) //目前网盘所拥有的电视集数列表

  const historyPlay = ref(uni.getStorageSync('historyPlay') || []) //历史播放
  const buttonTextKey = ref('video.play')
  const buttonTextParams = ref({})
  const buttonText = computed(() => t(buttonTextKey.value, buttonTextParams.value))
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

  const toSelect = item => {
    if (item.key == 'manualEdit') {
      showPopover.value = false
      //获取当前源里面的最大季数
      const maxSeasonArrLength = Math.max(...sourceList.value.map(v => v.seasonArr.length))
      uni.navigateTo({
        url: `/pages/mobile/video/search-match?type=${routerParams.value.type}&maxSeasonLength=${maxSeasonArrLength}`,
      })
    } else if (item.key == 'skipIntro') {
      let localMovieTvData = uni.getStorageSync('localMovieTvData')
      let nowTv = localMovieTvData.tv.find(i => i.movieTvId == routerParams.value.movieTvId)
      if (nowTv.openingTime) {
        const minutes = String(Math.floor(nowTv.openingTime / 60)) // 取整分钟数
        const remainingSeconds = String(nowTv.openingTime % 60) // 剩余秒数
        pickerVal.value = [minutes, remainingSeconds]
      } else {
        pickerVal.value = ['0', '0']
      }
      showPopover.value = false
      pickerTitle.value = item.text
      pickerType.value = item.key
      let arr1 = []
      let arr2 = []
      for (let i = 0; i <= 15; i++) {
        arr1.push({ text: String(i) + t('video.minute'), value: String(i) })
      }
      for (let i = 0; i <= 59; i++) {
        arr2.push({ text: String(i) + t('video.second'), value: String(i) })
      }
      pickerColumns.value[0] = arr1
      pickerColumns.value[1] = arr2
      showTimePicker.value = true
    } else if (item.key == 'skipOutro') {
      let localMovieTvData = uni.getStorageSync('localMovieTvData')
      let nowTv = localMovieTvData.tv.find(i => i.movieTvId == routerParams.value.movieTvId)
      if (nowTv.endTime) {
        const minutes = String(Math.floor(nowTv.endTime / 60)) // 取整分钟数
        const remainingSeconds = String(nowTv.endTime % 60) // 剩余秒数
        pickerVal.value = [minutes, remainingSeconds]
      } else {
        pickerVal.value = ['0', '0']
      }
      showPopover.value = false
      pickerTitle.value = item.text
      pickerType.value = item.key
      let arr1 = []
      let arr2 = []
      for (let i = 0; i <= 180; i++) {
        arr1.push({ text: String(i) + t('video.minute'), value: String(i) })
      }
      for (let i = 0; i <= 59; i++) {
        arr2.push({ text: String(i) + t('video.second'), value: String(i) })
      }
      pickerColumns.value[0] = arr1
      pickerColumns.value[1] = arr2
      showTimePicker.value = true
    } else if (item.key == 'downloadCenter') {
      uni.navigateTo({
        url: '/pages/mobile/toolbox/download/index',
      })
    }
  }

  const confirmPicker = ({ selectedValue, selectedOptions }) => {
    let time = Number(selectedValue[0]) * 60 + Number(selectedValue[1])
    let localMovieTvData = uni.getStorageSync('localMovieTvData')
    let nowTv = localMovieTvData.tv.find(i => i.movieTvId == routerParams.value.movieTvId)
    if (pickerType.value == 'skipIntro') {
      nowTv.openingTime = time
    } else if (pickerType.value == 'skipOutro') {
      nowTv.endTime = time
    }
    uni.setStorageSync('localMovieTvData', localMovieTvData)
    showTimePicker.value = false
  }

  const getValue = (data, prop) => {
    return prop.split('.').reduce((obj, key) => obj?.[key], data)
  }

  const getSourceLabel = provider => {
    const mapping = {
      '189CloudPC': t('source.tianyiCloudDriveLabel'),
      Quark: t('source.quarkCloudDriveLabel'),
      WoPan: t('source.unicomCloudDrive'),
      unknown: t('common.unknown'),
    }
    return mapping[provider] || provider
  }

  //从对象或者名称中提取第几季
  const determineSeason = () => {
    let season = ''
    season = activeSeason.value.season
    if (localMovieTvData.value.tv) {
      season = localMovieTvData.value.tv.find(i => i.movieTvId == routerParams.value.movieTvId).season
      season = season != '1' ? season : activeSeason.value.season
    } else {
      season = extractSeasonNumber(imgData.value.title)
      season = season != '1' ? season : activeSeason.value.season
    }
    return season
  }

  //处理tvList，将获取到的季数据写入到这个数组中
  const processTvlist = res => {
    if (tvList.value?.length) {
      tvList.value.forEach((v, vindex) => {
        let jiIndex = +v.ji - 1
        if (res.episodes) {
          v.title = res.episodes[jiIndex]?.name || t('video.noTitle')
          v.poster = res.episodes[jiIndex]?.still_path ? CONFIG.IMG_DOMAIN + '/t/p/w533_and_h300_bestv2' + res.episodes[jiIndex]?.still_path : imgData.value.img
          v.runtime = res.episodes[jiIndex]?.runtime ? calTime(res.episodes[jiIndex]?.runtime, 'en') : '00:00'
          v.runtimeOrg = res.episodes[jiIndex]?.runtime || 0
          v.vote_average = res.episodes[jiIndex]?.vote_average || res.vote_average
          v.overview = res.episodes[jiIndex]?.overview || res.overview
        } else {
          v.title = t('video.episodeTitle', { episode: jiIndex + 1 })
          // v.vote_average = res.vote_average
        }
      })
    }
  }

  //获取季数据，并且将季数据的结果赋值给一些参数
  const getSeasonData = async (seasonData1 = null, season) => {
    let res1 = {}
    if (!seasonData1) {
      if (routerParams.value.movieTvId) {
        res1 = await getTvSeason({ movieTvId: routerParams.value.movieTvId, season: season })
        processTvlist(res1)
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
    return res1
  }

  //处理webdav、天翼云盘、夸克网盘的剧集列表获取
  const getTvlist = async type => {
    let result = {}
    let videoFormat = ['mp4', 'mkv', 'm2ts', 'avi', 'mov', 'ts', 'm3u8', 'iso']
    const apiMapping = {
      WebDAV: {
        apiFunction: getFolder,
        params: { path: activeSeason.value.path },
        prop: 'data.content',
        name: 'name',
      },
      '天翼云盘': {
        apiFunction: get189Folder,
        params: { folderId: activeSeason.value.folderFileId },
        prop: 'fileListAO.fileList',
        name: 'name',
      },
      '夸克网盘': {
        apiFunction: getQuarkFolder,
        params: { fid: activeSeason.value.folderFileId },
        prop: 'data.list',
        name: 'file_name',
      },
    }
    try {
      result = await apiMapping[type].apiFunction(apiMapping[type].params, selectMedia.value)
    } catch (error) {
      showRehandleButton.value = true
      return
    }
    let arr = getValue(result, apiMapping[type].prop).filter(h => {
      h.name = h[apiMapping[type].name]
      return videoFormat.some(v => h[apiMapping[type].name].includes(v))
    })
    if (arr?.length === 1) {
      arr[0].ji = 1
    }
    //对电视进行排序
    tvList.value = arr.sort((a, b) => {
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
    if (type === '夸克网盘') {
      tvList.value = tvList.value.map(i => {
        return {
          id: i.fid,
          name: i.file_name,
          ji: i.ji,
          // path: "/我的视频/电视剧",
          provider: 'Quark',
        }
      })
    }
  }

  //处理电视的详情和剧集等
  const handleTv = async (seasonData1 = null) => {
    showRehandleButton.value = false
    //提取季
    const season = determineSeason()
    let res1 = {}
    //获取季数据，并且设置给某些参数，把res1传进去，获取到季的数据
    res1 = await getSeasonData(seasonData1, season)
    await getTvlist(selectType.value.type)
    imgData.value.runtime = t('video.totalEpisodesInLibrary', { total: res1?.episodes?.length || 0, count: tvList.value?.length || 0 })
    //处理现有的集数，将tmdb的封面，时长都设置进去，还有每一集的标题
    processTvlist(res1)
    nextTick(() => {
      if (historyTv.value.name) scrollIntoView.value = 'name' + historyTv.value.ji
    })
  }

  const getMovieTvDetail = async () => {
    if (!routerParams.value.movieTvId) {
      imgData.value.title = routerParams.value.name
      return false
    }
    if (routerParams.value.type == 'tv') {
      if (activeSeason.value.season != '1') {
        imgData.value.title = routerParams.value.name + ' ' + activeSeason.value.name
      } else {
        imgData.value.title = routerParams.value.name
      }
    }

    let res = await getMovieTvById(
      {
        movieTvId: routerParams.value.movieTvId,
      },
      routerParams.value.type
    )
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
        posterPath: CONFIG.IMG_DOMAIN + '/t/p/w300_and_h450_bestv2' + res.poster_path,
        networks: res.networks,
      }
    } else if (routerParams.value.type == 'tv') {
      seasonFirst.value.img = CONFIG.IMG_DOMAIN + '/t/p/w1920_and_h1080_bestv2' + res.backdrop_path
      seasonFirst.value.overview = res.overview
      imgData.value.score = res.vote_average.toFixed(1)
      imgData.value.genres = res.genres.map(i => i.name).join(' ')
      imgData.value.releaseTime = res.first_air_date
      imgData.value.runtime = t('video.totalEpisodesInLibrary', { total: res.number_of_episodes || 0, count: 0 })
      imgData.value.networks = res.networks
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
  //构造片头片尾参数及其 URL 查询串
  const buildOpenEndTime = nowTv => {
    let openEndTime = {}
    if (!routerParams.value.movieTvId) openEndTime.noSetHistory = 0
    if (nowTv.openingTime >= 0) openEndTime.openingTime = nowTv.openingTime
    if (nowTv.endTime >= 0) openEndTime.endTime = nowTv.endTime
    return toStringfy(openEndTime) ? '&' + toStringfy(openEndTime) : ''
  }

  //电影：写历史（无记录时）并跳播放器
  const clickPlayMovie = () => {
    const lastIndex = routerParams.value.path.lastIndexOf('/')
    let name = routerParams.value.path.substring(lastIndex + 1)
    let history = historyPlay.value?.find(i => i.name == name)
    if (!(history && selectSource.value.path == '/' + history.path)) {
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
      if (selectType.value.type != 'WebDAV') {
        historyItem.folderFileId = selectSource.value.folderFileId
      }
      historyStore.push(historyItem)
    }
    if (selectType.value.type == 'WebDAV') {
      uni.navigateTo({
        url: `/pages/mobile/video/video-player?path=${selectSource.value.path.slice(1)}&type=movie`,
      })
    } else {
      uni.navigateTo({
        url: `/pages/mobile/video/video-player?path=${selectSource.value.path.slice(1)}&folderFileId=${selectSource.value.folderFileId}&type=movie`,
      })
    }
  }

  //电视剧：写历史（无记录时）并跳播放器
  const clickPlayTv = () => {
    if (!tvList.value.length) {
      uni.showToast({
        title: t('video.pleaseCheckCloudOrWebdav'),
        icon: 'none',
      })
      return
    }
    uni.setStorageSync('tvList', tvList.value)
    let localMovieTvData = uni.getStorageSync('localMovieTvData')
    let nowTv = {}
    if (routerParams.value.movieTvId) {
      nowTv = localMovieTvData.tv.find(i => i.movieTvId == routerParams.value.movieTvId)
    } else {
      nowTv = localMovieTvData.tv.find(i => i.path == routerParams.value.path)
    }
    let history = historyPlay.value?.find(i => i.titlePlay == imgData.value.title)
    //有历史且路径一致时续播，否则从第一集开始并写历史
    const continuePlay = history && activeSeason.value.path + '/' + history.name == '/' + history.path
    const episode = continuePlay ? history : tvList.value[0]
    const episodeFolderFileId = continuePlay ? history.folderFileId : tvList.value[0].id
    if (!continuePlay) {
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
      if (selectType.value.type != 'WebDAV') {
        historyItem.folderFileId = tvList.value[0].id
      }
      historyStore.push(historyItem)
    }
    const queryStr = buildOpenEndTime(nowTv)
    if (selectType.value.type == 'WebDAV') {
      uni.navigateTo({
        url: `/pages/mobile/video/video-player?path=${activeSeason.value.path.slice(1)}/${episode.name}&type=tv${queryStr}`,
      })
    } else {
      uni.navigateTo({
        url: `/pages/mobile/video/video-player?path=${activeSeason.value.path.slice(1)}/${episode.name}&wjjId=${activeSeason.value.folderFileId}&folderFileId=${episodeFolderFileId}&type=tv${queryStr}`,
      })
    }
  }

  const clickPlayButton = () => {
    if (routerParams.value.type == 'movie') {
      clickPlayMovie()
    } else if (routerParams.value.type == 'tv') {
      clickPlayTv()
    }
  }

  //播放电视
  const toPlayVideo = (item, index) => {
    if (!CONFIG.IS_PC) uni.setStorageSync('tvList', tvList.value)
    let localMovieTvData = uni.getStorageSync('localMovieTvData')
    const nowTv = routerParams.value.movieTvId
      ? localMovieTvData.tv?.find(i => i.movieTvId == routerParams.value.movieTvId)
      : localMovieTvData.tv?.find(i => i.path == routerParams.value.path)
    const seasonName = activeSeason.value.season === '1' ? '' : ' ' + activeSeason.value.name
    const expectedTitle = handleSeasonName(selectSource.value.name + seasonName, true)
    const history = historyPlay.value?.find(
      i => i.titlePlay === expectedTitle && item.name === i.name && activeSeason.value.path + '/' + i.name === '/' + i.path && activeSeason.value.season === i.season
    )

    // 构建播放参数
    const basePath = `${activeSeason.value.path.slice(1)}/${item.name}`
    const isWebDAV = selectType.value.type === 'WebDAV'
    const historyItem = !history
      ? {
          path: basePath,
          titlePlay: imgData.value.title,
          ji: String(item.ji),
          poster: item.poster || imgData.value.img,
          type: 'tv',
          name: item.name,
          runtime: item.runtime,
          title: item.title,
          initialTime: '0',
          movieTvId: routerParams.value.movieTvId,
          season: activeSeason.value.season,
          sourceType: selectType.value.type,
          sourceName: selectMedia.value.name,
        }
      : null
    if (historyItem) {
      if (!isWebDAV) historyItem.folderFileId = item.id
      historyStore.push(historyItem)
    }
    // 构建查询参数
    const query = {
      path: basePath,
      type: 'tv',
      ...(!isWebDAV && {
        wjjId: activeSeason.value.folderFileId,
        folderFileId: item.id,
      }),
      isEmby: '0'
    }
    // PC端打开MPV播放器
    if (CONFIG.IS_PC) {
      const args = {
        type: 'vue',
        content: '/video',
        windowName: 'Video',
        windowTitle: history ? t('video.nowPlaying') : 'William Player',
        query,
      }
      ipc.invoke(ipcApiRoute.createMpv, args)
      return
    }

    // 移动端打开播放器
    const openEndTime = {}
    if (!routerParams.value.movieTvId) openEndTime.noSetHistory = 0
    if (nowTv?.openingTime >= 0) openEndTime.openingTime = nowTv.openingTime
    if (nowTv?.endTime >= 0) openEndTime.endTime = nowTv.endTime

    let url = `/pages/mobile/video/video-player?path=${basePath}&type=tv`
    if (!isWebDAV) {
      url += `&wjjId=${activeSeason.value.folderFileId}&folderFileId=${item.id}`
    }

    const queryStr = toStringfy(openEndTime)
    if (queryStr) url += `&${queryStr}`
    uni.navigateTo({ url })
  }

  //设置按钮文字
  const setButtonText = () => {
    historyPlay.value = historyStore.readBySource(selectType.value.type, selectMedia.value.name)
    buttonTextKey.value = 'video.play'
    buttonTextParams.value = {}
    if (routerParams.value.type == 'movie') {
      let history = historyPlay.value?.find(i => handleSeasonName(i.name, true) == handleSeasonName(selectSource.value.name, true))
      if (history && selectSource.value.path == '/' + history.path) {
        buttonTextKey.value = 'video.playWithTime'
        buttonTextParams.value = { time: handleSecond(history.initialTime) }
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
        buttonTextKey.value = 'video.episodeTitleWithTime'
        buttonTextParams.value = { episode: history.ji, time: handleSecond(history.initialTime) }
      }
    }
  }

  //判断选择的是webdav还是天翼云盘还是夸克
  const { judgeSelect } = useSourceSelect({ selectType, selectMedia, sourceListRef: nowSourceList })

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
    if (!resetMovieTv) return
    judgeSelect()
    let oldMovieTvId = routerParams.value.movieTvId
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
    //先把当前源之外的记录保留，再把过滤后的当前源记录接回去
    let others = historyStore.read().filter(v => v.sourceType != selectType.value.type || v.sourceName != selectMedia.value.name)
    historyStore.write([...others, ...historyPlay.value])
    selectSource.value.name = resetMovieTv.name
    localMovieTvData.value = uni.getStorageSync('localMovieTvData') || {}

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
      let nowMovie = localMovieTvData.value.movie.find(i => i.movieTvId == oldMovieTvId)
      let res = await getMovieTvDetail()
      nowMovie.poster = CONFIG.IMG_DOMAIN + '/t/p/w300_and_h450_bestv2' + res.poster_path
      nowMovie.releaseTime = res.release_date
      nowMovie.type = '2'
      nowMovie.movieTvId = res.id
      nowMovie.genre_ids = res.genres.map(i => i.id)
      nowMovie.name = res.title
    }
    imgData.value.title = resetMovieTv.name
    uni.setStorageSync('localMovieTvData', localMovieTvData.value)
    actor_list.value.getActorList()
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

  //设置selectSource，也就是选中的影片来源
  const setSelectSource = async () => {
    if (CONFIG.IS_PC) {
      routerParams.value = route.query
    }
    let source = []
    if (routerParams.value.source) {
      //source从上一个页面传过来
      source = JSON.parse(routerParams.value.source)
    }
    sourceList.value = source.map(i => {
      if (source.filter(v => v.provider == i.provider).length > 1) {
        let label = getSourceLabel(i.provider)
        i.sourceName = label ? label + `(${i.name})` : i.provider
      } else {
        i.sourceName = getSourceLabel(i.provider)
      }
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
            v =>
              i.titlePlay == handleSeasonName(v.name, true) + ' ' + t('video.seasonTitle', { season: chineseNumber[i.season] }) &&
              v.seasonArr.find(h => h.path + '/' + i.name == '/' + i.path)
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
  }

  //下载电影
  const downloadMovie = () => {
    let obj = {
      saveName: selectSource.value.name,
      imgUrl: imgData.value.posterPath,
    }
    if (selectType.value.type === 'WebDAV') {
      //如果是webdav，就需要设置webdavPath用于获取下载链接
      obj.webdavPath = selectSource.value.path.slice(1)
    } else {
      //如果是天翼云盘或者夸克网盘，那么就需要folderFileId，用来获取下载链接
      obj.id = selectSource.value.folderFileId
    }
    queryAll(createDownload, [obj])
  }

  onBeforeMount(async () => {
    judgeSelect()
    // historyPlay.value = uni.getStorageSync('historyPlay') || []
    historyPlay.value = historyPlay.value.filter(v => v.sourceType == selectType.value.type && v.sourceName == selectMedia.value.name)
  })

  onShow(() => {
    if (onShowTimer) {
      clearTimeout(onShowTimer)
    }
    onShowTimer = setTimeout(() => {
      setButtonText()
      if (!firstEnter.value) {
        nextTick(() => {
          if (historyTv.value.name) scrollIntoView.value = 'name' + historyTv.value.ji
        })
      }
      firstEnter.value = false
      onShowTimer = null
    }, 800) //为什么加延迟，因为上一个页面setStorageSync的时候，不加延迟返回这个页面获取不到最新的storage
    //重新设置影片信息
    resetMovieTvData()
  })
  onUnload(() => {
    if (onShowTimer) {
      clearTimeout(onShowTimer)
      onShowTimer = null
    }
  })

  watch(
    () => localeStore.locale,
    () => {
      setButtonText()
    }
  )

  onLoad(options => {
    judgeSelect()
    routerParams.value = options
    if (options.movieTvId == 'undefined') {
      routerParams.value.movieTvId = undefined
    }
    setSelectSource()
  })

  return {
    showPopover,
    popoverArr,
    showTimePicker,
    pickerTitle,
    pickerVal,
    pickerColumns,
    imgData,
    overview,
    sourceList,
    selectSource,
    activeSeason,
    tvList,
    buttonText,
    routerParams,
    showRehandleButton,
    historyTv,
    scrollIntoView,
    lineNumber,
    lineHeight,
    toSelect,
    confirmPicker,
    changeSource,
    changeTvSource,
    changeTvSeason,
    disabledTip,
    clickPlayButton,
    toPlayVideo,
    reHandleTv,
    downloadMovie,
  }
}
