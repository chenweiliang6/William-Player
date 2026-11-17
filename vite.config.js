import { defineConfig } from 'vite'
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
        additionalData: `@import "nutui-uniapp/styles/variables.scss";`
      }
    }
  }
})