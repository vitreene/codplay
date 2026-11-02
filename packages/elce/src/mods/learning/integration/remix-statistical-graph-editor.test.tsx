// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { createActor } from 'xstate'

import { render } from 'remix/ui/test'
import { STATISTICAL_GRAPH_BDC_TYPE } from '../../../resources/bdcs/statistical-graph/statistical-graph-config'
import { controllerMachine } from '../../../app/controller/controller-machine'
import { LearningEditorFacade } from '../authoring/learning-editor-facade'
import { renderRemixStatisticalGraphEditor } from '../../../resources/bdcs/statistical-graph/authoring/remix-statistical-graph-editor'

describe('Remix Statistical Graph editor', () => {
  it('includes the graph builder stylesheet in its visual preview', async () => {
    const controller = createActor(controllerMachine, { input: {} })
    controller.start()
    controller.send({ type: 'editor.access.activate' })
    const actions = new LearningEditorFacade(controller)
    const initialDocument = controller.getSnapshot().context.document
    const page = initialDocument.pages[0]
    if (page === undefined) throw new Error('The graph editor fixture has no page.')

    actions.createStatisticalGraph(page.id, page.bdcIds.length)
    const graphBdc = controller.getSnapshot().context.document.bdcs.find((entry) => entry.type === STATISTICAL_GRAPH_BDC_TYPE)
    if (graphBdc === undefined || graphBdc.statisticalGraph == null) throw new Error('The graph editor fixture has no statistical graph BDC.')
    const rendered = render(renderRemixStatisticalGraphEditor(
      graphBdc,
      actions.createStatisticalGraphEditorActions(graphBdc.id, graphBdc.statisticalGraph),
    ))
    const dialog = rendered.$(`#elce-statistical-graph-preview-dialog-${graphBdc.id}`) as HTMLDialogElement | null
    if (dialog === null) throw new Error('The graph editor fixture has no graph preview dialog.')
    dialog.showModal = () => { dialog.open = true }

    await rendered.act(() => {
      const button = rendered.$(`#elce-statistical-graph-preview-open-${graphBdc.id}`)
      if (button === null) throw new Error('The graph editor fixture has no preview button.')
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    const style = rendered.$(`#elce-graph-preview-style-${graphBdc.id}`)
    expect(style?.textContent).toContain('fill: #326c64;')
    expect(style?.textContent).toContain('stroke: #c27b3a;')
    expect(style?.textContent).toContain('background-color: #bd6688;')

    rendered.cleanup()
    controller.stop()
  })

  it('commits numeric cell input and accepts a paste beyond 40 data rows', async () => {
    const controller = createActor(controllerMachine, { input: {} })
    controller.start()
    controller.send({ type: 'editor.access.activate' })
    const actions = new LearningEditorFacade(controller)
    const initialDocument = controller.getSnapshot().context.document
    const page = initialDocument.pages[0]
    if (page === undefined) throw new Error('The graph editor fixture has no page.')

    actions.createStatisticalGraph(page.id, page.bdcIds.length)
    let document = controller.getSnapshot().context.document
    const graphBdc = document.bdcs.find((entry) => entry.type === STATISTICAL_GRAPH_BDC_TYPE)
    if (graphBdc === undefined || graphBdc.statisticalGraph == null) throw new Error('The graph editor fixture has no statistical graph BDC.')
    const initialGraph = graphBdc.statisticalGraph
    const rendered = render(renderRemixStatisticalGraphEditor(
      graphBdc,
      actions.createStatisticalGraphEditorActions(graphBdc.id, initialGraph),
    ))

    expect(rendered.$(`#elce-statistical-graph-editor-${graphBdc.id}`)?.getAttribute('aria-label')).toBe('Éditeur de graphe')
    expect((rendered.$(`#elce-statistical-graph-editor-title-${graphBdc.id}`)?.textContent ?? '').trim()).toBe('Graphe')

    await rendered.act(() => {
      const cell = rendered.$('[aria-label="Valeur catégorie 1, série 1"]') as HTMLInputElement | null
      if (cell === null) throw new Error('The graph editor fixture has no first value cell.')
      cell.value = '12'
      cell.dispatchEvent(new Event('input', { bubbles: true }))
    })

    document = controller.getSnapshot().context.document
    const editedGraph = document.bdcs.find((entry) => entry.id === graphBdc.id)?.statisticalGraph
    expect(editedGraph?.values).toEqual([{ categoryId: initialGraph.categories[0]?.id, seriesId: initialGraph.series[0]?.id, value: 12 }])

    await rendered.act(() => {
      const grid = rendered.$('.elce-statistical-graph-editor__grid') as HTMLTableElement | null
      if (grid === null) throw new Error('The graph editor fixture has no paste grid.')
      const event = new Event('paste', { bubbles: true, cancelable: true })
      const clipboardData = { getData: (type: string) => type === 'text/plain' ? Array.from({ length: 42 }, (_, index) => `R${index + 1}`).join('\n') : '' }
      Object.defineProperty(event, 'clipboardData', { value: clipboardData })
      grid.dispatchEvent(event)
    })

    document = controller.getSnapshot().context.document
    const pastedGraph = document.bdcs.find((entry) => entry.id === graphBdc.id)?.statisticalGraph
    expect(pastedGraph?.categories).toHaveLength(41)
    expect(pastedGraph?.series).toHaveLength(1)
    expect(rendered.$(`#elce-statistical-graph-grid-error-${graphBdc.id}`)?.textContent).toBe('')

    rendered.cleanup()
    controller.stop()
  })
})
