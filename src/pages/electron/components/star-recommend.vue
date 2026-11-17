<template>
    <div class="star-recommend">
        <wil-swiper :options="listData" :auto-play="5000" :pagination-visible="true" imgMode="aspectFill"
            @change="changeSwiper" ref="wil_swiper" v-if="props.showSwiper" :initPage="props.initPage">
            <template #item="data">
                <div class="swiper-content" @click="toVideoDetail(data)">
                    <div class="swiper-content-container">
                        <div class="swiper-content-left">
                            <image mode="aspectFill"
                                :src="CONFIG.IMG_DOMAIN + '/t/p/w300_and_h450_bestv2' + data.poster"></image>
                        </div>
                        <div class="swiper-content-right">
                            <div class="right-name">{{ handleSeasonName(data.name, true) }}</div>
                            <div class="right-info">
                                <div class="right-info-date">{{ data.releaseTime }}</div>
                                <div class="right-info-star">
                                    <wil-icon name="shoucang" custom-color="#f4bc22" />
                                    <span>{{ data.voteAverage.toFixed(1) }}</span>
                                </div>
                                <div class="right-info-genres">{{ data.genres }}</div>
                            </div>
                            <div class="right-desc">{{ data.overview }}</div>
                        </div>
                    </div>
                </div>
            </template>
        </wil-swiper>
    </div>
</template>

<script setup>
import wilIcon from '@/components/common/wil-icon/index.vue'
import wilSwiper from "@/components/mobile/wil-swiper/index.vue";
import { ref, onBeforeMount } from "vue";
import { classifyList, handleSeasonName, getMovieTvData } from "@/utils/scrape";
import { onShow } from "@dcloudio/uni-app";
import * as CONFIG from "@/utils/config";
import { useRouter } from "vue-router";
const props = defineProps({
    isFocus: { type: Boolean, default: true },
    historyPlay: { type: Array, default: [] },
    initPage: { type: [Number, String], default: 0 },
    showSwiper: { type: Boolean, default: true },
});

const router = useRouter()
const emits = defineEmits(["getStarList", "change", "setFocus"]);
const wil_swiper = ref(null);

const listData = ref([]);
const classifyList1 = ref(JSON.parse(JSON.stringify(classifyList)));
const removeExtension = (filename) => {
    let name = handleSeasonName(filename, true);
    if (name.length > 7) {
        name = name.slice(0, 6) + "...";
    }
    return name;
};

const toVideoDetail = (item) => {
    router.push({
        path: '/homeDetail',
        query: {
            path: item.path,
            name: handleSeasonName(item.name, true),
            type: item.type,
            source: JSON.stringify(item.source),
            movieTvId: item.movieTvId,
            workKey: item.workKey || ''
        }
    })
};

const changeSwiper = (index) => {
    emits("change", index);
};

const evtMove = (keyCode) => {
    if (keyCode === "KeyRight") {
        wil_swiper.value.next();
    } else if (keyCode === "KeyLeft") {
        wil_swiper.value.prev();
    } else if (keyCode === "KeyUp") {
        emits("setFocus", "tvNavbar", "KeyUp");
    } else if (keyCode === "KeyDown") {
        let localMovieTvData = getMovieTvData();
        if (props.historyPlay.length) {
            emits("setFocus", "recentPlayed", "KeyDown");
            return;
        }
        if (localMovieTvData?.movie?.length) {
            emits("setFocus", "hxMovie", "KeyDown");
            return;
        }
        if (localMovieTvData?.tv?.length) {
            emits("setFocus", "hxTv", "KeyDown");
            return;
        }
    }
};

const getScrollTop = () => {
    return 0
}

defineExpose({
    evtMove,
    getScrollTop
});

onShow(() => {
    //为什么在onShow中呢，是因为可能会清空影片列表，此时也需要更新轮播列表
    classifyList1.value = JSON.parse(JSON.stringify(classifyList));
    let localMovieTvData = getMovieTvData() || {};
    let tv = [];
    if (localMovieTvData?.tv) {
        tv = localMovieTvData.tv.filter((v) => v.voteAverage).sort((a, b) => b.voteAverage - a.voteAverage);
        tv = tv.slice(0, 3).map((item) => {
            let genres = "";
            item.type = "tv";
            item.genre_ids?.forEach((v, vindex) => {
                if (vindex < item.genre_ids.length - 1) {
                    genres += classifyList1.value.find((h) => h.id == v)?.label ? classifyList1.value.find((h) => h.id == v).label + " " : "";
                } else {
                    genres += classifyList1.value.find((h) => h.id == v)?.label || "";
                }
            });
            item.genres = genres;
            //   item.underImg = CONFIG.IMG_DOMAIN + "/t/p/w1920_and_h1080_bestv2" + item.backdrop;
            return item;
        });
    }
    let movie = [];
    if (localMovieTvData?.movie) {
        movie = localMovieTvData.movie.filter((v) => v.voteAverage).sort((a, b) => b.voteAverage - a.voteAverage);
        movie = movie.slice(0, 3).map((item) => {
            item.name = removeExtension(item.name);
            item.type = "movie";
            let genres = "";
            item.genre_ids?.forEach((v, vindex) => {
                if (vindex < item.genre_ids.length - 1) {
                    genres += classifyList1.value.find((h) => h.id == v)?.label ? classifyList1.value.find((h) => h.id == v).label + " " : "";
                } else {
                    genres += classifyList1.value.find((h) => h.id == v)?.label || "";
                }
            });
            item.genres = genres;
            //   item.underImg = CONFIG.IMG_DOMAIN + "/t/p/w1920_and_h1080_bestv2" + item.backdrop;
            return item;
        });
    }
    listData.value = [...tv, ...movie];
    emits("getStarList", listData.value);
});
</script>

<style lang="scss" scoped>
.star-recommend {
    height: 70%;

    ::v-deep .wil-swiper {
        background: transparent;

        .nut-swiper {
            .nut-swiper-inner {
                .nut-swiper-item {
                    .swiper-content {
                        padding: 0 80rpx;
                        width: 100%;
                        height: 100%;
                        box-sizing: border-box;

                        // padding: 140rpx 0 0 0;
                        // background: linear-gradient(180deg, rgba(255, 255, 255, 0), rgba(255, 255, 255, 0.8));
                        .swiper-content-container {
                            padding: 0 24rpx;
                            box-sizing: border-box;
                            width: 100%;
                            height: 100%;
                            display: flex;
                            align-items: center;
                        }

                        .swiper-content-left {
                            flex: 0 0 500rpx;
                            height: 700rpx;
                            border-radius: 12rpx;
                            margin-left: 150rpx;


                            image {
                                width: 100%;
                                height: 100%;
                                border-radius: 12rpx;
                            }

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
                                color: #000;
                                font-size: 66rpx;
                                font-weight: bold;
                                width: 800rpx;
                                display: -webkit-box;
                                -webkit-box-orient: vertical;
                                -webkit-line-clamp: 2;
                                /* 限制显示的行数 */
                                overflow: hidden;
                                text-overflow: ellipsis;
                            }

                            .right-info {
                                display: flex;
                                align-items: center;
                                font-size: 28rpx;
                                font-weight: bold;
                                margin: 20rpx 0;
                                color: #000;

                                .right-info-star {
                                    display: flex;
                                    align-items: center;
                                    margin-left: 50rpx;

                                    image {
                                        width: 30rpx;
                                        height: 30rpx;
                                    }
                                }

                                .right-info-genres {
                                    font-size: 28rpx;
                                    margin-left: 50rpx;
                                }
                            }

                            .right-desc {
                                font-size: 28rpx;
                                color: #545458;
                                font-weight: bold;
                                display: -webkit-box;
                                -webkit-line-clamp: 5;
                                /* 限制行数（可调整） */
                                -webkit-box-orient: vertical;
                                overflow: hidden;
                                text-overflow: ellipsis;
                            }

                        }
                    }
                }
            }
        }
    }
}
</style>
