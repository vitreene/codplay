# Remote CodPlay

> Statut : En cours — export V2 officiel, transition V1 isolée
> Version CodPlay : V2 foundation

## Rôle

Ce package fournit une télécommande visuelle pour une surface CodPlay. Son export
principal `createRemote` reçoit la surface `CodPlayTelco` V2 et ne connaît
ni le runner, ni le catalogue, ni le DOM de la scène. Il ne possède donc aucun
circuit de lecture : chaque commande est déléguée à la telco reçue.

L'ancien transport V1 reste disponible explicitement sous
`createDemoRemoteV1` pendant la migration progressive des démos historiques.

Le nom de package `@codplay/remote` désigne donc la télécommande V2 dans le
code nouveau. Le renommage global du noyau V1 (`codplay` vers `codplay-v1`) et
la migration de ses imports ne font pas partie de cette passe ; ils seront
effectués progressivement avec les fichiers concernés.

## Contrat V2

Le remote V2 consomme uniquement la telco V2 reçue :

- `getState()` et `getProgress()` pour l'affichage du temps et de l'état ;
- `play`, `pause`, `togglePlay`, `seek`, `rewind` et `setRate` pour les commandes ;
- `onChange` et `onProgress` pour les notifications ;
- `commandInFlight` pour ne pas concurrencer une commande en cours.

Le glissement du progress met en file les valeurs intermédiaires et envoie la
dernière valeur au relâchement. La pause préalable au seek et la limitation
des commandes restent dans cette télécommande de présentation ; la telco V2
reste l'unique propriétaire du pilotage réel.

Les styles `.telco-remote*` sont fournis par le layout de l'hôte. Le package ne
crée pas un layout de page et ne dépend pas d'une scène.
