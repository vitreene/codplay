# CodPlay V2 - plan general

## Statut et autorite

Ce document est le plan general de CodPlay V2. Il ordonne les domaines a construire, leurs dependances, leurs
jalons de validation et les questions qui doivent etre tranchees avant le code concerne.

Les parties complexes disposent d'un plan detaille distinct, reference depuis ce document. Un plan de partie
detaille l'execution d'un domaine sans redefinir l'architecture generale, les dependances ou les invariants V2.

Les contrats V2 sont l'autorité active du chantier. Les plans de partie sont
colocalisés dans `packages/codplay-v2/plan/` et les notes de `plan/notes/`
expliquent les décisions; ils ne doivent pas contredire ce plan général. Les
démos existantes sont un corpus non normatif, destiné à une adaptation
ultérieure, et ne constituent pas une dépendance du runtime V2.

## Invariants de construction

- V2 est une base autonome : aucune compatibilité avec une ancienne implémentation
  n'est construite dans le runtime.
- Aucun jalon ne cree de mini-DSL, de sous-format `CompiledScene`, de fallback ou de branche speciale de
  demo. Une capacite absente est explicitement hors de la tranche.
- Le flux V2 reste : `SceneDoc -> build -> CompiledScene -> materialize -> resolve -> solve -> composant`.
- Le builder sanitise une fois; le player ne porte pas de garde defensive sur son chemin chaud.
- L'etat logique ne se reconstruit jamais depuis le DOM. Un composant est l'unique ecrivain de l'etat qui
  lui est remis.
- Les materialisations auteur sont persistantes pendant toute la sequence/player :
  `mount`, `unmount`, detach, reparentage, reorder et seek ne detruisent ni ne
  recreent les elements deja materialises. Leur destruction intervient uniquement
  au teardown final ; les overlays FLIP et le DOM de mesure sont des ressources
  techniques transitoires distinctes.
- Les roles metier sont des classes petites et testables; les dossiers suivent les frontieres du flux.
- Tout nouveau code est TypeScript strict. Les API publiques, classes, methodes publiques et variables de
  domaine importantes ont un JSDoc. Les constantes auteur ou produit sont documentees dans `config/`.
- Lorsqu'un sous-systeme utilise une machine d'etats, son plan/spec declare son role, ses etats, ses
  transitions, ses declencheurs et la raison du choix.

## Architecture et artefacts

```text
@codplay/codplay-v2
  src/ace                calcul pur prepare et resolu
  src/diagnostics        collecte structuree, console.log par defaut et sorties adaptables
  src/shared             utilitaires purs communs aux domaines V2
  src/services           services nommes, contrats, validation, defaults et operations d'update
  src/scene              SceneDoc, build, validation, diagnostics et exports
  src/scene/compiled     contrat versionne et serialisable de l'artefact de lecture
  src/runtime/catalog    catalogue runtime unifie des composants, services et modules
  src/runtime/engine     ressources partagees, horloge et ordre des instances
  src/runtime/materializer interface de materialisation par substrat
  src/runtime/player     une instance, materialize, resolve et solve
```

La sanitation du markup qui précède `CompiledScene` appartient à
`src/scene/validation`. La capacité runtime `markup` conserve uniquement les
parts/outlets et leur materialization par player. Les services portent leurs
déclarations et validations pures ; leurs bindings de materializer sont
assemblés dans l'adapter runtime concerné.

`CompiledScene` possède son enveloppe V2 : `schemaVersion`, `createdAt`, `scene`,
`resources`, `rootNodeIds`, `requirements` et, lorsque nécessaire, les index
dérivés du contrat compilé comme `actionTargetIndex`. Toute extension doit correspondre
à une capacité V2 spécifiée; aucune ne sert seulement à faire fonctionner une
demo.

Une scene auteur peut contenir des fonctions. Avant diffusion, le build les extrait systematiquement dans
une collection externe et les remplace par des references nommees dans la donnee compilee. L'extraction
préserve l'ordre sémantique de chaque position. L'extraction est une étape V2
explicite, à généraliser à toutes les positions de fonctions.

Un lecteur de diffusion consomme un `CompiledScene` et sa collection de fonctions, mais pas `SceneDoc` ni
le builder. Un export d'intention consomme `SceneDoc`; un export fidele consomme `CompiledScene`; aucun
export ne passe par engine ou player.

Les composants sont declares avec un descripteur de capacite pur, construit lors de l'instanciation de CodPlay.
Une declaration unique porte le type, les services, la capacite runtime et la validation optionnelle dans le
`RuntimeCapabilityCatalog`; les services ne sont pas redesignes dans un second registre. Le build recoit le
snapshot de validation produit par ce catalogue et `CompiledScene` l'utilise sans
instancier de composant ni de service runtime. L'absence d'un validateur de composant est autorisee au debut et
produit un warning detaille; les validateurs des services courants sont la premiere couverture commune.

## Position actuelle

| Element | Position | Consequence |
|---|---|---|
| Chantier | Fondation V2 relue | Le flux `SceneDoc -> CompiledScene` et la première verticale runtime sont gelés sur leur périmètre actuel. |
| Mode | Implementation V2 incrementale | Le code ajoute est destine a V2; une preuve de principe est annoncee comme telle avant d'etre ecrite. |
| Partie active | Unification runtime V2 | Le catalogue unique, la validation dérivée, les services séparés et les materializers DOM HTML/SVG sont en place; Canvas/Three.js et les familles non encore portées restent hors tranche. |
| Diagnostics | Contrat fixe, implementation testee | Peut etre consomme par toutes les couches V2. |
| Validation/catalogue | Contrat initial fixe, extensions en cours | Les declarations composant/services/modules sont lues depuis `RuntimeCapabilityCatalog` et exposees au build par `validationSnapshot()`; les formes core de `style`, `className`, `attr` et `content` ainsi que les contrats initiaux de `tag`, `layout`, `list`, `media`, `img`, `input` et `polygon` sont couverts. Chaque composant core expose désormais son profil `*Initial`, son validateur et, lorsque nécessaire, ses sanitation callbacks ; la factory reste liee a la famille DOM HTML/SVG. |
| Composants | Base générique et base HTML séparées, tranche DOM HTML/SVG implémentée | `BaseComponent` est substrat-neutre ; `BaseHTMLComponent`, les sept composants core (`LayoutComponent`, `TagComponent`, `ListComponent`, `MediaComponent`, `ImageComponent`, `InputComponent`, `PolygonComponent`), leurs dossiers profils/validation/projection, factories runtime, parts/outlets et materialisation template string — y compris les fragments sans enveloppe — sont couverts par le `RuntimeMaterializer` unifié ; JSX, Canvas et Three.js restent hors tranche. |
| Surfaces de composants | Registre typé initial implémenté | Les déclarations peuvent publier une surface via `RuntimeComponentSurfaceProvider`; le runtime la conserve par instance montée et les modules la résolvent par `RuntimeComponentSurfaceResolver`; `media-sync` consomme `media` sans classe concrète ni duck typing. Les nouvelles surfaces restent à ajouter à la map contractuelle. |
| Utilitaires partagés | Sous-dossiers spécialisés en cours | `shared/values`, `shared/ordering` et `shared/numbers` centralisent le clonage structuré, la comparaison de chemins et la garde numérique ; `runtime/html` centralise la garde de mesurabilité ; les différences de contrat des pointeurs et des matrices HTML restent locales. |
| Découpage des points chauds | Fini pour la tranche interne du 2026-08-24 | `runtime/player`, `runtime/runner` et `runtime/capabilities/media-sync` sont découpés par responsabilités dans des dossiers spécialisés ; les façades publiques, le circuit runtime et les contrats V2 restent inchangés. |
| ACE | Contrat de valeurs et transforms scalaires en place | Les alias, l'ordre, les identités deterministes et la conservation des unités sont couverts; les séquences `transform` brutes sont conservées par le materializer HTML et les matrices ne sont pas décomposées. |
| Mouvement HTML | Tranche HTML fixe et clôturée | FIRST/LAST exacts, modes local/reparent, profondeur arbitraire, circuit Play/Seek unique et optimisation sans lecture DOM par frame sont couverts ; le materializer SVG DOM ajouté pour les composants ne porte pas encore le mouvement SVG. |
| Démos standard | Gabarit fixe, extension en cours | `packages/authoring/selection-frame/demos/flip-stress` sert de fixture de référence et de gabarit; ses paramètres de stress ne sont pas imposés à chaque démo. |

Une decision marquee `A relire` bloque le code qui en depend. Une decision `Fixe` peut etre implementee. Une
phase de prototype est possible, mais elle porte explicitement `Mode: Prototype`, son perimetre, son critere de
sortie et la decision de promotion ou de retrait; elle ne devient pas une regle implicite de V2.

## Diagnostics transversaux

`DiagnosticCollector` est une brique de tout `codplay-v2`, partagee par le builder, les guards, le codec,
l'engine, le player, les composants et les modules. Il conserve des entrees `warning` ou `error`, les deduplicate
par code et references, et fournit un rapport structure. La politique decide au point d'appel si un cas devient
warning ou error; en mode auteur, les warnings sont exposes. La sortie par defaut est `console.log`; une sortie
injectable permet ensuite de diversifier vers un log structure, une console dediee ou le viewport.

Le contrat est partage, mais la duree de vie est locale : un collector appartient a une compilation, une instance
de player ou une operation determinee. La facade configure la sortie; aucun singleton global ne melange les
diagnostics de plusieurs compilations, instances ou scenes.

## Plans de parties

| Partie | Plan detaille | Etat |
|---|---|---|
| Revue priorité 0 des contrats | [`2026-08-20-priority-0-contract-review.md`](./2026-08-20-priority-0-contract-review.md) | Fixe |
| CompiledScene, guards et deriveurs | [`compiled-scene-plan.md`](./compiled-scene-plan.md) | En cours, tranche initiale relue |
| Contrat auteur `move` | [`move-contract-plan.md`](./move-contract-plan.md) | Fixe |
| Mouvement visuel HTML et circuit Play/Seek | [`runner-flip-integration-study.md`](./runner-flip-integration-study.md) | Fini pour la tranche HTML V2; autres materializers reportés |
| Materializer composants et représentation | [`component-render-representation-plan.md`](./component-render-representation-plan.md) | Interface unifiée et tranche HTML en place; substrats supplémentaires reportés |
| Démo standard runner | [`../../authoring/selection-frame/demos/README.md`](../../authoring/selection-frame/demos/README.md) | Fixe comme gabarit de validation |
| ActionSequence et TweenAction | [`action-sequence-tween-plan.md`](./action-sequence-tween-plan.md), [`notes/2026-08-23-v1-behavior-inventory.md`](./notes/2026-08-23-v1-behavior-inventory.md) | Fixe, circuit logique unique en place; inventaire V1 des candidats Behavior consigné |
| Capture continue et liste DnD V2 | [`list-dnd-integration-plan.md`](./list-dnd-integration-plan.md) | Fini pour la tranche de validation : capture continue, placement list, lecture et seek validés ; démo consignée |

## Modeles algorithmiques

| Domaine | Modele applique | Regle de code |
|---|---|---|
| Materialize et seek | Event sourcing / CQRS | Les events sont materialises comme faits; le seek ne reexecute jamais un strap. |
| Etat continu | FRP Behavior | ACE evalue la valeur a tout instant. |
| Etat discret | FRP Event puis behavior en escalier | Un fait date ouvre une plage de validite interrogeable a `t`. |
| Placement | Scene graph, tri topologique, dirty flags | Le graphe se resout parent avant enfant; les optimisations ne changent pas sa semantique. |
| Etat applique | Reconciler | Le composant applique les deltas et reste le seul ecrivain. |
| Mouvement visuel HTML | Graphe temporel par item et mesure d'endpoints isolée | Play et Seek évaluent la même frame à `t`; la mesure est une entrée versionnée et ne relit jamais le modèle depuis le DOM visible. |

Ces modeles commandent les types, signatures, classes et tests. Ils ne justifient aucun framework importe.

## Elements a construire

| Domaine | Element V2 a construire | Statut et dependances |
|---|---|---|
| Glossaire, invariants, configuration | Invariants V2 explicites, conventions et `config/` par domaine | Fondation de toutes les tranches. |
| Diagnostics | Collecteur structure transversal, deduplication, rapport warnings/erreurs et sorties futures | `src/diagnostics`; contrat commun a toutes les couches V2. |
| Validation et erreurs | Sanitizer du builder, diagnostics auteur et catalogue d'erreurs/warnings | Avant tout player; le player fait confiance au compile. |
| SceneDoc, builder et exports | Build, validation, normalisation, derivation des ressources/besoins, extraction des fonctions, exports | `src/scene`; ne depend pas d'engine ou player. |
| CompiledScene | Enveloppe, guards, sanitation, codec, artefact immutable et requirements declares | `src/scene/compiled`; artefact de lecture interne. |
| Engine | `RuntimeCapabilityCatalog` unifie des composants, services, modules et bindings tiers; cache, styles, horloge et ordre de tick | Le catalogue est compose a l'initialisation puis verrouille avant l'execution. L'engine consomme cette source unique et ne lit pas `SceneDoc`. |
| Player et lifecycle | Instance, racine de montage, canaux diffusion/injection/authoring/observation, cycle init/play/pause/seek/destroy | Recoit engine et `CompiledScene`; ne cree pas sa propre horloge. Play et Seek résolvent le même état et la même frame absolue. |
| Events, listen et straps | Pipeline `listen -> transform -> straps -> emit -> persos`, fonctions referencees, ordre stable, events comme contrat primaire | Dispatcher runtime unique en place : append source, selection story/scene, straps sequentiels, outputs sur tracks declarees, cascade borne et relecture journalisee; annulation et helpers live restent a specifier. |
| Helpers de straps et schedule | Delais, repetitions, stagger, `planned` et cas `live` | Plan Temporel Declaratif fini pour les formes bornees; tout contrat live reste exclu et a specifier avec `f(t)`. |
| Tracks et eventimes | Journal ordonne, eventimes relatifs aplatis, activation, provenance et append live | Registre statique, journal live, ancrage runtime, controles d'activation et tracks dediees aux outputs de straps en place; generation obsolete reste a ouvrir. |
| Materialize, resolve et solve | Faits -> actions -> etat resolu; behaviors ACE, placements opaques, etats discrets par validite, hierarchie de solve | `materialize -> resolve -> solve`, registre de cibles, placements, conflits same-tick, transforms scalaires et graphe parent/enfant en place; mesures, diagnostics et politiques de liste restent a ouvrir. |
| Perso et composants | Types de perso, composants, services locaux, application de `PersoState`, parts et outlets | `RuntimeCapabilityCatalog` declare les types et leurs services; le `RuntimeMaterializer` matérialise les composants et leur structure, chaque player instancie ses composants. |
| Familles de composants | Tag/text/image/layout/list/media, quiz-question, positioning et composants de domaine des demos | Chaque famille reçoit son contrat V2 comme capacité déclarée, avec ses fixtures et ses démos; aucune ne devient un patch générique de `style`. |
| Layout et listes | Contrats de layout/outlets, capacite list et container ordonne | La timeline structurelle immutable possède l'ordre complet par target. Une liste marque une target; elle ne maintient aucun historique concurrent. |
| Move / List | Politique de conflit, etat parent/enfant, montage, ordre logique, deltas `mount/unmount/move`, `@root`, `@off`, detach/reattach, registre interne de cibles aux IDs opaques uniques par scene | Registre, resolution de placement, conflits same-tick, metadonnees de modes, persistance `first/last`, graphe parent/enfant, deltas generiques, propagation du detach, diagnostics de seek et politiques `reorderOnMove/Add/Remove` fournies par la capacite list en place; le move core reste independant de la capacite. |
| Mouvement local et reparent | Frontières avant/après, graphe temporel par item, mesures versionnées et présentation HTML atomique | Contrat fixe sur les moves compilés; le mode local est inféré pour une target inchangée et un changement de target/parent utilise automatiquement l'overlay reparent. `flipMode` reste une surcharge facultative. |
| Replace | Module de remplacement, clones transitoires et remplacement de scènes foreign | [`replace-foreign-plan.md`](./replace-foreign-plan.md) fixe la direction Sighty/layout/event et la variante HTML `replace-foreign`; l'implémentation du module classique et la validation runtime restent à construire. |
| ActionSequence et TweenAction | Actions continues, chainage, phases et interruption | Expansion pure dans materialize, fonctions compilées dans resolve et frontière `tween:stop` en place; renderer continu, composition additive et live restent hors tranche. |
| Capture continue core | [`capture-authoring-plan.md`](./capture-authoring-plan.md) | Plan V2 `Fini` : contrat source-agnostique, session, sorties de fin, application live, journal et seek ; aucune source HTML ni démo dans ce périmètre. |
| Validation capture S5 | [`capture-s5-validation-plan.md`](./capture-s5-validation-plan.md) | Plan V2 `Fini` : fixture HTML classique, adaptateur pointer, telco et tests d’intégration ; aucune nouvelle sémantique core. |
| Seek, horizon, rate | Evaluation synchrone, cibles locales par membre, portee multi-instance et commit de presentation unique, diagnostics par instance, segments, fenetres, policies seek-back, rate et lecture arriere eventuelle | La frontiere engine et les rapports structures par instance sont en place; conversion globale Sighty, horizon/rate et straps live demandent encore leur tranche. |
| Effets et lifecycle | Effets irreductibles filtres au seek; `scene:end` distinct de `sequence:end`, cleanup technique | Depend du pipeline event et des medias. |
| Media et preload | Media sync, master, correction de derive, cache partage, preload par capacite | Preload externalisé et façade autonome `run` validés. Socle `media-sync` player-scoped, option `initial.master`, fallback ticker, seek persistant et `node-per-src` en cours de validation ; la correction de dérive reste une optimisation finale ; bindings tiers et renderer de production restent hors tranche. |
| Tiers, modules et services | Binding tiers, preload, adapter hub, dispatcher generique, catalogue unifie et ModuleServices player-scoped | `RuntimeCapabilityCatalog`, derivation des requirements depuis les composants, initialisation solve, routage des deltas, seek reconciliation et cycle de vie en place; aucun catalogue local de runner ou de demo. |
| Authoring éditeur | [`2026-07-12-app-controller-definition.md`](../../editor/plan/app/2026-07-12-app-controller-definition.md) | Le canal d'intentions existe déjà côté éditeur. `setDecor(decorId, patch)` couvre la position ; lors de la reprise V2 dans l'éditeur, `setNodePose` sera examiné comme usage de ce canal et du flux Builder -> CompiledScene -> materializer, sans passer par capture/DnD ni ajouter de patch concurrent au player. |
| Diffusion, broadcast et telco | Lecteur autonome de CompiledScene, facade de diffusion et telco locale serialisable | La façade telco locale de validation (transport + observation) est en place; packaging, transport distant et `rate` restent reportés; ne pas mélanger avec authoring. |
| Tests | Fixtures, horloge déterministe, traces, assertions de paradigme et baselines DOM/géométriques | Transversal; le mouvement couvre les frontières exactes, recouvrements, profondeurs imbriquées et l'indépendance de l'historique d'évaluation. |

## Ordre de construction

### 1. Fondation de contrats

Ecrire et tester les invariants, config, validation, `CompiledScene`, extraction des fonctions, catalogue
engine et contrats player/composant. Les interfaces exactes sont définies par
les contrats V2 et les décisions déjà écrites; aucun nouveau concept n'est
ajouté pour raccourcir cette phase.

### 2. Verticale de validite

Creer d'abord sous `packages/codplay-v2/tests/runtime/` une verticale de test qui traverse le flux entier avec
un `RuntimeMaterializer` de test branche sur la meme interface que le runner HTML. La demo existante
`demos/validation/player` reste un banc visible du runtime, sans sortie ou catalogue parallele. Ni cette demo ni
la verticale ne doivent ouvrir le renderer de production. Elles couvrent :

La démo courante est unique et remplace la précédente lorsqu'une nouvelle
tranche doit être présentée, sauf demande explicite de conservation. La démo
FLIP de `demos/validation/runner` est consignée ; elle reste séparée de la démo
courante et ne doit pas être dupliquée sous une autre entrée.

- un composant racine fixe;
- un event materialise;
- un changement discret de classe lu par plage de validite;
- un behavior continu prepare par ACE;
- des seeks nommes avant, pendant et apres les changements.

Cette verticale de test ne couvre pas `move`, FLIP, containers, media, persos hotes, preload partagé ou seek
multi-instance. Les capacités non ouvertes restent absentes de ses types et fixtures, sans imitation.

### 3. Validation mouvement/list

La démo compacte dans `packages/codplay-v2/demos/validation/runner/` valide les
contrats local et reparent avec deux scénarios lisibles. La fixture
`packages/authoring/selection-frame/demos/flip-stress/` en est le gabarit de
stress et la base de reprise pour les démos standard : elle ajoute plusieurs
conteneurs mobiles, des listes imbriquées, des trajectoires, des transitions
chevauchées et le redimensionnement responsive.

Ces démos restent des surfaces de validation, pas des implémentations
alternatives du runtime. Elles doivent conserver une `SceneDoc` déclarative,
le cycle de vie possédé par `HtmlPlayerRunner`, les checkpoints FIRST / boundary
/ middle / LAST, ainsi que la comparaison Play/Seek au même temps. Les
paramètres de stress peuvent être réduits pour une démo standard, mais le
circuit de résolution et les points d'observation restent identiques.

Le seek reconstruit l'etat logique puis évalue le même graphe de mouvement et la
même frame de présentation que Play au temps demandé. Il ne rejoue pas les
événements et ne dépend pas des temps visités auparavant. Les baselines visuelles
existantes `player-poc` et `overlay-world-seek-baseline` restent un corpus à
adapter, mais les invariants numériques Play/Seek du plan de restructuration
sont normatifs.

### 4. Cadre de validation V2

Lors de l'adaptation progressive des démos existantes, construire le cadre de
tests V2 : fixtures communes, horloge déterministe, traces d'état à instants
nommés, baselines DOM/géométriques et assertions propres à V2 (writer unique,
absence de rejeu de strap, dépendances interdites et ordre de solve).

### 5. Tranches de capacites

Poursuivre par dependances : intégration authoring V2 dans l'éditeur via le canal d'intentions existant; bindings tiers; diffusion/broadcast/telco. La capture continue, la capacité list/DnD et la fondation media/preload sont clôturées pour la tranche de validation. Le preload reste externalisé et n'est pas une étape imposée au player.
Chaque tranche commence par le contrat V2, puis sa démo et ses tests.

## Sources de reference V2

- `docs/projet/codplay-v2/notes/2026-07-26-conduite-chantier-v2.md`.
- `docs/projet/codplay-v2/notes/2026-07-26-ancrages-algorithmiques.md`.
- `docs/projet/codplay-v2/notes/2026-07-26-etat-fonction-de-t.md`.
- `plan/notes/2026-07-28-decoupage-engine-instances-pilotage.md`.
