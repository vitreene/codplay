# Plan — mise à jour vers Remix 3.1.0

**Statut : En cours. Mise à jour vers la dernière version explicitement demandée le 4 novembre 2026.**

## Décisions et invariants

- `npm view remix version dist-tags` confirme `latest: 3.1.0`.
  Cette décision remplace le maintien de la RC4 pour cette tranche.
- Garder Elcé comme seul propriétaire de la dépendance, fixée à `3.1.0`,
  et conserver une seule résolution Remix dans le lockfile.
- Appliquer la migration officielle des points d’entrée : `remix/ui` vers
  `remix/component`, JSX et tests compris ; `uiHmr` vers `componentHmr`.
  Source : [migration officielle 3.0](https://github.com/remix-run/remix/releases/tag/remix@3.0.0).
- Préserver les contrats de la [SPA](../specs/remix-spa-spec.md), le contrôleur
  XState, les transactions Tiptap, le stockage, l’API et le lecteur existants.
  Aucun pont de compatibilité ou changement CodPlay.
- Référence avant mise à jour : 594 tests, 583 réussis et les mêmes 11 échecs
  sur les deux dernières exécutions ; typecheck limité au `title` inutilisé
  de `statistical-graph-scene-builder.ts:72` ; build réussi.

## Actions et acceptation

1. [x] Installer la version publiée dans `packages/elce/package.json` et
   réconcilier le lockfile ; vérifier l’absence de RC4 résiduelle. L’audit de
   tous les manifestes confirme qu’Elcé est l’unique déclaration directe de
   `remix`; le lockfile ne résout qu’un `remix@3.1.0`. Chaque paquet
   `@remix-run/*` n’a qu’une résolution, avec sa propre version de paquet.
   Au signalement, `node_modules/remix` était encore `3.0.0-rc.4` alors que
   manifeste et lockfile indiquaient `3.1.0` : ce décalage installé causait
   l’import SSR non exporté. La réconciliation a remis `3.1.0` et restauré
   `semver@7.8.6`, absent de l’arbre installé.
2. [x] Migrer les imports de production et de tests, `tsconfig.json`, JSX,
   serveur d’assets et HMR ; adapter les appels modifiés à contrat constant.
3. [x] Vérifier compilation réelle des assets et des JSON, serveur/API/SQLite,
   rendu Remix, édition/Undo/Redo Tiptap, preview et cycle de vie ; exécuter
   suite Elcé, typecheck et build et comparer les échecs à la référence.
   Les six suites ciblées passent 52 tests ; build réussi. La suite complète
   relevée sur `elce-avatar` conserve 583 réussites sur 595, avec une erreur
   Tiptap asynchrone déjà signalée. Le typecheck passe après retrait de la
   variable `title` locale redondante du builder Graphe ; ses tests ciblés
   passent 15/15. L’inventaire de tests diffère sur `elce` après les retraits
   demandés le 4 novembre ; revalider le workspace intégré avant clôture.
   Le vrai lancement `npm run dev` sert document, entrée, runtime JSX,
   composant auteur, module HMR et API en HTTP 200 ; une modification CSS
   temporaire déclenche `browser:reload` via SSE et actualise la feuille servie.
   La feuille est restaurée, le serveur arrêté et sa base temporaire retirée.
4. [ ] Qualifier et résoudre les garde-fous rouges avant de fermer l’acceptation
   globale ; l’antériorité ne constitue pas une résolution. Confronter chaque
   assertion au contrat propriétaire avant de corriger code ou test :
   - [x] Sur demande explicite du 4 novembre, retirer les sept cas incorrects
     identifiés et les deux cas passants de révélation liés aux préréglages,
     sans remplacement : deux cas Flux, un cas Diapo, deux parcours catalogue,
     un cas d’observateurs et deux cas de révélation player, plus la suite CSS.
     Imports, helpers devenus inutiles et preuves documentaires correspondantes
     retirés. Les trois cas non qualifiés sont conservés.
   - [x] Relancer la suite et le typecheck après ces retraits : 576 tests,
     575 réussis, un échec API ; typecheck limité au `title` inutilisé ci-dessous.
     Rapport : `/private/tmp/codplay-test-removal-after.json`.
     Ces suppressions ne constituent pas une validation des features retirées
     de la couverture automatisée.
   - [x] Supprimer `editor-settings-resolver.test.ts` et
     `revelation-action.test.ts` sur demande explicite du 4 novembre.
     Les deux suites et leurs 12 tests sont retirés sans remplacement, ainsi
     que leurs références dans les spécifications de réglages, Carousel et Flux.
   - [x] Les deux cas conservés de `learning-workspace.test.tsx`, suppression
     de page et accès Sommaire/profil, passent dans la suite complète après
     retrait du parcours catalogue obsolète. Aucun changement de production.
   - `elce-local-server.test.ts:48` : délai dépassé dans la suite complète,
     succès dans le groupe ciblé (1) ; qualifier la cause de cette instabilité.
   - [x] Le typecheck est rétabli après retrait de `title` dans le builder
     Graphe ; les 15 tests ciblés passent sur `elce-avatar`. Revalider après
     intégration des deux branches.
5. [x] Vérifier le navigateur sur le workspace courant. Après redémarrage du
   serveur, Safari affiche le catalogue Elcé puis le Projet 3 et ses éditeurs
   Avatar/Carousel ; HMR se connecte sans erreur console. La preview Rive et
   l’insertion audio restent suivies dans le plan talking-head.
6. [x] Actualiser les spécifications propriétaires pour les adaptations
   implémentées et vérifiées ; conserver ce plan pour les preuves manquantes.
