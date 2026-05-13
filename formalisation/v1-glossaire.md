# Final V1 - glossaire

## Statut

Glossaire final V1 de la terminologie normative.

## Termes principaux

- `Scene`: racine globale d'orchestration
- `rootStories`: stories autorisees a la racine de la scene
- `Story`: unite d'orchestration locale independante
- `entries`: persos d'entree explicites d'une story; peuvent etre multiples
- `Perso`: unite de rendu/action locale
- `name`: identite auteur lisible d'un element
- `id`: identifiant runtime canonique d'un element
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
- `transform` remplace `event.data`
- `straps` renvoient des events (immediats) ou en planifient (helpers runtime)

## Bootstrap et placement

- `init`: instanciation runtime initiale de la lecture
- `bootstrap scene`: phase avant diffusion visible, pilotee par la scene
- `mount`: operation technique de placement d'une story via ses `entries`
- `start`: depart logique d'une sequence/story par event; il fixe l'ancre temporelle

## Propagation

- portee locale story: event traite dans le perimetre de la story
- portee globale scene: publication scene-level via `cascade`
- aucun adressage nominatif direct d'une story cible

## Meta et ressources

- meta `CompiledScene`: `schemaVersion` + `createdAt`
- `hash` reste reserve a la policy de ressources preload

## Nommage d'events

- les noms d'events restent conventionnels en V1
- les prefixes recommandes aident la lisibilite mais ne sont jamais inscrits en dur comme mots-cles de spec
