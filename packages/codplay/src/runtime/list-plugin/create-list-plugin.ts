import type { ListAutoAnimateConfig, ListPerfConfig } from '../types'
import { runListPlugin } from './run-list-plugin'
import type { ListPlugin } from './types'

export type CreateListPluginOptions = {
  runtimeListId: string
  nodeRef: unknown
  autoAnimate?: ListAutoAnimateConfig
  perf?: ListPerfConfig
}

/**
 * Creates one list plugin instance bound to a runtime list element.
 *
 * @deprecated Legacy runtime path. The current component-based list runtime
 * does not consume this plugin pipeline anymore.
 */
export function createListPlugin(options: CreateListPluginOptions): ListPlugin {
  return {
    name: 'list-plugin',
    runtimeListId: options.runtimeListId,
    nodeRef: options.nodeRef,
    compute: (input) => {
      return runListPlugin({
        runtimeListId: options.runtimeListId,
        nodeRef: options.nodeRef,
        autoAnimate: options.autoAnimate,
        perf: options.perf,
        ...input
      })
    }
  }
}
