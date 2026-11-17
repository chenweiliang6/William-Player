<template>
  <div class="tv-form">
    <div class="tv-form-title" v-if="props.title">
      <div class="tv-form-title__left">{{ props.title }}</div>
      <div class="tv-form-title__right">
        <slot name="status" v-if="$slots.status"></slot>
        <div class="tv-form-title__right-status" v-if="!$slots.status && props.status">{{ props.status }}</div>
      </div>
    </div>
    <div class="tv-form-content" :style="{ paddingTop: props.title ? '' : '0' }">
      <nut-form :model-value="formData" :label-position="props.labelPosition" ref="formRef" :rules="rules">
        <nut-form-item :label="item.label" v-for="item in props.options" :key="item.prop" :prop="item.prop" :class="[setLabelPosition(item)]">
          <input
            :value="formData[item.prop]"
            v-bind="item.formItemProps"
            v-if="item.type == 'input'"
            @blur="customBlurValidate(item.prop)"
            @input="val => changeInput(val, item.prop)"
            @click="clickInput(item)"
            :border="false"
          />
          <nut-textarea
            v-model="formData[item.prop]"
            v-bind="item.formItemProps"
            v-if="item.type == 'textarea'"
            :disableDefaultPadding="true"
            @blur="customBlurValidate(item.prop)"
            @change="change"
          />
          <!-- 选择器 -->
          <div class="item-select" @click="clickSelect(item)" v-if="item.type == 'select'">
            <div class="item-select-value">{{ formData[item.prop] }}</div>
            <wil-icon name="daosanjiao" :custom-color="palette?.text || iconColor" size="30rpx" />
          </div>
          <slot
            :name="item.prop"
            v-if="$slots[item.prop] && !item.type"
            v-bind="{ ...item.formItemProps, customBlurValidate }"
            @blur="customBlurValidate(item.prop)"
          ></slot>
        </nut-form-item>
        <slot name="item" v-if="$slots.item"></slot>
      </nut-form>
      <!-- 用于显示select的popover -->
      <select-popover v-model:visible="showPopover" :options="popoverOptions" :position="popoverPosition"></select-popover>
    </div>
    <div class="tv-form-bottom" v-if="showButton">
      <nut-button custom-color="#ff6701" v-if="!$slots.bottom" @click="confirmCommit">{{ buttonText }}</nut-button>
      <slot name="bottom" v-if="$slots.bottom"></slot>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import selectPopover from '../../../pages/mobile/media/components/popover.vue'
import wilIcon from '@/components/common/wil-icon/index.vue'

const props = defineProps({
  title: { type: String, default: '' },
  status: { type: String, default: '' },
  options: { type: Array, default: [] },
  labelPosition: { type: String, default: 'left' },
  showButton: { type: Boolean, default: false },
  modelValue: { type: Object, default: {} },
  buttonText: { type: String, default: '' },
})

const { t } = useI18n()
const buttonText = computed(() => props.buttonText || t('common.confirmAndPublish'))

const formRef = ref(null)

const formData = ref({})

const showPopover = ref(false) //点击select的时候，弹窗选择的popover
const popoverOptions = ref([]) //配置popover的列
const popoverPosition = ref({}) //popover的弹出位置

const emits = defineEmits(['submit', 'update:modelValue', 'changePicker', 'clickInput', 'blur'])

const change = val => {
  emits('update:modelValue', JSON.parse(JSON.stringify(formData.value)))
}

const changeInput = (val, prop) => {
  formData.value[prop] = val.detail.value
  change(val.detail.value)
}

//点击选择器弹出popover
const clickSelect = item => {
  popoverOptions.value = item.columns
  showPopover.value = true
}

//失去焦点校验
const customBlurValidate = prop => {
  formRef.value?.validate(prop).then(({ valid, errors }) => {
    if (valid) {
      emits('blur', prop)
    } else {
      console.warn('error:', errors, '更新焦点')
    }
  })
}

//设置label的位置
const setLabelPosition = item => {
  let className = ''
  if (item.labelPosition) {
    className = 'nut-form-item__' + item.labelPosition
  } else {
    props.labelPosition ? (className = 'nut-form-item__' + props.labelPosition) : ''
  }
  return className
}

const clickInput = item => {
  emits('clickInput', item)
}

//确认并发布按钮
const confirmCommit = () => {
  return formRef.value?.validate().then(({ valid, errors }) => {
    if (valid) {
      // console.log('success:', valid);
      emits('submit')
      return valid
    } else {
      // console.warn('error:', errors);
      // return errors
    }
  })
}

const rules = computed(() => {
  let rules1 = {}
  props.options.forEach(item => {
    rules1[item.prop] = item.rule
  })
  return rules1
})
defineExpose({
  confirmCommit,
})

watch(
  () => props.modelValue,
  (val, oldVal) => {
    Object.keys(formData.value).forEach(v => {
      delete formData.value[v]
    })
    Object.keys(val).forEach(v => {
      formData.value[v] = val[v]
    })
  },
  { deep: true, immediate: true }
)
</script>

<style lang="scss" scoped>
.tv-form {
  width: 100%;
  background-color: transparent;
  border-radius: 16rpx;
  padding: 22rpx 26rpx;
  box-sizing: border-box;

  &-title {
    background-color: #fff;
    border-radius: 16rpx 16rpx 0 0;
    padding-bottom: 22rpx;
    border-bottom: 2rpx solid #d8d8d8;
    display: flex;
    justify-content: space-between;
    align-items: center;

    &__left {
      font-weight: bold;
      font-size: 30rpx;
      color: #343434;
    }

    &__right {
      &-status {
        padding: 8rpx 26rpx;
        // box-sizing: border-box;
        display: inline-block;
        border-radius: 8rpx;
        background: rgba(24, 202, 184, 0.1);
        color: #ff6701;
        font-size: 26rpx;
      }
    }
  }

  &-content {
    box-sizing: border-box;
    padding-top: 22rpx;

    ::v-deep .nut-form {
      .nut-cell-group {
        &__wrap {
          border-radius: 0;
          box-shadow: none;
          margin-top: 0;
          background-color: transparent;

          .nut-form-item {
            // padding-bottom: 0;
            padding-left: 0;
            padding-right: 0;
            box-shadow: none;
            margin: 0;
            background: transparent;

            // align-items: center;
            &:first-child {
              padding-top: 0;
            }

            &__label {
              min-width: 140rpx;
              width: auto;
              font-size: 28rpx;
              color: #353a45;
              margin-right: 0;
              height: 46rpx;
              line-height: 46rpx;
              // display: inline-flex !important;
              // justify-content: center;
              // display: flex !important;
              // flex-direction: row;
              // align-items: center;
            }

            &__body {
              &__slots {
                // padding-top: 1px;
                .nut-textarea {
                  // padding-top: 2px !important;
                  // box-sizing: border-box;
                  &__textarea {
                    color: #353a45;
                    font-size: 28rpx;
                    height: 256rpx;
                  }

                  .textarea-placeholder {
                    font-size: 28rpx;
                    color: #86909c;
                  }
                }

                .item-select {
                  display: flex;
                  align-items: center;
                  justify-content: space-between;
                }

                .nut-rate {
                  &-item {
                    margin-right: 8rpx;

                    .nut-icon::before {
                      position: relative;
                      top: auto;
                      left: auto;
                      -webkit-transform: none;
                      transform: none;
                    }
                  }
                }
              }

              uni-input {
                height: 46rpx;
                line-height: 46rpx;
              }

              .uni-input-placeholder {
                font-size: 28rpx;
              }

              .uni-input-input {
                display: inline;
                height: auto;
                font-size: 28rpx;
                text-align: left;
                color: #353a45;
                width: 100%;
                outline: 0 none;
                border: 0;
                text-decoration: none;
                background: transparent;
                padding: 0;
                margin: 0;
                min-height: 0;
              }
            }
          }

          .nut-form-item__top {
            flex-direction: column;
          }

          .nut-form-item__left {
            flex-direction: row;
          }

          .nut-form-item.error.line::before {
            left: 0;
            right: 0;
            z-index: 2;
            // border-bottom: 1px solid #fa2c19;
          }

          .nut-form-item.nut-cell::after {
            left: 0;
            right: 0;
            border-bottom: 2rpx solid #f5f6f7;
            z-index: 1;
          }
        }
      }
    }

    ::v-deep .nut-popup {
      .nut-picker {
        .nut-picker__bar {
          .nut-picker__title {
            font-weight: bold;
            font-size: 28rpx;
            color: #353a45;
          }

          .nut-picker__right {
            color: #ff6701;
          }
        }
      }
    }
  }

  &-bottom {
    width: 100%;
    margin-top: 212rpx;
    padding-bottom: 60rpx;

    .nut-button {
      width: 100%;
      height: 80rpx;
      border-radius: 40rpx;
    }
  }
}

// @media (prefers-color-scheme: dark) {
//   .tv-form {
//     background-color: #2f2f2f;

//     .tv-form-content {
//       ::v-deep .nut-form {
//         .nut-cell-group {
//           &__wrap {
//             background-color: #2f2f2f;

//             .nut-form-item {
//               background-color: #2f2f2f;

//               .nut-form-item__label {
//                 color: #fff;
//               }

//               &__body {
//                 &__slots {
//                   .uni-input-input {
//                     color: #fff;
//                   }
//                 }
//               }

//               &::after {
//                 border-color: rgb(73, 73, 73);
//               }
//             }
//           }
//         }
//       }
//     }
//   }
// }
</style>
