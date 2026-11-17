<template>
  <div class="search">
    <div class="search-title">
      <wil-icon name="arrow-left-copy" custom-color="#000000" class="search-back" @click="back" />
      <el-input v-model="searchValue" :placeholder="t('video.inputVideoNameSearch')" clearable @keydown.enter="toSearch" @clear="toSearch">
        <template #prefix>
          <wil-icon name="sousuo" custom-color="#000000" />
        </template>
      </el-input>
      <el-button @click="toSearch">{{ t('video.search') }}</el-button>
    </div>
    <div class="search-container">
      <div class="search-container-tabs">
        <el-tabs v-model="activeName" @tab-change="changeTab">
          <el-tab-pane :label="item.label" :name="item.name" v-for="item in tabsList" :key="item.name"></el-tab-pane>
        </el-tabs>
      </div>
      <div class="search-container-list">
        <wil-list
          :requestFn="getList"
          ref="wil_list"
          :refresherEnabled="false"
          idKey="path"
          listContainerClass="list-container"
          :pageSize="50"
          :request-params="requestParams"
        >
          <template #default="item">
            <div class="search-container-list__item" @click="toDetail(item)">
              <div class="item-poster">
                <img :src="setEmptyImg(item.poster)" class="item-poster-image" />
              </div>
              <span class="item-name">{{ removeExtension(item) }}</span>
              <span class="item-time" v-if="!item.notShowTime">{{ item.releaseTime || t('video.noReleaseTime') }}</span>
            </div>
          </template>
        </wil-list>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { getMovieTvData } from '@/utils/scrape'
import { ref } from 'vue'
import { ElInput, ElButton, ElTabs, ElTabPane } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import wilList from '@/components/mobile/wil-list/index.vue'
import wilIcon from '@/components/common/wil-icon/index.vue'
import posterEmpty from '@/static/poster-empty.png'
import * as CONFIG from '@/utils/config'
import { handleSeasonName } from '@/utils/scrape'
import type { TabPaneName } from 'element-plus'
import { getMainView, getEmbyList, setEmbyImg } from '@/utils/emby'
import dayjs from 'dayjs'
import type { EmbyCollectionItem, SourceList } from '../emby/types'
import { judgeSelect } from '@/utils/tools'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const route = useRoute()
const router = useRouter()
const oldValue = ref('')
const searchValue = ref('')
const activeName = ref<TabPaneName>('')
const tabsList = ref<{ name: string; label: string }[]>([])
const movieArr = ref<any[]>([])
const tvArr = ref<any[]>([])
const wil_list = ref<InstanceType<typeof wilList> | null>(null)
const requestParams = ref<Record<string, any> | null>(null)
const sourceList = ref<SourceList[]>([])
const selectType = ref<Partial<SourceList>>({})
const selectMedia = ref<Record<string, any>>({})

const back = () => {
  router.go(-1)
}

// 搜索结果的详情跳转（模板里 @click="toDetail(item)" 一直绑着但函数没定义，
// 导致点击必抛 toDetail is not defined）。
const toDetail = (item: any) => {
  router.push({
    path: '/homeDetail',
    query: {
      name: handleSeasonName(item.name, true),
      type: item.type == '1' ? 'tv' : 'movie',
      source: JSON.stringify(item.source),
      movieTvId: item.movieTvId,
      workKey: item.workKey || '',
    },
  })
}

const setEmptyImg = (poster: string) => {
  if (poster) {
    if (route.query.isEmby === '1') {
      return poster
    } else {
      return CONFIG.IMG_DOMAIN + '/t/p/w300_and_h450_bestv2' + poster
    }
  } else {
    return posterEmpty
  }
}
const removeExtension = (item: any) => {
  const firstDotIndex = item.name.indexOf('.')
  let name = firstDotIndex === -1 ? item.name : item.name.substring(0, firstDotIndex)
  name = handleSeasonName(name, true)
  if (name.length > 7) {
    name = name.slice(0, 6) + '...'
  }
  return name
}

//判断选择的是哪个emby
const initSelect = () => {
  const { selectMedia: media, selectType: type }: { selectMedia: Record<string, any>; selectType: any } = judgeSelect('emby')
  selectMedia.value = media
  selectType.value = type
}
//初始化tabsList
const initTabsList = async () => {
  if (route.query.isEmby !== '1') {
    activeName.value = 'movie'
    tabsList.value = [
      { name: 'movie', label: t('video.movie') },
      { name: 'tv', label: t('video.tv') },
    ]
  } else {
    let res = await getMainView(selectMedia.value)
    const typeMapping = {
      tvshows: 'Series',
      movies: 'Movie',
    } as const
    tabsList.value = res.Items.map((item: EmbyCollectionItem) => {
      return { name: typeMapping[item.CollectionType as keyof typeof typeMapping], label: item.Name }
    })
    activeName.value = tabsList.value[0]?.name || ''
  }
}

//切换tab
const changeTab = (val: TabPaneName) => {
  activeName.value = val
  wil_list.value?.reload()
}

//搜索的方法
const toSearch = () => {
  if (oldValue.value === searchValue.value) return
  if (!searchValue.value) {
    requestParams.value = null
    movieArr.value = []
    tvArr.value = []
    oldValue.value = ''
    return
  }
  if (route.query.isEmby !== '1') {
    let data = getMovieTvData()
    movieArr.value = data.movie.filter((item: any) => item.name.indexOf(searchValue.value) > -1)
    tvArr.value = data.tv.filter((item: any) => item.name.indexOf(searchValue.value) > -1)
    requestParams.value = {}
    wil_list.value?.reload()
  } else {
    requestParams.value = {}
    wil_list.value?.reload()
  }
  oldValue.value = searchValue.value
}

//wil-list分页获取数据的方法
const getList = async (params: { pageNum: number; pageSize: number }) => {
  if (route.query.isEmby !== '1') {
    const startIndex = (params.pageNum - 1) * params.pageSize
    const endIndex = params.pageNum * params.pageSize
    if (activeName.value === 'movie') {
      return {
        code: 200,
        rows: movieArr.value.slice(startIndex, endIndex),
        total: movieArr.value?.length,
      }
    } else if (activeName.value === 'tv') {
      return {
        code: 200,
        rows: tvArr.value.slice(startIndex, endIndex),
        total: tvArr.value?.length,
      }
    }
  } else {
    let res = await getEmbyList(
      {
        IncludeItemTypes: activeName.value,
        Fields: 'BasicSyncInfo,CanDelete,CanDownload,PrimaryImageAspectRatio,ProductionYear,Status,EndDate',
        StartIndex: (params.pageNum - 1) * params.pageSize,
        Limit: params.pageSize,
        SortBy: 'SortName',
        SortOrder: 'Ascending',
        EnableImageTypes: 'Primary,Backdrop,Thumb',
        ImageTypeLimit: '1',
        Recursive: true,
        SearchTerm: searchValue.value,
        IncludeSearchTypes: false,
      },
      selectMedia.value
    )
    let rows = res.Items.map((item: EmbyCollectionItem & { Type: string; ProductionYear: string }) => {
      return {
        id: item.Id,
        type: item.Type == 'Series' ? '1' : '0',
        poster: setEmbyImg(item, selectMedia.value),
        name: item.Name,
        releaseTime: item.ProductionYear + (item.EndDate ? `-${dayjs(item.EndDate).format('YYYY')}` : ''),
      }
    })
    return { total: res.TotalRecordCount, rows }
  }
}
initSelect()
initTabsList()
</script>

<style lang="scss" scoped>
.search {
  width: 100%;
  height: 100%;
  padding: 24rpx;
  display: flex;
  flex-direction: column;
  .search-title {
    display: flex;
    align-items: center;
    .search-back {
      font-size: 40rpx;
      margin-right: 36rpx;
      cursor: pointer;
    }
    :deep(.el-input) {
      line-height: 80rpx;
      .el-input__wrapper {
        box-shadow: none;
        border-radius: 24rpx;
        background: rgb(235, 235, 235);
        .el-input__inner {
          height: 76rpx;
        }
      }
    }
    :deep(.el-button) {
      margin-left: 36rpx;
      border: none;
      color: #fa851e;
      height: auto;
      span {
        font-size: 32rpx;
        line-height: 36rpx;
      }
      &:hover {
        background: #e9e9e9;
      }
    }
  }
  .search-container {
    margin-top: 24rpx;
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    .search-container-tabs {
      :deep(.el-tabs) {
        .el-tabs__content {
          display: none;
        }
        .el-tabs__header {
          margin-bottom: 0;
          .el-tabs__nav-wrap {
            &::after {
              display: none;
            }
            .el-tabs__nav-scroll {
              .el-tabs__nav {
                .el-tabs__active-bar {
                  background-color: #1b1b1b;
                }
                .el-tabs__item {
                  color: rgb(146, 146, 146);
                  &:hover {
                    color: #1b1b1b;
                  }
                }
                .is-active {
                  color: #1b1b1b;
                }
              }
            }
          }
        }
      }
    }
    .search-container-list {
      flex: 1;
      overflow: hidden;
      :deep(.load-list) {
        height: 100%;
        overflow: hidden;

        .list-container {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          padding: 0 24rpx;
          padding-top: 16px;

          .list-item {
            margin-bottom: 24rpx;
            // flex: 1 1 218rpx;
            // min-width: 218rpx;
            /* 确保最小宽度 */
            flex: 0 0 calc((100% - 168rpx) / 8);
            margin-left: 24rpx;

            .search-container-list__item {
              cursor: pointer;

              .item-poster {
                width: 100%;
                aspect-ratio: 109/160;
                /* 高度 = (109/160) × 宽度 */
                border-radius: 20rpx;
                position: relative;
                display: inline-block;

                .item-poster-image {
                  width: 100% !important;
                  height: 100%;
                  border-radius: 20rpx;
                  object-fit: cover;
                }
              }

              .item-name {
                font-size: 28rpx;
                font-weight: bold;
                color: #000;
                display: block;
              }

              .item-time {
                font-size: 24rpx;
                color: gray;
                padding-top: 6rpx;
                display: block;
              }
            }
            &:nth-child(8n + 1) {
              margin-left: 0;
            }
          }
        }
      }
    }
  }
}
</style>
