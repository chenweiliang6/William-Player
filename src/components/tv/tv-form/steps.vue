<template>
  <scroll-view :scroll-y="true" :style="{ height: '100%', overflow: 'auto' }" :scroll-top="scrollTop" :scroll-with-animation="true" :showScrollbar="false">
    <div class="steps-form" :style="{ '--step-color': props.stepColor }">
      <nut-form :model-value="formData" ref="formRef" :rules="rules">
        <nut-steps direction="vertical" :current="props.options.length + 1">
          <nut-step :title="item.label" v-for="(item, index) in props.options" :key="item.prop">
            {{ index + 1 }}
            <template #content>
              <nut-form-item :prop="item.prop" :class="[tabIndex === index ? 'form-item-active' : '']">
                <input
                  :value="formData[item.prop]"
                  v-bind="item.formItemProps"
                  v-if="item.type == 'input'"
                  @blur="customBlurValidate(item.prop)"
                  @input="val => changeInput(val, item.prop)"
                  @click="clickInput(item)"
                  :border="false"
                  ref="stepInput"
                  :focus="tabIndex === index"
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
                <div class="item-select" @click="event => clickSelect(event, item)" v-if="item.type == 'select'">
                  <div :class="['item-select-value', !mappingData[item.prop] ? 'item-select-placeholder' : '']">
                    {{ mappingData[item.prop] || item.formItemProps.placeholder }}
                  </div>
                  <wil-icon name="daosanjiao" :custom-color="palette?.text || iconColor" size="30rpx" />
                </div>
                <!-- radio单选按钮 -->
                <nut-radio-group v-model="formData[item.prop]" direction="horizontal" v-if="item.type == 'radio'">
                  <nut-radio :label="vitem.value" v-for="vitem in item.columns">{{ vitem.label }}</nut-radio>
                </nut-radio-group>
                <slot
                  :name="item.prop"
                  v-if="$slots[item.prop] && !item.type"
                  v-bind="{ ...item.formItemProps, customBlurValidate }"
                  @blur="customBlurValidate(item.prop)"
                ></slot>
              </nut-form-item>
            </template>
          </nut-step>
        </nut-steps>
      </nut-form>
      <div :class="['form-button', tabIndex === props.options.length ? 'form-button-active' : '']" v-if="showButton" @click="confirmSubmit">
        {{ buttonText }}
      </div>
      <!-- 用于显示select的popover -->
      <select-popover v-model:visible="showPopover" :options="popoverOptions" :position="popoverPosition" @close="closePopover"></select-popover>
    </div>
  </scroll-view>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import selectPopover from '@/pages/mobile/media/components/popover.vue'
import wilIcon from '@/components/common/wil-icon/index.vue'

const props = defineProps({
  options: { type: Array, default: [] },
  modelValue: { type: Object, default: {} },
  stepColor: { type: String, default: '#bcc7db' },
  buttonText: { type: String, default: '' },
  showButton: { type: Boolean, default: false },
})

const { t } = useI18n()
const buttonText = computed(() => props.buttonText || t('common.confirm'))

const emits = defineEmits(['submit', 'update:modelValue', 'changePicker', 'clickInput', 'blur', 'triggerBoundary', 'confirm'])

const tabIndex = ref(-1)
const scrollTop = ref(0)

const formData = ref({})
const formRef = ref(null)
const mappingData = ref({}) //用于存储那些需要映射的数据，包括select，radio这些，选中的值是id，展示需要中文

const showPopover = ref(false) //点击select的时候，弹窗选择的popover
const popoverOptions = ref([]) //配置popover的列
const popoverPosition = ref({}) //popover的弹出位置
const selectItem = ref({}) //当前点击选中的select

const stepInput = ref(null)

const change = val => {
  emits('update:modelValue', JSON.parse(JSON.stringify(formData.value)))
}

const changeInput = (val, prop) => {
  formData.value[prop] = val.detail.value
  change(val.detail.value)
}
const clickInput = item => {
  emits('clickInput', item)
}

//点击选择的输入框，弹出popover
const clickSelect = (event, item) => {
  popoverPosition.value.clientX = event.clientX || event.touches[0].clientX
  popoverPosition.value.clientY = event.clientY - 44 || event.touches[0].clientY
  popoverOptions.value = item.columns
  showPopover.value = true
  selectItem.value = item
}

//关闭select的popover，需要进行校验
const closePopover = () => {
  customBlurValidate(selectItem.value.prop)
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

//计算每一项的rules校验规则
const rules = computed(() => {
  let rules1 = {}
  props.options.forEach(item => {
    rules1[item.prop] = item.rule
  })
  return rules1
})

//校验表单
const submitForm = callback => {
  formRef.value?.validate().then(({ valid, errors }) => {
    callback(valid)
  })
}

const evtMove = keyCode => {
  if (keyCode === 'KeyDown') {
    if (tabIndex.value < props.options.length) {
      tabIndex.value++
      if (tabIndex.value === props.options.length) {
        scrollTop.value = 3000
      }
    } else {
      emits('triggerBoundary', 'down') //触发边界，可以让父组件自定义触发边界之后的事件
    }
  } else if (keyCode === 'KeyUp') {
    if (tabIndex.value > 0) {
      tabIndex.value--
      if (tabIndex.value === 0) {
        scrollTop.value = 0
      }
    } else {
      tabIndex.value = -1
      emits('triggerBoundary', 'up') //触发边界，可以让父组件自定义触发边界之后的事件
    }
  } else if (keyCode === 'KeyLeft') {
    let item = props.options[tabIndex.value] || {}
    if (item.type === 'radio') {
      //如果是radio，可以左右切换
      let radioIndex = item.columns.findIndex(v => v.value == formData.value[item.prop])
      if (radioIndex > 0) {
        radioIndex--
        formData.value[item.prop] = item.columns[radioIndex].value
      }
    } else {
      emits('triggerBoundary', 'left') //触发边界，可以让父组件自定义触发边界之后的事件
    }
  } else if (keyCode === 'KeyRight') {
    let item = props.options[tabIndex.value] || {}
    if (item.type === 'radio') {
      //如果是radio，可以左右切换
      let radioIndex = item.columns.findIndex(v => v.value == formData.value[item.prop])
      if (radioIndex < item.columns.length - 1) {
        radioIndex++
        formData.value[item.prop] = item.columns[radioIndex].value
      }
    } else {
      emits('triggerBoundary', 'right') //触发边界，可以让父组件自定义触发边界之后的事件
    }
  } else if (keyCode === 'KeyEnter') {
    if (tabIndex.value === props.options.length) {
      //此时是已经到确认按钮了
      emits('confirm')
    } else {
      let item = props.options[tabIndex.value] || {}
      if (item.type === 'select') {
        //为select预留打开select-popover
      }
    }
  }
}

const confirmSubmit = () => {
  emits('confirm')
}

watch(
  () => props.modelValue,
  (val, oldVal) => {
    Object.keys(formData.value).forEach(v => {
      delete formData.value[v]
    })
    Object.keys(val).forEach(v => {
      formData.value[v] = val[v]
      let obj = props.options.find(i => i.prop == v) //查找到当前prop相等的options中的某一项
      if (obj?.type == 'select') {
        //如果显示的中文跟value不是一个值，就像el-select的label，value，那么就将label值存在mappingData中
        val[v] ? (mappingData.value[v] = obj.columns.find(i => i.value == val[v])?.label || val[v]) : ''
      } else if (obj?.type == 'radio') {
        //如果显示的中文跟value不是一个值，就像el-select的label，value，那么就将label值存在mappingData中
        val[v] ? (mappingData.value[v] = obj.columns.find(i => i.value == val[v])?.label || val[v]) : ''
      }
    })
  },
  { deep: true, immediate: true }
)

defineExpose({
  submitForm,
  evtMove,
})
</script>

<style lang="scss" scoped>
.steps-form {
  :deep(.nut-form) {
    .nut-cell-group {
      .nut-cell-group__wrap {
        background-color: transparent;
        box-shadow: none;
        margin-top: 0;

        .nut-steps {
          .nut-step {
            .nut-step-main {
              flex: 1;
              padding-left: 24rpx;

              .nut-step-content {
                .nut-form-item {
                  background: transparent;
                  box-shadow: none;
                  border: 4rpx solid transparent;
                  padding: 23rpx 32rpx;
                  font-size: 28rpx;
                  line-height: 40rpx;
                  // margin: 20rpx 0;
                  margin: 0;
                  margin-bottom: 20rpx;
                  border-radius: 12rpx;

                  .nut-form-item__body {
                    font-size: 28rpx;

                    .nut-form-item__body__slots {
                      .uni-input-placeholder {
                        font-size: 32rpx;
                      }

                      input {
                        caret-color: #315ffd;
                        height: 45rpx;
                        line-height: 45rpx;
                        min-height: 45rpx;
                        color: #fff;
                        font-size: 32rpx;
                      }

                      .item-select {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;

                        .item-select-value {
                          flex: 1;
                          height: 45rpx;
                          line-height: 45rpx;
                          min-height: 45rpx;
                          font-size: 16px;
                        }

                        .item-select-placeholder {
                          color: gray;
                        }
                      }

                      .nut-radio-group {
                        display: flex;
                        align-items: center;

                        .nut-radio {
                          margin-bottom: 0;
                          margin-right: 20rpx !important;
                          font-size: 28rpx;

                          .nut-radio__icon {
                            color: #a0c3f6;
                            width: 40rpx;
                            height: 40rpx;
                            line-height: 40rpx;
                            font-size: 32rpx;
                          }

                          .nut-radio__label {
                            color: #fff;
                            font-size: 28rpx;
                            margin: 0 12rpx !important;
                            line-height: 40rpx;
                          }

                          &:last-child {
                            margin-right: 0 !important;
                          }
                        }
                      }
                    }
                  }

                  &::after {
                    display: block;
                    border-bottom: 1px solid #f5f6f7 !important;
                  }
                }

                .form-item-active {
                  border: 4rpx solid #a0c3f6;

                  &::before {
                    display: none;
                  }

                  &::after {
                    display: none;
                  }
                }

                .form-item-active.error {
                  border-bottom: 4rpx solid #fa2c19;
                }

                .nut-form-item.error {
                  &::before {
                    border-bottom: 1px solid #fa2c19;
                  }

                  &::after {
                    display: none;
                  }
                }
              }
            }
          }

          .nut-step-finish {
            .nut-step-head {
              color: var(--step-color);
              border-color: var(--step-color);

              .nut-step-line {
                background: var(--step-color);
              }

              .nut-step-icon {
                background: var(--step-color);
                font-size: 26rpx;
                line-height: 50rpx;
                width: 50rpx;
                height: 50rpx;

                .nut-step-icon-inner {
                  .nut-step-inner {
                    color: #000;
                  }
                }
              }
            }

            .nut-step-main {
              .nut-step-title {
                color: var(--step-color);
                margin-bottom: 20rpx;
                font-size: 28rpx;
              }
            }
          }

          .nut-step-process {
            .nut-step-head {
              border-color: var(--step-color);

              .nut-step-icon {
                background: var(--step-color);

                .nut-step-icon-inner {
                  .nut-step-inner {
                    color: #000;
                  }
                }

                &::before {
                  background: var(--step-color);
                }
              }
            }
          }
        }
      }
    }
  }

  .form-button {
    display: flex;
    align-items: center;
    justify-content: center;
    color: #000;
    font-size: 32rpx;
    background: #e5e6ec;
    padding: 28rpx 46rpx;
    border-radius: 30rpx;
    margin-right: 10%;
    border: 8rpx solid transparent;
  }

  .form-button-active {
    border: 8rpx solid #315ffd;
  }
}
</style>
