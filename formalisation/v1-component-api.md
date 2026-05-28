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
3. `update()`

Les autres methodes specifiques du composant restent privees.

## Constructeur

Le constructeur recoit le `perso` complet en lecture seule, ainsi que les dependances runtime injectees.

Le `perso` n'est pas fragmente en sous-ensembles pour l'auteur.

Principe:

- l'auteur peut lire l'integralite du `perso`
- le `perso` reste stable et readonly
- le constructeur ne construit pas lui-meme le node root

## `ComponentServices`

`services` est une map ouverte injectee au composant.

`services` ne constitue pas une liste fermee en V1.

Les cles de `services` doivent correspondre a des familles de proprietes auteur exposees par les persos.

Exemples de cles canoniques V1:

- `className`
- `style`
- `attr`
- `content`

Regles:

- un composant consomme directement les services dont il a besoin
- un composant ne declare pas lui-meme ses services via une liste ou une map de declaration supplementaire
- le typecheck cote auteur vient du type du composant lui-meme
- l'absence d'un service attendu est une erreur runtime explicite

La creation d'un composant etant controlee pendant la lecture et l'instanciation d'une scene, l'injection de `services` peut etre validee a ce moment-la.

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

`init()` est une methode interne du cycle de vie runtime.

`init()` n'est pas le point d'entree auteur principal.

`init()` peut faire plusieurs operations internes, mais il appelle notamment `createRootNode()`.

`init()` ne retourne rien.

## `createRootNode()`

`createRootNode()` est une methode interne.

Son role est:

1. appeler `render()`
2. resoudre la forme retournee
3. creer ou recuperer le node root runtime
4. assigner ce node a `rootNode`

`createRootNode()` ne fait pas partie de l'API auteur.

Le runtime ne cascade pas des methodes one-line inutiles: `init()` appelle `createRootNode()` sans se contenter d'un `return` direct de cette methode.

## Separation des responsabilites

### Auteur

- lit `perso`
- decrit le rendu initial dans `render()`
- ajoute sa logique de patch dans `update()`

### Runtime interne

- appelle `init()`
- resolve le resultat de `render()`
- assigne `rootNode`
- gere les details de cycle de vie

## Contrat type minimal

```ts
type ComponentRenderResult = string | Node

type RuntimeComponentClassInput = {
  perso: DeepReadonly<ItemDoc>
  services: ComponentServices
  runtime: Record<string, unknown>
  report: RuntimeReport
}

type RuntimeComponent = {
  init: () => void
  render: () => ComponentRenderResult
  update: (input: RuntimeComponentUpdateInput) => void
}
```

Note:

- `Node` dans ce contrat designe un node runtime deja construit
- la forme exacte du type `Node` reste a aligner avec les abstractions runtime existantes
- `services` est une map ouverte; cette spec n'en fige pas une liste exhaustive
- la structure exacte de `runtime` est specifiee dans d'autres specs

## Regles V1

- `render()` reste obligatoire dans tous les cas
- `render()` ne retourne ni tableau, ni valeur arbitraire opaque hors `string` ou `node`
- le runtime ne lit pas automatiquement un template dans `perso`
- `init()` est interne et ne remplace pas le constructeur auteur
- `createRootNode()` est interne et non exposee a l'auteur
- `services` est injecte au moment de la creation du composant
- l'absence d'un service attendu par le composant est une erreur runtime

## References

- `formalisation/v1-registry-api.md`
- `formalisation/v1-module-api.md`
- `formalisation/runtime-component-class-design-notes.md`
