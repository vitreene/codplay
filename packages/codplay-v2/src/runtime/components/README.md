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

## List

`ListComponent` est le composant auteur de type `list`. Il possède uniquement sa
racine et ses services `className`, `style` et `attr`. Il ne manipule pas ses
enfants et ne lit pas le DOM pour reconstruire l'ordre : la capacité runtime
`list` porte la politique V1 et la timeline structurelle fournit l'ordre complet
au materializer. Les éléments enfants restent les materialisations persistantes
des persos concernés.

## Media

`MediaComponent` reprend la règle V1 pour les sources à effet de bord :

- `render()` fournit le wrapper auteur ;
- une node `<audio>` ou `<video>` est créée pour chaque `src` statique déclaré
  par `initial.src` ou par une action ;
- `mediaBySrc` conserve chaque node pendant toute la vie du composant ;
- un changement de source détache l'ancienne node et rattache la node ciblée ;
- `src` n'est jamais réassigné sur une node déjà créée ;
- la nature audio/vidéo et la durée connue viennent des métadonnées du preload
  externe ; l'absence de durée ne permet pas au runtime d'inventer une durée ;
- la fenêtre `broadcast.startAt/endAt`, le rate natif et les transitions de
  lecture sont appliqués par la capacité `media-sync` via la surface du
  composant ;
- un seek ou un detach du perso ne détruit pas cette materialisation ;
- le handle runtime final retire le wrapper et permet la libération du composant.

La capacité `preload` est distincte du composant : elle prépare les manifestes
pour l'hôte et ne se déclenche pas depuis `render()`, `init()` ou un changement
de source. La synchronisation média et la lecture pilotée par le temps CodPlay
restent des extensions distinctes de cette capacité de préparation.
