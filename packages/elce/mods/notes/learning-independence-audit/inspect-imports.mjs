import { createRequire } from 'node:module'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, relative } from 'node:path'

const repo = process.cwd()
const require = createRequire(resolve(repo, 'package.json'))
const ts = require('typescript')
const outputPath = process.argv[2] ?? '/private/tmp/codplay-mods-audit.json'
const sourceRoot = resolve(repo, 'packages/elce/src')
const options = ts.getParsedCommandLineOfConfigFile(resolve(repo, 'packages/elce/tsconfig.json'), {}, {
  ...ts.sys,
  onUnRecoverableConfigFileDiagnostic: (error) => { throw new Error(ts.flattenDiagnosticMessageText(error.messageText, '\n')) },
}).options
const files = ts.sys.readDirectory(sourceRoot, ['.ts', '.tsx'], ['**/*.test.*', '**/*.spec.*']).sort()
const fileSet = new Set(files)
const edges = []
const external = []
const unresolved = []

/** Records literal module edges and separates declarations used only as types. */
function inspect(source, node) {
  const literal = ts.isImportDeclaration(node) || ts.isExportDeclaration(node) ? node.moduleSpecifier
    : ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) ? node.argument.literal
    : ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword ? node.arguments[0]
    : undefined
  if (literal && ts.isStringLiteral(literal)) {
    const bindings = ts.isImportDeclaration(node) ? node.importClause?.namedBindings : undefined
    const typeOnly = ts.isImportTypeNode(node) || node.isTypeOnly === true
      || (ts.isExportDeclaration(node) && node.exportClause && ts.isNamedExports(node.exportClause) && node.exportClause.elements.every((binding) => binding.isTypeOnly))
      || (ts.isImportDeclaration(node) && (node.importClause?.isTypeOnly === true
        || (!node.importClause?.name && bindings && ts.isNamedImports(bindings) && bindings.elements.every((binding) => binding.isTypeOnly))))
    const target = ts.resolveModuleName(literal.text, source.fileName, options, ts.sys).resolvedModule?.resolvedFileName
    const edge = { from: relative(sourceRoot, source.fileName), to: target ? relative(sourceRoot, resolve(target)) : null,
      specifier: literal.text, typeOnly: Boolean(typeOnly), line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1 }
    if (target && fileSet.has(resolve(target))) edges.push(edge)
    if (target && !fileSet.has(resolve(target))) external.push(edge)
    if (!target) unresolved.push(edge)
  }
  ts.forEachChild(node, (child) => inspect(source, child))
}
files.forEach((file) => {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true)
  inspect(source, source)
})
const names = files.map((file) => relative(sourceRoot, file))

/** Finds the shortest import path within the Elcé production corpus. */
function shortestPath(from, to, runtimeOnly = false) {
  const queue = [[from]]
  const seen = new Set([from])
  while (queue.length) {
    const path = queue.shift()
    const current = path.at(-1)
    if (current === to) return path
    edges.filter((edge) => edge.from === current && (!runtimeOnly || !edge.typeOnly)).forEach((edge) => {
      if (seen.has(edge.to)) return
      seen.add(edge.to)
      queue.push([...path, edge.to])
    })
  }
  return null
}

/** Computes mutually reachable import components without treating type imports as execution. */
function components(runtimeOnly) {
  const pending = new Set(names)
  const found = []
  names.forEach((name) => {
    if (!pending.has(name)) return
    const group = [...pending].filter((other) => shortestPath(name, other, runtimeOnly) && shortestPath(other, name, runtimeOnly))
    group.forEach((other) => pending.delete(other))
    if (group.length > 1) found.push(group)
  })
  return found.sort((a, b) => b.length - a.length)
}
const roots = [
  'domain/evaluation/evaluation-machine.ts', 'domain/evaluation/chapter-evaluation.ts',
  'domain/question/question-service.ts', 'domain/card/card-service.ts', 'domain/carousel/carousel-service.ts',
  'domain/statistical-graph/statistical-graph-service.ts', 'domain/summary-profile/profile-rules.ts',
  'domain/summary-profile/reader-projection.ts', 'domain/summary-profile/test-state-reconciliation.ts',
  'builders/summary-profile/summary-scene-builder.ts', 'builders/summary-profile/profile-form-scene-builder.ts',
  'domain/appearance/appearance-color-generator.ts', 'domain/appearance/appearance-resolver.ts',
  'domain/editor-settings/editor-settings-resolver.ts', 'builders/card/card-preset-builder.ts',
  'app/history/document-history.ts', 'domain/media/media-resource-service.ts',
  'builders/flux/flux-scene-builder.ts', 'builders/diapo/diapo-scene-builder.ts',
  'app/editor/section/section-editor-tiptap-adapter.ts', 'player/elce-player-composition.ts',
]
const targets = ['domain/document/document-model.ts', 'domain/document/document-types.ts',
  'config/document-config.ts', 'domain/summary-profile/test-state-types.ts', 'config/presets.ts']
const paths = roots.map((root) => ({ root, targets: Object.fromEntries(targets.map((target) => [target, {
  all: shortestPath(root, target), value: shortestPath(root, target, true),
}])) }))
const result = { sourceRoot, files: names, edges, external, unresolved, paths,
  components: { all: components(false), value: components(true) } }
writeFileSync(outputPath, JSON.stringify(result, null, 2) + '\n')
console.log(JSON.stringify({ files: names.length, internalEdges: edges.length,
  typeEdges: edges.filter((edge) => edge.typeOnly).length, valueEdges: edges.filter((edge) => !edge.typeOnly).length,
  externalEdges: external.length, unresolved, components: result.components,
  roots: paths.map(({ root, targets: entries }) => ({ root, reaches: Object.entries(entries).filter(([, value]) => value.all).map(([target, value]) => `${target}:${value.value ? 'value' : 'type-path'}`) })),
}, null, 2))
