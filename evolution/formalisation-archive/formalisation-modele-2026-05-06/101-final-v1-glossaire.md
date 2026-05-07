# Final V1 - glossaire

## Statut

Glossaire final V1 de la terminologie normative.

## Termes principaux

- `Scene`: racine globale d'orchestration
- `Story`: unite d'orchestration locale
- `Perso`: unite de rendu/action locale
- `Strap`: fonction stateless asynchrone qui produit ou planifie des events
- `Track`: unite minimale de timeline pilotable
- `CompiledScene`: artefact de diffusion immuable

## Terminologie event

- terme normatif: `event runtime`
- terme historique: `event public`
- regle de lecture: les deux termes designent la meme realite en V1

## Pipeline `listen`

- ordre normatif: `listen -> transform -> straps -> emit -> persos`
- `transform` et `straps` consomment la meme entree runtime
- `transform` renvoie uniquement de la data
- `straps` renvoient des events (immediats) ou en planifient (helpers runtime)

## Propagation

- bubbling enfant -> parent automatique
- `cascade: true` force la remontee jusqu'a `Scene` sans interception intermediaire
- aucun adressage nominatif direct d'une story cible

## Meta et ressources

- meta `CompiledScene`: `schemaVersion` + `createdAt`
- `hash` reste reserve a la policy de ressources preload
