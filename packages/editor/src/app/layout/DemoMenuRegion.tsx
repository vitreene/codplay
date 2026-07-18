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
 * Un item à 2 kf, décor EXPLICITE et distinct sur chacun (déplacement + rotation + couleur) —
 * pas de dépendance au preset par défaut (`assignType` le pose, mais chaque kf écrase ses propres
 * champs, § cascade `build-scene.ts::resolveKeyframeCascadeStyle`). `laneX` sépare les items en
 * lanes horizontales fixes (jamais de mouvement en x) : non-superposition garantie PAR CONSTRUCTION,
 * indépendamment de tout bug éventuel d'interpolation sur les autres champs — seul ce qu'on observe
 * (couleur/y/rotation) doit varier entre kf1 et kf2, jamais ce qui sert de repère de non-régression.
 */
function createLaneTestItem(
  controller: Actor<typeof controllerMachine>,
  laneX: number,
  label: string,
  kf1: { color: string },
  kf2: { color: string; rotate: number },
): void {
  controller.send({ type: 'RUN_COMMAND', command: { name: 'createItem', args: { geometry: {} } } })
  const items = controller.getSnapshot().context.scene?.items ?? []
  const itemId = items[items.length - 1]?.id
  if (!itemId) return
  controller.send({
    type: 'RUN_TRANSACTION',
    commands: [
      { name: 'assignType', args: { itemId, type: 'text' } },
      { name: 'assignContent', args: { itemId, content: { type: 'text', text: label } } },
      { name: 'createKeyframe', args: { itemId, timeMs: 0 } },
      { name: 'createKeyframe', args: { itemId, timeMs: emptyScene.meta.durationMs } },
    ],
  })
  const item = controller.getSnapshot().context.scene!.items.find((i) => i.id === itemId)!
  const [firstKf, secondKf] = [...item.keyframes].sort((a, b) => a.timeMs - b.timeMs)
  controller.send({
    type: 'RUN_TRANSACTION',
    commands: [
      {
        name: 'setDecor',
        args: {
          decorId: firstKf!.decorId,
          // `width`/`height` explicites (jamais laissés auto) : taille prévisible, condition
          // nécessaire pour garantir par calcul que le déplacement + la rotation restent dans le
          // cadre — une boîte de taille inconnue rendrait toute marge choisie ici arbitraire.
          patch: { offset: { translate: { x: laneX, y: 15 }, width: 18, height: 18, rotate: 0 }, style: { 'background-color': kf1.color } },
        },
      },
      {
        name: 'setDecor',
        args: {
          decorId: secondKf!.decorId,
          // Déplacement/rotation volontairement modérés (15cqw, 15°) — à `width/height:18` et
          // `laneX ∈ {8, 54}` (marge ≥8 de chaque bord, lanes espacées ≥28), même à rotation
          // maximale (diagonale ≈ 18·√2 ≈ 25.5cqw) la boîte reste entièrement dans un cadre
          // 0..100cqw carré ou plus large — jamais de sortie de vue pendant la démo.
          patch: { offset: { translate: { x: laneX, y: 50 }, width: 18, height: 18, rotate: kf2.rotate }, style: { 'background-color': kf2.color } },
        },
      },
    ],
  })
}

/**
 * Répro contrôlée (2026-07-18) : deux items côte à côte (lanes x=8/x=54, jamais de mouvement en x —
 * voir `createLaneTestItem`), chacun avec un décor CLAIREMENT distinct à kf1 et kf2 (position y,
 * rotation, couleur). Aucune sélection posée à la fin — teste d'abord le rendu SANS interférence de
 * dedit, avant d'introduire la sélection comme variable. Rotation limitée à 15° (voir
 * `createLaneTestItem` pour le calcul de marge) — reste visible dans le cadre à tout instant.
 */
function createPositionColorTestScene(controller: Actor<typeof controllerMachine>): void {
  controller.send({ type: 'CLEAR_SELECTION' })
  createLaneTestItem(controller, 8, 'Item A', { color: 'oklch(0.6 0.24 25)' }, { color: 'oklch(0.6 0.24 260)', rotate: 15 })
  createLaneTestItem(controller, 54, 'Item B', { color: 'oklch(0.6 0.24 145)' }, { color: 'oklch(0.7 0.2 80)', rotate: -15 })
  controller.send({ type: 'CLEAR_SELECTION' })
}

/**
 * Démonstration temporaire de l'étape 2 — boutons qui envoient des événements au contrôleur.
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
      <button
        type="button"
        disabled={!hasScene}
        onClick={() => createPositionColorTestScene(controller)}
      >
        Test position + couleur (2 items, sans sélection)
      </button>
    </div>
  )
}
