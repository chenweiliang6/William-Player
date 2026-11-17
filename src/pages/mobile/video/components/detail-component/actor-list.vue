<template>
  <div class="actor-list">
    <div class="story-introduction" v-if="imgData.overview">
      <div class="story-introduction-title">{{ t('video.storyIntroduction') }}</div>
      <div class="story-introduction-text">{{ imgData.overview }}</div>
    </div>
    <div class="related-actors" v-if="actors.length">
      <div class="related-actors-title">{{ t('video.relatedActors') }}</div>
      <scroll-view class="related-actors-scroll" :scroll-x="true" style="width: 100%" :enhanced="true"
        :showScrollbar="false">
        <div class="related-actors-list">
          <div class="related-actors-list__item" v-if="director.name">
            <image class="item-avatar" backgroundColor='#efefef'
              :src="director.profile_path ? CONFIG.IMG_DOMAIN + '/t/p/w100_and_h100_bestv2' + director.profile_path : 'https://storage.7x24cc.com/storage-server/presigned/ss1/a6-online-fileupload/newMediaImage/2AFA742_427A_user-avatar_20241225150546694newMediaImage.png'"
              mode="aspectFill"  />
            <div class="item-name">{{ director.name }}</div>
            <div class="item-job">{{ t('video.director') }}</div>
          </div>
          <div class="related-actors-list__item" v-for="item in actors" :key="item.name">
            <image class="item-avatar" backgroundColor='#efefef' :src="setActorAvatar(item.profile_path)" mode="aspectFill"  />
            <div class="item-name">{{ item.name }}</div>
            <div class="item-role">{{ t('video.rolePrefix') }} {{ item.character }}</div>
          </div>
        </div>
      </scroll-view>
    </div>
    <div class="tip-footer">
      <span class="tip-footer-name">{{ handleSeasonName(props.selectSource.name, true) + '-' }}</span>
      <span class="tip-footer-webdav">{{ t('video.pathPrefix') }}{{ props.selectSource.path }}</span>
      <div class="tip-footer-timesize">
        <span v-if="imgData.runtime">{{ imgData.runtime }}</span><span>{{ props.selectSource.sourceName }}</span>
        <span v-if="props.selectSource.size">{{ props.routerParams.type == 'movie' ? props.selectSource.size :
          handleSize(props.selectSource.size) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onBeforeMount } from "vue";
import { handleSeasonName } from "@/utils/scrape";
import * as CONFIG from "@/utils/config";
import { getActorById } from '@/utils/tmdb'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const props = defineProps({
  routerParams: { type: Object, default: {} },
  selectSource: { type: Object, default: {} },
  imgData: { type: Object, default: {} },
  actorArr: { type: Array, default: [] },
  type: { type: String, default: 'normal' }
});
const director = ref({});
const actors = ref([]);
//处理内存大小
const handleSize = (size) => {
  if (size == 0) return "0";
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(size) / Math.log(1024));
  const formatted = parseFloat((size / Math.pow(1024, i)).toFixed(2));
  return formatted + " " + sizes[i];
};
const getActorList = async () => {
  // TMDB 失败时不抛异常而是返回错误体，必须校验 crew/cast 是否存在，
  // 否则 res.cast.slice 会直接抛 TypeError 把整个详情页打断。
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
  if (!res || res.status_code || !Array.isArray(res.cast)) {
    console.warn('[actor-list] 演职员数据无效:', res?.status_message || res);
    return;
  }
  director.value = res.crew?.[0] || {};
  actors.value = res.cast.slice(0, 20);
};

//设置演员头像
const setActorAvatar = (url) => {
  if (props.type == 'normal') {
    return url ? CONFIG.IMG_DOMAIN + '/t/p/w100_and_h100_bestv2' + url : 'https://storage.7x24cc.com/storage-server/presigned/ss1/a6-online-fileupload/newMediaImage/2AFA742_427A_user-avatar_20241225150546694newMediaImage.png'
  } else if (props.type == 'emby') {
    return url
  }
}

defineExpose({
  getActorList,
});
onBeforeMount(() => {
  if (props.actorArr.length) {
    actors.value = props.actorArr
  } else {
    getActorList();
  }
});
</script>

<style lang="scss" scoped>
.actor-list {
  width: 100%;

  .story-introduction {
    margin-top: 50rpx;

    .story-introduction-title {
      font-size: 32rpx;
      font-weight: bold;
      color: var(--content-text, var(--app-text-primary));
      padding-bottom: 20rpx;
    }

    .story-introduction-text {
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
      text-overflow: ellipsis;
      font-size: 28rpx;
      color: var(--content-text, var(--app-text-primary));
    }
  }

  .related-actors {
    margin-top: 50rpx;

    .related-actors-title {
      font-size: 32rpx;
      font-weight: bold;
      color: var(--content-text, var(--app-text-primary));
      padding-bottom: 20rpx;
    }

    .related-actors-scroll {
      .related-actors-list {
        display: flex;
        align-items: center;
        flex-wrap: nowrap;

        .related-actors-list__item {
          margin-left: 12rpx;
          display: flex;
          flex-direction: column;
          align-items: center;
          flex: 0 0 140rpx;
          overflow: hidden;

          &:first-child {
            margin-left: 0;
          }

          .item-avatar {
            width: 120rpx;
            height: 120rpx;
            border-radius: 50%;
          }

          .item-name {
            font-size: 28rpx;
            color: var(--content-text, var(--app-text-primary));
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            text-align: center;
            width: 100%;
          }

          .item-job {
            padding: 4rpx 6rpx;
            border: 2rpx solid var(--content-border, var(--app-border-strong));
            font-size: 20rpx;
            color: var(--content-text-secondary, var(--app-text-tertiary));
            border-radius: 6rpx;
            height: 35rpx;
            box-sizing: border-box;
          }

          .item-role {
            height: 35rpx;
            line-height: 35rpx;
            font-size: 24rpx;
            color: var(--content-text-secondary, var(--app-text-tertiary));
            width: 100%;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            text-align: center;
          }
        }
      }
    }
  }

  .tip-footer {
    margin-top: 50rpx;
    padding-top: 20rpx;
    border-top: 2rpx solid var(--content-border, var(--app-border-strong));
    width: 100%;

    .tip-footer-name {
      font-size: 24rpx;
      color: var(--content-text-secondary, var(--app-text-tertiary));
    }

    .tip-footer-webdav {
      font-size: 24rpx;
      color: var(--content-text-secondary, var(--app-text-tertiary));
      padding-top: 20rpx;
      word-break: break-all;
      /* 允许在任意字符间断行 */
    }

    .tip-footer-timesize {
      font-size: 24rpx;
      color: var(--content-text-tertiary, var(--app-text-placeholder));
      font-weight: bold;
      display: flex;
      align-items: center;
      padding-top: 20rpx;

      span:nth-child(2) {
        padding-left: 10rpx;
      }

      span:last-child {
        padding-left: 10rpx;
      }
    }
  }
}

// @media (prefers-color-scheme: dark) {
//   .actor-list {
//     .story-introduction {
//       .story-introduction-title {
//         color: #fff;
//       }
//       .story-introduction-text {
//         color: #fff;
//       }
//     }

//     .related-actors {
//       .related-actors-title {
//         color: #fff;
//       }

//       .related-actors-scroll {
//         .related-actors-list {
//           .related-actors-list__item {
//             .item-name {
//               color: #fff;
//             }

//             .item-role {
//               height: 35rpx;
//               line-height: 35rpx;
//               font-size: 24rpx;
//               color: var(--app-text-tertiary);
//               width: 100%;
//               white-space: nowrap;
//               overflow: hidden;
//               text-overflow: ellipsis;
//               text-align: center;
//             }
//           }
//         }
//       }
//     }
//     .tip-footer {
//       margin-top: 50rpx;
//       padding-top: 20rpx;
//       border-top: 2rpx solid var(--app-border-strong);
//       width: 100%;
//       .tip-footer-name {
//         font-size: 24rpx;
//         color: var(--app-text-tertiary);
//       }

//       .tip-footer-webdav {
//         font-size: 24rpx;
//         color: var(--app-text-tertiary);
//         padding-top: 20rpx;
//         word-break: break-all; /* 允许在任意字符间断行 */
//       }

//       .tip-footer-timesize {
//         font-size: 24rpx;
//         color: var(--app-text-placeholder);
//         font-weight: bold;
//         display: flex;
//         align-items: center;
//         padding-top: 20rpx;

//         span:nth-child(2) {
//           padding-left: 10rpx;
//         }

//         span:last-child {
//           padding-left: 10rpx;
//         }
//       }
//     }
//   }
// }</style>
