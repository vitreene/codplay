import { describe, expect, it } from 'vitest'
import { buildScormManifest, type ScormManifestDefinition } from './scorm-manifest'

describe('SCORM manifest renderer', () => {
  it('renders a 1.2 package manifest with one launch resource per SCO', () => {
    const manifest = buildScormManifest(definition('1.2', [
      { id: 'chapter-a', title: 'Évaluation & pratique', href: 'chapter-a.html', isVisible: true, masteryScore: 80 },
      { id: 'chapter-b', title: 'Chapitre <B>', href: 'chapter-b.html', isVisible: false, masteryScore: 70 },
    ]))

    expect(manifest).toContain('xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"')
    expect(manifest).toContain('<schemaversion>1.2</schemaversion>')
    expect(manifest).toContain('<title>Évaluation &amp; pratique</title>')
    expect(manifest).toContain('<title>Chapitre &lt;B&gt;</title>')
    expect(manifest).toContain('<adlcp:masteryscore>80</adlcp:masteryscore>')
    expect(manifest).toContain('<resource identifier="RES-test-id-4" type="webcontent" href="chapter-a.html" adlcp:scormtype="sco">')
    expect(manifest).toContain('<file href="chapter-b.html"/>')
    expect(manifest).not.toContain('imsss:sequencing')
  })

  it('maps summary objectives for 2004 3rd Edition without the 4th Edition extension', () => {
    const manifest = buildScormManifest(definition('2004v3', [
      { id: 'summary', title: 'Sommaire', href: 'index.html', isVisible: true, masteryScore: 80 },
      { id: 'chapter-a', title: 'Chapitre A', href: 'chapter-a.html', isVisible: false, masteryScore: 75 },
    ], { withSummary: true }))

    expect(manifest).toContain('<schemaversion>2004 3rd Edition</schemaversion>')
    expect(manifest).toContain('objectiveID="obj_chapter-a"')
    expect(manifest).toContain('targetObjectiveID="map_obj_chapter-a"')
    expect(manifest).toContain('writeSatisfiedStatus="false"')
    expect(manifest).not.toContain('adlseq:objectives')
  })

  it('renders the single visible 1.2 SCO when the summary owns the chapter objectives', () => {
    const manifest = buildScormManifest(definition('1.2', [
      { id: 'summary', title: 'Sommaire', href: 'index.html', isVisible: true, masteryScore: 80 },
      { id: 'chapter-a', title: 'Chapitre A', href: null, isVisible: false, masteryScore: 75 },
    ], { withSummary: true, monoSco: true }))

    expect(manifest.match(/<item\b/g)).toHaveLength(1)
    expect(manifest.match(/<resource\b/g)).toHaveLength(1)
    expect(manifest).toContain('href="index.html"')
    expect(manifest).not.toContain('href="chapter-a.html"')
  })

  it('adds 2004 4th Edition objective mappings for separate SCOs', () => {
    const manifest = buildScormManifest(definition('2004v4', [
      { id: 'summary', title: 'Sommaire', href: 'index.html', isVisible: true, masteryScore: 80 },
      { id: 'chapter-a', title: 'Chapitre A', href: 'chapter-a.html', isVisible: false, masteryScore: 80 },
    ], { withSummary: true }))

    expect(manifest).toContain('<schemaversion>2004 4th Edition</schemaversion>')
    expect(manifest).toContain('<adlseq:objectives>')
    expect(manifest).toContain('targetObjectiveID="map_obj_chapter-a"')
    expect(manifest).toContain('writeRawScore="false"')
  })

  it('keeps mono-SCO manifests free of inter-SCO objective maps', () => {
    const manifest = buildScormManifest(definition('2004v4', [
      { id: 'summary', title: 'Sommaire', href: 'index.html', isVisible: true, masteryScore: 80 },
      { id: 'chapter-a', title: 'Chapitre A', href: null, isVisible: false, masteryScore: 80 },
    ], { withSummary: true, monoSco: true }))

    expect(manifest).toContain('objectiveID="obj_chapter-a"')
    expect(manifest).not.toContain('imsss:mapInfo')
    expect(manifest).not.toContain('adlseq:objectives')
    expect(manifest.match(/<item\b/g)).toHaveLength(1)
  })

  it('preserves explicit identities when a non-launchable item precedes a chapter SCO', () => {
    const manifest = buildScormManifest({
      ...definition('2004v4', [
        {
          id: 'summary', identifier: 'ITEM-summary', resourceIdentifier: 'RES-summary',
          title: 'Accueil', href: null, isVisible: true,
        },
        {
          id: 'chapter-a', identifier: 'ITEM-chapter-a', resourceIdentifier: 'RES-chapter-a',
          title: 'Chapitre A', href: 'chapter-a.html', isVisible: false,
        },
      ]),
      manifestIdentifier: 'MANIFEST-stable',
      organizationIdentifier: 'ORG-stable',
    })

    expect(manifest).toContain('identifier="MANIFEST-stable"')
    expect(manifest).toContain('identifier="ORG-stable"')
    expect(manifest).toContain('identifier="ITEM-chapter-a" identifierref="RES-chapter-a"')
    expect(manifest).toContain('identifier="RES-chapter-a" type="webcontent" href="chapter-a.html"')
    expect(manifest).not.toContain('ITEM-summary')
    expect(manifest).not.toContain('RES-summary')
  })
})

/** Creates deterministic fixture data that belongs only to these manifest tests. */
function definition(
  version: ScormManifestDefinition['version'],
  allSco: ScormManifestDefinition['allSco'],
  options: Partial<Pick<ScormManifestDefinition, 'withSummary' | 'monoSco'>> = {},
): ScormManifestDefinition {
  let nextIdentifier = 0
  return {
    version,
    title: 'Formation de test',
    withSummary: options.withSummary ?? false,
    monoSco: options.monoSco ?? false,
    allSco,
    createIdentifier: () => `test-id-${++nextIdentifier}`,
  }
}
