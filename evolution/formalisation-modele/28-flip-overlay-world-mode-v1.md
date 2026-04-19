# FLIP overlay world mode V1

## Statut

Reference V1 optionnelle (feature auteur), orientee runtime DOM.

## Preambule - intention

Cette spec introduit une variante FLIP lourde, activee intentionnellement par l'auteur, pour traiter un cas visuel specifique:

- deux containers list se chevauchent avec un ordre de pile stable
- un item transferre vers la list visuellement derriere
- l'item transferre est masque pendant la transition

La variante vise a garantir la continuite visuelle et la coherence `play/pause/seek` dans ce contexte.

## Positionnement architectural

Regle structurante:

- FLIP (local ou overlay-world) est une capacite runtime DOM
- FLIP n'est pas un mecanisme structurel du Player

Consequences:

- le Player orchestre seulement timeline + commandes globales (`play/pause/seek`)
- la logique overlay-world reside dans la couche runtime DOM (list/orchestrator/flip engine)

## Portee

Ce document couvre:

- le contrat auteur d'activation du mode
- l'algorithme runtime overlay-world
- la coherence `play/seek` avec ancres temporelles
- les contraintes d'implementation sans regression du mode local

## Hors perimetre

- runtimes non-DOM (canvas natif, WebGL pur, etc.)
- redefinir le modele global de z-order de la scene
- remplacement du FLIP local par defaut

## Dependances normatives

- `23-list-component-v1.md`
- `25-flip-runtime-core-v1.md`
- `26-player-orchestration-v1.md`
- `24-runtime-log-policy-v1.md`

## Principes non negociables

1. pipeline animation unique (adapter animejs)
2. mode local reste le defaut
3. mode overlay-world est opt-in explicite auteur
4. meme resultat a `t` entre lecture continue et `seek(t)`
5. fallback deterministe vers mode local si preconditions non remplies
6. implementation initiale sans optimisation prematuree obligatoire

## Contrat auteur - activation explicite

Extension `move` (backward compatible):

```ts
type MoveFlipMode = 'local' | 'overlay-world'

type MoveCommand = {
  parentId: string
  mode: 'auto' | 'first' | 'last' | 'append' | 'prepend' | number
  flip?: boolean
  flipMode?: MoveFlipMode
  reorder?: boolean
}
```

Regles:

- `flipMode` par defaut: `local`
- `flipMode` est ignore si `flip:false`
- `flipMode:'overlay-world'` doit etre active intentionnellement par l'auteur
- toute valeur absente/inconnue est traitee comme `local`

## Authoring z-order des containers

La spec ne remplace pas les choix auteur de z-order des lists:

- l'auteur peut continuer a regler `zIndex` (ou equivalent editeur) des containers
- `overlay-world` est un echappatoire pour transitions critiques, pas un substitut du layout scenaristique

## Matrice d'activation runtime

Le runtime active overlay-world seulement si:

1. `move.flip !== false`
2. `move.flipMode === 'overlay-world'`
3. runtime DOM disponible
4. node transferre mesurable
5. overlay layer disponible

Sinon:

- fallback en FLIP local
- warning dedoublonne

## Vocabulaire

- `overlay layer`: couche temporaire dediee au rendu de transition
- `ghost`: representation visuelle temporaire de l'item
- `world-space`: repere scene/runtime root (pas repere parent local)
- `anchor`: etat de reference d'un item a un instant cle
- `layoutEpoch`: compteur d'invalidation geometrique runtime

## Contrats runtime internes

```ts
type OverlayFlipSeed = {
  seedId: string
  eventId: string
  eventSeq: number
  itemId: string
  startMs: number
  endMs: number
  startWorldRect: { left: number; top: number; width: number; height: number }
  endWorldRect: { left: number; top: number; width: number; height: number }
  easing?: string
  sourceListId: string | null
  targetListId: string | null
  parentChainSignature: string
  layoutEpoch: number
}

type OverlayGhostHandle = {
  seedId: string
  ghostNodeRef: unknown
  itemNodeRef: unknown
  hiddenItemStyleToken: string
}

type OverlayAnchor = {
  seedId: string
  atMs: number
  worldRect: { left: number; top: number; width: number; height: number }
  parentChainSignature: string
  layoutEpoch: number
}
```

## Overlay layer

Regles:

- une couche overlay runtime unique par scene active
- `pointer-events:none`
- non interactive, purement visuelle
- ordre de pile au-dessus des containers list

Note implementation:

- le repere world-space doit etre stable et explicite (viewport ou root runtime), choisi une fois et applique partout

## Algorithme canonique - mode overlay-world

## Etape 0 - Decision de mode

Pour chaque `move`:

- si `flipMode !== 'overlay-world'` -> FLIP local
- sinon -> chemin overlay-world

## Etape 1 - Capture FIRST world

Capturer avant mutation:

- rect world de l'item transferre
- signature de chaine parent (source)
- metadonnees de style necessaires au ghost

## Etape 2 - Mutate structure

Executer le `mutationPlan` normal:

- detach/reparent/attach/reorder
- patches layout-impactants associes

## Etape 3 - Capture LAST world

Capturer apres mutation:

- rect world final
- signature de chaine parent (cible)

## Etape 4 - Seed overlay

Construire un `OverlayFlipSeed`.

## Etape 5 - Ghost lifecycle

1. creer ghost dans overlay layer
2. cacher le vrai node (sans detruire son etat runtime)
3. animer ghost `startWorldRect -> endWorldRect` via pipeline global
4. en fin de transition:
   - detruire ghost
   - reveler vrai node
   - appliquer cleanup style

## Etape 6 - Interruption

Si nouvelle transition sur meme item:

- interrompre ghost actif
- reveler vrai node
- recapturer et relancer selon nouvelle intention

## Coherence play / pause / seek

Regles:

- `pause`: pause toutes transitions actives, ghosts inclus
- `play`: reprise uniforme
- `seek`: reconstruction deterministe de l'etat visuel exact a `t`

## Seek - regle d'ancrage secondaire (obligatoire)

Quand `seek` tombe a l'interieur d'une transition overlay-world, le runtime doit:

1. remonter au debut de la transition (`startMs`)
2. reconstituer l'etat du node et de ses parents a `startMs`
3. evaluer ensuite la position a `t` depuis cet ancrage

Justification:

- eviter les FIRST errones sur transitions dynamiques en cascade
- garantir coherence parent/enfant quand le parent est aussi en transition

## Parent en transition simultanee

Regle:

- le calcul de l'item doit utiliser la position parent coherente au meme temps `t`
- la signature parentale (`parentChainSignature`) doit etre validee avant application

Si incoherence detectee:

- recalcul anchor via replay secondaire
- si echec, fallback local + warning

## Perimetre implementation initial (V1.0)

Regle:

- la premiere implementation ne depend d'aucun cache structurel.

Attendus V1.0:

- seeds et ancres calcules a la demande pendant `play/seek`
- replay secondaire obligatoire pour garantir la coherence spatiale
- correction fonctionnelle prioritaire sur performance

Non attendu V1.0:

- cache multi-niveaux persistant
- indexation temporelle avancee
- optimisation memoire fine

## Optimisations post-V1 (hors scope initial)

Objectif:

- reduire cout CPU du replay secondaire lors du scrubbing, une fois le comportement valide.

## Niveau 1 - Seed cache (optionnel, priorite basse)

Stocker `OverlayFlipSeed` par transition.

Cle recommandee:

- `sceneId + storyId + eventId + eventSeq + itemId + layoutEpoch`

## Niveau 2 - Anchor cache (optionnel)

Stocker des ancres temporelles par pas fixe (ex: 40-80ms).

Au seek:

- utiliser l'ancre precedente la plus proche
- interpoler sur l'intervalle restant

## Niveau 3 - Parent chain cache (optionnel avance)

Cache des compositions parentales pour cascades complexes.

## Invalidation cache

Invalidation totale ou partielle sur:

- `runtimeRevision` change
- resize viewport/root
- changement structurel parentage
- changement style impactant layout/transform
- changement police affectant metriques

## Fallback policy

Cas fallback vers local:

- overlay indisponible
- node non mesurable
- ancrage secondaire non resolvable
- incoherence parentale non resolue

Exigence:

- fallback sans crash
- trace warning dedoublonnee

## Logs / warnings recommandes

- `RUNTIME_FLIP_OVERLAY_MODE_UNAVAILABLE_FALLBACK_LOCAL`
- `RUNTIME_FLIP_OVERLAY_GHOST_CREATE_FAILED`
- `RUNTIME_FLIP_OVERLAY_ANCHOR_REPLAY_FAILED`
- `RUNTIME_FLIP_OVERLAY_PARENT_CHAIN_MISMATCH`
- `RUNTIME_FLIP_OVERLAY_CACHE_INVALIDATED` (uniquement si cache active)

## Non-DOM runtime policy

Regle:

- `flipMode:'overlay-world'` est non supporte hors DOM
- le runtime peut:
  - ignorer le mode et rester en local si FLIP local existe
  - ou desactiver FLIP sur l'operation

Dans tous les cas:

- warning explicite
- pas d'impact structurel Player

## Compatibilite et migration

- scenes existantes: inchangees (`flipMode` absent => local)
- activation progressive item par item
- aucun changement obligatoire du contrat Player public

## Tests smoke obligatoires

1. transfer inter-list overlap avec `flipMode:'overlay-world'`: item toujours visible
2. meme scenario en `flipMode:'local'`: comportement historique conserve
3. parent + enfant en transition simultanee: coherence spatiale
4. comparaison `play` vs `seek(25/50/75%)`: ecart visuel <= seuil
5. interruption par nouveau move pendant overlay
6. fallback overlay indisponible
7. scrubbing rapide aller-retour sans derive cumulative

## Criteres d'acceptation

1. suppression du masquage parasite en overlap list
2. coherence `play/seek` au pixel pres selon seuil valide
3. absence de regression sur `pause/resume/rewind`
4. comportement local par defaut strictement preserve

## Liens

- `27-flip-overlay-world-space-pre-spec.md`
- `23-list-component-v1.md`
- `25-flip-runtime-core-v1.md`
- `26-player-orchestration-v1.md`
