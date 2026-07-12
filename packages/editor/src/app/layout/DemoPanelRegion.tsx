import type { Actor } from 'xstate'
import { useSelector } from '@xstate/react'
import type { controllerMachine } from '../controller/controller-machine'

export interface DemoPanelRegionProps {
  controller: Actor<typeof controllerMachine>
}

/**
 * Démonstration temporaire de l'étape 2 — lit le MÊME contexte que `DemoMenuRegion`, sans lien
 * direct entre les deux composants : la preuve que le contrôleur est le seul point de vérité.
 */
export function DemoPanelRegion({ controller }: DemoPanelRegionProps) {
  const itemIds = useSelector(controller, (state) => state.context.scene?.items.map((item) => item.id) ?? [])

  return (
    <div className="app-demo-content">
      <p>Items dans le document : {itemIds.length}</p>
      <ul>
        {itemIds.map((id) => (
          <li key={id}>{id}</li>
        ))}
      </ul>
    </div>
  )
}
