import type { ModuleCommandDoc } from '../types'

export type ModuleTechnicalEventName = 'viewport:resize' | 'viewport:orientation' | 'viewport:safe-area'

export type ModuleTechnicalEvent = {
  name: ModuleTechnicalEventName
  data?: Record<string, unknown>
}

export type ModuleEmitEvent = {
  name: string
  data?: Record<string, unknown>
}

export type ModuleEmit = (event: ModuleEmitEvent) => void

export type ModuleLifecycleStatus = 'created' | 'initialized' | 'started' | 'destroyed'

export type ModuleActionRouteMode = 'root-only' | 'exposed-targets'

export type ModuleActionTargetMap = Record<string, unknown>

export type ModuleBaseConstructorInput<TModuleConfig = Record<string, unknown>, TNodeRef = unknown> = {
  runtimeItemId: string
  itemType: string
  moduleConfig?: TModuleConfig
  initialRootNode?: TNodeRef
  emit: ModuleEmit
}

export type ModuleUpdateInput = {
  command: ModuleCommandDoc
  nowMs?: number
}

export type ModuleInitInput = {
  initialData?: Record<string, unknown>
}

export type ModuleRenderInput = {
  nowMs?: number
}

export type RuntimeModule = {
  init: (input?: ModuleInitInput) => void
  start: () => void
  update: (input: ModuleUpdateInput) => void
  render: (input?: ModuleRenderInput) => unknown
  onTechnicalEvent: (event: ModuleTechnicalEvent) => void
  getActionRouteMode?: () => ModuleActionRouteMode
  getActionTargets?: () => ModuleActionTargetMap
  resolveActionTarget?: (targetId: string) => unknown | null
  destroy: () => void
}
