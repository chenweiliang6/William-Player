// stub:registry-stub
var listSourceFolder = async (type, ref) => {
  const l = (globalThis.__FS__ || {})[ref.path];
  if (!l)
    throw new Error("no dir " + ref.path);
  return { list: l };
};

// src/utils/scrape/constants.js
var SCRAPE_UNBOUNDED_TIMEOUT = 24 * 60 * 60 * 1e3;

// src/utils/scrape/rules/default.js
var CN_NUM = {
  \u96F6: 0,
  \u4E00: 1,
  \u4E8C: 2,
  \u4E24: 2,
  \u4E09: 3,
  \u56DB: 4,
  \u4E94: 5,
  \u516D: 6,
  \u4E03: 7,
  \u516B: 8,
  \u4E5D: 9,
  \u5341: 10
};
var buildChineseNumbers = () => {
  const map = { \u7279\u522B\u7BC7: "0" };
  for (let i = 0; i <= 9; i++) {
    const cn = Object.keys(CN_NUM).find((k) => CN_NUM[k] === i);
    if (cn)
      map[cn] = String(i);
  }
  map["\u5341"] = "10";
  const digitKeys = ["\u4E00", "\u4E8C", "\u4E09", "\u56DB", "\u4E94", "\u516D", "\u4E03", "\u516B", "\u4E5D"];
  digitKeys.forEach((k, i) => {
    map[`\u5341${k}`] = String(11 + i);
    map[`${k}\u5341`] = String((i + 1) * 10);
    for (let j = 1; j <= 9; j++) {
      map[`${k}\u5341${digitKeys[j - 1]}`] = String((i + 1) * 10 + j);
    }
  });
  return map;
};
var CHINESE_NUMBERS = buildChineseNumbers();
var default_default = {
  /**
   * 1. 视频扩展名白名单（小写，不带点）
   * 用于精确比对扩展名，取代旧的 name.includes() 子串匹配
   */
  videoExtensions: [
    "mp4",
    "mkv",
    "m2ts",
    "avi",
    "mov",
    "ts",
    "m3u8",
    "iso",
    "rmvb",
    "flv",
    "wmv",
    "webm",
    "m4v",
    "mpg",
    "mpeg",
    "3gp",
    "rm",
    "vob",
    "asf",
    "strm",
    "divx",
    "f4v",
    "ogv"
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
    /(?:^|\/)\.[^/]+(?:\/|$)/
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
    { re: /(19\d{2}|20\d{2})$/, group: 1, score: 6 }
  ],
  /**
   * 4. 季号识别
   * type: 'cn' 走中文数字映射，'num' 直接取数字
   */
  seasonPatterns: [
    // S01E02 / S03E05：把季和集一起吃掉，注意要放在单独的 S01 之前
    { re: /\bS(\d{1,2})E\d{1,3}\b/i, group: 1, type: "num" },
    { re: /第\s*([一二三四五六七八九十百零两\d]+)\s*季/, group: 1, type: "cn" },
    { re: /Season\s*0*(\d{1,2})/i, group: 1, type: "num" },
    // 单独的 S01：用边界避免命中 Spider 之类（要求后跟分隔符或结尾）
    { re: /\bS(\d{1,2})(?=[.\s\]\-_]|$)/i, group: 1, type: "num" },
    // 1x01 这种写法，取前面的季
    { re: /(?:^|[.\s\[(])(\d{1,2})x\d{1,3}(?:$|[.\s\])])/, group: 1, type: "num" },
    // 中文「第二部」这种少见写法
    { re: /第\s*([一二三四五六七八九十零两]+)\s*部/, group: 1, type: "cn" }
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
    { re: /[.\s]0*(\d{1,3})$/, group: 1 }
  ],
  /**
   * 6. 发行标记：出现在标题里时作为切分点，且不参与片名。
   * 按长度倒序匹配更安全，这里由 parse 层统一处理。
   */
  releaseTags: [
    "2160p",
    "1080p",
    "720p",
    "480p",
    "4k",
    "8k",
    "uhd",
    "hdr",
    "hdr10",
    "hdr10+",
    "dolbyvision",
    "dovi",
    "dv",
    "sdr",
    "bluray",
    "blu-ray",
    "bdrip",
    "brrip",
    "bdremux",
    "remux",
    "web-dl",
    "webdl",
    "webrip",
    "web",
    "hdtv",
    "dvdrip",
    "dvdscr",
    "hdrip",
    "cam",
    "x264",
    "x265",
    "h264",
    "h.264",
    "h265",
    "h.265",
    "hevc",
    "avc",
    "av1",
    "10bit",
    "8bit",
    "hi10p",
    "aac",
    "ac3",
    "eac3",
    "dts",
    "dts-hd",
    "truehd",
    "flac",
    "atmos",
    "ddp",
    "dd5.1",
    "\u56FD\u8BED",
    "\u7CA4\u8BED",
    "\u82F1\u8BED",
    "\u65E5\u8BED",
    "\u97E9\u8BED",
    "\u4E2D\u5B57",
    "\u7B80\u7E41",
    "\u53CC\u8BED",
    "\u5185\u5C01",
    "\u5185\u5D4C",
    "\u5916\u6302",
    "\u5B57\u5E55",
    "complete",
    "repack",
    "proper",
    "extended",
    "unrated",
    "remastered",
    "directors.cut",
    "director's.cut",
    "imax",
    "3d",
    "\u56FD\u914D",
    "\u4E2D\u82F1",
    "\u7E41\u4E2D",
    "\u7B80\u4E2D",
    "\u9AD8\u6E05",
    "\u8D85\u6E05",
    "\u84DD\u5149"
  ],
  /**
   * 7. 标题切分字符：片名在这些字符处结束
   */
  titleSplitChars: [".", "_", "(", "\uFF08", "[", "\u3010", "\u3011", "]", "\uFF09"],
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
    /^(?:预告|预告片|花絮|特辑|幕后|幕后花絮|短片|样片|片花|制作特辑|拍摄花絮)[\s._-]*\d{0,3}$/
  ],
  /**
   * 8. 中文数字映射表
   */
  chineseNumbers: CHINESE_NUMBERS
};

// src/utils/scrape/rules/user.js
var SETTING_KEY = "settingData";
var RULE_FIELD = "scrapeRules";
var readSettingData = () => {
  try {
    return uni.getStorageSync(SETTING_KEY) || {};
  } catch {
    return {};
  }
};
var getUserRules = () => {
  const data = readSettingData();
  return data[RULE_FIELD] || {};
};

// src/utils/scrape/rules/resolver.js
var cache = null;
var cacheSignature = "";
var compileRe = (re, label) => {
  if (re instanceof RegExp)
    return re;
  if (typeof re !== "string" || !re)
    return null;
  try {
    return new RegExp(re);
  } catch (e) {
    console.warn(`[scrape/rules] \u81EA\u5B9A\u4E49\u6B63\u5219\u7F16\u8BD1\u5931\u8D25\uFF08${label}\uFF09\uFF0C\u5DF2\u5FFD\u7565:`, re, e);
    return null;
  }
};
var dedupe = (arr) => Array.from(new Set(arr.filter((v) => v != null && v !== "")));
var toConcurrency = (v, fallback) => {
  if (v == null || v === "")
    return fallback;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0)
    return fallback;
  return Math.min(Math.floor(n), 9999);
};
var normalizePatterns = (arr, label) => {
  if (!Array.isArray(arr))
    return [];
  return arr.map((item) => {
    if (!item)
      return null;
    const re = compileRe(item.re, label);
    if (!re)
      return null;
    return {
      re,
      group: Number(item.group) || 1,
      type: item.type || "num",
      score: Number(item.score) || 10
    };
  }).filter(Boolean);
};
var compileBlacklist = (arr) => {
  if (!Array.isArray(arr))
    return [];
  return arr.map((item) => {
    if (item instanceof RegExp)
      return item;
    if (typeof item !== "string" || !item)
      return null;
    try {
      return new RegExp(item);
    } catch {
      const escaped = item.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(escaped, "i");
    }
  }).filter(Boolean);
};
var resolveRules = (force = false) => {
  const user = getUserRules();
  const signature = JSON.stringify(user);
  if (!force && cache && signature === cacheSignature)
    return cache;
  const merged = {
    videoExtensions: dedupe([
      ...default_default.videoExtensions,
      ...Array.isArray(user.videoExtensions) ? user.videoExtensions : []
    ]).map((v) => String(v).toLowerCase().replace(/^\./, "")),
    pathBlacklist: [
      ...default_default.pathBlacklist,
      ...compileBlacklist(user.pathBlacklist)
    ],
    releaseTags: dedupe([
      ...default_default.releaseTags,
      ...Array.isArray(user.releaseTags) ? user.releaseTags : []
    ]).map((v) => String(v).toLowerCase()),
    // 用户规则优先
    seasonPatterns: [
      ...normalizePatterns(user.seasonPatterns, "seasonPatterns"),
      ...default_default.seasonPatterns
    ],
    episodePatterns: [
      ...normalizePatterns(user.episodePatterns, "episodePatterns"),
      ...default_default.episodePatterns
    ],
    yearPatterns: [
      ...normalizePatterns(user.yearPatterns, "yearPatterns"),
      ...default_default.yearPatterns
    ],
    seasonSpecials: [
      ...Array.isArray(user.seasonSpecials) ? user.seasonSpecials.map((r) => compileRe(r, "seasonSpecials")).filter(Boolean) : [],
      ...default_default.seasonSpecials
    ],
    titleSplitChars: dedupe([
      ...default_default.titleSplitChars,
      ...Array.isArray(user.titleSplitChars) ? user.titleSplitChars : []
    ]),
    // 用户规则插到最前；内置的在后兜底
    meaninglessTitlePatterns: [
      ...Array.isArray(user.meaninglessTitlePatterns) ? user.meaninglessTitlePatterns.map((r) => compileRe(r, "meaninglessTitlePatterns")).filter(Boolean) : [],
      ...default_default.meaninglessTitlePatterns
    ],
    // 体积阈值：用户给正数才覆盖内置
    minVideoSize: Number(user.minVideoSize) >= 0 && user.minVideoSize != null ? Number(user.minVideoSize) : default_default.minVideoSize,
    // 并发度：0 无上限，正整数限流，其余回落默认
    scanConcurrency: toConcurrency(user.scanConcurrency, default_default.scanConcurrency),
    matchConcurrency: toConcurrency(user.matchConcurrency, default_default.matchConcurrency),
    chineseNumbers: { ...default_default.chineseNumbers }
  };
  cache = merged;
  cacheSignature = signature;
  return merged;
};

// src/utils/scrape/parse/video-ext.js
var getExtension = (name) => {
  if (!name)
    return "";
  const idx = String(name).lastIndexOf(".");
  if (idx < 0 || idx === name.length - 1)
    return "";
  return String(name).slice(idx + 1).toLowerCase();
};
var TS_CODE_STEM = /(^|\.)(d|config|test|spec|min|setup)$/i;
var isTsCodeFile = (name) => {
  const s = String(name || "");
  if (getExtension(s) !== "ts")
    return false;
  return TS_CODE_STEM.test(s.slice(0, s.length - 3));
};
var isVideoFile = (name) => {
  const ext = getExtension(name);
  if (!ext)
    return false;
  if (ext === "ts" && isTsCodeFile(name))
    return false;
  return resolveRules().videoExtensions.includes(ext);
};

// src/utils/scrape/parse/season.js
var extractSeason = (str) => {
  if (!str)
    return null;
  const rules = resolveRules();
  const text = String(str);
  if (rules.seasonSpecials.some((re) => re.test(text)))
    return "0";
  for (const p of rules.seasonPatterns) {
    const m = text.match(p.re);
    if (!m)
      continue;
    const raw = m[p.group];
    if (raw == null)
      continue;
    if (p.type === "cn") {
      const mapped = rules.chineseNumbers[raw];
      if (mapped != null)
        return String(mapped);
      const num2 = parseInt(raw, 10);
      if (!Number.isNaN(num2))
        return String(num2);
      continue;
    }
    const num = parseInt(raw, 10);
    if (!Number.isNaN(num))
      return String(num);
  }
  return null;
};
var extractEpisode = (str) => {
  if (!str)
    return null;
  const rules = resolveRules();
  const text = String(str);
  for (const p of rules.episodePatterns) {
    const m = text.match(p.re);
    if (!m)
      continue;
    const raw = m[p.group];
    if (raw == null)
      continue;
    const num = parseInt(raw, 10);
    if (!Number.isNaN(num))
      return String(num);
  }
  return null;
};

// src/utils/scrape/parse/filename.js
var stripExtension = (name) => {
  if (!name)
    return "";
  const s = String(name);
  const idx = s.lastIndexOf(".");
  if (idx <= 0)
    return s;
  const ext = s.slice(idx + 1).toLowerCase();
  if (!resolveRules().videoExtensions.includes(ext))
    return s;
  return s.slice(0, idx);
};
var stripLeadingGroupTag = (text) => {
  const s = String(text || "");
  const m = s.match(/^[\[【(（]([^\]】)）]{1,32})[\]】)）]\s*/);
  if (!m)
    return { text: s, stripped: false };
  const inner = m[1].trim();
  const rest = s.slice(m[0].length);
  if (!inner || rest.length < 2)
    return { text: s, stripped: false };
  if (/^[\d\s._-]+$/.test(inner))
    return { text: s, stripped: false };
  const isGroupName = /(?:字幕组|字幕社|字幕|压制组|压制|汉化组|汉化|资源组|发布组|搬运)$/.test(inner);
  if (/[一-龥]/.test(inner) && !isGroupName)
    return { text: s, stripped: false };
  return { text: rest, stripped: true };
};
var findReleaseTagPos = (text, tags) => {
  const lower = text.toLowerCase();
  let best = null;
  for (const tag of tags) {
    if (!tag)
      continue;
    const idx = lower.indexOf(tag);
    if (idx < 0)
      continue;
    const before = idx === 0 ? "" : lower[idx - 1];
    const after = idx + tag.length >= lower.length ? "" : lower[idx + tag.length];
    const isBoundary = (ch) => ch === "" || /[.\s\-_\[\]()（）【】]/.test(ch);
    if (!isBoundary(before) || !isBoundary(after))
      continue;
    if (tag.length <= 3) {
      const rest = lower.slice(idx + tag.length).replace(/^[.\s\-_\[\]【】]+/, "");
      const nextToken = rest.split(/[.\s\-_\[\]【】]/)[0] || "";
      if (/^\d+$/.test(nextToken))
        continue;
    }
    if (!best || idx < best.index)
      best = { index: idx, tag };
  }
  return best;
};
var findYearPos = (text, patterns) => {
  let best = null;
  for (const p of patterns) {
    const m = text.match(p.re);
    if (!m)
      continue;
    const idx = m.index;
    if (!best || idx < best.index || idx === best.index && (p.score || 0) > best.score) {
      best = { index: idx, year: m[p.group], score: p.score || 0 };
    }
  }
  return best;
};
var findSeasonPos = (text, rules) => {
  let best = null;
  for (const re of rules.seasonSpecials) {
    const m = text.match(re);
    if (m && (!best || m.index < best.index))
      best = { index: m.index, raw: m[0] };
  }
  for (const p of rules.seasonPatterns) {
    const m = text.match(p.re);
    if (m && (!best || m.index < best.index))
      best = { index: m.index, raw: m[0] };
  }
  for (const p of rules.episodePatterns) {
    const m = text.match(p.re);
    if (m && (!best || m.index < best.index))
      best = { index: m.index, raw: m[0] };
  }
  return best;
};
var findBracketPos = (text) => {
  let best = -1;
  for (const ch of ["(", "\uFF08", "[", "\u3010", "{"]) {
    const idx = text.indexOf(ch);
    if (idx > 0 && (best < 0 || idx < best))
      best = idx;
  }
  return best;
};
var isMeaninglessTitle = (title) => {
  const t = String(title || "").trim();
  if (!t)
    return true;
  const patterns = resolveRules().meaninglessTitlePatterns || [];
  const norm = t.replace(/[._]+/g, " ").replace(/\s+/g, " ").trim();
  return patterns.some((re) => {
    re.lastIndex = 0;
    return re.test(t) || re.test(norm);
  });
};
var parseFilename = (filename) => {
  const raw = stripExtension(String(filename || "").trim());
  const rules = resolveRules();
  if (!raw) {
    return { title: "", original: "", year: "", season: null, episode: null, quality: "", tags: [] };
  }
  const original = raw;
  const { text: body } = stripLeadingGroupTag(raw);
  const ext = getExtension(filename);
  const boundaries = [];
  const yearPos = findYearPos(body, rules.yearPatterns);
  if (yearPos)
    boundaries.push(yearPos.index);
  const seasonPos = findSeasonPos(body, rules);
  if (seasonPos)
    boundaries.push(seasonPos.index);
  const tagPos = findReleaseTagPos(body, rules.releaseTags);
  if (tagPos)
    boundaries.push(tagPos.index);
  if (!boundaries.length) {
    const bracketPos = findBracketPos(body);
    if (bracketPos > 0)
      boundaries.push(bracketPos);
  }
  const cutIdx = boundaries.length ? Math.min(...boundaries) : body.length;
  let title = body.slice(0, cutIdx);
  title = title.replace(/[._]+/g, " ").replace(/[{}\[\]()（）【】]/g, " ").replace(/\s+/g, " ").trim();
  title = title.replace(/^[\s.\-_]+|[\s.\-_]+$/g, "");
  if (!title && cutIdx > 0) {
    const firstSpace = body.indexOf(" ");
    title = (firstSpace > 0 ? body.slice(0, firstSpace) : body).trim();
  }
  title = title.replace(/\s+[一-龥A-Za-z]{1,2}$/, "").trim() || title;
  const pureNumericTitle = /^\d{1,4}$/.test(title);
  const hasYear = !!(yearPos && yearPos.year);
  if (isMeaninglessTitle(title) && !(pureNumericTitle && hasYear))
    title = "";
  const season = extractSeason(body);
  const episode = ext ? extractEpisode(body) : null;
  let quality = "";
  const qualityTags = ["2160p", "1080p", "720p", "480p", "4k", "8k", "uhd"];
  const lower = original.toLowerCase();
  for (const q of qualityTags) {
    if (lower.includes(q)) {
      quality = q === "4k" || q === "8k" || q === "uhd" ? q.toUpperCase() : q;
      break;
    }
  }
  const tags = [];
  if (tagPos) {
    const matched = rules.releaseTags.filter((t) => lower.includes(t));
    tags.push(...matched);
  }
  return {
    title,
    original,
    year: yearPos ? String(yearPos.year) : "",
    season,
    episode,
    quality,
    tags
  };
};

// src/utils/scrape/scan/shape.js
var CONFIDENCE = {
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low"
};
var DISC_PATTERN = /(?:^|[.\s_-])(?:cd|disc|disk|part|vol)[\s._-]*\d{1,2}(?:[.\s_-]|$)/i;
var EXPLICIT_EPISODE_PATTERNS = [
  /[Ss]\d{1,2}[Ee]\d{1,3}/,
  /第\s*\d{1,3}\s*[集话話期]/,
  // E01 / EP01，但**必须零填充**（E01 而不是 E7）。
  // Fast.and.Furious.E7 是《速度与激情7》，不能被当成第 7 集；
  // 而 `.E01.` / `】E01` 这种两位数零填充的写法几乎只出现在真分集上。
  /(?:^|[._\-\s\]】)）])[Ee][Pp]?\s*0\d{1,2}(?=$|[._\-\s\[【(（])/,
  /[._\-\s][Ee][Pp]\s*0*\d{1,3}(?=$|[._\-\s])/,
  /\bEP\s*0*\d{1,3}\b/i
];
var hasExplicitEpisode = (name) => {
  const s = String(name || "");
  return EXPLICIT_EPISODE_PATTERNS.some((re) => re.test(s));
};
var episodeNumberOf = (name) => {
  const stripped = String(name || "").replace(/\.[^.]+$/, "").trim();
  if (/^0*\d{1,3}$/.test(stripped))
    return Number(stripped.replace(/^0+(?=\d)/, ""));
  const lead = stripped.match(/^0*(\d{1,3})\s+([A-Za-z0-9][\w.+ -]*)$/);
  if (!lead || lead[2].length > 16 || /[一-龥]/.test(lead[2]))
    return null;
  return Number(lead[1]);
};
var looksLikeEpisodeSequence = (videos) => {
  const nums = videos.map((v) => {
    const name = String(v.name || "");
    const p = parseFilename(name);
    if (p.episode != null)
      return Number(p.episode);
    return episodeNumberOf(name);
  }).filter((n) => n != null && Number.isFinite(n));
  if (nums.length < 2)
    return false;
  nums.sort((a, b) => a - b);
  const span = nums[nums.length - 1] - nums[0];
  if (span > nums.length * 3)
    return false;
  for (let i = 1; i < nums.length; i++) {
    if (nums[i] - nums[i - 1] > 3)
      return false;
  }
  return true;
};
var workNameOf = (name) => {
  const parsed = parseFilename(name);
  return parsed.title || "";
};
var classifyShape = ({ videos = [], folders = [], dirName = "" }) => {
  const hasSeasonSubdir = folders.some((f) => extractSeason(f.name) != null);
  if (!videos.length) {
    return { shape: hasSeasonSubdir ? "show" : "descend", confidence: CONFIDENCE.HIGH };
  }
  if (hasSeasonSubdir) {
    return { shape: "show", confidence: CONFIDENCE.HIGH };
  }
  if (videos.length === 1) {
    if (hasExplicitEpisode(videos[0].name)) {
      return { shape: "show", confidence: CONFIDENCE.MEDIUM };
    }
    const p = parseFilename(videos[0].name);
    const dirParsed = parseFilename(dirName);
    const nameIsPureNumber = !p.title && !isGenericDirName(dirName) && !!dirParsed.title && !isMeaninglessTitle(dirParsed.title);
    return nameIsPureNumber ? { shape: "show", confidence: CONFIDENCE.MEDIUM } : { shape: "files", confidence: CONFIDENCE.MEDIUM };
  }
  const withEpisode = videos.filter((v) => hasExplicitEpisode(v.name));
  if (withEpisode.length) {
    if (withEpisode.length * 2 > videos.length) {
      return { shape: "show", confidence: CONFIDENCE.HIGH };
    }
    const restAllTitleless = videos.filter((v) => !hasExplicitEpisode(v.name)).every((v) => !workNameOf(v.name));
    if (withEpisode.length >= 2 && restAllTitleless) {
      return { shape: "show", confidence: CONFIDENCE.MEDIUM };
    }
    return { shape: "files", confidence: CONFIDENCE.MEDIUM };
  }
  const names = videos.map((v) => workNameOf(v.name)).filter(Boolean);
  const distinct = new Set(names);
  if (!names.length) {
    const isDiscSeries = videos.every((v) => DISC_PATTERN.test(String(v.name)));
    if (isDiscSeries)
      return { shape: "files", confidence: CONFIDENCE.MEDIUM };
    return looksLikeEpisodeSequence(videos) ? { shape: "show", confidence: CONFIDENCE.MEDIUM } : { shape: "files", confidence: CONFIDENCE.MEDIUM };
  }
  if (distinct.size > 1) {
    const stems = new Set(names.map((n) => String(n).replace(/[\s._-]*\d{1,3}$/, "").trim()).filter(Boolean));
    if (stems.size === 1) {
      return looksLikeMultiVersion(videos) ? { shape: "files", confidence: CONFIDENCE.MEDIUM } : { shape: "show", confidence: CONFIDENCE.MEDIUM };
    }
  }
  if (distinct.size === 1) {
    return looksLikeMultiVersion(videos) ? { shape: "files", confidence: CONFIDENCE.MEDIUM } : { shape: "show", confidence: CONFIDENCE.HIGH };
  }
  return { shape: "files", confidence: CONFIDENCE.MEDIUM };
};
var RELEASE_QUALITY = /\b(2160p|1080p|720p|480p|4k|8k|uhd|hdr|bluray|blu-ray|web-?dl|webrip|remux|x264|x265|h264|h265|hevc|av1)\b/i;
var withoutExtension = (name) => String(name || "").replace(/\.[^.]+$/, "");
var looksLikeMultiVersion = (videos) => {
  const qualities = /* @__PURE__ */ new Set();
  videos.forEach((v) => {
    const m = String(v.name).match(new RegExp(RELEASE_QUALITY.source, "gi"));
    if (m)
      m.forEach((q) => qualities.add(q.toLowerCase()));
  });
  if (qualities.size > 1)
    return true;
  const names = videos.map((v) => withoutExtension(v.name));
  if (names.every((n) => DISC_PATTERN.test(n)))
    return true;
  const allWithoutEpisode = names.every((n) => extractEpisode(n) == null);
  return allWithoutEpisode;
};
var extractShowTitle = (dirName) => {
  let t = String(dirName || "");
  const season = extractSeason(t);
  if (season != null) {
    t = t.replace(/\bS\d{1,2}E\d{1,3}\b/gi, " ").replace(/第\s*[一二三四五六七八九十百零两\d]+\s*季/g, " ").replace(/第\s*[一二三四五六七八九十百零两]+\s*部/g, " ").replace(/Season\s*0*\d{1,2}/gi, " ").replace(/特别篇|\bSP\b|\bOVA\b|\bOAD\b|\bSpecial\b/gi, " ");
  }
  t = t.replace(/\bS\d{1,2}(?=[.\s\]\-_]|$)/gi, " ");
  return stripReleaseMarks(t);
};
var stripReleaseMarks = (s) => {
  let t = stripLeadingGroupTag(String(s || "")).text.replace(/[._]+/g, " ");
  t = t.replace(/[（(]\s*(?:19|20)\d{2}\s*[)）]/g, " ").replace(/[【\[]\s*(?:19|20)\d{2}\s*[】\]]/g, " ").replace(/[（(]\s*\d+\s*[集话話期季]\s*[)）]/g, " ").replace(/[【\[]\s*[\d\s.GBKMTPgbkmpt]*[】\]]/g, " ").replace(/[【\[]\s*(?:x|h)?26[45]\s*[】\]]/gi, " ").replace(/[【\[]\s*\d{3,4}p\s*[】\]]/gi, " ");
  t = t.replace(/\b(?:19|20)\d{2}\b/g, " ").replace(/\b\d{3,4}p\b/gi, " ").replace(/\b(?:x|h)26[45]\b/gi, " ").replace(/\b(?:hevc|avc|aac|ac3|eac3|ddp|dd5\.1|dts|web-?dl|webrip|bluray|blu-ray|remux|hdr10?|dv|sdr|atmos)\b/gi, " ").replace(/\b\d+(?:\.\d+)?\s*[GT]B\b/gi, " ").replace(/\b\d{1,4}\s*$/g, " ").replace(/\s+/g, " ").trim();
  t = t.replace(/\s*-\s*[A-Za-z][\w.]*\s*$/g, " ");
  return t.replace(/^[\s\-_]+|[\s\-_]+$/g, "").trim();
};
var GENERIC_DIR_NAMES = [
  "\u7535\u5F71",
  "\u7535\u89C6\u5267",
  "\u52A8\u6F2B",
  "\u7EFC\u827A",
  "\u7EAA\u5F55\u7247",
  "\u52A8\u753B",
  "\u5267\u96C6",
  "\u8FDE\u7EED\u5267",
  "\u6211\u7684\u89C6\u9891",
  "\u89C6\u9891",
  "\u5168\u90E8\u6587\u4EF6",
  "\u4E2A\u4EBA\u6587\u4EF6",
  "\u5176\u4ED6",
  "\u672A\u5206\u7C7B",
  "\u672A\u8BC6\u522B",
  "movies",
  "movie",
  "tv",
  "tv shows",
  "shows",
  "videos",
  "video",
  "anime",
  "films",
  "film",
  "documentary",
  "documentaries",
  "variety",
  // 网盘里常见的临时/软件/下载目录，名字不能当片名
  "temp",
  "tmp",
  "download",
  "downloads",
  "\u4E0B\u8F7D",
  "\u4E34\u65F6",
  "\u65B0\u5EFA\u6587\u4EF6\u5939",
  "uploads",
  "upload",
  "backup",
  "\u5907\u4EFD",
  "apps",
  "software",
  "\u8F6F\u4EF6",
  // alist / WebDAV 挂载点的常见层级名。
  // 这些目录名一旦被当成片名，整层文件会塌缩成一部叫「media」的假影片。
  "media",
  "medias",
  "library",
  "libraries",
  "video library",
  "media library",
  "\u963F\u91CC\u4E91\u76D8",
  "\u767E\u5EA6\u7F51\u76D8",
  "\u5938\u514B",
  "\u8FC5\u96F7",
  "onedrive",
  "cloud",
  "clouddrive",
  "disk",
  "files",
  "file",
  "root",
  "home",
  "data",
  "public",
  "share",
  "shared",
  "\u5F71\u89C6",
  "\u5F71\u7247",
  "\u7247\u5B50",
  "\u8D44\u6E90",
  "\u7F51\u76D8",
  "\u6536\u85CF",
  // 课程 / 教程 / 素材类目录名。这些目录里的视频不是影视作品，
  // 名字一旦被当成片名就会刮出无关的 TMDB 条目（曾出现一份叫「Agent」的假影片）。
  "agent",
  "agent\u5F00\u53D1",
  "\u6559\u7A0B",
  "\u8BFE\u7A0B",
  "\u5408\u96C6",
  "\u8BFE\u4EF6",
  "\u8D44\u6599",
  "\u7D20\u6750",
  "\u6587\u6863",
  "\u7B14\u8BB0",
  "\u5B66\u4E60",
  "\u57F9\u8BAD",
  "\u6559\u5B66",
  "\u76F4\u64AD\u56DE\u653E",
  "music",
  "mv",
  "music video",
  "podcast",
  "audiobook",
  "course",
  "courses",
  "tutorial",
  "tutorials",
  "lecture",
  "lectures",
  "training"
];
var NON_MEDIA_DIR_KEYWORDS = [
  /(?:教程|课程|教学|课件|讲义|培训|训练营|入门到精通)/,
  /(?:素材|资料|文档|笔记|模版|模板|源码|课件包)/,
  /\bagent\b/i,
  /\bcoze\b/i,
  /\bworkflow\b/i,
  /\btutorials?\b/i,
  /\bcourses?\b/i,
  /\blectures?\b/i,
  /\bpodcasts?\b/i
];
var isGenericDirName = (name) => {
  const n = String(name || "").trim().toLowerCase();
  if (!n)
    return true;
  if (GENERIC_DIR_NAMES.includes(n))
    return true;
  if (/^[\s._\-()（）\[\]【】]+$/.test(n))
    return true;
  if (/^\d{1,2}$/.test(n))
    return true;
  return NON_MEDIA_DIR_KEYWORDS.some((re) => re.test(n));
};

// src/utils/scrape/scan/tree.js
var MAX_DEPTH = 8;
var createGate = (limit) => {
  const width = Number(limit);
  if (!Number.isFinite(width) || width <= 0) {
    return { limit: 0, run: (fn) => fn() };
  }
  let active = 0;
  const queue = [];
  let head = 0;
  const drain = () => {
    while (active < width && head < queue.length) {
      const job = queue[head++];
      active++;
      Promise.resolve().then(job.fn).then(job.resolve, job.reject).finally(() => {
        active--;
        drain();
      });
    }
    if (head > 256 && head * 2 > queue.length) {
      queue.splice(0, head);
      head = 0;
    }
  };
  return {
    limit: width,
    run: (fn) => new Promise((resolve, reject) => {
      queue.push({ fn, resolve, reject });
      drain();
    })
  };
};
var BATCH_SIZE = 60;
var FLUSH_INTERVAL_MS = 1500;
var isBlacklisted = (path) => {
  if (!path)
    return false;
  const rules = resolveRules();
  return rules.pathBlacklist.some((re) => {
    re.lastIndex = 0;
    return re.test(path);
  });
};
var joinPath = (parent, name) => {
  const p = String(parent || "").replace(/\/+$/, "");
  const n = String(name || "").replace(/^\/+/, "");
  return (p || "") + "/" + n;
};
var basename = (path) => String(path || "").split("/").filter(Boolean).pop() || "";
var isTooSmall = (item) => {
  const min = resolveRules().minVideoSize;
  if (!min || min <= 0)
    return false;
  const size = Number(item?.size) || 0;
  return size > 0 && size < min;
};
var pickShowTitle = (dirName, videos) => {
  const fromDir = extractShowTitle(dirName) || dirName;
  const fileTitles = /* @__PURE__ */ new Set();
  for (const v of videos) {
    const p = parseFilename(v.name);
    if (p.title && p.episode != null)
      fileTitles.add(p.title);
  }
  if (fromDir && !isMeaninglessTitle(fromDir) && !isGenericDirName(fromDir))
    return fromDir;
  if (fileTitles.size === 1)
    return [...fileTitles][0];
  if (fromDir)
    return fromDir;
  return videos.length ? parseFilename(videos[0].name).title || "" : "";
};
var belongsToShow = (video, showTitle) => {
  const name = String(video?.name || "");
  const parsed = parseFilename(name);
  const fileTitle = parsed.title || "";
  if (hasExplicitEpisode(name))
    return true;
  if (episodeNumberOf(name) != null)
    return true;
  const norm = (s) => String(s || "").replace(/[（(][^（()）]{0,40}[)）]/g, "").replace(/[【\[][^【\[\]】]{0,60}[】\]]/g, "").replace(/[\s._\-:：·・]+/g, "").replace(/\b(?:19|20)\d{2}\b/g, "").toLowerCase();
  const sameTitle = !!(fileTitle && showTitle && norm(fileTitle) === norm(showTitle));
  if (sameTitle)
    return true;
  return !fileTitle;
};
var scanFolderTree = async (opts) => {
  const {
    type,
    accountName,
    provider,
    cred,
    ref,
    isTv,
    onProgress,
    onBatch,
    signal,
    gate
  } = opts;
  const items = [];
  const folders = [];
  const skipped = [];
  let cancelled = false;
  const gateRef = gate || createGate(resolveRules().scanConcurrency);
  let fatalError = null;
  let delivered = 0;
  let lastFlushAt = Date.now();
  const flushBatch = (force = false) => {
    if (!onBatch)
      return;
    const pending = items.length - delivered;
    if (!pending)
      return;
    if (!force && pending < BATCH_SIZE && Date.now() - lastFlushAt < FLUSH_INTERVAL_MS)
      return;
    onBatch(items.slice(delivered));
    delivered = items.length;
    lastFlushAt = Date.now();
  };
  const shouldStop = () => {
    if (fatalError)
      return true;
    if (signal?.cancelled) {
      cancelled = true;
      return true;
    }
    return false;
  };
  const listSafe = async (currentRef, currentPath, depth) => {
    try {
      const { list } = await gateRef.run(
        () => listSourceFolder(type, currentRef, cred, { timeout: SCRAPE_UNBOUNDED_TIMEOUT })
      );
      return list || [];
    } catch (e) {
      const authError = e?.tokenExpired || Number(e?.code) === 401;
      if (authError || depth === 0) {
        if (!fatalError)
          fatalError = e;
        throw e;
      }
      const message = e?.message || e?.errMsg || String(e);
      skipped.push({
        path: currentPath || currentRef?.path || "",
        message,
        code: e?.code
      });
      console.warn("[scrape/scan] \u76EE\u5F55\u8DF3\u8FC7:", type, currentPath, message);
      return null;
    }
  };
  const emitShow = ({ title, showPath, season, seasonPath, folderId, sample, confidence }) => {
    const seasonStr = String(season ?? "1");
    if (items.some((i) => i.isSeasonDir && i.name === title && i.season === seasonStr))
      return;
    if (items.some((i) => i.seasonPath === seasonPath))
      return;
    items.push({
      name: title,
      path: seasonPath,
      fileId: folderId || null,
      folderFileId: folderId || null,
      parentPath: showPath,
      type,
      accountName,
      provider,
      // mediaType 是初判，最终以 TMDB 匹配结果为准
      mediaType: "tv",
      season: seasonStr,
      seasonPath,
      isSeasonDir: true,
      confidence: confidence || CONFIDENCE.HIGH,
      size: sample?.size || 0,
      createTime: sample?.createTime || "",
      updateTime: sample?.updateTime || "",
      thumb: sample?.thumb || ""
    });
    onProgress?.({ found: items.length });
  };
  const emitFile = (videoItem, path, confidence) => {
    items.push({
      name: videoItem.name,
      path,
      fileId: videoItem.id,
      folderFileId: videoItem.id,
      parentPath: path.split("/").slice(0, -1).join("/") || "/",
      type,
      accountName,
      provider,
      mediaType: "movie",
      season: null,
      seasonPath: null,
      isSeasonDir: false,
      confidence: confidence || CONFIDENCE.MEDIUM,
      size: videoItem.size || 0,
      createTime: videoItem.createTime || "",
      updateTime: videoItem.updateTime || "",
      thumb: videoItem.thumb || ""
    });
    onProgress?.({ found: items.length });
  };
  const walkNode = async (currentRef, currentPath, depth, ctx = {}) => {
    if (depth > MAX_DEPTH || shouldStop())
      return;
    const list = await listSafe(currentRef, currentPath, depth);
    if (list == null)
      return;
    if (!list.length)
      return;
    const selfName = basename(currentPath);
    const subFolders = [];
    const videos = [];
    for (const item of list) {
      const childPath = joinPath(currentPath, item.name);
      if (isBlacklisted(childPath))
        continue;
      if (item.isFolder) {
        subFolders.push(item);
      } else if (isVideoFile(item.name) && !isTooSmall(item)) {
        videos.push(item);
      }
    }
    const judged = isTv === true ? { shape: videos.length || subFolders.some((f) => extractSeason(f.name) != null) ? "show" : "descend", confidence: CONFIDENCE.HIGH } : isTv === false ? { shape: "files", confidence: CONFIDENCE.HIGH } : classifyShape({ videos, folders: subFolders, dirName: selfName });
    const seasonSubdirs = subFolders.filter((f) => extractSeason(f.name) != null);
    const dirIsGeneric = isGenericDirName(selfName);
    if (judged.shape === "show") {
      const ownSeason = extractSeason(selfName);
      const showTitle = ctx.showTitle !== void 0 ? ctx.showTitle : dirIsGeneric ? "" : extractShowTitle(selfName) || selfName;
      const finalShowTitle = ctx.showTitle !== void 0 ? ctx.showTitle : showTitle ? pickShowTitle(selfName, videos) || showTitle : "";
      const hasEpisodeEvidence = videos.some((v) => hasExplicitEpisode(v.name));
      const titleFromFile = videos.length > 0 && (() => {
        const p = parseFilename(videos[0].name);
        return !!p.title && p.episode != null;
      })();
      const showTitleCredible = titleFromFile || hasEpisodeEvidence || judged.shape === "show";
      if (videos.length && !seasonSubdirs.length && finalShowTitle && showTitleCredible) {
        emitShow({
          // 剧名的可信来源有两个：目录名，和本层文件名（含 SxxEyy 时最可靠）。
          // 取更长的那个——「单剧根/漫长的季节.S01E01.mkv」里，
          // 目录名是随手起的，真正的剧名在文件名里。
          title: finalShowTitle,
          showPath: currentPath,
          // 从季目录递归下来时，季号继承上层（ctx.season）；
          // 否则用本层的目录名或默认第 1 季
          season: ctx.season != null ? ctx.season : ownSeason != null ? ownSeason : "1",
          seasonPath: currentPath,
          folderId: currentRef.folderId,
          sample: videos[0],
          confidence: judged.confidence
        });
      }
      if (!seasonSubdirs.length) {
        videos.forEach((v) => {
          if (belongsToShow(v, finalShowTitle))
            return;
          emitFile(v, joinPath(currentPath, v.name), judged.confidence);
          flushBatch();
        });
      }
    } else if (judged.shape === "files") {
      videos.forEach((v) => {
        emitFile(v, joinPath(currentPath, v.name), judged.confidence);
        flushBatch();
      });
    }
    flushBatch();
    const walkChild = (folder) => {
      if (shouldStop())
        return Promise.resolve();
      const childPath = joinPath(currentPath, folder.name);
      folders.push({ path: childPath, ref: { path: childPath, folderId: folder.id }, name: folder.name });
      const season = extractSeason(folder.name);
      if (season != null && judged.shape === "show") {
        let showTitle;
        let showPath;
        if (videos.length && !dirIsGeneric) {
          showTitle = extractShowTitle(selfName) || selfName;
          showPath = currentPath;
        } else {
          const fromDir = extractShowTitle(folder.name);
          if (fromDir && !isGenericDirName(fromDir)) {
            showTitle = fromDir;
            showPath = childPath;
          } else {
            showTitle = dirIsGeneric ? "" : extractShowTitle(selfName) || selfName;
            showPath = currentPath;
          }
        }
        if (ctx.showTitle) {
          return walkNode(
            { path: childPath, folderId: folder.id },
            childPath,
            depth + 1,
            { showTitle: ctx.showTitle, season: ctx.season != null ? ctx.season : season }
          );
        }
        if (showTitle) {
          emitShow({
            title: showTitle,
            showPath,
            season,
            seasonPath: childPath,
            folderId: folder.id,
            sample: videos[0],
            confidence: judged.confidence
          });
        }
        return walkNode(
          { path: childPath, folderId: folder.id },
          childPath,
          depth + 1,
          { showTitle, season }
        );
      }
      return walkNode({ path: childPath, folderId: folder.id }, childPath, depth + 1, ctx);
    };
    let children = [];
    try {
      children = subFolders.map(walkChild);
    } catch (e) {
      console.warn("[scrape/scan] \u5B50\u76EE\u5F55\u5C55\u5F00\u5F02\u5E38:", type, currentPath, e);
      skipped.push({ path: currentPath, message: e?.message || String(e), code: e?.code });
    }
    const settled = await Promise.allSettled(children);
    settled.forEach((r, i) => {
      if (r.status !== "rejected" || fatalError)
        return;
      const folder = subFolders[i];
      const path = joinPath(currentPath, folder?.name || "");
      const e = r.reason;
      skipped.push({ path, message: e?.message || String(e), code: e?.code });
      console.warn("[scrape/scan] \u5B50\u6811\u5F02\u5E38\u8DF3\u8FC7:", type, path, e);
    });
    flushBatch();
  };
  try {
    await walkNode(ref, ref.path || "", 0);
    if (fatalError)
      throw fatalError;
  } catch (e) {
    flushBatch(true);
    console.warn("[scrape/scan] \u626B\u63CF\u5931\u8D25:", type, ref, e);
    throw e;
  }
  flushBatch(true);
  return { items, folders, cancelled, skipped };
};
export {
  createGate,
  isBlacklisted,
  joinPath,
  scanFolderTree
};
