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
  markerTracks: {},
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
        onClick={() => {
          // `buildSceneDoc` ne supporte que `type: 'text'` (§6 du plan) — sans ce second temps,
          // l'item reste `bloc` et ne peut pas être rendu par `scenePlayer`. `createItem` ne
          // renvoie pas son id via `RUN_COMMAND` (§4 : la seule sortie du contrôleur est `scene`) ;
          // il est ajouté en fin de tableau (`base-commands.ts::createItem`), donc lisible juste après.
          controller.send({ type: 'RUN_COMMAND', command: { name: 'createItem', args: { geometry: {} } } })
          const items = controller.getSnapshot().context.scene?.items ?? []
          const itemId = items[items.length - 1]?.id
          if (!itemId) return
          controller.send({
            type: 'RUN_TRANSACTION',
            commands: [
              { name: 'assignType', args: { itemId, type: 'text' } },
              { name: 'assignContent', args: { itemId, content: { type: 'text', text: 'Nouvel item' } } },
              // Sans keyframe, `CapsuleDistribution` n'a ni introMs ni outroMs à verrouiller — l'item
              // hérite du fade-in par défaut du type `card` sans jamais recevoir l'eventime qui le
              // déclenche (`buildTransitionEvents` lit `item.keyframes[0]`/`[…length-1]`) : il reste
              // à `opacity:0` en permanence. Deux keyframes (bornes du clip) donnent un intro/outro
              // résolus sur toute la durée de la scène plutôt que confondus au même instant.
              { name: 'createKeyframe', args: { itemId, timeMs: 0 } },
              { name: 'createKeyframe', args: { itemId, timeMs: emptyScene.meta.durationMs } },
            ],
          })
          // Sans ça, la sélection centrale reste sur l'item précédent — dedit continue d'éditer sa
          // cible d'avant, pas le nouvel item (bug constaté : un réglage de décor semblait « s'appliquer
          // partout » alors qu'il touchait en fait l'ancien item, invisible sous le nouveau qui partage
          // la même géométrie par défaut).
          controller.send({ type: 'SELECT_ITEM', itemIds: [itemId] })
        }}
      >
        Créer un item
      </button>
    </div>
  )
}
