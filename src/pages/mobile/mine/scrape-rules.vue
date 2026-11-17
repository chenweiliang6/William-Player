<template>
  <div :class="['scrape-rules', themeClass]">
    <div class="scrape-rules__header">
      <div class="scrape-rules__title">{{ t('scrapeRules.title') }}</div>
      <div class="scrape-rules__hint">{{ t('scrapeRules.hint') }}</div>
    </div>

    <nut-tabs v-model="activeTab" class="scrape-rules__tabs">
      <nut-tab-pane :title="t('scrapeRules.tabBlacklist')" pane-key="blacklist">
        <div class="scrape-rules__desc">{{ t('scrapeRules.blacklistDesc') }}</div>
        <nut-textarea
          v-model="blacklistText"
          :placeholder="t('scrapeRules.blacklistPlaceholder')"
          :rows="8"
          :maxlength="-1"
          class="scrape-rules__textarea"
        />
      </nut-tab-pane>

      <nut-tab-pane :title="t('scrapeRules.tabExt')" pane-key="ext">
        <div class="scrape-rules__desc">{{ t('scrapeRules.extDesc') }}</div>
        <nut-textarea
          v-model="extText"
          :placeholder="t('scrapeRules.extPlaceholder')"
          :rows="5"
          :maxlength="-1"
          class="scrape-rules__textarea"
        />
      </nut-tab-pane>

      <nut-tab-pane :title="t('scrapeRules.tabTags')" pane-key="tags">
        <div class="scrape-rules__desc">{{ t('scrapeRules.tagsDesc') }}</div>
        <nut-textarea
          v-model="tagsText"
          :placeholder="t('scrapeRules.tagsPlaceholder')"
          :rows="8"
          :maxlength="-1"
          class="scrape-rules__textarea"
        />
      </nut-tab-pane>

      <nut-tab-pane :title="t('scrapeRules.tabConcurrency')" pane-key="concurrency">
        <div class="scrape-rules__desc">{{ t('scrapeRules.concurrencyDesc') }}</div>

        <div class="scrape-rules__field">
          <div class="scrape-rules__field-label">{{ t('scrapeRules.scanConcurrency') }}</div>
          <nut-input
            v-model="scanConcurrencyText"
            type="number"
            :placeholder="t('scrapeRules.concurrencyPlaceholder')"
          />
          <div class="scrape-rules__field-hint">{{ t('scrapeRules.scanConcurrencyHint') }}</div>
        </div>

        <div class="scrape-rules__field">
          <div class="scrape-rules__field-label">{{ t('scrapeRules.matchConcurrency') }}</div>
          <nut-input
            v-model="matchConcurrencyText"
            type="number"
            :placeholder="t('scrapeRules.concurrencyPlaceholder')"
          />
          <div class="scrape-rules__field-hint">{{ t('scrapeRules.matchConcurrencyHint') }}</div>
        </div>
      </nut-tab-pane>
    </nut-tabs>

    <div class="scrape-rules__footer">
      <nut-button custom-color="#ff6701" @click="save">{{ t('common.save') }}</nut-button>
      <nut-button plain @click="reset">{{ t('scrapeRules.resetDefault') }}</nut-button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useThemeClass } from '@/hooks/useThemeClass'
import { getUserRules, setUserRules, invalidateRules } from '@/utils/scrape'

const { t } = useI18n()
const { themeClass } = useThemeClass()

const activeTab = ref('blacklist')

// 三个维度都用「一行一条」的文本编辑，比 JSON 直观
const blacklistText = ref('')
const extText = ref('')
const tagsText = ref('')

// 并发度用文本保存而不是 number：空串要能被区分成「未填」（= 无上限），
// 直接用 number 会因为 0 和空都变成 0 而丢掉这个语义。
const scanConcurrencyText = ref('')
const matchConcurrencyText = ref('')

const toLines = arr => (Array.isArray(arr) ? arr.join('\n') : '')
const fromLines = text =>
  String(text || '')
    .split('\n')
    .map(v => v.trim())
    .filter(Boolean)

// 载入现有自定义规则
const load = () => {
  const rules = getUserRules() || {}
  blacklistText.value = toLines(rules.pathBlacklist)
  extText.value = toLines(rules.videoExtensions)
  tagsText.value = toLines(rules.releaseTags)
  scanConcurrencyText.value = rules.scanConcurrency != null ? String(rules.scanConcurrency) : ''
  matchConcurrencyText.value = rules.matchConcurrency != null ? String(rules.matchConcurrency) : ''
}

// 并发度解析。
// 空串 = 无上限（0）。非法输入**必须返回 null 让保存中止**——
// 若静默归 0，用户把 10 误打成 "1O" 会以为限流了，实际变成无上限。
const parseLimit = text => {
  const s = String(text ?? '').trim()
  if (!s) return 0
  if (!/^\d+$/.test(s)) return null
  return Math.min(Number(s), 9999)
}

const save = () => {
  const rules = { ...(getUserRules() || {}) }
  const bl = fromLines(blacklistText.value)
  const ext = fromLines(extText.value)
  const tags = fromLines(tagsText.value)

  const scan = parseLimit(scanConcurrencyText.value)
  const match = parseLimit(matchConcurrencyText.value)
  if (scan == null || match == null) {
    uni.showToast({ title: t('scrapeRules.concurrencyInvalid'), icon: 'none' })
    return
  }

  // 空数组就不写这个字段，避免污染内置规则
  if (bl.length) rules.pathBlacklist = bl
  else delete rules.pathBlacklist
  if (ext.length) rules.videoExtensions = ext
  else delete rules.videoExtensions
  if (tags.length) rules.releaseTags = tags
  else delete rules.releaseTags

  // 并发度是数值，必须显式写 0——删掉字段会让它回落到内置默认，
  // 而内置默认恰好也是 0，改与不改看不出区别，所以一律写入便于排查。
  rules.scanConcurrency = scan
  rules.matchConcurrency = match

  setUserRules(rules)
  invalidateRules()

  uni.showToast({ title: t('scrapeRules.saved'), icon: 'success' })
  setTimeout(() => uni.navigateBack(), 600)
}

const reset = () => {
  uni.showModal({
    title: t('modal.warmTip'),
    content: t('scrapeRules.resetConfirm'),
    success: res => {
      if (!res.confirm) return
      setUserRules({})
      invalidateRules()
      load()
      uni.showToast({ title: t('scrapeRules.saved'), icon: 'success' })
    },
  })
}

load()
</script>

<style lang="scss" scoped>
.scrape-rules {
  min-height: 100vh;
  padding: 24rpx;
  background: var(--app-bg);
  color: var(--app-text-primary);

  &__header {
    margin-bottom: 24rpx;
  }

  &__title {
    font-size: 34rpx;
    font-weight: 600;
  }

  &__hint {
    margin-top: 12rpx;
    font-size: 24rpx;
    color: var(--app-text-tertiary);
    line-height: 1.6;
  }

  &__desc {
    margin: 16rpx 0;
    font-size: 24rpx;
    color: var(--app-text-tertiary);
    line-height: 1.6;
  }

  &__textarea {
    background: var(--app-bg-input);
    border-radius: 16rpx;
    padding: 16rpx;
  }

  &__field {
    margin-top: 32rpx;
  }

  &__field-label {
    font-size: 28rpx;
    margin-bottom: 12rpx;
    color: var(--app-text-primary);
  }

  &__field-hint {
    margin-top: 10rpx;
    font-size: 22rpx;
    color: var(--app-text-tertiary);
    line-height: 1.5;
  }

  // nut-input 默认只有一条极淡的下边框，在浅色/深色主题下都看不出可输入区域，
  // 这里改成卡片式容器，并让文字跟随主题变量。
  // 输入区用 secondary 底色 + 描边：浅色主题下 card 和页面底色都是白色，
  // 只换背景仍然看不出来。
  ::v-deep .nut-input {
    background: var(--app-bg-secondary);
    border-radius: 16rpx;
    padding: 16rpx 24rpx;
    border: 1px solid var(--app-border-strong);
    box-sizing: border-box;
  }

  ::v-deep .nut-input__input,
  ::v-deep .nut-input input {
    color: var(--app-text-primary);
  }

  ::v-deep .nut-input input::placeholder {
    color: var(--app-text-tertiary);
  }

  &__footer {
    display: flex;
    gap: 24rpx;
    margin-top: 40rpx;
  }
}
</style>
