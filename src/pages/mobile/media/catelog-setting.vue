<template>
    <div :class="['catelog-setting', themeClass]">
        <wil-form :options="settings2" :show-button="true" ref="base_form2" v-model="formData" :showButton="false">
            <template #tvCatelog>
                <nut-cell :title="t('navbar.tvCatelogSetting')" is-link @click="toMuluList('tv')">
                    <template #icon>
                        <wil-icon name="xianshiping" class="icon-theme" />
                    </template>
                </nut-cell>
            </template>
            <template #movieCatelog>
                <nut-cell :title="t('navbar.movieCatelogSetting')" is-link @click="toMuluList('movie')">
                    <template #icon>
                        <wil-icon name="dianying" class="icon-theme" />
                    </template>
                </nut-cell>
            </template>
        </wil-form>
    </div>
</template>

<script setup>
//目录设置
import wilForm from "@/components/mobile/wil-form/index.vue";
import wilIcon from "@/components/common/wil-icon/index.vue";
import { useThemeNavbar } from '@/hooks/useThemeNavbar'
import { useI18nNavbar } from '@/hooks/useI18nNavbar'
import { useThemeClass } from '@/hooks/useThemeClass'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
useThemeNavbar()
useI18nNavbar('navbar.catelogSetting')
const themeClass = useThemeClass()
const settings2 = [
    { label: "", prop: "tvCatelog" },
    { label: "", prop: "movieCatelog" },
]

const toMuluList = (type) => {
    uni.navigateTo({
        url: `/pages/mobile/media/catelog-mulu?title=${type === 'tv' ? t('video.tv') : t('video.movie')}`
    })
}
</script>

<style lang="scss" scoped>
page {
    width: 100%;
    height: 100%;
    background: var(--app-bg);
}

.catelog-setting {
    width: 100%;
    height: 100%;
    background: var(--app-bg);
    color: var(--app-text-primary);

    :deep(.base-form) {
        background: transparent;

        .base-form-content {
            .nut-form {
                .nut-cell-group {
                    .nut-cell-group__wrap {
                        margin-bottom: 0;
                        background: transparent;

                        .nut-form-item {
                            background: transparent;
                            padding-top: 0;
                            padding-bottom: 0;

                            .nut-form-item__body {
                                .nut-form-item__body__slots {
                                    .nut-cell {
                                        margin: 0;
                                        box-shadow: none;
                                        background: transparent;

                                        .nut-cell__icon {
                                            .iconfont {
                                                font-size: 40rpx;
                                            }
                                        }

                                        .nut-cell__title {
                                            color: var(--app-text-primary);
                                        }

                                        .nut-cell__link {
                                            color: var(--app-text-primary);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
</style>
