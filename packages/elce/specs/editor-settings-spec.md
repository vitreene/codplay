# Elcé — configuration et résolution des réglages de lecture

## Statut

**Fixe — source centralisée et transmission aux scènes vérifiées.** La correction
du fondu parasite des images Flux est vérifiée dans les tests et dans la preview
le 23 octobre 2026 ; son acceptation est consignée dans le
[plan actif](../plan/2026-10-06-elce-local-first-synchronisation-plan.md).

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
l’image applique ses actions à partir de ces événements, sans créer un second
observateur ; la Section continue de gérer le placement de l’ancre. Le résolveur
supprime aussi les mouvements média qui entreraient en conflit avec une
transition Capsule horizontale. La translation d’entrée est `-112%` → `0%` en
1000 ms `outCubic` ; la sortie est `0%` → `-112%` en 820 ms `inCubic`, selon le
comportement vérifié dans le composant d’image de
[`Demo5`](../../../demos/src/sighty/demo5/scenes/content-page-scene.ts).
Pour une Carte Flux contenant une image, la racine ne reçoit ni état initial ni
action `opacity` de sa transition Capsule : elle reste à son opacité CSS normale
pendant que le média suit la trajectoire. Le perso image reçoit une opacité
statique de `0.92` (environ 8 % de transparence). Les vidéos et les Cartes sans
image gardent leurs transitions existantes. Ces deux valeurs sont dans
`ELCE_EDITOR_SETTINGS.revelation.flux.cardMediaMotion` et sont transmises par
`ElceEditorSettingsResolver`.

La preview et l’export du scénario utilisent `createElcePlayerScenario` et la
même résolution de page. Les valeurs initiales cachées restent centralisées ;
elles ne sont pas recopiées comme réglages locaux dans les builders.

## Preuves

- [`editor-settings-resolver.test.ts`](../src/domain/editor-settings/editor-settings-resolver.test.ts)
  couvre l’héritage projet → parent → Carousel → entrée et vérifie la remise des
  réglages player groupés.
- [`flux-scene-builder.test.ts`](../src/builders/flux/flux-scene-builder.test.ts)
  vérifie les zones vidéo et fin de page, ainsi que les événements d’observation
  portés par la Carte, l’absence de fondu sur la racine d’une Carte image et
  l’opacité statique du média. La composition du player exerce le mouvement réel
  dans les deux directions sans état d’opacité animé sur la racine.
- Le 23 octobre 2026, Brave DevTools vérifie dans la preview générée depuis
  l’éditeur que la racine reste à l’opacité calculée `1`, tandis que l’image
  reste à `0.92`. Le scroll vers le bas puis vers le haut fait parcourir à
  l’image `0%` → `-112%` puis `-112%` → `0%` ; aucune variation d’opacité n’est
  observée pendant ces trajets.
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
