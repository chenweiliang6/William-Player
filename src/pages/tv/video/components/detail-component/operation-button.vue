<template>
    <div class="operation-button">
        <div class="operation-button-play"
            :class="[props.focusModel === 'operationButton' && activeButton === 'play' ? 'operation-button-active' : '']"
            @click="toPlay">
            <wil-icon name="icon_play"></wil-icon>
            <div class="operation-button-play__text">
                <span>{{ t('video.watchNow') }}</span>
                <span>{{ props.title }}</span>
            </div>
        </div>
        <div class="operation-button-source operation-button-item" @click="toOpenPopup('source')"
            :class="[props.focusModel === 'operationButton' && activeButton === 'source' ? 'operation-button-active' : '']">
            <wil-icon name="dongtaiyemianxiaotubiao06"></wil-icon>
            <span>{{ t('source.selectResource') }}</span>
        </div>
        <div class="operation-button-season operation-button-item" @click="toOpenPopup('season')"
            :class="[props.focusModel === 'operationButton' && activeButton === 'season' ? 'operation-button-active' : '']">
            <wil-icon name="season"></wil-icon>
            <span>{{ t('video.season') }}</span>
        </div>
        <div class="operation-button-tvlist operation-button-item" @click="toOpenPopup('tvlist')"
            :class="[props.focusModel === 'operationButton' && activeButton === 'tvlist' ? 'operation-button-active' : '']">
            <wil-icon name="bofangliebiao"></wil-icon>
            <span>{{ t('video.episode') }}</span>
        </div>
        <div class="operation-button-actor operation-button-item" @click="toOpenPopup('actor')"
            :class="[props.focusModel === 'operationButton' && activeButton === 'actor' ? 'operation-button-active' : '']">
            <wil-icon name="yonghu"></wil-icon>
            <span>{{ t('video.castAndCrew') }}</span>
        </div>
        <div class="operation-button-more operation-button-item" @click="toOpenPopup('more')"
            :class="[props.focusModel === 'operationButton' && activeButton === 'more' ? 'operation-button-active' : '']">
            <wil-icon name="sx-gd-copy"></wil-icon>
            <span>{{ t('common.more') }}</span>
        </div>
    </div>
</template>

<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import wilIcon from '@/components/common/wil-icon/index.vue'

const { t } = useI18n()

const props = defineProps({
    type: { type: String, default: 'tv' },
    focusModel: { type: String, default: '' },
    title: { type: String, default: '' }
})

const emits = defineEmits(['openPopup', 'toPlay'])

const activeButton = ref('play')
let tvButtonArr = ['play', 'source', 'season', 'tvlist', 'actor', 'more']
let movieButtonArr = ['play', 'source', 'actor', 'more']
let buttonArr = props.type === 'tv' ? tvButtonArr : movieButtonArr

const mapping = {
    'source': 'cloudList',
    'season': 'seasonList',
    'tvlist': 'tvList',
    'actor': 'actorList',
    'more': 'more'
}

const evtMove = (keyCode) => {
    if (keyCode === "KeyUp") {
        let index = buttonArr.findIndex(i => i === activeButton.value)
        if (index > 0) {
            activeButton.value = buttonArr[index - 1]
        }
    } else if (keyCode === "KeyDown") {
        let index = buttonArr.findIndex(i => i === activeButton.value)
        if (index < buttonArr.length - 1) {
            activeButton.value = buttonArr[index + 1]
        }
    } else if (keyCode === 'KeyEnter') {
        if (activeButton.value === 'play') { //跳转到视频播放页面
            emits('toPlay')
        } else {
            emits('openPopup', mapping[activeButton.value])
        }
    }
};

const toPlay = () => {
    emits('toPlay')
}

const toOpenPopup = (val) => {
    emits('openPopup', mapping[val])
}

defineExpose({
    evtMove,
})
</script>

<style lang="scss" scoped>
.operation-button {
    flex: 1;
    position: relative;
    margin-top: 40rpx;

    .operation-button-play {
        display: flex;
        align-items: center;
        padding: 30rpx 40rpx;
        border-radius: 16rpx;

        .iconfont {
            font-size: 35rpx;
            color: var(--content-text-secondary, #c5c6d0);
        }

        .operation-button-play__text {
            display: flex;
            flex-direction: column;
            padding-left: 30rpx;
            color: var(--content-text-secondary, #c5c6d0);
            font-weight: bold;
            font-size: 32rpx;

            span:last-child {
                font-size: 26rpx;
                padding-top: 10rpx;
            }
        }
    }


    .operation-button-item {
        display: flex;
        align-items: center;
        padding: 30rpx 40rpx;
        border-radius: 16rpx;

        .iconfont {
            font-size: 35rpx;
            color: var(--content-text-secondary, #c5c6d0);
        }

        span {
            font-size: 32rpx;
            color: var(--content-text-secondary, #c5c6d0);
            padding-left: 30rpx;
            font-weight: bold;
        }
    }

    // 焦点态：深浅两套背景都保持对比度
    .operation-button-active {
        background: var(--content-surface-strong, rgba(255, 255, 255, 0.24));

        .iconfont {
            color: var(--content-text, #000015);
        }

        .operation-button-play__text {
            color: var(--content-text, #000015);
        }

        span {
            color: var(--content-text, #000015);
        }
    }

}
</style>
