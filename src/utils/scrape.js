import { getFolder, get189Folder, getQuarkFolder, getWopanFolder } from './common'
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'

// wopan 的 createTime 为 yyyyMMddHHmmss 字符串，需按指定格式解析
dayjs.extend(customParseFormat)

//处理秒
const handleSecond = val => {
  let time = ''
  if (+val < 60) {
    let second = val >= 10 ? val : '0' + val
    time = `00:${second}`
  } else if (+val >= 60 && +val < 3600) {
    let mins = Math.floor(+val / 60)
    let second = +val % 60
    mins = mins >= 10 ? mins : '0' + mins
    second = second >= 10 ? second : '0' + second
    time = `${mins}:${second}`
  } else {
    let hour = Math.floor(+val / 3600)
    let mins = Math.floor((+val % 3600) / 60)
    let second = +val % 60
    mins = mins >= 10 ? mins : '0' + mins
    second = second >= 10 ? second : '0' + second
    time = `${hour}:${mins}:${second}`
  }
  return time
}
//节流函数
function throttle(func, delay) {
  let lastTime = 0 // 记录上次执行时间戳
  return function (...args) {
    const now = Date.now()
    // 首次触发或距离上次执行超过间隔时间 → 立即执行
    if (now - lastTime >= delay) {
      func.apply(this, args)
      lastTime = now // 更新执行时间戳
    }
  }
}
//防抖函数
function debounce(fn, wait) {
  let timer = null
  return function () {
    let context = this,
      args = [...arguments]

    // 如果此时存在定时器的话，则取消之前的定时器重新记时
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    // 设置定时器，使事件间隔指定事件后执行
    timer = setTimeout(() => {
      fn.apply(context, args)
    }, wait)
  }
}
//处理时间，例如1:10:00和1小时10分钟返回分钟
const parseTime = timeStr => {
  if (!timeStr) return 0
  // 中文格式解析（如："1小时10分钟" 或 "50分钟"）
  if (timeStr.includes('小时') || timeStr.includes('分钟')) {
    const cnRegex = /(\d+)小时?(\d+)?分钟?/
    const matches = timeStr.match(cnRegex)

    let hours = 0,
      mins = 0
    if (matches) {
      hours = matches[1] ? parseInt(matches[1], 10) : 0
      mins = matches[2] ? parseInt(matches[2], 10) : 0
    }
    return hours * 60 + mins

    // 英文格式解析（如："1:10:00" 或 "45:00"）
  } else if (timeStr.includes(':')) {
    const parts = timeStr.split(':')
    // 兼容带小时和不带小时的格式
    const hasHour = parts.length >= 2 && parts[2] === '00'
    if (hasHour) {
      const hours = parseInt(parts[0], 10)
      const mins = parseInt(parts[1], 10)
      return hours * 60 + mins
    } else {
      return parseInt(parts[0], 10)
    }
  }

  // 无法解析时返回 0 或抛出错误
  return 0
}
//计算时间
const calTime = (val, type = 'cn') => {
  if (type == 'cn') {
    if (val > 60) {
      let hours = Math.floor(val / 60)
      let mins = val % 60
      return `${hours}小时${mins}分钟`
    } else {
      return `${val}分钟`
    }
  } else if (type == 'en') {
    if (val > 60) {
      let hours = Math.floor(val / 60)
      let mins = val % 60
      mins = mins >= 10 ? mins : '0' + mins
      return `${hours}:${mins}:00`
    } else {
      return `${val}:00`
    }
  }
}

//转换纳秒
const formatSecondTime = fileTime => {
  // 将100纳秒单位转换为秒
  const totalSeconds = fileTime * 1e-7
  const seconds = Math.round(totalSeconds)
  return handleSecond(seconds)
}

//emby纳秒时间转换
const formatNanoseconds = (ns, type = 'cn') => {
  if (isNaN(ns) || ns < 0) return '0分钟' // 处理无效输入

  // 单位换算常量
  const NS_PER_SECOND = 10000000 // 1秒 = 10^9纳秒
  const SECONDS_PER_MINUTE = 60

  // 转换为秒（保留浮点数精度）
  const totalSeconds = ns / NS_PER_SECOND

  // 计算小时和分钟
  const minutes = Math.round(totalSeconds / SECONDS_PER_MINUTE)
  return minutes
}

const isSeasonString = str => {
  return /^第(?:[一二三四五六七八九十]|十[一二三四五六七八九]?)+季$/.test(str)
}

const handleSeasonName = (filename, reserve = false) => {
  //reserve为true,就是保留第几季，false就是不保留
  if (!filename) return
  const firstDotIndex = filename.indexOf('.') //获取第一个.的位置索引
  const secondDotIndex = filename.indexOf('.', firstDotIndex + 1) //获取第二个.的位置索引
  let name = firstDotIndex === -1 ? filename : filename.substring(0, firstDotIndex)
  let twoName = secondDotIndex === -1 ? name : filename.substring(firstDotIndex + 1, secondDotIndex) //获取第二个小数点前的内容，如果是第几季，给拼接上
  if (isSeasonString(twoName)) {
    name = name + ' ' + twoName
  }
  const lasekhIndex = name.lastIndexOf('(') > -1 ? name.lastIndexOf('(') : name.lastIndexOf('（')
  name = lasekhIndex === -1 ? name : name.substring(0, lasekhIndex)
  if (!reserve) {
    const lastKgIndex = name.lastIndexOf(' ')
    name = lastKgIndex === -1 ? name : name.substring(0, lastKgIndex)
  }
  return name.trim()
}

const handleNameYear = filename => {
  const firstDotIndex = filename.indexOf('.') //获取第一个.的位置索引
  const secondDotIndex = filename.indexOf('.', firstDotIndex + 1) //获取第二个.的位置索引
  if (secondDotIndex > -1) {
    let contentYear = filename.substring(firstDotIndex + 1, secondDotIndex)
    if (/^\d{4}$/.test(contentYear)) {
      return contentYear
    } else {
      const thirdDotIndex = filename.indexOf('.', secondDotIndex + 1)
      if (thirdDotIndex > -1) {
        contentYear = filename.substring(secondDotIndex + 1, thirdDotIndex)
        if (/^\d{4}$/.test(contentYear)) {
          return contentYear
        }
      }
    }
  }
  const lasekhIndex = filename.lastIndexOf('(') > -1 ? filename.lastIndexOf('(') : filename.lastIndexOf('（')
  let year = ''
  if (lasekhIndex > -1) {
    year = filename.substring(lasekhIndex + 1, lasekhIndex + 5)
  }
  return year
}

//生成数字映射对象
const generateChineseNumberMapping = (maxNumber = 99, type = 'string') => {
  const chineseDigits = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九']
  const mapping = {}
  if (type == 'string') {
    mapping['特别篇'] = '0'
  } else if (type == 'number') {
    mapping['0'] = '特别篇'
  }
  if (maxNumber >= 1) {
    // 生成 1-9
    for (let i = 1; i <= 9; i++) {
      if (type == 'string') {
        mapping[chineseDigits[i]] = i.toString()
      } else if (type == 'number') {
        mapping[i.toString()] = chineseDigits[i]
      }
    }
  }

  if (maxNumber >= 10) {
    // 生成 10-19 ("十", "十一", ..., "十九")
    type == 'string' ? (mapping['十'] = '10') : (mapping['10'] = '十')
    for (let i = 1; i <= 9; i++) {
      if (type == 'string') {
        mapping['十' + chineseDigits[i]] = `1${i}` // "十一" -> "11"
      } else if (type == 'number') {
        mapping[`1${i}`] = '十' + chineseDigits[i]
      }
    }
  }
  if (maxNumber >= 20 && maxNumber <= 99) {
    // 生成 20-99 ("二十", "二十一", ..., "九十九")
    for (let tens = 2; tens <= 9; tens++) {
      if (type == 'string') {
        mapping[chineseDigits[tens] + '十'] = `${tens}0` // "二十" -> "20"
        for (let ones = 1; ones <= 9; ones++) {
          mapping[chineseDigits[tens] + '十' + chineseDigits[ones]] = `${tens}${ones}` // "二十一" -> "21"
        }
      } else if (type == 'number') {
        mapping[`${tens}0`] = chineseDigits[tens] + '十' // "二十" -> "20"
        for (let ones = 1; ones <= 9; ones++) {
          mapping[`${tens}${ones}`] = chineseDigits[tens] + '十' + chineseDigits[ones] // "二十一" -> "21"
        }
      }
    }
  }
  return mapping
}

//递归查询电影文件夹里的深层电影
const recursionMovie = async (data, movieArr, selectType, selectMedia, refreshData) => {
  let videoFormat = ['mp4', 'mkv', 'm2ts', 'avi', 'mov', 'ts', 'm3u8', 'iso']
  if (selectType.type == 'WebDAV') {
    let result = await getFolder({ path: data.path }, selectMedia)
    if (result.data.content) {
      await Promise.allSettled(
        result.data.content.map(async item => {
          item.provider = result.data.provider
          item.path = data.path + '/' + item.name
          if (item.type == '1') {
            await recursionMovie(item, movieArr, selectType, selectMedia, refreshData)
          } else {
            if (videoFormat.some(v => item.name.includes(v))) {
              refreshData.found++
              movieArr.push(item)
            }
          }
        })
      )
    }
  } else if (selectType.type == '天翼云盘') {
    let result = await get189Folder({ folderId: data.id }, selectMedia)
    if (result.fileListAO.folderList) {
      await Promise.allSettled(
        result.fileListAO.folderList.map(async item => {
          item.provider = '189CloudPC'
          item.path = data.path + '/' + item.name
          await recursionMovie(item, movieArr, selectType, selectMedia, refreshData)
        })
      )
    }
    if (result.fileListAO.fileList) {
      result.fileListAO.fileList.forEach(item => {
        item.path = data.path + '/' + item.name
        item.provider = '189CloudPC'
        if (videoFormat.some(v => item.name.includes(v))) {
          refreshData.found++
          movieArr.push(item)
        }
      })
    }
  } else if (selectType.type == '夸克网盘') {
    let result = await getQuarkFolder({ fid: data.id }, selectMedia)
    if (result.data.list) {
      await Promise.allSettled(
        result.data.list.map(async item => {
          item.id = item.fid
          item.name = item.file_name
          item.provider = 'Quark'
          item.path = data.path + '/' + item.file_name
          if (item.file_type == '0') {
            await recursionMovie(item, movieArr, selectType, selectMedia, refreshData)
          } else {
            if (videoFormat.some(v => item.file_name.includes(v))) {
              refreshData.found++
              movieArr.push(item)
            }
          }
        })
      )
    }
  } else if (selectType.type == '联通云盘') {
    let result = await getWopanFolder({ folderId: data.id }, selectMedia)
    if (result.fileListAO.folderList) {
      await Promise.allSettled(
        result.fileListAO.folderList.map(async item => {
          item.provider = 'WoPan'
          item.path = data.path + '/' + item.name
          await recursionMovie(item, movieArr, selectType, selectMedia, refreshData)
        })
      )
    }
    if (result.fileListAO.fileList) {
      result.fileListAO.fileList.forEach(item => {
        item.path = data.path + '/' + item.name
        item.provider = 'WoPan'
        if (videoFormat.some(v => item.name.includes(v))) {
          refreshData.found++
          movieArr.push(item)
        }
      })
    }
  }
}

const startsWithSeasonFormat = str => {
  // 正则表达式匹配以多种季数格式开头的字符串
  const seasonRegex = /^(第[一二三四五六七八九十百千万\d]+季|Season\s?\d+|S\d{1,2})/i
  return seasonRegex.test(str)
}

//提取出第几季
function extractSeasonNumber(str) {
  // 优先检查"特别篇"
  if (/特别篇/i.test(str)) {
    return '0'
  }
  const seasonRegex = /(?:第([一二三四五六七八九十百千万\d]+)季|Season[\s\u3000]*(\d+)|S(\d{1,2}))/i
  const match = str.match(seasonRegex)
  if (!match) return '1'

  if (match[1]) {
    const chineseNumbers = generateChineseNumberMapping(40, 'string')
    return chineseNumbers[match[1]] || String(parseInt(match[1], 10))
  } else {
    return parseInt(match[2] || match[3], 10)
  }
}

//递归查询电视剧文件夹里的深层电视剧
const recursionTv = async (data, parent, tvArr, selectType, selectMedia, refreshData) => {
  let videoFormat = ['mp4', 'mkv', 'm2ts', 'avi', 'mov', 'ts', 'm3u8', 'iso']
  if (selectType.type == 'WebDAV') {
    let result = await getFolder({ path: data.path }, selectMedia)
    if (result.data.content) {
      let shouldSkip = false // 全局标记跳过继续循环
      for (const child of result.data.content) {
        if (shouldSkip) break
        child.provider = result.data.provider
        child.path = data.path + '/' + child.name
        if (child.type == '1') {
          await recursionTv(child, data, tvArr, selectType, selectMedia, refreshData)
        } else {
          if (!shouldSkip && videoFormat.some(v => child.name.includes(v))) {
            shouldSkip = true
            if (startsWithSeasonFormat(data.name)) {
              if (!tvArr.find(j => j.path == parent.path)) {
                refreshData.found++
              }
              tvArr.push({
                ...parent,
                createTime: dayjs(parent.created).format('YYYY-MM-DD HH:mm:ss'),
                updateTime: dayjs(parent.modified).format('YYYY-MM-DD HH:mm:ss'),
                season: extractSeasonNumber(data.name),
                seasonPath: parent.path + '/' + data.name,
              })
            } else {
              if (data.name.includes(handleSeasonName(parent.name))) {
                if (!tvArr.find(j => j.path == parent.path)) {
                  refreshData.found++
                }
                tvArr.push({
                  ...parent,
                  createTime: dayjs(parent.created).format('YYYY-MM-DD HH:mm:ss'),
                  updateTime: dayjs(parent.modified).format('YYYY-MM-DD HH:mm:ss'),
                  season: extractSeasonNumber(data.name),
                  seasonPath: parent.path + '/' + data.name,
                })
              } else {
                refreshData.found++
                tvArr.push({
                  ...data,
                  createTime: dayjs(data.created).format('YYYY-MM-DD HH:mm:ss'),
                  updateTime: dayjs(data.modified).format('YYYY-MM-DD HH:mm:ss'),
                  season: '1',
                  seasonPath: data.path,
                })
              }
            }
          }
        }
      }
    }
  } else if (selectType.type == '天翼云盘') {
    let result = await get189Folder({ folderId: data.id }, selectMedia)
    if (result.fileListAO.folderList) {
      for (const child of result.fileListAO.folderList) {
        child.provider = '189CloudPC'
        child.path = data.path + '/' + child.name
        await recursionTv(child, data, tvArr, selectType, selectMedia, refreshData)
      }
    }
    if (result.fileListAO.fileList) {
      let shouldSkip = false // 全局标记跳过继续循环
      for (const child of result.fileListAO.fileList) {
        if (shouldSkip) break
        child.path = data.path + '/' + child.name
        child.provider = '189CloudPC'
        if (!shouldSkip && videoFormat.some(v => child.name.includes(v))) {
          shouldSkip = true
          if (startsWithSeasonFormat(data.name)) {
            if (!tvArr.find(j => j.path == parent.path)) {
              refreshData.found++
            }
            tvArr.push({
              ...parent,
              createTime: dayjs(parent.createDate).format('YYYY-MM-DD HH:mm:ss'),
              updateTime: dayjs(parent.lastOpTime).format('YYYY-MM-DD HH:mm:ss'),
              folderFileId: data.id,
              season: extractSeasonNumber(data.name),
              seasonPath: parent.path + '/' + data.name,
            })
          } else {
            if (data.name.includes(handleSeasonName(parent.name))) {
              if (!tvArr.find(j => j.path == parent.path)) {
                refreshData.found++
              }
              tvArr.push({
                ...parent,
                createTime: dayjs(parent.createDate).format('YYYY-MM-DD HH:mm:ss'),
                updateTime: dayjs(parent.lastOpTime).format('YYYY-MM-DD HH:mm:ss'),
                folderFileId: data.id,
                season: extractSeasonNumber(data.name),
                seasonPath: parent.path + '/' + data.name,
              })
            } else {
              refreshData.found++
              tvArr.push({
                ...data,
                createTime: dayjs(data.createDate).format('YYYY-MM-DD HH:mm:ss'),
                updateTime: dayjs(data.lastOpTime).format('YYYY-MM-DD HH:mm:ss'),
                folderFileId: data.id,
                season: '1',
                seasonPath: data.path,
              })
            }
          }
        }
      }
    }
  } else if (selectType.type == '夸克网盘') {
    let result = await getQuarkFolder({ fid: data.id }, selectMedia)
    if (result.data.list) {
      result.data.list = result.data.list.map(v => {
        return { id: v.fid, name: v.file_name, path: data.path + '/' + v.file_name, provider: 'Quark', size: v.size, file_type: v.file_type }
      })
      let shouldSkip = false // 全局标记跳过继续循环
      for (const child of result.data.list) {
        if (shouldSkip) break
        if (child.file_type == '0') {
          await recursionTv(child, data, tvArr, selectType, selectMedia, refreshData)
        } else {
          if (!shouldSkip && videoFormat.some(v => child.name.includes(v))) {
            shouldSkip = true
            if (startsWithSeasonFormat(data.name)) {
              if (!tvArr.find(j => j.path == parent.path)) {
                refreshData.found++
              }
              tvArr.push({
                ...parent,
                createTime: dayjs(parent.created_at).format('YYYY-MM-DD HH:mm:ss'),
                updateTime: dayjs(parent.updated_at).format('YYYY-MM-DD HH:mm:ss'),
                folderFileId: data.id,
                season: extractSeasonNumber(data.name),
                seasonPath: parent.path + '/' + data.name,
              })
            } else {
              if (data.name.includes(handleSeasonName(parent.name))) {
                if (!tvArr.find(j => j.path == parent.path)) {
                  refreshData.found++
                }
                tvArr.push({
                  ...parent,
                  createTime: dayjs(parent.created_at).format('YYYY-MM-DD HH:mm:ss'),
                  updateTime: dayjs(parent.updated_at).format('YYYY-MM-DD HH:mm:ss'),
                  folderFileId: data.id,
                  season: extractSeasonNumber(data.name),
                  seasonPath: parent.path + '/' + data.name,
                })
              } else {
                refreshData.found++
                tvArr.push({
                  ...data,
                  createTime: dayjs(data.created_at).format('YYYY-MM-DD HH:mm:ss'),
                  updateTime: dayjs(data.updated_at).format('YYYY-MM-DD HH:mm:ss'),
                  folderFileId: data.id,
                  season: '1',
                  seasonPath: data.path,
                })
              }
            }
          }
        }
      }
    }
  } else if (selectType.type == '联通云盘') {
    let result = await getWopanFolder({ folderId: data.id }, selectMedia)
    if (result.fileListAO.folderList) {
      for (const child of result.fileListAO.folderList) {
        child.provider = 'WoPan'
        child.path = data.path + '/' + child.name
        await recursionTv(child, data, tvArr, selectType, selectMedia, refreshData)
      }
    }
    if (result.fileListAO.fileList) {
      let shouldSkip = false // 全局标记跳过继续循环
      for (const child of result.fileListAO.fileList) {
        if (shouldSkip) break
        child.path = data.path + '/' + child.name
        child.provider = 'WoPan'
        if (!shouldSkip && videoFormat.some(v => child.name.includes(v))) {
          shouldSkip = true
          // wopan createTime 为 yyyyMMddHHmmss 字符串
          const fmtTime = str => (str ? dayjs(str, 'YYYYMMDDHHmmss').format('YYYY-MM-DD HH:mm:ss') : '')
          if (startsWithSeasonFormat(data.name)) {
            if (!tvArr.find(j => j.path == parent.path)) {
              refreshData.found++
            }
            tvArr.push({
              ...parent,
              createTime: fmtTime(parent.createTime),
              updateTime: fmtTime(parent.createTime),
              folderFileId: data.id,
              season: extractSeasonNumber(data.name),
              seasonPath: parent.path + '/' + data.name,
            })
          } else {
            if (data.name.includes(handleSeasonName(parent.name))) {
              if (!tvArr.find(j => j.path == parent.path)) {
                refreshData.found++
              }
              tvArr.push({
                ...parent,
                createTime: fmtTime(parent.createTime),
                updateTime: fmtTime(parent.createTime),
                folderFileId: data.id,
                season: extractSeasonNumber(data.name),
                seasonPath: parent.path + '/' + data.name,
              })
            } else {
              refreshData.found++
              tvArr.push({
                ...data,
                createTime: fmtTime(data.createTime),
                updateTime: fmtTime(data.createTime),
                folderFileId: data.id,
                season: '1',
                seasonPath: data.path,
              })
            }
          }
        }
      }
    }
  }
}
let classifyList = [
  {
    id: '18',
    labelKey: 'genre.drama',
    img: 'https://n.sinaimg.cn/sinakd20230822s/429/w1000h1029/20230822/85c9-12a6845ed1089e9489c8510b78bfd6ef.jpg',
    background: 'linear-gradient(to bottom, #e90c00, #fc633d)',
  },
  {
    id: '10749',
    labelKey: 'genre.romance',
    labelEn: 'Romance',
    img: 'http://mms2.baidu.com/it/u=2417138206,3826310341&fm=253&app=138&f=JPEG?w=500&h=711',
    background: 'linear-gradient(to bottom, #152de0, #5c6bf8)',
  },
  {
    id: '10751',
    labelKey: 'genre.family',
    img: 'http://mms2.baidu.com/it/u=3450351846,2320385931&fm=253&app=138&f=JPEG?w=500&h=714',
    background: 'linear-gradient(to bottom, #e2860f, #ef9c41)',
  },
  {
    id: '35',
    labelKey: 'genre.comedy',
    labelEn: 'Comedy',
    img: 'https://img31.mtime.cn/pi/2014/03/06/100404.23427262_1000X1000.jpg',
    background: 'linear-gradient(to bottom, #00a9e8, #55cff7)',
  },
  {
    id: '36',
    labelKey: 'genre.history',
    img: 'http://mms2.baidu.com/it/u=1997636151,980359615&fm=253&app=138&f=JPEG?w=500&h=889',
    background: 'linear-gradient(to bottom, #f3743f, #f98f61)',
  },
  {
    id: '12',
    labelKey: 'genre.adventure',
    img: 'http://mms2.baidu.com/it/u=1171152207,1406454474&fm=253&app=138&f=JPEG?w=498&h=778',
    background: 'linear-gradient(to bottom, #8c8259, #a8a17a)',
  },
  {
    id: '878',
    labelKey: 'genre.scifi',
    img: 'http://mms0.baidu.com/it/u=543696733,898405375&fm=253&app=120&f=JPEG?w=608&h=950',
    background: 'linear-gradient(to bottom, #4f7077, #74959c)',
  },
  {
    id: '27',
    labelKey: 'genre.horror',
    img: 'https://bkimg.cdn.bcebos.com/pic/738b4710b912c8fcc3ce413dd2558545d688d53f8bbf?x-bce-process=image/format,f_auto/watermark,image_d2F0ZXIvYmFpa2UyNzI,g_7,xp_5,yp_5,P_20/resize,m_lfit,limit_1,h_1080',
    background: 'linear-gradient(to bottom, #8d4615, #b06d41)',
  },
  {
    id: '53',
    labelKey: 'genre.thriller',
    img: 'http://mms1.baidu.com/it/u=2731686268,2439194493&fm=253&app=120&f=JPEG?w=380&h=539',
    background: 'linear-gradient(to bottom, #313131, #636363)',
  },
  {
    id: '80',
    labelKey: 'genre.crime',
    img: 'https://img2.baidu.com/it/u=2409104269,3506751094&fm=253&fmt=auto&app=138&f=JPEG?w=500&h=670',
    background: 'linear-gradient(to bottom, #2655d0, #5a81dc)',
  },
  {
    id: '9648',
    labelKey: 'genre.mystery',
    img: 'http://mms0.baidu.com/it/u=3310303659,3889098684&fm=253&app=138&f=JPEG?w=338&h=507',
    background: 'linear-gradient(to bottom, #f22821, #f95c50)',
  },
  {
    id: '10752',
    labelKey: 'genre.war',
    img: 'https://img2.baidu.com/it/u=1996407550,4166232410&fm=253&fmt=auto&app=138&f=JPEG?w=500&h=677',
    background: 'linear-gradient(to bottom, #848486, #ababab)',
  },
  {
    id: '28',
    labelKey: 'genre.action',
    img: 'https://img1.baidu.com/it/u=477668422,3613401629&fm=253&fmt=auto&app=138&f=JPEG?w=500&h=750',
    background: 'linear-gradient(to bottom, #25add8, #5ecdf0)',
  },
  {
    id: '16',
    labelKey: 'genre.animation',
    img: 'https://img1.baidu.com/it/u=3020374768,111332665&fm=253&fmt=auto&app=138&f=JPEG?w=500&h=746',
    background: 'linear-gradient(to bottom, #d73c23, #f46e5b)',
  },
  {
    id: '14',
    labelKey: 'genre.fantasy',
    img: 'https://pic.rmb.bdstatic.com/efe475e3323491a06e7446b2b6022c80.jpeg',
    background: 'linear-gradient(to bottom, #da243d, #dd626e)',
  },
]
export {
  handleSecond,
  parseTime,
  throttle,
  debounce,
  calTime,
  formatNanoseconds,
  handleSeasonName,
  handleNameYear,
  generateChineseNumberMapping,
  recursionMovie,
  recursionTv,
  formatSecondTime,
  classifyList,
  extractSeasonNumber,
}
