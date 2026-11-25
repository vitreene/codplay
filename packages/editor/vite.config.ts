import { resolve } from 'path'
import { defineConfig } from 'vite'

const editorApiPort = Number(process.env.EDITOR_API_PORT ?? 5182)

export default defineConfig({
  server: {
    port: 5174,
    strictPort: true,
    proxy: {
      '/api': `http://127.0.0.1:${editorApiPort}`,
    },
  },
  resolve: {
    alias: [
      { find: /^ace\/(.*)/, replacement: resolve(__dirname, '../codplay/src/ace/$1') },
      { find: 'ace', replacement: resolve(__dirname, '../codplay/src/ace/index.ts') },
      { find: /^codplay\/(.*)/, replacement: resolve(__dirname, '../codplay/src/$1') },
      { find: 'codplay', replacement: resolve(__dirname, '../codplay/src/index.ts') },
      { find: '@codplay/selection-frame/v2', replacement: resolve(__dirname, '../authoring/selection-frame/src/v2.ts') },
      { find: /^@codplay\/selection-frame\/(.*)/, replacement: resolve(__dirname, '../authoring/selection-frame/src/$1') },
      { find: '@codplay/capsule-automation', replacement: resolve(__dirname, '../authoring/capsule-automation/src/index.ts') },
      { find: '@codplay/text-auto-size', replacement: resolve(__dirname, '../authoring/text-auto-size/src/index.ts') },
    ],
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
    },
  },
})
