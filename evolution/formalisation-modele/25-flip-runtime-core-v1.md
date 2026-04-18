# FLIP runtime core V1

## Statut

Reference V1 normative pour le calcul et l'execution FLIP runtime.

## Preambule - intention

Le calcul FLIP doit etre:

- unique (un seul chemin de calcul)
- deterministic
- verifiable visuellement
- integre au pipeline animation global (`animejs` via adapter)

Point central:

- le state interne (`Perso` / composant) prepare le contexte
- la mesure DOM reste la source de verite pour positions/taille/transform

## Portee

Ce document couvre:

- contrat d'entree/sortie du moteur FLIP
- algorithme FIRST/LAST/INVERT/PLAY
- calcul matriciel obligatoire
- gestion width/height obligatoire
- interruption/reprise (`play/pause/seek`)

## Hors perimetre V1

- options auteur de rendu FLIP avancees
- variantes de calcul alternatives
- tuning heuristique multi-profils

## Regles cardinales V1

1. un seul systeme de calcul
2. `width`/`height` toujours calcules et interpoles
3. correction matricielle transform toujours active
4. interruption immediate sur nouvelle transition
5. reprise depuis etat courant mesure

## Vocabulaire

- `touched set`: ensemble des elements impliques par une mutation
- `FIRST`: snapshot avant mutation
- `LAST`: snapshot apres mutation
- `INVERT`: etat de depart d'animation derive FIRST->LAST
- `PLAY`: execution des transitions via pipeline animation global

## Contrat d'entree

```ts
type FlipEntry = {
  id: string
  nodeRef: unknown
}

type FlipRunInput = {
  eventId: string
  eventSeq: number
  reason: 'local-move' | 'transfer-in' | 'transfer-out' | 'auto' | 'detach'
  entries: FlipEntry[] // touched set
  animation?: {
    durationMs?: number
    easing?: string
    trajectory?: 'linear' | 'curve'
  }
  mutate: () => void
}
```

Note:

- aucune option metier `includeSize` / `includeTransformMatrix` dans le contrat V1

## Contrat de sortie

```ts
type FlipTransition = {
  transitionId: string
  target: unknown
  from: { x?: number; y?: number; width?: number; height?: number }
  to: { x?: number; y?: number; width?: number; height?: number }
  durationMs: number
  easing?: string
  delayMs?: number
}
```

## Trajectory (note V1)

Regles V1:

- `trajectory` par defaut: `linear`
- `trajectory: 'curve'` active une trajectoire courbe (x/y non strictement synchrones)
- objectif visuel: donner l'impression que le deplacement est attire vers le centre de la scene

Contraintes:

- `curve` reste calculee dans le moteur FLIP puis transmise au pipeline animation global
- la matrice reste reservee aux calculs internes (jamais une propriete animee)

Note de fabrication:

- le detail exact de generation de courbe sera finalise a l'implementation

## Donnees snapshot minimales

Pour chaque entree mesuree:

- `left`, `top`, `width`, `height` (DOM rect)
- `transformValue` (computed transform)
- `transformOrigin`
- `translateX`, `translateY` (channels animation courants)
- `parentMatrix` (matrice combinee des parents)
- `nodeMatrix` (matrice locale du node)

## Methode de reference GSAP (adaptation)

Cette spec reprend la logique de reference GSAP Flip, adaptee a un runtime controle:

- `ElementState.update` -> capture snapshot riche
- `getGlobalMatrix` / conversion coordonnees -> base du calcul matriciel
- `_fit` -> derivee FIRST/LAST vers x/y/width/height animables
- `interrupt`/`kill` -> interruption immediate puis relance

Difference majeure avec GSAP:

- notre runtime connait les composants et leur parentage
- preparation amont possible dans les composants
- mais decision finale basee sur mesure DOM (source de verite)

## Algorithme canonique

### Etape 0 - Preparation

1. construire le `touched set`
2. ordonner le set de maniere stable
3. verifier les `nodeRef` mesurables

### Etape 1 - Capture FIRST

Pour chaque element du `touched set`:

- lire rect via `getBoundingClientRect()`
- lire transform calcule
- lire channels de translation courants (`x/y`)
- calculer matrice parent combinee
- parser la matrice locale du node

### Etape 2 - Mutate

- executer `mutate()` (move/reparent/reorder/detach)

### Etape 3 - Capture LAST

- repetition de l'etape FIRST apres mutation

### Etape 4 - Calcul INVERT (obligatoire)

Pour chaque element present en FIRST+LAST:

- `dx = first.left - last.left`
- `dy = first.top - last.top`

Matrice locale de conversion:

- `M = parentMatrixLast * nodeMatrixLast * Translate(-txLast, -tyLast)`

Delta local:

- `local = inverse(M) * [dx, dy]`
- fallback securise: si non inversible, utiliser `dx/dy`

Channels x/y:

- `from.x = local.x + txLast`
- `to.x = txLast`
- `from.y = local.y + tyLast`
- `to.y = tyLast`

Channels size:

- `from.width = first.width`
- `to.width = last.width`
- `from.height = first.height`
- `to.height = last.height`

### Etape 5 - PLAY

1. appliquer l'etat INVERT si necessaire
2. forcer un frame barrier
3. convertir en transitions runtime
4. executer via le pipeline animation global

## Reparent et chaine de transform

Regle V1:

- la conversion doit utiliser la chaine parent->parent via matrice
- pas de calcul simplifie en delta brut pour les cas reparent

Implementation:

- `DOMMatrix` (ou equivalent) pour composition/inversion
- accumulation des transforms parents dans l'ordre racine -> parent direct

## Portee de la matrice transform

Regles V1:

- la matrice (`DOMMatrix` / `matrix2d`) sert uniquement aux calculs internes FLIP
- la matrice n'est pas une propriete animee par `animejs`
- les canaux envoyes a l'animation restent: `x`, `y`, `width`, `height` (et eventuels canaux explicites hors FLIP)

Consequences:

- pas de `property: 'matrix'` dans les transitions runtime
- les valeurs matricielles ne sont ni exposees au contrat auteur ni persistees comme canaux d'animation

## Width/height: regle stricte

Regles V1:

- `width`/`height` sont toujours animes quand variation detectee
- pendant transition: valeurs explicites appliquees
- fin de transition: restauration propre

Restauration:

- si width/height inline existaient avant FLIP: restaurer les valeurs precedentes
- sinon: supprimer les props inline ajoutees par FLIP

## Interaction avec transitions explicites (`style.to`)

Regles:

- FLIP et transitions explicites partagent le meme pipeline global
- si un channel est deja pilote explicitement, eviter la double conduite contradictoire
- composition preferee: `merge`

Contrainte:

- la capture FIRST/LAST doit refleter l'etat reel au moment du calcul, y compris transform deja present

## Concurrence et interruption

Regles V1:

- nouvelle transition sur meme cible => interruption immediate de l'animation active
- recapture et relance depuis etat courant
- aucune file d'attente implicite

## Play / pause / seek

Regles:

- `pause`: suspension via pipeline global
- `play`: reprise via pipeline global
- `seek`: interruption + recapture + relance vers etat cible seek

Alignement:

- meme logique que micro-animations texte (`21-text-micro-animations-v1.md`)

## Logging / trace

Appliquer `24-runtime-log-policy-v1.md`.

Tracer seulement:

- `eventId`, `eventSeq`, `reason`
- cardinalite du `touched set`
- interruption/reprise
- warnings de fallback calcul (matrice non inversible, node non mesurable)

Mode debug seulement:

- details FIRST/LAST complets par element

## Warnings runtime recommandes

- `RUNTIME_FLIP_ENTRY_NOT_MEASURABLE`
- `RUNTIME_FLIP_MATRIX_NON_INVERTIBLE_FALLBACK_WORLD_DELTA`
- `RUNTIME_FLIP_TRANSITION_INTERRUPTED_RESTARTED`
- `RUNTIME_FLIP_SIZE_RESTORE_FAILED`

## Tests smoke obligatoires

1. move local sans transform parent
2. move local avec parent transform
3. transfer inter-list avec parents transformes
4. resize simultane + move
5. transition explicite `style.to` concurrente
6. interruption par nouvelle transition
7. seek pendant transition
8. validation visuelle width/height restore

## Cas de reference (A/B1/B2/C)

Le cas suivant est retenu comme test de reference FLIP reparent:

```html
<div id="A" style="transform:rotate(20deg) scale(1.2)">
  <div id="B1" style="transform:translateX(50px) rotate(-40deg) scale(1.1)">
    <div id="C" style="translate:0 150px; rotate:0.4turn; scale:0.8">MOVE</div>
  </div>
  <div id="B2" style="transform:translateX(200px)"></div>
</div>
```

Strategie de validation en 2 phases:

1. phase moteur isolee (hors Player):
   - valider capture FIRST/LAST
   - valider conversion world -> local
   - valider transitions `x/y/width/height`

2. phase integration Player:
   - transformer le scenario en `Perso` dans une sequence
   - valider `play/pause/seek`, interruption/reprise

Note implementation:

- le positionnement initial exact des elements (layout de base, dimensions, contraintes CSS) sera precise lors de la redaction concrete du test

## Liens

- `23-list-component-v1.md`
- `21-text-micro-animations-v1.md`
- `24-runtime-log-policy-v1.md`
