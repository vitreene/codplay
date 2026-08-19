# HTML runner V2

Status: En cours
CodPlay version: V2 foundation

## Role

Le runner est la frontière HTML générique entre un `CompiledScene`, un
`RuntimePlayer` et un root DOM. Il ne contient aucune règle propre à une démo.

Le flux couvert par cette tranche est:

```text
CompiledScene
  -> HtmlPlayerRunner
  -> RuntimePlayer
  -> RuntimeComponentRuntime
  -> HtmlComponentMaterializer
  -> LayoutDomBackend
  -> MoveFlipLayoutProjection
  -> HtmlDomProjection
  -> DOM
```

## Contract

`HtmlPlayerRunner` reçoit:

- un `CompiledScene` déjà construit et validé;
- un root HTML;
- une liste explicite de `rootTargets` associant un ID opaque à un `storyId`;
- un catalogue de composants et un catalogue de services DOM;
- éventuellement un `RuntimeEngine` et un `RuntimeModuleServiceCatalog` externes.

Les `rootTargets` sont obligatoires pour rendre `@root` matérialisable. Les
outlets sont publiés par le module `markup` lorsqu'un composant expose les parts
choisies par sa définition runtime. Le runner ne déduit jamais un target depuis
le nom d'un élément ou depuis le DOM.

Lors de l'initialisation, le host matérialise d'abord les composants afin que le
module `markup` publie les outlets, puis les modules player-scoped prennent leur
snapshot initial. Une capacité `list` peut ainsi conserver l'ordre initial de
ses enfants même lorsque la liste est imbriquée dans un outlet HTML.

`play()` démarre le ticker uniquement lorsque le runner possède son engine.
`advance(nowMs)` reste l'entrée déterministe pour les tests et les hosts qui
possèdent leur horloge. `seek(t)` reconstruit l'état logique sans rejouer les
straps. `resize()` incrémente l'epoch exposé pour la tranche visuelle future.

Dans cette tranche, les services DOM projettent les canaux auteur `style.x` et
`style.y` en une translation CSS composée. La résolution ACE fournit les valeurs
interpolées; le runner ne lit pas la position calculée du navigateur.

Un `move` explicite avec une transition positive active actuellement une capture
FLIP du perso déplacé, des siblings montés des targets before/after et de leurs
chaînes de composants ancêtres résolues. Le `flipMode` auteur est conservé : le
mover direct d'un groupe `overlay-world` est projeté dans l'espace monde; aucun
ancêtre n'est ajouté comme entry animée implicite. Une chaîne d'ancêtres reste
un contexte de coordonnées pour les items locaux. Un conteneur n'acquiert
l'ownership FLIP que par sa propre capture directe.
Le host peut fournir `resolveFlipAncestorRegime` pour déclarer un ancêtre
`stable`, `composited` ou `layout`; le premier ancêtre `layout` d'une chaîne ouvre
la coupe de reflow et ses descendants sont réalisés historiquement.
Un mover dont la chaîne de parents change entre FIRST et LAST n'utilise pas la
chaîne de destination pour sa pose FIRST : sa pose est interpolée dans le repère
monde, tandis que les siblings restés dans la même chaîne conservent leur repère
local.
Les moves compilés à durée positive sont indexés par un journal d'occurrences. Le
runner réalise toute capture manquante depuis les scènes historiques explicites,
dans `HtmlPresentationTransaction`, enregistre un `HtmlMeasurementTree` immutable
et réutilise `seekCached()` pour Play, Seek et les frames suivants. Il n'existe pas
de capture live parallèle dans le runner. La cache canonicalise les identités
primaires et aliases:
une capture groupée remplace les captures unitaires correspondantes et le runtime
conserve le même ownership de ghost pendant ce remplacement.
la présentation historique restaure la scène courante dans un `finally` avant la
projection au temps demandé. Les templates FIRST des overlays world sont stockés
à côté de la capture numérique et réutilisés lors d'une réactivation. Les ancêtres `layout` déclenchent une suspension
temporaire des poses transitoires avant leur présentation historique, puis sont
réinjectés dans le même commit. Les événements live restent hors de cette tranche.
À chaque commit, `HtmlFlipOverlayContentState` reconstruit toutefois le contenu
courant des ghosts parents depuis la scène présentée; le template FIRST ne sert
pas de snapshot permanent de leur liste.
Les entries world conservent aussi la table `overlayTargetByPerso` des descendants
présents dans leur template FIRST: une transition enfant masque et restaure un
clone parent uniquement selon ses targets source/LAST, jamais par `itemId` global.
Après résolution d'un commit, l'ownership actif est toutefois réaffirmé pour
chaque item encore porté par un ghost `capture` ou `handoff`: tous ses clones
parents sont masqués, sans dépendre du target historique de l'alias regroupé.
Le filtrage source/LAST reste la règle de restauration au moment de la libération.
Voir `plan/runner-flip-integration-study.md`.

Quand le module `list` est présent, son snapshot d'ordre et de touched set est
consommé par le player avant la projection DOM. L'ordre est vérifié contre la
révision et le graphe de la scène; un module ne peut pas fusionner silencieusement
un item dans un autre target. La réalisation historique d'un reorder recrée des
instances temporaires et rejoue les frontières d'événements compilées depuis
`t=0`, sans modifier l'état du player courant.

Le touched set reste event-local, mais il peut contenir un item dont une autre
occurrence de move est encore active. Le resolver de captures retire alors cet
item du nouveau groupe, sauf si c'est le mover direct de l'occurrence courante.
L'ancien capture conserve ainsi son ownership et sa trajectoire; le nouveau
capture ne mesure que son mover et les siblings réellement disponibles pour le
reflow. Cette règle évite qu'un échange concurrent remplace FIRST d'un item par
son état logique courant et interrompe son animation à mi-parcours.

Les captures concurrentes sont présentées parent avant enfant. Une capture
descendante peut utiliser la pose courante de son parent pour mesurer ses bornes,
mais elle ne remplace ni n'annule sa trajectoire. La fenêtre active du wrapper
reste ouverte jusqu'à la fin de la capture la plus longue restante.
Pour une nouvelle capture, les lectures FIRST et LAST présentent les captures
déjà actives aux phases absolues respectives de la capture : `startAt` pour
FIRST, puis `startAt + duration` pour LAST, de part et d'autre de la mutation
structurelle. La durée de l'enfant doit donc faire avancer la pose du parent
pendant la lecture de sa cible LAST, sans modifier l'ownership de ce parent.
Lorsqu'un ancien overlay direct de l'enfant reste actif pendant ce reparentage,
la mesure consulte d'abord l'overlay du parent trouvé dans l'ascendance DOM
courante ; l'ancien direct n'est qu'un repli sans parent animé. Cela évite que
la cible LAST de Kabc soit capturée sur la trajectoire FIRST de K.

Les siblings de reflow portent `isDirectMover: false`. Quand leur parent logique
possède déjà un ghost actif, leur propre ghost reste visible et animé, mais ses
poses FIRST/LAST sont converties dans le repère de ce parent puis recomposées
avec la pose parent courante. Ils ne suivent donc pas une interpolation monde
indépendante avant un second déplacement au handoff; la même règle s'applique à
chaque niveau de la hiérarchie. La chaîne `overlayParentIds` est parcourue du
parent immédiat vers la racine pour accrocher aussi un sibling à un ancêtre actif
lorsque son parent direct n'est pas lui-même animé.

Si un enfant `overlay-world` atteint son LAST avant son parent de destination, son
ghost passe en handoff: sa pose locale relative au parent est figée à son LAST puis
recomposée avec la trajectoire courante du parent à chaque commit. Le DOM auteur
n'est restauré qu'au LAST du parent. Les siblings ajoutés au groupe pour le reflow
portent `isDirectMover: false` et ne peuvent donc pas voler ce handoff. Cette règle
est récursive: chaque niveau conserve son propre noeud de projection et peut
s'accrocher au handoff de son parent, sans limite codée à deux niveaux.

Les templates FIRST des ghosts conservent aussi une table de références vers les
descendants connus. Lorsqu'un template est rematérialisé, ces références sont
remappées vers le clone correspondant; le runner ne dépend donc pas d'une recherche
par attribut dans un subtree où les identifiants peuvent être répétés. Les
marqueurs CSS transitoires restent confinés à la projection HTML.

## Invariants

- Les composants sont les seuls écrivains de l'état DOM auteur; la projection FLIP
  n'écrit que ses slots transitoires réservés et ses attributs de couche.
- `LayoutDomBackend` est le seul responsable du parentage logique.
- Les parts publiées sont enregistrées et supprimées avec le cycle de vie du composant.
- `destroy()` détache les noeuds matérialisés et libère les services player-scoped.
- Les éléments initialement présents dans le root fourni par le host ne sont pas supprimés par le runner.
- Une présentation FLIP courante ou historique ne franchit pas de frontière
  asynchrone entre les lectures FIRST/LAST et le flush de poses.
- Une capture persistée est indexée par son identité primaire et, lorsqu'elle est
  groupée, par les identités stables de toutes les occurrences couvertes; elle ne
  dépend pas du touched set DOM courant.
- Chaque conteneur possède une trajectoire propre; une capture enfant ne peut pas
  interrompre, terminer ou recalculer la trajectoire de son parent.
- Une HtmlPose.rect est une AABB dérivée ; toute dérivation ou composition de
  repère utilise HtmlPose.origin et la matrice linéaire.

## Hors tranche

Cette tranche ne prétend pas fournir:

- les réalisations historiques d'événements live;
- les transitions complexes qui ne sont pas représentées par des occurrences
  compilées;
- la policy métier `list` et son reorder; le touched set générique local ne
  remplace pas cette capacité;
- l'exécution générique de `listen` et des straps.

Ces capacités devront ouvrir leurs contrats avant l'adaptation de `flip-stress`.
