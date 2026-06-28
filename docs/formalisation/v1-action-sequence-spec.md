# Action sequence spec V1 — primitive de chaînage par durée propre

## Statut

Spec normative V1 pour `ActionSequence` (forme niveau perso) et le helper `sequence` (forme niveau
strap, `context.planned.sequence` — voir `v1-strap-helpers-spec.md`). Livrée en Phase 2 du plan
`2026-06-28-unify-action-execution-and-move-off-plan.md`, sur la base unifiée de Phase 1
(`v1-tween-action-spec.md`).

## Objectif

Permettre à l'auteur de chaîner une liste d'étapes **hétérogènes** — chacune avec sa propre durée
et son propre contenu — à partir d'un seul déclenchement. Chaque étape démarre où la précédente
s'est terminée, sauf offset explicite (`startAt`).

## Distinction avec `repeat`/`stagger`

`context.planned.repeat`/`stagger` répètent **un seul template** à une cadence **uniforme**
(`eachMs`/`stepMs`) : utile pour une série d'actions identiques à une variable près (ex. un
décompte). `ActionSequence`/`sequence` chaînent des étapes **distinctes**, avec des durées et des
propriétés totalement différentes les unes des autres : utile pour une mini-chorégraphie (ex. un
panneau qui se déplace, puis change de contenu, puis disparaît). Les deux primitives coexistent
sans se recouvrir ; aucune ne remplace l'autre.

## Primitive partagée

Une seule fonction de planification, réutilisée par les deux formes d'auteur :

```ts
// src/player/action-sequence.ts
type GenericSequenceStep<TContent> = {
  content: TContent
  durationMs?: number
  startAt?: number
}

function planGenericSequenceSteps<TContent>(
  steps: GenericSequenceStep<TContent>[],
  resolveImplicitDurationMs?: (content: TContent) => number
): Array<{ offsetMs: number; content: TContent }>
```

Règle de chaînage, commune aux deux formes :

- `startAt`, si présent, fixe l'offset absolu de l'étape (relatif au déclenchement, `t0`).
- Sinon, l'étape démarre où la précédente s'est terminée : `offsetMs[n] = offsetMs[n-1] +
  duration[n-1]`.
- `durationMs`, si absent, est résolu par un callback fourni par la forme d'auteur (sinon `0` — pas
  d'attente implicite, l'étape suivante démarre au même instant).
- Des étapes peuvent se chevaucher si leurs `startAt` respectifs le placent en parallèle.
- La primitive ne sait rien du contenu d'une étape : elle calcule uniquement *quand* chaque étape
  doit être délivrée au circuit normal (voir `v1-tween-action-spec.md` §Position dans le pipeline
  d'exécution) — jamais *ce qu'elle signifie* une fois délivrée.

## Forme niveau perso — `ActionSequence`

### Contrat canonique

```ts
type ActionSequenceStep = {
  action: Record<string, unknown>  // tout payload d'action valide, statique ou TweenAction
  durationMs?: number              // durée explicite de chaînage
  startAt?: number                 // offset absolu, contourne le chaînage automatique
}

type ActionSequence = ActionSequenceStep[]
```

Déclarée directement sur `perso.actions[eventName] = ActionSequenceStep[]`. Détection par forme :
un tableau non vide dont chaque élément est un objet `{ action: {...}, ... }` — jamais confondu
avec un `TweenAction` isolé (objet `{fn, duration}`, jamais tableau) ni avec une action statique
ordinaire.

Durée implicite d'une étape sans `durationMs` explicite : si `step.action` est un `TweenAction`
(`fn`+`duration`), sa propre `duration` est utilisée ; sinon `0`.

### Déclenchement et décomposition

Le runtime traite ce tableau au moment où l'event déclencheur (n'importe quel event ordinaire)
résout cette action, dans `PlayerFacade.runTimelineEvent` :

1. L'étape 0 est appliquée **immédiatement**, dans le commit courant — exactement comme n'importe
   quelle action (statique ou `TweenAction`), via le circuit normal.
2. Les étapes suivantes (index 1+) sont matérialisées dans le track à leur `ms` absolu
   (`event.ms + offsetMs`), via le même mécanisme bas niveau que les helpers de strap
   (`appendGeneratedEvents` → `trackManager.appendLiveEvents`) — rejouées correctement par tout
   `seek()` futur, sans mécanisme dédié.

### Auto-référence : ciblage des étapes différées

Le système de dispatch d'events n'a **aucune capacité de ciblage par perso** — seulement par story
(`scopeStoryId`). Pour délivrer les étapes différées au perso exact qui les a déclenchées, le
runtime réserve, à la normalisation de chaque perso (même point que l'auto-ajout de `tween:stop`,
`create-player-utils.ts`), une clé d'action **auto-référentielle** par clé d'action statiquement
déclarée comme `ActionSequence` :

```ts
// ajouté implicitement si perso.actions[actionKey] est une ActionSequence :
perso.actions[`${persoId}::${actionKey}::seq`] = null
```

Unique par construction (id du perso + clé d'action) : aucun autre perso de la même story ne
déclare cette clé, donc le dispatch ne peut matcher que ce perso précis — exploitant le mécanisme
`null` déjà existant ("auto-référence canonique", `event.data` devient l'action complète) plutôt
que d'inventer un ciblage dédié.

**Limite V1** : cette clé n'est réservée que pour les `ActionSequence` **déclarées statiquement**
dans `perso.actions`. Une `ActionSequence` portée dynamiquement par `event.data` (comme c'est
possible pour `TweenAction`, voir `v1-tween-action-spec.md`) n'est pas couverte — la longueur du
tableau n'est pas connue à la normalisation. Pour composer dynamiquement plusieurs persos depuis un
seul déclenchement, utiliser la forme strap (`context.planned.sequence`), qui n'a pas cette
limite.

### Idempotence au replay

La décomposition (calcul des offsets, matérialisation des étapes différées) ne s'exécute **qu'une
seule fois par event déclencheur distinct** — la première fois qu'il est traité, en lecture live ou
lors d'un seek à froid (jamais joué en live auparavant). Le runtime mémorise les ids d'event déjà
décomposés pour la durée de vie du lecteur (jamais réinitialisé au seek, contrairement à l'état
d'interruption ci-dessous) : un seed replay ultérieur du même event matérialise les étapes
différées une seule fois ; les replays suivants ne font que rejouer ce qui est déjà dans le track.

### Interruption (Cas 1 — remplacement)

Un nouvel event sur la **même clé d'action** invalide les étapes encore en attente de la séquence
précédente sur cette clé, qu'il s'agisse lui-même d'une nouvelle séquence ou d'une action
ordinaire. Mécanisme : chaque étape différée porte un jeton (id de l'event déclencheur) ; le
runtime mémorise le jeton le plus récent par `(persoId, actionKey)` et rejette silencieusement
toute étape différée dont le jeton ne correspond plus au plus récent au moment où elle devient due.
Cette mémoire est réinitialisée à chaque `seek()` (avant rejoué), pour rester cohérente avec
l'ordre de rejoué de la cible visée.

**Point ouvert, non traité en V1** : l'interaction avec les animations additives (gérées par la
bibliothèque d'animation externe) n'est pas spécifiée — seule l'interruption stricte (remplacement
total) est implémentée.

### Défaut corrigé localement : une étape retire explicitement le tween de l'étape précédente de la même chaîne

Un `TweenAction` encore actif (jamais explicitement arrêté par `tween:stop`) est ré-évalué à la fin
de **tout** seek, y compris un seek bien après sa propre fin naturelle (voir
`v1-tween-action-spec.md` §5). Sans précaution, une étape statique suivant une étape `TweenAction`
sur la même propriété se ferait donc écraser par cette ré-évaluation à chaque seek ultérieur — le
seek reconstruirait un état **faux**, pas seulement surprenant. Confirmé empiriquement, et ce n'est
pas un défaut introduit par `ActionSequence` : la cause racine est préexistante au modèle de seek
(cadrage complet : `2026-06-28-seek-continuous-engine-overwrite-defect.md`), et touche aussi bien
`TweenAction` isolé que les transitions anime.js.

**Corrigé au niveau d'`ActionSequence`** (`TweenRunner.cancelByActionKey`,
`PlayerFacade.retireActionSequenceChainTween`) : chaque étape qui s'applique — qu'il s'agisse de
l'étape 0 ou d'une étape différée — retire explicitement, avant d'appliquer sa propre action, tout
tween laissé actif par l'étape précédente de la **même chaîne** (sous la clé d'action d'origine et
sous la clé de continuation). Une étape n'attend donc plus une passe de seek globale, non ordonnée
chronologiquement, pour fermer ce que l'étape précédente a ouvert — voir
`tests/v1/action-sequence.spec.ts` (AS-T4).

**Limite de cette correction** : elle ne couvre que les collisions **internes à une même
`ActionSequence`**. Le cas plus large — deux actions indépendantes, sans lien de séquence,
touchant la même propriété — reste un défaut ouvert du modèle de seek, traité séparément dans
`2026-06-28-seek-continuous-engine-overwrite-defect.md`.

## Forme niveau strap — `context.planned.sequence`

Voir le contrat complet dans `v1-strap-helpers-spec.md`. Résumé :

```ts
type ActionSequenceStrapStep = {
  step: StrapStep   // { event?: StoryEvent; update?: Record<string, unknown> }
  durationMs?: number
  startAt?: number
}

context.planned.sequence(steps: ActionSequenceStrapStep[]): PlannedStrapOccurrence[]
```

Chaque étape porte un `StrapStep` complet — donc un `event` ciblant n'importe quel perso de la
story (selon le routing existant), permettant de **coordonner plusieurs persos depuis un seul
déclenchement**, sans la limite "déclaration statique" de la forme perso. Réutilise les règles
existantes de mode, de seek/rewind et d'`eventInsertMode` des autres helpers `context.planned` —
aucune règle nouvelle inventée. Pas de `context.live.sequence` en V1 : une séquence figée est
entièrement résolvable à l'avance, elle n'a pas besoin de la sémantique événementielle/
interruptible propre à `context.live`.

## Invariants `ActionSequence`/`sequence` V1

- La primitive de planification (`planGenericSequenceSteps`) est unique, partagée par les deux
  formes d'auteur.
- `ActionSequence` (perso) : tableau non vide de `{action, durationMs?, startAt?}` ; jamais confondu
  avec un `TweenAction` isolé.
- L'étape 0 s'applique toujours dans le commit courant ; les étapes suivantes sont matérialisées
  dans le track à leur `ms` absolu, rejouées comme tout event normal.
- Le ciblage des étapes différées niveau perso utilise l'auto-référence `null` réservée par
  `(persoId, actionKey)`, jamais de mécanisme de ciblage dédié.
- `ActionSequence` niveau perso ne supporte que la déclaration statique ; la composition dynamique
  multi-persos passe par `context.planned.sequence`.
- La décomposition d'un event déclencheur donné ne s'exécute qu'une fois pour la durée de vie du
  lecteur, quel que soit le nombre de replays ultérieurs par seek.
- Un nouvel event sur la même clé d'action invalide les étapes différées en attente de la séquence
  précédente sur cette clé (Cas 1 — remplacement strict, pas d'addition).
- `context.planned.sequence` ne réinvente aucune règle de mode/seek/`eventInsertMode` — il les
  réutilise telles que définies pour `wait`/`repeat`/`stagger`/`loop`.
