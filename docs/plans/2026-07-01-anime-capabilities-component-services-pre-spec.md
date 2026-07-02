# Capacités Anime.js via ComponentServices — pré-spec

## Statut

Note d'architecture préliminaire.

Ce document fixe le modèle visé pour intégrer les capacités Anime.js qui dépassent les transitions CSS simples, en commençant par les capacités SVG, puis en anticipant plus tard Text et Adapters.

Ce n'est pas encore un ticket d'implémentation directe. Le premier palier consiste à consolider les fondations runtime/spec avant d'ajouter `animeSvg.morphTo`.

## Problème

CodPlay possède déjà un chemin centralisé pour Anime.js :

```txt
TransitionRequest[]
  -> runAnimationBatch()
    -> AnimationAdapter.run()
      -> instance Anime.js centrale
```

Ce chemin est déjà relié au temps CodPlay et au seek : les animations actives sont conservées par l'adapter central et synchronisées via `animationAdapter.seek(timelineMs, eventMsByEventId)`.

Anime.js expose maintenant des capacités plus riches :

- `svg.morphTo()`
- `svg.createDrawable()`
- `svg.createMotionPath()`
- plus tard les capacités Text
- plus tard les capacités Adapters

Ces capacités ne doivent pas être réimplémentées dans les composants CodPlay. Elles ne doivent pas non plus créer une deuxième instance Anime.js, un deuxième moteur temporel, ou un pipeline parallèle.

## Principe normatif

Le modèle canonique est :

```txt
Action payload
  -> Component.update()
    -> ComponentServices
      -> opérations d'animation abstraites
        -> AnimationAdapter Anime.js central
          -> RenderSync / renderer.syncAnimationsToTimeline
```

Chaînes interdites :

```txt
Action payload -> composant -> algorithme SVG maison
Action payload -> service -> animate() direct
Action payload -> deuxième import Anime.js utilisé comme moteur autonome
Action payload -> TweenRunner -> fn(progress) pour une capacité Anime.js
```

Règle stricte : seule l'instance Anime.js possédée par l'`AnimationAdapter` central peut exécuter les capacités Anime.js.

Conséquences :

- un composant ne doit pas importer `animate`, `svg`, `text` ou des adapters Anime.js ;
- un service de composant ne doit pas démarrer une animation Anime.js ;
- le service peut valider et émettre une opération abstraite ;
- l'adapter central convertit cette opération en appel Anime.js concret ;
- tous les handles Anime.js restent suivis par l'adapter central pour `stop`, `pause`, `resume`, `rate` et `seek`.

## Pourquoi ComponentServices

Les specs existantes placent les capacités réutilisables au niveau des services de composants :

- un composant déclare ses services via `this.services.declare(...)` ;
- `update()` reçoit le patch résolu brut ;
- le composant décide comment transmettre le patch aux services ;
- un service est une capacité partagée locale au composant ;
- un module est réservé aux hooks runtime globaux.

Anime SVG est déclenché par une action locale et cible le root ou des refs internes du composant. C'est donc un service, pas un module.

## Palier 0 — consolider les fondations

Avant d'implémenter `animeSvg.morphTo`, il faut combler les écarts de spec/code qui empêchent une intégration propre.

On ne doit pas bâtir la capacité SVG sur des fondations fragiles, sinon le modèle sera difficile à généraliser à Rive, Three.js, Text et aux futurs adapters Anime.js.

### Objectif du palier 0

Aligner le runtime réel avec les contrats nécessaires :

- services typés et extensibles ;
- contexte d'application disponible pendant `component.update()` ;
- canal de sortie service -> renderer ;
- adapter central capable de recevoir autre chose que des transitions CSS simples ;
- injection de services core construits par le player/renderer ;
- validation que toutes les démos existantes continuent à fonctionner.

### Écarts identifiés

#### 1. `ThirdPartyBinding.services` existe dans la spec mais pas dans le code

La spec `v1-third-party-runtime-spec.md` décrit :

```ts
services?: Array<{ name: string; service: ServiceInstance }>
```

Mais le type actuel `ThirdPartyBinding` ne contient que :

```ts
components
renderAdapter?
preload?
```

Écart à combler : ajouter `services?` au type runtime réel et à l'expansion des bindings.

Attention : `animeSvg` ne doit pas être fourni par `@codplay/polygon`. Il doit être un service core, car il dépend du même adapter Anime.js central. En revanche, combler cet écart est important normativement pour les adapters tiers futurs.

#### 2. `ServiceInstance.apply()` n'a pas de contexte

Contrat actuel :

```ts
type ServiceInstance = {
  apply: (node: unknown, value: unknown) => void
}
```

Pour produire une opération seekable, un service a besoin de métadonnées :

- `eventId`
- `eventName`
- `eventSeq`
- `listenerId`
- `persoId`
- `isSeekReplay`
- canal de sortie animation

Écart à combler : ajouter un contexte optionnel.

Proposition :

```ts
type ServiceApplyContext = {
  eventId: string
  eventName: string
  eventSeq: number
  listenerId: string
  persoId: string
  isSeekReplay: boolean
  output: RuntimeServiceOutput
}

type RuntimeServiceOutput = {
  animationOperations: AnimationOperation[]
}

type ServiceInstance = {
  apply: (node: unknown, value: unknown, context?: ServiceApplyContext) => void
}
```

Les services core existants ignorent ce contexte.

#### 3. `RuntimeComponentUpdateInput` ne transporte pas le contexte service

Contrat actuel :

```ts
type RuntimeComponentUpdateInput = {
  persoId: string
  eventId: string
  eventSeq: number
  action: Record<string, unknown>
}
```

Écart à combler : rendre le contexte explicite.

Proposition :

```ts
type RuntimeComponentUpdateInput = {
  persoId: string
  eventId: string
  eventSeq: number
  action: Record<string, unknown>
  serviceContext?: ServiceApplyContext
}
```

Pourquoi explicite : cela évite un état ambiant caché dans `ComponentServices` et rend visible quels composants peuvent produire des opérations animées.

#### 4. Le résultat orchestrateur ne transporte pas les opérations de services

Contrat actuel :

```ts
RuntimeUpdateRoutingResult = {
  appliedActionsCount: number
  animatableActions: AnimationResolvedAction[]
  directTransitions: TransitionRequest[]
}
```

Écart à combler : ajouter un canal pour les opérations produites par services.

Proposition :

```ts
RuntimeUpdateRoutingResult = {
  appliedActionsCount: number
  animatableActions: AnimationResolvedAction[]
  directTransitions: TransitionRequest[]
  animationOperations: AnimationOperation[]
}
```

Ce canal est parallèle à `directTransitions`, mais il sert aux opérations plus riches que `TransitionRequest`.

#### 5. `AnimationAdapter.run()` ne reçoit que des `TransitionRequest[]`

Contrat actuel :

```ts
run(transitions: TransitionRequest[]): AnimationHandle[]
```

Écart à combler : introduire une union explicite.

Proposition :

```ts
type AnimationOperation = TransitionRequest | AnimeSvgOperation

type AnimationAdapter = {
  run: (operations: AnimationOperation[]) => AnimationHandle[]
  ...
}
```

Ne pas élargir trop tôt `TransitionRequest`. Il doit rester le modèle des transitions simples. Les capacités Anime.js deviennent des opérations distinctes.

#### 6. `RendererFacade` ne peut pas injecter des services core créés avec l'adapter

Le renderer construit son orchestrateur ainsi :

```ts
this.orchestrator = new RuntimeComponentOrchestrator({ ... })
```

Il n'a pas d'option pour injecter des services core liés à l'`animationAdapter` créé par le player.

Écart à combler : ajouter une option de services core.

Proposition :

```ts
type CreateRendererOptions = {
  coreServices?: Array<{ name: string; service: ServiceInstance }>
}
```

Puis :

```txt
PlayerFacade constructor
  -> crée animationAdapter
  -> crée animeSvg service core
  -> new RendererFacade({ animationAdapter, coreServices: [...] })
  -> RuntimeComponentOrchestrator enregistre ces services avant load
```

## Palier 0 — critères d'acceptation

Le palier 0 est terminé uniquement si :

- les types runtime reflètent les specs nécessaires ;
- `ThirdPartyBinding.services` est soit implémenté, soit documenté comme ticket séparé bloquant pour les bindings tiers ;
- `ComponentServices` peut recevoir un contexte optionnel ;
- `RuntimeComponentUpdateInput` peut transporter ce contexte ;
- l'orchestrateur peut collecter des `animationOperations` produites par services ;
- `AnimationAdapter.run()` peut accepter `AnimationOperation[]` sans changer le comportement des transitions existantes ;
- toutes les démos existantes sont testées manuellement ou automatiquement ;
- les bugs éventuels révélés par cette consolidation sont relevés et traités avant `animeSvg.morphTo`.

Validation minimale :

- `npm test`
- build démos
- validation visuelle des démos sensibles : `codplay-poc`, `overlay-world-outlet`, `polygon`, `quiz-hunt`, Flip.

## Palier 1 — service `animeSvg.morphTo`

Après le palier 0, on peut ajouter la première capacité réelle.

### Types

Première opération :

```ts
type AnimeSvgMorphOperation = {
  kind: 'anime-svg:morphTo'
  operationId: string
  eventId: string
  eventName: string
  listenerId: string
  target: SVGPathElement | SVGPolygonElement | SVGPolylineElement
  to: SVGPathElement | SVGPolygonElement | SVGPolylineElement
  property: 'd' | 'points'
  duration: number
  ease?: string
  precision?: number
  delayMs?: number
  finalValue?: string
}
```

L'opération reste abstraite : elle ne contient pas encore le résultat de `svg.morphTo()`. L'adapter central fera cet appel.

### Service générique

Service :

```ts
animeSvg
```

Surface typée :

```ts
type AnimeSvgService = ServiceInstance & {
  morphTo(input: AnimeSvgMorphToInput, context?: ServiceApplyContext): void
}
```

Entrée :

```ts
type AnimeSvgMorphToInput = {
  target: SVGPathElement | SVGPolygonElement | SVGPolylineElement
  to: SVGPathElement | SVGPolygonElement | SVGPolylineElement
  property: 'd' | 'points'
  duration: number
  ease?: string
  precision?: number
}
```

Responsabilité du service :

- valider les cibles ;
- construire un `operationId` stable ;
- pousser une opération `anime-svg:morphTo` dans `context.output.animationOperations` ;
- ne jamais importer Anime.js ;
- ne jamais appeler `animate()`.

### Adapter central

L'adapter Anime.js central reçoit l'opération et fait :

```txt
operation anime-svg:morphTo
  -> svg.morphTo(operation.to, operation.precision)
  -> paramètres Anime.js sur operation.property
  -> animate(operation.target, parameters)
  -> tracking dans activeAnimations
  -> seek via animation.seek(elapsedMs)
```

À la finalisation, l'adapter applique explicitement `finalValue` ou la valeur finale générée par Anime.js sur `target`.

## Palier 2 — déclinaison spéciale `polygon`

`polygon` utilise le service générique, mais garde une action métier naturelle.

Action visée :

```ts
{
  morph: { duration: 700, ease: 'inOutCubic', precision: 0.33 },
  sides: 8,
  inner: null,
  outer: 42
}
```

Cas minimal :

```ts
{
  morph: true,
  sides: 8
}
```

Responsabilités de `PolygonComponent` :

- conserver l'état logique courant de forme ;
- calculer le `to` à partir des champs `sides`, `inner`, `outer`, `rotationDeg`, `inflexion` ;
- préparer une forme cible cachée ;
- appeler `this.services.animeSvg.morphTo(...)` ;
- mettre à jour son état logique courant vers `to` ;
- ne pas réimplémenter le morph ;
- ne pas utiliser `TweenRunner`.

Structure SVG recommandée :

```svg
<svg>
  <polygon data-ref="shape" points="..." />
  <polygon data-ref="targetShape" points="..." opacity="0" />
  <text>...</text>
</svg>
```

Pourquoi `polygon points` plutôt que `path d` : Anime.js documente directement `morphTo()` avec `polygon` et `points`, ce qui correspond au domaine du composant.

## Palier 3 — autres capacités SVG

Après stabilisation de `morphTo` :

- `createDrawable`
- `createMotionPath`

Ces capacités suivent le même modèle, mais ne doivent pas être ajoutées avant que `morphTo` ait prouvé :

- le passage par services ;
- le passage par l'adapter central ;
- l'équivalence `play(t) == seek(t)`.

`motionPath` doit être particulièrement prudent : il touche aux transforms et peut entrer en conflit avec les règles apprises sur `overlay-world` et les matrices existantes.

## Anticipation Text et Adapters

La dimension normative est essentielle : d'autres essais ont déjà existé avec Three.js et Rive, mais avec une approche moins élaborée et moins contraignante.

Si ce modèle aboutit, il doit devenir le patron applicable aux autres adapters.

### Anime Text

Modèle visé :

```txt
Action texte métier
  -> TextComponent.update()
    -> animeText service
      -> opération abstraite
        -> adapter central ou adapter tiers désigné
```

Le composant prépare le domaine texte. Le service traduit en capacité technique. L'adapter exécute.

### Anime Adapters

Pour des cibles non-DOM, le service reste le point d'entrée composant, mais le backend peut être :

- l'adapter Anime central si la cible appartient au modèle Anime.js central ;
- un `RenderAdapter` tiers si la cible appartient à un moteur externe avec son propre cycle de vie.

Règle inchangée : un composant ne pilote pas directement le moteur externe s'il existe un adapter central/tiers prévu pour cela.

## Seek : invariant obligatoire

Invariant :

```txt
play(t) == seek(t)
```

Pour une capacité Anime.js :

1. l'événement live prépare une opération déterministe ;
2. le replay de seek prépare la même opération ;
3. l'adapter central possède les handles ;
4. `renderer.syncAnimationsToTimeline(...)` appelle `animationAdapter.seek(...)` avec `eventMsByEventId` ;
5. l'adapter calcule `elapsedMs` et appelle `animation.seek(elapsedMs)` ;
6. la valeur finale est appliquée explicitement si la timeline est après la durée.

Important : dans le code actuel, le `RenderAdapter` Anime interne a un `seek()` vide. La synchronisation temporelle effective passe par `RendererFacade.syncAnimationsToTimeline(...)`, car l'adapter a besoin de la map `eventId -> eventMs`.

## Tests normatifs

Le premier ticket d'implémentation doit inclure :

1. Tests de non-régression des transitions CSS existantes.

2. Test de plomberie service : un service reçoit bien `ServiceApplyContext` et peut produire une opération.

3. Test adapter : `anime-svg:morphTo` est converti en paramètres Anime.js via le helper central.

4. Test polygon : `{ morph, sides, inner, outer }` produit une opération `anime-svg:morphTo`.

5. Test finalisation : seek après durée applique exactement la forme cible.

6. Test `play(t) == seek(t)` : snapshot en lecture live à `t`, reset, seek vers `t`, snapshot identique.

7. Test de refresh/seek : aucun doublon de target cachée dans `polygon`.

8. Test global : les démos existantes continuent à fonctionner.

## Risques et mitigations

### Deuxième instance Anime.js cachée

Mitigation : interdire les imports Anime.js dans composants et services. Seul l'adapter central importe Anime.js.

### Services qui deviennent des moteurs

Mitigation : un service émet des opérations, jamais des animations démarrées.

### Contexte runtime implicite

Mitigation : passer `serviceContext` explicitement dans `RuntimeComponentUpdateInput`.

### `TransitionRequest` trop élargi

Mitigation : introduire `AnimationOperation` plutôt que transformer `TransitionRequest` en fourre-tout.

### Regressions démos

Mitigation : palier 0 obligatoire avec validation de toutes les démos avant d'ajouter les capacités Anime SVG.

### Polygon migré trop tôt

Mitigation : stabiliser `animeSvg.morphTo` avec polygon en authoring ou décider explicitement une migration séparée. Ne pas mélanger migration structurelle et capacité Anime.js si cela complique la validation.

## Ticket recommandé — Palier 0

Titre :

```txt
Aligner les fondations runtime pour les capacités Anime.js via ComponentServices
```

Scope :

- ajouter `ThirdPartyBinding.services` dans le code ou créer le ticket bloquant correspondant ;
- ajouter `ServiceApplyContext` optionnel ;
- ajouter `RuntimeServiceOutput.animationOperations` ;
- étendre `RuntimeComponentUpdateInput` avec `serviceContext` ;
- étendre `RuntimeUpdateRoutingResult` avec `animationOperations` ;
- introduire `AnimationOperation` sans changer le comportement des `TransitionRequest` existants ;
- généraliser `runAnimationBatch` et `AnimationAdapter.run` ;
- ajouter l'injection de services core dans le renderer/orchestrateur ;
- valider tests et démos.

Out of scope :

- `animeSvg.morphTo` ;
- changement visuel de polygon ;
- migration de polygon vers core ;
- `createDrawable` ;
- `createMotionPath` ;
- Text ;
- Adapters.

Critères d'acceptation :

- aucun changement de comportement des transitions CSS ;
- aucune régression démo ;
- l'architecture permet à un service de produire une opération d'animation abstraite ;
- l'adapter central reste le seul propriétaire des animations ;
- la spec et le code sont alignés sur les points nécessaires.

## Ticket recommandé — Palier 1

Titre :

```txt
Ajouter le service core animeSvg.morphTo via l'AnimationAdapter central
```

Scope :

- créer le service core `animeSvg` ;
- ajouter l'opération `anime-svg:morphTo` ;
- implémenter la conversion dans l'adapter central avec `svg.morphTo()` ;
- brancher `PolygonComponent.morph()` sur ce service ;
- remplacer le morph maison par l'action naturelle `{ morph, sides, inner, outer }` ;
- ajouter les tests `play(t) == seek(t)`.

Out of scope :

- autres capacités SVG ;
- Text ;
- Adapters ;
- migration core de polygon sauf décision explicite.
