import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
// 테일윈드 사용하기 위해 tailwind import
import tailwindcss from '@tailwindcss/vite'

// 테일윈드 사용하기 위해 tailwindcss() plugin 추가
export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react(), tailwindcss()]
  }
})
