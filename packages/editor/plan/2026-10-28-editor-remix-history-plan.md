# Éditeur — adaptation Remix, façades et historique

**Statut : En cours — cadrage accepté pour implémentation le 28 octobre 2026 ;
décisions 1 à 6 fixées.**
**Constat au 28 octobre 2026 :** build réussi, typecheck en échec,
452 tests réussis et 3 échecs sur 455. La
[note d’analyse](./notes/2026-10-28-editor-recovery-remix-analysis.md)
porte l’inventaire, les preuves et les raisons des propositions.

**Avancement au 28 octobre 2026 :** le portage applicatif est implémenté.
`remix@3.0.0`, le runtime `remix/component`, le routeur `remix/spa`, les vues
Remix, les façades d’actions et le stockage provisoire sont en place. Le typecheck
et le build passent après correction de la projection média locale. Les suites
automatisées et le parcours navigateur restent à exécuter ; le signal historique
de fin de lecture sans présentation reste ouvert.

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
Isoler ensuite le correctif dans un commit distinct, ou dans une branche de
fix dédiée. Seul le travail dépendant de ce correctif attend sa résolution ;
aucun contournement éditeur ne doit masquer le défaut.

**Persistance provisoire du modèle actuel : besoin confirmé.** Avant le chantier
de sauvegarde pérenne, la reconstruction doit permettre de conserver puis de
recharger l’`EditorScene` actuel. Examiner d’abord ce modèle et ses données
effectivement présentes ; la persistance provisoire s’adapte à cette forme
auteur, sans la remplacer par un modèle futur ou un artefact compilé CodPlay.

**Sauvegarde pérenne : décision laissée ouverte, chantier distinct.** Le support,
le format de long terme, les migrations, la gestion des ressources et la
synchronisation restent à élaborer. La persistance provisoire est suivie ici
et reliée à l’étape 5 du
[plan de construction](./app/2026-07-10-app-construction-plan.md).

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

- Le stockage `temp` utilise la clé `codplay.editor.temp-scenes.v1`, une
  enveloppe versionnée avec scènes par ID et scène active. Il conserve les
  propriétés `EditorScene` JSON ; il refuse les valeurs non sérialisables et
  signale les sources `blob:` dont les octets ne survivent pas au rechargement.
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
- L’erreur générique de sérialisation signalée n’a pas été reproduite après
  rechargement ; le stockage antérieur contenait un document JSON valide. Le
  garde indique désormais le chemin de la valeur refusée pour qualifier une
  prochaine occurrence. La cause initiale reste ouverte.
- La suite et le parcours navigateur complet restent à valider. Garder cette
  tranche `En cours` ; le défaut de présentation en fin de lecture reste sans
  cause établie.

## Actions ordonnées

Implémentation acceptée le 28 octobre 2026. H1 utilise l’historique local
d’Éditeur défini au point 3.

| Étape | Fichiers/propriétaires et remplacement | Porte d’acceptation |
| --- | --- | --- |
| R0 — Baseline | Builder V2, tests builder/bridge et plans V2 côté Éditeur ; diagnostic CodPlay en lecture seule si nécessaire. | Les attentes de transition et la projection média locale sont alignées ; le défaut de présentation en fin de lecture reste à diagnostiquer. Tout correctif CodPlay attend l’approbation préalable et reste isolé dans un commit ou une branche de fix ; les autres composants exclus exigent une tranche distincte. |
| P0 — Modèle à persister | Modèle documentaire, `src/app/commands/types.ts`, données et tests de sérialisation existants. | Inventorier les valeurs réellement portées par `EditorScene`, leurs références et leur sérialisabilité ; identifier les sources média éphémères. Réutiliser le modèle partagé et distinguer le round-trip existant d’un véritable stockage entre rechargements. |
| R1 — Contrats applicatifs | Ce plan, étapes 4/5 du plan de construction et définition historique du contrôleur. | Reporter le cadrage fixé, conserver les frontières d’édition, retirer l’intention d’historien externe concurrent ; traiter le contrat provisoire en interne à partir de P0 en gardant la sauvegarde pérenne ouverte. |
| P1 — Persistance provisoire | Adaptateur dédié sous `src/app/persistence/` à créer et nommer `temp`, contrôleur/chargement central et composition applicative. | Sauver puis restaurer le document courant par le circuit central ; rechargement réel avec état auteur et identifiants conservés. Documenter portée et limites média. Retirer/remplacer cet adaptateur lors de l’adoption de la sauvegarde pérenne, en décidant alors du devenir des documents provisoires. Aucun changement CodPlay ni des modules spécifiques. |
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
- Persistance provisoire : édition du modèle actuel → écriture → rechargement
  navigateur → chargement central → reconstruction V2 et reprise de l’édition.
  Vérifier les relations, tables, KFs, chemins et propriétés de décor conservés,
  ainsi que l’écriture du document restauré par Undo/Redo. Exercer les refus de
  lecture/écriture et documenter les limites de conservation des médias.
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
