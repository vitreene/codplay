# Plan — Moteur de validation métier (ed2)

**Périmètre** : nouvelle pièce, `packages/authoring/scene-factory/` — colocalisée avec `SceneDocEditor` et `CapsuleDistribution`, les deux autres classes métier du Builder. Valide la sortie du Builder (`SceneDef`) avant compilation, pour des règles spécifiques à ed2 que ni `SceneDocEditor` ni le validateur Codplay existant ne couvrent.
**Origine** : question exploratoire de l'utilisateur (2026-07-08) sur l'utilité d'un moteur de validation métier, en regard du principe acté que `SceneDocEditor` reste un pur helper de squelette (`2026-07-08-scenedoceditor-audit-plan.md` §1) — pas l'endroit pour ces règles.
**Dépend de** : `2026-07-08-builder-plan.md` (valide sa sortie), `2026-07-08-scenedoceditor-audit-plan.md`.

---

## 1. Pourquoi

Plusieurs échecs identifiés au fil du travail sur ed2 sont aujourd'hui **silencieux ou mal tracés** :

- `move.parentId` qui ne résout rien → la capsule/l'item n'est jamais monté, sans erreur claire (`AUTHOR_LAYOUT_OUTLET_NOT_FOUND` est un fourre-tout générique, déclenché au runtime, pas au build).
- Deux persos qui partagent par erreur un nom d'action → les deux réagissent au même eventime, sans avertissement (cf règle eventime/action, `2026-07-08-builder-plan.md` Principe A).
- Une référence de transition nommée (`ref`) absente du catalogue capsule-automation → résolue à `null` silencieusement (`resolveEventDefinition` dans capsule-automation).
- Invariants de la capsule racine (`move:'@root'` exigé à la fois côté story et côté perso) non vérifiés — un seul mal posé et la capsule racine n'est jamais montée, sans indication.

Le validateur Codplay existant (`BuilderValidator`) ne couvre que des cas génériques et transverses à tout Codplay (`AUTHOR_TRACKS_INVALID`, doublons `listen`, identité d'id) — rien de spécifique aux conventions ed2.

## 2. Ce que ce n'est pas

- **Pas dans `SceneDocEditor`** — qui reste un pur helper de squelette (structure + défauts), jamais un moteur de règles (principe acté, `2026-07-08-scenedoceditor-audit-plan.md` §1).
- **Pas dans le Builder lui-même** — le Builder oriente/orchestre la construction ; la validation est une étape séparée qu'il invoque, pas une responsabilité qu'il porte en interne mélangée à la construction.
- **Pas un remplacement du `BuilderValidator` Codplay** — celui-ci continue de tourner à la compilation (`BuilderFacade.compile()`) pour ses propres règles génériques. Le moteur ed2 s'exécute **avant**, sur des règles que Codplay ne peut pas connaître (elles dépendent des conventions ed2 : capsule racine, nommage d'actions, catalogue de transitions).

## 3. Règles — état réel (2026-07-09)

3 des 5 règles envisagées au départ sont implémentées ; les 2 autres ont été retirées du périmètre, chacune pour une raison structurelle vérifiée (pas un report arbitraire) :

| Règle | Détecte | Statut |
|---|---|---|
| Intégrité référentielle des `move.parentId` | Toute cible de move qui ne résout vers aucun id réel de la scène construite (recherche cross-story, comme Codplay lui-même) | **Fait** — `rule-move-parent-integrity.ts` |
| Unicité des noms d'action par story | Deux persos partageant un même nom de clé dans `actions` (collision, cf Principe A) | **Fait** — `rule-unique-action-names.ts` |
| Invariants de la capsule racine | Story dont le `move` résout à `'@root'` mais sans exactement un perso qui résout lui aussi à `'@root'` (absent ou dupliqué) | **Fait** — `rule-root-capsule-invariants.ts` |
| Existence des `ref` de transition | ~~Toute référence à une transition nommée absente du catalogue capsule-automation résolu~~ | **Retirée** — le `ref` littéral (ex. `'fade-invalide'`) ne survit pas jusqu'au `SceneDef` final : `build-scene.ts` ne recopie que le diff de style déjà résolu (`event.definition?.style`), qui devient silencieusement `undefined` si le ref est invalide (`resolveEventDefinition`, capsule-automation, retourne `null` sans erreur). Le seul endroit où le ref littéral survit est `AutoCapsuleChildElementArtifact.events[action].ref` — un artefact **intermédiaire** du pipeline, jamais présent dans le `SceneDef` que ce moteur valide. Une règle ici ne pourrait donc structurellement rien détecter. À rouvrir seulement si `build-scene.ts` recopie un jour ce `ref` quelque part de façon traçable sur le perso final. |
| Cohérence de mapping ItemType → type perso | ~~Types perso non enregistrés dans le registre Codplay~~ | **Retirée** — il n'existe **aucun registre consultable à l'exécution** : `PersoTypeRegistry`/`CorePersoType` (`packages/codplay/src/runtime/perso-type-registry.ts`) sont un pur type TypeScript compile-time (`interface` + `keyof`), sans const/array exporté. L'enregistrement réel se fait dynamiquement via `registerComponent()` (l'appelant applicatif alimente une `Map` privée de l'orchestrateur runtime, jamais exposée). Dupliquer la liste en dur dans ce moteur romprait le Principe B (aucune donnée inventée/copiée sans source unique) et se désynchroniserait silencieusement dès qu'un composant tiers (lottie, rive, threejs — prévus, pas encore présents) s'ajoute au registre applicatif. **Chantier distinct identifié, pas encore ouvert** : un vrai mécanisme d'identification/enregistrement dynamique des composants tiers côté app, dont ce moteur de validation pourrait un jour dépendre — décision explicite de l'utilisateur de le traiter séparément, après ce présent chantier. |

`mapContentTypeToPersoType` (`build-scene.ts`) reste le seul garde-fou pour le mapping ItemType→perso aujourd'hui (il throw pour tout `contentType` non supporté) — pas remplacé par une règle de ce moteur, cf tableau ci-dessus.

## 4. Architecture — telle qu'implémentée

- Emplacement confirmé : `packages/authoring/scene-factory/src/validation/` — colocalisé avec `SceneDocEditor`/`CapsuleDistribution`/`CapsulePreset`. Question posée explicitement (les 3 règles restantes sont toutes des conventions ed2, pas des règles Codplay génériques réutilisables par un autre outil) — tranchée par l'utilisateur : `scene-factory` reste le bon endroit, ce paquet EST déjà le paquet ed2, pas un paquet Codplay générique partagé.
- Règles = **fonctions pures** (`rule-*.ts`, une par fichier), chacune `(sceneDoc: SceneDef) => SceneValidationDiagnostic[]`, testables indépendamment. Prennent uniquement le `SceneDef` — pas besoin du contexte `EditorScene` source, puisque `perso.id === track.id` partout dans la sortie du Builder (vérifié dans `build-scene.ts`/ses tests), donc l'id perso EST déjà l'ancrage ed2 nécessaire.
- Format de diagnostic : `SceneValidationDiagnostic{level, code, message, context?}` (`validation/types.ts`) — `level: 'error'|'warning'` (const object `SCENE_VALIDATION_LEVEL`, même style que `DIAGNOSTIC_LEVEL` de capsule-automation), `context` structuré (`storyId`/`persoId`/`actionName`) plutôt qu'un seul `childId` comme `AutoCapsuleDiagnostic` — ed2 a besoin d'ancrer un diagnostic à des choses différentes selon la règle. Ni `AutoCapsuleDiagnostic` ni `ApiWarning` (Codplay) réutilisés tels quels : aucun des deux n'a de `context` structuré, et `ApiWarning` n'a même pas de `level`.
- `validateSceneDoc(sceneDoc): {ok, diagnostics}` (`validate-scene-doc.ts`) agrège les 3 règles ; `ok` devient `false` dès qu'un diagnostic `error` est présent (un `warning` seul laisse `ok:true` — aucune règle n'émet de `warning` aujourd'hui, ce niveau existe pour un futur besoin).
- Invoqué dans `buildSceneDoc()` (`packages/editor/src/builder/build-scene.ts`), juste après `SceneDocEditor.exportSceneDoc()`, avant de retourner `{sceneDoc, styleSheet}` — un échec bloquant fait `throw` avec les messages d'erreur agrégés, avant tout appel à `BuilderFacade.compile()`.

## 5. Résultat (2026-07-09)

7 tests, `packages/editor/tests/validate-scene-doc.spec.ts` — 1 cas passant (un vrai `SceneDef` produit par `buildSceneDoc()`, jamais un `SceneDef` tapé à la main) + 2 cas par règle (dont le cas negatif `'@root'`/`'@off'` jamais flaggés pour la règle move.parentId, et le cas où une story ne résout pas du tout à `'@root'` pour la règle capsule racine). 254 tests `packages/editor` (247+7), typecheck propre sur `scene-factory`/`capsule-automation`, démo `?demo=ed2-builder` répond toujours 200 après le branchement.

Chantier moteur de validation — **clos pour son périmètre réduit (3 règles sur 5)**. Les 2 règles retirées ne sont pas des dettes silencieuses : chacune a une raison structurelle documentée ci-dessus, et un chemin de réouverture explicite si les conditions changent.
