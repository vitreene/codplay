import type { Handle, RemixNode } from 'remix/ui'

export interface EditorContext<TController extends object, TActions extends object> {
  readonly controller: TController | null
  readonly actions: TActions | null
}

export interface EditorContextProviderProps<TController extends object, TActions extends object>
  extends EditorContext<TController, TActions> {
  readonly children?: RemixNode
}

/** Creates a typed context provider for one composition's actor and action ports. */
export function createEditorContextProvider<TController extends object, TActions extends object>() {
  return function EditorContextProvider(
    handle: Handle<EditorContextProviderProps<TController, TActions>, EditorContext<TController, TActions>>,
  ) {
    handle.context.set({ controller: handle.props.controller, actions: handle.props.actions })
    return () => handle.props.children ?? null
  }
}
