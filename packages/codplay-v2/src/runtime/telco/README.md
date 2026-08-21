# Telco V2

> Status: En cours
> CodPlay version: V2 foundation

La telco est la façade locale de pilotage du transport d'un player V2. Elle
ne contient ni logique de scène, ni recherche de cibles, ni materialisation.
Elle délègue `play`, `pause`, `seek` et `rewind` à une cible de transport déjà
initialisée, sérialise les commandes et expose les snapshots d'état ainsi que
la progression.

La tranche actuelle sert au pilotage interne de la validation capture/DnD. Elle
n'implémente pas de transport distant et n'ajoute pas encore le `rate`, qui
reste une capacité distincte du player V2.

La démo utilise cette façade avec `HtmlPlayerRunner` et un remote de contrôle
unique. Elle ne possède donc plus de boutons de pilotage parallèles au telco.
