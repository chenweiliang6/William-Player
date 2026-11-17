<template>
  <div class="star-recommend" :style="{ '--navbar-height': navBarHeight }">
    <wil-swiper :options="listData" :auto-play="3000" :pagination-visible="true" imgMode="aspectFill">
      <template #item="data">
        <div class="swiper-content" @click="toVideoDetail(data)">
          <div class="swiper-content-container">
            <div class="swiper-content-left">
              <image mode="aspectFill" :src="CONFIG.IMG_DOMAIN + '/t/p/w300_and_h450_bestv2' + data.poster" />
            </div>
            <div class="swiper-content-right">
              <div class="right-genres">{{ data.genres }}</div>
              <div class="right-name">{{ handleSeasonName(data.name, true) }}</div>
              <div class="right-info">
                <div class="right-info-date">{{ data.releaseTime }}</div>
                <div class="right-info-star">
                  <wil-icon name="shoucang" custom-color="#f4bc22" />
                  <span>{{ data.voteAverage.toFixed(1) }}</span>
                </div>
              </div>
              <div class="right-desc">{{ data.overview }}</div>
            </div>
          </div>
        </div>
      </template>
    </wil-swiper>
  </div>
</template>

<script setup>
import wilSwiper from '@/components/mobile/wil-swiper/index.vue'
import wilIcon from '@/components/common/wil-icon/index.vue'
import { ref, watch } from 'vue'
import { classifyList, handleSeasonName, getMovieTvData } from '@/utils/scrape'
import { onShow } from '@dcloudio/uni-app'
import * as CONFIG from '@/utils/config'
import { useI18n } from 'vue-i18n'
import { useLocaleStore } from '@/stores/locale'

const { t } = useI18n()
const localeStore = useLocaleStore()
const listData = ref([])
const navBarHeight = ref('')
const removeExtension = filename => {
  let name = handleSeasonName(filename, true)
  if (name.length > 7) {
    name = name.slice(0, 6) + '...'
  }
  return name
}

const toVideoDetail = item => {
  uni.navigateTo({
    url: `/pages/mobile/video/video-detail?path=${item.path}&name=${handleSeasonName(item.name, true)}&type=${item.type}&source=${JSON.stringify(item.source)}&movieTvId=${item.movieTvId}&workKey=${encodeURIComponent(item.workKey || '')}`,
  })
}

//计算设备navBar高度
const getNavHeight = () => {
  let sysinfo = uni.getSystemInfoSync() // 获取设备系统对象
  let statusBarHeight = sysinfo.statusBarHeight // 获取状态栏高度
  navBarHeight.value = statusBarHeight + 44 + 'px' //计算nav导航栏的高度
}

//计算h5的navBar高度
const getH5NavbarHeight = () => {
  navBarHeight.value = '44px'
}
// #ifdef H5
getH5NavbarHeight()
// #endif

// #ifndef H5
getNavHeight()
// #endif
const getGenreText = genreId => {
  const genre = classifyList.find(item => item.id == genreId)
  return genre ? t(genre.labelKey) : ''
}

const getRecommendList = () => {
  let localMovieTvData = getMovieTvData() || {}
  let tv = []
  if (localMovieTvData?.tv) {
    tv = localMovieTvData.tv.filter(v => v.voteAverage).sort((a, b) => b.voteAverage - a.voteAverage)
    tv = tv.slice(0, 3).map(item => {
      let genres = ''
      item.type = 'tv'
      item.genre_ids?.forEach((v, vindex) => {
        if (vindex < item.genre_ids.length - 1) {
          genres += getGenreText(v) ? getGenreText(v) + ' ' : ''
        } else {
          genres += getGenreText(v) || ''
        }
      })
      item.genres = genres
      item.underImg = CONFIG.IMG_DOMAIN + '/t/p/w1920_and_h1080_bestv2' + item.backdrop
      return item
    })
  }
  let movie = []
  if (localMovieTvData?.movie) {
    movie = localMovieTvData.movie.filter(v => v.voteAverage).sort((a, b) => b.voteAverage - a.voteAverage)
    movie = movie.slice(0, 3).map(item => {
      item.name = removeExtension(item.name)
      item.type = 'movie'
      let genres = ''
      item.genre_ids?.forEach((v, vindex) => {
        if (vindex < item.genre_ids.length - 1) {
          genres += getGenreText(v) ? getGenreText(v) + ' ' : ''
        } else {
          genres += getGenreText(v) || ''
        }
      })
      item.genres = genres
      item.underImg = CONFIG.IMG_DOMAIN + '/t/p/w1920_and_h1080_bestv2' + item.backdrop
      return item
    })
  }
  listData.value = [...tv, ...movie]
}

onShow(getRecommendList)

watch(
  () => localeStore.locale,
  () => {
    getRecommendList()
  }
)
</script>

<style lang="scss" scoped>
@media (min-width: 700px) {
  .star-recommend {
    // height: 800rpx !important;
    height: calc(800rpx + var(--navbar-height)) !important;
  }
}

.star-recommend {
  // height: 500rpx;
  height: calc(500rpx + var(--navbar-height));

  ::v-deep .wil-swiper {
    padding-top: 44px;

    .nut-swiper {
      .nut-swiper-inner {
        .nut-swiper-item {
          .swiper-content {
            width: 100%;
            height: 100%;
            box-sizing: border-box;
            // padding: 140rpx 0 0 0;
            // 底部渐隐要融进页面底色，用 --app-bg-secondary（.video 的背景色），
            // 不能用 --app-bg-card：卡片色比页面底色亮，会在轮播与列表之间留一道接缝
            background: linear-gradient(180deg, transparent, var(--app-bg-secondary));

            .swiper-content-container {
              padding: 0 24rpx;
              box-sizing: border-box;
              width: 100%;
              height: 100%;
              display: flex;
              align-items: center;
            }

            .swiper-content-left {
              flex: 0 0 192.6rpx;
              height: 270rpx;
              border-radius: 12rpx;

              image {
                width: 100%;
                height: 100%;
                border-radius: 12rpx;
              }
            }

            .swiper-content-right {
              flex: 1;
              overflow: hidden;
              height: 270rpx;
              margin-left: 24rpx;
              display: flex;
              flex-direction: column;
              justify-content: space-between;

              .right-genres {
                font-size: 26rpx;
                color: var(--app-text-primary);
              }

              .right-name {
                font-size: 32rpx;
                color: var(--app-text-primary);
              }

              .right-info {
                display: flex;
                align-items: center;
                font-size: 24rpx;
                font-weight: bold;
                color: var(--app-text-secondary);

                .right-info-star {
                  display: flex;
                  align-items: center;
                  margin-left: 50rpx;

                  image {
                    width: 30rpx;
                    height: 30rpx;
                  }
                }
              }

              .right-desc {
                font-size: 28rpx;
                color: var(--app-text-secondary);
                display: -webkit-box;
                -webkit-line-clamp: 3;
                /* 限制行数（可调整） */
                -webkit-box-orient: vertical;
                overflow: hidden;
                text-overflow: ellipsis;
              }
            }
          }
        }
      }
    }
  }
}
</style>
