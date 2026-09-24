# Sélection Fame V2

## Rôle

`fame.html` est le point d'entrée V2 pour une sélection de démos. La page
complète reste accessible par `index.html`. L'entrée historique V1 est servie
par `fame-v1.html`.

## Sélection et ordre

Le sélecteur de `fame.html` contient exactement les démos suivantes dans cet
ordre :

| Ordre | Identifiant | Titre |
|---:|---|---|
| 1 | `components` | basic components |
| 2 | `events` | Events — comment ça fonctionne |
| 3 | `position` | Positions |
| 4 | `quiz-series` | Quiz — Série de 3 questions |
| 5 | `polygon` | Polygone interactif |
| 6 | `preload-media` | Preload média |
| 7 | `chrono` | Chronomètre |
| 8 | `threejs-grid` | Three.js — grille procédurale |
| 9 | `rive` | Rive lip-sync |
| 10 | `stroke-path` | Stroke Path — capture live |

La page Fame omet `avatar`, `flip-list` (FLIP stress test) et `flip-nested`.
Ces exclusions ne retirent pas les démos du registry complet ni de `index.html`.
`stroke-path` reste une fixture expérimentale non normative ; son inclusion
dans Fame ne change pas son statut décrit dans le
[plan Stroke Path V2](../plan/2026-09-23-stroke-path-v2-plan.md).

## Contrat d'intégration

- `fame.html` et `index.html` utilisent le même point d'entrée V2 et le même
  layout partagé, dont l'interaction de scène suit le
  [contrat du layout V2](./v2-demo-layout-spec.md).
- Le layout conserve la propriété de la page commune, du sélecteur, de la
  scène, de la télécommande, du journal et du cycle de vie CodPlay.
- Le registre Fame ordonne des identifiants qui sont résolus depuis
  `V2_DEMO_REGISTRY`. Il ne déclare pas de scènes ni de chargements parallèles.
- Le changement de sélection conserve l'entrée HTML courante et ne change que
  le paramètre `demo`.
- La page V1 continue d'utiliser son point d'entrée et son registre V1 depuis
  `fame-v1.html`.

## Chemin de lecture

- `src/v2/registry.ts` déclare le registre V2 complet et la sélection Fame
  ordonnée.
- `src/v2/main.ts` choisit le registre à partir de
  `#app[data-v2-demo-collection="fame"]`, puis monte la scène sélectionnée
  dans le layout commun. Sans ce marqueur, il fournit le registry complet.
- `src/v2/layout/page-markup.ts` possède le balisage partagé de toutes les
  pages V2 ; `src/v2/layout/layout.ts` possède son comportement et le cycle de
  vie commun.
