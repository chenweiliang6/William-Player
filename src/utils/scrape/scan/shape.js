/**
 * 扫描形态判定：判断「当前目录」是一部剧的目录，还是一堆独立影片。
 *
 * 改造前这个判断来自外部（用户选了「电视剧目录」还是「电影目录」）。
 * 现在必须靠目录内容自己判断。
 *
 * 判定不能只看「有没有集号」：片名里的年份（满江红.2023）会被
 * parseFilename 的纯数字结尾当成集号，直接把电影误判成剧集。
 * 这里改用「同目录内文件名是否指向同一部作品」这个更稳的信号：
 *   多个文件、片名基本一致  → 同一部剧的不同集数
 *   多个文件、片名各不相同  → 若干部独立影片
 */
import { parseFilename, stripLeadingGroupTag, isMeaninglessTitle } from '../parse/filename'
import { extractSeason, extractEpisode } from '../parse/season'
import { isVideoFile } from '../parse/video-ext'

export const CONFIDENCE = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
}

// 盘号/分卷写法：CD1 / DISC2 / Part.1 / 上 / 下
const DISC_PATTERN = /(?:^|[.\s_-])(?:cd|disc|disk|part|vol)[\s._-]*\d{1,2}(?:[.\s_-]|$)/i

// 明确标记集号的写法。不含「纯数字结尾」这一类，
// 因为它会把年份（xxx.2023）误当集号。
//
// 也不认**单独的 E+数字**：
//   Fast.and.Furious.E7.mkv → 是《速度与激情7》，不是第 7 集
//   xxx.E05.mkv 这类季内集号写法同理容易误伤电影续集编号。
// 只用 EP / Episode 前缀，或 SxxExx、中文「第N集」。
const EXPLICIT_EPISODE_PATTERNS = [
  /[Ss]\d{1,2}[Ee]\d{1,3}/,
  /第\s*\d{1,3}\s*[集话話期]/,
  // E01 / EP01，但**必须零填充**（E01 而不是 E7）。
  // Fast.and.Furious.E7 是《速度与激情7》，不能被当成第 7 集；
  // 而 `.E01.` / `】E01` 这种两位数零填充的写法几乎只出现在真分集上。
  /(?:^|[._\-\s\]】)）])[Ee][Pp]?\s*0\d{1,2}(?=$|[._\-\s\[【(（])/,
  /[._\-\s][Ee][Pp]\s*0*\d{1,3}(?=$|[._\-\s])/,
  /\bEP\s*0*\d{1,3}\b/i,
]

/** 是否带明确集号标记 */
export const hasExplicitEpisode = name => {
  const s = String(name || '')
  return EXPLICIT_EPISODE_PATTERNS.some(re => re.test(s))
}

/**
 * 判断一组「片名为空」的文件是否构成连续分集。
 *
 * 只看集号序列是否像剧集：数量 ≥2，且取出的序号能从最小连续递增
 * （允许少量缺号，网盘缺集很常见）。
 *
 *   01 02 03     → true
 *   01 02 04     → true（缺 03 也认）
 *   01 33 38     → false（差太远，是素材编号不是分集）
 *   01 05        → false
 *
 * 这个判据直接决定「整层是剧集还是独立影片」——判错剧集会让
 * 调用方拿不到剧名时把整层丢掉。
 */
/**
 * 「编号 + 发行标记」里的标记白名单。
 *
 * 标记必须是画质/编码/版本/音轨这类**发行属性**，不能是任意短词。
 * 旧实现用的是「≤16 字符且不含中文」的宽松阈值，只认空格分隔，于是
 * `10-4K.高码率.mp4`（横杠分隔 + 中文标记）取不到号，整层被判成 files，
 * 40 个文件散成 40 张电影卡（2026-11-11 实盘「逐玉」）。
 *
 * 反过来也不能放太宽：`9-10`（章节号）、`01-总览`（课程小节）、
 * `3-Clip-1`（课程演示片段）的尾部都不是发行标记，必须仍然取不到号。
 *
 * 用整词前缀 + 可选续接，兼顾 `4K`、`4K.高码率`、`2160p.WEB-DL.H265`。
 */
const EPISODE_MARKER = new RegExp(
  '^(?:'
  + '\\d{3,4}p|[48]k|uhd|hdr\\d*|sdr'
  + '|hevc|avc|x26[45]|h26[45]|10bit|8bit'
  + '|web-?dl|webrip|bluray|blu-?ray|bdrip|hdtv|remux'
  + '|高码率|高清|超清|蓝光|原盘|蓝光原盘'
  + '|加长|未删减|无删减|修复版?|收藏版?'
  + '|中字|简繁|双语|国语|粤语|英语'
  + ')(?:[\\s._-].*)?$',
  'i',
)

/**
 * 单个文件名里的「分集编号」。命中返回数字，否则 null。
 *
 * 三种写法：
 *   01.mp4 / 2.mkv                     纯数字
 *   01 4K.mp4 / 05 WEB-DL              编号 + 发行标记（空格分隔）
 *   10-4K.高码率.mp4 / 01_1080p.mkv    编号 + 发行标记（横杠/下划线/点分隔）
 *   取不到号                             null
 *
 * 「编号 + 发行标记」这条是九门那 30 个 `01 4K.mp4` 的命门：旧实现只认
 * 整串纯数字，于是整层判成 files，30 个文件按 movie 送进 TMDB，撞上
 * 2021 年同名电影。「逐玉」的 `10-4K.高码率.mp4` 同理，是横杠 + 中文
 * 标记的变体，见 EPISODE_MARKER 的注释。
 *
 * 课程里的 `10-【Agent框架开发篇】10.Langchain…`、`3-Clip-1.mp4`、
 * `01-总览.mp4` 必须排除——它们尾部不是发行标记。
 *
 * 也刻意**不**用 parseFilename().episode 作唯一来源：`01 4K.mp4` 的
 * episode 是 null（4K 不是视频扩展名，不会被 stripExtension 吃掉）。
 */
export const episodeNumberOf = name => {
  const stripped = String(name || '').replace(/\.[^.]+$/, '').trim()
  if (/^0*\d{1,3}$/.test(stripped)) return Number(stripped.replace(/^0+(?=\d)/, ''))
  const lead = stripped.match(/^0*(\d{1,3})[\s._-]+(.+)$/)
  if (!lead) return null
  const marker = lead[2].trim()
  // 标记是年份时不认：`300.2006` 是《三百》带年份，不是第 300 集
  if (/^(?:19|20)\d{2}$/.test(marker)) return null
  if (!EPISODE_MARKER.test(marker)) return null
  return Number(lead[1])
}

/**
 * 文件名本身是否就是一个「分集编号」。
 *
 * 与 episodeNumberOf 的区别：这里不关心号是多少，只回答「这名字像不像
 * 分集」。tree.js 用它判断「剧目录里的这个文件是不是这部剧的一集」——
 * 判成剧集之后，带 SxxExx 或纯编号的文件不可能属于另一部作品。
 */
export const isEpisodeNumberName = name => episodeNumberOf(name) != null

/**
 * 一个视频文件是否「像分集」——显式集号或纯编号名。
 *
 * tree.js 用它做整层断言：判成剧集后，如果本层每个文件都像分集，
 * 那这一层就是一部剧的分集，不该再补任何独立影片。
 */
export const looksLikeEpisodeFile = name =>
  hasExplicitEpisode(name) || isEpisodeNumberName(name) || hasBareEpisodeNumber(name) ||
  isDatedEpisodeName(name)

/**
 * 综艺/直播回放的「日期式分集」：`2023-10.24先导片.mp4`、`2023-11.03加更.mp4`。
 *
 * 这类命名只出现在综艺/直播目录里（每期按播出日期命名），实盘见
 * 「花儿与少年·丝路季」下 38 个文件。旧判据全都不命中，于是整季被散成电影。
 *
 * **只在 confirmshow 语境下使用**（belongsToShow / 整层断言 / 局部清理），
 * 不进 classifyShape：光看文件名，`2024.05.20 某电影` 这种日期命名的
 * 独立影片也会命中，但那种目录不会被判成 show，所以不会误伤。
 *
 * 后面允许跟状态词（先导片/加更/超前/花絮/正片/第N期）或直接结尾。
 */
const DATED_EPISODE = /^(?:19|20)\d{2}[.\-]\d{1,2}(?:[.\-]\d{1,2})?(?:[\s._\-]*(?:先导片|加更|超前|花絮|正片|未播|彩蛋|第\s*\d+\s*期|第\s*[一二三四五六七八九十]+\s*期|期\s*\d*))?$/i
export const isDatedEpisodeName = name => {
  const stem = String(name || '').replace(/\.[^.]+$/, '').trim()
  return DATED_EPISODE.test(stem)
}

/**
 * `xxx.E10.mkv` / `xxx.E11` 这类**不零填充**的集号。
 *
 * hasExplicitEpisode 刻意只认零填充的 `E01`：`Fast.and.Furious.E7` 是
 * 《速度与激情7》，不能被当成第 7 集。但两位以上（E10+）不可能是续集编号
 * 的写法——续集号都是 E2/E3/E7 这种一位数，十集以上的剧才会出现 E10。
 *
 * 所以这里放开两位数及以上，仍然挡住一位数。
 *
 * 单看文件名会误伤（`Fast.X.E10` 这种片名极少），所以只在**本层已判成
 * 剧集之后**（belongsToShow）和「剧目录整层是否都是分集」的断言里使用。
 */
const BARE_EPISODE = /(?:^|[._\-\s])E(\d{2,4})(?=$|[._\-\s\[【(（])/i
export const hasBareEpisodeNumber = name => BARE_EPISODE.test(String(name || ''))

const looksLikeEpisodeSequence = videos => {
  const nums = videos
    .map(v => {
      const name = String(v.name || '')
      // 先从显式集号里取，再退回「编号名」
      const p = parseFilename(name)
      // 显式集号优先。注意要排除「编号 + 发行标记」被当成集号的情况：
      // `01 4K.mp4` 的 parseFilename.episode 现在是 null（4K 不是视频扩展名，
      // 不会被 stripExtension 吃掉），所以这里靠 episodeNumberOf 兜住。
      if (p.episode != null) return Number(p.episode)
      return episodeNumberOf(name)
    })
    .filter(n => n != null && Number.isFinite(n))

  if (nums.length < 2) return false
  nums.sort((a, b) => a - b)

  // 序号跨度不能远大于文件数：20 个文件跨到 300 说明不是分集
  const span = nums[nums.length - 1] - nums[0]
  if (span > nums.length * 3) return false

  // 相邻两号之差不能太大（允许缺 1~2 集）
  for (let i = 1; i < nums.length; i++) {
    if (nums[i] - nums[i - 1] > 3) return false
  }
  return true
}

/**
 * 取「作品名」用于比较同目录内文件是否属于同一部片。
 * parseFilename 会把年份、季集、发行标记切掉，正好是我们要的作品名。
 */
const workNameOf = name => {
  const parsed = parseFilename(name)
  return parsed.title || ''
}

/**
 * 判定一个目录的形态。
 *
 * @param {object} opts
 * @param {Array} opts.videos    本层的视频文件项（已过滤黑名单）
 * @param {Array} opts.folders   本层的子目录项
 * @param {string} opts.dirName  本层目录名
 * @returns {{ shape: 'show'|'files'|'descend', confidence: string }}
 *   show    - 本层是一部剧的根（产出剧 + 季）
 *   files   - 本层视频是独立作品（电影/合集），逐个产出
 *   descend - 本层没有视频，只有子目录，继续下钻
 */
export const classifyShape = ({ videos = [], folders = [], dirName = '', nonMedia = false }) => {
  const hasSeasonSubdir = folders.some(f => extractSeason(f.name) != null)

  // 位于课程/教程目录下：内容本来就不是影视作品，不该产出剧集或影片条目。
  //
  // 只处理**子集形态**。`马馺·怎样用AI做PPT（完结）/ms-00…` 会被判成
  // 「ms 第 0 集」，进而 emitShow 出一张拿课程目录名去搜 TMDB 的假剧集卡；
  // 那正是 documentary「MS」(649811) 那种脏卡的来源。
  //
  // 反向也不能太狠：`1-ViT-补丁嵌入…` 这类没有集号的一堆文件保留 files，
  // 让它们照常进「其他」，用户仍能点开播放。
  if (nonMedia) {
    const epCount = videos.filter(v => hasExplicitEpisode(v.name) || isEpisodeNumberName(v.name)).length
    if (epCount * 2 > videos.length) {
      return { shape: 'files', confidence: CONFIDENCE.MEDIUM }
    }
  }

  // 本层没有视频：看子目录是不是季目录
  if (!videos.length) {
    return { shape: hasSeasonSubdir ? 'show' : 'descend', confidence: CONFIDENCE.HIGH }
  }

  // 有视频 + 有季子目录：以季子目录为准，本层散集归入这部剧
  // （沿用旧 walkTv 的行为，避免同一部剧产出两条记录）
  if (hasSeasonSubdir) {
    return { shape: 'show', confidence: CONFIDENCE.HIGH }
  }

  // 单个视频：带显式集号 → 剧集；否则看它是不是「某剧目录下的单集」。
  //
  // `那年，我们的夏天/01.mp4`、`北上（2025）/01 4K.mkv` 都是剧目录下漏下的一集。
  // 判据是「目录名像剧名 + 文件名是纯编号」，两者同时成立才当剧集：
  //   剧名目录/01.mp4          → 剧集（目录名有语义，文件名是集号）
  //   电影/指环王3：国王归来.mkv → 电影（文件名本身就是片名）
  //   /m/01.mkv                → 仍按电影处理（目录名是承载层，tree 层另有兜底）
  if (videos.length === 1) {
    if (hasExplicitEpisode(videos[0].name)) {
      return { shape: 'show', confidence: CONFIDENCE.MEDIUM }
    }
    const p = parseFilename(videos[0].name)
    const dirParsed = parseFilename(dirName)
    const nameIsPureNumber = !p.title && !isGenericDirName(dirName) &&
      !!dirParsed.title && !isMeaninglessTitle(dirParsed.title)
    return nameIsPureNumber
      ? { shape: 'show', confidence: CONFIDENCE.MEDIUM }
      : { shape: 'files', confidence: CONFIDENCE.MEDIUM }
  }

  // 多个视频：**过半数**带明确集号才判剧集。
  //
  // 早期判据是「任一文件带集号 → show」，对混装目录是灾难：
  //   /电影/ 里有 20 部电影 + 1 个名字带「第01集」的文件
  //   → 整层判剧集 → 20 部电影全部丢失（只产出一条「剧」）
  // 要求过半数能有效挡掉这种误判。同时保留一条例外：
  // 带集号的文件 ≥2 个且其余文件片名为空（纯编号），仍算剧集。
  const withEpisode = videos.filter(v => hasExplicitEpisode(v.name))
  if (withEpisode.length) {
    if (withEpisode.length * 2 > videos.length) {
      return { shape: 'show', confidence: CONFIDENCE.HIGH }
    }
    const restAllTitleless = videos
      .filter(v => !hasExplicitEpisode(v.name))
      .every(v => !workNameOf(v.name))
    if (withEpisode.length >= 2 && restAllTitleless) {
      return { shape: 'show', confidence: CONFIDENCE.MEDIUM }
    }
    // 集号文件是少数 → 整层按独立影片处理，带集号的也不会丢
    return { shape: 'files', confidence: CONFIDENCE.MEDIUM }
  }

  // 多个视频、都没有明确集号。
  // 「片名相同」有两种完全不同的情况，必须区分：
  //   沙丘2.2160p.mkv + 沙丘2.1080p.mkv  → 同一部电影的多版本，应各成一个 version
  //   某剧.01.mkv + 某剧.02.mkv          → 同一部剧的不同集
  // 判据：去掉作品名后，剩余部分是否像「集号」。
  const names = videos.map(v => workNameOf(v.name)).filter(Boolean)
  const distinct = new Set(names)

  // 片名全为空：区分「集数容器」和「多盘/多版本」。
  //   第01集.mkv + 第02集.mkv  → 是剧集
  //   CD1.mkv  + CD2.mkv       → 同一部片的分盘
  // 不能用 extractEpisode 区分：'Part.1.mkv' 会被当成第 1 集。
  // 用显式集号标记 + 盘号前缀来判断。
  //
  // 注意：这里判 show 后，调用方若拿不到剧名（承载目录名）会把整层丢掉，
  // 所以只有**确实像分集**时才算剧集——序号连号或递增。
  //   01.mkv 02.mkv 03.mkv → 剧集
  //   01.mkv 33.mkv 38.mkv → 不是（推特/素材编号），按独立影片处理
  if (!names.length) {
    const isDiscSeries = videos.every(v => DISC_PATTERN.test(String(v.name)))
    if (isDiscSeries) return { shape: 'files', confidence: CONFIDENCE.MEDIUM }
    return looksLikeEpisodeSequence(videos)
      ? { shape: 'show', confidence: CONFIDENCE.MEDIUM }
      : { shape: 'files', confidence: CONFIDENCE.MEDIUM }
  }

  // 多文件、片名各异，但每个「片名」都只是同一个词根 + 编号
  // （`某剧.01` → `某剧`、`某剧.02` → `某剧`，去掉编号后其实同名）。
  // 这种情况在 names 里已经因为 distinct.size === 1 被上面接住了，
  // 这里只兜住「片名里仍带编号」的情形：作品名去编号后一致 → 是同一部剧。
  if (distinct.size > 1) {
    const stems = new Set(names.map(n => String(n).replace(/[\s._-]*\d{1,3}$/, '').trim()).filter(Boolean))
    if (stems.size === 1) {
      return looksLikeMultiVersion(videos)
        ? { shape: 'files', confidence: CONFIDENCE.MEDIUM }
        : { shape: 'show', confidence: CONFIDENCE.MEDIUM }
    }
  }

  if (distinct.size === 1) {
    // 片名相同：区分多版本还是多集
    return looksLikeMultiVersion(videos)
      ? { shape: 'files', confidence: CONFIDENCE.MEDIUM }
      : { shape: 'show', confidence: CONFIDENCE.HIGH }
  }

  // 片名各异：一堆独立影片
  return { shape: 'files', confidence: CONFIDENCE.MEDIUM }
}

// 同一作品名的多个文件里，是否出现不同的清晰度/编码等发行标记。
// 出现即认为是同一部片的多个版本，而不是多集。
const RELEASE_QUALITY = /\b(2160p|1080p|720p|480p|4k|8k|uhd|hdr|bluray|blu-ray|web-?dl|webrip|remux|x264|x265|h264|h265|hevc|av1)\b/i

// 去掉文件扩展名。集号正则 /[.\s]0*(\d{1,3})$/ 要求数字落在**字符串结尾**，
// 直接拿 '某番.01.mkv' 去取会让结尾的 '.mkv' 挡住匹配，取不到集号。
const withoutExtension = name => String(name || '').replace(/\.[^.]+$/, '')

const looksLikeMultiVersion = videos => {
  // 判据一：出现两种以上不同发行标记（沙丘2.2160p + 沙丘2.1080p）
  const qualities = new Set()
  videos.forEach(v => {
    const m = String(v.name).match(new RegExp(RELEASE_QUALITY.source, 'gi'))
    if (m) m.forEach(q => qualities.add(q.toLowerCase()))
  })
  if (qualities.size > 1) return true

  // 判据二：片名相同但每个文件都不带集号 → 是同一部片的多个拷贝/分盘，
  // 不是同一部剧的不同集。
  //   某电影.1080p.mkv + 某电影.1080p.CHS.mkv → 两个版本
  //   某剧.01.mkv + 某剧.02.mkv               → 不同集（episode 非空，不算多版本）
  //
  // **必须先去掉扩展名再取集号**。用原名会让所有「剧名.01.mkv」都取不到集号，
  // 于是平铺的整部剧被当成「一部电影有 N 个版本」，详情页显示成 N 个来源
  // 而不是 N 集。（2026-11-09 实测：某番.01~.08.mkv 全部落进 files）
  const names = videos.map(v => withoutExtension(v.name))

  // 判据三：全部是盘号/分卷（某电影 CD1 + CD2、某电影.Part.1 + Part.2）
  // 去扩展名后 'Part.1' 会被集号正则当成第 1 集，所以要在取集号之前先挡掉。
  if (names.every(n => DISC_PATTERN.test(n))) return true

  const allWithoutEpisode = names.every(n => extractEpisode(n) == null)
  return allWithoutEpisode
}

/**
 * 从「剧目录名 + 季号」推出剧名。
 *
 * 季目录名可能形如：
 *   庆余年.第二季.2019   → 庆余年
 *   双城之战 第二季       → 双城之战
 *   Season 1            → ''（只剩季号，说明剧名在上层，调用方需另找）
 *   第1季                → ''
 */
export const extractShowTitle = dirName => {
  let t = String(dirName || '')
  // 先剥掉季标记（与 seasonPatterns 同源，这里直接复用解析结果更稳）
  const season = extractSeason(t)
  if (season != null) {
    // 逐个剥掉季/集/特别篇标记
    t = t
      .replace(/\bS\d{1,2}E\d{1,3}\b/gi, ' ')
      .replace(/第\s*[一二三四五六七八九十百零两\d]+\s*季/g, ' ')
      .replace(/第\s*[一二三四五六七八九十百零两]+\s*部/g, ' ')
      .replace(/Season\s*0*\d{1,2}/gi, ' ')
      .replace(/特别篇|\bSP\b|\bOVA\b|\bOAD\b|\bSpecial\b/gi, ' ')
  }
  // 单独的 S01 / 1x01 也要剥。上面那段只在 extractSeason 命中时才跑，
  // 而 `[飞驰人生热爱篇] Pegasus S01 2160p ...` 的季号虽然能识别，
  // 这里的 S01 仍会留在剧名里。
  t = t.replace(/\bS\d{1,2}(?=[.\s\]\-_]|$)/gi, ' ')
  return stripReleaseMarks(t)
}

/**
 * 去掉分隔符、年份、括号注释、发布标记，得到干净的剧名。
 *
 * 括号注释必须剥掉：`北上（2025）` 只去年份会留下 `北上（ ）`，
 * 而 belongsToShow 拿它和文件名里的 `北上` 比较时对不上，
 * 整季分集就会被判成「不属于本剧」并逐个拆成独立电影。
 */
const stripReleaseMarks = s => {
  // 开头的站点/字幕组前缀（`[LoliHouse]`、【tvzongheba】）先剥掉，
  // 与 filename.js 用同一套判据，避免两处各写一套导致行为不一致。
  let t = stripLeadingGroupTag(String(s || '')).text.replace(/[._]+/g, ' ')
  // 括号注释：只剥**纯注释性**的，也就是括号内含年份/分辨率/集数/体积的。
  // 不能无差别剥——`[飞驰人生热爱篇] Pegasus ...` 的剧名就在方括号里，
  // 一并剥掉会让剧名变成「Pegasus」。
  t = t
    .replace(/[（(]\s*(?:19|20)\d{2}\s*[)）]/g, ' ')
    .replace(/[【\[]\s*(?:19|20)\d{2}\s*[】\]]/g, ' ')
    .replace(/[（(]\s*\d+\s*[集话話期季]\s*[)）]/g, ' ')
    // 纯数字/体积/编码型的方括号标记：`[42 35GB]`、`[1080p]`、`[x265]`
    .replace(/[【\[]\s*[\d\s.GBKMTPgbkmpt]*[】\]]/g, ' ')
    .replace(/[【\[]\s*(?:x|h)?26[45]\s*[】\]]/gi, ' ')
    .replace(/[【\[]\s*\d{3,4}p\s*[】\]]/gi, ' ')
    // 整串都在方括号里时，剥完前缀会剩下 `[飞驰人生热爱篇] Pegasus`——
    // 括号其实是「资源站标注剧名」的写法，剧名就在里面。这里去掉成对的括号。
    // 注意只取**配对**的括号，`北上（2025）` 已在上一步处理过。
    .replace(/[【\[]([^【\[\]】]{1,60})[】\]]/g, ' $1 ')
  t = t
    .replace(/\b(?:19|20)\d{2}\b/g, ' ')
    // 分辨率 / 编码 / 音轨 / 体积
    .replace(/\b\d{3,4}p\b/gi, ' ')
    .replace(/\b(?:x|h)26[45]\b/gi, ' ')
    .replace(/\b(?:hevc|avc|aac|ac3|eac3|ddp|dd5\.1|dts|web-?dl|webrip|bluray|blu-ray|remux|hdr10?|dv|sdr|atmos)\b/gi, ' ')
    .replace(/\b\d+(?:\.\d+)?\s*[GT]B\b/gi, ' ')
    // 只剩体积数字的残余（`[42 35GB]` 剥掉 35GB 后留下 `42`）
    .replace(/\b\d{1,4}\s*$/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  // 结尾的 `-压制组名`（`-QHstudIo`）：横杠后面是纯字母/数字且长度 ≥ 3
  t = t.replace(/\s*-\s*[A-Za-z][\w.]*\s*$/g, ' ')
  return t.replace(/^[\s\-_]+|[\s\-_]+$/g, '').trim()
}

// 常见的「承载目录」名：它们只是分类层级，不能当作品名
export const GENERIC_DIR_NAMES = [
  '电影', '电视剧', '动漫', '综艺', '纪录片', '动画', '剧集', '连续剧',
  '我的视频', '视频', '全部文件', '个人文件', '其他', '未分类', '未识别',
  'movies', 'movie', 'tv', 'tv shows', 'shows', 'videos', 'video', 'anime', 'films', 'film',
  'documentary', 'documentaries', 'variety',
  // 网盘里常见的临时/软件/下载目录，名字不能当片名
  'temp', 'tmp', 'download', 'downloads', '下载', '临时', '新建文件夹',
  'uploads', 'upload', 'backup', '备份', 'apps', 'software', '软件',
  // 网盘「分享 / 转存」类目录名。这些是网盘的转存入口层级，不是作品名。
  // 拿它当片名会配出不相干的片：`来自：分享` 被 stripSubtitle 切成「来自」，
  // 搜 TMDB 命中纪录片《来自阴道》（45 分，单候选前缀放宽放行）。
  '分享', '来自：分享', '来自分享', '来自:分享', '来自：共享',
  '我的分享', '收到的分享', '转存的文件', '转存文件', '共享文件',
  // alist / WebDAV 挂载点的常见层级名。
  // 这些目录名一旦被当成片名，整层文件会塌缩成一部叫「media」的假影片。
  'media', 'medias', 'library', 'libraries', 'video library', 'media library',
  '阿里云盘', '百度网盘', '夸克', '迅雷', 'onedrive', 'cloud', 'clouddrive',
  'disk', 'files', 'file', 'root', 'home', 'data', 'public', 'share', 'shared',
  '影视', '影片', '片子', '资源', '网盘', '收藏',
  // 课程 / 教程 / 素材类目录名。这些目录里的视频不是影视作品，
  // 名字一旦被当成片名就会刮出无关的 TMDB 条目（曾出现一份叫「Agent」的假影片）。
  //
  // 注意：这里是**整名**匹配，所以可以安全地列「笔记」「资料」这类弱词。
  // 它们绝不能进 NON_MEDIA_DIR_KEYWORDS 做子串判定——那会把
  // 《吴邪私家笔记》《盗墓笔记》《死亡笔记》整部剧判成承载层（见那里的注释）。
  'agent', 'agent开发', '教程', '课程', '合集', '课件', '资料', '素材',
  '文档', '笔记', '学习', '培训', '教学', '直播回放',
  '模版', '模板', '源码', '课件包', '学习笔记', '课程笔记', '上课笔记',
  'music', 'mv', 'music video', 'podcast', 'audiobook', 'course', 'courses',
  'tutorial', 'tutorials', 'lecture', 'lectures', 'training',
]

/**
 * 目录名里出现这些词，说明它装的是课程/教程/素材，不是影视作品。
 *
 * 用「包含」判定（不能整名匹配）：`agent开发全套教程`、`AI大模型教学视频`、
 * `第9章 AI编程智能体记忆能力实现(AI Agent的记忆能力)` 都得挡住。
 * 这些目录里的视频会被 pod 成一部叫「Agent」「教程」的假影片。
 *
 * **只收「强特征词」**：出现在片名里几乎不可能、出现在课程目录里几乎必然。
 *
 * `素材/资料/文档/笔记/模版/模板/源码/课件包` 这组**必须排除**。
 * 早期它们也在这里做子串判定，结果 `isGenericDirName` 把整部剧的目录名
 * 判成承载层，剧名被置空、整层不产出剧集卡：
 *   `吴邪私家笔记 (2025)/Season 1/…` → 命中「笔记」→ 电视剧分类里彻底消失
 *   `盗墓笔记`、`死亡笔记` 同源误伤。
 * 这些词只在 GENERIC_DIR_NAMES 里做**整名**匹配（`资料`、`素材`、`笔记` 等
 * 仍会被判成承载层），片名里带它们则是正常的（《吴邪私家笔记》）。
 */
const NON_MEDIA_DIR_KEYWORDS = [
  /(?:教程|课程|教学|课件|讲义|培训|训练营|入门到精通)/,
  /\bagent\b/i,
  /\bcoze\b/i,
  /\bworkflow\b/i,
  /\btutorials?\b/i,
  /\bcourses?\b/i,
  /\blectures?\b/i,
  /\bpodcasts?\b/i,
]

/** 目录名是否明确是「课程/教程/素材」这类非影视目录 */
export const isNonMediaDir = name => {
  const n = String(name || '').trim().toLowerCase()
  if (!n) return false
  return NON_MEDIA_DIR_KEYWORDS.some(re => re.test(n))
}

/**
 * 「祖先链里有课程/教程目录」的窄口径判据。
 *
 * 与 isNonMediaDir 的区别是**故意更保守**：后者含 `素材`/`资料`/`文档`/`笔记`，
 * 这些词出现在祖先位置时误伤面太大——`/影视资料/电影/…`、`/电影合集/…`
 * 都是正常影视目录，判错会把整库清成未识别。
 *
 * 只保留课程类的强特征词。实测要挡的两条路径：
 *   /夸克网盘/来自：分享/AI智能体教程合集/马馺·怎样用AI做PPT（完结）/ms-00.发刊词…mp4
 *   /夸克网盘/来自：分享/Ai Agent开发/尚硅谷…/2.视频/day01/3-Clip-1.mp4
 * 两者的共同祖先分别是「AI智能体教程合集」和「Ai Agent开发」。
 */
const NON_MEDIA_ANCESTOR_PATTERNS = [
  /(?:教程|课程|教学|课件|讲义|培训|训练营|入门到精通)/,
  /\bagent\b/i,
  /\bcoze\b/i,
  /\bworkflow\b/i,
  /\btutorials?\b/i,
  /\bcourses?\b/i,
  /\blectures?\b/i,
]

/**
 * 「分集数量标注」目录名：`【共16集 每周六日同步更新中】`、`1080P【12集全】`。
 *
 * 这类名字来自网盘分享转存，描述的是更新状态而非作品名。拿它当剧名去搜
 * TMDB 必然搜不到，只会产出一张挂着怪名字的卡。
 */
//
// 也要认没有括号的 `共16集 每周六日同步更新中`、`12集全`——剥括号之后
// 就是这个样子，所以必须整串判定。
// `共` 在数字前：`共16集`，所以可选的「共/全」要放在数字前
const EPISODE_COUNT_ANNOTATION = /(?:^|[\s【\[（(])(?:共\s*|全\s*)?\d{1,4}\s*[集话話期]/
const EPISODE_COUNT_ONLY = /^(?:共\s*|全\s*)?\d{1,4}\s*[集话話期]/
export const isEpisodeCountAnnotation = name => {
  const s = String(name || '').trim()
  if (!s) return false
  // 整串就是这个标注，或标注后面只剩「全/完结/更新中」这类状态词
  if (EPISODE_COUNT_ONLY.test(s)) return true
  // 括号形式：`1080P【共16集 …】`
  if (EPISODE_COUNT_ANNOTATION.test(s) && /[【\[（(]/.test(s)) return true
  return false
}

/** 目录名是否像「课程/教程」目录（用于祖先链判定） */
export const isNonMediaAncestor = name => {
  const n = String(name || '').trim().toLowerCase()
  if (!n) return false
  return NON_MEDIA_ANCESTOR_PATTERNS.some(re => re.test(n))
}

/** 目录名是否是通用承载名 */
export const isGenericDirName = name => {
  const n = String(name || '').trim().toLowerCase()
  if (!n) return true
  if (GENERIC_DIR_NAMES.includes(n)) return true
  // 纯编号/纯符号目录名（01 / 02 / --- / (09)）不是片名。
  //
  // 但**四位数字不能一律当承载层**：《1917》《2012》《2046》《1984》《300》
  // 的片名就是数字，电影常放在 `电影/1917/` 这样的目录里。
  // 只把 1~2 位编号（集号形态）和纯符号当承载层；
  // 3~4 位数字交给下游判断——文件名里带年份时能自证是片名。
  if (/^[\s._\-()（）\[\]【】]+$/.test(n)) return true
  if (/^\d{1,2}$/.test(n)) return true
  // 「共16集 每周六日同步更新中」这类更新状态标注，不是作品名
  if (isEpisodeCountAnnotation(n)) return true
  // 网盘「来自：xxx」这类分享来源目录：前缀固定、后缀任意，列表无法穷举。
  // 例：来自：分享 / 来自：小明 / 来自:xxx。后缀为空也认（`来自：`）。
  if (/^来自\s*[：:]\s*\S*$/.test(n)) return true
  // 课程/教程类目录
  return NON_MEDIA_DIR_KEYWORDS.some(re => re.test(n))
}

/** 本层视频里，能作为「剧样本」的第一个 */
export const firstVideo = videos => videos.find(v => isVideoFile(v.name)) || null
