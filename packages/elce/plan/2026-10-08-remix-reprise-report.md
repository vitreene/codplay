# Reprise — portage Remix Elcé

État de travail au 8 octobre 2026, pour transférer la reprise vers une autre
machine. Le contrat détaillé reste dans le [plan de transposition Remix](./2026-10-06-plan-transposition-remix-3.md) et les comportements vérifiés dans les [spécifications de l’organisation](../specs/organization-editor-spec.md) et de [l’entrée Remix SPA](../specs/remix-spa-spec.md).

## Avancement courant

L’étape 4 du plan est en cours. Le Scénario, le catalogue et les réglages de
chapitre ont été portés dans des vues natives Remix. Ils lisent le modèle de
vue de l’acteur XState courant et envoient leurs commandes via la façade
existante. La zone d’édition des pages reste dans le pont React temporaire.

La décision de conserver la Diapo à la racine est appliquée et inscrite au
contrat : Flux et Diapo sont deux commandes distinctes, à la racine comme dans
un chapitre.

Les changements sont dans `packages/elce/src/app/remix/workspace/`,
`project-application.ts`, et le mode page de `app/layout/app-layout.tsx`. Le
plan et les deux spécifications ci-dessus ont été actualisés.

## Vérifications

- `tsc --noEmit -p tsconfig.json` : réussi.
- `vitest run` : 39 fichiers, 219 tests réussis. Le test HTTP écoute sur
  `127.0.0.1`; il a fallu l’autorisation d’exécution locale après le refus
  `EPERM` du bac à sable.
- `vite build` : réussi ; avertissement existant de taille de bundle
  (1 612,83 kB minifié, 459,59 kB gzip).
- `git diff --check` : réussi.
- Safari Technology Preview via le MCP de cette session : Diapo racine,
  séparateur du Scénario, onglets du catalogue et absence d’identifiants DOM
  dupliqués vérifiés. L’affichage des réglages centraux après sélection d’un
  chapitre reste à vérifier dans Safari ; les tests du runtime Remix le
  confirment. Cette réserve figure aussi dans le plan.

La vérification navigateur utilisait l’environnement Safari TP de la machine
précédente ; elle doit être reprise avec le navigateur fourni par
l’environnement actif au moment du contrôle.
