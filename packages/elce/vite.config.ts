import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
  },
  resolve: {
    alias: [
      { find: /^codplay\/(.*)/, replacement: resolve(__dirname, '../codplay/src/$1') },
      { find: 'codplay', replacement: resolve(__dirname, '../codplay/src/index.ts') },
      { find: /^ace\/(.*)/, replacement: resolve(__dirname, '../codplay/src/ace/$1') },
      { find: 'ace', replacement: resolve(__dirname, '../codplay/src/ace/index.ts') },
      { find: '@codplay/sighty', replacement: resolve(__dirname, '../sighty/src/index.ts') },
      { find: /^@codplay\/component-v2\/(.*)/, replacement: resolve(__dirname, '../authoring/component-v2/src/$1') },
      { find: '@codplay/component-v2', replacement: resolve(__dirname, '../authoring/component-v2/src/index.ts') },
    ],
  },
})
