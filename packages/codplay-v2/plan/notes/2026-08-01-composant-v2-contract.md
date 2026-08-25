# CodPlay V2 - contrat composant

## Statut

Status: Fixe pour la fondation composant et la tranche DOM HTML/SVG V2
CodPlay version: V2 foundation  
Review: séparation BaseComponent/BaseHTMLComponent et déclaration locale des services validées le 2026-08-25; JSX, Canvas et Three.js restent hors tranche

Le module de capacite layout est defini dans
[`2026-08-01-markup-module-service-contract.md`](./2026-08-01-markup-module-service-contract.md).
L'audit de la separation V1/V2 est documente dans
[`2026-08-01-audit-v1-components-services-layout.md`](./2026-08-01-audit-v1-components-services-layout.md).
Son etat pur et son wrapper `RuntimeModuleService` sont implementes dans
`src/runtime/capabilities/markup/markup-capability.ts`.
Le socle composant, le catalogue runtime, `RuntimeComponentRuntime` et les
composants `LayoutComponent`/`TagComponent` sont implementes dans
`src/runtime/components/`. Leur materializer HTML est branche au player ; le
catalogue enregistre la classe du composant et ses validateurs, tandis que le
composant declare lui-même les services qu'il consomme.

## Contrat

```ts
type ComponentInput<Initial extends Record<string, unknown> = Record<string, unknown>> = {
  services: ComponentServices
  perso: {
    id: string
    storyId: string
    initial: Initial
    actions?: Readonly<Record<string, unknown>>
  }
  resourceMetadata?: ReadonlyMap<string, RuntimePreloadResourceMetadata>
}

type HTMLComponentInput<Initial extends Record<string, unknown> = Record<string, unknown>> =
  ComponentInput<Initial>

type MaterializedPart = {
  partId: string
  nodeRef: unknown
}

type ComponentService = {
  apply(node: unknown, value: unknown): void
}

type ComponentServices = {
  declare(names: readonly string[]): void
  get(name: string): ComponentService
  apply(node: unknown, patch: Record<string, unknown>): void
}

type RuntimeComponentDefinition = {
  type: string
  component: RuntimeComponentClass
  modules: readonly string[]
  mountableParts?: readonly string[]
}

type RuntimeComponentClass = {
  new (input: ComponentInput<Record<string, unknown>>): BaseComponent<Record<string, unknown>>
  readonly declaredServices: readonly string[]
}
```

Le socle V2 impose une seule methode obligatoire. La tranche HTML ajoute
`render()` dans une base specialisee :

```ts
abstract class BaseComponent<Initial extends Record<string, unknown>> {
  protected readonly perso: ComponentInput<Initial>['perso']
  protected readonly services: ComponentServices
  abstract update(input: ComponentUpdateInput): void
}

abstract class BaseHTMLComponent<Initial extends Record<string, unknown>>
  extends BaseComponent<Initial> {
  public node: unknown | null = null

  abstract render(): string

  /** Internal materialization registry consumed by specialized components. */
  protected getPartsSnapshot(): readonly MaterializedPart[]
}
```

`BaseComponent` ne connait ni template ni DOM. Il conserve `perso`, reçoit une
facade de services abstraite et impose l'application de l'etat resolu. Les
services ne prescrivent aucun substrat : leur implementation est fournie par le
materializer choisi. Les metadonnees de preload restent dans `ComponentInput`
pour les composants qui en ont besoin. `BaseHTMLComponent` ajoute uniquement la
tranche markup actuelle ; les materializers Canvas, Three.js, Rive ou autres
peuvent utiliser la même frontière de services avec leurs propres adapters.

`BaseHTMLComponent.render()` fournit le template string de materialisation. Le runtime JSX autonome
est reporte a l'objectif V2.5.

Pour la materialisation HTML, un template a une racine reelle lorsque le rendu
produit un seul noeud. Lorsqu'il en produit plusieurs, le materializer conserve
la collection ordonnee de ces noeuds reels comme un fragment : il ne cree aucun
element d'enveloppement. Cette collection est la reference de materialisation
du composant ; elle n'est pas une cible de service. Les services ne recoivent
que les noeuds reels designes par le composant.

Le composant reçoit également les actions compilées lorsqu'elles font partie de
ses données auteur. Ce n'est pas un second circuit d'état : `SolvedPerso.state`
reste la seule entrée de `update()`. Cette donnée complète permet notamment à un
composant media de connaître les sources statiques à mettre en cache, comme en
V1.

`update()` applique l'etat resolu a la materialisation du composant.

`update()` peut muter directement `this.node`, qui est le node racine possede par
l'instance du composant. Les mutations restent limitees a la materialisation de
cette instance.

Cette mutation ne change pas la nature de `f(t)` :

```text
PersoState(t) -> update(this.node, PersoState(t), t) -> materialisation
```

`this.node` est une cible de materialisation et jamais une source d'etat. `update()`
ne doit pas lire le node pour reconstruire l'etat, ni dependre d'une accumulation
de mutations precedentes pour produire la materialisation a `t`.

Le composant conserve une reference interne vers son node racine materialise. Cette
reference sert a `update()`. Elle n'est ni l'etat logique du perso ni un handle
public.

## Instanciation runtime

Le `RuntimePlayer` ne connait pas les classes concretes. Il utilise un
`RuntimeCapabilityCatalog` pour resoudre `perso.type`, puis un
`RuntimeComponentRuntime` pour le cycle suivant :

```text
SolvedScene
  -> factory du type
  -> materialization du markup compile
  -> Component.update(state, timeMs)
  -> cleanup au retrait ou a la destruction du player
```

Le runtime composant reçoit une facade `ComponentServices` construite par le
`RuntimeCapabilityCatalog`, ainsi que les instances de modules du player et son
materializer. Le composant appelle `this.services.declare()` dans son
constructeur, dans l'ordre d'application voulu. Le catalogue vérifie cette
déclaration et résout chaque nom vers l'adapter du materializer courant ; il ne
fournit pas une seconde liste de services au composant. Les modules ne sont pas appliques comme des proprietes ;
ils servent a satisfaire la dependance et restent hors de l'API de mutation du node.
Le runtime generique ne cree pas de DOM lui-meme et ne contient aucune branche
speciale pour `layout` ou `input`. Le materializer HTML n'accepte les composants
qui exposent `render()` et la materialisation de parts qu'a travers
`BaseHTMLComponent`.

## Exemple Tag

Le composant `tag` declare une balise et applique son etat DOM. Sa definition
runtime partage avec le validateur les services `className`, `style`, `attr` et
`content`.

```ts
type TagState = {
  tag: string
  content?: string | HTMLElement
  className?: string | { add?: string; remove?: string }
  style?: Record<string, unknown>
  attr?: Record<string, unknown>
}

type ComponentUpdateInput = {
  state: TagState
  timeMs: number
}

class TagComponent extends BaseHTMLComponent<TagState> {
  static readonly declaredServices = ['className', 'style', 'attr', 'content'] as const

  constructor(input: HTMLComponentInput<TagState>) {
    super(input)
    this.services.declare(TagComponent.declaredServices)
  }

  /** Declares the tag root with a template string. */
  render(): string {
    const tag = (this.perso.initial as TagState).tag ?? 'div'

    return `
      <${tag}></${tag}>
    `
  }

  /** Applies one resolved tag state to the materialized root. */
  update(input: ComponentUpdateInput<TagState>): void {
    const state = input.state

    this.services.apply(this.node, {
      className: state.className,
      style: state.style,
      attr: state.attr,
    })

    this.services.apply(this.node, { content: state.content })
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
  className?: string | { add?: string; remove?: string }
  style?: Record<string, unknown>
  attr?: Record<string, unknown>
}

type LayoutState = {
  className?: string | { add?: string; remove?: string }
  style?: Record<string, unknown>
  attr?: Record<string, unknown>
}

type LayoutUpdateInput = {
  state: LayoutState
  timeMs: number
}

class LayoutComponent extends BaseHTMLComponent<LayoutInitial> {
  constructor(input: HTMLComponentInput<LayoutInitial>) {
    super(input)
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

Le parseur du template et le module `markup` de la capacite layout enregistrent les elements `data-part`
en interne. Le composant ne publie pas lui-meme ces declarations. Le runtime de
placement consomme ensuite le registre du module pour resoudre les `move.target`.

Une fonction `init()` optionnelle pourra etre etudiee pour les usages avances en
V2.5. Elle ne fait pas partie du contrat V2 actuel.

La decouverte des parts et leur enregistrement sont des operations internes de la
materialisation et du module `markup`. Elles ne font pas partie des methodes du
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
    move: { target: '@root' },
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
    move: { target: 'page-layout:content' },
  },
  actions: {},
}

const asidePerso: PersoDoc = {
  id: 'page-aside',
  type: 'tag',
  initial: {
    tag: 'p',
    content: 'Informations secondaires',
    move: { target: 'page-layout:aside' },
  },
  actions: {},
}
```

`page-layout:content` et `content` sont deux identifiants possibles pour un outlet.
Leur forme n'est pas normative. Le runtime compare et enregistre la valeur
declaree ; le type `layout` porte le contrat du composant, pas le nom de l'outlet.
