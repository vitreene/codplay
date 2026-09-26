# CodPlay V2 — inactivité du player

## Périmètre vérifié

Cette spécification couvre la configuration du monitor d'inactivité du player,
sa mesure pendant la lecture et l'émission de son événement par le circuit
normal. Elle ne définit pas la détection d'inactivité de la fenêtre ou des
périphériques d'entrée.

Le monitor appartient au player. Il compte les frames fournies par l'engine et
n'ajoute ni timer ni journal parallèle. L'implémentation est portée par
[`RuntimeIdleMonitor`](../src/runtime/idle/runtime-idle.ts) et son émission par
le [contrôleur d'événements](../src/runtime/player/runtime-player/event-controller.ts).

## Configuration

L'option `idle` peut être fournie à l'engine ou à une instance :

- sans configuration, le seuil est de `30_000` ms et l'événement est
  `{ name: 'sequence:end' }` ;
- la configuration de l'instance remplace celle de l'engine ;
- `idle: false` désactive le monitor de cette instance ;
- une configuration peut fixer `durationMs` et le descripteur d'événement
  (`name`, `data`, `visibility`, `storyId`) ;
- la durée doit être un nombre fini positif et le nom d'événement ne peut pas
  être vide.

Les options publiques sont exposées sur
[`CodPlayEngineOptions`](../src/facade/facade-types.ts) et
[`CodPlayInstanceOptions`](../src/facade/facade-types.ts).

## Mesure et émission

Le monitor accumule `deltaMs` des frames reçues pendant que le player est en
lecture. Au franchissement du seuil, il émet une seule fois l'événement
configuré par le circuit normal de `RuntimePlayer` ; l'émission porte le
contexte interne `source: 'idle'`. Une nouvelle période commence après un
événement externe accepté, une reprise après pause ou un seek. La pause suspend
le comptage.

L'événement configuré conserve sa visibilité au dispatch. Une visibilité
`public` le rend observable par l'hôte selon le contrat général du
[pipeline événementiel](./event-pipeline-v2-spec.md).

Lorsque l'événement émis est `sequence:end` — le défaut — le player applique
son comportement terminal existant : il s'arrête en état `paused`, signale la
fin de séquence et appelle le hook de scène après le nettoyage. Le test
d'intégration vérifie qu'un appel `instance.telco.play()` reprend alors la
lecture à `0 ms` et efface `sequenceEnded`. Il ne certifie pas les effets
complets du redémarrage direct de `RuntimePlayer.play()` sur le journal, les
modules et les callbacks ; ces points restent au plan Player.

## Preuves

- [`runtime-idle.spec.ts`](../tests/runtime/idle/runtime-idle.spec.ts) vérifie
  les valeurs par défaut, le seuil et l'émission unique, la surcharge par
  instance, la désactivation, le reset par événement externe, la pause/reprise,
  le seek et le rejet des durées ou noms invalides.
- [`idle-config.spec.ts`](../tests/facade/idle-config.spec.ts) vérifie la
  configuration publique d'engine et d'instance, l'observation d'un événement
  `public`, la fin `sequence:end`, le replay et l'intégration de la télécommande.
- [`runtime-player.spec.ts`](../tests/runtime/player/runtime-player.spec.ts)
  couvre le nettoyage terminal et le cycle de replay de `sequence:end`.
