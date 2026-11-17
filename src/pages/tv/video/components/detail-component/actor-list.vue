<template>
    <div class="actor-list">
        <tv-scroll :scroll-y="true" style="width: 100%;height: 100%;" :enhanced="true" :showScrollbar="false"
            :scrollIntoView="scrollIntoView">
            <div :class="['actor-list-item', tabIndex === index ? 'actor-list-active' : '']"
                v-for="(item, index) in actorList" :key="item.id" :id="'name' + (index + 1)">
                <image
                    :src="item.profile_path ? CONFIG.IMG_DOMAIN + '/t/p/w300_and_h450_bestv2' + item.profile_path : 'https://img1.baidu.com/it/u=429698422,319829798&fm=253&app=120&f=JPEG?w=800&h=800'"
                    mode="aspectFill">
                </image>
                <div class="item-right">
                    <div class="item-right-name">{{ item.name }}</div>
                    <div class="item-right-role">{{ item.known_for_department != 'Acting' ? t('video.director') : t('video.roleWithCharacter', { character: item.character })
                    }}
                    </div>
                    <div class="item-right-gender">{{ item.gender == 1 ? t('common.female') : t('common.male') }}</div>
                    <div class="item-right-tag">TMDB</div>
                </div>
            </div>
        </tv-scroll>
    </div>
</template>

<script setup>
import tvScroll from "@/components/tv/tv-scroll/index.vue";
import * as CONFIG from "@/utils/config";
import { ref } from "vue";
import { useI18n } from 'vue-i18n'
import { debounce } from "@/utils/scrape";

const { t } = useI18n()

const props = defineProps({
    routerParams: { type: Object, default: {} },
})

const emits = defineEmits(['backLeft', 'openPopup'])


const actorList = ref([])
const scrollIntoView = ref('name1')
const tabIndex = ref(0)

//获取演员表
const getActorById = (data, type) => {
    let url = "";
    let obj = JSON.parse(JSON.stringify(data));
    if (!data.movieTvId || !obj.movieTvId) return Promise.reject();
    if (type == "movie") {
        url = `https://api.tmdb.org/3/movie/${obj.movieTvId}/credits`;
    } else if (type == "tv") {
        url = `https://api.tmdb.org/3/tv/${obj.movieTvId}/credits`;
    }
    return new Promise((resolve) => {
        uni.request({
            url: url,
            data: {
                language: "zh-CN",
                api_key: uni.getStorageSync("settingData").tmdbKey,
            },
            method: "GET",
            header: {
                "Content-Type": "application/json",
            },
            success: (res) => {
                resolve(res.data);
            },
        });
    });
};
const getActorList = async () => {
    // TMDB 失败时返回错误体而非抛异常，必须校验，否则 res.cast.slice 会崩
    let res;
    try {
        res = await getActorById(
            {
                movieTvId: props.routerParams.movieTvId,
            },
            props.routerParams.type
        );
    } catch (e) {
        console.warn('[actor-list] 获取演职员失败:', e?.message);
        return;
    }
    if (!res || res.status_code || !Array.isArray(res.cast) || !Array.isArray(res.crew)) {
        console.warn('[actor-list] 演职员数据无效:', res?.status_message || res);
        return;
    }
    actorList.value = res.cast.slice(0, 20);
    let director = res.crew.find(v => v.known_for_department === 'Directing')
    if (director) {
        actorList.value.unshift(director)
    } else {
        if (res.crew[0]) {
            actorList.value.unshift(res.crew[0])
        }
    }
};
getActorList()
let nowTime = 0
const evtMove = (keyCode) => {
    if (keyCode === "KeyUp") {
        if (tabIndex.value > 1) {
            tabIndex.value = tabIndex.value - 2
        }
    } else if (keyCode === "KeyDown") {
        if (tabIndex.value < actorList.value.length - 2) {
            tabIndex.value = tabIndex.value + 2
        }
    } else if (keyCode === "KeyLeft") {
        if (tabIndex.value > 0) {
            tabIndex.value--
        } else {
            emits('backLeft')
        }
    } else if (keyCode === 'KeyRight') {
        if (tabIndex.value < actorList.value.length - 1) {
            tabIndex.value++
        }
    }
    let time = Date.now();
    if (time - nowTime > 300) {
        if (tabIndex.value >= 4) {
            scrollIntoView.value = "name" + (tabIndex.value - 1);
        } else {
            scrollIntoView.value = "name1";
        }
    } else {
        setScrollIntoView();
    }
    console.log(scrollIntoView.value, 'asd');

    nowTime = time;
};
const setScrollIntoView = debounce(() => {
    if (tabIndex.value >= 4) {
        scrollIntoView.value = "name" + (tabIndex.value - 1);
    } else {
        scrollIntoView.value = "name1";
    }
}, 300);
defineExpose({
    evtMove
})

</script>

<style lang="scss" scoped>
.actor-list {
    width: 100%;
    height: 100%;

    ::v-deep .tv-scroll {
        .uni-scroll-view {
            .uni-scroll-view-content {
                display: flex;
                align-items: center;
                flex-wrap: wrap;

                .actor-list-item {
                    display: flex;
                    flex: 0 0 50%;
                    margin-bottom: 24rpx;

                    image {
                        flex: 0 0 250rpx;
                        width: 250rpx;
                        height: 375rpx;
                        border-radius: 20rpx;
                        border: 6rpx solid transparent;
                    }

                    .item-right {
                        padding-top: 6rpx;
                        padding-left: 20rpx;

                        .item-right-name {
                            font-size: 36rpx;
                            font-weight: bold;
                            color: #fff;
                        }

                        .item-right-role {
                            font-size: 28rpx;
                            color: #fff;
                            padding-top: 12rpx;
                        }

                        .item-right-gender {
                            font-size: 32rpx;
                            color: #fff;
                            padding-top: 20rpx;
                            padding-bottom: 12rpx;
                        }

                        .item-right-tag {
                            display: inline-block;
                            font-size: 26rpx;
                            border: 2rpx solid #86caa5;
                            color: #86caa5;
                            border-radius: 10rpx;
                            padding: 6rpx 10rpx;
                        }
                    }
                }

                .actor-list-active {
                    image {
                        border: 6rpx solid #ff6701;
                    }
                }
            }
        }
    }


}
</style>
