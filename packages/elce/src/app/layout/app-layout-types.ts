import type { Actor } from 'xstate'
import type { controllerMachine } from '../controller/controller-machine'

export interface AppLayoutProps {
  readonly controller: Actor<typeof controllerMachine>
}
