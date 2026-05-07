# Component system V1 - draft de cadrage

## Statut

Document de travail en mode etude active.

Reference normative associee:

- `16-base-component-v1.md`
- `26-player-orchestration-v1.md`

## Intention

Definir un contrat composant generique minimal, stable, et reutilisable.

Objectif produit:

- garder un Player mince
- concentrer la logique metier dans les composants
- permettre des composants simples (image, texte) et complexes (list)

Objectif de livraison:

- construire une premiere scene avec 3 composants de base:
  - image
  - text
  - list

## Perimetre V1

Ce document couvre:

- le contrat composant generique
- les responsabilites Player vs composant
- le contrat d'enregistrement des composants
- le contrat update runtime

Ce document ne couvre pas encore:

- le detail metier complet de List
- les variantes non-DOM detaillees
- la totalite du pipeline animation final

## Invariants globaux

- 1 Player par scene
- 1 instance composant par Perso
- `Perso.type` designe un composant unique
- composants enregistres avant `load(scene)`
- pas de chargement dynamique en runtime
- runtime permissif: action invalide ignoree, warning auteur
- dedoublonnage warning par `eventSeq` et code

## Contrat composant generique

## Cycle de vie

Un composant expose 4 points d'entree:

- `constructor(input)`
- `init(initial)` (une seule fois)
- `render()` (une seule fois)
- `update({ persoId, eventId, eventSeq, action })`

Regles:

- `update` recoit une action agregee, deja ordonnee et dedoublonnee
- `update` ne doit pas re-trier ni resoudre les conflits inter-actions
- `update` traite la logique metier du composant

## Interface TypeScript cible

```ts
type ComponentWarning = {
  code: string
  message: string
  details?: Record<string, unknown>
}

type ComponentWarningReporter = (warning: ComponentWarning) => void

type ComponentUpdateInput = {
  persoId: string
  eventId: string
  eventSeq: number
  action: Record<string, unknown>
}

type ComponentClassInput = {
  persoId: string
  persoType: string
  config?: Record<string, unknown>
  adapter: unknown
  warn: ComponentWarningReporter
}

type RuntimeComponent = {
  init: (initial: Record<string, unknown>) => void
  render: () => unknown
  update: (input: ComponentUpdateInput) => void
}

type ComponentClass = new (input: ComponentClassInput) => RuntimeComponent
```

## Responsabilites

## Cote Player

- maintenir le registre `persoType -> ComponentClass`
- instancier les composants au `load(scene)`
- router les updates vers la bonne instance
- fournir `eventId`, `eventSeq`, action agregee
- capturer les erreurs composant (catch)
- publier les warnings auteur

## Cote composant

- conserver son etat interne
- construire son rendu dans `init`
- retourner son root dans `render`
- appliquer les actions metier dans `update`
- ignorer les actions non applicables et reporter warning

## Enregistrement des composants

API host cote Player:

- `registerComponent(persoType, componentClass)`
- `overrideComponent(persoType, componentClass)`

Regles:

- appels autorises uniquement avant `load(scene)`
- `registerComponent` sur type deja present => warning + ignore
- `overrideComponent` remplace explicitement le composant cible

## Adaptation de rendu

Le composant depend d'un contexte de rendu via `adapter`.

Regle V1:

- le Player ne doit pas embarquer de logique DOM metier
- le composant utilise l'adapter correspondant a son contexte

Exemples d'adapters de reference:

- `video-component-example.ts` (fragment DOM + sous-couches)
- `list-component-example.ts` (modele enfant->parent via `move.parentId`, bridge FLIP)

## Gestion d'erreur et warning

Regle runtime:

- aucune erreur composant ne doit casser le runtime global
- le Player catch, convertit en warning trace auteur

Regle auteur:

- warnings dedoublonnes par `{eventSeq, code}`
- action invalide non bloquante

## Conventions structurelles

- les composants complexes peuvent utiliser la composition interne (layers)
- les patches de base (`style`, `className`, `attr`) peuvent etre traites via une couche utilitaire reutilisable
- les commandes metier (ex `move`, `media`) restent dans les couches metier

## Jalons suivants (ordre valide)

1. Definir le composant `image` (minimal, sans complexite structurelle)
2. Definir le composant `text` (minimal + patches base)
3. Definir le composant `list` (move, transfer, FLIP)

Avec ces trois composants, on couvre la premiere scene cible V1.

## Artifacts examples

- `evolution/formalisation-modele/examples/video-component-example.ts`
- `evolution/formalisation-modele/examples/list-component-example.ts`
