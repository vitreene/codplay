# Capacité markup V2

> Statut : En cours
> Version CodPlay : V2 foundation

## Rôle

La capacité `markup` enregistre les parties d'un composant que d'autres
éléments peuvent utiliser comme points d'insertion. Elle fait le lien entre le
composant et la couche qui transforme son HTML ou son SVG en nœuds affichés.

Elle ne crée pas les composants et ne décide pas de leur contenu. Elle conserve
uniquement les déclarations de points publiés et permet au lecteur de les
retrouver.

## Fonctionnement

Lorsqu'un composant est affiché, le runner HTML lui transmet les déclarations
de parties publiques. La capacité :

1. mémorise la racine logique et les parties publiées ;
2. rend ces parties disponibles comme cibles de montage ;
3. fournit le retrait logique des enregistrements lors du démontage.

Le lecteur récupère ensuite les cibles avec `getMountTargets()` et les combine
avec les cibles de son propre conteneur avant de résoudre la scène.

Pour le composant core `layout`, toutes les zones marquées `data-part` sont
publiées. Pour un composant qui garde certaines zones pour son usage interne,
sa définition peut n'en publier qu'une partie. Le choix est fait par le
catalogue du runtime, pas par la démo et pas par le composant parent.

## Organisation interne

`MarkupCapabilityState` conserve l'état d'un composant. La définition créée par
`createMarkupModuleServiceDefinition()` est enregistrée dans le catalogue et
produit une instance par lecteur. Le pont qui relie cette capacité à la
materialisation DOM se trouve dans
`runtime/runner-html/markup-materialization.ts` ; il n'appartient pas à l'état
logique de la capacité.

Le parsing des templates est réalisé par le materializer HTML du runner avec
les API DOM du navigateur. La capacité `markup` ne parse pas les templates ;
elle conserve uniquement l'état des parts et des outlets.

## Contrat et limites

- une instance de capacité existe par lecteur ;
- les identifiants de cible sont comparés comme des valeurs exactes ;
- un identifiant ne peut apparaître qu'une fois dans une instance ;
- supprimer un composant supprime toutes ses parties publiées ;
- le module ne déduit pas le sens d'un nom de cible ;
- son état est indépendant de l'état logique de la scène ;
- il ne lit pas le DOM, ne monte pas les enfants et ne parse pas les templates.
