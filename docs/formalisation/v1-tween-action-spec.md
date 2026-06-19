# Tween action spec V1 - action animée par fonction

## Statut

Spec normative V1 pour les actions animées par fonction (`TweenAction`, `TweenSequence`) dans Codplay.

## Objectif

Permettre à l'auteur de déclarer, dans les `actions` d'un perso, une animation de propriétés
définie par une fonction pure du progrès, ou une séquence de telles animations, plutôt qu'un
objet de valeurs cibles statiques.

Le déclenchement reste celui des events existants. Le runtime évalue la fonction à chaque tick.
Le seek re-évalue la fonction à la position cible sans ré-exécuter de strap.

## Motivation

Une action statique (`{ style: { opacity: 1 } }`) confie l'interpolation au composant ou à une
bibliothèque externe. La valeur cible est fixe; la trajectoire est opaque pour le runtime.

Une `TweenAction` déplace la définition de la trajectoire dans la scène: la fonction `fn` est
déclarée par l'auteur, évaluée par le runtime à chaque tick. Elle est seek-compatible par
construction — `fn(progress)` est une fonction pure, re-évaluable à n'importe quelle position T
sans rejouer de strap.

Différence fondamentale avec anime.js: anime.js lit la valeur courante du DOM pour déduire `from`.
`fn` est une fonction pure — elle ne lit pas le DOM et ne reçoit pas l'état runtime. Si l'auteur
a besoin de la valeur de départ, il la transmet via `event.data` depuis le strap qui émet
l'event déclencheur. `data` reste toujours facultatif si la trajectoire est absolue.

## Contrat canonique

```ts
type TweenFnInput = {
  progress: number                   // normalisé 0 → 1, après application de l'easing
  data?: Record<string, unknown>     // event.data capturé au déclenchement; toujours facultatif
}

type TweenFnOutput = Record<string, unknown>  // payload action valide pour le perso cible;
                                              // même structure qu'une action statique

type TweenFn = (input: TweenFnInput) => TweenFnOutput | undefined

type TweenAction = {
  duration: number          // ms, strictement > 0
  ease?: string             // identifiant easing; défaut: "linear"
  fn: TweenFn
  ignoreDuration?: boolean  // si true, ne contribue pas au calcul de durée de séquence
}

type TweenStep = TweenAction & {
  startAt?: number          // offset ms relatif à t0 de la séquence (voir §Séquence)
}

type TweenSequence = TweenStep[]

type PersoAction =
  | Record<string, unknown>  // forme statique existante
  | true                     // raccourci : action dont le contenu est livré intégralement par event.data
  | TweenAction
  | TweenSequence
```

## Polymorphisme des actions

Le runtime distingue les formes à l'application de l'event, dans cet ordre :

- **`true`** → raccourci pour action vide; `event.data` est l'action appliquée (identique à `{}`)
- **Array** → `TweenSequence`
- **Objet avec `fn: function` et `duration: number`** → `TweenAction`
- **Objet sans `fn`** → action statique existante

### `true` comme raccourci d'action vide

`{ "my-action": true }` est équivalent à `{ "my-action": {} }`. Le contenu de l'action est
entièrement fourni par `event.data` au moment du déclenchement. `true` est préféré à `{}` pour
la lisibilité : il exprime explicitement l'intention de déléguer le contenu à l'event.

La distinction avec `actions[id] = null` reste inchangée : `null` est l'auto-référence canonique
qui fait de `event.data` l'action complète; `true` est la forme déclarée explicitement pour toute
autre clé d'action. Les deux comportements runtime sont identiques.

## `event.data` comme porteur de `TweenAction` ou `TweenSequence`

Quand `perso.actions[eventName]` vaut `true` (ou `null`/`{}`), `event.data` devient l'action
appliquée. `event.data` peut alors contenir une `TweenAction` ou une `TweenSequence`.

Le runtime applique la même détection de forme sur `event.data` que sur `perso.actions` :
si `event.data` est un objet avec `fn: function` + `duration: number`, il est traité comme
`TweenAction`; si c'est un array de tels objets, comme `TweenSequence`.

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

Au seek, le runtime lit `event.data` directement depuis l'entrée track matérialisée, retrouve
la `TweenAction` ou `TweenSequence`, et évalue `fn` à la position cible — sans ré-exécuter
le strap émetteur.

Cette compatibilité est garantie dans les limites du cycle de vie en mémoire. Si le track est
détruit (rechargement complet), la séquence de jeu qui le reconstruit re-émet les events avec
les mêmes `fn` (le strap est déterministe), et le track en mémoire est rétabli.

## Retour de `fn` : payload complet

`fn` retourne un payload d'action complet — même structure qu'une action statique. Le runtime
applique le résultat via la même pipeline de services (`style`, `className`, `content`, `attr`…).

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

## Séquence (`TweenSequence`)

Un tableau de `TweenStep` constitue une séquence. Chaque step est une `TweenAction` augmentée
d'un `startAt` optionnel.

### Calcul des offsets

- `startAt` est un offset en ms relatif à `t0` (timestamp de l'event déclencheur de la séquence).
- Si `startAt` est absent sur un step, le runtime le calcule comme la fin du step précédent :
  `startAt[n] = startAt[n-1] + duration[n-1]`
- Le premier step sans `startAt` démarre à `t0` (offset = 0).
- Des steps peuvent se chevaucher si leurs `startAt` respectifs le placent en parallèle.

### Durée totale de la séquence

`sequenceDuration = max(step.startAt + step.duration)` sur tous les steps.

### Exemple — périmètre d'un carré

```ts
perso.actions["play-square"] = [
  {
    duration: 400,
    fn: ({ progress }) => ({ style: { transform: `translateX(${progress * 200}px)` } })
  },
  {
    duration: 400,
    fn: ({ progress }) => ({ style: { transform: `translate(200px, ${progress * 200}px)` } })
  },
  {
    duration: 400,
    fn: ({ progress }) => ({ style: { transform: `translate(${(1 - progress) * 200}px, 200px)` } })
  },
  {
    duration: 400,
    fn: ({ progress }) => ({ style: { transform: `translateY(${(1 - progress) * 200}px)` } })
  }
]
// durée totale: 1600ms; steps chaînés (startAt calculés: 0, 400, 800, 1200)
```

### Exemple — animation parallèle avec offset

```ts
perso.actions["reveal"] = [
  { duration: 600, fn: ({ progress }) => ({ style: { opacity: progress } }) },
  { startAt: 200, duration: 400, fn: ({ progress }) => ({ style: { transform: `scaleX(${progress})` } }) }
  // opacity: 0→600ms ; scaleX: 200→600ms (chevauchement)
]
```

## Règles normatives

### 1. Déclenchement

- Une `TweenAction` ou `TweenSequence` est déclenchée par le même mécanisme qu'une action statique.
- `event.data` est capturé au tick de déclenchement (`t0`) et transmis identique à chaque
  appel de `fn` pendant toute la durée. Il ne mute pas.
- `event.data` est facultatif. Si absent, `input.data` vaut `undefined`.

### 2. Évaluation de `fn`

À chaque tick du runtime pendant `[t0 + stepStartAt, t0 + stepStartAt + duration]` :

```
rawProgress = clamp((currentMs - stepT0) / duration, 0, 1)
progress    = applyEasing(ease, rawProgress)
output      = fn({ progress, data })
```

- `output` est appliqué au perso via la pipeline de services.
- `fn` est appelée avec `progress = 1` au tick final ou si `currentMs >= stepT0 + duration`.
- Après le tick final, le step est terminé; le runtime cesse de l'évaluer.
- `fn` qui retourne `undefined` ou un objet vide est silencieusement ignorée.
- La cadence d'évaluation est celle de la boucle d'animation du runtime (~60fps). L'auteur ne
  pilote pas la fréquence. Les affichages haute fréquence (1/100s, barres de progression) sont
  le cas d'usage naturel : `fn` avec `Math.round` ou `toFixed` suffit à produire l'effet de
  défilement sans recourir à `context.planned.repeat`.

### 3. Pureté de `fn`

- `fn` est une fonction pure : elle ne lit pas `state`, n'accède pas au DOM, et ne produit
  pas d'effets de bord.
- Toute valeur de départ variable doit être transmise via `event.data` par le strap émetteur.

### 4. Matérialisation dans le track

Le runtime matérialise dans le track, au moment du déclenchement, un descripteur par step :

```ts
type TweenTrackEntry = {
  type: "tween"
  persoId: string
  stepT0: number          // t0 + stepStartAt
  duration: number
  ease: string
  data?: Record<string, unknown>
  fnRef: string           // identifiant stable de fn (voir §5)
}
```

Les valeurs intermédiaires ne sont jamais matérialisées dans le track.

### 5. Identifiant de fonction (`fnRef`)

- `fn` est déclarée dans la scène (`perso.actions`), pas dans le track.
- Le track enregistre `fnRef`, un identifiant stable qui permet au seek de retrouver `fn`.
- En V1, `fnRef` est composé de `persoId` + clé d'action + index du step dans la séquence.
  Le runtime reconstruit la référence via `scene.perso[persoId].actions[actionKey][stepIndex].fn`.
- Si la fonction n'est plus disponible au moment du seek (scène modifiée), un warning runtime
  est émis et le seek ignore l'entrée tween concernée.

### 6. Seek

- Au seek, le runtime collecte les `TweenTrackEntry` dont `stepT0 <= targetMs`.
- Pour chaque entrée :
  - si `targetMs >= stepT0 + duration` : appliquer `fn({ progress: 1, data })`
  - sinon : calculer `progress` à `targetMs` et appliquer `fn({ progress, data })`
- L'ordre d'application au seek suit l'ordre track puis l'ordre d'insertion.
- Le seek n'évalue jamais de strap; il évalue uniquement les fonctions `fn` des tweens actifs.

### 7. Interruption

Trois cas distincts :

**Cas 1 — Interruption + remplacement**
Un event arrive sur la même clé d'action avec une nouvelle `TweenAction`, `TweenSequence` ou
valeur statique. Le tween en cours est interrompu; la nouvelle action s'applique immédiatement.

**Cas 2 — Interruption + gel**
Un event arrive sur la clé d'arrêt réservée (voir §11). Tous les tweens actifs sur ce perso
sont interrompus. Aucune nouvelle valeur n'est appliquée. Le perso reste dans son dernier état
évalué.

**Cas 3 — Interruption + reset**
Un event arrive avec une action statique qui redéfinit les valeurs. C'est une action statique
ordinaire appliquée après interruption du tween.

Dans tous les cas, le runtime inscrit une entrée `tween:interrupted` dans le track à `currentMs`
pour que le seek ne projette pas les steps interrompus au-delà de ce point.

### 11. Action d'arrêt réservée (`tween:stop`)

Chaque perso reçoit implicitement à la normalisation une clé d'action réservée dont le nom est
défini par la config runtime (`tweenStopActionName`). La valeur par défaut est `"tween:stop"`.

```ts
// ajouté implicitement à tout perso lors de la normalisation :
perso.actions[config.tweenStopActionName] = "stop"
```

Cette clé n'a pas besoin d'être déclarée par l'auteur. Un event portant ce nom interrompt tous
les tweens actifs sur le perso qui le reçoit (Cas 2 ci-dessus).

```ts
// config runtime (valeur par défaut)
{ tweenStopActionName: "tween:stop" }

// strap — arrêt ciblé via le routing story
return {
  events: [
    { name: "tween:stop" }   // reçu par les persos de la story selon leur routing
  ]
}
```

Pour arrêter les tweens d'un perso spécifique, le routing story existant s'applique : l'event
est émis dans le scope de la story concernée ou via `cascade` selon la portée souhaitée.

La valeur `"stop"` dans `perso.actions` est une valeur réservée reconnue exclusivement par ce
mécanisme. Elle n'est pas un payload d'action ordinaire.

### 8. Easing

- `ease` accepte tous les identifiants supportés par anime.js :
  - fonctions nommées : `"linear"`, `"easeInQuad"`, `"easeOutExpo"`, `"easeInOutElastic"`, etc.
  - fonctions paramétrées : `"cubicBezier(0.25, 0.1, 0.25, 1)"`, `"steps(4, end)"`,
    `"spring(1, 80, 10, 0)"`
- Un `ease` inconnu produit un warning et fallback vers `"linear"`.
- `progress` transmis à `fn` est déjà le progrès après application de l'easing.
  L'auteur ne ré-applique pas l'easing dans `fn`.

### 9. `ignoreDuration`

- `ignoreDuration: true` sur un step : sa durée ne contribue pas au calcul de durée de séquence.
- Sur une `TweenSequence`, seuls les steps sans `ignoreDuration: true` contribuent à
  `sequenceDuration`.
- Absent ou `false` : contribue normalement.

### 10. Relation aux options de timing statiques

- Les options de timing existantes (`duration`, `ease`, `delay`…) sur une action statique
  décrivent une transition vers une valeur cible fixe (CSS transition ou anime.js).
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

### Séquence — interpolation de compteur entre deux paliers

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
est exposé par le runtime pour éviter que chaque auteur réécrive le même calcul :

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

Des utilitaires complémentaires (`clamp`, `map`, `round`) peuvent être ajoutés en fonction
des besoins relevés à l'implémentation.

## Question ouverte

**Q3 — résolu : option B retenue.** `fn` retourne un payload complet identique à une action
statique. Le routing vers les refs internes suit les mêmes conventions. Pas de propriété `ref`
sur `TweenAction`.

## Invariants TweenAction V1

- `duration` est obligatoire et strictement `> 0`.
- `fn` est obligatoire et doit être une fonction pure.
- `fn` reçoit `{ progress, data }` et ne produit pas d'effets de bord.
- `progress` est toujours dans `[0, 1]` après easing.
- `event.data` est capturé au déclenchement et ne mute pas pendant l'animation.
- `data` est facultatif; `fn` doit fonctionner sans `data` si la trajectoire est absolue.
- Le track matérialise le descripteur, jamais les valeurs intermédiaires.
- Le seek re-évalue `fn` à la position cible sans ré-exécuter de strap.
- Un tween interrompu laisse une entrée `tween:interrupted` dans le track.
- `ease` inconnu → warning + fallback `"linear"`.
- Dans une `TweenSequence`, `startAt` absent → chaînage automatique après le step précédent.
- `sequenceDuration = max(stepStartAt + stepDuration)` sur tous les steps.
- `actions[key] = true` est équivalent à `actions[key] = {}` : `event.data` devient l'action.
- `event.data` peut contenir une `TweenAction` ou `TweenSequence`; la détection de forme est
  identique à celle des actions statiques déclarées dans `perso.actions`.
- La seek-compatibilité des tweens portés par `event.data` est garantie dans les limites du
  cycle de vie du track en mémoire.
- Chaque perso reçoit implicitement à la normalisation `actions[config.tweenStopActionName] = "stop"`.
- La valeur par défaut de `tweenStopActionName` est `"tween:stop"`; elle est configurable par l'hôte.
- Un event nommé `config.tweenStopActionName` reçu par un perso interrompt tous ses tweens actifs
  et gèle le perso dans son dernier état évalué (Cas 2 — interruption + gel).
