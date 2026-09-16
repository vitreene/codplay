# Sighty — démo 2, télécommande-scène

## Statut

Statut : En cours — première tranche implémentée ; validation navigateur et
Safari encore ouvertes.

Cette démo reprend la scène `sceneB` de la première démo Sighty
(`sighty-scene-b`). Elle ajoute une scène de commandes et un layout qui les
présente ensemble. Le scénario de cette démonstration est distinct du besoin
générique d'un composant CodPlay.

## Résultat demandé

L'entrée Sighty partagée monte trois scènes CodPlay séparées :

- `layout`, qui expose une zone principale pour `sceneB` et une zone située en dessous
  pour `telco` ;
- `sceneB`, réutilisée depuis la première démo avec son visuel et sa timeline ;
- `telco`, qui porte les boutons de commande comme des persos CodPlay.

La scène `telco` émet des événements publics. Le fichier auteur déclare le
couplage entre le slot `telco` et le slot `sceneB` ; le runtime Sighty valide la
liaison active et médiatise les commandes vers la telco de `sceneB`. La scène
de commandes ne contient aucune référence à l'identité de la scène pilotée et
`sceneB` ne connaît pas la telco.

La première tranche couvre trois intentions : `Lire`, `Pause` et `Rejouer`.
Ces intentions commandent le transport réel du player de `sceneB` : lecture,
pause et remise au début suivie d'une lecture. Les scènes restent
indépendantes et le layout ne fait que les accueillir.

Les événements de la télécommande sont le seul raccord interscènes : Sighty
les reçoit, résout le couplage déclaré et envoie la commande à `sceneB`. Sighty
garde la responsabilité infrastructurelle du cycle de vie des occurrences
(composition, démarrage initial, démontage et destruction), tandis que la
maîtrise fonctionnelle exercée dans cette démo vient de la scène `telco` et de
la déclaration de couplage. `sceneB` ne connaît pas la télécommande et `telco`
ne connaît pas `sceneB`.

## Parcours retenu

1. Sighty compile et prépare séparément `layout`, `sceneB` et `telco`.
2. Sighty crée et monte les deux enfants dans les slots déclarés du layout.
3. Sighty démarre les trois occurrences ; `sceneB` commence sa timeline à zéro.
4. Un clic sur un bouton de `telco` produit un événement public dans cette
   scène.
5. Sighty publie l'événement, résout le couplage déclaré et applique la
   commande prévue à `sceneB`.
6. Sighty démonte puis détruit les trois occurrences à la fin de la démo.

Le chemin de message est le seul raccord entre la télécommande et la scène
pilotée. Aucun appel de la scène-telco vers une autre instance n'est déclaré
dans son document auteur.

## Étapes et gates

| Étape | Statut | Condition de passage |
| --- | --- | --- |
| 1. Scènes auteur | Effectuée pour la première tranche | Déclarer `layout` et `telco` dans la démo 2, puis réutiliser le document `sceneB` de la première démo avec son id, son story et son visuel. |
| 2. Composition Sighty | Effectuée pour la première tranche | Résoudre les slots, monter les enfants et activer le couplage déclaré. |
| 3. Démonstration visible | Effectuée pour la première tranche | Sélectionner la démo 2 dans l'entrée partagée et présenter les commandes sous la scène B. |
| 4. Validation | Exercée ; navigateur à compléter | Prouver le chemin clic → message public → Sighty → telco de `sceneB`, ainsi que le teardown. |

## Critères d'acceptation

- La scène B est visible dans la zone principale, au-dessus des commandes.
- La scène de commandes est une scène CodPlay matérialisée dans le slot inférieur.
- Un clic sur `Lire` envoie un message à Sighty, qui appelle la telco de
  `sceneB`.
- Un clic sur `Pause` envoie un message à Sighty, qui met en pause la telco de
  `sceneB`.
- Un clic sur `Rejouer` envoie un message à Sighty, qui rembobine puis relance
  la telco de `sceneB`.
- Le journal de la démo permet d'observer l'événement reçu ; la commande est
  ensuite médiatisée par le couplage générique.
- Le test utilise les vrais runners et les vrais players ; il ne simule pas le
  message par un appel direct de la scène de commandes vers `sceneB`.
- Le montage et la destruction n'ajoutent pas de fuite d'écouteur ni de style.
- Les typechecks, le build et la suite de tests ciblée passent. Le navigateur
  et Safari restent à valider séparément.

## Suivi

La scène B réutilisée est identifiée dans le dépôt par l'id `sighty-scene-b` et
provient du module auteur de la première démo. La première preuve est le test
`packages/codplay/tests/facade/sighty-demo2.spec.ts`, qui passe par les vrais
runners, players, événements publics et handles de montage.

La composition de la démo 2 instancie désormais une seule façade `Sighty` et
utilise sa surface `runtime` pour la compilation, le préchargement, la création,
le montage et la destruction. Elle ne conserve qu'un abonnement au journal
public propre à ce scénario ; le couplage est déclaré dans le fichier Sighty et
exécuté par le runtime générique. L'entrée partagée garde le statut accessible,
le journal, la télécommande générale et le nettoyage de sa racine DOM ; la
démo 2 ne fournit pas de zone de contrôles optionnelle.

Validation locale du 2026-09-12 : les typechecks `@codplay/demos` et `@codplay/sighty`,
la suite Sighty, la suite CodPlay complète et le test de l'interface partagée passent
(101 fichiers, 626 tests CodPlay ; 2 tests Sighty). Le build Vite produit bien
`sighty.html`, qui sert aussi `?demo=demo2`. Le parcours visuel navigateur et
Safari restent ouverts.

Validation de la reprise du 2026-09-15 : la suite Sighty passe avec 26 tests,
la suite CodPlay complète avec 104 fichiers et 645 tests, les typechecks
Sighty/CodPlay/démos passent, le build Vite produit `sighty.html` et les tests
de façade Demo 2/Demo 4 passent avec 8 tests. Le parcours visuel navigateur et
Safari restent à exécuter séparément.

L'interface commune a été raccordée le 2026-09-12 : le sélecteur commute entre
les deux scénarios dans la même page, la télécommande générale expose un toggle
iconique `play`/`pause` et un bouton de remise à zéro sans progression, et le
volet de logs est partagé.
Le footer de commande reste sous la scène ; la télécommande générale possède
un habillage distinct des telcos de scène, qui conservent leurs boutons
graphiques et leur progression lorsqu'ils ciblent une occurrence.

Correctif de présentation : la chaîne page → layout → section → slot → racine
de scène utilise désormais des conteneurs flex avec étirement explicite ; les
racines `sceneB` et `telco` conservent leur mise en page interne et remplissent
leur hôte. `sceneB` occupe la zone principale, les commandes restent visibles
en pied, et aucun titre visible ne qualifie la scène de commande. Les sections
portent directement leurs `data-part` : aucun `div` intermédiaire vide n'est
nécessaire pour cibler les slots.
