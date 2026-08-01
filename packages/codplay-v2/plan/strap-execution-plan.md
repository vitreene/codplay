# CodPlay V2 - execution des straps

## Statut

> Status: En cours
> CodPlay version: V2 foundation
> Review: required before journal integration

## Contrat actuel

`executeStrapsSequentially` execute une collection de fonctions stateless dans
l'ordre de declaration. Chaque fonction peut etre synchrone ou asynchrone. Les
erreurs et noms absents deviennent des issues; ils n'interrompent pas la chaine.

Le flattening recursif collecte :

- les events immediats;
- les updates immediates;
- les occurrences planifiees avec `offsetMs`;
- les warnings auteur.

Cette sortie reste d'abord en memoire et n'est pas appendee implicitement par
l'execution du strap. La demo de validation l'append explicitement pour montrer le
flux, sans en faire encore une orchestration runtime generale.

Les sorties `events` et les occurrences planifiees qui portent un event peuvent
maintenant etre appendees par `RuntimeTrackJournal.appendStrapOutput` sur la track
dediee deja declaree. Les `update` restent explicitement non materialises et leur
nombre est retourne au caller.

Les helpers finis `context.planned` V2 sont `wait`, `delay`, `repeat`, `stagger` et
`sequence`. Ils produisent uniquement des occurrences declaratives et ne lancent
aucun scheduler.

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

## A faire

- definir la materialisation des `update` sans muter implicitement l'etat;
- definir les cas de loop bornes compatibles avec `f(t)`;
- definir le protocole d'annulation et de generation obsolete;
- ne jamais creer de track pendant la lecture.
