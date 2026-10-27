import { ref } from 'vue'

// 历史播放记录的统一入口：读取、按源过滤、去重写入
// storage key 与数据形状保持与原散调用完全一致，行为不变
const historyPlay = ref([])

const read = () => {
  historyPlay.value = uni.getStorageSync('historyPlay') || []
  return historyPlay.value
}

//读取当前源的历史记录
const readBySource = (sourceType, sourceName) => {
  return read().filter(v => v.sourceType == sourceType && v.sourceName == sourceName)
}

//去重规则与 hooks/useVideoDetail.js 的 filterDuplicateHistory 完全一致：
//电视剧按 type+titlePlay+season+sourceName 去重，电影按 type+name+sourceName 去重
const filterDuplicate = (historyArr, historyItem) => {
  if (historyItem.type === 'tv') {
    return historyArr.filter(
      item => !(item.type === 'tv' && item.titlePlay === historyItem.titlePlay && item.season === historyItem.season && item.sourceName === historyItem.sourceName)
    )
  }
  return historyArr.filter(item => !(item.type === 'movie' && item.name === historyItem.name && item.sourceName === historyItem.sourceName))
}

//去重写入，新记录置于最前
const push = historyItem => {
  let arr = uni.getStorageSync('historyPlay') || []
  arr = filterDuplicate(arr, historyItem)
  arr = [historyItem, ...arr]
  uni.setStorageSync('historyPlay', arr)
  historyPlay.value = arr
  return arr
}

//整表回写（保持原有直接 setStorageSync 的语义）
const write = arr => {
  uni.setStorageSync('historyPlay', arr)
  historyPlay.value = arr
}

export function useHistoryStore() {
  return {
    historyPlay,
    read,
    readBySource,
    push,
    write,
  }
}
