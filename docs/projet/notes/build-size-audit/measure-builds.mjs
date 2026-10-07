import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  statSync,
  utimesSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build, rolldownVersion, version as viteVersion } from 'vite'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..')
const artifactRoot = join(repositoryRoot, 'dist')
mkdirSync(artifactRoot, { recursive: true })
const outputRoot = mkdtempSync(join(artifactRoot, 'build-size-audit-'))
const fixedTimestamp = new Date('2000-01-01T00:00:00Z')
const measurements = []
const variants = [
  { id: 'codplay', packageDirectory: 'codplay', externalCodplay: false },
  { id: 'sighty', packageDirectory: 'sighty', externalCodplay: true },
  { id: 'sighty-with-codplay', packageDirectory: 'sighty', externalCodplay: false },
]

/** Lists regular files beneath one directory in a reproducible order. */
function listFiles(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(directory, entry.name)
      return entry.isDirectory() ? listFiles(path) : entry.isFile() ? [path] : []
    })
    .sort()
}

/** Records the exact byte length and digest of one generated artifact. */
function describeFile(path) {
  const content = readFileSync(path)
  return {
    path: relative(outputRoot, path),
    bytes: content.length,
    sha256: createHash('sha256').update(content).digest('hex'),
  }
}

/** Groups bundled source modules by their owning workspace or dependency. */
function groupModules(moduleIds) {
  const counts = {}
  for (const id of moduleIds) {
    const path = relative(repositoryRoot, id)
    const owner = path.startsWith('packages/')
      ? path.split('/').slice(0, 2).join('/')
      : path.startsWith('node_modules/') ? 'node_modules' : 'generated'
    counts[owner] = (counts[owner] ?? 0) + 1
  }
  return counts
}

/** Builds one public entry, archives its outputs, and verifies the ZIP bytes. */
async function measureVariant(variant, minified) {
  const packageRoot = join(repositoryRoot, 'packages', variant.packageDirectory)
  const outputDirectory = join(outputRoot, variant.id, minified ? 'minified' : 'unminified')
  const result = await build({
    root: packageRoot,
    configFile: join(packageRoot, 'vite.config.ts'),
    mode: 'production',
    publicDir: false,
    logLevel: 'warn',
    build: {
      outDir: outputDirectory,
      emptyOutDir: false,
      copyPublicDir: false,
      target: 'es2023',
      sourcemap: false,
      minify: minified ? 'oxc' : false,
      reportCompressedSize: false,
      lib: {
        entry: join(packageRoot, 'src/index.ts'),
        formats: ['es'],
        fileName: variant.id,
      },
      rolldownOptions: {
        external: variant.externalCodplay ? [/^codplay(?:\/|$)/] : [],
        output: minified ? { minify: true } : {},
      },
    },
  })
  const outputs = (Array.isArray(result) ? result : [result]).flatMap((item) => item.output)
  const chunks = outputs.filter((item) => item.type === 'chunk')
  const moduleIds = [...new Set(chunks.flatMap((chunk) => Object.keys(chunk.modules)))].sort()
  const files = listFiles(outputDirectory)
  for (const path of files) {
    if (/\.(?:js|mjs)$/.test(path)) execFileSync(process.execPath, ['--check', path])
    utimesSync(path, fixedTimestamp, fixedTimestamp)
  }
  const archivePath = `${outputDirectory}.zip`
  const names = files.map((path) => relative(outputDirectory, path))
  execFileSync('zip', ['-X', '-9', '-q', archivePath, ...names], {
    cwd: outputDirectory,
    env: { ...process.env, TZ: 'UTC' },
  })
  execFileSync('unzip', ['-t', archivePath])
  for (const [index, name] of names.entries()) {
    const extracted = execFileSync('unzip', ['-p', archivePath, name], { maxBuffer: 16 * 1024 * 1024 })
    if (!extracted.equals(readFileSync(files[index]))) throw new Error(`ZIP mismatch: ${name}`)
  }
  const measurement = {
    library: variant.id,
    minified,
    bytes: files.reduce((sum, path) => sum + statSync(path).size, 0),
    files: files.map(describeFile),
    zip: describeFile(archivePath),
    zipVerified: true,
    exports: chunks.filter((chunk) => chunk.isEntry).flatMap((chunk) => chunk.exports).sort(),
    imports: chunks.flatMap((chunk) => chunk.imports),
    dynamicImports: chunks.flatMap((chunk) => chunk.dynamicImports),
    moduleCounts: groupModules(moduleIds),
    modules: moduleIds.map((id) => relative(repositoryRoot, id)),
  }
  measurements.push(measurement)
  console.log(JSON.stringify({
    library: measurement.library,
    minified,
    bytes: measurement.bytes,
    zipBytes: measurement.zip.bytes,
    imports: measurement.imports,
    moduleCounts: measurement.moduleCounts,
  }))
}

for (const variant of variants) {
  for (const minified of [false, true]) await measureVariant(variant, minified)
  const pair = measurements.filter((measurement) => measurement.library === variant.id)
  if (JSON.stringify(pair[0].exports) !== JSON.stringify(pair[1].exports)) {
    throw new Error(`Minification changed exports: ${variant.id}`)
  }
}

const metadata = {
  measuredAt: new Date().toISOString(),
  gitRevision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repositoryRoot, encoding: 'utf8' }).trim(),
  packageWorkingTreeStatus: execFileSync('git', ['status', '--short', '--', 'packages/codplay', 'packages/sighty'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  }).trim(),
  tools: {
    node: process.version,
    vite: viteVersion,
    rolldown: rolldownVersion,
    zip: execFileSync('zip', ['-v'], { encoding: 'utf8' }).split('\n').slice(0, 3),
  },
  configuration: {
    format: 'es',
    target: 'es2023',
    entry: 'src/index.ts',
    sourceMaps: false,
    typescriptDeclarations: false,
    publicAssets: false,
    minifier: 'oxc, including whitespace minification through rolldownOptions.output.minify',
    archive: 'ZIP Deflate, zip -X -9, UTC timestamps fixed at 2000-01-01',
  },
  checks: { javascriptSyntax: true, exportParity: true, zipIntegrityAndContents: true },
  outputDirectory: relative(repositoryRoot, outputRoot),
  measurements,
}
writeFileSync(join(outputRoot, 'measurements.json'), `${JSON.stringify(metadata, null, 2)}\n`)
console.log(`Artifacts: ${outputRoot}`)
