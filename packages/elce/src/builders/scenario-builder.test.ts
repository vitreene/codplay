import { describe, expect, it } from 'vitest'
import type { SceneDoc } from 'codplay/scene/types'
import { PAGE_LOCATION } from '../config/document-config'
import { applyDocumentCommand, createPageCommand } from '../app/commands/document-commands'
import { createInitialDocument } from '../domain/document-model'
import { buildScenario } from './scenario-builder'

const emptyScene: SceneDoc<string> = { id: 'empty-scene', stories: {} }

describe('Elcé scenario builder', () => {
  it('keeps page ordering in a separate Sighty graph', () => {
    const document = createInitialDocument()
    const scenario = buildScenario(document, { 'scene-page-a': emptyScene })

    expect(scenario.scenes?.['scene-page-a']).toBe(emptyScene)
    expect(scenario.scenes?.['scene-layout']).toMatchObject({ id: 'elce-document-layout-scene' })
    expect(scenario.scenes?.['scene-menu']).toMatchObject({ id: 'elce-document-menu-scene' })
    expect(scenario.scenes?.['scene-title']).toMatchObject({ id: 'scene-title-document' })
    expect(scenario.scenes?.['scene-navigation']).toMatchObject({ id: 'scene-navigation-document' })
    expect(scenario.views).toMatchObject({ start: 'main' })

    const layoutSource = scenario.scenes?.['scene-layout']
    const layoutScene = layoutSource === undefined
      ? undefined
      : 'stories' in layoutSource
        ? layoutSource
        : layoutSource.sceneDoc
    const layoutPersos = layoutScene?.stories.main?.persos ?? []
    expect(layoutPersos.map((perso) => perso.name)).toEqual(expect.arrayContaining([
      'slot-menu',
      'slot-title',
      'slot-content',
      'slot-navigation',
    ]))
  })

  it('places root pages beside chapters and keeps catalogue pages out of the menu', () => {
    const initial = createInitialDocument()
    const withRootPage = applyDocumentCommand(initial, createPageCommand({
      pageId: 'page-root',
      bdcId: 'bdc-section-root',
      placement: { kind: PAGE_LOCATION.SCENARIO },
    }))
    const document = applyDocumentCommand(withRootPage, createPageCommand({
      pageId: 'page-catalog',
      bdcId: 'bdc-section-catalog',
      placement: { kind: PAGE_LOCATION.CATALOG },
    }))
    const scenario = buildScenario(document, {
      'scene-page-a': emptyScene,
      'scene-page-root': emptyScene,
    })
    const menuScene = scenario.scenes?.['scene-menu']
    const menuMarkup = menuScene !== undefined && 'stories' in menuScene
      ? String(menuScene.stories.main?.persos[0]?.initial && 'markup' in menuScene.stories.main.persos[0].initial
        ? menuScene.stories.main.persos[0].initial.markup
        : '')
      : ''

    expect(scenario.data?.pageIds).toEqual(['page-root', 'page-a'])
    expect(scenario.data?.pagePaths).toMatchObject({
      'page-root': 'main/view-root-pages/slot-content/page-root',
      'page-a': 'main/chapter-1/slot-content/page-a',
    })
    const mainView = scenario.views !== undefined && 'views' in scenario.views
      ? scenario.views.views.main
      : undefined
    const scenarioGraph = mainView?.view.views
    expect(scenarioGraph !== undefined && 'start' in scenarioGraph ? scenarioGraph.start : undefined).toBe('view-root-pages')
    expect(scenarioGraph !== undefined && 'views' in scenarioGraph
      ? scenarioGraph.views['view-root-pages']?.view.slots?.['slot-content']
      : undefined).toMatchObject({ start: 'page-root' })
    expect(scenarioGraph !== undefined && 'views' in scenarioGraph
      ? scenarioGraph.views['chapter-1']?.view.slots?.['slot-content']
      : undefined).toMatchObject({ start: 'page-a' })
    expect(menuMarkup).toContain('id="elce-menu-scenario-pages"')
    expect(menuMarkup).not.toContain('elce-menu-scenario-group')
    expect(menuMarkup).not.toContain('page-catalog')
    expect(menuScene !== undefined && 'stories' in menuScene
      ? menuScene.stories.main?.persos.some((perso) => perso.id === 'elce-menu-page-button-page-catalog')
      : false).toBe(false)
  })
})
