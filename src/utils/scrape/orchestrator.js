/**
 * 刮削编排：把「扫描 → 匹配 → 聚合 → 落库」串起来。
 *
 * 这是各端 UI 唯一要调的入口：
 *   await scrapeSource({ source, cred, muluData, onProgress })
 */
import { init as storeInit, get as storeGet, set as storeSet, flush as storeFlush, isReady } from './store'
import { upgradeLibrary } from './library/upgrade'
import { scanSource } from './scan/source'
import { buildBucketWorks } from './library/model'
import { saveBucket } from './library/query'
import { migrateLegacyLibrary, buildLibraryFromMigration } from './library/migrate'
import { createMatchMemo } from './match/tmdb'
import { applyWorkMeta, mergeVersionsInto, upsertWorks, cloneWorks, removeWorksByKeys, workId, inScanScope, findTypeCollisionIds, demoteCollided, findEpisodeSplitIds } from './library/merge'

/**
 * 启动时初始化库。若新库不存在而旧库有数据，自动迁移。
 *
 * @param {object} [legacyCtx] { type, accountName } 当前激活源，用于推断旧数据归属
 * @returns {Promise<{migrated: boolean, info?: object}>}
 */
export const initLibraryWithMigration = async legacyCtx => {
  await storeInit()
  if (isReady()) {
    const lib = storeGet()
    // 已有新库就不迁移
    if (lib && Object.keys(lib.buckets || {}).length > 0) {
      return { migrated: false }
    }
  }

  if (!legacyCtx) return { migrated: false }

  const migration = migrateLegacyLibrary(legacyCtx)
  if (!migration.migrated) return { migrated: false, info: migration }

  const built = buildLibraryFromMigration(migration)
  if (!built) return { migrated: false, info: migration }

  // 迁移产物是 version: 2，**必须立刻跑一次升级**。
  // storeInit() 在上面已经执行过，那时库还是空的、upgradeLibrary 无内容可升；
  // 若把未经升级的 v2 库直接落盘，旧链路遗留的脏匹配（01/02/33 挂着
  // 错误海报）要等用户下次启动 App 才会被清理——表现就是「迁移完了，
  // 错误海报还在」。
  const { library: lib } = upgradeLibrary(built)

  storeSet(lib)
  await storeFlush()
  return { migrated: true, info: migration }
}

/**
 * 刮削一个源。
 *
 * 改造后不再按 movie/tv 分两轮扫描：
 * 目录树一次性走完，每部作品的类型由扫描器按内容判定，
 * 再按 TMDB 结果派生展示分类（category）。
 *
 * @param {object} opts
 * @param {object} opts.source       { type, name }
 * @param {object} opts.cred         该源凭据条目
 * @param {object} opts.muluData     目录配置（新 entries / 旧 movie+tv 均兼容）
 * @param {object} [opts.signal]     { cancelled }
 * @param {object} [opts.kinds]      兼容旧调用：传了就按旧方式分两轮扫
 * @param {Function} [opts.onPhase]  (phase, payload) 阶段回调
 * @returns {Promise<{movie: number, tv: number, failed: number, categories: object}>}
 */
export const scrapeSource = async ({
  source, cred, muluData, signal, kinds, onPhase,
}) => {
  // 确保库已初始化
  if (!isReady()) await storeInit()

  // errors 收集扫描阶段的真实错误，供 UI 区分「确实是空目录」和「请求失败」。
  // 早先这里只有 warn + continue，异常被吞掉后上层看到的是「刮削完成、0 部影片」。
  const stats = { movie: 0, tv: 0, failed: 0, errors: [], categories: {} }

  // ── 扫描完整性的分项计数 ──
  //
  // 决定「能不能删掉本轮没扫到的旧条目」。任何一项不为 0 就不删：
  // 一次网络抖动/挂载失效/批次异常都不该把用户整月的海报墙清掉。
  // 这些计数必须**分开**记，早先全塞进 stats.failed 会把
  // 「根目录扫不到」和「某批匹配失败」混成同一件事。
  let scanFailures = 0   // 整个根目录扫描失败（scanSource 抛错）
  let batchFailures = 0  // 批次匹配/入库异常（onBatch 的 catch）
  // 本次实际扫过的根路径，删除范围以它为界
  const scannedRootPaths = []
  // 本次扫描确认存在的剧集目录（来自 items.isSeasonDir，不经过 TMDB 匹配）。
  // 用于「把剧目录里被散成电影卡的分集清掉」的局部判定。
  const scannedShowDirs = new Set()

  // 旧调用方式仍按 kind 分两轮（保留给未迁移的入口）；
  // 新调用方式不传 kinds，一次扫完
  const passes = Array.isArray(kinds) && kinds.length ? kinds : [undefined]

  // ── 流式刮削的状态 ──

  const bucketId = `${source.type}::${source.name}`
  const bucketOf = () => storeGet().buckets?.[bucketId]

  // **扫描前的干净快照**。最终全量合并必须以它为基准：
  // 刮削过程中库已被增量写入，若直接拿「当前桶内容」当旧库，
  // 一旦触发 TMDB 故障保护（返回 oldWorks 不覆盖），返回的是已被
  // 未识别条目污染过的库，发现不了问题也不还原。
  const baseline = cloneWorks(bucketOf()?.works || [])
  const baselineMatched = baseline.filter(w => w.tmdbId).length

  // 本轮已刮到的全部 works，按 workKey 折叠（跨批同名作品要合并 seasons）
  const runMap = new Map()
  // 本轮出现过的 workKey（统计用，跨批不重复计数）
  const countedKeys = new Set()
  // 整轮共用的 TMDB 匹配缓存，保证同一片名跨批拿到同一结果
  const memo = createMatchMemo()

  let processedGroups = 0
  let matchedGroups = 0
  let totalGroups = 0
  // 本轮至少写过一次库
  let snapshotWritten = false
  // 上次强制落盘的时间：800ms 防抖在每批都写入时会一直被重置、整轮不落盘，
  // 进程被杀就全丢，所以按 FLUSH_BUDGET_MS 保底强制落一次。
  let lastFlushAt = Date.now()
  const FLUSH_BUDGET_MS = 5000

  const writeBucket = (works, { flushNow = false } = {}) => {
    saveBucket({ type: source.type, accountName: source.name, works })
    snapshotWritten = true
    // 增量阶段只写内存，落盘交给 store 的 800ms 防抖。
    // 逐批 await flush 会因 flush 的互斥锁把整个刮削串行化。
    // 但高频写入会让防抖计时器一直重置、整轮一次都不落盘，进程被杀就全丢，
    // 所以按 FLUSH_BUDGET_MS 保底强制落一次。
    if (flushNow || Date.now() - lastFlushAt > FLUSH_BUDGET_MS) {
      lastFlushAt = Date.now()
      return storeFlush()
    }
    return undefined
  }

  /** 把本批 works 折叠进 runMap（同 key 合并 seasons，不丢季） */
  const foldRunWorks = works => {
    const merged = upsertWorks(Array.from(runMap.values()), works)
    runMap.clear()
    merged.forEach(w => runMap.set(workId(w), w))
  }

  const recordWorks = works => {
    works.forEach(w => {
      const k = workId(w)
      if (countedKeys.has(k)) return
      countedKeys.add(k)
      if (w.mediaType === 'tv') stats.tv++
      else stats.movie++
      const cat = w.category || w.mediaType
      stats.categories[cat] = (stats.categories[cat] || 0) + 1
    })
  }

  /**
   * 未识别门禁：决定本批哪些条目可以立刻落库。
   *
   * 为什么要门禁：TMDB 429/断网时每批都会产出「未识别」条目并即时写库，
   * 用户会看到海报墙从电影/电视剧**实时降级成「其他」**，几秒后才恢复。
   *
   * 判据：
   *   - 本批有匹配 → 全落（正常情况）
   *   - 库里本来就没有任何匹配 → 全落（首次刮削，全是未识别也要显示）
   *   - 库里有匹配、本批却一条都没匹配上 → 疑似 TMDB 故障，本批先不落
   */
  const selectPersistable = works => {
    if (!works.length) return works
    if (works.some(w => w.tmdbId)) return works
    const bucketHasMatched = (bucketOf()?.works || []).some(w => w.tmdbId)
    return bucketHasMatched ? [] : works
  }

  /**
   * 身份收敛：同一个查询在不同批次得出不同身份时，把旧身份收进新身份。
   *
   * 场景：批次 A 查「庆余年」时 TMDB 瞬时失败 → 生成 `slug:tv:庆余年`；
   * 批次 B 重查成功 → `tmdb:tv:12345`。两者 workKey 不同，最终 mergeWorks
   * 也**清不掉**（它会把 slug 条目当成新结果的一部分重新加回来），
   * 结果是同一部剧出现两张卡。
   *
   * 这里按「查询身份 → 当前 workKey」在运行期记账：发现换了身份就
   * 把旧 Work 的版本搬进新的、并从库里删掉旧的。状态只在内存里，不落库。
   *
   * @returns {Set<string>} 需要从库里移除的旧 workId
   */
  const queryIdentity = new Map()
  const reconcileIdentity = (works, queries) => {
    const dropped = new Set()
    if (!queries?.size) return dropped
    works.forEach(w => {
      const q = queries.get(workId(w))
      if (!q) return
      const id = workId(w)
      const prevId = queryIdentity.get(q)
      if (prevId && prevId !== id) {
        const prev = runMap.get(prevId)
        // 手动匹配过的身份是用户选定的，绝不因自动匹配结果替换
        if (prev && !prev.manualMatched) {
          mergeVersionsInto(w, prev.versions)
          runMap.delete(prevId)
          dropped.add(prevId)
        }
      }
      queryIdentity.set(q, id)
    })
    return dropped
  }

  // 单个消费者：扫描交付的批次排队串行处理，避免多批并发写同一个桶。
  //
  // kind 必须在**入队时**捕获，不能读外层循环的当前值：队列是异步排空的，
  // 上一轮 pass 的批次可能在下一轮 pass 开始之后才被消费。
  let consuming = Promise.resolve()
  const onBatchFor = kind => items => {
    if (!items?.length) return
    consuming = consuming.then(async () => {
      if (signal?.cancelled) return
      // 变量名不能叫 stats —— 会遮蔽外层统计对象
      const built = await buildBucketWorks({
        source,
        items,
        kind,
        signal,
        memo,
        onProgress: p => onPhase?.('match-progress', { kind, ...p }),
      })
      onPhase?.('built', { kind, works: built.works.length, stats: built.stats })
      recordWorks(built.works)
      // 身份收敛必须在 fold 之前：它会把旧身份的版本搬进新身份，
      // 若先 fold 再收敛，runMap 里的副本拿不到被搬过来的版本。
      const dropped = reconcileIdentity(built.works, built.queries)
      foldRunWorks(built.works)
      processedGroups += built.stats.processed
      matchedGroups += built.stats.matched
      totalGroups += built.stats.total

      // ── 增量入库 ──
      //
      // 用 upsertWorks（只增/覆盖，绝不删）而不是 mergeWorks：
      // 增量阶段的新结果只是「到目前为止扫到的部分」，尚未扫到的目录
      // 会被 mergeWorks 当成本轮已消失而摘掉版本 → 用户看到海报墙大面积消失。
      // 删除与故障保护都留到最终全量合并。
      const current = bucketOf()?.works || []
      const nextWorks = upsertWorks(current, selectPersistable(built.works))
      writeBucket(dropped.size ? removeWorksByKeys(nextWorks, dropped) : nextWorks)

      onPhase?.('partial', {
        works: runMap.size,
        processed: processedGroups,
        total: totalGroups,
      })

      // 提前判失败：旧库本来有匹配、处理了一批却一条都没匹配上 →
      // 高度怀疑 TMDB 不可用。中止并与最终保护走同一套还原逻辑。
      if (baselineMatched > 0 && processedGroups >= 20 && matchedGroups === 0) {
        signal.cancelled = true
        signal.reason = 'tmdb'
      }
    }).catch(e => {
      // 单批失败不能让整个队列停摆，也不能让后续批次的累积丢掉
      console.warn('[scrape] 批次处理失败:', e)
      batchFailures++
      stats.failed++
      stats.errors.push({ kind: 'batch', message: e?.message || String(e) })
    })
  }

  for (const kind of passes) {
    if (signal?.cancelled) break

    onPhase?.('scan', { kind })

    let scanResult
    try {
      scanResult = await scanSource({
        source,
        cred,
        muluData,
        kind,
        signal,
        onProgress: p => onPhase?.('scan-progress', { kind, ...p }),
        onBatch: onBatchFor(kind),
      })
    } catch (e) {
      console.warn('[scrape] 扫描失败:', kind, e)
      scanFailures++
      stats.failed++
      stats.errors.push({
        kind,
        message: e?.message || String(e),
        isAuthError: !!e?.isAuthError,
        isConnectError: !!e?.isConnectError,
      })
      onPhase?.('error', { kind, message: e?.message, isAuthError: !!e?.isAuthError, isConnectError: !!e?.isConnectError })
      continue
    }

    // 收集本次扫过的根路径。范围以「配置目录」为准而非「实际成功的目录」：
    // 某个目录扫描失败时 scanFailures / partialFailures 已经阻止了删除，
    // 这里不需要再缩小范围。
    ;(scanResult.rootPaths || []).forEach(p => scannedRootPaths.push(p))

    // 本轮**扫描结果**里确认存在的剧集目录。
    //
    // 必须取自 scanResult.items（isSeasonDir 项），不能从 runWorks 反推：
    // runWorks 经过匹配阶段，`selectPersistable` 会拦下整批未匹配的 works，
    // 一旦被拦，剧集卡就不在 runWorks 里，清理也就失效了。
    // 扫描事实与 TMDB 匹配成败无关，这才是可靠的正向证据。
    ;(scanResult.items || []).forEach(it => {
      if (!it?.isSeasonDir) return
      const d = it.seasonPath || it.parentPath || it.path
      if (d) scannedShowDirs.add(String(d))
    })

    // 部分目录扫描失败：scanSource 用 allSettled 并行扫多个导入目录，
    // 单个目录抛错（超时/token 过期/路径不存在）时该目录下的所有影片
    // 会静默消失，只有全部失败才抛错。这里把「部分失败」透出去，
    // 否则用户看到的是「莫名其妙少了一整个分类的片」。
    if (scanResult.failed > 0) {
      stats.partialFailures = stats.partialFailures || []
      stats.partialFailures.push({
        kind,
        failed: scanResult.failed,
        total: scanResult.total,
        message: scanResult.errors?.[0]?.message || '部分目录扫描失败',
      })
      onPhase?.('partial-failure', {
        kind,
        failed: scanResult.failed,
        total: scanResult.total,
        message: scanResult.errors?.[0]?.message,
      })
    }

    // 根目录内部的子目录/挂载失效被跳过：这些目录整棵没刮到，
    // 但不影响其余目录，所以不计入 stats.failed（那会让「全失败才抛错」误判）。
    // 单独累计到 stats.skipped，并在 partialFailures 里带 reason 供 UI 区分文案。
    if (scanResult.skipped?.length) {
      stats.skipped = (stats.skipped || 0) + scanResult.skipped.length
      stats.partialFailures = stats.partialFailures || []
      stats.partialFailures.push({
        kind,
        reason: 'skipped',
        skipped: scanResult.skipped.length,
        message: scanResult.skipped[0]?.message || '部分目录无法访问，已跳过',
        paths: scanResult.skipped.map(s => s.path),
      })
      onPhase?.('partial-failure', {
        kind,
        reason: 'skipped',
        skipped: scanResult.skipped.length,
        message: scanResult.skipped[0]?.message,
      })
    }

    const items = scanResult.items || []
    if (!items.length) {
      onPhase?.('empty', { kind })
      continue
    }

    onPhase?.('match', { kind, total: items.length })
    // 匹配本身已经在 onBatch 的消费队列里做了，这里不再重复跑一遍
    // buildBucketWorks —— 那会把每一部片查两次 TMDB。
    // 扫描返回的 items 只用来报「本次一共要处理多少」。
    // 注意：onBatch 入队是同步的、消费是异步的，此处队列里可能还有
    // 未处理完的批次，故 runMap 此刻未必包含本 kind 的全部结果。
  }

  // 等消费队列把最后几批处理完，再决定怎么收尾。
  // 必须 await：扫描可能在队列还没排空时就已经返回了（onBatch 不等消费）。
  await consuming

  // 本轮刮到的全部 works（按 workKey 折叠过，跨批同名作品已合并 seasons）
  const runWorks = Array.from(runMap.values())

  // ── 局部清理：剧目录里的分集被散成电影卡 ──
  //
  // 放在所有提前返回**之前**，因为它不依赖本轮匹配成败：
  // 判据是「本轮扫描确认 D 是剧集目录」（scannedShowDirs）+「库里某张电影卡
  // 的全部版本都在 D 下且文件名都是分集形态」。
  //
  // 之所以必须放在这里：`runWorks.length === 0`（整批被 selectPersistable
  // 拦下）和 `prune`（要求零跳过目录，真实网盘几乎不满足）都会让
  // mergeWorks 里的清理失效，而脏卡是上一轮增量 upsert 写进去的、不会自己消失。
  const splitIds = findEpisodeSplitIds(baseline, scannedShowDirs)
  // 清理后的基线。后续 mergeWorks 必须拿它当旧库：否则 mergeWorks 会把
  // 刚清掉的脏卡当「旧库条目」重新加回结果里（它从 oldWorks 建 map）。
  let baselineAfterClean = baseline
  if (splitIds.size) {
    const kept = baseline.filter(w => !splitIds.has(workId(w)))
    baselineAfterClean = kept
    const dropped = baseline.filter(w => splitIds.has(workId(w)))
    console.warn('[scrape][diag] 局部清理分集电影卡', {
      showDirs: scannedShowDirs.size,
      dropped: splitIds.size,
      sample: dropped.slice(0, 5).map(w => w.title),
    })
    const result = writeBucket(kept, { flushNow: true })
    // writeBucket 在「未到保底时间」时返回 undefined，此时 await 是空操作；
    // 显式 await 保证真落盘时不会与后面的 mergeWorks 竞争写。
    if (result) await result
  } else {
    console.warn('[scrape][diag] 局部清理: 未发现分集电影卡', {
      showDirs: scannedShowDirs.size,
      baseline: baseline.length,
    })
  }

  // ── 诊断日志（临时）──
  // 直接回答「到底走了哪条分支、清理有没有机会执行」。
  console.warn('[scrape][diag] before-merge', {
    runWorks: runWorks.length,
    runShows: runWorks.filter(w => w.mediaType === 'tv').length,
    baseline: baseline.length,
    baselineMatched,
    scanFailures,
    batchFailures,
    skipped: stats.skipped || 0,
    failed: stats.failed || 0,
    cancelled: !!signal?.cancelled,
    snapshotWritten,
  })

  // 故障保护判据：旧库有匹配、本轮一条都没匹配上 → TMDB 疑似不可用。
  // 与 mergeWorks 内部那条判据一致，但这里显式算出来，避免靠返回值
  // 引用相等去猜（那样既脆弱又要把 mergeWorks 跑两遍）。
  const tmdbDown = baselineMatched > 0 && runWorks.length > 0
    && runWorks.every(w => !w.tmdbId)

  // 全部扫描都失败 → 抛出真实原因。
  // 不落库：此时库里是空的，覆盖写会把用户已有的海报墙清掉。
  // 判据从「allWorks 为空」换成「本轮一条都没刮到」，否则增量写过的
  // 半截数据会绕过这条保护。
  if (stats.failed > 0 && !runWorks.length && !snapshotWritten) {
    const first = stats.errors[0]
    const err = new Error(first?.message || `${source.type} 扫描失败`)
    err.isAuthError = !!first?.isAuthError
    err.isConnectError = !!first?.isConnectError
    err.scanErrors = stats.errors
    throw err
  }

  if (tmdbDown) {
    console.warn('[scrape][diag] 分支: tmdbDown=true，保留旧库不清理')
    // 已经增量写进去的整库降级必须撤回，否则用户的海报墙被清空成「未识别」
    writeBucket(cloneWorks(baseline), { flushNow: true })
    await storeFlush()
    onPhase?.('error', { message: 'TMDB 不可用', isTmdbDown: true })
    return { ...stats, tmdbDown: true }
  }

  if (signal?.cancelled) {
    console.warn('[scrape][diag] 分支: cancelled=true，跳过最终合并')
    // 取消语义：保留已刮到的（用户已确认）。已写过的批次就地落盘后返回。
    // **不做最终全量 merge** —— 它会按「本轮的 versionKey 集合」摘掉旧版本，
    // 而取消时本轮只是部分扫描，尚未扫到的目录会被当成已消失而删掉。
    if (snapshotWritten) await storeFlush()
    return { ...stats, cancelled: true, partial: true }
  }

  if (!runWorks.length) {
    console.warn('[scrape][diag] 分支: runWorks=0，跳过最终合并与清理',
      { failed: stats.failed, skipped: stats.skipped, snapshotWritten })
    // 一条都没刮到：库保持原样（可能是空目录，也可能全被跳过）
    onPhase?.('done', stats)
    return stats
  }

  // ── 能不能删掉「本轮没扫到」的旧条目 ──
  //
  // 只有当本轮是**一次完整、可信的全量扫描**时才允许删：
  //   有根目录扫失败 / 有子树被跳过 / 有批次异常 / 被取消 / TMDB 整体不可用
  //   —— 任何一条成立，都可能只是「这次没扫到」而不是「文件真删了」。
  // 宁可留着幽灵条目（点进去播放失败，用户能自己发现并重刮），
  // 也不能因为一次挂载失效把整月的片清空。
  //
  // runWorks.length > 0 这条同样刻意保守：真把导入目录清空了本轮会 0 条，
  // 此时不动库。要支持「清空」应该走「移除导入目录」的入口，不靠刮削推断。
  const pruneEligible =
    !signal?.cancelled &&
    scanFailures === 0 &&
    batchFailures === 0 &&
    (stats.skipped || 0) === 0 &&
    !tmdbDown &&
    runWorks.length > 0

  // 最终全量合并：清理本轮确实已消失的旧条目。
  // 基准必须是**扫描前的快照**：刮削中库已被增量写入，拿当前桶内容
  // 当旧库会让「本轮消失的条目」判断失效。
  // 故障保护已在上面显式判过并提前返回。
  const finalWorks = mergeWorks(baselineAfterClean, runWorks, {
    guard: false,
    prune: pruneEligible,
    roots: scannedRootPaths,
  })
  saveBucket({ type: source.type, accountName: source.name, works: finalWorks })

  // 本次被清掉的条目数。UI 要告诉用户，静默删片比留幽灵条目更让人困惑。
  // 注意：这些条目的 versionKey 从库里消失后，syncHistoryPlay 会把
  // 对应的播放历史一并过滤掉 —— 片没了历史也没意义，属预期行为。
  const finalKeys = new Set(finalWorks.map(workId))
  stats.removed = baseline.filter(w => !finalKeys.has(workId(w))).length

  await storeFlush()

  onPhase?.('done', stats)
  return stats
}

/**
 * 合并已有 works 与新扫描结果。
 * 新结果里的 work 覆盖元数据，已有版本保留（用户可能暂时看不到某个目录）。
 *
 * @param {Array} oldWorks 基线（本轮开始前的桶内容）
 * @param {Array} newWorks 本轮已刮到的全部 works
 * @param {object} [opts]
 * @param {boolean} [opts.guard=true] 是否启用 TMDB 故障保护。
 *        流式刮削的**每一批**都要用它来合并到库里，但此时 newWorks 只是
 *        「到目前为止扫到的」——第一批全都没匹配上完全可能是正常情况
 *        （比如前 20 部恰好都是片名解析不出的垃圾文件）。此时若触发保护，
 *        会把基线整库回滚掉、后面再写回来，白白抖动。
 *        所以增量阶段传 false，只在最终全量合并时用默认的 true。
 * @param {boolean} [opts.prune=false] 是否删除「落在扫描范围内、本轮却没扫到」的旧版本。
 *        代表「文件已从网盘删除」。**只有调用方能保证本轮是完整扫描时才传 true**。
 * @param {string[]} [opts.roots=[]] 本轮扫描的根路径，`prune` 的范围边界。
 */
const mergeWorks = (oldWorks, newWorks, { guard = true, prune = false, roots = [] } = {}) => {
  // TMDB 整体不可用时的保护。
  //
  // 新结果把某个 Work 判成未识别（tmdbId=null）会让它的 workKey 从
  // `tmdb:` 变成 `slug:`，旧 Work 的版本被摘空后删除——这是正确的清理逻辑，
  // 但 TMDB 429/断网/Key 失效时**所有**条目都会匹配失败，一次刷新就能把
  // 整库从电影/电视剧分区降级成「未识别」，海报全丢。
  //
  // 判据：旧库本来有匹配成功的作品，而新结果一条都没匹配上 → 说明是
  // TMDB 侧故障，不是真的都识别不了。此时保留旧库不动。
  const oldMatched = oldWorks.filter(w => w.tmdbId).length
  const newMatched = newWorks.filter(w => w.tmdbId).length
  if (guard && oldMatched > 0 && newMatched === 0) {
    console.warn(
      '[scrape] 本轮 TMDB 全部匹配失败（旧库有 %d 条已匹配），疑似 TMDB 不可用，保留旧库不覆盖',
      oldMatched,
    )
    return oldWorks
  }

  // ── 跨类型碰撞裁决 ──
  //
  // 增量阶段 upsertWorks 已经裁决过，但最终全量合并是另一条路径，
  // 且可能跨批拼出碰撞（旧库里的纠正条目 + 本轮新刮到的原生条目）。
  // 裁决必须在 map 构建**之前**：一旦两条同 workId 被塞进 map，后到的
  // 只会覆盖/合并先到的，畸形 Work 就此固化，再无机会拆开。
  //
  // 碰撞可能跨侧：旧库里是一条纠正条目，本轮刮到的是它的原生命中。
  // 必须把两侧合起来找碰撞，再各自降级 —— 分开找会两边都看不见对方。
  const collisions = findTypeCollisionIds([...oldWorks, ...newWorks])

  // 历史脏数据兜底：本轮产出了剧集卡的目录，库里那些「分集形态」的电影卡
  // 是旧链路把分集散成电影的产物，直接丢掉。
  //
  // 注意：主清理已前移到 scrapeSource 的「局部清理」段（基于扫描结果，
  // 不受 runWorks 过滤影响）。这里保留一份是基于本轮 works 的补充，
  // 覆盖「扫描结果里没有 isSeasonDir，但匹配后产出了 tv work」的情况。
  const splitIds = findEpisodeSplitIds(
    oldWorks,
    newWorks.filter(w => w.mediaType === 'tv').flatMap(w => (w.versions || []).flatMap(v => [
      v?.ref?.path,
      ...(v?.seasons || []).map(s => s?.ref?.path),
    ])).filter(Boolean),
  )

  const map = new Map()
  demoteCollided(oldWorks, collisions)
    .forEach(w => {
      const k = `${w.workKey}::${w.mediaType}`
      if (splitIds.has(k)) return
      map.set(k, { ...w, versions: [...w.versions] })
    })

  // 新结果里出现的 versionKey 集合：同一份文件的新结论要覆盖旧的
  const freshVersionKeys = new Set()
  newWorks.forEach(w => (w.versions || []).forEach(v => freshVersionKeys.add(v.versionKey)))

  // 旧 Work 里的版本，两种情况从旧 Work 上摘掉：
  //   1. 这一轮重新扫到了（新结论由后面的 newWorks 覆盖）
  //   2. prune 开启且该版本路径落在扫描范围内，但本轮没有对应的新版本
  //      → 文件已从网盘删除
  //
  // 注意 versionKey 是 `bucketKey::versionPath`（只由路径决定，与 TMDB
  // 身份无关），所以匹配抖动不会让条目误进第 2 条 —— 只要文件还在，
  // 它的 versionKey 必然出现在 freshVersionKeys 里。
  map.forEach((oldWork, k) => {
    let prunedByScope = false
    oldWork.versions = oldWork.versions.filter(v => {
      if (freshVersionKeys.has(v.versionKey)) return false
      if (prune && inScanScope(v.ref?.path, roots)) {
        prunedByScope = true
        return false
      }
      return true
    })
    if (oldWork.versions.length) return
    // 版本被摘空的旧 Work 直接移除，避免留下只有元数据没有文件的空壳。
    //
    // 因「本轮扫到过」摘空时，**手动匹配过的要保留**：它的 workKey 是用户
    // 选中的 TMDB 身份，与新扫描生成的 key 不同，一并删掉会把用户手动修好
    // 的匹配冲掉。
    // 但若是因为「范围内没扫到」（文件确实没了），用户已确认手动匹配的也
    // 一并删 —— 身份本身没有意义了。
    if (prunedByScope || !oldWork.manualMatched) map.delete(k)
  })

  demoteCollided(newWorks, collisions).forEach(w => {
    const k = `${w.workKey}::${w.mediaType}`
    const existed = map.get(k)
    if (!existed) {
      // 必须克隆：流式刮削时 mergeWorks 每批都要跑，w 是 accumulated 里的
      // 对象，下面 Object.assign 会原地改写它，连带污染后续批次的合并。
      map.set(k, { ...w, versions: [...(w.versions || [])] })
      return
    }
    // 元数据整体以最新一轮为准（字段表见 library/merge.js 的 applyWorkMeta，
    // 与增量 upsert 共用同一份规则），**不做 `||` 兜底**。
    applyWorkMeta(existed, w)
    // 版本去重合并。**必须合并 seasons**：剧集的 versionKey 落在「剧目录」
    // 层级（model.js 的 toVersion），同一部剧的多季共用同一个 versionKey，
    // 季的差异体现在 seasons 里。早期这里只做「不存在才 push」——
    // 单轮刮削时不会有重复，但流式刮削会把不同批次的同一部剧重复传进来，
    // 第二个版本的 seasons 会被整块丢掉（表现为「第二季消失了」）。
    mergeVersionsInto(existed, w.versions)
  })

  return Array.from(map.values())
}
