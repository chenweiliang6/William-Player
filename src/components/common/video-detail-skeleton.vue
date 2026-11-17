<template>
  <view class="detail-skeleton">
    <!-- 顶部大图 -->
    <view class="ds-hero">
      <skeleton-block :width="'100%'" :height="840" :radius="0" strong />
      <view class="ds-hero-info">
        <skeleton-block :width="'60%'" :height="44" :radius="8" />
        <view class="ds-hero-meta">
          <skeleton-block :width="120" :height="28" :radius="14" />
          <skeleton-block :width="120" :height="28" :radius="14" />
          <skeleton-block :width="100" :height="28" :radius="14" />
        </view>
        <skeleton-block :width="'40%'" :height="28" :radius="8" />
      </view>
    </view>

    <view class="ds-body">
      <!-- 播放按钮 -->
      <skeleton-block :width="'100%'" :height="88" :radius="44" />

      <!-- 版本 / 季 tabs -->
      <view class="ds-tabs">
        <skeleton-block :width="88" :height="48" :radius="8" />
        <skeleton-block :width="88" :height="48" :radius="8" />
        <skeleton-block :width="88" :height="48" :radius="8" />
      </view>

      <!-- 集卡片 -->
      <view class="ds-episodes">
        <skeleton-block v-for="i in 6" :key="i" :width="200" :height="112" :radius="12" />
      </view>

      <!-- 简介 -->
      <view class="ds-intro">
        <skeleton-block :width="'100%'" :height="28" :radius="8" />
        <skeleton-block :width="'92%'" :height="28" :radius="8" />
        <skeleton-block :width="'70%'" :height="28" :radius="8" />
      </view>

      <!-- 演员 -->
      <view class="ds-actors">
        <skeleton-block v-for="i in 6" :key="i" :width="80" :height="80" circle />
      </view>
    </view>
  </view>
</template>

<script setup>
/**
 * 影视详情页骨架屏。
 * 只负责布局，流光与配色由 skeleton-block 提供。
 */
import SkeletonBlock from './skeleton-block.vue'
</script>

<style lang="scss" scoped>
.detail-skeleton {
  width: 100%;
  min-height: 100%;
  background: var(--app-bg);
}

.ds-hero {
  position: relative;
  width: 100%;
  height: 840rpx;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  box-sizing: border-box;
  padding: 0 24rpx 32rpx;

  // 大图占位铺满，信息条压在底部
  > :first-child {
    position: absolute;
    top: 0;
    left: 0;
    z-index: 0;
  }

  .ds-hero-info {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: 20rpx;
  }

  .ds-hero-meta {
    display: flex;
    gap: 20rpx;
  }
}

.ds-body {
  padding: 24rpx;
  display: flex;
  flex-direction: column;
  gap: 28rpx;
}

.ds-tabs {
  display: flex;
  gap: 20rpx;
}

.ds-episodes {
  display: flex;
  gap: 20rpx;
  // 超出一屏的部分裁掉，避免骨架比真实内容长太多
  overflow: hidden;
}

.ds-intro {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.ds-actors {
  display: flex;
  gap: 24rpx;
  overflow: hidden;
}
</style>
