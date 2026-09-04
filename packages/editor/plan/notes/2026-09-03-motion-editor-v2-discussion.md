# Note de discussion — éditeur de mouvement V2

**Statut : note d'élaboration — non normative**  
**Date :** 2026-09-03

Cette note conserve les raisonnements et les divergences qui ont conduit au plan
[`2026-09-02-motion-editor-v2-plan.md`](../2026-09-02-motion-editor-v2-plan.md).
Elle ne remplace ni les spécifications V2 ni le plan d'actions.

## Décision complémentaire du 2026-09-04 — deux canaux par item

La trajectoire et l'habillage ne sont plus considérés comme une seule chaîne
de KFs. Le modèle porte explicitement `channel: 'pose' | 'decor'` :

- les KFs `pose` forment la chaîne spatiale et les bornes de visibilité ;
- les KFs `decor` portent un patch d'habillage sans contribuer à la pose tant
  qu'ils restent sur ce canal, n'interrompent jamais une trajectoire et ne
  produisent pas de ghost ;
- un KF `pose` peut aussi porter du décor et participe alors aux deux chaînes,
  mais reste un seul point visuel dans la zone pose ;
- la timeline reste une seule row par item. Elle ne se sépare en zone haute
  `decor` et zone basse `pose` que lorsque les deux canaux sont présents. Les
  losanges restent identiques et il n'existe pas de timeline par propriété.

Exemple : avec `A pose @ 0 s`, `B pose @ 10 s` et `C decor @ 5 s`, la pose à
`5 s` reste celle de la trajectoire `A → B`; `C` ne devient pas une cible
spatiale. Si l'auteur déplace l'item à `5 s`, `C` est promu en KF `pose`, sa
pose est capturée et la trajectoire devient réellement `A → C → B`.

## Décisions issues de la discussion

- L'éditeur travaille dans la capsule qui reçoit l'item. La capsule fournit les
  règles par défaut d'apparition et de disparition.
- Pour une capsule sans contrainte particulière, l'insertion crée un KF réel
  d'apparition et une sortie virtuelle héritée. Pour la capsule racine, la vie
  par défaut couvre la scène. Une capsule spécialisée peut fournir une autre
  distribution.
- Une borne virtuelle n'appartient pas encore à l'item. Son déplacement la
  matérialise en KF réel et raccourcit la vie de l'item. Play, Seek et une simple
  projection ne la matérialisent jamais.
- Un item qui ne porte qu'un KF réel garde sa dernière pose jusqu'à sa sortie
  virtuelle. Le décor de sortie peut donc ne porter qu'une transition de
  visibilité ; son édition explicite est nécessaire pour fixer une nouvelle pose.
- Il n'y a pas, dans cette version, deux intentions « repositionner » et
  « déplacer ». Le geste du CS est unique : sur un KF il met à jour le canal
  `pose` au même temps ; entre deux KFs il peut créer un KF `pose` au temps du
  playhead ; répété sur ce KF, il met à jour ce même KF, sans remplacer ni
  dupliquer le KF. La palette crée un KF `decor` si aucun KF `pose` n'existe à
  cet instant, ou enrichit le KF `pose` existant.
  L'ancien routage central/bord de 12 px est conservé comme module expérimental
  dormant.
- Cette règle vaut pour toute propriété de `Decor`, pas seulement la pose : style,
  couleur, taille, rotation, classes, zone, custom ou toute propriété future
  peuvent constituer le patch d'un KF. La capture d'un KF `decor` reste sparse ;
  celle d'un KF `pose` capture en plus la pose complète requise par son waypoint.
  Le contenu reste `Content` dans le modèle V2 ; un changement de contenu piloté
  par KF demande un contrat distinct et n'est pas introduit ici.
- Le nouveau KF `pose` porte son `Decor.path` entrant selon le contrat de
  trajectoire courant. Une droite est implicite et ne s'enregistre pas. Tant
  qu'un KF reste `decor`, il ne contribue pas à la pose ; un mouvement le
  transforme en KF `pose` au même instant. Le path, le ghost et le CS sont des
  artefacts d'authoring, jamais des éléments de scène.
- La chaîne visuelle expose tous les ghosts réels des KFs `pose` de l'item, pas
  seulement ceux du segment actif. La pose courante est masquée ; les autres
  restent cliquables. Les KFs `decor` n'ont pas de ghost géométrique. Les ghosts
  et trajets non actifs sont nettement plus discrets par transparence et couleur
  ambrée pâlie/désaturée ; cette couleur et leur opacité varient légèrement avec
  la distance temporelle au KF courant, sans changer leur contrat d'interaction.
- La sélection automatique d'un KF intervient à la pause ou au relâchement du
  scrub, jamais à chaque seek intermédiaire ni à l'entrée de Play. Le contrôleur
  retient le KF réel le plus proche dans une tolérance de 50 ms pour l'unique
  item sélectionné ; sinon il retire seulement `keyframeId`. Les bornes
  virtuelles ne sont pas sélectionnables par cette dérivation.
- Entre deux KFs, la transition de position est une donnée unique. Le point de
  début est facultatif : sans point, la transition couvre l'intervalle ; avec
  point, la pose amont est maintenue jusqu'à lui. Le point est borné par les KFs
  et suit le KF aval. Aux extrémités, les transitions nommées restent dédiées à
  la visibilité.

## Ce qui a été écarté

- La création systématique d'une cible à `source.timeMs + 500 ms` n'est plus la
  règle. `500 ms` est la valeur provisoire de la fenêtre de transition, pas le
  temps de création du KF.
- La séparation active par bordure intérieure et zone centrale n'est plus une
  règle d'interface.
- Le `Sustain` du sequence-editor ne représente pas le plateau de cette
  transition de position.
- Le `Move` structurel CodPlay ne représente pas un déplacement de pose dans la
  même capsule et ne change ni parentage ni ordre.
- Le CS ne reconstruit pas une pose depuis le DOM, une AABB ou un lecteur de path
  parallèle. Il lit la pose numérique publiée par la `PresentationFrame` du
  runtime, tandis que le snapshot sert à l'authoring.

## Relecture du plan sequence-editor

Le plan SE actuel établit que :

- `Keyframe.timeMs` est documentaire et que le premier/dernier KF `pose` bornent
  la visibilité ; un seul KF `pose` reçoit une sortie virtuelle de la capsule ;
- la grille est décor-agnostique et transporte `decorId` ainsi que le canal
  explicite `pose`/`decor` ;
- les transitions sont aujourd'hui décrites par `transitionIn`/`transitionOut`,
  avec une exclusivité par segment, et rendues par rampe/bande ;
- `Sustain` est un comportement distinct, appliqué au-dessus du décor ;
- la machine et le rendu définissent partiellement les bornes virtuelles, mais
  pas encore la transition de position unique avec point facultatif ni le
  plateau.

L'interface implémente ces bornes : `machine.ts` calcule `virtualKeyframes` pour
la capsule racine implicite et les capsules explicites, `track-row.ts` rend les
losanges virtuels et `mount.ts` les matérialise par double-clic ou glisser-déposer
(`addKeyframe` puis renommage). Le drag est borné par la capsule parente et
Échap annule le geste avant écriture. La création du premier KF hérite désormais
le décor initial.
Les tests couvrent les enfants sans KF, avec un KF réel, les capsules explicites,
ainsi que l'absence d'écriture pendant seek et resize. La validation native de
la matérialisation reste une porte séparée.

## Points techniques à aligner

- Le plan SE possède un défaut général de transition de `400 ms` avec easing
  `ease-in-out`. La feature mouvement conserve provisoirement `500 ms` pour sa
  fenêtre ; le nommage d'une constante dédiée doit être explicite.
- Le concept de transition est fixé par canal : entre deux KFs `pose`, la
  transition de position est portée par le KF aval ; entre deux événements de
  décor, la transition d'habillage est portée par le canal `decor`. Le point de
  début est facultatif et borne la fenêtre. `transitionIn`/`transitionOut`
  restent réservés aux transitions nommées des extrémités de visibilité.
- Les collisions temporelles, le choix d'easing visible, les options de path,
  l'orientation/taille selon la tangente, le reparentage, l'undo/redo applicatif,
  la multi-sélection et l'interface des zones de capsule restent hors de cette
  tranche.

## Fin naturelle et queue virtuelle

La reproduction avec plusieurs KFs créés par le chemin réel de l'overlay a
isolé la désynchronisation de fin : la capsule V2 peut exposer une queue de
sortie après `scene.meta.durationMs`. Une grande frame de ticker faisait donc
réconcilier le sequence-editor sur un temps comme `5900 ms` pour une scène de
`5000 ms`; la présentation runtime pouvait déjà être vide alors que le CS et
les ghosts sortaient du mode suspendu.

Le correctif reste dans `EditorCoordinationBridge`, sans modifier CodPlay :
après la pause, une fin qui dépasse la durée auteur seek la frontière de scène,
puis publie la réconciliation et quitte `playing`. Une pause ordinaire conserve
son temps courant. Le test d'intégration vérifie le cycle création de cinq KFs,
déplacement, Play, fin naturelle, réaffichage du CS et conservation des
positions de tous les ghosts.

## État de validation historique

Un premier vertical slice de l'overlay, de la géométrie SVG, des ghosts et de la
couture `PresentationFrame` a été essayé sur le serveur existant `5174` dans
Safari Technology Preview. Ces essais utilisaient en partie des événements
synthétiques et ne constituent pas une validation native complète. Ils restent
des éléments de contexte, pas des critères de fin du plan.
