# Plan — drag-and-drop positionné pour le composant `list` (clos)

## Statut

Chantier terminé (2026-07-23). Le contrat normatif final vit désormais dans
`docs/formalisation/v1-list-dnd-spec.md` — ce document n'est conservé que
comme trace historique de la conception, pas comme référence à jour.

## Objectif d'origine

Permettre à un item d'un composant `list` d'être déposé à un index précis
(entre deux autres items, pas seulement en fin de liste), via une capture
pointeur ordinaire, sans exposer de géométrie ni de node runtime à
l'auteur de scène.

## Correction architecturale postérieure à la première implémentation

La première implémentation (module `list-dnd`, action `listDnd` dédiée,
event `list-dnd:dropped`) faisait elle-même tout le travail du commit
(détachement, attachement, animation FLIP maison). Un chantier de suite
(2026-07-23) a corrigé plusieurs bugs de cette animation maison
(mesures corrompues pendant une transition en cours, origine bidon au
replay de seek) avant de constater que cette logique dupliquait ce que le
module `move`/le moteur `list-flip` faisaient déjà correctement,
rotation/ancêtres/seek compris.

Correction retenue : le commit d'un drop est désormais une action `move`
ordinaire (`flipMode: 'overlay-world'`), résolue dynamiquement dans
`captureState.move` par `capture-runtime.ts` au relâchement (`onEnd`), et
entièrement prise en charge par `moveModule`/`list-flip` — plus aucune
logique d'attachement/détachement/animation propre au dnd. Le module
`list-dnd` ne garde que la préview live (hit-test + ghost) et un nettoyage
post-drop (`finalizeDrop`).

Point encore ouvert, hors périmètre de ce chantier : intégrer le ghost/la
préview live au moteur `list-flip` de la même façon (bloqué par l'absence
d'un canal pour appliquer des `TransitionRequest[]` hors du cycle
`routeUpdates` — voir la mémoire de session correspondante).

## Référence

Le détail normatif (guard/`dropIn`, `ghost`, canal preview, résolution du
commit) est dans `docs/formalisation/v1-list-dnd-spec.md`. Ne pas se fier
au reste de ce document pour l'implémentation actuelle : les sections qui
suivaient ici décrivaient l'architecture `listDnd`/`commit()` désormais
retirée.
