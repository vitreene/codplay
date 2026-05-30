import type {
  RuntimeModule,
  RuntimeModuleBinding,
  RuntimeModuleHost,
  RuntimeModuleHookPayload
} from '../../components/types'

/**
 * Checks whether one component exposes the list attach/detach/reposition contract.
 */
function isListComponent(component: unknown): boolean {
  if (typeof component !== 'object' || component === null) {
    return false
  }

  const c = component as Record<string, unknown>
  return (
    typeof c.attachChild === 'function' &&
    typeof c.detachChild === 'function' &&
    typeof c.repositionChild === 'function'
  )
}

/**
 * Installs the list module and returns its runtime binding with hooks and match.
 */
function install(host: RuntimeModuleHost): RuntimeModuleBinding {
  function onComponentMounted(payload: RuntimeModuleHookPayload): void {
    const { perso, component } = payload
    if (perso === undefined || component === undefined) {
      return
    }

    if (isListComponent(component)) {
      host.registries.container.set(perso.id, component as import('../../components/types').RuntimeListComponent)
      host.registries.mounted.set(perso.id, true)
    }
  }

  function onComponentUnmounted(payload: RuntimeModuleHookPayload): void {
    const { perso } = payload
    if (perso === undefined) {
      return
    }

    host.registries.container.delete(perso.id)
  }

  return {
    runtime: {
      hooks: { onComponentMounted, onComponentUnmounted },
      match: { componentCapabilities: ['list'] }
    }
  }
}

/**
 * The list module — maintains the container registry for list components.
 */
export const listModule: RuntimeModule = { install }
