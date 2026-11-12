import { describe, expect, it } from 'vitest'
import { CoreEditorFacade } from './core-editor-facade'

describe('CoreEditorFacade', () => {
  it('routes project, history, access and rename intentions through injected ports', () => {
    const events: unknown[] = []
    const names: string[] = []
    const facade = new CoreEditorFacade((event) => events.push(event), (name) => names.push(name))

    facade.bootstrapProjects('project-current')
    facade.undo()
    facade.redo()
    facade.cancelImport()
    facade.retryProjectAccess()
    facade.forceProjectAccess()
    facade.openProject('project-next')
    facade.renameActiveProject('Nom modifié')

    expect(events).toEqual([
      { type: 'project.operation', operation: { kind: 'bootstrap', rememberedProjectId: 'project-current' } },
      { type: 'history.undo' },
      { type: 'history.redo' },
      { type: 'import.cancel' },
      { type: 'project.access.retry' },
      { type: 'project.access.force' },
      { type: 'project.operation', operation: { kind: 'open', projectId: 'project-next' } },
    ])
    expect(names).toEqual(['Nom modifié'])
  })
})
