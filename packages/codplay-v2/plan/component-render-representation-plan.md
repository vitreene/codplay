# CodPlay V2 - representation de rendu des composants

## Statut

Status: En cours  
CodPlay version: V2 foundation  
Review: template-string materialization integrated; JSX remains V2.5

## Decision

Un composant V2 est ecrit par un auteur et possede une methode `render()`.
Pour un composant dont la structure est decrite par un arbre de vue, cette methode
retourne une representation de vue, pas un `Node` et pas une liste externe
d'outlets.

Un composant hybride specialise peut constituer directement le node support de sa
projection. Le cas `avatar3d` retourne ainsi un `HTMLCanvasElement` reel et possede
son contexte de rendu interne ; il ne decrit pas ce canvas par un `ViewTree`. Le
contrat de ce cas est precise dans la note dediee aux composants hybrides.

Pour la fondation V2 actuelle, la representation admise est le template string
converti par la `BaseComponent`. Le JSX autonome, transpile vers le runtime de vue
CodPlay sans React, est reporte a l'objectif V2.5. Une representation equivalente
fournie par un autre frontend d'auteur sera examinee apres ce jalon.

La `BaseComponent` convertit cette representation en arbre de vue interne. Le
backend de rendu materialise ensuite l'arbre et possede les mutations du substrat.

## De la representation au node

Les deux formes d'auteur convergent vers le meme format intermediaire : `ViewTree`.

### JSX autonome - objectif V2.5

Le JSX V2 est transpile vers une factory CodPlay, pas vers React :

```text
<polygon points={points} />
  -> jsxCreateElement('polygon', { points }, [])
  -> ViewNode {
       kind: 'element',
       namespace: 'svg',
       type: 'polygon',
       props: { points },
       children: []
     }
```

La factory ne cree pas encore de `SVGElement`. Elle cree une representation
serialisable ou comparable par le backend.

### Template string

Un template string suit la meme conversion :

```text
template(markup)
  -> parse/sanitize
  -> ViewTree
```

Le parser ne doit pas deleguer la source de verite a `innerHTML`. Il produit un
arbre inspectable, valide les balises/attributs autorises par le contrat du
composant et conserve les marqueurs structurels internes. Un parser SVG utilise
le namespace SVG au lieu de traiter `polygon` comme une balise HTML ordinaire.

### Materialisation initiale

Le `RenderBackend` recoit le `ViewTree` et un mount target logique :

```text
ViewNode(kind=element, namespace=svg, type=polygon)
  -> backend.createElementNS(SVG_NAMESPACE, 'polygon')
  -> backend.applyAttributes(points, fill, stroke)
  -> backend.attach(parentNode)
  -> registry[viewKey] = SVGElement
```

Pour un node HTML, le backend utilise `createElement`. Pour un node SVG, il
utilise `createElementNS`. Les text nodes, fragments et sous-arbres suivent la
meme materialisation recursive.

La conversion des parts pendant cette phase enregistre les cibles internes dans
le registre logique du composant. Elle ne construit pas une table auteur
`id + selector`.

## Mise a jour du node

Lorsque `SolvedPerso.state` change, le composant produit un nouveau `ViewTree`.
Le backend reconcilie l'ancien arbre avec le nouveau :

```text
old ViewTree + new ViewTree
  -> comparaison type/namespace/key
  -> reutilisation du node compatible
  -> creation des nodes ajoutes
  -> suppression des nodes retires
  -> patch des props/attributs/textes
  -> reconciliation de l'ordre des enfants
```

Les regles minimales sont :

- meme `viewKey`, type et namespace : node reutilise ;
- type ou namespace different : node remplace ;
- prop absente dans le nouvel arbre : attribut/propriete retire ;
- enfant present dans les deux arbres : reconciliation recursive ;
- changement d'ordre logique : `insertBefore` ou operation equivalente du backend ;
- node retire : detach et liberation de son entree de registre.

Le backend conserve une table `viewKey -> node` par instance de composant. Cette
table est un cache de projection, jamais la source de verite de l'etat.

## Mutation des proprietes

Le composant peut muter directement son node racine pendant `update()`. Les
services fournissent les operations de projection adaptees au substrat :

```text
style value      -> DomStyleBackend.apply(node, value)
className value  -> DomClassBackend.apply(node, value)
attr value       -> DomAttributeBackend.apply(node, value)
```

Le composant ne connait pas `style.setProperty`, `classList` ou
`setAttribute`. Ces operations appartiennent aux adapters du substrat.

## Reparenting et FLIP

La reconciliation interne d'un composant ne decide pas seule d'un changement de
parent logique. `MoveStateDelta` et la capacite list produisent une demande de
projection. Le backend DOM peut alors :

1. capturer les nodes concernes ;
2. appliquer le reparenting et l'ordre ;
3. reconcilier les `ViewTree` ;
4. mesurer le nouvel emplacement ;
5. appliquer FLIP.

Au seek, les memes operations de creation/reconciliation sont effectuees sans
capture FLIP ni animation.

## Exemple layout

L'auteur peut ecrire un layout dont la propriete `markup` fournit la representation
HTML necessaire :

```ts
class LayoutComponent extends BaseComponent {
  render() {
    return this.template(this.state.markup)
  }
}
```

Le template peut contenir ses marqueurs structurels internes :

```html
<section class="shell">
  <main data-part="content"></main>
</section>
```

La conversion de `BaseComponent` :

- cree l'arbre de vue HTML ;
- valide ou assainit la representation selon le contrat du composant ;
- decouvre les parts/outlets presents dans l'arbre ;
- enregistre leurs cibles internes avec leurs IDs opaques ;
- ne demande pas a l'auteur de fournir un tableau `id + selector`.

Le selector n'est donc pas un contrat auteur separe. Si le backend DOM utilise un
selector interne pendant la conversion, il reste une detail d'implementation de
la representation et de la base de composant.

## Exemple SVG polygon

Un composant SVG peut declarer sa representation en JSX autonome :

```tsx
class SvgPolygonComponent extends BaseComponent {
  render() {
    return (
      <polygon
        points={this.state.points}
        fill={this.state.fill}
        stroke={this.state.stroke}
      />
    )
  }
}
```

La definition du composant porte le namespace SVG necessaire a la conversion.
Le JSX ne depend pas de React et ne fabrique pas directement un `SVGElement`.
La `BaseComponent` produit un arbre de vue SVG ; le backend SVG/DOM cree ou
reutilise ensuite le node `<polygon>` et applique ses attributs.

## Mutation du node

La chaine de mutation est :

```text
SolvedPerso.state
  -> Component.render()
  -> BaseComponent conversion
  -> ViewTree
  -> RenderBackend
  -> node DOM/SVG/canvas
```

Le composant peut appliquer les changements a son propre node par les services ou
par l'API de son substrat. Il ne decide pas le parentage des nodes, ne mute pas les
nodes d'un autre composant et ne reconstruit pas l'etat logique depuis le DOM.
Les services `style`, `className` et `attr` restent les operations de projection
standard du composant.

Le node reste une cible de projection :

```text
PersoState(t) -> Component.update(node, state, t) -> node
```

La projection ne doit pas lire le node pour reconstruire `PersoState(t)` ni
dependre d'une accumulation de mutations precedentes.

## Move et FLIP

`move` cible une cible logique opaque produite par le registre interne. La
representation du composant peut produire des parts/outlets internes, mais le
composant ne decide pas la politique de parentage.

La capacite list calcule l'ensemble affecte. Le backend DOM FLIP mesure et anime
ensuite cet ensemble selon `flip-list-coordination-plan.md`.

## Seek

Au seek, la representation est convertie directement vers l'etat cible. Le backend
nettoie ses transitions et projette l'arbre sans rejouer une animation FLIP.

## Composant hybride et substrat interne

Le cas d'un composant specialise comme `avatar3d` est precise dans
[`2026-08-01-composants-hybrides-threejs-v2.md`](./notes/2026-08-01-composants-hybrides-threejs-v2.md).
Son `ViewTree` decrit l'hote DOM, par exemple un `canvas`. Le backend DOM materialise
et monte cet hote ; le composant possede ensuite directement son substrat interne,
par exemple `WebGLRenderer`, `THREE.Scene` et `THREE.Camera`.

La regle de writer unique est appliquee par couche : le backend ecrit l'hote DOM,
le composant ecrit sa scene Three.js privee. Le `ViewTree` ne decrit pas les objets
internes Three.js et le coeur CodPlay ne les manipule pas.

## Hors contrat actuel

- JSX runtime V2 ;
- template sanitizer V2 ;
- `BaseComponent` executable ;
- `ViewTree` final ;
- backend DOM/SVG de production ;
- contrat final de parts/outlets decouverts pendant conversion.
