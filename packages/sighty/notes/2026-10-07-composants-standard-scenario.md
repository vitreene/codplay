# Widgets autonomes — Sommaire, navigation et Calendrier

## Portée

Cette note conserve l'orientation et la discussion sur les widgets autonomes.
Le [plan distinct des widgets foreign](../plan/2026-11-11-widgets-foreign-plan.md)
porte le raccord commun et sa réalisation. Ces orientations ne décrivent pas
une API déjà disponible ni un changement appliqué au runtime actuel.

## Orientation retenue

Le sommaire qui présente les pages et les chapitres, ainsi que l’interface de
navigation entre les pages, sont aujourd’hui des scènes CodPlay dans le
[player Elcé](../../elce/specs/flux-scene-builder-spec.md). Pour ces deux
rôles, CodPlay n’apporte pas de valeur utile et n’est pas un support adapté.

À terme, ces scènes seront remplacées par deux composants JavaScript
autonomes et réutilisables, intégrés comme contenu foreign selon le contrat
CodPlay `slot` / `foreignContent`. Ils remplissent les mêmes rôles et reflètent
le scénario Sighty : le sommaire représente son organisation en pages et
chapitres, et les commandes de navigation agissent sur le parcours Sighty.

Sighty les rend disponibles en standard, mais leur inclusion reste
facultative pour chaque projet. Ils ne deviennent pas des scènes CodPlay.
Cette évolution concerne le sommaire et la navigation ; elle ne décide pas du
sort de la scène de titre.

## Contrats à préciser avant réalisation

- Où vivent et comment sont fournis ces composants standard : dans Sighty ou
  dans un module associé.
- Comment ils reçoivent une représentation à jour du scénario, notamment son
  ordre, ses chapitres, ses pages et leur état d’accès.
- Comment une sélection du sommaire et les commandes Précédent/Suivant
  adressent le parcours Sighty sans créer de navigation parallèle.
- Qui possède leur création, leur mise à jour et leur destruction, et comment
  ce cycle s’articule avec l’attachement `foreignContent`.
- Quelles parties de leur présentation et de leur interaction peuvent être
  personnalisées par le projet tout en conservant leur disponibilité
  standard.

## Deux usages à normaliser

Un widget peut être présenté dans un récit comme une illustration, ou servir
de menu en envoyant des intentions à Sighty. Le Calendrier illustre les deux
usages : afficher le planning d'une salle, ou permettre qu'un clic sur un
rendez-vous demande la lecture d'une scène. Le Sommaire global est un autre
consommateur de ce second usage.

Le rendu et son modèle métier restent indépendants de CodPlay. Un accueil
foreign commun possède le raccord à la boîte hôte ; l'intégration Sighty
traduit les intentions et fournit les données ou commandes de présentation.
Le widget n'embarque ni routeur ni player. Une même représentation peut
être passive ou émettre des intentions selon sa configuration, sans créer
deux renderers ni un bus supplémentaire.

Cette normalisation porte sur le montage, le cycle, l'alimentation et les
échanges. Elle ne fusionne pas les données du Sommaire et celles du Calendrier.
Le Sommaire et la navigation standard reflètent le scénario Sighty ; le
métier calendaire et ses adaptateurs restent dans leur ressource propriétaire.
Les noms et signatures des opérations communes restent à arrêter dans le
plan avant la réalisation.

La [spécification Sighty](../specs/authoring-library-spec.md) reste l’autorité
pour le graphe de scénario et le routage. La [spécification CodPlay `slot`](../../codplay/specs/slot-component-spec.md)
reste l’autorité pour l’attachement du contenu foreign ; elle ne définit pas
l’API de ces futurs composants Sighty.
