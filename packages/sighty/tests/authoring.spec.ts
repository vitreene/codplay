/** @vitest-environment jsdom */

import { describe, expect, it } from 'vitest'

import type { SceneDoc } from 'codplay/scene/types'
import { Sighty, type SightyFile } from '../src'

const file: SightyFile<'layout' | 'sceneB', 'main'> = {
  format: 'sighty',
  version: 1,
  id: 'authoring-test',
  resources: {
    scenes: {
      layout: './layout-scene',
      sceneB: './scene-b',
    },
  },
  views: [{ view: { scene: 'layout', slots: { main: [{ view: { scene: 'sceneB' } }] } } }],
}

describe('Sighty authoring class', () => {
  it('groups file, scenes and data without executing them', () => {
    const layout = { id: 'layout', stories: {} }
    const sceneB = { id: 'scene-b', stories: {} }
    const project = new Sighty({
      scenario: {
        file,
        scenes: { layout, sceneB },
        data: { locale: 'fr' },
      },
      runtime: {
        root: document.createElement('div'),
        instanceIds: { layout: 'layout-1', sceneB: 'scene-b-1' },
        layout: { sceneKey: 'layout', storyId: 'main' },
      },
    })

    expect(project.scenario.file).toBe(file)
    expect(project.scenario.getScene('sceneB')).toBe(sceneB)
    expect(project.scenario.getData('locale')).toBe('fr')
    expect(project.scenario.getView('layout')?.view.scene).toBe('layout')
    expect(project.scenario.sceneKeys).toEqual(['layout', 'sceneB'])
    expect(project.scenario.getSlotNames('layout')).toEqual(['main'])
    expect(project.scenario.validate()).toEqual([])
    expect(project.runtime.sceneKeys).toEqual(['layout', 'sceneB'])
    project.runtime.destroy()
  })

  it('reports missing and undeclared scene resources', () => {
    // This intentionally invalid fixture bypasses the typed complete catalog
    // so that runtime validation can report the missing file resource.
    const scenes = {
      layout: { id: 'layout', stories: {} },
      sceneC: { id: 'scene-c', stories: {} },
    } as unknown as Readonly<Record<'layout' | 'sceneB', SceneDoc<string>>>
    const project = new Sighty({
      scenario: { file, scenes },
      runtime: {
        root: document.createElement('div'),
        instanceIds: { layout: 'layout-1', sceneB: 'scene-b-1' },
        layout: { sceneKey: 'layout', storyId: 'main' },
      },
    })

    expect(project.scenario.validate().map((diagnostic) => diagnostic.code)).toEqual([
      'AUTHOR_SCENE_RESOURCE_MISSING',
      'AUTHOR_SCENE_RESOURCE_UNDECLARED',
      'AUTHOR_VIEW_CHILD_SCENE_UNKNOWN',
    ])
    project.runtime.destroy()
  })
})
