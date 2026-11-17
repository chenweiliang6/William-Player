import videoPlayerIcon from '@/static/video-player.png'
import fileIcon from '@/static/file-icon.png'
import imageFormat from '@/static/image-format.png'
//处理iptv的m3u文件
const parseM3UToArray = m3uContent => {
  const lines = m3uContent.split('\n')
  const result = []
  let currentEntry = {}

  for (const line of lines) {
    const trimmedLine = line.trim()
    if (!trimmedLine) continue // 跳过空行

    // 解析 #EXTINF 元数据行
    if (trimmedLine.startsWith('#EXTINF')) {
      // 提取 tvg-name、tvg-logo、group-title
      const metaMatch = trimmedLine.match(/tvg-name="([^"]+)".*tvg-logo="([^"]+)".*group-title="([^"]+)"/)

      currentEntry = {
        name: metaMatch ? metaMatch[1] : 'Unknown',
        logo: metaMatch ? metaMatch[2] : '',
        groupTitle: metaMatch ? metaMatch[3] : '',
        url: '',
      }

      // 如果正则匹配失败，尝试兼容性解析（例如字段顺序不同）
      if (!metaMatch) {
        currentEntry.name = trimmedLine.split(/,(.+)/)[1] || 'Unknown' // 获取逗号后的频道名
        currentEntry.logo = (trimmedLine.match(/tvg-logo="([^"]+)"/) || [])[1] || ''
        currentEntry.groupTitle = (trimmedLine.match(/group-title="([^"]+)"/) || [])[1] || ''
      }
    }
    // 解析播放链接行（非注释行）
    else if (!trimmedLine.startsWith('#')) {
      currentEntry.url = trimmedLine
      result.push(currentEntry)
      currentEntry = {} // 重置当前条目
    }
  }
  return result
}

//对iptv数组进行分类
const groupByGroupTitle = (arr, level = '2') => {
  let arr1 = arr.reduce((groups, item) => {
    // 处理可能的 undefined/null/空字符串
    const key = item.name || '未命名'
    let obj = groups.find(v => v.name == key)
    if (!obj) {
      groups.push({ name: key, groupTitle: item.groupTitle, logo: item.logo, childList: [] })
      obj = groups.find(v => v.name == key)
    }
    if (level == '3') {
      obj.childList.push(item)
    }
    return groups
  }, [])
  return arr1.reduce((groups, item) => {
    // 处理可能的 undefined/null/空字符串
    const key = item.groupTitle || '未分组'
    let obj = groups.find(v => v.name == key)
    if (!obj) {
      groups.push({ name: key, childList: [] })
      obj = groups.find(v => v.name == key)
    }
    obj.childList.push(item)
    return groups
  }, [])
}

//一级不进行分类，直接平铺开，根据name进行分类
const groupByName = arr => {
  return arr.reduce((groups, item) => {
    const key = item.name || '未命名'
    let group = groups.find(g => g.name === key)

    if (!group) {
      group = {
        name: key,
        logo: item.logo,
        groupTitle: item.groupTitle,
        childList: [],
      }
      groups.push(group)
    }

    group.childList.push(item)
    return groups
  }, [])
}

//查询手机号是哪个城市以及运营商的
const getPhoneCityAndCarrier = data => {
  return new Promise((resolve, reject) => {
    uni.request({
      url: 'https://cx.shouji.360.cn/phonearea.php',
      data: {
        number: data.number,
      },
      timeout: 10000,
      method: 'GET',
      success: res => {
        resolve(res.data)
      },
      fail: error => {
        reject(error)
      },
    })
  })
}

/**
 * 判断来源条目是否处于激活状态。
 * 历史上 WebDAV/Emby/天翼写布尔 true，联通/移动写字符串 '1'/'0'。
 * 字符串 '0' 在 JS 中是真值，直接用 i.active 会把未激活项误判为已激活，
 * 所以统一在这里做严格判断。
 */
const isSourceActive = item => item?.active === true || item?.active === '1'

//在 sourceList 分组里找出激活条目
const findActiveSource = list => (Array.isArray(list) ? list.find(isSourceActive) : undefined)

//获取当前选择的是哪个资源，isEmby是true的话就获取选中的emby资源，不是就是正常资源
const judgeSelect = (type = 'all') => {
  let sourceList = uni.getStorageSync('sourceList') || []
  let selectType = {}
  let selectMedia = {}
  if (type === 'emby') {
    const embySource = sourceList.find(item => item.type === 'Emby')
    const activeItem = findActiveSource(embySource?.list)
    if (activeItem) {
      selectMedia = activeItem
      selectType = embySource
    }
    return { selectType, selectMedia }
  } else if (type === 'normal') {
    // 非Emby场景:遍历找有active的组
    const nonEmbySource = sourceList.find(item => item.type !== 'Emby' && item.list?.some(isSourceActive)) || {}
    const activeItem = findActiveSource(nonEmbySource?.list)
    if (activeItem) {
      // 这里原先误写成 selectMedia.value，普通对象没有 .value，会导致选源结果为空
      selectMedia = activeItem
      selectType = nonEmbySource
    }
    return { selectType, selectMedia }
  } else {
    selectType =
      sourceList.find(item => {
        let select = findActiveSource(item.list)
        if (select) {
          selectMedia = select
        }
        return !!select
      }) || {}
    return { selectType, selectMedia }
  }
}

//根据格式获取图标
const getFormatIcon = format => {
  const formatMapping = {
    'docx': 'https://image.quark.cn/s/uae/g/3o/broccoli/resource/202501/71725b30-c8f4-11ef-98f3-674d066e29a6.png',
    'doc': 'https://image.quark.cn/s/uae/g/3o/broccoli/resource/202501/71725b30-c8f4-11ef-98f3-674d066e29a6.png',
    'xlsx': 'https://image.quark.cn/s/uae/g/3o/broccoli/resource/202501/19e25220-c8f5-11ef-98f3-674d066e29a6.png',
    'jpg': imageFormat,
    'png': imageFormat,
    'jpeg': imageFormat,
    'pdf': 'https://image.quark.cn/s/uae/g/3o/broccoli/resource/202501/b6132c60-c8f4-11ef-98f3-674d066e29a6.png',
    'pptx': 'https://image.quark.cn/s/uae/g/3o/broccoli/resource/202501/cd05a790-c8f4-11ef-98f3-674d066e29a6.png',
    'mp3': 'https://image.quark.cn/s/uae/g/3o/broccoli/resource/202501/835e41f0-c8f5-11ef-98f3-674d066e29a6.png',
    'aac': 'https://image.quark.cn/s/uae/g/3o/broccoli/resource/202501/835e41f0-c8f5-11ef-98f3-674d066e29a6.png',
    'wma': 'https://image.quark.cn/s/uae/g/3o/broccoli/resource/202501/835e41f0-c8f5-11ef-98f3-674d066e29a6.png',
    'ogg': 'https://image.quark.cn/s/uae/g/3o/broccoli/resource/202501/835e41f0-c8f5-11ef-98f3-674d066e29a6.png',
    'flac': 'https://image.quark.cn/s/uae/g/3o/broccoli/resource/202501/835e41f0-c8f5-11ef-98f3-674d066e29a6.png',
    'alac': 'https://image.quark.cn/s/uae/g/3o/broccoli/resource/202501/835e41f0-c8f5-11ef-98f3-674d066e29a6.png',
    'zip': 'https://image.quark.cn/s/uae/g/3o/broccoli/resource/202501/e4210780-c8f4-11ef-98f3-674d066e29a6.png',
    'rar': 'https://image.quark.cn/s/uae/g/3o/broccoli/resource/202501/e4210780-c8f4-11ef-98f3-674d066e29a6.png',
    'tar': 'https://image.quark.cn/s/uae/g/3o/broccoli/resource/202501/e4210780-c8f4-11ef-98f3-674d066e29a6.png',
    'mp4': videoPlayerIcon,
    'mkv': videoPlayerIcon,
    'iso': videoPlayerIcon,
  }
  if (formatMapping[format]) {
    return formatMapping[format]
  } else {
    return fileIcon
  }
}

export { parseM3UToArray, groupByGroupTitle, groupByName, getPhoneCityAndCarrier, judgeSelect, getFormatIcon, isSourceActive, findActiveSource }
