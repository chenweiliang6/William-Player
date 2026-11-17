<template>
<nut-cell-group class="wil-cell">
<nut-cell
v-for="item in props.options"
:key="item[props.defaultProps.title]"
:is-link="item[props.defaultProps.isLink] || true"
v-bind="item"
@click="clickItem(item)">
<template #title>
<slot v-if="$slots.title" name="title" v-bind="item"></slot>
<template v-else>
{{ item[props.defaultProps.title] }}
</template>
</template>
<template #icon v-if="$slots.icon || item[props.defaultProps.leftIcon]">
<slot name="icon" v-if="$slots.icon" v-bind="item"></slot>
<image :src="item[props.defaultProps.leftIcon]" v-if="item[props.defaultProps.leftIcon] && !$slots.icon"  />
</template>
<template #link>
<slot v-if="$slots.link" name="link" v-bind="item"></slot>
<nut-icon name="rect-right" :custom-color="iconColorMuted" v-else></nut-icon>
</template>
</nut-cell>
</nut-cell-group>
</template>

<script setup>
import { toStringfy, toParse } from '@/pages/mobile/mine/common'
import { useThemeColors } from '@/hooks/useThemeColors'

const props = defineProps({
options: { type: Array, default: [] },
defaultProps: {
type: Object,
default: {
title: 'title',
isLink: 'isLink',
leftIcon: 'leftIcon',
path: 'path',
query: 'query',
},
},
})

const { iconColorMuted } = useThemeColors()

const emits = defineEmits(['clickItem'])

const clickItem = item => {
if (item[props.defaultProps.path]) {
uni.navigateTo({
url: toStringfy(item[props.defaultProps.query]) ? item[props.defaultProps.path] + '?' + toStringfy(item[props.defaultProps.query]) : item[props.defaultProps.path],
})
} else {
emits('clickItem', item)
}
}
</script>

<style lang="scss" scoped>
.wil-cell {
:deep(.nut-cell-group__wrap) {
border-radius: 24rpx;
margin: 0;
background: var(--app-bg-card);
box-shadow: none;

.nut-cell {
padding: 24rpx;
background: var(--app-bg-card);
border-radius: 24rpx;
align-items: center;
box-shadow: none;
margin: 0;

&::after {
border-bottom: 2rpx solid var(--app-border);
}

.nut-cell__icon {
margin-right: 16rpx;

image {
width: 60rpx;
height: 60rpx;
}
}

.nut-cell__title {
justify-content: center;
font-size: 30rpx;
color: var(--app-text-secondary);
line-height: normal;

.wil-cell__title {
display: flex;
align-items: center;

span:last-child {
padding-left: 24rpx;
}
}
}
.nut-icon-rect-right {
width: 40rpx;
height: 40rpx;
font-size: 32rpx;
}
}
}
}
</style>
