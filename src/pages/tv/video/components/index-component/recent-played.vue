<template>
  <div class="recent-played">
    <div class="recent-played-title">
      <div class="recent-played-title-left">{{ t('video.recentPlayed') }}</div>
    </div>
    <div class="recent-played-list">
      <tv-scroll class="recent-played-list-scroll" style="width: 100%" :scrollIntoView="scrollIntoView">
        <div class="recent-played-list-movie__item" v-for="(item, index) in scrollData" :key="item.name + (item.type || '')"
          @click="toVideoPlayer(item)">
          <div class="recent-played-list-movie__item-img" :class="[tabIndex == index ? 'img-active' : '']">
            <image :src="item.poster" style="width: 100%;height: 100%;position: static;" mode="aspectFill"></image>
            <span style="color: red;font-size: 30px;">
              {{ item.loadImg }}
            </span>
            <wil-icon name="icon_play" custom-color="#ffffff" class="img-button" />
            <span class="img-runtime">{{ handleSecond(item.initialTime) + '/' + item.runtime }}</span>
            <div class="img-process"
              :style="{ width: Number(item.initialTime) / (Number(parseTime(item.runtime)) * 0.6) + '%' }"></div>
          </div>
          <span class="recent-played-list-movie__item-name" v-if="item.type == 'movie'">{{
            handleSeasonName(removeExtension(item.name)) }}</span>
          <span class="recent-played-list-movie__item-name" v-if="item.type == 'tv'">{{
            removeExtension(`${item.titlePlay} 第${item.ji}集 ${item.title||''}`) }}</span>
        </div>
      </tv-scroll>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import wilIcon from "@/components/common/wil-icon/index.vue";
import { handleSecond, parseTime, handleSeasonName, debounce, getMovieTvData } from "@/utils/scrape";
import { onShow } from "@dcloudio/uni-app";
import emptyBg from "@/static/empty_bg.png";
import { toStringfy } from "@/pages/mobile/mine/common";
import tvScroll from "@/components/tv/tv-scroll/index.vue";

const { t } = useI18n()

const props = defineProps({
  isFocus: { type: Boolean, default: true },
  listData: { type: Array, default: [] },
  offsetTop: { type: Number, default: 0 },
  // 下移目标：第一个可见的分类分区（父组件按焦点序列算好）
  nextFocus: { type: String, default: '' },
});

const emits = defineEmits(['setFocus'])

const scrollData = ref([]);
const tabIndex = ref(-1);

const scrollTop = ref(0)

const selectType = ref({});
const selectMedia = ref({});
const scrollIntoView = ref("");

//判断选择的是webdav还是天翼云盘还是夸克
const judgeSelect = () => {
  let sourceList = uni.getStorageSync("sourceList");
  selectType.value = sourceList.find((item) => {
    let select = item.list.find((i) => i.active);
    if (select) {
      selectMedia.value = select;
      return true;
    } else {
      return false;
    }
  });
};

const removeExtension = (filename) => {
  const firstDotIndex = filename.indexOf(".");
  let name = firstDotIndex === -1 ? filename : filename.substring(0, firstDotIndex);
  if (name.length > 17) {
    name = name.slice(0, 16) + "...";
  }
  return name;
};

//裁剪格式获取电影名
const getMovieName = (val) => {
  const firstDotIndex = val.indexOf(".");
  let name = firstDotIndex === -1 ? val : val.substring(0, firstDotIndex);
  return name;
};

//将点击了的视频放置到数组的第一个去
const setItemFirst = (item) => {
  let index = null;
  if (item.type == "tv") {
    index = scrollData.value.findIndex((i) => i.type == item.type && i.titlePlay == item.titlePlay);
  } else if (item.type == "movie") {
    index = scrollData.value.findIndex((i) => i.type == item.type && getMovieName(i.name) == getMovieName(item.name));
  }
  if (index > -1) {
    scrollData.value.splice(index, 1);
    scrollData.value.unshift(item);
  } else {
    scrollData.value.unshift(item);
  }
  let historyArr = uni.getStorageSync("historyPlay") || [];
  historyArr = historyArr.filter((v) => v.sourceType != selectType.value.type || v.sourceName != selectMedia.value.name);
  uni.setStorageSync("historyPlay", [...historyArr, ...scrollData.value]);
};

const toVideoPlayer = async (item) => {
  uni.setStorageSync("secondPage", "videoPlayer");
  if (item.type == "movie") {
    if (selectType.value.type == "WebDAV") {
      uni.navigateTo({
        url: `/pages/tv/video/video-player?path=${item.path}&type=movie`,
        success: () => {
          setItemFirst(item);
        },
      });
    } else {
      uni.navigateTo({
        url: `/pages/tv/video/video-player?path=${item.path}&folderFileId=${item.folderFileId}&type=movie`,
        success: () => {
          setItemFirst(item);
        },
      });
    }
  } else if (item.type == "tv") {
    let localMovieTvData = getMovieTvData() || {};
    let nowTv = localMovieTvData.tv.find((i) => {
      return (
        i.source.some((v) => {
          return v.seasonArr.some((h) => h.path + "/" + item.name == "/" + item.path);
        }) && i.movieTvId == item.movieTvId
      );
    });
    let openEndTime = {};
    nowTv.openingTime >= 0 ? (openEndTime.openingTime = nowTv.openingTime) : "";
    nowTv.endTime >= 0 ? (openEndTime.endTime = nowTv.endTime) : "";
    if (selectType.value.type == "WebDAV") {
      uni.navigateTo({
        url: `/pages/tv/video/video-player?path=${item.path}&titlePlay=${item.titlePlay}&type=tv&movieTvId=${item.movieTvId}&${toStringfy(openEndTime)}`,
        success: () => {
          setItemFirst(item);
        },
      });
    } else {
      uni.navigateTo({
        url: `/pages/tv/video/video-player?path=${item.path}&titlePlay=${item.titlePlay}&wjjId=${item.wjjId}&movieTvId=${item.movieTvId}&folderFileId=${item.folderFileId}&type=tv&${toStringfy(openEndTime)}`,
      });
    }
  }
};

const toVideoAll = () => {
  uni.navigateTo({
    url: `/pages/tv/video/video-all?title=${encodeURIComponent(t('video.recentPlayed'))}&listKind=recent`,
  });
};
//获取上下的组件
// 下移目标由父组件按焦点序列算好传入，不再按 movie→tv 硬编码
const getUpDown = (direction) => {
  if (direction === "up") {
    return "starRecommend";
  }
  return props.nextFocus || "";
}

let nowTime = 0;
const evtMove = (keyCode) => {
  if (keyCode === "KeyRight") {
    if (tabIndex.value != props.listData.length - 1) {
      tabIndex.value++;
    }
  } else if (keyCode === "KeyLeft") {
    if (tabIndex.value > 0) {
      tabIndex.value--;
    }
  } else if (keyCode === "KeyUp") {
    emits("setFocus", getUpDown("up"), 'KeyUp');
  } else if (keyCode === "KeyDown") {
    emits("setFocus", getUpDown("down"), 'KeyDown');
  } else if (keyCode === 'KeyEnter') {
    toVideoPlayer(scrollData.value[tabIndex.value])
  }
  let time = Date.now();
  if (time - nowTime > 300) {
    if (tabIndex.value >= 3) {
      scrollIntoView.value = "name" + (tabIndex.value - 1);
    } else {
      scrollIntoView.value = "name1";
    }
  } else {
    setScrollIntoView();
  }
  nowTime = time;
};
const setScrollIntoView = debounce(() => {
  if (tabIndex.value >= 3) {
    scrollIntoView.value = "name" + (tabIndex.value - 1);
  } else {
    scrollIntoView.value = "name1";
  }
}, 300);
onShow(() => {
  judgeSelect();
  scrollData.value = [...props.listData];
  scrollData.value.forEach((item) => {
    item.loadImg = true;
  });
  setTimeout(() => {
    let windowHeight = uni.getSystemInfoSync().windowHeight
    const query = uni.createSelectorQuery();
    query.select(".recent-played-list-movie__item-img").fields(
      {
        rect: true,
        size: true,
      },
      (res) => {
        scrollTop.value = (props.offsetTop + res.top - windowHeight / 2 + res.height / 2) < 0 ? 0 : props.offsetTop + res.top - windowHeight / 2 + res.height / 2
      }
    ).exec();
  }, 0);
});

watch(
  () => props.listData,
  (val) => {
    scrollData.value = [...props.listData];
    scrollData.value.forEach((item) => {
      item.loadImg = true;
    });
  },
  { immediate: true, deep: true }
);

watch(
  () => props.isFocus,
  (val) => {
    if (val) {
      tabIndex.value = 0;
    } else {
      tabIndex.value = -1;
    }
  }
);
const getScrollTop = () => {
  return scrollTop.value
}
defineExpose({
  evtMove,
  getScrollTop
})
</script>

<style lang="scss" scoped>
.recent-played {
  width: 100%;
  margin: 50rpx 0;
  padding: 0 80rpx;

  .recent-played-title {
    display: flex;
    align-items: center;
    justify-content: space-between;

    .recent-played-title-left {
      font-size: 36rpx;
      font-weight: bold;
      color: #000;
    }

    .recent-played-title-right {
      display: flex;
      align-items: center;

      span {
        font-size: 30rpx;
        color: gray;
        line-height: 30rpx;
      }

      span:nth-child(2) {
        padding-left: 6rpx;
      }
    }
  }

  .recent-played-list {
    margin-top: 24rpx;

    ::v-deep .recent-played-list-scroll {
      width: 100%;
      overflow-x: auto;

      .uni-scroll-view-content {
        display: flex;
        flex-direction: row;
        align-items: center;
        flex-wrap: nowrap;
        width: 100%;

        .recent-played-list-movie__item {
          margin-left: 24rpx;
          flex: 0 0 520rpx;

          .recent-played-list-movie__item-img {
            background-position: center;
            background-repeat: no-repeat;
            background-size: cover;
            height: 320rpx;
            width: 100%;
            border-radius: 20rpx;
            position: relative;
            overflow: hidden;
            border: 6rpx solid transparent;



            .img-button {
              font-size: 80rpx;
              position: absolute;
              left: 50%;
              top: 50%;
              transform: translate(-50%, -50%);
            }

            .img-runtime {
              position: absolute;
              right: 10rpx;
              bottom: 10rpx;
              background: rgba(0, 0, 0, 0.5);
              color: #fff;
              font-size: 24rpx;
              border-radius: 8rpx;
              padding: 4rpx 8rpx;
            }

            .img-process {
              height: 7rpx;
              background: #ff6701;
              position: absolute;
              bottom: 0;
              left: 0;
            }
          }

          .img-active {
            border: 6rpx solid #ff6701;
          }

          &-name {
            font-size: 28rpx;
            font-weight: bold;
            color: #fff;
          }

          &:first-child {
            margin-left: 0;
          }
        }
      }
    }
  }
}

// @media (prefers-color-scheme: dark) {
//   .recent-played {
//     .recent-played-title {
//       .recent-played-title-left {
//         color: #fff;
//       }

//       .recent-played-title-right {
//         span {
//           color: rgb(154, 154, 154);
//         }
//       }
//     }

//     .recent-played-list {
//       .recent-played-list-scroll {
//         .recent-played-list-movie {
//           .recent-played-list-movie__item {
//             &-name {
//               color: #fff;
//             }
//           }
//         }
//       }
//     }
//   }
// }
</style>
