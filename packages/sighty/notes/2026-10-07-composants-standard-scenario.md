# Sighty — sommaire et commandes de navigation autonomes

## Portée

Cette évolution est à reprendre après la migration Elcé en cours. Elle ne
change ni le runtime actuel ni les scènes CodPlay du POC.

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

La [spécification Sighty](../specs/authoring-library-spec.md) reste l’autorité
pour le graphe de scénario et le routage. La [spécification CodPlay `slot`](../../codplay/specs/slot-component-spec.md)
reste l’autorité pour l’attachement du contenu foreign ; elle ne définit pas
l’API de ces futurs composants Sighty.
