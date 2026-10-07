import type { Actor } from 'xstate'
import type { controllerMachine } from '../controller/controller-machine'
import type { EditorActionsFacade } from '../facades/editor-actions-facade'

export interface AppLayoutProps {
  readonly controller: Actor<typeof controllerMachine>
  readonly actions: EditorActionsFacade
}
