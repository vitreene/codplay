# CodPlay V2 - execution des straps

## Statut

> Status: Fixe
> CodPlay version: V2 foundation
> Review: exécution planned bornée validée le 2026-08-20; l'invalidation des résultats asynchrones est reportée à V3 et live reste une extension

## Déclaration auteur

Un strap appartient par défaut à l'élément qui le définit : une `SceneDoc` peut
déclarer les straps de la scène et une `StoryDoc` peut déclarer les straps de la
story. Cette déclaration locale est la forme normative pour un comportement
propre à la scène ou à la story.

Une déclaration sous forme de noms est la forme exceptionnelle des straps
réutilisables. Elle désigne explicitement une implémentation portable fournie
par une collection externe. Le choix entre déclaration locale et référence
réutilisable appartient à l'auteur ; le runtime ne requalifie pas un strap et
ne choisit pas un mode en fonction de son contenu.

Après compilation, les fonctions locales deviennent des références dans le
`CompiledScene` et restent dans la collection de fonctions produite par le
builder. Les noms réutilisables restent des noms. Les deux formes sont ensuite
résolues une seule fois dans la même collection d'exécution et suivent le même
pipeline.

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

Un strap asynchrone peut être attendu puis produire des events ou des updates par
son résultat. V2 ne définit pas encore l'invalidation d'un résultat arrivé après
une opération plus récente : ce protocole de génération et d'annulation relève
de V3.

## Limite live obligatoire

Le contrat `live` V1 n'est pas porte. La V2 a fait evoluer ce contrat pour rester
compatible avec `f(t)` : aucune emission liee au rythme des frames, aucun `onUpdate`
et aucun helper `context.live` ne doit etre introduit par copie de V1.

Un compteur temporel doit devenir un behavior/tween evaluable. Un compteur
d'occurrences doit rester un etat mis a jour par des events. Toute forme live V2
future doit etre specifiquement decidee avant implementation.

## Deja en place

- déclarations locales scene/story et références réutilisables explicites,
  sans fallback croisé;
- validation des straps declares a `RuntimePlayer.init`;
- warnings non bloquants pour les declarations absentes.
- snapshots scene/story geles via `RuntimeStateStore`.
- `RuntimeEventDispatcher` appelle chaque strap declare dans l'ordre, attend sa
  completion, journalise son resultat, réinjecte ses événements immédiats dans le
  pipeline puis réinjecte les emits déclarés;
- plusieurs straps dans une meme regle gardent chacun leur provenance et leur
  track dediee;
- le `RuntimePlayer` reconcilie les snapshots d'etat depuis le journal apres
  seek et avant un nouveau dispatch.

## Limites V2

- definir les cas de loop bornes compatibles avec `f(t)`;
- ne jamais creer de track pendant la lecture.

## V3

- définir le protocole d'invalidation et de génération obsolète des résultats de
  straps asynchrones;
