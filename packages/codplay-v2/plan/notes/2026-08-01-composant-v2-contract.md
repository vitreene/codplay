# CodPlay V2 - contrat composant

## Statut

Status: Fixe pour la fondation composant et la tranche HTML V2
CodPlay version: V2 foundation  
Review: separation BaseComponent/BaseHTMLComponent et migration du runtime validees le 2026-08-24; JSX et les substrats non HTML restent hors tranche

Le module de capacite layout est defini dans
[`2026-08-01-markup-module-service-contract.md`](./2026-08-01-markup-module-service-contract.md).
L'audit de la separation V1/V2 est documente dans
[`2026-08-01-audit-v1-components-services-layout.md`](./2026-08-01-audit-v1-components-services-layout.md).
Son etat pur et son wrapper `RuntimeModuleService` sont implementes dans
`src/runtime/capabilities/markup/markup-capability.ts`.
Le socle composant, le catalogue runtime, `RuntimeComponentRuntime` et les
composants `LayoutComponent`/`TagComponent` sont implementes dans
`src/runtime/components/`. Leur materializer HTML est branche au player ; la
factory de chaque type reste fournie par le catalogue.

## Contrat

```ts
type ComponentInput<Initial extends Record<string, unknown> = Record<string, unknown>> = {
  perso: {
    id: string
    storyId: string
    initial: Initial
    actions?: Readonly<Record<string, unknown>>
  }
  resourceMetadata?: ReadonlyMap<string, RuntimePreloadResourceMetadata>
}

type HTMLComponentInput<Initial extends Record<string, unknown> = Record<string, unknown>> =
  ComponentInput<Initial> & {
    services: HTMLComponentServices
  }

type MaterializedPart = {
  partId: string
  nodeRef: unknown
}

type HTMLComponentServices = {
  apply(node: unknown, patch: Record<string, unknown>): void
}

type RuntimeComponentDefinition = {
  type: string
  services: readonly string[]
  modules: readonly string[]
  mountableParts?: readonly string[]
  create: RuntimeComponentFactory
}
```

Le socle V2 impose une seule methode obligatoire. La tranche HTML ajoute
`render()` dans une base specialisee :

```ts
abstract class BaseComponent<Initial extends Record<string, unknown>> {
  protected readonly perso: ComponentInput<Initial>['perso']
  abstract update(input: ComponentUpdateInput): void
}

abstract class BaseHTMLComponent<Initial extends Record<string, unknown>>
  extends BaseComponent<Initial> {
  protected readonly services: HTMLComponentServices
  public node: unknown | null = null

  abstract render(): string

  /** Internal materialization registry consumed by specialized components. */
  protected getPartsSnapshot(): readonly MaterializedPart[]
}
```

`BaseComponent` ne connait ni template, ni DOM, ni services HTML/SVG. Il conserve
uniquement `perso` et impose l'application de l'etat resolu. Les metadonnees de
preload restent dans `ComponentInput` pour les composants qui en ont besoin ;
elles ne deviennent pas une dependance de la base generique. `BaseHTMLComponent`
fournit la tranche markup actuelle ; les materializers Canvas, Three.js, Rive ou
autres peuvent definir leur propre base specialisee sans heriter de cette API.

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

Le runtime composant HTML recoit une facade `HTMLComponentServices` deja construite par le
`RuntimeCapabilityCatalog`, ainsi que les instances de modules du player et son
materializer. La liste des services et modules est portée uniquement par la
definition runtime du type. Les modules ne sont pas appliques comme des proprietes ;
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
  constructor(input: HTMLComponentInput<TagState>) {
    super(input)
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

Le parseur du template et le module `layout` enregistrent les elements `data-part`
en interne. Le composant ne publie pas lui-meme ces declarations. Le runtime de
placement consomme ensuite le registre du module pour resoudre les `move.target`.

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
