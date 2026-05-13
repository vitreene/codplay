# Final V1 - validation minimale

## Statut

Checklist finale de validation avant diffusion V1.

## Validation bloquante

- doublon `listen.on` dans une meme `Story` ou `Scene` -> `AUTHOR_DUPLICATE_LISTEN_ON`
- `rootStories` absent/vide/invalide -> `AUTHOR_ROOT_STORIES_INVALID`
- reference `trackId` inconnue -> `AUTHOR_TRACK_UNKNOWN`
- `entries` absentes/incoherentes dans une `Story` -> `AUTHOR_STORY_ENTRIES_INVALID`
- tentative de modifier l'`id` d'un element apres creation -> `AUTHOR_ELEMENT_ID_IMMUTABLE`
- structure `CompiledScene` invalide (champs obligatoires manquants)

## Validation non bloquante

- collision d'`id` d'elements detectee a `scene.init` -> `RUNTIME_ELEMENT_ID_COLLISION`
- erreur strap avec policy par defaut continue -> `RUNTIME_STRAP_CONTINUE_WARNING`
- collisions/repetitions same tick selon policy -> `RUNTIME_SAME_TICK_REPETITION`

## Chaine de verification recommandee

1. valider schema `Scene` auteur
2. valider identites et structures (`rootStories`, `entries`, `tracks`, presence des `id` et `name` attendus)
3. valider regles `listen` (`on` unique, formes `transform/straps/emit`)
4. compiler `CompiledScene` (`schemaVersion`, `createdAt`, `tracks`, `rootStories`, `entries`)
5. executer `player.init(...)` pour verifier l'unicite effective des `id` d'elements dans le runtime
6. executer un run de smoke runtime avec collecte erreurs/warnings

## Regle d'extension

- tout nouveau code d'erreur/warning V1 est ajoute dans `v1-error-catalog.md`
- cette checklist ne duplique pas les definitions detaillees des messages
