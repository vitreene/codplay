# Catalogue des capacités runtime V2

> Statut : En cours
> Version CodPlay : V2 foundation

## Rôle

Le `RuntimeCapabilityCatalog` est le registre unique construit au démarrage
d'une instance CodPlay. Il indique quels composants, services et modules sont
disponibles, et fournit ces mêmes définitions à la compilation comme à la
lecture.

Cette centralisation évite qu'une démo, un runner ou un composant crée son
propre registre parallèle.

## Fonctionnement

Le catalogue peut enregistrer :

- les définitions de composants, avec leur classe, leurs modules et leurs
  validations ; les classes déclarent elles-mêmes leurs services ;
- les services de données, qui appliquent les propriétés à la cible fournie par
  le materializer ;
- les modules créés à l'échelle d'un lecteur, comme `list` ou `media-sync`.

La compilation reçoit une vue de validation pure du même catalogue. Elle peut
donc vérifier les données et appliquer les defaults sans instancier de
composant. La lecture utilise ensuite les définitions runtime correspondantes.

## Organisation interne

Les déclarations de services générales vivent dans `src/services/<service>/`.
Les adaptateurs HTML ou SVG sont assemblés par le runtime choisi. Les
composants reçoivent uniquement les services qu'ils ont déclarés ; le
materializer sélectionné fournit l'implémentation de chaque service.

Une définition peut aussi publier une surface runtime typée : une petite
interface d'opérations destinée aux modules. Le runtime conserve cette surface
pour chaque instance montée et ne transmet jamais la classe concrète au module.

## Contrat et limites

- les définitions core peuvent être remplacées avant le verrouillage ;
- des définitions externes peuvent être ajoutées avant ce verrouillage ;
- après verrouillage, engine, player, composants et materializers utilisent le
  même catalogue ;
- chaque composant core ou externe doit déclarer son profil d'entrée et son
  validateur avant d'être enregistré ;
- le materializer core actuel couvre la famille HTML/SVG ;
- le contrat Canvas, Three.js ou Rive devra être spécifié avant d'ajouter un
  nouveau support ;
- `BaseComponent` reçoit uniquement la façade abstraite `ComponentServices` ;
  aucune API DOM n'est imposée aux composants non HTML.
