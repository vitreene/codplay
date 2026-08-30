# ed2 — Reprise CodPlay V2 : rapport et plan de migration

**Statut : A relire — aucune étape de code n'est autorisée avant validation.**  
**Cible : ed2 avec CodPlay V2 foundation.**  
**Date : 2026-08-30.**

## Conclusion

Le raccordement de l'éditeur à V2 n'est pas un remplacement local de `codplay-v1` par `codplay`. Le bridge actuel dépend du cycle V1 `new CodPlay() -> studio.load() -> studio.player`, du `SceneDef` V1 produit par le builder et d'un `AuthorApi` construit sur le player V1. V2 impose le circuit explicite suivant :

```text
EditorScene -> SceneDoc V2 -> CompiledScene -> preload
  -> CodPlay.instances.create -> instance.telco
  -> état logique résolu -> runner HTML/DOM
```

V2 permet de lever la limite structurante de V1 : l'éditeur peut lire et modifier une contribution logique au temps `t`, avant matérialisation, au lieu de déduire ou d'écrire l'état depuis le DOM. Ce canal authoring est toutefois explicitement reporté par le plan de façade V2. Il doit être spécifié et construit comme adaptateur externe avant que le bridge puisse migrer.

La migration doit porter une verticale complète (builder, instance, authoring et interactions), puis remplacer le pont V1. Il ne faut ni adapter V1 vers V2 à l'exécution, ni maintenir deux players, deux catalogues ou deux circuits de décor dans l'application.

## Sources d'autorité lues

- `AGENTS.md` ;
- `packages/codplay/plan/codplay-v2-plan.md` ;
- `packages/codplay/plan/facade-engine-instance-plan.md`, particulièrement §8 ;
- `packages/codplay/plan/component-render-representation-plan.md` et `capture-authoring-plan.md` ;
- `packages/codplay/plan/notes/2026-08-26-decouverte-etat-codplay-v2.md` ;
- `packages/editor/plan/2026-07-18-editor-data-flow-inventory.md` ;
- `packages/editor/plan/2026-07-25-decor-unified-api-study.md` et `2026-07-25-decor-unified-channel-plan.md` ;
- `packages/authoring/selection-frame/plan/2026-07-18-pose-edit-architecture-study.md`.

Les contrats V1, dont `docs/formalisation/v1-author-api-spec.md`, restent des oracles de comportement à préserver, jamais une API à réimporter dans V2.

## État constaté

`app/bridges/scene-player-bridge.ts` crée `CodPlay` depuis `codplay-v1/creator`, appelle `studio.load()`, récupère `studio.telco`, puis construit `AuthorApi` depuis `studio.player`. Après chaque modification de document, le player V1 est reconstruit et le seek courant est rejoué. Les autres ponts reçoivent ensuite `AuthorApi`, telco et bridge offset via `PLAYER_READY`.

`packages/editor/src/builder/build-scene.ts` produit un `SceneDef` V1, des eventimes V1 et une feuille CSS injectée avec `extraResources`. Il ne produit ni `SceneDoc` V2 ni `CompiledScene` V2. Le builder et le bridge doivent donc être portés ensemble, par tranches.

| Besoin | Usage V1 actuel | État V2 |
| --- | --- | --- |
| Lecture à `t` | `getPersoStates()` pour le décor temporaire | Contrat cible prévu, non exposé |
| Pilotage | telco du studio | `instance.telco` disponible |
| Suivi du noeud | `subscribeToNode()` pour le cadre | Capacité HTML optionnelle, à spécifier |
| Lecture/écriture pose | `getNodePose()` / `setNodePose()` | À sortir du flux principal |
| Lecture CSS | ancien `getNodeSnapshot()` | Ne pas réintroduire |

Le décor temporaire lit déjà `getPersoStates()`, dans l'unité auteur, au lieu du node. En revanche, `LibreAdapter` écrit encore une pose V1 au fil du geste, puis l'offset est reconstruit pour rejoindre le canal `Decor`.

Le modèle `Decor` actuel reste à préserver : données keyframe-varying, cascade dynamique, copy-on-write et interpolation par le builder. Les données stables de l'item (contenu, définition des zones, preset) restent hors de cette cascade, selon la décision du 2026-07-25.

Quatre producteurs d'aspect doivent converger : palette/style/CSS libre, offset du Selection Frame, multi-sélection et édition de zones. Les deux premiers ne convergent aujourd'hui vers `controller.applyPatch()` qu'après des circuits distincts. La multi-sélection multiplie la même rupture. `zone-editor` est entièrement déconnecté de `Decor` et sa relation au simple `Decor.zoneId` n'est pas décidée : le portage V2 ne doit pas inventer cette relation.

V2 fournit déjà une projection logique puis une matérialisation HTML/DOM unique, persistante pendant play, seek, detach et reparentage ; la même boucle pour play, seek et resize ; les composants `tag`, `img`, `media`, `list` et les services `style`, `className`, `attr`, `content` ; le preload CSS scoped ; et une telco par instance.

V2 ne fournit pas aujourd'hui `load()` ni player public réutilisable, un accès générique de l'éditeur au DOM, `getPersoStates()` ou l'écriture authoring transitoire sur une instance, ni un équivalent V2 du builder ed2. Le runtime a en interne un chemin de mise à jour live des composants, mais ce n'est pas une API que l'éditeur peut appeler.

## "vDom" : clarification

Il n'existe pas de contrat public nommé `vDom` dans le dépôt. V2 n'expose ni un arbre virtuel mutable par l'éditeur, ni le DOM comme modèle de données. Le terme opérant est la **projection logique retenue/réconciliée** :

```text
materialize -> resolve -> solve -> component.update -> runner HTML
```

La migration doit s'appuyer sur cette projection : document et état résolu sont les sources de vérité ; un geste produit une contribution logique temporaire ; le runner la projette sur le DOM. Le DOM reste utile pour la géométrie du cadre, le hit-test et les pointeurs, jamais pour reconstituer `Decor` ou une pose persistable. Cela est indispensable pour rester correct pendant une présentation FLIP, un seek ou un resize.

## Position proposée sur `setNodePose()`

`setNodePose()` ne doit plus être le mécanisme principal d'édition de l'offset. La cible est la contribution authoring déjà fixée par le plan de façade :

```ts
{ persoId, timeMs, state: Partial<Record<string, unknown>> }
```

Elle remplace, avant matérialisation, les seules propriétés fournies de l'état résolu à `timeMs`. Elle ne modifie ni `CompiledScene`, ni journal, ni document éditeur. À la fin du geste, l'éditeur convertit cette même contribution en `DecorPatch` et la persiste par son unique transaction `setDecor`/copy-on-write.

Le Selection Frame reste un consommateur de géométrie DOM, non l'écrivain de l'état de l'item. `subscribeToNode()` peut donc subsister comme capacité HTML optionnelle pour ancrer le cadre. `getNodePose()`/`setNodePose()` ne seraient conservés que si une interaction impossible à exprimer logiquement était démontrée ; les gestes connus (move, resize, rotate, scale) ne le justifient pas.

## Architecture cible

```text
EditorScene
  -> builder ed2 V2 -> SceneDoc V2 -> CodPlay.build -> CompiledScene
  -> preload CSS/médias -> resources.register -> instances.create
  -> instance.telco

adaptateur authoring externe
  -> état résolu à t / contribution transitoire à t
  -> solve + component.update + runner HTML
  -> noeud HTML (géométrie seulement) -> Selection Frame
  -> deltas -> contribution transitoire -> DecorPatch
  -> transaction éditeur unique -> EditorScene
```

L'adaptateur authoring appartient à `packages/authoring`, dépend de la frontière d'instance V2 et ne donne pas accès au `RuntimePlayer`, catalogue ou materializer. Son point d'attachement précis est ouvert : la façade actuelle cache justement ces objets, mais ne livre pas encore cette capacité.

## Plan de reprise proposé

### 0. Valider le contrat authoring V2

Écrire puis valider le contrat de l'adaptateur : obtention depuis une instance, lecture de l'état résolu, observation de lecture, écriture/remplacement/effacement d'une contribution transitoire, annulation au seek/rebuild/destroy, et diagnostics. Aucune modification de `packages/codplay` avant l'acceptation explicite de cette tranche.

**Preuve :** contrat relu et décisions dépendantes hors statut `A relire`.

### 1. Porter une verticale de builder vers V2

Créer une frontière `EditorScene -> SceneDoc V2`, d'abord avec une capsule racine, un texte et deux keyframes de décor. Préserver ids, cascade, styles, offset dans l'unité auteur, interpolation, pré-roll et les mappings supportés : `text/bloc -> tag`, `image -> img`, `media/video -> media`, capsules -> `list`.

Le CSS de capsule-automation passe par le preload V2 scoped sur la racine de scène ; pas de `<style>` ou `extraResources` V1 dans le bridge.

**Preuve :** build, preload, création d'instance, seek avant/dans/après interpolation, play, resize et teardown dans un navigateur réel. Les cas V1 servent d'oracles, mais les deux runtimes ne tournent pas dans la même scène.

### 2. Construire l'adaptateur authoring minimal

Implémenter l'adaptateur accepté à l'étape 0. La surface node reste différée ; si le cadre en a besoin, n'ajouter que `subscribeToNode()` comme capacité HTML étroite, sans lecture ou écriture d'état via le node.

**Preuve :** tests au temps exact : contribution partielle, remplacement, effacement, seek, destruction et absence de lecture DOM après resize.

### 3. Unifier le canal `Decor`

Faire de la contribution transitoire la seule preview. Palette et Selection Frame produisent des patches de même nature ; le contrôleur garde l'unique écriture persistante, la cascade et le copy-on-write. Définir une résolution de cascade unique consommée par lecture, insertion de keyframe et builder.

**Preuve :** palette, offset, couleur, CSS libre, insertion à mi-interpolation, seek/replay, annulation, copy-on-write et réordonnancement.

### 4. Porter Selection Frame et multi-sélection

`LibreAdapter` transforme les deltas de pointeur et la géométrie locale en patchs logiques remis au canal authoring V2. La multi-sélection diffuse le même patch sur les items ciblés avec une persistance atomique.

**Preuve :** move/resize/rotate/scale sur un et plusieurs items, pendant une interpolation, avec pause/reprise, seek, resize, changement de sélection, interruption, rebuild et Safari.

### 5. Spécifier les zones avant intégration

Décider la relation entre la définition stable de zone de capsule et l'affectation temporelle de zone de l'enfant, ainsi que la représentation V2 du placement. Cette décision est bloquante : elle ne se déduit pas de `Decor.zoneId`.

**Preuve :** spécification `Fixe`, puis tests parent/enfant, orientation, play/seek/resize et persistance.

### 6. Basculer puis retirer V1

Remplacer `scene-player-bridge` seulement une fois les étapes précédentes validées. L'éditeur possède alors un seul `CodPlay` V2, une instance de scène et un adaptateur authoring. Retirer les imports V1 et le bridge de pose devenu inutile après la validation intégrale, pas avant.

**Preuve :** application éditeur réelle : décor, interactions, play, seek, resize, persistance, destruction ; tests complets affectés, typecheck, build, Safari et absence de double runtime.

## Décisions à valider

| Décision | Proposition | Statut |
| --- | --- | --- |
| "vDom" | Projection logique réconciliée, pas API VDOM mutable | À valider |
| Interaction | Contribution transitoire `{ persoId, timeMs, state }` | À valider |
| `setNodePose()` | Non requis pour les gestes connus | À valider |
| Attachement authoring | Capability externe sans exposition des classes runtime | À concevoir |
| Rebuild sur commit | Recompiler et recréer l'instance ; jamais muter `CompiledScene` | À valider |
| CSS généré | Preload V2 scoped, cycle de libération des Blob URLs à spécifier | À valider |
| Zones | Définition stable de capsule distincte de l'affectation temporelle enfant | Bloquant |

## Garde-fous

- Les actions V1 du builder ne prouvent pas leur compatibilité V2 : chaque mapping doit passer par le contrat du composant V2 concerné.
- Une conversion unitaire ne suffit pas : toute validation traverse builder, player, materializer, seek et lifecycle réels.
- Une transformation FLIP est une présentation transitoire, jamais une pose auteur à capturer.
- Le travail local non lié sur le preload média est hors périmètre et doit être préservé.
- Ce rapport n'autorise aucune modification du cœur V2. Une tranche acceptée et une autorisation explicite restent nécessaires.

La revue doit d'abord trancher la frontière authoring et les zones. Ce document pourra ensuite être découpé en plans exécutables ; tant qu'il est `A relire`, il décrit une direction et les preuves attendues, pas un contrat de code.
