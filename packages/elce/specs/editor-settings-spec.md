# Elcé — configuration et résolution des réglages de lecture

## Statut

**Fixe — source centralisée et transmission aux scènes vérifiées.** Les
transitions Flux utilisent la racine observée fixe et les actions Capsule du
média, selon la [spécification Flux](./flux-scene-builder-spec.md).

## Rôle

Cette couche rassemble les valeurs système de l’éditeur et les valeurs de
présentation qui ne sont pas encore exposées dans l’interface. Elle fournit
une source unique aux builders et au player, sans dupliquer un réglage dans une
fonction de construction. Les valeurs métier déjà enregistrées dans le
document restent leur source de vérité.

## Contrat

`ELCE_EDITOR_SETTINGS`, dans `src/config/editor-settings.ts`, contient les
valeurs par défaut et les règles système. `ElceEditorSettingsResolver`, dans
`src/domain/editor-settings/`, calcule les réglages effectifs avant la
projection :

- `resolvePage(page, bdcs, projectDefaults)` applique aux transitions de
  révélation la chaîne d’héritage document → BDC parent → entrée Carousel ;
  `null` hérite indépendamment pour l’entrée et la sortie ;
- le même résultat porte les valeurs de player communes à la page : zone de
  visibilité des vidéos Flux, observation de fin de page et durée/easing de
  l’agrandissement média ;
- `resolvePlayer()` fournit les valeurs des scènes persistantes, dont le
  tiroir de sommaire et l’agrandissement média. Le réglage
  `player.interactions.viewportExpansion.backdropOpacity` définit l’opacité du
  fond noir de l’agrandissement. `backdropClose` définit durée et easing de
  l’action CodPlay qui ramène l’opacité du layout à zéro à la fermeture ; sa
  durée reste inférieure à celle du déplacement média. L’ouverture rétablit
  l’opacité à `1`. Ces réglages ne changent pas la transition `move` du média.

Le résolveur décide des valeurs par défaut, priorités et conflits. Les builders
reçoivent les réglages résolus et les projettent dans Sighty/CodPlay. Ils ne
créent pas de nouveaux défauts de lecture. Une évolution de l’interface doit
écrire dans le modèle métier ou sélectionner une règle de cette configuration,
puis reprendre le même résolveur.

Les observations de révélation et leurs actions conservent leurs propriétaires
existants : la racine Carte Flux observe et émet les événements d’entrée/sortie ;
si la Carte possède un média, celui-ci porte l’état de repos et les actions
Capsule résolues, sans second observateur. Une Carte sans média porte ses
propres actions. La première mesure synchronise la phase sans animer une Carte
déjà visible ; les passages suivants rejouent l’entrée et la sortie. La
Section continue de gérer le placement de l’ancre. Le défaut des nouveaux
projets est `swipe-right` pour les deux directions ; les références persistées
et leurs remplacements restent prioritaires. Les anciens tweens image
supplémentaires et l’opacité fixe `0.92` ne sont plus appliqués aux Cartes.
L’illustration image d’une Question conserve sa propre entrée configurée.

La preview et l’export du scénario utilisent `createElcePlayerScenario` et la
même résolution de page. Les valeurs initiales cachées restent centralisées ;
elles ne sont pas recopiées comme réglages locaux dans les builders.

## Preuves

- [`editor-settings-resolver.test.ts`](../src/domain/editor-settings/editor-settings-resolver.test.ts)
  couvre l’héritage projet → parent → Carousel → entrée et vérifie la remise des
  réglages player groupés.
- [`flux-scene-builder.test.ts`](../src/builders/flux/flux-scene-builder.test.ts)
  vérifie les zones vidéo et fin de page, les événements de visibilité portés
  par la Carte et les actions Capsule portées par son média ou par sa racine
  lorsqu’elle n’a pas de média.
- [`elce-player-composition.test.ts`](../src/player/elce-player-composition.test.ts)
  vérifie la première mesure stable, l’entrée après une mesure extérieure et le
  rejeu des transitions dans les deux sens dans la composition réelle.
- [`diapo-scene-builder.test.ts`](../src/builders/diapo/diapo-scene-builder.test.ts)
  vérifie la zone centralisée des marqueurs de fin de page.
- [`scenario-builder.test.ts`](../src/builders/scenario/scenario-builder.test.ts)
  vérifie que le tiroir de sommaire reçoit les mouvements résolus.
- Le test de composition du player couvre les interactions d’agrandissement
  image et graphe.
- [`viewport-expansion-builder.test.ts`](../src/builders/viewport-expansion/viewport-expansion-builder.test.ts)
  vérifie que l’action de fermeture fait passer l’opacité du layout de `1` à
  `0` sur une durée plus courte que le `move`, sans changer l’aller-retour du
  média. Le 23 octobre 2026, Brave mesure `0.198` à 50 ms puis `0` à 130 ms ;
  le test de composition vérifie aussi que la réouverture rétablit `1`.

La fusion du 26 octobre 2026 passe la suite Elcé complète (481 tests dans
73 fichiers), le typecheck et le build. La vérification visuelle après fusion
reste suivie dans le [plan Style](../plan/2026-10-22-elce-style-tab-plan.md).
