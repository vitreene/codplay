import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 5173,
  },
  resolve: {
    alias: [
      { find: /^codplay\/(.*)/, replacement: resolve(__dirname, '../codplay/src/$1') },
      { find: 'codplay', replacement: resolve(__dirname, '../codplay/src/index.ts') },
      { find: '@codplay/capsule-automation', replacement: resolve(__dirname, '../authoring/capsule-automation/src/index.ts') },
    ],
  },
})
