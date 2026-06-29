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
- `AUTHOR_TRACK_UNKNOWN`: track referencee inconnue
- `AUTHOR_ELEMENT_ID_IMMUTABLE`: tentative de modification d'`id` apres creation
- `RUNTIME_HELPER_INVALID_ARG`: argument helper invalide
- `HOST_INVALID_PLAYER_STATE`: commande Player invalide dans l'etat courant

Warnings:

- `RUNTIME_ELEMENT_ID_COLLISION`: collision d'`id` d'elements detectee a `scene.init`
- `AUTHOR_LAYOUT_FORMAT_INVALID`: `layout.initial.format` invalide, fallback applique
- `AUTHOR_LAYOUT_MARKUP_INVALID`: `layout.initial.markup` invalide ou vide
- `AUTHOR_LAYOUT_OUTLET_INVALID`: declaration d'`outlet` invalide
- `AUTHOR_LAYOUT_OUTLET_DUPLICATE`: doublon d'`outlet.id` dans un meme `layout`
- `AUTHOR_LAYOUT_OUTLET_NOT_FOUND`: `outlet.id` absent du `markup`
- `AUTHOR_LAYOUT_OUTLET_ID_COLLISION`: collision entre `outlet.id` et un identifiant runtime existant
- `AUTHOR_LAYOUT_OUTLET_CHILD_INCOMPATIBLE`: insertion refusee pour incompatibilite `html` / `svg`
- `RUNTIME_TRACK_UNKNOWN_IGNORED`: track inconnu reference par un event de controle runtime, ignore avec warning
- `RUNTIME_STRAP_CONTINUE_WARNING`: erreur strap, chaine continue
- `RUNTIME_SAME_TICK_REPETITION`: repetitions meme tick preservees (mode keep-all)
- `RUNTIME_EVENT_LIMIT_REACHED`: limite runtime atteinte si policy activee
- `RUNTIME_CASCADE_DEPTH_REACHED`: profondeur de cascade limite atteinte, propagation tronquee
- `AUTHOR_STORY_DISABLED_REFERENCE`: `move.parentId` (story ou perso) referencant un perso d'une story `disabled`, compile quand meme
- `AUTHOR_STORY_MOVE_MISSING`: story sans `initial.move` resolu, signale uniquement en mode auteur

Fallback unique:

- `RUNTIME_UNKNOWN`: erreur runtime non catalogee
- `details` est obligatoire pour ce fallback (references + contexte d'enquete)

## Notes

- les messages restent generiques en V1.
- les details evoluent selon besoins terrain et campagne de tests.
- en pratique, ces erreurs/warnings peuvent etre exposes via `console.error` / `console.warn` et/ou objets de retour d'appel.
- invariants transverses associes: `v1-invariants.md`.
