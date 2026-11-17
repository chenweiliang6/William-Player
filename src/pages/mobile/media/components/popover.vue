<template>
    <nut-transition :show="showPopover" name="fade" :duration="200" style="z-index: 9999;width: 0;">
        <div class="popover"
            :style="{ left: positionObj.left, top: positionObj.top, background: props.background, width: props.width }">
            <div class="popover-item" v-for="item in props.options" :key="item.label" @click="clickItem(item)">
                <wil-icon v-if="item.icon" :name="item.icon" :custom-color="item.iconColor" class="popover-item__icon" />
                <span :style="{ color: item.color }">{{ item.label }}</span>
            </div>
        </div>
    </nut-transition>
    <div class="popover-overlay" v-show="showPopover" @click="closePopover"></div>
    <div class="seat-popover" ref="seat_popover">
        <div class="popover-item" v-for="item in props.options" :key="item.label">
            <wil-icon v-if="item.icon" :name="item.icon" :custom-color="item.iconColor" class="popover-item__icon" />
            <span :style="{ color: item.color }">{{ item.label }}</span>
        </div>
    </div>
</template>

<script setup>
import { watch, ref, onMounted, onBeforeUnmount } from 'vue'
import wilIcon from '@/components/common/wil-icon/index.vue'

const props = defineProps({
    options: { type: Array, default: [] },
    visible: { type: Boolean, default: false },
    position: { type: Object, default: {} },
    background: { type: String, default: 'var(--app-bg-card)' },
    width: { type: String, default: 'auto' },
    height: { type: String, default: 'auto' }
})

const emits = defineEmits(['update:visible', 'close', 'clickItem'])

const showPopover = ref(false)

const isInit = ref(true)
const positionObj = ref({})
const rectValue = ref({})

const seat_popover = ref(null)

// 判断弹窗显示的位置
const adjustMenuPosition = () => {
    if (!seat_popover.value) return
    console.log("daozhe", props.position);
    // 获取系统信息（替代 window.innerWidth/Height）
    const systemInfo = uni.getSystemInfoSync()
    const viewportWidth = systemInfo.windowWidth
    const viewportHeight = systemInfo.windowHeight

    if (rectValue.value.width) {
        const menuWidth = rectValue.value.width
        const menuHeight = rectValue.value.height

        // 计算最终位置
        let finalX = props.position.clientX
        let finalY = props.position.clientY
        // 右侧空间检查
        if (finalX + menuWidth > viewportWidth) {
            finalX = viewportWidth - menuWidth - 5
        }

        // 底部空间检查
        if (finalY + menuHeight > viewportHeight) {
            finalY = props.position.clientY - menuHeight
        }
        // 应用位置（通过 CSS 变量或直接设置样式）
        positionObj.value = {
            left: `${finalX}px`,
            top: `${finalY}px`,
        }
        showPopover.value = true
        return
    }
    // 创建节点查询（替代 offsetWidth/Height）
    const query = uni.createSelectorQuery().in(this)
    query.select('.seat-popover').boundingClientRect(rect => {
        if (!rect) return
        rectValue.value = rect
        const menuWidth = rect.width
        const menuHeight = rect.height

        // 计算最终位置
        let finalX = props.position.clientX
        let finalY = props.position.clientY
        // 右侧空间检查
        if (finalX + menuWidth > viewportWidth) {
            finalX = viewportWidth - menuWidth - 5
        }

        // 底部空间检查
        if (finalY + menuHeight > viewportHeight) {
            finalY = props.position.clientY - menuHeight
        }

        // 应用位置（通过 CSS 变量或直接设置样式）
        positionObj.value = {
            left: `${finalX}px`,
            top: `${finalY}px`,
        }
        showPopover.value = true

    }).exec()
}

const closePopover = () => {
    showPopover.value = false
    emits('close')
    emits('update:visible', false)
}

// 点击选项
const clickItem = (item) => {
    showPopover.value = false
    emits('update:visible', false)
    item.func ? item.func() : emits('clickItem', item)
}

watch(
    () => props.visible,
    (val) => {
        if (!val) {
            showPopover.value = val
        } else {
            adjustMenuPosition()
        }
    }, { immediate: true })
onMounted(() => {
    // adjustMenuPosition()
})
onBeforeUnmount(() => {
})
</script>

<style lang="scss" scoped>
.popover {
    position: absolute;
    // left: 50%;
    // top: 50%;
    // transform: translateX(-50%);
    background: var(--app-bg-card);
    z-index: 999;
    box-shadow: 0px 0px 16px 0px rgba(0, 0, 0, 0.11);
    border-radius: 8px 8px 8px 8px;
    border: 1px solid var(--app-border-strong);
    padding: 4px;
    overflow-y: auto;

    .popover-item {
        display: flex;
        align-items: center;
        padding: 8px 12px;
        cursor: pointer;

        .popover-item__icon {
            font-size: 20px;
            display: block;
        }

        span {
            padding-left: 4px;
            font-size: 14px;
            white-space: nowrap;
            /* 防止文字换行 */
        }

        &:active {
            background: var(--app-bg-secondary);
            border-radius: 6px 6px 6px 6px;
        }
    }
}

.popover-overlay {
    width: 100%;
    height: 100%;
    left: 0;
    top: 0;
    background: transparent;
    position: fixed;
    z-index: 99;
}

.seat-popover {
    position: fixed;
    right: -600rpx;
    opacity: 0;

    // left: 50%;
    // top: 50%;
    // transform: translateX(-50%);
    background: var(--app-bg-card);
    z-index: 999;
    box-shadow: 0px 0px 16px 0px rgba(0, 0, 0, 0.11);
    border-radius: 8px 8px 8px 8px;
    border: 1px solid var(--app-border-strong);
    padding: 4px;

    .popover-item {
        display: flex;
        align-items: center;
        padding: 8px 12px;
        cursor: pointer;

        .popover-item__icon {
            font-size: 20px;
            display: block;
        }

        span {
            padding-left: 4px;
            font-size: 14px;
            white-space: nowrap;
            /* 防止文字换行 */
        }

        &:active {
            background: var(--app-bg-secondary);
            border-radius: 6px 6px 6px 6px;
        }
    }
}
</style>
