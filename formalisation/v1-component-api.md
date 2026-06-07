# Component API V1 - contrat de classe composant

## Statut

Spec normative V1 pour le contrat de classe des composants runtime de Codplay.

## Objectif

Rendre lisible et stable la construction de composants personnalises par des auteurs, en separant:

- l'API auteur
- le cycle de vie runtime interne

## Perimetre de cette spec

Cette spec fixe uniquement:

- les entrees principales du composant
- le role de `render()`
- le role de `init()`
- le role de `_init()`
- le role de `createRootNode()`
- les formes autorisees du retour de `render()`

Cette spec ne fige pas encore:

- `part`
- `outlet`
- le detail de l'injection `runtime`

Cette spec fixe en revanche les principes de `ComponentServices`.

## Contrat auteur

Le contrat auteur visible doit rester minimal:

1. constructeur
2. `render()`
3. `init()`
4. `update()`

`init()` est une methode auteur optionnelle de mise en place personnalisee du composant.

Les autres methodes specifiques du composant restent privees.

## Constructeur

Le constructeur recoit le `perso` complet en lecture seule, ainsi que les dependances runtime injectees.

Le `perso` n'est pas fragmente en sous-ensembles pour l'auteur.

Principe:

- l'auteur peut lire l'integralite du `perso`
- le `perso` reste stable et readonly
- le constructeur ne construit pas lui-meme le node root

## `createElementOptions`

`createElementOptions` est une dependance interne du runtime, non exposee a l'auteur.

Elle regroupe deux responsabilites distinctes:

1. `nodeFactory` — determine comment le node physique est cree (DOM browser ou objet de substitution en environnement sans DOM, typiquement les tests)
2. `emitRuntimeEvent` — pont vers le systeme d'evenements runtime, utilise pour brancher les declarations `emit` auteur comme event listeners sur les nodes

`createElementOptions` est transmis au constructeur de `BaseComponent` comme propriete interne.

Elle est utilisee en deux moments du cycle de vie:

- dans `_createRootNode()` — le `nodeFactory` entre en jeu pour produire le node physique a partir du retour de `render()`; si `render()` retourne une `string`, le runtime cree le node; si `render()` retourne un `Node`, le runtime l'utilise directement
- dans `_init()` apres `_createRootNode()` — `emitRuntimeEvent` est utilise pour brancher les event listeners declares dans `perso.emit` sur le node et ses parts internes

Cette dependance ne fait pas partie de `ComponentServices`.

Elle ne fait pas partie du contrat auteur.

L'auteur n'a pas a connaitre ni a manipuler `createElementOptions`.

## `ComponentServices`

`services` est l'objet injecte au composant qui lui donne acces aux services enregistres.

### Enregistrement

Codplay enregistre ses services core au bootstrap:

- `className`
- `style`
- `attr`
- `content`

L'hote peut enregistrer des services supplementaires via `codplay.service.register({ name, service })`.

### Validation a l'initialisation de scene

Quand une scene est initialisee, tous les services declares par les composants presents doivent etre connus du registry. Si un service declare est absent, c'est une erreur explicite. Pas de resolution lazy.

### Declaration dans le constructeur

Le composant declare les services dont il a besoin en appelant `this.services.declare(names)` dans son constructeur, apres `super(input)`.

```ts
constructor(input: RuntimeComponentClassInput) {
  super(input)
  this.services.declare(['className', 'style', 'attr'])
}
```

`declare()` resout les noms depuis le registry et les rend disponibles sur `this.services`. L'ordre de declaration est l'ordre d'execution lors d'un appel a `apply()`.

Les services sont ainsi disponibles des `render()`, ce qui garantit une coherence entre la construction initiale et les mises a jour.

Une variable de config peut proposer une liste par defaut pour les cas standard:

```ts
constructor(input: RuntimeComponentClassInput) {
  super(input)
  this.services.declare(COMPONENT_DEFAULT_SERVICES)
}
```

### Usage dans `update()`

L'auteur appelle les services dans `update()`. Deux formes:

**Cas standard** — `apply()` passe le patch par tous les services declares, dans l'ordre de declaration:

```ts
update(input: RuntimeComponentUpdateInput): void {
  this.services.apply(this.node, input.action)
  // traitement specifique si besoin
}
```

**Cas orchestre** — appel individuel pour controler l'ordre (ex. list + move):

```ts
update(input: RuntimeComponentUpdateInput): void {
  this.prepareFlip()
  this.resolveChildMove(input)
  this.services.style.apply(this.node, input.action.style)
  this.commitFlip()
}
```

### Cohabitation avec les methodes auteur

Si un composant auteur definit une methode portant le meme nom qu'un service (ex. `style()`), il n'y a pas de conflit: les services vivent sur `this.services.style`, la methode auteur s'appelle via `this.style()`. L'auteur appelle ce dont il a besoin explicitement dans `update()`.

### `render()` utilise les services

`render()` utilise les services pour appliquer les proprietes standard sur le node initial, avec la meme coherence que `update()`:

```ts
render(): ComponentRenderResult {
  const rootNode = createComponentRoot(...)
  resetComponentRoot(rootNode)
  setComponentRootId(rootNode, ...)
  this.services.apply(rootNode, this.perso.initial)
  // traitements specifiques si besoin
  return rootNode as Node
}
```

Les helpers de construction du node (`createComponentRoot`, `resetComponentRoot`, `setComponentRootId`) restent des appels directs car ils ne relevent pas de la couche services.

Un `service` reste distinct d'un `module`:

- un `service` n'accroche pas le runtime global
- un `service` fournit des fonctions partagees reutilisables par les composants
- un `module` releve d'une autre spec et peut, lui, s'accrocher au runtime

## `render()`

`render()` est obligatoire.

`render()` est le point d'entree auteur pour decrire le rendu initial du composant.

`render()` est one-shot dans le cycle normal V1.

Le runtime ne lit jamais implicitement un template dans `perso` a la place de `render()`.

Si l'auteur veut utiliser un template stocke dans `perso`, il le fait explicitement:

```ts
render() {
  return this.perso.initial.template
}
```

## Formes autorisees du retour de `render()`

En V1, `render()` peut retourner uniquement:

1. une `string`
2. un `node`

Interpretation:

- `string` = template string auteur
- `node` = node deja construit, par exemple via `document.createElement("div")` ou un helper auteur externe

La V1 ne fige pas de contrat VDOM ou de forme objet intermediaire.

La V1 n'impose aucune fonction `h(...)` fournie par Codplay.

Si un auteur utilise une fonction externe de type `h(...)`, elle doit au final retourner un `node` pour rester compatible avec ce contrat V1.

## `init()`

`init()` est une methode auteur optionnelle.

`init()` ne remplace pas le constructeur.

`init()` est appelee apres `_createRootNode()`. C'est le moment ou l'auteur:

1. declare les services dont il a besoin via `this.services.declare([...])`
2. effectue toute mise en place personnalisee qui necessite que `node` existe (ex. branchement d'event listeners)

`init()` ne retourne rien.

## `_init()`

`_init()` est une methode interne du cycle de vie runtime.

`_init()` n'est pas une API auteur.

Son role:

1. appelle `render()`
2. si le retour est une `string`, la convertit en node (parsing DOM ou objet de substitution)
3. si le retour est deja un `node`, l'utilise directement
4. assigne le resultat a `this.node`
5. appelle `init()` si le composant l'implemente

`_init()` ne retourne rien.

## `buildNode()`

`buildNode(tagOrTemplate)` est une methode protegee de `BaseComponent`, disponible pour les auteurs dans `render()`.

Elle accepte deux formes:

### Forme tag

```ts
const rootNode = this.buildNode('div')
```

- reutilise `this.node` si deja present (cas refresh), sinon cree un nouveau node via la factory runtime
- remet le node a zero
- applique l'id depuis `this.perso.initial.id` ou `this.perso.id` en fallback

### Forme template

```ts
const rootNode = this.buildNode('<div><img data-part="media"/></div>')
```

- parse le template HTML
- remet le node a zero
- applique l'id sur le root
- enregistre automatiquement les elements descendants portant `data-part` comme parts internes du composant via `setPart()`
- supprime l'attribut `data-part` du DOM apres enregistrement

### Convention `data-part`

L'attribut `data-part` est la convention pour nommer les parts internes d'un composant dans un template.

Regles:

- `data-part` est temporaire: il est retire du DOM apres enregistrement
- `data-part` ne doit pas etre confondu avec l'attribut `id`, qui reste reserve aux ancres publiques stables (ex. outlets de `layout`)
- plusieurs elements peuvent porter `data-part` dans un meme template
- le nom de la part doit etre unique dans le composant
- une constante est recommandee pour eviter les doublons entre template et `getPart()`:

```ts
const MEDIA = 'media'

render(): ComponentRenderResult {
  const rootNode = this.buildNode(`<div><img data-part="${MEDIA}"/></div>`)
  this.services.apply(rootNode, this.perso.initial)
  this.applyMediaState(this.getPart(MEDIA), this.perso.initial)
  return rootNode as Node
}
```

La forme tag reste preferee pour les composants sans parts enfants (ex. `text`, `list`). La forme template est recommandee des qu'un composant a des parts internes nommees.

## `update()`

`update()` est la methode auteur pour appliquer un patch resolu sur le composant.

`update()` est responsable de:

1. consommer les services declares via `this.services.apply()` ou des appels individuels
2. appliquer les traitements specifiques au composant (methodes propres, orchestration)

L'auteur controle l'ordre d'application. Il n'y a pas de pipeline canonique imposee.

`update()` recoit le patch brut resolu. Les services ont ete declares dans `init()` et sont disponibles via `this.services`.

Il n'existe pas de `_update()`. La frontiere runtime autour de `update()` est assuree par l'orchestrateur (`tryUpdateComponent`).

## Separation des responsabilites

### Auteur

- lit `perso`
- decrit le rendu initial dans `render()`
- declare les services et effectue la mise en place dans `init()`
- applique les patches via services et traitements specifiques dans `update()`

### Runtime interne

- appelle `_init()`
- resout le resultat de `render()`
- assigne `node`
- gere les details de cycle de vie
- enveloppe `update()` dans une frontiere d'erreur (orchestrateur)

## Contrat type minimal

```ts
type ComponentRenderResult = string | Node

type ComponentServices = {
  declare: (names: string[]) => void
  apply: (node: unknown, patch: Record<string, unknown>) => void
  [name: string]: ServiceInstance | unknown
}

type RuntimeComponentClassInput = {
  perso: DeepReadonly<ItemDoc>
  services: ComponentServices
  runtime: Record<string, unknown>
  report: RuntimeReport
}

type RuntimeComponent = {
  node: unknown
  render: () => ComponentRenderResult
  init?: () => void
  _init: () => void
  update: (input: RuntimeComponentUpdateInput) => void
}
```

Note:

- `Node` dans ce contrat designe un node runtime deja construit
- la forme exacte du type `Node` reste a aligner avec les abstractions runtime existantes
- `ComponentServices` expose `declare()` et `apply()` comme surface principale; les services individuels sont accessibles par leur nom
- la structure exacte de `runtime` est specifiee dans d'autres specs

## Regles V1

- `render()` est obligatoire; elle retourne `string | Node`; elle n'utilise pas les services
- le runtime ne lit pas automatiquement un template dans `perso`
- `this.services.declare(names)` est appele dans le constructeur, apres `super(input)`; services disponibles des `render()`
- `init()` est une methode auteur optionnelle; c'est le lieu de la mise en place post-node (ex. branchement d'event listeners)
- `_init()` est interne; il appelle `render()`, resout le retour (`string | node`), assigne `this.node`, puis appelle `init()` si elle existe
- `update()` est responsable de la consommation des services et des traitements specifiques; l'auteur controle l'ordre
- il n'existe pas de `_update()`; la frontiere d'erreur autour de `update()` est assuree par l'orchestrateur
- l'ordre de declaration dans `declare()` est l'ordre d'execution dans `apply()`
- une variable de config peut proposer une liste de services par defaut
- un service absent au moment de la declaration d'un composant dans une scene est une erreur explicite

## Props d'element interne : `img` et `video`

Certains composants built-in exposent une prop de sous-ciblage qui transmet des valeurs directement a l'element enfant gere par le composant, et non au div wrapper racine.

### Composants concernes

| Composant | Type perso | Prop | Element cible |
|---|---|---|---|
| `ImageComponent` | `img` | `img` | `<img>` interne |
| `MediaComponent` | `media` | `video` | `<video>` interne |

La prop accepte les memes cles que toute action ordinaire : `style`, `className`, `attr`.

```ts
// Exemples
initial: {
  src: '/photo.jpg',
  img: {
    style: { objectFit: 'cover' },
    className: 'hero-photo'
  }
}

initial: {
  src: '/clip.mp4',
  video: {
    style: { objectFit: 'cover', display: 'block' }
  }
}
```

### Dimensions par defaut et specifite CSS

Les composants `ImageComponent` et `MediaComponent` injectent une feuille de style de base au premier rendu :

```css
/* ImageComponent */
:where(.cp-img-inner) { width: 100%; height: 100%; display: block; }

/* MediaComponent */
:where(.cp-video-inner) { width: 100%; height: 100%; }
```

La pseudo-classe `:where()` a une specificite de zero. Toute regle CSS auteur, quel que soit son selecteur, prend la priorite sur ces valeurs par defaut sans recourir a `!important`. Les styles inline appliques via `img.style` ou `video.style` ont la priorite maximale.

Tableau de priorite pour `width` sur l'element interne :

| Source | Specifite | Resultat |
|---|---|---|
| `:where(.cp-img-inner)` | 0 | valeur par defaut |
| `.ma-classe { width: 50px }` | 0,1,0 | ecrase le defaut |
| `img: { style: { width: '50px' } }` | inline | ecrase tout |

La classe de base (`cp-img-inner` / `cp-video-inner`) est toujours re-assuree en dernier lors de chaque cycle `render` et `update`. Si l'auteur fournit `img: { className: 'custom' }` (remplacement total), la classe de base est rajoutee apres. Pour ajouter une classe sans effacer les autres, utiliser la forme additive : `img: { className: { add: 'custom' } }`.

### Note sur fitMode

La propriete `fitMode` de `ImageComponent` (`'wallpaper'` / `'sprite'`) reste utilisable en V1 mais est consideree deprecated. Elle est un alias opaque de `object-fit: cover` et `object-fit: contain` respectivement. La forme directe est preferee :

```ts
// deprecated
initial: { src: '/img.jpg', fitMode: 'wallpaper' }

// prefere
initial: { src: '/img.jpg', img: { style: { objectFit: 'cover' } } }
```

Si `fitMode` et `img.style.objectFit` sont tous deux presents, `img.style.objectFit` prend la priorite car il est applique apres.

## References

- `formalisation/v1-registry-api.md`
- `formalisation/v1-module-api.md`
- `formalisation/runtime-component-class-design-notes.md`
