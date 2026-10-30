import { readFileSync, realpathSync } from 'node:fs'
import { matchesGlob, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { initSync, parse } from 'es-module-lexer'
import MagicString from 'magic-string'
import type { BrowserHmrChannel, ModuleLoader } from 'remix/assets'

type JsonModuleOptions = {
  rootDirectory: string
  allowFiles: readonly string[]
  denyFiles: readonly string[]
}

/** Compiles local JSON imports and attaches their dependencies to the existing Remix channel. */
export function createJsonModuleLoader(options: JsonModuleOptions) {
  initSync()
  const dependencies = new Map<string, Set<string>>()
  const scriptFiles = new Set<string>()
  let watchedFiles = new Set<string>()
  let channel: BrowserHmrChannel | undefined

  /** Applies the browser source access rules to an authored or canonical JSON path. */
  function assertAllowed(filePath: string): void {
    const localPath = relative(options.rootDirectory, filePath).replaceAll('\\', '/')
    if (!options.allowFiles.some((pattern) => matchesGlob(localPath, pattern))
      || options.denyFiles.some((pattern) => matchesGlob(localPath, pattern))) {
      throw new Error(`JSON import is not allowed by the asset server: ${filePath}`)
    }
  }

  /** Updates JSON watch targets alongside the script graph without creating another watcher. */
  function refreshWatchedFiles(): void {
    if (!channel) return
    const nextFiles = new Set(scriptFiles)
    for (const scriptFile of scriptFiles) {
      for (const dependency of dependencies.get(scriptFile) ?? []) nextFiles.add(dependency)
    }
    channel.updateWatchedFiles({
      add: [...nextFiles].filter((file) => !watchedFiles.has(file)),
      remove: [...watchedFiles].filter((file) => !nextFiles.has(file)),
    })
    watchedFiles = nextFiles
  }

  /** Rewrites actual import specifiers to shared, self-contained ESM URLs before Remix resolution. */
  const load: ModuleLoader = (url, context, nextLoad) => {
    const result = nextLoad(url, context)
    const source = typeof result.source === 'string'
      ? result.source
      : new TextDecoder().decode(result.source as Uint8Array | undefined)
    const importer = fileURLToPath(url)
    const importedFiles = new Set<string>()
    dependencies.set(importer, importedFiles)
    const transformed = new MagicString(source)
    try {
      const [imports] = parse(source)
      for (const imported of [...imports].reverse()) {
        const specifier = imported.n
        if (!specifier?.endsWith('.json')
          || !(specifier.startsWith('.') || specifier.startsWith('/') || specifier.startsWith('file:'))) continue
        const authoredPath = fileURLToPath(new URL(specifier, url))
        assertAllowed(authoredPath)
        importedFiles.add(authoredPath)
        const canonicalPath = realpathSync(authoredPath)
        assertAllowed(canonicalPath)
        importedFiles.add(canonicalPath)
        const jsonText = readFileSync(canonicalPath, 'utf8')
        try {
          JSON.parse(jsonText)
        } catch (cause) {
          throw new Error(`Invalid JSON import ${canonicalPath} from ${importer}`, { cause })
        }
        // The path distinguishes equal files; identical consumers share one module instance.
        const moduleSource = `// ${encodeURIComponent(canonicalPath)}\nexport default JSON.parse(${JSON.stringify(jsonText)});`
        const moduleUrl = `data:text/javascript;base64,${Buffer.from(moduleSource).toString('base64')}`
        const replacement = imported.d === -1 ? moduleUrl : JSON.stringify(moduleUrl)
        transformed.overwrite(imported.s, imported.e, replacement)
      }
    } finally {
      refreshWatchedFiles()
    }
    if (!transformed.hasChanged()) return result
    // Remix composes this map with the TypeScript transform's original source map.
    const sourceMap = transformed.generateMap({ source: url, includeContent: true, hires: true })
    return { ...result, source: `${transformed}\n//# sourceMappingURL=${sourceMap.toUrl()}` }
  }

  /** Routes JSON file events through the existing script invalidation and browser reload handler. */
  function wrapHmrChannel(baseChannel: BrowserHmrChannel): BrowserHmrChannel {
    channel = baseChannel
    return {
      url: baseChannel.url,
      close() {
        dependencies.clear()
        scriptFiles.clear()
        watchedFiles.clear()
        channel = undefined
        baseChannel.close()
      },
      updateWatchedFiles(delta) {
        for (const file of delta.remove) {
          scriptFiles.delete(file)
          dependencies.delete(file)
        }
        for (const file of delta.add) scriptFiles.add(file)
        refreshWatchedFiles()
      },
      onFileEvents(handler) {
        return baseChannel.onFileEvents(async (events) => {
          const expanded = new Map(events.map((event) => [event.filePath, event]))
          for (const event of events) {
            for (const [importer, importedFiles] of dependencies) {
              if (scriptFiles.has(importer) && importedFiles.has(event.filePath)) {
                expanded.set(importer, { filePath: importer, event: 'change' })
              }
            }
          }
          return handler([...expanded.values()])
        })
      },
    }
  }

  return { load, wrapHmrChannel }
}
