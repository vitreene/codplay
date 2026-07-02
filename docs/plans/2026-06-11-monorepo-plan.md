# Plan de migration en monorepo

Date : 2026-06-11  
Statut : arbitrages confirmés — prêt pour mise en oeuvre

**Arbitrages confirmés (2026-06-11) :**
- Q1 : racine du repo inchangée (`vitreene/codplay/`)
- Q2 : naming précisé — voir section 2 et Q2 révisée
- Q3 : `capsule-automation` dans le workspace, dans l'ombrelle `authoring`
- Q4 : les scènes sont à la fois fixtures de test et démos visuelles

---

## 1. État actuel

Le dépôt est un paquet npm unique où tout coexiste dans `src/` :

| Dossier | Nature | Destination cible |
|---|---|---|
| `src/` (hors demos, hors capsule-automation) | Librairie moteur | `packages/codplay` |
| `src/demos/` | Application de démonstration | `packages/demos` |
| `src/capsule-automation/` | Helper d'authoring autonome | `packages/authoring/capsule-automation` |
| `tests/` | Tests de la librairie | `packages/codplay/tests` |
| `formalisation/` | Specs normatives | `docs/formalisation` |
| `evolution/` | Historique, études, lots | `docs/evolution` |
| `public/` | Assets statiques des démos | `packages/demos/public` |
| `index.html` | Entrée HTML des démos | `packages/demos/index.html` |
| `scripts/` | Scripts de test | `packages/codplay/scripts/` |

---

## 2. Structure cible

```
vitreene/codplay/                    ← racine du repo (inchangée)
├── packages/
│   ├── codplay/                     ← librairie moteur
│   │   ├── src/
│   │   ├── tests/
│   │   ├── scripts/
│   │   ├── package.json             name: "codplay"
│   │   ├── tsconfig.json
│   │   └── vite.config.ts           ← mode lib
│   │
│   ├── demos/                       ← application de démo
│   │   ├── src/
│   │   │   ├── scenes/              ← scènes (fixtures ET démos visuelles)
│   │   │   ├── codplay/             ← entry points démos
│   │   │   ├── player/
│   │   │   ├── shared/
│   │   │   └── main.ts
│   │   ├── public/
│   │   ├── index.html
│   │   ├── package.json             name: "@codplay/demos"  private: true
│   │   ├── tsconfig.json
│   │   └── vite.config.ts           ← mode app
│   │
│   ├── authoring/                   ← logique métier pure, sans UI, sans framework
│   │   │                              (utilisée par l'éditeur ET par l'auteur direct)
│   │   ├── capsule-automation/      ← calcul d'artefacts capsule (général)
│   │   │   ├── src/
│   │   │   ├── package.json         name: "@codplay/capsule-automation"
│   │   │   └── tsconfig.json
│   │   └── [futur-helper]/          ← même pattern : pur, pas de dépendance UI
│   │
│   └── editor/                      ← couche UI uniquement
│       │                              (consomme les packages authoring/*)
│       ├── src/
│       │   └── main.ts              ← point d'entrée du serveur dev éditeur
│       ├── public/
│       │   └── assets/              ← assets statiques de l'éditeur (icônes, fonts…)
│       ├── index.html               ← HTML du dev server éditeur (distinct de demos)
│       ├── package.json             name: "@codplay/editor"  private: true
│       ├── tsconfig.json
│       └── vite.config.ts           ← mode app, port distinct des démos
│
├── docs/
│   ├── formalisation/               ← specs normatives
│   └── evolution/                   ← historique, lots, études
│
├── package.json                     ← workspace root
├── tsconfig.base.json               ← options TypeScript partagées
└── .gitignore / CLAUDE.md / AGENTS.md
```

### Workspace glob

L'ombrelle `authoring/` n'est pas elle-même un package. Le `package.json` racine déclare :

```json
{
  "workspaces": [
    "packages/codplay",
    "packages/demos",
    "packages/editor",
    "packages/authoring/*"
  ]
}
```

Chaque nouveau helper dans `packages/authoring/` est automatiquement inclus dans le workspace.

---

## 3. Outillage

### Gestionnaire de workspace

**Recommandation : npm workspaces** (natif, zéro dépendance ajoutée).

- Pas de migration vers pnpm ni d'ajout de turborepo/nx à ce stade.
- Turborepo peut être ajouté plus tard si l'orchestration des builds devient un problème.
- La configuration est dans le `package.json` racine (voir glob section 2).

### TypeScript

- `tsconfig.base.json` à la racine avec les options communes actuelles.
- Chaque package étend `tsconfig.base.json` et déclare ses `include` / `paths`.
- **Project references** TypeScript (`references` + `composite: true`) recommandées pour `codplay` → `demos` et `codplay` → `editor`, mais non obligatoires en phase 1.

### Vite

- `packages/codplay/vite.config.ts` : build mode `lib`, entrée `src/index.ts`, produit un bundle ESM + types.
- `packages/demos/vite.config.ts` : build mode app, port 5173 (par défaut Vite).
- `packages/editor/vite.config.ts` : build mode app, port 5174 (distinct des démos), entrée `src/main.ts`.

Commandes de raccourci à la racine :

```json
"scripts": {
  "dev:demos":  "npm run dev --workspace=packages/demos",
  "dev:editor": "npm run dev --workspace=packages/editor",
  "test":       "npm run test --workspace=packages/codplay",
  "build":      "npm run build --workspace=packages/codplay"
}
```

### Tests

- Les tests restent dans `packages/codplay/tests/` (ils testent la librairie).
- `scripts/run-tests.mjs` : à déplacer dans `packages/codplay/scripts/` ou adapter le chemin depuis la racine.
- Commande racine `npm run test` délègue à `npm run test --workspace=packages/codplay`.

---

## 4. Contraintes identifiées

### 4a. Imports croisés tests ↔ demos

Plusieurs tests `tests/v1/` importent des scènes de `src/demos/scenes/` :

- `reference-scenes.spec.ts`
- `resolve-scene-seek-max.spec.ts`
- `sequence-command-panel.spec.ts`
- `quiz-question-runtime.spec.ts`

Ces scènes sont à la fois fixtures de test et démos visuelles accessibles depuis `main.ts`. **Elles restent dans `packages/demos/src/scenes/`.**

Pour que les tests de `packages/codplay` puissent les importer, `packages/codplay` ajoute `@codplay/demos` en `devDependency` workspace. C'est une dépendance dev circulaire (demos → codplay en runtime, codplay → demos en test), ce que npm workspaces tolère puisque les devDependencies ne sont pas installées transitivement.

```json
// packages/codplay/package.json
"devDependencies": { "@codplay/demos": "workspace:*" }
```

Les imports dans les tests passent de `../../src/demos/scenes/foo` à `@codplay/demos/scenes/foo`.

### 4b. Famille `authoring` — pattern headless

`packages/authoring/` regroupe **toute la logique métier liée à la création de scènes**, sans UI et sans dépendance à un framework. C'est la couche headless du système.

Deux sous-familles coexistent dans le même dossier :
- **Helpers généraux** (ex. `capsule-automation`) : utiles à l'auteur qui code directement et à l'éditeur.
- **Modules éditeur-spécifiques** : logique métier propre à l'éditeur (gestion d'état, sérialisation, commandes…) mais sans UI. Aucun import de React, Vue, ou tout framework de rendu.

`packages/editor/` est **uniquement la couche UI** : elle importe les packages d'authoring et les expose dans une interface. Cette séparation garantit que la logique métier est testable indépendamment, et réutilisable si l'UI change de framework.

Règle d'appartenance à `authoring/` : si le package peut s'exécuter dans un test Vitest sans jsdom et sans framework UI, il appartient à `authoring/`. Sinon il appartient à `editor/`.

Dépendances autorisées dans `authoring/*` :
- `codplay` (moteur, si besoin)
- d'autres packages `@codplay/authoring-*`
- pas de `@codplay/editor`, jamais de framework UI

### 4c. Dépendance `demos` → `codplay`

Dans `packages/demos/package.json` :
```json
"dependencies": { "codplay": "workspace:*" }
```
(syntaxe npm workspaces : `"*"` ou `"file:../codplay"`).

Pendant le développement, les imports dans `src/demos/` passent de `../../player/...` à `codplay/player/...` (ou via le barrel `codplay`). C'est la principale refactoring d'imports à faire.

### 4d. Assets publics

`public/` contient des médias utilisés uniquement par les démos. Ils bougent vers `packages/demos/public/`. Aucun impact sur la librairie.

### 4e. `tsconfig.json` actuel

Ne contient que `"include": ["src"]`. En monorepo, chaque package a le sien. Le `tsconfig.base.json` racine ne doit pas déclarer `include`.

### 4f. `tmp-*.md` à la racine

Trois fichiers temporaires (`tmp-capture-plan`, `tmp-seek-reprise`, `tmp-sequence-refonte`) traînent à la racine. À archiver dans `docs/evolution/` ou supprimer lors de la migration.

---

## 5. Étapes d'implémentation

### Phase 0 — Prérequis (sans toucher au code)

1. Créer la structure de dossiers `packages/` et `docs/`.
2. Rédiger le `package.json` racine avec `workspaces`.
3. Rédiger `tsconfig.base.json`.
4. Archiver les `tmp-*.md` dans `docs/evolution/`.

### Phase 1 — Extraire `authoring/capsule-automation`

- Créer `packages/authoring/capsule-automation/`.
- Déplacer `src/capsule-automation/src/` → `packages/authoring/capsule-automation/src/`.
- Créer `packages/authoring/capsule-automation/package.json` (`name: "@codplay/capsule-automation"`) et `tsconfig.json`.
- Vérifier qu'il compile seul (`npx tsc --noEmit` depuis le package).
- Pas d'impact sur les tests existants (aucun test ne dépend de capsule-automation).

### Phase 2 — Extraire `docs`

- Déplacer `formalisation/` → `docs/formalisation/`.
- Déplacer `evolution/` → `docs/evolution/`.
- Mettre à jour `CLAUDE.md` (chemins dans la section "Key source locations").

### Phase 3 — Isoler `codplay` (librairie)

- Créer `packages/codplay/`.
- Déplacer `src/` (hors demos, hors capsule-automation) → `packages/codplay/src/`.
- Déplacer `tests/` → `packages/codplay/tests/`.
- Déplacer les scènes-fixtures identifiées en 4a → `packages/codplay/tests/fixtures/`.
- Créer `packages/codplay/package.json`, `tsconfig.json`, `vite.config.ts` (mode lib).
- Vérifier que tous les tests passent.

### Phase 4 — Extraire `demos`

- Créer `packages/demos/`.
- Déplacer `src/demos/` → `packages/demos/src/`.
- Déplacer `public/` → `packages/demos/public/`.
- Déplacer `index.html` → `packages/demos/`.
- Déplacer `src/main.ts` → `packages/demos/src/main.ts`.
- Refactorer les imports `src/demos/` → `codplay` (depuis workspace).
- Créer `packages/demos/package.json` (`private: true`, dépendance `codplay`), `tsconfig.json`, `vite.config.ts` (mode app).
- Vérifier que `npm run dev --workspace=packages/demos` fonctionne.

### Phase 5 — Scaffold `editor`

- Créer `packages/editor/` avec `package.json` vide et `src/index.ts` minimal.
- Pas de code fonctionnel à ce stade.

### Phase 6 — Nettoyage racine

- Supprimer les anciens `src/`, `tests/`, `formalisation/`, `evolution/`, `public/`, `index.html`.
- Mettre à jour `.gitignore`, `CLAUDE.md`, `AGENTS.md` pour les nouveaux chemins.
- Ajouter les scripts de raccourci à la racine (`npm run dev`, `npm run test`, etc.).

---

## 6. Arbitrages confirmés

### Q1 — Racine du repo : inchangée ✓

`vitreene/codplay/` reste la racine. Pas de migration git.

### Q2 — Naming des packages ✓

| Package | Nom npm | Publié |
|---|---|---|
| Librairie moteur | `codplay` | oui (futur) |
| Démos | `@codplay/demos` | non (`private: true`) |
| Éditeur | `@codplay/editor` | non (`private: true`) |
| Helpers authoring | `@codplay/<nom-du-helper>` | selon le helper |
| capsule-automation | `@codplay/capsule-automation` | oui (futur) |

La librairie reste `codplay` (nom flat) pour un import direct `import { createPlayer } from 'codplay'`. Les helpers d'authoring sont scopés `@codplay/` car ils peuvent être publiés indépendamment et leur périmètre est plus restreint.

### Q3 — `authoring` dans le workspace ✓

Tous les helpers sont dans `packages/authoring/` au sein du même repo. L'ombrelle couvre deux catégories : helpers généraux (auteur direct + éditeur) et modules éditeur-spécifiques — tous purs, sans UI. Extraction vers un repo séparé si et quand un helper doit être consommé comme dépendance externe installée via npm.

### Q4 — Scènes : fixtures ET démos visuelles ✓

Les scènes restent dans `packages/demos/src/scenes/`. `packages/codplay` les consomme via une `devDependency` workspace. Voir section 4a.

---

## 7. Ce que ce plan ne résout pas

- La définition fonctionnelle de l'éditeur (hors scope, en réflexion).
- La publication npm de `codplay` (versioning, changelog, exports map — à traiter séparément).
- La CI/CD multi-packages (à construire après la migration).
