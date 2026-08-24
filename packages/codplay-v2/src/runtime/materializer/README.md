# Matérialisation runtime V2

> Statut : Fixe — tranche HTML/SVG DOM
> Version CodPlay : V2 foundation

## Rôle

Le materializer est la couche qui transforme la représentation d'un composant
en objets du support choisi, puis applique la structure de la scène à ces
objets. La version actuelle couvre le DOM HTML et SVG.

## Fonctionnement

L'interface `RuntimeMaterializer` fournit trois opérations :

- `materializeComponent()` reçoit la représentation d'un composant et ses
  services sélectionnés ;
- `materializeScene()` applique à ces mêmes objets les parents et l'ordre
  résolus par la scène ;
- `invalidateStructure()` signale qu'une présentation temporaire a déplacé ou
  libéré une racine et que la prochaine validation doit refaire la
  réconciliation structurelle.

Ces opérations utilisent un seul hôte de materialization. Elles ne passent pas
par un catalogue de composants séparé, ni par un circuit spécial de démonstration.

## Organisation interne

Les implémentations HTML et SVG DOM se trouvent dans `runtime/runner`. Les
services communs HTML/SVG restent à côté de leurs déclarations dans
`src/services`.

`BaseComponent` ne dépend d'aucun support. Les composants HTML/SVG utilisent
`BaseHTMLComponent`; un futur materializer Canvas ou Three.js devra définir sa
propre projection au lieu d'imposer `render(): string` et des nœuds DOM à tous
les composants.

## Contrat et limites

- un template HTML avec une racine produit un seul nœud réel ;
- plusieurs racines restent un fragment ordonné, sans wrapper ajouté ;
- les racines conservées servent au montage, au démontage, au seek et à la
  capture HTML ;
- un fragment n'est pas une cible de service ;
- le materializer ne remplace pas la logique de scène et ne crée pas un second
  player.
