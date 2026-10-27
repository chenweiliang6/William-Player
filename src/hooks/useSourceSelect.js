//从 storage 的 sourceList 中找出当前激活的媒体源，同步到 selectType 与 selectMedia
export function useSourceSelect({ selectType, selectMedia, sourceListRef }) {
  const judgeSelect = () => {
    const list = uni.getStorageSync('sourceList')
    if (sourceListRef) {
      sourceListRef.value = list
    }
    selectType.value =
      list.find(item => {
        let select = item.list.find(i => i.active)
        if (select) {
          selectMedia.value = select
          return true
        } else {
          return false
        }
      }) || {}
  }
  return { judgeSelect }
}
