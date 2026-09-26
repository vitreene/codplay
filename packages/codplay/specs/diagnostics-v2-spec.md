# CodPlay V2 — diagnostics structurés

## Contrat certifié

Cette spécification décrit le collecteur commun des diagnostics V2. Il stocke
des entrées structurées ; l'appelant décide si une situation est un warning ou
une erreur et choisit la portée de vie de son collecteur.

Une entrée contient une sévérité (`warning` ou `error`), un code, un message
et un contexte optionnel. Les références structurées disponibles sont
`instanceId`, `sceneId`, `storyId`, `persoId`, `trackId`, `eventId`,
`eventSeq` et `commitSeq`. Un appelant peut aussi fournir une clé de
déduplication.

Chaque collecteur possède son propre rapport et ses propres clés de
déduplication. Par défaut, une entrée répétée avec la même sévérité, le même
code et les mêmes références est ignorée, même si son message ou son contexte
diffère. Une clé explicite remplace cette clé par défaut. La déduplication peut
être désactivée à la création du collecteur.

`report()` retourne les entrées acceptées sous les groupes `all`,
`warnings` et `errors`. `hasErrors()` indique si le rapport contient au
moins une erreur. `clear()` vide le rapport et les clés déjà vues.

Le callback `output`, s'il est fourni, reçoit chaque entrée acceptée. Par
défaut, le collecteur écrit dans `console.log` sous la forme
`[sévérité] code: message`, suivie du JSON des détails quand ils existent.
Passer un callback sans effet permet de supprimer cette sortie.

Le builder, le codec, l'engine et le player utilisent cette même classe de
collecteur. Les instances de diagnostic gardent leur état local ; le
consommateur choisit quand créer et réutiliser un collecteur.

## Preuves

- Le [collecteur](../src/diagnostics/diagnostic-collector.ts) implémente le
  format, le regroupement, la déduplication et les adaptateurs de sortie.
- Les [tests du collecteur](../tests/diagnostics/diagnostic-collector.spec.ts)
  vérifient les groupes warning/error, la clé par défaut, la clé explicite,
  `clear()`, la déduplication désactivée et la sortie par défaut.
- Le [builder](../src/scene/compiled/scene-builder.ts), le
  [codec](../src/scene/compiled/codec.ts), l'[engine](../src/runtime/engine/runtime-engine.ts)
  et le [contrôleur d'événements](../src/runtime/player/runtime-player/event-controller.ts)
  importent le même collecteur.
