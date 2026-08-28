import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: [
      { find: /^codplay-v1\/(.*)/, replacement: resolve(__dirname, '../../codplay-v1/src/$1') },
      { find: 'codplay-v1', replacement: resolve(__dirname, '../../codplay-v1/src/index.ts') },
      { find: '@codplay/capsule-automation', replacement: resolve(__dirname, '../capsule-automation/src/index.ts') },
    ],
  },
  test: {
    include: ['tests/**/*.spec.ts'],
  },
})
