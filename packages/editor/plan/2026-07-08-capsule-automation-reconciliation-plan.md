# Plan — Réconciliation capsule-automation ↔ CapsuleDistribution

**Périmètre** : `packages/authoring/capsule-automation` et `capsule-distribution.ts` (déplacée dans `packages/authoring/scene-factory/` aux côtés de `SceneDocEditor` — fait, 2026-07-08).
**Statut** : chantier terminé et vérifié (2026-07-08) — les 4 étapes de l'ordre de mise en œuvre (§7) sont faites.

---

## 1. Problème

Deux implémentations indépendantes du même problème (distribuer dans le temps les enfants d'une capsule) coexistent, sans lien de code entre elles, avec des modèles déjà divergents :

| | `CapsuleDistribution` (sequence-editor) | `resolveAutoCapsuleTiming` (capsule-automation) |
|---|---|---|
| Modes | `sequential` (+ `order: forward/backward`), `stagger` (`staggerInMs`/`staggerOutMs`) | `distributed`, `fixed` |
| Lock | par borne (`lockedIntroMs`/`lockedOutroMs` indépendants) | atomique (`constraints.lockedTimeRange:{startMs,endMs}`, les deux bornes ensemble) |
| `visible` | calculé (hors plage → `false`) | fourni tel quel par l'appelant |
| Tests | 7 cas passants (`capsule-distribution.spec.ts`, vérifié) — seul « sequential forward/backward » couvert, `stagger` non testé | aucun test, jamais, pour tout le package |

`CapsuleDistribution` pilote déjà l'aperçu (kf virtuels) dans l'éditeur — c'est la référence visuelle que l'auteur voit. Si le Builder utilisait `resolveAutoCapsuleTiming` pour la scène finale, le rendu pourrait diverger de cet aperçu.

## 2. Décision

**`CapsuleDistribution` fait foi pour la distribution temporelle.** capsule-automation garde son rôle propre — catalogue de transitions nommées, résolution d'événements, génération CSS/grid — mais cesse de calculer sa propre distribution temporelle : elle consomme un `timeRange` déjà résolu, fourni par le Builder.

Les deux modules sont **complémentaires**, pas redondants : sequence-editor est l'interface où l'auteur travaille et prévisualise ; capsule-automation est la classe qui transforme le résultat (positions + décors) en `eventimes`/classes CSS exploitables par le Builder.

## 3. Mécanisme de réconciliation

### 3.1 Retrait du calcul de timing dans capsule-automation

- `AutoCapsuleChildInput` : remplacer `constraints.lockedTimeRange?: AutoCapsuleTimeRangeInput | null` (optionnel, un des mécanismes de contrainte parmi d'autres) par un champ **obligatoire** `timeRange: AutoCapsuleTimeRangeInput` directement sur le child — ce n'est plus une contrainte parmi d'autres, c'est la donnée d'entrée.
- `resolveAutoCapsuleTiming` (`core/resolve-timing.ts`) : supprimé. Remplacé par une fonction triviale qui construit `AutoCapsuleResolvedTimeRange` directement depuis `child.timeRange` (`{...child.timeRange, durationMs: endMs-startMs, locked: true}` — tout devient "locked" par construction, puisque tout vient de l'extérieur).
- Supprimés en cascade : `TIME_MODE`, `AutoCapsuleTimingInput`, `AutoCapsuleDefinition.timing`, `AutoCapsuleTypeBehavior.defaultTimeMode`/`defaultFixedDurationMs` (`config/capsule-types.ts`), le diagnostic `capsule-empty-time-range` (n'a plus de sens sans plage de capsule globale à valider — la validation, si besoin, se fait sur chaque `child.timeRange`).
- `constraints.minDurationMs`/`maxDurationMs` retirés (décidé 2026-07-08) : non consommés nulle part (confirmé à l'audit), vraisemblablement un reliquat Eddy — aucune logique ne les lit. Retrait complet de `AutoCapsuleChildInput.constraints`, pas de report à l'implémentation.
- **`GRID_POLICY` retiré (décidé 2026-07-08)** : obsolète au profit de `GRID_MODE` seul (cf `2026-07-08-capsule-spec.md` §4 — deux enums non reliés, `GRID_POLICY` presque entièrement inerte, seul `.stack` était lu). À retirer : le type `GRID_POLICY`, `AutoCapsuleTypeBehavior.gridPolicy` (`config/capsule-types.ts`), le site de lecture dans `build-grid.ts:60`. Mapping `CapsuleKind` → `GRID_MODE` désormais fixé (`2026-07-08-capsule-spec.md` §3, un mode par sous-type) — `config/capsule-types.ts` doit poser ce `GRID_MODE` par type à la place de `gridPolicy`.
- **`CAPSULE_TYPE.legacy` retiré (décidé 2026-07-08)** : sans objet — `CapsuleKind`/`CAPSULE_TYPE` ont désormais exactement les mêmes 5 valeurs (`carousel`/`rangee`/`grille`/`card`/`liste`). Cascade : `AUTO_CAPSULE_TYPE_BEHAVIORS.legacy` (`config/capsule-types.ts`) supprimé. Le repli `state.config.types[state.capsule.type] || state.config.types.legacy` (présent dans `resolve-events.ts:63`, `resolve-placement.ts:134`, `build-grid.ts:40`) est retiré aussi, remplacé par une lecture directe `state.config.types[state.capsule.type]` — plus de repli silencieux. Garantie qu'un type invalide n'atteint jamais capsule-automation confiée au moteur de validation (`2026-07-08-validation-engine-plan.md`, désormais colocalisé dans `packages/authoring/scene-factory/`), pas à capsule-automation lui-même.
- **`position` fusionné dans `card` (décidé 2026-07-08)** : les deux types partageaient déjà `gridPolicy:'areas'` dans `config/capsule-types.ts`, ne différant que par `placementPolicy` — résolu en faveur d'`explicitOnly` (hérité de `position`, cf `2026-07-08-capsule-spec.md` §3) : le Builder garantit un placement explicite pour chaque enfant d'une `card` (zone pleine surface par défaut si l'auteur n'en a assigné aucune), capsule-automation ne calcule jamais de placement automatique pour ce sous-type. Cascade code : retirer `CAPSULE_TYPE.position` (`types/public.ts`), fusionner son entrée `AUTO_CAPSULE_TYPE_BEHAVIORS` dans celle de `card` (`placementPolicy: explicitOnly`). La capsule racine (`2026-07-08-builder-plan.md` §3), auparavant de type `position`, devient de type `card` avec zéro zone.
- **`GRID_MODE.areas` retiré (décidé 2026-07-08)** : ambigu (même mot que les zones, mécanisme différent) et dominé par les zones (row/col/span, chevauchement permis, contrairement à `grid-template-areas` CSS littéral). `GRID_MODE` passe de 5 à 4 valeurs. À retirer : la branche `areas` dans `build-grid.ts`, `AutoCapsuleGridInput.areas`. Cf `2026-07-08-capsule-spec.md` §4/§12.6.

### 3.2 Ce qui ne change pas

- Grid/placement (`resolveAutoCapsulePlacement`, `build-grid.ts`) — indépendant du timing, aucune raison de toucher.
- Catalogue et résolution des transitions nommées (`resolveAutoCapsuleEvents`, `DEFAULT_AUTO_CAPSULE_EVENT_DEFINITIONS`) — continue de consommer le `timeRange` résolu (désormais fourni, pas calculé) pour dériver `triggerMs`/`durationMs` par événement. Aucun changement de logique, juste la source du `timeRange` en entrée.
- Génération de la feuille de style (`renderAutoCapsuleStyleSheet`).

### 3.3 Responsabilité du Builder

Pour chaque capsule : appeler `CapsuleDistribution.compute()` (`packages/authoring/scene-factory/`) **avant** de construire l'`AutoCapsuleInput`, convertir chaque `{introMs, outroMs}` relatif en `{startMs, endMs}` absolu, et le poser sur `child.timeRange`. Aucun enfant n'est plus "libre" du point de vue de capsule-automation — la liberté (distribution automatique) est entièrement gérée en amont par `CapsuleDistribution`.

## 4. Renommage

En touchant `config/capsule-types.ts` pour ce chantier : appliquer aussi le renommage déjà décidé `carrousel` → `carousel` (anglais fait foi — cf plan général, décisions actées).

## 5. Spec associée — déplacée et corrigée

`2026-06-12-capsule-distribution-spec.md` déplacée de `docs/formalisation/` vers `packages/authoring/scene-factory/` (colocalisée avec le code, 2026-07-08). §7 et §8 corrigés au passage : n'attribuent plus la résolution des kf virtuels à un « builder codplay » ou à un « module métier externe, hors scope » — `CapsuleDistribution` est déjà implémentée (`packages/authoring/scene-factory/capsule-distribution.ts`), appelée par sequence-editor (aperçu) et par le Builder ed2 (résolution finale, avant capsule-automation). Voir aussi `2026-07-08-capsule-spec.md`.

## 6. Tests

capsule-automation n'a aujourd'hui aucun test. Une fois le retrait du timing effectué, écrire une suite de tests couvrant au minimum :
- Résolution grid/placement (les cas déjà implicitement couverts par la démo `carousel-scene.ts`, formalisés en tests).
- Résolution d'événements/transitions nommées à partir d'un `timeRange` fourni.
- Génération de la feuille de style (au moins un cas non-trivial : plusieurs enfants, plusieurs transitions).

`CapsuleDistribution` reste couvert par ses 7 cas existants (vérifié) — ajouter la couverture manquante identifiée dans l'audit (`mode: 'stagger'`, aujourd'hui non testé du tout) à l'occasion de ce chantier plutôt que de la reporter indéfiniment.

## 7. Ordre de mise en œuvre

1. ~~Modifier les types capsule-automation (§3.1) + renommage `carousel` (§4).~~ **Fait, vérifié (2026-07-08)** — voir §8.
2. ~~Adapter `resolveAutoCapsuleTiming` → passthrough trivial ; supprimer le mort restant (`TIME_MODE`, diagnostics devenus sans objet).~~ **Fait, vérifié (2026-07-08)**.
3. ~~Écrire les tests capsule-automation (§6) sur la nouvelle forme.~~ **Fait (2026-07-08)** — 21 tests, 4 fichiers (`tests/build-grid.spec.ts`, `resolve-placement.spec.ts`, `resolve-events.spec.ts`, `auto-capsule.spec.ts`), infra vitest ajoutée au package (zéro test avant ce chantier).
4. ~~Ajouter la couverture `stagger` manquante à `CapsuleDistribution`.~~ **Fait (2026-07-08)** — 6 nouveaux cas dans `packages/editor/tests/capsule-distribution.spec.ts` (13 au total, coïncidence avec l'ancien chiffre erroné de « 13 » — c'est bien parce que 6 ont été ajoutés, pas parce que l'ancien chiffre était juste).
5. ~~Corriger `2026-06-12-capsule-distribution-spec.md` §7~~ **Fait (2026-07-08)** — voir §5 ci-dessus.
6. Seulement après : le Builder (chantier suivant) peut consommer les deux modules dans leurs rôles clarifiés.

Chantier « cœur » — avancer par incréments courts, montrer le code au fil de l'eau (cf conventions du plan général).

## 8. Fait (2026-07-08) — détail de ce qui a été implémenté

Toutes les suppressions déjà annoncées en §3.1/§4 sont faites : `GRID_POLICY`, `TIME_MODE`, `AutoCapsuleTimingInput`, `AutoCapsuleDefinition.timing`, `CAPSULE_TYPE.legacy`/`.position`, `constraints.lockedTimeRange`/`minDurationMs`/`maxDurationMs`, `GRID_MODE.areas` (+ `AutoCapsuleGridInput.areas`, `AutoCapsuleGridArtifact.context.areas`), le renommage `carrousel`→`carousel` (dans `capsule-automation` **et** dans `CapsuleKind`, `packages/editor/src/sequence-editor/types.ts`). Deux points vérifiés et exécutés au-delà de la lettre du texte ci-dessus, notés ici pour traçabilité :

- **`GRID_MODE` n'est plus un champ de `grid` du tout** — `AutoCapsuleGridInput.mode` est retiré ; `AutoCapsuleTypeBehavior.gridMode` (nouveau champ, remplace `gridPolicy`) est l'unique source. Conséquence : `build-grid.ts` lit `behavior.gridMode`, plus jamais un `grid.mode` fourni par l'appelant — cohérent avec « un mode fixe par sous-type », pas seulement un défaut que l'appelant pourrait encore changer. `resolve-placement.ts:97` simplifié en cascade : `capsule.type === CAPSULE_TYPE.liste` devenait redondant avec `grid.context.mode === GRID_MODE.list` une fois la dérivation garantie 1:1, retiré.
- **`AutoCapsuleDefinition.timeRange` (capsule-level) retiré**, en plus de ce qui était explicitement listé — vérifié qu'aucune logique de résolution ne le consommait plus une fois `resolveAutoCapsuleTiming` trivialisé (seul `auto-capsule.ts` le lisait/écrivait, via `setTimeRange()` — méthode retirée avec). Cohérent avec le retrait déjà décidé de `minDurationMs`/`maxDurationMs` (même critère : aucun consommateur réel), mais pas explicitement nommé dans le texte du plan — à signaler si un besoin de le restaurer apparaît.

Trouvaille non traitée dans ce chantier, notée pour plus tard : `AutoCapsuleChildConstraintInput.lockPlacement`/`.lockClassGeneration` ne sont, eux non plus, jamais lus nulle part dans le package — même profil que les champs déjà retirés, mais hors périmètre de cette réconciliation (aucune mention dans ce plan), laissés en l'état.

Consommateurs mis à jour pour rester compatibles : `packages/demos/src/scenes/carousel-scene.ts` (calcule désormais lui-même un `timeRange` par enfant, égal à ce que produirait un `CapsuleDistribution.compute()` séquentiel — ce chantier ne branche pas encore ce pipeline dans les démos, seulement dans le Builder à venir), `packages/demos/src/codplay/selection-frame-grid-demo.ts`, et les deux fixtures `temp__createGridArtifact` de `packages/authoring/selection-frame/tests/`. Vérifié : typecheck propre et tests verts sur `capsule-automation`, `scene-factory`, `selection-frame`, `packages/editor` (217 tests) et `packages/codplay` (272 tests).
