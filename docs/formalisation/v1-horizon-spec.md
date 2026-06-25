# Horizon spec V1 - bornes de lecture, progress et seek

## Statut

Spec normative V1 pour la notion `horizon` exposee par le runtime de lecture.

La logique complete de `seek` est decrite dans `v1-seek-spec.md`.

## Objectif

Separer clairement les bornes proches mais non equivalentes qui pilotent:

- la progression visible
- la projection future autorisee
- le seek selon le mode d'usage
- la lecture d'un segment

## Contrat canonique

```ts
type HorizonSnapshot = {
  playedEndMs: number
  projectedMasterEndMs: number
  authorEndMs: number
  progressEndMs: number
  seekEndMs: number
  segment?: {
    startMs: number
    endMs: number
  }
}
```

## Definitions

1. `playedEndMs`

- borne maximale effectivement deja lue pendant la lecture courante.
- `playedEndMs` est monotone jusqu'a `rewind` ou relance a zero.
- `playedEndMs` suit la **position de lecture courante**, pas seulement la position des events deja lus. A chaque tick de lecture, `playedEndMs = max(playedEndMs, timelineMs courant)`.
- Justification (2026-06-25) : une animation pilotee par `currentTime` (action-tween : un `fn` evalue a chaque frame sur une `duration`, sans event par tick) fait progresser la lecture sans materialiser d'event intermediaire. Si `playedEndMs` n'etait nourri que par les events, il resterait fige au dernier event et la portion deja lue de l'animation deviendrait inatteignable au seek arriere. La position « deja lue » est donc la position temporelle reellement parcourue par la tete de lecture, events ou non.
- corollaire : une track sans event sur l'intervalle (animation currentTime) nourrit quand meme `playedEndMs` via l'avancee du tick.

2. `projectedMasterEndMs`

- borne future garantie par les tracks `role: "master"`.
- inclut les events statiques de ces tracks.
- inclut les media `master` et leur duree effective (`startAt` / `endAt` si segment).
- ignore les tracks decoratives et les futures occurrences non master.

3. `authorEndMs`

- borne future totale connue en mode auteur.
- peut inclure les events finis generes par straps meme s'ils sont decoratifs.

4. `progressEndMs`

- borne utilisee pour afficher la progression utilisateur.
- en diffusion, `progressEndMs` ne doit pas etre pollue par les tracks d'accompagnement.
- en pratique V1, `progressEndMs` suit les tracks `role: "master"` quand elles existent.

5. `seekEndMs`

- borne effectivement autorisee pour le seek selon la policy active.
- `seekEndMs` n'est pas necessairement egal a `progressEndMs`.

6. `segment`

- borne optionnelle d'une lecture limitee a un fragment de sequence.
- `segment.startMs` et `segment.endMs` s'appliquent a `play` et `seek` quand ce mode est actif.
- la lecture segmentee est particulierement utile en mode auteur pour tester des `effects` localises.

## Policies de seek

```ts
type SeekPolicy =
  | "disabled"
  | "played-only"
  | "master-projected"
  | "author-unrestricted"
```

### `disabled`

- le seek est interdit.

### `played-only`

- le seek est borne a `playedEndMs`.

### `master-projected`

- le seek est borne a `max(playedEndMs, projectedMasterEndMs)`.

### `author-unrestricted`

- le seek est borne a `authorEndMs`.

## Regles normatives

- `progressEndMs` et `seekEndMs` sont distincts conceptuellement.
- une track non master peut nourrir `playedEndMs` si ses events ont deja ete lus.
- une track non master ne doit pas etendre `projectedMasterEndMs`.
- si aucune track `role: "master"` n'est declaree, le runtime peut utiliser un fallback legacy pour `progressEndMs`.
- `seek` doit toujours montrer l'etat exact deja vu pour le passe, et respecter la policy active pour le futur.
- corollaire normatif : `seekEndMs >= playedEndMs` **toujours** (sauf policy `disabled`). Le passe deja lu reste integralement atteignable au seek quelle que soit la policy ; la policy ne borne que le **futur au-dela de `playedEndMs`**. Concretement `seekEndMs = max(playedEndMs, borne-future-de-la-policy)`.
- `seek` ne rejoue jamais les `effects`.

## Exemple s4

- le compteur peut nourrir `playedEndMs` au fur et a mesure.
- le compteur n'etend pas `projectedMasterEndMs` s'il n'est pas sur une track `role: "master"`.
- en mode auteur, il peut tout de meme nourrir `authorEndMs`.
