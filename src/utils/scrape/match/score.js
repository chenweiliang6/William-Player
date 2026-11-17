/**
 * TMDB 候选打分。
 *
 * 取代旧的 `results.find(v => v.name.includes(query))` —— 那个做法
 * 对多结果没有任何排序，取到第一个包含关系的就用了，经常匹配错。
 *
 * 打分维度：
 *   标题相似度  （权重最高）
 *   年份是否一致
 *   类型是否一致
 *   TMDB 热度/评分（作为平手时的次要参考）
 */

/**
 * 归一化标题：小写、去标点、压缩空白、去季标记
 */
export const normalizeTitle = str => {
  if (!str) return ''
  return String(str)
    .toLowerCase()
    .replace(/[·・:：,，.。!！?？'"“”‘’\-_()（）\[\]【】{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * 二元组相似度（Sørensen–Dice）
 * 对中文友好：中文按字符切，英文按词切
 */
export const similarity = (a, b) => {
  const na = normalizeTitle(a)
  const nb = normalizeTitle(b)
  if (!na || !nb) return 0
  if (na === nb) return 1

  const grams = str => {
    const hasCJK = /[一-龥]/.test(str)
    if (hasCJK) {
      // 中文：字符级二元组
      const chars = str.replace(/\s/g, '').split('')
      if (chars.length < 2) return [str]
      return chars.slice(0, -1).map((c, i) => c + chars[i + 1])
    }
    // 英文：词级 + 字符级混合
    const words = str.split(' ').filter(Boolean)
    if (words.length >= 2) return words
    const chars = str.replace(/\s/g, '').split('')
    if (chars.length < 2) return [str]
    return chars.slice(0, -1).map((c, i) => c + chars[i + 1])
  }

  const ga = grams(na)
  const gb = grams(nb)
  if (!ga.length || !gb.length) return 0

  const countMap = new Map()
  ga.forEach(g => countMap.set(g, (countMap.get(g) || 0) + 1))
  let overlap = 0
  gb.forEach(g => {
    const c = countMap.get(g)
    if (c > 0) {
      overlap++
      countMap.set(g, c - 1)
    }
  })
  return (2 * overlap) / (ga.length + gb.length)
}

// 权重
const W = {
  title: 60,      // 标题相似度
  titleExact: 25, // 完全一致额外加分
  yearMatch: 20,  // 年份一致
  yearMismatch: -25, // 年份明确不一致（扣分，防止跨年份误配）
  typeMatch: 10,  // 类型一致
  vote: 5,        // 评分加成
  popularity: 3,  // 热度加成
}

/**
 * 给单个候选打分。
 *
 * @param {object} candidate TMDB 搜索结果项
 * @param {object} query     { title, year, mediaType: 'movie'|'tv' }
 * @returns {{score: number, reasons: string[]}}
 */
export const scoreCandidate = (candidate, query) => {
  const reasons = []
  let score = 0

  const candTitle = candidate.title || candidate.name || ''
  const candOriginal = candidate.original_title || candidate.original_name || ''

  // 标题相似度取最大值（原名/译名都可能匹配）
  const simMain = similarity(candTitle, query.title)
  const simOriginal = similarity(candOriginal, query.title)
  const sim = Math.max(simMain, simOriginal)

  score += sim * W.title
  reasons.push(`title=${sim.toFixed(2)}`)

  // 完全一致额外加分
  if (normalizeTitle(candTitle) === normalizeTitle(query.title) ||
      normalizeTitle(candOriginal) === normalizeTitle(query.title)) {
    score += W.titleExact
    reasons.push('titleExact')
  }

  // 年份
  const candDate = candidate.release_date || candidate.first_air_date || ''
  const candYear = candDate ? String(candDate).slice(0, 4) : ''
  if (query.year && candYear) {
    if (query.year === candYear) {
      score += W.yearMatch
      reasons.push('yearMatch')
    } else {
      // 年份差 1 年算常见（跨年上映），不完全扣
      const diff = Math.abs(Number(query.year) - Number(candYear))
      if (diff > 1) {
        score += W.yearMismatch
        reasons.push(`yearDiff=${diff}`)
      }
    }
  }

  // 类型
  const candType = candidate.media_type || (candidate.title ? 'movie' : 'tv')
  if (query.mediaType && candType) {
    if (candType === query.mediaType) {
      score += W.typeMatch
      reasons.push('typeMatch')
    } else {
      score -= W.typeMatch
      reasons.push('typeMismatch')
    }
  }

  // 评分与热度（都是 0~10 / 0~100 量级，做归一）
  const vote = Number(candidate.vote_average) || 0
  score += (vote / 10) * W.vote
  const pop = Math.min(Number(candidate.popularity) || 0, 200)
  score += (pop / 200) * W.popularity

  return { score, reasons, similarity: sim }
}

/**
 * 给候选列表排序，返回按分数降序的数组。
 *
 * @param {Array} candidates
 * @param {object} query
 * @returns {Array<{candidate, score, reasons, similarity}>}
 */
export const rankCandidates = (candidates, query) => {
  if (!Array.isArray(candidates) || !candidates.length) return []
  return candidates
    .map(candidate => ({ candidate, ...scoreCandidate(candidate, query) }))
    .sort((a, b) => b.score - a.score)
}

// 低于这个分数视为「不可信」，归入「未识别」让用户手动选。
// 原值 45 过低：相似度 0.25 + 年份一致 + 类型一致就能过，
// 实测会把「某电影」配到完全不相干的作品上。
export const MIN_ACCEPT_SCORE = 60

/**
 * 从候选里挑最佳匹配。
 * 返回 { picked, confident, ranked }
 */
export const pickBest = (candidates, query) => {
  const ranked = rankCandidates(candidates, query)
  if (!ranked.length) return { picked: null, confident: false, ranked }

  const top = ranked[0]
  const second = ranked[1]

  // 分数够高才考虑。例外：只有一个候选，且查询词是候选标题的前缀
  // （"毒液3" vs "毒液3：最后一舞"），这类简称语义明确，可放宽阈值。
  const onlyOne = ranked.length === 1
  const topTitleNorm = normalizeTitle(top.candidate.title || top.candidate.name || '')
  const queryNorm = normalizeTitle(query.title || '')
  // 纯编号查询词不享受前缀放宽：'01' 是无数片名的前缀，放行等于没门槛
  const queryIsNumeric = /^\d{1,4}$/.test(queryNorm)
  const isPrefix = onlyOne && !queryIsNumeric && topTitleNorm && queryNorm && topTitleNorm.startsWith(queryNorm)
  const threshold = isPrefix ? MIN_ACCEPT_SCORE * 0.85 : MIN_ACCEPT_SCORE

  if (top.score < threshold) {
    return { picked: top.candidate, confident: false, score: top.score, ranked }
  }

  // TMDB 里同一部片常有多个条目（重制/不同地区/重复录入），
  // 标题完全相同、分数接近时不能因为「差距小」就判不可信。
  //
  // 但「同名」本身不能作为可信的全部理由：早期实现只要前两名标题相同就
  // 无条件返回 confident，绕过了上面所有分数门槛。查询词是纯编号
  // （01 / 02）时，TMDB 会返回一堆同名条目，于是垃圾名被配到真影片。
  // 现在要求同名的候选本身也得达到一个下限分数。
  const topTitle = normalizeTitle(top.candidate.title || top.candidate.name || '')
  const secondTitle = second ? normalizeTitle(second.candidate.title || second.candidate.name || '') : ''
  const sameTitle = !!second && topTitle && topTitle === secondTitle
  const SAME_TITLE_MIN = MIN_ACCEPT_SCORE * 0.75

  if (sameTitle) {
    return { picked: top.candidate, confident: top.score >= SAME_TITLE_MIN, score: top.score, ranked }
  }

  const gap = second ? top.score - second.score : Infinity

  // 候选里常混着「日语版 / 幕后纪录片 / 特别篇」这类衍生条目。
  // 若第一名与查询是「包含关系」（互为前缀或子串），且它明显高于其余候选，
  // 即使 gap 不足 8 也判可信。
  // gap 门槛从 1 提到 5：领先 1 分说明两个候选几乎持平，此时「包含关系」
  // 并不足以证明是同一部片，容易配错。
  // 纯编号查询词（01 / 02 / 33）没有辨识度：任何包含它的长标题都能「命中」。
  // 这类不允许走「包含关系放宽」的通道，必须靠分数硬门槛。
  const related = !queryIsNumeric && !!(queryNorm && topTitleNorm &&
    (topTitleNorm.startsWith(queryNorm) || topTitleNorm.includes(queryNorm)))
  const clearLead = !second || gap >= 8
  const confident = clearLead || (related && gap >= 5)

  return { picked: top.candidate, confident, score: top.score, ranked }
}
