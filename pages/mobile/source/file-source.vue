<template>
  <div class="fileSource">
    <div class="fileSource-item" v-for="item in sourceList" :key="item.type">
      <div class="fileSource-item__title">{{ item.type }}</div>
      <div class="fileSource-item__list">
        <div :class="['list-item', item.list.length == 1 ? 'list-one' : '']" v-for="vitem in item.list" :key="vitem.name" @click="toPath(vitem)">
          <div class="list-item-img">
            <image :src="vitem.img"></image>
          </div>
          <div class="list-item-name">{{ vitem.name }}</div>
          <image :src="theme=='light' ? icIntoBlack : icIntoWhite" class="list-item-button" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onBeforeMount } from "vue";
import webdavFileIcon from "@/static/webdav-fileIcon.png";
import icIntoBlack from "@/static/ic-intoblack.png";
import icIntoWhite from "@/static/ic-intowhite.png";
import { toParse, toStringfy } from "../mine/common";
import { onUnload } from "@dcloudio/uni-app";

const theme = ref(uni.getSystemInfoSync().theme);

const sourceList = ref([
  {
    type: "网络存储",
    list: [
      {
        name: "WebDAV",
        img: webdavFileIcon,
        path: "/pages/mobile/source/add-webdav",
        query: { title: "添加WebDAV" },
      },
      {
        name: "Emby",
        img: "https://gimg3.baidu.com/search/src=https%3A%2F%2Ftiebapic.baidu.com%2Fforum%2Fw%253D120%253Bh%253D120%2Fsign%3D44147d7d4e82b2b7a79f3dc60196a3d2%2Fc9fcc3cec3fdfc03771506c1c33f8794a4c2265e.jpg%3Ftbpicau%3D2025-04-08-05_5fe90c457d4356ee146a73914e8a8871&refer=http%3A%2F%2Fwww.baidu.com&app=2021&size=w240&n=0&g=0n&q=75&fmt=auto?sec=1744045200&t=627b5377de1d3107a8a09cb4f65c9fdc",
        // path: "/pages/mobile/source/add-webdav",
        // query: { title: "添加WebDAV" },
      },
    ],
  },
  {
    type: "云盘存储",
    list: [
      {
        name: "天翼云盘",
        img: "https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/8c/87/69/8c8769f2-6bfa-19b2-53a4-9e10a555deb3/AppIcon-0-0-1x_U007emarketing-0-7-0-0-sRGB-85-220.png/350x350.png",
        path: "/pages/mobile/backend/cloud189-webview",
        query: {
          url: "https://cloud.189.cn",
          title: "天翼云盘",
        },
      },
      {
        name: "夸克网盘",
        img: "https://is1-ssl.mzstatic.com/image/thumb/Purple211/v4/60/6f/e5/606fe5ab-3bfb-c5e4-5bed-08c9b2b5188f/AppIcon-0-0-1x_U007emarketing-0-7-0-0-85-220.png/350x350.png?",
        path: "/pages/mobile/backend/quark-webview",
        query: {
          url: "https://pan.quark.cn",
          title: "夸克网盘",
        },
      },
    ],
  },
]);

const toPath = (vitem) => {
  if (vitem.path) {
    uni.navigateTo({
      url: vitem.path + "?" + toStringfy(vitem.query),
    });
  } else {
    uni.showToast({
      title: "敬请期待...",
      icon: "none",
    });
  }
};
const changeTheme = () => {
  theme.value = uni.getSystemInfoSync().theme;
};
uni.onThemeChange(changeTheme);

onUnload(() => {
  uni.offThemeChange(changeTheme);
});
</script>

<style lang="scss" scoped>
page {
  width: 100%;
  height: 100%;
}

.fileSource {
  background: #f6f7f8;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  overflow: auto;
  padding: 0 24rpx;

  .fileSource-item {
    padding-bottom: 16rpx;

    .fileSource-item__title {
      font-size: 28rpx;
      color: #6d6d6d;
      padding: 16rpx 0;
    }

    .fileSource-item__list {
      background: #fff;
      border-radius: 14rpx;

      .list-item {
        background: #fff;
        padding: 10rpx 24rpx;
        display: flex;
        align-items: center;
        position: relative;
        border-top: 2rpx solid rgb(241, 241, 241);
        .list-item-name {
          color: #000;
        }
        &:active {
          background: rgb(241, 241, 241);
        }
        &:first-child {
          border-radius: 14rpx 14rpx 0 0;
          border-top: none;
        }
        &:last-child {
          border-radius: 0 0 14rpx 14rpx;
        }

        .list-item-img {
          width: 90rpx;
          height: 90rpx;
          position: relative;

          image {
            width: 90rpx;
            height: 90rpx;
            border-radius: 50%;
          }
        }

        .list-item-name {
          padding-left: 20rpx;
          font-size: 32rpx;
        }

        .list-item-button {
          position: absolute;
          right: 24rpx;
          top: 50%;
          transform: translateY(-50%);
          width: 30rpx;
          height: 30rpx;
        }
      }

      .list-one {
        border-radius: 14rpx !important;
        border: none !important;
      }
    }
  }
}
@media (prefers-color-scheme: dark) {
  .fileSource {
    background: #1e1e20;
    .fileSource-item {
      .fileSource-item__title {
        color: rgb(154, 154, 154);
      }
      .fileSource-item__list {
        background: #2f2f2f;
        .list-item {
          background: #2f2f2f;
          border-top: 2rpx solid rgb(73, 73, 73);
          .list-item-name {
            color: #fff;
          }
          &:active {
            background: rgb(73, 73, 73);
          }
        }
      }
    }
  }
}
</style>
