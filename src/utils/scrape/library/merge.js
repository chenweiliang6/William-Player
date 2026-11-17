/**
 * Works 合并的基础操作。
 *
 * 从 orchestrator.js 抽出来的原因：流式刮削需要两种语义不同的合并——
 *   1. **全量合并**（mergeWorks）：新结果代表「这一轮扫到的全集」，
 *      旧库里本轮没再扫到的条目要删掉。用于刮削收尾。
 *   2. **增量合并**（upsertWorks）：新结果只是「到目前为止扫到的部分」，
 *      绝不能删任何东西。用于刮削过程中每批落库。
 *
 * 两者的字段覆盖规则必须**完全一致**，所以共用 applyWorkMeta / mergeVersionsInto。
 */
import { demoteWork } from './model'
import { looksLikeEpisodeFile } from '../scan/shape'

/** 版本路径的父目录：`/a/b/c.mkv` → `/a/b` */
const dirOfPath = p => String(p || '').split('/').slice(0, -1).join('/')

/**
 * 找出「其实是某部剧分集」的错误电影卡。
 *
 * 背景（2026-11 实测）：扫描期把剧目录里的分集重复 emit 成独立影片，
 * 这些文件再去搜 TMDB，撞上同名作品就变成有海报的「电影」——
 * 九门 / 01 4K.mp4 ×30 → 电影《九门》(2021)，一个目录两张卡。
 * 扫描链路修好后这些文件不再产出 item，因此 `freshVersionKeys` 里没有它们，
 * `mergeWorks` 的第一条摘除路径不触发；只能靠 prune，而 prune 要求
 * 整轮扫描零跳过目录（真实网盘常有挂载失败），一旦不满足脏卡就永远留着。
 *
 * 这里用**本轮正向证据**兜底，不依赖「没扫到」这种推断：
 *   本轮产出了剧集卡、其版本路径为目录 D → 库里所有满足以下条件的 work 都是脏卡：
 *     · mediaType 不是 tv（且版本里没有 seasons）
 *     · 每个版本的文件名都是分集形态（SxxExx / 第N集 / 01.mp4 / 01 4K.mp4）
 *     · 每个版本所在的父目录都在 D 之下
 *     · 没有手动匹配过
 *
 * 安全性：真电影（`某电影.2023.mkv`）不满足「分集形态」；跨目录的 work
 * 一个条件都不满足就会被留下。删除不损失可播内容——剧集卡按目录浏览
 * 覆盖同一批文件（剧集的 versionKey 落在剧目录层级）。
 *
 * **入参改成「剧集目录集合」而不是「剧集 works」**（2026-11 第三次修复）：
 * 从 runWorks 收集会被匹配阶段过滤——`selectPersistable` 会拦下整批未匹配的
 * works，`runWorks.length === 0` 时更会直接跳过 mergeWorks。而「本轮这个目录
 * 被判成剧集」这个事实来自**扫描结果**（items 里的 isSeasonDir），与匹配成败
 * 无关，用它做局部判定就没有这些耦合。
 *
 * @param {Array} works 待过滤的 works（通常是旧库）
 * @param {Set<string>|Array<string>} showDirs 本轮确认存在的剧集目录路径
 * @returns {Set<string>} 要丢弃的 workId 集合
 */
export const findEpisodeSplitIds = (works, showDirs) => {
  const dirs = showDirs instanceof Set ? showDirs : new Set(showDirs || [])
  if (!dirs.size) return new Set()

  const out = new Set()
  ;(works || []).forEach(w => {
    if (!w || w.mediaType === 'tv' || w.manualMatched) return
    const vers = w.versions || []
    if (!vers.length) return
    // 带 seasons 的说明它自己也承担了季结构，不是分集散片
    if (vers.some(v => (v.seasons || []).length)) return
    const everyEpisode = vers.every(v => looksLikeEpisodeFile(v?.file?.name))
    if (!everyEpisode) return
    const allInside = vers.every(v => dirs.has(dirOfPath(v?.ref?.path)))
    if (allInside) out.add(`${w.workKey}::${w.mediaType}`)
  })
  return out
}

/**
 * 元数据整体以最新结论为准，**不做 `||` 兜底**。
 *
 * 早期这里写 `poster: w.poster || existed.poster` 这类兜底，导致：
 * 新链路把某条目判定为「未识别」（poster/year 为空）时，旧 Work 上
 * 那张错误海报被保留下来，而 category 却已变成 unidentified ——
 * 结果是未识别分区里全挂着错片海报，重刮多少次都清不掉。
 *
 * 新结果的空值本身就是「这一轮没匹配上」的有效结论，必须如实落库。
 * 唯一的例外是 title：未识别条目的 title 由文件名兜底生成，
 * 新结果拿不到 title 时保留旧的展示名，避免卡片变空白。
 */
export const applyWorkMeta = (existed, w) => {
  Object.assign(existed, {
    tmdbId: w.tmdbId ?? null,
    title: w.title || existed.title,
    originalTitle: w.originalTitle || '',
    year: w.year || '',
    releaseDate: w.releaseDate || '',
    seasonCount: w.seasonCount || 0,
    poster: w.poster || '',
    backdrop: w.backdrop || '',
    overview: w.overview || '',
    voteAverage: w.voteAverage || 0,
    genres: w.genres || [],
    originCountry: w.originCountry || [],
    collectionId: w.collectionId ?? null,
    category: w.category,
    matched: !!w.matched,
    unidentified: !!w.unidentified,
    needsReview: w.needsReview,
    matchScore: w.matchScore,
    lastMatchAttempt: w.lastMatchAttempt,
    // 跨类型纠正标记必须随元数据一起覆盖：碰撞裁决完全依赖它。
    // 漏掉会让降级条目在下一批又变回「原生」，碰撞检测失效。
    scanMediaType: w.scanMediaType || existed.scanMediaType || '',
    typeCorrected: !!w.typeCorrected,
  })
  return existed
}

/**
 * 把一批 version 合并进 work，同 versionKey 时合并 seasons。
 *
 * **seasons 必须合并，不能只按 versionKey 去重**：剧集的 versionKey 落在
 * 「剧目录」层级（见 model.js 的 toVersion），同一部剧的多季共用一个
 * versionKey，季的差异体现在 seasons 里。流式刮削会把同一部剧的不同季
 * 分到不同批次，只去重不合并 seasons 会让后到的季整块消失。
 */
export const mergeVersionsInto = (work, versions) => {
  if (!Array.isArray(work.versions)) work.versions = []
  for (const v of versions || []) {
    const existed = work.versions.find(e => e.versionKey === v.versionKey)
    if (!existed) {
      work.versions.push({ ...v, seasons: [...(v.seasons || [])] })
      continue
    }
    ;(v.seasons || []).forEach(s => {
      if (!existed.seasons.find(e => e.season === s.season)) {
        existed.seasons.push(s)
      }
    })
    existed.seasons.sort((a, b) => Number(a.season) - Number(b.season))
  }
  return work
}

/**
 * 深克隆一层（work + versions + seasons）。
 *
 * 库里的对象会被多方持有（store 内存镜像、projectLegacyView 的投影、
 * 以及刮削过程中的中间数组），就地改写会互相污染。
 */
export const cloneWorks = works => (works || []).map(w => ({
  ...w,
  versions: (w.versions || []).map(v => ({ ...v, seasons: [...(v.seasons || [])] })),
}))

export const workId = w => `${w.workKey}::${w.mediaType}`

/**
 * 找出「跨类型碰撞」的 workId 集合。
 *
 * 背景：`tryMatchMulti` 在「指定类型搜不到」时会用 `/search/multi` 兜底，
 * 命中后把 mediaType 纠正成 TMDB 返回的真实类型。纠正后的 workKey 是
 * `tmdb:{纠正后类型}:{tmdbId}` —— 与一部扫描原生就命中同一 TMDB 作品的
 * Work **完全同 workId**。直接合并会造出「一部电影文件挂在剧集 Work 下」
 * 的畸形条目：`versions[0]` 指到电影文件，却按剧集播放。
 *
 * 判据必须是「同 workId 下既有原生又有纠正」。**不能**用「同 tmdbId
 * 不同 mediaType」—— TMDB 的 movie id 与 tv id 是两个独立自增空间，
 * /movie/555 与 /tv/555 是两部毫不相干的作品，同号完全合法。
 *
 * @param {Array} works
 * @returns {Set<string>} 发生碰撞的 workId
 */
export const findTypeCollisionIds = works => {
  const natives = new Set()
  const corrected = new Set()
  ;(works || []).forEach(w => {
    if (!w) return
    const k = workId(w)
    if (w.typeCorrected) corrected.add(k)
    else natives.add(k)
  })
  const out = new Set()
  corrected.forEach(k => { if (natives.has(k)) out.add(k) })
  return out
}

/**
 * 跨类型碰撞裁决：把碰撞的纠正条降级为未识别。
 *
 * 只在「同 workId 下既有扫描原生命中、又有跨类型纠正」时触发。
 * 降级后用户可通过「修正匹配」手动指定 —— 保留一条能播的条目，
 * 好过把它错并进另一部作品。
 *
 * 只有纠正、没有原生时不降级：那是「单文件剧集被误判成电影」的
 * 自动修复能力，不能砍掉。
 *
 * @param {Array} works
 * @returns {Array} 同长度数组，碰撞的纠正条替换为 demoteWork 结果
 */
export const resolveTypeCollisions = works => {
  const collided = findTypeCollisionIds(works)
  return (works || []).filter(Boolean).map(w =>
    collided.has(workId(w)) && w.typeCorrected ? demoteWork(w) : w,
  )
}

/**
 * 同 `resolveTypeCollisions`，但碰撞集合由外部提供（跨侧检测）。
 *
 * 场景：旧库里的纠正条目 + 本轮新刮到的原生条目分处两个数组，
 * 各自裁决看不出碰撞。调用方先把两侧合起来跑 `findTypeCollisionIds`，
 * 再对各自数组套用这个函数。
 */
export const demoteCollided = (works, collidedIds) =>
  (works || []).filter(Boolean).map(w =>
    collidedIds.has(workId(w)) && w.typeCorrected ? demoteWork(w) : w,
  )

/**
 * **纯增量**合并：只新增与覆盖，**绝不删除**。
 *
 * 用于流式刮削的每批落库。不能用 mergeWorks 代替 —— 它会按
 * 「本轮的 versionKey 集合」摘掉旧版本，而增量阶段的新结果只是
 * 「到目前为止扫到的部分」，尚未扫到的目录会被当成本轮消失而删掉，
 * 用户会在刮削头几秒看到海报墙大面积消失。
 *
 * @param {Array} base     当前库里的 works
 * @param {Array} incoming 本批新刮到的 works
 */
export const upsertWorks = (base, incoming) => {
  // 先做跨类型碰撞裁决：base（库里已有）与 incoming（本批新刮到）可能
  // 在同 workId 上一边原生一边纠正 —— 例如电影文件在第 1 批被纠正成剧集、
  // 真正的剧集目录在第 3 批原生命中同一 TMDB 作品。裁决必须在合并之前，
  // 否则两条会先在 map 里被折叠成一条畸形 Work，之后再想拆就无从下手。
  const resolved = resolveTypeCollisions([...(base || []), ...(incoming || [])])

  const map = new Map()
  resolved.forEach(w => {
    const k = workId(w)
    // 裁决后仍可能同 key（例如降级产生的 slug 与已有未识别条目同 key），
    // 走正常的增量合并语义
    const existed = map.get(k)
    if (!existed) {
      map.set(k, { ...w, versions: (w.versions || []).map(v => ({ ...v, seasons: [...(v.seasons || [])] })) })
      return
    }
    applyWorkMeta(existed, w)
    mergeVersionsInto(existed, w.versions)
  })
  return Array.from(map.values())
}

/**
 * 按 key 集合剔除 works（用于「身份收敛」后清掉被取代的旧条目）。
 */
export const removeWorksByKeys = (works, keys) =>
  (works || []).filter(w => !keys.has(workId(w)))

// 路径归一化：折叠重复斜杠，去掉末尾斜杠。
// 不同源返回的路径尾部斜杠不一致（Alist 常带、目录配置里常不带），
// 不做归一会让「范围包含」判断失效。
const normalizePath = p => String(p || '').replace(/\/{2,}/g, '/')
const normalizeRoot = p => normalizePath(p).replace(/\/+$/, '')

/**
 * 版本路径是否落在本次扫描的某个根目录之下。
 *
 * 用途：重刮结束后判断「这条旧版本是不是本该被扫到」。
 * 只有在范围内、本轮却一个同路径版本都没产出，才能认定文件已从网盘删除。
 *
 * 保守原则：
 *   - 根为 '' 或 '/' 视为整棵树（历史数据可能没有具体路径）。
 *   - 路径为空或无法比较时返回 false → 该条目**不会被删**。
 *     旧链路迁移来的条目路径格式可能和新扫描不一致，宁可留幽灵条目，
 *     也不能因为格式差异把用户的片清空。
 *
 * @param {string} path  version.ref.path
 * @param {string[]} roots 本轮扫描的根路径
 */
export const inScanScope = (path, roots) => {
  const p = normalizePath(path)
  if (!p || !Array.isArray(roots) || !roots.length) return false
  return roots.some(root => {
    const r = normalizeRoot(root)
    if (!r) return true
    return p === r || p.startsWith(r + '/')
  })
}
