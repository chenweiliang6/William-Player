<template>
  <div class="base-form">
    <div class="base-form-title" v-if="props.title">
      <div class="base-form-title__left">{{ props.title }}</div>
      <div class="base-form-title__right">
        <slot name="status" v-if="$slots.status"></slot>
        <div class="base-form-title__right-status" v-if="!$slots.status && props.status">{{ props.status }}</div>
      </div>
    </div>
    <div class="base-form-content" :style="{ paddingTop: props.title ? '' : '0' }">
      <nut-form :model-value="formData" :labelPosition="labelPosition" ref="formRef" :rules="rules">
        <nut-form-item :label="item.label" v-for="item in props.options" :key="item.prop" :prop="item.prop" :required="item.required">
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
          <nut-radio-group v-model="formData[item.prop]" direction="horizontal" v-if="item.type == 'radio'">
            <nut-radio :label="vitem.value" v-for="vitem in item.columns" :key="vitem.value">{{ vitem.label }}</nut-radio>
          </nut-radio-group>
          <slot
            :name="item.prop"
            v-if="$slots[item.prop] && !item.type"
            v-bind="{ ...item.formItemProps, customBlurValidate }"
            @blur="customBlurValidate(item.prop)"
          ></slot>
        </nut-form-item>
        <slot name="item" v-if="$slots.item"></slot>
      </nut-form>
    </div>
    <div class="base-form-bottom" v-if="showButton">
      <nut-button custom-color="#ff6701" v-if="!$slots.bottom" @click="confirmCommit">{{ props.buttonText || t('common.confirmAndPublish') }}</nut-button>
      <slot name="bottom" v-if="$slots.bottom"></slot>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps({
  title: { type: String, default: '' },
  status: { type: String, default: '' },
  options: { type: Array, default: [] },
  labelPosition: { type: String, default: 'left' },
  showButton: { type: Boolean, default: false },
  modelValue: { type: Object, default: {} },
  buttonText: { type: String, default: '' },
})

const formRef = ref(null)

const formData = ref({})

const emits = defineEmits(['submit', 'update:modelValue', 'changePicker', 'clickInput', 'blur'])

const change = val => {
  emits('update:modelValue', JSON.parse(JSON.stringify(formData.value)))
}

const changeInput = (val, prop) => {
  formData.value[prop] = val.detail.value
  change(val.detail.value)
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

const clickInput = item => {
  emits('clickInput', item)
}

//确认并发布按钮
const confirmCommit = () => {
  return formRef.value?.validate().then(({ valid, errors }) => {
    if (valid) {
      emits('submit')
      return valid
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
  formRef,
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
.base-form {
  width: 100%;
  background-color: var(--app-bg-card);
  border-radius: 16rpx;
  padding: 22rpx 26rpx;
  box-sizing: border-box;

  &-title {
    background-color: var(--app-bg-card);
    border-radius: 16rpx 16rpx 0 0;
    padding-bottom: 22rpx;
    border-bottom: 2rpx solid var(--app-border-strong);
    display: flex;
    justify-content: space-between;
    align-items: center;

    &__left {
      font-weight: bold;
      font-size: 30rpx;
      color: var(--app-text-secondary);
    }

    &__right {
      &-status {
        padding: 8rpx 26rpx;
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

          .nut-form-item {
            padding-left: 0;
            padding-right: 0;
            box-shadow: none;
            margin: 0;

            &:first-child {
              padding-top: 0;
            }

            &__label {
              min-width: 140rpx;
              width: auto;
              font-size: 28rpx;
              color: var(--app-text-secondary);
              margin-right: 0;
              height: 46rpx;
              line-height: 46rpx;
            }

            &__body {
              &__slots {
                .nut-textarea {
                  &__textarea {
                    color: var(--app-text-secondary);
                    font-size: 28rpx;
                    height: 256rpx;
                  }

                  .textarea-placeholder {
                    font-size: 28rpx;
                    color: var(--app-text-placeholder);
                  }
                }

                .item-picker {
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
                width: 100%;
              }

              .uni-input-placeholder {
                font-size: 28rpx;
              }

              .uni-input-input {
                display: inline;
                height: auto;
                font-size: 28rpx;
                text-align: left;
                color: var(--app-text-secondary);
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

          .nut-form-item.error.line::before {
            left: 0;
            right: 0;
            z-index: 2;
          }

          .nut-form-item.nut-cell::after {
            left: 0;
            right: 0;
            border-bottom: 2rpx solid var(--app-border);
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
            color: var(--app-text-secondary);
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
</style>
