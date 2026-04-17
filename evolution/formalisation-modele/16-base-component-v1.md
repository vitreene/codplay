# Base component V1

## Statut

Reference V1 pour le contrat generique commun a tous les composants runtime.

## Preambule - intention

Le systeme composants doit rester simple au niveau Player et expressif au niveau composant.

Le contrat de base vise a:

- garantir un cycle de vie unique et previsible
- stabiliser le transport des actions runtime
- permettre des composants tres simples (`image`, `text`) et tres complexes (`list`)
- rester independant d'un framework UI

## Portee

Ce document couvre le socle commun:

- cycle de vie composant
- enregistrement/override cote Player
- format des entrees runtime (`constructor`, `init`, `render`, `update`)
- policy d'erreur/warning permissive
- separations de responsabilites Player/composant

## Hors perimetre V1

- details metier d'un composant particulier (`image`, `text`, `list`)
- pipeline animation detaille
- specification fine des handlers d'events auteur

## Invariants systeme

- 1 Player par scene
- 1 instance composant par `Perso`
- `Perso.type` mappe un composant unique
- composants enregistres avant `load(scene)`
- aucun chargement dynamique de nouveau composant pendant le runtime
- runtime permissif: action non applicable ignoree, warning auteur

## Contrat TypeScript canonique

```ts
type ComponentWarning = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
};

type ComponentWarningReporter = (warning: ComponentWarning) => void;

type ComponentUpdateInput = {
  persoId: string;
  eventId: string;
  eventSeq: number;
  action: Record<string, unknown>;
};

type ComponentClassInput = {
  persoId: string;
  persoType: string;
  config?: Record<string, unknown>;
  adapter: unknown;
  warn: ComponentWarningReporter;
};

type RuntimeComponent = {
  init: (initial: Record<string, unknown>) => void;
  render: () => unknown;
  update: (input: ComponentUpdateInput) => void;
};

type ComponentClass = new (input: ComponentClassInput) => RuntimeComponent;
```

## Cycle de vie

### constructor(input)

- initialise les dependances et l'etat local du composant
- ne depend pas d'une logique Player specifique metier

### init(initial)

- appelee une seule fois par instance
- initialise le rendu du composant depuis `perso.initial`

### render()

- appelee une seule fois apres `init`
- retourne le root de rendu de l'instance

### update(input)

- point d'entree runtime recurrent
- recoit une action unique deja agregee et resolue
- traite la logique metier du composant

Note V1:

- pas de methode `destroy` dans le contrat de base

## Contrat update

Garanties de l'entree `update`:

- `action` deja ordonnee
- conflits deja resolus (last-write-wins si applicable)
- `eventId` et `eventSeq` fournis pour trace/dedoublonnage

Regles:

- le composant n'emet pas d'event interne pendant `update`
- le composant ignore ce qui n'est pas applicable
- le composant peut emettre un warning auteur

## Attachement interactions utilisateur

Regle V1:

- si `Perso.emit` est present, le composant attache les listeners utilisateur pendant `init`
- cet attachement est porte par un objet `handleEvent(event)` associe au node de rendu
- l'emission d'events publics suit le contrat defini dans `17-user-events-emit-v1.md`

## Enregistrement des composants

API cote Player:

- `registerComponent(persoType, componentClass)`
- `overrideComponent(persoType, componentClass)`

Regles:

- appels autorises avant `load(scene)` uniquement
- `registerComponent` sur type deja present: warning + ignore
- `overrideComponent` remplace explicitement le composant existant
- un seul composant actif par `persoType`

## Responsabilites

### Player

- maintient le registre de classes composants
- instancie 1 composant par `Perso` au chargement de scene
- route `update` vers l'instance cible
- capture les erreurs composant (catch)
- centralise warning/trace auteur

### Composant

- conserve son etat interne
- construit et expose son root de rendu
- applique ses commandes metier dans `update`
- encapsule sa complexite (layers internes autorises)

## Base patch commun

Les proprietes visuelles de base communes sont:

- `style`
- `className`
- `attr`

Regle V1:

- elles peuvent etre traitees via une couche composee reutilisable (`BasePatchLayer`)
- le composant reste responsable de leur application finale sur son rendu

## Insertion DOM commune (`move`)

Regle V1:

- `move` est un mecanisme commun a tous les composants pour designer leur parent runtime
- la relation est enfant -> parent (et non parent -> enfants)

Contrat recommande:

```ts
type MoveMode = 'auto' | 'first' | 'last' | 'append' | 'prepend' | number

type MoveCommand = {
  parentId: string
  mode: MoveMode
  flip?: boolean
  reorder?: boolean
}
```

Comportement:

- `move` valide => placement/replacement dans le parent cible
- cible invalide/non-list => composant detache + warning auteur

Usage:

- `initial.move` peut definir un parent de montage initial
- `actions.*.move` permet un replacement dynamique runtime

Etat de montage commun:

- `mounted`: node rattache a un parent runtime
- `detached`: node non monte dans l'arbre actif, conserve en memoire runtime pour reuse (ex: seek)

## Adaptation de rendu

Le composant depend d'un adapter adapte au support (DOM ou autre).

Regle V1:

- le Player reste indifferent au framework UI
- la logique de rendu est portee par le composant + son adapter

Convention DOM recommandee:

- privilegier un rendu par fragment/template de composant
- ne pas limiter le composant a un simple choix de `tag` racine
- permettre un root + sous-parts internes quand le composant en a besoin

## Erreurs et warnings

Regles:

- aucune erreur composant ne doit casser le runtime global
- les erreurs sont capturees et converties en warnings auteur
- warnings dedoublonnes par `{eventSeq, code}`

## Notes implementation

- les composants complexes peuvent distribuer `update` vers des sous-couches internes
- les composants simples peuvent rester mono-classe sans sous-couches
- la recherche de nodes runtime doit privilegier des references deja resolues (ids/runtime maps)

## Exemples de reference

- `evolution/formalisation-modele/examples/video-component-example.ts`
- `evolution/formalisation-modele/examples/list-component-example.ts`

## Suite immediate

Ordre de definition des composants V1:

1. `text`
2. `image`
3. `list`

Avec ces trois composants, la premiere scene V1 est constructible.

Etat documentaire courant:

- `19-text-component-v1.md` defini
- `22-image-component-v1.md` defini
- `23-list-component-v1.md` defini
