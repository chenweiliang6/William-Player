/**
 * 统一目录扫描。
 *
 * 取代旧 scrape.js 里 5 份复制粘贴的 recursionMovie / recursionTv：
 *   旧：WebDAV / 天翼 / 夸克 / 联通 / 移动 各写一份，字段名各不相同
 *   中：一个 walkTv + 一个 walkMovie，靠调用方传入的 kind 决定走哪条
 *   新：一个 walkNode，靠目录内容自己判定（见 scan/shape.js），
 *       不再要求用户事先声明「这是电影目录 / 电视剧目录」
 *
 * 输出是「原始媒体项」的扁平列表，交由 library/model.js 聚合。
 * 每个条目自带 mediaType 初判（movie/tv），最终类型以 TMDB 匹配结果为准。
 */
import { listSourceFolder } from '@/utils/sources/registry'
import { SCRAPE_UNBOUNDED_TIMEOUT } from '../constants'
import { resolveRules } from '../rules/resolver'
import { isVideoFile } from '../parse/video-ext'
import { extractSeason } from '../parse/season'
import { parseFilename, isMeaninglessTitle } from '../parse/filename'
import { classifyShape, extractShowTitle, isGenericDirName, isNonMediaAncestor, hasExplicitEpisode, looksLikeEpisodeFile, CONFIDENCE } from './shape'

// 安全上限：防止异常目录结构导致无限递归
const MAX_DEPTH = 8

/**
 * 并发闸门：限制同时执行的异步任务数。
 *
 * **只包住网络请求本身，不包住递归**——拿到结果立刻释放槽位再下钻，
 * 否则「父目录占着槽位等子目录」把自己锁死。
 *
 * `limit <= 0` 或非法值时不在 JS 侧排队（语义上「不人为设限」）。
 * 真正的连接数由底层约束：H5 同源约 6 条、Android OkHttp 默认每 host 5 条、
 * iOS NSURLSession 同理。也就是说「无上限」实际是「排进原生层队列」，
 * 而不是真的会同时开几千个 socket。
 *
 * @param {number} limit 并发上限，0 表示无上限
 * @returns {{run: Function, limit: number}}
 */
export const createGate = limit => {
  const width = Number(limit)
  if (!Number.isFinite(width) || width <= 0) {
    return { limit: 0, run: fn => fn() }
  }

  let active = 0
  const queue = []
  // 用游标而不是 shift()：队列可能很长（宽目录树），shift 是 O(n)，
  // 每个任务都 shift 一次会让限流模式退化成 O(n²)。
  let head = 0

  const drain = () => {
    while (active < width && head < queue.length) {
      const job = queue[head++]
      active++
      // 用 Promise.resolve().then 包一层，让 fn 的同步抛错也走 reject 分支
      Promise.resolve()
        .then(job.fn)
        .then(job.resolve, job.reject)
        .finally(() => {
          active--
          drain()
        })
    }
    // 已消费的头部定期回收，避免数组随扫描进度无限增长。
    // 放在循环外，不在出队过程中改动 head/queue 的关系。
    if (head > 256 && head * 2 > queue.length) {
      queue.splice(0, head)
      head = 0
    }
  }

  return {
    limit: width,
    run: fn =>
      new Promise((resolve, reject) => {
        queue.push({ fn, resolve, reject })
        drain()
      }),
  }
}

// 分批交付的条数阈值。与 TMDB 匹配的内置并发默认值取同一个数量级，
// 一批大约对应几个并发波次。
const BATCH_SIZE = 60
// 目录特别碎时（每层只有一两部片）按条数永远攒不满，靠时间兜底。
// 没有这一条时，深目录树会等到整棵扫完才交付第一批，等于没做流式。
const FLUSH_INTERVAL_MS = 1500

/**
 * 是否被路径黑名单命中
 */
export const isBlacklisted = path => {
  if (!path) return false
  const rules = resolveRules()
  return rules.pathBlacklist.some(re => {
    // 正则可能带 g 标志，test 会受 lastIndex 影响，重置一下
    re.lastIndex = 0
    return re.test(path)
  })
}

/**
 * 拼接路径，避免出现 // 或首尾斜杠不一致
 */
export const joinPath = (parent, name) => {
  const p = String(parent || '').replace(/\/+$/, '')
  const n = String(name || '').replace(/^\/+/, '')
  return (p || '') + '/' + n
}

const basename = path => String(path || '').split('/').filter(Boolean).pop() || ''

/**
 * 体积过小 → 视为样片/碎片，不参与刮削。
 * 来源未返回大小（size 为 0/undefined）时放行，宁可留也不要误杀。
 */
const isTooSmall = item => {
  const min = resolveRules().minVideoSize
  if (!min || min <= 0) return false
  const size = Number(item?.size) || 0
  return size > 0 && size < min
}

/**
 * 在「目录名」和「本层文件名」之间挑一个更可信的剧名。
 *
 * 名称较长的那个通常是真正的剧名：
 *   单剧根/漫长的季节.S01E01.mkv   → 文件名里的「漫长的季节」更准
 *   庆余年/庆余年.S01E01.mkv        → 两者相同
 *   某剧/第01集.mkv                → 文件名解析不出剧名，用目录名
 */
const pickShowTitle = (dirName, videos) => {
  const fromDir = extractShowTitle(dirName) || dirName

  // 不能只看 videos[0]。
  //
  // 旧实现拿第一个文件的解析结果定剧名，第一项若是花絮/片头/`01 4K.mp4`
  // 这类不带集号的文件，就会白白丢掉文件名里最可靠的剧名。
  // 现在扫一遍全部文件，只采信「带集号且解析出片名」的结论；
  // 若多个文件给出**不同**片名，说明这层不是单一剧集，交回目录名。
  const fileTitles = new Set()
  for (const v of videos) {
    const p = parseFilename(v.name)
    if (p.title && p.episode != null) fileTitles.add(p.title)
  }

  // **目录名优先**。目录名是这部剧的名字，文件名只是单集的命名，
  // 常把中英文名、副标题、发布组全塞进去：
  //   孤单又灿烂的神：鬼怪/孤单又灿烂的神：鬼怪.Guardian...E01...mkv
  // 用文件名会得到「孤单又灿烂的神：鬼怪 Guardian The Lonely and Great God」，
  // 中英混排后在 TMDB 里搜不到。
  //
  // 唯一例外是目录名完全无意义（`2019`、`New Folder`、承载层名），
  // 这时才退回文件名的片名。
  if (fromDir && !isMeaninglessTitle(fromDir) && !isGenericDirName(fromDir)) return fromDir
  if (fileTitles.size === 1) return [...fileTitles][0]
  if (fromDir) return fromDir
  // 没有可信文件片名且目录名也空：退回第一个解析出的片名（可能为空）
  return videos.length ? (parseFilename(videos[0].name).title || '') : ''
}

/**
 * 判断一个视频文件是否属于本层的这部剧。
 *
 * 用于「判成剧集后，把不属于这部剧的文件补成独立影片」。
 *
 * **默认归属，例外才拆出**。
 *
 * 早期判据要求「片名归一化后严格相等」才认，方向是反的：实盘里目录名
 * 与文件名几乎永远对不上，于是整季分集被全部拆成独立影片。实测数据：
 *   知否知否应是绿肥红瘦 / The.Story.of.Ming.Lan.S01E01…  → 78 条
 *   孤舟 / 孤舟.Gu.Zhou.2024…S01E01.mkv                  → 32 条
 *   宝物岛 / 01.mp4                                       → 18 条
 * 44 个已识别剧集里 18 个目录同时挂着剧集卡和几十张分集卡，共 356 条脏数据。
 *
 * 新判据——命中任一即算属于本剧：
 *   1. 文件名带显式集号（SxxExx / 第N集 / 两位以上 E10），或就是一个
 *      分集编号（01.mp4 / 02.mkv / 01 4K.mp4）
 *      剧目录里这种文件不可能是另一部作品，不必再看片名
 *   2. 解析出的作品名与本剧名归一化后一致（庆余年/庆余年.S01E01.mkv）
 *   3. 片名与本剧名互为子串（`孤单又灿烂的神：鬼怪 Guardian…` 这类
 *      中文剧名拖英文/拼音的写法）
 *   4. 解析不出作品名（纯编号，如「第01集.mkv」）
 *
 * 四条都不命中才判「不属于」——那种情况是「有片名、片名不同、无集号、
 * 也不是编号」，同目录下混进来的另一部影片。
 *
 * 注意多版本场景（`沙丘2.2160p + 沙丘2.1080p`）走不到这里：
 * classifyShape 判的是 files，根本不进 show 分支。
 *
 * @param {object} video 视频文件项 { name }
 * @param {string} showTitle 本层剧名（可能为空）
 */
const belongsToShow = (video, showTitle) => {
  const name = String(video?.name || '')
  const parsed = parseFilename(name)
  const fileTitle = parsed.title || ''

  // 1. 显式集号 / 纯编号（01.mp4 / 01 4K.mp4）：不必看片名。
  if (looksLikeEpisodeFile(name)) return true

  // 3. 片名归一化后一致。没有剧名可对时这条自然不成立。
  //
  // 归一化：去分隔符 + 去括号 + 去年份。
  //
  // 括号必须去掉。`extractShowTitle('北上（2025）')` 得到 `北上`，
  // 但文件名侧的片名也可能带括号（`北上 (2025)`），两者不能靠字符串
  // 精确相等来判定「属于本剧」——差一个全角括号就会把整季拆成独立电影。
  const norm = s => String(s || '')
    .replace(/[（(][^（()）]{0,40}[)）]/g, '')
    .replace(/[【\[][^【\[\]】]{0,60}[】\]]/g, '')
    .replace(/[\s._\-:：·・]+/g, '')
    .replace(/\b(?:19|20)\d{2}\b/g, '')
    .toLowerCase()
  const sameTitle = !!(fileTitle && showTitle && norm(fileTitle) === norm(showTitle))
  if (sameTitle) return true

  // 4. 包含关系：解析出的作品名与本剧名互为子串。
  //
  // 中文剧名常在文件名里拖一串英文/拼音（`孤单又灿烂的神：鬼怪 Guardian…`、
  // `孤舟 Gu Zhou`、`藏海花 Tibetan Sea Flowe`），严格相等永远不成立。
  // 这类「剧名是文件片名的前缀」是同一部作品的强证据。
  //
  // 只在**本层已判成剧集**之后才走这条，所以不会把「/电影/ 里的 Another.Movie」
  // 误吞成剧集——那种层的 classifyShape 根本不判 show。长度 ≥2 是为了
  // 挡住单字噪声。
  if (fileTitle && showTitle) {
    const a = norm(fileTitle)
    const b = norm(showTitle)
    if (a.length >= 2 && b.length >= 2 && (a.includes(b) || b.includes(a))) return true
  }

  // 5. 解析不出作品名：纯编号/集号名，归本剧。
  return !fileTitle
}

/**
 * 递归遍历一个目录，自动判定剧集 / 影片。
 *
 * @param {object} opts
 * @param {string} opts.type        源 type
 * @param {string} opts.accountName 账号名
 * @param {string} opts.provider    文件级 provider
 * @param {object} opts.cred        该来源的凭据条目
 * @param {object} opts.ref         起始位置 { path } 或 { folderId }
 * @param {boolean} [opts.isTv]     兼容旧调用：强制整棵树按剧集扫描（不传则自动判定）
 * @param {Function} [opts.onProgress] 进度回调 ({ found })
 * @param {Function} [opts.onBatch]  增量交付回调，收到本批新产出的条目（不含此前已交付的）。
 *        不传时行为与旧版完全一致：只在返回时一次性给出全部 items。
 * @param {object} [opts.signal]    { cancelled } 取消标记
 * @param {object} [opts.gate]      并发闸门（见 createGate）。多根目录扫描时由
 *        scanSource 传入以共享同一个上限；不传则按配置自建。
 * @returns {Promise<{items: Array, folders: Array, cancelled: boolean, skipped: Array}>}
 */
export const scanFolderTree = async opts => {
  const {
    type, accountName, provider, cred, ref,
    isTv, onProgress, onBatch, signal, gate,
  } = opts

  const items = []
  const folders = []
  // 被跳过的目录（挂载失效/无权限/超时）。跳过的粒度为「该目录及其整棵子树」。
  const skipped = []
  let cancelled = false

  // 闸门只约束网络请求。0 = 无上限时退化为直通。
  const gateRef = gate || createGate(resolveRules().scanConcurrency)

  // 致命错误（鉴权失效 / 扫描根失败）。并发下这个错误只会 reject 自己那一支，
  // 其余分支靠 shouldStop() 看到它之后自行退出，最后统一在出口抛出。
  let fatalError = null

  // 已交付给 onBatch 的条目数。items 只增不减，所以用下标即可。
  let delivered = 0
  let lastFlushAt = Date.now()

  /**
   * 把尚未交付的条目交给 onBatch。
   *
   * 必须**同步**调用、不 await —— 扫描不能等匹配，否则整条链路退化成串行。
   *
   * 并发下钻后，**不再保证同一部剧的季落在同一批**：几个剧目录可能同时
   * 往 items 里 push，批次边界落在哪一条不确定。这不影响数据正确性——
   * 编排层的 foldRunWorks / mergeVersionsInto 会按 workKey 合并 seasons，
   * 而 scanSource 早就写明「批与批之间没有跨目录的顺序保证」。
   *
   * @param {boolean} [force] true 时忽略阈值立刻交付（用于一致的边界）
   */
  const flushBatch = (force = false) => {
    if (!onBatch) return
    const pending = items.length - delivered
    if (!pending) return
    if (!force && pending < BATCH_SIZE && Date.now() - lastFlushAt < FLUSH_INTERVAL_MS) return
    onBatch(items.slice(delivered))
    delivered = items.length
    lastFlushAt = Date.now()
  }

  const shouldStop = () => {
    if (fatalError) return true
    if (signal?.cancelled) {
      cancelled = true
      return true
    }
    return false
  }

  /**
   * 安全列目录：失败时决定「跳过当前子树」还是「终止整棵树」。
   *
   * 判据只看「深度」和「鉴权类型」，不看具体错误码，原因见下：
   *   1. 鉴权/会话失效（401 / tokenExpired）是全局问题，任何深度都要终止。
   *      prepareSource 刚重登过，此刻再 401 说明密码被改/用户被禁用，
   *      跳过只会让整库静默变空。
   *   2. 扫描根（depth 0）失败保留原行为——抛出去，交给 source.js 的
   *      Promise.allSettled 汇总成「根目录部分失败」，其余根目录照常扫。
   *      这同时是「服务整体不可达」的探测点：网络全断时根目录必失败。
   *   3. depth > 0 的失败是这个目录/挂载点自身的问题（Alist 返回
   *      code 500 的 failed get objs / failed get storage、连接被拒、
   *      403 的独立密码目录），跳过整棵子树继续兄弟。
   *
   * 注意：刮削阶段请求不设超时（见下方 listSafe 内的说明），因此
   * **不存在 request:fail timeout 这类失败**。代价是「服务端 hang 住但
   * 连接不断」的目录会一直 await —— 没有看门狗兜底，只能由用户点取消。
   * 这是刻意的取舍：超时会静默少刮一批片子，挂起至少能被用户看见。
   *
   * @returns {Promise<Array|null>} 列表；null 表示本目录及子树已被跳过
   */
  const listSafe = async (currentRef, currentPath, depth) => {
    try {
      // 闸门只包这一次请求：拿到列表立刻释放槽位，后面的递归不占位，
      // 否则父目录持锁等子目录会死锁。
      // 刮削阶段不设请求超时：慢速网盘 / 挂载抖动时超时会被当成「目录不可访问」，
      // 整棵子树静默跳过，比慢更糟。取舍见 constants.js 的 SCRAPE_UNBOUNDED_TIMEOUT。
      const { list } = await gateRef.run(() =>
        listSourceFolder(type, currentRef, cred, { timeout: SCRAPE_UNBOUNDED_TIMEOUT }),
      )
      return list || []
    } catch (e) {
      const authError = e?.tokenExpired || Number(e?.code) === 401
      if (authError || depth === 0) {
        // 致命：先记下来再抛。并发下这个 throw 只能 reject 自己这一支，
        // 其余分支靠 shouldStop() 看到 fatalError 后自行退出。
        if (!fatalError) fatalError = e
        throw e
      }
      const message = e?.message || e?.errMsg || String(e)
      skipped.push({
        path: currentPath || currentRef?.path || '',
        message,
        code: e?.code,
      })
      console.warn('[scrape/scan] 目录跳过:', type, currentPath, message)
      return null
    }
  }

  /**
   * 产出一个「剧」条目。
   * @param {object} p
   * @param {string} p.title      剧名
   * @param {string} p.showPath   剧目录
   * @param {string|null} p.season 季号
   * @param {string} p.seasonPath 季目录（剧目录本身即为季时为同一路径）
   * @param {object} p.folderId   该目录的文件 id（非 path 导航的源需要）
   * @param {object} [p.sample]   样本文件（取大小/时间/缩略图）
   */
  const emitShow = ({ title, showPath, season, seasonPath, folderId, sample, confidence, nonMedia }) => {
    // 课程/教程目录下不产出剧集。
    //
    // 这里的视频是课程，不是影视作品；拿目录名去搜 TMDB 会刮出 documentary
    // 「MS」(649811) 这类脏卡。挡在 emitShow 内部而不是只在 classifyShape，
    // 是因为季目录分支（walkChild）也会直接 emitShow，绕过了形态判定。
    //
    // 文件本身仍会由 files 分支逐个产出（带 nonMedia 标记，匹配层直接归未识别），
    // 所以「其他」分区里照样能播放。
    if (nonMedia) return

    // 去重按「剧名 + 季号」，不能只看 seasonPath。
    //
    // 季目录里再套一层分集容器时（某剧/第一季/分集视频/）会产出两条
    // 同名同季的剧集，seasonPath 却不同。按路径去重挡不住，
    // 结果是海报墙上同一部剧出现两次。
    const seasonStr = String(season ?? '1')
    if (items.some(i => i.isSeasonDir && i.name === title && i.season === seasonStr)) return
    if (items.some(i => i.seasonPath === seasonPath)) return
    items.push({
      name: title,
      path: seasonPath,
      fileId: folderId || null,
      folderFileId: folderId || null,
      parentPath: showPath,
      type, accountName, provider,
      // mediaType 是初判，最终以 TMDB 匹配结果为准
      mediaType: 'tv',
      season: seasonStr,
      seasonPath,
      isSeasonDir: true,
      confidence: confidence || CONFIDENCE.HIGH,
      // 祖先链里含课程/教程目录 → 匹配阶段不查 TMDB，直接归未识别
      nonMedia: !!nonMedia,
      size: sample?.size || 0,
      createTime: sample?.createTime || '',
      updateTime: sample?.updateTime || '',
      thumb: sample?.thumb || '',
    })
    onProgress?.({ found: items.length })
  }

  /** 产出一个「影片」条目（电影/单集/合集里的一个视频文件） */
  const emitFile = (videoItem, path, confidence, nonMedia) => {
    items.push({
      name: videoItem.name,
      path,
      fileId: videoItem.id,
      folderFileId: videoItem.id,
      parentPath: path.split('/').slice(0, -1).join('/') || '/',
      type, accountName, provider,
      mediaType: 'movie',
      season: null,
      seasonPath: null,
      isSeasonDir: false,
      confidence: confidence || CONFIDENCE.MEDIUM,
      // 祖先链里含课程/教程目录 → 匹配阶段不查 TMDB，直接归未识别
      nonMedia: !!nonMedia,
      size: videoItem.size || 0,
      createTime: videoItem.createTime || '',
      updateTime: videoItem.updateTime || '',
      thumb: videoItem.thumb || '',
    })
    onProgress?.({ found: items.length })
  }

  /**
   * 统一递归。
   *
   * 每层做两件事：
   *   1. 判定本层形态（剧目录 / 一堆独立影片 / 只有子目录）
   *   2. 按形态产出条目，然后下钻所有非季子目录
   *
   * 语义细节（沿用旧 walkTv，避免回归）：
   *   - depth === 0 是用户配置的扫描根，不产条目。
   *     根层名字常是「电视剧」「夸克网盘」这类承载层级，直接产出会得到假剧。
   *   - 本层既有散集又有季子目录时，以季子目录为准，散集不单独产出。
   *   - 季目录名自带季号时用季目录名推剧名（电视剧/庆余年.第二季.2019/）。
   */
  const walkNode = async (currentRef, currentPath, depth, ctx = {}) => {
    if (depth > MAX_DEPTH || shouldStop()) return
    const list = await listSafe(currentRef, currentPath, depth)
    // null：该目录列举失败，已记入 skipped，整棵子树跳过
    if (list == null) return
    if (!list.length) return

    const selfName = basename(currentPath)
    const subFolders = []
    const videos = []

    // 祖先（含本层，也含 depth 0 的导入根）是否落在课程/教程目录下。
    //
    // 必须在扫描期算出来：item 只有 parentPath（直接父目录），匹配层拿不到
    // 完整祖先链；而导入根之上的路径不属于用户交给刮削的范围，不能算进去
    // （`/影视资料/…` 若把 `资料` 当课程词，会把整库清空）。
    const selfNonMedia = ctx.nonMedia || isNonMediaAncestor(selfName)

    for (const item of list) {
      const childPath = joinPath(currentPath, item.name)
      if (isBlacklisted(childPath)) continue
      if (item.isFolder) {
        subFolders.push(item)
      } else if (isVideoFile(item.name) && !isTooSmall(item)) {
        videos.push(item)
      }
    }

    // 兼容旧调用：外部强制按剧集扫描时，跳过内容判定
    const judged = isTv === true
      ? { shape: videos.length || subFolders.some(f => extractSeason(f.name) != null) ? 'show' : 'descend', confidence: CONFIDENCE.HIGH }
      : isTv === false
        ? { shape: 'files', confidence: CONFIDENCE.HIGH }
        : classifyShape({ videos, folders: subFolders, dirName: selfName, nonMedia: selfNonMedia })

    const seasonSubdirs = subFolders.filter(f => extractSeason(f.name) != null)

    // 本层能否作为「一部剧的根」，取决于它的名字是不是承载层名，而不是深度。
    //   /电视剧/            → 名字是承载层，本层散集忽略，靠下面的季目录产出
    //   /单剧根/（扫描根）  → 名字就是剧名，应当产出一条
    const dirIsGeneric = isGenericDirName(selfName)

    if (judged.shape === 'show') {
      const ownSeason = extractSeason(selfName)
      // 分批修复 a：从季目录递归下来时，剧名和季号继承上层，
      // 不再根据「第01集」这类文件名重新推一个假剧名。
      //
      // ── 剧名的两个来源，以及「空串 vs 未继承」的区别 ──
      //
      // `ctx.showTitle` 有三种取值，语义各不相同：
      //   undefined  未进入季目录（本层自己判定剧名）
      //   非空串     上层已确定剧名，本层沿用
      //   空串       上层是承载层（`电视剧`/`影视`/`media`），拿不到剧名
      //
      // 空串**不能**当成「已继承」，否则下层再也取不回剧名：
      //   承载层/吴邪私家笔记 (2025)/Season 1/… - S01E01.mkv
      //   承载层/Season 1/楚乔传 - S01E01.mkv
      // 但空串**也不能**退化成「拿本层目录名兜底」，否则会编出假剧：
      //   承载层/Season 1/01.mp4 → 一部叫「Season 1」的剧
      //
      // 所以空串时只允许**从文件名**找剧名（`pickShowTitle('', videos)`），
      // 它的 fromDir 为空，只会采信「带集号且解析出片名」的文件。
      // `Season 1/01.mp4` 解析不出片名 → 返回空串 → 依旧不编假剧。
      const ownTitle = dirIsGeneric ? '' : (extractShowTitle(selfName) || selfName)
      const showTitle = ctx.showTitle !== undefined ? ctx.showTitle : ownTitle
      const finalShowTitle = ctx.showTitle
        ? ctx.showTitle
        : (showTitle
          ? (pickShowTitle(selfName, videos) || showTitle)
          : (videos.length ? pickShowTitle('', videos) : ''))

      // 剧名可信度校验。
      //
      // 剧名有两个来源：文件名（带 SxxEyy 且解析出真片名，最可靠）和目录名。
      // 只靠目录名时必须有「这确实是分集」的硬证据，否则会造出假剧集：
      //   /m/01.mkv 02.mkv 03.mkv
      //   文件名全解析不出片名 → 剧名回退成目录名「m」→ 产出「剧集 m」
      // 这种情况应当把三个文件都当作独立影片（进未识别），而不是编一部剧。
      //
      // 硬证据 = 至少一个文件带显式集号（第01集 / S01E01 / EP01），
      // 或者本层文件构成**连续编号序列**（01/02/03… / `01 4K` / `01 2160p`）。
      //
      // 「繁花/第01集.mkv」有证据，「/m/01.mkv 02.mkv 03.mkv」靠序列也算——
      // 三个连续编号的文件几乎不可能是三部独立影片，而旧判据把它归为「无证据」，
      // 结果九门那 30 个 `01 4K.mp4` 全被当成独立影片送去 TMDB 搜电影。
      // 真正要挡的是「编号不连续」（01/33/38 这类素材编号），
      // 这一点由 looksLikeEpisodeSequence 内部的跨度/差额检查保证。
      const hasEpisodeEvidence = videos.some(v => hasExplicitEpisode(v.name))
      const titleFromFile = videos.length > 0 && (() => {
        const p = parseFilename(videos[0].name)
        return !!p.title && p.episode != null
      })()
      const showTitleCredible = titleFromFile || hasEpisodeEvidence || judged.shape === 'show'

      if (videos.length && !seasonSubdirs.length && finalShowTitle && showTitleCredible) {
        emitShow({
          // 剧名的可信来源有两个：目录名，和本层文件名（含 SxxEyy 时最可靠）。
          // 取更长的那个——「单剧根/漫长的季节.S01E01.mkv」里，
          // 目录名是随手起的，真正的剧名在文件名里。
          title: finalShowTitle,
          showPath: currentPath,
          // 从季目录递归下来时，季号继承上层（ctx.season）；
          // 否则用本层的目录名或默认第 1 季
          season: ctx.season != null ? ctx.season : (ownSeason != null ? ownSeason : '1'),
          seasonPath: currentPath,
          folderId: currentRef.folderId,
          sample: videos[0],
          confidence: judged.confidence,
          nonMedia: selfNonMedia,
        })
      }

      // ★ 关键修复：判成剧集不等于「本层其余文件都不要了」。
      //
      // 早期实现在这里什么都不做，导致两类影片被静默丢弃：
      //   a) 拿不到剧名（目录名是「电影」「media」这类承载层）→ 整层 0 条产出
      //   b) 拿到了剧名 → 只产出一条剧集，本层其余视频全部消失
      //
      // 现在把「没有参与这部剧」的文件逐个按独立影片补出来。
      // 判定「参与」要严谨，否则一部剧的分集会散成几十部电影。
      if (!seasonSubdirs.length) {
        // 整层都是分集时不必逐个判定：一个剧目录里不可能同时装着另一部剧的分集。
        // 这条断言直接挡掉最脏的一类数据（知否 78 条、孤舟 32 条、宝物岛 18 条…）。
        const allEpisodes = videos.length > 0 && videos.every(v => looksLikeEpisodeFile(v.name))
        let emitted = 0
        if (!allEpisodes) {
          videos.forEach(v => {
            if (belongsToShow(v, finalShowTitle)) return
            emitFile(v, joinPath(currentPath, v.name), judged.confidence, selfNonMedia)
            emitted++
            // 补出来的这些文件各自是独立影片，与这部剧无关，
            // 在这里切批不会把一部剧拆散。
            flushBatch()
          })
        }
        // 诊断：判成剧集却仍补出影片的目录，是本轮要查的对象。
        // allEpisodes=true 时 emitted 必为 0；若 !=0 说明 belongsToShow 判错了。
        if (emitted > 0 || !allEpisodes) {
          console.warn('[scrape][diag] show-dir', {
            dir: currentPath,
            videos: videos.length,
            allEpisodes,
            showTitle: finalShowTitle,
            emittedFiles: emitted,
            sample: videos.slice(0, 2).map(v => v.name),
          })
        }
      }
    } else if (judged.shape === 'files') {
      // 本层是一堆独立影片（电影 / 合集 / 散片）。
      // 平铺几百部电影的目录里，这里就是切批主力：攒够一批就交出去，
      // 不必等整棵目录树扫完。
      // `files` 形态已保证本层没有季子目录（有季目录会被判成 show/descend），
      // 因此在这里切批不会把同一部剧的季拆到不同批。
      videos.forEach(v => {
        emitFile(v, joinPath(currentPath, v.name), judged.confidence, selfNonMedia)
        flushBatch()
      })
    }

    // 本层判定产出全部结束、进入子目录之前的统一交付点。
    // 覆盖 `show` 分支只产出一条 emitShow 的情况（此时上面两个 forEach 都没跑）。
    flushBatch()

    // 下钻所有非季子目录。
    // 季子目录在这里单独处理：它归属于「本层这部剧」，不再往里递归找剧。
    //
    // **并发下钻**：子目录之间没有依赖，可以同时展开。并发上限由 gateRef
    // 控制——只卡网络请求，不卡递归，所以不会出现「层数相乘」的请求爆炸。
    //
    // 这里用 allSettled 而不是 all：普通子目录失败已经被 listSafe 吃掉
    // （记入 skipped 返回 null），只有致命错误会 reject，而它只需让
    // fatalError 记录在案，不必中断其余分支——出口会统一抛出。
    //
    // walkChild 里 emitShow 发生在第一个 await 之前，同一层的季条目会
    // 先于任何子目录递归产出，顺序反而比串行版更稳定。
    const walkChild = folder => {
      if (shouldStop()) return Promise.resolve()
      const childPath = joinPath(currentPath, folder.name)
      folders.push({ path: childPath, ref: { path: childPath, folderId: folder.id }, name: folder.name })

      const season = extractSeason(folder.name)
      if (season != null && judged.shape === 'show') {
        // A. 本层有视频（本层就是剧目录），子目录是它的季
        //    → 剧名用本层名
        // B. 本层无视频（本层是承载目录），子目录名自带季号且本身就是一部剧
        //    → 用季目录名去季号得剧名
        // C. 本层无视频、子目录名只有季号（「第1季」「Season 1」），
        //    剧名只能来自上层；上层是承载层名时跳过，避免产出「电视剧」这种假剧
        let showTitle
        let showPath
        if (videos.length && !dirIsGeneric) {
          showTitle = extractShowTitle(selfName) || selfName
          showPath = currentPath
        } else {
          const fromDir = extractShowTitle(folder.name)
          if (fromDir && !isGenericDirName(fromDir)) {
            showTitle = fromDir
            showPath = childPath
          } else {
            showTitle = dirIsGeneric ? '' : (extractShowTitle(selfName) || selfName)
            showPath = currentPath
          }
        }
        // 已经处在某部剧的季目录里时（ctx.showTitle 有值），
        // 子目录只是分集容器（如「第一季/分集视频/第02集.mkv」），
        // 不能拿它的名字再推一部新剧，否则会多出一堆假剧集。
        // 这种情况沿用上层剧名，由下面的 walkNode 继承 ctx 处理。
        if (ctx.showTitle) {
          return walkNode(
            { path: childPath, folderId: folder.id },
            childPath,
            depth + 1,
            { showTitle: ctx.showTitle, season: ctx.season != null ? ctx.season : season, nonMedia: selfNonMedia },
          )
        }

        if (showTitle) {
          emitShow({
            title: showTitle,
            showPath,
            season,
            seasonPath: childPath,
            folderId: folder.id,
            sample: videos[0],
            confidence: judged.confidence,
            nonMedia: selfNonMedia,
          })
        }
        // ★ 修复：不再 `continue` 整棵跳过。
        //
        // 早期这里直接 continue，季目录下只要还有子层级
        // （Season 1/Extras/、S01/分集/、第1季/花絮/）就会整棵丢失。
        // 现在照常递归，把剧名/季号作为上下文传下去，
        // 让季目录内的文件仍归到这部剧，而不是各自成片。
        return walkNode(
          { path: childPath, folderId: folder.id },
          childPath,
          depth + 1,
          { showTitle, season, nonMedia: selfNonMedia },
        )
      }

      // 普通子目录：**必须继承 ctx**。
      // 漏传会让「某剧/第一季/分集视频/第02集.mkv」这类结构断链——
      // 「分集视频」拿不到剧名，会被当成一部新剧产出。
      // nonMedia 同理：`AI智能体教程合集/某课/第1章/…` 中间层不带关键词，
      // 靠继承才认得出整棵子树都在课程目录下。
      return walkNode({ path: childPath, folderId: folder.id }, childPath, depth + 1, { ...ctx, nonMedia: selfNonMedia })
    }

    // walkChild 是同步函数（内部返回 walkNode 的 promise），所以这里直接 map。
    // 但 walkChild 的同步段若抛错（未来解析逻辑的 bug），它会冒泡到 map 本身
    // 并让整棵 tree reject——那不是「目录扫描失败」的语义，需要单独兜住。
    let children = []
    try {
      children = subFolders.map(walkChild)
    } catch (e) {
      console.warn('[scrape/scan] 子目录展开异常:', type, currentPath, e)
      skipped.push({ path: currentPath, message: e?.message || String(e), code: e?.code })
    }

    // allSettled 收掉每条分支的 rejection：普通失败已在 listSafe 里转成 skipped
    // 并返回 null，走到这里的 rejection 基本只有致命错误（fatalError 已记录），
    // 或者是子树内的意外异常。两者都不该中断其它分支。
    const settled = await Promise.allSettled(children)
    settled.forEach((r, i) => {
      if (r.status !== 'rejected' || fatalError) return
      const folder = subFolders[i]
      const path = joinPath(currentPath, folder?.name || '')
      const e = r.reason
      skipped.push({ path, message: e?.message || String(e), code: e?.code })
      console.warn('[scrape/scan] 子树异常跳过:', type, path, e)
    })

    // 子目录全部展开后的兜底交付。
    // 各子树已各自交付过自己那部分，这里只处理
    // 「整棵子树遍历期间没有新产出」的空操作场景。
    flushBatch()
  }

  try {
    await walkNode(ref, ref.path || '', 0)
    // 并发下致命错误只 reject 了自己那一支，被 allSettled 收走，
    // 这里统一抛出，保持「鉴权失效/根目录失败会让整个根目录失败」的语义。
    if (fatalError) throw fatalError
  } catch (e) {
    // 抛错前把已经产出的条目交付掉：这些是真实扫到的，不该因为
    // 后续某个目录失败而一起丢掉（上层会把失败并进 partialFailures）。
    flushBatch(true)
    console.warn('[scrape/scan] 扫描失败:', type, ref, e)
    throw e
  }

  // 收尾兜底：忽略阈值，把最后不够一批的剩余条目交出去。
  flushBatch(true)

  // ── 诊断日志（临时，定位「剧集目录的分集仍被 emit 成影片」）──
  //
  // 关键指标是 leak：**同时产出剧集卡、又把同目录文件 emit 成影片**的数量。
  // 这个值应当恒为 0。若这里打印 0，而库里仍有对应条目，说明浏览器执行的
  // 不是这份代码（HMR 残留 / 未硬刷新），问题就与刮削逻辑无关了。
  try {
    const showDirs = new Set(
      items.filter(i => i.isSeasonDir).map(i => i.seasonPath).filter(Boolean),
    )
    const leaked = items.filter(i => !i.isSeasonDir &&
      showDirs.has(String(i.path || '').split('/').slice(0, -1).join('/')))
    console.warn('[scrape][diag] scan', {
      root: ref?.path || '(root)',
      items: items.length,
      shows: items.filter(i => i.isSeasonDir).length,
      files: items.filter(i => !i.isSeasonDir).length,
      leak: leaked.length,
      leakSample: leaked.slice(0, 3).map(i => i.path),
      skipped: skipped.length,
      cancelled,
    })
  } catch (e) {
    console.warn('[scrape][diag] 统计失败:', e)
  }

  return { items, folders, cancelled, skipped }
}
