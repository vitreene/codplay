# CodPlay V2 - plan general

## Statut et autorite

Ce document est le plan general de CodPlay V2. Il ordonne les domaines a construire, leurs dependances, leurs
jalons de validation et les questions qui doivent etre tranchees avant le code concerne.

Les parties complexes disposent d'un plan detaille distinct, reference depuis ce document. Un plan de partie
detaille l'execution d'un domaine sans redefinir l'architecture generale, les dependances ou les invariants V2.

Les specifications V1 restent la reference du comportement a conserver. Les plans de partie sont colocalises
dans `packages/codplay-v2/plan/` et les notes de `plan/notes/` expliquent les decisions; ils ne doivent pas
contredire ce plan general. Aucun code V1 n'est importe, modifie ou reutilise dans le runtime V2.

## Invariants de construction

- V2 est une reecriture distincte : V1 fournit contrats, demos et tests-oracles, jamais un chemin de
  compatibilite runtime.
- Aucun jalon ne cree de mini-DSL, de sous-format `CompiledScene`, de fallback ou de branche speciale de
  demo. Une capacite absente est explicitement hors de la tranche.
- Le flux V2 reste : `SceneDoc -> build -> CompiledScene -> materialize -> resolve -> solve -> composant`.
- Le builder sanitise une fois; le player ne porte pas de garde defensive sur son chemin chaud.
- L'etat logique ne se reconstruit jamais depuis le DOM. Un composant est l'unique ecrivain de l'etat qui
  lui est remis.
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
  src/runtime/engine     catalogue, ressources partagees, horloge et ordre des instances
  src/runtime/player     une instance, materialize, resolve et solve
```

`CompiledScene` conserve son enveloppe V1 : `schemaVersion`, `createdAt`, `scene`, `resources` et
`rootNodeIds`. Toute extension doit correspondre a une capacite V2 specifiee; aucune ne sert seulement a
faire fonctionner une demo.

Une scene auteur peut contenir des fonctions. Avant diffusion, le build les extrait systematiquement dans
une collection externe et les remplace par des references nommees dans la donnee compilee. L'extraction
preserve l'ordre semantique de chaque position. Le mecanisme V1 `extractSceneFunctions` est la reference
initiale, a generaliser a toutes les positions de fonctions.

Un lecteur de diffusion consomme un `CompiledScene` et sa collection de fonctions, mais pas `SceneDoc` ni
le builder. Un export d'intention consomme `SceneDoc`; un export fidele consomme `CompiledScene`; aucun
export ne passe par engine ou player.

Les composants sont declares avec un descripteur de capacite pur, construit lors de l'instanciation de CodPlay.
Une declaration unique porte le type, les services, la capacite runtime et la validation optionnelle. CodPlay
projette cette declaration dans le registre runtime et dans le catalogue de validation; les services ne sont pas
redesignes dans un second registre. Le build recoit un snapshot du catalogue et `CompiledScene` l'utilise sans
instancier de composant ni de service runtime. L'absence d'un validateur de composant est autorisee au debut et
produit un warning detaille; les validateurs des services courants sont la premiere couverture commune.

## Position actuelle

| Element | Position | Consequence |
|---|---|---|
| Chantier | Fondation V2 | Le flux `SceneDoc -> CompiledScene` est la tranche active. |
| Mode | Implementation V2 incrementale | Le code ajoute est destine a V2; une preuve de principe est annoncee comme telle avant d'etre ecrite. |
| Partie active | `player-engine-plan.md` | Le socle CompiledScene est gele comme fondation; la tranche en cours definit la consommation player/engine avant le sink de rendu temporaire. |
| Diagnostics | Contrat fixe, implementation testee | Peut etre consomme par toutes les couches V2. |
| Validation/catalogue | En cours, a relire avant integration composant | Les declarations composant/services/modules sont projetees depuis le catalogue runtime vers le snapshot de validation; les extensions de validateurs restent a couvrir. |
| Composants | Fondation layout en cours | `LayoutComponent`, `TagComponent`, factories runtime et projection template string sont couverts ; JSX et les autres types restent hors tranche. |
| ACE | Existant, non modifie | Il reste consommateur de valeurs completes; la preparation amont est a construire. |
| Mouvement HTML | Graphe V2 implémenté, `A relire` | FIRST/LAST exacts, modes local/reparent, profondeur arbitraire et circuit Play/Seek unique sont couverts. |
| Démos standard | Base documentée, `En cours` | `packages/authoring/selection-frame/demos/flip-stress` sert de fixture de référence et de gabarit; ses paramètres de stress ne sont pas imposés à chaque démo. |

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
| CompiledScene, guards et deriveurs | [`compiled-scene-plan.md`](./compiled-scene-plan.md) | En cours |
| Contrat auteur `move` | [`move-contract-plan.md`](./move-contract-plan.md) | En cours, base auteur fixée |
| Mouvement visuel HTML et circuit Play/Seek | [`runner-flip-integration-study.md`](./runner-flip-integration-study.md) | A relire, restructuration appliquée |
| Démo standard runner | [`../../authoring/selection-frame/demos/README.md`](../../authoring/selection-frame/demos/README.md) | En cours, gabarit documenté |

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

| Domaine V1 | Element V2 a construire | Statut et dependances |
|---|---|---|
| Glossaire, invariants, configuration | Invariants V2 explicites, conventions et `config/` par domaine | Fondation de toutes les tranches. |
| Diagnostics | Collecteur structure transversal, deduplication, rapport warnings/erreurs et sorties futures | `src/diagnostics`; contrat commun a toutes les couches V2. |
| Validation et erreurs | Sanitizer du builder, diagnostics auteur et catalogue d'erreurs/warnings | Avant tout player; le player fait confiance au compile. |
| SceneDoc, builder et exports | Build, validation, normalisation, derivation des ressources/besoins, extraction des fonctions, exports | `src/scene`; ne depend pas d'engine ou player. |
| CompiledScene | Schema versionne, guards, sanitation, codec, artefact immutable et requirements declares | `src/scene/compiled`; base de diffusion et d'exports. |
| Engine | Catalogue de composants, modules, services, bindings tiers; cache, styles, horloge et ordre de tick | Fournit les capacites declarees; ne lit pas `SceneDoc`. |
| Player et lifecycle | Instance, racine de montage, canaux diffusion/injection/authoring/observation, cycle init/play/pause/seek/destroy | Recoit engine et `CompiledScene`; ne cree pas sa propre horloge. Play et Seek résolvent le même état et la même frame absolue. |
| Events, listen et straps | Pipeline `listen -> transform -> straps -> emit -> persos`, fonctions referencees, ordre stable, events comme contrat primaire | Propagation, executeur, collections, snapshots d'etat, validation init, sorties event et updates rejouables en place; loop et helpers live restent a specifier. |
| Helpers de straps et schedule | Delais, repetitions, stagger, `planned` et cas `live` | Plan Temporel Declaratif fini pour les formes bornees; tout contrat live reste exclu et a specifier avec `f(t)`. |
| Tracks et eventimes | Journal ordonne, eventimes relatifs aplatis, activation, provenance et append live | Registre statique, journal live, ancrage runtime et controles d'activation en place; straps restent a ouvrir. |
| Materialize, resolve et solve | Faits -> actions -> etat resolu; behaviors ACE, placements opaques, etats discrets par validite, hierarchie de solve | `materialize -> resolve -> solve`, registre de cibles, placements, conflits same-tick et graphe parent/enfant en place; transforms, mesures, diagnostics et politiques de liste restent a ouvrir. |
| Perso et composants | Types de perso, composants, services locaux, application de `PersoState`, parts et outlets | Le catalogue engine declare les types; chaque player instancie ses composants. |
| Familles de composants | Tag/text/image/layout/list/media, quiz-question, positioning et composants de domaine des demos | Chaque famille reprend son contrat V1 comme capacite declaree, avec ses fixtures et ses demos; aucune ne devient un patch generique de `style`. |
| Layout et listes | Contrats de layout/outlets, capacite list et container ordonne | La timeline structurelle immutable possède l'ordre complet par target. Une liste marque une target; elle ne maintient aucun historique concurrent. |
| Move | Politique de conflit, etat parent/enfant, montage, ordre logique, deltas `mount/unmount/move`, `@root`, `@off`, detach/reattach, registre interne de cibles aux IDs opaques uniques par scene | Registre, resolution de placement, conflits same-tick, metadonnees de modes, persistance `first/last`, graphe parent/enfant, deltas generiques, propagation du detach et diagnostics de seek en place; l'application de `reorderOnMove/Add/Remove` appartient a une capacite/service list, pas au move core ni a un composant unique. |
| Mouvement local et reparent | Frontières avant/après, graphe temporel par item, mesures versionnées et présentation HTML atomique | Implémenté et `A relire`. Le mode local est inféré pour une target inchangée; un changement de target/parent utilise automatiquement l'overlay reparent. `flipMode` reste une surcharge facultative. |
| Replace | Module de remplacement et clones transitoires | A reprendre apres audit du contrat module/service et du flux de move. |
| ActionSequence et TweenAction | Actions continues, chainage, phases et interruption | Depend de events/tracks/materialize/ACE; les emissions de phase restent declarees. |
| Capture et DnD | Capture live, commit `persist-only`, etat de capture, notification authoring; DnD comme commit move | Troisieme producteur de `PersoState`; DnD depend de capture, move, listes et mesure. |
| Seek, horizon, rate | Evaluation synchrone, cibles locales par membre, portee multi-instance et commit de presentation unique, diagnostics par instance, segments, fenetres, policies seek-back, rate et lecture arriere eventuelle | La frontiere engine et les rapports structures par instance sont en place; conversion globale Sighty, horizon/rate et straps live demandent encore leur tranche. |
| Effets et lifecycle | Effets irreductibles filtres au seek; `scene:end` distinct de `sequence:end`, cleanup technique | Depend du pipeline event et des medias. |
| Media et preload | Media sync, master, correction de derive, cache partage, preload par capacite | Media-sync est conserve conceptuellement; cache et strategie remontent a l'engine. |
| Tiers, modules et services | Binding tiers, preload, adapter hub, dispatcher generique, catalogues et ModuleServices player-scoped | `RuntimeModuleServiceCatalog`, derivation des requirements depuis les composants, initialisation solve, routage des deltas, seek reconciliation et cycle de vie en place. |
| Authoring | Construction de SceneDoc, canal authoring local, observation de PersoState et capture | Separe du player de diffusion et du protocole de pilotage. |
| Diffusion, broadcast et telco | Lecteur autonome de CompiledScene, facade de diffusion et telco locale serialisable | Packaging fin et transport distant reportes; ne pas melanger avec authoring. |
| Tests | Fixtures, horloge deterministe, traces, comparateurs V1/V2, assertions de paradigme et baselines DOM/geometriques | Transversal; le mouvement couvre les frontières exactes, recouvrements, profondeurs imbriquées et l'indépendance de l'historique d'évaluation. |

## Ordre de construction

### 1. Fondation de contrats

Ecrire et tester les invariants, config, validation, `CompiledScene`, extraction des fonctions, catalogue
engine et contrats player/composant. Les interfaces exactes doivent suivre les specifications V1 et les
decisions V2 deja ecrites; aucun nouveau concept n'est ajoute pour raccourcir cette phase.

### 2. Verticale de validite

Creer d'abord sous `packages/codplay-v2/tests/runtime/` une verticale de test qui traverse le flux entier avec
le sink memoire temporaire. La demo temporaire `demos/validation/player` reste maintenue en parallele comme
banc de validation visible des progres Clock/Ticker et runtime; elle ne sera retiree qu'a l'ouverture des
composants. Ni cette demo ni la verticale ne doivent ouvrir le renderer de production. Elles couvrent :

- un composant racine fixe;
- un event materialise;
- un changement discret de classe lu par plage de validite;
- un behavior continu prepare par ACE;
- des seeks nommes avant, pendant et apres les changements.

Cette verticale de test ne couvre pas `move`, FLIP, containers, media, persos hotes, ActionSequence, preload
partage ou seek multi-instance. Ces capacites sont absentes de ses types et fixtures, sans imitation.

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
événements et ne dépend pas des temps visités auparavant. Les baselines V1
`player-poc` et `overlay-world-seek-baseline` restent des oracles visuels, mais
les invariants numériques Play/Seek du plan de restructuration sont normatifs.

### 4. Cadre comparatif V2

Au debut de la revue systematique des demos V1, construire le cadre de tests V2 : fixtures communes,
horloge deterministe, traces d'etat a instants nommes, comparateurs V1/V2, baselines DOM/geometriques et
assertions propres a V2 (writer unique, absence de rejeu de strap, dependances interdites et ordre de
solve).

### 5. Tranches de capacites

Poursuivre par dependances : pipeline events/straps/tracks complet et ActionSequence; capture/DnD et
authoring; media/preload; bindings tiers; diffusion/broadcast/telco. Chaque tranche commence par le contrat
V1 conserve ou la decision V2 necessaire, puis sa demo et ses tests.

## Sources de reference

- `docs/formalisation/v1-index.md` et les specifications V1 qu'il indexe.
- `docs/projet/codplay-v2/notes/2026-07-26-conduite-chantier-v2.md`.
- `docs/projet/codplay-v2/notes/2026-07-26-ancrages-algorithmiques.md`.
- `docs/projet/codplay-v2/notes/2026-07-26-etat-fonction-de-t.md`.
- `plan/notes/2026-07-28-decoupage-engine-instances-pilotage.md`.
- `docs/formalisation/v1-move-separation-policy-state-backend-dom.md`.
