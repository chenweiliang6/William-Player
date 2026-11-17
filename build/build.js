#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { execSync, spawn } = require('child_process')

// 支持的平台类型
const PLATFORMS = {
  PC: 'PC',
  MOBILE: 'MOBILE',
  TV: 'TV',
}

// 命令行参数解析
const args = process.argv.slice(2)
const platform = args[0]?.toUpperCase()
const isDev = args.includes('--dev')

// 验证平台参数
if (!platform || !PLATFORMS[platform]) {
  console.error('请指定平台: pc, mobile 或 tv')
  console.log('用法: npm run build <platform> [--dev]')
  process.exit(1)
}

console.log(`开始构建 ${platform} 平台${isDev ? '开发环境' : '生产环境'}...`)

// 获取项目根目录（脚本所在目录的上一级）
const rootDir = path.resolve(__dirname, '..')

// 文件路径（基于项目根目录）
const configJsPath = path.resolve(rootDir, 'src/utils/config.js')
const pagesJsonPath = path.resolve(rootDir, 'src/pages.json')
const appVuePath = path.resolve(rootDir, 'src/App.vue')
const templateDir = path.resolve(rootDir, 'config-pages-json')
const commonJsPath = path.resolve(rootDir, 'src/utils/common.js')
const mainJsPath = path.resolve(rootDir, 'src/main.js') // 新增main.js路径

console.log('项目根目录:', rootDir)
console.log('config.js 路径:', configJsPath)
console.log('App.vue 路径:', appVuePath)
console.log('pages.json 路径:', pagesJsonPath)
console.log('common.js 路径:', commonJsPath)
console.log('main.js 路径:', mainJsPath)

// 修改config.js文件
function modifyConfigJs() {
  try {
    let content = fs.readFileSync(configJsPath, 'utf8')

    // 使用正则表达式替换PLATFORM的值
    const pattern = /(export const PLATFORM = ')(.*)(')/
    content = content.replace(pattern, `$1${platform}$3`)

    fs.writeFileSync(configJsPath, content, 'utf8')
    console.log('✓ 成功修改 config.js 中的 PLATFORM')
    return true
  } catch (error) {
    console.error('✗ 修改 config.js 失败:', error.message)
    return false
  }
}

// 使用模板替换pages.json
function replacePagesJson() {
  try {
    const templatePath = path.join(templateDir, `${platform.toLowerCase()}-pages.json`)

    if (!fs.existsSync(templatePath)) {
      console.error(`✗ 模板文件不存在: ${templatePath}`)
      return false
    }

    const templateContent = fs.readFileSync(templatePath, 'utf8')
    fs.writeFileSync(pagesJsonPath, templateContent, 'utf8')
    console.log('✓ 成功应用 pages.json 模板')
    return true
  } catch (error) {
    console.error('✗ 替换 pages.json 失败:', error.message)
    return false
  }
}
// 生成App.vue内容
function generateAppVueContent() {
  try {
    // 读取基础模板
    const baseAppPath = path.join(templateDir, 'base-app.vue')
    if (!fs.existsSync(baseAppPath)) {
      console.error(`✗✗ 基础模板文件不存在: ${baseAppPath}`)
      return false
    }

    let content = fs.readFileSync(baseAppPath, 'utf8')

    // 如果是PC平台，添加额外的模板代码
    if (platform === PLATFORMS.PC) {
      // 直接在代码中定义PC模板
      const pcTemplate = `<template>
  <div id="app1">
    <router-view></router-view>
  </div>
</template>`

      // 将PC模板插入到基础模板的<script>标签之前
      content = content.replace('<script>', `${pcTemplate}\n<script>`)
    }

    // 如果是MOBILE平台，在条件编译注释下插入屏幕方向锁定代码
    if (platform === PLATFORMS.MOBILE) {
      const targetComment = '// #ifdef APP-PLUS'
      const orientationCode = '    plus.screen.lockOrientation("portrait-primary");'

      // 查找目标注释位置
      const targetIndex = content.indexOf(targetComment)
      if (targetIndex !== -1) {
        // 计算目标注释所在行的结束位置（下一个换行符）
        const lineEndIndex = content.indexOf('\n', targetIndex)

        if (lineEndIndex !== -1) {
          // 在目标注释行的下一行插入方向锁定代码
          content = content.slice(0, lineEndIndex + 1) + orientationCode + '\n' + content.slice(lineEndIndex + 1)
        }
      }
    }
    return content
  } catch (error) {
    console.error('✗✗ 生成 App.vue 内容失败:', error.message)
    return false
  }
}

// 修改App.vue文件
function modifyAppVue() {
  try {
    const content = generateAppVueContent()
    if (!content) {
      return false
    }

    fs.writeFileSync(appVuePath, content, 'utf8')
    console.log('✓ 成功修改 App.vue')
    return true
  } catch (error) {
    console.error('✗✗ 修改 App.vue 失败:', error.message)
    return false
  }
}
// 修改common.js文件
function modifyCommonJs() {
  try {
    let content = fs.readFileSync(commonJsPath, 'utf8')

    // 定义需要处理的两行import语句
    const ipcImport = `import { ipc } from "@/utils/ipcRenderer";`
    const ipcApiRouteImport = `import { ipcApiRoute } from "@/utils/ipcApiRoute";`

    // 如果是PC平台，确保这两行没有被注释
    if (platform === PLATFORMS.PC) {
      // 取消注释ipc导入
      content = content.replace(new RegExp(`\\/\\/\\s*${ipcImport}`), ipcImport)
      content = content.replace(new RegExp(`\\/\\/\\s*${ipcApiRouteImport}`), ipcApiRouteImport)

      // 如果这两行不存在，则添加它们
      if (!content.includes(ipcImport)) {
        // 找到第一个import语句的位置，在其后添加
        const firstImportIndex = content.indexOf('import ')
        if (firstImportIndex !== -1) {
          const nextLineIndex = content.indexOf('\n', firstImportIndex) + 1
          content = content.slice(0, nextLineIndex) + ipcImport + '\n' + ipcApiRouteImport + '\n' + content.slice(nextLineIndex)
        }
      }
    } else {
      const uncommentedIpcPattern = /^(\s*)(import\s*{\s*ipc\s*}\s*from\s*["']@\/utils\/ipcRenderer["'];?\s*)$/m
      // 匹配未被注释的 ipcApiRoute import 语句
      const uncommentedIpcApiRoutePattern = /^(\s*)(import\s*{\s*ipcApiRoute\s*}\s*from\s*["']@\/utils\/ipcApiRoute["'];?\s*)$/m

      // 只有当语句未被注释时，才添加注释符号
      if (uncommentedIpcPattern.test(content)) {
        content = content.replace(uncommentedIpcPattern, `$1// $2`)
      }
      if (uncommentedIpcApiRoutePattern.test(content)) {
        content = content.replace(uncommentedIpcApiRoutePattern, `$1// $2`)
      }
    }

    fs.writeFileSync(commonJsPath, content, 'utf8')
    console.log('✓ 成功修改 common.js')
    return true
  } catch (error) {
    console.error('✗✗ 修改 common.js 失败:', error.message)
    return false
  }
}
// 修改vite.config.js文件 - 直接生成对应配置
function modifyViteConfig() {
  try {
    const viteConfigPath = path.resolve(rootDir, 'vite.config.js')
    if (!fs.existsSync(viteConfigPath)) {
      console.error('✗ vite.config.js 文件不存在')
      return false
    }

    let content

    if (platform === PLATFORMS.PC) {
      content = `import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'
import UniComponents from "@uni-helper/vite-plugin-uni-components";
import { NutResolver } from "nutui-uniapp";
import { createSvgIconsPlugin } from 'vite-plugin-svg-icons'
import path from 'path'
import { nutuiRafShim } from './build/vite-plugin-nutui-raf.js'

export default defineConfig({
  plugins: [
    uni(),
    nutuiRafShim(),
    UniComponents({
      resolvers: [
        NutResolver(),
      ]
    }),
    createSvgIconsPlugin({
      iconDirs: [path.resolve(process.cwd(), 'src/static/svg')],
      symbolId: 'icon-[dir]-[name]',
      svgoOptions: true
    })
  ],
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: \`@import "nutui-uniapp/styles/variables.scss";\`
      }
    }
  }
})`
      console.log('✓ 已生成 PC 平台专用配置')
    } else {
      content = `import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'
import UniComponents from "@uni-helper/vite-plugin-uni-components";
import { NutResolver } from "nutui-uniapp";
import { nutuiRafShim } from './build/vite-plugin-nutui-raf.js'

export default defineConfig({
  plugins: [
    uni(),
    nutuiRafShim(),
    UniComponents({
      resolvers: [
        NutResolver(),
      ]
    })
  ],
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: \`@import "nutui-uniapp/styles/variables.scss";\`
      }
    }
  }
})`
      console.log('✓ 已生成非 PC 平台专用配置')
    }

    fs.writeFileSync(viteConfigPath, content, 'utf8')
    console.log('✓ 成功重写 vite.config.js')
    return true
  } catch (error) {
    console.error('✗ 修改 vite.config.js 失败:', error.message)
    return false
  }
}

// 修改main.js文件
function modifyMainJs() {
  try {
    let content

    if (platform === PLATFORMS.PC) {
      // PC平台的main.js内容
      content = `import {
\tcreateSSRApp
} from "vue";
import { createPinia } from 'pinia'
import App from "./App.vue";
import i18n from './i18n'
import router from "./router/index.js";
import 'virtual:svg-icons-register'
import 'element-plus/dist/index.css'

export function createApp() {
\tconst app = createSSRApp(App);
\tconst pinia = createPinia()
\tapp.use(pinia)
\tapp.use(i18n)
\tapp.use(router)
\tapp.mount('#app1')
\treturn {
\t\tapp,
\t};
}`
      console.log('✓ 已生成 PC 平台 main.js 配置')
    } else {
      // 非PC平台（MOBILE/TV）的main.js内容
      content = `import {
\tcreateSSRApp
} from "vue";
import { createPinia } from 'pinia'
import App from "./App.vue";
import i18n from './i18n'

export function createApp() {
\tconst app = createSSRApp(App);
\tconst pinia = createPinia()
\tapp.use(pinia)
\tapp.use(i18n)
\t// 非PC平台直接挂载，不需要路由
\treturn {
\t\tapp,
\t};
}`
      console.log('✓ 已生成非 PC 平台 main.js 配置')
    }

    fs.writeFileSync(mainJsPath, content, 'utf8')
    console.log('✓ 成功修改 main.js')
    return true
  } catch (error) {
    console.error('✗ 修改 main.js 失败:', error.message)
    return false
  }
}

// 修改package.json文件
function modifyPackageJson() {
  try {
    const packageJsonPath = path.resolve(rootDir, 'package.json')
    if (!fs.existsSync(packageJsonPath)) {
      console.error('✗ package.json 文件不存在')
      return false
    }

    const packageData = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
    let changed = false

    if (platform === PLATFORMS.PC) {
      // 确保PC平台有element-plus
      if (!packageData.dependencies['element-plus']) {
        packageData.dependencies['element-plus'] = '^2.8.4'
        changed = true
        console.log('✓ 添加 element-plus 到 dependencies')
      }
      // 确保PC平台有xgplayer
      if (!packageData.dependencies['xgplayer']) {
        packageData.dependencies['xgplayer'] = '^3.0.23'
        changed = true
        console.log('✓ 添加 xgplayer 到 dependencies')
      }
      // 确保PC平台有xgplayer-hls
      if (!packageData.dependencies['xgplayer-hls']) {
        packageData.dependencies['xgplayer-hls'] = '^3.0.23'
        changed = true
        console.log('✓ 添加 xgplayer-hls 到 dependencies')
      }
    } else {
      // 非PC平台删除这些依赖
      if (packageData.dependencies['element-plus']) {
        delete packageData.dependencies['element-plus']
        changed = true
        console.log('✓ 从 dependencies 中移除 element-plus')
      }
      if (packageData.dependencies['xgplayer']) {
        delete packageData.dependencies['xgplayer']
        changed = true
        console.log('✓ 从 dependencies 中移除 xgplayer')
      }
      if (packageData.dependencies['xgplayer-hls']) {
        delete packageData.dependencies['xgplayer-hls']
        changed = true
        console.log('✓ 从 dependencies 中移除 xgplayer-hls')
      }
    }

    if (changed) {
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageData, null, 2), 'utf8')
      console.log('✓ 成功修改 package.json')
    } else {
      console.log('✓ package.json 无需修改')
    }

    return true
  } catch (error) {
    console.error('✗ 修改 package.json 失败:', error.message)
    return false
  }
}
// 主函数
async function main() {
  try {
    // 修改配置文件
    if (!modifyConfigJs() || !replacePagesJson() || !modifyAppVue() || !modifyCommonJs() || !modifyViteConfig() || !modifyMainJs() || !modifyPackageJson()) {
      process.exit(1)
    }

    console.log(`✓ ${platform} 平台配置修改完成!`)
    console.log('配置文件已更新，请使用 uni 命令启动开发服务器或构建')
  } catch (error) {
    console.error('配置修改过程出错:', error.message)
    process.exit(1)
  }
}

// 执行主函数
main()
