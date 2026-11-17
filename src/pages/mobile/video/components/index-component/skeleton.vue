<template>
  <view class="sk-container" :style="{ paddingTop: navBarHeight }">
    <view class="h5-div video">
      <view class="h5-div video-container" style="overflow: hidden;">
        <view class="h5-div recent-played">
          <view class="h5-div recent-played-title">
            <view class="h5-div recent-played-title-left sk-transparent sk-text-14-2857-459 sk-text">{{ t('video.recentPlayed') }}
            </view>
            <view class="h5-div recent-played-title-right">
              <view class="h5-span sk-transparent sk-text-14-2857-474 sk-text">{{ t('common.all') }}
              </view>
              <view class="h5-span sk-transparent sk-opacity">2</view>
              <text class="h5-i nutui-iconfont nut-icon nut-icon-rect-right sk-pseudo sk-pseudo-circle"
                style="color: gray; font-size: 10px; width: 10px; height: 10px;"></text>
            </view>
          </view>
          <view class="h5-div recent-played-list" style="overflow: hidden;">
            <view class="recent-played-list-scroll">
              <view class="h5-div recent-played-list-movie"
                style="scroll-snap-align: none;overflow: hidden;width: 100%;">
                <view class="h5-div recent-played-list-movie__item" v-for="item in 4" :key="item">
                  <view class="h5-div recent-played-list-movie__item-img sk-image"></view>
                  <view class="h5-span recent-played-list-movie__item-name sk-transparent sk-text-14-2857-57 sk-text">
                    </view>
                </view>
              </view>
            </view>
          </view>
        </view>
        <view class="h5-div hxList">
          <view class="h5-div hxList-title">
            <view class="h5-div hxList-title-left sk-transparent sk-text-14-2857-375 sk-text">{{ t('video.movie') }}</view>
            <view class="h5-div hxList-title-right">
              <view class="h5-span sk-transparent sk-text-14-2857-432 sk-text">{{ t('common.all') }}
              </view>
              <view class="h5-span sk-transparent sk-opacity">8</view>
              <text class="h5-i nutui-iconfont nut-icon nut-icon-rect-right sk-pseudo sk-pseudo-circle"
                style="color: gray; font-size: 10px; width: 10px; height: 10px;"></text>
            </view>
          </view>
          <view class="h5-div hxList-list">
            <view class="hxList-list-scroll" style="overflow: hidden;">
              <view class="h5-div hxList-list-movie" style="scroll-snap-align: none;overflow: hidden;width: 100%;">
                <view class="h5-div hxList-list-movie__item" v-for="item in 8" :key="item">
                  <image class="h5-img sk-image" mode="aspectFill"  />
                  <view class="h5-span hxList-list-movie__item-name sk-transparent sk-text-14-2857-799 sk-text">
                    </view>
                  <view class="h5-span hxList-list-movie__item-time sk-transparent sk-text-14-2857-681 sk-text">
                    2024-07-24</view>
                </view>
              </view>
            </view>
          </view>
        </view>
        <view class="h5-div hxList">
          <view class="h5-div hxList-title">
            <view class="h5-div hxList-title-left sk-transparent sk-text-14-2857-706 sk-text">{{ t('video.tv') }}</view>
            <view class="h5-div hxList-title-right">
              <view class="h5-span sk-transparent sk-text-14-2857-346 sk-text">{{ t('common.all') }}
              </view>
              <view class="h5-span sk-transparent sk-opacity">9</view>
              <text class="h5-i nutui-iconfont nut-icon nut-icon-rect-right sk-pseudo sk-pseudo-circle"
                style="color: gray; font-size: 10px; width: 10px; height: 10px;"></text>
            </view>
          </view>
          <view class="h5-div hxList-list">
            <view class="hxList-list-scroll" style="overflow: hidden;">
              <view class="h5-div hxList-list-movie" style="scroll-snap-align: none;overflow: hidden;width: 100%;">
                <view class="h5-div hxList-list-movie__item" v-for="item in 8" :key="item">
                  <image class="h5-img sk-image" mode="aspectFill"  />
                </view>
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from 'vue';
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const navBarHeight = ref('')
//计算设备navBar高度
const getNavHeight = () => {
  let sysinfo = uni.getSystemInfoSync(); // 获取设备系统对象
  let statusBarHeight = sysinfo.statusBarHeight; // 获取状态栏高度
  navBarHeight.value = statusBarHeight + 44 + 'px'; //计算nav导航栏的高度
};

//计算h5的navBar高度
const getH5NavbarHeight = () => {
  navBarHeight.value = '44px';
};
// #ifdef H5
getH5NavbarHeight();
// #endif

// #ifndef H5
getNavHeight();
// #endif
</script>

<style lang="scss" scoped>
.recent-played {
  width: 100%;
  margin-bottom: 50rpx;

  .recent-played-title {
    display: flex;
    align-items: center;
    justify-content: space-between;

    .recent-played-title-left {
      font-size: 36rpx;
      font-weight: bold;
      color: var(--app-text-primary);
    }

    .recent-played-title-right {
      display: flex;
      align-items: center;

      span {
        font-size: 30rpx;
        color: gray;
      }

      span:nth-child(2) {
        padding-left: 6rpx;
      }
    }
  }

  .recent-played-list {
    margin-top: 24rpx;

    .recent-played-list-scroll {
      width: 100%;
      overflow-x: auto;

      .recent-played-list-movie {
        display: flex;
        flex-wrap: nowrap;
        align-items: center;

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

            img {
              width: 80rpx;
              height: 80rpx;
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
          }

          &-name {
            font-size: 28rpx;
            font-weight: bold;
            color: var(--app-text-primary);
          }

          &:first-child {
            margin-left: 0;
          }
        }
      }
    }
  }
}

.hxList {
  width: 100%;
  margin-bottom: 50rpx;
  overflow-x: hidden;

  .hxList-title {
    display: flex;
    align-items: center;
    justify-content: space-between;

    .hxList-title-left {
      font-size: 36rpx;
      font-weight: bold;
      color: var(--app-text-primary);
    }

    .hxList-title-right {
      display: flex;
      align-items: center;

      span {
        font-size: 30rpx;
        color: gray;
      }

      span:nth-child(2) {
        padding-left: 6rpx;
      }
    }
  }

  .hxList-list {
    margin-top: 24rpx;

    .hxList-list-scroll {
      width: 100%;

      .hxList-list-movie {
        display: flex;
        flex-wrap: nowrap;
        align-items: center;

        .hxList-list-movie__item {
          margin-left: 24rpx;
          flex: 0 0 214rpx;
          overflow: hidden;

          .h5-img {
            width: 100%;
            height: 320rpx;
            border-radius: 20rpx;
          }

          &-name {
            font-size: 28rpx;
            font-weight: bold;
            color: var(--app-text-primary);
            display: block;
          }

          &-time {
            font-size: 24rpx;
            color: gray;
            padding-top: 6rpx;
            display: block;
          }

          &:first-child {
            margin-left: 0;
          }
        }

      }
    }
  }
}

// ── 骨架流光 ──
// 旧做法是一条 120rpx 全高的白色光柱横向扫过整页（@keyframes backpos +
// .sk-animation-guangzhu）。它不贴合任何骨架块形状，会压过空白区和文字，
// 且是纯白在浅色背景上很刺眼。现改为让每个骨架块自带一道斜向渐变、
// 靠 background-position 平移 —— 光只存在于块内，观感与 shapes-clipped
// 的 ShimmerLayout 一致。
.sk-transparent {
  color: transparent !important;
}

.sk-text-14-2857-322 {
  background-size: 100% 56rpx;
  position: relative !important;
}

.sk-text {
  background-origin: content-box !important;
  background-clip: content-box !important;
  background-color: transparent !important;
  color: transparent !important;
  background-repeat: repeat-y !important;
}

.sk-text-14-2857-459 {
  background-size: 100% 50.4rpx;
  position: relative !important;
}

.sk-text-14-2857-474 {
  background-size: 100% 42rpx;
  position: relative !important;
}

.sk-opacity {
  opacity: 0 !important;
}

.sk-text-14-2857-534 {
  background-size: 100% 33.6rpx;
  position: absolute !important;
}

.sk-text-14-2857-53 {
  background-size: 100% 39.2rpx;
  position: relative !important;
}

.sk-text-14-2857-57 {
  background-size: 100% 39.2rpx;
  position: relative !important;
}

.sk-text-14-2857-375 {
  background-size: 100% 50.4rpx;
  position: relative !important;
}

.sk-text-14-2857-432 {
  background-size: 100% 42rpx;
  position: relative !important;
}

.sk-text-14-2857-799 {
  background-size: 100% 39.2rpx;
  position: relative !important;
}

.sk-text-14-2857-681 {
  background-size: 100% 33.6rpx;
  position: relative !important;
}

.sk-text-14-2857-471 {
  background-size: 100% 39.2rpx;
  position: relative !important;
}

.sk-text-14-2857-780 {
  background-size: 100% 33.6rpx;
  position: relative !important;
}

.sk-text-14-2857-396 {
  background-size: 100% 39.2rpx;
  position: relative !important;
}

.sk-text-14-2857-103 {
  background-size: 100% 33.6rpx;
  position: relative !important;
}

.sk-text-14-2857-211 {
  background-size: 100% 39.2rpx;
  position: relative !important;
}

.sk-text-14-2857-117 {
  background-size: 100% 33.6rpx;
  position: relative !important;
}

.sk-text-14-2857-706 {
  background-size: 100% 50.4rpx;
  position: relative !important;
}

.sk-text-14-2857-346 {
  background-size: 100% 42rpx;
  position: relative !important;
}

.sk-pseudo::before,
.sk-pseudo::after {
  color: transparent !important;
  border-color: transparent !important;
}

.sk-pseudo-rect::before,
.sk-pseudo-rect::after {
  border-radius: 0 !important;
}

.sk-pseudo-circle::before,
.sk-pseudo-circle::after {
  border-radius: 50% !important;
}

.sk-container {
  width: 100%;
  height: 100%;
  overflow: hidden;
  flex: 1;
  padding: 20px 12px;
  padding-bottom: 0;
  box-sizing: border-box;
  position: relative;
}
// 用 vw 绝对坐标而非百分比：百分比会随块宽缩放，宽窄不同的块光带互相错位
@keyframes skShimmer {
  0% {
    background-position: -60vw 0;
  }

  100% {
    background-position: 160vw 0;
  }
}

// 覆盖文件末尾所有 .sk-text-* 的底色：浅色模式下 --app-bg-input 是 #ffffff，
// 与页面背景同色，导致骨架块完全看不见。这里统一换成可见的骨架底色，
// 并叠加流光。!important 用于盖过各 .sk-text-* 自带的 !important 声明。
.sk-text-14-2857,
[class*='sk-text-14-2857-'] {
  background-color: var(--app-skeleton-base) !important;
  background-image: linear-gradient(100deg,
      transparent 22%,
      var(--app-skeleton-highlight) 50%,
      transparent 78%) !important;
  background-size: 60vw 100% !important;
  background-repeat: no-repeat !important;
  animation: skShimmer 1.6s linear infinite;
}

.sk-image {
  background-color: var(--app-skeleton-base-strong) !important;
  background-image: linear-gradient(100deg,
      transparent 22%,
      var(--app-skeleton-highlight) 50%,
      transparent 78%) !important;
  background-size: 60vw 100% !important;
  background-repeat: no-repeat !important;
  animation: skShimmer 1.6s linear infinite;
}

// 装饰性伪元素（图标占位）沿用底色，不参与流光，避免碎光点
.sk-pseudo::before,
.sk-pseudo::after {
  background: var(--app-skeleton-base) !important;
  background-image: none !important;
}

@media (prefers-reduced-motion: reduce) {

  .sk-text-14-2857,
  [class*='sk-text-14-2857-'],
  .sk-image {
    animation: none;
  }
}


</style>
