<template>
    <tv-page @keyCodeClick="keyCodeClick">
        <div class="code-input">
            <div class="code-input-left">
                <wilQrcode ref="wilQrcodeRef" :logo="appLogo"></wilQrcode>
            </div>
            <div class="code-input-right">
                <div class="code-input-right__tabs">
                    <div :class="['tabs-item', item.active ? 'tabs-active' : '', tabIndex === index ? 'tabs-select' : '']"
                        v-for="(item, index) in tabsList" :key="item.value" @click="changeTab(item, index)">{{ item.name
                        }}
                    </div>
                </div>
                <div class="code-input-right__form">
                    <tv-form labelPosition="top" :options="webdavFormOptions" v-model="state.webdavFormData"
                        :showButton="true" :buttonText="t('common.submit')" type="steps" v-if="activeTab === 'WebDAV'" ref="webdav_form"
                        @confirm="confirmSubmit" @triggerBoundary="triggerBoundary">
                    </tv-form>
                    <tv-form labelPosition="top" :options="embyFormOptions" v-model="state.embyFormData"
                        :showButton="true" :buttonText="t('common.submit')" type="steps" v-if="activeTab === 'Emby'" ref="emby_form"
                        @confirm="confirmSubmit" @triggerBoundary="triggerBoundary">
                    </tv-form>
                    <tv-form labelPosition="top" :options="cloud189FormOptions" v-model="state.cloud189FormData"
                        :showButton="true" :buttonText="t('source.accountLogin')" type="steps" v-if="activeTab === '天翼云盘'" ref="cloud189_form"
                        @confirm="confirmSubmit" @triggerBoundary="triggerBoundary">
                        <template #captchaImage>
                            <div class="captcha-image">
                                <image v-if="state.captchaImage" class="captcha-image__img" :src="state.captchaImage"
                                    mode="aspectFit" @click="refreshCaptcha"></image>
                                <div v-else class="captcha-image__tip">{{ state.needCaptcha ?
                                    t('source.captchaLoading') : t('source.captchaNotRequired') }}</div>
                            </div>
                        </template>
                    </tv-form>
                    <tv-form labelPosition="top" :options="wopanFormOptions" v-model="state.wopanFormData"
                        :showButton="true" :buttonText="t('source.accountLogin')" type="steps" v-if="activeTab === '联通云盘'" ref="wopan_form"
                        @confirm="confirmSubmit" @triggerBoundary="triggerBoundary">
                    </tv-form>
                    <tv-form labelPosition="top" :options="cloud139FormOptions" v-model="state.cloud139FormData"
                        :showButton="true" :buttonText="t('source.accountLogin')" type="steps" v-if="activeTab === '移动云盘'" ref="cloud139_form"
                        @confirm="confirmSubmit" @triggerBoundary="triggerBoundary">
                    </tv-form>
                </div>
            </div>
        </div>
    </tv-page>
</template>

<script setup>
import { ref, onMounted, reactive, computed } from "vue";
import { useI18n } from "vue-i18n";
import wilQrcode from "@/components/mobile/wil-qrcode/index.vue";
import appLogo from "@/static/app-logo1.png";
import tvPage from "@/components/tv/tv-page/index.vue";
import tvForm from '@/components/tv/tv-form/index.vue'
import { validateWebdav, validateEmby } from "@/utils/validate";
import { onLoad } from "@dcloudio/uni-app";
import { initLoginParam, login189 } from "@/utils/cloud189/login.js";
import { persist189Token, save189Password } from "@/utils/cloud189/store.js";
import { wopanLogin } from "@/utils/wopan/login.js";
import { persistWopanToken } from "@/utils/wopan/store.js";
import { login139 } from "@/utils/cloud139/login.js";
import { persist139Token, save139Password } from "@/utils/cloud139/store.js";

const { t } = useI18n()
const wilQrcodeRef = ref(null);
const webdav_form = ref(null)
const emby_form = ref(null)
const cloud189_form = ref(null)
const wopan_form = ref(null)
const cloud139_form = ref(null)

const routerParams = ref({})

let port = "";
let timer = null;
let sub189Nvue = null;
let subQuarkNvue = null;

const tabIndex = ref(0)//默认选中的索引
const activeTab = ref('WebDAV')
const tabsList = computed(() => [
    { value: 'WebDAV', name: 'WebDAV', active: activeTab.value === 'WebDAV' },
    { value: 'Emby', name: 'Emby', active: activeTab.value === 'Emby' },
    { value: '天翼云盘', name: t('navbar.tianyiCloudDrive'), active: activeTab.value === '天翼云盘' },
    { value: '夸克网盘', name: t('navbar.quarkCloudDrive'), active: activeTab.value === '夸克网盘' },
    { value: '联通云盘', name: t('source.unicomCloudDrive'), active: activeTab.value === '联通云盘' },
    { value: '移动云盘', name: t('source.cloud139Label'), active: activeTab.value === '移动云盘' }
])

const focusModel = ref('tabs')//当前键盘控制器在哪个组件上

const state = reactive({
    //webdav的表单配置
    webdavFormData: { protocol: 'http' },
    webdavOldData:{},
    //emby的表单配置
    embyFormData: { protocol: 'http' },
    embyOldData:{},
    //天翼云盘账密登录
    cloud189FormData: {},
    needCaptcha: false,
    captchaImage: '',
    cloud189Loading: false,
    //联通云盘账密登录
    wopanFormData: {},
    needWopanSms: false,
    wopanLoading: false,
    //移动云盘账密登录
    cloud139FormData: {},
    cloud139Loading: false,
})
const protocolOptions = [
    { label: 'HTTP', value: 'http' },
    { label: 'HTTPS', value: 'https' },
]
const webdavFormOptions = computed(() => [
    { label: t('source.name'), prop: 'name', type: 'input', formItemProps: { placeholder: t('common.input'), type: 'text' }, rule: [{ required: true, message: t('source.pleaseInputName') }] },
    {
        label: t('source.protocol'), prop: 'protocol', type: 'radio', formItemProps: { placeholder: t('common.select'), type: 'text' }, rule: [{ required: true, message: t('source.pleaseSelectProtocol') }], columns: protocolOptions,
    },
    { label: t('source.address'), prop: 'address', type: 'input', formItemProps: { placeholder: t('source.exampleLocalhost'), type: 'text' }, rule: [{ required: true, message: t('source.pleaseInputAddress') }] },
    { label: t('source.port'), prop: 'port', type: 'input', formItemProps: { placeholder: t('source.requiredPortExample5244'), type: 'number' }, rule: [{ required: true, message: t('source.pleaseInputPort') }] },
    {
        label: t('source.username'),
        prop: 'username',
        type: 'input',
        formItemProps: { placeholder: t('source.alistUsernamePlaceholder'), type: 'text' },
        rule: [{ required: true, message: t('source.pleaseInputUsername') }],
    },
    { label: t('source.password'), prop: 'password', type: 'input', formItemProps: { placeholder: t('source.alistPasswordPlaceholder'), type: 'password' }, rule: [{ required: true, message: t('source.pleaseInputPassword') }] },
])
const embyFormOptions = computed(() => [
    {
        label: t('source.protocol'), prop: 'protocol', type: 'radio', formItemProps: { placeholder: t('common.select'), type: 'text' }, rule: [{ required: true, message: t('source.pleaseSelectProtocol') }], columns: protocolOptions,
    },
    { label: t('source.address'), prop: 'address', type: 'input', formItemProps: { placeholder: t('source.exampleLocalhost'), type: 'text' }, rule: [{ required: true, message: t('source.pleaseInputAddress') }] },
    { label: t('source.port'), prop: 'port', type: 'input', formItemProps: { placeholder: t('source.requiredPortExample443'), type: 'number' }, rule: [{ required: true, message: t('source.pleaseInputPort') }] },
    {
        label: t('source.username'),
        prop: 'username',
        type: 'input',
        formItemProps: { placeholder: t('source.embyUsernamePlaceholder'), type: 'text' },
        rule: [{ required: true, message: t('source.pleaseInputUsername') }],
    },
    { label: t('source.password'), prop: 'password', type: 'input', formItemProps: { placeholder: t('source.embyPasswordPlaceholder'), type: 'password' }, rule: [{ required: true, message: t('source.pleaseInputPassword') }] },
])

const cloud189FormOptions = computed(() => {
    const opts = [
        {
            label: t('source.username'), prop: 'username', type: 'input',
            formItemProps: { placeholder: t('source.accountPlaceholder'), type: 'text' },
            rule: [{ required: true, message: t('source.pleaseInputUsername') }],
        },
        {
            label: t('source.password'), prop: 'password', type: 'input',
            formItemProps: { placeholder: t('source.tianyiPasswordPlaceholder'), type: 'password' },
            rule: [{ required: true, message: t('source.pleaseInputPassword') }],
        },
    ]
    if (state.needCaptcha) {
        opts.push({ label: t('source.captchaLabel'), prop: 'captchaImage' })
        opts.push({
            label: t('source.captchaLabel'), prop: 'captcha', type: 'input',
            formItemProps: { placeholder: t('source.captchaPlaceholder'), type: 'text' },
            rule: [{ required: true, message: t('source.captchaPlaceholder') }],
        })
    }
    return opts
})

//联通云盘表单：手机号+密码，needSmsCode 后动态加短信验证码
const wopanFormOptions = computed(() => {
    const opts = [
        {
            label: t('source.wopanPhone'), prop: 'phone', type: 'input',
            formItemProps: { placeholder: t('source.wopanPhonePlaceholder'), type: 'text' },
            rule: [{ required: true, message: t('source.wopanPhonePlaceholder') }],
        },
        {
            label: t('source.password'), prop: 'password', type: 'input',
            formItemProps: { placeholder: t('source.wopanPasswordPlaceholder'), type: 'password' },
            rule: [{ required: true, message: t('source.pleaseInputPassword') }],
        },
    ]
    if (state.needWopanSms) {
        opts.push({
            label: t('source.wopanSmsCode'), prop: 'smsCode', type: 'input',
            formItemProps: { placeholder: t('source.wopanSmsCodePlaceholder'), type: 'text' },
            rule: [{ required: true, message: t('source.wopanSmsCodePlaceholder') }],
        })
    }
    return opts
})

//移动云盘表单：手机号+密码，无验证码
const cloud139FormOptions = computed(() => [
    {
        label: t('source.cloud139Phone'), prop: 'phone', type: 'input',
        formItemProps: { placeholder: t('source.cloud139PhonePlaceholder'), type: 'text' },
        rule: [{ required: true, message: t('source.cloud139PhonePlaceholder') }],
    },
    {
        label: t('source.password'), prop: 'password', type: 'input',
        formItemProps: { placeholder: t('source.cloud139PasswordPlaceholder'), type: 'password' },
        rule: [{ required: true, message: t('source.pleaseInputPassword') }],
    },
])


// #ifdef APP-PLUS
let ipAddress = ''
let TcpModule = uni.requireNativePlugin("TcpModule");
const lyzmlDLNA = uni.requireNativePlugin("LyzmlDLNAModule");
// #endif
const setQrcode = (sourceType) => {
    // #ifdef APP-PLUS
    if (ipAddress) {
        port = ipAddress + ':' + String(Math.floor(Math.random() * 90000) + 10000);
        let obj = { type: "sourceInput", sourceType, port: port };
        wilQrcodeRef.value.getQRcode(JSON.stringify(obj));
    } else {
        lyzmlDLNA.getIpAddress(val => {
            ipAddress = val
            port = ipAddress + ':' + String(Math.floor(Math.random() * 90000) + 10000);
            let obj = { type: "sourceInput", sourceType, port: port };
            wilQrcodeRef.value.getQRcode(JSON.stringify(obj));
        })
    }
    // #endif

    // #ifndef APP-PLUS
    port = ':' + String(Math.floor(Math.random() * 90000) + 10000);
    let obj = { type: "sourceInput", port: port };
    wilQrcodeRef.value.getQRcode(JSON.stringify(obj));
    // #endif

};

//作为服务端开启服务
const startServer = () => {
    TcpModule.startServer(1025, (res) => { //接收别的设备发过来的数据
        let result = JSON.parse(res)
        if (result.code == 500) {
            uni.showToast({
                title: t('common.errorOccurred'),
                icon: 'none',
            })
        } else {
            uni.setStorageSync('sourceList', result)
            uni.setStorageSync('historyPlay', result.historyPlay)
            uni.setStorageSync('isreload', true)
            uni.switchTab({
                url: '/pages/mobile/video/index'
            })
        }
    });
}

//点击选择tab
const changeTab = (item, index) => {
    if (item.value === activeTab.value) return
    activeTab.value = item.value
    tabIndex.value = index
    if (activeTab.value === '夸克网盘') {
        openQuarkWebview()
    } else {
    }
}

const keyCodeClick = (keyCode) => {
    if (focusModel.value === 'tabs') { //在上面tabs中切换的时候
        if (keyCode === "KeyDown") { //往下就是到下面的输入form，夸克跳webview不能往下
            if (activeTab.value === 'WebDAV' || activeTab.value === 'Emby' || activeTab.value === '天翼云盘' || activeTab.value === '联通云盘' || activeTab.value === '移动云盘') {
                focusModel.value = 'form'
                tabIndex.value = tabsList.value.findIndex(v => v.value === activeTab.value)
                activeTab.value === 'WebDAV' ? webdav_form.value.evtMove(keyCode)
                    : activeTab.value === 'Emby' ? emby_form.value.evtMove(keyCode)
                        : activeTab.value === '天翼云盘' ? cloud189_form.value.evtMove(keyCode)
                            : activeTab.value === '联通云盘' ? wopan_form.value.evtMove(keyCode)
                                : cloud139_form.value.evtMove(keyCode)
            }
        } else if (keyCode === "KeyLeft") {
            if (tabIndex.value > 0) {
                tabIndex.value--
            } else {
                emits('backLeft')
            }
        } else if (keyCode === 'KeyRight') {
            if (tabIndex.value < tabsList.value.length - 1) {
                tabIndex.value++
            }
        } else if (keyCode === 'KeyEnter') {
            changeTab(tabsList.value[tabIndex.value], tabIndex.value)
        }
    } else if (focusModel.value === 'form') {//遥控器在表单中切换的时候
        if (activeTab.value === 'WebDAV') {
            webdav_form.value.evtMove(keyCode)
        } else if (activeTab.value === 'Emby') {
            emby_form.value.evtMove(keyCode)
        } else if (activeTab.value === '天翼云盘') {
            cloud189_form.value.evtMove(keyCode)
        } else if (activeTab.value === '联通云盘') {
            wopan_form.value.evtMove(keyCode)
        } else if (activeTab.value === '移动云盘') {
            cloud139_form.value.evtMove(keyCode)
        }
    }
};

//表单提交
const confirmSubmit = () => {
    if (activeTab.value === 'WebDAV') {
        webdav_form.value.submitForm(valid => {
            if (valid) {
                validateWebdav(!routerParams.value.type, state.webdavFormData,state.webdavOldData, {})
            }
        })
    } else if (activeTab.value === 'Emby') {
        emby_form.value.submitForm(valid => {
            if (valid) {
                validateEmby(!routerParams.value.type, state.embyFormData,state.embyOldData, {})
            }
        })
    } else if (activeTab.value === '天翼云盘') {
        cloud189_form.value.submitForm(valid => {
            if (valid) {
                submitCloud189()
            }
        })
    } else if (activeTab.value === '联通云盘') {
        wopan_form.value.submitForm(valid => {
            if (valid) {
                submitWopan()
            }
        })
    } else if (activeTab.value === '移动云盘') {
        cloud139_form.value.submitForm(valid => {
            if (valid) {
                submit139()
            }
        })
    }
}

//天翼云盘账密登录
const submitCloud189 = async () => {
    if (state.cloud189Loading) return
    const { username, password, captcha } = state.cloud189FormData
    state.cloud189Loading = true
    try {
        if (!state.needCaptcha && !state.captchaImage) {
            // 首次提交：初始化登录参数
            const param = await initLoginParam(username, password)
            state.needCaptcha = !!param.needCaptcha
            state.captchaImage = param.captchaImage || ''
            if (!param.needCaptcha) {
                await doCloud189Login('')
            }
        } else {
            await doCloud189Login(captcha || '')
        }
    } catch (e) {
        uni.showToast({ title: e.message || t('source.loginFailed'), icon: 'none' })
    } finally {
        state.cloud189Loading = false
    }
}

const doCloud189Login = async validateCode => {
    try {
        const tokenInfo = await login189({ validateCode })
        const { isNew } = persist189Token(tokenInfo, {})
        save189Password(tokenInfo.loginName, state.cloud189FormData.username, state.cloud189FormData.password)
        uni.showToast({ title: isNew ? t('source.addAccountSuccess') : t('source.modifyAccountSuccess'), icon: 'none' })
        uni.setStorageSync('isreload', true)
        setTimeout(() => {
            uni.switchTab({ url: '/pages/mobile/video/index' })
        }, 1500)
    } catch (e) {
        uni.showToast({ title: e.message || t('source.loginFailed'), icon: 'none' })
        // 登录失败刷新登录参数（验证码场景）
        if (state.needCaptcha) {
            try {
                const param = await initLoginParam(state.cloud189FormData.username, state.cloud189FormData.password)
                state.captchaImage = param.captchaImage || ''
                state.cloud189FormData.captcha = ''
            } catch (e2) { }
        }
    }
}

//联通云盘两步登录：手机号+密码 → 短信验证码 → token 落库
const submitWopan = async () => {
    if (state.wopanLoading) return
    const { phone, password, smsCode } = state.wopanFormData
    state.wopanLoading = true
    try {
        const result = await wopanLogin(phone, password, state.needWopanSms ? smsCode : '')
        if (result.needSmsCode) {
            // 第一步完成，需要短信验证码
            state.needWopanSms = true
            uni.showToast({ title: t('source.wopanSmsSent'), icon: 'none' })
            return
        }
        persistWopanToken({ phone, accessToken: result.accessToken, refreshToken: result.refreshToken }, {})
        uni.showToast({ title: t('source.addAccountSuccess'), icon: 'none' })
        uni.setStorageSync('isreload', true)
        setTimeout(() => {
            uni.switchTab({ url: '/pages/mobile/video/index' })
        }, 1500)
    } catch (e) {
        uni.showToast({ title: e.message || t('source.loginFailed'), icon: 'none' })
    } finally {
        state.wopanLoading = false
    }
}

//移动云盘三步链登录：手机号+密码 → token 落库
const submit139 = async () => {
    if (state.cloud139Loading) return
    const { phone, password } = state.cloud139FormData
    state.cloud139Loading = true
    try {
        const result = await login139(phone, password)
        save139Password(phone, phone, password)
        const { isNew } = persist139Token({ phone, authorization: result.authorization, account: result.account }, {})
        uni.showToast({ title: isNew ? t('source.addAccountSuccess') : t('source.modifyAccountSuccess'), icon: 'none' })
        uni.setStorageSync('isreload', true)
        setTimeout(() => {
            uni.switchTab({ url: '/pages/mobile/video/index' })
        }, 1500)
    } catch (e) {
        // 风控/账密错误映射为专用提示，其余按 message 兜底
        let title = e.message || t('source.loginFailed')
        if (e.code == 'CLOUD139_RISK_CONTROL') title = t('source.cloud139RiskControl')
        if (e.code == 'CLOUD139_AUTH_FAILED') title = t('source.cloud139AuthFailed')
        uni.showToast({ title, icon: 'none' })
    } finally {
        state.cloud139Loading = false
    }
}

//刷新验证码
const refreshCaptcha = async () => {
    if (!state.cloud189FormData.username || !state.cloud189FormData.password) {
        uni.showToast({ title: t('source.pleaseInputUsernameAndPassword'), icon: 'none' })
        return
    }
    try {
        const param = await initLoginParam(state.cloud189FormData.username, state.cloud189FormData.password)
        state.needCaptcha = !!param.needCaptcha
        state.captchaImage = param.captchaImage || ''
    } catch (e) {
        uni.showToast({ title: e.message || t('source.loginFailed'), icon: 'none' })
    }
}

//表单触发边界
const triggerBoundary = (direction) => {
    if (direction === 'up') {
        focusModel.value = 'tabs'
    }
}

//打开夸克网盘的webview
const openQuarkWebview = () => {
     uni.navigateTo({
        url:`/pages/mobile/backend/quark-webview?platform=TV&url=${encodeURIComponent('https://pan.quark.cn')}`
    })  
}

onMounted(() => {
    setQrcode();
    // #ifdef APP-PLUS
    startServer()
    // #endif

});

onLoad((options) => {
    routerParams.value = options
})
</script>

<style lang="scss" scoped>
page {
    width: 100%;
    height: 100%;
}

.code-input {
    width: 100%;
    height: 100%;
    display: flex;
    background: #000;

    .code-input-left {
        background: url('@/static/bg-wheat.jpg') center repeat;
        flex: 0 0 32%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;

        .wil-qrcode {
            width: 600rpx;
            height: 600rpx;
        }
    }

    .code-input-right {
        flex: 1;
        overflow: hidden;
        display: flex;
        flex-direction: column;

        .code-input-right__tabs {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0 200rpx;
            margin-top: 24rpx;

            .tabs-item {
                padding: 12rpx 46rpx;
                border-radius: 30rpx;
                // background: #fff;
                border: 4rpx solid transparent;
                color: #a0c3f6;
                margin-left: 24rpx;

                &:first-child {
                    margin-left: 0;
                }
            }

            .tabs-active {
                background: #e5e6ec;
                color: #000;
            }

            .tabs-select {
                border: 4rpx solid #e5e6ec;
            }
        }

        .code-input-right__form {
            flex: 1;
            overflow: hidden;
            padding: 0 150rpx 50rpx 150rpx;
            margin-top: 40rpx;

            .captcha-image {
                display: flex;
                align-items: center;

                &__img {
                    width: 240rpx;
                    height: 90rpx;
                }

                &__tip {
                    color: #a0c3f6;
                    font-size: 26rpx;
                }
            }
        }
    }
}
</style>
