# Guide de reprise CodPlay V2

> État documentaire : 2026-09-26. Ce guide dirige la lecture ; les
> spécifications et plans détaillés portent les contrats et statuts courants.

## Ordre de lecture

1. Lire les [règles du dépôt](../../../../AGENTS.md).
2. Identifier le [plan détaillé](../codplay-v2-plan.md) qui couvre le sujet.
3. Lire le présent guide, puis la spécification du comportement vérifié.
4. Lire le plan actif du domaine, s'il existe, pour les décisions non prises,
   les décisions acceptées mais non appliquées et leur parcours d'acceptation.
5. Vérifier les fichiers de code et de test cités par ces documents.

La [carte de fonctionnement](../../projet/notes/2026-09-25-carte-fonctionnement-v2.md)
repère les dépendances, les circuits et les propriétaires dans le code. Le
[registre d’audit achevé](../../projet/notes/2026-09-26-audit-contradictions-doublons-methodes.md)
archive les constats et fichiers de preuve ; les spécifications et plans
détaillés restent les sources de référence.

## Règle d'autorité

- Une spécification décrit seulement les comportements implémentés, vérifiés
  et normatifs.
- Un plan conserve les décisions à prendre ou acceptées mais non appliquées,
  avec leurs gates et critères d'acceptation.
- Une note explique le contexte utile ; elle ne crée pas de contrat.
- Un plan exécuté est retiré quand la spécification couvre sa feature et
  qu'aucune décision ou validation ne reste.

## État actuel de quelques frontières

- **Engine et Player** : le cycle, l'horloge et le Seek groupé vérifiés sont
  dans la [spécification](../../specs/engine-player-v2-spec.md). Le contrat de
  `schedule`, le redémarrage direct de `RuntimePlayer.play()` depuis l'état
  `sequence:end` avec ses effets de cycle, la réutilisation logique, la
  politique de `rate`, la lecture arrière éventuelle et la préparation motion
  restent au [plan Player](../player-engine-plan.md). Le chemin façade
  `instance.telco.play()` après une fin d'inactivité est vérifié séparément.
- **Actions temporelles** : les comportements `ActionSequence` et
  `TweenAction` couverts sont dans leur [spécification](../../specs/action-sequence-tween-v2-spec.md).
  Les extensions auteur ACE et les cas d'acceptation manquants restent au
  [plan associé](../action-sequence-tween-plan.md) ; les primitives ACE seules
  ne définissent pas une API `Behavior`.
- **Façade** : le contrat public vérifié est dans
  [`facade-v2-spec.md`](../../specs/facade-v2-spec.md). Son plan ne conserve que
  la décision non prise sur une éventuelle observation des changements de
  `snapshot`.
- **Capture** : la [spécification capture](../../specs/capture-v2-spec.md)
  décrit le contrat vérifié, y compris le routage `visibility` des événements
  d’ouverture et de fin. Les validations navigateur restantes sont suivies par
  les [plans S5](../capture-s5-validation-plan.md) et
  [S6](../drag-capture-list-s6-validation-plan.md).
- **Scroll-container** : la capacité a été validée par l'utilisateur et son
  contrat vérifié est dans la [spécification scroll](../../specs/scroll-container-spec.md).
- **Source DOM `Perso.emit`** : le sous-ensemble compilé et intégré est dans la
  [spécification](../../specs/perso-emit-v2-spec.md). Les portées non-story,
  les modes, l'ordre des actions et les parcours Seek/reparent restent au
  [plan d'acceptation](../perso-emit-v2-portage-plan.md). Le contrat source
  continu partagé, dont le raccord au scroll, est décrit dans les
  spécifications [capture](../../specs/capture-v2-spec.md) et
  [scroll-container](../../specs/scroll-container-spec.md).
- **Isolation des stories** : l'activation ciblée, le reset et la projection
  d'actions vérifiés sont décrits par la
  [spécification](../../specs/story-isolation-spec.md). Les occurrences
  différées et motion, la suppression des autres effets `listen`, le cycle
  Play/Seek/resize/persistence/lifecycle et l'acceptation navigateur restent au
  [plan d'acceptation](../story-isolation-plan.md).
- **Mouvement** : la forme auteur et sa compilation vérifiées sont dans la
  [spécification `move`](../../specs/move-v2-spec.md). Les snapshots de
  frontière et l'évaluation au temps absolu sont décrits par la
  [spécification motion](../../specs/motion-frame-v2-spec.md) ; le retarget vers
  une target déplacée par sa
  [spécification dédiée](../../specs/move-target-dependency-v2-spec.md). La
  préparation et les validations complètes Play/Seek restent aux plans
  [motion](../motion-live-discovery-invalidation-plan.md),
  [runner](../runner-flip-integration-study.md) et
  [retarget](../move-target-dependency-plan.md).
- **CompiledScene** : la [spec d'authoring](../../specs/scene-authoring-spec.md)
  et la [spec codec](../../specs/compiled-codec-v2-spec.md) décrivent les
  frontières vérifiées. `SceneDoc.defaults` et la preuve d'intégration des
  `rootNodeIds` restent au [plan CompiledScene](../compiled-scene-plan.md).
- **Preload et médias** : les comportements vérifiés sont dans les
  [specifications preload](../../specs/preload-v2-spec.md) et
  [media-sync](../../specs/media-sync-v2-spec.md). Leurs preuves restantes,
  `run()` et le parcours Safari sont au [plan média](../media-preload-plan.md).
  La règle acceptée pour une source directe — temps réel, sans rewind,
  buffering ni contrôle par `rate` — reste non appliquée ; sa déclaration et
  son cycle de vie sont encore à décider dans ce même plan.

Pour les autres domaines, utiliser l'index du [plan général V2](../codplay-v2-plan.md)
et suivre les plans d'acceptation reliés depuis chaque spécification.

## Circuit CodPlay

Le [guide auteur](../../README.md) montre un exemple d'usage. La carte de
fonctionnement détaille le chemin `SceneDoc → build → CompiledScene → instance`
et le raccord entre player, journal, solveur, composants et runner HTML. Les
contrats du runtime restent séparés par domaine ; une démo est une fixture qui
exerce ces contrats, jamais leur source d'autorité.
