# Module API V1 - integration runtime et composant

## Statut

Spec normative V1 pour les modules runtime enregistres via le registry `codplay.module`.

## Objectif

Definir un contrat d'integration de module permettant:

- une accroche reguliere au niveau runtime de l'application
- une accroche reguliere au niveau composant
- une injection de dependances centralisee et lisible

Le cas de reference pour cette spec est `move`.

## Positionnement

- un module est enregistre via `codplay.module.register(...)`
- un module est integre au runtime avant usage
- un composant ne declare jamais lui-meme un module
- un composant consomme les bindings de module deja installes

## Bootstrap Codplay

Codplay declare d'abord ses composants, services et modules internes via les memes registries que l'hote.

Exemple de principe:

```ts
class Codplay {
  constructor() {
    this.component.register({ type: "text", component: TextComponent })
    this.component.register({ type: "img", component: ImageComponent })
    this.component.register({ type: "media", component: MediaComponent })
    this.component.register({ type: "list", component: ListComponent })
    this.component.register({ type: "layout", component: LayoutComponent })

    this.service.register({ name: "style", service: styleService })
    this.service.register({ name: "className", service: classNameService })
    this.service.register({ name: "attr", service: attrService })
    this.service.register({ name: "content", service: contentService })

    this.module.register({ name: "move", module: moveModule })
    this.module.register({ name: "list", module: listModule })
  }
}
```

Regles:

- il n'existe pas de chemin privilegie pour les declarations internes
- Codplay utilise les memes APIs `register/override` que l'hote
- l'hote peut ensuite faire des `override(...)` explicites

Reference registry:

- `v1-registry-api.md`

## Contrat minimal

```ts
type RuntimeModuleHost = {
  report: RuntimeReport
  registries: {
    node: RuntimeNodeRegistry
    component: RuntimeComponentRegistry
    container: RuntimeContainerRegistry
    mounted: RuntimeMountedRegistry
  }
}

type RuntimeModuleBinding<TRuntime = unknown, TComponent = unknown> = {
  runtime?: TRuntime
  component?: TComponent
}

type RuntimeModule<TRuntime = unknown, TComponent = unknown> = {
  install: (host: RuntimeModuleHost) => RuntimeModuleBinding<TRuntime, TComponent>
}
```

## Mecanisme declaratif runtime

Le runtime ne doit pas connaitre un module par son nom metier au moment de l'execution.

Le runtime ne doit pas ecrire de code specialise du type:

```ts
runtime.move.applyResolvedMove(...)
runtime.list.registerComponent(...)
```

Le mecanisme cible est:

1. un module est enregistre par nom
2. le module est installe
3. sa face `runtime` declare des hooks
4. un dispatcher runtime generique execute les hooks matchants selon la phase courante

## Contrat de hooks runtime

```ts
type RuntimeModuleHookPhase =
  | "onComponentMounted"
  | "onComponentUnmounted"
  | "onInitialPerso"
  | "beforeUpdate"
  | "afterUpdate"
  | "onDestroy"

type RuntimeModuleHookPayload = {
  perso?: DeepReadonly<ItemDoc>
  component?: RuntimeComponent
  rootNode?: unknown
  resolvedAction?: AnimationResolvedAction
  eventSeq?: number
}

type RuntimeModuleHookContext = {
  phase: RuntimeModuleHookPhase
  payload: RuntimeModuleHookPayload
}

type RuntimeModuleHook = (input: RuntimeModuleHookContext) => unknown

type RuntimeModuleMatch = {
  actionKeys?: string[]
  componentCapabilities?: string[]
}

type RuntimeModuleRuntimeHooks = Partial<Record<RuntimeModuleHookPhase, RuntimeModuleHook>>

type RuntimeModuleRuntimeBinding = {
  hooks?: RuntimeModuleRuntimeHooks
  match?: RuntimeModuleMatch
}
```

## Regles de dispatch

1. Le runtime annonce une phase

- par exemple `beforeUpdate`
- ou `onComponentMounted`

2. Le runtime transmet un contexte generique

- phase
- payload

3. Le dispatcher runtime execute uniquement les modules dont le `match` est compatible

Exemples:

- si `payload.resolvedAction.action.move` existe, les modules avec `match.actionKeys` contenant `"move"` peuvent etre executes
- si le composant expose une capacite `list`, les modules avec `match.componentCapabilities` contenant `"list"` peuvent etre executes

4. Le runtime reste un routeur

- il ne connait ni la logique interne de `move`, ni celle de `list`
- il ne fait que diffuser les phases et le contexte

## Exemple `move`

`move` est un module a double accroche.

Sa face `runtime` declare typiquement:

```ts
type MoveRuntimeBinding = {
  hooks: {
    onInitialPerso: RuntimeModuleHook
    beforeUpdate: RuntimeModuleHook
  }
  match: {
    actionKeys: ["move"]
  }
}
```

Lecture:

- `onInitialPerso` traite `initial.move`
- `beforeUpdate` traite `action.move`
- le module est appele uniquement quand la phase et le `match` correspondent

Le module `move` garde en interne sa logique de normalisation, de coordination et de support FLIP.

## Exemple `list`

`list` peut etre traite comme un module a accroche runtime seule.

Sa face `runtime` declare typiquement:

```ts
type ListRuntimeBinding = {
  hooks: {
    onComponentMounted: RuntimeModuleHook
    onComponentUnmounted: RuntimeModuleHook
  }
  match: {
    componentCapabilities: ["list"]
  }
}
```

Lecture:

- quand un composant list est monte, le module `list` peut l'enregistrer dans son propre etat runtime
- quand il est detruit ou demonte, le module `list` peut nettoyer son etat
- le runtime n'appelle pas directement `list` par son nom; il diffuse seulement `onComponentMounted` / `onComponentUnmounted`

## Face composant

La face `component` reste optionnelle.

Un module n'expose une face `component` que si un composant doit consommer explicitement une capability locale issue du module.

Sinon, seule la face `runtime` existe.

## Regles V1

1. Installation

- un module est enregistre dans le registry `codplay.module`
- un module est ensuite installe par le runtime avant le chargement effectif des composants
- l'installation est centralisee; elle n'est jamais declenchee par un composant
- Codplay enregistre d'abord ses modules internes pendant son bootstrap via les memes APIs `register/override`

2. Double accroche

- un module peut exposer une face `runtime`
- un module peut exposer une face `component`
- un module peut exposer les deux

3. Face runtime

- la face `runtime` sert au player, au renderer, a l'orchestrateur ou aux coordinators internes
- elle peut dependre des registries runtime et de l'etat global
- elle ne doit pas etre confondue avec un helper de patch local de composant
- elle declare ses hooks et son `match`
- elle est executee par un dispatcher runtime generique
- le runtime n'appelle pas un module par son nom metier pendant l'execution normale

4. Face composant

- la face `component` est injectee dans les composants via l'objet `runtime` prepare par le runtime
- elle sert de capability locale stable, deja preparee par l'installation runtime
- elle ne doit pas reinstaller ou redeclarer le module
- elle est optionnelle

5. Separation services / modules

- un `service` ne patch pas le runtime global
- un `module` peut s'accrocher au runtime global et exposer une capability composant
- un module n'est donc pas un simple helper de patch de node

6. Cas `move`

- `move` est un module, pas un simple service
- `move` a besoin d'une accroche runtime car il depend de:
  - `node registry`
  - `component registry`
  - `container registry`
  - `mounted registry`
- `move` a aussi besoin d'une accroche composant, notamment pour les composants de type `list`
- `move` declare des hooks sur les phases runtime generiques, mais reste appele via le dispatcher generique

## Binding attendu pour le cas `move`

```ts
type MoveRuntimeBinding = {
  hooks: {
    onInitialPerso: RuntimeModuleHook
    beforeUpdate: RuntimeModuleHook
  }
  match: {
    actionKeys: ["move"]
  }
}

type MoveComponentBinding = {
  list?: {
    attachChild: RuntimeListComponent["attachChild"]
    detachChild: RuntimeListComponent["detachChild"]
    repositionChild: RuntimeListComponent["repositionChild"]
    getChildrenSnapshot: RuntimeListComponent["getChildrenSnapshot"]
  }
}

type MoveModule = RuntimeModule<MoveRuntimeBinding, MoveComponentBinding>
```

Lecture:

- la logique interne de normalisation, de coordination et de support FLIP reste cachee dans l'implementation du module
- le contrat runtime visible du module reste `install(...)` puis `hooks + match`
- le composant ne consomme que la capability locale utile, par exemple `runtime.move?.list`

## Invariants du cas `move`

- la logique globale de `move` reste pilotee par la face `runtime`
- la logique locale de conteneur reste portee par la face `component`
- `flip` ne fait pas partie du contrat composant de `move`
- `flip` reste un detail d'orchestration interne du runtime

## Injection cible dans un composant

```ts
type RuntimeComponentClassInput = {
  perso: DeepReadonly<ItemDoc>
  services: ComponentServices
  runtime: {
    move?: MoveComponentBinding
  }
  report: RuntimeReport
}
```

## Dispatcher runtime

Le runtime doit disposer d'un point unique de diffusion des phases module.

Exemple de principe:

```ts
type RuntimeModuleDispatcher = {
  runHook: (phase: RuntimeModuleHookPhase, payload: RuntimeModuleHookPayload) => void
}
```

Regles:

- `runHook(...)` ne connait pas le nom metier des modules
- `runHook(...)` parcourt les modules installes
- `runHook(...)` applique le `match` puis execute le hook de meme nom s'il existe

## Consequence architecturale

- le couplage par nom direct entre runtime et module doit disparaitre
- le runtime ne connait que des phases, un payload et un dispatcher generique
- la logique specifique reste a l'interieur du module

## Perimetre repere pour `move`

Les dependances runtime directes reperees aujourd'hui sont:

- `RuntimeComponentOrchestrator`
  - normalisation de `move`
  - application des moves initiaux
  - application des moves resolus
  - coordination avant/apres autour des updates
- `create-player-utils`
  - transport de `story.initial.move` vers `RuntimePersos.storyMovesByStoryId`
- `runtime/types`
  - `MoveValue`, `MoveCommand`, `MoveFlipMode`
- `runtime/config`
  - `move.rootToken`
- `animation/types`
  - transport de payloads contenant `move`

Les autres parties du systeme ne portent pas de logique `move` metier directe:

- facade player publique
- telco local
- registry de composants/services/modules
- builder/validation hors transport de donnees auteur

## Consequence architecturale

- `move` doit etre extrait de l'orchestrateur inline vers un module/coordinator dedie
- `list` peut etre branche via le meme mecanisme de hooks runtime sans appel nominal direct
- l'accroche runtime et l'accroche composant doivent etre centralisees par l'installation du module
- un composant consomme seulement la capability locale dont il a besoin
