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
composant, cree ou met a jour ses ressources et conserve les references necessaires
vers le substrat. Le cycle de vie runtime declenche ensuite leur retrait ; le
materializer execute le nettoyage prevu par ce cycle. Le composant ne connait pas
l'implementation choisie.

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
  -> creation du DOM et conservation des references vers les nœuds internes
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
  -> references internes vers les nœuds désignés
```

Les appels DOM, Canvas ou Three.js sont internes a l'implementation du materializer.
Le composant ne connait ni `createElement`, ni `createElementNS`, ni la structure
des ressources produites.

Le materializer ne preclasse pas les proprietes SVG. Une propriete SVG generique
est partagee uniquement lorsqu'un service existant la couvre ; une propriete ou
une operation specialisee est introduite avec le composant qui en a besoin, son
service, sa validation et sa destination de materialisation. Aucun inventaire
global des proprietes SVG n'est donc requis pour ouvrir l'interface materializer.

Un resultat comportant plusieurs noeuds forme un fragment : le materializer
conserve les noeuds reels dans leur ordre et ne genere aucun element enveloppe.
Le fragment n'est pas une cible de service. Les services s'appliquent uniquement
aux noeuds reels designes par le composant. Pour `list`, l'appartenance et l'ordre
sont traites par la structure resolue. Pour `layout`, les parts/outlets designes
sont les seules cibles dynamiques ; les autres noeuds du template restent
statiques et ne recoivent pas de mise a jour.

## Persistance des materialisations auteur

La materialisation d'un perso est persistante pendant toute la duree de vie de
la sequence/player. Une fois ses elements et ses ressources materialises, leur
identite est conservee qu'ils soient montes ou non dans le DOM.

- un `unmount`, un detach ou un changement de target modifie uniquement le
  parentage et l'ordre structurels ; il ne detruit pas la materialisation auteur ;
- un seek conserve les memes instances de composant et les memes elements ; il
  applique l'etat cible, le parentage et l'ordre sans rerendre ni recreer les
  elements deja materialises ;
- le `RuntimeComponentHandle.destroy()` n'est appele qu'au teardown final de la
  sequence/player, jamais pour rendre un perso absent ou non monte a un instant
  donne ;
- la destruction finale libere les ressources auteur, y compris les ressources
  media, et retire les references et les elements conserves ;
- les clones d'overlay FLIP et le DOM de mesure sont des ressources techniques
  temporaires distinctes des materialisations auteur.

Cette persistance est notamment requise pour les composants media : un seek ou un
detachement ne doit pas recreer l'element ni recharger sa source.

Cette regle reprend la decision V1 documentee dans
[`2026-06-25-image-node-per-src-plan.md`](../../../docs/plans/2026-06-25-image-node-per-src-plan.md) :
les nodes media sont conservees, detachees et rattachees selon l'etat cible ; la
source n'est assignee qu'a la creation de la node correspondante. Les tests V1
[`seek-media-src.spec.ts`](../../codplay/tests/v1/seek-media-src.spec.ts) et
[`seek-no-detach.spec.ts`](../../codplay/tests/v1/seek-no-detach.spec.ts) couvrent
respectivement la conservation par source et l'absence de churn DOM au seek.

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

Dans la tranche HTML, ces references sont des references vers les nœuds DOM reels.
La racine sert au parentage et a l'ordre ; les parts/outlets publies servent aux
cibles de placement ; une presentation FLIP reçoit l'`HTMLElement` reel de la
cible qu'elle anime. Ce ne sont ni une structure de rendu abstraite ni une API
publique du composant. La destruction n'est pas une reference supplementaire :
elle relève du cycle de vie du runtime et du nettoyage du materializer.

## Reparenting et FLIP

Le composant ne decide pas d'un changement de parent logique. `MoveStateDelta` et
la capacite list produisent une demande de placement. Le materializer DOM peut
alors :

1. retrouver les nœuds reels concernes ;
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
- enregistre les references vers ces nœuds avec leurs IDs opaques ;
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

La reference de materialisation reste une cible d'application :

`PersoState(t) -> Component.update(state, t) -> Materializer -> substrat`

La materialisation ne doit pas lire le substrat pour reconstruire `PersoState(t)`
ni dependre d'une accumulation de mutations precedentes.

## Move et FLIP

`move` cible une cible logique opaque produite par le registre interne. La
materialisation peut publier des parts/outlets internes, mais le composant ne
decide pas la politique de parentage.

La capacite list calcule l'ensemble affecte. Le materializer DOM fournit les
nœuds HTML reels que FLIP mesure et anime ensuite selon
`flip-list-coordination-plan.md`.

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

### Media et ressources internes V1

Le composant `media` suit la même séparation qu'un composant spécialisé V1 : sa
racine wrapper est fournie par `render()` et montée par le Materializer, tandis
que les nodes vidéo internes restent privées au composant. Le composant conserve
une node par `src`, assigne la source à sa création puis ne fait que détacher ou
rattacher la node active. Ces nodes ne sont ni des persos ni des outlets de
montage.

La tranche V2 actuelle vérifie cette persistance et le changement de source. Elle
n'ouvre pas encore `media-sync`, le preload partagé ou le pilotage de lecture.

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
- conserve le noeud reel unique ou les noeuds reels du fragment dans le registre
  interne des persos ;
- n'ajoute aucun element d'enveloppement pour representer un fragment ;
- publie uniquement les parts autorisées par la définition runtime du composant ;
- detache les noeuds reels lors d'un retrait structurel et conserve leurs
  references jusqu'au teardown final.

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
