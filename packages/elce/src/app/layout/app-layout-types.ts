import type { Actor } from 'xstate'
import type { controllerMachine } from '../controller/controller-machine'
import type { EditorActionsFacade } from '../facades/editor-actions-facade'

export type AppLayoutSurface = 'full' | 'remix-page-work-area'

export interface AppLayoutProps {
  readonly controller: Actor<typeof controllerMachine>
  readonly actions: EditorActionsFacade
  readonly hideHeader?: boolean
  readonly surface?: AppLayoutSurface
}
