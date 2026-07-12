import type { Actor } from 'xstate'
import { useSelector } from '@xstate/react'
import type { controllerMachine } from '../controller/controller-machine'

export interface DemoMenuRegionProps {
  controller: Actor<typeof controllerMachine>
}

const emptyScene = {
  id: 'demo-scene',
  meta: {
    title: 'Scène de démonstration',
    durationMs: 5000,
    durationSource: 'arbitrary' as const,
    timeUnit: 's' as const,
    capsuleOrder: 'forward' as const,
  },
  items: [],
  contents: {},
  decors: {},
  zones: {},
}

/**
 * Démonstration temporaire de l'étape 2 — deux boutons qui envoient des événements au contrôleur.
 * Pas la vraie région menu (étape 3) : sert uniquement à prouver visuellement que RUN_COMMAND émis
 * ici se reflète dans la région panel, sans lien direct entre les deux composants.
 */
export function DemoMenuRegion({ controller }: DemoMenuRegionProps) {
  const hasScene = useSelector(controller, (state) => state.context.scene !== null)

  return (
    <div className="app-demo-content">
      <button
        type="button"
        disabled={hasScene}
        onClick={() => controller.send({ type: 'SCENE_LOADED', scene: emptyScene })}
      >
        Charger la scène de démo
      </button>
      <button
        type="button"
        disabled={!hasScene}
        onClick={() => controller.send({ type: 'RUN_COMMAND', command: { name: 'createItem', args: { geometry: {} } } })}
      >
        Créer un item
      </button>
    </div>
  )
}
