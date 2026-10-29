// @vitest-environment node

import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises'
import { realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAssetServer, type BrowserHmrChannel } from 'remix/assets'
import { createJsonModuleLoader } from './json-module-loader'

const cleanups: Array<() => Promise<void>> = []

afterEach(async () => {
  for (const cleanup of cleanups.reverse()) await cleanup()
  cleanups.length = 0
})

/** Creates independent source files and a real Remix compiler with an observable HMR channel. */
async function createFixture(files: Record<string, string>, enableHmr = true) {
  const root = realpathSync(await mkdtemp(join(tmpdir(), 'elce-json-assets-')))
  cleanups.push(() => rm(root, { recursive: true, force: true }))
  for (const [name, contents] of Object.entries(files)) {
    await mkdir(dirname(join(root, name)), { recursive: true })
    await writeFile(join(root, name), contents)
  }
  const watched = new Set<string>()
  let handler: Parameters<BrowserHmrChannel['onFileEvents']>[0] | undefined
  const close = vi.fn()
  const baseChannel: BrowserHmrChannel = {
    url: 'http://localhost:1/events',
    close,
    updateWatchedFiles(delta) {
      for (const file of delta.remove) watched.delete(file)
      for (const file of delta.add) watched.add(file)
    },
    onFileEvents(callback) {
      handler = callback
      return () => { handler = undefined }
    },
  }
  const allowFiles = ['src/**']
  const denyFiles = ['src/private/**']
  const jsonModules = createJsonModuleLoader({ rootDirectory: root, allowFiles, denyFiles })
  const assets = createAssetServer({
    rootDir: root,
    basePath: '/assets',
    mounts: { app: 'src' },
    allowFiles,
    denyFiles,
    scripts: { loaders: [jsonModules.load] },
    sourceMaps: 'external',
    minify: !enableHmr,
    watch: enableHmr ? { poll: true, pollInterval: 60_000 } : false,
    hmr: enableHmr ? { channel: () => jsonModules.wrapHmrChannel(baseChannel) } : undefined,
  })
  cleanups.push(() => assets.close())

  /** Compiles and fetches the actual emitted browser entry. */
  async function compile(name = 'src/entry.ts') {
    const entry = await assets.getScriptEntry(name)
    const response = await assets.fetch(new Request(`http://elce.test${entry.href}`))
    expect(response?.status).toBe(200)
    return response!.text()
  }

  /** Sends a filesystem event through the channel used by the actual asset compiler. */
  async function emit(name: string, event: 'change' | 'add' | 'unlink' = 'change') {
    if (!handler) throw new Error('The Remix HMR handler is not connected')
    return handler([{ filePath: join(root, name), event }])
  }

  return { root, assets, compile, emit, watched, close, jsonModules }
}

/** Evaluates an emitted ESM entry with Node's native module loader, outside Vite's resolver. */
async function evaluateModule(source: string): Promise<Record<string, any>> {
  const url = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
  return import(/* @vite-ignore */ url)
}

describe('Elcé JSON asset imports', () => {
  it.each([
    { nested: [1, true, null, { label: 'été 🐈' }], text: '</script>\n\u2028' },
    [1, 'two', false],
    'a string',
    42,
    false,
    null,
  ].map((value) => ({ value })))('compiles and evaluates JSON value $value through the real asset server', async ({ value }) => {
    const fixture = await createFixture({
      'src/entry.ts': 'import data from "./data.json"; export default data',
      'src/data.json': JSON.stringify(value),
    })
    const source = await fixture.compile()
    expect((await evaluateModule(source)).default).toEqual(value)
  })

  it('shares identity across default, namespace, dynamic imports and reexports', async () => {
    const fixture = await createFixture({
      'src/entry.ts': `
        import first from './data.json'
        import * as namespace from './data.json'
        import alias from './alias.json'
        export { default as reexported } from './data.json'
        export { first, namespace, alias }
        export const dynamic = () => import('./data.json')
      `,
      'src/other.ts': 'export { default } from "./data.json"',
      'src/equal.json': '{"value":1}',
      'src/data.json': '{"value":1}',
      'src/equal.ts': 'export { default } from "./equal.json"',
    })
    await symlink(join(fixture.root, 'src/data.json'), join(fixture.root, 'src/alias.json'))
    const main = await evaluateModule(await fixture.compile())
    const other = await evaluateModule(await fixture.compile('src/other.ts'))
    const equal = await evaluateModule(await fixture.compile('src/equal.ts'))
    expect(main.first).toBe(main.namespace.default)
    expect(main.first).toBe(main.alias)
    expect(main.first).toBe(main.reexported)
    expect(main.first).toBe((await main.dynamic()).default)
    expect(main.first).toBe(other.default)
    expect(main.first).not.toBe(equal.default)
  })

  it('preserves JSON keys and leaves import-like comments and strings unchanged', async () => {
    const fixture = await createFixture({
      'src/entry.ts': `
        // import ignored from './missing.json'
        export const text = "import ignored from './missing.json'"
        import data from './data.json'
        export default data
      `,
      'src/data.json': '{"__proto__":{"visible":true}}',
    })
    const result = await evaluateModule(await fixture.compile())
    expect(result.text).toBe("import ignored from './missing.json'")
    expect(Object.hasOwn(result.default, '__proto__')).toBe(true)
    expect(Object.getPrototypeOf(result.default)).toBe(Object.prototype)
  })

  it('compiles JSON with production minification and no HMR channel', async () => {
    const fixture = await createFixture({
      'src/entry.ts': 'export { default } from "./data.json"',
      'src/data.json': '{"environment":"production","values":[1,null,true]}',
    }, false)
    expect((await evaluateModule(await fixture.compile())).default).toEqual({
      environment: 'production', values: [1, null, true],
    })
    expect(fixture.watched.size).toBe(0)
  })

  it('reports invalid and missing JSON instead of supplying substitute data', async () => {
    const fixture = await createFixture({
      'src/entry.ts': 'import data from "./data.json"; export default data',
      'src/data.json': '{broken',
    })
    await expect(fixture.compile()).rejects.toThrow('Invalid JSON import')
    await rm(join(fixture.root, 'src/data.json'))
    await fixture.emit('src/data.json', 'unlink')
    await expect(fixture.compile()).rejects.toThrow()
  })

  it.each(['./private/data.json', '../outside.json', './linked.json'])('enforces source access rules for %s', async (specifier) => {
    const fixture = await createFixture({
      'src/entry.ts': `import data from '${specifier}'; export default data`,
      'src/private/data.json': '{"secret":true}',
      'outside.json': '{"secret":true}',
    })
    await symlink(join(fixture.root, 'outside.json'), join(fixture.root, 'src/linked.json'))
    await expect(fixture.compile()).rejects.toThrow('JSON import is not allowed')
  })

  it('invalidates all consumers when JSON changes and recovers after removal or invalid data', async () => {
    const fixture = await createFixture({
      'src/entry.ts': 'export { default } from "./data.json"',
      'src/other.ts': 'export { default } from "./data.json"',
      'src/data.json': '{"revision":1}',
    })
    await fixture.compile()
    await fixture.compile('src/other.ts')
    await vi.waitFor(() => expect(fixture.watched.has(join(fixture.root, 'src/data.json'))).toBe(true))
    await writeFile(join(fixture.root, 'src/data.json'), '{"revision":2}')
    expect((await fixture.emit('src/data.json')).length).toBeGreaterThan(0)
    expect((await evaluateModule(await fixture.compile())).default).toEqual({ revision: 2 })
    expect((await evaluateModule(await fixture.compile('src/other.ts'))).default).toEqual({ revision: 2 })

    await writeFile(join(fixture.root, 'src/data.json'), '{invalid')
    await fixture.emit('src/data.json')
    await expect(fixture.compile()).rejects.toThrow('Invalid JSON import')
    await rm(join(fixture.root, 'src/data.json'))
    await fixture.emit('src/data.json', 'unlink')
    await expect(fixture.compile()).rejects.toThrow()
    await writeFile(join(fixture.root, 'src/data.json'), '{"revision":3}')
    await fixture.emit('src/data.json', 'add')
    expect((await evaluateModule(await fixture.compile())).default).toEqual({ revision: 3 })
  })

  it('removes stale dependencies after an import changes and closes the existing channel', async () => {
    const fixture = await createFixture({
      'src/entry.ts': 'export { default } from "./data.json"',
      'src/data.json': '{"revision":1}',
      'src/next.json': '{"revision":2}',
    })
    await fixture.compile()
    await writeFile(join(fixture.root, 'src/entry.ts'), 'export { default } from "./next.json"')
    await fixture.emit('src/entry.ts')
    await fixture.compile()
    expect(fixture.watched.has(join(fixture.root, 'src/data.json'))).toBe(false)
    expect(fixture.watched.has(join(fixture.root, 'src/next.json'))).toBe(true)
    await fixture.assets.close()
    expect(fixture.close).toHaveBeenCalledOnce()
  })

  it('leaves scripts with no JSON imports unchanged', async () => {
    const fixture = await createFixture({ 'src/entry.ts': 'export const count = 3' })
    const result = fixture.jsonModules.load(pathToFileURL(join(fixture.root, 'src/entry.ts')).href, {
      format: 'module', conditions: [], importAttributes: {},
    }, () => ({ format: 'module', source: 'export const count = 3' }))
    expect(result.source).toBe('export const count = 3')
  })
})
