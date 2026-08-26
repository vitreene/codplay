# Matérialisation runtime V2

> Statut : Fixe — materialisation HTML/DOM
> Version CodPlay : V2 foundation

## Rôle

Le materializer est la frontière interne qui transforme la représentation d'un
composant en nœuds HTML/DOM, puis applique la structure de la scène à ces nœuds.
Il n'existe qu'une materialisation CodPlay en V2 : le DOM HTML. Un élément SVG
produit par le template reste un nœud DOM pris en charge par cette même
materialisation ; il ne constitue pas un materializer distinct.

## Fonctionnement

L'interface `RuntimeMaterializer` fournit trois opérations :

- `materializeComponent()` reçoit la représentation d'un composant et ses
  services sélectionnés ;
- `materializeScene()` applique à ces mêmes objets les parents et l'ordre
  résolus par la scène ;
- `invalidateStructure()` signale qu'une présentation temporaire a déplacé ou
  libéré une racine et que la prochaine validation doit refaire la
  réconciliation structurelle.

Ces opérations utilisent un seul hôte de materialisation. Elles ne passent pas
par un catalogue de composants séparé, ni par un circuit spécial de démonstration.

## Organisation interne

L'implémentation HTML/DOM se trouve dans `runtime/runner`. Les services communs
aux éléments HTML et SVG restent à côté de leurs déclarations dans
`src/services` ; leur cible est le nœud DOM reçu, quel que soit son namespace.

`BaseComponent` ne dépend d'aucun support. Les composants markup utilisent
`BaseHTMLComponent` et retournent un template HTML, qui peut contenir du SVG ou
un `canvas`. Un contexte Three.js éventuel appartient au composant spécialisé
qui possède ce canvas ; il n'est ni une materialisation CodPlay ni un choix de
la façade.

## Contrat et limites

- un template HTML avec une racine produit un seul nœud réel ;
- plusieurs racines restent un fragment ordonné, sans wrapper ajouté ;
- les racines conservées servent au montage, au démontage, au seek et à la
  capture HTML ;
- un fragment n'est pas une cible de service ;
- le materializer ne remplace pas la logique de scène et ne crée pas un second
  player ;
- aucune option publique ne permet de fournir ou sélectionner un materializer
  Canvas, Three.js, SVG ou autre.
