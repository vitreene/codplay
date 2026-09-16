/** @vitest-environment jsdom */

import { describe, expect, it } from 'vitest'

import type { SceneDoc } from 'codplay/scene/types'
import { Sighty, type SightyFile, type SightyGraphView } from '../src'

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

  it('validates routes declared on a view map scope', () => {
    const invalidFile: SightyFile<'layout' | 'sceneB', 'main'> = {
      format: 'sighty',
      version: 2,
      id: 'invalid-map-action',
      views: {
        start: 'layout',
        actions: {
          'navigation:missing': { go: { path: 'does-not-exist' } },
        },
        views: {
          layout: {
            view: {
              scene: 'layout',
              slots: {
                main: [{ id: 'scene-b', view: { scene: 'sceneB' } }],
              },
            },
          },
        },
      },
    }
    const project = new Sighty({
      scenario: {
        file: invalidFile,
        scenes: {
          layout: { id: 'layout', stories: {} },
          sceneB: { id: 'scene-b', stories: {} },
        },
      },
      runtime: {
        root: document.createElement('div'),
        instanceIds: { layout: 'layout-1', sceneB: 'scene-b-1' },
        layout: { sceneKey: 'layout', storyId: 'main' },
      },
    })

    expect(project.scenario.validate()).toEqual([{
      code: 'AUTHOR_VIEW_ROUTE_UNKNOWN',
      path: 'views.actions.navigation:missing.go.path',
      message: 'L\'action « navigation:missing » du graphe « racine » référence le chemin inconnu « does-not-exist ».',
    }])
    project.runtime.destroy()
  })

  it('rejects unknown and ambiguous route labels during authoring validation', () => {
    const invalidFile: SightyFile<'layout' | 'sceneB', 'main' | 'secondary'> = {
      format: 'sighty',
      version: 2,
      id: 'invalid-label-routes',
      views: {
        start: 'layout',
        actions: {
          'navigation:unknown-label': { go: { label: 'missing' } },
        },
        views: {
          layout: {
            actions: {
              'navigation:ambiguous-label': { go: { label: 'same' } },
            },
            view: {
              scene: 'layout',
              slots: {
                main: [{ id: 'same', view: { scene: 'sceneB' } }],
                secondary: [{ id: 'same', view: { scene: 'sceneB' } }],
              },
            },
          },
        },
      },
    }
    const project = new Sighty({
      scenario: {
        file: invalidFile,
        scenes: {
          layout: { id: 'layout', stories: {} },
          sceneB: { id: 'scene-b', stories: {} },
        },
      },
      runtime: {
        root: document.createElement('div'),
        instanceIds: { layout: 'layout-1', sceneB: 'scene-b-1' },
        layout: { sceneKey: 'layout', storyId: 'main' },
      },
    })

    expect(project.scenario.validate()).toEqual([
      {
        code: 'AUTHOR_VIEW_ROUTE_UNKNOWN',
        path: 'views.actions.navigation:unknown-label.go.label',
        message: 'L\'action « navigation:unknown-label » du graphe « racine » référence le label inconnu « missing ».',
      },
      {
        code: 'AUTHOR_VIEW_ROUTE_AMBIGUOUS',
        path: 'views.layout.actions.navigation:ambiguous-label.go.label',
        message: 'L\'action « navigation:ambiguous-label » de la vue « layout » référence le label ambigu « same ».',
      },
    ])
    project.runtime.destroy()
  })

  it('validates view couplings before runtime initialization', () => {
    const invalidFile: SightyFile<'layout' | 'sceneB', 'main'> = {
      format: 'sighty',
      version: 2,
      id: 'invalid-coupling',
      views: {
        start: 'layout-view',
        views: {
          'layout-view': {
            coupling: {
              couplingId: '',
              controllerSlot: 'unknown',
              controlledSlot: 'missing',
              commands: { 'coupling:invalid': 'stop' },
            } as unknown as SightyGraphView<'layout' | 'sceneB', 'main'>['coupling'],
            view: {
              scene: 'layout',
              slots: {
                main: [{ id: 'scene-b', view: { scene: 'sceneB' } }],
              },
            },
          },
        },
      },
    }
    const project = new Sighty({
      scenario: {
        file: invalidFile,
        scenes: {
          layout: { id: 'layout', stories: {} },
          sceneB: { id: 'scene-b', stories: {} },
        },
      },
      runtime: {
        root: document.createElement('div'),
        instanceIds: { layout: 'layout-1', sceneB: 'scene-b-1' },
        layout: { sceneKey: 'layout', storyId: 'main' },
      },
    })

    expect(project.scenario.validate().map((diagnostic) => diagnostic.code)).toEqual([
      'AUTHOR_COUPLING_ID_MISSING',
      'AUTHOR_COUPLING_CONTROLLER_SLOT_UNKNOWN',
      'AUTHOR_COUPLING_CONTROLLED_SLOT_UNKNOWN',
      'AUTHOR_COUPLING_COMMAND_UNKNOWN',
    ])
    project.runtime.destroy()
  })

  it('validates the public showMode vocabulary before runtime initialization', () => {
    const invalidFile = {
      ...file,
      showMode: 'replay',
    } as unknown as SightyFile<'layout' | 'sceneB', 'main'>
    const project = new Sighty({
      scenario: {
        file: invalidFile,
        scenes: {
          layout: { id: 'layout', stories: {} },
          sceneB: { id: 'scene-b', stories: {} },
        },
      },
      runtime: {
        root: document.createElement('div'),
        instanceIds: { layout: 'layout-1', sceneB: 'scene-b-1' },
        layout: { sceneKey: 'layout', storyId: 'main' },
      },
    })

    expect(project.scenario.validate()).toEqual([{
      code: 'AUTHOR_SHOW_MODE_UNKNOWN',
      path: 'showMode',
      message: 'La politique showMode « replay » est inconnue. Les valeurs admises sont reset, maintain et rewind.',
    }])
    project.runtime.destroy()
  })
})
