import { strToU8, unzipSync, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { resolveScormExportOptions } from '../scorm-export-options'
import { assembleScormPackage } from './scorm-package-assembler'

describe('SCORM package assembler', () => {
  it.each(['1.2', '2004v3', '2004v4'] as const)('wraps the existing Sighty package for SCORM %s', (version) => {
    const result = assembleScormPackage({
      sightyPackage: sourcePackage(),
      options: resolveScormExportOptions({ version, withSummary: true, monoSco: true }),
      title: 'Formation & pratique',
      allSco: [
        { id: 'summary', title: 'Accueil', href: 'sommaire.html', isVisible: true, masteryScore: 80 },
        { id: 'assessment-a', title: 'Évaluation A', href: null, isVisible: false, masteryScore: 80 },
      ],
      additionalFiles: {
        'sommaire.html': '<html id="document"><body id="body"></body></html>',
        'runtime/elce-scorm-runtime.js': 'export const ready = true',
      },
    })

    expect(result.zip).toBeDefined()
    expect(result.files['imsmanifest.xml']).toBeDefined()
    expect(result.files['adlcp_rootv1p2.xsd'] !== undefined || version !== '1.2').toBe(true)
    expect(result.files['adlcp_v1p3.xsd'] !== undefined || version === '1.2').toBe(true)
    expect(result.files['scenes/scene-a/scene/scene.json']).toEqual(strToU8('{"format":"fixture"}'))
    expect(result.files['runtime/pipwerks-scorm-api-wrapper.js']).toBeDefined()

    const archivedFiles = unzipSync(result.zip!)
    expect(archivedFiles['imsmanifest.xml']).toEqual(result.files['imsmanifest.xml'])
    expect(archivedFiles['sommaire.html']).toBeDefined()
    expect(archivedFiles['ims_xml.xsd'] !== undefined).toBe(true)
    expect(archivedFiles['imscp_v1p1.xsd'] !== undefined || version === '1.2').toBe(true)
  })

  it('keeps the complete package directory and omits the archive when zip is false', () => {
    const result = assembleScormPackage({
      sightyPackage: sourcePackage(),
      options: resolveScormExportOptions({ version: '2004v4', withSummary: true, monoSco: true, zip: false }),
      title: 'Formation',
      allSco: [{ id: 'summary', title: 'Accueil', href: 'sommaire.html', isVisible: true }],
      additionalFiles: { 'sommaire.html': 'launcher' },
    })

    expect(result.files['imsmanifest.xml']).toBeDefined()
    expect(result.files['scenario.mjs']).toBeDefined()
    expect(result.zip).toBeUndefined()
  })

  it('omits the local Sighty package and Pipwerks wrapper in absolute-path mode', () => {
    const result = assembleScormPackage({
      sightyPackage: sourcePackage(),
      options: resolveScormExportOptions({
        version: '2004v4',
        withSummary: true,
        monoSco: true,
        absolutePath: 'https://training.example/course/',
      }),
      title: 'Formation',
      allSco: [{ id: 'summary', title: 'Accueil', href: 'sommaire.html', isVisible: true }],
      additionalFiles: { 'sommaire.html': 'remote launcher' },
    })

    expect(result.files['scenario.mjs']).toBeUndefined()
    expect(result.files['runtime/pipwerks-scorm-api-wrapper.js']).toBeUndefined()
    expect(result.files['imscp_v1p1.xsd']).toBeDefined()
  })

  it('rejects an unsafe source path and an unresolved launch href', () => {
    expect(() => assembleScormPackage({
      sightyPackage: zipSync({ '../outside.txt': strToU8('blocked') }),
      options: resolveScormExportOptions({ version: '2004v4' }),
      title: 'Formation',
      allSco: [],
      additionalFiles: {},
    })).toThrow('Chemin de package SCORM invalide')

    expect(() => assembleScormPackage({
      sightyPackage: sourcePackage(),
      options: resolveScormExportOptions({ version: '2004v4' }),
      title: 'Formation',
      allSco: [{ id: 'chapter-a', title: 'Chapitre A', href: 'chapter-a.html', isVisible: true }],
      additionalFiles: {},
    })).toThrow('Le lanceur SCORM chapter-a.html est absent')
  })
})

/** Creates an input archive matching the public Sighty package contract. */
function sourcePackage(): Uint8Array {
  return zipSync({
    'export-manifest.json': strToU8('{"format":"sighty.scenario-package.v2","scenario":"scenario.mjs","scenes":{"scene-a":"scenes/scene-a/"}}'),
    'scenario.mjs': strToU8('export const scenario = { id: "fixture" }'),
    'loader.mjs': strToU8('export async function loadSightyPackage() {}'),
    'scenes/scene-a/scene/scene.json': strToU8('{"format":"fixture"}'),
  })
}
