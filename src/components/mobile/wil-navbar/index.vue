<template>
  <div class="wil-navbar" :style="{ 'height': navBarHeight }">
    <nut-navbar :title="$slots.content ? '' : props.title" :left-show="props.leftShow"
      :style="{ '--content-height': contentHeight, '--right-show': props.rightShow ? 'flex' : 'none' }"
      @click-back="clickBack" :title-icon="$slots['title-icon'] ? true : false">
      <template #leftShow v-if="props.leftShow">
        <slot v-if="$slots.leftShow" name="leftShow"></slot>
        <nut-icon name="rect-left" :custom-color="computedArrowColor" v-else></nut-icon>
      </template>
      <template #left>
        <slot v-if="$slots.left" name="left"></slot>
      </template>
      <template #content>
        <slot v-if="$slots.content" name="content"></slot>
      </template>
      <template #right>
        <slot v-if="$slots.right" name="right"></slot>
      </template>
      <template #titleIcon>
        <slot v-if="$slots['title-icon']" name="title-icon"></slot>
      </template>
    </nut-navbar>
  </div>
</template>

<script setup>
import { onMounted, ref, computed } from "vue";
import { useThemeColors } from "@/hooks/useThemeColors";

const { iconColor } = useThemeColors();

const props = defineProps({
  title: { type: String, default: "" },
  leftShow: { type: Boolean, default: process.env.uni_ENV === "alipay" ? false : true },
  arrowColor: { type: String, default: "" },
  rightShow: { type: Boolean, default: false },
});

// 如果传了 arrowColor 就用传入的，否则跟随主题
const computedArrowColor = computed(() => props.arrowColor || iconColor.value);

const navBarHeight = ref("");
const contentHeight = ref("");

const emits = defineEmits(["clickBack", "getHeight"]);

//计算微信navBar高度
const getNavHeight = () => {
  let sysinfo = uni.getSystemInfoSync();
  let statusBarHeight = sysinfo.statusBarHeight;
  navBarHeight.value = statusBarHeight + 44 + "px";
  contentHeight.value = "44px";
  emits("getHeight", navBarHeight.value);
};

//计算h5的navBar高度
const getH5NavbarHeight = () => {
  let sysinfo = uni.getSystemInfoSync();
  navBarHeight.value = "44px";
  contentHeight.value = "44px";
  emits("getHeight", navBarHeight.value);
};

// #ifdef APP-PLUS
getNavHeight();
// #endif

// #ifdef H5
getH5NavbarHeight();
// #endif

const clickBack = () => {
  uni.navigateBack();
  emits("clickBack");
};
</script>

<style lang="scss" scoped>
.wil-navbar {
  width: 100%;
  position: relative;
  background: transparent;
  z-index: 99;
  top: 0;

  ::v-deep .nut-navbar {
    position: absolute;
    width: 100%;
    bottom: 0;
    left: 0;
    height: var(--content-height);
    background: transparent;
    border: none;
    box-shadow: none;
    margin-bottom: 0;

    .nut-navbar__left {
      position: absolute;
      left: 0;

      .nut-icon-rect-left {
        font-size: 34rpx;
        width: 34rpx;
        height: 34rpx;
      }
    }

    .nut-navbar__title {
      min-width: 60%;

      .text {
        color: var(--app-text-primary) !important;
        font-size: 34rpx;
        font-weight: bold;
      }
    }

    .nut-navbar__right {
      display: var(--right-show);
      align-items: center;
    }
  }
}
</style>
