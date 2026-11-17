#!/usr/bin/env node
/**
 * 刮削库精简器 —— 把 movieTvLibrary 的巨大 JSON 压成「AI 读得懂、结构不丢」的版本。
 *
 * 设计原则：**只压缩值，不删除层级**。
 *   buckets → { [bucketKey]: { type, accountName, lastScrapedAt, works: [...] } }
 *   work    → { workKey, tmdbId, mediaType, category, title, ..., versions: [...] }
 *   version → { versionKey, source, ref, file, seasons: [...] }
 * 这套层级在每个模式里都完整保留，AI 能据此推断字段含义和父子关系。
 *
 * 输入可以是以下任一种，脚本会自动认：
 *   · 库本身 { version, updatedAt, buckets }
 *   · PC 端整库文件 data/janime_db.json → { cache: { movieTvLibrary: {...} } }
 *   · 上面两种的 value 被 JSON.stringify 成字符串存的情况
 *   · 包了一层的 { data: {...} }
 *
 * 用法：
 *   node scripts/compact-library.mjs <库.json>
 *   node scripts/compact-library.mjs <库.json> --mode=skeleton
 *   node scripts/compact-library.mjs <库.json> --overview=0 --merge-unidentified
 *
 * 选项：
 *   --mode=compact|copy|skeleton
 *                            compact（默认）保留全部条目
 *                            copy    可一键贴进 AI 上下文：已识别作品全保留、版本按需折叠、
 *                                    未识别按目录聚合（推荐，906 条库约 50 KB）
 *                            skeleton 只留骨架 + 全片名清单 + 目录统计
 *   --overview=<n>           overview 截断到 n 字，0 = 整个删除。默认 60
 *   --merge-unidentified     把同一目录下的大量未识别条目归并成一条（最大膨胀源）
 *   --keep=poster,backdrop   额外保留这些本来会被裁掉的字段（逗号分隔）
 *   --sample=<n>             skeleton 模式下每个桶保留的代表条目数，默认 3
 *   --titles=<n>             skeleton 模式下 catalog / unidentifiedDirs 的条数，默认 200
 *   --names=<n>              copy 模式下每个未识别目录留几个文件名，默认 2；0 = 不列文件名
 *   --key=<点路径>           手动指定库在文件里的位置，如 cache.movieTvLibrary
 *   -o, --out=<文件>         输出路径。默认写到 <输入文件名>.compact.json
 *   --pretty                 输出带 1 格缩进（便于人工核对，体积约大 37%）
 *   --stats                  只打印统计，不写文件
 *
 * 典型体积（真实库 2.3 MB / 906 条 work，其中 849 条未识别）：
 *   --mode=copy       ≈ 50 KB / 2.3 万 tokens   ← 一键复制推荐
 *   --mode=skeleton   ≈ 35 KB / 1.6 万 tokens   ← 只要清单和统计
 *   --mode=compact --merge-unidentified --overview=0  ≈ 148 KB / 6.9 万 tokens
 *   --mode=compact（默认，不归并）                       ≈ 558 KB / 26 万 tokens
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'

// ── 参数解析 ──────────────────────────────────────────────
const argv = process.argv.slice(2)
const flags = new Map()
const positional = []

for (let i = 0; i < argv.length; i++) {
  const a = argv[i]
  if (a === '--stats') flags.set('stats', '1')
  else if (a === '--pretty') flags.set('pretty', '1')
  else if (a === '--merge-unidentified') flags.set('mergeUnidentified', '1')
  else if (a.startsWith('--mode=')) flags.set('mode', a.slice(7))
  else if (a.startsWith('--overview=')) flags.set('overview', a.slice(11))
  else if (a.startsWith('--keep=')) flags.set('keep', a.slice(7))
  else if (a.startsWith('--sample=')) flags.set('sample', a.slice(9))
  else if (a.startsWith('--titles=')) flags.set('titles', a.slice(9))
  else if (a.startsWith('--names=')) flags.set('names', a.slice(8))
  else if (a.startsWith('--key=')) flags.set('key', a.slice(6))
  else if (a === '-o' || a === '--out') flags.set('out', argv[++i])
  else if (a.startsWith('--out=')) flags.set('out', a.slice(6))
  else if (a.startsWith('-')) {
    console.error(`未知参数：${a}`)
    process.exit(1)
  } else positional.push(a)
}

const inputPath = positional[0]
if (!inputPath) {
  // 打印文件头注释作为用法说明
  const text = readFileSync(new URL(import.meta.url), 'utf8').split('\n')
  const end = text.findIndex((l, i) => i > 0 && l.trim().startsWith('*/'))
  console.error(
    text.slice(1, end < 0 ? 30 : end)
      .map(l => l.replace(/^\s*\* ?/, ''))
      .join('\n'),
  )
  process.exit(1)
}

const mode = flags.get('mode') || 'compact'
const overviewLimit = Number(flags.get('overview') ?? 60)
const samplePerBucket = Number(flags.get('sample') ?? 3)
const titlesLimit = Number(flags.get('titles') ?? 200)
// copy 模式：未识别目录每个留几个文件名当样本。0 = 完全不列文件名（最省）
const nameSample = Number(flags.get('names') ?? 2)
const extraKeep = new Set((flags.get('keep') || '').split(',').map(s => s.trim()).filter(Boolean))
const mergeUnidentified = flags.has('mergeUnidentified')

// ── 读入 + 兼容多种外层形态 ────────────────────────────────
// 可能直接是 {version, updatedAt, buckets}，也可能是 {data: {...}} 或 JSON 字符串。
const rawText = readFileSync(resolve(inputPath), 'utf8')
let lib
try {
  lib = JSON.parse(rawText)
} catch (e) {
  // 有些导出工具会把 JSON 再包一层字符串
  const m = rawText.match(/^\s*"([\s\S]*)"\s*$/s)
  if (!m) {
    console.error('无法解析输入 JSON：', e.message)
    process.exit(1)
  }
  lib = JSON.parse(JSON.parse(rawText))
}
// PC 端 janime_db.json 是 { cache: { movieTvLibrary: {...} } } 的形态。
// 也兼容 value 被存成 JSON 字符串的情况。
const keyHint = flags.get('key')
const dig = (obj, path) => path.reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), obj)
const maybeParse = v => {
  if (typeof v !== 'string') return v
  try {
    return JSON.parse(v)
  } catch {
    return null
  }
}

let resolved = null
if (keyHint) {
  // 显式指定时只用这一条路径，避免「写错 key 却靠兜底蒙对」
  resolved = maybeParse(dig(lib, keyHint.split('.')))
  if (!resolved?.buckets) {
    console.error(`--key=${keyHint} 指向的位置没有 buckets 字段。`)
    process.exit(1)
  }
} else {
  const candidates = [
    lib,
    lib?.data,
    dig(lib, ['cache', 'movieTvLibrary']),
    dig(lib, ['data', 'cache', 'movieTvLibrary']),
    maybeParse(dig(lib, ['cache', 'movieTvLibrary'])),
    maybeParse(dig(lib, ['data', 'cache', 'movieTvLibrary'])),
  ]
  resolved = candidates.find(c => c && typeof c === 'object' && c.buckets)
}

lib = resolved
if (!lib) {
  console.error('输入里找不到 buckets 字段，不是刮削库结构。')
  console.error('（PC 端整库文件是 { cache: { movieTvLibrary: {...} } }，本脚本会自动识别；')
  console.error('  其他形态可用 --key=cache.movieTvLibrary 指定路径）')
  process.exit(1)
}

// ── 通用小工具 ────────────────────────────────────────────
const truncate = (s, n) => {
  const str = String(s ?? '')
  if (!n) return ''
  return str.length > n ? str.slice(0, n) + '…' : str
}

const round1 = v => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : 0
}

// 海报路径只留文件名，够 AI 判断「有没有」即可
const posterName = p => (p ? basename(String(p)) : '')

// 路径太长时保留「头/尾」，中间省略。AI 需要看目录结构，不能整条丢掉。
const shortPath = (p, keep = 2) => {
  const s = String(p ?? '')
  if (!s || s.length <= 80) return s
  const parts = s.split('/').filter(Boolean)
  if (parts.length <= keep * 2 + 1) return s
  return '/' + [...parts.slice(0, keep), '…', ...parts.slice(-keep)].join('/')
}

// ── 单条 work 的压缩 ──────────────────────────────────────
const compactWork = (w, hoistSource = false) => {
  const out = {}

  for (const [k, v] of Object.entries(w)) {
    // 1) 重字段：按需保留
    if (k === 'overview') {
      if (overviewLimit > 0 && v) out.overview = truncate(v, overviewLimit)
      continue
    }
    if (k === 'poster' || k === 'backdrop') {
      if (extraKeep.has(k) && v) out[k] = posterName(v)
      continue
    }
    if (k === 'titleSlug') continue

    // 2) 与 title 完全相同的 originalTitle 无信息量
    if (k === 'originalTitle' && v === w.title) continue

    // 3) 布尔/数值里「无信息量」的默认值直接省略（AI 看到缺失即知道是默认）
    if (k === 'typeCorrected' && v === false) continue
    if (k === 'matched' && v === true) continue
    if (k === 'unidentified' && v === false) continue
    if (k === 'needsReview' && v === false) continue
    if (k === 'scanMediaType' && v === w.mediaType) continue
    if (k === 'matchScore') { if (Number(v) > 0) out.matchScore = round1(v); continue }
    if (k === 'lastMatchAttempt') continue
    if (k === 'voteAverage') { if (Number(v) > 0) out.voteAverage = round1(v); continue }
    if (k === 'seasonCount' && Number(v) === 0) continue
    if (k === 'collectionId' && v == null) continue

    // 4) 空数组省略，保留非空数组（genres/originCountry 是分类依据）
    if (Array.isArray(v) && v.length === 0) continue
    if (v === '' || v === null) continue

    // 5) versions 走自己的压缩
    if (k === 'versions') {
      out.versions = (v || []).map(x => compactVersion(x, hoistSource))
      continue
    }

    out[k] = v
  }

  return out
}

const compactVersion = (v, hoistSource) => {
  const out = {}
  for (const [k, val] of Object.entries(v)) {
    if (k === 'versionKey') continue                 // 可由 bucket + path 推导
    if (k === 'source') {
      // 桶内所有 version 的来源都等于桶本身时，提到桶级一次，逐条省掉
      if (hoistSource) continue
      // provider 通常等于 type，省掉
      const s = { type: val.type, accountName: val.accountName }
      if (val.provider && val.provider !== val.type) s.provider = val.provider
      if (val.displayLabel && val.displayLabel !== val.type) s.displayLabel = val.displayLabel
      out.source = s
      continue
    }
    if (k === 'ref') {
      const r = { path: shortPath(val.path) }
      if (val.fileId) r.fileId = val.fileId
      if (val.folderFileId && val.folderFileId !== val.fileId) r.folderFileId = val.folderFileId
      out.ref = r
      continue
    }
    if (k === 'file') {
      const f = { name: val.name, size: val.size }
      if (val.sizeText) f.sizeText = val.sizeText
      out.file = f
      continue
    }
    if (k === 'seasons') {
      if (!val?.length) continue
      out.seasons = val.map(s => {
        const o = { season: s.season }
        if (s.name) o.name = s.name
        if (s.ref) {
          o.ref = { path: shortPath(s.ref.path) }
          if (s.ref.folderFileId) o.ref.folderFileId = s.ref.folderFileId
        }
        return o
      })
      continue
    }
    out[k] = val
  }
  return out
}

// ── 未识别条目归并（最大膨胀源） ──────────────────────────
// 同一目录下的几十上百条未识别文件，压成一条：
//   { workKey, mediaType, category, title, mergedUnidentified: { dir, fileCount, files: [...] } }
const mergeUnidentifiedWorks = (works) => {
  const kept = []
  const groups = new Map()

  for (const w of works) {
    if (!w.unidentified) {
      kept.push(w)
      continue
    }
    const p = w.versions?.[0]?.ref?.path || ''
    const dir = p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : ''
    const key = `${dir}::${w.mediaType}`
    if (!groups.has(key)) groups.set(key, { dir, mediaType: w.mediaType, items: [] })
    groups.get(key).items.push(w)
  }

  for (const g of groups.values()) {
    // 单条不归并，保持原样
    if (g.items.length === 1) {
      kept.push(g.items[0])
      continue
    }
    const names = g.items.map(w => w.versions?.[0]?.file?.name || w.title).filter(Boolean)
    kept.push({
      workKey: `slug:${g.mediaType}:${basename(g.dir) || g.items[0].title}`,
      mediaType: g.mediaType,
      category: 'unidentified',
      title: basename(g.dir) || g.items[0].title,
      unidentified: true,
      mergedUnidentified: {
        dir: shortPath(g.dir),
        fileCount: g.items.length,
        // 只给文件名（省掉每条完整的 version 结构）
        files: names.slice(0, 8).concat(names.length > 8 ? [`…共 ${names.length} 个文件`] : []),
      },
    })
  }

  return kept
}

// ── 省略约定：告诉 AI「哪些字段为什么不见了」 ─────────────
// 这一步不能省。紧凑化最大的风险不是删错了字段，而是 AI 把「被省略」
// 误读成「结构里没有这个字段」，从而以为 Work 只有 8 个属性。
const buildConventions = () => ({
  'matched 缺省': '= true（有可信 TMDB 身份）',
  'unidentified 缺省': '= false（已识别）',
  'needsReview 缺省': '= false',
  'typeCorrected 缺省': '= false（类型未被 /search/multi 纠正）',
  'scanMediaType 缺省': '= mediaType',
  '空数组 / 空串 / null': '省略',
  'poster / backdrop / titleSlug': '省略（--keep 可保留）',
  'overview': overviewLimit > 0 ? `截断到 ${overviewLimit} 字（--overview=0 可全删）` : '已删除',
  'versions[].versionKey': '省略，可由 `${bucketKey}::${ref.path}` 推导',
  'versions[].file.resolution / duration': '恒为空串 / 0，省略',
  'versions[].ref.fileId 与 folderFileId': '相同时只留 fileId',
  'versions[].source': '桶上有 source 字段时，逐条的 source 同桶本身，故省略；桶上无 source 时逐条保留',
  'seasons': '空数组省略；非空表示该 version 下的季目录',
  'mergedUnidentified': '仅 --merge-unidentified 产生：同目录的未识别文件已归并，files 只列前 8 个',
})

// ── skeleton 模式：骨架 + 每桶代表条目 ────────────────────
const SAMPLE_SCHEMA = {
  '// 库外形': {
    version: 'number  结构版本，当前 6',
    updatedAt: 'number  毫秒时间戳',
    buckets: 'Record<bucketKey, Bucket>  bucketKey = `${type}::${accountName}`',
  },
  '// Bucket（skeleton 模式：完整 works 被替换成统计 + 清单 + 样本）': {
    type: 'string  源类型，如 WebDAV / 189 / quark / emby',
    accountName: 'string  账号名',
    lastScrapedAt: 'number  毫秒时间戳',
    stats: '{ works, matched, unidentified, byCategory }  条目总量与分类分布',
    catalog: '[title, year, category][]  已识别作品清单（最多 --titles 条）',
    unidentifiedDirs: '[{ dir, count }][]  未识别条目按目录聚合',
    samples: 'Work[]  各分类各一条的代表条目，完整展示字段结构',
  },
  '// Work（一部作品 = 一个 TMDB 身份或 slug 身份）': {
    workKey: 'string  身份键：tmdb:{mediaType}:{id} 或 slug:{mediaType}:{title[.year][::path]}',
    tmdbId: 'number|null',
    mediaType: "'movie' | 'tv'",
    scanMediaType: "扫描阶段判定，与 mediaType 不同表示被跨类型纠正过",
    typeCorrected: 'boolean  是否被 /search/multi 纠正过类型',
    category: "'movie'|'tv'|'anime'|'variety'|'documentary'|'unidentified'  展示分区",
    title: 'string',
    originalTitle: 'string',
    year: 'string',
    releaseDate: 'string  YYYY-MM-DD',
    seasonCount: 'number  共 N 季',
    titleSlug: 'string  文件名解析出的标题片段',
    poster: 'string  TMDB 海报相对路径',
    backdrop: 'string',
    overview: 'string  简介',
    voteAverage: 'number',
    genres: 'number[]  TMDB genre id',
    originCountry: 'string[]  如 [\"CN\"]',
    collectionId: 'number|null  系列合集 id',
    matched: 'boolean  是否有可信身份',
    unidentified: 'boolean  是否归入「未识别」',
    needsReview: 'boolean',
    matchScore: 'number',
    lastMatchAttempt: 'number  毫秒时间戳',
    manualMatched: 'boolean  （可选）用户手动指定过身份',
    versions: 'Version[]',
  },
  '// Version（某个源上的一份拷贝）': {
    versionKey: 'string  `${bucketKey}::${versionPath}`',
    source: '{ type, accountName, provider, displayLabel }',
    ref: '{ path, fileId, folderFileId }  剧集为剧目录，电影为文件路径',
    file: '{ name, size, sizeText, resolution, duration }',
    seasons: "[{ season: '1', name: '第1季', ref: { path, folderFileId } }]  电影为空数组",
  },
}

const buildSkeleton = (lib) => {
  const buckets = {}

  for (const [key, bucket] of Object.entries(lib.buckets)) {
    const works = bucket.works || []

    // 分类统计：AI 看这个就知道库的构成，不需要逐条
    const byCategory = {}
    for (const w of works) {
      const c = w.category || 'movie'
      byCategory[c] = (byCategory[c] || 0) + 1
    }
    const matched = works.filter(w => w.matched).length
    const unidentified = works.filter(w => w.unidentified).length

    // 代表条目：按分类尽量各取一条，保证 AI 见过每种形态
    const picked = []
    const seenCat = new Set()
    for (const w of works) {
      const c = w.category || 'movie'
      if (!seenCat.has(c) && picked.length < samplePerBucket) {
        seenCat.add(c)
        picked.push(w)
      }
    }
    // 不够就从剩下的补
    for (const w of works) {
      if (picked.length >= samplePerBucket) break
      if (!picked.includes(w)) picked.push(w)
    }

    // 目录索引：未识别条目往往是一批课程/合集，按目录聚一下比逐条列有用得多
    const unidentifiedDirs = []
    const dirMap = new Map()
    for (const w of works) {
      if (!w.unidentified) continue
      const p = w.versions?.[0]?.ref?.path || ''
      const dir = p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : ''
      dirMap.set(dir, (dirMap.get(dir) || 0) + 1)
    }
    for (const [dir, count] of dirMap) {
      unidentifiedDirs.push({ dir: shortPath(dir), count })
    }
    unidentifiedDirs.sort((a, b) => b.count - a.count)

    buckets[key] = {
      type: bucket.type,
      accountName: bucket.accountName,
      lastScrapedAt: bucket.lastScrapedAt || 0,
      stats: { works: works.length, matched, unidentified, byCategory },
      // 已识别作品的清单：AI 靠它就能回答「库里有什么」
      catalog: works
        .filter(w => w.matched)
        .slice(0, titlesLimit)
        .map(w => [w.title, w.year || '', w.category || w.mediaType]),
      // 未识别条目的目录分布（Top N）
      unidentifiedDirs: unidentifiedDirs.slice(0, titlesLimit),
      // 完整结构只在这几条上体现
      samples: picked.map(compactWork),
    }
  }

  return {
    mode: 'skeleton',
    version: lib.version,
    updatedAt: lib.updatedAt,
    schema: SAMPLE_SCHEMA,
    conventions: buildConventions(),
    buckets,
  }
}

// ── copy 模式：为「一键贴进 AI 上下文」优化的档位 ─────────
//
// 与 compact 的区别：
//   · 已识别作品全部保留（名、年、分类、评分、题材、版本），但版本超过 3 个时
//     按目录折叠成 { dir, fileCount, files }，避免 40 集的剧展开占满篇幅；
//   · 未识别条目不再逐条列出，直接按目录聚合成 unidentifiedDirs，
//     每个目录只给前 2 个文件名当样本 —— 这是这个库 90% 的体积来源；
//   · 不带 schema，靠实际条目自证结构；conventions 精简成几行关键约定。
//
// 对 906 条 work（849 条未识别）的真实库，输出约 50 KB / 2.3 万 tokens。
const buildCopy = (lib) => {
  const buckets = {}

  for (const [key, bucket] of Object.entries(lib.buckets)) {
    const works = bucket.works || []
    const matchedWorks = works.filter(w => w.matched)
    const unidentified = works.filter(w => w.unidentified)

    // 已识别：版本折叠
    const worksOut = matchedWorks.map(w => {
      const o = { workKey: w.workKey }
      if (w.tmdbId) o.tmdbId = w.tmdbId
      o.title = w.title
      if (w.originalTitle && w.originalTitle !== w.title) o.originalTitle = w.originalTitle
      if (w.year) o.year = w.year
      if (w.releaseDate) o.releaseDate = w.releaseDate
      o.category = w.category || w.mediaType
      o.mediaType = w.mediaType
      if (w.seasonCount) o.seasonCount = w.seasonCount
      if (w.voteAverage) o.voteAverage = round1(w.voteAverage)
      if (w.genres?.length) o.genres = w.genres
      if (w.originCountry?.length) o.originCountry = w.originCountry
      if (w.collectionId != null) o.collectionId = w.collectionId

      const vs = w.versions || []
      if (vs.length <= 3) {
        o.versions = vs.map(v => {
          const x = { path: shortPath(v.ref.path) }
          if (v.file?.name) x.name = v.file.name
          if (v.file?.sizeText) x.size = v.file.sizeText
          if (v.seasons?.length) {
            x.seasons = v.seasons.map(s => s.season + (s.name ? ` ${s.name}` : ''))
          }
          return x
        })
      } else {
        // 同一部剧的几十集折叠成一条目录记录，避免展开挤占篇幅
        const byDir = new Map()
        for (const v of vs) {
          const p = v.ref.path || ''
          const d = p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : ''
          if (!byDir.has(d)) byDir.set(d, [])
          byDir.get(d).push(v)
        }
        o.versions = [...byDir].map(([dir, list]) => {
          const names = list.map(v => v.file?.name).filter(Boolean)
          return {
            dir: shortPath(dir),
            fileCount: list.length,
            files: names.slice(0, 3).concat(names.length > 3 ? [`…共 ${names.length} 个文件`] : []),
          }
        })
      }
      return o
    })

    // 未识别：按目录聚合成树。
    //
    // 为什么用树而不是平坦的 [{dir, count}]：真实库里目录路径动辄 120 字符，
    // 且大量共享前缀（「/夸克网盘/来自：分享/010 Coze扣子…/」重复几十次）。
    // 树把共享前缀只写一次，实测 28.6 KB → 18.1 KB。
    //
    // 文件名留几个由 --names 决定：
    //   实测（849 个未识别文件）每目录留 0/1/2/3 个 → 8.5 / 14.0 / 17.5 / 20.7 KB。
    //   全列 849 个文件名反而要 43 KB —— 课程文件名平均 28 字，并不比目录省。
    //   默认留 2 个当样本，够 AI 判断这个目录里是剧集还是课程。
    const root = new Map()
    for (const w of unidentified) {
      const p = w.versions?.[0]?.ref?.path || ''
      const dir = p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : ''
      const parts = dir.split('/').filter(Boolean)
      if (!parts.length) continue

      let cur = root
      for (let i = 0; i < parts.length; i++) {
        const seg = parts[i]
        if (!cur.has(seg)) cur.set(seg, { children: new Map(), count: 0, names: [] })
        const node = cur.get(seg)
        if (i === parts.length - 1) {
          node.count++
          const name = w.versions?.[0]?.file?.name || w.title
          if (name && node.names.length < nameSample) node.names.push(name)
        }
        cur = node.children
      }
    }

    const serializeTree = map => {
      const out = {}
      for (const [k, v] of map) {
        const node = {}
        if (v.count) node.n = v.count
        if (v.names?.length) {
          node.files = v.names.slice()
          if (v.count > v.names.length) node.files.push(`…共 ${v.count} 个文件`)
        }
        if (v.children.size) node.sub = serializeTree(v.children)
        out[k] = Object.keys(node).length ? node : 1
      }
      return out
    }

    buckets[key] = {
      type: bucket.type,
      accountName: bucket.accountName,
      stats: {
        works: works.length,
        matched: matchedWorks.length,
        unidentified: unidentified.length,
      },
      works: worksOut,
      unidentifiedTree: serializeTree(root),
    }
  }

  return {
    $conventions: {
      '层级': 'buckets → { type, accountName, stats, works, unidentifiedTree }',
      'works': '仅已识别作品（57 条全保留）。',
      'works[].versions': '≤3 个时逐条给 {path,name,size}；>3 个时按目录折叠成 {dir,fileCount,files}',
      'unidentifiedTree': '未识别文件按目录建树。节点 { n=文件数, files=前2个文件名, sub=子目录 }；值为 1 表示空目录',
      '缺省即默认': 'matched=true、unidentified=false、needsReview=false、typeCorrected=false、scanMediaType=mediaType',
      '已省略': 'poster/backdrop/titleSlug/overview/lastMatchAttempt/matchScore',
      '空值': '空数组、空串、null 一律省略',
    },
    version: lib.version,
    updatedAt: lib.updatedAt,
    buckets,
  }
}

// ── 主流程 ────────────────────────────────────────────────
let output

/**
 * 桶内所有 version 的 source 是否都等于桶本身。
 * 是的话把 source 提到桶级一次，逐条省掉「WebDAV/我的webdav」这类重复。
 * 注意 provider / displayLabel 可能不等于 type，那就不提升（信息会丢）。
 */
const canHoistSource = (bucket, works) => {
  const same = s => s
    && s.type === bucket.type
    && s.accountName === bucket.accountName
    && (!s.provider || s.provider === s.type)
    && (!s.displayLabel || s.displayLabel === s.type)
  for (const w of works) {
    for (const v of w.versions || []) {
      if (!same(v.source)) return false
    }
  }
  return true
}

if (mode === 'skeleton') {
  output = buildSkeleton(lib)
} else if (mode === 'copy') {
  output = buildCopy(lib)
} else {
  const buckets = {}
  for (const [key, bucket] of Object.entries(lib.buckets)) {
    let works = bucket.works || []
    if (mergeUnidentified) works = mergeUnidentifiedWorks(works)
    const hoist = canHoistSource(bucket, works)
    buckets[key] = {
      type: bucket.type,
      accountName: bucket.accountName,
      lastScrapedAt: bucket.lastScrapedAt || 0,
      ...(hoist ? { source: { type: bucket.type, accountName: bucket.accountName } } : {}),
      works: works.map(w => compactWork(w, hoist)),
    }
  }
  // 不带 schema（结构由实际条目自己体现），但必须带省略约定，
  // 否则 AI 会把「字段缺失」当成「结构里没有」。
  output = {
    mode: 'compact',
    version: lib.version,
    updatedAt: lib.updatedAt,
    conventions: buildConventions(),
    buckets,
  }
}

// 默认不缩进：目标是尽量少占上下文，缩进对 AI 没有意义，
// 单行 JSON 比 1 格缩进省约 37%（68 KB → 43 KB）。
// skeleton 和 --pretty 缩进，是给人看的。
const indent = mode === 'skeleton' || flags.has('pretty') ? 1 : 0
const json = JSON.stringify(output, null, indent)

// ── 统计 ──────────────────────────────────────────────────
const inBytes = Buffer.byteLength(rawText, 'utf8')
const outBytes = Buffer.byteLength(json, 'utf8')
const est = t => Math.round(t / 2.2) // 中英混排粗估
console.log(`模式        : ${mode}${mergeUnidentified ? ' + merge-unidentified' : ''}`)
console.log(`原始大小    : ${(inBytes / 1024).toFixed(1)} KB  ≈ ${est(inBytes).toLocaleString()} tokens`)
console.log(`输出大小    : ${(outBytes / 1024).toFixed(1)} KB  ≈ ${est(outBytes).toLocaleString()} tokens`)
console.log(`压缩比      : ${(outBytes / inBytes * 100).toFixed(1)}%`)
for (const [k, b] of Object.entries(output.buckets)) {
  const n = b.works ? b.works.length : b.stats.works
  console.log(`  桶 ${k} : ${n} 条`)
}

// 体量提示：compact 模式不减条目数，未识别条目多时仍然很大
if (outBytes > 200 * 1024) {
  console.warn(`\n⚠ 输出仍有 ${(outBytes / 1024).toFixed(0)} KB，直接贴给 AI 偏大。可以：`)
  if (!mergeUnidentified) console.warn('  · 加 --merge-unidentified  把同目录的未识别文件归并成一条')
  if (overviewLimit > 0) console.warn('  · 加 --overview=0          丢掉全部简介')
  console.warn('  · 加 --mode=skeleton       只留骨架 + 每桶代表条目 + 分类统计')
}

if (flags.has('stats')) process.exit(0)

const outPath = flags.get('out')
  || join(dirname(resolve(inputPath)), `${basename(inputPath, '.json')}.${mode}.json`)
writeFileSync(outPath, json, 'utf8')
console.log(`已写入      : ${outPath}`)
