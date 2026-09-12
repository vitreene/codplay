import { resolve } from 'node:path'
import { defineConfig } from 'vite'

/** Resolves the sibling CodPlay source when running Sighty's package tests. */
export default defineConfig({
  resolve: {
    alias: [
      { find: /^codplay\/(.*)/, replacement: resolve(__dirname, '../codplay/src/$1') },
      { find: 'codplay', replacement: resolve(__dirname, '../codplay/src/index.ts') },
      { find: /^ace\/(.*)/, replacement: resolve(__dirname, '../codplay/src/ace/$1') },
      { find: 'ace', replacement: resolve(__dirname, '../codplay/src/ace/index.ts') },
    ],
  },
})
