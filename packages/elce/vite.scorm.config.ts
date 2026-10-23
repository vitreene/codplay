import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const packageRoot = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  root: packageRoot,
  resolve: {
    alias: [
      { find: '@codplay/sighty-scorm/session', replacement: resolve(packageRoot, '../sighty-scorm/src/scorm-session.ts') },
      { find: '@codplay/sighty-scorm/limits', replacement: resolve(packageRoot, '../sighty-scorm/src/scorm-data-limits.ts') },
    ],
  },
  build: {
    emptyOutDir: true,
    lib: {
      entry: resolve(packageRoot, 'src/scorm/scorm-package-runtime.ts'),
      formats: ['es'],
      fileName: () => 'elce-scorm-runtime.js',
    },
    rollupOptions: {
      output: { codeSplitting: false },
    },
    target: 'es2022',
  },
})
