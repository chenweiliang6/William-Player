<template>
    <div :class="['edit', themeClass]">
        <wil-navbar :title="t('navbar.editTitle', { title: routerParams.title })" :right-show="true">
            <template #right>
                <span style="color: var(--app-brand);font-weight: 500;" @click="handleSave">{{ t('common.save') }}</span>
            </template>
        </wil-navbar>
        <div class="edit-container">
            <div class="edit-container-name" v-if="editType === 'nickname'">
                <nut-input show-word-limit :max-length="24" v-model="formData.name"></nut-input>
                <div class="edit-container-name__tip">
                    {{ t('mine.editNicknameTip') }}
                </div>
            </div>
            <div class="edit-container-gender" v-else-if="editType === 'gender'">
                <nut-radio-group v-model="formData.gender" direction="horizontal">
                    <nut-radio label="0" shape="button">{{ t('common.male') }}</nut-radio>
                    <nut-radio label="1" shape="button">{{ t('common.female') }}</nut-radio>
                    <nut-radio label="2" shape="button">{{ t('common.unknown') }}</nut-radio>
                </nut-radio-group>
            </div>
            <div class="edit-container-remark" v-else-if="editType === 'introduction'">
                <nut-textarea v-model="formData.remark" limit-show :max-length="100" :placeholder="t('mine.pleaseInputIntroduction')" />
            </div>
            <div class="edit-container-phonenumber" v-else-if="editType === 'phoneNumber'">
                <wil-form :options="formOptions1" v-model="phoneForm" ref="wil_form">
                    <template #phonenumberOld>
                        <div :style="{ height: '46rpx', lineHeight: '46rpx', color: 'var(--app-text-tertiary)' }">{{ phoneForm.phonenumber }}</div>
                    </template>
                    <template #email>
                        <div :style="{ height: '46rpx', lineHeight: '46rpx', color: 'var(--app-text-tertiary)' }">{{ phoneForm.email }}</div>
                    </template>
                    <template #authCode="item">
                        <div class="authcode">
                            <input v-bind="item" v-model="phoneForm.authCode" :maxlength="6">
                            <span class="authcode-button"
                                :style="{ color: countDown < 61 ? 'rgba(204,204,204,1)' : 'rgb(255, 103, 1)' }"
                                @click="handlePhoneSendEmail">{{
                                    countDown > 60 ? t('auth.sendVerificationCode') : t('auth.resendAfterSeconds', { seconds: countDown })
                                }}</span>
                        </div>
                    </template>
                </wil-form>
            </div>
            <div class="edit-container-email" v-else-if="editType === 'email'">
                <wil-form :options="formOptions2" v-model="emailForm" ref="wil_form">
                    <template #emailOld v-if="emailForm.emailOld">
                        <div :style="{ height: '46rpx', lineHeight: '46rpx', color: 'var(--app-text-tertiary)' }">{{ emailForm.emailOld }}</div>
                    </template>
                    <template #authCodeOld="item" v-if="emailForm.emailOld">
                        <div class="authcode">
                            <input v-bind="item" v-model="emailForm.authCodeOld" :maxlength="6">
                            <span class="authcode-button"
                                :style="{ color: countDownOld < 61 ? 'rgba(204,204,204,1)' : 'rgb(255, 103, 1)' }"
                                @click="handleSendOldEmail">{{
                                    countDownOld > 60 ? t('auth.sendVerificationCode') : t('auth.resendAfterSeconds', { seconds: countDownOld })
                                }}</span>
                        </div>
                    </template>
                    <template #authCode="item">
                        <div class="authcode">
                            <input v-bind="item" v-model="emailForm.authCode" :maxlength="6">
                            <span class="authcode-button"
                                :style="{ color: countDown < 61 ? 'rgba(204,204,204,1)' : 'rgb(255, 103, 1)' }"
                                @click="handleSendEmail">{{
                                    countDown > 60 ? t('auth.sendVerificationCode') : t('auth.resendAfterSeconds', { seconds: countDown })
                                }}</span>
                        </div>
                    </template>
                </wil-form>
            </div>
        </div>
    </div>
</template>

<script setup>
import wilNavbar from '@/components/mobile/wil-navbar/index.vue'
import wilForm from '@/components/mobile/wil-form/index.vue'
import { onLoad, onUnload } from '@dcloudio/uni-app';
import * as CONFIG from '@/utils/config.js'
import { editUserInfo, editUserPhone, editUserEmail } from '@/network/apis.js'
import { toSendEmail, clearEmailTimer } from '@/utils/common.js'
import { computed, ref } from 'vue';
import { useThemeClass } from '@/hooks/useThemeClass'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const routerParams = ref({})
const editType = computed(() => {
    const mapping = {
        [t('mine.nickname')]: 'nickname',
        [t('mine.gender')]: 'gender',
        [t('mine.introduction')]: 'introduction',
        [t('auth.phoneNumber')]: 'phoneNumber',
        [t('auth.email')]: 'email',
        '昵称': 'nickname',
        '性别': 'gender',
        '简介': 'introduction',
        '手机号': 'phoneNumber',
        '邮箱': 'email',
    }
    return routerParams.value.key || mapping[routerParams.value.title]
})
const themeClass = useThemeClass()
const userInfo = ref({})
const countDown = ref(61)//是否展示验证码倒计时,61为不展示
const countDownOld = ref(61) //编辑邮箱的时候使用
const codeEncrypt = ref('')
const codeEncryptOld = ref('') //编辑邮箱的时候使用
userInfo.value = uni.getStorageSync(CONFIG.USER_KEY);
userInfo.value.email = ''
let timer = null
const formData = ref({
    name: userInfo.value.name,
    gender: userInfo.value.gender,
    remark: userInfo.value.remark,
})

//修改电话号的表单
const phoneForm = ref({
    phonenumber: userInfo.value.phonenumber,
    email: userInfo.value.email,
    newPhoneNumber: ''
})

//修改邮箱的表单
const emailForm = ref({
    emailOld: userInfo.value.email,
    email: ''
})

const formOptions1 = computed(() => [
    { label: t('mine.oldPhoneNumber'), prop: "phonenumberOld", formItemProps: {} },
    { label: t('auth.email'), prop: "email", formItemProps: {} },
    { label: t('mine.newPhoneNumber'), prop: "newPhoneNumber", type: 'input', formItemProps: { placeholder: t('mine.pleaseInputNewPhone'), type: "text" } },
    { label: t('mine.emailVerificationCode'), prop: "authCode", formItemProps: { placeholder: t('auth.pleaseInputCode'), type: "number" } },
])

const formOptions2 = computed(() => userInfo.value.email ? [
    { label: t('mine.oldEmail'), prop: "emailOld", formItemProps: {} },
    { label: t('mine.newEmail'), prop: "email", type: 'input', formItemProps: { placeholder: t('mine.pleaseInputNewEmail'), type: "text" } },
    { label: t('mine.oldEmailVerificationCode'), prop: "authCodeOld", formItemProps: { placeholder: t('auth.pleaseInputCode'), type: "number" } },
    { label: t('mine.newEmailVerificationCode'), prop: "authCode", formItemProps: { placeholder: t('auth.pleaseInputCode'), type: "number" } },
] : [
    { label: t('auth.email'), prop: "email", type: 'input', formItemProps: { placeholder: t('auth.pleaseInputEmail'), type: "text" } },
    { label: t('auth.verificationCode'), prop: "authCode", formItemProps: { placeholder: t('auth.pleaseInputCode'), type: "number" } },
])

const handleSave = async () => {
    switch (editType.value) {
        case 'nickname':
            let value = formData.value.name.replace(/\s+/g, '')
            if (value.length < 2) {
                uni.showToast({
                    title: t('mine.wordCountNotEnough'),
                    icon: 'none'
                })
            } else {
                await editUserInfo({ name: formData.value.name })
                userInfo.value.name = formData.value.name
                uni.setStorageSync(CONFIG.USER_KEY, userInfo.value)
                uni.navigateBack()
            }
            break;
        case 'gender':
            await editUserInfo({ gender: formData.value.gender })
            userInfo.value.gender = formData.value.gender
            uni.setStorageSync(CONFIG.USER_KEY, userInfo.value)
            uni.navigateBack()
            break;
        case 'introduction':
            if (formData.value.remark) {
                await editUserInfo({ remark: formData.value.remark })
                userInfo.value.remark = formData.value.remark
                uni.setStorageSync(CONFIG.USER_KEY, userInfo.value)
                uni.navigateBack()
            } else {
                uni.showToast({
                    title: t('mine.pleaseInputIntroduction'),
                    icon: 'none'
                })
            }
            break;
        case 'phoneNumber':
            if (!phoneForm.value.newPhoneNumber) {
                uni.showToast({
                    title: t('auth.phoneRequired'),
                    icon: 'none'
                })
            } else {
                const reg = /^1[3-9][0-9]\d{8}$/; // 手机号正则表达式
                if (!reg.test(phoneForm.value.newPhoneNumber)) {
                    uni.showToast({
                        title: t('auth.phoneInvalid'),
                        icon: 'none'
                    })
                } else {
                    if (phoneForm.value.authCode?.length !== 6) {
                        uni.showToast({
                            title: t('auth.codeSixDigits'),
                            icon: 'none'
                        })
                    } else {
                        await editUserPhone({
                            phonenumber: phoneForm.value.newPhoneNumber,
                            codeEncrypt: codeEncrypt.value,
                            authCode: phoneForm.value.authCode
                        })
                        userInfo.value.phonenumber = phoneForm.value.newPhoneNumber
                        uni.setStorageSync(CONFIG.USER_KEY, userInfo.value)
                        uni.navigateBack()
                    }
                }
            }
            break;
        case 'email':
            if (emailForm.value.email) {
                const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
                if (!emailRegex.test(emailForm.value.email)) {
                    uni.showToast({
                        title: t('auth.emailInvalid'),
                        icon: 'none'
                    })
                } else {
                    if (userInfo.value.email) {
                        if (emailForm.value.authCode?.length !== 6 || emailForm.value.authCodeOld?.length !== 6) {
                            uni.showToast({
                                title: t('auth.codeSixDigits'),
                                icon: 'none'
                            })
                        } else {
                            await editUserEmail({
                                email: emailForm.value.email,
                                codeEncryptOld: codeEncryptOld.value,
                                authCodeOld: emailForm.value.authCodeOld,
                                codeEncrypt: codeEncrypt.value,
                                authCode: emailForm.value.authCode
                            })
                            userInfo.value.email = emailForm.value.email
                            uni.setStorageSync(CONFIG.USER_KEY, userInfo.value)
                            uni.navigateBack()
                        }
                    } else {
                        if (emailForm.value.authCode?.length !== 6) {
                            uni.showToast({
                                title: t('auth.codeSixDigits'),
                                icon: 'none'
                            })
                        } else {
                            await editUserEmail({
                                email: emailForm.value.email,
                                codeEncrypt: codeEncrypt.value,
                                authCode: emailForm.value.authCode
                            })
                            userInfo.value.email = emailForm.value.email
                            uni.setStorageSync(CONFIG.USER_KEY, userInfo.value)
                            uni.navigateBack()
                        }
                    }
                }
            } else {
                uni.showToast({
                    title: t('mine.pleaseInputNewEmailAddress'),
                    icon: 'none'
                })
            }
            break;
    }
}

const handlePhoneSendEmail = () => {
    toSendEmail(codeEncrypt, countDown, phoneForm.value.email)
}
//旧邮箱验证码发送
const handleSendOldEmail = () => {
    toSendEmail(codeEncryptOld, countDownOld, emailForm.value.emailOld)
}

//发送邮箱验证码
const handleSendEmail = () => {
    toSendEmail(codeEncrypt, countDown, emailForm.value.email)
}
onLoad((options) => {
    routerParams.value = options
})
onUnload(() => {
    clearEmailTimer()
})
</script>

<style lang="scss" scoped>
page {
    width: 100%;
    height: 100%;
}

.edit {
    width: 100%;
    height: 100%;
    background: var(--app-bg);
    display: flex;
    flex-direction: column;
    align-items: center;

    .edit-container {
        flex: 1;
        overflow: auto;
        padding: 0 24rpx;
        width: 100%;
        padding-top: 40rpx;

        .edit-container-name {
            :deep(.nut-input) {
                border-radius: 24rpx;
                border-bottom: none;
                padding-right: 20rpx;
            }

            .edit-container-name__tip {
                font-size: 26rpx;
                color: var(--app-text-tertiary);
                margin-top: 24rpx;
            }
        }

        .edit-container-gender {
            :deep(.nut-radio-group) {
                .nut-radio {
                    .nut-radio__button {
                        background: var(--app-bg-card);
                    }
                }
            }
        }

        .edit-container-remark {
            :deep(.nut-textarea) {
                border-radius: 24rpx;
            }
        }

        .edit-container-phonenumber {
            :deep(.base-form) {
                .base-form-content {
                    .nut-form {
                        .nut-cell-group {
                            .nut-cell-group__wrap {
                                margin-bottom: 0;

                                .nut-form-item {
                                    &:last-child {
                                        padding-bottom: 0;
                                    }

                                    .nut-form-item__label {
                                        min-width: 160rpx;

                                        &::before {
                                            display: none;
                                        }
                                    }

                                    .nut-form-item__body {
                                        .nut-form-item__body__slots {
                                            .authcode {
                                                display: flex;
                                                align-items: center;
                                                width: 100%;

                                                input {
                                                    flex: 1;
                                                }

                                                .authcode-button {
                                                    white-space: nowrap;
                                                    font-size: 14px;
                                                    color: rgb(255, 103, 1);
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

        .edit-container-email {
            :deep(.base-form) {
                .base-form-content {
                    .nut-form {
                        .nut-cell-group {
                            .nut-cell-group__wrap {
                                margin-bottom: 0;

                                .nut-form-item {
                                    &:last-child {
                                        padding-bottom: 0;
                                    }

                                    .nut-form-item__label {
                                        min-width: 190rpx;

                                        &::before {
                                            display: none;
                                        }
                                    }

                                    .nut-form-item__body {
                                        .nut-form-item__body__slots {
                                            .authcode {
                                                display: flex;
                                                align-items: center;
                                                width: 100%;

                                                input {
                                                    flex: 1;
                                                }

                                                .authcode-button {
                                                    white-space: nowrap;
                                                    font-size: 14px;
                                                    color: rgb(255, 103, 1);
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
    }
}
</style>
