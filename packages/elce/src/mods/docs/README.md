# Utiliser les mods Elcé

Elcé propose deux parcours d’édition et de lecture : Learning et Quiz Hunt.
Learning construit des expériences de lecture ; Quiz Hunt organise un jeu de
questions et de finales. Chaque document s’ouvre dans le parcours correspondant.

## Ouvrir ou créer un document

| Route | Usage |
| --- | --- |
| `/` | Choisir un document existant ou créer un projet. Learning est sélectionné au départ ; « Autre… » permet de choisir Quiz Hunt. |
| `/new` | Ouvrir directement le sélecteur et créer un document nommé. |
| `/learning/:documentId` | Ouvrir un document Learning. |
| `/hunt/:documentId` | Ouvrir un document Quiz Hunt. |

Par exemple, depuis la racine du dépôt, lance `npm run dev:elce`, ouvre `/`,
choisis « Autre… · Quiz Hunt », puis « Nouveau document ». Le document créé
s’ouvre sur `/hunt/:documentId`.

Pour ajouter ou adapter un mod, consulter le [skill Elcé Mod](../../../../.agents/skills/elce-mod/SKILL.md).
