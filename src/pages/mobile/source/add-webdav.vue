<template>
  <div :class="['add-webdav-form', themeClass]">
    <wil-navbar :title="titleText"></wil-navbar>
    <div class="add-webdav-form__container">
      <wil-form v-model="state.formData" :options="options" ref="base_form">
        <template #protocol>
          <nut-cell :title="protoColumns.find(i => i.value == state.formData.protocol)?.text" is-link @click="openPopup"></nut-cell>
        </template>
      </wil-form>
      <nut-button :custom-color="primaryBtnColor" @click="confirmSubmit">
        <span :style="{ color: primaryBtnTextColor }">{{ t('source.confirmAddOrModify', { action: isAdd ? t('common.add') : t('common.modify') }) }}</span>
      </nut-button>
      <!-- <loginPopup v-model:visible="showLoginPopup" @loginSuccess="loginSuccess"></loginPopup> -->
      <nut-popup v-model:visible="showProtocol" position="bottom" safe-area-inset-bottom round>
        <nut-picker v-model="protoValue" :columns="protoColumns" :title="t('source.selectProtocol')" @confirm="confirmPicker" @cancel="showProtocol = false"></nut-picker>
      </nut-popup>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeMount, reactive, ref } from 'vue'
import wilForm from '@/components/mobile/wil-form/index.vue'
import wilNavbar from '@/components/mobile/wil-navbar/index.vue'
import { onLoad } from '@dcloudio/uni-app'
import { validateWebdav } from '@/utils/validate'
import { useThemeClass } from '@/hooks/useThemeClass'
import { useThemeColors } from '@/hooks/useThemeColors'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const themeClass = useThemeClass()
const { primaryBtnColor, primaryBtnTextColor } = useThemeColors()
const state = reactive({
  formData: {
    protocol: 'http',
  },
  oldData: {},
})

const base_form = ref(null)
// const showLoginPopup = ref(false)

const routerParams = ref({})

const title = ref('')
const isAdd = computed(() => title.value == '添加Openlist/Alist' || title.value == t('navbar.addWebdav'))
const titleText = computed(() => isAdd.value ? t('navbar.addWebdav') : t('navbar.modifyWebdav'))

const options = computed(() => [
  { label: t('source.name'), prop: 'name', type: 'input', formItemProps: { placeholder: t('common.input'), type: 'text' }, rule: [{ required: true, message: t('source.pleaseInputName') }] },
  { label: t('source.protocol'), prop: 'protocol', formItemProps: { placeholder: t('common.input'), type: 'text' }, rule: [{ required: true, message: t('source.pleaseSelectProtocol') }] },

  { label: t('source.address'), prop: 'address', type: 'input', formItemProps: { placeholder: t('source.exampleLocalhost'), type: 'text' }, rule: [{ required: true, message: t('source.pleaseInputAddress') }] },
  { label: t('source.port'), prop: 'port', type: 'input', formItemProps: { placeholder: t('source.examplePort5244'), type: 'number' }, rule: [{ required: true, message: t('source.pleaseInputPort') }] },
  {
    label: t('source.username'),
    prop: 'username',
    type: 'input',
    formItemProps: { placeholder: t('source.alistUsernamePlaceholder'), type: 'text' },
    rule: [{ required: true, message: t('source.pleaseInputUsername') }],
  },
  { label: t('source.password'), prop: 'password', type: 'input', formItemProps: { placeholder: t('source.alistPasswordPlaceholder'), type: 'password' }, rule: [{ required: true, message: t('source.pleaseInputPassword') }] },
])

const showProtocol = ref(false)
const protoValue = ref(['HTTP'])
const protoColumns = ref([
  { text: 'HTTP', value: 'http' },
  { text: 'HTTPS', value: 'https' },
])

//修改webdav的时候，同步修改电视剧电影目录
const editMulu = () => {
  const muluData = uni.getStorageSync('muluData')
  let muluMovie = muluData.movie?.find(v => v.name == state.oldData.name)
  let muluTv = muluData.tv?.find(v => v.name == state.oldData.name)
  if (muluMovie) {
    muluMovie.name = state.formData.name
  }
  if (muluTv) {
    muluTv.name = state.formData.name
  }
  uni.setStorageSync('muluData', muluData)
}

const confirmSubmit = () => {
  base_form.value.confirmCommit().then(async valid => {
    if (valid) {
      validateWebdav(isAdd.value, state.formData, state.oldData, routerParams.value) //校验，抽成一个方法了
    }
  })
}

const openPopup = () => {
  showProtocol.value = true
}
const confirmPicker = ({ selectedValue, selectedOptions }) => {
  console.log(selectedOptions)
  state.formData.protocol = selectedValue[0]
  showProtocol.value = false
}

onLoad(options => {
  routerParams.value = options
  title.value = decodeURIComponent(routerParams.value.title)
  if (title.value == '修改Openlist/Alist') {
    let sourceList = uni.getStorageSync('sourceList')
    state.formData = sourceList.find(i => i.type == 'WebDAV').list.find(i => i.address == routerParams.value.address)
    if (!state.formData.protocol) state.formData.protocol = 'http'
    state.oldData = JSON.parse(JSON.stringify(state.formData))
  }
})
</script>

<style lang="scss" scoped>
page {
  width: 100%;
  height: 100%;
}

.add-webdav-form {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  background: var(--app-gradient-mine);
  background-size: 100% 100%;
  box-sizing: border-box;

  &__container {
    padding: 0 24rpx;
    padding-top: 24rpx;
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow: auto;

    ::v-deep .base-form {
      .nut-form {
        .nut-cell-group {
          &__wrap {
            .nut-form-item {
              &__body {
                justify-content: center;

                &__slots {
                  .nut-cell {
                    margin: 0;
                    padding: 0;
                    height: 100%;
                    box-shadow: none;
                    color: var(--app-text-secondary);

                    .nut-cell__title {
                      font-size: 28rpx;
                    }
                  }
                }
              }

              &:last-child {
                padding-bottom: 0;
              }
            }
          }
        }
      }
    }
  }

  :deep(.nut-button) {
    margin-top: 80rpx;
  }
}

// @media (prefers-color-scheme: dark) {
//   .add-webdav-form {
//     background: #1e1e20;

//     &__container {
//       ::v-deep .base-form {
//         background-color: #2f2f2f;

//         .nut-form {
//           .nut-cell-group {
//             &__wrap {
//               background-color: #2f2f2f;

//               .nut-form-item {
//                 background-color: #2f2f2f;

//                 .nut-form-item__label {
//                   color: #fff;
//                 }

//                 &__body {
//                   &__slots {
//                     .nut-cell {
//                       background-color: #2f2f2f;
//                       color: #fff;

//                       .nut-cell__title {
//                         font-size: 28rpx;
//                       }
//                     }
//                   }
//                 }

//                 &::after {
//                   border-color: rgb(73, 73, 73);
//                 }
//               }
//             }
//           }
//         }
//       }
//     }

//     ::v-deep .nut-button {
//       margin-top: 80rpx;
//     }
//   }
// }
</style>
