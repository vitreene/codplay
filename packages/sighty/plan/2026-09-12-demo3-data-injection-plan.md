# Sighty — démo 3, injection de données dans une scène

## Statut

Statut : Différée — le circuit de la première tranche a été reconstruit sur la
passerelle Sighty canonique ; cette démo n’est pas prioritaire pour la
stabilisation du runtime et de Demo 4. Sa validation navigateur/Safari reste
ouverte et non bloquante. Si son rendu complet ne peut pas être garanti sans
réintroduire un circuit obsolète, elle sera marquée `deprecated` et retirée du
registre actif.

Cette démo est un scénario de validation distinct du besoin générique des
composants. Elle reprend la composition de la démo 2, remplace la scène B par
la scène A et déclare deux familles d’intentions vers cette scène.

## Parcours retenu

1. `layout` place la scène A au-dessus de la scène de commandes.
2. Deux boutons de la scène `telco` émettent des événements publics avec un
   payload `{ content }`.
3. L’action déclarée sur la vue `telco` reçoit ces événements et délègue
   l’injection à la passerelle Sighty avec une cible story explicite.
4. Deux contrôles extérieurs à la scène de commandes demandent à Sighty
   d'injecter un événement de couleur dans la même instance `sceneA`.
5. La scène A applique ces payloads par des actions auteur déclarées à `null`.

Le trajet inter-scènes reste donc celui fixé par la démo 2 : la telco ne
connaît pas la scène A, et la scène A ne connaît ni la telco ni la page. La
page ne manipule pas le DOM de la scène ; elle appelle la composition, qui
utilise la façade publique de l'instance.

## Contrats réutilisés

- événements publics CodPlay observés par Sighty sur la scène `telco` ;
- passerelle Sighty interne vers l’interface eventime CodPlay, avec une cible
  `{ scope: 'story', storyId: 'main' }` ;
- fusion canonique de `event.data` dans une action auteur `null` ;
- service `content` pour le texte et service `style` pour la couleur ;
- cycle de vie et montage des scènes pris en charge par `Sighty.runtime`.

Aucune nouvelle API du cœur CodPlay ou de Sighty n'est nécessaire pour cette
tranche. Aucun chemin DOM parallèle, catalogue local ou état de présentation
dupliqué n'est autorisé.

## Durée et remise à zéro

La scène A de cette démo conserve l'animation d'image de dix secondes, mais sa
fin de séquence est déclarée à vingt secondes. Cette spécialisation appartient
au document auteur de la démo 3 ; la durée de la démo 1 reste inchangée.

Le bouton général « Remise à zéro » relève du reset logique CodPlay de la
session Sighty sélectionnée. Il réinitialise les occurrences conservées sur
leur instance existante et ne simule pas ce reset par une destruction et une
recréation. Cette opération est distincte de `instance.telco.rewind()`, dont
le contrat CodPlay remet seulement la position de lecture à zéro et conserve
le journal pour les opérations normales de relecture. Aucun effacement interne
du journal et aucun `story.reset()` local ne sont ajoutés.

## Étapes et validation

| Étape | Statut | Preuve attendue |
| --- | --- | --- |
| Déclarer les événements et les quatre contrôles | Effectuée | Deux boutons dans la scène telco et deux contrôles dans la zone optionnelle de la page. |
| Relayer les payloads de la telco | Effectuée | Clic → événement public → action déclarée → passerelle Sighty → scène A. |
| Injecter les couleurs depuis Sighty | Effectuée | Chaque contrôle produit une intention hôte admise par Sighty et transmise par la même passerelle. |
| Étendre la durée de la démo | Effectuée côté test | La scène A de Demo 3 se termine à 20 s ; son animation d'image reste limitée à 10 s. |
| Réinitialiser la session sans conserver les enregistrements | En cours | Le bouton général doit demander le reset logique CodPlay sur les instances conservées ; la primitive est raccordée, mais le parcours propre à Demo 3 reste à valider. |
| Vérifier le parcours réel | Effectuée côté test | Test avec les vrais runners, players, montage, événements et teardown. |
| Vérifications globales | Partielle | Tests, typechecks et build passent ; contrôle navigateur à compléter. |

## Critères d'acceptation

- la démo 3 apparaît dans l'entrée Sighty partagée ;
- la scène A conserve son image, son titre, sa mise en scène et sa timeline ;
- la durée de la démo 3 est de 20 s, sans prolonger l'animation d'image de 10 s ;
- les deux boutons de la telco changent le texte de la scène A avec leur
  payload propre ;
- les deux contrôles extérieurs changent la couleur du texte via Sighty ;
- la remise à zéro générale réinitialise les instances conservées et ne rejoue
  aucun enregistrement utilisateur de la session précédente ;
- aucun contrôle ne cible directement une autre scène depuis le document
  auteur de la telco ;
- le test prouve le chemin runtime public complet et le nettoyage.

## Validation locale

Le test `packages/codplay/tests/facade/sighty-demo3.spec.ts` passe avec les
vrais runners HTML, les vrais players Sighty/CodPlay, le montage déclaré et le
teardown. Il vérifie la durée de 20 s, les deux payloads `content`, les deux
injections de couleur, les messages observables et les contrôles extérieurs.
Le test du layout partagé devra vérifier que la remise à zéro réinitialise la
session active sur ses instances conservées, sans appeler `destroy/create` pour
simuler le reset ; les enregistrements utilisateur sont remis à zéro selon le
contrat CodPlay. Le montage, le détachement et le reset restent pilotés par le
runtime à partir du scénario ; aucune primitive publique d’occurrence n’est
ajoutée à cette démo.

La validation automatisée actuelle passe avec les vrais runners : 104 fichiers
et 655 tests CodPlay, 31 tests Sighty, les typechecks `codplay`,
`@codplay/sighty` et `@codplay/demos`, ainsi que le build Vite des démos qui
produit `sighty.html`. Le chemin texte a été rejoué dans Safari MCP ; la
validation visuelle complète de Demo 3 et Safari reste différée avec cette
démo non prioritaire.
