import { resolve } from 'path'
import { defineConfig } from 'vite'

// Mirrors avatar3d/tsconfig.json paths + packages/codplay-v1/vite.config.ts and
// packages/authoring/components/avatar-engine/vite.config.ts — avatar3d
// imports both `codplay-v1` (runtime base classes) and `three` at runtime now
// that Avatar3DBaseComponent builds its own renderer/scene/camera.
const THREE_ROOT = '/Users/hervesaintmacary/Projets/vitreene/timeline/node_modules/three'

export default defineConfig({
  resolve: {
    alias: [
      { find: /^three\/addons\/(.*)$/, replacement: resolve(THREE_ROOT, 'examples/jsm/$1') },
      { find: 'three', replacement: resolve(THREE_ROOT, 'build/three.module.js') },
      { find: /^codplay-v1\/(.*)/, replacement: resolve(__dirname, '../../../codplay-v1/src/$1') },
      { find: 'codplay-v1', replacement: resolve(__dirname, '../../../codplay-v1/src/index.ts') },
    ],
  },
})
