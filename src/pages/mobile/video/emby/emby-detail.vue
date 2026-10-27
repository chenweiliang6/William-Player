<template>
  <div :class="['emby-detail', themeClass]">
    <wil-navbar style="position: fixed; z-index: 999" arrow-color="#fff"></wil-navbar>
    <div class="emby-detail-container">
      <div class="emby-detail-container__img" :style="{ backgroundImage: `url(${imgData.img})` }">
        <div class="img-container">
          <div class="img-title">{{ imgData.title }}</div>
          <div class="img-mid" v-if="imgData.releaseTime">
            <div class="img-mid-score">
              <image src="@/static/star-fill.png"  />
              <span>{{ imgData.score }}</span>
            </div>
            <div class="img-mid-date">
              <image src="@/static/date-icon.png"  />
              <span>{{ imgData.releaseTime }}</span>
            </div>
            <div class="img-mid-runtime">
              <image src="@/static/clock-icon.png" v-if="routerParams.type == 'movie'"  />
              <span>{{ imgData.runtime }}</span>
            </div>
          </div>
          <div class="img-bottom">
            <span class="img-bottom-genres">{{ imgData.genres }}</span>
            <span v-if="routerParams.type == 'movie'" class="img-bottom-size">{{ imgData.size }}</span>
          </div>
        </div>
      </div>
      <div class="emby-detail-container__content">
        <nut-button :custom-color="primaryBtnColor" @click="clickPlayButton">
          <template #icon>
            <image src="/static/play.png"  />
          </template>
          <span :style="{ color: primaryBtnTextColor }">{{ buttonText }}</span>
        </nut-button>
        <!-- 电影专用 -->
        <div class="movie-version" v-if="routerParams.type == 'movie'">
          <div class="movie-version-title">{{ t('video.movieVersion') }}</div>
          <div class="movie-version-item">Emby</div>
        </div>
        <!-- 电视专用 -->
        <div class="tv-version" v-if="routerParams.type == 'tv'">
          <div class="tv-version-tabs">
            <div class="tv-version-tabs__cloud">
              <div class="tv-version-tabs__cloud-item">Emby</div>
            </div>
            <nut-tabs v-model="activeSeason.season" :title-scroll="true" :custom-color="iconColor" background="var(--app-bg)" @change="changeTvSeason">
              <nut-tab-pane :title="item.name" :pane-key="item.season" v-for="item in seasonArr" :key="item.season"></nut-tab-pane>
            </nut-tabs>
            <div class="tv-version-tabs__disabled" v-if="!tvList.length && !showRehandleButton" @click="disabledTip"></div>
          </div>
          <scroll-view
            class="tv-version-scroll"
            :scroll-with-animation="true"
            :scroll-into-view="scrollIntoView"
            :scroll-x="true"
            style="width: 100%"
            :enhanced="true"
            :showScrollbar="false"
            v-if="tvList.length"
            :style="{ '--line-number': lineNumber, '--line-height': lineHeight }"
          >
            <div class="tv-version-list__item" v-for="(item, index) in tvList" :id="'name' + (index + 1)" :key="item.name" @click="toPlayVideo(item, index)">
              <div class="item-img" :style="{ backgroundImage: `url(${item.poster})` }">
                <image src="@/static/playVideo-button.png"  />
                <span class="item-img-runtime" v-if="item.runtime">{{ item.runtime }}</span>
                <div
                  class="item-img-process"
                  :style="{ width: Number(historyTv.initialTime) / (Number(parseTime(item.runtime)) * 0.6) + '%' }"
                  v-if="index + 1 == historyTv.ji && item.runtime && activeSeason.path + '/' + historyTv.name == '/' + historyTv.path"
                ></div>
              </div>
              <div class="item-title">{{ index + 1 + '.' + (item.title || t('video.episodeTitle', { episode: index + 1 })) }}</div>
            </div>
          </scroll-view>
          <div class="tv-version-empty" v-else>
            <nut-button :custom-color="primaryBtnColor" v-if="showRehandleButton" @click="reHandleTv"><span :style="{ color: primaryBtnTextColor }">{{ t('video.reload') }}</span></nut-button>
            <span v-else>{{ t('common.loadingEllipsis') }}</span>
          </div>
        </div>
        <actor-list
          ref="actor_list"
          :routerParams="routerParams"
          :actorArr="actorArr"
          type="emby"
          v-if="showActor"
          :selectSource="{ name: imgData.title, path: imgData.path, sourceName: 'Emby', size: null }"
          :imgData="{ ...imgData, overview: overview }"
        ></actor-list>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onBeforeMount, nextTick, watch } from 'vue'
import { onShow, onLoad } from '@dcloudio/uni-app'
import wilNavbar from '@/components/mobile/wil-navbar/index.vue'
import actorList from '../components/detail-component/actor-list.vue'
import { getEmbyMovieTv, getEmbySeasonList, getEmbyList, setEmbyImg, getSeasonTvList } from '@/utils/emby'
import { parseTime, calTime, formatNanoseconds, handleSecond, handleSeasonName, generateChineseNumberMapping } from '@/utils/scrape'
import { useThemeClass } from '@/hooks/useThemeClass'
import { useThemeColors } from '@/hooks/useThemeColors'
import { useI18n } from 'vue-i18n'
import { useLocaleStore } from '@/stores/locale'

const { t } = useI18n()
const localeStore = useLocaleStore()
const themeClass = useThemeClass()
const { primaryBtnColor, primaryBtnTextColor, iconColor } = useThemeColors()
const imgData = ref({}) //图片内的信息
const overview = ref('') //剧情简介
const actor_list = ref(null)
const activeSeason = ref({})
const seasonFirst = ref({})
const tvList = ref([]) //目前Emby所拥有的电视集数列表
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
const scrollIntoView = ref('')
const seasonArr = ref([]) //季的数组
const actorArr = ref([]) //emby获取到的演员列表
const showActor = ref(false) //显示演员列表组件

const lineNumber = ref(2)
const lineHeight = ref(0)

const allDetail = ref({}) //如果电视剧有很多季,这个参数就存放总的电视剧的详情，用于初始化

//判断选择的是哪个Emby
const judgeSelect = () => {
  nowSourceList.value = uni.getStorageSync('sourceList')
  selectType.value = nowSourceList.value.find(item => {
    let select = item.list.find(i => i.active)
    if (select) {
      selectMedia.value = select
      return true
    } else {
      return false
    }
  })
}

//获取影片详情
const getMovieTvDetail = async (type = 'all') => {
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
  let res = {}
  if (type == 'all') {
    res = await getEmbyMovieTv({ movieTvId: routerParams.value.movieTvId }, selectMedia.value)
    allDetail.value = res
  } else if (type == 'season') {
    res = await getEmbyMovieTv({ movieTvId: activeSeason.value.id }, selectMedia.value)
  }
  res.overview ? (overview.value = res.overview) : (overview.value = allDetail.value.overview)
  actorArr.value = res.actors
  showActor.value = true
  let copyImgData = imgData.value
  if (routerParams.value.type == 'movie') {
    imgData.value = {
      //如果季接口返回的值不存在，就用imgData原来的
      title: res.name || copyImgData.title,
      img: res.backdrop_path || copyImgData.img,
      score: res.vote_average.toFixed(1) || copyImgData.score,
      releaseTime: res.release_date || copyImgData.releaseTime,
      runtime: calTime(res.runtime) || copyImgData.runtime,
      runtimeEn: calTime(res.runtime, 'en') || copyImgData.runtimeEn,
      genres: res.genres.map(i => i.name).join(' ') || copyImgData.genres,
      size: res.size || copyImgData.size,
      poster: res.poster_path || copyImgData.poster,
      tmdbId: res.tmdbId || copyImgData.tmdbId,
      production_companies: res.production_companies || copyImgData.production_companies,
      overview: res.overview || copyImgData.overview,
      path: res.path || copyImgData.path,
    }
  } else if (routerParams.value.type == 'tv') {
    seasonFirst.value.img = res.backdrop_path
    if ((type == 'all' && seasonArr.value.length == 1) || (type == 'season' && seasonArr.value.length > 1)) {
      if (res.backdrop_path) imgData.value.img = res.backdrop_path
    }
    seasonFirst.value.overview = res.overview
    if (res.vote_average) imgData.value.score = res.vote_average.toFixed(1)
    if (res.genres?.length) imgData.value.genres = res.genres.map(i => i.name).join(' ')
    if (res.release_date) imgData.value.releaseTime = res.release_date
    if (res.poster_path) imgData.value.poster = res.poster_path
    if (res.tmdbId) imgData.value.tmdbId = res.tmdbId
    if (res.production_companies) imgData.value.production_companies = res.production_companies
    if (res.overview) imgData.value.overview = res.overview
    if (res.path) imgData.value.path = res.path
    if (res.number_of_episodes) imgData.value.runtime = t('video.totalEpisodesInLibrary', { total: res.number_of_episodes || 0, count: res.number_of_episodes || 0 })
  }
  return res
}

//切换第几季
const changeTvSeason = async obj => {
  activeSeason.value = { ...seasonArr.value.find(v => v.name == obj.title) }
  if (activeSeason.value.season != '1') {
    imgData.value.title = routerParams.value.name + ' ' + activeSeason.value.name
  } else {
    imgData.value.title = routerParams.value.name
  }
  getMovieTvDetail('season')
  handleTv()
}

//设置电视剧文件夹
const handleTv = async () => {
  let result = {}
  try {
    if (seasonArr.value.length == 1) {
      let embyObj = {
        ParentId: routerParams.value.movieTvId,
        IsFolder: false,
        EnableImageTypes: 'Primary,Backdrop,Thumb',
        Fields: 'BasicSyncInfo,CanDelete,CanDownload,PrimaryImageAspectRatio,Overview,PremiereDate,ProductionYear,RunTimeTicks,SpecialEpisodeNumbers',
        StartIndex: 0,
        Limit: 1000,
        EnableTotalRecordCount: false,
        Recursive: true,
        IsStandaloneSpecial: false,
      }
      result = await getEmbyList(embyObj, selectMedia.value)
    } else if (seasonArr.value.length > 1) {
      let embyObj = {
        SeasonId: activeSeason.value.id,
        folderFileId: routerParams.value.movieTvId,
      }
      result = await getSeasonTvList(embyObj, selectMedia.value)
    }
    console.log(result, 'result')
  } catch (error) {
    showRehandleButton.value = true
    return
  }
  tvList.value = result.Items.map(i => {
    return {
      id: i.Id,
      name: i.Name,
      title: i.Name,
      provider: 'Emby',
      poster: setEmbyImg(i, selectMedia.value),
    }
  })
  console.log(tvList.value, 'tvList')
}

//设置按钮文字
const setButtonText = () => {
  historyPlay.value = uni.getStorageSync('historyPlay') || []
  historyPlay.value = historyPlay.value.filter(v => v.sourceType == selectType.value.type && v.sourceName == selectMedia.value.name)
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

//点击播放按钮
const clickPlayButton = () => {
  uni.setStorageSync('overviewData', imgData.value)
  if (routerParams.value.type == 'movie') {
    uni.navigateTo({
      url: `/pages/mobile/video/emby/emby-player?folderFileId=${routerParams.value.movieTvId}&type=movie&movieName=${imgData.value.title}`,
    })
  } else if (routerParams.value.type == 'tv') {
    uni.setStorageSync('tvList', tvList.value)
    let openEndTime = {}
    if (!routerParams.value.movieTvId) openEndTime.noSetHistory = 0
    uni.navigateTo({
      url: `/pages/mobile/video/emby/emby-player?folderFileId=${tvList.value[0].id}&type=tv`,
    })
  }
}

//电视剧点击某一集进行播放
const toPlayVideo = (item, index) => {
  uni.setStorageSync('overviewData', imgData.value)
  if (routerParams.value.type == 'movie') {
    uni.navigateTo({
      url: `/pages/mobile/video/emby/emby-player?folderFileId=${routerParams.value.movieTvId}&type=movie&movieName=${imgData.value.title}`,
    })
  } else if (routerParams.value.type == 'tv') {
    uni.setStorageSync('tvList', tvList.value) //用于给视频播放器页面显示集数
    uni.navigateTo({
      url: `/pages/mobile/video/emby/emby-player?folderFileId=${item.id}&type=tv`,
    })
  }
}

//从接口获取该剧集有多少个季
const getSeasonArr = async () => {
  const seasonInfo = {
    movieTvId: routerParams.value.movieTvId,
    UserId: selectMedia.value.userId,
    Fields: 'BasicSyncInfo,CanDelete,CanDownload,PrimaryImageAspectRatio,Overview',
  }
  let res = await getEmbySeasonList(seasonInfo, selectMedia.value)
  seasonArr.value = res.Items.map(v => {
    return { name: v.Name, season: String(v.IndexNumber), id: v.Id }
  })
  activeSeason.value = { ...seasonArr.value[0] }
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
onBeforeMount(async () => {
  judgeSelect()
  if (routerParams.value.type === 'tv') {
    await getSeasonArr()
    handleTv()
  }
  if (seasonArr.value.length > 1) {
    await getMovieTvDetail()
    getMovieTvDetail('season')
  } else {
    getMovieTvDetail()
  }
})

watch(
  () => localeStore.locale,
  () => {
    setButtonText()
  }
)

onShow(() => {
  setTimeout(() => {
    setButtonText()
    if (!firstEnter.value) {
      nextTick(() => {
        if (historyTv.value?.name) scrollIntoView.value = 'name' + historyTv.value.ji
      })
    }
    firstEnter.value = false
  }, 800) //为什么加延迟，因为上一个页面setStorageSync的时候，不加延迟返回这个页面获取不到最新的storage
  //重新设置影片信息
})

onLoad(options => {
  routerParams.value = options
  if (options.movieTvId == 'undefined') {
    routerParams.value.movieTvId = undefined
  }
  if (options.isEmby == 'true') {
    routerParams.value.isEmby = true
  } else {
    routerParams.value.isEmby = false
  }
})
</script>

<style lang="scss" scoped>
page {
  width: 100%;
  height: 100%;
}

@media (min-width: 700px) {
  .emby-detail {
    .emby-detail-container {
      height: 100%;

      .emby-detail-container__img {
        height: 1200rpx !important;
      }
    }
  }
}

.emby-detail {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  background: var(--app-bg);
  overflow: auto;

  ::v-deep .wil-navbar {
    .nut-navbar {
      overflow: visible;
      background: transparent;

      .nut-navbar__right {
        display: block;
        position: absolute;
        right: 0;
        display: flex;
        align-items: center;

        .nut-transition {
          position: absolute;
          top: 50rpx;
          right: 25%;
          z-index: 3000;

          .more-arrow {
            width: 0;
            height: 0;
            position: absolute;
            right: 14rpx;
            transform: translateY(-100%);
            border-left: 12rpx solid transparent;
            border-right: 12rpx solid transparent;
            border-bottom: 16rpx solid var(--app-bg-card);
          }

          .more-popover {
            width: 360rpx;
            background: var(--app-bg-card);
            border-radius: 16rpx;

            .more-popover-item {
              display: flex;
              align-items: center;
              padding: 16rpx 24rpx;

              image {
                width: 40rpx;
                height: 40rpx;
              }

              .more-popover-item__text {
                flex: 1;
                padding-left: 15rpx;
                color: var(--app-text-primary);
              }
            }
          }
        }

        .nut-overlay {
          position: fixed;
          top: 0px;
          left: 0px;
          top: 0;
          left: 0;
          background: transparent;
        }
      }
    }
  }

  .emby-detail-container {
    height: 100%;

    .emby-detail-container__img {
      width: 100%;
      height: 840rpx;
      background-size: cover;
      background-position: center;
      background-repeat: no-repeat;
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      box-sizing: border-box;
      position: relative;

      &::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.1);
        z-index: 1;
      }

      .img-container {
        background: linear-gradient(to bottom, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.4) 100%);
        padding: 0 24rpx 30rpx 24rpx;

        .img-title {
          position: relative;
          z-index: 2;
          color: #fff;
          font-size: 42rpx;
          font-weight: bold;
        }

        .img-mid {
          position: relative;
          z-index: 2;
          display: flex;
          align-items: center;
          padding: 30rpx 0 10px 0;

          .img-mid-score {
            display: flex;
            align-items: center;
            padding: 0 14rpx;
            padding-left: 0;
            height: 40rpx;
            position: relative;

            &::after {
              position: absolute;
              content: '';
              width: 2rpx;
              height: 24rpx;
              background-color: #c2c5c6;
              right: 0;
              top: 50%;
              transform: translateY(-50%);
            }

            image {
              width: 32rpx;
              height: 32rpx;
            }

            span {
              font-size: 28rpx;
              line-height: 15px;
              color: #c2c5c6;
              padding-left: 10rpx;
            }
          }

          .img-mid-date {
            display: flex;
            align-items: center;
            padding: 0 14rpx;
            height: 40rpx;
            position: relative;

            &::after {
              position: absolute;
              content: '';
              width: 2rpx;
              height: 24rpx;
              background-color: #c2c5c6;
              right: 0;
              top: 50%;
              transform: translateY(-50%);
            }

            image {
              width: 28rpx;
              height: 28rpx;
            }

            span {
              font-size: 28rpx;
              color: #c2c5c6;
              padding-left: 10rpx;
            }
          }

          .img-mid-runtime {
            display: flex;
            align-items: center;
            padding: 0 14rpx;
            height: 40rpx;

            image {
              width: 28rpx;
              height: 28rpx;
            }

            span {
              font-size: 28rpx;
              color: #c2c5c6;
              padding-left: 10rpx;
            }
          }
        }
      }

      .img-bottom {
        position: relative;
        z-index: 2;
        display: flex;
        align-items: baseline;

        .img-bottom-genres {
          padding: 0 14rpx;
          font-size: 28rpx;
          color: #c2c5c6;
          display: block;
          padding-left: 0;
        }

        .img-bottom-size {
          position: relative;
          padding: 0 14rpx;
          font-size: 28rpx;
          color: #c2c5c6;
          display: block;

          &::before {
            position: absolute;
            display: block;
            content: '';
            width: 3rpx;
            height: 24rpx;
            background-color: #c2c5c6;
            left: 0;
            top: 50%;
            transform: translateY(-50%);
          }
        }
      }
    }

    .emby-detail-container__content {
      padding: 24rpx 24rpx 0 24rpx;
      padding-bottom: 100rpx;

      ::v-deep .nut-button {
        width: 100%;
        border-radius: 16rpx;
        height: 100rpx;

        .nut-button__wrap {
          image {
            width: 30rpx;
            height: 30rpx;
          }

          .nut-button__text {
            margin-left: 16rpx;
          }
        }
      }

      .movie-version {
        margin-top: 50rpx;

        .movie-version-title {
          font-size: 32rpx;
          font-weight: bold;
          color: var(--app-text-primary);
          padding-bottom: 20rpx;
        }

        .movie-version-item {
          font-size: 28rpx;
          font-weight: bold;
          padding: 12rpx 24rpx;
          border-radius: 8rpx;
          color: #52b54b;
          border: 2rpx solid #52b54b;
          margin-left: 12rpx;
          white-space: nowrap;
          display: inline-block;

          &:first-child {
            margin-left: 0;
          }
        }
      }

      .tv-version {
        margin-top: 20rpx;

        .tv-version-tabs__cloud {
          display: flex;
          align-items: center;
          flex-wrap: nowrap;
          width: 100%;
          overflow: auto;

          .tv-version-tabs__cloud-item {
            font-size: 28rpx;
            font-weight: bold;
            padding: 12rpx 24rpx;
            border-radius: 8rpx;
            color: #52b54b;
            border: 2rpx solid #52b54b;
            margin-left: 12rpx;
            white-space: nowrap;

            &:first-child {
              margin-left: 0;
            }
          }
        }

        ::v-deep .nut-tabs {
          &__titles {
            .nut-tabs__list {
              .nut-tabs__titles-item {
                // width: 92px;
                // flex: 0 0 92px;
                flex: 0 0 auto;
                min-width: auto;
                width: auto;
                margin-left: 30rpx;

                &:first-child {
                  margin-left: 0;
                }
              }

              .nut-tabs-active {
                color: var(--app-text-primary);

                .nut-tabs__titles-item__line {
                  width: 100%;
                  border-radius: 8rpx;
                  bottom: 12%;
                }
              }
            }
          }

          &__content {
            display: none;
          }
        }

        .tv-version-tabs {
          position: relative;

          .tv-version-tabs__disabled {
            position: absolute;
            width: 100%;
            height: 100%;
            left: 0;
            top: 0;
            z-index: 99;
          }

          ::v-deep .nut-tabs {
            .nut-tabs__titles {
              height: 92rpx;

              .uni-scroll-view {
                .uni-scroll-view-content {
                  .nut-tabs__list {
                    height: 92rpx;

                    .nut-tabs__titles-item {
                      .nut-tabs__titles-item__line {
                        height: 6rpx;
                      }

                      .nut-tabs__titles-item__text {
                        font-size: 28rpx;
                      }
                    }
                  }
                }
              }
            }
          }
        }

        .tv-version-scroll {
          width: 100%;
          height: 100%;
          overflow: hidden;

          ::v-deep .uni-scroll-view-content {
            display: flex;
            flex-direction: row;
            align-items: center;
            flex-wrap: nowrap;
            width: 100%;
            height: 250rpx;
          }

          .tv-version-list__item {
            margin-left: 24rpx;
            flex: 0 0 calc((100% - (var(--line-number) - 1) * 24rpx) / var(--line-number));
            overflow: hidden;

            &:first-child {
              margin-left: 0;
            }

            .item-img {
              width: 100%;
              // aspect-ratio: 169.5/85;
              height: var(--line-height);
              background: var(--app-bg-secondary);
              background-position: center;
              background-repeat: no-repeat;
              background-size: cover;
              border-radius: 16rpx;
              position: relative;
              overflow: hidden;

              image {
                width: 60rpx;
                height: 60rpx;
                position: absolute;
                left: 50%;
                top: 50%;
                transform: translate(-50%, -50%);
              }

              .item-img-runtime {
                position: absolute;
                right: 10rpx;
                bottom: 10rpx;
                background: rgba(0, 0, 0, 0.5);
                color: #fff;
                font-size: 24rpx;
                border-radius: 8rpx;
                padding: 4rpx 8rpx;
              }

              .item-img-process {
                height: 7rpx;
                background: #ff6701;
                position: absolute;
                bottom: 0;
                left: 0;
              }
            }

            .item-title {
              font-size: 28rpx;
              color: var(--app-text-primary);
              font-weight: bold;
              padding-top: 12rpx;
              width: 100%;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
          }
        }

        .tv-version-empty {
          width: 100%;
          height: 250rpx;
          display: flex;
          align-items: center;
          justify-content: center;

          ::v-deep .nut-button {
            height: initial;
            width: initial;
          }
        }
      }
    }
  }
}

// @media (prefers-color-scheme: dark) {
//   .emby-detail {
//     .emby-detail-container {
//       .emby-detail-container__content {
//         background: #1e1e20;

//         ::v-deep .nut-button {
//           background-color: gray !important;
//         }

//         .movie-version {
//           .movie-version-title {
//             color: #fff;
//           }

//               .movie-version-item {
//                 color: #fff;
//                 border: 2rpx solid #c2c5c6;
//               }

//             }

//         .tv-version {
//           .tv-version-tabs__cloud {
//             .tv-version-tabs__cloud-item {
//               color: #fff;
//               border: 2rpx solid #c2c5c6;
//             }

//             .tv-version-tabs__cloud-active {
//               color: #315ffd;
//               border: 2rpx solid #315ffd;
//             }
//           }

//           ::v-deep .nut-tabs {
//             &__titles {
//               background-color: #1e1e20 !important;

//               .nut-tabs__list {
//                 .nut-tabs-active {
//                   color: #fff;

//                   .nut-tabs__titles-item__line {
//                     background: #fff !important;
//                   }
//                 }
//               }
//             }
//           }

//           .tv-version-scroll {
//             .tv-version-list__item {
//               .item-title {
//                 color: #fff;
//               }
//             }
//           }
//         }
//       }
//     }
//   }
// }
</style>
