/**
 * 目录列表项的图标判定。
 *
 * 原先散在 useSelectFolder.js、catelog-list.vue 等多处各写一遍，
 * 且都用 name.includes('mp4') 这种子串匹配（'Boats.txt' 会命中 'ts'）。
 * 统一收敛到这里，按扩展名精确判断。
 */
import Folder from '@/static/folder.png'
import videoPlayer from '@/static/video-player.png'
import photoIcon from '@/static/photo-icon.png'
import fileIcon from '@/static/file-icon.png'
import { isVideoFile, getExtension } from '@/utils/scrape/parse/video-ext'

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'raw', 'webp', 'gif', 'bmp', 'heic']

/**
 * 取列表项图标。
 *
 * @param {object} item { name, isFolder?, thumbnail? }
 * @returns {string} 图片地址
 */
export const getFileIcon = item => {
  if (!item) return fileIcon
  if (item.isFolder || item.type == '1' || item.type === 1) return Folder

  const ext = getExtension(item.name)
  if (!ext) return fileIcon
  if (isVideoFile(item.name)) return videoPlayer
  if (IMAGE_EXTENSIONS.includes(ext)) {
    // 网盘返回的缩略图优先
    return item.thumbnail || item.thumb || photoIcon
  }
  return fileIcon
}

/**
 * 文件类型图标的字形 ↔ 颜色。
 *
 * 原来的 png 是分色的（文件夹橙、视频蓝灰、图片蓝、文件黑），
 * 换成字形后颜色必须一并带上，否则所有类型会变成同一种色。
 */
const FILE_ICON_STYLE = {
  wenjianjia: { glyph: 'wenjianjia', color: '#ff6701' }, // folder.png   橙色
  video: { glyph: 'video', color: '#495d77' }, // video-player.png 蓝灰
  tupian: { glyph: 'tupian', color: '#4285f4' }, // photo-icon.png  蓝色
  wj: { glyph: 'wj', color: '#000000' }, // file-icon.png   黑色
}

/**
 * 取列表项图标的 iconfont 字形与颜色。
 *
 * 与 getFileIcon 判定规则一致，只是把 png 换成语义字形。
 * 图片文件若带网盘缩略图，仍返回 null 表示「该用 <image> 显示缩略图」。
 *
 * @param {object} item { name, isFolder?, thumbnail?, thumb? }
 * @returns {{glyph: string, color: string}|null} null 表示调用方应改用缩略图
 */
export const getFileIconName = item => {
  if (!item) return FILE_ICON_STYLE.wj
  if (item.isFolder || item.type == '1' || item.type === 1) return FILE_ICON_STYLE.wenjianjia

  const ext = getExtension(item.name)
  if (!ext) return FILE_ICON_STYLE.wj
  if (isVideoFile(item.name)) return FILE_ICON_STYLE.video
  if (IMAGE_EXTENSIONS.includes(ext)) {
    if (item.thumbnail || item.thumb) return null
    return FILE_ICON_STYLE.tupian
  }
  return FILE_ICON_STYLE.wj
}

export { isVideoFile }
