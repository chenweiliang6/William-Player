import { createRouter, createWebHistory, createWebHashHistory } from 'vue-router'
import Layout from '@/layout/index.vue'

const constantRoutes = [
  {
    path: '/',
    component: Layout,
    redirect: '/entry',
    children: [
      {
        path: 'entry',
        component: () => import('@/pages/electron/login/entry'),
        name: 'Entry',
        meta: { titleKey: 'pc.route.entry', hideSidebar: true, noTransition: true },
      },
      {
        path: 'login',
        component: () => import('@/pages/electron/login/index'),
        name: 'Login',
        meta: { titleKey: 'pc.route.login', hideSidebar: true, noTransition: true },
      },
      {
        path: 'home',
        component: () => import('@/pages/electron/home/index'),
        name: 'Home',
        meta: { titleKey: 'pc.route.home' },
      },
      {
        path: 'emby',
        component: () => import('@/pages/electron/emby/index'),
        name: 'Emby',
        meta: { titleKey: 'pc.route.emby' },
      },
      {
        path: 'live',
        component: () => import('@/pages/electron/live/index'),
        name: 'Live',
        meta: { titleKey: 'pc.route.live' },
      },
      {
        path: 'settings',
        component: () => import('@/pages/electron/settings/index'),
        name: 'Settings',
        meta: { titleKey: 'pc.route.settings' },
      },
      {
        path: 'homeDetail',
        component: () => import('@/pages/electron/home/detail'),
        name: 'HomeDetail',
        meta: { titleKey: 'pc.route.detail' },
      },
      {
        path: 'homeAll',
        component: () => import('@/pages/electron/home/all'),
        name: 'HomeAll',
        meta: { titleKey: 'pc.route.all' },
      },
      {
        path: 'search',
        component: () => import('@/pages/electron/search/index'),
        name: 'Search',
        meta: { titleKey: 'pc.route.search' },
      },
      {
        path: 'embyAll',
        component: () => import('@/pages/electron/emby/emby-all'),
        name: 'EmbyAll',
        meta: { titleKey: 'pc.route.embyAll' },
      },
      {
        path: 'embyDetail',
        component: () => import('@/pages/electron/emby/emby-detail'),
        name: 'embyDetail',
        meta: { titleKey: 'pc.route.detail' },
      },
      {
        path: 'embyAll-copy',
        component: () => import('@/pages/electron/emby/emby-all'),
        name: 'EmbyAllCopy',
        meta: { titleKey: 'pc.route.embyAll' },
      },
      {
        path: 'sourceList',
        component: () => import('@/pages/electron/source/source-list'),
        name: 'SourceList',
        meta: { titleKey: 'pc.route.sourceList' },
      },
      {
        path: 'mediaList',
        component: () => import('@/pages/electron/media/list'),
        name: 'MediaList',
        meta: { titleKey: 'pc.route.mediaList' },
      },
      {
        path: 'appreciate',
        component: () => import('@/pages/electron/settings/appreciate'),
        name: 'Appreciate',
        meta: { titleKey: 'pc.route.appreciate' },
      },
      {
        path: 'iframe',
        component: () => import('@/pages/electron/settings/iframe'),
        name: 'Iframe',
        meta: { titleKey: 'pc.route.iframe' },
      },
      {
        path: 'qqTalk',
        component: () => import('@/pages/electron/settings/qq-talk'),
        name: 'QqTalk',
        meta: { titleKey: 'pc.route.qqTalk' },
      },
      {
        path: 'about-version',
        component: () => import('@/pages/electron/settings/about-version'),
        name: 'AboutVersion',
        meta: { titleKey: 'pc.route.about' },
      },
      {
        path: 'catelog-mulu',
        component: () => import('@/pages/electron/media/catelog-mulu'),
        name: 'CatelogMulu',
        meta: { titleKey: 'pc.route.directorySetting' },
      },
    ],
  },
  {
    path: '/',
    component: Layout,
    children: [
      {
        path: 'video',
        component: () => import('@/pages/electron/video/video-player'),
        name: 'Video',
        meta: { titleKey: 'pc.route.player', icon: 'user', hideSidebar: true },
      },
    ],
  },
  // 更多路由配置...
]

const router = createRouter({
  history: createWebHashHistory(),
  routes: constantRoutes,
  h5: {
    //配置了之后就可以不用uniapp的那套路由了
    vueRouterDev: true, //完全使用vue-router开发 默认 false
  },
})

export default router
