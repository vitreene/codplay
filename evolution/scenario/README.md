# Orchestration de scenario (notes)

Ce dossier contient un modele simple d'orchestration de scene pilote par:

- un flux narratif predefini (scenario)
- des actions utilisateur (click, reponse, inactivite)

## Intention

Espace de reflexion en priorite:

- pseudo-code avant code de production
- discussion d'architecture avant implementation detaillee
- legacy comme reference de pensee (pas de reprise directe)

## Fichiers

- `types.ts`: modele partage (sequence, transition, contexte, events)
- `guards.ts`: conditions de transition reutilisables
- `reducers.ts`: mise a jour du contexte apres chaque event
- `graph.ts`: exemple de graphe scenario
- `orchestrator.ts`: moteur runtime qui choisit la sequence suivante
- `adapter-legacy.ts`: pont de reference vers legacy
- `example.ts`: exemple de pseudo-usage (non production)

## Idee centrale

Chaque sequence expose des transitions. A chaque event, l'orchestrateur:

1. met a jour le contexte
2. evalue les transitions par priorite
3. bascule vers la premiere cible valide

Ce principe conserve un flux deterministe tout en reagissant a l'utilisateur.
