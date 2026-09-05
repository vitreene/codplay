# Graphe de mouvement V2

> Statut : En cours — correction de la frontière géométrique FLIP
> Version CodPlay : V2 foundation
> Relecture : frontière move/action, source naturelle pré-frontière et composition des parents ; validation Firefox ciblée effectuée, matrice Safari complète encore ouverte

## Rôle

Le module de mouvement transforme les changements de structure et de position
en une description temporelle immuable. Cette description permet de connaître la
pose d'un élément à n'importe quel instant, pour Play comme pour Seek.

Le module ne possède ni nœud DOM, ni état de transport, ni animation mutable.
Il produit uniquement des données consommées par le runner et le materializer.

## Fonctionnement

```text
Intentions de mouvement compilées
  + géométrie avant et après la frontière
  -> MotionGraph
  -> resolvePresentationFrame(graph, layoutCourant, t)
```

Une frontière correspond à un changement précis de la scène. Le graphe conserve
les poses de départ et d'arrivée, puis calcule la pose demandée à partir du
temps absolu `t`.

## Organisation interne

- `LayoutSnapshot` contient les éléments mesurés, leur cible, leur parent
  logique et leurs poses relatives au parent et à la racine. La pose relative
  au parent est la seule référence locale publiée ; le runner ajoute seulement
  les ancêtres nécessaires au calcul ;
- `MotionBoundary` contient les géométries FIRST/LAST d'une transition. Pour un
  `move`, FIRST est capturé avant `startAt`, `afterStart` décrit la structure
  immédiatement après `startAt`, et LAST est capturé à
  `startAt + delay + duration`, même si la cible n'existe qu'à cet endpoint.
  `afterStart` sert aux slots de reflow des frères ; LAST sert à l'attachement
  du mover et au contexte temporel de sa destination. Pour une transition de
  pose portée par une action, FIRST est capturé dans l'état monté à `start` si
  nécessaire, puis LAST à son endpoint ; cette transition ne devient pas un
  reflow FLIP. Si plusieurs propriétés de l'action ont des fins différentes,
  les snapshots `keyframes` conservent aussi leurs temps de fin intermédiaires ;
  ces états sont résolus et présentés par le player avant d'être mesurés ;
- `ItemMotionTrack` contient les segments chronologiques d'un élément ;
- `MotionAttachment` décrit le parent, la cible, la pose locale, le contexte de
  positions FIRST/LAST de l'item et de ses ancêtres, ainsi qu'un fallback vers
  la racine uniquement si ce contexte est réellement absent. Il conserve aussi
  le repère local capturé lorsque plusieurs conteneurs HTML ont des moves
  simultanés ;
- `MotionGraph.presentationItemIds` liste uniquement les éléments qui possèdent
  une trajectoire à présenter ;
- `PresentationFrame` contient la pose et la représentation demandées pour ces
  éléments à un instant donné.

La timeline naturelle distingue le layout engagé à la frontière de celui qui
était encore visible juste avant. `resolveNaturalLayoutBefore()` conserve ce
dernier état par identifiant de frontière ; le graphe l'utilise pour construire
le FIRST réel d'un retarget, sans remplacer un mover par le `before` brut d'une
frontière ultérieure. Au démarrage structurel, le mover et les slots de reflow
engagent `afterStart`, tandis que la pose présentée part toujours du FIRST.

Lors d'un `move` structurel, la capture inclut tous les éléments des cibles
source et destination. Un élément qui possède aussi un mouvement direct ultérieur
reste disponible pour animer le reflow de la liste, mais son instantané naturel
ne peut pas écraser sa propre trajectoire. Un élément capturé seulement comme
ancêtre reste une dépendance de calcul et ne devient pas automatiquement
propriétaire d'un segment.

## Planification

À chaque frontière, le planificateur ferme la portée sur les éléments en
mouvement, les éléments réordonnés et les ancêtres jusqu'à la racine. Il compare
les attaches locales sélectionnées, mais seuls les mouvements directs et les
éléments du reflow possèdent un segment. Les ancêtres restent disponibles pour
composer leur propre trajectoire si nécessaire.

Le runner peut produire deux plannings à partir du même journal :

- le planning de présentation courante exclut les faits `persist-only` ;
- le planning de reconstruction les inclut.

Les deux utilisent les mêmes `MotionBoundary` et le même graphe. Ainsi, un
`endEmit` live conserve la première géométrie visible, tandis qu'un seek utilise
la frontière logique persistée sans conserver une branche spéciale de capture.

Le planning est compilé à l'initialisation du journal visible, après une capture
live terminée et après un resize. Un append live réveille le runner ; si le
planning contient alors un nouvel intent issu de `move`, la géométrie naturelle
est recapturée aux frontières FIRST/LAST correspondantes et conservée comme
donnée. Un append sans `move` ne reconstruit pas le graphe.

Pour chaque frontière, la capture présente successivement les scènes résolues
par le player aux points `before`, `afterStart`, aux fins intermédiaires de
propriétés et à `after`, sur le même DOM auteur. Elle mesure alors ces états et
ne conserve que leurs poses. Le planning HTML ne relit pas une transition CSS
parallèle : le résolveur d'action ne fournit que les temps à capturer, tandis
que la scène et les valeurs courantes viennent du pipeline canonique.

`LayoutSnapshot.rootKey` est un identifiant opaque, local au runner HTML, qui
permet de retrouver le conteneur DOM de présentation au moment du commit. Il ne
transporte aucune référence DOM dans le graphe de mouvement et n'ajoute aucun
contrat auteur.

Chaque `LayoutItemSnapshot` et chaque attachement conservent, lorsque le runner
le fournit, la clé et la pose du conteneur local de l'item. Cette donnée ne
change ni le calcul FIRST/LAST ni le ciblage des events : elle empêche seulement
le présentateur HTML de projeter deux items actifs dans le même overlay lorsque
leurs conteneurs sont distincts. Le graphe reste unique et la frame reste
résolue sans lecture du DOM.

La préparation du graphe est terminée avant la première présentation. Elle
enregistre d'abord tous les propriétaires de trajectoire, y compris ceux qui
commencent plus tard mais dont la pose est nécessaire à un enfant déjà en
mouvement. Elle résout ensuite les poses des segments dans l'ordre temporel.
Ainsi, un retarget de `Qa` ne peut pas figer la pose finale de `K` simplement
parce que le segment de `K` n'avait pas encore été parcouru. Cette organisation
est interne au planificateur : elle n'ajoute pas de seconde API ni de second
circuit d'événements.

Après cette préparation, `present(t)` ne construit pas le graphe et ne mesure
pas les ancêtres. Il sélectionne le layout naturel préparé, suit les relations
parent/enfant déjà enregistrées et calcule la pose interpolée à `t`. La remontée
jusqu'à `root` peut donc encore être nécessaire pour composer une pose, mais
elle ne découvre aucune structure et ne consulte pas le DOM. Une nouvelle
préparation n'est déclenchée qu'après une nouvelle capture ou une invalidation
explicite, notamment un resize ou une modification structurelle utilisateur.

La capture des points intermédiaires est finie avant la première frame de
lecture. La RAF de lecture ne fait plus que sélectionner et interpoler les
poses conservées ; elle ne présente pas successivement des scènes historiques
et n'effectue aucune mesure.

Une intention directe conserve son délai et son timing. Les éléments réordonnés
utilisent le timing effectif le plus long de la frontière. Un changement de
cible ou de parent impose le mode `reparent`; sinon l'indication de l'auteur
peut choisir `local` ou `reparent`.

Lorsqu'une frontière recouvre un segment existant, le segment est recalé sur la
pose visuelle déjà résolue. Sa phase, sa trajectoire et sa date de fin restent
inchangées. Aucun segment actif n'est redémarré à zéro, annulé globalement ou
remplacé par un simple point final.

## Résolution

La résolution est pure et limitée aux éléments qui possèdent une trajectoire :

1. sélectionner les identifiants préparés dans `presentationItemIds` ;
2. trouver le dernier segment actif à l'instant `t` ;
3. calculer la pose de l'élément, en utilisant si nécessaire le contexte privé
   de ses parents en mouvement ;
4. interpoler les attaches avec l'easing et le chemin ACE ;
5. produire uniquement l'entrée de présentation de l'élément.

Un parent en mouvement ne peut pas être ignoré : il modifie la pose mondiale de
son enfant. Cependant, sa présence dans le calcul ne crée pas de nouvelle entrée
de présentation s'il ne possède pas son propre segment. Le graphe prépare cette
dépendance à l'avance et la frame ne parcourt pas toute la mise en page.

La préparation conserve ce contexte sur chaque attachement, séparément pour
FIRST et LAST. Ainsi, si Qa termine dans K alors que K commence son propre move
plus tard, la résolution de Qa retrouve la chaîne `Qa -> liste K -> K` dans le
contexte LAST. Elle évalue ensuite le segment de K au temps demandé : avant le
début de K, sa pose FIRST ; pendant son move, sa pose interpolée ; après son
move, sa pose LAST. Qa ne vise donc jamais la pose finale de K par défaut.
Cette résolution temporelle est pure et n'ajoute ni mesure DOM ni trajectoire
FLIP aux ancêtres qui n'ont pas leur propre intention.

Le même graphe et la même géométrie naturelle produisent toujours la même frame.
Résoudre une frame ancienne ne modifie pas les résolutions suivantes.

Une transition de pose HTML portée par une action reste dans le graphe pour la
composition des descendants, mais son service possède la pose du nœud auteur.
Le host HTML ne lui applique donc pas une seconde matrice locale.

La capture conserve aussi, séparément de `origin`, l'origine de la boîte de
mise en page non transformée (`layoutOrigin`) dans chaque attachement local.
Quand la feuille de projection remplace le `transform` auteur, le host retire
uniquement cette origine de layout avant d'écrire la matrice temporaire. Il ne
retire pas l'origine affine qui contient déjà le `translate`/`rotate` auteur ;
sinon un item local serait visuellement décalé alors que sa pose affine et son
centre de trajectoire sont corrects. Toute `RelativeMotionPose` de snapshot V2
porte cette donnée ; seule une `HtmlPose` synthétique qui ne la fournit pas est
normalisée par `deriveRelativeMotionPose` en prenant provisoirement `origin`.

### Ancrage d'un path

Une transition `move` peut déclarer `pathAnchor`. La valeur `center` est le
contrat V2 utilisé par l'éditeur ed2 : le path est résolu entre les centres
visuels affines des poses (`origin + matrix × dimensions locales / 2`) et chaque
point résolu reconstruit l'origine de l'item avec sa matrice et ses dimensions
courantes. Ainsi, rotation et redimensionnement ne décalent pas l'item par
rapport au path affiché. `aabb` ou l'absence du champ conserve l'ancrage AABB
des transitions V2 qui ne déclarent pas l'extension. Cette donnée est immuable
dans le segment ; aucun bounding box ni pixel de viewport n'est écrit dans le
décor.

Un perso détaché conserve ses relations logiques `parentByPerso` et
`targetByPerso`, sans entrer dans l'ordre des cibles ni dans la présentation DOM.
Si un mover direct est absent au FIRST à cause d'un ancêtre détaché et que cet
ancêtre est monté au LAST, la capture peut présenter ponctuellement l'état FIRST
du mover dans ce contexte LAST pour mesurer son attachement source. Cette phase
réutilise les materialisations persistantes, ne crée aucun DOM d'analyse et
restaure le LAST avant sa capture finale.

La composition hybride ne remplace que le mover concerné et les ancêtres
nécessaires à son attachement. Elle ne peut pas écraser le FIRST d'un autre
mover capturé dans la même frontière ; Q et K conservent donc chacun leur propre
côté FIRST.

Lorsqu'un retarget vise une liste dont l'ancêtre possède déjà un segment, la
pose de la liste est résolue en remontant cette chaîne au temps exact de la
frontière. Un intermédiaire sans piste propre ne doit pas réintroduire sa pose
capturée statique et perdre la phase de son parent animé. Le contexte LAST reste
le fallback uniquement lorsque la branche cible n'est pas encore montée dans le
layout courant.

## Inférence de la présentation

- même cible : `local` par défaut ;
- cible ou parent logique différent : `reparent` ;
- `flipMode: 'overlay-world'` : `reparent`, même si la cible ne change pas ;
- `local` ne peut pas annuler un véritable changement de cible ou de parent.

## Contrat et limites

- aucune lecture du DOM pendant la résolution d'une frame ;
- aucune création d'arbre de mesure ;
- les instantanés de géométrie contiennent des données, jamais des références
  DOM ;
- chaque élément possède ses segments temporels indépendamment ;
- l'influence des parents est composée récursivement ;
- une trajectoire locale recouverte conserve sa phase d'interpolation ;
- une seule source ou représentation indépendante est visible par élément ;
- les poses HTML utilisent des origines affines et des matrices ;
  `rect.left/top` restent de simples valeurs AABB dérivées.
