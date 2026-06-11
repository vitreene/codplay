# Session context - 2026-05-19 - refonte sequence event-driven

## Objectif

Realigner le runtime sur le concept valide avec le user:

- toutes les stories sont actives logiquement des `init`
- la narration est pilotee par les events, pas par `schedule`
- `play`, `pause`, `seek`, `rewind` restent indispensables
- la fin de sequence est explicite via `sequence:end`

## Decisions validees

1. Stories et persos
   - toutes les stories d'une scene sont actives logiquement des `init`
   - tous les persos peuvent etre crees des `init`
   - les persos reagissent aux events des le depart
   - `rootStories` sert a designer les points d'entree racine du contexte scene
   - une scene elaboree pourra plus tard deleguer le placement a une `story-layout`

2. Pilotage runtime
   - `play` et `pause` sont des interfaces de conduite telco indispensables
   - `seek` et `rewind` restent indispensables pour la conduite de sequence
   - `seek` et `rewind` continuent a se caler sur le `trackManager`
   - le runtime reste temporel pour les tracks, les media et les animations
   - le runtime ne doit plus utiliser le temps comme mecanisme implicite d'orchestration des stories

3. Events et fin de sequence
   - `scene:end` est un event runtime normal, gere par l'auteur
   - `sequence:end` est un event runtime normal mais terminal
   - il n'y a pas de contrainte d'ordre entre les emissions d'events
   - tant que `sequence:end` n'est pas recu, `seek` et `rewind` restent possibles
   - a reception de `sequence:end`, la sequence est verrouillee
   - apres `sequence:end`, plus aucun event n'est route vers la sequence
   - apres `sequence:end`, `seek`, `rewind` et replay ne sont plus possibles
   - `onSequenceEnd` est conserve comme hook scene et s'execute apres le verrouillage terminal
   - les noms `scene:end` et `sequence:end` restent des conventions repertoriees comme les autres noms d'events

4. Ce qui devient obsolete
   - `waitingForExternalEvent`
   - le modele `wait-flow`
   - `schedule` comme mecanisme narratif
   - toute fin implicite deduite d'un manque d'events temporels

5. Pause et events user
   - en pause, les events user sont geles
   - une extension future pourra basculer des groupes de tracks de suspension distincts
   - cette extension est volontairement separee du chantier principal

## Consequence implementation

- le player doit charger le runtime a partir de l'ensemble des stories de la scene
- les `eventimes` de story restent des sources d'events persistables via le `trackManager`
- les stories ne doivent plus dependre de `mount/schedule` pour exister narrativement
- `sequence:end` devient l'unique pivot de terminaison runtime
