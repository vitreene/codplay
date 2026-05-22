# Seek spec V1 - relecture, horizons et policies

## Statut

Spec normative V1 pour le comportement de `seek` dans Codplay.

## Objectif

Figer de facon exhaustive comment le runtime:

- borne une demande de seek
- selectionne les events replayables deja materialises dans les tracks
- reconstruit l'etat et le rendu sans rejouer les straps
- applique les regles de master, de segment et de mode auteur

## Perimetre

- `seek` ne declenche jamais `init`
- `seek` ne rejoue jamais les straps
- `seek` ne rejoue jamais les `effects`
- `seek` ne joue pas `sequence:end` comme un event normal
- `seek` ne depend pas d'une couche runtime intermediaire

## Etat d'execution

- `seek` n'est accepté que lorsque le runtime est initialise et en `ready`, `paused` ou `playing`.
- si le player est en `playing`, le flux de lecture courant est suspendu avant la relecture.
- apres un seek reussi, le player reste en `paused` jusqu'a un `play` explicite.
- le curseur courant du player est positionne sur la cible bornee par la policy et, si besoin, par le segment.

## Contrat canonique

```ts
type SeekPolicy =
  | 'disabled'
  | 'played-only'
  | 'master-projected'
  | 'author-unrestricted'

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

- borne maximale effectivement atteinte par des events deja lus et appliques pendant la lecture courante.
- `playedEndMs` est monotone jusqu'a `rewind`, `restart` ou rechargement complet du runtime.

2. `projectedMasterEndMs`

- borne future garantie par les tracks `role: "master"`.
- inclut les events deja materialises sur ces tracks, meme s'ils n'ont pas encore ete traverses en lecture.
- inclut les media `master` et leur duree effective.
- ignore les tracks decoratives et les futures occurrences non master.

3. `authorEndMs`

- borne future totale connue en mode auteur.
- peut inclure toutes les occurrences deterministes deja materialisees dans les tracks, meme decoratives.

4. `progressEndMs`

- borne utilisee pour afficher la progression visible a l'utilisateur.
- en diffusion, elle ne doit pas etre polluee par les tracks d'accompagnement.
- en V1, elle suit la projection master quand elle existe, avec fallback legacy sinon.

5. `seekEndMs`

- borne effectivement autorisee pour le seek selon la policy active.
- `seekEndMs` n'est pas necessairement egal a `progressEndMs`.

6. `segment`

- borne optionnelle d'une lecture limitee a un fragment de sequence.
- `segment.startMs` et `segment.endMs` definissent une fenetre de lecture coherente pour `play` et `seek` quand ce mode est active.
- le segment sert d'abord a l'edition auteur; il peut aussi devenir une borne effective par configuration.

## Policies de seek

### `disabled`

- le seek est interdit.

### `played-only`

- le seek ne peut pas depasser `playedEndMs`.

### `master-projected`

- le seek peut aller jusqu'a `max(playedEndMs, projectedMasterEndMs)`.

### `author-unrestricted`

- le seek peut aller jusqu'a `authorEndMs`.

## Regles normatives

1. Source de verite

- le seek lit uniquement les events deja materialises dans les tracks.
- le seek ne reexecute pas les straps pour reconstruire le passe.
- le seek ne reexecute pas les `effects`.
- le seek reconstruit l'etat visible par application du flux de tracks deja enregistre.

2. Role du master

- une track non master peut nourrir `playedEndMs` si ses events ont deja ete lus.
- une track non master ne doit pas etendre `projectedMasterEndMs`.
- une track `role: "master"` peut faire avancer `projectedMasterEndMs` et donc la borne de seek en mode `master-projected`.
- si aucune track `role: "master"` n'est declaree, le runtime peut conserver un fallback legacy pour `progressEndMs`, sans changer la regle de policy du seek.

3. Reconstruction

- le runtime repart du debut des tracks concernes.
- il collecte les events actifs dont `ms <= targetTimelineMs`.
- il applique les events dans un ordre deterministe base sur l'ordre des tracks et l'ordre stable des events.
- les mutations d'etat deja materialisees sont rejouees comme donnees, pas comme code.

4. `sequence:end`

- `sequence:end` est terminal en `play`.
- en `seek`, si la borne `sequence:end` est franchie, l'event n'est pas joue.
- en `seek`, `sequence:end` borne seulement la projection du replay.
- le cleanup terminal associe a `sequence:end` ne doit pas etre execute pendant un seek.

5. `state`

- `story.state` reste la surface auteur.
- le runtime recoit et relit l'etat depuis les tracks deja materialises.
- les `update` et les donnees associees aux events sont rejouees pour reconstruire l'etat visible a l'instant `T`.

6. Segment

- le segment est une fenetre de lecture et d'edition auteur.
- si la configuration active le segment comme borne, le seek est clamped dans cette fenetre.
- le segment ne cree pas de moteur de replay distinct.

## Selection des events a rejouer

Le seek selectionne uniquement des entries deja presentes dans les tracks:

1. verifier la policy active et calculer `seekEndMs`
2. borner la cible demandee par `seekEndMs`
3. si un segment actif est configure comme borne, borner aussi par le segment
4. remettre les curseurs de tracks au debut
5. parcourir toutes les tracks actives
6. garder les events dont `ms <= cible`
7. les trier selon l'ordre de track puis l'ordre stable d'insertion
8. appliquer les donnees et mutations dans l'ordre
9. arreter la projection avant `sequence:end` sans declencher sa logique terminale
10. positionner le curseur courant sur la cible bornee (ou sur le dernier instant replayable avant `sequence:end`)

## Mode auteur et segment

- le mode auteur est configurable et peut etre aligne sur le mode diffusion pour tester une scene dans des conditions identiques.
- lorsque le mode auteur est aligne sur la diffusion, il respecte les memes bornes de seek, de progress et de segment que la policy active.
- en mode auteur, `authorEndMs` peut ouvrir plus large que `projectedMasterEndMs`.
- le mode segment est le mode auteur privilegie pour tester des `effects` localises en jouant une fenetre de sequence.
- quand un seek reste dans la fenetre de segment, le runtime peut reutiliser l'etat de depart du segment au lieu de le recalculer integralement a chaque fois.
- le seek reste un replay de tracks, pas un re-execution de straps, meme en mode auteur.

## Notes d'implementation

- la forme interne des tracks peut utiliser une `Map` indexee par `ms` si cela aide les performances.
- cette spec contraint le comportement, pas la structure memoire exacte.
- la progression visible peut etre recalculée quand de nouveaux events master arrivent; l'UI de seek peut verrouiller temporairement son echelle pendant une interaction utilisateur pour eviter des sauts visuels.

## Exemple s4

- le compteur peut avancer `playedEndMs` au fur et a mesure de la lecture.
- si le compteur n'est pas sur une track `master`, il ne doit pas faire avancer `projectedMasterEndMs`.
- en mode auteur, il peut quand meme faire avancer `authorEndMs` si ses events sont materialises dans les tracks.
