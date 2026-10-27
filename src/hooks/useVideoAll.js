import { ref, nextTick, onMounted, computed } from 'vue'
import { onShow, onLoad } from '@dcloudio/uni-app'
import emptyBg from '@/static/empty_bg.png'
import { toStringfy } from '../pages/mobile/mine/common'
import { handleSeasonName, handleSecond, parseTime } from '@/utils/scrape.js'
import posterEmpty from '@/static/poster-empty.png'
import * as CONFIG from '@/utils/config'
import { getEmbyList, getGenresList } from '../utils/emby'
import dayjs from 'dayjs'
import { useI18n } from 'vue-i18n'
import { useSourceSelect } from '@/hooks/useSourceSelect'

export function useVideoAll({ wil_list, route = null }) {
  const { t } = useI18n()
  const requestParams = ref({})
  const titleKey = ref('')
  const displayTitle = ref('')
  const listKind = ref('all')
  const isRecent = computed(() => listKind.value === 'recent')
  const getTypeByTitle = title => {
    const mapping = {
      [t('video.movie')]: 'movie',
      [t('video.tv')]: 'tv',
      电影: 'movie',
      电视剧: 'tv',
    }
    return mapping[title]
  }
  const getMediaType = () => routerParams.value.mediaType || getTypeByTitle(routerParams.value.title)

  const routerParams = ref({})

  const selectType = ref({})
  const selectMedia = ref({})
  const tabList = ref([])
  const embyActiveTab = ref('')
  const embyActiveTabKey = ref('')

  const showPopover = ref(false)

  const lineNumber = ref(3)
  const lineHeight = ref('')

  const windowWidth = ref(375)
  const getTitleText = () => (displayTitle.value || (titleKey.value ? t(titleKey.value) : routerParams.value.title))

  const changeSort = () => {
    wil_list.value.reload()
  }
  //判断选择的是webdav还是天翼云盘还是夸克
  const { judgeSelect } = useSourceSelect({ selectType, selectMedia })

  //emby分页请求的公共参数，差异项通过 overrides 合并
  const buildEmbyParams = (params, overrides = {}) => {
    return {
      ParentId: routerParams.value.embyParentId,
      EnableImageTypes: 'Primary,Backdrop,Thumb',
      Fields: 'BasicSyncInfo,CanDelete,Container,PrimaryImageAspectRatio,ProductionYear,Status,EndDate,Prefix',
      SortBy: 'SortName',
      SortOrder: 'Ascending',
      StartIndex: (params.pageNum - 1) * params.pageSize,
      Limit: params.pageSize,
      Recursive: true,
      ImageTypeLimit: '1',
      ...overrides,
    }
  }

  //emby响应统一映射为列表组件需要的结构
  const mapEmbyItems = (res, mapItem) => {
    let arr = res.Items.map(mapItem)
    arr.forEach(item => {
      item.loadImg = true
    })
    return {
      code: '200',
      rows: arr,
      total: res.TotalRecordCount,
    }
  }
  const removeExtension = item => {
    const firstDotIndex = item.name.indexOf('.')
    let name = firstDotIndex === -1 ? item.name : item.name.substring(0, firstDotIndex)
    name = handleSeasonName(name, true)
    if (name.length > 7) {
      name = name.slice(0, 6) + '...'
    }
    return name
  }

  //设置emby图片
  const setEmbyImg = item => {
    if (item.ImageTags.Primary) {
      return `${selectMedia.value.protocol}://${selectMedia.value.address}:${selectMedia.value.port}/emby/Items/${item.Id}/Images/Primary?tag=${item.ImageTags.Primary}`
    } else if (item.PrimaryImageItemId) {
      return `${selectMedia.value.protocol}://${selectMedia.value.address}:${selectMedia.value.port}/emby/Items/${item.PrimaryImageItemId}/Images/Primary?tag=${item.PrimaryImageTag}`
    } else {
      return posterEmpty
    }
  }
  //emby获取剧集列表
  const getEmbyJjList = async params => {
    let embyObj = buildEmbyParams(params, { IncludeItemTypes: routerParams.value.embyIncludeItemTypes })
    let res = await getEmbyList(embyObj, selectMedia.value)
    return mapEmbyItems(res, i => ({
      id: i.Id,
      name: i.Name,
      provider: 'Emby',
      releaseTime: dayjs(i.EndDate).format('YYYY-MM-DD'),
      type: i.Type,
      poster: setEmbyImg(i),
    }))
  }
  //emby获取流派列表
  const getEmbyGenreList = async params => {
    let embyObj = buildEmbyParams(params, {
      IncludeItemTypes: routerParams.value.embyIncludeItemTypes,
      userId: selectMedia.value.userId,
    })
    let res = await getGenresList(embyObj, selectMedia.value)
    return mapEmbyItems(res, i => ({
      id: i.Id,
      name: i.Name,
      provider: 'Emby',
      notShowTime: true,
      type: i.Type,
      poster: setEmbyImg(i),
    }))
  }
  //获取流派下的影视列表
  const getGenreChildren = async (params, query) => {
    let embyObj = buildEmbyParams(params, {
      userId: selectMedia.value.userId,
      ...query,
    })
    let res = await getEmbyList(embyObj, selectMedia.value)
    return mapEmbyItems(res, i => ({
      id: i.Id,
      name: i.Name,
      provider: 'Emby',
      releaseTime: dayjs(i.EndDate).format('YYYY-MM-DD'),
      poster: setEmbyImg(i),
      type: i.Type,
    }))
  }
  //emby获取文件夹列表
  const getEmbyFolderList = async params => {
    let embyObj = buildEmbyParams(params, {
      SortBy: 'IsFolder,FileName',
      Recursive: false,
    })
    let res = await getEmbyList(embyObj, selectMedia.value)
    let arr = res.Items.map(i => {
      return {
        id: i.Id,
        name: i.Name,
        provider: 'Emby',
        notShowTime: true,
        type: i.Type,
        poster: setEmbyImg(i),
      }
    })
    return {
      code: '200',
      rows: arr,
      total: res.TotalRecordCount,
    }
  }
  const getMovieTvList = async params => {
    if (routerParams.value.type == 'emby') {
      //如果是emby，通过请求接口分页加载
      const includeType = routerParams.value.embyIncludeItemTypes
      const tabKey = embyActiveTabKey.value
      if (includeType == 'Series' || includeType == 'Movie') {
        if (tabKey == 'episode' || tabKey == 'movie') {
          return await getEmbyJjList(params)
        } else if (tabKey == 'genre') {
          return await getEmbyGenreList(params)
        } else if (tabKey == 'folder') {
          return await getEmbyFolderList(params)
        }
      } else if (includeType == 'Genres') {
        if (routerParams.value.genreType == 'Series') {
          return await getGenreChildren(params, { IncludeItemTypes: 'Series', GenreIds: routerParams.value.GenreIds })
        } else if (routerParams.value.genreType == 'Movie') {
          return await getGenreChildren(params, { IncludeItemTypes: 'Movie,Series,Video', GenreIds: routerParams.value.GenreIds })
        }
      } else if (includeType == 'Folder') {
        return await getEmbyFolderList(params)
      }
    } else {
      if (isRecent.value) {
        let res = uni.getStorageSync('historyPlay') || []
        res = res.filter(v => v.sourceType == selectType.value.type && v.sourceName == selectMedia.value.name)
        res.forEach(item => {
          item.loadImg = true
        })
        return {
          code: '200',
          rows: res.slice((params.pageNum - 1) * params.pageSize, params.pageNum * params.pageSize),
          total: res.length,
        }
      } else if (getMediaType()) {
        let res = uni.getStorageSync('localMovieTvData') || {}
        let arr = res[getMediaType()] || []
        arr.forEach(item => {
          item.loadImg = true
        })
        return {
          code: '200',
          rows: arr.slice((params.pageNum - 1) * params.pageSize, params.pageNum * params.pageSize),
          total: arr.length,
        }
      } else {
        let res = uni.getStorageSync('localMovieTvData') || {}
        let arr = []
        arr.push(...res.movie.filter(i => i.genre_ids?.indexOf(+routerParams.value.genreId) > -1))
        arr.push(...res.tv.filter(i => i.genre_ids?.indexOf(+routerParams.value.genreId) > -1))
        arr.forEach(item => {
          item.loadImg = true
        })
        return {
          code: '200',
          rows: arr.slice((params.pageNum - 1) * params.pageSize, params.pageNum * params.pageSize),
          total: arr.length,
        }
      }
    }
  }

  const toVideoDetail = async item => {
    if (routerParams.value.type == 'emby') {
      if (item.type == 'Genre') {
        uni.navigateTo({
          url: `/pages/mobile/video/video-all?title=${item.name}&embyIncludeItemTypes=Genres&type=emby&GenreIds=${item.id}&embyParentId=${routerParams.value.embyParentId}&genreType=${routerParams.value.embyIncludeItemTypes}&isConnected1=true`,
        })
      } else if (item.type == 'Folder') {
        uni.navigateTo({
          url: `/pages/mobile/video/video-all?title=${item.name}&embyIncludeItemTypes=Folder&type=emby&embyParentId=${item.id}&isConnected1=true`,
        })
      } else if (item.type == 'Series' || item.type == 'Movie') {
        //直接跳转到剧集或者电影的详情页
        uni.navigateTo({
          url: `/pages/${CONFIG.PLATFORM_DIR}/video/emby/emby-detail?name=${handleSeasonName(item.name, true)}&type=${item.type == 'Series' ? 'tv' : 'movie'}&movieTvId=${item.id}&isEmby=true`,
        })
      }
    } else {
      uni.navigateTo({
        url: `/pages/${CONFIG.PLATFORM_DIR}/video/video-detail?path=${item.path}&name=${handleSeasonName(item.name, true)}&type=${item.type == '1' ? 'tv' : 'movie'}&source=${JSON.stringify(item.source)}&movieTvId=${item.movieTvId}`,
      })
    }
  }

  const setEmptyImg = poster => {
    if (poster) {
      if (routerParams.value.type == 'emby') {
        return poster
      } else {
        return CONFIG.IMG_DOMAIN + '/t/p/w300_and_h450_bestv2' + poster
      }
    } else {
      return posterEmpty
    }
  }

  let changeItemFn = () => {}
  const imgError = item => {
    changeItemFn = v => {
      v.loadImg = false
    }
    nextTick(() => {
      wil_list.value.handleEdit(item.path)
    })
  }

  const imgLoad = item => {
    if (!routerParams.value.isConnected && !item.loadImg) return
    // changeItemFn.value = (v) => {
    //     v.loadImg = true;
    // };
    nextTick(() => {
      wil_list.value.handleEdit(item.path)
    })
  }

  //设置平板的宽高
  const setItemWidth = () => {
    let sysinfo = uni.getSystemInfoSync() // 获取设备系统对象
    windowWidth.value = sysinfo.windowWidth
    const scale = uni.upx2px(100) / 100 // 获取1rpx对应的px比例
    if (windowWidth.value > 700) {
      lineNumber.value = Math.floor((windowWidth.value - 24) / 109)
      let remain = windowWidth.value - 24 - lineNumber.value * 109
      if (remain < (lineNumber.value - 1) * 12) {
        lineNumber.value--
      }
      lineHeight.value = (((windowWidth.value - uni.upx2px(24 * lineNumber.value + 24)) / lineNumber.value) * 160) / 109 / scale + 'rpx'
    } else {
      lineNumber.value = 3
      lineHeight.value = (((windowWidth.value - uni.upx2px(24 * lineNumber.value + 24)) / lineNumber.value) * 160) / 109 / scale + 'rpx'
    }
  }

  const listItemStyle = item => {
    if (item.index % lineNumber.value == 0) {
      return { marginLeft: 0 }
    } else {
      return { marginLeft: '24rpx' }
    }
  }

  //emby切换tab
  const changeTab = async title => {
    embyActiveTab.value = title
    embyActiveTabKey.value = tabList.value.find(item => item.title == title)?.key || ''
    wil_list.value.reload()
  }

  onLoad(options => {
    judgeSelect()
    routerParams.value = options
    const titleMapping = {
      最近观看: 'video.recentPlayed',
      电视剧: 'video.tv',
      电影: 'video.movie',
      [t('video.recentPlayed')]: 'video.recentPlayed',
      [t('video.tv')]: 'video.tv',
      [t('video.movie')]: 'video.movie',
    }
    titleKey.value = routerParams.value.genreKey || titleMapping[routerParams.value.title] || ''
    displayTitle.value = titleKey.value ? t(titleKey.value) : routerParams.value.title
    listKind.value = routerParams.value.listKind || (routerParams.value.title == '最近观看' || routerParams.value.title == t('video.recentPlayed') ? 'recent' : 'all')
    routerParams.value.isConnected = routerParams.value.isConnected1 == 'true' ? true : false
    if (CONFIG.IS_PC) {
      routerParams.value = route.query
    }
    if (routerParams.value.embyIncludeItemTypes == 'Series') {
      embyActiveTabKey.value = 'episode'
      embyActiveTab.value = t('video.episode')
      tabList.value = [
        { key: 'episode', title: t('video.episode') },
        { key: 'genre', title: t('video.genre') },
        { key: 'folder', title: t('video.folder') },
      ]
    } else if (routerParams.value.embyIncludeItemTypes == 'Movie') {
      embyActiveTabKey.value = 'movie'
      embyActiveTab.value = t('video.movie')
      tabList.value = [
        { key: 'movie', title: t('video.movie') },
        { key: 'genre', title: t('video.genre') },
        { key: 'folder', title: t('video.folder') },
      ]
    }
    setItemWidth()
    uni.setNavigationBarTitle({
      title: getTitleText(),
    })
  })

  return {
    routerParams,
    titleKey,
    displayTitle,
    isRecent,
    getTitleText,
    showPopover,
    getTypeByTitle,
    changeSort,
    tabList,
    changeTab,
    getMovieTvList,
    requestParams,
    windowWidth,
    changeItemFn,
    listItemStyle,
    lineNumber,
    lineHeight,
    embyActiveTab,
    embyActiveTabKey,
    toVideoDetail,
    setEmptyImg,
    imgError,
    imgLoad,
    removeExtension,
  }
}
