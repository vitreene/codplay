import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { writeFileSync } from 'node:fs'

const repo = process.cwd()
const require = createRequire(resolve(repo, 'package.json'))
const { createServer } = await import(pathToFileURL(require.resolve('vite')).href)
const outputPath = process.argv[2] ?? '/private/tmp/codplay-mods-cache-probe.json'
const server = await createServer({
  root: resolve(repo, 'packages/elce'),
  configFile: resolve(repo, 'packages/elce/vite.config.ts'),
  server: { middlewareMode: true, hmr: false, ws: false, watch: null },
  optimizeDeps: { noDiscovery: true },
  logLevel: 'error',
})
const { createInitialDocument } = await server.ssrLoadModule('/src/domain/document/document-model.ts')
const { applyDocumentCommand, createQuestionBdcCommand } = await server.ssrLoadModule('/src/domain/commands/document-commands/index.ts')
const { createPageSceneCatalog } = await server.ssrLoadModule('/src/player/elce-player-composition.ts')
const initial = createInitialDocument()
const document = applyDocumentCommand(initial, createQuestionBdcCommand('audit-question', 'page-a', 1))
const question = document.bdcs.find((bdc) => bdc.id === 'audit-question').question
const answer = {
  answerIds: question.answers.map((entry) => entry.id),
  selectedAnswerIds: question.answers.filter((entry) => entry.correct).map((entry) => entry.id),
  expectedAnswerIds: question.answers.filter((entry) => entry.correct).map((entry) => entry.id),
  isCorrect: true,
}
const cache = new Map()
const first = createPageSceneCatalog(document, {}, cache)
const cachedWithAnswer = createPageSceneCatalog(document, {}, cache, { 'page-a': answer })
const freshWithAnswer = createPageSceneCatalog(document, {}, new Map(), { 'page-a': answer })
const reverseCache = new Map()
const answered = createPageSceneCatalog(document, {}, reverseCache, { 'page-a': answer })
const cachedAfterReset = createPageSceneCatalog(document, {}, reverseCache)

/** Reads only the Question story state produced by the actual page builder. */
function questionState(catalog) {
  const source = catalog.scenes['scene-page-a']
  const scene = source.sceneDoc ?? source
  return Object.values(scene.stories).find((story) => story.state?.elceQuestionRuntime)?.state
}
const result = {
  restoredSourceReused: first.scenes['scene-page-a'] === cachedWithAnswer.scenes['scene-page-a'],
  firstSubmitted: questionState(first).submitted,
  cachedRestorationSubmitted: questionState(cachedWithAnswer).submitted,
  freshRestorationSubmitted: questionState(freshWithAnswer).submitted,
  resetSourceReused: answered.scenes['scene-page-a'] === cachedAfterReset.scenes['scene-page-a'],
  cachedResetSubmitted: questionState(cachedAfterReset).submitted,
}
writeFileSync(outputPath, JSON.stringify(result, null, 2) + '\n')
console.log(JSON.stringify(result, null, 2))
await server.close()
