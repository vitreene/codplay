import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: [
      { find: /^ace\/(.*)/, replacement: resolve(__dirname, '../codplay/src/ace/$1') },
      { find: 'ace', replacement: resolve(__dirname, '../codplay/src/ace/index.ts') },
      { find: /^codplay\/(.*)/, replacement: resolve(__dirname, '../codplay/src/$1') },
      { find: 'codplay', replacement: resolve(__dirname, '../codplay/src/index.ts') },
      { find: /^codplay-v1\/(.*)/, replacement: resolve(__dirname, '../codplay-v1/src/$1') },
      { find: 'codplay-v1', replacement: resolve(__dirname, '../codplay-v1/src/index.ts') },
      { find: '@codplay/capsule-automation', replacement: resolve(__dirname, '../authoring/capsule-automation/src/index.ts') },
      { find: '@codplay/scene-factory', replacement: resolve(__dirname, '../authoring/scene-factory/src/index.ts') },
      { find: '@codplay/text-auto-size', replacement: resolve(__dirname, '../authoring/text-auto-size/src/index.ts') },
    ],
  },
  test: {
    include: ['tests/**/*.spec.ts'],
  },
})
