import { describe, expect, it } from 'vitest'
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { runElceScormPackage } from './scorm-package-runner'

describe('Elcé SCORM package runner', () => {
  it('exports the authored chapter name in the manifest and launcher while keeping technical paths', async () => {
    const scenario = {
      id: 'chapter-label-fixture',
      data: {
        pageIds: ['page-a'],
        pagePaths: { 'page-a': 'main/chapter-chapter-a/slot-content/page-a' },
        chapterIds: ['chapter-a'],
        previewStartPageId: 'page-a',
        questionBdcByPage: {},
        chapters: {
          'chapter-a': {
            id: 'chapter-a',
            name: '1. Lire une scène',
            type: 'standard',
            pageIds: ['page-a'],
          },
        },
        profile: { fieldPropertyIds: [] },
      },
    }
    const sightyPackage = zipSync({
      'export-manifest.json': strToU8(JSON.stringify({ format: 'sighty.scenario-package.v2', scenario: 'scenario.mjs' })),
      'scenario.mjs': strToU8(`export const scenario = ${JSON.stringify(scenario)};`),
      'loader.mjs': strToU8('export async function loadSightyPackage() {}'),
    })

    const result = await runElceScormPackage(sightyPackage, { version: '2004v4', monoSco: false })
    const files = unzipSync(result.archive)
    const manifest = strFromU8(files['imsmanifest.xml']!)
    const launcher = strFromU8(files['chapter-a.html']!)

    expect(result.packageCount).toBe(1)
    expect(manifest).toContain('<title>1. Lire une scène</title>')
    expect(manifest).toContain('href="chapter-a.html"')
    expect(manifest).not.toContain('<title>chapter-a</title>')
    expect(launcher).toContain('<title id="scorm-title">chapter-label-fixture - 1. Lire une scène</title>')
  }, 60_000)
})
