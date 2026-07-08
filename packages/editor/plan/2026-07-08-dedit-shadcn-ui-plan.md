# Plan (esquisse) — Refonte de l'interface dedit en shadcn

**Périmètre** : `packages/editor/src/decor-editor/render.ts` et tout ce qui en dépend visuellement.
**Statut** : esquisse d'engineering seulement — les détails visuels/UX seront pilotés par l'utilisateur au moment venu. Ce document ne fixe aucun choix de présentation, uniquement la mécanique de migration.

---

## 1. Ce qui change, ce qui ne change pas

`render.ts` (la démo actuelle, `?demo=dedit`) est une démonstration, pas l'interface finale — confirmé par l'utilisateur. Elle sera remplacée par des composants shadcn. Ce que l'architecture actuelle de dedit garantit déjà, et qui rend cette bascule contenue :

- **Domaine, machine XState et contrôleur (`DecorEditorApi`) ne changent pas.** La séparation stricte contrat/rendu (`2026-07-07-dedit-spec.md` §4 bis) existe précisément pour ça : le rendu consomme `PaletteConfig`/`PanelField`/snapshots, sans qu'aucune logique métier n'y vive.
- Seul `render.ts` (et la config `PaletteConfig` fournie par l'hôte — aujourd'hui `dedit-demo.ts`, un exemple, pas une norme) est concerné.

## 2. Prérequis technique

`packages/editor` n'a aujourd'hui **aucune dépendance React** — sequence-editor et dedit sont 100% TS vanilla + XState. C'est ed2 qui introduit React (+ shadcn + base-ui) pour la première fois dans ce package. Prérequis avant toute réécriture de `render.ts` :
- Ajout des dépendances React/shadcn/base-ui à `packages/editor/package.json`.
- Politique de hooks (cf `skill.md`, racine du repo) : hooks XState (`useSelector`/`useActor`/`useMachine`) seuls autorisés explicitement ; `useEffect` proscrit absolument.
- Binding React minimal : un composant qui souscrit au contrôleur (`controller.subscribe`) et se re-rend — pas de state React dupliquant le contexte de la machine.

## 3. Panneaux à construire (au-delà du remplacement 1:1 de `render.ts`)

Deux panneaux identifiés comme mécaniquement câblés mais **sans aucune UI existante**, à concevoir en même temps que la bascule shadcn plutôt qu'après :
- **Panneau capsule** (`CapsulePatch` — `behavior`/`defaultTransition`/`sequencing`/`staggerMs`/`grid`) — aujourd'hui, un item capsule reçoit les mêmes panneaux qu'image/média dans `dedit-demo.ts`. Cf `2026-07-08-capsule-spec.md` §5.
- **Panneau zones** — `zoneMode`/`setZones`/`onZonesChange` existent côté machine/contrôleur, `render.ts` ne les lit jamais. Dépend de `createZoneEditor` (`docs/plans/2026-07-03-selection-frame-variantes-plan.md`, Phase 2, pas commencée) pour avoir quelque chose de réel à afficher — panneau nommage/sélection de zones côté dedit, tracé/géométrie côté `createZoneEditor`.
- **Pont position** (`PositionEditorBridge` vers selection-frame) — type déclaré (`PositionValuesPx`), zéro consommateur dans le repo. À câbler.

## 4. Ordre proposé

1. Setup React/shadcn/base-ui dans `packages/editor` (prérequis technique, §2).
2. Binding React minimal générique (souscription au contrôleur), sans encore de composants shadcn spécifiques.
3. Remplacement 1:1 des panneaux existants (`shape`/`typo`/`dimensions`/`custom`/`presets`) en composants shadcn — pas de nouveau comportement, juste le rendu.
4. Panneau capsule (§3) — nouveau, pas un remplacement.
5. Pont position (§3) — câblage vers selection-frame.
6. Panneau zones (§3) — dépend de la Phase 2 zones (chantier séparé).

**Les détails de présentation (disposition, styles shadcn précis, choix de composants base-ui) seront donnés par l'utilisateur au fil de cette bascule — ne pas anticiper de choix visuels ici.**
