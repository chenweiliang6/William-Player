import { ref, onBeforeMount } from 'vue'
import { setTmdbKey, getUntokenDicts, addOperLog } from '@/network/apis'
import { loginUser, getFolder, getTvSeason, get189Folder, getQuarkFolder, getWopanFolder, get139Folder, getCutContent } from '@/utils/common'
import { handleSeasonName, handleNameYear, recursionMovie, recursionTv, extractSeasonNumber, generateChineseNumberMapping } from '@/utils/scrape'
import { toStringfy } from '@/pages/mobile/mine/common'
import { onShow, onUnload } from '@dcloudio/uni-app'
import { chineseToPinYin } from '@/utils/pinyin.js'
import * as CONFIG from '@/utils/config'
import Folder from '@/static/folder.png'
import webdavFileIcon from '@/static/webdav-fileIcon.png'
import { getMainView, getEmbyList, getEmbyNewList } from '@/utils/emby'
import { searchMovieTvByType } from '@/utils/tmdb'
import {
  scrapeSource,
  getMovieTvData,
  setMovieTvData,
  initLibraryWithMigration,
  isLibraryEmpty,
  getAvailableSources,
  hasLibraryContent,
} from '@/utils/scrape'
import { useI18n } from 'vue-i18n'
import dayjs from 'dayjs'
import emptyBg from '@/static/poster-empty.png'
import { IS_TV } from '@/utils/config.js'
import { useSourceSelect } from '@/hooks/useSourceSelect'
import { useHistoryStore } from '@/stores/historyPlay'
import { VIDEO_FORMAT } from '@/utils/player-common'

export function useVideoIndex({ wil_modal }) {
  const { t } = useI18n()
  const historyStore = useHistoryStore()
  let historySyncTimer = null //返回本页时同步历史记录的延迟任务，页面卸载时需清理
  const video_navbar = ref(null)
  const listData = ref([])
  const sourceList = ref([])
  const refreshData = ref({ found: 0, toupdate: 0, updated: 0, success: 0, fail: 0 })
  const refreshLoading = ref(false)
  const scrollTop = ref(0)

  // 刮削取消控制。signal 由编排/扫描/匹配三层共同检查（见 scrape/orchestrator.js:74、scan/tree.js:87、library/model.js:195），
  // 这里只负责把它传下去并给出取消入口。
  let activeSignal = null
  // 与 refreshLoading 分开：取消后 refreshLoading 已置 false，不能再靠它防重入，
  // 否则用户连点两次刷新会起两个并发的 scrapeSource 竞争写同一个 bucket。
  const isScraping = ref(false)

  // 把库重新投影到 UI 数据源。
  // 刮削中每批都会调用，所以必须节流 —— projectLegacyView 是 O(n) 的
  // 全量重建（建 Map + 三次 localeCompare 排序），大库时单次几毫秒。
  const syncViewFromLibrary = () => {
    const view = getMovieTvData()
    localMovieTvData.value = view
    setNavbarStyle(!hasLibraryContent(view))
    libraryRevision.value++
  }

  let viewSyncTimer = null
  let lastViewSyncAt = 0
  const VIEW_SYNC_INTERVAL_MS = 400
  const scheduleViewSync = () => {
    if (viewSyncTimer) return
    const wait = Math.max(0, VIEW_SYNC_INTERVAL_MS - (Date.now() - lastViewSyncAt))
    viewSyncTimer = setTimeout(() => {
      viewSyncTimer = null
      lastViewSyncAt = Date.now()
      syncViewFromLibrary()
    }, wait)
  }

  const clearViewSync = () => {
    if (viewSyncTimer) {
      clearTimeout(viewSyncTimer)
      viewSyncTimer = null
    }
  }

  const cancelRefresh = (reason = 'user') => {
    if (!activeSignal) return false
    activeSignal.cancelled = true
    activeSignal.reason = reason
    return true
  }
  const movieTvData = ref({
    //存储电影电视剧数据
    movie: [],
    tv: [],
  })

  const localMovieTvData = ref({})
  // 库内容的版本号。刮削期间库会分批增长，父组件每次投影后 +1；
  // 子组件（hx-list / classify）靠它感知「需要重建列表了」，
  // 因为它们的展示快照是从 props 复制出来的，不会自动跟随。
  const libraryRevision = ref(0)
  const embyMovieTvList = ref([])
  const tmdbKey = ref('')
  const historyPlay = ref([])
  const selectMedia = ref({})
  const selectType = ref({})
  const settingData = ref({}) //设置的数据
  const navbarStyle = ref({
    background: `rgba(255,255,255,0)`,
    color: `rgb(255,255,255)`,
    borderColor: `rgba(246, 247, 248, 0)`,
  })

  //设置navbarStyle
  const setNavbarStyle = isEmpty => {
    if (isEmpty) {
      navbarStyle.value = {
        background: `rgba(255,255,255,1)`,
        color: `rgb(0,0,0)`,
        borderColor: `rgba(246, 247, 248, 1)`,
      }
    } else {
      if (!settingData.value.showRecommend) {
        //如果不展示影视推荐轮播图，那么就设置单独的navbar样式
        navbarStyle.value = {
          background: `rgba(255,255,255,1)`,
          color: `rgb(0,0,0)`,
          borderColor: `rgba(246, 247, 248, 1)`,
        }
      } else {
        navbarStyle.value = {
          background: `rgba(255,255,255,0)`,
          color: `rgb(255,255,255)`,
          borderColor: `rgba(246, 247, 248, 0)`,
        }
      }
    }
  }

  //通过tmdb接口获取更详细的信息
  const searchMovieTv = (data, type) => searchMovieTvByType(data, type)

  //处理内存大小
  const handleSize = size => {
    if (size == 0) return '0'
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(size) / Math.log(1024))
    const formatted = parseFloat((size / Math.pow(1024, i)).toFixed(2))
    return formatted + ' ' + sizes[i]
  }

  //groupBy视频来源，将多个网盘来的视频合成一个
  const groupBySource = arr => {
    const chineseNumber = generateChineseNumberMapping(40, 'number')
    const map = new Map()
    let arr1 = arr.sort((a, b) => {
      const nameA = chineseToPinYin(a.name).toLowerCase().slice(0, 1)
      const nameB = chineseToPinYin(b.name).toLowerCase().slice(0, 1)
      if (nameA < nameB) return -1
      if (nameA > nameB) return 1
      return 0
    })
    arr1.forEach(item => {
      if (!map.has(handleSeasonName(item.name, true))) {
        let deleteProp = ['created', 'hash_info', 'hashinfo', 'is_dir', 'modified', 'sign']
        deleteProp.forEach(v => {
          delete item[v]
        })
        map.set(handleSeasonName(item.name, true), {
          ...item,
          provider: null,
          source: [],
        })
      }
      let source = map.get(handleSeasonName(item.name, true)).source
      if (!source.length) {
        source.push({
          provider: item.provider,
          size: handleSize(item.size) || 0,
          path: item.path,
          folderFileId: item.id, //电影的folderFileId放在这个层级
          name: item.name,
          seasonArr: [{ name: t('video.seasonTitle', { season: chineseNumber[item.season] }), path: item.seasonPath, season: String(item.season), folderFileId: item.folderFileId }], //电视剧的folderFileId放在这个层级
        })
      } else {
        let nowSource = source.find(v => v.name == item.name && v.path == item.path)
        if (nowSource) {
          nowSource.seasonArr.push({ name: t('video.seasonTitle', { season: chineseNumber[item.season] }), path: item.seasonPath, season: String(item.season), folderFileId: item.folderFileId })
          nowSource.seasonArr = nowSource.seasonArr.sort((a, b) => {
            return Number(a.season) - Number(b.season)
          })
        } else {
          source.push({
            provider: item.provider,
            size: handleSize(item.size) || 0,
            path: item.path,
            folderFileId: item.id,
            name: item.name,
            seasonArr: [{ name: t('video.seasonTitle', { season: chineseNumber[item.season] }), path: item.seasonPath, season: String(item.season) }],
          })
        }
      }
    })
    const result = Array.from(map.values())
    return result
  }

  //三网盘刮削的公共流程：重置统计 -> 登录(可选) -> 扫描目录 -> 比对 -> 刮削图片 -> 回写storage与埋点
  // ── 新版刮削：走统一链路，按源分桶写入多源库 ──
  // 与旧 refreshPosterWall 并存，逐步切换
  const refreshSourceUnified = async ({ logTitle }) => {
    // 重入守卫：上一轮还没结束就不再起新的。
    // 用 isScraping 而不是 refreshLoading —— 取消会把后者置 false，守卫就失效了。
    if (isScraping.value) {
      uni.showToast({ title: t('video.syncingNow'), icon: 'none' })
      return
    }
    refreshData.value = { found: 0, toupdate: 0, updated: 0, success: 0, fail: 0 }
    scrollTop.value = 0
    refreshLoading.value = true
    isScraping.value = true

    // 不设总时长上限：大库单次刮削可能跑很久，按时间掐断只会得到半截库。
    // 结束方式只剩两种 —— 自然跑完，或用户点「取消」。
    const signal = { cancelled: false, reason: '' }
    activeSignal = signal

    try {
      // 确保库就绪；首次运行会尝试迁移旧库
      await initLibraryWithMigration({
        type: selectType.value.type,
        accountName: selectMedia.value.name,
      })

      // 不再强制要求「电影目录 + 电视剧目录」两桶都配。
      // 新结构用 entries（导入到媒体库的目录），旧结构两桶任一有值即可。
      const muluData = uni.getStorageSync('muluData') || { movie: [], tv: [] }
      const hasMediaFolder =
        (muluData.entries || []).some(v => (v.target || 'media') === 'media') ||
        muluData.movie?.length ||
        muluData.tv?.length
      if (!hasMediaFolder) {
        uni.showToast({ title: t('media.pleaseSetMovieTvDirectory'), icon: 'none' })
        return
      }

      const stats = await scrapeSource({
        source: { type: selectType.value.type, name: selectMedia.value.name },
        cred: selectMedia.value,
        muluData,
        signal,
        onPhase: (phase, payload) => {
          // 取消后不再刷数字，否则弹层里的计数会继续跳
          if (signal.cancelled) return
          if (phase === 'scan-progress') {
            refreshData.value.found = payload.found || 0
          } else if (phase === 'match-progress') {
            refreshData.value.updated = payload.processed || 0
            refreshData.value.toupdate = payload.total || 0
          } else if (phase === 'partial') {
            // 已有一批结果入库 → 刷新海报墙，让卡片就地增长。
            // 进度数字由 match-progress 维护，这里不重复写，
            // 否则「已更新/待更新」的含义会在「作品数」和「已处理组数」之间跳变。
            scheduleViewSync()
          }
        },
      })

      // 取消/超时：编排层已把**已经刮到的批次**落库（取消语义 = 保留已刮到的）。
      // 所以这里必须刷新一次数据源，让这些卡片显示出来；
      // cancelReason 让弹层把标题显示成「已取消」还是「识别超时，已停止」。
      if (signal.cancelled) {
        clearViewSync()
        syncViewFromLibrary()
        refreshData.value.toupdate = refreshData.value.updated = 0
        refreshData.value.cancelReason = signal.reason || 'user'
        return
      }

      // 刮削结束（含 TMDB 故障保护撤回）：用最终库投影回旧形态喂给 UI。
      // 先清掉挂起的节流刷新，避免它在 400ms 后又用同一份库覆盖一次。
      clearViewSync()
      const view = getMovieTvData()
      localMovieTvData.value = view
      libraryRevision.value++

      // 统计要算上 byCategory 全部分区（含未识别），
      // 只看 movie/tv 会把「全是未识别条目」的情况报成 0 部
      const totalWorks = Object.values(view.byCategory || {})
        .reduce((n, list) => n + (list?.length || 0), 0)
      refreshData.value.updated = refreshData.value.toupdate = totalWorks
      refreshData.value.success = totalWorks
      // 进度弹层的「已失败」= 整根目录失败 + 被跳过的子树目录，
      // 否则用户看不到「这轮有 N 个目录没刮成」。
      refreshData.value.fail = (stats?.failed || 0) + (stats?.skipped || 0)
      // 部分目录扫描失败要告诉用户，否则会被当成「刮漏」
      refreshData.value.partialFailures = stats?.partialFailures || []
      setNavbarStyle(!hasLibraryContent(view))

      // 本次清掉了网盘上已不存在的影片 → 必须告知，静默删片比留幽灵条目更困惑。
      // 注意：这些条目的播放历史也会被 syncHistoryPlay 一并过滤（片没了历史没意义）。
      if (stats?.removed > 0) {
        uni.showToast({
          title: t('video.removedMissingVideos', {
            count: stats.removed,
            default: `已移除 ${stats.removed} 部网盘上已不存在的影片`,
          }),
          icon: 'none',
          duration: 3000,
        })
      }

      if (stats?.partialFailures?.length) {
        const pf = stats.partialFailures[0]
        // 跳过（挂载失效）与扫描失败是两种问题，提示要能指导下一步：
        //   跳过 → 去检查 Alist 存储/重新登录该挂载
        //   失败 → 检查网络或网盘登录
        const title = pf.reason === 'skipped'
          ? t('video.partialScanSkipped', {
            count: pf.skipped,
            default: `${pf.skipped} 个目录无法访问，已跳过（挂载可能已失效）`,
          })
          : t('video.partialScanFailed', {
            failed: pf.failed,
            total: pf.total,
            default: `${pf.failed}/${pf.total} 个目录扫描失败，部分影片可能未显示`,
          })
        uni.showToast({ title, icon: 'none', duration: 3000 })
      }

      // 一个条目都没扫到：区分「目录确实是空的」和「请求失败/全部被跳过」，
      // 后者以前会被静默吞掉，表现为「刮削完成但海报墙还是空的」
      if (!view.movie.length && !view.tv.length && (stats?.failed || stats?.skipped)) {
        uni.showToast({ title: t('source.scanFailedCheckLogin'), icon: 'none' })
      }
    } catch (e) {
      console.error('[useVideoIndex] 统一刮削失败:', e)
      // 区分三类失败，各给一条能指导下一步的提示
      let title
      if (e?.isAuthError) title = t('source.loginExpiredRelogin')
      else if (e?.isConnectError) title = t('source.connectFailed')
      else title = e?.message || t('video.invalidApiKey')
      uni.showToast({ title, icon: 'none' })
    } finally {
      clearViewSync()
      const wasCancelled = signal.cancelled
      const cancelReason = signal.reason
      activeSignal = null
      isScraping.value = false
      scrollTop.value = 0
      refreshLoading.value = false
      if (wasCancelled) {
        // 取消语义是「保留已刮到的」，文案要说清楚，否则用户会以为白刮了
        const title = cancelReason === 'tmdb'
          ? t('video.tmdbUnavailable')
          : t('video.scanCancelledKeepPartial', { default: '已取消，已保留识别到的影片' })
        uni.showToast({ title, icon: 'none' })
      } else if (logTitle) {
        addOperLog({ title: logTitle, businessType: 11, operatorType: 2 })
      }
    }
  }

  const refreshPosterWall = async ({ prepare, scan, logTitle }) => {
    refreshData.value = { found: 0, toupdate: 0, updated: 0, success: 0, fail: 0 }
    movieTvData.value = { movie: [], tv: [] }
    if (prepare) {
      await prepare()
    }
    await scan()
    if (!movieTvData.value.movie.length && !movieTvData.value.tv.length) {
      scrollTop.value = 0
      refreshLoading.value = false
      if (!IS_TV) {
        wil_modal.value.showModal({
          title: t('modal.warmTip'),
          content: t('video.noPosterWallGuide'),
          confirmColor: '#ff6701',
          confirm: async () => {
            let query = {
              url: CONFIG.BASE_URL.split(':4040')[0] + ':8443/app-webview/#/question',
              title: t('navbar.feedback'),
            }
            uni.navigateTo({
              url: '/pages/mobile/backend/index' + '?' + toStringfy(query),
            })
          },
        })
      }
      return
    }
    let movie = groupBySource(movieTvData.value.movie)
    let tv = groupBySource(movieTvData.value.tv)
    compareMovieTv(movie, 'movie')
    compareMovieTv(tv, 'tv')
    await setMovieTvImg(movie, 'movie')
      .then(res => {
        localMovieTvData.value.movie = res
      })
      .catch(() => {
        scrollTop.value = 0
        refreshLoading.value = false
        uni.showToast({
          title: t('video.invalidApiKey'),
          icon: 'none',
        })
      })
    localMovieTvData.value.tv = await setMovieTvImg(tv, 'tv')
    refreshData.value.updated = refreshData.value.toupdate
    refreshData.value.toupdate = 0
    refreshData.value.success = localMovieTvData.value.movie.length + localMovieTvData.value.tv.length
    setNavbarStyle(!hasLibraryContent(localMovieTvData.value))
    // 旧链路已停用（refreshVideo 走 refreshSourceUnified），这里不再写旧 key，
    // 避免与新库 movieTvLibrary 产生两份互相矛盾的数据。
    scrollTop.value = 0
    refreshLoading.value = false
    addOperLog({ title: logTitle, businessType: 11, operatorType: 2 })
  }

  const refreshWebDavVideo = () =>
    refreshPosterWall({
      prepare: async () => {
        if (selectMedia.value.name) {
          let res1 = await loginUser(selectMedia.value)
          selectMedia.value.token = res1.data.token
          uni.setStorageSync('sourceList', sourceList.value)
        }
      },
      scan: getMovieTv,
      logTitle: t('video.webdavPosterWallGenerated'),
    })

  //比较新刮削出来的影片是否已经存在或者删除，不存在就是待更新
  const compareMovieTv = (arr, type) => {
    if (type == 'movie') {
      const deleteNumber = localMovieTvData.value.movie?.filter(item => arr?.every(i => i.name != item.name))?.length || 0
      const addNumber = arr?.filter(item => localMovieTvData.value.movie?.every(i => i.name != item.name))?.length || 0
      refreshData.value.toupdate += deleteNumber + addNumber
    } else if (type == 'tv') {
      const deleteNumber = localMovieTvData.value.tv?.filter(item => arr?.every(i => i.name != item.name))?.length || 0
      const addNumber = arr?.filter(item => localMovieTvData.value.tv?.every(i => i.name != item.name))?.length || 0
      refreshData.value.toupdate += deleteNumber + addNumber
    }
  }

  //查找网盘中的名叫电影,电视剧的文件夹
  const getMovieTv = async () => {
    let muluData = uni.getStorageSync('muluData') || {}
    if (!muluData?.tv?.length && !muluData?.movie?.length) {
      uni.showToast({
        title: t('media.pleaseSetMovieTvDirectory'),
        icon: 'none',
      })
      return
    }
    scrollTop.value = 0
    refreshLoading.value = true

    let movieMulu = muluData.movie?.filter(v => v.name == selectMedia.value.name)
    if (movieMulu?.length) {
      await Promise.allSettled(
        movieMulu.map(async h => {
          let movieResult = await getFolder({ path: h.path }, selectMedia.value)
          if (!movieResult.data.content) movieResult.data.content = []
          await Promise.allSettled(
            movieResult.data.content.map(async v => {
              v.path = h.path + '/' + v.name
              v.provider = movieResult.data.provider
              if (v.type == '1') {
                await recursionMovie(v, movieTvData.value.movie, selectType.value, selectMedia.value, refreshData.value)
              } else {
                if (VIDEO_FORMAT.some(i => v.name.includes(i))) {
                  movieTvData.value.movie.push(v)
                  refreshData.value.found++
                }
              }
            })
          )
        })
      )
    } else {
      uni.showToast({
        title: t('source.pleaseSetMovieDirectory'),
        icon: 'none',
      })
    }
    let tvMulu = muluData.tv?.filter(v => v.name == selectMedia.value.name)
    if (tvMulu?.length) {
      await Promise.allSettled(
        tvMulu.map(async h => {
          let tvResult = await getFolder({ path: h.path }, selectMedia.value)
          if (!tvResult.data.content) tvResult.data.content = []
          await Promise.allSettled(
            tvResult.data.content.map(async v => {
              v.path = h.path + '/' + v.name
              v.provider = tvResult.data.provider
              if (v.type == '1') {
                await recursionTv(v, {}, movieTvData.value.tv, selectType.value, selectMedia.value, refreshData.value)
              }
            })
          )
        })
      )
    } else {
      uni.showToast({
        title: t('source.pleaseSetTvDirectory'),
        icon: 'none',
      })
    }
  }
  //将网盘中的电影等都设置详细信息
  const setMovieTvImg = async (arr, type) => {
    const processedItems = await Promise.allSettled(
      arr.map(async item => {
        try {
          const season = extractSeasonNumber(item.name)
          //刮削的时候查询这个影片名是不是在本地已经有了，本地有了的话，就不用去tmdb查了
          let exitMovieTv = null
          let cachedData = getMovieTvData()
          if (type == 'movie') {
            exitMovieTv = cachedData.movie?.find(i => i.path == item.path) || null
          } else if (type == 'tv') {
            exitMovieTv = cachedData.tv?.find(i => i.path == item.path) || null
          }
          let res = {}
          let data = {}
          if (!exitMovieTv) {
            //本地不存在已有的影片，就去查tmdb
            res = await searchMovieTv({ query: handleSeasonName(item.name), first_air_date_year: handleNameYear(item.name) }, type)
            if (res.results.length == 1) {
              data = res.results[0]
            } else if (res.results.length > 1) {
              data = res.results.find(vitem => vitem.name?.includes(handleSeasonName(item.name)) || vitem.title?.includes(handleSeasonName(item.name)))
            } else {
              data = { name: handleSeasonName(item.name) }
            }
          } else {
            data = exitMovieTv
            item.name = data.name
            type == 'movie' ? (data.release_date = data.releaseTime) : (data.first_air_date = data.releaseTime)
            data.id = data.movieTvId
            data.poster_path = data.poster
            data.backdrop_path = data.backdrop
            data.vote_average = data.voteAverage || 0
          }
          if (data) {
            let newItem = { ...item }
            newItem.poster = data.poster_path
            newItem.backdrop = data.backdrop_path
            let seasonRes = null
            if (season != '1' && !exitMovieTv) {
              seasonRes = await getTvSeason({
                movieTvId: data.id,
                season: season,
              })
              newItem.poster = seasonRes.poster_path
            }
            if (type == 'movie') {
              newItem.releaseTime = data.release_date
              newItem.type = '2'
            } else if (type == 'tv') {
              newItem.season = season
              newItem.releaseTime = seasonRes ? seasonRes.air_date : data.first_air_date
              newItem.type = '1'
            }
            newItem.movieTvId = data.id
            newItem.genre_ids = data.genre_ids
            newItem.overview = data.overview
            newItem.voteAverage = data.vote_average //评分
            if (data.openingTime) newItem.openingTime = data.openingTime //本地刮削的重新设置片头时间
            if (data.endTime) newItem.endTime = data.endTime //本地刮削的重新设置片头时间
            return newItem
          } else {
            refreshData.value.fail++
            return null
          }
        } catch (error) {
          refreshData.value.fail++
          return null
        }
      })
    )
    return processedItems.filter(item => item.value !== null && item.status === 'fulfilled').map(item => item.value)
  }

  //处理添加或者修改完webdav之后自动刮削
  const handleGx = async () => {
    let isreload = uni.getStorageSync('isreload')
    if (isreload) {
      scrollTop.value = 0
      uni.removeStorageSync('isreload')
      sourceList.value = uni.getStorageSync('sourceList')
      if (selectType.value.type == 'WebDAV') {
        if (selectMedia.value.name) {
          let res1 = await loginUser(selectMedia.value)
          selectMedia.value.token = res1.data.token
          uni.setStorageSync('sourceList', sourceList.value)
        }
      }
      if (uni.getStorageSync('settingData').tmdbKey) {
        video_navbar.value.showProgress()
      }
    }
  }

  //天翼云盘refresh
  const refresh189Video = () =>
    refreshPosterWall({
      scan: get189MovieTv,
      logTitle: t('video.tianyiPosterWallGenerated'),
    })

  //根据设定好的文件路径进行查找天翼云盘的文件
  /**
   * 通用扫描器：五个网盘来源的结构完全一致，
   * 差异只有「取列表的方式」和「provider 名」，交给注册表处理。
   * 入参用 fetchFolder(ref) 而不是来源 type，便于夸克在首屏额外传 listData。
   */
  const scanSourceFolder = async ({ fetchFolder, provider }) => {
    let muluData = uni.getStorageSync('muluData') || {}
    let movieMulu = muluData.movie?.filter(v => v.name == selectMedia.value.name)
    let tvMulu = muluData.tv?.filter(v => v.name == selectMedia.value.name)
    if (!movieMulu?.length && !tvMulu?.length) {
      uni.showToast({
        title: t('media.pleaseSetMovieTvDirectory'),
        icon: 'none',
      })
      return
    }
    scrollTop.value = 0
    refreshLoading.value = true

    if (movieMulu?.length) {
      await Promise.allSettled(
        movieMulu.map(async h => {
          let movieResult = await fetchFolder(h)
          let movieArr = (movieResult.fileList || []).filter(v => {
            v.path = h.path + '/' + v.name
            v.provider = provider
            return VIDEO_FORMAT.some(i => v.name.includes(i))
          })
          refreshData.value.found += movieArr.length
          movieTvData.value.movie.push(...movieArr)
          await Promise.allSettled(
            (movieResult.folderList || []).map(async v => {
              v.path = h.path + '/' + v.name
              v.provider = provider
              await recursionMovie(v, movieTvData.value.movie, selectType.value, selectMedia.value, refreshData.value)
            })
          )
        })
      )
    } else {
      uni.showToast({
        title: t('source.pleaseSetMovieDirectory'),
        icon: 'none',
      })
    }
    if (tvMulu?.length) {
      await Promise.allSettled(
        tvMulu.map(async h => {
          let tvResult = await fetchFolder(h)
          if (!tvResult.folderList) tvResult.folderList = []
          await Promise.allSettled(
            tvResult.folderList.map(async v => {
              v.path = h.path + '/' + v.name
              v.provider = provider
              await recursionTv(v, {}, movieTvData.value.tv, selectType.value, selectMedia.value, refreshData.value)
            })
          )
        })
      )
    } else {
      uni.showToast({
        title: t('source.pleaseSetTvDirectory'),
        icon: 'none',
      })
    }
  }

  //天翼 / 联通 / 移动 / 夸克：结构完全一致，只剩取列表方式不同
  const get189MovieTv = () =>
    scanSourceFolder({
      fetchFolder: h => get189Folder({ folderId: h.folderFileId }, selectMedia.value),
      provider: '189CloudPC',
    })

  const getWopanMovieTv = () =>
    scanSourceFolder({
      fetchFolder: h => getWopanFolder({ folderId: h.folderFileId }, selectMedia.value),
      provider: 'WoPan',
    })

  const get139MovieTv = () =>
    scanSourceFolder({
      fetchFolder: h => get139Folder({ folderId: h.folderFileId }, selectMedia.value),
      provider: 'Cloud139',
    })

  const getQuarkMovieTv = () =>
    scanSourceFolder({
      fetchFolder: h => getQuarkFolder({ fid: h.folderFileId }, selectMedia.value),
      provider: 'Quark',
    })

  //Emby的refresh
  const refreshEmby = async () => {
    const CollectionTypeArr = ['movies', 'tvshows', 'music', 'games', 'books', 'musicvideos', 'homevideos', 'livetv', 'channels']
    scrollTop.value = 0
    refreshLoading.value = true
    try {
      let res1 = await getMainView(selectMedia.value)
      const imgApiKey = selectMedia.value.token ? `&api_key=${selectMedia.value.token}` : ''
      embyMovieTvList.value = res1.Items.map(v => {
        return {
          name: v.Name,
          collectionType: v.CollectionType,
          poster: v?.ImageTags?.Primary
            ? `${selectMedia.value.protocol}://${selectMedia.value.address}:${selectMedia.value.port}/emby/Items/${v.Id}/Images/Primary?tag=${v.ImageTags.Primary}${imgApiKey}`
            : emptyBg,
          id: v.Id,
          list: [],
        }
      })
      let embyObj = {
        EnableImageTypes: 'Primary,Backdrop,Thumb',
        Fields: 'BasicSyncInfo,CanDelete,Container,PrimaryImageAspectRatio,ProductionYear,Status,EndDate,Prefix',
        MediaTypes: 'Video',
        Limit: '20',
        Recursive: true,
        ImageTypeLimit: '1',
      }
      await Promise.all(
        embyMovieTvList.value.map(async v => {
          if (CollectionTypeArr.includes(v.collectionType)) {
            embyObj.ParentId = v.id
            let res2 = await getEmbyNewList(embyObj, selectMedia.value)
            let arr = res2.map(i => {
              return {
                id: i.Id,
                name: i.Name,
                provider: 'Emby',
                releaseTime: dayjs(i.EndDate).format('YYYY-MM-DD'),
                poster: i.ImageTags.Primary
                  ? `${selectMedia.value.protocol}://${selectMedia.value.address}:${selectMedia.value.port}/emby/Items/${i.Id}/Images/Primary?tag=${i.ImageTags.Primary}${imgApiKey}`
                  : emptyBg,
                type: i.Type,
              }
            })
            v.list = arr
          }
        })
      )
      setNavbarStyle(embyMovieTvList.value?.length)
      uni.setStorageSync('embyMovieTvList', embyMovieTvList.value)
    } catch (e) {
      console.error('[useVideoIndex] Emby 刷新失败:', e)
      let title
      if (e?.isAuthError) title = t('source.loginExpiredRelogin')
      else if (e?.isConnectError) title = t('source.connectFailed')
      else title = e?.message || t('source.connectFailed')
      uni.showToast({ title, icon: 'none' })
    } finally {
      // 原先只在成功路径末尾置 false，任一 await 抛错都会让骨架屏永久转圈
      scrollTop.value = 0
      refreshLoading.value = false
    }
  }

  const refreshVideo = async () => {
    if (selectType.value.type == 'Emby') {
      // Emby 是服务端媒体库，一次性 Recursive 拉取，不参与本地刮削
      await refreshEmby()
    } else {
      // 五个网盘来源统一走新链路。
      // 旧代码在这里调用了已删除的 refreshQuarkVideo/refreshWopanVideo/refresh139Video，
      // 会抛 ReferenceError，现已一并修复。
      // WebDAV 需要先重新登录换 token，交给 prepare 处理。
      await refreshSourceUnified({
        logTitle: t('video.posterWallGenerated', { source: selectType.value.type }) || '刮削完成',
      })
    }
    syncHistoryPlay()
  }

  //同步当前源的历史记录：只保留本地影视库中仍存在的记录，并回写storage
  const syncHistoryPlay = () => {
    historyPlay.value = historyStore.readBySource(selectType.value.type, selectMedia.value.name)
    //Emby 源没有本地刮削库 localMovieTvData，历史记录直接保留
    if (selectType.value.type == 'Emby') {
      const embyOthers = historyStore.read().filter(v => v.sourceType != selectType.value.type || v.sourceName != selectMedia.value.name)
      historyStore.write([...embyOthers, ...historyPlay.value])
      return
    }
    //从历史播放记录中筛选出当前影视中存在的
    historyPlay.value = historyPlay.value.filter(item => {
      return (
        localMovieTvData.value.movie?.some(v => handleSeasonName(v.name, true) == handleSeasonName(item.name, true) && v.movieTvId == item.movieTvId) ||
        localMovieTvData.value.tv?.some(v => {
          if (item.season != '1') {
            return handleSeasonName(v.name, true) == handleSeasonName(item.titlePlay) && v.movieTvId == item.movieTvId
          } else {
            return handleSeasonName(v.name, true) == item.titlePlay && v.movieTvId == item.movieTvId
          }
        })
      )
    })
    const others = historyStore.read().filter(v => v.sourceType != selectType.value.type || v.sourceName != selectMedia.value.name)
    historyStore.write([...others, ...historyPlay.value])
  }
  //判断选择的是webdav还是天翼云盘还是夸克
  const { judgeSelect } = useSourceSelect({ selectType, selectMedia, sourceListRef: sourceList })

  //把历史上写成字符串 '1'/'0' 的 active 归一为布尔，避免 '0' 被判为真值
  const normalizeActiveFlag = list => {
    let changed = false
    list.forEach(group => {
      (group.list || []).forEach(item => {
        if (item.active === '1' || item.active === '0') {
          item.active = item.active === '1'
          changed = true
        }
      })
    })
    return changed
  }

  const initSourceList = () => {
    sourceList.value = uni.getStorageSync('sourceList')
    if (!sourceList.value) {
      sourceList.value = [
        { type: 'WebDAV', list: [], img: webdavFileIcon },
        {
          type: 'Emby',
          list: [],
          img: 'https://gimg3.baidu.com/search/src=https%3A%2F%2Ftiebapic.baidu.com%2Fforum%2Fw%253D120%253Bh%253D120%2Fsign%3D44147d7d4e82b2b7a79f3dc60196a3d2%2Fc9fcc3cec3fdfc03771506c1c33f8794a4c2265e.jpg%3Ftbpicau%3D2025-04-08-05_5fe90c457d4356ee146a73914e8a8871&refer=http%3A%2F%2Fwww.baidu.com&app=2021&size=w240&n=0&g=0n&q=75&fmt=auto?sec=1744045200&t=627b5377de1d3107a8a09cb4f65c9fdc',
        },
        {
          type: '天翼云盘',
          list: [],
          img: 'https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/8c/87/69/8c8769f2-6bfa-19b2-53a4-9e10a555deb3/AppIcon-0-0-1x_U007emarketing-0-7-0-0-sRGB-85-220.png/350x350.png',
        },
        {
          type: '夸克网盘',
          list: [],
          img: 'https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/60/6f/e5/606fe5ab-3bfb-c5e4-5bed-08c9b2b5188f/AppIcon-0-0-1x_U007emarketing-0-7-0-0-85-220.png/350x350.png?',
        },
        {
          type: '联通云盘',
          list: [],
          img: 'https://is1-ssl.mzstatic.com/image/thumb/Purple126/v4/a1/63/38/a16338a7-ba51-498a-5180-7327b46ca2b7/AppIcon-0-0-1x_U007emarketing-0-0-0-0-85-220.png/350x350.png',
        },
        {
          type: '移动云盘',
          list: [],
          img: 'https://is1-ssl.mzstatic.com/image/thumb/Purple126/v4/a1/63/38/a16338a7-ba51-498a-5180-7327b46ca2b7/AppIcon-0-0-1x_U007emarketing-0-0-0-0-85-220.png/350x350.png',
        },
      ]
      uni.setStorageSync('sourceList', sourceList.value)
    } else if (!sourceList.value.some(v => v.type == '移动云盘')) {
      //老用户的 storage 里没有移动云盘分组，补齐避免 persist139Token 静默失败
      sourceList.value.push({
        type: '移动云盘',
        list: [],
        img: 'https://is1-ssl.mzstatic.com/image/thumb/Purple126/v4/a1/63/38/a16338a7-ba51-498a-5180-7327b46ca2b7/AppIcon-0-0-1x_U007emarketing-0-7-0-0-85-220.png/350x350.png',
      })
      uni.setStorageSync('sourceList', sourceList.value)
    }
    //老数据迁移：'1'/'0' → true/false
    if (normalizeActiveFlag(sourceList.value)) {
      uni.setStorageSync('sourceList', sourceList.value)
    }
  }

  //页面显示执行的方法
  const showPage = async () => {
    sourceList.value = uni.getStorageSync('sourceList')
    let showRecommend = settingData.value.showRecommend
    settingData.value = uni.getStorageSync('settingData')
    if (showRecommend !== settingData.value.showRecommend) {
      //如果设置改变
      embyMovieTvList.value = uni.getStorageSync('embyMovieTvList')
      let isEmpty = selectType.value.type === 'Emby' ? embyMovieTvList.value?.length : !hasLibraryContent(localMovieTvData.value)
      if (!settingData.value.showRecommend) {
        setNavbarStyle(isEmpty)
      }
    }
    initSourceList()
    judgeSelect()
    localMovieTvData.value = getMovieTvData()
    if (!hasLibraryContent(localMovieTvData.value)) scrollTop.value = 0
    tmdbKey.value = uni.getStorageSync('settingData').tmdbKey || ''
    if (uni.getStorageSync('secondPage') == 'videoPlayer') {
      if (historySyncTimer) {
        clearTimeout(historySyncTimer)
      }
      historySyncTimer = setTimeout(() => {
        syncHistoryPlay()
        historySyncTimer = null
      }, 800) //为什么加延迟，因为上一个页面setStorageSync的时候，不加延迟返回这个页面获取不到最新的storage
    } else {
      historyPlay.value = []
      if (!uni.getStorageSync('isreload')) {
        syncHistoryPlay()
      }
    }
    uni.removeStorageSync('secondPage')
    const pages = getCurrentPages()
    const prevPage = pages[pages.length - 2]
    if (selectType.value.type == 'WebDAV') {
      handleGx()
    } else if (selectType.value.type == '天翼云盘') {
      let isreload = uni.getStorageSync('isreload')
      if (isreload || prevPage == 'pages/mobile/backend/data-sync') {
        scrollTop.value = 0
        uni.removeStorageSync('isreload')
        // let res = await get189Folder({ folderId: "-11" }, selectMedia.value);
        // listData.value = [res.fileListAO];
        if (uni.getStorageSync('settingData').tmdbKey) {
          video_navbar.value.showProgress()
        }
      }
    } else if (selectType.value.type == '夸克网盘') {
      let isreload = uni.getStorageSync('isreload')
      if (isreload || prevPage == 'pages/mobile/backend/data-sync') {
        scrollTop.value = 0
        uni.removeStorageSync('isreload')
        // let res = await getQuarkFolder({ fid: "0" }, selectMedia.value);
        // listData.value = [res.data];
        if (uni.getStorageSync('settingData').tmdbKey) {
          video_navbar.value.showProgress()
        }
      }
    } else if (selectType.value.type == '联通云盘') {
      let isreload = uni.getStorageSync('isreload')
      if (isreload || prevPage == 'pages/mobile/backend/data-sync') {
        scrollTop.value = 0
        uni.removeStorageSync('isreload')
        if (uni.getStorageSync('settingData').tmdbKey) {
          video_navbar.value.showProgress()
        }
      }
    } else if (selectType.value.type == '移动云盘') {
      let isreload = uni.getStorageSync('isreload')
      if (isreload || prevPage == 'pages/mobile/backend/data-sync') {
        scrollTop.value = 0
        uni.removeStorageSync('isreload')
        if (uni.getStorageSync('settingData').tmdbKey) {
          video_navbar.value.showProgress()
        }
      }
    } else if (selectType.value.type == 'Emby') {
      let isreload = uni.getStorageSync('isreload')
      if (isreload || prevPage == 'pages/mobile/backend/data-sync') {
        scrollTop.value = 0
        uni.removeStorageSync('isreload')
        video_navbar.value.showProgress()
      }
    }
    //初始化资源库列表
  }

  onBeforeMount(async () => {
    // setTmdbImgDomain();
    initSourceList()
    judgeSelect()
    localMovieTvData.value = getMovieTvData()
    setNavbarStyle(!hasLibraryContent(localMovieTvData.value))
    historyPlay.value = uni.getStorageSync('historyPlay') || []
    historyPlay.value = historyPlay.value.filter(v => v.sourceType == selectType.value.type && v.sourceName == selectMedia.value.name)
    historyPlay.value = historyPlay.value.filter(item => {
      return (
        localMovieTvData.value.movie?.some(v => handleSeasonName(v.name, true) == handleSeasonName(item.name, true) && v.movieTvId == item.movieTvId) ||
        localMovieTvData.value.tv?.some(v => {
          if (item.season != '1') {
            return handleSeasonName(v.name, true) == handleSeasonName(item.titlePlay) && v.movieTvId == item.movieTvId
          } else {
            return handleSeasonName(v.name, true) == item.titlePlay && v.movieTvId == item.movieTvId
          }
        })
      )
    })
    let historyArr = uni.getStorageSync('historyPlay') || []
    historyArr = historyArr.filter(v => v.sourceType != selectType.value.type || v.sourceName != selectMedia.value.name)
    uni.setStorageSync('historyPlay', [...historyArr, ...historyPlay.value])
    if (selectType.value.type == 'WebDAV') {
      if (selectMedia.value.name) {
        // alist 不可达/登录失败在这里抛错；不影响历史同步，降级成空列表即可
        try {
          let res1 = await loginUser(selectMedia.value)
          if (!res1?.data?.token) throw new Error('登录失败')
          selectMedia.value.token = res1.data.token
          uni.setStorageSync('sourceList', sourceList.value)
          let res = await getFolder({}, selectMedia.value)
          listData.value = res.data.content.map(item => {
            if (item.type == '1') {
              item.leftIcon = Folder
            }
            return item
          })
        } catch (e) {
          console.warn('[useVideoIndex] 读取 WebDAV 根目录失败:', e?.message)
          listData.value = []
        }
      }
    } else if (selectType.value.type == '天翼云盘') {
      if (selectMedia.value.name) {
        // let res = await get189Folder({ folderId: "-11" }, selectMedia.value);
        // listData.value = [res.fileListAO];
      }
    } else if (selectType.value.type == '夸克网盘') {
      if (selectMedia.value.name) {
        // let res = await getQuarkFolder({ fid: "0" }, selectMedia.value);
        // listData.value = [res.data];
      }
    } else if (selectType.value.type == '联通云盘') {
      if (selectMedia.value.name) {
        // let res = await getWopanFolder({ folderId: "0" }, selectMedia.value);
        // listData.value = [res.fileListAO];
      }
    } else if (selectType.value.type == '移动云盘') {
      if (selectMedia.value.name) {
        // let res = await get139Folder({ folderId: "root" }, selectMedia.value);
        // listData.value = [res.fileListAO];
      }
    }
  })
  onShow(() => {
    showPage()
  })
  onUnload(() => {
    if (historySyncTimer) {
      clearTimeout(historySyncTimer)
      historySyncTimer = null
    }
    // 页面卸载后节流定时器不该继续跑（它还会写 localMovieTvData）
    clearViewSync()
    // 刮削本身不因离页而停止 —— 它已经在后台写库了，中途放弃反而会留下半截。
    // 这里只断开 UI 与它的联系；本轮会在后台跑到自然结束，
    // 或者由用户重新进入页面后点「取消」结束。
  })
  return {
    video_navbar,
    refreshData,
    refreshLoading,
    isScraping,
    cancelRefresh,
    libraryRevision,
    movieTvData,
    localMovieTvData,
    embyMovieTvList,
    tmdbKey,
    navbarStyle,
    selectType,
    historyPlay,
    settingData,
    scrollTop,
    refreshVideo,
    showPage,
    judgeSelect,
  }
}
