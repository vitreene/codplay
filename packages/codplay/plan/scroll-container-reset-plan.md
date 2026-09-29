# Plan — remise au début du scroll-container au reset

> Statut : **En cours** — l’axe block est vérifié dans le parcours Sighty réel
> sous Firefox ; le contrôle Safari demandé par la matrice projet reste ouvert.

## Décision acceptée

Quand le runtime appelle `ScrollContainerComponent.onReset()`, le composant
remet la position de son axe de progression à l’origine : `scrollTop = 0` pour
`block` et `scrollLeft = 0` pour `inline`. Le reset se produit à la frontière
de cycle de vie existante, après `player.reset()`. L’auteur a confirmé le
comportement de l’axe `inline` le 2026-09-28. L’usage Sighty qui motive cette
règle est le retour au début du cours après un échec à l’évaluation.

Ne pas étendre le reset à d’autres coordonnées de présentation ou modifier la
sémantique des observations `once` sans décision et plan dédiés.

## Travail et acceptation

1. [x] Ajouter le comportement dans `ScrollContainerComponent.onReset()` sans
   créer de nouveau cycle de reset ni toucher au chemin seek.
2. [x] Ajouter les régressions block et inline au test
   `scroll-container-component-source`.
3. [x] Vérifier component-v2, ses typechecks et les vérifications Sighty/démos
   associées ; valider le graphe Demo 5 sans diagnostics.
4. [x] Mettre à jour `scroll-container-spec.md` avec le comportement et les
   preuves automatisées.
5. [x] Vérifier le vrai parcours de reset dans Firefox : après lecture des
   pages et échec final, Sighty réadmet la page de départ avec son scrollport
   `block` à `scrollTop = 0`.
6. [ ] Exécuter le contrôle Safari du même parcours avant de déclarer le
   comportement stable.

## Analyse causale et portée des validations

Le défaut était que `onReset()` réattachait et échantillonnait la source sans
replacer la coordonnée de progression. Le correctif écrit zéro sur le seul axe
configuré, puis conserve le réattachement et l’échantillonnage existants. Il ne
change pas la structure du DOM, le graphe parent/enfant, les relations de
reparent, le calcul du progress, les événements du journal, le seek, le resize
ou une éventuelle persistance de position. Les tests source couvrent les deux
axes, le seek, la fin de séquence, le reset et le teardown ; component-v2 a
passé 48 tests et son typecheck. Sighty, component-v2 et les démos ont passé
leurs typechecks et tests applicables ; le build des démos passe aussi.

La vérification Firefox MCP de Demo 5 emprunte la route de refus Sighty, puis
`showMode: 'reset'` à la réadmission de la page de départ ; elle confirme
l’origine de l’axe block. Le code ajouté ne repose que sur les propriétés DOM
standard `scrollTop` et `scrollLeft`. Le contrôle Safari reste toutefois requis
par la matrice projet avant de retirer ce plan.
