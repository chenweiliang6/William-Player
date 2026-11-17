/**
 * 文件名解析：从「名字.年份.1080p.BluRay」这类发布命名里拆出结构化信息。
 *
 * 这是整个重构的核心修正点。旧实现 handleSeasonName（scrape.js:143-160）
 * 只取第一个点之前的内容：
 *   'The.Matrix.1999.1080p.BluRay.x264.mkv' → 'The'   ← 片名全丢了
 *
 * 新实现找「最早出现的边界标记」再截断：
 *   同上 → { title: 'The Matrix', year: '1999', quality: '1080p' }
 *
 * 边界标记包括：年份、季集标记、发行标记（1080p/BluRay/x264 等）、
 * 以及 . _ ( [ 【 等结构分隔符。
 */
import { resolveRules } from '../rules/resolver'
import { extractSeason, extractEpisode } from './season'
import { getExtension } from './video-ext'

/**
 * 去掉视频文件扩展名。
 *
 * **只认已知的视频扩展名**。目录名同样会走这个函数（resolveSearchTitle 拿
 * 父目录名来解析片名），而目录名里常带点：
 *   '20. 唐宇迪AI Agent2024'  → 旧实现从第一个点截断，得到 '20'，年份也丢了
 * 现在只有最后一段确实在 videoExtensions 白名单里才截断。
 */
const stripExtension = name => {
  if (!name) return ''
  const s = String(name)
  const idx = s.lastIndexOf('.')
  if (idx <= 0) return s
  const ext = s.slice(idx + 1).toLowerCase()
  if (!resolveRules().videoExtensions.includes(ext)) return s
  return s.slice(0, idx)
}

/**
 * 开头的方括号/圆括号块是否是「站点 / 字幕组 / 发布组」标记。
 *
 * 这些前缀会被解析成片名，直接导致搜不到：
 *   '[www.hmxz.org]Arcane.S02E01...' → 片名 'www hmxz org Arcane'
 *   '【tvzongheba】E01.mkv'          → 片名 'tvzongheba E01'
 *   '[LoliHouse] 三体 - 01.mkv'      → 片名 'LoliHouse'
 *
 * 判据必须严，避免误剥片名自带的括号：
 *   '(500) Days of Summer'  → 括号内是纯数字，不剥
 *   '[飞驰人生热爱篇] Pegasus...' → 括号内是中文剧名，不剥（剧名就在里面）
 *
 * @returns {{ text: string, stripped: boolean }}
 */
export const stripLeadingGroupTag = text => {
  const s = String(text || '')
  const m = s.match(/^[\[【(（]([^\]】)）]{1,32})[\]】)）]\s*/)
  if (!m) return { text: s, stripped: false }
  const inner = m[1].trim()
  const rest = s.slice(m[0].length)
  if (!inner || rest.length < 2) return { text: s, stripped: false }
  // 括号内是纯数字/年份：属于片名本身，保留
  if (/^[\d\s._-]+$/.test(inner)) return { text: s, stripped: false }
  // 括号内是中文剧名（不含「字幕组」这类组名尾巴）：片名就在里面，保留
  const isGroupName = /(?:字幕组|字幕社|字幕|压制组|压制|汉化组|汉化|资源组|发布组|搬运)$/.test(inner)
  if (/[一-龥]/.test(inner) && !isGroupName) return { text: s, stripped: false }
  return { text: rest, stripped: true }
}

/**
 * 在文本里找每个 releaseTag 的最早出现位置。
 * 返回 { index, tag } 或 null。
 */
const findReleaseTagPos = (text, tags) => {
  const lower = text.toLowerCase()
  let best = null
  for (const tag of tags) {
    if (!tag) continue
    const idx = lower.indexOf(tag)
    // 只接受「边界处」的命中，避免 'web' 命中 'Webber'
    if (idx < 0) continue
    const before = idx === 0 ? '' : lower[idx - 1]
    const after = idx + tag.length >= lower.length ? '' : lower[idx + tag.length]
    const isBoundary = ch => ch === '' || /[.\s\-_\[\]()（）【】]/.test(ch)
    if (!isBoundary(before) || !isBoundary(after)) continue
    // 短标记（web / cam / dv / 3d / ts）极易误伤真实片名：
    //   Charlotte's Web.2006 → 在 'Web' 处截断，片名只剩 'Charlottes'
    // 约束：短标记后面紧接的 token 若是一个纯数字，它是片名的一部分而不是发行标记
    // （'Web.2006' 是片名+年份），真标记后面跟的是 'dl'/'rip' 之类或直接结束。
    if (tag.length <= 3) {
      const rest = lower.slice(idx + tag.length).replace(/^[.\s\-_\[\]【】]+/, '')
      const nextToken = rest.split(/[.\s\-_\[\]【】]/)[0] || ''
      if (/^\d+$/.test(nextToken)) continue
    }
    if (!best || idx < best.index) best = { index: idx, tag }
  }
  return best
}

/**
 * 在文本里找年份最早出现的位置。
 */
const findYearPos = (text, patterns) => {
  let best = null
  for (const p of patterns) {
    const m = text.match(p.re)
    if (!m) continue
    const idx = m.index
    if (!best || idx < best.index || (idx === best.index && (p.score || 0) > best.score)) {
      best = { index: idx, year: m[p.group], score: p.score || 0 }
    }
  }
  return best
}

/**
 * 在文本里找季/集标记最早出现的位置。
 * 季和集都算标题边界：某综艺.第12期 → 标题截在「第12期」之前
 */
const findSeasonPos = (text, rules) => {
  let best = null
  for (const re of rules.seasonSpecials) {
    const m = text.match(re)
    if (m && (!best || m.index < best.index)) best = { index: m.index, raw: m[0] }
  }
  for (const p of rules.seasonPatterns) {
    const m = text.match(p.re)
    if (m && (!best || m.index < best.index)) best = { index: m.index, raw: m[0] }
  }
  for (const p of rules.episodePatterns) {
    const m = text.match(p.re)
    if (m && (!best || m.index < best.index)) best = { index: m.index, raw: m[0] }
  }
  return best
}

/**
 * 找第一个「非开头」的括号位置。
 * 只在没有内容边界时兜底用。
 */
const findBracketPos = text => {
  let best = -1
  for (const ch of ['(', '（', '[', '【', '{']) {
    const idx = text.indexOf(ch)
    if (idx > 0 && (best < 0 || idx < best)) best = idx
  }
  return best
}

/**
 * 判断一个「标题」是否只是编号/季集标记/发行标记，不能当片名用。
 *
 * 典型输入：'第01集' '01' 'Episode 01' 'EP01' 'S01E01' 'Season 1' 'CD1' '1080p'
 * 这些名字解析出的 title 如果拿去搜 TMDB，会刮出大量无关结果。
 *
 * @param {string} title
 * @returns {boolean}
 */
export const isMeaninglessTitle = title => {
  const t = String(title || '').trim()
  if (!t) return true
  const patterns = resolveRules().meaninglessTitlePatterns || []
  // 归一化后再比：点/下划线/多空格都压成单个空格，避免 '.01' 这类漏判
  const norm = t.replace(/[._]+/g, ' ').replace(/\s+/g, ' ').trim()
  return patterns.some(re => {
    re.lastIndex = 0
    return re.test(t) || re.test(norm)
  })
}

/**
 * 主解析函数。
 *
 * @param {string} filename 文件名或目录名
 * @returns {{
 *   title: string,        // 清洗后的片名
 *   original: string,     // 原始名（去扩展名）
 *   year: string,         // 'YYYY' 或 ''
 *   season: string|null,  // '1' / '0' 或 null
 *   episode: string|null, // '05' 或 null
 *   quality: string,      // '1080p' 或 ''
 *   tags: string[],       // 命中的发行标记
 * }}
 */
export const parseFilename = filename => {
  const raw = stripExtension(String(filename || '').trim())
  const rules = resolveRules()

  if (!raw) {
    return { title: '', original: '', year: '', season: null, episode: null, quality: '', tags: [] }
  }

  // 开头的 [站点]/【字幕组】前缀先剥掉再解析。
  // original 保留「去扩展名后的原始串」，供调用方展示/生成 slug；
  // 内部所有解析都基于剥过前缀的 body。
  const original = raw
  const { text: body } = stripLeadingGroupTag(raw)

  // 无扩展名的目录名，也按同一套规则解析（剧名/季目录名）
  const ext = getExtension(filename)

  // 收集所有「边界位置」，取最靠前的作为标题截断点
  const boundaries = []

  const yearPos = findYearPos(body, rules.yearPatterns)
  if (yearPos) boundaries.push(yearPos.index)

  const seasonPos = findSeasonPos(body, rules)
  if (seasonPos) boundaries.push(seasonPos.index)

  const tagPos = findReleaseTagPos(body, rules.releaseTags)
  if (tagPos) boundaries.push(tagPos.index)

  // 点/下划线/横杠是「词分隔符」不是「标题终止符」：
  // The.Matrix.1999 → 点是空格，不能在这里截断，否则只剩 'The'
  // 只有在没有任何内容边界时，才退回用括号截断
  if (!boundaries.length) {
    const bracketPos = findBracketPos(body)
    if (bracketPos > 0) boundaries.push(bracketPos)
  }

  // 标题 = 最早边界之前的部分
  const cutIdx = boundaries.length ? Math.min(...boundaries) : body.length
  let title = body.slice(0, cutIdx)

  // 清理分隔符，规则分两种语境：
  //   中文名里的 . 是「词内分隔」：某综艺.第12期 → 保留为空格才是对的，
  //     但「流浪地球2.2023」里 . 已在上一步被当作年份边界截掉了
  //   英文名里的 . 是「词间空格」：The.Matrix → The Matrix
  // 统一处理：点/下划线 → 空格；横杠在两侧有空格时保留（片名可能自带横杠）
  title = title
    .replace(/[._]+/g, ' ')
    .replace(/[{}\[\]()（）【】]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  // 去掉首尾残留的点/横杠/空格
  title = title.replace(/^[\s.\-_]+|[\s.\-_]+$/g, '')

  // 标题为空时的兜底。
  //
  // **只在 cutIdx > 0 时才兜底**。cutIdx === 0 意味着文件名/目录名以季集
  // 或发行标记开头，前面根本没有片名可截——此时必须返回空串，让调用方
  // 回退到父目录名取片名。
  //
  // 这是「小巷人家/九重紫/借命而生」85 个文件全未识别的直接原因：
  //   'S01E02.2024.2160p.WEB-DL.H265.AAC-BestWEB.mkv'
  // 季集边界在下标 0 → title 被切成 '' → 旧实现退回「第一个空格前」，
  // 而这串没有空格 → title 变成整串原文 → 被当成有效片名送进 TMDB。
  if (!title && cutIdx > 0) {
    const firstSpace = body.indexOf(' ')
    title = (firstSpace > 0 ? body.slice(0, firstSpace) : body).trim()
  }

  // 剥离片名尾部的「无意义短尾缀」：藏海花.Ti → 藏海花，流浪地球.2CH → 流浪地球
  //
  // 网络资源里的片名常带两三个字母的站点/压制组后缀。它们几乎不可能
  // 是片名的一部分（TMDB 中文片名不会有「Ti」这种尾巴），但会把
  // 查询词污染成「藏海花 Ti」，直接导致搜不到。
  //
  // 约束：只在「前面还有实义内容」时才剥，避免把整段名字剥空。
  title = title.replace(/\s+[一-龥A-Za-z]{1,2}$/, '').trim() || title

  // 兜底出来的标题若只是编号（「第01集」「01」「Episode 01」），它不是片名。
  // 这里必须返回空串——否则它会被当成有效查询词送进 TMDB，
  // 刮出一堆与用户影片无关的结果。真正的片名交给调用方从父目录名另找。
  //
  // 例外：**纯数字片名 + 明确年份**是正常影片，不能判空。
  // 《1917》(2019)、《2012》(2009)、《2046》(2004)、《1984》(1984)、《300》(2006)
  // 的片名本身就是数字，文件名形如 `1917.2019.mkv`。只看「标题是纯数字」
  // 会把它们全部误杀，这类片在 TMDB 里的中文名就是数字本身。
  //
  // 判据：标题纯数字 + 解析出了年份 → 当片名用。
  //       「01.mkv」「第01集.mkv」没有年份，仍判空。
  const pureNumericTitle = /^\d{1,4}$/.test(title)
  const hasYear = !!(yearPos && yearPos.year)
  if (isMeaninglessTitle(title) && !(pureNumericTitle && hasYear)) title = ''

  const season = extractSeason(body)
  const episode = ext ? extractEpisode(body) : null

  // 质量标记：从 releaseTag 里挑出分辨率类
  let quality = ''
  const qualityTags = ['2160p', '1080p', '720p', '480p', '4k', '8k', 'uhd']
  const lower = original.toLowerCase()
  for (const q of qualityTags) {
    if (lower.includes(q)) {
      quality = q === '4k' || q === '8k' || q === 'uhd' ? q.toUpperCase() : q
      break
    }
  }

  // 命中的发行标记（供详情页展示或后续筛选）
  const tags = []
  if (tagPos) {
    const matched = rules.releaseTags.filter(t => lower.includes(t))
    tags.push(...matched)
  }

  return {
    title,
    original,
    year: yearPos ? String(yearPos.year) : '',
    season,
    episode,
    quality,
    tags,
  }
}

/**
 * 只取片名（大多数调用方只需要这个）
 */
export const parseTitle = filename => parseFilename(filename).title

/**
 * 只取年份
 */
export const parseYear = filename => parseFilename(filename).year

/**
 * 生成作品聚合键：片名 + 年份。
 * 有年份时含年份，避免「复联.2012」和「复联.1994」被合并。
 */
export const workSlug = filename => {
  const { title, year } = parseFilename(filename)
  if (!title) return ''
  return year ? `${title}.${year}` : title
}

/**
 * 从一条路径取目录名（用于「片名从父目录补」）。
 */
export const basenameOfPath = path => String(path || '').split('/').filter(Boolean).pop() || ''
