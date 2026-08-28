import type { RuntimeComponentUpdateInput } from 'codplay-v1/runtime/components/types'

export type Avatar3DRuntimeMode = 'play' | 'seek'

export type Avatar3DRuntimeUpdateInput = RuntimeComponentUpdateInput

export type Avatar3DWarningReporter = (code: string, message: string, details?: Record<string, unknown>) => void
