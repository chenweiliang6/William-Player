<template>
    <div class="settings">
        <div class="settings-title">{{ t('pc.settings') }}</div>
        <div class="language-selector">
            <span class="language-label">{{ t('settings.language') }}</span>
            <div class="language-options">
                <span
                    v-for="lang in localeStore.supportedLocales"
                    :key="lang.value"
                    :class="['language-option', localeStore.locale === lang.value ? 'active' : '']"
                    @click="changeLanguage(lang.value)"
                >
                    {{ lang.label }}
                </span>
            </div>
        </div>
        <wil-cell :options="options1" @clickItem="clickItem"></wil-cell>
        <wil-cell :options="options2" @clickItem="clickItem"></wil-cell>
    </div>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import wilCell from '@/components/electron/wil-cell/index.vue'
import ziyuankuBlack from '@/static/ziyuanku-black.png'
import datasyncBlack from '@/static/datasync-black.png'
import xspBlack from '@/static/xsp-black.png'
import dyBlack from '@/static/dy-black.png'
import fankuiBlack from '@/static/fankui-black.png'
import zanshangBlack from '@/static/zanshang-black.png'
import chilunBlack from '@/static/chilun-black.png'
import guanyuBlack from '@/static/guanyu-black.png'
import { useRouter } from 'vue-router'
import { useLocaleStore } from '@/stores/locale'
import * as CONFIG from '@/utils/config'

const { t } = useI18n()
const localeStore = useLocaleStore()
const router = useRouter()

const options1 = computed(() => [
    { title: t('pc.mediaLibraryList'), icon: ziyuankuBlack, path: '/mediaList' },
    { title: t('pc.dataSync'), icon: datasyncBlack },
    // 目录不再分电影/电视剧，统一为导入目录管理
    { title: t('folderPicker.manage'), icon: xspBlack, path: '/catelog-mulu' },
    { title: t('navbar.resourceLibrary'), icon: ziyuankuBlack, path: '/resource-library' },
])

const options2 = computed(() => [
    { title: t('navbar.feedback'), icon: fankuiBlack, path: '/iframe', query: { title: t('navbar.feedback'), url: CONFIG.BASE_URL.split(":4040")[0] + ':8443/app-webview/#/question' } },
    { title: t('navbar.appreciate'), icon: zanshangBlack, path: '/appreciate' },
    { title: t('pc.otherSettings'), icon: chilunBlack },
    { title: t('navbar.about'), icon: guanyuBlack, path: '/about-version' },
])

const changeLanguage = (locale) => {
    localeStore.setLocale(locale)
}

const clickItem = (item) => {
    router.push({
        path: item.path,
        query: item.query
    })
}

</script>

<style lang="scss" scoped>
.settings {
    .settings-title {
        font-size: 50rpx;
        padding: 24rpx 0 24rpx 24rpx;
        border-bottom: 2rpx solid #e9e9e9;
    }

    .language-selector {
        display: flex;
        align-items: center;
        padding: 24rpx;
        border-bottom: 2rpx solid #e9e9e9;

        .language-label {
            font-size: 28rpx;
            color: #666;
            margin-right: 24rpx;
        }

        .language-options {
            display: flex;
            gap: 16rpx;

            .language-option {
                padding: 8rpx 16rpx;
                font-size: 24rpx;
                color: #333;
                background: #f5f5f5;
                border-radius: 8rpx;
                cursor: pointer;
                transition: all 0.2s;

                &:hover {
                    background: #e0e0e0;
                }

                &.active {
                    background: #fa851e;
                    color: #fff;
                }
            }
        }
    }

    :deep(.wil-cell) {
        border-bottom: 2rpx solid #e9e9e9;

        &:last-child {
            border-bottom: none;
        }
    }
}
</style>
