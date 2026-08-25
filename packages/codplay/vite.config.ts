import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@codplay\/demos\/(.*)/, replacement: resolve(__dirname, '../demos/src/v1/$1') },
      { find: '@codplay/demos', replacement: resolve(__dirname, '../demos/src/v1') },
      { find: '@codplay/capsule-automation', replacement: resolve(__dirname, '../authoring/capsule-automation/src/index.ts') },
      // When demo files (loaded transitively via @codplay/demos) import back from codplay, resolve to local src
      { find: /^codplay\/(.*)/, replacement: resolve(__dirname, './src/$1') },
      { find: 'codplay', replacement: resolve(__dirname, './src/index.ts') },
    ],
  },
})
