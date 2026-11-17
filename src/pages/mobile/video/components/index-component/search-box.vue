<template>
    <div class="search-box">
        <div class="item-left" :style="{ backgroundImage: `url(${setEmptyImg(props.data.poster)})` }">
            <div :class="['item-left-logo', props.data.type == '1' ? 'item-left-tv' : '']">
                <template v-if="props.data.type == '1'">
                    <wil-icon name="xianshiping" custom-color="#ffffff" />
                    <span>{{ t('video.tv') }}</span>
                </template>
                <template v-else>
                    <wil-icon name="dianying" custom-color="#ffffff" />
                    <span>{{ t('video.movie') }}</span>
                </template>
            </div>
        </div>
        <div class="item-right">
            <div class="item-right-name">
                <span v-for="second in handleName(props.data.name)" :key="second" :style="{ color: second.color }">{{
                    second.label
                }}</span>
            </div>
            <div class="item-right-content">
                <div class="item-right-content__date">
                    <nut-icon name="date" size="14" custom-color="var(--app-text-tertiary)"></nut-icon>
                    <span>{{ props.data.releaseTime }}</span>
                </div>
                <div class="item-right-content__line"></div>
                <div class="item-right-content__type">{{ props.data.type == '1' ? t('video.tv') : t('video.movie') }}</div>
            </div>
        </div>
    </div>
</template>

<script setup>
import wilIcon from '@/components/common/wil-icon/index.vue'
import posterEmpty from "@/static/poster-empty.png";
import * as CONFIG from "@/utils/config";
import { handleSeasonName } from "@/utils/scrape";
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const props = defineProps({
    isEmby: { type: Boolean, default: false },
    data: { type: Object, default: {} },
    oldValue: { type: String, default: '' }
})
const handleName = (name) => {
    let arr = [];
    name = handleSeasonName(name);
    if (!props.oldValue) return [{ label: name }]
    arr.push({ label: name.split(props.oldValue)[0] });
    arr.push({ label: props.oldValue, color: "var(--app-brand)" });
    arr.push({ label: name.split(props.oldValue)[1] });
    arr = arr.filter((i) => i.label);
    return arr;
};

const setEmptyImg = (poster) => {
    if (props.isEmby) {
        if (poster) return poster
        else return posterEmpty
    } else {
        if (poster) {
            return CONFIG.IMG_DOMAIN + "/t/p/w300_and_h450_bestv2" + poster;
        } else {
            return posterEmpty;
        }
    }

};
</script>

<style lang="scss" scoped>
.search-box {
    display: flex;
    align-items: center;
    margin-top: 30rpx;

    .item-left {
        width: 140rpx;
        height: 220rpx;
        background-position: center;
        background-repeat: no-repeat;
        background-size: cover;
        border-radius: 16rpx;
        position: relative;

        .item-left-logo {
            display: inline-flex;
            align-items: center;
            background: #031963;
            border-radius: 16rpx 0 16rpx 0;
            padding: 8rpx;
            position: absolute;
            top: 0;
            left: 0;

            image {
                width: 24rpx;
                height: 24rpx;
            }

            .iconfont {
                font-size: 24rpx;
            }

            span {
                font-size: 22rpx;
                color: #fff;
                padding-left: 4rpx;
            }
        }

        .item-left-tv {
            background: #315bfd;
        }
    }

    .item-right {
        margin-left: 20rpx;

        .item-right-name {
            display: flex;
            align-items: baseline;
            font-size: 30rpx;
            color: var(--app-text-primary);
            font-weight: bold;
        }

        .item-right-content {
            display: flex;
            align-items: center;
            color: var(--app-text-tertiary);
            font-size: 28rpx;
            margin-top: 20rpx;

            .item-right-content__date {
                display: flex;
                align-items: center;

                span {
                    padding-left: 10rpx;
                }
            }

            .item-right-content__line {
                height: 28rpx;
                width: 2rpx;
                background: var(--app-border);
                margin: 0 20rpx;
            }
        }
    }

    &:first-child {
        margin-top: 0;
    }
}
</style>
