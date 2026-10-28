<template>
  <div class="source-list">
    <div class="source-list-title">{{ props.title || t('navbar.resourceLibrary') }}</div>
    <div class="source-list-container" v-if="show">
      <div class="source-list-container__classify" :style="{ paddingBottom: item?.list?.length ? '16rpx' : '0' }" v-for="(item, index) in sourceList" :key="item.type">
        <template v-if="item?.list?.length">
          <div class="classify-title">{{ item.type }}</div>
          <div class="classify-list">
            <nut-swipe v-for="vitem in item.list" :key="vitem.name" :ref="el => setRefs(el, vitem.index)" :disabled="props.type === 'list' ? false : true">
              <div :class="['classify-list-item', vitem.index === tabIndex ? 'classify-list-active' : '']" @click="handleChoose(vitem.index)">
                <div class="item-left">
                  <div class="item-left-icon">
                    <image :src="item.img"></image>
                  </div>
                  <div class="item-left-name">{{ vitem.name }}</div>
                </div>
                <div class="item-right">
                  <image src="@/static/sx-gd.png"></image>
                </div>
              </div>
              <template #right>
                <div class="swipe-button">
                  <div :class="['swipe-button-edit', iconIndex === 0 ? 'swipe-button-active' : '']">
                    <image src="@/static/swipe-bj.png"></image>
                  </div>
                  <div :class="['swipe-button-delete', iconIndex === 1 ? 'swipe-button-active' : '']">
                    <image src="@/static/swipe-sc.png"></image>
                  </div>
                </div>
              </template>
            </nut-swipe>
          </div>
        </template>
      </div>
    </div>
    <div :class="['source-list-add', tabIndex === lengthValue ? 'source-list-add_active' : '']" @click="toAdd">
      <image src="@/static/jia-hao.png"></image>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { loginUser, get189Folder, getQuarkFolder, getWopanFolder } from '@/utils/common'
import { onShow } from '@dcloudio/uni-app'

const props = defineProps({
  title: { type: String, default: '' },
  type: { type: String, default: 'list' }, //可选值list、menu，list就是在settings-popup中显示，menu就是在选择目录的页面使用
})
const { t } = useI18n()
const emits = defineEmits(['changeShowType', 'openModal', 'getSelectType'])

const tabIndex = ref(0)
const iconIndex = ref(-1) //表示swipe右侧的那些图标的索引
const sourceList = ref(uni.getStorageSync('sourceList'))
const show = ref(false)
const lengthValue = ref(0)
const itemRefs = ref([])

const isSwipe = ref(false)

//为每个swipe设置ref
const setRefs = (el, index) => {
  itemRefs.value[index] = el
}

//遥控器按键事件
const evtMove = keyCode => {
  if (keyCode === 'KeyUp') {
    if (tabIndex.value > 0) {
      tabIndex.value < lengthValue.value ? itemRefs.value[tabIndex.value].close() : ''
      tabIndex.value--
      isSwipe.value = false
      iconIndex.value = -1
    }
  } else if (keyCode === 'KeyDown') {
    if (tabIndex.value < lengthValue.value) {
      itemRefs.value[tabIndex.value].close()
      tabIndex.value++
      isSwipe.value = false
      iconIndex.value = -1
    }
  } else if (keyCode === 'KeyLeft') {
    // if (tabIndex.value === lengthValue.value) return
    if (isSwipe.value) {
      if (iconIndex.value > 0) {
        iconIndex.value--
      } else {
        isSwipe.value = false
        itemRefs.value[tabIndex.value].close()
        iconIndex.value--
      }
    } else {
      emits('changeShowType', 'settings')
    }
  } else if (keyCode === 'KeyRight') {
    if (tabIndex.value === lengthValue.value) return
    if (!isSwipe.value) {
      isSwipe.value = true
      props.type == 'list' ? itemRefs.value[tabIndex.value].open('left') : ''
    } else {
      iconIndex.value < 1 ? iconIndex.value++ : ''
    }
  } else if (keyCode === 'KeyEnter') {
    if (tabIndex.value === lengthValue.value) {
      uni.navigateTo({
        url: '/pages/tv/source/code-input',
      })
    } else {
      let targetObject = null
      for (const innerObj of sourceList.value) {
        targetObject = innerObj.list.find(item => item.index === tabIndex.value)
        if (targetObject) break // 找到后立即终止循环
      }
      if (iconIndex.value == -1) {
        //选中当前资源
        let { item, vitem } = getItemAndVitem()
        selectSource(item, vitem)
      } else if (iconIndex.value == 0) {
        //编辑当前资源
        uni.showToast({
          title: t('common.comingSoon'),
          icon: 'none',
        })
        // let { item, vitem } = getItemAndVitem()
        // editSource()
      } else if (iconIndex.value == 1) {
        //点击删除
        let { item, vitem } = getItemAndVitem()
        deleteSource(item, vitem)
      }
      //type是menu的逻辑，catelog-settings页面需要获取到当前选中的item，vitem
      if (props.type === 'menu') {
        let { item, vitem } = getItemAndVitem()
        emits('getSelectType', item, vitem)
      }
    }
  }
}

const toAdd = () => {
  uni.navigateTo({
    url: '/pages/tv/source/code-input',
  })
}

//根据tabIndex索引获取当前的item和vitem
const getItemAndVitem = () => {
  let index = 0
  sourceList.value = uni.getStorageSync('sourceList')
  lengthValue.value = 0
  sourceList.value.forEach(item => {
    if (item?.list?.length) {
      lengthValue.value += item.list.length
      item.list.forEach(v => {
        v.index = index
        index++
      })
    }
  })
  let item = {}
  let vitem = {}
  item =
    sourceList.value.find(i => {
      let nowVitem = i.list.find(v => v.index === tabIndex.value)
      if (nowVitem) {
        vitem = nowVitem
        return true
      } else {
        return false
      }
    }) || {}
  return { item, vitem }
}

const clearAcitve = () => {
  sourceList.value.forEach(item => {
    item.list.forEach(v => {
      v.active = false
    })
  })
}
const resetSelect = vitem => {
  clearAcitve()
  vitem.active = true
  uni.setStorageSync('sourceList', sourceList.value)
}

//点击选择
const handleChoose = index => {
  tabIndex.value = index
  let { item, vitem } = getItemAndVitem()
  //type是menu的逻辑，catelog-settings页面需要获取到当前选中的item，vitem
  if (props.type === 'menu') {
    emits('getSelectType', item, vitem)
  } else {
    selectSource(item, vitem)
  }
}

//点击选中资源
const selectSource = (item, vitem) => {
  emits('openModal', {
    title: t('source.selectResourceConfirm'),
    message: t('source.selectResourceMessage'),
    confirmEvent: async () => {
      if (item.type == 'WebDAV') {
        await loginUser(vitem)
          .then(res => {
            vitem.token = res.data.token
            resetSelect(vitem)
          })
          .catch(error => {
            uni.showToast({
              title: t('source.pleaseEnableAlist'),
              icon: 'none',
            })
          })
      } else if (item.type == '天翼云盘') {
        await get189Folder({ folderId: '-11' }, { JSESSIONID: vitem.JSESSIONID, COOKIE_LOGIN_USER: vitem.COOKIE_LOGIN_USER })
          .then(res => {
            if (res.res_code == 0) {
              resetSelect(vitem)
            } else {
              uni.showToast({
                title: t('source.reloginTianyiCloudDrive'),
                icon: 'none',
              })
            }
          })
          .catch(error => {
            uni.showToast({
              title: t('source.reloginTianyiCloudDrive'),
              icon: 'none',
            })
          })
      } else if (item.type == '夸克网盘') {
        await getQuarkFolder({ fid: '0' }, vitem)
          .then(res => {
            if (res.status == 200) {
              resetSelect(vitem)
            } else {
              uni.showToast({
                title: t('source.reloginQuarkCloudDrive'),
                icon: 'none',
              })
            }
          })
          .catch(error => {
            uni.showToast({
              title: t('source.reloginQuarkCloudDrive'),
              icon: 'none',
            })
          })
      } else if (item.type == '联通云盘') {
        await getWopanFolder({ folderId: '0' }, vitem)
          .then(() => {
            resetSelect(vitem)
          })
          .catch(error => {
            uni.showToast({
              title: t('source.reloginUnicomCloudDrive'),
              icon: 'none',
            })
          })
      } else if (item.type == 'Emby') {
        resetSelect(vitem)
      }
    },
  })
}
//点击编辑资源
const editSource = () => {
  uni.navigateTo({
    url: '/pages/tv/source/code-input',
  })
}

//点击删除资源
const deleteSource = (item, vitem) => {
  //item是type，vitem是media
  emits('openModal', {
    title: t('source.deleteResourceConfirm'),
    message: t('source.deleteResourceMessage'),
    confirmEvent: () => {
      item.list = item.list.filter(i => i.name != vitem.name)
      uni.setStorageSync('sourceList', sourceList.value)
      if (vitem.active) {
        uni.removeStorageSync('localMovieTvData')
      }
      iconIndex.value = -1
      let historyPlay = uni.getStorageSync('historyPlay')
      historyPlay = historyPlay.filter(v => v.sourceType != item.type || v.sourceName != vitem.name)
      uni.setStorageSync('historyPlay', historyPlay)
      judegeShow()
    },
  })
}

const judegeShow = () => {
  sourceList.value = uni.getStorageSync('sourceList')
  //为item.list的每一项依次设置一个index，扁平化的index
  let index = 0
  lengthValue.value = 0
  sourceList.value.forEach(item => {
    if (item?.list?.length) {
      lengthValue.value += item.list.length
      item.list.forEach(v => {
        v.index = index
        index++
      })
    }
  })
  show.value = !sourceList.value.every(item => {
    return !item.list.length
  })
  // if (show.value) {
  //     let vitem = {}
  //     let item = sourceList.value.find((v) => {
  //         if (v.list?.length) {
  //             vitem = v.list[0]
  //             return true
  //         } else {
  //             return false
  //         }

  //     });
  //     emits('getSelectType', item, vitem)
  // }
}

onShow(() => {
  judegeShow()
})

defineExpose({
  evtMove,
})
</script>

<style lang="scss" scoped>
.source-list {
  width: 100%;
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;

  .source-list-title {
    background: #272a2f;
    height: 150rpx;
    color: #fff;
    font-size: 44rpx;
    font-weight: bold;
    padding-left: 40rpx;
    padding-top: 60rpx;
    width: 100%;
  }

  .source-list-container {
    padding: 24rpx;
    padding-bottom: 0;
    width: 100%;

    .source-list-container__classify {
      // border-bottom: 2rpx solid #c5c6d0;
      padding-bottom: 16rpx;

      .classify-title {
        font-size: 32rpx;
        color: #c3c6cf;
        font-weight: bold;
        margin-bottom: 24rpx;
      }

      .classify-list {
        width: 100%;
        overflow: hidden;

        :deep(.nut-swipe) {
          .nut-swipe__content {
            .classify-list-item {
              width: 100%;
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 20rpx 24rpx;
              border-radius: 16rpx;

              .item-left {
                display: flex;
                align-items: center;

                .item-left-icon {
                  image {
                    width: 80rpx;
                    height: 80rpx;
                    border-radius: 50%;
                    display: block;
                  }
                }

                .item-left-name {
                  margin-left: 24rpx;
                  color: #c5c6d0;
                  font-weight: bold;
                  font-size: 34rpx;
                }
              }

              .item-right {
                width: 30rpx;
                height: 30rpx;

                image {
                  width: 30rpx;
                  height: 30rpx;
                }
              }
            }

            .classify-list-active {
              background: #e5e6ec;

              .item-left {
                .item-left-name {
                  color: #000015;
                }
              }
            }
          }

          .nut-swipe__right {
            .swipe-button {
              display: flex;
              align-items: center;
              justify-content: space-around;
              height: 100%;
              width: 150rpx;

              .swipe-button-edit {
                padding: 10rpx;
                display: flex;
                align-items: center;
                justify-content: center;
                border: 4rpx solid transparent;

                image {
                  width: 40rpx;
                  height: 40rpx;
                }
              }

              .swipe-button-delete {
                padding: 10rpx;
                display: flex;
                align-items: center;
                justify-content: center;
                border: 4rpx solid transparent;

                image {
                  width: 40rpx;
                  height: 40rpx;
                }
              }

              .swipe-button-active {
                border: 4rpx solid #e5e6ec;
                border-radius: 50%;
              }
            }
          }
        }
      }
    }
  }

  .source-list-add {
    background: #3d4758;
    border-radius: 50%;
    width: 80rpx;
    height: 80rpx;
    flex: 0 0 80rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    border: 4rpx solid transparent;
    margin-top: 24rpx;

    image {
      width: 30rpx;
      height: 30rpx;
    }
  }

  .source-list-add_active {
    border: 4rpx solid #e5e6ec;
  }
}
</style>
