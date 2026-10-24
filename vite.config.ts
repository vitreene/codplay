import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const repositoryRoot = fileURLToPath(new URL('.', import.meta.url))
const aceSource = resolve(repositoryRoot, 'packages/codplay/src/ace')

export default defineConfig({
  resolve: {
    alias: [
      { find: /^ace\/(.*)/, replacement: `${aceSource}/$1` },
      { find: /^ace$/, replacement: resolve(aceSource, 'index.ts') },
    ],
  },
})
