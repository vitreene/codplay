# Layout spec V1 - contrat normalise

## Statut

Spec normative V1 pour le composant `layout` dans Codplay.

## Objectif

Figer une base unique pour:

- la composition d'un cadre statique `html` ou `svg`
- la designation declarative de points d'insertion `outlets`
- l'insertion de persos dynamiques dans ces `outlets`
- la distinction entre structure statique du `markup` et placement runtime par `move`

## Contrat canonique

```ts
type LayoutFormat = 'html' | 'svg'

type LayoutOutletDoc = {
  id: string
}

type LayoutInitial = {
  markup: string
  format?: LayoutFormat
  outlets: LayoutOutletDoc[]
  className?: string
  style?: Record<string, unknown>
  attr?: Record<string, unknown>
  move?: MoveValue
}

type LayoutAction = ActionDoc
```

Extension du registre auteur:

```ts
type PersoTypeRegistry = {
  layout: { initial: LayoutInitial; action: LayoutAction }
}
```

## Regles normatives

1. Nature du composant

- `layout` est un `Perso` de composition.
- `layout` interprete un `markup` statique et y expose des points d'insertion nommes.
- `layout` ne genere pas un tag parent a partir d'une prop `tag`.
- le root runtime du `layout` est derive du `markup` parse.

2. Format

- `layout.initial.format` accepte `html` ou `svg`.
- si `format` est absent, sa valeur par defaut est `html`.
- le runtime parse `markup` selon `format`.

3. Root effectif

- si `markup` produit un seul noeud top-level, ce noeud devient le root runtime du `layout`.
- si `markup` produit plusieurs noeuds top-level, le runtime cree automatiquement une `div` englobante.
- cette `div` englobante devient le root runtime du `layout`.
- le root runtime effectif recoit les actions appliquees au perso `layout`.

4. Markup

- `markup` decrit uniquement une structure statique `html` ou `svg`.
- `markup` peut contenir des ids arbitraires utilises comme `outlets`.
- `markup` ne declare pas de logique runtime par attribut specialise du type `data-slot`.
- `markup` ne sert pas a injecter une valeur dans `style`, `class`, `attr` ou toute autre portion d'attribut.

5. Outlets

- `outlets` est la declaration canonique des points d'insertion du composant.
- chaque `outlet.id` designe un noeud present dans `markup`.
- les ids d'`outlet` sont des identifiants declaratifs auteur; leur forme textuelle releve d'une convention auteur et non d'une contrainte normative du runtime.
- un `outlet` est une cible de noeud, jamais une cible d'attribut.
- un `outlet` vide conserve son noeud hote dans le rendu.
- un `outlet` est declare par le perso `layout` lui-meme via `layout.initial.outlets`.
- un `outlet` est employe ensuite par d'autres persos via `initial.move.parentId`.
- un `outlet` ne designe pas un perso; il designe un noeud d'insertion du rendu du `layout`.

6. Placement runtime

- un perso dynamique vise un `outlet` via `move.parentId`.
- `move.parentId` peut donc referencer soit un container runtime existant (`list`, etc.), soit un `outlet` de `layout`.
- plusieurs persos peuvent etre inseres dans un meme `outlet` selon les regles normales d'ordre de placement runtime.
- tout type de composant peut etre insere dans un `outlet`, dans les limites du contexte `html` ou `svg`.
- un `outlet` est donc relie aux persos consommateurs par la cle `move.parentId`.

7. Compatibilite `html` / `svg`

- un `layout` en `html` accepte des composants dont le root runtime est compatible avec un arbre HTML.
- un `layout` en `svg` accepte des composants dont le root runtime est compatible avec un arbre SVG.
- une insertion incompatible entre contexte `html` / `svg` doit etre rejetee a l'initialisation de scene.

8. Actions

- les actions du perso `layout` s'appliquent au root runtime effectif du composant.
- cette regle vaut aussi quand le root effectif est la `div` auto-generee.
- un `outlet` n'est pas une cible d'action en V1.
- en V1, `outlet` n'est cible que par `move.parentId`.

9. Etat interne runtime

- `layout` maintient un etat interne runtime pour memoriser ses `outlets` et leurs assignations courantes.
- cet etat interne ne fait pas partie de `story.state` ni de `scene.state`.
- cet etat interne sert uniquement a la mecanique de placement, reconstruction et detachement runtime.

10. Validation a `scene.init`

- les regles de `layout` sont verifiees a `scene.init`, pas pendant la lecture normale.
- chaque `outlet.id` declare dans `outlets` doit exister dans le `markup` parse.
- l'unicite des `outlet.id` d'un meme `layout` est obligatoire.
- une collision entre un `outlet.id` et un autre identifiant runtime visible de la scene doit etre rejetee.
- toute insertion vers un `move.parentId` qui vise un `outlet` inconnu doit etre rejetee a `scene.init`.
- toute incompatibilite `html` / `svg` detectee statiquement doit etre rejetee a `scene.init`.

11. Limites V1

- V1 ne definit aucune ecriture dans des attributs via `layout`.
- V1 ne definit aucun mecanisme d'insertion dans une sous-portion de texte brut.
- V1 ne definit pas de ciblage d'un `outlet` par `ref` ou par action.

## Exemple auteur minimal

```ts
{
  id: 'scene-layout',
  type: 'layout',
  initial: {
    format: 'html',
    markup: `
      <div class="scene-grid">
        <div id="scene-layout:decor"></div>
        <div id="scene-layout:intro"></div>
        <div id="scene-layout:question"></div>
        <div id="scene-layout:count"></div>
      </div>
    `,
    outlets: [
      { id: 'scene-layout:decor' },
      { id: 'scene-layout:intro' },
      { id: 'scene-layout:question' },
      { id: 'scene-layout:count' }
    ]
  },
  actions: {
    'scene-layout': null
  }
}
```

Exemple d'insertion:

```ts
{
  id: 'quiz-intro-panel',
  type: 'list',
  initial: {
    move: {
      parentId: 'scene-layout:intro',
      mode: 'append'
    }
  },
  actions: {
    'quiz-intro-panel': null
  }
}
```

## Exemple multi-root

```ts
markup: `
  <header id="card-layout:header"></header>
  <section id="card-layout:body"></section>
`
```

- le runtime cree automatiquement une `div` englobante.
- cette `div` devient le root runtime du `layout`.
- `header` et `section` restent disponibles comme `outlets` si declares.

## Evolution possible post-V1

- une `scene` pourra plus tard declarer un `layout` hote general.
- dans cette evolution, les stories root pourront etre routees vers ce `layout` au lieu d'etre montees directement dans le conteneur de scene.
- cette possibilite ne fait pas partie du comportement V1 obligatoire.
