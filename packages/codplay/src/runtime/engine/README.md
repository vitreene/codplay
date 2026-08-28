# Moteur runtime V2

> Statut : En cours
> Version CodPlay : V2 foundation

## Rôle

Le moteur fournit les ressources partagées par les lecteurs CodPlay. Il porte
le catalogue composé au démarrage, les ressources connues, les horloges, l'ordre
des instances et la coordination des services communs.

Il ne lit pas directement une scène auteur et ne décide pas quand les ressources
doivent être préchargées.

## Fonctionnement

Le service `RuntimePreload` reçoit les manifestes depuis la diffusion, Sighty ou
l'éditeur. Après son chargement, l'appelant enregistre les URLs disponibles avec
`registerResources()` avant d'initialiser le player. La validation des besoins
reste ainsi synchrone et `RuntimePlayer.init()` ne contient pas de branche
implicite de preload.

Les composants, services et modules sont tous déclarés dans le même catalogue.
Chaque composant indique les services et modules qu'il accepte ; le moteur ne
crée que les instances nécessaires au materializer choisi.

## Organisation interne

Les modules runtime sont déclarés dans le catalogue et instanciés une fois par
player. Le moteur possède la disponibilité des capacités et la coordination des
seeks groupés ; l'état d'un module n'est jamais un singleton global.

Un module reçoit uniquement la surface typée dont il a besoin pour agir sur les
composants montés du player. Le moteur ne lui expose jamais une instance de
composant concrète.

## Contrat et limites

- la création du player, l'initialisation de la scène, les deltas de mouvement,
  le seek en deux phases et la destruction passent par le catalogue unique ;
- un seek groupé exécute `validate -> prepare -> commit -> present` et retourne
  un diagnostic structuré par instance cible ;
- le moteur ne possède pas la logique d'auteur de `SceneDoc` ;
- le moteur ne lance pas le preload et ne crée pas de registre de modules
  concurrent.
