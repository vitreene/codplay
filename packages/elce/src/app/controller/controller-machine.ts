import { createMachine } from 'xstate'

/** Shared application state owned by the Elcé controller. */
export interface ElceAppContext {
  readonly documentId: string | null
}

/** Minimal controller boundary used while the document model is introduced in the next tranche. */
export const controllerMachine = createMachine({
  id: 'elce-app',
  types: {
    context: {} as ElceAppContext,
  },
  context: {
    documentId: null,
  },
  initial: 'ready',
  states: {
    ready: {},
  },
})
