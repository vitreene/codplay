# Final V1 - validation minimale

## Statut

Checklist finale de validation avant diffusion V1.

## Validation bloquante

- doublon `listen.on` dans une meme `Story` ou `Scene` -> `AUTHOR_DUPLICATE_LISTEN_ON`
- reference `trackId` inconnue -> `AUTHOR_TRACK_UNKNOWN`
- tentative de modifier l'`id` d'un element apres creation -> `AUTHOR_ELEMENT_ID_IMMUTABLE`
- structure `CompiledScene` invalide (champs obligatoires manquants)

## Validation non bloquante

- collision d'`id` d'elements detectee a `scene.init` -> `RUNTIME_ELEMENT_ID_COLLISION`
- track inconnu reference par un event de controle runtime -> `RUNTIME_TRACK_UNKNOWN_IGNORED`
- erreur strap avec policy par defaut continue -> `RUNTIME_STRAP_CONTINUE_WARNING`
- collisions/repetitions same tick selon policy -> `RUNTIME_SAME_TICK_REPETITION`
- `move.parentId` (story ou perso) referencant un perso d'une story `disabled` -> `AUTHOR_STORY_DISABLED_REFERENCE`
- story sans `initial.move` resolu, en mode auteur -> `AUTHOR_STORY_MOVE_MISSING`

## Chaine de verification recommandee

1. valider schema `Scene` auteur
2. valider identites et structures (`tracks`, presence des `id` et `name` attendus)
3. valider regles `listen` (`on` unique, formes `transform/straps/emit`)
4. compiler `CompiledScene` (`schemaVersion`, `createdAt`, `tracks`, `rootNodeIds`)
5. executer `player.init(...)` pour verifier l'unicite effective des `id` d'elements et figer le registre runtime des tracks
6. executer un run de smoke runtime avec collecte erreurs/warnings

## Regle d'extension

- tout nouveau code d'erreur/warning V1 est ajoute dans `v1-error-catalog.md`
- cette checklist ne duplique pas les definitions detaillees des messages
