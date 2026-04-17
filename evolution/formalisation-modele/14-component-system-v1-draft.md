# Component system V1 - draft de travail

## Statut

Document de travail en mode etude.

## Orientation

- 1 Player par scene
- 1 instance composant par `Perso`
- `Perso.type` selectionne une classe composant unique
- registre composants prepare avant `load(scene)`
- pas de chargement dynamique en runtime

## Contrat minimal composant (draft)

- `constructor(input)`
- `init(initial)` (une fois)
- `render()` (une fois)
- `update({ persoId, eventId, eventSeq, action })`

Regles:

- `update` recoit une action agregée unique (deja ordonnee/dedoublonnee)
- comportement permissif: operation non applicable ignoree, warning en mode `author`
- erreurs composant capturees par le Player (pas de throw bloquant runtime)

## Extension composant par composition

Le composant peut embarquer des sous-couches metier (ex: `move layer`) et une couche patch de base (`style/className/attr`) pour garder:

- un Player minimal
- une logique metier complete dans le composant
- une implementation independante du framework

## Exemple fictif - composant video

Objectif:

- un fragment DOM unique (surface video + controles)
- une seule interface `update`
- routage vers sous-couches internes (`media`, `controls`, `basePatch`)

Exemple code place dans:

- `evolution/formalisation-modele/examples/video-component-example.ts`
- `evolution/formalisation-modele/examples/list-component-example.ts`

Metadonnees de l'exemple (dans le fichier TS):

- `id: video-component-example`
- `version: 0.1.0`
- `status: draft`
- `updatedAt: 2026-04-17`

## Notes ouvertes

- fixer le contrat exact de l'adapter de rendu (DOM / non-DOM)
- definir la politique warnings (dedoublonnage par `eventSeq`)
- formaliser la declaration statique des proprietes exclusives composant
