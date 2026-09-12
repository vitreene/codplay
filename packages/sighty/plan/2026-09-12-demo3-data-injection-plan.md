# Sighty — démo 3, injection de données dans une scène

## Statut

Statut : En cours — première tranche implémentée ; validation navigateur et
Safari restent ouvertes.

Cette démo est un scénario de validation distinct du besoin générique des
composants. Elle reprend la composition de la démo 2, remplace la scène B par
la scène A et ajoute deux formes d'émission vers cette scène.

## Parcours retenu

1. `layout` place la scène A au-dessus de la scène de commandes.
2. Deux boutons de la scène `telco` émettent des événements publics avec un
   payload `{ content }`.
3. La composition Sighty écoute ces événements, puis les injecte dans
   l'instance `sceneA` avec `instance.events.emit` et une cible story explicite.
4. Deux contrôles extérieurs à la scène de commandes demandent à Sighty
   d'injecter un événement de couleur dans la même instance `sceneA`.
5. La scène A applique ces payloads par des actions auteur déclarées à `null`.

Le trajet inter-scènes reste donc celui fixé par la démo 2 : la telco ne
connaît pas la scène A, et la scène A ne connaît ni la telco ni la page. La
page ne manipule pas le DOM de la scène ; elle appelle la composition, qui
utilise la façade publique de l'instance.

## Contrats réutilisés

- événements publics CodPlay sur `telco.events.onEvent` ;
- injection CodPlay sur `sceneA.events.emit(eventime, { scope: 'story', storyId: 'main' })` ;
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

Le bouton général « Remise à zéro » recrée la session Sighty sélectionnée. Le
layout détruit l'ancienne session, ses instances et leurs journaux, puis
reconstruit le scénario et le relance. Cette opération est distincte de
`instance.telco.rewind()`, dont le contrat CodPlay remet seulement la position
de lecture à zéro et conserve le journal pour les opérations normales de
relecture. Aucun effacement interne du journal et aucun `story.reset()` ne sont
ajoutés.

## Étapes et validation

| Étape | Statut | Preuve attendue |
| --- | --- | --- |
| Déclarer les événements et les quatre contrôles | Effectuée | Deux boutons dans la scène telco et deux contrôles dans la zone optionnelle de la page. |
| Relayer les payloads de la telco | Effectuée | Clic → événement public → Sighty → `sceneA.events.emit`. |
| Injecter les couleurs depuis Sighty | Effectuée | Chaque contrôle modifie la couleur du texte par un événement ciblé. |
| Étendre la durée de la démo | Effectuée côté test | La scène A de Demo 3 se termine à 20 s ; son animation d'image reste limitée à 10 s. |
| Réinitialiser la session sans conserver les enregistrements | Effectuée côté test | Le bouton général détruit puis recrée la session Sighty sélectionnée. |
| Vérifier le parcours réel | Effectuée côté test | Test avec les vrais runners, players, montage, événements et teardown. |
| Vérifications globales | Partielle | Tests, typechecks et build passent ; contrôle navigateur à compléter. |

## Critères d'acceptation

- la démo 3 apparaît dans l'entrée Sighty partagée ;
- la scène A conserve son image, son titre, sa mise en scène et sa timeline ;
- la durée de la démo 3 est de 20 s, sans prolonger l'animation d'image de 10 s ;
- les deux boutons de la telco changent le texte de la scène A avec leur
  payload propre ;
- les deux contrôles extérieurs changent la couleur du texte via Sighty ;
- la remise à zéro générale recrée la session et ne rejoue aucun enregistrement
  utilisateur de la session précédente ;
- aucun contrôle ne cible directement une autre scène depuis le document
  auteur de la telco ;
- le test prouve le chemin runtime public complet et le nettoyage.

## Validation locale

Le test `packages/codplay/tests/facade/sighty-demo3.spec.ts` passe avec les
vrais runners HTML, les vrais players Sighty/CodPlay, le montage déclaré et le
teardown. Il vérifie la durée de 20 s, les deux payloads `content`, les deux
injections de couleur, les messages observables et les contrôles extérieurs.
Le test du layout partagé vérifie que la remise à zéro détruit la session
active, n'appelle pas son `relaunch()` et recrée la session avant de la rejouer ;
les enregistrements de l'ancienne session sont ainsi abandonnés avec ses
instances.

Le 2026-09-12, la suite CodPlay complète passe (102 fichiers, 633 tests), les
tests Sighty passent (2 tests), les typechecks `codplay`, `@codplay/sighty` et
`@codplay/demos` passent, et le build Vite des démos produit `sighty.html`.
La vérification visuelle dans un navigateur et Safari reste à faire.
