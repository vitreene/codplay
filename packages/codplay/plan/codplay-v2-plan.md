# CodPlay V2 — feuille de route générale

## Rôle du document

Les spécifications sont les références normatives des comportements certifiés.
Les plans détaillés conservent les décisions à prendre, les décisions acceptées
mais non appliquées, les actions et leurs critères de vérification. Ce document
indexe les deux ; il ne répète ni les contrats ni l'avancement détaillé.

Un domaine sans décision ni validation résiduelle est référencé par sa
spécification seule. Une case « — » dans l'index des spécifications indique
qu'aucun plan de partie n'est ouvert.

Les règles de travail sont dans [AGENTS.md](../../../AGENTS.md).
Cet index distingue les acceptations des circuits V2 existants et les
évolutions futures, qui ne constituent pas des contrats certifiés.

## Index des spécifications et plans

| Domaine | Spécification(s) normative(s) | Suivi actif |
|---|---|---|
| Scène auteur, compilation et codec | [Scène](../specs/scene-authoring-spec.md), [codec CompiledScene](../specs/compiled-codec-v2-spec.md) | [Acceptation CompiledScene](./compiled-scene-plan.md) |
| Export d’une scène CodPlay | [Paquet de diffusion](../specs/scene-package-export-v1-spec.md) | — ; le défaut vidéo relève du [plan média](./media-preload-plan.md) |
| Reconstruction, engine et player | [Reconstruction logique](../specs/runtime-reconstruction-v2-spec.md), [Engine/Player](../specs/engine-player-v2-spec.md) | [Plan Player](./player-engine-plan.md) |
| Façade et instances | [Façade](../specs/facade-v2-spec.md) | — |
| Diagnostics structurés | [Diagnostics](../specs/diagnostics-v2-spec.md) | — |
| Événements, straps, stories et source DOM | [Pipeline](../specs/event-pipeline-v2-spec.md), [straps](../specs/strap-execution-v2-spec.md), [isolation](../specs/story-isolation-spec.md), [Perso.emit](../specs/perso-emit-v2-spec.md) | [Straps](./strap-execution-plan.md), [isolation](./story-isolation-plan.md), [Perso.emit](./perso-emit-v2-portage-plan.md) ; reset motion dans le [plan motion](./motion-live-discovery-invalidation-plan.md#reset-chaud) |
| Inactivité du player | [Monitor d'inactivité](../specs/idle-monitor-v2-spec.md) | — |
| Préchargement et synchronisation média | [Preload](../specs/preload-v2-spec.md), [media-sync](../specs/media-sync-v2-spec.md) | [Plan média](./media-preload-plan.md) |
| Composants HTML, layout et projection input | [Matérialisation](../specs/component-materialization-v2-spec.md), [layout](../specs/layout-component-spec.md), [projection input](../specs/input-projection-spec.md), [image](../specs/image-component-v2-spec.md), [input](../specs/input-component-v2-spec.md), [polygon](../specs/polygon-component-v2-spec.md) | [Représentation des composants](./component-render-representation-plan.md), [layout](./layout-part-marker-plan.md), [image/input/polygon/SVG](./components-image-input-polygon-svg-plan.md) |
| Méthodes demandées par une action dans la projection HTML | [Matérialisation](../specs/component-materialization-v2-spec.md), [méthodes HTML](../specs/html-element-method-spec.md), [scène](../specs/scene-authoring-spec.md) | [Capacité de projection HTML `htmlElementMethod`](./node-method-capability-plan.md) |
| Relation et cibles de bibliothèques tierces | [rel](../specs/third-party-rel-spec.md), [pont](../specs/third-party-target-bridge-spec.md), [bibliothèques](../specs/third-party-library-spec.md), [Three.js](../specs/third-party-threejs-spec.md), [Rive](../specs/third-party-rive-spec.md), [Avatar](../specs/third-party-avatar-spec.md) | [Intégrations et pont](./2026-09-18-third-party-components-v2-plan.md), [Avatar](./2026-09-19-avatar-components-v2-plan.md) |
| Contenu foreign et slot | [Slot](../specs/slot-component-spec.md), [pont de cibles](../specs/third-party-target-bridge-spec.md) | [Plan foreign](./foreign-scene-component-plan.md) |
| Remplacement texte, média et slot | [Slot](../specs/slot-component-spec.md), [texte](../specs/replace-text-v2-spec.md), [média](../specs/replace-media-v2-spec.md), [presets](../specs/replace-presets-v2-spec.md), [présentation](../specs/replace-presentation-v2-spec.md) | — |
| Calculs ACE et actions temporelles | [Calculs ACE](../specs/ace-calculation-v2-spec.md), [ActionSequence/TweenAction](../specs/action-sequence-tween-v2-spec.md) | [Plan ActionSequence/TweenAction](./action-sequence-tween-plan.md) |
| Valeurs couleur et unités | [Couleurs](../specs/color-values-v2-spec.md), [unités](../specs/unit-values-v2-spec.md) | [Couleurs](./color-values-plan.md) |
| Projection des transformations | [Canaux de transformation](../specs/transform-properties-v2-spec.md) | [Plan transform](./transform-properties-plan.md) |
| Move, retarget et présentation motion | [Move](../specs/move-v2-spec.md), [dépendance à la cible](../specs/move-target-dependency-v2-spec.md), [frontières motion](../specs/motion-frame-v2-spec.md) | [dimensions de liste](./list-dimension-interpolation-plan.md), [retarget](./move-target-dependency-plan.md), [préparation motion](./motion-live-discovery-invalidation-plan.md), [intégration runner](./runner-flip-integration-study.md) |
| Capacités list et glisser-déposer | [List](../specs/list-capability-v2-spec.md), [DnD/list](../specs/list-dnd-v2-spec.md) | [Validation DnD/capture S6](./drag-capture-list-s6-validation-plan.md) |
| Capture continue | [Capture](../specs/capture-v2-spec.md) | [Intégration capture/list](./drag-capture-list-s6-validation-plan.md) |
| Observation par scroll | [Scroll-container](../specs/scroll-container-spec.md) | [Sources, observations et reset](./scroll-observation-registration-plan.md) |

## Évolutions séparées

Les versions des sujets non affectés restent à décider. Leur déplacement ne
valide pas leurs propositions et ne les ajoute pas à la stabilisation V2.

| Cible | Suivi |
|---|---|
| V2.5 | [Modules DnD/FLIP et authoring JSX/init](./evolutions/v2.5-plan.md) |
| V3 | [Résultats asynchrones obsolètes des straps](./evolutions/v3-plan.md) |
| À affecter | [Décisions et extensions par domaine](./evolutions/evolution-backlog.md), [découverte des actions](./evolutions/action-discovery-plan.md), [unités](./evolutions/unit-values-plan.md), [export distant et compatibilité](./evolutions/scene-export-plan.md) |
