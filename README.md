# Codplay

Status: En cours
CodPlay version: V2 official + V1 legacy

Moteur de scènes interactives basé sur une timeline et un système d'événements. Ce dépôt est organisé en monorepo npm workspaces.

---

## Packages

### `codplay-v1` — moteur historique (`packages/codplay-v1`)

Le cœur du système. Trois couches :

- **Builder** — compile une `SceneDoc` (document auteur) en un `CompiledScene` normalisé.
- **Player** — machine à états qui pilote la lecture : `init → play ↔ pause → stop → destroy`. Gère la timeline, le seek, et les straps.
- **Runtime** — exécute les mutations de composants image par image contre le DOM.

Les straps sont les unités de comportement : fonctions pures déclenchées par des événements, retournant des effets immédiats ou des séquences planifiées.

### `codplay` — runtime officiel V2 (`packages/codplay`)

Réécriture déclarative séparée de V1. La fondation couvre actuellement la compilation `SceneDoc -> CompiledScene`, ACE, engine/player, materialize/resolve/solve, seek groupé, les composants de base, le move state et le runner HTML V2 avec projection locale/reparent. La fixture `packages/authoring/selection-frame/demos/flip-stress` sert de surface de validation et de gabarit pour les futures démos standard. Le renderer de production et les capacités encore non spécifiées restent à ouvrir.

### `@codplay/demos` — application de démonstration (`packages/demos`)

Exemples interactifs qui valident les fonctionnalités du moteur et révèlent les pièces manquantes. Chaque démo expose une scène dans un cadre commun avec contrôles play/pause/seek.

Les scènes V1 (`src/v1/scenes/`) servent aussi de fixtures aux tests
d'intégration. Les démos V2 sont regroupées dans `src/v2/`.

### `@codplay/capsule-automation` — helper d'authoring (`packages/authoring/capsule-automation`)

Module pur (sans UI, sans dépendance framework) qui calcule les artefacts nécessaires pour une capsule DOM et ses enfants : contexte de grille, classes CSS, plages temporelles, events résolus. Premier membre de la famille `packages/authoring/`.

### `@codplay/editor` — éditeur (`packages/editor`)

Couche UI de l'éditeur visuel de scènes. Consomme les packages `authoring/*` pour la logique métier. En cours de conception.

---

## Prérequis

- Node.js ≥ 20
- npm ≥ 10

---

## Installation

```bash
# Cloner le dépôt, puis :
npm install
```

npm workspaces installe toutes les dépendances et crée les liens symboliques entre packages en une seule commande.

---

## Lancement

```bash
# Démos (port 5173)
npm run dev:demos

# Éditeur (port 5174)
npm run dev:editor
```

Les démos s'ouvrent sur `http://localhost:5173`. Un paramètre `?demo=<nom>` sélectionne la démo active (ex. `?demo=carousel`, `?demo=quiz`).

---

## Tests

```bash
# Tous les tests
npm run test

# Tests critiques uniquement — doivent passer avant tout merge
npm run test:gates

# Un lot spécifique du moteur historique (depuis packages/codplay-v1)
cd packages/codplay-v1
npm run test:lot lot3
npm run test:lot lot3 lot12

# Mode watch (depuis packages/codplay-v1)
node scripts/run-tests.mjs watch

# Un fichier directement (depuis packages/codplay-v1)
npx vitest run tests/v1/reference-scenes.spec.ts
```

Les tests sont organisés en `tests/lot1`–`tests/lot20` (fonctionnalités) et `tests/v1/` (conformité spec).

---

## Build

```bash
# Build du moteur historique codplay-v1
npm run build
```

Le résultat est produit dans `packages/codplay-v1/dist/`.

---

## Structure du dépôt

```
packages/
  codplay-v1/               moteur historique + tests V1
  codplay/                  runtime officiel + tests V2
  demos/                    application de démo
  authoring/
    capsule-automation/     helper d'authoring (pur, sans UI)
  editor/                   éditeur visuel (en cours)
docs/
  formalisation/            specs normatives v1
  evolution/                historique, études, lots
```

---

## Specs

La documentation normative est dans `docs/formalisation/`. Fichiers clés :

- `v1-index.md` — index de toutes les specs
- `v1-scene-spec.md`, `v1-story-spec.md`, `v1-perso-spec.md` — modèle de données
- `v1-strap-helpers-spec.md` — helpers de scheduling, `eventInsertMode`
- `v1-seek-spec.md` — politiques de seek et reconstruction d'état
- `v1-event-spec.md` — routage et cycle de vie des événements

Quand l'implémentation diverge d'une spec, la spec fait autorité sauf décision documentée contraire.

---

## Annexe — Tests critiques

### Principe

Certains lots de tests sont marqués **critiques** : ils doivent passer en permanence et bloquent tout merge s'ils régressent. Les autres lots peuvent être rouges pendant le développement d'une fonctionnalité.

Les lots critiques actuels sont **lot7** (list plugin), **lot8** (flip engine) et **lot18** (move). Ils sont déclarés dans [`packages/codplay/scripts/run-tests.mjs`](packages/codplay/scripts/run-tests.mjs) :

```js
if (suiteName === 'gates') {
  return ['lot7', 'lot8', 'lot18'].flatMap(...)
}
```

`npm run test:gates` exécute ces trois lots en séquence et s'arrête au premier échec.

### Ajouter un lot à la liste des tests critiques

1. S'assurer que le lot passe au vert (`npm run test:lot lotN`).
2. Ouvrir [`packages/codplay/scripts/run-tests.mjs`](packages/codplay/scripts/run-tests.mjs).
3. Ajouter `'lotN'` dans le tableau de la clause `gates` :

```js
if (suiteName === 'gates') {
  return ['lot7', 'lot8', 'lot18', 'lotN'].flatMap(...)
}
```

4. Mettre à jour ce README (liste des lots critiques ci-dessus).

### Critères pour promouvoir un lot en critique

- La fonctionnalité couverte est structurante : une régression bloquerait des fonctionnalités en aval.
- Le lot est stable : il ne dépend pas d'une partie du code encore en chantier.
- Les tests du lot sont déterministes : aucun test flaky.
