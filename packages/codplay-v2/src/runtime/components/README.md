# Composants runtime V2

> Status: En cours
> CodPlay version: V2 foundation

Ce module contient les composants auteur instanciés par le
`RuntimeCapabilityCatalog`. Le materializer possède la racine et son parentage ;
un composant spécialisé peut posséder des ressources internes qui ne sont pas
des persos et ne sont pas publiées comme outlets.

Dans la tranche HTML, `BaseComponent` reçoit après `render()` soit un nœud réel,
soit la collection ordonnée des nœuds réels d'un fragment. Le fragment n'est
jamais enveloppé automatiquement et ne constitue pas une cible de service.

## Media

`MediaComponent` reprend la règle V1 pour les sources à effet de bord :

- `render()` fournit le wrapper auteur ;
- une node vidéo est créée à la première rencontre de chaque `src` ;
- `mediaBySrc` conserve chaque node pendant toute la vie du composant ;
- un changement de source détache l'ancienne node et rattache la node ciblée ;
- `src` n'est jamais réassigné sur une node déjà créée ;
- un seek ou un detach du perso ne détruit pas cette materialisation ;
- le handle runtime final retire le wrapper et permet la libération du composant.

La tranche actuelle ne branche pas encore `media-sync`, le preload partagé ni la
lecture pilotée par le temps CodPlay. Ces points restent une extension distincte.
