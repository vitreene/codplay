# CodPlay V2 - materializer des composants

## Statut

Status: En cours  
CodPlay version: V2 foundation  
Review: interface RuntimeMaterializer unifiée et tranche HTML relues le 2026-08-20

## Contrat auteur

Le contrat de `BaseComponent.render()` est deja fixe dans
[`2026-08-01-composant-v2-contract.md`](./notes/2026-08-01-composant-v2-contract.md).
Ce plan ne le redéfinit pas et n'ouvre aucune décision sur le rôle de `render()`.

Le présent plan traite uniquement de la frontière située après le composant : la
prise en charge de son résultat par le `Materializer`. Le composant auteur ne
parse pas son résultat, ne crée pas les ressources du substrat et ne porte pas la
décomposition technique de celles-ci.

## Frontiere Materializer

`BaseComponent` est la couche auteur en entree du rendu. Il expose une
méthode `render()` et recoit les etats resolus; il cible uniquement le
`Materializer`, jamais le DOM, Canvas ou Three.js directement.

Le `Materializer` est l'interface de rendu vers un substrat. Une implementation
DOM, Canvas ou Three.js recoit le resultat de `render()` et les mises a jour du
composant, cree ou met a jour ses ressources, publie ses handles et assure leur
destruction. Le composant ne connait pas l'implementation choisie.

`HtmlComponentMaterializer` est l'implementation HTML actuelle de cette frontiere.
Elle expose à la fois la materialisation d'un composant et la materialisation
structurelle d'une scène ; aucune interface structurelle distincte ou catalogue
local parallèle n'est utilisé. Les services sont choisis par la definition du composant dans
`RuntimeCapabilityCatalog`; le materializer ne construit pas de catalogue local.

## Du template au substrat

La fondation V2 suit cette chaine, sans redefinir le contrat de `render()` :

```text
BaseComponent.render() -> template string -> Materializer HTML -> DOM
```

Le composant fournit son resultat au materializer. Il ne le parse pas, ne le compare
pas avec une version precedente et ne cree pas les nodes.

### Template string

Le template string est recu par le materializer HTML :

```text
BaseComponent.render()
  -> HtmlComponentMaterializer
  -> lecture, assainissement et normalisation
  -> creation du DOM et des handles internes
```

La politique de lecture et d'assainissement appartient au materializer et a ses
services. Elle valide les balises et attributs autorises, conserve les marqueurs
structurels internes et traite le namespace SVG correctement lorsqu'une
implementation SVG sera ouverte.

### Materialisation initiale

Le `Materializer` recoit le template, la cible de montage et les services necessaires :

```text
template string + mount target
  -> materializer.readAndSanitize(template)
  -> materializer.createResources()
  -> materializer.attach()
  -> handles internes du composant
```

Les appels DOM, Canvas ou Three.js sont internes a l'implementation du materializer.
Le composant ne connait ni `createElement`, ni `createElementNS`, ni la structure
des ressources produites.

## Mise a jour du rendu

Lorsque `SolvedPerso.state` change, le runtime appelle le composant puis transmet
son resultat au materializer :

```text
SolvedPerso.state
  -> Component.update(state, time)
  -> services et materializer
  -> substrat mis a jour
```

La fondation V2 ne fixe pas de reconciliation generique de markup dynamique.
Le materializer conserve les ressources qu'il a creees et applique les mises a
jour autorisees par le contrat du composant. Les regles de remplacement, de
destruction et de remise en ordre sont propres au materializer concerne.

Le composant ne reconstruit jamais son etat logique a partir du substrat.

## Application des proprietes

Pendant `update()`, le composant fournit l'etat resolu aux services du
materializer. Ces services fournissent les operations d'application adaptees au
substrat :

```text
style value      -> materializer.style.apply(node, value)
className value  -> materializer.className.apply(node, value)
attr value       -> materializer.attr.apply(node, value)
```

Le composant ne connait pas les APIs natives du substrat (`style.setProperty`,
`classList`, `setAttribute`, etc.). Ces operations appartiennent au materializer
et a ses services de substrat.

## Reparenting et FLIP

Le composant ne decide pas d'un changement de parent logique. `MoveStateDelta` et
la capacite list produisent une demande de placement. Le materializer DOM peut
alors :

1. obtenir les handles concernes ;
2. appliquer le reparenting et l'ordre ;
3. mettre a jour les ressources materialisees ;
4. mesurer le nouvel emplacement ;
5. appliquer FLIP.

Au seek, les memes operations de materialisation sont effectuees sans capture
FLIP ni animation.

## Exemple layout

L'auteur peut ecrire un layout dont la propriete `markup` fournit la representation
HTML necessaire :

```ts
class LayoutComponent extends BaseComponent {
  render() {
    return this.perso.initial.markup
  }
}
```

Le template peut contenir ses marqueurs structurels internes :

```html
<section class="shell">
  <main data-part="content"></main>
</section>
```

Le materializer HTML :

- lit, valide et assainit le template selon le contrat du composant ;
- decouvre les parts/outlets presents dans le template ;
- enregistre leurs handles internes avec leurs IDs opaques ;
- ne demande pas a l'auteur de fournir un tableau `id + selector`.

Le selector n'est donc pas un contrat auteur separe. Si le materializer DOM utilise
un selector interne, il reste un detail d'implementation du materializer.

## Chaine de rendu et de mutation

La chaine de mutation est :

```text
SolvedPerso.state
  -> Component.update(state, time)
  -> Materializer
  -> substrat DOM/SVG/Canvas/Three.js
```

Le composant peut declarer ou demander les changements d'etat prevus par ses
services. Il ne decide pas le parentage, ne mute pas les ressources d'un autre
composant et ne reconstruit pas l'etat logique depuis le substrat.
Les services `style`, `className` et `attr` restent les operations d'application
standard du composant.

Le handle de materialisation reste une cible d'application :

`PersoState(t) -> Component.update(state, t) -> Materializer -> substrat`

La materialisation ne doit pas lire le substrat pour reconstruire `PersoState(t)`
ni dependre d'une accumulation de mutations precedentes.

## Move et FLIP

`move` cible une cible logique opaque produite par le registre interne. La
materialisation peut publier des parts/outlets internes, mais le composant ne
decide pas la politique de parentage.

La capacite list calcule l'ensemble affecte. Le materializer DOM fournit les
handles que FLIP mesure et anime ensuite selon `flip-list-coordination-plan.md`.

## Seek

Au seek, le resultat de `render()` est materialise directement vers l'etat cible. Le materializer
nettoie ses transitions et materialise l'etat cible sans rejouer une animation FLIP.

## Composant hybride et substrat interne

Le cas d'un composant specialise comme `avatar3d` est precise dans
[`2026-08-01-composants-hybrides-threejs-v2.md`](./notes/2026-08-01-composants-hybrides-threejs-v2.md).
Son rendu auteur fournit l'hote DOM, par exemple un template contenant un `canvas`.
Le materializer DOM materialise et monte cet hote ; le composant possede ensuite
directement son substrat interne, par exemple `WebGLRenderer`, `THREE.Scene` et
`THREE.Camera`.

La regle de writer unique est appliquee par couche : le materializer ecrit l'hote DOM,
le composant ecrit sa scene Three.js privee. Le coeur CodPlay ne decompose ni ne
manipule les objets internes Three.js.

## Dialogue Materializer / FLIP — contrat HTML runner

Le dialogue est maintenant fixe pour la verticale HTML. Il ne passe pas par un
échange direct entre le composant et FLIP :

```text
SolvedScene
  -> RuntimeComponentRuntime.sync()
  -> RuntimeMaterializer HTML
       -> racines, parts, parentage et ordre des racines
  -> HtmlMotionPresentationHost
       -> présentation locale ou représentation overlay
```

### Responsabilités

Le `RuntimePlayer` synchronise les composants une fois avant l'appel au
materializer. Le `HtmlComponentMaterializer` :

- appelle `component.render()` et materialise son résultat ;
- conserve une racine par composant dans le registre interne des persos ;
- publie uniquement les parts autorisées par la définition runtime du composant ;
- détruit la racine et désenregistre ses parts lors du retrait.

La même instance applique aussi le parentage et l'ordre produits par `SolvedScene`.
Elle ne reconstruit ni l'état du composant ni la structure depuis le DOM. Pour la
présentation motion, `MotionMaterializer` décore cette interface et délègue la
materialisation HTML avant d'appeler le résolveur de frame ; il ne constitue pas
un second circuit de composants ou de structure.

Le `HtmlMotionPresentationHost` reçoit seulement un résolveur
`itemId -> HTMLElement` et une `PresentationFrame`. Il :

- écrit les dimensions et matrices transitoires sur la racine réelle en mode local ;
- clone la materialisation courante dans l'overlay en mode reparent ;
- masque la source pendant la représentation overlay ;
- retire les contributions transitoires et détruit les clones lorsque la frame ne
  les demande plus.

FLIP ne demande donc pas au composant de se rerendre et n'appelle aucun service
auteur. Les services du composant ont déjà appliqué l'état courant avant la mesure
ou la création d'un clone. La couche transitoire conserve les propriétés auteur et
les restaure à sa destruction.

### Ordre d'une frame

Pour Play, Seek et `resize()`, l'ordre est le même :

1. résoudre l'état logique à `t` ;
2. synchroniser les composants et leurs services ;
3. appliquer le parentage et l'ordre structurels ;
4. mesurer ou réutiliser la géométrie isolée ;
5. résoudre la `PresentationFrame` à `t` ;
6. committer la présentation locale ou overlay.

Au seek, l'étape de présentation transitoire est committée directement à `t` sans
animation ni rejeu d'une transition passée. À `LAST`, les slots et ressources
transitoires sont retirés ; la materialisation auteur reste la seule représentation.

Ce contrat est limité au materializer HTML et aux moves compilés. Il ne fixe pas
encore une interface générique pour SVG, Canvas ou Three.js, ni le runtime JSX.

## Hors contrat actuel

- JSX runtime V2 ;
- profils complets de sanitizer SVG/CSS et politiques de ressources ;
- `BaseComponent` executable ;
- implementations de production pour SVG, Canvas ou Three.js ;
- contrat final de parts/outlets publies par le materializer.
