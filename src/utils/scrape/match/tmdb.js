/**
 * TMDB 匹配。
 *
 * 流程：
 *   1. 用解析出的 title + year 搜索
 *   2. 用 score.js 打分排序，取可信度最高的
 *   3. 不可信时返回 matched:false 并带上候选，条目归入「未识别」，
 *      由用户在「修正匹配」里手动指定，而不是展示错误影片的海报
 */
import { searchMovieTvByType, searchMovieTvMulti, getTvSeasonDetail, getScrapeDetail } from '@/utils/tmdb'
import { pickBest, MIN_ACCEPT_SCORE, normalizeTitle } from './score'

// 同一批刮削内，相同查询只请求一次
const createMemo = () => {
  const cache = new Map()
  return {
    get: key => cache.get(key),
    set: (key, val) => cache.set(key, val),
    has: key => cache.has(key),
  }
}

/**
 * 去掉标题里的副标题。
 *   "指环王3：国王归来" → "指环王3"
 *   "复仇者联盟4：终局之战" → "复仇者联盟4"
 *   "Mission: Impossible" → "Mission"（英文冒号会误伤，所以要求副标题足够长）
 *
 * 用途：TMDB 的中文译名副标题常与发布组/字幕组不同，直接搜全名会 0 结果。
 */
export const stripSubtitle = title => {
  const t = String(title || '')
  // 中文全角冒号：副标题通常较长，任意长度都切
  const cn = t.split('：')
  if (cn.length > 1 && cn[0].trim().length >= 2) return cn[0].trim()
  // 英文/半角冒号：只在副标题较长时切，避免误伤 "Mission: Impossible"
  const en = t.split(/:\s+/)
  if (en.length > 1 && en[0].trim().length >= 2 && en.slice(1).join(':').trim().length >= 4) {
    return en[0].trim()
  }
  return t
}

/**
 * 把 TMDB 详情归一成库里的作品元数据。
 */
const normalizeDetail = (raw, mediaType) => {
  // 搜索接口给 genre_ids，详情接口给 genres:[{id,name}]。
  // 两者都要能归一成一个 id 数组，分类判定依赖它。
  const genres = Array.isArray(raw.genres) && raw.genres.length
    ? raw.genres.map(g => (typeof g === 'number' ? g : g.id)).filter(n => n != null)
    : (raw.genre_ids || [])

  const releaseDate = String(raw.release_date || raw.first_air_date || '')

  return {
    tmdbId: raw.id,
    mediaType,
    title: raw.title || raw.name || '',
    originalTitle: raw.original_title || raw.original_name || '',
    year: releaseDate.slice(0, 4),
    // 完整上映日期，卡片第二行按爆米花展示 YYYY-MM-DD
    releaseDate,
    poster: raw.poster_path || '',
    backdrop: raw.backdrop_path || '',
    overview: raw.overview || '',
    voteAverage: raw.vote_average || 0,
    genres,
    // 出品国家：仅 /search/tv 返回 origin_country，电影为空数组。
    // 用于把「动画剧集」细分成动漫/电视剧（见 parse/category.js）
    originCountry: raw.origin_country || [],
    collectionId: raw.belongs_to_collection?.id || null,
    // 季数：只有详情接口有。爆米花卡片第二行「共N季」用它。
    seasonCount: Number(raw.number_of_seasons) || 0,
  }
}

/**
 * 命中后用详情接口补齐搜索接口拿不到的字段。
 *
 * 为什么必须补：
 *   - 搜索接口没有 number_of_seasons，无法展示「共N季」
 *   - 搜索接口的 genre_ids 对剧集常是空的，导致动漫/综艺/纪录片分不出来
 *   - 没有完整上映日期，卡片只能显示年份
 *
 * 失败不致命：退回搜索结果的字段，刮削照常进行。
 */
const enrichWithDetail = async (detail, memo) => {
  if (!detail?.tmdbId || !detail?.mediaType) return detail

  const memoKey = `detail::${detail.mediaType}::${detail.tmdbId}`
  let raw
  if (memo?.has(memoKey)) {
    raw = memo.get(memoKey)
  } else {
    try {
      raw = await getScrapeDetail({ id: detail.tmdbId, mediaType: detail.mediaType })
      memo?.set(memoKey, raw)
    } catch (e) {
      console.warn('[scrape/match] TMDB 详情获取失败，沿用搜索结果:', detail.tmdbId, e?.message)
      return detail
    }
  }
  if (!raw || !raw.id) return detail

  // 详情返回真实媒体类型，可用于纠正搜索纠错后的误判
  const realType = raw.media_type === 'movie' || raw.media_type === 'tv'
    ? raw.media_type
    : detail.mediaType

  return { ...normalizeDetail(raw, realType), mediaType: realType }
}

/**
 * 「简称 + 序号」放宽匹配。
 *
 * 文件名常写简称（毒液3 / 变形金刚5 / 速度与激情10），而 TMDB 的
 * 中文名或原名往往带副标题（毒液：最后一舞）。
 *
 * 判据必须同时满足，否则纯编号名（01 / 02）也会被放行：
 *   1. 查询词形如「文字前缀 + 序号」，例如「毒液3」→ 前缀「毒液」、序号 3
 *   2. 候选的标题或原名以该前缀开头（毒液 / Venom）
 *   3. 候选的标题或原名里出现同一个序号（Venom: The Last Dance 不含 3，
 *      但 Venom 3 含；中文名「毒液：最后一舞」不含，所以要看原名）
 *
 * 纯数字查询词（01）第 1 条就过不了，天然被排除。
 */
/**
 * 拆分「简称 + 序号」，并校验前缀是否有辨识度。
 *
 * `毒液3` → { prefix:'毒液', seq:'3' }；
 * `t02`   → null（前缀是单个字母，任何以 t 开头带数字的条目都会被误认）
 *
 * 早期只挡了「前缀是纯数字」，于是课程合集里的 `t02.mp4` 被切成
 * 「前缀 t + 序号 02」，命中了 TMDB 上任意以 t 开头的带号条目
 * （演唱会、T11 Incomplete、Top 10 roommate tips…）。
 */
const splitTitleAndSeq = title => {
  const m = String(title || '').match(/^(.+?)(\d{1,2})$/)
  if (!m) return null
  const prefix = m[1].trim()
  const seq = m[2]
  if (!prefix || /^\d+$/.test(prefix)) return null
  // 前缀必须有辨识度：至少一个汉字，或至少 3 个字母
  const hasCJK = /[一-龥]/.test(prefix)
  const letters = (prefix.match(/[A-Za-z]/g) || []).length
  if (!hasCJK && letters < 3) return null
  return { prefix, seq }
}

/**
 * 候选标题是否以查询词开头（前缀一致）。
 *
 * 只在「该前缀不是某个更长远配的诱饵」时采信：要求这个前缀候选
 * 是全部候选里唯一一个以它开头的，避免「指环王3」同时前缀命中
 * 「指环王3：王者无敌」和「指环王3：加长版」时靠运气选一个。
 * 两条其实是同一部片的加长版，选谁都能接受，所以这里只要求 ≥1 条即可。
 */
const isPrefixMatch = (picked, queryTitle, candidates) => {
  const q = normalizeTitle(queryTitle)
  if (!q || /^\d{1,4}$/.test(q)) return false
  const norm = c => normalizeTitle(c.title || c.name || '')
  const orig = c => normalizeTitle(c.original_title || c.original_name || '')
  // 被选中的候选自身必须前缀命中
  return norm(picked) === q || norm(picked).startsWith(q) || orig(picked) === q || orig(picked).startsWith(q)
}

/**
 * 候选年份与查询年份是否相差太远。
 * 查询没给年份时一律放行（无从判断）。
 */
const yearTooFar = (candidate, queryYear) => {
  if (!queryYear) return false
  const d = String(candidate.release_date || candidate.first_air_date || '')
  const cy = d ? Number(d.slice(0, 4)) : 0
  if (!cy) return false
  return Math.abs(Number(queryYear) - cy) > 2
}

const relaxBySequelNumber = (candidates, title, parsed, mediaType) => {
  const split = splitTitleAndSeq(title)
  if (!split) return null
  const { prefix, seq } = split

  const lowerPrefix = prefix.toLowerCase()
  const hit = candidates.find(c => {
    // 年份差太远的直接排除：系列片放宽本就容易配错，年份是廉价的硬约束
    if (yearTooFar(c, parsed?.year)) return false
    const names = [c.title, c.name, c.original_title, c.original_name]
      .filter(Boolean)
      .map(n => String(n))
    return names.some(n => {
      const lower = n.toLowerCase()
      if (!lower.startsWith(lowerPrefix)) return false
      // 序号要作为独立 token 出现（避免 3 命中 30 / 13）
      return new RegExp(`(?:^|[^0-9])${seq}(?:[^0-9]|$)`).test(n)
    })
  })
  if (!hit) return null

  // 用候选自己的类型，而不是扫描阶段的猜测
  const realType = hit.media_type === 'tv' || hit.media_type === 'movie' ? hit.media_type : mediaType

  return {
    matched: true,
    detail: normalizeDetail(hit, realType),
    needsReview: false,
    score: MIN_ACCEPT_SCORE,
    candidates,
    // 标记来源，便于排查
    relaxedFrom: title,
  }
}

/**
 * 去掉序号重新搜索。
 *
 * 「毒液3」直接搜能拿到候选，但 TMDB 的中文名是「毒液：最后一舞」，
 * 原名是 Venom: The Last Dance —— 两处都不带数字 3，相似度和序号校验
 * 都会失败。而搜「毒液」能拿到整条系列的所有条目。
 *
 * 拿到系列候选后，用「候选上映年份 与 查询序号 的排序关系」挑：
 * 系列第 N 部往往不是年份第 N 近，靠不住。所以这里的判据是——
 * 只在**整条系列里恰好只有这一个候选**（说明系列就这点片），或者
 * **候选的标题/原名里带同一个序号**时才采信。宁可放过，不可配错。
 */
const reserchedBySeries = async (title, parsed, mediaType, memo) => {
  const split = splitTitleAndSeq(title)
  if (!split) return null
  const { prefix, seq } = split

  const memoKey = `series::${mediaType}::${prefix}`
  let res
  if (memo?.has(memoKey)) {
    res = memo.get(memoKey)
  } else {
    try {
      res = await searchMovieTvByType({ query: prefix }, mediaType)
      memo?.set(memoKey, res)
    } catch {
      return null
    }
  }

  const cands = (res?.results || []).filter(c => c.id !== undefined)
  if (!cands.length) return null

  // 候选自己的类型才是权威的：扫描阶段按「单文件无集号」会一律猜 movie，
  // 但 TMDB 返回 media_type=tv 说明它其实是剧集。用猜的类型去归一，
  // 会让 deriveCategory 走进 movie 分支，剧集被错分到电影。
  const typeOf = c => (c.media_type === 'tv' || c.media_type === 'movie' ? c.media_type : mediaType)

  // 优先：标题或原名里带同一个序号（毒液3 / Venom 3）
  const bySeq = cands.find(c => {
    const names = [c.title, c.name, c.original_title, c.original_name]
      .filter(Boolean).map(String)
    return names.some(n =>
      n.toLowerCase().startsWith(prefix.toLowerCase()) &&
      new RegExp(`(?:^|[^0-9])${seq}(?:[^0-9]|$)`).test(n),
    )
  })
  if (bySeq) {
    return {
      matched: true,
      detail: normalizeDetail(bySeq, typeOf(bySeq)),
      needsReview: false,
      score: MIN_ACCEPT_SCORE,
      candidates: cands,
      relaxedFrom: title,
    }
  }

  // 系列只有一个候选：序号写成几都指向它（如「毒液3」对应的唯一系列条目）
  if (cands.length === 1) {
    return {
      matched: true,
      detail: normalizeDetail(cands[0], typeOf(cands[0])),
      needsReview: false,
      score: MIN_ACCEPT_SCORE,
      candidates: cands,
      relaxedFrom: title,
    }
  }

  return null
}

/**
 * 跨类型兜底搜索。
 *
 * 扫描阶段对「电影 / 剧集」的判定是启发式的，可能判错。
 * 当指定类型搜不到任何结果时，用 /search/multi 再搜一次；
 * 命中后把 mediaType 纠正为 TMDB 返回的真实类型。
 *
 * 只在「指定类型完全无结果」时触发，不会影响已有结果的判定质量。
 *
 * @returns {Promise<object|null>} 命中时返回与 matchOnTmdb 同形的结果，未命中返回 null
 */
const tryMatchMulti = async (title, parsed, mediaType, memo) => {
  const memoKey = `multi::${title}::${parsed.year || ''}`
  let res
  if (memo?.has(memoKey)) {
    res = memo.get(memoKey)
  } else {
    try {
      res = await searchMovieTvMulti({ query: title })
      memo?.set(memoKey, res)
    } catch {
      return null
    }
  }

  // /search/multi 会混入 person 结果，只保留有明确媒体类型的
  const candidates = (res?.results || []).filter(c => c.media_type === 'movie' || c.media_type === 'tv')
  if (!candidates.length) return null

  const { picked, confident, score } = pickBest(candidates, {
    title,
    year: parsed.year,
    // 用候选自身的类型打分，避免类型项被统一扣分
    mediaType: null,
  })
  if (!picked || !confident) return null

  const realType = picked.media_type
  const detail = await enrichWithDetail(normalizeDetail(picked, realType), memo)
  return {
    matched: true,
    detail,
    needsReview: false,
    score,
    candidates,
    // 标记：类型被兜底纠正过，上层据此更新 mediaType / category
    typeCorrected: realType !== mediaType,
    correctedFrom: mediaType,
  }
}

/**
 * 搜索并挑最佳匹配。
 *
 * @param {object} parsed { title, year, season }
 * @param {'movie'|'tv'} mediaType
 * @param {object} [memo] 同批次缓存
 * @returns {Promise<{
 *   matched: boolean,
 *   detail: object|null,
 *   needsReview: boolean,
 *   score: number,
 *   candidates: Array,
 * }>}
 */
export const matchOnTmdb = async (parsed, mediaType, memo) => {
  const title = parsed.title
  if (!title) {
    return { matched: false, detail: null, needsReview: true, score: 0, candidates: [] }
  }

  const memoKey = `${mediaType}::${title}::${parsed.year || ''}`
  let searchResult
  if (memo?.has(memoKey)) {
    searchResult = memo.get(memoKey)
  } else {
    const params = { query: title }
    if (parsed.year) {
      // 电影用 primary_release_year，剧集用 first_air_date_year（tmdb.js 内部会改名）
      params.first_air_date_year = parsed.year
    }
    try {
      searchResult = await searchMovieTvByType(params, mediaType)
      memo?.set(memoKey, searchResult)
    } catch (e) {
      console.warn('[scrape/match] TMDB 搜索失败:', title, e)
      return { matched: false, detail: null, needsReview: true, score: 0, candidates: [], error: e }
    }
  }

  const candidates = searchResult?.results || []
  if (!candidates.length) {
    // 搜索无结果时依次降级重试：
    //   1) 去掉年份（年份常被文件名弄错）
    //   2) 去掉副标题（"指环王3：国王归来" → "指环王3"，
    //      因为 TMDB 里同一部片的中文译名可能是"王者无敌"）
    const retries = []

    if (parsed.year) retries.push({ query: title, year: '' })

    const mainTitle = stripSubtitle(title)
    if (mainTitle && mainTitle !== title) {
      retries.push({ query: mainTitle, year: parsed.year })
      if (parsed.year) retries.push({ query: mainTitle, year: '' })
    }

    for (const r of retries) {
      try {
        const retry = await searchMovieTvByType(
          r.year ? { query: r.query, first_air_date_year: r.year } : { query: r.query },
          mediaType,
        )
        const retryCandidates = retry?.results || []
        if (!retryCandidates.length) continue
        const retryPick = pickBest(retryCandidates, { title: r.query, year: r.year || '', mediaType })
        // 「前缀一致」放宽：候选标题以查询词开头即为强证据。
        //
        // 这是「指环王3：国王归来」的解法。TMDB 的中文名是「指环王3：王者无敌」，
        // 全名相似度只有 0.43（25.7 分），去副标题后搜「指环王3」能拿到正确
        // 候选，但多候选时 60 分门槛过不去。以查询词为前缀的候选超过阈值的一半
        // 就该采信——「指环王3：王者无敌」以「指环王3」开头，这是明确的同一部。
        const relaxedByPrefix = retryPick.picked && retryPick.score >= MIN_ACCEPT_SCORE * 0.75 &&
          isPrefixMatch(retryPick.picked, r.query, retryCandidates)
        if (retryPick.picked && (retryPick.confident || relaxedByPrefix)) {
          const rp = retryPick.picked
          const retryType = rp.media_type === 'tv' || rp.media_type === 'movie' ? rp.media_type : mediaType
          const retryDetail = await enrichWithDetail(normalizeDetail(rp, retryType), memo)
          return {
            matched: true,
            detail: retryDetail,
            needsReview: false,
            score: retryPick.score,
            candidates: retryCandidates,
          }
        }
      } catch {
        // 这一轮失败，继续下一轮
      }
    }

    // 最后一层兜底：指定类型搜不到，可能是扫描阶段判错了类型
    // （电影被当成剧，或反过来）。/search/multi 跨类型搜索，
    // 命中后按返回值纠正 mediaType。
    const corrected = await tryMatchMulti(title, parsed, mediaType, memo)
    if (corrected) return corrected

    return { matched: false, detail: null, needsReview: true, score: 0, candidates: [] }
  }

  const { picked, confident, score, ranked } = pickBest(candidates, {
    title,
    year: parsed.year,
    mediaType,
  })

  if (!picked) {
    return { matched: false, detail: null, needsReview: true, score: 0, candidates }
  }

  if (!confident) {
    // 有候选但不够可信，依次尝试三种放宽，都不行才判未识别：
    //   1. 候选里带同一个序号（Venom 3 vs 毒液3）
    //   2. 去掉序号重新搜（毒液3 → 毒液）：系列片的中文名常不带序号，
    //      搜「毒液」能拿到「毒液：最后一舞」，再按系列序号校验
    //   3. 跨类型兜底（/search/multi）
    //
    // 第 3 条以前只在「指定类型搜到 0 条」时才跑。但真正的类型错判往往
    // 不是 0 条——`/search/movie?query=那年，我们的夏天` 会返回几条不相干的
    // 电影，于是流程停在「有候选但不可信」，永远走不到 tv 那一侧，
    // 而正确答案就在 tv 里。这里把它补进「不可信」分支。
    const relaxed = relaxBySequelNumber(candidates, title, parsed, mediaType)
    if (relaxed) return relaxed

    const reserched = await reserchedBySeries(title, parsed, mediaType, memo)
    if (reserched) return reserched

    const corrected = await tryMatchMulti(title, parsed, mediaType, memo)
    if (corrected) return corrected

    // 实在不可信：不再把候选的元数据写进 Work。
    // 旧实现返回 matched:true + 错误影片的海报/简介，而 needsReview 在 UI 层
    // 没有任何消费方，结果是海报墙直接展示错误的片子。
    // 现在返回 matched:false，条目归入「未识别」，候选留给用户手动挑。
    return {
      matched: false,
      detail: null,
      needsReview: true,
      score,
      candidates: ranked.slice(0, 5).map(r => r.candidate),
    }
  }

  // 以 TMDB 返回的类型为准。`/search/movie` 的条目没有 media_type 字段，
  // 但兜底后的 candidate 可能有；扫描阶段猜错时这里能把类型纠正回来。
  const pickedType = picked.media_type === 'tv' || picked.media_type === 'movie'
    ? picked.media_type
    : mediaType

  return {
    matched: true,
    detail: await enrichWithDetail(normalizeDetail(picked, pickedType), memo),
    needsReview: false,
    score,
    candidates,
  }
}

/**
 * 剧集专用：补季海报。
 * 旧逻辑只在 season != '1' 时取，这里保持同样行为。
 */
export const fetchSeasonPoster = async (tmdbId, season) => {
  if (!tmdbId || !season || String(season) === '1') return ''
  try {
    const res = await getTvSeasonDetail({ movieTvId: tmdbId, season })
    return res?.poster_path || ''
  } catch {
    return ''
  }
}

export const createMatchMemo = createMemo
