<template>
  <div :class="['toolbox', themeClass]">
    <wil-navbar :title="t('navbar.toolbox')"></wil-navbar>
    <div class="toolbox-container">
      <div class="toolbox-container-list">
        <div class="list-item" v-for="item in toolboxArr" :key="item.key" @click="clickItem(item)">
          <image v-if="item.iconURL" class="list-item-logo" :src="item.iconURL" />
          <wil-icon v-else class="list-item-logo" :name="item.icon" custom-color="#ff6701" />
          <span>{{ item.title }}</span>
        </div>
        <!-- <div @click="handleChat">点击进入</div> -->
      </div>
    </div>
  </div>
</template>

<script setup>
import wilNavbar from '@/components/mobile/wil-navbar/index.vue'
import wilIcon from '@/components/common/wil-icon/index.vue'
import expressSearch from '@/static/express-search.png'
import downloadIcon from '@/static/download-manage.png'
import { toStringfy, toParse } from '@/pages/mobile/mine/common'
import { getPhoneCityAndCarrier } from '@/utils/tools'
import * as CONFIG from '@/utils/config'
import { useThemeClass } from '@/hooks/useThemeClass'
import { useI18n } from 'vue-i18n'
import { useI18nNavbar } from '@/hooks/useI18nNavbar'
import { computed } from 'vue'

const themeClass = useThemeClass()
const { t } = useI18n()
useI18nNavbar('navbar.toolbox')

const toolboxArr = computed(() => [
  { key: 'downloadManagement', title: t('navbar.downloadManagement'), iconURL: downloadIcon, path: '/pages/mobile/toolbox/download/index' },
  { key: 'expressSearch', title: t('navbar.expressSearch'), iconURL: expressSearch, path: '/pages/mobile/toolbox/express/search' },
  {
    key: 'tongyiQianwen',
    title: t('toolbox.tongyiQianwenShort'),
    iconURL: 'https://appstoreimg-ipv6.vivo.com.cn/appstore/developer/icon/20260218/rs7abhxe/2026021810452118kcz.webp',
    path: '/pages/mobile/backend/index',
    query: {
      url: 'https://www.qianwen.com/',
      title: t('toolbox.tongyiQianwen'),
    },
  },
  {
    key: 'todayOilPrice',
    title: t('toolbox.todayOilPrice'),
    iconURL: 'https://appimg-drcn.dbankcdn.com/application/icon144/950609aee81d49c38d3c5f1ad5fd5e87.png',
    path: '/pages/mobile/backend/index',
    query: {
      url: 'https://cx.sinopecsales.com/yjkqiantai/core/initCpb',
      title: t('toolbox.todayOilPrice'),
    },
  },
  {
    key: 'weatherForecast',
    title: t('toolbox.weatherForecast'),
    iconURL: 'https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/77/a8/3e/77a83e97-f088-b8f9-71cc-9cf395deae1c/AppIcon-0-0-1x_U007emarketing-0-8-0-0-85-220.png/350x350.png',
    path: '/pages/mobile/backend/index',
    query: {
      url: 'https://html5.moji.com/tpd/mojiweatheraggr/index.html#/home',
      title: t('toolbox.weatherForecast'),
    },
  },
  {
    key: 'cliQrCode',
    title: t('toolbox.cliQrCode'),
    iconURL: 'https://tmpic.tmkoo.com/407b6f44964ededc967541ee3bb13223?v=2022',
    path: '/pages/mobile/backend/index',
    query: {
      url: 'https://cli.im/',
      title: t('toolbox.cliQrCode'),
    },
  },
  {
    key: 'syncWatch',
    title: t('toolbox.syncWatch'),
    iconURL: 'https://cdn.jsdelivr.net/gh/synctv-org/docs@main/logo/logo.png',
    path: 'https://synctv.mofashi.ltd/web/',
  },
  {
    key: 'xiachufang',
    title: t('toolbox.xiachufang'),
    iconURL: 'http://file.market.xiaomi.com/thumbnail/PNG/l62/AppStore/0fd2845f926424d67a95aa14402d2ff14fca354d4',
    path: '/pages/mobile/backend/index',
    query: {
      url: 'https://m.xiachufang.com/',
      title: t('toolbox.xiachufang'),
    },
  },
  {
    key: 'trafficQuery',
    title: t('toolbox.trafficQuery'),
    iconURL: 'https://appstoreimg-ipv6.vivo.com.cn/appstore/developer/icon/20251130/4mfwmxop/202511302251297qv4p.webp',
    path: '/pages/mobile/backend/index',
    query: {
      url: '',
      title: t('toolbox.trafficQuery'),
    },
  },
  {
    key: 'aiQa',
    title: t('navbar.aiQa'),
    iconURL: 'https://appstoreimg-ipv6.vivo.com.cn/appstore/developer/icon/20231211/xnof23rl/202312111204047yhfu.webp',
    path: '/pages/mobile/toolbox/chat/index',
  },
  {
    key: 'newApi',
    title: 'NewApi',
    iconURL: 'https://api.gemai.cc/logo.png',
    path: '/pages/mobile/backend/index',
    query: {
      url: CONFIG.BASE_URL.split(':4040')[0] + ':3001',
      title: 'NewApi',
    },
  },
])

//流量查询单独的方法
const queryTraffic = async item => {
  if (item.key === 'trafficQuery') {
    const userInfo = uni.getStorageSync(CONFIG.USER_KEY)
    if (!userInfo.phonenumber) {
      uni.showToast({
        title: t('toolbox.pleaseBindPhoneFirst'),
        icon: 'none',
      })
      return
    }
    let res = await getPhoneCityAndCarrier({ number: userInfo.phonenumber })
    // 电信/联通/移动是API返回的中文运营商名，保留中文用于比较，用key映射显示
    if (res.data.sp === '电信') {
      item.query.url = 'https://wappark.189.cn/resources/feeBill/home.html?pageType=unifiedlogin&isSMS=true&channel=wap'
    } else if (res.data.sp === '联通') {
      item.query.url = 'https://img.client.10010.com/unicom_weiting/index.html'
    } else if (res.data.sp === '移动') {
      item.query.url = 'https://wap.10086.cn/bj/index_100_100.html'
    }
  }
}

const clickItem = async item => {
  if (item.path.includes('https://') || item.path.includes('http://')) {
    plus.runtime.openURL(item.path, error => {
      if (error) {
        uni.showToast({ title: t('common.openBrowserFailed'), icon: 'none' })
      }
    })
  } else {
    await queryTraffic(item)
    uni.navigateTo({
      url: toStringfy(item.query) ? item.path + '?' + toStringfy(item.query) : item.path,
      animationType: 'slide-in-bottom',
    })
  }
}

const handleChat = () => {
  uni.navigateTo({
    url: '/pages/mobile/toolbox/chat/index',
  })
}
</script>

<style lang="scss" scoped>
page {
  width: 100%;
  height: 100%;
}

.toolbox {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  background: var(--app-gradient-mine);
  position: relative;

  .toolbox-container {
    flex: 1;
    overflow: auto;
    padding: 0 24rpx;
    padding-top: 24rpx;

    .toolbox-container-list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(120rpx, 1fr));
      gap: 24rpx;
      justify-content: space-between;

      .list-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        cursor: pointer;

        image {
          display: block;
          width: 90rpx;
          height: 90rpx;
          border-radius: 50%;
        }

        .iconfont {
          font-size: 90rpx;
        }

        span {
          width: 100%;
          display: block;
          font-size: 28rpx;
          color: var(--app-text-primary);
          padding-top: 16rpx;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          text-align: center;
        }
      }
    }
  }
}
</style>
