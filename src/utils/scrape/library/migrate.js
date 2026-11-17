/**
 * 旧库迁移：localMovieTvData → movieTvLibrary
 *
 * 旧结构：
 *   { movie: [条目], tv: [条目] }
 *   条目 = { name, path, poster, movieTvId, source: [{provider, path, folderFileId, name, seasonArr}] }
 *
 * 新结构：见 constants.js / model.js
 *
 * 迁移只能「尽力而为」：
 *   旧数据经过 handleSeasonName 处理后年份已丢失，无法百分百还原。
 *   迁移完成后建议用户在 UI 上重刮一次。
 *
 * 迁移后旧 key 不删，留作回滚。
 */
import { LEGACY_STORAGE_KEY } from '../constants'
import { parseFilename } from '../parse/filename'
import { seasonDisplayName } from '../parse/season'
import { formatSize } from './model'
import { bucketKey } from '../constants'

/**
 * 从旧的 provider 推断源 type。
 * 旧数据里 provider 是 189CloudPC / Quark / WoPan / Cloud139 / Emby 或 alist 的 driver 名。
 */
const TYPE_BY_PROVIDER = {
  '189CloudPC': '天翼云盘',
  'Quark': '夸克网盘',
  'WoPan': '联通云盘',
  'Cloud139': '移动云盘',
  'Emby': 'Emby',
}

const inferType = provider => TYPE_BY_PROVIDER[provider] || 'WebDAV'

/**
 * 旧条目 → Work
 *
 * @param {object} old 旧条目
 * @param {'movie'|'tv'} mediaType
 * @param {object} ctx { type, accountName }
 */
const convertEntry = (old, mediaType, ctx) => {
  const parsed = parseFilename(old.name || '')
  const title = old.name || parsed.title
  const year = parsed.year || ''

  // 旧数据里 movieTvId 可能 undefined（占位条目）
  const tmdbId = old.movieTvId || null
  const workKey = tmdbId
    ? `tmdb:${mediaType}:${tmdbId}`
    : `slug:${mediaType}:${year ? `${title}.${year}` : title}`

  const versions = (old.source || []).map(s => {
    const provider = s.provider || ctx.type
    const type = inferType(provider)
    // 旧数据的 source[].provider 只有 provider，没有 type；用这个推断
    return {
      versionKey: `${bucketKey(type, ctx.accountName)}::${s.path || ''}`,
      source: {
        type,
        accountName: ctx.accountName,
        provider,
        displayLabel: type,
      },
      ref: {
        path: s.path || '',
        fileId: s.folderFileId || null,
        folderFileId: s.folderFileId || null,
      },
      file: {
        name: s.name || old.name || '',
        size: 0,
        sizeText: s.size || '',
        resolution: '',
        duration: 0,
      },
      seasons: (s.seasonArr || []).map(sa => ({
        season: String(sa.season || '1'),
        name: sa.name || seasonDisplayName(sa.season || '1'),
        ref: {
          path: sa.path || '',
          folderFileId: sa.folderFileId || null,
        },
      })),
    }
  })

  return {
    workKey,
    tmdbId,
    mediaType,
    title,
    originalTitle: '',
    year,
    titleSlug: old.name || '',
    poster: old.poster || '',
    backdrop: old.backdrop || '',
    overview: old.overview || '',
    voteAverage: old.voteAverage || 0,
    genres: old.genre_ids || [],
    collectionId: null,
    matched: !!tmdbId,
    needsReview: !tmdbId,
    matchScore: 0,
    lastMatchAttempt: 0,
    versions,
  }
}

/**
 * 执行迁移。
 *
 * @param {object} opts
 * @param {string} opts.type        当前激活源的 type，用于推断归属
 * @param {string} opts.accountName 当前激活源的账号名
 * @returns {{migrated: boolean, movieCount: number, tvCount: number, reason?: string}}
 */
export const migrateLegacyLibrary = ({ type, accountName }) => {
  let legacy
  try {
    legacy = uni.getStorageSync(LEGACY_STORAGE_KEY)
  } catch {
    return { migrated: false, movieCount: 0, tvCount: 0, reason: '读取旧库失败' }
  }

  if (!legacy || (!legacy.movie?.length && !legacy.tv?.length)) {
    return { migrated: false, movieCount: 0, tvCount: 0, reason: '旧库为空' }
  }

  const ctx = { type: type || 'WebDAV', accountName: accountName || '' }
  const works = []
  let movieCount = 0
  let tvCount = 0

  ;(legacy.movie || []).forEach(old => {
    try {
      works.push(convertEntry(old, 'movie', ctx))
      movieCount++
    } catch (e) {
      console.warn('[scrape/migrate] 电影条目迁移失败:', old?.name, e)
    }
  })

  ;(legacy.tv || []).forEach(old => {
    try {
      works.push(convertEntry(old, 'tv', ctx))
      tvCount++
    } catch (e) {
      console.warn('[scrape/migrate] 剧集条目迁移失败:', old?.name, e)
    }
  })

  if (!works.length) {
    return { migrated: false, movieCount: 0, tvCount: 0, reason: '没有可迁移的条目' }
  }

  // 同一 workKey 的合并
  const byKey = new Map()
  works.forEach(w => {
    const k = `${w.workKey}::${w.mediaType}`
    const existed = byKey.get(k)
    if (!existed) {
      byKey.set(k, w)
      return
    }
    w.versions.forEach(v => {
      if (!existed.versions.find(e => e.versionKey === v.versionKey)) {
        existed.versions.push(v)
      }
    })
  })

  return {
    migrated: true,
    movieCount,
    tvCount,
    bucket: {
      type: ctx.type,
      accountName: ctx.accountName,
      lastScrapedAt: Date.now(),
      works: Array.from(byKey.values()),
    },
  }
}

/**
 * 用迁移结果构造新库对象
 */
export const buildLibraryFromMigration = migration => {
  if (!migration.migrated || !migration.bucket) return null
  const key = bucketKey(migration.bucket.type, migration.bucket.accountName)
  return {
    version: 2,
    updatedAt: Date.now(),
    buckets: {
      [key]: migration.bucket,
    },
  }
}
