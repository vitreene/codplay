import { createReadStream, statSync } from 'node:fs'
import { extname, resolve } from 'node:path'
import { defineConfig } from 'vite'
import { resolveCodplayAuthoringImport } from './build/resolve-codplay-authoring'

const TH_ROOT = '/Users/hervesaintmacary/Projets/Talking-head'
const THREE_ROOT = resolve(__dirname, '../../node_modules/three')

const MIME: Record<string, string> = {
  '.glb':  'model/gltf-binary',
  '.mp3':  'audio/mpeg',
  '.mjs':  'text/javascript',
  '.json': 'application/json',
}

export default defineConfig({
  server: {
    port: 5173,
    fs: {
      allow: ['..', TH_ROOT],
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        fame: resolve(__dirname, 'fame.html'),
      },
    },
  },
  resolve: {
    alias: [
      { find: /^codplay\/(.*)/, replacement: resolve(__dirname, '../codplay/src/$1') },
      { find: 'codplay', replacement: resolve(__dirname, '../codplay/src/index.ts') },
      { find: /^three\/addons\/(.*)$/, replacement: resolve(THREE_ROOT, 'examples/jsm/$1') },
      { find: 'three', replacement: resolve(THREE_ROOT, 'build/three.module.js') },
    ],
  },
  plugins: [
    {
      name: 'resolve-codplay-authoring',
      resolveId(id: string) {
        return resolveCodplayAuthoringImport(id)
      },
    },
    {
      name: 'resolve-talkinghead',
      resolveId(id: string) {
        if (id === '@met4citizen/talkinghead') {
          return resolve(TH_ROOT, 'modules/talkinghead.mjs')
        }
      },
      transform(code: string, id: string) {
        if (id.endsWith('talkinghead.mjs')) {
          return code.replace(/\bimport\(moduleName\)/g, 'import(/* @vite-ignore */ moduleName)')
        }
      },
    },
    {
      name: 'talking-head-assets',
      configureServer(server) {
        // Serve /avatars/* from TalkingHead avatars directory
        server.middlewares.use((req, res, next) => {
          if (!req.url?.startsWith('/avatars/')) return next()
          const fileName = req.url.slice('/avatars/'.length).split('?')[0]!
          const filePath = resolve(TH_ROOT, 'avatars', fileName)
          try {
            const stat = statSync(filePath)
            res.setHeader('Content-Type', MIME[extname(filePath)] ?? 'application/octet-stream')
            res.setHeader('Content-Length', stat.size)
            createReadStream(filePath).pipe(res)
          } catch {
            next()
          }
        })
      },
    },
  ],
})
