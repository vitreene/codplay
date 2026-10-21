import { resolve } from 'node:path'
import { defineConfig } from 'vite'

/** Resolves CodPlay's internal ACE specifier when Sighty tests load workspace source. */
export default defineConfig({
  resolve: {
    alias: [
      { find: /^ace\/(.*)/, replacement: resolve(__dirname, '../codplay/src/ace/$1') },
      { find: 'ace', replacement: resolve(__dirname, '../codplay/src/ace/index.ts') },
    ],
  },
})
