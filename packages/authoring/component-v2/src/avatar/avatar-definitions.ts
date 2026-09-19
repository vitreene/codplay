import type { CodPlayEngineOptions, RuntimeComponentDefinition } from 'codplay'
import { AvatarComponent } from './avatar-component'
import { AvatarGestureComponent } from './avatar-gesture-component'
import { AvatarIdleComponent } from './avatar-idle-component'
import { AvatarLipSyncComponent } from './avatar-lip-sync-component'
import { AvatarMoodComponent } from './avatar-mood-component'
import {
  validateAvatarGesture,
  validateAvatarIdle,
  validateAvatarInitial,
  validateAvatarLipSync,
  validateAvatarMood,
} from './avatar-validation'

/** Definition of the central Avatar model component. */
export const AVATAR_DEFINITION: RuntimeComponentDefinition = {
  type: 'avatar',
  component: AvatarComponent,
  modules: [],
  libraries: ['three'],
  runtimeProfile: 'attached',
  validateInitial: validateAvatarInitial,
  targetProvider: (component) => component instanceof AvatarComponent
    ? { value: component.getTarget(), scope: 'target' }
    : undefined,
}

/** Definition of the generic mood feature component. */
export const AVATAR_MOOD_DEFINITION: RuntimeComponentDefinition = {
  type: 'avatar-mood',
  component: AvatarMoodComponent,
  modules: [],
  runtimeProfile: 'attached',
  validateInitial: validateAvatarMood,
  validateAction: validateAvatarMood,
}

/** Definition of the generic lip-sync feature component. */
export const AVATAR_LIP_SYNC_DEFINITION: RuntimeComponentDefinition = {
  type: 'avatar-lip-sync',
  component: AvatarLipSyncComponent,
  modules: [],
  runtimeProfile: 'attached',
  validateInitial: validateAvatarLipSync,
  validateAction: validateAvatarLipSync,
}

/** Definition of the generic gesture feature component. */
export const AVATAR_GESTURE_DEFINITION: RuntimeComponentDefinition = {
  type: 'avatar-gesture',
  component: AvatarGestureComponent,
  modules: [],
  runtimeProfile: 'attached',
  validateInitial: validateAvatarGesture,
  validateAction: validateAvatarGesture,
}

/** Definition of the non-event-driven Avatar idle feature component. */
export const AVATAR_IDLE_DEFINITION: RuntimeComponentDefinition = {
  type: 'avatar-idle',
  component: AvatarIdleComponent,
  modules: [],
  runtimeProfile: 'attached',
  validateInitial: validateAvatarIdle,
}

/** Avatar component set registered explicitly by an application. */
export const AVATAR_COMPONENTS: readonly RuntimeComponentDefinition[] = [
  AVATAR_DEFINITION,
  AVATAR_MOOD_DEFINITION,
  AVATAR_LIP_SYNC_DEFINITION,
  AVATAR_GESTURE_DEFINITION,
  AVATAR_IDLE_DEFINITION,
]

/** Engine capabilities contributed by the Avatar module. */
export const AVATAR_ENGINE: Pick<CodPlayEngineOptions, 'components'> = {
  components: { register: AVATAR_COMPONENTS },
}
