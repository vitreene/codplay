# Carte de lecture du fonctionnement CodPlay V2

Cette carte aide à retrouver le propriétaire d'un comportement. Elle décrit
les raccords observables dans le dépôt ; les plans et spécifications liés
portent les contrats et les décisions de suivi. Le
[registre d’audit](./2026-09-26-audit-contradictions-doublons-methodes.md)
conserve les constats et leurs preuves ; il ne remplace pas ces sources.

## Ordre de lecture

Lire les [règles du projet](../../../../AGENTS.md), puis utiliser le
[plan général V2](../../plan/codplay-v2-plan.md) pour identifier le plan
détaillé du sujet. Lire ensuite le
[guide de découverte](../../plan/notes/2026-08-26-decouverte-etat-codplay-v2.md),
comme l'exigent les règles de reprise CodPlay V2. Lire la spécification pour le
comportement vérifié, puis le plan détaillé pour les décisions ouvertes ou
acceptées mais non appliquées et leurs gates. Vérifier ensuite le code et les
tests indiqués ci-dessous. Une note d'étude éclaire une décision sans remplacer
ces contrats ; les statuts à jour appartiennent aux plans détaillés.

## Packages et dépendances

Les dépendances indiquées ici viennent des `package.json` et des imports des
points d'entrée cités. Le [workspace](../../../../package.json) rassemble des
consommateurs de plusieurs générations ; son appartenance à un même dépôt ne
fusionne pas leurs runtimes.

| Partie | Rôle et sens des dépendances | Entrée à lire |
|---|---|---|
| `codplay-v1` | Runtime historique autonome, encore consommé par des outils d'authoring et des démos V1. Aucun import de son runtime ne construit le player V2. | [package V1](../../../codplay-v1/package.json), [plan général V2](../../plan/codplay-v2-plan.md) |
| `codplay` | Runtime V2, compilation, façade, moteur, player et présentation HTML. Il ne dépend d'aucun autre package du workspace. | [package V2](../../package.json), [exports publics](../../src/index.ts) |
| `authoring/component-v2` | Composants et intégrations V2 facultatifs, dont scroll-container et les hôtes de contenus tiers ; dépend de `codplay`. | [package](../../../authoring/component-v2/package.json), [scroll-container](../../../authoring/component-v2/src/scroll-container/index.ts) |
| Autres packages `authoring` | Aides de création, composants tiers et cadre de sélection. Plusieurs consomment encore `codplay-v1` ; `selection-frame` connaît aussi V2. Leur migration ne découle pas du seul nom du dossier. | [dossier](../../../authoring/), [plan de représentation](../../plan/component-render-representation-plan.md) |
| `demos` | Fixtures V1 et V2. Le [layout V2](../../../demos/src/v2/layout/layout.ts) possède la page, le preload, le propriétaire CodPlay et la telco ; chaque module de démo fournit sa scène. | [package](../../../demos/package.json), [contrat du layout](../../../demos/specs/v2-demo-layout-spec.md) |
| `editor` | Application d'authoring ; sa verticale V2 passe par la façade CodPlay, tandis que d'autres dépendances V1 restent à examiner. | [package](../../../editor/package.json), [plan d'organisation V2](../../../editor/plan/2026-09-01-editor-v2-organization-plan.md) |
| `sighty` | Parcours de vues et pilotage d'occurrences CodPlay ; dépend de V2 et utilise ses opérations publiques de montage et de telco. | [package](../../../sighty/package.json), [spécification Sighty](../../../sighty/specs/authoring-library-spec.md) |

## D'une déclaration à l'image

```text
SceneDoc auteur
  → CodPlay.build : validation, normalisation, extraction des fonctions,
    ressources et requirements
  → CompiledScene + fonctions séparées
  → préparation des bibliothèques et preload explicite si nécessaires
  → instances.create : engine partagé, player et hôte HTML d'une occurrence
  → journal + materialize → resolve → solve : état logique au temps demandé
  → composants et services : application de cet état
  → materializer et runner HTML : présentation visible
```

Le [builder](../../src/scene/compiled/scene-builder.ts) produit l'artefact ;
le [codec](../../src/scene/compiled/), la
[spécification de scène](../../specs/scene-authoring-spec.md) et le
[plan CompiledScene](../../plan/compiled-scene-plan.md) décrivent sa frontière
sérialisable. La [façade](../../src/facade/codplay-facade.ts)
et son [registre d'instances](../../src/facade/engine-facade/instance-registry.ts)
préparent et créent l'occurrence. L'[engine](../../src/runtime/engine/) possède
horloge, les ressources partagées et les instances ; le
[player](../../src/runtime/player/runtime-player/runtime-player.ts) possède le
journal et la reconstruction. La
[spécification Engine/Player](../../specs/engine-player-v2-spec.md) décrit le
cycle et le Seek groupé vérifiés ; son [plan](../../plan/player-engine-plan.md)
reste actif pour les validations motion et de réutilisation logique ; la
[spécification de reconstruction logique](../../specs/runtime-reconstruction-v2-spec.md)
décrit le comportement vérifié de materialize, resolve et solve. La
[spécification de façade](../../specs/facade-v2-spec.md)
décrit les opérations exposées à l'hôte. Les tests
[builder](../../tests/scene/compiled/scene-builder.spec.ts),
[façade](../../tests/facade/facade.spec.ts) et
[pipeline](../../tests/runtime/player/pipeline.spec.ts) en vérifient des
frontières différentes ; une démo navigateur vérifie aussi la présentation.

Le [runtime des composants](../../src/runtime/components/runtime-component-runtime.ts)
instancie les définitions du [catalogue](../../src/runtime/catalog/) et
applique l'état résolu. Les services fournissent leurs opérations aux
composants. Les modules sont des capacités du player ; ils ne remplacent ni
son journal ni son catalogue. Le [contrat de matérialisation](../../src/runtime/materializer/materializer-types.ts)
reçoit une `SolvedScene` et les deltas utiles à la présentation. Le
[runner HTML](../../src/runtime/runner-html/player-runner/runtime-runner.ts)
compose cette présentation avec le DOM. Les [tests du runner](../../tests/runtime/runner-html/player-runner.spec.ts)
et la [démo position](../../../demos/src/v2/demos/position/main.ts) exercent
ce raccord. Le DOM ne constitue pas une source de reconstruction de l'état
logique ; la [spécification de matérialisation](../../specs/component-materialization-v2-spec.md)
décrit les frontières vérifiées. La politique de sanitation des templates reste
à relire dans le [plan associé](../../plan/component-render-representation-plan.md).

## D'un événement à l'état

Un eventime compilé est lu à sa frontière temporelle, ou une entrée publique
arrive par [`instance.events.emit`](../../src/facade/instance-facade.ts) ou
[`codplay.events.emit`](../../src/facade/engine-facade/instance-registry.ts).
Les deux rejoignent [`RuntimePlayer.emit`](../../src/runtime/player/runtime-player/runtime-player.ts).
Le [contrôleur d'événements](../../src/runtime/player/runtime-player/event-controller.ts)
utilise un seul [dispatcher](../../src/runtime/player/pipeline/runtime-event-dispatcher.ts)
et un seul [journal](../../src/runtime/player/pipeline/track-journal.ts) :
sélection de portée, `listen`, transformations et straps y produisent les faits
à relire. La [spécification du pipeline événementiel](../../specs/event-pipeline-v2-spec.md), la
[spécification d'exécution des straps](../../specs/strap-execution-v2-spec.md) et le
[plan d'acceptation straps](../../plan/strap-execution-plan.md) détaillent ces étapes.

Le [contrôleur d'état de scène](../../src/runtime/player/runtime-player/scene-state.ts)
reconstruit le résultat logique à partir de l'artefact et du journal. La
[présentation du player](../../src/runtime/player/runtime-player/presentation.ts)
le transmet ensuite aux composants puis au materializer. Le dispatcher et le
journal n'importent ni DOM ni runner HTML ; leur code ne lit pas la
présentation. Le contrôleur d'événements demande ensuite une présentation au
port dédié, mais ce port ne réécrit pas ses faits. Les tests
[dispatch](../../tests/runtime/player/runtime-event-dispatcher.spec.ts),
[listen](../../tests/runtime/player/listen.spec.ts),
[seek/player](../../tests/runtime/player/runtime-player.spec.ts) et la
[démo events](../../../demos/src/v2/demos/events/main.ts) couvrent des niveaux
complémentaires. Les événements visibles par l'application passent par la
façade selon leur visibilité déclarée.

Une interaction native déclarée par `Perso.emit` entre par l'adaptateur
HTML du runner puis appelle `RuntimePlayer.emit()` ; son contrat DOM vérifié et
ses gates d'acceptation sont décrits par la
[spécification dédiée](../../specs/perso-emit-v2-spec.md) et son
[plan actif](../../plan/perso-emit-v2-portage-plan.md).

## Capacités et chemins d'extension

| Sujet | Propriétaire et circuit existant | Décision et preuve |
|---|---|---|
| Actions, valeurs et temps | Le [pipeline](../../src/runtime/player/pipeline/) matérialise les actions ; [ACE](../../src/ace/) résout les valeurs et interpolations pures. | [spécification couleur](../../specs/color-values-v2-spec.md), [plan d'acceptation couleur](../../plan/color-values-plan.md), [spécification des unités](../../specs/unit-values-v2-spec.md), [spécification transform](../../specs/transform-properties-v2-spec.md), [plan transform](../../plan/transform-properties-plan.md), [spécification ActionSequence/TweenAction](../../specs/action-sequence-tween-v2-spec.md), [plan d'acceptation actions](../../plan/action-sequence-tween-plan.md), [tests ACE](../../tests/ace/tween.spec.ts), [chrono](../../../demos/src/v2/demos/chrono/main.ts) |
| Composants core markup | Le catalogue enregistre `img`, `input` et `polygon`; leurs templates passent par le materializer HTML/DOM commun. | [spécification image](../../specs/image-component-v2-spec.md), [spécification input](../../specs/input-component-v2-spec.md), [spécification polygon](../../specs/polygon-component-v2-spec.md), [plan d'acceptation](../../plan/components-image-input-polygon-svg-plan.md), [tests composant](../../tests/runtime/components/image-input-polygon.spec.ts), [démo polygon](../../../demos/src/v2/demos/polygon/main.ts) |
| Placement, liste, DnD et mouvement | Le [solveur](../../src/runtime/player/pipeline/solve.ts) résout les cibles ; la capacité `list` transmet l'ordre à la timeline structurelle ; la preview DnD commit par `move` et `list`. Le seek navigateur S6 reste ouvert au plan. | [spécification `move`](../../specs/move-v2-spec.md), [spécification `list`](../../specs/list-capability-v2-spec.md), [spécification DnD/list](../../specs/list-dnd-v2-spec.md), [spécification temps et frontières motion](../../specs/motion-frame-v2-spec.md), [spécification retarget](../../specs/move-target-dependency-v2-spec.md), [plan dimensions](../../plan/list-dimension-interpolation-plan.md), [plan motion](../../plan/motion-live-discovery-invalidation-plan.md), [plan d'acceptation du retarget](../../plan/move-target-dependency-plan.md), [plan S6 — capture et glisser-déposer dans une liste](../../plan/drag-capture-list-s6-validation-plan.md), [tests cible](../../tests/runtime/player/mount-targets.spec.ts), [position](../../../demos/src/v2/demos/position/main.ts) |
| Média et preload | Le [service preload](../../src/runtime/preload/) prépare hors player ; les ressources vont à l'engine puis aux composants média. | [spec preload](../../specs/preload-v2-spec.md), [spec media-sync](../../specs/media-sync-v2-spec.md), [plan d'acceptation](../../plan/media-preload-plan.md), [test de façade](../../tests/facade/media-preload-handoff.spec.ts), [démo](../../../demos/src/v2/demos/preload-media/main.ts) |
| Inactivité du player | Le [`RuntimeIdleMonitor`](../../src/runtime/idle/runtime-idle.ts) compte les frames de l'engine pendant la lecture et transmet son événement au player, qui utilise le dispatcher existant. | [spécification](../../specs/idle-monitor-v2-spec.md), [test runtime](../../tests/runtime/idle/runtime-idle.spec.ts), [test façade](../../tests/facade/idle-config.spec.ts) |
| Isolation des stories | Le dispatcher journalise les périodes ciblées et filtre les occurrences de story ; l'acceptation des groupes et ressources motion lors des changements de période reste ouverte. | [spécification logique](../../specs/story-isolation-spec.md), [plan d'acceptation](../../plan/story-isolation-plan.md), [plan reset](../../plan/story-reset-plan.md), [tests runtime](../../tests/runtime/player/story-isolation.spec.ts), [démo position](../../tests/facade/position-demo.spec.ts) |
| Source DOM `Perso.emit` ordinaire | Le [runner HTML](../../src/runtime/runner-html/player-runner/runtime-runner.ts) branche l'[adaptateur de source](../../src/runtime/runner-html/perso-emit-source-adapter.ts) sur les nœuds publiés par le materializer ; celui-ci appelle `RuntimePlayer.emit()` pour rejoindre le dispatcher et le journal uniques. | [spécification partielle](../../specs/perso-emit-v2-spec.md), [plan d'acceptation](../../plan/perso-emit-v2-portage-plan.md), [tests builder et runner](../../tests/runtime/runner-html/player-runner.spec.ts), [intégration quiz](../../tests/runtime/runner-html/quiz-series-emit.spec.ts) |
| Capture | La [session player](../../src/runtime/player/runtime-player/capture-controller.ts) et ses [actions live](../../src/runtime/player/live-actions/) réutilisent les déclarations compilées ; les sources navigateur passent par le circuit partagé, qui relie règle, événement d’ouverture et session au routage `visibility` commun. L'acceptation navigateur du runtime CodPlay, exercé avec la fixture `stroke-path`, a été confirmée par l’utilisateur ; le Seek S6 reste ouvert. | [spécification](../../specs/capture-v2-spec.md), [plan S6](../../plan/drag-capture-list-s6-validation-plan.md), [test de session](../../tests/runtime/capture/runtime-capture-session.spec.ts), [test circuit](../../tests/runtime/capture/capture-source-circuit.spec.ts), [test runner S6](../../tests/runtime/runner-html/player-runner.spec.ts) |
| Scroll et observation | Le [composant optionnel](../../../authoring/component-v2/src/scroll-container/scroll-container-component.ts) attache progression et capture à son node matérialisé ; le circuit capture partagé appartient au core CodPlay. La [factory HTML](../../../authoring/component-v2/src/scroll-container/scroll-container-source-adapter.ts) ne porte que l'observation des descendants. Le catalogue core n'enregistre pas le composant par défaut. | [spécification scroll](../../specs/scroll-container-spec.md), [spécification capture](../../specs/capture-v2-spec.md), [tests providers](../../../authoring/component-v2/tests/scroll-container-providers.spec.ts), [test d'intégration](../../../authoring/component-v2/tests/scroll-container-player-integration.spec.ts), [démo](../../../demos/src/v2/demos/scroll-container/main.ts) |
| Contenu foreign et projections tierces | Le [composant slot](../../src/runtime/components/slot/) publie une surface que la [façade de montage](../../src/facade/engine-facade/mount-registry.ts) utilise ; un hôte de projection tierce possède sa représentation. | [spécification slot](../../specs/slot-component-spec.md), [plan foreign](../../plan/foreign-scene-component-plan.md), [test montage](../../tests/facade/foreign-mount.spec.ts) |
| Intégrations Three.js, Rive et Avatar | Les hôtes possèdent leurs rendus natifs ; le core CodPlay fournit la préparation de bibliothèque, la relation `rel` et le pont de cible opaque. Avatar contribue par une cible opaque attachée au host Three. Lottie reste à établir. | [spécification core Three.js](../../specs/third-party-threejs-spec.md), [spécification Rive](../../specs/third-party-rive-spec.md), [spécification Avatar](../../specs/third-party-avatar-spec.md), [plan d'acceptation CodPlay](../../plan/2026-09-18-third-party-render-target-codplay-plan.md), [plan d'intégration](../../plan/2026-09-18-third-party-components-v2-plan.md), [plan Avatar](../../plan/2026-09-19-avatar-components-v2-plan.md) |
| Parcours de plusieurs scènes | [Sighty](../../../sighty/src/) sélectionne les vues et pilote les instances par la façade CodPlay ; CodPlay continue à posséder leur état et leur rendu. | [spécification Sighty](../../../sighty/specs/authoring-library-spec.md), [tests Sighty](../../../sighty/tests/runtime.spec.ts) |

Les autres [plans de parties](../../plan/codplay-v2-plan.md) précisent les
capacités encore ouvertes. Aucune ligne de cette carte ne leur attribue un
statut de validation nouveau.
