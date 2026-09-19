import { resolve } from 'path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

// Resolve Three from this workspace so tests and the package use the declared dependency.
const THREE_ROOT = fileURLToPath(new URL('../../../../node_modules/three', import.meta.url))

export default defineConfig({
  resolve: {
    alias: [
      { find: /^three\/addons\/(.*)$/, replacement: resolve(THREE_ROOT, 'examples/jsm/$1') },
      { find: 'three', replacement: resolve(THREE_ROOT, 'build/three.module.js') },
    ],
  },
})
