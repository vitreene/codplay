# List spec V1 - contrat du composant list

## Statut

Spec normative V1 pour le composant `list` dans Codplay.

## Objectif

Figer le role du composant `list` comme hebergeur ordonne d'elements runtime, et clarifier l'usage de la notion de `part` dans son cas.

## Nature du composant

- `list` est un composant conteneur
- `list` heberge des elements runtime qui lui sont rattaches apres sa creation
- ces elements heberges sont inconnus au moment de la creation initiale du `list`

## Usage de `part` dans `list`

Dans le cas de `list`, le terme `part` ne designe pas un sous-noeud declaratif d'un template.

Dans le cas de `list`, un `part` designe un element heberge par le conteneur et gere dans son ordre local.

Consequences:

- un `part` de `list` n'est pas declare dans un markup initial
- un `part` de `list` apparait au fil des rattachements runtime
- un `part` de `list` est manipule par des operations de conteneur

## Lien avec les persos

- les `parts` de `list` correspondent a des persos runtime heberges
- un `part` est donc rattache a un `persoId`
- `list` maintient un ordre logique stable de ces `persoId`

## Operations minimales attendues

Le composant `list` doit fournir au runtime les operations locales necessaires pour gerer ses elements heberges:

- attacher un enfant
- detacher un enfant
- repositionner un enfant
- lire l'ordre courant des enfants

Ces operations sont locales au composant `list`.

## Ordre

- `list` maintient un ordre runtime de ses enfants heberges
- cet ordre est distinct de la declaration initiale de la scene
- cet ordre peut etre affecte par les operations de move et de reorder

## Portee V1

- cette spec ne fait pas de `part` une notion commune a tous les composants
- cette spec fige seulement l'interpretation de `part` pour `list`
- l'orchestration globale de `move` reste hors du perimetre de cette spec

## References

- `formalisation/v1-perso-spec.md`
- `formalisation/v1-layout-spec.md`
- `formalisation/v1-move-separation-policy-state-backend-dom.md`
