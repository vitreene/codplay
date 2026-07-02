# Cadrage — le seek peut reconstruire un état faux quand une transition active chevauche une action plus tardive

## Statut

Défaut confirmé empiriquement le 2026-06-28, découvert en testant la Phase 2 du plan
`2026-06-28-unify-action-execution-and-move-off-plan.md` (`ActionSequence`).

**Corrigé localement le 2026-06-28** pour le cas qui a déclenché cette investigation : une étape
d'`ActionSequence` retire désormais explicitement, avant de s'appliquer, le tween laissé actif par
l'étape précédente de la **même chaîne** (`TweenRunner.cancelByActionKey`,
`PlayerFacade.retireActionSequenceChainTween`, voir `v1-action-sequence-spec.md` et
`tests/v1/action-sequence.spec.ts` AS-T4). Ce correctif est volontairement **local** : il ne change
rien à l'ordonnancement global du seek, et ne couvre que les collisions internes à une séquence
explicitement chaînée.

**Le cas général reste ouvert** : deux actions indépendantes, sans lien de séquence, qui touchent la
même propriété — que ce soit via `TweenAction` isolé ou via anime.js. Document maintenu comme
cadrage pour ce cas restant. Ne pas démarrer la Phase 3 du plan d'unification avant d'avoir statué
sur la suite à donner à ce cas général (corriger l'ordonnancement, ou seulement détecter/signaler —
voir "Pistes" ci-dessous, mises à jour).

## Le défaut, précisément

Le `seek()` repose sur deux phases découplées, qui ne se coordonnent pas :

1. **Rejoué du track** (`replayDueTimelineEventsForSeek`, `create-player.ts`) : rejoue tous les
   commits dus, dans l'ordre chronologique. C'est la source de vérité censée reconstruire l'état
   exact à `targetMs`.
2. **Ré-évaluation des moteurs d'animation continue** (`TweenRunner.seek()` →
   `evaluateAt(timelineMs, isSeek=true)`, `tween-runner.ts` ; `AnimationAdapter.seek()`,
   `adapter.ts:432`) : s'exécute **après**, sans connaissance de ce que la phase 1 vient
   d'établir. Elle réapplique la valeur de toute transition encore "active" à ce moment — y
   compris une transition **terminée depuis longtemps**, si rien ne l'a explicitement arrêtée —
   même si une action chronologiquement **plus tardive** a déjà écrit sur la même propriété
   pendant la phase 1.

Résultat : le seek peut reconstruire un état faux dès qu'une transition active et une action plus
tardive touchent la même propriété.

## Portée confirmée

- **Limité au seek, pas à la lecture live.** En lecture live (`evaluateAt(timelineMs,
  isSeek=false)`), une fois `rawProgress >= 1`, le tween est retiré de `activeTweens`
  (`tween-runner.ts`, branche `!isSeek`) — il ne peut donc plus écraser quoi que ce soit après sa
  propre fin. Cette protection n'existe que pour ce chemin ; elle est absente du chemin `isSeek`.
- **Touche les deux moteurs**, pas seulement `TweenRunner` :
  - Confirmé par test dédié (jetable, supprimé après vérification) sur `TweenAction` : une étape
    `ActionSequence` statique suivant un `TweenAction` sur la même propriété se voit écrasée par la
    ré-évaluation du tween à tout seek postérieur à sa fin naturelle.
  - Confirmé par un second test dédié (jetable, supprimé après vérification) sur une transition
    anime.js classique (`style.opacity` avec `{from,to,duration}`) suivie d'une action statique sur
    la même propriété, déclenchée nettement plus tard (ms800 contre une transition finissant à
    ms500) : au seek, la valeur statique n'apparaît pas — `style.opacity` finit à `0`, ni la valeur
    de la transition à son terme naturel (`1`) ni la valeur statique attendue (`0.2`).
- **Aggravant observé sur ce second test, non encore expliqué complètement** : le mock d'adaptateur
  anime.js a reçu **deux** appels `seek()` pour la même transition (`time=500` puis `time=0`), ce
  qui suggère qu'une transition peut être **enregistrée plusieurs fois** (une fois en lecture live,
  une nouvelle fois à chaque rejoué par un seek) sans déduplication — un mécanisme de duplication
  similaire à celui que j'ai dû corriger pour `ActionSequence` côté track (voir
  `v1-action-sequence-spec.md`, "Idempotence au replay"), mais ici côté `AnimationAdapter`, non
  corrigé, et dont l'ampleur réelle reste à établir précisément.
- **Aucune démo existante identifiée comme touchée en l'état** (recherche dans
  `packages/demos/src/scenes/`) : les usages actuels de `TweenAction` appellent explicitement
  `tween:stop` avant toute action suivante sur la même propriété (`chrono-story.ts`,
  `quiz-hunt/straps/game-timer.ts`). Les transitions anime.js enchaînées trouvées
  (`quiz-series-scene.ts`) ciblent la même propriété **entre elles** (hide/show successifs), un cas
  qui se comporte correctement par chaînage naturel — pas le cas transition-puis-action-statique
  testé ci-dessus. Ce constat ne garantit pas l'absence du défaut dans des scènes non auditées
  individuellement ; seule une recherche par motif a été faite, pas une vérification scène par
  scène.

## Pourquoi ce n'est pas spécifique à ce plan

Ce défaut existe indépendamment de `ActionSequence` et du travail de Phase 1/2 : il touche tout
couple "transition active + action plus tardive sur la même propriété", que la transition soit
déclenchée par un `TweenAction` isolé, par une transition statique anime.js, ou — désormais — par
une étape d'`ActionSequence`. `ActionSequence` n'a fait que rendre le cas facile à provoquer
(chaîner une transition puis une étape statique est un usage naturel), pas créé le défaut.

## Pistes de correction envisagées — aucune tranchée

- **Invalidation par propriété pendant le rejoué** : pendant `replayDueTimelineEventsForSeek`,
  mémoriser, par perso et par propriété touchée, le dernier point d'écriture rencontré ; après le
  rejoué, ne laisser un moteur continu ré-évaluer une propriété que si rien de plus tardif ne l'a
  déjà fixée. Suppose de savoir, pour une transition anime.js, quelles propriétés elle déclare
  (`{property: {to, duration}}` le permet directement) — et pour un `TweenAction`, que `fn` est
  opaque : il faudrait soit l'évaluer une fois pour connaître les clés qu'il produit, soit changer
  l'invalidation de grain (par `(persoId, actionKey)` plutôt que par propriété).
- **Séquencement réel** : faire que la ré-évaluation des moteurs continus s'intercale
  chronologiquement avec le rejoué du track, plutôt que de s'exécuter en bloc après — changement
  plus profond de l'architecture du seek, touchant `RenderSync` et l'ordre d'appel actuel
  (`replayDueTimelineEventsForSeek` puis `renderSync.seek(...)`, `create-player.ts:~2089-2091`).
- **Expliquer et traiter la duplication d'enregistrement côté `AnimationAdapter`** avant toute autre
  chose : si une transition peut être enregistrée plusieurs fois sans déduplication à chaque
  rejoué, la correction de l'écrasement ne suffira pas — il faut d'abord établir un état propre.
- **Détection/signalement plutôt que correction systématique** (proposition de l'auteur,
  2026-06-28) : pour le cas général (actions indépendantes, pas de lien de séquence), corriger
  l'ordonnancement partout est plus risqué que de **signaler** la collision à l'auteur de la scène.
  Deux formes possibles, ni l'une ni l'autre implémentée :
  - un avertissement ciblé sur les propriétés jugées "intentionnelles" (ex. `content`, plus
    significatif qu'un calcul de coordonnées) quand une action plus tardive sur la même propriété
    risque de se faire écraser par une transition encore active ;
  - un mode trace auteur plus générique, pour repérer ce genre de collision en développement sans
    figer une liste de propriétés sensibles en dur.

Aucune de ces pistes n'a été creusée au point de pouvoir trancher ; ce document sert à objectiver le
défaut et ses conditions d'apparition avant de choisir.

## Prochaine étape

Décider, avec l'auteur, laquelle de ces pistes (ou une autre) creuser en premier — pas de code tant
que ce choix n'est pas fait. La Phase 3 du plan d'unification (`move:"off"`) reste en attente tant
que ce point n'est pas au moins scoping-validé.
