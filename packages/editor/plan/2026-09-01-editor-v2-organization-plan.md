# Plan d'organisation — migration de l'éditeur vers CodPlay V2

**Statut : En cours — C1/S1, B1–B3, D1 de base, D2 et R1 de la verticale
position/taille sont implémentés et vérifiés ; l'édition à un temps interpolé
(`isTemporary`) est raccordée au candidat V2 et son cas seek/rebuild est vérifié ;
la capture de keyframe compose désormais le snapshot interpolé au temps exact et
le candidat d'édition ;
la rotation avec axe déplaçable est maintenant raccordée dans l'entrée V2 du cadre
et dans le bridge décor ; la preuve navigateur de cette extension reste à exécuter ;
les bornes de visibilité premier/dernier keyframe et l'héritage des transitions
de capsule sont maintenant raccordés au builder et au rendu timeline ;
la matrice globale reste en cours avec S2 et les contrôles complémentaires dans Safari Technology Preview.
Les extensions hors verticale ne sont pas engagées.**
**Cible :** `ed2` avec la façade CodPlay V2.
**Date de mise à jour :** 2026-09-02.

Ce document est un plan d'actions. Il ne remplace pas les spécifications V2,
ne constitue pas un rapport de reprise et n'ajoute pas de contrat public par
sa seule existence.

## Objectif

Remplacer la verticale de dialogue éditeur/player V1 par une organisation V2
centrée sur `instance.snapshot`, tout en conservant des modules autonomes et
leurs contrats propres :

- `sequence-editor` possède son modèle de timeline et émet des intentions ;
- `decor-editor` est le propriétaire du modèle complet d'apparence de l'item :
  style, contenu visuel, position, taille, rotation, échelle, preview et
  persistance ;
- le Selection Frame est une surface d'interaction du `decor-editor` : il
  produit des deltas px et reçoit une valeur px projetée, mais ne possède ni
  l'apparence ni le document ;
- le player V2 possède l'instance, le snapshot et le transport ;
- une façade de pilotage player exécute et observe les commandes CodPlay V2 ;
  un bridge de coordination indépendant fait coopérer ces modules via le
  contrôleur et les ports de cette façade.

La façade documentaire et son contrat d'historisation restent inchangés.

Le circuit cible est :

```text
EditorScene / xState
        │  buildSceneDocV2
        ▼
SceneDoc V2 — nombres unitless structurés
        │  codplay.build()
        ▼
CompiledScene — longueurs logiques qualifiées par CodPlay
        │  instance
        ▼
instance.snapshot.get()
        │
        ├── état logique → `decor-editor` résout l'apparence complète de l'item
        │                    ├── valeur px → Selection Frame
        │                    └── valeurs de vue → panneaux de décor
        │
        └── geste du Selection Frame en px, piloté par `decor-editor`
                │
                ▼
        patch logique unitless → instance.snapshot.set()
                │
                ▼
        présentation V2 → état relu par snapshot

commit éditeur : snapshot.clear() → commande xState → rebuild V2
```

Le cadre de sélection reste un overlay appartenant à l'éditeur, mais sa
propriété fonctionnelle relève de `decor-editor`. Il constitue une partie de
son interface, au même titre que les panneaux de palette. Il ne reçoit pas de
node du player et n'écrit pas dans le DOM du player :

```text
DecorEditorController — modèle complet de l'apparence
        │
        ├── panneaux de palette / contenu / CSS libre
        │       └── patches de décor
        │
        └── Selection Frame — interaction position/taille/transform
                ├── valeur courante projetée en px
                └── deltas de geste en px

decor-editor → bridge de coordination → port snapshot V2
```

Le Selection Frame n'est donc pas un module frère de `decor-editor` dans la
composition métier. Le package `selection-frame` fournit les mécanismes de
geste et d'overlay ; `decor-editor` en possède l'usage, la valeur présentée,
la conversion et la décision de preview/commit.

## Invariants à préserver

- `instance.snapshot` est la surface V2 de lecture de l'état et de preview.
  La surface actuelle est `get`, `set`, `clear`.
- `snapshot.get()` lit l'état logique de base au temps présenté et n'inclut
  pas la preview active. `snapshot.set()` remplace atomiquement la preview et
  `snapshot.clear()` l'abandonne.
- Les longueurs structurées de position et de taille sont transportées comme
  nombres `unitless`. CodPlay les qualifie selon sa configuration ; la valeur
  actuelle de configuration est `cqw`.
- La qualification `unitless → cqw` se fait une seule fois dans CodPlay. Le
  builder éditeur ne fabrique ni objet `cqw` ni texte CSS.
- La projection en pixels dépend du contexte de racine du player. Elle ne
  modifie ni le nombre logique ni le snapshot.
- Les opérations de geste du cadre restent exprimées en pixels pendant
  l'algèbre graphique. Le passage vers la donnée logique se fait au bord du
  bridge V2, pas dans une séquence de reconversions au fil des seeks.
- `rotate` et `scale` restent dimensionnels respectivement en degrés et en
  facteurs. Les chaînes CSS libres, les propriétés custom, `calc()`,
  `line-height` et les propriétés discrètes ne sont pas qualifiées comme des
  longueurs.
- En mode édition, `sequence-editor` reste propriétaire de la progression
  auteur (`playheadMs`). Il émet une intention de seek vers la façade de
  pilotage player de l'éditeur ; le bridge de coordination commande le player
  par `SEEK` puis publie l'accusé de réception.
- En mode lecture, `sequence-editor` et sa télécommande intégrée commandent
  l'animation par la façade de pilotage player de l'éditeur, dont l'unique
  backend CodPlay est `instance.telco`. La séquence historique reste `play`,
  `pause`, `rewind`, `rate` et seek. `telco.onProgress()` alimente les vues de
  progression, mais ne pilote pas le cadre de sélection pendant l'édition. La
  connexion cible est exclusivement V2.
- Le passage lecture → édition fait une réconciliation unique du temps
  player vers le temps auteur ; il ne crée pas une écriture concurrente à
  chaque notification. `telco.onChange` est observé par la façade de pilotage
  pour le lifecycle et relayé par le bridge ; `events` reste réservé aux
  événements publics. Aucune de ces surfaces ne devient un second canal de
  décor.
- La verticale cible ne conserve aucune méthode ou type V1 : pas de
  `AuthorApi`, `getNodePose`, `setNodePose`, `subscribeToNode`, player V1,
  remote V1 ou cache de pose V1.
- La machine xState existante reste propriétaire de `EditorScene`, de la
  sélection, des mutations documentaires, de la persistance et du commit. La
  façade documentaire (`packages/editor/src/app/commands/facade.ts`) reste
  pure et constitue la voie d'historisation. Une façade de pilotage player
  séparée exécute et observe le transport ; le bridge de coordination est son
  composant frère, créé par la composition de l'application, et relie ses ports
  aux modèles autonomes. La façade ne crée, ne possède et ne détruit pas ce
  bridge. Le bridge de scène garde le cycle de vie de l'instance V2 et ne publie
  aux autres modules qu'un port snapshot minimal.
- Lorsqu'une instance V2 est remplacée, un seek auteur est borné par la durée
  auteur validée de l'`EditorScene`, puis converti avec le `preRollMs`. L'horizon
  runtime découvert d'une instance fraîche ne peut pas ramener ce seek à zéro.

## Lecture de cohérence — readiness des tranches

La lecture croisée du plan actif, du code de façade V2 et des ports actuels
fixe les points suivants avant toute implémentation :

- la construction applicable est `codplay.build({ scene })`, puis
  `codplay.instances.create(...)`. Le code, les types publics et l'amendement
  final du plan de façade V2 convergent sur cette forme ; les occurrences
  anciennes de `engine.builder.compile(...)` dans ce plan core ne sont pas une
  API à utiliser pour l'éditeur ;
- la surface d'édition disponible est exactement
  `instance.snapshot.get/set/clear`. `snapshot.onChange` ne fait pas partie de
  C1, S1 ou B1–D2 ; il reste l'étude S2 séparée ;
- pour la première verticale limitée aux quatre longueurs explicites
  `x/y/width/height`, le bridge peut produire une `SelectionFrameValue` en px
  locaux à la racine à partir du snapshot logique et de la largeur de la
  racine. Cette verticale n'ouvre donc aucun canal de géométrie du player et ne
  lit pas le node player. Les géométries naturelles de grille, les conteneurs à taille
  intrinsèque et les repères complexes restent hors de cette tranche ; ils
  nécessiteraient une feature core distincte, non un fallback caché ;
- `PLAYER_READY` et `authorApiReady` sont supprimés sans événement de
  remplacement dans le contrôleur central. Le bridge de scène enregistre
  directement l'instance et son port snapshot auprès de la composition et du
  bridge de coordination ; la machine centrale ne devient pas un registre de
  lifecycle player ;
- `RECONCILE_PLAYBACK_TIME` désigne un rendez-vous interne du bridge de
  coordination. Après une pause ou un rewind vérifié, le bridge appelle une
  méthode silencieuse du port `sequence-editor` (mise à jour locale de
  `playheadMs` sans `onPlayheadChange`) ; il n'ajoute pas d'événement au
  contrôleur central, ne produit pas de `SEEK` et n'ajoute pas d'entrée
  d'historique.

Ainsi, C1 et S1 sont implémentés sur la façade V2 existante et B1–B3, D1, D2
et R1 ont une réalisation dans l'éditeur. Le parcours réel Firefox de la
verticale position/taille est validé ; les limites et validations restantes
sont celles indiquées dans l'état courant ci-dessous.

## Baseline initiale — intégration `decor-editor` / CodPlay V2

Cette section conserve le constat établi avant l'implémentation des tranches
B1–B3. Elle ne décrit pas l'état courant et ne crée aucun contrat
supplémentaire.

| Partie contrôlée | État constaté | Écart avec la cible du plan |
| --- | --- | --- |
| `builder-v2/build-scene.ts` | Existe, produit un `SceneDoc` V2 et est accepté isolément par le compilateur V2. | Il n'est pas appelé par `scene-player-bridge.ts`, qui utilise encore `builder/build-scene.ts`. B2 reste à réaliser. |
| Géométrie du builder V2 | `builder-v2/decor-resolution.ts` transforme encore les longueurs en objets `EditorV2CqwLength` (`kind: 'length', unit: 'cqw'`). | Le plan cible des nombres unitless transmis à CodPlay, avec la qualification `cqw` dans sa configuration. C1/B2 doivent modifier le builder et ses tests ; les tests actuels figent encore cet écart. |
| Interpolation combinée du décor | `buildInterpolationActions` agrège structurellement les propriétés du style résolu dans une action d'item ; les tests présents couvrent une couleur seule et une géométrie inchangée, pas une couleur et une géométrie toutes deux modifiées. | Ajouter un test de transition combinée puis une preuve navigateur sur le circuit V2 réel. Cette preuve doit établir qu'il n'existe ni action ni circuit concurrent pour la position et la couleur. |
| `DecorEditorController` / `decorEditorMachine` | Le modèle de décor est séparé, xState, et porte les patches, la sélection d'items attachés et la résolution de palette. | Le code ne lui rattache pas encore le Selection Frame comme interface de position/taille/transform et ne lui fournit pas le port snapshot prévu par D1. La cible fixe ce rattachement : le décor reste propriétaire, le cadre reste son outil d'interaction. |
| Preview des panneaux | `decor-editor/mount.ts` s'abonne à `subscribeToNode` et écrit directement le décor résolu dans le node du player. | Aucun `instance.snapshot.set()`/`clear()` ; le montage doit devenir une vue de ports éditeur et ne plus observer ni muter le node. |
| Lecture de l'état temporaire | `decor-editor-bridge.ts` lit `AuthorApi.getPersoStates()` et `offset-editor-bridge.ts` lit `AuthorApi.getNodePose()`. | Le retour doit venir de `instance.snapshot.get()` au temps présenté, via le bridge de coordination, sans API node ni `AuthorApi`. |
| Position et taille | `offset-editor-bridge.ts` utilise `TrackedSession`, `LibreAdapter`, `NodePose`, `referenceWidthPx` et les conversions `px ↔ cqw` ; `DecorEditorController` reboucle encore `onValues → applyPatch → offsetBridge.apply`. | Le circuit cible est `SelectionFrameValue` en px → interface du `decor-editor` → patch unitless → `snapshot.set()`, avec une seule conversion au bord de l'interface. D1/D2 restent à faire. |
| Composition de l'application | `AppLayout` monte trois bridges indépendants ; la région telco est vide. | `EditorPlayerCommandFacade` et `editor-coordination-bridge` n'existent pas encore et ne sont pas composés au niveau de l'application. B1 reste à faire. |
| Bridge de scène | `scene-player-bridge.ts` importe `codplay-v1`, construit `AuthorApi`/`SelectionFrame`/`TrackedSession` et appelle directement `telco` V1. | Il doit être remplacé par le cycle V2 et exposer seulement le port `snapshot`/lifecycle ; il ne doit plus construire ni posséder le Selection Frame. Celui-ci est monté par l'intégration `decor-editor`. B2/B3 restent à faire. |
| Historisation | Les changements de décor sont accumulés puis envoyés par `RUN_TRANSACTION`; le contrôleur appelle la façade documentaire pure `transaction`. | Ce point est conforme et doit être conservé. Le remplacement V2 ne doit pas déplacer les commandes documentaires ni historiser les commandes de transport. |
| `width`/`height` | La palette par défaut édite `style.width`/`style.height`, tandis que le cadre produit `offset.width`/`offset.height`. | La valeur unique ou la réconciliation reste la décision séparée déjà notée en §8 ; D1 ne doit pas la résoudre implicitement. |

La conclusion opérationnelle est donc : la verticale principale est bien
`decor-editor` — le décor porte l'ensemble de l'apparence de l'item et le
Selection Frame en est une interface — mais son raccordement au player V2
n'existe pas encore dans le code exécuté. La partie V2 disponible est le
builder isolé et ses tests ; elle ne constitue pas cette intégration. Les
tranches B1, B2, B3 et D1 sont précisément le travail de migration de cette
verticale principale, avant D2.

La validation ciblée précédemment annoncée est retirée du projet.
`decor-editor-bridge.spec.ts`, `decor-editor/mount.spec.ts` et
`decor-editor-controller.spec.ts` utilisent des doubles
`AuthorApi`/`subscribeToNode` ou valident la boucle V1 ; elles ne doivent plus
être exécutées comme preuve de progression. Elles seront supprimées ou
réécrites sur `instance.snapshot`, le `DecorEditorController` V2 et le
Selection Frame intégré à `decor-editor`. Le test `builder-v2` reste une
base V2 isolée, mais ses attentes `cqw` doivent être remplacées par les
nombres unitless et complétées par le cas d'interpolation combinée. Aucun
résultat d'une suite qui importe ou simule V1 ne peut faire avancer une porte
du présent plan.

Le typecheck de l'éditeur de cette baseline pouvait conserver des erreurs
héritées tant que le code V1 concerné était retiré ; le résultat courant est
consigné dans le rapport de reprise dédié ci-dessous.

## État historique à la pause — fin de B3 (2026-09-01)

Cette section conserve le point de reprise intermédiaire avant D1/D2/R1. Elle
est historique et ne décrit pas l'état courant.

| Tranche | Réalisation présente | Limite à la reprise |
| --- | --- | --- |
| C1/S1 | CodPlay qualifie les longueurs structurées numériques selon la configuration `cqw`; `snapshot.get/set/clear` est exposé par l'instance et couvert par les tests ciblés. | La preuve navigateur Play/Seek/resize et la matrice complète restent à exécuter. |
| B1 | `EditorPlayerCommandFacade` possède la référence d'instance, le `preRollMs`, les appels `telco` et les abonnements `onChange/onProgress`; `EditorCoordinationBridge` est créé au niveau de `AppLayout`. | Le port du décor n'est pas raccordé à ce stade : ce raccordement relève de D1. |
| B2 | `scene-player-bridge` utilise `buildSceneDocV2`, `codplay.build`, preload CSS/ressources, une instance V2 et une transaction de remplacement; il transmet le port `snapshot` à la coordination. | Aucun parcours navigateur réel n'a encore validé le cycle complet, le rebuild ou l'échec de remplacement. |
| B3 | Le contrôleur ne stocke plus `AuthorApi`, `TelcoApi`, `referenceWidthPx`, `offsetBridge` ni `PLAYER_READY`; `sequence-editor` expose un transport générique, conserve `playheadMs` comme progression auteur et adopte le temps player seulement par `PLAYHEAD.RECONCILE`; l'insertion de keyframe lit `coordination.snapshot.get()`. | Le vieux circuit `decor-editor`/`offset-editor-bridge` reste à réécrire ou supprimer dans D1/R1; le typecheck éditeur complet reste donc ouvert. |

### Limites consignées à cette pause (historique)

- D1 n'est pas validé. Le montage de palette a été préparé pour ne plus
  écrire directement dans un node, mais `decor-editor-bridge.ts` et
  `offset-editor-bridge.ts` contiennent encore l'ancien raccord et ne doivent
  pas être présentés comme le circuit V2 final.
- D2 n'est pas engagé. Aucun nouveau contrat public de mesure n'est ajouté à
  cette étape ; le cadre sera raccordé par une interface px interne à
  `decor-editor`.
- R1 n'est pas engagé. Les modules V1 encore isolés dans
  `packages/authoring/selection-frame` et le builder historique seront retirés
  après la preuve D1/D2, selon l'inventaire du plan.

Le détail opératoire, les commandes de validation et le point de reprise sont
dans le [rapport de reprise après B3](./2026-09-01-editor-v2-b3-reprise-report.md).

## État courant après D1/D2/R1 (2026-09-01)

| Tranche | État vérifié | Preuve disponible |
| --- | --- | --- |
| C1/S1 | Les nombres unitless des quatre longueurs structurées sont qualifiés en `cqw` par CodPlay ; `snapshot.get/set/clear` suit le même transport. La frontière HTML ajoute l'unité aux angles numériques avant l'application CSS. | Tests core ciblés : 4 fichiers, 37 tests ; typecheck core passé. |
| B1–B3 | `EditorPlayerCommandFacade` est le seul appelant de `instance.telco`. `EditorCoordinationBridge` est indépendant de la façade et relie le player, `sequence-editor` et `decor-editor`. La progression auteur reste dans `sequence-editor`; la télécommande intégrée à cette interface conserve la séquence de pilotage historique. | Play/Pause/Stop, seek et réconciliation exécutés sur l'outil réel. |
| D1 | La base de `decor-editor-bridge` lit le snapshot, projette en px locaux, maintient une base de geste, preview par `snapshot.set()`, puis commit xState après `snapshot.clear()`. Les panneaux et le cadre ne lisent ni n'écrivent un node player. L'extension V2 autorisant un geste entre deux keyframes sans décor persistant conserve son candidat dans le port de coordination jusqu'à la création du keyframe. À l'insertion, le pont compose toutes les propriétés CSS/pose du snapshot présenté au temps exact et le candidat utilisateur par-dessus. | Move, resize, couleur + géométrie, commit, rebuild et abandon validés sur décor existant ; le cas `isTemporary` est éditable, capturé par un décor frais à la création du KF et sélectionné après insertion. L'intégration seek hors temps → retour au temps preview est couverte par test et par le parcours Safari Technology Preview. La capture sans preview, la fusion candidat + interpolation et l'attente de `SEEK_APPLIED` sont couvertes par les tests V2 et par le parcours Safari Technology Preview sans édition à `2,5 s` : troisième KF sélectionné, couleur interpolée `oklch(0.6 0.24 322.5)`, rotation `7,5°`, pose intermédiaire conservée, aucune erreur ni warning. |
| D2 | `@codplay/selection-frame/v2` est un overlay bas niveau neutre ; il reçoit une valeur px et émet des deltas de geste (`move`/`resize` en px, `rotate` en degrés, `pivot` en fractions). Le bridge d'application conserve la sélection, les unités, l'algèbre de resize ancrée sous rotation, la compensation du déplacement d'axe et le cycle preview/commit. | Tests de l'overlay pour axe/aiguille/rotation/pivot, régressions géométriques du bridge et builder ; parcours navigateur avec cadre visible et rotation/pivot encore à rejouer. |
| R1 | Les bridges, tests, dépendances et chemins V1 de la verticale migrée sont retirés. `packages/authoring/selection-frame` conserve ses autres entrées historiques hors de cette verticale ; seule l'entrée `/v2` est consommée par l'éditeur. | Recherche sans import V1 dans `packages/editor/src` et `packages/editor/package.json` ; suite éditeur V2 passée. |

Le bridge de scène a également été aligné sur la façade CodPlay actuellement
exposée : `instances.create()` reçoit uniquement les options publiques V2
(`root`, `compiledScene` et `functions`). La durée et la déclaration de racine
sont déduites par le runner à partir de la scène compilée ; l'éditeur ne passe
plus `durationMs` ni `mountTargets`.

### Preuve live de la verticale position/taille

Le serveur Vite de l'éditeur et l'outil ont été utilisés dans Firefox headless.
Le parcours réel a établi les rendez-vous suivants :

- sélection par l'identité `data-item-id` rendue par le materializer V2 ;
- cadre et item avec le même rectangle px local à la sélection ;
- déplacement de `24px`, puis commit et rebuild ;
- resize de `40px × 20px`, puis commit et rebuild ;
- Play masque le cadre ; Pause réconcilie une seule fois le temps auteur ;
- seek vers environ `2425ms`, avec interpolation simultanée de couleur,
  position, taille et rotation ;
- Stop revient à `0ms` ; Échap abandonne une preview sans mutation documentaire ;
- passage de la racine de `864px` à `1098px` : les valeurs logiques restent
  identiques et le cadre comme l'item sont reprojetés au même rectangle px.

Le typecheck éditeur, le build éditeur, la suite éditeur V2 et les tests
Selection Frame V2 sont passés. Le contrôle de non-régression post-alignement
a de nouveau matérialisé la scène dans Firefox, fait coïncider le cadre avec
l'item sélectionné, puis suspendu/réaffiché le cadre sur Play/Pause.

Le diagnostic et le correctif du seek de reprise sont consignés dans la
[note V2 du 2 septembre 2026](./notes/2026-09-02-editor-v2-seek-rebuild-diagnostic.md).
La façade de pilotage utilise désormais la durée auteur du builder lors du
rebind d'une instance ; la régression est couverte par un test de façade et un
test d'intégration DOM du cycle seek/reprise. Cette correction ne clôt pas la
matrice Safari Technology Preview ni les extensions hors de la verticale position/taille.

Le core V2 passe aussi son typecheck et sa suite complète (86 fichiers, 541
tests), sans suite `codplay-v1`. Une reproduction initiale, désormais
historique, avait montré dans Safari Technology Preview que les gardes
`isTemporary` rendaient le cadre visible mais bloquaient le déplacement et la
palette. Le parcours corrigé dans Safari Technology Preview autorise maintenant
le geste au temps interpolé, conserve le candidat au seek/rebuild, crée un
décor frais à la pose du keyframe et resélectionne ce keyframe. La matrice
complète (lecture, seek, resize, persistance et cycle de vie) reste à clôturer
sur le parcours final ; les grilles, la taille intrinsèque, les parents
transformés, la multi-sélection et le reparentage restent hors verticale.

### Correctif de grille de page V2 — 2026-09-02

Le défaut de présentation signalé lors de la sélection d'une piste venait de
la combinaison suivante : `.app-layout` dimensionnait la piste timeline avec
`auto`, tandis que `.seq-infobar:empty` était masquée. Son affichage ajoutait
alors une hauteur au track timeline, réduisait le track scène et déplaçait le
lecteur centré. Ce chemin ne reconstruisait pas l'instance et ne concernait
pas la lecture ou le seek.

Le correctif accepté pour la grille V2 est le suivant :

1. réserver la piste timeline par `--app-timeline-height` et dimensionner la
   piste centrale avec `minmax(0, 1fr)` ;
2. placer les boutons provisoires de `DemoMenuRegion` dans la colonne gauche
   de la rangée principale (`menu | scène | panneau`), sans rangée pleine
   largeur au-dessus de la scène, avec `1rem` de padding sur le conteneur, et
   réserver le même padding `1rem` au conteneur de `DecorEditorRegion` ;
3. conserver la zone d'information dans le flux avec une hauteur fixe de
   24 px, y compris lorsqu'elle est vide, avec troncature horizontale si
   nécessaire ;
4. remettre à zéro les marges de la page et les minima intrinsèques des
   régions afin que la grille occupe exactement la fenêtre ;
5. dessiner un outline de présentation sur le conteneur du lecteur de scène,
   sans modifier sa boîte ni son ratio.

L'acceptation est réalisée dans Safari Technology Preview par comparaison des
rectangles avant/après sélection et par contrôle visuel de l'outline. Le
correctif ne modifie aucune frontière de transport, de snapshot ou de
lifecycle V2. Il s'agit de la grille de présentation de la page ; les
extensions de géométrie logique de grille restent une tranche distincte.

Preuve enregistrée : dans Safari Technology Preview, à `1300 × 796` CSS, les
rectangles avant et après sélection sont identiques (`menu 0,0,220,595`,
`scene 220,0,800,595`, `player 221,73.0625,798,448.875`, `timeline y=595,h=199`,
`infobar h=24`). Les trois boutons de test restent dans la colonne gauche
avec le padding `1rem` (`x=17`, `y=17/43/69`, `w=186`). À `1024 × 664` CSS exposés par la fenêtre
demandée `1024 × 768`, ils restent également identiques (`menu 0,0,220,496`,
`scene 220,0,524,496`, `player 221,101.1875,522,293.625`, `timeline y=496,h=166`,
`infobar h=24`). Le conteneur du décor réserve également `1rem` autour de sa
palette. La racine
`.editor-v2-instance-root` reste unique et identique pendant
sélection/désélection ; la console STP ne signale ni erreur ni avertissement.

### Correctif de resize ancré sous rotation V2 — 2026-09-02

Le premier calcul du bridge ajoutait `dx`/`dy` directement à `width`/`height`
et reconstruisait `x`/`y` sur les axes non tournés. Comme le cadre V2 applique
la rotation et l'échelle autour de son centre, le côté opposé dérivait dès
qu'un item était tourné.

Le bridge projette maintenant le delta dans les axes locaux de la pose de base,
applique la borne minimale de `4px`, puis translate le centre selon la moitié
de la variation effectivement acceptée. Le côté opposé (ou le coin opposé)
reste ainsi au même point visuel pour les poignées latérales et angulaires ;
la rotation et l'échelle restent inchangées. Le calcul reste dans la frontière
`decor-editor`/Selection Frame et n'ajoute aucun accès au player ou au core.

La régression est couverte par deux tests V2 : côté opposé d'un resize latéral
avec rotation, puis coin opposé d'un resize angulaire avec rotation et échelle.
La vérification dans Safari Technology Preview reste à exécuter sur le parcours
réel ; elle ne peut pas être déclarée comme preuve tant que l'automatisation
WebDriver/Apple Events n'est pas activée dans les réglages développeur de cet
environnement.

### Extension V2 rotation et axe déplaçable — 2026-09-02

La première verticale avait laissé `rotate`/`scale` hors du circuit du cadre ; la
spécification dedit §6.0.2 arrête maintenant leur intégration V2. L'entrée
`selection-frame/v2` compose un modifieur de rotation indépendant : il rend une
aiguille et un pivot central par défaut, émet un delta angulaire autour d'un
pivot figé pendant le geste, puis accepte le déplacement du pivot en fractions
locales. Le rayon de l'aiguille est au moins
`36px` et la variation angulaire est arrondie au degré (`Shift` : pas de `15°`),
ce qui conserve la finesse accrue quand le pointeur s'éloigne de l'axe.

`rotationOrigin` est stocké dans `Decor.offset` en fractions `[0,1]` et le
builder le matérialise en `transform-origin`. Le déplacement du pivot compense
la translation par l'algèbre de la pose courante pour éviter un saut visuel ;
rotation, pivot, preview temporaire et commit empruntent ensuite exactement le
même canal snapshot/xState que move/resize. Aucun accès de node ou contrat V1
n'est réintroduit.

Le cadre de base ne connaît pas le vocabulaire de la rotation : le modifieur
expose `update/reset/destroy` et réserve seulement les poignées magnétisées par
le contexte de composition. Cette frontière permet d'ajouter une future
capacité du CS sans modifier move/resize ni le bridge décor.

Les tests couvrent l'affichage et les gestes de l'overlay, la composition d'un
modifieur indépendant, l'ancrage visuel lors du changement d'axe, la conversion
px↔offset et le mapping builder. La preuve
du parcours réel dans Safari Technology Preview (rotation, déplacement d'axe,
seek/rebuild et persistance) reste obligatoire avant de déclarer cette extension
stable ; l'automatisation est encore désactivée dans l'environnement courant.

### Bornes de visibilité et transitions héritées V2 — 2026-09-02

Le contrat V2 de `sequence-editor` est maintenant explicite : pour un item, le
premier et le dernier keyframes selon `timeMs` sont les frontières d'entrée et de
sortie, même si leurs noms réservés `intro`/`outro` sont absents. Une transition
nommée portée par le premier kf se termine à cet instant ; une transition portée
par le dernier commence à cet instant. Déplacer une borne déplace donc son
déclenchement, tandis que sa durée reste attachée au keyframe. Un item qui ne
porte qu'un seul kf fixe son entrée ; la distribution conserve une sortie
virtuelle pour éviter une fenêtre nulle.

La capsule parente fournit les transitions par défaut quand le kf de bord n'en
porte pas explicitement. La capsule racine implicite est le `card` qui représente
la scène : elle n'est pas affichée comme item et ne possède pas de keyframes,
mais ses défauts `fade/fade` sont résolus sur ses enfants directs. Les capsules
explicites transmettent de la même façon leurs `defaultTransitionIn/Out` selon
leur type ; un choix nommé sur le kf prime le défaut. `preRollMs` reste une
réservation technique de la façade player et ne change jamais le temps auteur.

Un enfant direct sans keyframe reste présent sur toute la durée `scene.meta.durationMs` ; la root
implicite lui applique donc une fenêtre complète et non une durée nulle. Un seul kf réel fixe
l'entrée et laisse toujours la distribution fournir la sortie virtuelle.

Pour éviter deux résolutions divergentes, `resolveAutoCapsuleDefaults` est
désormais partagé par `capsule-automation` et `buildSceneDocV2`. Le builder
calcule les locks avec les durées effectives (défaut ou override), transmet ces
défauts à `AutoCapsule`, et le rendu timeline cherche les bornes premier/dernier
plutôt que les seuls noms. Les tests builder et player couvrent le déplacement
de la première frontière, l'héritage d'une transition de capsule et la lecture
réelle avant/après le déplacement ; les tests de la machine couvrent aussi le
cas du kf unique. La preuve visuelle complète reste à rejouer dans Safari
Technology Preview avant toute clôture de la matrice.

## Audit ciblé — façade documentaire et machines d'état

Cette section fixe ce qui se trouve effectivement derrière la façade de
commandes et dans les machines d'état. Elle sépare les éléments à préserver
des références V1 à retirer. Elle complète l'inventaire d'intégration ci-dessus
et ne constitue pas une nouvelle API implémentée.

### Façade actuellement en place : à préserver

`packages/editor/src/app/commands/facade.ts` est la façade de mutation du
document. Elle ne dépend ni de CodPlay V1 ni d'un player :

- `runCommand` et `runCommandWithResult` routent les commandes de base et les
  commandes pures de `sequence-editor` ;
- `transaction` compose ces mêmes commandes et retourne la scène finale ;
- `packages/editor/src/app/commands/base-commands.ts` et
  `packages/editor/src/sequence-editor/commands.ts` restent des fonctions
  pures ;
- dans le code de production, la machine de contrôleur est le point qui
  applique ces fonctions à `context.scene` via `RUN_COMMAND` et
  `RUN_TRANSACTION`.

Cette façade et ce contrat d'historisation ne doivent pas être remplacés par
la façade player. Aucun `telco`, `snapshot`, nœud DOM ou handle de sélection
ne doit y être ajouté. Les tests unitaires des commandes pures et de
`facade.ts` restent donc pertinents, même s'ils appellent directement les
fonctions internes pour tester leur composition. Le commentaire de
`base-commands.ts` qui mentionne encore « en v1 » doit seulement être reformulé
pour décrire le modèle ed2 ; la commande `assignType` n'est pas à retirer pour
cette raison.

La façade distincte créée pour le player est
`EditorPlayerCommandFacade`. Elle recevra une instance CodPlay V2 et exposera
les commandes de transport ainsi que les retours nécessaires au bridge de
coordination. Elle ne prendra pas en charge les mutations documentaires ni
l'historisation.

### Audit initial — écarts et retraits de la verticale V1

Cet audit décrit l'état de départ et les cibles de migration. L'état atteint
après exécution de ces actions est consigné dans « État courant après
D1/D2/R1 » ; les entrées qui mentionnent un fichier retiré sont conservées
comme traçabilité du retrait, pas comme actions encore à réaliser.

| Frontière | Ce qui existe aujourd'hui | Modification V2 requise | Retrait V1 précis |
| --- | --- | --- | --- |
| `app/controller/types.ts` | `ControllerContext` conserve `authorApi`, `referenceWidthPx`, `offsetBridge` et `telco: TelcoApi` ; `PLAYER_READY` transporte ces handles. | Conserver dans le contexte la scène, la sélection, les panneaux, le geste d'édition et les phases `idle/creating/playing`. Retirer les handles runtime et faire communiquer le bridge avec les ports V2 en dehors de ce contexte. | `AuthorApi`, `TelcoApi`, `OffsetEditorBridge`, `authorApi`, `referenceWidthPx`, `offsetBridge`, `telco`, `PLAYER_READY` et `authorApiReady`. |
| `app/controller/controller-machine.ts` | Les actions `setAuthorApi` et `emitAuthorApiReady` écrivent puis réémettent les handles V1. La machine applique correctement `runCommand`/`transaction` et porte les phases de l'éditeur. | Supprimer le stockage et la propagation des handles. Préserver `runCommand`, `runTransaction`, les événements de scène, `SEEK`, `SEEK_APPLIED`, `flushPending` et `playbackActiveChanged`. Les intentions de lecture/pause restent des intentions de l'éditeur ; elles ne doivent plus appeler un telco depuis la machine. | Actions `setAuthorApi`/`emitAuthorApiReady`, contexte runtime et tout accès direct à `AuthorApi` ou `TelcoApi`. Les transitions `idle/creating/playing` ne sont pas V1 à supprimer : elles restent le mode d'édition et de lecture de l'éditeur. |
| `sequence-editor/machine.ts` et `controller.ts` | Le commentaire et `TELCO.SYNC_PLAYHEAD` traitent le playhead reçu du telco comme une source de vérité ; `syncPlayheadFromTelco()` l'injecte dans la machine. | Le `playheadMs` reste la progression auteur. Supprimer l'événement de synchronisation telco. Ajouter, dans le port de coordination défini en B3, une réconciliation silencieuse au retour de lecture si le playhead auteur doit rejoindre le temps courant ; elle ne doit pas produire une nouvelle intention `SEEK` ni une entrée d'historique. | `TELCO.SYNC_PLAYHEAD`, son handler, `syncPlayheadFromTelco()` et les commentaires qui présentent `TelcoApi` comme source du playhead. |
| `sequence-editor/mount.ts` et `sequence-editor-bridge.ts` | Le mount importe `TelcoApi`/`PlayerStateSnapshot`, possède un telco local, s'y abonne et appelle `play`/`pause`. Le bridge lit `context.telco` et appelle `attachTelco`. | Le mount reçoit uniquement des commandes et états de transport génériques fournis par le bridge de coordination. Les boutons conservent leur comportement historique via ces intentions. Le scrub auteur continue d'émettre `SEEK` ; la progression player affichée ne réécrit pas continuellement `playheadMs`. | Imports V1, `attachTelco`, telco local, abonnements `onChange`/`onProgress` et appels directs `telco.play/pause`. |
| `builder/build-scene.ts` | L'ancien constructeur de scène importe encore `SceneDef`, `Perso` et `StoryDef` depuis `codplay-v1`; il est encore appelé par `scene-player-bridge.ts`. `builder-v2` existe séparément. | Faire de `builder-v2` l'unique constructeur appelé par la verticale V2, adapter ses entrées au document ed2 et supprimer l'ancien module après migration des tests et de l'import du bridge. | Le fichier `builder/build-scene.ts` dans sa forme V1, ses types `SceneDef`/`Perso`/`StoryDef` V1 et les commentaires qui renvoient à l'adapter V1. |
| `decor-editor/machine.ts` | La machine ne contient pas d'import V1 ; elle porte les items, le décor, la chaîne, les patches et le statut temporaire. | Conserver ce modèle d'état autonome. Alimenter le statut temporaire et la prévisualisation par le port de snapshot logique fourni par la coordination ; le commit continue de produire une commande documentaire via la façade conservée. | Aucun retrait mécanique dans cette machine. Retirer seulement les sources V1 auxquelles ses contrôleurs la relient. |
| `decor-editor/controller.ts`, `types.ts`, `merge.ts` | Le contrôleur dépend de `OffsetEditorBridge` ; les types importent `ClassNameValue` depuis `codplay-v1` et exposent une interface de frame couplée à `AuthorApi`/`TrackedSession`. | Garder le contrôleur comme propriétaire des valeurs d'apparence et des patches. Remplacer la frontière par un port neutre de Selection Frame en px ; convertir une fois à la frontière décor (`px ↔ cqw`) et envoyer un patch cohérent au bridge, qui prévisualise par `instance.snapshot`. Conserver l'algorithme de merge pur. | `ClassNameValue` V1, `OffsetEditorBridge`, `AuthorApi`, `LibreAdapter`, `TrackedSession`, `NodePose`, `DecorLiveSession` dans le port public et toute conversion pilotée par un nœud DOM. `DecorLiveSession` ne sera supprimé que s'il n'est plus utilisé après le remplacement du port ; sa sémantique de groupement de geste reste utile. |
| `decor-editor/mount.ts`, `css-value-format.ts`, `decor-editor-bridge.ts` | Le mount observe `subscribeToNode` et écrit directement les décors/textes dans les nœuds player. Les helpers de valeur live relisent `getNodeSnapshot`/`getPersoStates`. Le bridge V1 résout les patches temporaires depuis `AuthorApi`. | Rendre le mount piloté par l'état de la machine et le snapshot logique présenté. Le bridge conserve la séquence pending → preview → commit, mais sa source devient `instance.snapshot.get` ou le port logique fourni par la coordination. Une transition d'apparence complète doit rester atomique (couleur et géométrie du même item). | `subscribeToNode`, `applyResolvedDecor`, écritures de nœud, `getNodeSnapshot`, `getPersoStates` et helpers `AuthorApi`/DOM. |
| `offset-editor-bridge.ts` | Construisait `AuthorApi`, `LibreAdapter`, `TrackedSession` et lisait `NodePose`. | Responsabilité absorbée par `decor-editor-bridge` et l'entrée `selection-frame/v2` : valeur px locale, deltas px, conversion unitless au bord du bridge, preview snapshot et commit xState. | Fichier entier retiré par R1, avec ses imports et tests V1. |
| `scene-player-bridge.ts` | Construit `new CodPlay({})` V1, utilise `studio.telco`, `buildSceneDoc`, `createAuthorApi`, `createSelectionFrame`, `createTrackedSession`, puis transmet des handles à la machine. | Réécrire le bridge autour de `CodPlay` V2 (`build` → `preload` → `instances.create`). Il possède le cycle de vie de l'instance, fournit le port snapshot/lifecycle et enregistre l'instance auprès de `EditorPlayerCommandFacade`. Il ne crée ni frame ni session d'édition et ne transmet aucun handle V1 à l'éditeur. | Import `codplay-v1/creator`, `studio.telco`, `buildSceneDoc` V1, `AuthorApi`, `LibreAdapter`, `createSelectionFrame`, `createTrackedSession`, `NodePose` et le montage frame/session du bridge. |
| Composition `main.tsx` / `AppLayout` / régions | Les régions montaient trois bridges indépendants ; la région telco est restée vide. | Une unique `EditorPlayerCommandFacade` et un unique `editor-coordination-bridge` sont composés dans `AppLayout`. `sequence-editor` porte aussi la télécommande de l'éditeur et reçoit des ports génériques ; le bridge n'appartient ni à la façade documentaire ni à une région. | Toute injection de `AuthorApi`, `TelcoApi`, `OffsetEditorBridge` ou `codplay-v1` dans les régions et bridges éditeur. |
| Configuration `packages/editor` | `package.json`, `tsconfig.json` et `vite.config.ts` déclarent encore la dépendance, les paths, le polyfill et l'alias `codplay-v1`. | Retirer ces déclarations après migration des sources et tests. `@codplay/selection-frame` peut rester une dépendance uniquement si son API consommée par l'éditeur est V2-neutre ; le package ne doit pas être supprimé globalement sans audit des autres consommateurs. | Dépendance directe `codplay-v1`, alias Vite, path TypeScript et inclusion du polyfill V1. |

### Cible de la machine de contrôleur

Après B1–B3, la machine centrale doit avoir une responsabilité lisible : état
du document, sélection, panneaux, geste d'édition et mode `playing`. Elle ne
doit pas être le registre de l'instance CodPlay. La façade player et le bridge
de coordination possèdent les références runtime ; la machine reçoit
uniquement les événements métier nécessaires à l'éditeur.

Le circuit à conserver est donc :

1. une commande documentaire ou une transaction entre par la machine et est
   appliquée par `app/commands/facade.ts` ;
2. `sceneCommitted` est relayé au bridge de coordination ;
3. le bridge demande au player facade la reconstruction V2 et/ou la
   prévisualisation snapshot ;
4. les retours de lecture et les acquittements `SEEK_APPLIED` reviennent sous
   forme d'événements sans handle runtime ;
5. un commit de décor revient à la machine comme commande/transaction
   documentaire, jamais comme mutation directe du player.

La machine de `sequence-editor` conserve le modèle autonome de séquence, sa
sélection et son playhead auteur. La machine de `decor-editor` conserve les
patches et le statut de geste. Aucune des deux ne doit importer CodPlay,
`TelcoApi`, `AuthorApi` ou observer un nœud player.

### Tests et preuves V2

Les tests V1 ont été retirés de la commande de validation ou supprimés avec les
fichiers qu'ils couvraient. Les tests éditeur conservés ont été réécrits sur
les ports V2 et couvrent sélection, scène, transactions, phases, snapshot,
interpolation couleur + géométrie, preview, abandon, commit, rebuild et
réconciliation silencieuse. Le test navigateur complète cette couverture sur
le chemin réel.

Les commandes et résultats sont consignés dans l'état courant et le rapport de
reprise ; aucune suite qui importe `codplay-v1`, `AuthorApi`,
`subscribeToNode` ou une pose DOM V1 ne compte dans la validation V2.

Le critère de sortie n'est pas « les anciens tests passent » : aucune suite
qui importe `codplay-v1` ou les handles V1 ne doit être dans la commande de
validation V2, et les preuves retenues doivent traverser façade documentaire,
bridge de coordination, façade player, instance V2 et rendu réel.

## Choix opératoires qui lèvent les ambiguïtés

Les choix suivants constituent la proposition concrète de migration. Ils
évitent d'ouvrir une nouvelle API de géométrie dans CodPlay et restent dans la
surface V2 déjà retenue : `instance.snapshot`.

### Transport de la géométrie

Le schéma `SceneDoc` n'est pas enrichi d'un champ `geometry` ou `offset` et la
façade snapshot ne reçoit pas une seconde famille de patches. Le transport
reste le `style` déjà accepté par `SceneDoc` et par `instance.snapshot`.

Dans ce transport, quatre propriétés numériques sont réservées à l'offset
structuré de l'éditeur :

```ts
state: {
  style: {
    x?: number
    y?: number
    width?: number
    height?: number
  }
}
```

Ces nombres sont unitless. Cette règle est un contrat de transport explicite,
pas une qualification générique de toutes les valeurs numériques CSS :

- le builder V2 produit `x` et `y` depuis `offset.translate.x/y` et produit
  `width` et `height` depuis `offset.width/height` ;
- `offset.x/y`, encore présents dans les données existantes, sont lus comme
  alias d'entrée ; si `translate` et l'alias coexistent, `translate` gagne,
  comme dans le mapping actuel ; l'éditeur migré n'émet plus les alias ;
- `rotate`, `scaleX` et `scaleY` restent des nombres sans dimension ;
- `Decor.style` reste réservé aux valeurs CSS chaîne dans l'éditeur ; les
  champs de palette de dimensions sont donc déplacés vers `offset.width` et
  `offset.height` ;
- les nombres qui ne sont pas ces quatre champs, les chaînes CSS, `calc()`,
  `line-height`, `opacity`, les propriétés custom et les valeurs discrètes ne
  sont pas qualifiés par cette règle.

CodPlay applique la qualification des quatre champs numériques au passage
`SceneDoc → CompiledScene` et au passage du patch reçu par
`instance.snapshot.set()`. Les deux passages utilisent la même fonction de
qualification et la même configuration. L'éditeur ne crée jamais
`{ kind: 'length', unit: 'cqw', value }`.

La configuration porte actuellement la constante `cqw`. Elle décrit le
repère logique choisi pour cette application ; elle ne transforme pas `cqw`
en convention normative de l'éditeur ni en second canal de géométrie.

### Unité d'interpolation du décor

La migration doit corriger une limitation fonctionnelle du circuit V1 : son
intégration incomplète entre le décor, le cadre et le player ne garantissait
pas qu'une même transition d'item puisse interpoler simultanément une
propriété de position ou de taille et une propriété visuelle, par exemple
`background-color`. La cible V2 ne sépare pas ces propriétés en deux
animations concurrentes.

Pour chaque item et chaque intervalle entre deux états, l'unité d'animation
est le décor effectif complet résolu par `decor-editor` et transmis au
builder. Une transition peut donc contenir dans le même payload `style` :

```ts
{
  "background-color": { from: "red", to: "blue", duration: 300 },
  x: { from: 10, to: 30, duration: 300 },
  width: { from: 20, to: 30, duration: 300 }
}
```

Les valeurs de position et de taille restent les nombres unitless définis
ci-dessus ; leur qualification `cqw` est appliquée par CodPlay comme pour
les autres états. Le builder V2 doit fusionner le style visuel et la
géométrie résolue avant de calculer le diff entre les deux états. Il produit
une action d'item portant ces propriétés ensemble, avec le même intervalle,
déclenchement et temps de présentation. Il ne produit pas une action de
position séparée de l'action de couleur et le Selection Frame ne crée jamais
une animation player concurrente.

Cette règle s'applique aussi à l'édition : palette, contenu et Selection
Frame passent par le même `DecorEditorController` et le même bridge. Une
preview réunissant plusieurs propriétés est envoyée comme une mise à jour
atomique du snapshot ; le commit persiste le patch cohérent par la commande
xState. Après rebuild, le builder doit reconstruire la même transition
combinée. La réussite visuelle d'une couleur seule ou d'une géométrie seule
ne valide donc pas cette verticale.

### Source et synchronisation du cadre

Le cadre ne lit pas le DOM du player et ne demande pas de mesure à CodPlay.
En mode édition, la progression de référence est celle de
`sequence-editor`, pas celle rapportée par `telco`. Le bridge éditeur possède
les seules opérations suivantes :

1. `sequence-editor` émet une intention de `SEEK` avec son `playheadMs`
   auteur ; le bridge de coordination la remet à
   `EditorPlayerCommandFacade`, qui convertit ce temps en temps player avec le
   `preRollMs` du builder et est l'unique code autorisé à appeler
   `instance.telco.seek(playerTimeMs)` ;
2. la façade vérifie la position player après le seek et remet au bridge de
   coordination un résultat validé. Le bridge publie alors `SEEK_APPLIED`. Ce signal est un
   accusé de réception, jamais une nouvelle valeur de progression ; une
   réponse ancienne est ignorée si un seek plus récent a été demandé ;
3. sur sélection ou `SEEK_APPLIED`, `instance.snapshot.get()` fournit la base
   logique de l'item au temps de l'éditeur ; le bridge convertit les longueurs
   logiques en pixels avec la largeur actuelle de la racine et remet au cadre
   un `SelectionFrameValue` (`x`, `y`, `width`, `height`, rotation, échelle) ;
4. pendant un geste, le cadre conserve son algèbre en pixels ; le bridge
   convertit la valeur candidate en nombre unitless et l'envoie par
   `instance.snapshot.set()` avec le `playerTimeMs` présenté ;
5. le cadre est rafraîchi avec cette même valeur candidate calculée par le
   bridge. Il ne relit pas `snapshot.get()` pour obtenir la preview, puisque
   `snapshot.get()` exclut volontairement la preview active ;
6. au commit, le bridge conserve le patch unitless, appelle
   `snapshot.clear()`, puis remet ce patch à la commande xState ; le rebuild
   rend la nouvelle base au même `playheadMs` auteur ;
7. à l'abandon, seul `snapshot.clear()` est appelé ;
8. sur changement d'instance ou rebuild, un geste actif est interrompu, la
   preview est effacée, puis la scène est repositionnée sur le
   `playheadMs` de l'éditeur avant la relecture du snapshot.

La synchronisation du cadre en mode édition ne dépend donc pas de
`telco.onProgress()` pour définir le temps, ni de `snapshot.onChange` (non
validé), ni d’un canal de géométrie du player, ni de `AuthorApi`. Le seul retour
du player utilisé par ce circuit est la fin du seek demandé par l’éditeur ;
pendant une preview, la valeur candidate du geste est la seule valeur affichée
par le cadre. Quand la lecture est active, le cadre est suspendu ; il ne suit
pas la progression d'animation par un second circuit.

Pour cette première verticale, `SelectionFrameValue.x/y/width/height` est
exprimé en pixels dans le repère local de la racine de scène. Le bridge calcule
ces quatre valeurs à partir de `snapshot.get().states[*].state.style` et de la
largeur courante de cette racine (`1cqw = largeur / 100`). Le cadre est monté
dans cette même racine d'overlay : il n'a pas besoin de convertir en
coordonnées viewport ni de mesurer le node du player. Les items dont la boîte
réelle dépend d'une grille, d'une taille intrinsèque, d'un parent transformé ou
d'un autre repère ne font pas partie du scénario position/taille C1–D2 ; ils
restent hors périmètre jusqu'à une décision core distincte.

### Pilotage de l'animation et rôle de la télécommande

L'éditeur possède deux surfaces d'entrée, mais une seule instance V2 :

| Surface | Rôle | Chemin V2 |
| --- | --- | --- |
| `sequence-editor` et sa télécommande intégrée | choisir le temps auteur et piloter play/pause/stop de la scène | intentions vers le port `sequenceEditor` du bridge de coordination |

`sequence-editor` est donc aussi une interface de pilotage, mais son modèle
reste autonome : il ne connaît ni CodPlay ni la télécommande. Son bridge émet
des intentions sémantiques ; le bridge de coordination adapte ces intentions
et celles de la télécommande à `EditorPlayerCommandFacade`. Cette façade
interne à l'application est le seul appelant de `instance.telco` ; elle n'est
pas une nouvelle API CodPlay.

Le câblage à réaliser est le suivant :

| Action | Émetteur | Circuit central | Conséquence sur le temps auteur et le cadre |
| --- | --- | --- | --- |
| scrub de la timeline, clic sur une keyframe ou Stop | `sequence-editor` | `ctrl.seek()` → bridge de coordination → `SEEK` → `EditorPlayerCommandFacade.execute(seek auteur)` → `instance.telco.seek(editorTimeMs + preRollMs)` | la cible du seek est le `playheadMs` auteur ; si la lecture était active, ce `SEEK` termine `playing` et sa cible, non l'ancien temps telco, est adoptée ; après `SEEK_APPLIED`, le snapshot et le cadre sont relus |
| Play | télécommande intégrée à `sequence-editor` | bridge de coordination → `TELCO_ACTION_REQUEST`/flush → `EditorPlayerCommandFacade.execute(play)` → `instance.telco.play()` | entrée dans `playing` ; le cadre et l'édition sont suspendus ; aucun `playheadMs` n'est écrit par `onProgress` |
| Pause explicite | télécommande intégrée à `sequence-editor` | bridge de coordination → `TELCO_PAUSE_REQUEST` → `EditorPlayerCommandFacade.execute(pause)` → `instance.telco.pause()` → résultat vérifié → `RECONCILE_PLAYBACK_TIME` | une seule lecture de `getProgress()`, retrait du `preRollMs`, adoption dans `playheadMs`, puis réactivation du cadre ; aucun `SEEK` supplémentaire |
| Rewind | télécommande intégrée à `sequence-editor` | bridge de coordination → `EditorPlayerCommandFacade.execute(rewind)` → `instance.telco.rewind()` → résultat vérifié → `RECONCILE_PLAYBACK_TIME` | même handoff unique après la commande ; le rewind ne passe pas par une copie continue de `onProgress` |
| Rate | télécommande intégrée à `sequence-editor` | bridge de coordination → `EditorPlayerCommandFacade.execute(setRate)` → `instance.telco.setRate(rate)` | modification du transport uniquement ; aucune modification du `playheadMs` ni du snapshot |

Le bouton Stop conserve la sémantique observée de l'éditeur : il fixe
`sequence-editor.playheadMs` à zéro et émet une intention `seek` au bridge de
coordination. Le bridge passe par `SEEK`, puis demande l'exécution à la façade
player. Il ne déclenche pas un handoff préalable, car la position auteur zéro
est la cible finale. Les boutons Play/Pause passent eux aussi par le bridge et
la façade player afin que le flush, le changement de mode et le handoff soient
identiques depuis les deux interfaces.

La façade de pilotage player doit fournir au bridge de `sequence-editor` un affichage de
progression distinct du `playheadMs` auteur pendant `playing`. Elle recueille
`telco.onProgress()` et le transmet à la vue pour faire avancer le curseur ou
le chrono visibles, mais le timeline ne doit ni appeler `instance.telco` ni
écrire `playheadMs` avec ce flux. À la sortie de lecture,
`RECONCILE_PLAYBACK_TIME` remplace cet affichage temporaire par le
`playheadMs` auteur adopté. En mode arrêté ou édition, `playheadMs` reste la
valeur affichée et la valeur de référence.

### Séparation des modèles et bridge de coordination

Les modules restent autonomes. La coopération ne se fait pas par une référence
directe `sequence-editor ↔ decor-editor` ou `sequence-editor ↔ player`, mais
par le contrôleur et un bridge de coordination créé au niveau de la composition
de l'application :

    AppLayout
      ├─ controller central
      ├─ EditorPlayerCommandFacade → instance.telco
      └─ editor-coordination-bridge
           ├─ sequence-editor-bridge → SequenceEditorController autonome
           ├─ decor-editor-bridge    → DecorEditorController propriétaire de l'apparence
           │                            └─ Selection Frame (surface d'interaction)
           └─ scene-player-bridge    → instance V2 / snapshot

Les responsabilités sont séparées ainsi :

1. `packages/editor/src/app/commands/facade.ts` reste la façade documentaire.
   `runCommand`, `runCommandWithResult` et `transaction` restent synchrones et
   purs. Le contrôleur continue de les invoquer pour les commits ; l'historien
   garde exactement ce point d'accroche. Aucun appel telco, seek ou progress
   n'entre dans cette façade et aucune commande de transport n'est historisée.
2. `SequenceEditorController` reste le modèle autonome de la timeline :
   `scene`/sélection projetés, `playheadMs`, viewport et gestes lui
   appartiennent selon son contrat actuel. Il émet des commandes documentaires,
   des demandes de sélection et des intentions de transport ; il ne reçoit ni
   `CodPlayTelco`, ni instance, ni snapshot.
3. `DecorEditorController` est le propriétaire de l'apparence complète de
   l'item. Il garde l'état éphémère de ses gestes, les patches de style,
   contenu, offset et transform, ainsi que la décision de preview ou de
   commit. `decor-editor-bridge` compose ses panneaux avec le Selection Frame.
   Le cadre ne fait que rendre la valeur px fournie par `decor-editor` et
   émettre ses deltas px vers lui. Le bridge lit `instance.snapshot` aux
   rendez-vous prévus et transforme les valeurs px/logiques ; il ne commande
   pas la telco.
4. `EditorPlayerCommandFacade` est un service d'application distinct de la
   façade documentaire. Il possède l'instance V2 courante et le `preRollMs`,
   est le seul appelant de `instance.telco`, et ne possède ni `EditorScene`, ni
   historique, ni référence aux modules éditeur. Le `scene-player-bridge`
   enregistre le binding telco après `instances.create()` et le désenregistre
   avant la destruction ou le remplacement de l'instance ; le bridge de scène
   reste responsable du cycle de vie et du port `snapshot`. Il ne crée ni ne
   possède le Selection Frame.
5. `editor-coordination-bridge.ts` est un objet indépendant, créé au même
   niveau que la façade par la composition de l'application. Il connaît les
   ports des modules, le contrôleur et la façade player ; il installe les
   abonnements, traduit les intentions, distribue les retours et détruit ces
   raccordements. Il ne devient pas une nouvelle source d'état et n'est pas
   contenu dans `EditorPlayerCommandFacade`.

`EditorPlayerCommandFacade` expose au bridge deux ports internes, sans exposer
CodPlay aux modules :

- un port de commandes pour `seek(authorTimeMs)`, `play()`, `pause()`,
  `togglePlay()`, `rewind()` et `setRate(rate)` ;
- un port d'observation pour l'état de transport, la progression de lecture
  et le résultat de commande.

Le résultat de commande est un résultat de l'éditeur, pas une modification du
contrat CodPlay : il associe la commande et son origine à l'état/progression V2
observés après l'appel. Le bridge n'émet `SEEK_APPLIED` qu'après vérification
de la position player ; il déclenche le handoff de sortie uniquement après
vérification de la pause ou du rewind. La façade ne conclut donc pas au succès
sur le seul `Promise<void>` de la telco ; les refus restent corrélés au
diagnostic V2 et à l'état observé.

Le circuit de coopération, entièrement piloté par le bridge indépendant, est le
suivant :

1. `sequence-editor-bridge` reçoit l'intention du modèle autonome et la remet
   au bridge de coordination ; pour un seek, celui-ci conserve l'événement
   central `SEEK` (flush et règles de phase), puis demande à
   `EditorPlayerCommandFacade` la conversion `authorTimeMs + preRollMs` et
   l'appel telco unique.
2. La façade recueille `telco.onChange()` et `telco.onProgress()` sur l'instance
   active. Le bridge
    redistribue l'état de transport à `sequence-editor` et à sa télécommande
    intégrée, et une
   progression projetée en temps auteur à l'affichage temporaire de la
   timeline. Ce flux ne modifie ni `playheadMs`, ni `EditorScene`, ni le
   snapshot, ni le cadre.
3. Après un seek validé, le bridge publie `SEEK_APPLIED`. Le
   `decor-editor-bridge` et le bridge du cadre relisent alors
   `instance.snapshot`; ils ne lisent jamais le player par une API de node.
4. Après une pause ou un rewind validé, le bridge exécute une seule
   `RECONCILE_PLAYBACK_TIME`, adopte `getProgress() - preRollMs` dans le modèle
   `sequence-editor` par une mise à jour silencieuse, puis réactive le cadre.
   Cette adoption ne réémet pas `onPlayheadChange` et ne crée pas de `SEEK`.
5. Une édition de décor suit l'autre sens : preview par `snapshot.set()`,
   abandon par `snapshot.clear()`, puis commit documentaire par
   `RUN_COMMAND`/`RUN_TRANSACTION`. Le rebuild repasse par le
   `scene-player-bridge`, qui rebinde la façade et rediffuse `SCENE.SYNC` aux
   modèles. Aucun modèle ne reçoit la référence `CodPlayInstance`.

`sequence-editor/mount.ts` reçoit du bridge un port de vue générique — état de
transport, progression de lecture et résultat/accusé de seek — et une méthode
de mise à jour silencieuse du playhead. Il affichera ces valeurs sans appeler
la telco et sans décider de la réussite. La télécommande de l'éditeur est la
barre de pilotage intégrée à `sequence-editor` dans cette tranche ; elle rejoint
le même circuit `SEEK` que la timeline. Aucun remote séparé n'est monté dans la
composition actuelle. Un futur consommateur devra être raccordé par le bridge,
sans recevoir directement l'instance.

Dans ce plan, « suivre V1 » signifie uniquement conserver la séquence
d'utilisation historique de la télécommande : play/pause, rewind, seek
interactif temporisé, progress et rate. Cela ne signifie ni conserver CodPlay
V1, ni importer une API V1, ni maintenir une branche telco dans
`sequence-editor`.

### Port autonome de `sequence-editor` à mettre en place

Le module ne doit pas recevoir le transport CodPlay. Son contrat de module reste
exprimé en intentions et en projections de vue :

| Sens | Port du module | Donnée |
| --- | --- | --- |
| `sequence-editor` → bridge | `onCommand` | commandes documentaires à envoyer à `RUN_COMMAND`/`RUN_TRANSACTION` |
| `sequence-editor` → bridge | `onSelectionRequest` | `itemIds` et `keyframeId` |
| `sequence-editor` → bridge | `onTransportIntent` | `play`, `pause`, `stop`, `seek(authorTimeMs)`, et plus tard `rewind`/`rate` si les boutons existent dans cette vue |
| bridge → `sequence-editor` | `syncFromCenter` | projection `EditorScene`/sélection après commit ou chargement |
| bridge → `sequence-editor` | `setTransportView` | état de transport et disponibilité des commandes, dans un type éditeur générique |
| bridge → `sequence-editor` | `setPlaybackProgress` | progression player projetée en temps auteur, affichée séparément de `playheadMs` pendant `playing` |
| bridge → `sequence-editor` | `setPlayheadSilently` | adoption ponctuelle après seek externe ou handoff, sans réémettre `onPlayheadChange` |

Dans `mount.ts`, `attachTelco`, les imports V1, les appels directs à
`telco.play()`/`telco.pause()` et le mirroring `syncFromTelco()` sont supprimés.
Les boutons appellent `onTransportIntent`; les retours de vue génériques sont
consommés pour le rendu. `onPlayheadChange` reste réservé au geste local de
timeline et au seek auteur. Le modèle conserve ainsi son autonomie et le
bridge peut remplacer le player ou la façade sans modifier sa logique de
timeline.

### Articulation avec les façades de commandes existantes

La façade V2 vérifiée expose une seule surface de commande par instance :
`instance.telco`. Ses méthodes `play`, `pause`, `togglePlay`, `seek` et
`rewind` retournent `Promise<void>` ; un refus de commande est publié par
`instance.diagnostic`, pas par une enveloppe `ok` retournée à l'appelant.
`getState()` et `getProgress()` restent les lectures publiques du résultat, et
`onChange`/`onProgress` les notifications publiques correspondantes.

La façade de commandes actuelle dans `packages/editor/src/app/commands/facade.ts`
évalue des mutations pures de `EditorScene` (`runCommand` et `transaction`).
Elle reste pure pour préserver l'historique et ne doit pas appeler CodPlay.
Il ne faut donc pas lui ajouter un sous-domaine asynchrone. L'organisation
cible crée un service associé, nommé ici
`packages/editor/src/app/commands/editor-player-command-facade.ts`, pour les
commandes de transport. Les commandes documentaires restent
`EditorScene → EditorScene` ; les commandes de transport sont impératives,
peuvent être asynchrones et ne produisent aucune entrée d'historique.

La télécommande intégrée à `sequence-editor` ne reçoit pas directement
`instance.telco`. Le bridge de coordination adapte ses intentions à
`EditorPlayerCommandFacade`, vérifie les postconditions dans `getState()` et
`getProgress()`, et ne déduit pas un succès du seul retour de `Promise<void>`.

Avant d'émettre un accusé d'application ou le handoff, la façade de pilotage
player doit vérifier la postcondition dans `getState()`/`getProgress()` :

- après `play`, l'état attendu est `status = playing` ;
- après `pause`, l'état attendu est `status = paused` ou `ready` ;
- après `rewind`, la position attendue est `timelineMs = 0` et l'état n'est
  plus `playing` ;
- après `seek`, la position attendue est la cible player clampée, et l'état
  n'est plus `playing`.

Si cette postcondition n'est pas observable, la façade ne doit ni émettre
`SEEK_APPLIED` ni exécuter `RECONCILE_PLAYBACK_TIME` comme si la commande avait
réussi ; elle doit conserver le diagnostic et laisser l'interface dans l'état
de transport indiqué par `getState()`. Cette vérification fait partie de B1 à B3
et ne nécessite pas d'ajouter une méthode à la façade CodPlay.

### Choix proposé pour la synchronisation progression éditeur → player → cadre

Pour la première verticale, le bridge n'attend pas une nouvelle méthode de
snapshot. La propriété du temps dépend explicitement du mode :

- en mode édition ou scène arrêtée, l'éditeur possède le temps auteur ;
- en mode `playing`, `instance.telco` possède le temps d'animation et
   `telco.onProgress()` alimente l'affichage de pilotage intégré à
   `sequence-editor`, selon la séquence d'utilisation
  historique ;
- à la sortie de `playing`, une adoption unique du temps player rend la main à
  l'éditeur.

En mode édition, le circuit est :

1. `sequence-editor` est l'unique émetteur de l'intention `SEEK` et l'unique
   écrivain de `playheadMs` dans la verticale migrée, hors adoption unique à la
   sortie de lecture ;
2. le bridge de coordination transmet cette intention à
   `EditorPlayerCommandFacade`, qui transforme `editorTimeMs` en
   `playerTimeMs`, appelle la telco et émet `SEEK_APPLIED` seulement pour la
   dernière demande effectivement appliquée ;
3. `decor-editor-bridge` et le cadre se synchronisent sur `SEEK_APPLIED`, la
   sélection, le rebuild et le changement d'instance ;
4. lors d'un `snapshot.set()` déclenché par le cadre ou un panneau, le cadre
   est mis à jour uniquement si le résultat est `{ ok: true }`, avec la valeur
   candidate déjà calculée par le bridge ;
5. lors d'un `snapshot.clear()`, le bridge relit explicitement la base par
   `snapshot.get()` ;
6. lors d'un redimensionnement de la racine, un `ResizeObserver` réapplique la
   projection px de la dernière valeur logique ; ce changement ne relève pas
   d'un changement de snapshot.

Le handoff de sortie de lecture est un rendez-vous interne du bridge de
coordination, nommé `RECONCILE_PLAYBACK_TIME`, déclenché une seule fois après
la commande qui met fin à `playing`. Le bridge lit la progression exposée par
`EditorPlayerCommandFacade`, retire le `preRollMs`, puis appelle la mise à jour
silencieuse du port `sequence-editor` pour adopter `playheadMs`. Il déclenche
ensuite le même circuit de lecture du snapshot et du cadre qu'un seek
éditorial. Il n'appelle pas `SEEK` et ne
doit pas être implémenté en réutilisant `TELCO.SYNC_PLAYHEAD` comme abonnement
continu. Ainsi, en édition, l'éditeur choisit le temps ; en lecture, telco
anime ; au changement de mode, une seule transition transfère la position.

`snapshot.onChange` deviendrait intéressant uniquement si un changement de
présentation peut se produire au `playerTimeMs` courant sans `SEEK_APPLIED`,
sans sélection, sans rebuild et sans commande connue du bridge. Dans ce cas,
il faudrait le définir comme une notification de changement de base à temps
constant, et non comme une nouvelle source de progression ou de géométrie. Il
ne devrait pas émettre une valeur que `get()` ne sait pas restituer pendant une
preview ; sinon le callback pourrait réafficher une ancienne base sur le
cadre. Cette extension reste donc une option séparée, non une dépendance de la
migration initiale.

### Découpage concret des responsabilités éditeur

| Module | Remplacement prévu |
| --- | --- |
| `builder-v2/decor-resolution.ts` | retourner des nombres unitless pour les quatre champs structurés ; supprimer `EditorV2CqwLength` et `cqwLength` du builder |
| `decor-editor/units.ts` | remplacer les conversions nommées px/cqw par `px ↔ logicalLength`, paramétrées par la largeur de racine ; ne jamais produire un objet compilé |
| `offset-editor-bridge.ts` | ne plus dépendre de `AuthorApi`, `LibreAdapter` ou `NodePose` ; lire la base par snapshot, calculer le patch unitless et fournir la valeur px du cadre |
| `decor-editor/controller.ts` | faire du contrôleur le propriétaire de l'apparence complète ; supprimer la boucle `onValues → px → cqw → apply → bridge.apply` ; le patch logique live est envoyé au snapshot une fois par mise à jour |
| `decor-editor/mount.ts` | monter les panneaux et le Selection Frame comme une seule interface du `decor-editor`, depuis le décor xState et la valeur snapshot ; ne plus suivre ni muter les nodes du player |
| `selection-frame` | rester un outil d'overlay et de gestes consommé par `decor-editor` ; remplacer la source node V1 par une entrée `SelectionFrameValue` et une sortie de delta vers le contrôleur/bridge du décor |
| `scene-player-bridge.ts` | ne plus publier directement aux modules une instance V2, son `telco` ou une API de node ; supprimer les chemins `CodPlay` V1/`AuthorApi` et la construction du Selection Frame ; garder le cycle `build → preload/resources → instances.create`, enregistrer le binding telco dans `EditorPlayerCommandFacade`, et exposer au bridge de coordination seulement le port `snapshot`/lifecycle nécessaire à `decor-editor` |
| `editor-player-command-facade.ts`, `editor-coordination-bridge.ts` et `SequenceEditorRegion.tsx` | créer la façade de pilotage player indépendante de la façade documentaire ; créer le bridge de coordination pour la télécommande intégrée et les ports de `sequence-editor`, recueillir les retours de la telco et faire converger les seek vers `SEEK` |
| `controller/types.ts` et `controller-machine.ts` | supprimer `referenceWidthPx`, `authorApi`, `telco` et les rendez-vous node V1 ; conserver seulement les événements métier de coordination sans référence runtime ni readiness player |
| `sequence-editor/machine.ts`, `controller.ts`, `mount.ts` | conserver `playheadMs` comme progression auteur en mode édition ; faire émettre les intentions Play/Pause vers le bridge de coordination ; supprimer `TELCO.SYNC_PLAYHEAD` et son mirroring continu depuis `telco.onProgress()` ; afficher, si nécessaire, une progression de lecture distincte et ajouter le handoff unique de sortie |
| palette dimensions | écrire `offset.width` et `offset.height`, jamais `style.width` ou `style.height` |

### Inventaire des retraits V1 dans l'éditeur

Cette liste porte sur le code exécutable de la verticale éditeur et sur ses
dépendances directes. Une mention historique de V1 dans un plan ou une note
n'est pas une dépendance d'exécution et n'a pas à être réécrite ici. En
revanche, les imports, types, appels et commentaires qui décrivent encore le
chemin V1 dans `packages/editor/src` doivent disparaître ou être remplacés.

| Cible | À retirer précisément | Remplacement attendu |
| --- | --- | --- |
| `packages/editor/src/app/bridges/scene-player-bridge.ts` | `CodPlay` de `codplay-v1/creator`, `SceneDoc` de `codplay-v1/player/types`, `createAuthorApi`, `createLibreAdapter`, `createTrackedSession`, les types `AuthorApi`/`TrackedSession`/`SelectionFrameHandle`, puis les variables et chemins `authorApi`, session node, `studio.player`, `studio.load()`, `subscribeToNode`, `destroySelection()` et `reattachSelection()` fondés sur le remplacement d'un node | `CodPlay` V2, `buildSceneDocV2`, `build()`, `preload`, `instances.create()` ; l'instance reste privée au bridge de scène et à `EditorPlayerCommandFacade`, tandis que le bridge de coordination transmet à l'intégration `decor-editor` le port `snapshot`/lifecycle. Le Selection Frame est créé et piloté par `decor-editor`, pas par le bridge de scène |
| `packages/editor/src/app/controller/types.ts` et `controller-machine.ts` | l'import `TelcoApi` V1, l'import `AuthorApi`, les champs `authorApi`, `telco` et `referenceWidthPx`, les payloads V1 de `PLAYER_READY`/`authorApiReady`, `setAuthorApi`, `emitAuthorApiReady` et les commentaires `AuthorApi`/node | supprimer ces champs, événements et actions sans les remplacer par un readiness runtime ; l'instance reste liée dans `scene-player-bridge`/`EditorPlayerCommandFacade`, et le port snapshot est transmis par le bridge de coordination |
| `packages/editor/src/app/bridges/sequence-editor-bridge.ts` | la lecture de `context.authorApi` dans `enrichIfKeyframeCreation`, le passage de cet objet à `resolveKeyframeInsertionPatch`, le branchement raw `attachTelco(TelcoApi)` et l'abonnement `authorApiReady` | lecture de l'état présenté par le port snapshot fourni par le bridge de coordination au temps auteur courant ; raccordement à ses ports d'intentions et de retours de pilotage ; aucun accès à l'instance V2 |
| `packages/editor/src/app/layout/AppLayout.tsx` et `SequenceEditorRegion.tsx` | région telco laissée vide ; `sequence-editor` porte la télécommande et le timeline | composer une seule `EditorPlayerCommandFacade` et un seul `editor-coordination-bridge` au même niveau dans `AppLayout` ; la région reçoit seulement les ports de module ; détruire les raccordements une seule fois au démontage |
| `packages/editor/src/app/bridges/offset-editor-bridge.ts` | `OffsetEditorBinding` avec `TrackedSession`/`LibreAdapter`/`AuthorApi`, `nodePoseToOffsetValuesPx`, `readActivePose`, les appels `getNodePose`/`setNodePose`, `referenceWidthPx` et la production de valeurs depuis un node | devenir l'adaptateur interne de l'interface Selection Frame du `decor-editor` — ou être remplacé par cette interface — avec base issue du port `snapshot.get()`, algèbre px locale, conversion px → unitless au bord du décor, `snapshot.set()` et valeur candidate `SelectionFrameValue` |
| `packages/editor/src/app/bridges/decor-editor-bridge.ts` | l'import `AuthorApi`, les signatures `resolveTemporaryPatch(authorApi, ...)`, `resolveTemporaryOffset(authorApi, ...)`, `resolveKeyframeInsertionPatch(..., authorApi, ...)`, `getPersoStates`, `getNodeSnapshot`, `context.authorApi`, `subscribeToNode`, `authorApiReady` et les commentaires de pose/node | résolution depuis le port `snapshot.get()` et la base xState ; les helpers restent purs et reçoivent une donnée V2 déjà lue, jamais une référence player |
| `packages/editor/src/decor-editor/mount.ts` | `SubscribeToNode`, l'argument `subscribeToNode`, `referenceWidthPx`, les maps d'abonnements aux nodes et `applyResolvedDecor`/`applyTextAutoSize` lorsqu'ils écrivent directement dans les nodes du player | montage des panneaux et de leur état depuis xState et le bridge ; aucune écriture ni observation du DOM du player |
| `packages/editor/src/decor-editor/css-value-format.ts` | la logique nommée `formatLiveValueForCssProperty`/`formatPersoValueForCssProperty` lorsqu'elle dépend de `getNodeSnapshot` ou `getPersoStates`, ainsi que leurs commentaires V1 et conversions node px → cqw | conserver uniquement le formatage de saisie CSS qui reste nécessaire ; les valeurs présentées proviennent du snapshot V2 et les longueurs structurées passent par le bridge logique |
| `packages/editor/src/decor-editor/types.ts` et `merge.ts` | l'import `ClassNameValue` de `codplay-v1` et la référence au runtime V1 dans le merge de classes | `ClassNameValue` exporté par `codplay` V2, ou un type éditeur équivalent sans dépendance runtime ; la normalisation document `string` ou `string[]` → chaîne V2 reste explicite dans le builder |
| `packages/editor/src/sequence-editor/controller.ts` et `machine.ts` | `syncPlayheadFromTelco()`, l'événement `TELCO.SYNC_PLAYHEAD`, sa transition et les commentaires décrivant `playheadMs` comme miroir continu de telco | aucun mirroring continu ; `playheadMs` est écrit par l'éditeur en mode édition et reçoit seulement l'adoption unique `RECONCILE_PLAYBACK_TIME` à la sortie de lecture |
| `packages/editor/src/sequence-editor/mount.ts` | les imports `TelcoApi`/`PlayerStateSnapshot` de `codplay-v1`, `attachTelco(telco)`, les appels directs `telco.play()`/`telco.pause()`, `unsubscribeTelcoProgress`, `syncFromTelco()` et l'appel `ctrl.syncPlayheadFromTelco(...)` | recevoir un port de transport générique fourni par `sequence-editor-bridge` ; ses commandes Play/Pause deviennent des intentions vers le bridge de coordination ; consommer `onTransportChange` pour l'état UI et `onPlaybackProgress` pour un affichage de lecture distinct, sans écriture continue du playhead |
| `packages/editor/src/decor-editor/decor-live-session.ts` | les seules mentions de `TrackedSession` dans les commentaires | le module et sa machine xState restent utiles ; les commentaires parlent d'une session de geste éditeur, sans type ni contrat `selection-frame` V1 |
| `packages/editor/src/builder/build-scene.ts` et `src/builder/` | le builder V1, son import `codplay-v1/builder/types`, son README et son exposition comme chemin de build de l'éditeur | `src/builder-v2/` et `buildSceneDocV2` ; supprimer l'ancien dossier après migration ou retrait de ses tests et consommateurs, jamais maintenir deux chemins de build dans l'éditeur |
| `packages/editor/package.json` | la dépendance directe `codplay-v1` | conserver `codplay` ; la télécommande de l'éditeur est portée par `sequence-editor` dans cette tranche et aucune dépendance remote séparée n'est ajoutée |

Le même contrôle doit être appliqué aux deux paquets consommés par cette
verticale : `packages/authoring/selection-frame` ne doit plus fournir au
chemin migré `createAuthorApi`, `AuthorApi`, `NodePose`, `createTrackedSession`
ou `createLibreAdapter` ; son interface de cadre est réécrite sur
`SelectionFrameValue` et les deltas dans D2. Le package
`packages/authoring/remote`, s'il est repris ultérieurement, devra être audité
dans un plan distinct ; il n'est pas monté dans la composition de cette
verticale et ne doit pas être introduit pour valider le circuit présent.
Les outils de zone et d'ancrage qui dépendent encore de cette ancienne
interface restent hors de cette verticale tant qu'un plan dédié ne les a pas
migrés ; ils ne doivent pas être réintroduits dans le circuit position/taille.

### Porte de retrait

Le retrait s'effectue dans cet ordre :

1. basculer `scene-player-bridge` et les bridges consommateurs sur la façade
   player V2 et le bridge de coordination ;
2. retirer immédiatement des commandes de validation les tests éditeur qui
   importent ou simulent V1 ; les réécrire ensuite (`scene-player`, `offset`,
   `decor`, `sequence`) sur `snapshot`, les ports V2 et `CodPlayInstance` ;
3. supprimer les tests du builder V1 et la démo qui importe encore
   `@codplay/editor/builder/build-scene` ; le builder V2 reçoit ses propres
   tests unitless et d'interpolation combinée ;
4. seulement après, supprimer `src/builder/`, les dépendances `codplay-v1` et
   les exports V1 résiduels ;
5. vérifier par recherche que `packages/editor/src` et
   `packages/editor/package.json` ne contiennent plus d'import, type ou appel
   V1. Les mentions négatives nécessaires dans les README de frontière et
   dans ce plan peuvent rester documentaires ; elles ne doivent correspondre
   à aucun chemin d'exécution.

Le contrat `SelectionFrameValue` est interne à la verticale éditeur. Il ne
devient pas une API CodPlay :

```ts
type SelectionFrameValue = {
  itemId: string
  x: number
  y: number
  width: number
  height: number
  rotate: number
  scaleX: number
  scaleY: number
}
```

Le cadre reçoit cette valeur et émet seulement des deltas de geste. Le bridge
reste l'unique endroit qui connaît à la fois le snapshot, la largeur de racine
et le patch `Decor`.

## Organisation des responsabilités

| Responsabilité | Propriétaire V2 | Entrée/sortie attendue |
| --- | --- | --- |
| Document, sélection, commandes, persistance | `controller-machine.ts` et ses commandes | `EditorScene`, sélection, commandes xState |
| Mapping de scène | `builder-v2/` | `EditorScene → SceneDoc` avec données structurées unitless |
| Qualification logique | `packages/codplay/src/scene/compiled` | nombres structurés → longueur logique configurée |
| Preview temporaire | `instance.snapshot` dans CodPlay | `get`, `set`, `clear`, sans journal ni `CompiledScene` muté |
| Progression auteur | `sequence-editor` (`playheadMs`) | temps auteur ; émet une intention vers le bridge de coordination |
| Commande et retour de transport | `EditorPlayerCommandFacade` | reçoit les intentions du bridge, appelle `instance.telco`, vérifie l'état/position et relaie les retours au bridge |
| Exécution du temps | `instance.telco` | applique le seek demandé, play/pause et lifecycle ; n'écrit pas `playheadMs` |
| Adaptation de la vue | bridge éditeur V2 | snapshot logique ↔ modèle px du cadre/panneaux |
| Geste graphique | Selection Frame et ses machines existantes | deltas px → patch logique |
| Persistance | commandes xState | patch d'édition → `Decor` par l'unique transaction |
| Validation réelle | démonstration V2 et tests navigateur | build, preview, seek, resize, commit, rebuild |

## Tranches d'action

### O0 — établir le plan de passage et la porte de code

**Actions :**

1. Utiliser ce document comme plan actif ; ne pas y remplacer les contrats des
   spécifications. Le rapport `2026-09-01-editor-v2-b3-reprise-report.md`
   sert uniquement de point de reprise factuel.
2. Maintenir dans une note séparée les questions non arrêtées, notamment le
   comportement éventuel d'une notification `snapshot.onChange`.
3. Pour chaque tranche, relier les changements à une spécification V2, à un
   test de frontière et à une preuve navigateur.
4. Ne pas commencer le code d'une tranche dont le contrat est encore à
   relire. L'autorisation core déjà donnée couvre `snapshot` et la migration
   `cqw` ; elle ne couvre pas une nouvelle méthode `onChange`.

**Sortie :** périmètre de la tranche suivant accepté, sans ajout d'API
implicite.

### C1 — déplacer la qualification des longueurs dans CodPlay

**Fichiers concernés :**

- `packages/editor/src/builder-v2/decor-resolution.ts` ;
- `packages/editor/src/builder-v2/build-scene.ts` ;
- types de transport V2 dans `packages/codplay/src/scene/` ;
- `packages/codplay/src/scene/compiled/` ;
- configuration de build CodPlay ;
- tests du builder, de la compilation et de la façade.

**Actions :**

1. Formaliser dans la spécification V2 la règle de transport arrêtée ci-dessus :
   `style.x/y/width/height` numériques représentent exclusivement les quatre
   longueurs structurées issues de l'offset V2 ; le reste de `style` conserve
   ses sémantiques propres.
2. Adapter `resolveOffsetAsStyle` pour produire des nombres unitless, avec
   `translate` prioritaire sur les alias `x/y`, sans créer
   `{ kind: 'length', unit: 'cqw', value }` ni de chaîne CSS.
3. Ajouter la constante de configuration CodPlay qui porte l'unité logique
   courante (`cqw`). Le type compilé doit représenter une longueur logique,
   sans faire de `cqw` une convention normative du builder.
4. Qualifier uniquement les nombres de `style.x/y/width/height` à la frontière
   `SceneDoc → CompiledScene`, pour les valeurs initiales et les actions.
5. Réutiliser exactement cette qualification pour les mêmes champs des patches
   envoyés à `instance.snapshot.set()`.
6. Laisser intactes les chaînes de `style`, les propriétés custom et les
   valeurs dimensionless ; ajouter un test qui prouve qu'un nombre d'opacité
   n'est pas transformé.

**Porte de validation :** la règle `style.x/y/width/height` ci-dessus est la
forme de transport à valider avant le code core. Elle ne crée pas de champ
`geometry`, de méthode de mesure ou de second canal snapshot. Si elle est
refusée, la tranche s'arrête ; le builder ne sera pas corrigé par une autre
heuristique.

**Preuves :**

- le résultat de `buildSceneDocV2` contient les nombres unitless attendus ;
- `CodPlay.build()` produit une longueur logique selon la constante de
  configuration ;
- une transition unique agrège une propriété visuelle et au moins une
  longueur de position/taille dans le même payload d'action ;
- deux longueurs qualifiées s'interpolent ;
- un resize change uniquement la projection px ;
- `rotate`, `scale`, `line-height`, `object-fit`, `calc()` et CSS libre restent
  inchangés.

### S1 — confirmer et tester la surface snapshot existante

**Fichiers concernés :** façade/types, `instance-facade.ts`,
`runtime-player.ts`, tests de façade.

**Actions :**

1. Conserver `instance.snapshot.get/set/clear` comme surface de base.
2. Vérifier que `get()` fournit la base logique et que `set()` applique une
   preview de `state.style` au temps présenté, sans modifier le journal ni le
   `CompiledScene`. Le test doit aussi établir que `get()` n'inclut pas la
   preview active ; le bridge ne doit donc pas dépendre d'une relecture pour
   rafraîchir le cadre pendant un geste.
3. Ajouter les cas unitless dans les tests snapshot : initialisation,
   position, dimensions, remplacement atomique, `clear`, seek et resize.
4. Vérifier qu'un patch de preview unitless suit le même chemin de
   qualification que la scène initiale, pour `x/y/width/height` uniquement.
5. Vérifier que l'état relu après projection reste logique et stable lorsque
   la largeur de racine change.

**Sortie :** le core expose et teste le seul canal de preview utilisé par la
verticale éditeur.

### S2 — étude séparée de `snapshot.onChange`

Cette tranche ne code pas la méthode. Elle décide si une notification est
nécessaire à l'organisation du bridge.

**Questions à trancher :**

1. Le signal suit-il l'état de base présenté, les appels réussis à `set` et
   `clear`, ou les deux ?
2. Le callback reçoit-il un snapshot, un signal à relire, ou une information
   distincte pour la preview ? Cette question est obligatoire puisque
   `snapshot.get()` exclut la preview active.
3. Le signal est-il immédiat après la présentation, regroupé, ou différé ?
4. Quel est le comportement à l'initialisation, au seek, au resize, au
   remplacement de preview et à la destruction ?
5. Comment le bridge garantit-il un seul abonnement et une seule transmission
   vers xState ?

**Règle :** tant que ces questions ne sont pas validées, aucun type, nom de
méthode ou événement `onChange` n'entre dans la façade ou le core. Le bridge
utilise `get()` après une sélection, un seek, un rebuild ou un `clear`. Après
un `set`, il conserve la valeur candidate du geste, car `get()` exclut la
preview active. `telco.onChange` et `telco.onProgress` sont observés par la
façade player et relayés par le bridge vers les vues concernées ; ils ne sont
pas recopiés en continu dans la progression auteur ni consommés par le cadre en
mode édition.

### B1 — poser la façade player et le bridge de coordination V2

**Fichiers à créer ou à faire évoluer :**

- `packages/editor/src/app/commands/editor-player-command-facade.ts` ;
- `packages/editor/src/app/bridges/editor-coordination-bridge.ts` ;
- `packages/editor/src/app/layout/AppLayout.tsx` et les régions qui montent les
  trois modules.

**Actions :**

1. Créer `EditorPlayerCommandFacade` comme service impératif de l'application,
   indépendant du bridge de coordination et de la façade documentaire.
   Il ne modifie pas `EditorScene`, n'appelle pas `runCommand`/`transaction` et
   ne branche pas l'historien.
2. Lui donner la responsabilité exclusive de la référence à l'instance V2,
   du `preRollMs`, de l'appel `instance.telco` et des abonnements
   `telco.onChange`/`telco.onProgress`. Lors d'un remplacement, désabonner
   l'ancienne instance avant de lier la nouvelle.
3. Créer `editor-coordination-bridge` une seule fois, au même niveau que la
   façade player. Lui faire relier les
   ports de `SequenceEditorController`, `DecorEditorController`,
   `scene-player-bridge` et `EditorPlayerCommandFacade`, sans transférer une
   référence CodPlay à un modèle de module.
4. Faire transiter par ce bridge les intentions de transport et les retours :
   la télécommande intégrée à `sequence-editor` demande ; la façade player
   exécute et vérifie ; le bridge rediffuse l'état, la progression, le résultat
   et les accusés au module concerné.
5. Vérifier que les commandes documentaires émises par `sequence-editor` et
   `decor-editor` continuent d'emprunter `RUN_COMMAND`/`RUN_TRANSACTION` et la
   façade pure existante. Une commande Play/Pause/Seek ne doit jamais créer une
   entrée d'historique.

**Sortie :** les frontières de coopération sont posées avant la migration du
player : les modèles restent remplaçables, le seul appel telco est localisé
dans la façade player et le contrat historique est inchangé.

### B2 — remplacer le bridge de scène par la connexion V2

**Fichier principal :** `packages/editor/src/app/bridges/scene-player-bridge.ts`
à réécrire sur la façade V2, sans créer un second bridge de compatibilité.

**Actions :**

1. Construire `SceneDoc` avec `buildSceneDocV2`.
2. Compiler par `codplay.build()`.
3. Charger les feuilles CSS par le preload CSS V2 et les médias par le
   preload/cache V2.
4. Enregistrer les ressources puis créer une seule instance V2 active.
5. Enregistrer dans `EditorPlayerCommandFacade` le handle V2 de l'instance et
   le `preRollMs` correspondant. Lors d'un remplacement, retirer l'ancienne
   instance de la façade avant de publier la nouvelle.
6. Laisser `EditorPlayerCommandFacade` être l'unique appelant de
   `instance.telco`. Pour un seek, le bridge transmet l'intention `SEEK` au
   contrôleur, puis la façade ajoute le `preRollMs`, appelle la telco et
   vérifie la position player avant de remettre le résultat au bridge.
7. Rebrancher les boutons Play/Pause de la télécommande intégrée à
   `sequence-editor` sur les ports du bridge de coordination. L'interface ne
   reçoit plus de `TelcoApi` brut et n'appelle plus directement
   `telco.play()`, `telco.pause()` ou `telco.seek()`.
8. Faire de `instance.snapshot` la source de lecture de la base pour les
   consommateurs éditeur ; transmettre au bridge de coordination un port
   snapshot, jamais le handle d'instance ni une API de node.
9. Faire consommer au bridge de coordination le résultat validé de la façade
   pour émettre `SEEK_APPLIED` et déclencher la lecture snapshot/cadre ; ce
   signal accuse réception et ne modifie pas `playheadMs` par lui-même.
10. Faire recueillir par `EditorPlayerCommandFacade` `telco.onChange()` et
   `telco.onProgress()`, puis faire relayer par le bridge les états/résultats
   vers `sequence-editor` et sa télécommande intégrée. Le flux de progression ne doit ni appeler
   `snapshot.set()` ni synchroniser le cadre ou écrire `playheadMs` pendant
   l'édition.
11. Conserver la transaction de remplacement : en cas d'échec de build,
   preload ou création, l'instance et la feuille précédentes restent actives.
12. Retirer les imports et appels V1 une fois la preuve de la nouvelle
   connexion obtenue.

**Sortie :** une sélection, un seek ou une commande de transport issue de l'une
des deux interfaces ne déclenche qu'un circuit V2, avec une seule instance et
sans accès aux classes runtime internes.

### B3 — adapter le contrôleur et les ports de modules sans déplacer leur ownership

**Fichiers concernés :** `packages/editor/src/app/controller/types.ts`,
`controller-machine.ts` et les événements de bridge.

**Actions :**

1. Supprimer les rendez-vous `AuthorApi`, telco V1 et `referenceWidthPx`
   propres au player. Le contrôleur ne stocke pas de `CodPlayInstance` et ne
   reçoit pas de signal de readiness player ; l'instance et `telco` restent
   dans le bridge de scène et la façade player, le port `snapshot` étant
   relayé par le bridge de coordination.
2. Laisser `scene`, `selection`, les commandes, `playheadMs` et les
   transactions dans xState/modules éditeur ; supprimer
   `TELCO.SYNC_PLAYHEAD` comme voie d'écriture permanente et
   `syncPlayheadFromTelco()` comme synchronisation continue. Si le suivi du
   temps pendant `playing` est affiché dans la timeline, le porter dans une
   valeur de lecture distincte ; ne jamais le renvoyer comme `SEEK`. À la
   sortie de `playing`, déclencher une seule fois
   `RECONCILE_PLAYBACK_TIME`, qui lit la progression exposée par la façade
   player, retire le `preRollMs` et met à jour `playheadMs` sans rappeler
   `telco.seek()`.
3. Traiter `SEEK_APPLIED` comme un accusé de réception utilisé par
   l'intégration `decor-editor` — cadre et panneaux — ; il ne devient jamais
   un événement qui réécrit
   la progression auteur.
4. Ne pas modifier la façade documentaire : `runCommand`/`transaction` restent
   synchrones et purs. Le bridge de coordination raccorde le contrôleur à
   `EditorPlayerCommandFacade` ; cette façade reçoit `CodPlayInstance`, le
   `preRollMs` et les commandes déjà routées par le bridge, observe les retours
   V2 et reste le seul code autorisé à appeler `instance.telco`.
5. Faire converger la télécommande intégrée et la timeline vers le bridge : un
   seek de la télécommande rejoint `SEEK`, comme le scrub de la timeline ;
   `play`, `pause`, `rewind` et `rate` passent par
   `EditorPlayerCommandFacade` via le bridge avec la sérialisation historique.
   Le flux de seek interactif (pause préparatoire
   éventuelle puis seek final) est traité comme une seule transition : la
   pause préparatoire ne déclenche pas `RECONCILE_PLAYBACK_TIME`, le `SEEK`
   final devient la seule mise à jour auteur. Une pause explicite ou un rewind
   validé demande le rendez-vous unique ; la façade ne recopie jamais
   `onProgress` dans xState.
6. Ajouter au montage de `sequence-editor` les retours de vue fournis par le
   bridge : état de transport (`onTransportChange`), progression de lecture
   (`onPlaybackProgress`) et résultat/accusé de seek. Le montage rend ces
   valeurs, mais ne lit pas la telco et ne décide pas de la réussite.
7. Ajouter une mise à jour silencieuse du `playheadMs` local pour un seek
   externe ou le handoff : elle met à jour le rendu sans rappeler
   `onPlayheadChange`. Le scrub local reste l'unique émission de l'intention
   auteur ; aucune boucle retour → `SEEK` ne doit être possible.
8. Transformer les retours d'instance en événements de contrôleur déjà
   prévus, sans créer une machine authoring parallèle.
9. Rebrancher le cycle `playheadMs` éditeur → bridge de coordination → façade
   player →
   `SEEK` V2 → résultat vérifié → `SEEK_APPLIED` →
   lecture snapshot → affichage du cadre et du panneau, puis le cycle commit
   → commande → rebuild. Vérifier les deux entrées de transport sur le même
   cycle : `sequence-editor` (timeline et télécommande intégrée) → bridge de
   coordination → façade player → telco → retours,
   puis le handoff unique `pause/rewind → RECONCILE_PLAYBACK_TIME →
   `playheadMs`.

**Sortie :** le contrôleur ne connaît ni node, ni `AuthorApi`, ni cache de
pose, ni instance V2 ; il ne connaît que ses données et les événements de
coordination nécessaires au cycle d'édition et de lecture.

### D1 — refaire le circuit Decor par snapshot

**Statut : réalisé pour la verticale position/taille, y compris l'édition à un
temps interpolé (`isTemporary`) et sa matérialisation dans un décor frais à la
création d'un KF ; la matrice seek/rebuild complète reste à consigner.
Extensions grille, multi-sélection et repères complexes hors périmètre.**

**Fichiers concernés :**

- `packages/editor/src/app/bridges/decor-editor-bridge.ts` ;
- `packages/editor/src/decor-editor/controller.ts` ;
- `packages/editor/src/decor-editor/mount.ts` ;
- `packages/editor/src/decor-editor/types.ts` et unités ;
- l'ancien `offset-editor-bridge.ts`, retiré par R1.

**Actions :**

1. Faire de `DecorEditorController` le propriétaire explicite de la valeur
   complète d'apparence de l'item. `decor-editor-bridge` monte les panneaux et
   le Selection Frame comme une seule interface ; le cadre ne possède ni
   `DecorPatch`, ni sélection documentaire, ni accès player.
2. À la sélection, lire `instance.snapshot.get()` et composer l'état affiché
   depuis la base logique au temps courant ; convertir les longueurs logiques
   en px pour l'interface du cadre et les valeurs de panneau qui en ont besoin.
3. Pour une édition live, conserver la base du geste et construire un patch
   partiel `state.style` avec des nombres unitless ; l'envoyer par
   `instance.snapshot.set()` avec `timeMs = editorTimeMs + preRollMs`, puis
   remettre au cadre la valeur px candidate calculée à partir du même patch.
   Si la modification porte aussi sur une propriété visuelle, le contrôleur
   fusionne les deux changements dans le même patch de décor ; le cadre ne
   déclenche pas une écriture ou une animation séparée pour sa géométrie.
4. Ne pas attendre que `snapshot.get()` restitue cette preview : le contrat
   actuel l'exclut. Pour un abandon, appeler `instance.snapshot.clear()` et
   relire la base.
5. Au commit, transmettre le patch unitless à l'unique commande xState après
   `snapshot.clear()`, puis laisser
   le rebuild V2 reconstruire la scène ; ne pas écrire directement dans le
   player.
6. Utiliser `offset.translate`, `offset.width` et `offset.height` comme
   vocabulaire structuré unique de l'éditeur ; retirer les champs de palette
   `style.width`/`style.height` et conserver le CSS libre dans `style`.
7. Conserver l'algèbre du geste en px. Effectuer la conversion px → valeur
   unitless au bord du bridge, puis laisser CodPlay qualifier cette valeur.
   Au retour d'un rebuild ou d'une sélection, convertir la valeur logique du
   snapshot vers le modèle px du cadre en un seul point.
8. Lorsque plusieurs champs du décor sont modifiés par la même opération,
   conserver un `DecorPatch` cohérent et vérifier que palette, cadre et
   snapshot voient le même candidat avant le commit.
9. Rejouer la scène et la lecture après `set`, seek, resize et rebuild pour
   vérifier que le cadre et le panneau lisent le même état.
10. Autoriser un geste de cadre ou de palette lorsque `resolveTarget` indique
    `isTemporary`. La valeur candidate reste une preview V2, sans écriture
    documentaire. À la création d'un keyframe au temps présenté, le bridge
    de coordination compose l'état CSS et la pose interpolés fournis par le
    snapshot avec cette candidate (la candidate prime uniquement sur les
    propriétés qu'elle modifie) ; il crée un décor frais et le remplit dans
    la même transaction. `snapshot.get()` ne peut pas servir seul de capture
    puisqu'il exclut la preview active.
11. Faire correspondre une création arrondie de la timeline avec le candidat
    auteur dans une tolérance d'un demi-pas (`50 ms`), attendre `SEEK_APPLIED`
    lorsque le snapshot n'est pas encore au `timeMs` du keyframe, puis
    sélectionner le keyframe capturé afin que l'édition suivante cible
    immédiatement son décor persistant, même si le seek initial n'était pas
    exactement sur le pas.

**Sortie :** palette et cadre utilisent le même canal de preview et la même
base logique ; aucune lecture de node ne participe à la construction d'un
`DecorPatch`. La multi-sélection reste hors de cette tranche.

### Scénario d'acceptation de la verticale position/taille

Ce scénario est la preuve minimale avant d'élargir la migration aux autres
éditeurs graphiques :

1. Le `sequence-editor` fixe `playheadMs = 250`. Le bridge de coordination
   demande à la façade player `seek(250 + preRollMs)`. Après `SEEK_APPLIED`,
   `snapshot.get()` est lu au
   temps player correspondant ; `telco.onProgress()` ne peut pas réécrire
   `playheadMs` ni déplacer le cadre vers un autre temps en mode édition.
2. Le bouton `play` de `sequence-editor` passe par
   le port de transport du bridge de coordination :
   flush, entrée dans `playing`, appel unique à `instance.telco.play()`. Le
   cadre est masqué. `telco.onProgress()` alimente l'affichage de lecture
   temporaire du timeline sans réécrire `playheadMs`.
3. Le bouton `pause` de `sequence-editor` passe par le même bridge et la même
   façade player :
   après le succès de `instance.telco.pause()`, le bridge exécute une seule
   fois `RECONCILE_PLAYBACK_TIME`, adopte `getProgress() - preRollMs` dans
   `playheadMs`, puis réactive le cadre sans émettre de nouveau `SEEK`.
4. Les commandes Play puis Pause de l'interface de pilotage de l'éditeur
   passent par le même bridge et la même façade ; leurs traces de commande et
   de handoff sont identiques, sans seconde instance ni branche telco.
5. L'interface de pilotage demande un seek à `400ms` : conformément à la
   séquence historique, la lecture est d'abord mise en pause si nécessaire,
   sans handoff intermédiaire, la demande rejoint `SEEK`, le player reçoit
   `400 + preRollMs`, puis la progression de lecture est affichée sans
   réécrire le `playheadMs` auteur avant la fin de la transition. Le cadre
   reprend après `SEEK_APPLIED`.
6. Le bouton Stop de `sequence-editor` fixe `playheadMs` à zéro et produit un
   seul `SEEK` vers `preRollMs` ; il ne déclenche pas de réconciliation de
   l'ancien temps telco.
7. Une scène V2 contient un item avec
   `offset.translate = { x: 10, y: 5 }`, `offset.width = 20` et
   `offset.height = 12`. Le builder émet les nombres `10`, `5`, `20`, `12`.
8. Avec une racine de `800px` de large, CodPlay compile les quatre champs en
   longueurs logiques `cqw`. Le bridge affiche un cadre de
   `80px × 40px`, situé à `80px, 40px`, avec une hauteur de `96px`.
9. Un déplacement de `24px` horizontal produit le patch snapshot
   `style.x = 13` ; un agrandissement de `40px` produit `style.width = 25`.
   Les nombres envoyés par l'éditeur restent unitless.
10. Le cadre est mis à jour avec `x = 104px` et `width = 200px` depuis la
   valeur candidate du bridge ; aucune mesure du node player n'est effectuée.
11. Un changement de racine à `1200px` conserve `x = 13` et `width = 25` dans
   la donnée logique et affiche respectivement `156px` et `300px`.
12. Le commit efface la preview, persiste
   `offset.translate.x = 13` et `offset.width = 25` par la commande xState,
   reconstruit l'instance V2 et retrouve le même cadre après sélection.
13. Un abandon efface la preview et retrouve `x = 10` et `width = 20` sans
   modifier `EditorScene`.
14. Deux états adjacents du même item contiennent respectivement
   `background-color = "red"`, `x = 10`, `width = 20`, puis
   `background-color = "blue"`, `x = 30`, `width = 30`. Le builder V2 produit
   une seule action de l'item dont le payload porte les transitions de
   `background-color`, `x` et `width`, avec le même intervalle et le même
   déclenchement ; aucune action concurrente de position n'est créée.
15. La lecture de cette scène montre simultanément l'interpolation de la
   couleur et celle de la position/taille. Une preview qui modifie plusieurs
   propriétés passe par une mise à jour atomique du snapshot ; son commit
   passe par une commande xState et le rebuild restitue les deux valeurs.
16. Entre les deux keyframes, la première sélection affiche le cadre et
    autorise immédiatement un déplacement, un resize, une rotation autour de
    l'axe et une modification de couleur. Ces gestes ne produisent aucune
    commande documentaire tant qu'il n'y a pas de décor persistant à cet instant.
17. Une création de keyframe à `t` capture l'état interpolé du snapshot au
    temps exact `t` dans un décor frais, puis superpose le candidat accepté à
    `t` s'il existe ; aucune propriété interpolée absente du candidat ne doit
    disparaître. Si le seek réel vaut `t - 12,5 ms` et que la timeline arrondit
    le nouveau keyframe à `t`, la capture attend `SEEK_APPLIED` avant de lire le
    snapshot. Le keyframe est sélectionné après la transaction ; une édition
    suivante suit alors le chemin normal de commit.
18. Un seek hors de `t`, puis retour à `t`, restitue le candidat non committé
    tant qu'aucun keyframe n'est créé ; Échap l'abandonne sans modifier
    `EditorScene`. Après création du keyframe, un seek/rebuild puis retour
    restitue le décor documenté.

Dans l'état initial de cette première verticale, les cas `rotate` et `scale`
étaient hors circuit. L'extension V2 du 2026-09-02 lève explicitement cette
exclusion pour `rotate` et son axe ; `scale`, capsule/grille et édition CSS libre
restent hors circuit jusqu'à leur propre plan. Aucune de ces extensions ne peut
réintroduire une lecture de node V1.

### D2 — connecter le Selection Frame comme interface de `decor-editor`

**Statut : réalisé côté code pour l'entrée V2 consommée par l'éditeur ; preuve
navigateur de la rotation et de l'axe encore requise.**

**Fichiers traités :** `packages/authoring/selection-frame/src/v2.ts`,
`src/v2/types.ts`, `src/v2/rotation-modifier.ts` et leurs tests ; le package
reste un outil bas niveau et ne devient pas le propriétaire du décor. Les
capacités sont montées comme des modifieurs indépendants ; les autres entrées
historiques du package sont hors de cette migration.

**Actions :**

1. Garder le DOM de l'overlay, les pointeurs et les machines de geste du
   Selection Frame côté éditeur.
2. Fournir au cadre une `SelectionFrameValue` locale en px depuis
   `decor-editor-bridge`, après lecture du snapshot et projection dans la
   racine de scène. Aucun adaptateur de pose V1 n'est conservé.
3. Garder les coordonnées du geste en px pour `move` et `resize`, les degrés
   pour `rotate` et les fractions pour `pivot`, puis transmettre uniquement des
   deltas au bridge ; celui-ci produit les champs structurés unitless du patch
   V2.
4. Après chaque preview, afficher la valeur candidate fournie par
   `decor-editor` ;
   ne pas relire `snapshot.get()` pour chercher une preview absente du getter.
5. Appliquer ces règles à la sélection simple de la première verticale ; la
   multi-sélection et la diffusion de groupes restent hors de cette tranche.
6. Utiliser les rendez-vous de rebuild, sélection et `SEEK_APPLIED` pour
   relire la base. `telco.onProgress` ne doit piloter ni le cadre ni le
   `playheadMs` de l'éditeur. S2 pourra traiter `snapshot.onChange`
   séparément si un changement hors de ces rendez-vous est démontré ; D2 ne
   dépend pas de cette méthode.

**Porte de sortie :** la verticale ne contient plus de source node V1. Si le
cadre ne peut pas être alimenté par `SelectionFrameValue`, son interface est
réécrite côté éditeur ; aucune API de mesure n'est ajoutée à CodPlay pour
conserver l'ancienne interface.

### R1 — persistance, rebuild et suppression de V1

**Statut : réalisé pour la verticale position/taille.**

**Actions :**

1. Tester le geste complet : sélection → lecture snapshot → déplacement ou
   resize px → preview snapshot → commit xState → rebuild → nouvelle lecture
   snapshot.
2. Vérifier la conservation de l'identité story/item et du temps présenté.
3. Vérifier qu'un seek pendant un geste ne déclenche pas une seconde
   conversion de la valeur déjà projetée.
4. Supprimer les imports V1 et les chemins morts seulement après les preuves
   B1, B2, B3, D1 et D2.
5. Ne pas modifier les démos pour masquer un défaut du circuit ; elles servent
   de fixtures de validation.

**Recherche de sortie attendue :** aucun appel V1 dans la verticale éditeur
V2 (`AuthorApi`, `getNodePose`, `setNodePose`, `subscribeToNode`, player ou
remote V1).

## Matrice de validation

Cette matrice ne compte que des tests et parcours qui franchissent les
interfaces V2 réellement ciblées. Les suites dépendant de `codplay-v1`, de
`AuthorApi`, de `subscribeToNode` ou d'un node player sont hors périmètre et
doivent être retirées ou réécrites avant d'être relancées. Elles ne servent
pas de filet de compatibilité.

| Frontière | Preuve minimale |
| --- | --- |
| Builder | `OffsetData` sort en nombres unitless ; aucune chaîne ou valeur `cqw` produite par ed2 |
| Compilation | la configuration CodPlay qualifie une longueur structurée en `cqw` |
| Snapshot | `get/set/clear`, patch partiel, remplacement atomique, cible/temps invalides |
| Résolution | une action unique interpole simultanément couleur et position/taille ; `rotate`/`scale` inchangés |
| Projection | largeur de racine initiale puis resize ; même état logique, px projetés différents |
| Autorité temporelle | édition : `sequence-editor.playheadMs` → `SEEK` → `SEEK_APPLIED` ; lecture : `telco` ; sortie : une seule adoption `getProgress() - preRollMs` |
| Interfaces de pilotage | boutons Play/Pause/Stop de la télécommande intégrée à `sequence-editor` convergent sur le bridge de coordination ; commandes player exécutées par la façade player, seek centralisé, progress de lecture depuis `telco.onProgress` |
| Façade player / bridge | `instance.telco` garde le contrat V2 (`Promise<void>` + diagnostics) ; `EditorPlayerCommandFacade` exécute et observe, le bridge adapte les intentions de `sequence-editor` et vérifie les postconditions avant `SEEK_APPLIED`/handoff |
| Lecture | animation pilotée par `telco` ; CS et édition suspendus ; sortie de lecture = une seule réconciliation player → temps auteur |
| Édition | move et resize px, avec les autres changements du décor, → patch unitless cohérent → preview atomique → retour px |
| Rotation / axe | aiguille V2 autour de `rotationOrigin`, pivot déplaçable et compensé, → patch `offset.rotate`/`offset.rotationOrigin` → preview atomique → commit/rebuild |
| Preview interpolée | `isTemporary` reste éditable ; le candidat accepté est séparé de `snapshot.get()`, survit au seek/rebuild et n'est persisté qu'avec un décor frais créé par le keyframe |
| Persistance | commit par commande xState, rebuild, resélection et snapshot cohérents |
| Structure | parent/enfant et reparent sans réintroduire un accès node V1 |
| Lifecycle | destruction, remplacement d'instance et désinscription sans callback résiduel |
| Navigateur | parcours réel de l'outil, puis typecheck, tests, build et contrôle Safari Technology Preview applicables |

## Ordre de validation

1. Valider la forme de transport structurée de C1.
2. Implémenter et tester C1 puis S1 sur le core autorisé.
3. Décider séparément S2 (`onChange`) ; ne pas la déduire de S1.
4. Implémenter B1, B2 et B3 avec une seule `EditorPlayerCommandFacade` et un
   seul bridge de coordination indépendant, partagés par la timeline et la
   télécommande intégrées à `sequence-editor`, `playheadMs` comme référence en
   mode édition, `telco` comme transport d'animation en mode `playing` et le
   handoff unique `RECONCILE_PLAYBACK_TIME` entre les deux.
5. Implémenter D1, puis D2 sur le circuit réel.
6. Exécuter R1 et la matrice navigateur complète.
7. Mettre à jour la spécification des modules effectivement stabilisés et les
   README d'utilisation concernés ; le présent document ne devient pas une
   spécification après exécution.

## Conditions de fin

Le plan ne sera terminé que lorsque :

- le build éditeur et le snapshot utilisent le même transport unitless ;
- CodPlay est le seul lieu de qualification `unitless → cqw` ;
- le cadre et les panneaux ne lisent ni n'écrivent le node du player ;
- une transition d'item prouve l'interpolation conjointe d'une propriété
  visuelle et de la position/taille, sans action ni circuit concurrent ;
- la persistance passe par les commandes xState et un rebuild V2 réel ;
- aucun import ou appel V1 ne reste dans la verticale migrée ;
- les preuves de la matrice, dont le test navigateur live, sont consignées ;
- les contrats stabilisés sont retranscrits dans leurs spécifications et non
  dans un rapport de reprise.
