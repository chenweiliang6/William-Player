<template>
  <div :class="['userInfo', themeClass]">
    <div class="userInfo-avatar">
      <wil-uploader @success="uploadSuccess">
        <image
          :src="
            userInfo.avatar ||
            'https://storage.7x24cc.com/storage-server/presigned/ss1/a6-online-fileupload/newMediaImage/2AFA742_427A_user-avatar_20241225150546694newMediaImage.png'
          "
          />
      </wil-uploader>
    </div>
    <div class="userInfo-cell">
      <wil-cell :options="options1" @clickItem="clickItem">
        <template #icon="item">
          {{ item.title }}
        </template>
        <template #title="item">
          <span :style="{ color: item.value ? textSecondaryColor : textPlaceholderColor }">{{ item.value || item.placeholder }}</span>
        </template>
      </wil-cell>
      <wil-cell :options="options2" @clickItem="clickItem">
        <template #icon="item">
          {{ item.title }}
        </template>
        <template #title="item">
          <span :style="{ color: item.value ? textSecondaryColor : textPlaceholderColor }">{{ item.value || item.placeholder }}</span>
        </template>
      </wil-cell>
      <wil-cell :options="options3" @clickItem="clickItem">
        <template #icon="item">
          {{ item.title }}
        </template>
        <template #title="item">
          <div class="alipay-cell" v-if="bindOne.includes(item.key)">
            <wil-icon name="bangdingchenggong" :custom-color="userInfo?.[item.prop] ? successColor : dangerColor" />
            <span :style="{ color: userInfo?.[item.prop] ? successColor : dangerColor }">{{ userInfo?.[item.prop] ? t('mine.bound') : t('mine.unbound') }}</span>
          </div>
          <span :style="{ color: item.value ? textSecondaryColor : textPlaceholderColor }" v-else>{{ item.value || item.placeholder }}</span>
        </template>
        <template #link="item">
          <span class="unbind-button" v-if="bindOne.includes(item.key) && userInfo?.[item.prop]" @click.stop="unBind(item)">{{ t('mine.unbind') }}</span>
        </template>
      </wil-cell>
    </div>
    <wil-modal ref="wil_modal"></wil-modal>
  </div>
</template>

<script setup>
import wilUploader from '@/components/mobile/wil-uploader/index.vue'
import wilCell from '@/components/mobile/wil-cell/index.vue'
import * as CONFIG from '@/utils/config.js'
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { editUserInfo } from '@/network/apis.js'
import wilIcon from '@/components/common/wil-icon/index.vue'
import { bindAlipay, unbindAlipay, bindQQ, unbindQQ, bindWechat, unbindWechat } from '@/network/apis'
import { useThemeNavbar } from '@/hooks/useThemeNavbar'
import { useI18nNavbar } from '@/hooks/useI18nNavbar'
import { useThemeClass } from '@/hooks/useThemeClass'
import { useThemeColors } from '@/hooks/useThemeColors'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
useThemeNavbar()
useI18nNavbar('navbar.personalCenter')
const themeClass = useThemeClass()
const { textSecondaryColor, textPlaceholderColor, successColor, dangerColor } = useThemeColors()
const userInfo = ref({})
const wil_modal = ref(null)
const genderDict = computed(() => ({
  '0': t('common.male'),
  '1': t('common.female'),
  '2': t('common.unknown'),
}))

const bindOne = ['wechat', 'alipay', 'qq']
const options1 = computed(() => [
  {
    key: 'userId',
    title: t('mine.userId'),
    path: null,
    tip: t('mine.cannotModifyUserId'),
    value: uni.getStorageSync(CONFIG.USER_ID),
  },
  {
    key: 'nickname',
    title: t('mine.nickname'),
    path: null,
    value: userInfo.value.name,
  },
  {
    key: 'gender',
    title: t('mine.gender'),
    path: null,
    value: genderDict.value[userInfo.value.gender],
  },
])
const options2 = computed(() => [
  {
    key: 'introduction',
    title: t('mine.introduction'),
    path: null,
    value: userInfo.value.remark,
    placeholder: t('mine.introduceYourself'),
  },
])
const options3 = computed(() => [
  {
    key: 'account',
    title: t('auth.account'),
    path: null,
    tip: t('mine.cannotModifyAccount'),
    value: userInfo.value.userName,
  },
  {
    key: 'phoneNumber',
    title: t('auth.phoneNumber'),
    path: null,
    value: userInfo.value.phonenumber,
  },
  {
    key: 'email',
    title: t('auth.email'),
    path: null,
    value: userInfo.value.email,
    placeholder: t('mine.bindEmail'),
  },
  {
    key: 'wechat',
    title: t('mine.wechat'),
    path: null,
    value: '',
    placeholder: t('mine.bindWechat'),
    prop: 'isBindWechat',
  },
  {
    key: 'alipay',
    title: t('mine.alipay'),
    path: null,
    value: '',
    placeholder: t('mine.bindAlipay'),
    prop: 'isBindAlipay',
  },
  {
    key: 'qq',
    title: t('mine.qq'),
    path: null,
    value: '',
    placeholder: t('mine.bindQq'),
    prop: 'isBindQQ',
  },
  //   {
  //     title: 'Tmdb密钥',
  //     path: null,
  //     tip: '无法修改Tmbd密钥',
  //     value: userInfo.value.tmdbKey,
  //   },
])
const uploadSuccess = event => {
  userInfo.value.avatar = event.data.url
  uni.setStorageSync(CONFIG.USER_KEY, userInfo.value)
  editUserInfo({ avatar: event.data.url })
}

const clickItem = item => {
  if (item.tip) {
    uni.showToast({
      title: item.tip,
      icon: 'none',
    })
  } else {
    if (item.key === 'wechat') {
      toBindWechat()
    } else if (item.key === 'alipay') {
      toBindAlipay()
    } else if (item.key === 'qq') {
      toBindQQ()
    } else {
      uni.navigateTo({
        url: `/pages/mobile/mine/userInfo/edit?title=${item.title}&key=${item.key}`,
      })
    }
  }
}

const toBindPost = async res => {
  await bindAlipay({ alipayCode: res.auth_code })
  userInfo.value.isBindAlipay = true
  uni.setStorageSync(CONFIG.USER_KEY, userInfo.value)
}

//绑定微信
const toBindWechat = () => {
  uni.login({
    provider: 'weixin', //使用qq登录
    onlyAuthorize: true, // 微信登录仅请求授权认证
    success: async loginRes => {
      await bindWechat({ code: loginRes.code })
      userInfo.value.isBindWechat = true
      uni.setStorageSync(CONFIG.USER_KEY, userInfo.value)
    },
  })
}

//绑定支付宝
const toBindAlipay = () => {
  const Alipay = uni.requireNativePlugin('AlipayModule')
  Alipay.openAuthScheme(
    {
      appId: '2021006126672664', // 支付宝分配给开发者的应用 ID
      scheme: 'WilliamPlayer',
    },
    res => {
      toBindPost(res)
    }
  )
}
//绑定QQ
const toBindQQ = async () => {
  uni.login({
    provider: 'qq', //使用qq登录
    success: function (loginRes) {
      uni.getUserInfo({
        provider: 'qq',
        success: async res => {
          await bindQQ({ qqId: res.userInfo.openId })
          userInfo.value.isBindQQ = true
          uni.setStorageSync(CONFIG.USER_KEY, userInfo.value)
        },
      })
    },
  })
}

//解除绑定
const unBind = item => {
  if (item.key === 'wechat') {
    wil_modal.value.showModal({
      title: t('modal.warmTip'),
      content: t('mine.unbindWechatConfirm'),
      confirmColor: '#ff6701',
      confirm: async () => {
        await unbindWechat({})
        userInfo.value.isBindAlipay = false
        uni.setStorageSync(CONFIG.USER_KEY, userInfo.value)
      },
    })
  } else if (item.key === 'alipay') {
    wil_modal.value.showModal({
      title: t('modal.warmTip'),
      content: t('mine.unbindAlipayConfirm'),
      confirmColor: '#ff6701',
      confirm: async () => {
        await unbindAlipay({})
        userInfo.value.isBindAlipay = false
        uni.setStorageSync(CONFIG.USER_KEY, userInfo.value)
      },
    })
  } else if (item.key === 'qq') {
    wil_modal.value.showModal({
      title: t('modal.warmTip'),
      content: t('mine.unbindQqConfirm'),
      confirmColor: '#ff6701',
      confirm: async () => {
        await unbindQQ({})
        userInfo.value.isBindQQ = false
        uni.setStorageSync(CONFIG.USER_KEY, userInfo.value)
      },
    })
  }
}
onShow(() => {
  userInfo.value = uni.getStorageSync(CONFIG.USER_KEY)
})
</script>

<style lang="scss" scoped>
page {
  width: 100%;
  height: 100%;
}

.userInfo {
  width: 100%;
  height: 100%;
  background: var(--app-bg);
  color: var(--app-text-primary);
  padding: 0 24rpx;
  display: flex;
  flex-direction: column;
  align-items: center;

  .userInfo-avatar {
    width: 150rpx;
    height: 150rpx;
    margin: 32rpx 0;

    image {
      width: 150rpx;
      height: 150rpx;
      border-radius: 50%;
      display: block;
    }
  }

  .userInfo-cell {
    width: 100%;

    :deep(.wil-cell) {
      margin-top: 24rpx;

      .nut-cell-group__wrap {
        .nut-cell {
          .nut-cell__icon {
            flex: 0 0 200rpx;
            margin-right: 0;
            color: var(--app-text-tertiary);
            font-weight: 500;
          }

          .nut-cell__title {
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            display: block;
            font-weight: 500;
            .alipay-cell {
              display: flex;
              align-items: center;
              //   justify-content: space-between;

              .iconfont {
                display: block;
                font-size: 30rpx;
              }
              span {
                color: var(--app-danger);
                font-size: 30rpx;
                padding-left: 12rpx;
              }

              .alipay-cell-right {
                font-size: 30rpx;
                color: var(--app-danger);
              }
            }
          }
          .unbind-button {
            font-size: 30rpx;
            color: var(--app-danger);
            position: relative;
            z-index: 9999;
          }
        }
      }
    }
  }
}
</style>
