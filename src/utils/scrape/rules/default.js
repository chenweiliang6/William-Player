/**
 * 内置默认解析规则。
 *
 * 设计参照网易爆米花服务端下发的 path_regex / public_webdav_blacklist 思路，
 * 但因为是纯客户端，规则内置进包。用户可在设置页覆盖（见 user.js）。
 *
 * 约定：
 *   - 正则一律用 RegExp 字面量，不要写成字符串，避免二次转义出错
 *   - 规则按顺序尝试，先命中者优先
 *   - 每条正则都要有 group 指明取哪个捕获组
 */

// 中文数字 → 阿拉伯数字
const CN_NUM = {
  零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5,
  六: 6, 七: 7, 八: 8, 九: 9, 十: 10,
}

// 生成中文数字映射：一~九十九
const buildChineseNumbers = () => {
  const map = { 特别篇: '0' }
  // 个位
  for (let i = 0; i <= 9; i++) {
    const cn = Object.keys(CN_NUM).find(k => CN_NUM[k] === i)
    if (cn) map[cn] = String(i)
  }
  // 十、十一~十九
  map['十'] = '10'
  const digitKeys = ['一', '二', '三', '四', '五', '六', '七', '八', '九']
  digitKeys.forEach((k, i) => {
    map[`十${k}`] = String(11 + i)
    map[`${k}十`] = String((i + 1) * 10)
    // 二十一~九十九
    for (let j = 1; j <= 9; j++) {
      map[`${k}十${digitKeys[j - 1]}`] = String((i + 1) * 10 + j)
    }
  })
  return map
}

export const CHINESE_NUMBERS = buildChineseNumbers()

export default {
  /**
   * 1. 视频扩展名白名单（小写，不带点）
   * 用于精确比对扩展名，取代旧的 name.includes() 子串匹配
   */
  videoExtensions: [
    'mp4', 'mkv', 'm2ts', 'avi', 'mov', 'ts', 'm3u8', 'iso',
    'rmvb', 'flv', 'wmv', 'webm', 'm4v', 'mpg', 'mpeg', '3gp',
    'rm', 'vob', 'asf', 'strm', 'divx', 'f4v', 'ogv',
  ],

  /**
   * 2. 路径黑名单：命中则整个目录/文件跳过，不参与刮削。
   * 对标爆米花的 public_webdav_blacklist
   */
  pathBlacklist: [
    // 回收站与系统目录
    /(?:^|\/)(?:#recycle|\$RECYCLE\.BIN|@eaDir|@Recently-Snapshot|\.Trash|\.recycle|lost\+found|System Volume Information)(?:\/|$)/i,
    // 花絮/预告/样本：关键词后允许接 . / 空格 / - / _ 或行尾，
    // 不能只认「整段名字等于关键词」——那样 Sample.mkv、预告片.mp4 全会漏。
    /(?:^|\/)(?:sample|samples|trailer|trailers|teaser|extras|featurettes|behind[\s._-]?the[\s._-]?scenes|预告|预告片|花絮|特典|幕后|短片|制作特辑)(?:[.\s_-]|$)/i,
    // 隐藏目录（以点开头）
    /(?:^|\/)\.[^/]+(?:\/|$)/,
  ],

  /**
   * 2.1 视频文件最小体积（字节）。低于此值的当作样片/碎片丢弃。
   *      0 表示不做体积过滤；来源未返回大小时也放行，避免误杀。
   */
  // 20MB：原值 50MB 会误杀高清短片、演唱会片段、动画短片。
  // 真正要挡的是几百 KB 的样本片段，20MB 已经足够区分。
  minVideoSize: 20 * 1024 * 1024,

  /**
   * 2.2 刮削并发度。0 表示无上限。
   *
   * scanConcurrency  同时进行的目录列举请求上限。跨整棵扫描树共享一个闸门，
   *                  不是每层各开一个池——后者会让在飞请求数变成「每层并发
   *                  相乘」，用户填 4 却得到几十上百个并发。
   * matchConcurrency 同时进行的 TMDB 匹配请求上限。
   *
   * 默认 0 = 全并发，与改造前（旧 recursionMovie / recursionTv 每层
   * Promise.allSettled 铺开）的行为一致；用户遇到限流可自行调小。
   */
  scanConcurrency: 4,
  matchConcurrency: 10,

  /**
   * 3. 年份识别
   * score 用于多个候选时的取舍
   */
  yearPatterns: [
    // 被分隔符包起来的四位年：.1999. / (1999) / [1999] / 空格1999空格
    { re: /[.\[(（【\s](19\d{2}|20\d{2})[.\]）】)\s]/, group: 1, score: 10 },
    // 结尾独立的四位年
    { re: /(19\d{2}|20\d{2})$/, group: 1, score: 6 },
  ],

  /**
   * 4. 季号识别
   * type: 'cn' 走中文数字映射，'num' 直接取数字
   */
  seasonPatterns: [
    // S01E02 / S03E05：把季和集一起吃掉，注意要放在单独的 S01 之前
    { re: /\bS(\d{1,2})E\d{1,3}\b/i, group: 1, type: 'num' },
    { re: /第\s*([一二三四五六七八九十百零两\d]+)\s*季/, group: 1, type: 'cn' },
    { re: /Season\s*0*(\d{1,2})/i, group: 1, type: 'num' },
    // 单独的 S01：用边界避免命中 Spider 之类（要求后跟分隔符或结尾）
    { re: /\bS(\d{1,2})(?=[.\s\]\-_]|$)/i, group: 1, type: 'num' },
    // 1x01 这种写法，取前面的季
    { re: /(?:^|[.\s\[(])(\d{1,2})x\d{1,3}(?:$|[.\s\])])/, group: 1, type: 'num' },
    // 中文「第二部」这种少见写法
    { re: /第\s*([一二三四五六七八九十零两]+)\s*部/, group: 1, type: 'cn' },
  ],

  // 特别篇/OVA 等，统一归到第 0 季
  seasonSpecials: [/特别篇/, /\bSP\b/i, /\bOVA\b/i, /\bOAD\b/i, /\bSpecial\b/i],

  /**
   * 5. 集号识别
   */
  episodePatterns: [
    { re: /[Ss]\d{1,2}[Ee](\d{1,3})/, group: 1 },
    { re: /第\s*(\d{1,3})\s*[集话話期]/, group: 1 },
    // 右方括号后紧跟的集号：【tvzongheba】E01 / [组名]EP05
    // 括号把前面的站点名隔断了，`[._-]E` 那条要求的是 . _ - 前缀，认不到。
    { re: /[\]】)）]\s*[Ee][Pp]?\s*0*(\d{1,3})/, group: 1 },
    { re: /[._-][Ee](\d{1,3})[._\s-]/, group: 1 },
    { re: /(?:^|[.\s])EP?\s*0*(\d{1,3})(?:$|[.\s])/i, group: 1 },
    // 横杠分隔的集号：「三体 - 01 [1080p]」「某番 - 05」
    // 要求数字后面是边界或结尾，并且前面带分隔符，避免命中片名里的连字符。
    // 不能写成 `[._\s-]0*(\d+)$` 那样不设后界——「1917.2019」会被切成 201。
    { re: /[._\s-]\s*0*(\d{1,3})(?=$|[.\s\[\]【】()（）])/, group: 1 },
    // 区间写法：01-02 / 03-04，取前一个
    { re: /(?:^|[.\s_])0*(\d{1,3})\s*-\s*0*(\d{1,3})(?=$|[.\s])/, group: 1 },
    // 纯数字结尾的集号：xxx.05.mkv / xxx 第5集
    { re: /[.\s]0*(\d{1,3})$/, group: 1 },
  ],

  /**
   * 6. 发行标记：出现在标题里时作为切分点，且不参与片名。
   * 按长度倒序匹配更安全，这里由 parse 层统一处理。
   */
  releaseTags: [
    '2160p', '1080p', '720p', '480p', '4k', '8k', 'uhd',
    'hdr', 'hdr10', 'hdr10+', 'dolbyvision', 'dovi', 'dv', 'sdr',
    'bluray', 'blu-ray', 'bdrip', 'brrip', 'bdremux', 'remux',
    'web-dl', 'webdl', 'webrip', 'web', 'hdtv', 'dvdrip', 'dvdscr', 'hdrip', 'cam',
    'x264', 'x265', 'h264', 'h.264', 'h265', 'h.265', 'hevc', 'avc', 'av1',
    '10bit', '8bit', 'hi10p',
    'aac', 'ac3', 'eac3', 'dts', 'dts-hd', 'truehd', 'flac', 'atmos', 'ddp', 'dd5.1',
    '国语', '粤语', '英语', '日语', '韩语', '中字', '简繁', '双语', '内封', '内嵌', '外挂', '字幕',
    'complete', 'repack', 'proper', 'extended', 'unrated', 'remastered',
    'directors.cut', "director's.cut", 'imax', '3d',
    '国配', '中英', '繁中', '简中', '高清', '超清', '蓝光',
  ],

  /**
   * 7. 标题切分字符：片名在这些字符处结束
   */
  titleSplitChars: ['.', '_', '(', '（', '[', '【', '】', ']', '）'],

  /**
   * 9. 「无意义片名」判定：整段名字只是编号/集号/季号/发行标记时，
   * 它不能当片名用（否则「第01集」「01」「Episode 01」都会被拿去搜 TMDB）。
   *
   * 这些名字的片名必须从父目录名另找，找不到就归入「未识别」。
   * 判定在 parse/filename.js 的 isMeaninglessTitle 里做整串匹配。
   */
  meaninglessTitlePatterns: [
    // 纯数字：01 / 2023 / 1
    /^\d{1,4}$/,
    // 中文集号：第01集 / 第1话 / 第3期 / 第十集
    /^第\s*[0-9一二三四五六七八九十百千零两]+\s*[集话話期回]$/,
    // 英文集号：EP01 / E01 / Episode 01 / Ep.5
    // 也含解析后只剩 'Episode'/'EP'/'E' 的情况（集号被 episodePatterns 吃掉后留下的词）
    /^(?:episode|ep|e)[\s._-]*\d{0,4}$/i,
    // 季集连写：S01E01 / S1E1 / 01x01
    /^s\d{1,2}[\s._-]*e\d{1,3}$/i,
    /^\d{1,2}x\d{1,3}$/,
    // 纯季标记：S01 / Season 1 / 第1季 / 第一季
    /^s\d{1,2}$/i,
    /^season[\s._-]*\d{1,2}$/i,
    /^第\s*[0-9一二三四五六七八九十百千零两]+\s*季$/,
    // 章节编号：课程/教程里的 9-10 / 12-10 / 18_17（归一化后是 18 17）
    // 这两个数字之间没有任何片名语义，是纯粹的进度标记。
    /^\d{1,3}\s*[-_]\s*\d{1,3}$/,
    /^\d{1,3}\s+\d{1,3}$/,
    // 「单字母 + 数字」：t02 / t11 / a01
    // 课程合集里 t01~t20 这类分集命名，曾被 relaxBySequelNumber 当成
    // 「前缀 t + 序号 02」去搜 TMDB，刮出无关影片。
    /^[a-z]\s*\d{1,3}$/i,
    // 编号后只剩标点：29， / 03、 / 12：
    /^\d{1,4}\s*[，,、：:。.]*$/,
    // 特别篇 / OVA / SP
    /^(?:特别篇|特典|ova|oad|sp|special)$/i,
    // 纯盘号：CD1 / DISC2 / Part.1 / 上 / 下
    /^(?:cd|disc|disk|part|vol)[\s._-]*\d{1,2}$/i,
    /^[上下集]$/,
    // 纯时间/日期串：00:08 / 1:23:45 / 20231105 / 2023-11-05
    // 这类名字常出现在随手命名的录制文件里，不能当片名搜索
    /^\d{1,2}:\d{2}(?::\d{2})?$/,
    /^\d{8}$/,
    /^(?:19|20)\d{2}[-_.]\d{1,2}[-_.]\d{1,2}$/,
    // 纯发行标记 / 分辨率
    /^(?:\d{3,4}p|[48]k|uhd|hdr|bluray|blu-ray|web-?dl|webrip|remux|x264|x265|h264|h265|hevc|av1)$/i,
    // 常见非正片：sample / trailer / 预告 / 花絮 / 幕后 / 短片 / 特辑
    //
    // 中文侧**不能用「包含」判定**：这些词都是正常片名的一部分。
    //   《幕后玩家》(2018)、《预告犯》(2015)、《死亡预告》
    // 早期这里写成 /(?:预告|花絮|特辑|幕后|短片|样片|片花)/ 的裸子串匹配，
    // 把上面这些真影片的片名清空、直接掉进「未识别」，是漏片直接原因。
    //
    // 改为整串判定：只有整个名字就是这类词（或后接集号/序号）才算花絮。
    /^(?:预告|预告片|花絮|特辑|幕后|幕后花絮|短片|样片|片花|制作特辑|拍摄花絮)[\s._-]*\d{0,3}$/,
  ],

  /**
   * 8. 中文数字映射表
   */
  chineseNumbers: CHINESE_NUMBERS,
}
