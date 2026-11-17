<template>
    <div class="settings-popup">
        <nut-popup position="right" v-bind="$attrs" @closed="closedPopup">
            <div :class="['popup', openAnimation ? 'settings-leave' : 'settings-enter']"
                v-show="showType == 'settings'">
                <div class="popup-title">{{ t('navbar.settings') }}</div>
                <div class="popup-container">
                    <div class="popup-container-list" v-for="(litem, lindex) in settings" :key="lindex">
                        <div :class="['list-item', tabIndex === item.index ? 'list-active' : '']" v-for="item in litem"
                            :key="item.key" @click="clickItem(item)">
                            <wil-icon :name="item.icon"></wil-icon>
                            <span>{{ item.title }}</span>
                        </div>
                    </div>
                </div>
            </div>
            <div :class="['popup', openAnimation ? 'source-enter' : 'source-leave']" v-show="showType == 'language'">
                <div class="popup-title">{{ t('settings.language') }}</div>
                <div class="popup-container">
                    <div class="popup-container-list">
                        <div :class="['list-item', languageIndex === index ? 'list-active' : '']" v-for="(item, index) in languageList"
                            :key="item.value" @click="chooseLanguage(item.value, index)">
                            <wil-icon name="language_en"></wil-icon>
                            <span>{{ item.label }}</span>
                            <span class="list-item-check" v-if="item.value === localeStore.locale">✓</span>
                        </div>
                    </div>
                </div>
            </div>
            <source-list v-if="showType == 'source'" :class="[openAnimation ? 'source-enter' : 'source-leave']"
                ref="source_list" @changeShowType="changeShowType" @openModal="openModal" :title="typeTitle">
            </source-list>
            <catelog-mulu v-if="showType == 'catelogMulu'" :class="[openAnimation ? 'source-enter' : 'source-leave']"
                ref="catelog_mulu" @changeShowType="changeShowType" :title="typeTitle">
            </catelog-mulu>
        </nut-popup>
    </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import wilIcon from '@/components/common/wil-icon/index.vue'
import { useLocaleStore } from '@/stores/locale'
import sourceList from './source-list.vue'
import catelogMulu from './catelog-mulu.vue'

const { t } = useI18n()
const localeStore = useLocaleStore()
const settings = computed(() => [
    [
        { key: 'source', icon: 'ziyuanku', title: t('navbar.resourceLibrary'), index: 0, type: 'source' },
        { key: 'dataSync', icon: 'shujutongbu', title: t('navbar.dataSync'), index: 1, path: '/pages/tv/mine/data-sync' },
        // 目录不再分电影/电视剧，统一为「导入目录」：勾选要扫描的目录并选择导入到媒体库或资源库
        { key: 'importDirectory', icon: 'wenjianjia', title: t('folderPicker.manage'), index: 2, type: 'catelogMulu' },
        { key: 'resourceLibrary', icon: 'wenjianjia', title: t('navbar.resourceLibrary'), index: 3, path: '/pages/tv/source/resource-library' },
    ],
    [
        { key: 'language', icon: 'language_en', title: t('settings.language'), index: 4, type: 'language' },
        { key: 'feedback', icon: 'neibufankui', title: t('navbar.feedback'), index: 5, path: '/pages/tv/mine/enter-qqgroup' },
        { key: 'appreciate', icon: 'zanshang', title: t('navbar.appreciate'), index: 6, path: '/pages/tv/mine/appreciate' },
        { key: 'about', icon: 'guanyu', title: t('navbar.about'), index: 7, path: '/pages/tv/mine/about-version' },
    ]
])
const languageList = computed(() => localeStore.supportedLocales)
const lengthValue = computed(() => settings.value.reduce((sum, item) => sum + item.length, 0))
const tabIndex = ref(0)
const showType = ref('settings')//在popup中展示的模块
const openAnimation = ref(false) //true就是点击跳转，false就是返回

const source_list = ref(null)
const catelog_mulu = ref(null)
const typeTitle = ref('')
const languageIndex = ref(Math.max(languageList.value.findIndex(item => item.value === localeStore.locale), 0))

const emits = defineEmits(['changeSetting', 'openModal', 'closed'])

const evtMove = (keyCode) => {
    if (showType.value === 'settings') {
        if (keyCode === "KeyUp") {
            if (tabIndex.value > 0) {
                tabIndex.value--;
            }
        } else if (keyCode === "KeyDown") {
            if (tabIndex.value < lengthValue.value - 1) {
                tabIndex.value++;
            }
        } else if (keyCode === 'KeyLeft') {
            emits('changeSetting', false)
        } else if (keyCode === 'KeyEnter') {
            let targetObject = null;
            for (const innerArray of settings.value) { // 遍历外层数组
                targetObject = innerArray.find(item => item.index === tabIndex.value); // 在内层数组中查找
                if (targetObject) break; // 找到后立即终止循环
            }
            clickItem(targetObject)
        }
    } else if (showType.value === 'language') {
        if (keyCode === 'KeyUp') {
            languageIndex.value > 0 ? languageIndex.value-- : ''
        } else if (keyCode === 'KeyDown') {
            languageIndex.value < languageList.value.length - 1 ? languageIndex.value++ : ''
        } else if (keyCode === 'KeyLeft') {
            changeShowType('settings')
        } else if (keyCode === 'KeyEnter') {
            chooseLanguage(languageList.value[languageIndex.value].value, languageIndex.value)
        }
    } else if (showType.value === 'source') {
        source_list.value.evtMove(keyCode)
    } else if (showType.value === 'catelogMulu') {
        catelog_mulu.value.evtMove(keyCode)
    }
};

//跳转页面
const clickItem = (item) => {
    if (!item) return
    if (item.path) {
        uni.navigateTo({
            url: item.path
        })
        return
    }
    if (item.type) {
        typeTitle.value = item.title
        if (item.type === 'language') {
            languageIndex.value = Math.max(languageList.value.findIndex(v => v.value === localeStore.locale), 0)
        }
        openAnimation.value = true
        setTimeout(() => {
            showType.value = item.type
            openAnimation.value = false
            setTimeout(() => {
                openAnimation.value = true
            }, 0);
        }, 150);
    }
}

const chooseLanguage = (locale, index) => {
    languageIndex.value = index
    localeStore.setLocale(locale, { syncUniLocale: false })
}

//二级popup返回settings
const changeShowType = (val) => {
    if (val === 'settings') {
        openAnimation.value = false
        setTimeout(() => {
            showType.value = val
            openAnimation.value = true
            setTimeout(() => {
                openAnimation.value = false
            }, 0);
        }, 150);
    }
}

//关闭popup之后
const closedPopup = () => {
    showType.value = 'settings'
    openAnimation.value = false
    emits('closed')
}

const openModal = (obj) => {
    emits('openModal', obj)
}

defineExpose({
    evtMove
})
</script>

<style lang="scss" scoped>
.settings-popup {
    position: relative;
    z-index: 1000;

    :deep(.nut-overlay) {
        background-color: rgba(0, 0, 0, 0.5);
    }

    :deep(.nut-popup) {
        width: 33%;
        height: 100%;
        background: #191c20;
        overflow: hidden;

        .popup {
            width: 100%;
            height: 100%;
            transition: transform 0.15s ease-in-out, opacity 0.15s ease;

            .popup-title {
                background: #272a2f;
                height: 150rpx;
                color: #fff;
                font-size: 44rpx;
                font-weight: bold;
                padding-left: 40rpx;
                padding-top: 60rpx;
            }

            .popup-container {
                padding: 24rpx;

                .popup-container-list {
                    border-bottom: 2rpx solid #747474;
                    padding: 16rpx 0;

                    &:first-child {
                        padding-top: 0;
                    }

                    .list-item {
                        display: flex;
                        align-items: center;
                        padding: 20rpx 24rpx;
                        border-radius: 16rpx;

                        .iconfont {
                            font-size: 70rpx;
                            color: #c5c6d0;
                        }

                        span {
                            padding-left: 24rpx;
                            color: #c5c6d0;
                            font-size: 32rpx;
                        }

                        .list-item-check {
                            margin-left: auto;
                            padding-left: 0;
                            color: #ff6701;
                            font-size: 36rpx;
                        }
                    }

                    .list-active {
                        background: #e5e6ec;

                        .iconfont {
                            color: #000015;
                        }

                        span {
                            color: #000015;
                        }
                    }

                    &:last-child {
                        border-bottom: none;
                    }
                }
            }
        }

        .settings-leave {
            transform: translateX(-50rpx);
            opacity: 0;
        }

        .source-list {
            transform: translateX(50rpx);
            opacity: 0;
            transition: transform 0.15s ease-in-out, opacity 0.15s ease;
        }

        .catelog-mulu {
            transform: translateX(50rpx);
            opacity: 0;
            transition: transform 0.15s ease-in-out, opacity 0.15s ease;
        }

        .source-leave {
            transform: translateX(50rpx);
            opacity: 0;
        }

        .source-enter {
            transform: translateX(0);
            opacity: 1;
        }
    }
}
</style>
