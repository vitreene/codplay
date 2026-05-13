# Error catalog V1 - base code/message

## Statut

Catalogue minimal V1 des erreurs et warnings.

## Objectif

Fournir une base `code + message` simple et stable, a completer en conditions reelles.

## Principe

- V1 reste volontairement sommaire
- pas de sur-anticipation des cas
- enrichissement progressif selon incidents observes

## Format

```ts
type RuntimeError = {
  code: string
  message: string
  details?: {
    refs?: {
      sceneId?: string
      storyId?: string
      persoId?: string
      trackId?: string
      eventId?: string
      eventSeq?: number
      commitSeq?: number
    }
    context?: Record<string, unknown>
  }
}

type RuntimeWarning = {
  code: string
  message: string
  details?: {
    refs?: {
      sceneId?: string
      storyId?: string
      persoId?: string
      trackId?: string
      eventId?: string
      eventSeq?: number
      commitSeq?: number
    }
    context?: Record<string, unknown>
  }
}
```

Regles V1:

- `details` doit renseigner les references disponibles (`refs`) quand elles existent.
- `message` reste court et neutre.

## Espaces de codes

- `AUTHOR_*`: probleme de structure auteur/compilation
- `RUNTIME_*`: probleme detecte en execution
- `HOST_*`: probleme d'appel facade publique

## Base initiale V1

Erreurs:

- `AUTHOR_DUPLICATE_LISTEN_ON`: doublon `listen.on` dans une meme story/scene
- `AUTHOR_ROOT_STORIES_INVALID`: `rootStories` manquant, vide ou invalide en diffusion
- `AUTHOR_STORY_ENTRIES_INVALID`: `entries` absentes ou invalides dans une `Story`
- `AUTHOR_TRACK_UNKNOWN`: track referencee inconnue
- `AUTHOR_ELEMENT_ID_IMMUTABLE`: tentative de modification d'`id` apres creation
- `RUNTIME_HELPER_INVALID_ARG`: argument helper invalide
- `HOST_INVALID_PLAYER_STATE`: commande Player invalide dans l'etat courant

Warnings:

- `RUNTIME_ELEMENT_ID_COLLISION`: collision d'`id` d'elements detectee a `scene.init`
- `RUNTIME_STRAP_CONTINUE_WARNING`: erreur strap, chaine continue
- `RUNTIME_SAME_TICK_REPETITION`: repetitions meme tick preservees (mode keep-all)
- `RUNTIME_EVENT_LIMIT_REACHED`: limite runtime atteinte si policy activee
- `RUNTIME_CASCADE_DEPTH_REACHED`: profondeur de cascade limite atteinte, propagation tronquee

Fallback unique:

- `RUNTIME_UNKNOWN`: erreur runtime non catalogee
- `details` est obligatoire pour ce fallback (references + contexte d'enquete)

## Notes

- les messages restent generiques en V1.
- les details evoluent selon besoins terrain et campagne de tests.
- en pratique, ces erreurs/warnings peuvent etre exposes via `console.error` / `console.warn` et/ou objets de retour d'appel.
- invariants transverses associes: `v1-invariants.md`.
