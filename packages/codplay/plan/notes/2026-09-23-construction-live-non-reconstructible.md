# Construction CodPlay live non reconstructible — cadrage exploratoire

> Statut : étude séparée — aucune API, option de scène ou modification du core
> n'est décidée par ce document.
>
> Date : 2026-09-23

## Rôle

Cette étude concerne une **option de construction centrale du player CodPlay** :
un player peut-il exécuter des events live sans les inscrire dans son journal,
et ne pas proposer de reconstruction historique de ces events ?

Ce n'est pas une option propre au scroll, à `IntersectionObserver`, ni à un
composant particulier. Ces sources pourront éventuellement utiliser cette
construction, mais elles ne la définissent pas.

## État actuel

Le chemin V2 existant est unique :

```text
source -> RuntimePlayer.emit() -> RuntimeTrackJournal
       -> listen -> straps -> events/actions -> présentation
       -> Seek reconstruit depuis le journal
```

`persist-only` ne déroge pas à cette règle. Il conserve l'event dans le journal
et empêche uniquement son application à la présentation au moment de son
insertion live ; un Seek le relit normalement.

La construction étudiée introduirait une autre politique, centrale et explicite :

```text
source -> dispatch live central -> effets live autorisés
       -> aucun append dans RuntimeTrackJournal
       -> aucune reconstruction historique de ces effets
```

Elle ne peut pas être réalisée en laissant une source appeler directement un
strap ou un composant : cela contournerait l'ordre, les diagnostics, les
validations et les frontières de cycle de vie du player.

## Questions de contrat

1. Quelle construction choisit-on à la création du player et quelle façade la
   rend lisible, sans la confondre avec une propriété locale de `SceneDoc` ?
2. Quels consumers live sont autorisés : présentation seulement, `listen`,
   straps, mises à jour d'état, events dérivés ?
3. Si un event dérivé est persistant, comment la frontière entre le flux live et
   le journal est-elle déclarée et ordonnée ?
4. Quelle est la règle de `seek()` : refus total, seek limité aux eventimes
   déclarés avant lecture, ou autre construction de timeline ?
5. Quels états sont détruits, conservés ou resynchronisés au pause, reset,
   reparentage, resize et destroy ?
6. Quelles garanties restent communes aux deux constructions : validation des
   sources, ordre des emissions multiples, diagnostics, isolation et sécurité
   des surfaces runtime ?

## Relation avec le scroll-driven

Le scroll-driven reste un consommateur possible, non le motif architectural :

- dans la construction actuelle, une condition géométrique peut émettre un
  event journalisé ; `scrollend` peut enregistrer une position via
  `persist-only` ;
- dans la construction étudiée, une progression `g` et ses conditions peuvent
  rester entièrement live, mais leur comportement de Seek dépendra du contrat
  central adopté ici.

L'étude scroll-driven conserve donc le chemin V2 actuel et ne spécifie pas
cette construction.

## Références lues

- `packages/codplay/plan/player-engine-plan.md` ;
- `packages/codplay/plan/facade-engine-instance-plan.md` ;
- `packages/codplay/src/runtime/player/runtime-player/event-controller.ts` ;
- `packages/codplay/src/runtime/player/pipeline/runtime-event-dispatcher.ts` ;
- `packages/codplay/src/runtime/player/pipeline/track-journal.ts` ;
- `packages/codplay/src/runtime/config/event-insertion.ts` ;
- `docs/formalisation/v1-seek-spec.md`.
