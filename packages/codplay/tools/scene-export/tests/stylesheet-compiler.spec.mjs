import { afterEach, describe, expect, it } from 'vitest'
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { compileStyleSheets } from '../stylesheet-compiler.mjs'
import { packageStyleSheet } from '../stylesheet-packager.mjs'

const temporaryDirectories = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe('scene export stylesheet compilation', () => {
  it('expands local imports in order, preserves qualifiers and packages URL dependencies', async () => {
    const directory = await createTemporaryDirectory()
    await mkdir(path.join(directory, 'styles'), { recursive: true })
    await mkdir(path.join(directory, 'images'), { recursive: true })
    const sourceFile = path.join(directory, 'scene.ts')
    const rootSheet = path.join(directory, 'styles/root.css')
    const importedSheet = path.join(directory, 'styles/theme.css')
    const imageFile = path.join(directory, 'images/card.svg')
    const imageBytes = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')
    await writeFile(sourceFile, 'export const scene = {}')
    await writeFile(rootSheet, '')
    await writeFile(importedSheet, '.cp-theme { color: blue; }')
    await writeFile(imageFile, imageBytes)

    const result = await compileStyleSheets([{
      sourceFile: rootSheet,
      cssText: '@import "./theme.css" layer(theme) supports(display: grid) screen;\n.cp-card { background-image: url("../images/card.svg"); }',
    }], sourceFile)
    const packaged = await packageStyleSheet({
      compiledStyleSheet: result,
      stageDirectory: path.join(directory, 'stage'),
    })
    const outputCss = await readFile(path.join(directory, 'stage/scene/style.css'), 'utf8')
    const outputImage = await readFile(path.join(directory, 'stage', packaged.resources[0].file))

    expect(result.classNames).toEqual(['cp-theme', 'cp-card'])
    expect(outputCss).toContain('@layer theme')
    expect(outputCss).toContain('@supports (display: grid)')
    expect(outputCss).toContain('@media screen')
    expect(outputCss).toContain('.cp-theme { color: blue; }')
    expect(outputCss).toContain('.cp-card { background-image: url("assets/')
    expect(outputCss).not.toContain('codplay-resource-')
    expect(packaged.resources[0]?.type).toBe('image')
    expect(outputImage).toEqual(imageBytes)
  })

  it('packages local @font-face sources as font resources and keeps their declarations', async () => {
    const directory = await createTemporaryDirectory()
    const sourceFile = path.join(directory, 'scene.ts')
    const stylesheetFile = path.join(directory, 'scene.css')
    const fontFile = path.join(directory, 'probe.woff2')
    const fontFixture = fileURLToPath(new URL('../../../tests/fixtures/fonts/codplay-font-fixture.woff2', import.meta.url))
    const fontBytes = await readFile(fontFixture)
    await writeFile(sourceFile, 'export const scene = {}')
    await writeFile(stylesheetFile, '')
    await copyFile(fontFixture, fontFile)

    const compiled = await compileStyleSheets([{
      sourceFile: stylesheetFile,
      cssText: '@font-face { font-family: "Package Probe"; src: url("./probe.woff2") format("woff2"); font-weight: 400; }',
    }], sourceFile)
    const packaged = await packageStyleSheet({
      compiledStyleSheet: compiled,
      stageDirectory: path.join(directory, 'stage'),
    })
    const outputCss = await readFile(path.join(directory, 'stage/scene/style.css'), 'utf8')
    const outputFont = await readFile(path.join(directory, 'stage', packaged.resources[0].file))

    expect(compiled.resources[0]?.type).toBe('font')
    expect(packaged.resources[0]?.type).toBe('font')
    expect(compiled.fontFaces).toEqual([{
      sourceOrder: 0,
      family: 'Package Probe',
      src: 'url("codplay-resource-0") format("woff2")',
      weight: '400',
      style: 'normal',
      stretch: 'normal',
      variationSettings: 'normal',
      unicodeRange: 'U+0-10FFFF',
      display: 'auto',
    }])
    expect(packaged.fontFaces[0]).toMatchObject({
      sourceOrder: 0,
      family: 'Package Probe',
      weight: '400',
      style: 'normal',
      stretch: 'normal',
      variationSettings: 'normal',
      unicodeRange: 'U+0-10FFFF',
      display: 'auto',
    })
    expect(packaged.fontFaces[0]?.src).toMatch(/^url\("assets\//)
    expect(packaged.fontFaces[0]?.src).not.toContain('codplay-resource-')
    expect(outputCss).toContain('font-family: "Package Probe"')
    expect(outputCss).toContain('font-weight: 400')
    expect(outputCss).toContain('src: url("assets/')
    expect(outputFont).toEqual(fontBytes)
  })

  it('rejects cycles, non-local imports, missing files and unsupported CSS namespace rules', async () => {
    const directory = await createTemporaryDirectory()
    const sourceFile = path.join(directory, 'scene.ts')
    const sheetFile = path.join(directory, 'scene.css')
    await writeFile(sourceFile, 'export const scene = {}')
    await writeFile(sheetFile, '')
    await writeFile(path.join(directory, 'a.css'), '@import "./b.css";')
    await writeFile(path.join(directory, 'b.css'), '@import "./a.css";')

    await expect(compileStyleSheets([{ sourceFile: sheetFile, cssText: '@import "./a.css";' }], sourceFile))
      .rejects.toThrow('CSS import cycle detected')
    await expect(compileStyleSheets([{ sourceFile: sheetFile, cssText: '@import "https://cdn.example/site.css";' }], sourceFile))
      .rejects.toThrow('CSS import must be local')
    await expect(compileStyleSheets([{ sourceFile: sheetFile, cssText: '.scene { background: url("./missing.png") }' }], sourceFile))
      .rejects.toThrow('CSS resource file does not exist')
    await expect(compileStyleSheets([{ sourceFile: sheetFile, cssText: '@namespace svg "urn:svg";' }], sourceFile))
      .rejects.toThrow('@namespace cannot be preserved')
    await expect(compileStyleSheets([{ sourceFile: sheetFile, cssText: '@import "./a.css" scope(.scene);' }], sourceFile))
      .rejects.toThrow('Unsupported or misplaced @import qualifier')
    await expect(compileStyleSheets([{ sourceFile: sheetFile, cssText: '@import "./a.css" screen layer(theme);' }], sourceFile))
      .rejects.toThrow('Unsupported or misplaced @import qualifier')
    await expect(compileStyleSheets([{ sourceFile: sheetFile, cssText: '.scene { @import "./a.css"; }' }], sourceFile))
      .rejects.toThrow('@import must be a top-level stylesheet rule')
    await expect(compileStyleSheets([{ sourceFile: sheetFile, cssText: '@import "./a.css#section";' }], sourceFile))
      .rejects.toThrow('CSS import query, fragment or empty path is unsupported')
    await expect(compileStyleSheets([{ sourceFile: sheetFile, cssText: '.scene { @namespace svg "urn:svg"; }' }], sourceFile))
      .rejects.toThrow('@namespace cannot be preserved')
    await expect(compileStyleSheets([{
      sourceFile: sheetFile,
      cssText: '@font-face { font-family: "local-only"; src: local("local-only"); }',
    }], sourceFile)).rejects.toThrow('@font-face local() sources are unsupported')
    await expect(compileStyleSheets([{
      sourceFile: sheetFile,
      cssText: '@font-face { src: url("data:font/woff2;base64,AA=="); }',
    }], sourceFile)).rejects.toThrow('@font-face requires a font-family descriptor')
  })
})

/** Creates and tracks one isolated directory for stylesheet compiler fixtures. */
async function createTemporaryDirectory() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'codplay-scene-export-css-'))
  temporaryDirectories.push(directory)
  return directory
}
