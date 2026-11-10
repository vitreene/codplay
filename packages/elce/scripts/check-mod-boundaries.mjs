import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = fileURLToPath(new URL('../', import.meta.url))
const sourceRoot = resolve(packageRoot, 'src')
const require = createRequire(resolve(packageRoot, 'package.json'))
const ts = require('typescript')
const parsedConfig = ts.getParsedCommandLineOfConfigFile(resolve(packageRoot, 'tsconfig.json'), {}, {
  ...ts.sys,
  onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
    throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'))
  },
})

if (parsedConfig === undefined) throw new Error('Could not read the Elcé TypeScript configuration.')

const sourceFiles = ts.sys.readDirectory(sourceRoot, ['.ts', '.tsx'], ['**/*.test.*', '**/*.spec.*'])
  .map((file) => resolve(file))
  .sort()
const sourceFileSet = new Set(sourceFiles)
const edges = []
const unresolvedImports = []

/** Returns the Elcé-local owner of a source path. */
function getOwner(file) {
  const [root, mod] = relative(sourceRoot, file).split(sep)
  if (root === 'core' || root === 'resources') return root
  if (root === 'mods' && mod !== undefined) return `mod:${mod}`
  return null
}

/** Resolves one module edge and records unresolved imports that would hide a boundary path. */
function recordImport(source, node, specifier, typeOnly) {
  const resolved = ts.resolveModuleName(specifier, source.fileName, parsedConfig.options, ts.sys)
    .resolvedModule?.resolvedFileName
  const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1
  if (resolved === undefined) {
    if (!specifier.startsWith('node:')) unresolvedImports.push({ file: relative(sourceRoot, source.fileName), specifier, line })
    return
  }

  const target = resolve(resolved)
  if (!target.startsWith(`${sourceRoot}${sep}`) || !sourceFileSet.has(target)) return
  edges.push({
    from: relative(sourceRoot, source.fileName),
    to: relative(sourceRoot, target),
    specifier,
    line,
    typeOnly,
  })
}

/** Parses imports, re-exports, import types, and literal or unresolved dynamic imports. */
function collectImports(source, node) {
  const isDeclaration = ts.isImportDeclaration(node) || ts.isExportDeclaration(node)
  const isImportType = ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)
  const isDynamicImport = ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword
  const literal = isDeclaration ? node.moduleSpecifier
    : isImportType ? node.argument.literal
    : isDynamicImport ? node.arguments[0]
    : undefined

  if (isDynamicImport && (literal === undefined || !ts.isStringLiteralLike(literal))) {
    unresolvedImports.push({
      file: relative(sourceRoot, source.fileName),
      specifier: 'dynamic import with a non-literal path',
      line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
    })
  }

  if (literal !== undefined && ts.isStringLiteralLike(literal)) {
    const importBindings = ts.isImportDeclaration(node) ? node.importClause : undefined
    const exportBindings = ts.isExportDeclaration(node) && node.exportClause && ts.isNamedExports(node.exportClause)
      ? node.exportClause.elements
      : undefined
    const typeOnly = ts.isImportTypeNode(node) || node.isTypeOnly === true
      || importBindings?.isTypeOnly === true
      || (importBindings?.name === undefined && importBindings?.namedBindings !== undefined
        && ts.isNamedImports(importBindings.namedBindings)
        && importBindings.namedBindings.elements.every((binding) => binding.isTypeOnly))
      || (exportBindings !== undefined && exportBindings.length > 0
        && exportBindings.every((binding) => binding.isTypeOnly))
    recordImport(source, node, literal.text, Boolean(typeOnly))
  }

  ts.forEachChild(node, (child) => collectImports(source, child))
}

sourceFiles.forEach((file) => {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
  collectImports(source, source)
})

const adjacency = new Map(sourceFiles.map((file) => [relative(sourceRoot, file), []]))
edges.forEach((edge) => adjacency.get(edge.from)?.push(edge))

/** Finds one shortest, complete forbidden path for each owner pair. */
function findBoundaryPaths() {
  const owners = [...new Set(sourceFiles.map(getOwner).filter((owner) => owner !== null))]
  return owners.flatMap((sourceOwner) => {
    const starts = sourceFiles
      .filter((file) => getOwner(file) === sourceOwner)
      .map((file) => relative(sourceRoot, file))
    const previous = new Map(starts.map((file) => [file, null]))
    const queue = [...starts]
    const found = new Map()

    for (let index = 0; index < queue.length; index += 1) {
      const current = queue[index]
      for (const edge of adjacency.get(current) ?? []) {
        const targetOwner = getOwner(resolve(sourceRoot, edge.to))
        const forbidden = sourceOwner === 'core' || sourceOwner === 'resources'
          ? targetOwner?.startsWith('mod:') === true
          : targetOwner?.startsWith('mod:') === true && targetOwner !== sourceOwner

        if (forbidden) {
          if (found.has(targetOwner)) continue
          previous.set(edge.to, { from: current, edge })
          const pathEdges = []
          let target = edge.to
          while (previous.get(target) !== null) {
            const step = previous.get(target)
            pathEdges.unshift(step.edge)
            target = step.from
          }
          found.set(targetOwner, { sourceOwner, targetOwner, edges: pathEdges })
          continue
        }

        if (previous.has(edge.to)) continue
        previous.set(edge.to, { from: current, edge })
        queue.push(edge.to)
      }
    }

    return [...found.values()]
  })
}

/** Formats a forbidden path with the exact source line and import used at each edge. */
function formatBoundaryPath(path) {
  const details = path.edges.map((edge) => {
    const usage = edge.typeOnly ? ' (type only)' : ''
    return `  ${edge.from}:${edge.line} --${edge.specifier}--> ${edge.to}${usage}`
  })
  return [`${path.sourceOwner} must not depend on ${path.targetOwner}:`, ...details].join('\n')
}

const boundaryPaths = findBoundaryPaths()
const diagnostics = [
  ...boundaryPaths.map(formatBoundaryPath),
  ...unresolvedImports.map((item) => `Unresolved import at ${item.file}:${item.line}: ${item.specifier}`),
]

if (diagnostics.length > 0) {
  console.error(diagnostics.join('\n\n'))
  process.exitCode = 1
} else {
  console.log(`Elcé module boundaries are clear (${sourceFiles.length} production files, ${edges.length} internal imports).`)
}
