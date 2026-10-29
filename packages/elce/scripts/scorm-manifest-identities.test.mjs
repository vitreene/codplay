import { describe, expect, it } from 'vitest'
import { createScormManifestIdentities } from './scorm-manifest-identities.mjs'

describe('Elcé SCORM manifest identity generation', () => {
  it('reuses the exact Demo5 manifest, organization, item, and resource identifiers already installed in the LMS', () => {
    const result = createScormManifestIdentities('demo5-elce-comparison-scenario', [
      { id: 'chapter-1', title: 'Chapitre 1', href: 'chapter-1.html' },
      { id: 'chapter-2', title: 'Chapitre 2', href: 'chapter-2.html' },
      { id: 'chapter-final', title: 'Chapitre final', href: 'chapter-final.html' },
    ])

    expect(result).toEqual({
      manifestIdentifier: 'MANIFEST-b763b91b-f054-4319-b324-711a10ffa818',
      organizationIdentifier: 'ORG-03743c8b-88cc-4ee6-b604-55403b132564',
      allSco: [
        {
          id: 'chapter-1', title: 'Chapitre 1', href: 'chapter-1.html',
          identifier: 'ITEM-d073705f-2979-4ab2-be1f-9e3cf6b318e7',
          resourceIdentifier: 'RES-4af8f5bf-c1f4-4121-8b0c-08aa08d0ead7',
        },
        {
          id: 'chapter-2', title: 'Chapitre 2', href: 'chapter-2.html',
          identifier: 'ITEM-5f22828b-f42d-4414-b8b2-b61d5c0481f1',
          resourceIdentifier: 'RES-c6f3fec6-a5c3-4ab4-8328-329536c2f811',
        },
        {
          id: 'chapter-final', title: 'Chapitre final', href: 'chapter-final.html',
          identifier: 'ITEM-b6f20112-217f-4c5f-a4a2-c209f361c618',
          resourceIdentifier: 'RES-8929f7ee-6de4-45dd-a8be-8bb4958b8367',
        },
      ],
    })
  })

  it('keeps every existing chapter identity across repeated exports and additions', () => {
    const chapters = [
      { id: 'chapter-a', title: 'A', href: 'chapter-a.html' },
      { id: 'chapter-b', title: 'B', href: 'chapter-b.html' },
    ]
    const first = createScormManifestIdentities('project-1-scenario', chapters)
    const repeated = createScormManifestIdentities('project-1-scenario', chapters)
    const extended = createScormManifestIdentities('project-1-scenario', [
      ...chapters,
      { id: 'chapter-c', title: 'C', href: 'chapter-c.html' },
    ])

    expect(repeated).toEqual(first)
    expect(extended.manifestIdentifier).toBe(first.manifestIdentifier)
    expect(extended.organizationIdentifier).toBe(first.organizationIdentifier)
    expect(extended.allSco.slice(0, 2)).toEqual(first.allSco)
    expect(extended.allSco[2]).toMatchObject({ id: 'chapter-c', identifier: expect.stringMatching(/^ITEM-[0-9a-f]{32}$/u) })
  })

  it('requires a stable scenario identity instead of falling back to random UUIDs', () => {
    expect(() => createScormManifestIdentities('', [])).toThrow('identifiant stable')
  })
})
