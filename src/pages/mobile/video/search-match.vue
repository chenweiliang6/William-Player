<template>
  <div :class="['search-match', themeClass]">
    <div class="search-match-title">{{ t('navbar.searchAndMatchVideo') }}</div>
    <nut-searchbar v-model="searchValue" :placeholder="t('video.inputVideoNameSearch')" @search="toSearch" @clear="toCancel">
      <template #leftin>
        <nut-icon name="search" :custom-color="iconColor"></nut-icon>
      </template>
      <template #rightout>
        <span :style="{ color: searchValue ? 'var(--app-brand)' : 'var(--app-text-tertiary)' }" @click="toSearch" v-if="!requestParams.query">
          {{ t('video.search') }}
        </span>
        <span v-else :style="{ color: 'var(--app-brand)' }" @click="toCancel">{{ t('common.cancel') }}</span>
      </template>
    </nut-searchbar>
    <div class="search-match-list">
      <wil-list
        :requestFn="searchMovieTv"
        :request-params="requestParams"
        :responseAdapter="responseAdapter"
        ref="wil_list"
        :refresherEnabled="false"
        idKey="id"
        :pageSize="20"
        pageNumKey="page"
        v-if="requestParams.query"
      >
        <template #default="item">
          <div
            class="search-match-list__item"
            @click="handleSelect(item, item.$index)"
            :style="{ borderColor: activeIndex == item.$index ? '#ff6701' : 'rgb(235, 235, 235)' }"
          >
            <div class="item-left" :style="{ backgroundImage: `url(${CONFIG.IMG_DOMAIN}/t/p/w300_and_h450_bestv2${item.poster_path})` }">
              <div :class="['item-left-logo', item.media_type == 'tv' ? 'item-left-tv' : '']">
                <template v-if="item.media_type == 'tv'">
                  <wil-icon name="xianshiping" custom-color="#ffffff" />
                  <span>{{ t('video.tv') }}</span>
                </template>
                <template v-else>
                  <wil-icon name="dianying" custom-color="#ffffff" />
                  <span>{{ t('video.movie') }}</span>
                </template>
              </div>
            </div>
            <div class="item-right">
              <div class="item-right-name">
                {{ item.name || item.title }}
              </div>
              <div class="item-right-content">
                <div class="item-right-content__date">
                  <nut-icon name="date" size="14" custom-color="#7a787b"></nut-icon>
                  <span>{{ item.first_air_date || item.release_date || t('video.noReleaseTime') }}</span>
                </div>
                <div class="item-right-content__line"></div>
                <div class="item-right-content__type">{{ item.media_type == 'tv' ? t('video.tv') : t('video.movie') }}</div>
              </div>
              <div class="item-right-overview">{{ item.overview || '...' }}</div>
            </div>
          </div>
        </template>
      </wil-list>
      <wil-empty v-else :text="t('video.onlySearchVideoName')"></wil-empty>
    </div>
    <wil-modal ref="wil_modal"></wil-modal>
    <nut-popup v-model:visible="showSeason" position="bottom" round safe-area-inset-bottom>
      <nut-picker v-model="popupValue" :columns="seasonColumns" :title="t('video.selectSeason')" @confirm="confirmPicker" @cancel="showSeason = false"></nut-picker>
    </nut-popup>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import wilList from '@/components/mobile/wil-list/index'
import wilEmpty from '@/components/mobile/wil-empty/index'
import wilIcon from '@/components/common/wil-icon/index.vue'
import wilModal from '@/components/mobile/wil-modal/index.vue'
import { generateChineseNumberMapping, getMovieTvData, applyManualMatch, findInView, normalizeMediaType, fetchDetailForManualMatch } from '@/utils/scrape'
import { onLoad } from '@dcloudio/uni-app'
import * as CONFIG from '@/utils/config'
import { useThemeNavbar } from '@/hooks/useThemeNavbar'
import { useI18nNavbar } from '@/hooks/useI18nNavbar'
import { useThemeClass } from '@/hooks/useThemeClass'
import { useThemeColors } from '@/hooks/useThemeColors'
import { searchMovieTvMulti, getTvDetail, getMovieDetail } from '@/utils/tmdb'

useThemeNavbar({ variant: 'secondary' })
useI18nNavbar('navbar.editInformation')
const { t } = useI18n()
const themeClass = useThemeClass()
const { iconColor } = useThemeColors()
const searchValue = ref('')
const requestParams = ref({})
const activeIndex = ref(null)

const showSeason = ref(false)
const popupValue = ref([])
const seasonColumns = ref([])
const selectItem = ref({})

const routerParams = ref({})

const wil_modal = ref(null)

const responseAdapter = result => {
  if (!result) {
    return {
      listData: [],
      listTotal: 0,
    }
  }
  return {
    listData: result.results || [],
    listTotal: +result.total_results,
  }
}
//通过tmdb接口根据关键词搜索影视
const searchMovieTv = data => searchMovieTvMulti(data)

const toSearch = () => {
  requestParams.value.query = searchValue.value
}

const toCancel = () => {
  searchValue.value = ''
  requestParams.value.query = ''
}

const handleSelect = async (item, index) => {
  activeIndex.value = index
  selectItem.value = item
  let res = {}
  if (item.media_type == 'tv') {
    res = await getTvDetail(item.id)
    if (routerParams.value.maxSeasonLength > res.seasons.length) {
      uni.showToast({
        title: t('video.librarySeasonMoreThanCurrent'),
        icon: 'none',
      })
      return
    } else {
      if (res.seasons.length >= 2 && routerParams.value.maxSeasonLength == 1) {
        seasonColumns.value = res.seasons.map(v => {
          return { text: v.name, value: v.season_number }
        })
        showSeason.value = true
        return
      }
    }
  } else {
    res = await getMovieDetail(item.id)
  }

  wil_modal.value.showModal({
    title: t('modal.warmTip'),
    content: t('video.matchVideoConfirm'),
    confirmColor: '#ff6701',
    confirm: async () => {
      // 新库模式：从「其他」分区带 workKey 进来，直接改写库里的 Work。
      // 这是未识别条目的修正入口——自动匹配覆盖不到的情况靠它兜底。
      if (routerParams.value.workKey) {
        const type = normalizeMediaType(item.media_type)
        // 与旧分支一致：禁止把电影手动纠成剧集（反之亦然）。
        // 跨类型改写会打乱 seasons 结构，且与碰撞裁决语义冲突。
        if (normalizeMediaType(routerParams.value.type) !== type) {
          const mapping = { tv: t('video.tv'), movie: t('video.movie') }
          uni.showToast({
            title: t('video.currentVideoTypeMismatch', {
              currentType: mapping[normalizeMediaType(routerParams.value.type)],
              selectedType: mapping[type],
            }),
            icon: 'none',
          })
          return
        }
        const detail = await fetchDetailForManualMatch(item)
        const result = applyManualMatch({
          workKey: routerParams.value.workKey,
          tmdbDetail: detail,
        })
        if (result?.conflict) {
          // 目标影片已在库中：拦下来，避免产生重复 workId 被下次启动静默折叠
          uni.showToast({ title: t('video.duplicateVideoInLibrary'), icon: 'none' })
          return
        }
        if (!result?.work) {
          uni.showToast({ title: t('video.matchFailed', { default: '匹配失败' }), icon: 'none' })
          return
        }
        uni.showToast({ title: t('video.matchSuccess', { default: '已修正' }), icon: 'none' })
        setTimeout(() => uni.navigateBack(), 600)
        return
      }

      let localMovieTvData = getMovieTvData()
      const type = normalizeMediaType(item.media_type)
      // 重复检查必须按「类型 + id」——只比数字会让「库里已有同号电影」
      // 挡住合法的同号剧集（TMDB 的 movie id 与 tv id 是两套独立空间）。
      if (findInView(localMovieTvData, { mediaType: type, tmdbId: item.id })) {
        uni.showToast({
          title: t('video.duplicateVideoInLibrary'),
          icon: 'none',
        })
        return
      }
      const mapping = {
        tv: t('video.tv'),
        movie: t('video.movie'),
      }
      if (normalizeMediaType(routerParams.value.type) !== type) {
        uni.showToast({
          title: t('video.currentVideoTypeMismatch', {
            currentType: mapping[normalizeMediaType(routerParams.value.type)],
            selectedType: mapping[type],
          }),
          icon: 'none',
        })
        return
      }
      uni.setStorageSync('resetMovieTv', { type: type, movieTvId: item.id, name: item.name || item.title }) //设置到缓存，详情页去获取
      uni.navigateBack()
    },
  })
}


const confirmPicker = ({ selectedValue, selectedOptions }) => {
  let localMovieTvData = getMovieTvData()
  let type = normalizeMediaType(selectItem.value.media_type)
  // 按「类型 + id」查重：剧集额外比较季号，电影只看身份
  const dup = findInView(localMovieTvData, { mediaType: type, tmdbId: selectItem.value.id })
  if (dup && (type === 'movie' || selectedValue[0] == dup.season)) {
    uni.showToast({
      title: t('video.duplicateVideoInLibrary'),
      icon: 'none',
    })
    return
  }
  const mapping = {
    tv: t('video.tv'),
    movie: t('video.movie'),
  }
  if (normalizeMediaType(routerParams.value.type) !== type) {
    uni.showToast({
      title: t('video.currentVideoTypeMismatch', {
        currentType: mapping[normalizeMediaType(routerParams.value.type)],
        selectedType: mapping[type],
      }),
      icon: 'none',
    })
    return
  }
  const numberMapping = generateChineseNumberMapping(40, 'number')
  // console.log(selectedValue[0],'选择');
  let season = selectedValue[0] == '1' || !numberMapping[selectedValue[0]] ? '' : ` ${t('video.seasonTitle', { season: selectedValue[0] })}`
  if (selectedValue[0] == '0') season = ` ${t('video.specialEpisode')}`
  console.log(selectItem.value.name + season)

  uni.setStorageSync('resetMovieTv', {
    type: type,
    movieTvId: selectItem.value.id,
    name: routerParams.value.type == 'tv' ? selectItem.value.name + season : selectItem.value.title,
  }) //设置到缓存，详情页去获取
  uni.navigateBack()
}

onLoad(options => {
  routerParams.value = options
  // 从「其他」分区的「修正匹配」带 query 进来时，预填搜索词并直接搜一次，
  // 省得用户再手工输入一遍片名
  if (options?.query) {
    // uni 的 onLoad 已经对 URL 参数做过一次 decodeURIComponent，
    // 这里再解一次遇到片名含 `%` 会抛 URIError。失败就沿用原值。
    let q = options.query
    try { q = decodeURIComponent(q) } catch { /* 已是解码后的值 */ }
    searchValue.value = q
    requestParams.value = { query: q }
  }
})
</script>

<style lang="scss" scoped>
page {
  width: 100%;
  height: 100%;
}
.search-match {
  padding: 24rpx 24rpx 0 24rpx;
  background: var(--app-bg);
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  .search-match-title {
    font-size: 36rpx;
    font-weight: bold;
  }
  :deep(.nut-searchbar) {
    padding: 18rpx 0;
    .nut-searchbar__search-input {
      border-radius: 12rpx;
      align-items: center;
      overflow: hidden;
      .nut-searchbar__input-bar {
        color: var(--app-text-primary);
        min-height: 0;
      }
    }
    .nut-searchbar__search-icon {
      margin-top: -6rpx;
      span {
        font-size: 30rpx;
      }
    }
    .nut-searchbar__right-search-icon {
      margin-top: 0;
      white-space: nowrap;
    }
  }
  .search-match-list {
    display: flex;
    // align-items: center;
    justify-content: center;
    flex: 1;
    overflow: hidden;
    :deep(.load-list) {
      .search-match-list__item {
        margin-bottom: 24rpx;
        border-radius: 16rpx;
        border: 2rpx solid var(--app-border);
        display: flex;
        align-items: center;
        .item-left {
          width: 180rpx;
          height: 250rpx;
          background-position: center;
          background-repeat: no-repeat;
          background-size: cover;
          border-radius: 16rpx 0 0 16rpx;
          position: relative;
          .item-left-logo {
            display: inline-flex;
            align-items: center;
            background: #031963;
            border-radius: 16rpx 0 16rpx 0;
            padding: 8rpx;
            position: absolute;
            top: 0;
            left: 0;
            .iconfont {
              width: 24rpx;
              height: 24rpx;
              font-size: 24rpx;
            }
            span {
              font-size: 22rpx;
              color: #fff;
              padding-left: 4rpx;
            }
          }
          .item-left-tv {
            background: #315bfd;
          }
        }
        .item-right {
          margin-left: 20rpx;
          flex: 1;
          overflow: hidden;
          padding-right: 20rpx;
          box-sizing: border-box;
          .item-right-name {
            font-size: 30rpx;
            color: var(--app-text-primary);
            font-weight: bold;
            display: -webkit-box; /* 启用弹性盒子布局 */
            -webkit-box-orient: vertical; /* 设置子元素垂直排列 */
            -webkit-line-clamp: 2; /* 限制显示行数为2行 */
            overflow: hidden; /* 隐藏超出内容 */
            text-overflow: ellipsis;
          }
          .item-right-content {
            display: flex;
            align-items: center;
            color: var(--app-text-tertiary);
            font-size: 28rpx;
            margin-top: 20rpx;
            .item-right-content__date {
              display: flex;
              align-items: center;
              span {
                padding-left: 10rpx;
              }
            }
            .item-right-content__line {
              height: 28rpx;
              width: 2rpx;
              background: var(--app-border-strong);
              margin: 0 20rpx;
            }
          }
          .item-right-overview {
            display: -webkit-box; /* 启用弹性盒子布局 */
            -webkit-box-orient: vertical; /* 设置子元素垂直排列 */
            -webkit-line-clamp: 2; /* 限制显示行数为2行 */
            overflow: hidden; /* 隐藏超出内容 */
            text-overflow: ellipsis;
            width: 100%;
            font-size: 28rpx;
            color: var(--app-text-tertiary);
            padding-top: 16rpx;
          }
        }
      }
    }
  }
}
// @media (prefers-color-scheme: dark) {
//   .search-match {
//     background: #1e1e20;
//     ::v-deep .nut-searchbar {
//       background-color: #1e1e20;
//       .nut-searchbar__search-input {
//         background: #2f2f2f;
//         .nut-searchbar__search-icon {
//           .nut-icon-search {
//             color: #606060 !important;
//           }
//         }
//         .nut-searchbar__input-inner {
//           .nut-searchbar__input-form {
//             .uni-input-input {
//               color: #fff;
//             }
//           }
//         }
//       }
//     }
//     .search-match-list {
//       ::v-deep .load-list {
//         .search-match-list__item {
//           border: 2rpx solid rgb(40, 40, 40);

//           .item-right {
//             .item-right-name {
//               color: #fff;
//             }
//             .item-right-content {
//               color: #cacaca;
//               .item-right-content__line {
//                 background: #cacaca;
//               }
//             }
//             .item-right-overview {
//               color: #cacaca;
//             }
//           }
//         }
//       }
//     }
//   }
// }
</style>
