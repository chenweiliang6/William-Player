import { ref, nextTick, onMounted } from "vue";
import { onShow, onLoad } from "@dcloudio/uni-app";
import emptyBg from "@/static/empty_bg.png";
import { toStringfy } from "../pages/mobile/mine/common";
import { handleSeasonName, handleSecond, parseTime } from "@/utils/scrape.js";
import posterEmpty from "@/static/poster-empty.png";
import * as CONFIG from "@/utils/config";
import { getEmbyList, getGenresList } from "../utils/emby";
import dayjs from 'dayjs'
import { useI18n } from 'vue-i18n'
import { useSourceSelect } from '@/hooks/useSourceSelect'

export function useHistoryPlayed({ wil_list, wil_modal }) {
    const { t } = useI18n()
    const requestParams = ref({});

    const routerParams = ref({});
    const titleKey = ref('');
    const getTitleText = () => (titleKey.value ? t(titleKey.value) : routerParams.value.title);
    const recentSelect = ref([]);
    const isSelect = ref(false);
    const isClearAll = ref(false);

    const selectType = ref({});
    const selectMedia = ref({});

    const lineNumber = ref(3);
    const lineHeight = ref("");
    let changeItemFn = () => {};

    const windowWidth = ref(375);

    //判断选择的是webdav还是天翼云盘还是夸克
    const { judgeSelect } = useSourceSelect({ selectType, selectMedia });

    const editHistory = () => {
        let historyPlay = uni.getStorageSync("historyPlay");
        if (!historyPlay?.length) {
            uni.showToast({
                title: t('video.noPlayedRecords'),
                icon: 'none'
            })
            return
        }
        isSelect.value = !isSelect.value;
        changeItemFn = (item) => {
            item.select = false;
        };
        recentSelect.value = [];
        nextTick(() => {
            historyPlay.forEach((item) => {
                wil_list.value.handleEdit(item.path);
            });
        });
    };
    const getHistoryList = async (params) => {
        if (routerParams.value.type == 'emby') {//如果是emby，通过请求接口分页获取历史播放记录

        } else {
            let res = uni.getStorageSync("historyPlay");
            res = res.filter((v) => v.sourceType == selectType.value.type && v.sourceName == selectMedia.value.name);
            res.forEach((item) => {
                item.loadImg = true;
            });
            return {
                code: "200",
                rows: res.slice((params.pageNum - 1) * params.pageSize, params.pageNum * params.pageSize),
                total: res.length,
            };
        }
    };

    const listItemStyle = (item) => {
        if (item.index % lineNumber.value == 0) {
            return { marginLeft: 0 };
        } else {
            return { marginLeft: "24rpx" };
        }
    };

    //点击跳转播放
    const toPlayHistory = async (item) => {
        //最近观看在选择状态下
        if (isSelect.value) {
            changeItemFn = (vitem) => {
                vitem.select ? (vitem.select = false) : (vitem.select = true);
            };
            if (item.select) {
                recentSelect.value = recentSelect.value.filter((i) => i.titlePlay != item.titlePlay);
            } else {
                recentSelect.value.push(item);
            }
            nextTick(() => {
                wil_list.value.handleEdit(item.path);
            });
        } else {
            if (item.type == "movie") {
                if (selectType.value.type == "WebDAV") {
                    uni.navigateTo({
                        url: `/pages/${CONFIG.PLATFORM_DIR}/video/video-player?path=${item.path}&type=movie`,
                        success: () => {
                            setItemFirst(item);
                        },
                    });
                } else {
                    uni.navigateTo({
                        url: `/pages/${CONFIG.PLATFORM_DIR}/video/video-player?path=${item.path}&folderFileId=${item.folderFileId}&type=movie`,
                        success: () => {
                            setItemFirst(item);
                        },
                    });
                }
            } else if (item.type == "tv") {
                let localMovieTvData = uni.getStorageSync("localMovieTvData") || {};
                const lastIndex = item.path.lastIndexOf("/");
                let nowTv = localMovieTvData.tv.find((i) => i.name == item.titlePlay && i.path == "/" + item.path.slice(0, lastIndex));
                let openEndTime = {};
                nowTv.openingTime >= 0 ? (openEndTime.openingTime = nowTv.openingTime) : "";
                nowTv.endTime >= 0 ? (openEndTime.endTime = nowTv.endTime) : "";
                if (selectType.value.type == "WebDAV") {
                    uni.navigateTo({
                        url: `/pages/${CONFIG.PLATFORM_DIR}/video/video-player?path=${item.path}&titlePlay=${item.titlePlay}&type=tv&${toStringfy(openEndTime)}`,
                        success: () => {
                            setItemFirst(item);
                        },
                    });
                } else {
                    uni.navigateTo({
                        url: `/pages/${CONFIG.PLATFORM_DIR}/video/video-player?path=${item.path}&folderFileId=${item.folderFileId}&titlePlay=${item.titlePlay}&type=tv&${toStringfy(openEndTime)}`,
                    });
                }
            }
        }
    }

    //长按选择历史播放记录
    const longPress = (item) => {
        if (isSelect.value) return;
        isSelect.value = true;
        changeItemFn = (vitem) => {
            vitem.select ? (vitem.select = false) : (vitem.select = true);
        };
        if (item.select) {
            recentSelect.value = recentSelect.value.filter((i) => i.titlePlay != item.titlePlay);
        } else {
            recentSelect.value.push(item);
        }
        nextTick(() => {
            wil_list.value.handleEdit(item.path);
        });
    };

    const setRecentImg = (poster) => {
        if (poster) {
            return poster
        } else {
            return emptyBg;
        }
    }
    const imgError = (item) => {
        changeItemFn = (item) => {
            item.loadImg = false;
        };
        nextTick(() => {
            wil_list.value.handleEdit(item.path);
        });
    };
    //将点击了的视频放置到数组的第一个去
    const setItemFirst = (item) => {
        let historyPlay = uni.getStorageSync("historyPlay");
        let historyArr1 = historyPlay.filter((v) => v.sourceType != selectType.value.type || v.sourceName != selectMedia.value.name);
        let historyArr2 = historyPlay.filter((v) => v.sourceType == selectType.value.type && v.sourceName == selectMedia.value.name);
        let index = null;
        if (item.type == "tv") {
            index = historyArr2.findIndex((i) => i.type == item.type && i.titlePlay == item.titlePlay);
        } else if (item.type == "movie") {
            index = historyArr2.findIndex((i) => i.type == item.type && getMovieName(i.name) == getMovieName(item.name));
        }
        if (index > -1) {
            historyArr2.splice(index, 1);
            historyArr2.unshift(item);
        } else {
            historyArr2.unshift(item);
        }
        uni.setStorageSync("historyPlay", [...historyArr1, ...historyArr2]);
    };
    //设置平板的宽高
    const setItemWidth = () => {
        let sysinfo = uni.getSystemInfoSync(); // 获取设备系统对象
        windowWidth.value = sysinfo.windowWidth;
        const scale = uni.upx2px(100) / 100; // 获取1rpx对应的px比例
        if (windowWidth.value > 700) {
            lineNumber.value = Math.floor((windowWidth.value - 24) / 169.5);
            let remain = windowWidth.value - 24 - lineNumber.value * 169.5;
            if (remain < (lineNumber.value - 1) * 12) {
                lineNumber.value--;
            }
            lineHeight.value = (((windowWidth.value - uni.upx2px(24 * lineNumber.value + 24)) / lineNumber.value) * 90) / 169.5 / scale + "rpx";
        } else {
            lineNumber.value = 2;
            lineHeight.value = (((windowWidth.value - uni.upx2px(24 * lineNumber.value + 24)) / lineNumber.value) * 90) / 169.5 / scale + "rpx";
        }
    };
    const imgLoad = (item) => {
        if (!routerParams.value.isConnected && !item.loadImg) return;
        changeItemFn = (item) => {
            item.loadImg = true;
        };
        nextTick(() => {
            wil_list.value.handleEdit(item.path);
        });
    };
    const removeExtension = (item) => {
        if (item.type == "tv") {
            item.name1 = `${item.titlePlay} ${t('video.episodeTitle', { episode: item.ji })} ${item.title || t('video.episodeTitle', { episode: item.ji })}`;
            const firstDotIndex = item.name1.indexOf(".");
            let name = firstDotIndex === -1 ? item.name1 : item.name1.substring(0, firstDotIndex);
            if (name.length > 12) {
                name = name.slice(0, 11) + "...";
            }
            return name;
        } else if (item.type == "movie") {
            const firstDotIndex = item.name.indexOf(".");
            let name = firstDotIndex === -1 ? item.name : item.name.substring(0, firstDotIndex);
            if (name.length > 7) {
                name = name.slice(0, 6) + "...";
            }
            return name;
        }
        const firstDotIndex = item.name.indexOf(".");
        let name = firstDotIndex === -1 ? item.name : item.name.substring(0, firstDotIndex);
        name = handleSeasonName(name, true);
        if (name.length > 7) {
            name = name.slice(0, 6) + "...";
        }
        return name;
    };
    const clearAll = () => {
        wil_modal.value.showModal({
            title: t('modal.warmTip'),
            content: t('modal.clearAllPlayedRecordsConfirm'),
            confirmColor: "#ff6701",
            confirm: async () => {
                recentSelect.value = [];
                isClearAll.value = true;
                isSelect.value = false;
                let historyArr = uni.getStorageSync("historyPlay");
                historyArr = historyArr.filter((v) => v.sourceType != selectType.value.type || v.sourceName != selectMedia.value.name);
                uni.setStorageSync("historyPlay", historyArr);
            },
        });
    };
    const clearPart = () => {
        let historyPlay = uni.getStorageSync("historyPlay");
        if (recentSelect.value.length == historyPlay.length) {
            recentSelect.value = [];
            isClearAll.value = true;
            isSelect.value = false;
            historyPlay = historyPlay.filter((v) => v.sourceType != selectType.value.type || v.sourceName != selectMedia.value.name);
            uni.setStorageSync("historyPlay", historyPlay);
        } else {
            let historyArr = historyPlay.filter((v) => v.sourceType == selectType.value.type && v.sourceName == selectMedia.value.name);
            historyArr = historyArr.filter((item) => {
                return recentSelect.value.every((v) => v.path != item.path);
            });
            historyPlay = historyPlay.filter((v) => v.sourceType != selectType.value.type || v.sourceName != selectMedia.value.name);
            recentSelect.value.forEach((item) => {
                wil_list.value.handleDelete(item.path);
            });
            recentSelect.value = [];
            isSelect.value = false;
            uni.setStorageSync("historyPlay", [...historyPlay, ...historyArr]);
        }
    };

    onLoad((options) => {
        judgeSelect();
        routerParams.value = options;
        titleKey.value = routerParams.value.title == '最近观看' || routerParams.value.title == t('video.recentPlayed') ? 'video.recentPlayed' : '';
        routerParams.value.isConnected = routerParams.value.isConnected1 == "true" ? true : false;
        setItemWidth();
    });
    return {
        requestParams, isClearAll, routerParams, titleKey, getTitleText, lineNumber, lineHeight, changeItemFn,
        isSelect, windowWidth, recentSelect,
        editHistory, getHistoryList, listItemStyle, toPlayHistory, longPress,
        setRecentImg, imgError, imgLoad, removeExtension, clearAll, clearPart
    }
}