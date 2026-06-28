# Tween action spec V1 - action animée par fonction

## Statut

Spec normative V1 pour `TweenAction` (action animée par fonction pure) dans Codplay. Réécrite le
2026-06-28 pour décrire le mécanisme réel d'implémentation après le plan
`2026-06-28-unify-action-execution-and-move-off-plan.md` (Phase 1). Toute mention de
`TweenSequence` est retirée de ce document : ce n'est plus une notion du projet. Le chaînage de
plusieurs animations distinctes (durées et propriétés propres à chaque étape) relève d'une
primitive séparée, `ActionSequence`, spécifiée à part (Phase 2 du plan ci-dessus, non encore
implémentée à la date de cette révision).

## Objectif

Permettre à l'auteur de déclarer, dans les `actions` d'un perso, une animation de propriétés
définie par une fonction pure du progrès, plutôt qu'un objet de valeurs cibles statiques.

Le déclenchement reste celui des events existants. Une fois déclenchée, `TweenAction` est évaluée
en continu à chaque tick par un moteur dédié (`TweenRunner`), au même niveau que la bibliothèque
d'animation externe — voir §Position dans le pipeline d'exécution. Le seek re-évalue la fonction
à la position cible sans ré-exécuter de strap.

## Motivation

Une action statique (`{ style: { opacity: 1 } }`) confie l'interpolation au composant ou à une
bibliothèque externe. La valeur cible est fixe; la trajectoire est opaque pour le runtime.

Une `TweenAction` déplace la définition de la trajectoire dans la scène: la fonction `fn` est
déclarée par l'auteur, évaluée par le runtime à chaque tick. Elle est seek-compatible par
construction — `fn(progress)` est une fonction pure, re-évaluable à n'importe quelle position T
sans rejouer de strap.

Différence fondamentale avec la bibliothèque d'animation externe : celle-ci lit la valeur courante
du DOM pour déduire `from`. `fn` est une fonction pure — elle ne lit pas le DOM et ne reçoit pas
l'état runtime. Si l'auteur a besoin de la valeur de départ, il la transmet via `event.data` depuis
le strap qui émet l'event déclencheur. `data` reste toujours facultatif si la trajectoire est
absolue.

## Position dans le pipeline d'exécution

`TweenAction` et la bibliothèque d'animation externe sont deux implémentations sœurs du même rôle
— un moteur d'**évaluation continue**, déclenché une seule fois puis autonome jusqu'à la fin de sa
propre durée, à la différence d'une action statique (appliquée une fois, immédiatement).

```ts
// src/animation/types.ts
type ContinuousAnimationEngineTriggerInput = {
  resolvedAction: AnimationResolvedAction
  eventMs: number
}

type ContinuousAnimationEngine = {
  name: string
  claims(action: unknown): boolean
  trigger(input: ContinuousAnimationEngineTriggerInput): void
}
```

Le déclenchement passe par le même chemin que toute action, sans branche séparée :

1. L'event résout l'action (statique ou `TweenAction`, formes indistinguables à ce stade) et
   produit un commit, comme n'importe quel event.
2. `triggerResolvedAction` (`runtime-component-orchestrator.ts`) résout le composant cible
   (avertissement `RUNTIME_COMPONENT_NODE_NOT_FOUND` si absent — **uniforme**, qu'il s'agisse d'une
   action statique ou d'une `TweenAction`), exécute `beforeUpdate`, applique l'action une fois via
   `tryUpdateComponent` (no-op silencieux pour `TweenAction` : `fn`/`duration` ne correspondent à
   aucune clé de service connue — `style`/`className`/`attr`/`content`/`move`), exécute
   `afterUpdate`, puis collecte l'action dans `animatableActions`.
3. `RendererFacade.tick()` parcourt `animatableActions` et propose chacune aux moteurs enregistrés
   (`continuousAnimationEngines`, option du renderer). Le premier moteur dont `claims(action)`
   répond `true` reçoit `trigger(...)` et prend la suite ; l'action est alors retirée de la liste
   transmise à la bibliothèque d'animation externe. `TweenRunner.claims` répond `true` pour toute
   forme `{ fn: function, duration: number > 0 }`.
4. À partir de ce point, `TweenRunner` évalue `fn` à chaque tick (`RenderAdapter.tick`/`seek`,
   inchangé par ce plan) en appelant directement `component.update(...)` — sans repasser par
   `beforeUpdate`/`afterUpdate` pour les évaluations suivantes, exactement comme la bibliothèque
   d'animation externe pilote elle-même ses propres frames une fois déclenchée.

Cette séparation est un invariant délibéré, pas une optimisation accidentelle : le circuit de
commits déclenche une fois ; le moteur continu évalue ensuite, à son propre rythme, jusqu'à
extinction. `TweenRunner` ne traite jamais qu'une seule `TweenAction` à la fois par
`(persoId, actionKey)` — jamais de forme hétérogène, jamais de clé `move`.

## Contrat canonique

```ts
type TweenFnInput = {
  progress: number                   // normalisé 0 → 1, après application de l'easing
  data?: Record<string, unknown>     // l'action résolue elle-même (voir §Évaluation de fn)
}

type TweenFnOutput = Record<string, unknown>  // payload action valide pour le perso cible;
                                              // même structure qu'une action statique

type TweenFn = (input: TweenFnInput) => TweenFnOutput | undefined

type TweenAction = {
  duration: number          // ms, strictement > 0
  ease?: string             // identifiant easing; défaut: "linear"
  fn: TweenFn
}

type PersoAction =
  | Record<string, unknown>  // forme statique existante
  | true                     // raccourci : action dont le contenu est livré intégralement par event.data
  | TweenAction
```

## Polymorphisme des actions

Le runtime distingue les formes à l'application de l'event, dans cet ordre :

- **`true`** → raccourci pour action vide; `event.data` est l'action appliquée (identique à `{}`)
- **Objet avec `fn: function` et `duration: number > 0`** → `TweenAction`
- **Tout autre objet** → action statique existante
- **Tableau** → n'est pas une forme reconnue par `TweenAction`. Réservé à la future primitive
  `ActionSequence` (non spécifiée ici).

### `true` comme raccourci d'action vide

`{ "my-action": true }` est équivalent à `{ "my-action": {} }`. Le contenu de l'action est
entièrement fourni par `event.data` au moment du déclenchement. `true` est préféré à `{}` pour
la lisibilité : il exprime explicitement l'intention de déléguer le contenu à l'event.

La distinction avec `actions[id] = null` reste inchangée : `null` est l'auto-référence canonique
qui fait de `event.data` l'action complète; `true` est la forme déclarée explicitement pour toute
autre clé d'action. Les deux comportements runtime sont identiques.

## `event.data` comme porteur de `TweenAction`

Quand `perso.actions[eventName]` vaut `true` (ou `null`/`{}`), `event.data` devient l'action
appliquée. `event.data` peut alors contenir une `TweenAction`.

Le runtime applique la même détection de forme sur l'action résolue, qu'elle provienne d'une
déclaration statique dans `perso.actions` ou d'un `event.data` fusionné à l'event : si l'action
résolue est un objet avec `fn: function` + `duration: number > 0`, elle est traitée comme
`TweenAction`.

Cela permet à un strap de composer et d'émettre un tween dynamiquement :

```ts
straps["drive-perso"] = ({ event, state }) => ({
  events: [{
    name: "mon-perso",   // actions["mon-perso"] = true
    data: {
      duration: 600,
      ease: "easeOutCubic",
      fn: ({ progress }) => ({
        style: { transform: `translateX(${progress * state.targetX}px)` }
      })
    }
  }]
})
```

### Seek-compatibilité des tweens portés par `event.data`

Le track CodPlay est une structure en mémoire, non persistée sur disque. La fonction `fn`
présente dans `event.data` reste donc vivante dans le track pendant toute la session.

Au seek, le runtime rejoue l'event déclencheur depuis le track (comme tout event), ce qui
redérive l'action résolue (donc `fn`) en mémoire, puis évalue `fn` à la position cible — sans
ré-exécuter le strap émetteur.

Cette compatibilité est garantie dans les limites du cycle de vie en mémoire. Si le track est
détruit (rechargement complet), la séquence de jeu qui le reconstruit re-émet les events avec
les mêmes `fn` (le strap est déterministe), et le track en mémoire est rétabli.

## Retour de `fn` : payload complet

`fn` retourne un payload d'action complet — même structure qu'une action statique. Le runtime
applique le résultat via la même pipeline de services (`style`, `className`, `content`, `attr`…),
en appelant directement `component.update(...)` (voir §Position dans le pipeline d'exécution).

Le routage vers les refs internes du composant suit les mêmes conventions que les actions
statiques existantes. Pour cibler l'élément interne d'un `ImageComponent` :

```ts
fn: ({ progress }) => ({
  style: { opacity: progress },      // appliqué au root
  img: { style: { width: `${progress * 100}%` } }  // appliqué à l'img interne
})
```

Il n'existe pas de propriété `ref` sur `TweenAction` : le routing est porté par la structure
du payload retourné par `fn`, de façon identique aux actions statiques.

## Règles normatives

### 1. Déclenchement

- Une `TweenAction` est déclenchée par le même mécanisme qu'une action statique — un seul
  déclenchement, voir §Position dans le pipeline d'exécution.
- Un nouvel event sur la même clé d'action (`actionKey`) interrompt et remplace l'instance en
  cours (Cas 1, §Interruption).

### 2. Évaluation de `fn`

À chaque tick du moteur continu pendant `[t0, t0 + duration]` (`t0` = ms de l'event déclencheur) :

```
rawProgress = clamp((currentMs - t0) / duration, 0, 1)
progress    = applyEasing(ease, rawProgress)
output      = fn({ progress, data })
```

- `output` est appliqué au perso via la pipeline de services.
- `fn` est appelée avec `progress = 1` au tick où `currentMs >= t0 + duration`, puis le tween est
  retiré de la liste active (terminé).
- `fn` qui retourne `undefined` ou un objet vide est silencieusement ignorée — aucune mutation.
- La cadence d'évaluation est celle de la boucle d'animation du runtime (~60fps, pilotée par
  `requestAnimationFrame` avec repli `MessageChannel`). L'auteur ne pilote pas la fréquence. Les
  affichages haute fréquence (1/100s, barres de progression) sont le cas d'usage naturel : `fn`
  avec `Math.round` ou `toFixed` suffit à produire l'effet de défilement.

### 3. Pureté de `fn` et contenu de `data`

- `fn` est une fonction pure : elle ne lit pas `state`, n'accède pas au DOM, et ne produit
  pas d'effets de bord.
- `data` transmis à `fn` est l'action résolue elle-même (l'objet `{ fn, duration, ease?, ... }`,
  éventuellement enrichi de toute clé supplémentaire fusionnée depuis `event.data` au
  déclenchement — voir la fusion action/payload des actions statiques, identique ici). `fn` peut
  donc lire toute clé contextuelle que le strap émetteur y a placée à côté de `duration`/`fn`.
  Toute valeur de départ variable doit être transmise ainsi par le strap émetteur.
- `data` ne mute pas pendant l'animation : il est capturé une fois, au déclenchement.

### 4. Matérialisation dans le track

Le runtime ne matérialise **aucun descripteur dédié** pour `TweenAction`. Le seul élément
matérialisé dans le track est l'**event déclencheur lui-même** (comme pour toute action). Au
rejoué (seek), cet event est ré-exécuté (`replayDueTimelineEventsForSeek` → `runTimelineEvent`),
ce qui redérive l'action résolue — donc `fn`, `duration`, `data` — en mémoire, depuis
`perso.actions` (et `event.data` le cas échéant). Aucun identifiant de fonction (`fnRef`) n'est
nécessaire : `fn` est une référence vivante portée par la scène compilée, jamais sérialisée.

### 5. Seek

- Le seek réinitialise les tweens actifs (`TweenRunner.resetActiveTweens()`), puis rejoue les
  events dus dans l'ordre track jusqu'à `targetMs`, ce qui ré-enregistre chaque `TweenAction`
  rencontrée (et applique chaque `tween:stop` rencontré — §Interruption).
- Une fois le replay terminé, le moteur évalue chaque tween encore actif à `targetMs` :
  - si `targetMs >= t0 + duration` : appliquer `fn({ progress: 1, data })`
  - sinon : calculer `progress` à `targetMs` et appliquer `fn({ progress, data })`
- Le seek n'évalue jamais de strap; il rejoue uniquement les events déjà matérialisés dans le
  track et évalue les fonctions `fn` des tweens qui en résultent.
- Conséquence directe : un seek à une position **postérieure** à un `tween:stop` ne "gèle" pas la
  valeur au point d'arrêt. Le replay réinscrit puis annule le tween avant de jamais l'évaluer à la
  cible — le perso retombe sur son état initial (celui issu de `perso.initial`, sans la clé
  concernée si elle n'y est pas déclarée), pas sur une valeur intermédiaire. C'est un effet de la
  reconstruction par replay déterministe, pas un comportement spécifique à coder : il diffère du
  gel observé en lecture live (où le tween a réellement progressé en temps réel avant l'arrêt).

### 6. Interruption

Deux cas distincts :

**Cas 1 — Interruption + remplacement**
Un event arrive sur la même clé d'action (`actionKey`) avec une nouvelle `TweenAction` ou une
valeur statique. Le tween en cours pour cette clé est annulé et remplacé ; la nouvelle action
s'applique selon sa propre nature (déclenchement immédiat si statique, nouveau cycle d'évaluation
si `TweenAction`).

**Cas 2 — Interruption + gel (lecture live) / reset (seek)**
Un event arrive sur la clé d'arrêt réservée (`tween:stop`, voir §7). Tous les tweens actifs sur ce
perso sont annulés (`TweenRunner.cancelAll(persoId)`). En lecture live, le perso reste dans son
dernier état appliqué (gel). Au seek, voir la conséquence documentée en §5 : pas de gel, retour à
l'état initial si le point d'arrêt est rejoué avant la cible.

### 7. Action d'arrêt réservée (`tween:stop`)

Chaque perso reçoit implicitement, à la normalisation de la scène compilée
(`create-player-utils.ts`), une clé d'action réservée si elle n'est pas déjà déclarée par l'auteur :

```ts
// ajouté implicitement à tout perso lors de la normalisation, si absent :
perso.actions["tween:stop"] = "stop"
```

Le nom `"tween:stop"` est fixe en V1 (pas de configuration hôte). Un event portant ce nom
interrompt tous les tweens actifs sur le perso qui le reçoit (Cas 2 ci-dessus).

```ts
// strap — arrêt ciblé via le routing story
return {
  events: [
    { name: "tween:stop" }   // reçu par les persos de la story selon leur routing
  ]
}
```

Pour arrêter les tweens d'un perso spécifique, le routing story existant s'applique : l'event
est émis dans le scope de la story concernée ou via `cascade` selon la portée souhaitée.

La valeur `"stop"` dans `perso.actions` est une chaîne réservée, reconnue exclusivement par ce
mécanisme — pas un payload d'action ordinaire. Pour cette raison, `tween:stop` ne traverse **pas**
le circuit décrit en §Position dans le pipeline d'exécution comme une `TweenAction` : il est
intercepté avant tout commit (`create-player.ts`, `runTimelineEvent`), exactement comme aujourd'hui
— `tryUpdateComponent` exige un payload d'action sous forme d'objet, jamais une chaîne brute.
L'annulation est donc toujours appliquée de façon synchrone, avant tout commit, indépendamment du
cycle de tick normal.

### 8. Easing

- `ease` accepte un sous-ensemble d'identifiants nommés courants (`linear`, `ease`, `easeIn`,
  `easeOut`, `easeInOut`, et leurs variantes `Quad`/`Cubic`/`Quart`/`Expo`/`Sine`) — voir le
  registre `EASINGS` dans `tween-runner.ts`. Les formes paramétrées (`cubicBezier(...)`,
  `steps(...)`, `spring(...)`) ne sont pas supportées par ce moteur ; elles restent l'apanage de la
  bibliothèque d'animation externe pour les actions statiques avec timing.
- Un `ease` inconnu produit un warning et fallback vers `"linear"`.
- `progress` transmis à `fn` est déjà le progrès après application de l'easing.
  L'auteur ne ré-applique pas l'easing dans `fn`.

### 9. Relation aux options de timing statiques

- Les options de timing existantes (`duration`, `ease`, `delay`…) sur une action statique
  décrivent une transition vers une valeur cible fixe, prise en charge par la bibliothèque
  d'animation externe.
- Une `TweenAction` et une action statique avec timing sont deux formes distinctes et
  orthogonales. Elles ne se fusionnent pas.

## Exemples auteur

### Tween simple — valeur de départ transmise via event.data

```ts
// strap: lit l'état et passe fromX via event.data
const straps: StrapCollection = {
  "move-to-target": ({ event, state }) => ({
    events: [{
      name: "mon-perso",
      data: { fromX: state.currentX, toX: event.data?.targetX ?? 0 }
    }]
  })
}

// action déclarée dans le perso
perso.actions["mon-perso"] = {
  duration: 600,
  ease: "easeOutCubic",
  fn: ({ progress, data }) => ({
    style: {
      transform: `translateX(${data.fromX + (data.toX - data.fromX) * progress}px)`
    }
  })
}
```

### Tween simple — trajectoire absolue, sans data

```ts
perso.actions["fade-in"] = {
  duration: 400,
  ease: "easeOutQuad",
  fn: ({ progress }) => ({ style: { opacity: progress } })
}
```

### Tween multi-propriétés et multi-refs

```ts
perso.actions["reveal"] = {
  duration: 500,
  ease: "easeOutExpo",
  fn: ({ progress }) => ({
    style: { opacity: progress, transform: `scale(${0.8 + progress * 0.2})` },
    img: { style: { objectFit: progress > 0.5 ? "cover" : "contain" } }
  })
}
```

### Interpolation de compteur entre deux paliers

```ts
perso.actions["counter-step"] = {
  duration: 1000,
  ease: "linear",
  fn: ({ progress, data }) => ({
    content: String(Math.round(data.from + (data.to - data.from) * progress))
  })
}
```

## Utilitaires auteur

### `lerp`

La plupart des `fn` effectuent une interpolation linéaire entre deux valeurs. Un helper `lerp`
est exposé par le runtime (`src/tween/lerp.ts`) pour éviter que chaque auteur réécrive le même
calcul :

```ts
lerp(from: number, to: number, progress: number): number
// lerp(from, to, progress) = from + (to - from) * progress
```

Exemple d'usage dans `fn` :

```ts
import { lerp } from "codplay"

fn: ({ progress, data }) => ({
  style: { transform: `translateX(${lerp(data.fromX, data.toX, progress)}px)` }
})
```

`lerp` est une fonction pure exportée comme utilitaire auteur. Elle n'est pas liée au runtime
ni à l'état de la scène.

## Invariants TweenAction V1

- `duration` est obligatoire et strictement `> 0`.
- `fn` est obligatoire et doit être une fonction pure.
- `fn` reçoit `{ progress, data }` et ne produit pas d'effets de bord.
- `progress` est toujours dans `[0, 1]` après easing.
- `data` est l'action résolue elle-même, capturée au déclenchement; elle ne mute pas pendant
  l'animation. `data` est facultatif pour `fn` si la trajectoire est absolue.
- Le track ne matérialise aucun descripteur dédié : seul l'event déclencheur est matérialisé;
  l'action (donc `fn`) est redérivée en mémoire à chaque rejoué.
- Le seek rejoue les events dus puis re-évalue `fn` à la position cible, sans ré-exécuter de
  strap. Un seek postérieur à un `tween:stop` ne gèle pas la valeur : il retombe sur l'état
  initial (voir §5).
- `ease` inconnu → warning + fallback `"linear"`.
- `actions[key] = true` est équivalent à `actions[key] = {}` : `event.data` devient l'action.
- `event.data` peut contenir une `TweenAction`; la détection de forme est identique à celle des
  actions statiques déclarées dans `perso.actions`.
- La seek-compatibilité des tweens portés par `event.data` est garantie dans les limites du
  cycle de vie du track en mémoire.
- Chaque perso reçoit implicitement à la normalisation `actions["tween:stop"] = "stop"`, si la clé
  n'est pas déjà déclarée par l'auteur. Le nom n'est pas configurable en V1.
- `tween:stop` est intercepté avant tout commit — la seule exception à la règle de déclenchement
  unique décrite en §Position dans le pipeline d'exécution, parce que `"stop"` est une chaîne
  brute et non un payload d'action.
- `TweenRunner` ne traite jamais qu'une `TweenAction` unique par `(persoId, actionKey)`. Tout
  chaînage de plusieurs animations distinctes relève d'`ActionSequence` (spec séparée, Phase 2,
  non implémentée à la date de cette révision) — jamais de ce moteur.
