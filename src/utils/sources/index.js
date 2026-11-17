/**
 * 来源统一入口。
 *
 * 用法：
 *   import { listSourceFolder, getSourceDef } from '@/utils/sources'
 *   const { list, total } = await listSourceFolder('天翼云盘', { folderId: '-11' }, selectMedia)
 */
export { SOURCE_REGISTRY, getSourceDef, isDirectorySource, isServerSource, listSourceFolder } from './registry'
export { normalizeList } from './normalize'
export { getSourceIcon, SOURCE_BRAND_ICON } from './sourceIcon'
export { getFileIcon, getFileIconName } from './fileIcon'

import { isDirectorySource } from './registry'

//所有需要走「目录 + 刮削」链路的来源 type
export const DIRECTORY_SOURCE_TYPES = ['WebDAV', '天翼云盘', '夸克网盘', '联通云盘', '移动云盘']

//该 type 是否需要刮削（Emby 等 server 型不需要）
export const needScrape = type => isDirectorySource(type)
