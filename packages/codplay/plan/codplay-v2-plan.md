# CodPlay V2 — feuille de route générale

## Rôle du document

Les spécifications sont les références normatives des comportements certifiés.
Les plans détaillés conservent les décisions à prendre, les décisions acceptées
mais non appliquées, les actions et leurs critères de vérification. Ce document
indexe les deux ; il ne répète ni les contrats ni l'avancement détaillé.

Un domaine sans décision ni validation résiduelle est référencé par sa
spécification seule. Une case « — » dans l'index des spécifications indique
qu'aucun plan de partie n'est ouvert.

Les règles de travail sont dans [AGENTS.md](../../../AGENTS.md). Les constats
et preuves de l'audit documentaire du 2026-09-26 sont archivés dans le
[registre d'audit](../projet/notes/2026-09-26-audit-contradictions-doublons-methodes.md) ;
celui-ci ne remplace pas les spécifications ou plans actifs.

## Index des spécifications et plans

| Domaine | Spécification(s) normative(s) | Suivi actif |
|---|---|---|
| Scène auteur, compilation et codec | [Scène](../specs/scene-authoring-spec.md), [codec CompiledScene](../specs/compiled-codec-v2-spec.md) | [Plan CompiledScene](./compiled-scene-plan.md) |
| Reconstruction, engine et player | [Reconstruction logique](../specs/runtime-reconstruction-v2-spec.md), [Engine/Player](../specs/engine-player-v2-spec.md) | [Plan Player](./player-engine-plan.md) |
| Façade et instances | [Façade](../specs/facade-v2-spec.md) | [Plan façade](./facade-engine-instance-plan.md) |
| Diagnostics structurés | [Diagnostics](../specs/diagnostics-v2-spec.md) | — |
| Événements, straps, stories et source DOM | [Pipeline événementiel](../specs/event-pipeline-v2-spec.md), [straps](../specs/strap-execution-v2-spec.md), [isolation des stories](../specs/story-isolation-spec.md), [Perso.emit](../specs/perso-emit-v2-spec.md) | [Straps](./strap-execution-plan.md), [isolation](./story-isolation-plan.md), [reset](./story-reset-plan.md), [Perso.emit](./perso-emit-v2-portage-plan.md) |
| Inactivité du player | [Monitor d'inactivité](../specs/idle-monitor-v2-spec.md) | — |
| Préchargement et synchronisation média | [Preload](../specs/preload-v2-spec.md), [media-sync](../specs/media-sync-v2-spec.md) | [Plan média](./media-preload-plan.md) |
| Composants HTML, layout et projection input | [Matérialisation](../specs/component-materialization-v2-spec.md), [layout](../specs/layout-component-spec.md), [projection input](../specs/input-projection-spec.md), [image](../specs/image-component-v2-spec.md), [input](../specs/input-component-v2-spec.md), [polygon](../specs/polygon-component-v2-spec.md) | [Représentation des composants](./component-render-representation-plan.md), [layout](./layout-part-marker-plan.md), [image/input/polygon/SVG](./components-image-input-polygon-svg-plan.md) |
| Relation et cibles de bibliothèques tierces | [Relation rel](../specs/third-party-rel-spec.md), [pont de cibles](../specs/third-party-target-bridge-spec.md), [bibliothèques](../specs/third-party-library-spec.md), [Three.js](../specs/third-party-threejs-spec.md), [Rive](../specs/third-party-rive-spec.md), [Avatar](../specs/third-party-avatar-spec.md) | [Pont CodPlay](./2026-09-18-third-party-render-target-codplay-plan.md), [intégrations](./2026-09-18-third-party-components-v2-plan.md), [Avatar](./2026-09-19-avatar-components-v2-plan.md) |
| Contenu foreign et slot | [Slot](../specs/slot-component-spec.md), [pont de cibles](../specs/third-party-target-bridge-spec.md) | [Plan foreign](./foreign-scene-component-plan.md) |
| Calculs ACE et actions temporelles | [Calculs ACE](../specs/ace-calculation-v2-spec.md), [ActionSequence/TweenAction](../specs/action-sequence-tween-v2-spec.md) | [Plan ActionSequence/TweenAction](./action-sequence-tween-plan.md) |
| Valeurs couleur et unités | [Couleurs](../specs/color-values-v2-spec.md), [unités](../specs/unit-values-v2-spec.md) | [Couleurs](./color-values-plan.md), [unités](./unit-values-plan.md) |
| Projection des transformations | [Canaux de transformation](../specs/transform-properties-v2-spec.md) | [Plan transform](./transform-properties-plan.md) |
| Move, retarget et présentation motion | [Move](../specs/move-v2-spec.md), [dépendance à la cible](../specs/move-target-dependency-v2-spec.md), [frontières motion](../specs/motion-frame-v2-spec.md) | [Dimensions de liste](./list-dimension-interpolation-plan.md), [retarget](./move-target-dependency-plan.md), [préparation motion](./motion-live-discovery-invalidation-plan.md), [intégration runner](./runner-flip-integration-study.md) |
| Capacités list et glisser-déposer | [List](../specs/list-capability-v2-spec.md), [DnD/list](../specs/list-dnd-v2-spec.md) | [Validation DnD/capture S6](./drag-capture-list-s6-validation-plan.md) |
| Capture continue | [Capture](../specs/capture-v2-spec.md) | [Validation S5](./capture-s5-validation-plan.md), [intégration du cycle source au cœur](./scroll-capture-core-integration-plan.md) |
| Observation par scroll | [Scroll-container](../specs/scroll-container-spec.md) | [Intégration du cycle capture au cœur](./scroll-capture-core-integration-plan.md) |

## Dette d'architecture différée à V2.5 — DnD et FLIP

> Statut : différée à V2.5 ; aucune migration DnD/FLIP n'est ouverte dans la
> tranche V2 actuelle.

La tranche V2 conserve DnD et FLIP/motion comme sous-systèmes de présentation
HTML. Le circuit de placement, d'ordre et de transition couple encore cette
présentation au module métier list, ce qui limite la substituabilité des
modules et le portage vers un materializer non HTML.

Lorsqu'une tranche V2.5 sera ouverte, son plan devra décider et valider :

- des modules runtime DnD et FLIP/motion enregistrés et instanciés par le
  catalogue comme les autres capacités ;
- des contrats de capture, placement, trajectoire et composition séparés des
  opérations DOM ;
- une frontière explicite entre ces modules et les runners/materializers HTML ;
- une direction de dépendance où le runner HTML adapte les contrats sans
  dépendre directement d'un module métier, notamment list ;
- les dépendances déclarées, le cycle de vie par player et les ports des futurs
  materializers non HTML ;
- des tests d'architecture montrant qu'un changement de materializer ou de
  module ne reconstruit pas un circuit HTML parallèle.
