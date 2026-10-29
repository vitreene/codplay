import { createHash } from 'node:crypto'

const INSTALLED_IDENTITIES = {
  'demo5-elce-comparison-scenario': {
    manifestIdentifier: 'MANIFEST-b763b91b-f054-4319-b324-711a10ffa818',
    organizationIdentifier: 'ORG-03743c8b-88cc-4ee6-b604-55403b132564',
    scos: {
      'chapter-1': {
        identifier: 'ITEM-d073705f-2979-4ab2-be1f-9e3cf6b318e7',
        resourceIdentifier: 'RES-4af8f5bf-c1f4-4121-8b0c-08aa08d0ead7',
      },
      'chapter-2': {
        identifier: 'ITEM-5f22828b-f42d-4414-b8b2-b61d5c0481f1',
        resourceIdentifier: 'RES-c6f3fec6-a5c3-4ab4-8328-329536c2f811',
      },
      'chapter-final': {
        identifier: 'ITEM-b6f20112-217f-4c5f-a4a2-c209f361c618',
        resourceIdentifier: 'RES-8929f7ee-6de4-45dd-a8be-8bb4958b8367',
      },
    },
  },
}

/** Creates stable root, organization, item, and resource identities for one scenario. */
export function createScormManifestIdentities(scenarioId, allSco) {
  if (typeof scenarioId !== 'string' || scenarioId.length === 0) {
    throw new Error('Le scénario doit avoir un identifiant stable pour produire un manifeste SCORM révisable.')
  }
  const installed = INSTALLED_IDENTITIES[scenarioId]
  return {
    manifestIdentifier: installed?.manifestIdentifier ?? createStableIdentifier('MANIFEST', scenarioId, 'manifest'),
    organizationIdentifier: installed?.organizationIdentifier ?? createStableIdentifier('ORG', scenarioId, 'organization'),
    allSco: allSco.map((sco) => ({
      ...sco,
      ...(installed?.scos[sco.id] ?? {
        identifier: createStableIdentifier('ITEM', scenarioId, 'item', sco.id),
        resourceIdentifier: createStableIdentifier('RES', scenarioId, 'resource', sco.id),
      }),
    })),
  }
}

/** Derives one readable SCORM identifier from the stable scenario and SCO identities. */
function createStableIdentifier(prefix, scenarioId, role, scoId = '') {
  const source = ['elce-scorm-manifest-v1', scenarioId, role, scoId].join('\u0000')
  const digest = createHash('sha256').update(source).digest('hex').slice(0, 32)
  return `${prefix}-${digest}`
}
