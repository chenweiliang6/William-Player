<template>
  <view class="sk-block" :class="[{ 'sk-block--strong': strong }, { 'sk-block--circle': circle }]" :style="blockStyle"></view>
</template>

<script setup>
/**
 * 骨架屏的单个占位块。
 *
 * 流光做法：块自身带一道斜向渐变，靠 background-position 平移。
 * 注意不能沿用首页旧做法（一条全屏光柱横向扫），那种结构不贴合块形状，
 * 会扫过空白区和文字。这里每块自带渐变，且用固定 background-size，
 * 使一排块的流光速度一致、看起来像一道连贯光带。
 */
import { computed } from 'vue'

const props = defineProps({
  // 宽度：数字（rpx）或带单位字符串，如 '60%'
  width: { type: [Number, String], default: 100 },
  // 高度（rpx）
  height: { type: [Number, String], default: 32 },
  // 圆角（rpx）；circle 时忽略
  radius: { type: [Number, String], default: 8 },
  // 深一档的底色（用于大图占位）
  strong: { type: Boolean, default: false },
  // 正圆（演员头像）
  circle: { type: Boolean, default: false },
})

const toUnit = v => (typeof v === 'number' ? `${v}rpx` : v)

const blockStyle = computed(() => ({
  width: toUnit(props.width),
  height: toUnit(props.height),
  // circle 用 50% 覆盖 radius
  borderRadius: props.circle ? '50%' : toUnit(props.radius),
  // 关键：用 vw 而不是 %。百分比会让 background-position 随块宽缩放，
  // 导致一排宽窄不同的块光带各扫各的、互相错位。
  // vw 是绝对单位，所有块共享同一套屏幕坐标，光带才连贯成一条。
  backgroundSize: '60vw 100%',
}))
</script>

<style lang="scss" scoped>
// 绝对坐标（vw）而非百分比：详见 script 里的说明
@keyframes skShimmer {
  0% {
    background-position: -60vw 0;
  }

  100% {
    background-position: 160vw 0;
  }
}

.sk-block {
  display: block;
  flex-shrink: 0;
  background-color: var(--app-skeleton-base);
  background-image: linear-gradient(
    100deg,
    transparent 22%,
    var(--app-skeleton-highlight) 50%,
    transparent 78%
  );
  background-repeat: no-repeat;
  animation: skShimmer 1.6s linear infinite;

  &--strong {
    background-color: var(--app-skeleton-base-strong);
  }
}

// 尊重系统的「减弱动态效果」设置
@media (prefers-reduced-motion: reduce) {
  .sk-block {
    animation: none;
  }
}
</style>
