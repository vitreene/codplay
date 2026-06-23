import { resolve } from 'path'
import { defineConfig } from 'vite'

// Mirrors packages/demos/vite.config.ts: this repo does not depend on `three`
// directly — the real package lives in a sibling project. Tests that import
// model-loader.ts (a static `three`/`three/addons` import, even when
// loadModel() itself is never called) need the same resolution to load at all.
const THREE_ROOT = '/Users/hervesaintmacary/Projets/vitreene/timeline/node_modules/three'

export default defineConfig({
  resolve: {
    alias: [
      { find: /^three\/addons\/(.*)$/, replacement: resolve(THREE_ROOT, 'examples/jsm/$1') },
      { find: 'three', replacement: resolve(THREE_ROOT, 'build/three.module.js') },
    ],
  },
})
