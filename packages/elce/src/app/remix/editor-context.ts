import type { Actor } from 'xstate'
import type { RemixNode, Handle } from 'remix/ui'
import { controllerMachine } from '../controller/controller-machine'
import type { EditorActionsFacade } from '../facades/editor-actions-facade'

export interface EditorContext {
  readonly controller: Actor<typeof controllerMachine> | null
  readonly actions: EditorActionsFacade | null
}

export interface EditorContextProviderProps extends EditorContext {
  readonly children?: RemixNode
}

/** Makes the existing editor actor and action facade available to Remix descendants. */
export function EditorContextProvider(handle: Handle<EditorContextProviderProps, EditorContext>) {
  handle.context.set({ controller: handle.props.controller, actions: handle.props.actions })
  return () => handle.props.children ?? null
}
