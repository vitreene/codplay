# Session context - 2026-04-19

## Objet

Reprise de l implementation `move.flipMode = "overlay-world"` sans regression du mode FLIP local.

## Etat actuel

- Le mode local FLIP reste inchange (pipeline existant conserve).
- Le mode overlay-world est active uniquement en opt-in (`flipMode: "overlay-world"`).
- Le node reel est toujours reparent dans la list cible (comme local), mais masque pendant la transition ghost.

## Strategie overlay-world en place

1. Capturer `old` (FIRST world) avant move.
2. Appliquer le move/reparent normal.
3. Capturer `next` (LAST world) apres move.
4. Creer un ghost overlay (fixed) clone du node cible.
5. Calibrer le ghost sur `old` en world (`getBoundingClientRect` + correction iterative left/top/width/height).
6. Animer le ghost vers `next` (world) en left/top/width/height.
7. Pendant l animation, appliquer une compensation per-frame du drift de la list-cible via le rect live du node masque (suivi de transform parent).
8. A `onFinalize(completed)`, recaler le ghost sur la position/size world reelle du node cible, puis reveal node + remove ghost.

## Logs disponibles (copiables)

Uniquement pour le premier event overlay-world de la session chargee:

- `[FLIP_OVERLAY_WORLD_START] { ... }`
- `[FLIP_OVERLAY_WORLD_END] { ... }`

Contenu principal du payload:

- `old`, `next`, `ghost`, `node`
- `residual.oldToGhost`
- `residual.nextToGhost`
- `residual.nextToNode`
- `residual.ghostToNode`

## Lecture rapide des logs

- `START`:
  - `oldToGhost` proche de zero => seed world correcte.
- `END`:
  - `ghostToNode` proche de zero => pas de jump visuel a la finalisation.
  - `nextToNode` non nul possible si les parents/listes continuent de bouger apres capture `next`.
  - en cas de drift parent, `nextToGhost` doit rester contenu grace au suivi per-frame.

## Point d attention restant

Le drift de la list cible pendant la transition peut decaler `next` (capture ponctuelle) par rapport au node reel en fin.
Le handoff ghost->node doit rester prioritaire pour eviter un saut visuel meme si `next` est stale.

## Commandes de verification

- `npm run build`
- `npm test`
- demo active: `npm run dev:demo`

## Fichiers modifies dans cette session

- `src/runtime/components/runtime-component-orchestrator.ts`
- `src/animation/adapter.ts`
- `src/animation/types.ts`
- `src/demos/player-poc-demo.ts`
