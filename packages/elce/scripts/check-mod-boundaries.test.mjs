import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { analyzeModBoundaries } from './check-mod-boundaries.mjs'

const packageRoot = fileURLToPath(new URL('../', import.meta.url))

const cases = [
  {
    name: 'direct import from core to a mod',
    fixture: 'direct-core-to-mod',
    sourceOwner: 'core',
    targetOwner: 'mod:learning',
    expectedEdges: [
      { from: 'core/entry.ts', to: 'mods/learning/target.ts', typeOnly: false },
    ],
  },
  {
    name: 'resource re-export to a mod',
    fixture: 'resource-reexport-to-mod',
    sourceOwner: 'resources',
    targetOwner: 'mod:quiz-hunt',
    expectedEdges: [
      { from: 'resources/public.ts', to: 'mods/quiz-hunt/target.ts', typeOnly: false },
    ],
  },
  {
    name: 'type-only re-export between mods',
    fixture: 'type-only-cross-mod',
    sourceOwner: 'mod:learning',
    targetOwner: 'mod:quiz-hunt',
    expectedEdges: [
      { from: 'mods/learning/public.ts', to: 'mods/quiz-hunt/contract.ts', typeOnly: true },
    ],
  },
  {
    name: 'indirect path from core through a resource to a mod',
    fixture: 'indirect-core-resource-mod',
    sourceOwner: 'core',
    targetOwner: 'mod:learning',
    expectedEdges: [
      { from: 'core/entry.ts', to: 'resources/bridge.ts', typeOnly: false },
      { from: 'resources/bridge.ts', to: 'mods/learning/target.ts', typeOnly: false },
    ],
  },
]

describe('Elcé module boundary checker fixtures', () => {
  it.each(cases)('reports $name with its complete path', ({ fixture, sourceOwner, targetOwner, expectedEdges }) => {
    const sourceRoot = fileURLToPath(new URL(`./check-mod-boundaries-fixtures/${fixture}/src/`, import.meta.url))
    const result = analyzeModBoundaries(sourceRoot, packageRoot)

    expect(result.unresolvedImports).toEqual([])
    const matchingPaths = result.boundaryPaths.filter((path) => path.sourceOwner === sourceOwner && path.targetOwner === targetOwner)
    expect(matchingPaths).toHaveLength(1)
    expect(matchingPaths[0]).toMatchObject({ edges: expectedEdges })
  })
})
