import { resolve } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  resolve: {
    alias: [
      { find: /^codplay\/(.*)/, replacement: resolve(__dirname, 'src/$1') },
      { find: 'codplay', replacement: resolve(__dirname, 'src/index.ts') },
      { find: /^ace\/(.*)/, replacement: resolve(__dirname, 'src/ace/$1') },
      { find: 'ace', replacement: resolve(__dirname, 'src/ace/index.ts') },
    ],
  },
})
