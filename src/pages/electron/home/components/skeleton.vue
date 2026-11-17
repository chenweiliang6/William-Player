<template>
    <div class="skeleton">
        <div class="sk-animation">
            <div class="sk-animation-guangzhu"></div>
        </div>
        <div class="skeleton-swiper">
            <div class="swiper-content-left">
            </div>
            <div class="swiper-content-right">
                <div class="right-name">{{ t('video.noTitle') }}</div>
                <div class="right-info">
                    <div class="right-info-date">2024-10-28</div>
                    <div class="right-info-star">
                        <wil-icon name="shoucang" custom-color="#f4bc22" />
                        <span>9.2</span>
                    </div>
                    <div class="right-info-genres">{{ t('video.genre') }}</div>
                </div>
                <div class="right-desc">
                    <span>
                        唐伯虎身为江南四大才子之首，却有道不尽的心酸。宁王想唐伯虎帮忙图谋作反，唐伯虎只好用内功改变脉象，令众人都相信他命不久矣。母亲埋怨他不应该把功夫暴露，因为他们家族一直被当年的仇人追杀。唐伯虎在与朋友出游时，遇到了貌若天仙的秋香并对她一见钟情，决心要到华府当家丁以追求秋香，唐伯虎被取名华安。期间华太师遇到了宁王上门刁难，幸好有唐伯虎出面相助，并暴露了自己是唐伯虎的身份。秋香才知道华安是自己欣赏的唐伯虎。华夫人跟唐家有怨，因此二人便开始斗法。怎料宁王跟夺面书生再次上门，华夫人不是对手，幸得唐伯虎出手，华夫人也答应把秋香许配给唐伯虎。
                    </span>
                </div>
            </div>
        </div>
        <div class="skeleton-hx" v-for="item in 2" :key="item">
            <div class="skeleton-hx-title">
                <div class="skeleton-hx-title__left">{{ t('video.movie') }}</div>
                <div class="skeleton-hx-title__right">{{ t('common.all') }}</div>
            </div>
            <div class="skeleton-hx-list">
                <div class="skeleton-hx-list__item" v-for="item1 in 8" :key="item1">
                    <div class="img"></div>
                    <div class="skeleton-hx-list__item-name">{{ t('video.noTitle') }}</div>
                    <div class="skeleton-hx-list__item-time">2025-10-19</div>
                </div>
            </div>
        </div>
        <div class="skeleton-classify">
            <div class="skeleton-classify-title">{{ t('video.category') }}</div>
            <div class="skeleton-classify-list">
                <div class="list-item" v-for="item in 13" :key="item"></div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import wilIcon from '@/components/common/wil-icon/index.vue'

const { t } = useI18n()
</script>

<style lang="scss" scoped>
@keyframes backpos {
  0% {
    left: -100%;
  }

  100% {
    left: 200%;
  }
}
.skeleton {
    width: 100%;
    height: 100%;
    position: relative;
    z-index: 999;
    left: 0;
    top: 0;
    overflow: hidden;

    .sk-animation {
        animation: backpos 1.5s ease-in-out 0s infinite;
        background-repeat: no-repeat;
        height: 100%;
        left: 0;
        position: absolute;
        top: 0;
        width: 100%;
        z-index: 1;

        .sk-animation-guangzhu {
            width: 120rpx;
            height: 100%;
            transform: skew(-20deg);
            background: linear-gradient(100deg,
                    hsla(0, 0%, 100%, 0),
                    hsl(0, 0%, 100%) 50%,
                    hsla(0, 0%, 100%, 0) 80%);
        }
    }

    .skeleton-swiper {
        height: 1000rpx;
        padding: 0 104rpx;
        box-sizing: border-box;
        width: 100%;
        display: flex;
        align-items: center;

        .swiper-content-left {
            flex: 0 0 500rpx;
            height: 700rpx;
            border-radius: 12rpx;
            margin-left: 150rpx;
            background: #f2f3f5;
        }

        .swiper-content-right {

            flex: 1;
            overflow: hidden;
            //   height: 270rpx;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: flex-start;
            margin-left: 100rpx;

            .right-name {
                color: transparent;
                font-size: 66rpx;
                font-weight: bold;
                width: 800rpx;
                display: -webkit-box;
                -webkit-box-orient: vertical;
                -webkit-line-clamp: 2;
                /* 限制显示的行数 */
                overflow: hidden;
                text-overflow: ellipsis;
                background: #f2f3f5;
            }

            .right-info {
                display: flex;
                align-items: center;
                font-size: 28rpx;
                font-weight: bold;
                margin: 20rpx 0;
                color: transparent;
                background: #f2f3f5;

                .right-info-star {
                    display: flex;
                    align-items: center;
                    margin-left: 50rpx;

                    .iconfont {
                        font-size: 30rpx;
                        opacity: 0;
                    }
                }

                .right-info-genres {
                    font-size: 28rpx;
                    margin-left: 50rpx;
                }
            }

            .right-desc {
                font-size: 28rpx;
                color: transparent;
                font-weight: bold;
                display: -webkit-box;
                -webkit-line-clamp: 5;
                /* 限制行数（可调整） */
                -webkit-box-orient: vertical;
                overflow: hidden;
                text-overflow: ellipsis;

                span {
                    background: #f2f3f5;
                    line-height: 1.6;
                }
            }

        }
    }

    .skeleton-hx {
        width: 100%;
        margin-bottom: 50rpx;
        overflow-x: hidden;
        padding: 0 100rpx;
        // padding-bottom: 100rpx;
        box-sizing: border-box;

        .skeleton-hx-title {
            display: flex;
            align-items: center;
            justify-content: space-between;

            .skeleton-hx-title__left {
                font-size: 36rpx;
                font-weight: bold;
                color: transparent;
                background: #f2f3f5;
            }

            .skeleton-hx-title__right {
                font-size: 30rpx;
                font-weight: bold;
                color: transparent;
                background: #f2f3f5;
            }
        }

        .skeleton-hx-list {
            display: flex;
            flex-wrap: nowrap;
            align-items: center;
            margin-top: 24rpx;


            .skeleton-hx-list__item {
                margin-left: 24rpx;
                flex: 0 0 calc((100% - 168rpx) / 8);
                cursor: pointer;
                overflow: hidden;

                .img {
                    width: 100%;
                    aspect-ratio: 107 / 160;
                    height: auto;
                    border-radius: 20rpx;
                    background: #f2f3f5;
                    display: inline-block;

                }

                &-name {
                    font-size: 28rpx;
                    font-weight: bold;
                    color: transparent;
                    display: block;
                    width: 100%;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    background: #f2f3f5;
                }

                &-time {
                    font-size: 24rpx;
                    color: transparent;
                    padding-top: 6rpx;
                    display: block;
                    background: #f2f3f5;
                    display: inline;
                }

                &:first-child {
                    margin-left: 0;
                }
            }

            .is-move {
                transition: transform 0.3s ease;
            }

            .is-new {
                animation: opacityIn 0.3s ease;
            }
        }
    }

    .skeleton-classify {
        padding: 0 100rpx;

        .skeleton-classify-title {
            font-size: 36rpx;
            font-weight: bold;
            color: transparent;
            background: #f2f3f5;
            display: inline;
        }

        .skeleton-classify-list {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            box-sizing: border-box;
            width: 100%;

            .list-item {
                flex: 0 0 calc((100% - 120rpx) / 6);
                aspect-ratio: 2/1; //webview大于90版本可用
                border-radius: 20rpx;
                margin-top: 20rpx;
                position: relative;
                padding: 30rpx;
                box-sizing: border-box;
                margin-left: 24rpx;
                background: #f2f3f5;

                &:nth-child(6n+1) {
                    margin-left: 0;
                }
            }
        }




    }
}
</style>
