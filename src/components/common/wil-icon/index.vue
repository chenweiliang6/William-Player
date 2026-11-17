<template>
  <text :class="['iconfont', iconClass]" :style="iconStyle"></text>
</template>

<script setup>
/**
 * 字体图标。字形来自全局 styles/iconfont.scss 的 .icon-xxx:before。
 *
 * 根节点刻意保持 <text class="iconfont">：
 * 1. 页面里已有的 .xxx .iconfont { font-size/color } scoped 覆盖可直接命中根节点；
 * 2. 父组件传的 class / style / @click 由 Vue 自动合并、透传到根节点，无需 $attrs 转发。
 *
 * 颜色优先级：icon-theme 等修饰类 < custom-color < 外部 style。
 * 外部 style 能盖过 custom-color 是 Vue 合并根节点 props 的既定行为，无需特殊处理。
 * custom-color / size 不传时不输出行内样式，避免打断页面的 scoped 覆盖。
 */
import { computed } from 'vue'

const props = defineProps({
  // 字形名，可带或不带 icon- 前缀，如 'rili' 或 'icon-rili'
  name: { type: String, required: true },
  // 图标颜色，接受任意 CSS 颜色值（含 var(--app-*)）
  customColor: { type: String, default: '' },
  // 图标大小：数字按 rpx 处理，字符串原样使用（如 '40rpx' / '20px'）
  size: { type: [Number, String], default: '' },
})

const iconClass = computed(() =>
  props.name.startsWith('icon-') ? props.name : `icon-${props.name}`
)

// 与 skeleton-block.vue 的 toUnit 保持同一套尺寸约定
const toUnit = v => (typeof v === 'number' ? `${v}rpx` : v)

const iconStyle = computed(() => {
  const style = {}
  if (props.customColor) style.color = props.customColor
  if (props.size !== '' && props.size !== null) style.fontSize = toUnit(props.size)
  return Object.keys(style).length ? style : null
})
</script>