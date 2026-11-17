const LOCALE_STORAGE_KEY = 'app_locale'
const TMDB_BASE_URL = 'https://api.tmdb.org/3'

export const getTmdbLanguage = () => {
  const locale = uni.getStorageSync(LOCALE_STORAGE_KEY) || 'zh-Hans'
  const mapping = {
    'zh-Hans': 'zh-CN',
    'zh-CN': 'zh-CN',
    en: 'en-US',
    'en-US': 'en-US',
    ko: 'ko-KR',
    'ko-KR': 'ko-KR',
    ja: 'ja-JP',
    'ja-JP': 'ja-JP',
  }
  return mapping[locale] || 'zh-CN'
}

const getTmdbApiKey = () => {
  return uni.getStorageSync('settingData').tmdbKey
}

// 429 最多重试次数。三次指数退避（1s/2s/4s）足够避开瞬时突发。
const RATE_LIMIT_MAX_RETRY = 3
const RATE_LIMIT_BASE_DELAY = 1000

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

export const requestTmdb = ({ url, data = {}, timeout }, attempt = 0) => {
  return new Promise((resolve, reject) => {
    uni.request({
      url,
      data: {
        ...data,
        language: getTmdbLanguage(),
        api_key: getTmdbApiKey(),
      },
      timeout,
      method: 'GET',
      header: {
        'Content-Type': 'application/json',
      },
      // 注意：uni.request 在 4xx/5xx 时走的也是 success 而不是 fail，
      // 所以 429 的判断必须写在这里。
      success: res => {
        if (res.statusCode === 429) {
          if (attempt >= RATE_LIMIT_MAX_RETRY) {
            const err = new Error('TMDB 请求过于频繁（429），重试已用尽')
            err.isRateLimited = true
            err.statusCode = 429
            reject(err)
            return
          }
          // 优先用服务端给的 Retry-After（秒），没有就指数退避
          const retryAfter = Number(res.header?.['Retry-After'] || res.header?.['retry-after'])
          const delay = Number.isFinite(retryAfter) && retryAfter > 0
            ? retryAfter * 1000
            : RATE_LIMIT_BASE_DELAY * Math.pow(2, attempt)
          sleep(delay)
            .then(() => requestTmdb({ url, data, timeout }, attempt + 1))
            .then(resolve)
            .catch(reject)
          return
        }
        resolve(res.data)
      },
      fail: error => {
        reject(error)
      },
    })
  })
}

export const searchMovieTvByType = (data, type) => {
  const params = { ...data }
  let url = ''
  if (type === 'movie') {
    url = `${TMDB_BASE_URL}/search/movie`
    params.primary_release_year = params.first_air_date_year
    delete params.first_air_date_year
  } else if (type === 'tv') {
    url = `${TMDB_BASE_URL}/search/tv`
  }
  return requestTmdb({
    url,
    data: {
      ...params,
      page: 1,
    },
    timeout: 10000,
  })
}

export const searchMovieTvMulti = data => {
  return requestTmdb({
    url: `${TMDB_BASE_URL}/search/multi`,
    data,
  })
}

export const getTvDetail = id => {
  return requestTmdb({
    url: `${TMDB_BASE_URL}/tv/${id}`,
  })
}

export const getMovieDetail = id => {
  return requestTmdb({
    url: `${TMDB_BASE_URL}/movie/${id}`,
  })
}

/**
 * 刮削用的精简详情。
 *
 * 搜索接口只返回 genre_ids / vote_average，没有季数与上映日期；
 * 而「共N季」和卡片日期都依赖详情。这里只要几个字段，
 * 不拉 cast/videos 之类的大块数据。
 */
export const getScrapeDetail = ({ id, mediaType }) => {
  const kind = mediaType === 'tv' ? 'tv' : 'movie'
  return requestTmdb({
    url: `${TMDB_BASE_URL}/${kind}/${id}`,
    timeout: 10000,
  })
}

export const getTvSeasonDetail = data => {
  return requestTmdb({
    url: `${TMDB_BASE_URL}/tv/${data.movieTvId}/season/${data.season}`,
  })
}

export const getMovieTvDetailById = (data, type) => {
  const params = JSON.parse(JSON.stringify(data))
  let url = ''
  if (type === 'movie') {
    url = `${TMDB_BASE_URL}/movie/${params.movieTvId}`
  } else if (type === 'tv') {
    url = `${TMDB_BASE_URL}/tv/${params.movieTvId}`
  }
  delete params.movieTvId
  return requestTmdb({
    url,
    data: params,
  })
}

export const getActorById = (data, type) => {
  const params = JSON.parse(JSON.stringify(data))
  if (!data.movieTvId || !params.movieTvId) return Promise.reject()
  let url = ''
  if (type === 'movie') {
    url = `${TMDB_BASE_URL}/movie/${params.movieTvId}/credits`
  } else if (type === 'tv') {
    url = `${TMDB_BASE_URL}/tv/${params.movieTvId}/credits`
  }
  return requestTmdb({ url })
}
