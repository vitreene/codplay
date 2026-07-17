# ed2 — Plan général

**Périmètre** : nouvelle application éditeur de scène complète, dans `packages/editor`, référencée « ed2 » (alias « EddyDeux »). Assemble trois modules déjà conçus (player Codplay, grid-editor = `sequence-editor`, dedit = `decor-editor`) plus un nouveau composant, le **Builder**.

**Rôle de ce document** : organiser l'ordre d'implémentation entre les chantiers détaillés ci-dessous. Il ne contient pas le détail de chaque chantier — chacun a son propre document dans ce dossier.

**Organisation du dossier `packages/editor/plan/`** :
- Documents **normatifs** (décidés, déclaratifs) — à garder. Répartis en :
  - **racine** : ce qui chapeaute ou est transverse — ce plan général, et les specs du domaine (capsule, item) lues par l'app comme par les modules ;
  - **`app/`** : la construction de l'**app elle-même** — plan de construction, architecture, modèle de données, Builder, SceneDocEditor, moteur de validation ;
  - **`modules/`** : les **modules** assemblés par l'app — sequence-editor, dedit, capsule-automation, variantes d'orientation, présentation Codplay.
- `notes/` = discussions, hypothèses, points non tranchés — matière de travail, **jetable** (on finira par l'effacer, on garde les plans). Un point qui migre de `notes/` vers un document normatif doit être formulé sans trace de l'hésitation qui a précédé.

---

## Documents du chantier

| # | Document | Type | Statut | Emplacement |
|---|---|---|---|---|
| 1 | Réconciliation capsule-automation ↔ CapsuleDistribution | Plan | **Terminé et vérifié (2026-07-08)** | `packages/editor/plan/modules/2026-07-08-capsule-automation-reconciliation-plan.md` |
| 2 | Audit et remise à niveau de `SceneDocEditor` depuis Codplay | Plan | **Terminé et vérifié (2026-07-09)** | `packages/editor/plan/app/2026-07-08-scenedoceditor-audit-plan.md` |
| 3 | Construction du Builder | Spec + Plan | **Terminé (2026-07-09, étapes 1 à 7 closes)** | `packages/editor/plan/app/2026-07-08-builder-plan.md` |
| 4 | Moteur de validation métier (ed2) | Plan | Écrit (dépend de 3) | `packages/editor/plan/app/2026-07-08-validation-engine-plan.md` |
| 5 | Spec capsule (ed2) | Spec | Écrit, fermée (tous les points tranchés) | `packages/editor/plan/2026-07-08-capsule-spec.md` |
| 6 | Spec modèle d'Item (ed2) | Spec | Écrit, fermée (tous les points tranchés) | `packages/editor/plan/2026-07-08-item-model-spec.md` |
| 7 | Éditeur de zones (Phase 2 selection-frame) | Plan | **Exécuté pour l'essentiel (2026-07-10)** — `ZoneDef.container` (cf. `docs/plans/2026-07-10-zone-container-design.md`) ; reste cs↔zones | `docs/plans/2026-07-03-selection-frame-variantes-plan.md` |
| 8 | Migration `ZoneDef` dedit → forme grille | Plan | Écrit — parqué (le décor attend) | `packages/editor/plan/modules/2026-07-08-dedit-zonedef-migration-plan.md` |
| 9 | Refonte interface dedit (shadcn) | Plan | Écrit (esquisse seulement — détails pilotés par l'utilisateur) — parqué (le décor attend) | `packages/editor/plan/modules/2026-07-08-dedit-shadcn-ui-plan.md` |
| 10 | Construction de l'app (squelette, contrôleur général, composants, sauvegarde locale) | Plan | **Écrit (2026-07-10)** | `packages/editor/plan/app/2026-07-10-app-construction-plan.md` |
| 11 | Variantes d'orientation des zones/grilles (capsule-automation) | Plan | **Écrit (2026-07-11)** — chantier autonome, exécutable en parallèle | `packages/editor/plan/modules/2026-07-11-zone-orientation-variants-plan.md` |
| 12 | Modèle de données (EditorScene, item, capsule, content, décor…) | Spec / structure | **Écrit (2026-07-11)** — structure exhaustive ; arbitrages tranchés | `packages/editor/plan/app/2026-07-11-ed2-document-model.md` |
| 13 | Représentation sequence-editor (pistes, mini-éditeur audio) | Plan | **Écrit (2026-07-11)** — multipiste audio non fait | `packages/editor/plan/modules/2026-07-11-sequence-editor-representation.md` |
| 14 | Item avatar (typeDef, pistes, macros, tempérament) | Spec + Plan | **Écrit (2026-07-16)** — chantier futur, rien d'implémenté | `packages/editor/plan/2026-07-16-avatar-item-plan.md` |

**Schémas de présentation** (pédagogiques, **non normatifs** → `notes/`, jetables) : architecture logique de l'app (`notes/2026-07-11-ed2-architecture.md`), présentation Codplay (`notes/2026-07-11-codplay-presentation.md`). Ils expliquent, ne prescrivent pas.

## Ordre d'implémentation

1. **Réconciliation capsule-automation ↔ CapsuleDistribution — terminé (2026-07-08).** `CapsuleDistribution` (déplacée dans `packages/authoring/scene-factory/`) fait foi pour le timing ; capsule-automation se recentre sur catalogue de transitions + génération CSS/grid, consommant un `timeRange` déjà résolu par enfant plutôt qu'en le recalculant. `GRID_MODE` fixé par sous-type (plus un champ caller-fourni). Mise en test faite (capsule-automation : 21 tests, zéro avant ce chantier ; `CapsuleDistribution` : 13, dont 6 nouveaux sur `stagger`).
2. **Audit et remise à niveau de `SceneDocEditor` — terminé (2026-07-09).** `id?` explicite + collision sur `createStory`/`createPerso`, `scene.onStart`/`scene.onSequenceEnd`, `scene.state`, `cloneStory()` préserve `trackId`, `Perso.list?: ListConfig` ajouté côté Codplay et suivi par `clonePerso()`. `docs/formalisation/v1-authoring-api.md` étendu en premier (capacités absentes depuis toujours, pas une staleness) avant de toucher l'implémentation. Seul l'usage réel de `scene.state` dans quiz-hunt (état partagé cross-stories) reste différé — la capacité elle-même est faite.
3. **Construction du Builder** — dépend de (1) et (2). Couvre : construction du `SceneDef` (persos, eventimes, actions) via `SceneDocEditor` remis à niveau, capsule racine (`list`, `flip:false`), génération et branchement de la feuille de style. Une validation explicitement demandée à mener ici :
   - **Feuille de style vérifiée par un test concret** : Blob CSS généré dynamiquement (`type:'text/css'`) → `extraResources` → rendu effectif dans une scène jouée. Aucune démo existante n'exerce ce chemin précis (seul un CSS statique est aujourd'hui prouvé via `preload-media-demo.ts`).
4. **Moteur de validation métier (ed2)** — dépend de (3) : valide la sortie du Builder (invariants capsule racine, intégrité référentielle des moves, unicité des noms d'action, existence des `ref` de transition) avant compilation. Pièce distincte de `SceneDocEditor` (qui reste un pur squelette) et du Builder (orchestration).
5. **Spec capsule (ed2)** — dépend de (1) et (3) : décrit le comportement normatif d'une capsule une fois le moteur de timing et le Builder stabilisés. Fermée — tous les points de fusion tranchés, y compris le mapping `CapsuleKind` → `GRID_MODE` (un mode fixe par sous-type) et la fusion `position`/`card` (`placementPolicy: explicitOnly`, zone pleine surface par défaut).
6. **Spec modèle d'Item (ed2)** — dépend de (5) (une capsule est un item d'un type particulier). Unifie `ItemType` (dedit), `TrackNode` (sequence-editor) et `Perso` (Codplay). Fermée — `bloc` résolu (text à contenu vide, pas une valeur distincte), futurs types média (story-comme-média, lotties, rive, threejs) résolus en principe (valeurs distinctes, ajoutées à la disponibilité du composant Codplay correspondant).
7. **Éditeur de zones (Phase 2)** — indépendant de (1)-(6), peut avancer en parallèle. Plan déjà entièrement arbitré, il ne reste qu'à l'exécuter (`zone-model.ts`, `zone-machine.ts`, `zone-editor.ts`).
8. **Migration `ZoneDef` dedit** — dépend de (7) (ou au moins de la forme retenue par le plan zones) : dedit possède aujourd'hui un `ZoneDef` incompatible (rectangle cqw) avec celui du plan zones (`{name,row,col,rowSpan,colSpan}`).
9. **Refonte interface dedit (shadcn)** — dépend de (3)/(5)/(8) autant que possible : éviter de refaire l'UI deux fois si le modèle de décor/zones bouge encore. Dernier de la liste par défaut, sauf besoin contraire de l'utilisateur.
10. **Construction de l'app** — recadrage utilisateur (2026-07-10) : les points précédents ne sont que des préalables ; l'app passe devant (8)/(9), le décor attend. Séquence : squelette vide (layout général + librairies) → contrôleur général (fondamental, définition avant code) → composants (React ; sequence-editor et player restent vanilla ; Eddy jamais une référence, accès sur invitation) → sauvegarde provisoire localStorage → backend prisma-sqlite (modèles élaborés alors ; piste pressentie : architecture react-router). Détail : `app/2026-07-10-app-construction-plan.md`.

## Décisions déjà actées (résumé — détail complet en mémoire de session, à reporter dans les documents détaillés)

- Scène ed2 = une story, pas de straps, pas d'écoute (`listen: []`) — config légale, pas dégradée.
- Toute scène a une **capsule racine implicite**, plein cadre, non supprimable, non sélectionnable comme item, sans keyframe ni position propre ; sélectionnée via la « non-sélection » ou le nom de la scène. Sous-type capsule-automation : `card` (zéro zone définie) — fond layout pour placer les items dessus ; layouts par défaut via zones/Cards devient possible nativement, plus besoin d'une amélioration séparée.
- **Tous** les types de capsule compilent vers un perso `list` (pas de mapping différencié par type) ; nesting `list`-dans-`list` confirmé sans restriction technique. `flip:false` systématique sur les moves de la capsule racine (FLIP neutralisable, vérifié).
- Nommage `carrousel`/`carousel` : l'anglais fait foi (`carousel`) — renommé dans capsule-automation et `CapsuleKind` (fait, 2026-07-08).
- `CapsuleDistribution` fait foi pour le timing ; capsule-automation complémentaire (CSS + eventimes), pas concurrent. `CapsuleDistribution`, `SceneDocEditor` et le moteur de validation — les trois classes métier du Builder — sont colocalisées dans `packages/authoring/scene-factory/`.
- `GRID_POLICY` (capsule-automation) retiré, `GRID_MODE` seul pilote la forme de la grille. `GRID_MODE.areas` retiré aussi (ambigu avec les zones, strictement dominé par elles) : `GRID_MODE` a 4 valeurs (`manual`/`forced`/`derived`/`list`). Mapping `CapsuleKind`→`GRID_MODE` fixé : `carousel→forced`, `rangee→derived`, `grille`/`card→manual`, `liste→list`. `position` fusionné dans `card` (mêmes `gridPolicy:'areas'` déjà en commun) ; `legacy` retiré — `CapsuleKind`/`CAPSULE_TYPE` ont désormais exactement les mêmes 5 valeurs.
- `CapsulePatch` (dedit) : `defaultTransition` scindé en `defaultTransitionIn`/`defaultTransitionOut` ; `grid.preset` retiré au profit de `rows`/`cols`/`gap` explicites. Pas encore reporté dans `2026-07-07-dedit-spec.md` ni dans le code — prévu pour le chantier UI dedit.
- `eventTimes` (capsule-automation) et cues/markers (sequence-editor) sont des mécanismes distincts par nature (déclenchement vs label temporel) — la résolution label→ms reste interne à sequence-editor, capsule-automation ne voit jamais de cue.
- Modèle d'Item : l'id d'un item est directement l'id de son perso Codplay (aucune dérivation). `TrackNode.contentType` (inerte, jamais lu) fusionné dans un nouveau `TrackNode.itemType: ItemType` — le type de perso Codplay reste toujours dérivé par le Builder, jamais stocké séparément.
- Feuille de style générée par capsule-automation : branchée via `CodPlay.load({extraResources: [{type:'css', url, policy}]})`, jamais en `<style>` direct (pour survivre à l'export/diffusion de la scène).
- Stack ed2 : React + shadcn + base-ui ; XState possède tout l'état partagé, React ne fait que du rendu. Politique de hooks détaillée dans `skill.md` (racine du repo).
- Rôle d'Eddy (prototype sœur) : non normatif. Seuls le chutier (media bin) et whisper (transcription) seront réemployés « au moment adéquat ». Tout le reste écarté (cf conflit React/XState non maîtrisé dans Eddy, à l'origine de la politique de hooks stricte d'ed2).
- Premier incrément de construction : fixture `EditorScene` → Builder → `SceneDef` → player. **Révisé (2026-07-09)** : validé à la fois par test automatisé ET par un rendu réel dans une démo (`?demo=ed2-builder`) — décision explicite de l'utilisateur, pas seulement « headless ». La coquille React (chutier/menu/télécommande) vient après (interactions timeline, puis décor).
- « bloc » (ItemType) : pas une valeur distincte, un `text` à contenu vide (surface colorée). Futurs types média (story-comme-média, lotties, rive, threejs) : valeurs `ItemType` distinctes (propriétés dédiées propres à chacun), jamais des discriminants sous `media` — ajoutés à la disponibilité du composant Codplay correspondant.
- `constraints.minDurationMs`/`maxDurationMs` (capsule-automation) retirés : non consommés nulle part, reliquat Eddy probable (cf `modules/2026-07-08-capsule-automation-reconciliation-plan.md` §3.1).
- `SceneDocEditor` : `createStory`/`createPerso` acceptent un `id?` explicite (collision rejetée, jamais un écrasement) — ed2 peut imposer ses propres ids déterministes. `scene.onStart`/`scene.onSequenceEnd`/`scene.state` exposés (effets de bord auteur type transmission backend ; état niveau scène, distinct de `story.state`). `SceneDef.name?` ajouté (`create({id, name?})`, symétrique à `story.name`/`perso.name`). `trackId`/`Perso.list` ne se perdent plus au clone. `docs/formalisation/v1-authoring-api.md` étendu pour couvrir ces ajouts — absents de la spec depuis toujours, pas une régression corrigée.
- Principe transverse posé pendant ce chantier : à chaque ajout/modif de champ sur `SceneDef` ou `StoryDef`, se demander si l'autre niveau en a besoin aussi — pas une équivalence stricte, une question de familiarité auteur (cf mémoire de session `feedback-scene-story-parameter-symmetry`).

## Hors périmètre (parqué, pas bloquant)

- Rôle `master` sur une track (horizon/`progressEndMs`) : non testé nulle part dans Codplay, sans rapport avec ed2 — la plupart des démos Codplay tournent déjà sans média. À tester un jour dans une démo Codplay dédiée.
- Usage réel de `scene.state` dans quiz-hunt (démo Codplay) : la capacité existe maintenant dans `SceneDocEditor`/`v1-authoring-api.md`, mais son emploi pour un état partagé cross-stories dans quiz-hunt lui-même reste différé au retour sur ce chantier.

## Conventions transverses au chantier

- **Code très documenté**, comme le reste du projet — commentaires explicatifs sur les fonctions/classes, pas seulement sur les cas non-évidents.
- **Parties « cœur »** (Builder, réconciliation capsule-automation/CapsuleDistribution, montage de la capsule racine) : l'utilisateur veut suivre la progression de l'écriture au fil de l'eau pour intervenir au besoin — avancer par incréments courts et montrer le code au fur et à mesure plutôt que de livrer de gros blocs d'un coup, sur ces parties précisément.
