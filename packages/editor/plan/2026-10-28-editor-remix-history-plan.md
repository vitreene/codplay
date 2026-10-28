# Éditeur — adaptation Remix, façades et historique

**Statut : En cours — cadrage accepté pour implémentation le 28 octobre 2026 ;
décisions 1 à 6 fixées.**
**État retrouvé au début du chantier, le 28 octobre 2026 :** build réussi, typecheck en échec,
452 tests réussis et 3 échecs sur 455. La
[note d’analyse](./notes/2026-10-28-editor-recovery-remix-analysis.md)
porte l’inventaire, les preuves et les raisons des propositions.

**Avancement au 28 octobre 2026 :** le portage applicatif est implémenté.
`remix@3.0.0`, le runtime `remix/component`, le routeur `remix/spa`, les vues
Remix et les façades d’actions sont en place. Le basculement SQLite est intégré :
round-trip, Undo/Redo persistés, rechargement navigateur, typecheck et build sont
validés. La suite complète donne 470 réussites et un échec de présentation en fin
de lecture sur 471 tests ; le même échec est reproduit à HEAD propre. Il reste
ouvert ci-dessous. Les preuves et limites du stockage sont dans
le [plan SQLite](./2026-10-28-editor-sqlite-persistence-plan.md) et sa
[spécification](./2026-10-28-editor-sqlite-persistence-spec.md).

## Résultat et limites

Application en Remix SPA sans React, acteur XState propriétaire du document,
façades d’intentions et historique unique, sur le modèle technique Elcé.
Les commandes pures, la façade player et la coordination existantes sont
prolongées.

Composants spécifiques non React inchangés : timeline, décor, mouvement,
cadre et autres packages d’authoring existants. Leurs hôtes et bridges
applicatifs peuvent être adaptés. Une correction demandant de modifier ces
composants exige une tranche distincte acceptée.

**Périmètre confirmé :** la reconstruction ne modifie aucun fichier de
`packages/codplay`. Si un diagnostic identifie une intervention nécessaire
dans CodPlay, consigner le défaut, la correction proposée et son acceptation
attendue, puis obtenir l’approbation de l’utilisateur avant intervention.
Isoler le correctif dans un changement distinct, éventuellement sur une
branche de fix. Seul le travail dépendant de ce correctif attend sa résolution ;
aucun contournement éditeur ne doit masquer le défaut.

**Persistance provisoire du modèle actuel :** elle a d’abord utilisé
`localStorage` pour conserver l’`EditorScene` auteur. L’adaptateur a été retiré
au début du basculement SQLite, sans migration des données, conformément au
cadrage accepté. Le schéma, le serveur local, le remplacement et les critères
de sortie sont maintenant suivis dans le
[plan SQLite](./2026-10-28-editor-sqlite-persistence-plan.md).

Backend, chutier, zones, nouvelles fonctions auteur et refonte structurelle du
builder Decor restent hors de ce portage.

## Références et invariants

- Contrats Éditeur : [document](./app/2026-07-11-ed2-document-model.md),
  [timeline](./2026-06-11-sequence-editor-grid-spec.md),
  [décor](./2026-07-07-dedit-spec.md), [capsule](./2026-07-08-capsule-spec.md).
- Contrats CodPlay : [façade V2](../../codplay/specs/facade-v2-spec.md),
  [médias](../../codplay/specs/media-sync-v2-spec.md).
- Travaux ouverts distincts : [organisation V2](./2026-09-01-editor-v2-organization-plan.md),
  [mouvement](./2026-09-02-motion-editor-v2-plan.md),
  [builder Decor](./2026-09-04-decor-builder-projection-plan.md).
- Références Elcé : [Remix](../../elce/specs/remix-spa-spec.md),
  [historique](../../elce/specs/document-history-spec.md).
- Frontières d’édition existantes : [mouvement V2](./2026-09-02-motion-editor-v2-plan.md)
  et, pour les flux de phase concernés,
  [commit/abandon de phase](./app/2026-07-17-phase-commit-selection-recovery-plan.md).

## Décisions de reconstruction

1. **Baseline — Fixe.** Le catalogue partagé fait référence pour les
   transitions, y compris `swipe-right` ; aligner les attentes éditeur sur ce
   catalogue et apprécier le résultat lors des tests. Il n’y a plus
   d’arbitrage préalable sur son signe. Restent le diagnostic de présentation
   absente en fin de lecture et la projection média `master` vers `sync` côté
   builder éditeur, sous les limites de périmètre déjà fixées.
2. **Runtime — Fixe.** Cible `remix@3.0.0`, runtime sans React, JSX
   `remix/component`, routeur `remix/spa` et port `5174`. Éditeur déclare
   `remix@3.0.0` et `@remix-run/ui@0.11.0` ; build et typecheck valident les
   exports utilisés. Elcé reste inchangé.
3. **Partage d’historique — Fixe.** Garder l’historique dans le cœur
   applicatif d’Éditeur et prendre Elcé comme
   référence de fonctionnement. Ne pas extraire de package commun ni modifier
   Elcé pour ce chantier. Le rapprochement des algorithmes avant/après ne
   suffit pas à partager leurs règles de geste, de sélection et de ressources.
   Voir l’[analyse du partage](./notes/2026-10-28-editor-recovery-remix-analysis.md#6-frontières-de-lundoredo).
4. **Sémantique — Fixe.** Une transaction réussie = un geste ; 100 gestes
   maximum, historique de session vidé au changement de scène ou remplacement
   documentaire externe. Garder temps auteur et sélection encore valide,
   nettoyer les références supprimées. Pour une capture continue, ne retenir
   que l’état avant la première modification et l’état final validé à la
   frontière du geste ou de la phase existante. Les valeurs intermédiaires
   restent disponibles pour la preview, sans être conservées dans l’historique.
   Aucun second regroupement temporel ajouté à celui des modules.
5. **Frontières d’édition — Fixe.** Conserver les frontières déjà définies
   dans le projet, avec leur portée propre : capture continue, fin de geste,
   fin de phase, commit et abandon. L’historique et la persistance se raccordent
   à ces circuits ; ils ne redéfinissent ni leur cadence, ni leurs déclencheurs.
   Vérifier les éditions/captures en attente et l’absence de commit tardif à
   partir de ces contrats, sans nouvelle politique implicite d’Annuler.
6. **Persistance provisoire — Fixe, modalités internes.** Persister le modèle
   `EditorScene` actuel complet, identifiants et relations compris, par le
   contrôleur et son chargement central. Inventaire, sérialisabilité, support
   minimal, identification de version et erreurs sont traités en interne en
   P0/P1. Ils ne demandent pas un arbitrage utilisateur de principe. Préserver
   les propriétés ouvertes et identifier les sources média éphémères ; le
   document validé est la source, sans preview, état runtime ou pile Undo/Redo.

## Implémentation en cours de validation

- Le stockage provisoire `localStorage` a été retiré au profit du dépôt SQLite
  local. Le sérialiseur JSON strict est réutilisé pour les colonnes auteur ;
  l’API suit les révisions pour refuser un écrasement périmé.
- L’historique local à l’application garde 100 transactions avant/après,
  vide Rétablir sur une nouvelle édition et se réinitialise au chargement d’un
  document. Les bridges du contrôleur distinguent commits documentaires,
  échos de sélection et captures de keyframe différées.
- Le test existant `swipe-right` suit désormais le catalogue partagé. Le
  builder Éditeur projette `masterItemId` par `initial.sync`; aucun fichier
  `packages/codplay` n’a été modifié.
- Dans Safari MCP, la rotation par événements `PointerEvent` synthétiques a été
  stockée ; Undo et Redo ont chacun persisté leur document restauré, puis Undo
  a rétabli le stockage d’origine. L’adaptateur écoute maintenant aussi
  `sceneCommitted` quand la référence du document change, sans écrire lors des
  seuls changements de sélection. Le geste physique natif reste à valider.
- Le parcours SQLite réel vérifie chargement, sauvegarde après création, Undo,
  Redo, retour à la scène initiale et restauration après rechargement. La
  génération d’identifiants ne repart plus d’un compteur de processus ; son
  test de régression couvre une scène contenant déjà des IDs restaurés.
- L’erreur générique de sérialisation signalée n’a pas été reproduite après
  rechargement ; le stockage antérieur contenait un document JSON valide. Le
  garde indique désormais le chemin de la valeur refusée pour qualifier une
  prochaine occurrence. La cause initiale reste ouverte.
- Le parcours SQLite navigateur est validé, mais le parcours global de
  reconstruction et les gestes physiques restent à compléter. La suite complète
  donne 470 réussites et un échec : `scene-player-bridge-v2.spec.ts`, test
  « keeps the complete ghost chain after creating successive displaced
  keyframes and playing to the end », ligne 420. La présentation attendue à
  5000 ms est `undefined`. L’échec est identique sur le HEAD propre archivé pour
  établir la baseline ; garder cette tranche `En cours`, la cause reste à établir.

## Actions ordonnées

Implémentation acceptée le 28 octobre 2026. H1 utilise l’historique local
d’Éditeur défini au point 3.

| Étape | Fichiers/propriétaires et remplacement | Porte d’acceptation |
| --- | --- | --- |
| R0 — Baseline | Builder V2, tests builder/bridge et plans V2 côté Éditeur ; diagnostic CodPlay en lecture seule si nécessaire. | Les attentes de transition et la projection média locale sont alignées ; le défaut de présentation en fin de lecture reste à diagnostiquer. Tout correctif CodPlay attend l’approbation préalable et reste isolé dans un commit ou une branche de fix ; les autres composants exclus exigent une tranche distincte. |
| P0 — Modèle à persister | Modèle documentaire, `src/app/commands/types.ts`, données et tests de sérialisation existants. | Inventorier les valeurs réellement portées par `EditorScene`, leurs références et leur sérialisabilité ; identifier les sources média éphémères. Réutiliser le modèle partagé et distinguer le round-trip existant d’un véritable stockage entre rechargements. |
| R1 — Contrats applicatifs | Ce plan, étapes 4/5 du plan de construction et définition historique du contrôleur. | Reporter le cadrage fixé, conserver les frontières d’édition, retirer l’intention d’historien externe concurrent ; traiter le contrat provisoire en interne à partir de P0 en gardant la sauvegarde pérenne ouverte. |
| P1 — Persistance de transition | Adaptateur `temp` sous `src/app/persistence/`, contrôleur et composition applicative. | Réalisée pendant la reconstruction, puis retirée lors du basculement SQLite sans migration. Les preuves SQLite et ses limites sont suivies dans le plan dédié. Aucun changement CodPlay ni des modules spécifiques. |
| M1 — Composition Remix | Remplacer `src/app/main.tsx`, créer composition/routeur sous `src/app/`, adapter scripts/config/manifest. | Un acteur, une façade player et une coordination hors du rendu ; SPA, démarrage/erreurs/destruction vérifiés sur `5174`. |
| M2 — Vues et hôtes | Remplacer les cinq vues `src/app/layout/*.tsx` par des fichiers kebab-case et les primitives standards utiles. | Identifiants explicites, DOM spécialisé préservé, bridges montés/détruits une fois ; aucun remontage sur update. Modules spécifiques inchangés. |
| F1 — Intentions | Façade applicative dédiée, contrôleur/types et adaptateurs appelants. | Vues vers intentions typées ; transformations pures et façade player conservées ; mutation documentaire distincte de l’écho de sélection pour l’historisation. |
| H1 — Historique | Sous réserve du point 3 : historique applicatif local Éditeur, contrôleur/types, tests et bridges applicatifs existants. | Succès seulement, no-op exclu, une entrée avant/après par geste/phase validé, aucun échantillon intermédiaire retenu ; branche Redo et borne ; restauration par synchronisation/rebuild existants, sans `SCENE.LOAD` pour Undo local. Aucun changement Elcé ou CodPlay. |
| H2 — Interface | Layout/menu Remix, façade et raccourcis. | Boutons et Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z vers le même circuit ; disponibilité réelle, édition en attente traitée et aucune double annulation. |
| V1 — Acceptation | Tests, navigateur, manifest/config, specs propriétaires et suivi. | Typecheck/tests/build passent ; parité native prouvée ; zéro import React/ReactDOM/`@xstate/react` et retrait des dépendances inutilisées du workspace. Documenter seulement le comportement vérifié. |

## Parcours d’acceptation

- Création/typage/contenu par le geste applicatif prévu ; création, déplacement
  et suppression de KFs `pose`/`decor` ; décor/contenu ; capsules imbriquées,
  parent/enfant, références partagées et reparent existant.
- Undo/Redo : états exacts, transaction unique, pas d’entrée pour sélection,
  seek, Play, resize, preview ou no-op ; branche Redo, limite, changement de
  scène et références invalidées.
- Capture continue : plusieurs valeurs successives dans un même geste/phase
  produisent une seule entrée, du premier état au dernier validé ; Annuler
  retrouve l’état initial, Rétablir l’état final. Une phase abandonnée ne crée
  aucune entrée. Vérifier les frontières existantes propres à chaque module,
  sans leur ajouter un minuteur ou un commit intermédiaire.
- Ordre : décor en attente → autre commande → Undo/Redo ; saisie non validée
  → raccourci ; capture KF différée → restauration. Aucun candidat périmé ne
  recrée une édition annulée.
- Chemin réel `commande → acteur → builder V2 → CodPlay.build → instance →
  Seek/Play → snapshot/presentation → palette/cadre` : fin de lecture,
  reprise, resize, temps auteur, sélection et overlays.
- Lifecycle : updates Remix et changements de scène sans remontage des
  composants ; démontage/remontage propre, aucun callback résiduel ni mutation
  du DOM spécialisé par le rendu de son hôte.
- Persistance SQLite : le parcours et ses critères de round-trip sont suivis dans
  le [plan dédié](./2026-10-28-editor-sqlite-persistence-plan.md).
- Depuis les packages concernés : suites ciblées puis suites complètes,
  typecheck/build, parcours navigateur avec les outils MCP exposés. Compléter
  manuellement les gestes physiques non disponibles ; une simulation ne
  ferme pas leur preuve native.
- Vérifier que les changements de reconstruction ne touchent pas
  `packages/codplay`. Si un correctif CodPlay approuvé est nécessaire, référencer
  son commit ou sa branche distincte et les preuves qu’il fournit ; conserver
  ouverte toute validation qui en dépend encore. La persistance provisoire du
  modèle actuel entre dans l’acceptation ; la sauvegarde pérenne reste un
  chantier distinct ouvert.

Garder le plan ouvert tant qu’une preuve manque. À la clôture, transférer
contrats/preuves dans les specs, mettre à jour les liens, puis retirer la note
préparatoire et ce plan selon les règles du dépôt.
