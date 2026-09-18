import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const packageRoot = dirname(fileURLToPath(import.meta.url))

/** Resolves the V2 package against the source aliases used by CodPlay itself. */
export default defineConfig({
  resolve: {
    alias: [
      { find: /^codplay\/(.*)/, replacement: resolve(packageRoot, '../../codplay/src/$1') },
      { find: 'codplay', replacement: resolve(packageRoot, '../../codplay/src/index.ts') },
      { find: /^ace\/(.*)/, replacement: resolve(packageRoot, '../../codplay/src/ace/$1') },
      { find: 'ace', replacement: resolve(packageRoot, '../../codplay/src/ace/index.ts') },
    ],
  },
})
