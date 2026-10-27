// 播放器页面共用方法：剧集列表按集数排序（S01E02 或纯数字）
// mobile/tv 两端 .nvue 播放器共用，保持与原排序行为一致
export const sortVideoList = (list, nameKey = 'name') => {
  const regex = /S\d{2}E\d{2}/
  const regex1 = /\d+/
  return list.sort((a, b) => {
    const nameA = a[nameKey]
    const nameB = b[nameKey]
    const matchA = nameA.match(regex) || nameA.match(regex1)
    const matchB = nameB.match(regex) || nameB.match(regex1)
    if (matchA && matchB) {
      const numA = parseInt(matchA[0].slice(-2), 10)
      const numB = parseInt(matchB[0].slice(-2), 10)
      a.ji = numA
      b.ji = numB
      return numA - numB
    }
    return 0
  })
}

export const VIDEO_FORMAT = ['mp4', 'mkv', 'm2ts', 'avi', 'mov', 'ts', 'm3u8', 'iso']

export const filterVideoFormat = (list, nameKey = 'name') => {
  return list.filter(item => VIDEO_FORMAT.some(v => item[nameKey].includes(v)))
}
