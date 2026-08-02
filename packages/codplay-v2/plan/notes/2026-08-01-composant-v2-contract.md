# CodPlay V2 - contrat composant

## Statut

Status: En cours  
CodPlay version: V2 foundation  
Review: template-string runtime and player projection integrated; JSX remains V2.5

Le module de capacite layout est defini dans
[`2026-08-01-markup-module-service-contract.md`](./2026-08-01-markup-module-service-contract.md).
L'audit de la separation V1/V2 est documente dans
[`2026-08-01-audit-v1-components-services-layout.md`](./2026-08-01-audit-v1-components-services-layout.md).
Son etat pur et son wrapper `RuntimeModuleService` sont implementes dans
`src/runtime/capabilities/markup/markup-capability.ts`.
Le socle composant, le catalogue runtime, `RuntimeComponentRuntime` et les
composants `LayoutComponent`/`TagComponent` sont implementes dans
`src/runtime/components/`. Leur backend de projection est branche au player ; la
factory de chaque type reste fournie par le catalogue.

## Contrat

```ts
type ComponentInput<Initial extends Record<string, unknown> = Record<string, unknown>> = {
  perso: {
    id: string
    storyId: string
    initial: Initial
  }
  services: ComponentServices
}

type MaterializedPart = {
  partId: string
  nodeRef: unknown
}

type ComponentServices = {
  declare(names: readonly string[]): void
  apply(node: unknown, patch: Record<string, unknown>): void
  content?: {
    apply(node: unknown, value: unknown): void
  }
}

type RuntimeComponentDefinition = {
  type: string
  services: readonly string[]
  modules: readonly string[]
  mountableParts?: readonly string[]
  create: RuntimeComponentFactory
}
```

Un composant V2 expose deux methodes obligatoires :

```ts
abstract class BaseComponent<Initial extends Record<string, unknown>> {
  protected readonly perso: ComponentInput<Initial>['perso']
  protected readonly services: ComponentServices
  public node: unknown | null = null

  abstract render(): string
  abstract update(input: ComponentUpdateInput): void

  /** Internal materialization registry consumed by specialized components. */
  protected getPartsSnapshot(): readonly MaterializedPart[]
}
```

`render()` declare la projection avec un template string. Le runtime JSX autonome
est reporte a l'objectif V2.5.

`update()` applique l'etat resolu a la projection du composant.

`update()` peut muter directement `this.node`, qui est le node racine possede par
l'instance du composant. Les mutations restent limitees a cette projection.

Cette mutation ne change pas la nature de `f(t)` :

```text
PersoState(t) -> update(this.node, PersoState(t), t) -> projection
```

`this.node` est une cible de projection et jamais une source d'etat. `update()` ne
doit pas lire le node pour reconstruire l'etat, ni dependre d'une accumulation de
mutations precedentes pour produire la projection a `t`.

Le composant conserve une reference interne vers son node racine materialise. Cette
reference sert a `update()`. Elle n'est ni l'etat logique du perso ni un handle
public.

## Instanciation runtime

Le `RuntimePlayer` ne connait pas les classes concretes. Il utilise un
`RuntimeComponentCatalog` pour resoudre `perso.type`, puis un
`RuntimeComponentRuntime` pour le cycle suivant :

```text
SolvedScene
  -> factory du type
  -> materialization du markup compile
  -> Component.update(state, timeMs)
  -> cleanup au retrait ou a la destruction du player
```

Le runtime composant recoit son catalogue de services, les instances de modules
du player et son materializer par injection. `declare()` verifie que chaque nom
correspond a un service disponible ou a un module player-scoped. Les modules ne
sont pas appliques comme des proprietes ; ils servent a satisfaire la dependance
et restent hors de l'API de mutation du node. Le runtime ne cree pas de DOM lui-
meme et ne contient aucune branche speciale pour `layout` ou `input`.

## Exemple Tag

Le composant `tag` declare une balise et applique son etat DOM. Sa definition
runtime partage avec le validateur les services `className`, `style`, `attr` et
`content`.

```ts
type TagState = {
  tag: string
  content?: string | number
  className?: string
  style?: Record<string, string | number>
  attr?: Record<string, string | boolean | number>
}

type ComponentUpdateInput = {
  state: TagState
  timeMs: number
}

class TagComponent extends BaseComponent<TagState> {
  constructor(input: ComponentInput<TagState>) {
    super(input)
    this.services.declare(['className', 'style', 'attr', 'content'])
  }

  /** Declares the tag root with a template string. */
  render(): string {
    const tag = (this.perso.initial as TagState).tag ?? 'div'

    return `
      <${tag}></${tag}>
    `
  }

  /** Applies one resolved tag state to the materialized root. */
  update(input: ComponentUpdateInput): void {
    const state = input.state

    this.services.apply(this.node, {
      className: state.className,
      style: state.style,
      attr: state.attr,
    })

    if (state.content !== undefined) {
      this.services.content?.apply(this.node, String(state.content))
    }
  }
}
```

`TagComponent` ne definit pas `init()` : son template suffit et son `update()`
travaille sur le node materialise.

## Exemple Layout

Un layout utilise `this.node` pour deux raisons :

- appliquer l'etat du layout sur sa racine ;
- retrouver les nodes internes qui servent de points de montage.

Les marqueurs `data-part` sont utiles ici parce que le layout expose plusieurs
outlets. Ils ne sont pas necessaires pour la racine d'un composant `tag`.

```ts
type LayoutInitial = {
  markup: string
  className?: string
  style?: Record<string, string | number>
  attr?: Record<string, string | boolean | number>
}

type LayoutState = {
  className?: string
  style?: Record<string, string | number>
  attr?: Record<string, string | boolean | number>
}

type LayoutUpdateInput = {
  state: LayoutState
  timeMs: number
}

class LayoutComponent extends BaseComponent<LayoutInitial> {
  constructor(input: ComponentInput<LayoutInitial>) {
    super(input)
    this.services.declare(['markup', 'className', 'style', 'attr'])
  }

  /** Declares the layout structure with its internal mounting points. */
  render(): string {
    const state = this.perso.initial as LayoutInitial
    return state.markup
  }

  /** Applies one resolved layout state to the root node. */
  update(input: LayoutUpdateInput): void {
    this.services.apply(this.node, input.state)
  }
}
```

`markup` est une donnee source de `SceneDoc`. Le builder la parse, la sanitise et
la normalise dans `CompiledPerso.initial.markup`. Le runtime recoit ce markup de
confiance et le materialise sans refaire la sanitization.

Le parseur du template et le module `layout` enregistrent les elements `data-part`
en interne. Le composant ne publie pas lui-meme ces declarations. Le runtime de
placement consomme ensuite le registre du module pour resoudre les `move.parentId`.

Une fonction `init()` optionnelle pourra etre etudiee pour les usages avances en
V2.5. Elle ne fait pas partie du contrat V2 actuel.

La decouverte des parts et leur enregistrement sont des operations internes de la
materialisation et du module `layout`. Elles ne font pas partie des methodes du
composant auteur.

Dans cet exemple :

```text
this.node
  -> racine du layout
  -> cible de update()

registre interne des data-part
  -> outlet interne
  -> cible de montage d'un autre perso
```

## Persos du layout

Cet exemple definit la forme auteur attendue. La verticale de validation player
exerce maintenant le runtime de composants, la materialisation DOM et le module
`markup` sur ce flux.

Le `perso` layout porte le template. Les autres persos ciblent les outlets
decouverts dans ce template avec `move.parentId`.

```ts
const layoutPerso: PersoDoc = {
  id: 'page-layout',
  type: 'layout',
  initial: {
    move: { parentId: '@root' },
    markup: `
      <section class="page-shell">
        <main data-part="page-layout:content"></main>
        <aside data-part="page-layout:aside"></aside>
      </section>
    `,
  },
  actions: {},
}

const contentPerso: PersoDoc = {
  id: 'page-content',
  type: 'tag',
  initial: {
    tag: 'article',
    content: 'Contenu principal',
    move: { parentId: 'page-layout:content' },
  },
  actions: {},
}

const asidePerso: PersoDoc = {
  id: 'page-aside',
  type: 'tag',
  initial: {
    tag: 'p',
    content: 'Informations secondaires',
    move: { parentId: 'page-layout:aside' },
  },
  actions: {},
}
```

`page-layout:content` et `content` sont deux identifiants possibles pour un outlet.
Leur forme n'est pas normative. Le runtime compare et enregistre la valeur
declaree ; le type `layout` porte le contrat du composant, pas le nom de l'outlet.
