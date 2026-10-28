<template>
  <div class="detail">
    <div class="detail-background">
      <img :src="imgData.img" />
      <div class="detail-background-overlay"></div>
    </div>
    <div class="detail-content">
      <wil-title :title="route.query.title"></wil-title>
      <div class="detail-info">
        <div class="detail-info-img">
          <img :src="imgData.poster" />
        </div>
        <div class="detail-info-right">
          <div class="detail-info-right__name">{{ imgData.title }}</div>
          <div class="detail-info-right__mid">
            <div class="mid-score">
              <img src="@/static/star-fill.png" />
              <span>{{ imgData.score }}</span>
            </div>
            <div class="mid-date">
              <img src="@/static/date-icon.png" />
              <span>{{ imgData.releaseTime }}</span>
            </div>
            <div class="mid-runtime">
              <img src="@/static/clock-icon.png" v-if="route.query.type == 'movie'" />
              <span>{{ imgData.runtime }}</span>
            </div>
          </div>
          <div class="detail-info-right__genre">
            <span class="genre-value">{{ imgData.genres }}</span>
            <span v-if="route.query.type == 'movie'" class="genre-size">{{ selectSource?.size }}</span>
          </div>
          <div class="detail-info-right__button">
            <nut-button custom-color="#090909" @click="clickPlayButton">
              <template #icon>
                <image src="@/static/play.png" />
              </template>
              <span>{{ buttonText }}</span>
            </nut-button>
            <div class="button-more">
              <img src="@/static/gengduo-white.png" />
            </div>
          </div>
          <div class="detail-info-right__overview">
            {{ overview }}
          </div>
        </div>
      </div>
      <div class="detail-container">
        <div class="detail-container-source">
          <div :class="['source-item', 'source-active']">Emby</div>
        </div>
        <div class="detail-container-tabs" v-if="route.query.type === 'tv'">
          <div class="detail-container-tabs__arrow">
            <div class="arrow-left" @click="slideTv('left')">
              <img src="@/static/rect-leftblack.png" />
            </div>
            <div class="arrow-right" @click="slideTv('right')">
              <img src="@/static/rect-leftblack.png" />
            </div>
          </div>
        </div>
        <div class="detail-container-tv">
          <scroll-view
            class="tv-list"
            :scroll-with-animation="true"
            :scroll-into-view="scrollIntoView"
            :scroll-x="true"
            style="width: 100%"
            :enhanced="true"
            :showScrollbar="false"
            v-if="tvList.length"
          >
            <div class="tv-list-item" v-for="(item, index) in tvList" :id="'name' + (index + 1)" :key="item.name" @click="toPlayVideo(item, index)">
              <div class="item-img" :style="{ backgroundImage: `url(${item.poster})` }">
                <img src="@/static/playVideo-button.png" />
                <span class="item-img-runtime" v-if="item.runtime">{{ item.runtime }}</span>
                <div
                  class="item-img-process"
                  :style="{ width: Number(historyTv?.initialTime) / (Number(parseTime(item.runtime)) * 0.6) + '%' }"
                  v-if="index + 1 == historyTv?.ji && item.runtime && activeSeason.path + '/' + historyTv.name == '/' + historyTv.path"
                ></div>
              </div>
              <div class="item-title">{{ index + 1 + '.' + (item.title || t('video.episodeTitle', { episode: index + 1 })) }}</div>
            </div>
          </scroll-view>
        </div>
        <actor-list
          ref="actor_list"
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

<script setup lang="ts">
import { ref, onBeforeMount, nextTick } from 'vue'
import type {
  EmbyCollectionItem,
  ImgData,
  SourceItem,
  HistoryItem,
  SeasonItem,
  TvEpisode,
  ActiveSeason,
  HistoryTv,
  ActorListInstance,
  SourceList,
  MovieTvDetailType,
} from './types'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { useRoute } from 'vue-router'
import * as CONFIG from '@/utils/config'
import { getEmbyMovieTv, getEmbySeasonList, getEmbyList, setEmbyImg, getSeasonTvList } from '@/utils/emby'
import { calTime, handleSeasonName, handleSecond, debounce, parseTime } from '@/utils/scrape'
import { judgeSelect } from '@/utils/tools'
import { ipc } from '@/utils/ipcRenderer'
import { ipcApiRoute } from '@/utils/ipcApiRoute'
import actorList from '../home/components/actor-list.vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const route = useRoute()

const imgData = ref<Partial<ImgData>>({})
const overview = ref('') //剧情简介
const actor_list = ref(null)
const activeSeason = ref<Partial<SeasonItem>>({})
const seasonFirst = ref<{ img: string; overview: string }>({ img: '', overview: '' })
const tvList = ref<TvEpisode[]>([]) //目前Emby所拥有的电视集数列表
const historyPlay = ref<HistoryItem[]>(uni.getStorageSync('historyPlay') || []) //历史播放
const buttonText = ref(t('video.play'))
const firstEnter = ref(true)
const selectType = ref<Partial<SourceList>>({})
const selectMedia = ref<Record<string, any>>({})
const nowSourceList = ref<SourceList[]>([])
const showRehandleButton = ref(false)
const historyTv = ref<HistoryItem | Record<string, any> | undefined>({})
const scrollIntoView = ref<string>('name1')
const seasonArr = ref<SeasonItem[]>([]) //季的数组
const actorArr = ref<any[]>([]) //emby获取到的演员列表
const showActor = ref(false) //显示演员列表组件
const selectSource = ref<SourceItem | null>(null)
const allDetail = ref<MovieTvDetailType>({}) //如果电视剧有很多季,这个参数就存放总的电视剧的详情，用于初始化
const nowMovieTv = ref<any>({})
let nowTime = 0

//获取影片详情
const getMovieTvDetail = async (type = 'all') => {
  if (!route.query.movieTvId) {
    imgData.value.title = route.query.name ? String(route.query.name) : ''
    return false
  }
  if (route.query.type == 'tv') {
    if (activeSeason.value.season != '1') {
      imgData.value.title = route.query.name + ' ' + activeSeason.value.name
    } else {
      imgData.value.title = route.query.name as string
    }
  }
  let res: MovieTvDetailType = {}
  if (type == 'all') {
    res = (await getEmbyMovieTv({ movieTvId: route.query.movieTvId }, selectMedia.value)) as MovieTvDetailType
    allDetail.value = res
  } else if (type == 'season') {
    res = (await getEmbyMovieTv({ movieTvId: activeSeason.value.id }, selectMedia.value)) as MovieTvDetailType
  }
  res.overview ? (overview.value = res.overview) : (overview.value = allDetail.value.overview || '')
  actorArr.value = res.actors || []
  showActor.value = true
  let copyImgData = imgData.value
  if (route.query.type == 'movie') {
    imgData.value = {
      //如果季接口返回的值不存在，就用imgData原来的
      title: res.name || copyImgData.title,
      img: res.backdrop_path || copyImgData.img,
      score: res.vote_average?.toFixed(1) || copyImgData.score,
      releaseTime: res.release_date || copyImgData.releaseTime,
      runtime: calTime(res.runtime) || copyImgData.runtime,
      runtimeEn: calTime(res.runtime, 'en') || copyImgData.runtimeEn,
      genres: res.genres?.map(i => i.name).join(' ') || copyImgData.genres,
      size: res.size || copyImgData.size,
      poster: res.poster_path || copyImgData.poster,
      tmdbId: res.tmdbId || copyImgData.tmdbId,
      production_companies: res.production_companies || copyImgData.production_companies,
      overview: res.overview || copyImgData.overview,
      path: res.path || copyImgData.path,
    }
  } else if (route.query.type == 'tv') {
    seasonFirst.value.img = res.backdrop_path || ''
    if ((type == 'all' && seasonArr.value.length == 1) || (type == 'season' && seasonArr.value.length > 1)) {
      if (res.backdrop_path) imgData.value.img = res.backdrop_path
    }
    seasonFirst.value.overview = res.overview || ''
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
const changeTvSeason = async (obj: any) => {
  activeSeason.value = { ...seasonArr.value.find(v => v.name == obj.title) }
  if (activeSeason.value.season != '1') {
    imgData.value.title = route.query.name + ' ' + activeSeason.value.name
  } else {
    imgData.value.title = route.query.name ? String(route.query.name) : ''
  }
  getMovieTvDetail('season')
  handleTv()
}

//设置电视剧文件夹
const handleTv = async () => {
  let result: any = {}
  try {
    if (seasonArr.value.length == 1) {
      let embyObj = {
        ParentId: route.query.movieTvId,
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
        folderFileId: route.query.movieTvId,
      }
      result = await getSeasonTvList(embyObj, selectMedia.value)
    }
  } catch (error) {
    showRehandleButton.value = true
    return
  }
  tvList.value = result.Items.map((i: Pick<EmbyCollectionItem, 'Id' | 'Name'>) => {
    return {
      id: i.Id,
      name: i.Name,
      title: i.Name,
      provider: 'Emby',
      poster: setEmbyImg(i, selectMedia.value),
    }
  })
  console.log(tvList.value, '电视剧列表')
}

//设置按钮文字
const setButtonText = () => {
  historyPlay.value = uni.getStorageSync('historyPlay') || []
  historyPlay.value = historyPlay.value.filter(v => v.sourceType == selectType.value.type && v.sourceName == selectMedia.value.name)
  if (route.query.type == 'movie') {
    let history: HistoryItem | undefined = historyPlay.value?.find(i => handleSeasonName(i.name, true) == handleSeasonName(selectSource.value?.name, true))
    if (history && selectSource.value?.path == '/' + history.path) {
      buttonText.value = t('video.playWithTime', { time: handleSecond(history.initialTime) })
    } else {
      buttonText.value = t('video.play')
    }
  } else if (route.query.type == 'tv') {
    let history: HistoryItem | undefined = historyPlay.value?.find(i => {
      if (activeSeason.value.season == '1') {
        return i.titlePlay == handleSeasonName(selectSource.value?.name, true)
      } else {
        return i.titlePlay == handleSeasonName(selectSource.value?.name, true) + ' ' + activeSeason.value.name
      }
    })
    historyTv.value = history || {}
    if (history && activeSeason.value.path + '/' + history.name == '/' + history.path && history.season == activeSeason.value.season) {
      let time = handleSecond(history.initialTime)
      buttonText.value = t('video.episodeTitleWithTime', { episode: history.ji, time })
    } else {
      buttonText.value = t('video.play')
    }
  }
}

//通过 createMpv 打开播放窗口
const openMpvPlayer = (folderFileId: string | undefined) => {
  if (!folderFileId) return
  const args = {
    type: 'vue',
    content: '/video',
    windowName: 'Video',
    windowTitle: t('video.nowPlaying'),
    opusId: '1',
    windowsOption: {
      frame: false,
      width: 1358,
      height: 841,
      backgroundColor: '#000000',
    },
    query: {
      folderFileId,
      isEmby: 'true',
    },
  }
  ipc.invoke(ipcApiRoute.createMpv, args).then((id: number) => {
    console.log('[createWindow] id:', id)
  })
}

//点击播放按钮
const clickPlayButton = () => {
  uni.setStorageSync('overviewData', imgData.value)
  if (route.query.type == 'movie') {
    openMpvPlayer(String(route.query.movieTvId))
  } else if (route.query.type == 'tv') {
    uni.setStorageSync('tvList', tvList.value)
    openMpvPlayer(tvList.value[0]?.id)
  }
}

//电视剧点击某一集进行播放
const toPlayVideo = (item: TvEpisode, index: number) => {
  uni.setStorageSync('overviewData', imgData.value)
  if (route.query.type == 'movie') {
    openMpvPlayer(String(route.query.movieTvId))
  } else if (route.query.type == 'tv') {
    uni.setStorageSync('tvList', tvList.value) //用于给视频播放器页面显示集数
    openMpvPlayer(item.id)
  }
}

//从接口获取该剧集有多少个季
const getSeasonArr = async () => {
  const seasonInfo = {
    movieTvId: route.query.movieTvId,
    UserId: selectMedia.value.userId,
    Fields: 'BasicSyncInfo,CanDelete,CanDownload,PrimaryImageAspectRatio,Overview',
  }
  let res = await getEmbySeasonList(seasonInfo, selectMedia.value)
  seasonArr.value = res.Items.map((v: SeasonItem) => {
    return { name: v.Name, season: String(v.IndexNumber), id: v.Id }
  })
  activeSeason.value = { ...seasonArr.value[0] }
}
const setScrollIntoView = debounce((direction: string) => {
  handleSilde(direction)
}, 300)

const handleSilde = (direction: string) => {
  if (direction === 'left') {
    let number = Number(scrollIntoView.value.split('name')[1])
    if (number > 3) {
      scrollIntoView.value = 'name' + (number - 3)
    } else {
      scrollIntoView.value = 'name1'
    }
  } else if (direction === 'right') {
    let number = Number(scrollIntoView.value.split('name')[1])
    if (number < tvList.value.length - 4) {
      if (number + 3 >= tvList.value.length - 4) {
        scrollIntoView.value = 'name' + (tvList.value.length - 4)
      } else {
        scrollIntoView.value = 'name' + (number + 3)
      }
    } else {
      scrollIntoView.value = 'name' + (tvList.value.length - 4)
    }
  }
}

const slideTv = (direction: string) => {
  let time = Date.now()
  if (time - nowTime > 300) {
    handleSilde(direction)
  } else {
    setScrollIntoView(direction)
  }
  nowTime = time
}
onBeforeMount(async () => {
  const selectData = judgeSelect('emby')
  selectMedia.value = selectData.selectMedia
  selectType.value = selectData.selectType as any
  if (route.query.type == 'tv') {
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
</script>

<style lang="scss" scoped>
.detail {
  width: 100%;
  height: 100%;
  position: relative;

  .detail-background {
    position: absolute;
    width: 100%;
    height: 100%;
    top: 0;
    left: 0;
    z-index: 1;
    background-position: center;
    background-repeat: no-repeat;
    background-size: cover;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      position: absolute;
      left: 0;
      top: 0;
      z-index: 1;
    }

    .detail-background-overlay {
      width: 100%;
      height: 100%;
      // background: rgba(0, 0, 0, 0.8);
      background: rgba(255, 255, 255, 0.7);
      position: absolute;
      left: 0;
      top: 0;
      z-index: 2;
    }
  }

  .detail-content {
    width: 100%;
    height: 100%;
    overflow: auto;
    position: relative;
    z-index: 2;
    padding-bottom: 60rpx;

    .detail-info {
      z-index: 2;
      position: relative;
      padding: 0 100rpx;
      margin-top: 24rpx;
      display: flex;

      .detail-info-img {
        width: 600rpx;
        height: 900rpx;

        img {
          width: 100%;
          height: 100%;
          border-radius: 40rpx;
        }
      }

      .detail-info-right {
        margin-left: 48rpx;
        flex: 1;

        .detail-info-right__name {
          font-size: 60rpx;
          font-weight: bold;
        }

        .detail-info-right__mid {
          display: flex;
          align-items: center;
          margin-top: 24rpx;

          .mid-score {
            display: flex;
            align-items: center;
            font-size: 30rpx;
            color: #000;

            img {
              width: 40rpx;
              height: 40rpx;
            }
          }

          .mid-date {
            display: flex;
            align-items: center;
            font-size: 30rpx;
            color: #000;
            margin-left: 24rpx;

            img {
              width: 40rpx;
              height: 40rpx;
            }
          }

          .mid-runtime {
            margin-left: 24rpx;
            font-size: 30rpx;
            color: #000;
            display: flex;
            align-items: center;

            img {
              width: 40rpx;
              height: 40rpx;
            }
          }
        }

        .detail-info-right__genre {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          font-size: 30rpx;
          margin-top: 24rpx;

          .genre-size {
            margin-left: 14rpx;
          }
          .genre-value {
            background: rgb(240, 240, 240);
            padding: 10rpx 24rpx;
            border-radius: 16rpx;
            margin-left: 24rpx;
            &:first-child {
              margin-left: 0;
            }
          }
        }

        .detail-info-right__button {
          display: flex;
          align-items: center;
          margin-top: 24rpx;

          :deep(.nut-button) {
            border-radius: 16rpx;
            height: 80rpx;

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

          .button-more {
            width: 80rpx;
            height: 80rpx;
            border-radius: 50%;
            background: #090909;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-left: 24rpx;
            cursor: pointer;

            img {
              width: 50rpx;
              height: 50rpx;
            }
          }
        }

        .detail-info-right__overview {
          display: -webkit-box;
          -webkit-line-clamp: 3;
          /* 限制显示的行数 */
          -webkit-box-orient: vertical;
          overflow: hidden;
          text-overflow: ellipsis;
          font-size: 32rpx;
          margin-top: 24rpx;
          line-height: 50rpx;
        }
        .detail-info-right__platform {
          margin-top: 24rpx;
          width: 100%;
          .platform-title {
            font-size: 32rpx;
          }
          .platform-list {
            display: flex;
            align-items: center;
            flex-wrap: wrap;
            width: 100%;
            .platform-list-item {
              background: rgb(240, 240, 240);
              width: auto;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 10rpx 16rpx;
              border-radius: 16rpx;
              font-size: 24rpx;
              margin-left: 24rpx;
              margin-bottom: 24rpx;
              &:first-child {
                margin-left: 0;
              }
              img {
                height: 40rpx;
              }
            }
          }
        }
      }
    }

    .detail-container {
      position: relative;
      z-index: 2;
      margin-top: 50rpx;
      padding: 0 100rpx;

      .detail-container-source {
        display: flex;
        align-items: center;

        .source-item {
          font-size: 28rpx;
          color: #000;
          font-weight: bold;
          padding: 12rpx 24rpx;
          border-radius: 8rpx;
          border: 2rpx solid #000;
          margin-left: 12rpx;
          white-space: nowrap;
          cursor: pointer;

          &:first-child {
            margin-left: 0;
          }
        }

        .source-active {
          color: #315ffd;
          border: 2rpx solid #315ffd;
        }
      }

      .detail-container-tabs {
        display: flex;
        justify-content: flex-end;
        align-items: center;
        margin-bottom: 24rpx;

        .detail-container-tabs__list {
          flex: 0 0 50%;

          :deep(.nut-tabs) {
            .nut-tabs__titles {
              background-color: transparent !important;

              .nut-tabs__list {
                .nut-tabs__titles-item {
                  // width: 92px;
                  // flex: 0 0 92px;
                  flex: 0 0 auto;
                  min-width: auto;
                  width: auto;
                  margin-left: 30rpx;
                  cursor: pointer;

                  &:first-child {
                    margin-left: 0;
                  }
                }

                .nut-tabs-active {
                  color: #090909;

                  .nut-tabs__titles-item__line {
                    width: 100%;
                    border-radius: 8rpx;
                    bottom: 12%;
                  }
                }
              }
            }

            .nut-tabs__content {
              display: none;
            }
          }
        }

        .detail-container-tabs__arrow {
          display: flex;
          align-items: center;

          .arrow-left {
            width: 56rpx;
            height: 56rpx;
            border-radius: 50%;
            border: 2rpx solid #000;
            padding: 10rpx;
            cursor: pointer;
            box-sizing: border-box;
            display: flex;
            align-items: center;
            justify-content: center;

            img {
              width: 100%;
              height: 100%;
            }
          }

          .arrow-right {
            width: 56rpx;
            height: 56rpx;
            border-radius: 50%;
            border: 2rpx solid #000;
            padding: 10rpx;
            margin-left: 24rpx;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;

            img {
              width: 100%;
              height: 100%;
              transform: rotate(180deg);
            }
          }
        }
      }

      .detail-container-tv {
        .tv-list {
          width: 100%;
          height: 100%;
          overflow: hidden;

          ::v-deep .uni-scroll-view-content {
            display: flex;
            flex-direction: row;
            align-items: center;
            flex-wrap: nowrap;
            width: 100%;
            // height: 250rpx;
          }

          .tv-list-item {
            margin-left: 24rpx;
            flex: 0 0 calc((100% - 96rpx) / 5);
            overflow: hidden;
            cursor: pointer;

            &:first-child {
              margin-left: 0;
            }

            .item-img {
              width: 100%;
              aspect-ratio: 169.5/90;
              background: rgb(212, 212, 212);
              background-position: center;
              background-repeat: no-repeat;
              background-size: cover;
              border-radius: 16rpx;
              position: relative;
              overflow: hidden;

              img {
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
              color: #000;
              font-weight: bold;
              padding-top: 12rpx;
              width: 100%;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
          }
        }
      }
    }
  }
}
</style>
