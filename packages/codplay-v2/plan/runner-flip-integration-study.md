# CodPlay V2 — architecture du mouvement hiérarchique HTML

> Status: Fixe
> CodPlay version: V2 foundation
> Implementation: appliquée le 2026-08-19
> Review: contrat validé le 2026-08-20 pour les moves compilés et le seek froid

## Objet unique

Cette tranche fournit le déplacement d'un élément entre des sources et cibles
arbitraires dans une hiérarchie d'éléments imbriqués, chacun pouvant suivre sa
propre animation à une phase temporelle indépendante.

Les positions FIRST et LAST sont les conséquences directes de l'événement :

- FIRST est le layout exact juste avant la frontière ;
- l'événement est inclus ;
- LAST est le layout naturel immédiatement après cette frontière ;
- la durée anime entre ces deux layouts, mais ne choisit jamais un état futur.

Play et Seek évaluent un circuit unique à un temps absolu `t`.

## Décisions fixées

### Source de vérité structurelle

`SolvedGraph` est l'unique source de parentage, target et ordre. Le DOM ne corrige
jamais le graphe et aucun module ne maintient un ordre historique alternatif.

`StructuralTimeline` réduit les frontières compilées en snapshots complets et
immutables `childrenByTarget`. Tous les consommateurs interrogent cette timeline.

### Persistance des materialisations auteur

Les elements et ressources crees pour un perso sont persistants pendant toute la
duree de la sequence/player, qu'ils soient actuellement montes ou detaches.
`mount`, `unmount`, reparentage et reorder sont des operations de structure et ne
detruisent jamais une materialisation auteur.

Play et Seek reutilisent les memes instances de composants et les memes elements.
Un seek ne detruit, ne recree et ne recharge donc pas les elements media ; il
reconcilie uniquement l'etat cible, le parentage et l'ordre.

La destruction des materialisations auteur intervient uniquement lors du teardown
final du player/sequence. Les clones d'overlay et le DOM de mesure ne relevent pas
de cette persistance : ce sont des ressources techniques transitoires.

### Côtés d'une frontière

La frontière temporelle est un type sémantique, pas un epsilon :

```text
before(t) = événements dont startAt <  t
after(t)  = événements dont startAt <= t
```

`materializeSceneBeforeBoundary()` rend cette distinction valide même à `0 ms`.

### Modes de présentation

Les modes ont des usages distincts :

| Situation | Mode effectif | Présentation HTML |
|---|---|---|
| réordonnancement dans la même target/list | `local` | nœud source réel |
| changement de target ou de parent logique | `reparent` | overlay indépendant |
| `flipMode: 'overlay-world'` explicite | `reparent` | overlay indépendant |

`flipMode` est facultatif. L'absence de mode choisit `local` si la target reste
identique et `reparent` si elle change. Un `local` explicite ne peut pas dégrader
un vrai reparentage en présentation locale.

L'overlay est le procédé de présentation du mode reparent. Ce n'est ni un second
graphe ni un second algorithme temporel.

### Pas de bridge FLIP autonome

Le bridge autonome, les captures persistées et leur cache ont disparu du
périmètre V2. La géométrie affine HTML est une primitive interne au module
`motion`; elle n'expose aucun runtime de capture concurrent au runner.

## Architecture appliquée

```text
                         +----------------------+
CompiledScene ---------->| StructuralTimeline   |
       |                 | parent/target/order  |
       |                 +----------+-----------+
       |                            |
       +-> compileMotionSchedule    |
                    |               |
                    v               v
             event boundaries -> isolated HTML layout sampler
                                      | before / after snapshots
                                      v
                                buildMotionGraph
                                      |
                             MotionGraph by item
                                      |
                current natural layout + absolute t
                                      |
                                      v
                          resolvePresentationFrame
                                      |
                           +----------+----------+
                           |                     |
                       local host          reparent host
```

### 1. `StructuralTimeline`

Fichier : `src/runtime/player/structural-timeline.ts`.

La timeline part de l'état initial exclusif à `0`, parcourt chaque frontière
compilée dans l'ordre, applique les deltas de placement puis fige l'ordre complet.
Elle expose `resolveAt(t)` et `resolveBefore(t)`.

La capacité list n'est plus un reducer mutable. Son service runtime est un
marqueur ; la sémantique ordonnée appartient au graphe structurel commun.

### 2. `compileMotionSchedule`

Fichier : `src/runtime/motion/motion-schedule.ts`.

Le compilateur pur aplatit les eventimes, sélectionne la dernière commande d'un
item à une même frontière et produit les intentions directes :

```ts
type ScheduledMotionIntent = {
  id: string
  itemId: string
  startAt: number
  duration: number
  ease: string
  presentationMode: 'local' | 'reparent'
  path?: Path
}
```

Le player logique ne connaît ni ce calendrier, ni les overlays, ni leurs
ressources HTML.

### 3. Mesure isolée

Fichiers :

- `src/runtime/runner/html-layout-snapshot.ts` ;
- `src/runtime/runner/html-player-runner.ts`.

Un root HTML hors écran est matérialisé avec les mêmes composants, services,
targets et règles structurelles que le root visible. Pour chaque frontière `t`,
il matérialise successivement les scènes pures `before(t)` et `after(t)`.

Un `LayoutSnapshot` contient, par `itemId` :

- `parentItemId` logique ;
- `targetId` opaque ;
- pose affine locale au parent ;
- pose affine relative au root ;
- dimensions locales.

Le root isolé reprend exactement la largeur et la hauteur du root visible avant
chaque mesure. Conserver seulement une `min-height` laisserait son `height: 100%`
lié au viewport ; les descendants positionnés en pourcentage auraient alors des
coordonnées FIRST/LAST différentes de celles du root visible.

Le DOM isolé est un substrat de mesure. Il ne fournit ni identité ni structure.
Le DOM visible n'est jamais déplacé temporairement pour lire FIRST ou LAST.

### 4. Graphe temporel par item

Fichiers :

- `src/runtime/motion/types.ts` ;
- `src/runtime/motion/motion-graph.ts` ;
- `src/runtime/motion/motion-pose.ts`.

`buildMotionGraph()` compare les deux layouts complets de chaque frontière. Il
crée un segment lorsque l'attachement local d'un item change : parent, target,
origine, matrice ou dimensions.

Chaque segment appartient à exactement un item :

```ts
type MotionSegment = {
  itemId: string
  startAt: number
  endAt: number
  duration: number
  ease: string
  presentationMode: 'local' | 'reparent'
  from: MotionAttachment
  to: MotionAttachment
  direct: boolean
}
```

Un enfant dont l'attachement local ne change pas ne reçoit pas une trajectoire
dupliquée : il suit récursivement la pose résolue de son parent. Cette règle ne
code aucune profondeur maximale.

### 5. Parents mobiles et attachements dynamiques

Les endpoints ne sont pas des coordonnées monde figées. Un
`MotionAttachment` conserve la relation locale au parent source ou cible. À tout
temps `t`, le resolver :

1. résout la pose courante du parent source ;
2. compose le FIRST local avec cette pose ;
3. résout la pose courante du parent cible ;
4. compose le LAST local avec cette pose ;
5. interpole les deux résultats.

Les phases temporelles des parents et enfants peuvent donc être différentes.
Un parent reste souverain : une frontière enfant ne termine, n'annule et ne
recalcule jamais sa trajectoire.

### 6. Chevauchement et retarget

Lorsqu'une nouvelle frontière affecte un item déjà animé, son nouveau FIRST est
la pose calculée par le graphe existant au temps exact de la frontière. Le
planner n'utilise pas la pose logique finale du segment précédent. Pour un
reflow local qui n'a pas son propre intent direct, le segment en cours conserve
son `startAt`, son `endAt`, son easing et sa phase ; seul son endpoint est
retargeté. Le graphe conserve ce retarget dans une liste de sous-frontières
immutables afin que l'ancien endpoint reste inchangé avant la frontière.

La pose source virtuelle du retarget est extrapolée à la phase courante dans la
même géométrie que l'interpolation : sans `path`, l'extrapolation est affine ;
avec `path`, elle résout aussi le point de départ canonique nécessaire pour que
le point courbe à cette phase soit exactement la pose visuelle courante. Ainsi,
le départ d'un autre item dans la même liste ne remet pas le sibling à une
easing de progression zéro et ne crée pas de palier visuel. Un intent direct de
l'item conserve sa propre ownership, son chemin et son timing.

Les segments restent indexés chronologiquement par item. Le plus récent segment
actif possède la pose de l'item, sans annuler les segments d'autres items ou de
ses ancêtres.

### 7. Résolveur absolu unique

`resolvePresentationFrame(graph, currentLayout, t)` est pur. Son résultat ne
dépend pas des temps précédemment visités.

Le layout courant apporte les mouvements auteur continus et le reflow naturel au
temps `t`; le graphe apporte les segments structurels. Les parents sont résolus
récursivement avant leurs descendants.

`MotionMaterializer` appelle ce même resolver après chaque materialisation
structurelle. Play et Seek ne sélectionnent aucune stratégie différente.

### 8. Présentation locale

Le host local écrit uniquement des slots CSS réservés sur les sources réelles.

Pour une frame complète :

1. retirer les anciennes contributions locales ;
2. écrire toutes les dimensions actives ;
3. laisser le layout se stabiliser synchroniquement ;
4. résoudre les matrices parent-first ;
5. écrire les transforms ;
6. retirer les slots à LAST.

Cette transaction évite de calculer un sibling contre un layout seulement
partiellement mis à jour.

### 9. Présentation reparent par overlay

Le host reparent indexe les ressources par `itemId`, jamais par capture. Il masque
la source, clone son contenu auteur courant, applique la pose résolue dans la
couche overlay puis restaure la source à LAST.

La pose est localisée contre la géométrie mesurée de la couche overlay elle-même,
pas contre une hypothèse sur le root. Les bordures et transforms du root ne
créent donc pas de saut source/overlay.

Un descendant qui possède une trajectoire indépendante est masqué dans le clone
de son ancêtre. Un segment local situé sous un ancêtre overlay est présenté par
une ressource overlay propre, car son nœud réel est contenu dans une source
masquée. Seule la représentation change ; le segment reste local dans le graphe.

## Code retiré

La restructuration supprime les concepts suivants :

- `FlipCapture` et groupes de captures ;
- `captureId`, aliases et cache canonique ;
- replay historique de modules/list ;
- `HtmlPresentationTransaction` sur le DOM visible ;
- `HtmlFlipRuntime` et bridge FLIP autonome ;
- ownership/handoff mutable de ghosts ;
- `resolveFlipAncestorRegime` et coupes host ;
- touched sets utilisés comme contrats temporels ;
- chemins distincts de résolution Play et Seek.

Le dossier `src/runtime/flip` a été supprimé. La géométrie restante vit dans
`src/runtime/motion/html-pose.ts` et `html-types.ts`.

## Invariants normatifs

1. Un événement définit FIRST et LAST ; la durée ne sélectionne pas LAST.
2. Une frontière possède deux côtés explicites, sans epsilon.
3. Le graphe structurel est complet et unique à tout temps.
4. Chaque item possède ses propres segments temporels.
5. Un descendant inchangé suit récursivement son parent sans segment dupliqué.
6. Chaque parent conserve sa trajectoire et sa phase propres.
7. Un overlap local retargete depuis la pose visuelle résolue en conservant la
   phase du segment ; il n'est jamais réécrit rétroactivement avant sa frontière.
8. Une target différente force le mode reparent et donc l'overlay.
9. Une target identique choisit local par défaut.
10. Play et Seek appellent le même résolveur absolu et le même commit.
11. Une pose affine utilise origine et matrice ; `rect` n'est qu'une AABB dérivée.
12. Le DOM visible n'est jamais une source de structure ni un host de mesure
    historique.

## Validation appliquée

Les tests couvrent notamment :

- parent source et parent cible animés indépendamment ;
- propagation récursive à cinq niveaux sans pistes enfant dupliquées ;
- overlap et retarget continu ;
- retarget de reflow sans remise à zéro de l'easing ;
- retarget d'une trajectoire courbe sans saut à la frontière ;
- indépendance à l'historique d'évaluation ;
- inférence local/reparent et override `overlay-world` ;
- frontière exclusive à `0 ms` ;
- ordre list reconstruit par la timeline structurelle.

La démo runner expose deux scénarios :

- reorder `[B, C, A] -> [A, B, C]` dans une même list : A/B/C locaux,
  aucun overlay ;
- P et Q reparentés simultanément dans une hiérarchie imbriquée : deux overlays
  indépendants, B/C locaux.

Inspection Safari effectuée aux frontières et par pas de `10 ms` :

- continuité locale à `800 ms` et `2200 ms` ;
- continuité source/overlay à `800 ms` après localisation dans la couche réelle ;
- résidu inférieur au sous-pixel à la limite gauche de `2200 ms` ;
- frame Play à `1467 ms` strictement identique à un Seek immédiat à `1467 ms` ;
- aucun overlay, masque ou transform transitoire après LAST.

La fixture stress contient désormais six enfants par liste (`Qa…Qf` et `Ka…Kf`),
présentés en deux rangées de trois. Les douze échanges alternés couvrent
`1200…6700 ms` avec un espacement de `500 ms`. Avec un viewport plus haut, la
continuité `8990→9000 ms` de Q/K reste inférieure à `0,002 px`, sans débordement
des transferts et avec overlay vide après LAST. Les transitions de Q/K utilisent
un arc orienté vers le centre de la page ; chaque enfant utilise deux arcs
pseudo-aléatoires générés par son identifiant, donc stables entre Play et Seek.
Le contrôle `Ke` autour de `6200 ms` couvre aussi une frontière simultanée : son
chemin reste continu lorsque `Qf` provoque le reflow de la liste. Les arcs
quantifiés de Q/K restent également à moins de `0,002 px` de leur cible à
`8999,9 ms`, avant la libération exacte des overlays à `9000 ms`.

Le stage de stress remplit désormais exactement la zone de présentation
responsive (`100%` en largeur et en hauteur). Les conteneurs A–D utilisent des
ancres et des déplacements verticaux en pourcentage du root, tout en conservant
leur taille de stress fixe pour préserver les deux rangées Q/K. Un
`ResizeObserver` invalide le graphe mesuré
après chaque changement de taille du stage, au temps logique courant ; Play et
Seek restent donc sur le même circuit de résolution.
Safari a vérifié les largeurs `1280`, `1000`, `700` et `400 px` : le stage
occupe exactement la boîte de contenu de son conteneur, A–D restent dans ses
limites aux checkpoints `FIRST`, `BOUNDARY` et `LAST`, et un redimensionnement
à `t=5000 ms` ne produit ni saut ni erreur console.

## État de revue

L'architecture et son application sont complètes pour la verticale compilée du
runner. La revue du 2026-08-20 valide le contrat public de cette tranche et de
la démo. Les événements live non présents dans le calendrier compilé
devront produire les mêmes `MotionBoundary`; ils ne doivent pas introduire un
second moteur et restent hors du statut `Fixe` de cette tranche.
