# CodPlay V2 - execution des straps

## Statut

> Status: Fixe
> CodPlay version: V2 foundation
> Review: exécution planned bornée validée le 2026-08-20; annulation, générations obsolètes et live restent des extensions

## Contrat actuel

`executeStrapsSequentially` execute une collection de fonctions stateless dans
l'ordre de declaration. Chaque fonction peut etre synchrone ou asynchrone. Les
erreurs et noms absents deviennent des issues; ils n'interrompent pas la chaine.

Le flattening recursif collecte :

- les events immediats;
- les updates immediates;
- les occurrences planifiees avec `offsetMs`;
- les warnings auteur.

Cette sortie reste d'abord en memoire dans l'execution pure du strap. Le
`RuntimeEventDispatcher` est ensuite responsable de son append explicite dans le
journal; l'execution du strap ne connait donc toujours pas le stockage.

Les sorties `events` et les occurrences planifiees qui portent un event sont
appendees par `RuntimeTrackJournal.appendStrapOutput` sur la track dediee deja
declaree, une track par strap et par scope. Les `update` sont materialises comme des events
`runtime:state:update` portant leur scope `story` ou `scene`. Ils sont rejouables
par `materialize` et ne sont jamais appliques directement par le renderer.

Les helpers finis `context.planned` V2 sont `wait`, `delay`, `repeat`, `stagger`,
`sequence` et les `loop` bornes par `times` ou `durationMs`. Ils produisent
uniquement des occurrences declaratives et ne lancent aucun scheduler. Ce modele
est nomme **Plan Temporel Declaratif**; voir
`2026-08-01-context-live-evolution.md`.

`RuntimeStateStore` fournit les snapshots scene/story en lecture seule aux straps.
Un `update` n'est applique qu'explicitement par l'orchestrateur, apres sa
journalisation, puis peut etre remplace par une reconstruction de seek.

## Limite live obligatoire

Le contrat `live` V1 n'est pas porte. La V2 a fait evoluer ce contrat pour rester
compatible avec `f(t)` : aucune emission liee au rythme des frames, aucun `onUpdate`
et aucun helper `context.live` ne doit etre introduit par copie de V1.

Un compteur temporel doit devenir un behavior/tween evaluable. Un compteur
d'occurrences doit rester un etat mis a jour par des events. Toute forme live V2
future doit etre specifiquement decidee avant implementation.

## Deja en place

- collections scene/story sans fallback croise;
- validation des straps declares a `RuntimePlayer.init`;
- warnings non bloquants pour les declarations absentes.
- snapshots scene/story geles via `RuntimeStateStore`.
- `RuntimeEventDispatcher` appelle chaque strap declare dans l'ordre, attend sa
  completion, journalise son resultat, puis seulement reinjecte les emits;
- plusieurs straps dans une meme regle gardent chacun leur provenance et leur
  track dediee;
- le `RuntimePlayer` reconcilie les snapshots d'etat depuis le journal apres
  seek et avant un nouveau dispatch.

## A faire

- definir les cas de loop bornes compatibles avec `f(t)`;
- definir le protocole d'annulation et de generation obsolete;
- ne jamais creer de track pendant la lecture.
