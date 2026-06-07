# Positionnement architectural de Codplay

## Codplay est-il un modèle de machine à états ?

Non, pas exactement — ou du moins pas au sens classique du terme.

**Ce qui ressemble à une machine à états :**

Le **cycle de vie du player** est explicitement une FSM avec des états nommés et des transitions contraintes :
`idle → ready → playing ↔ paused → destroyed`
et les variantes `seeking`, `rewinding`, `error`. Les événements utilisateur sont bloqués en `paused` et `seeking`.

**Ce qui ne l'est pas :**

Le **modèle auteur** (stories + straps) est un système **réactif événementiel**, pas une FSM :

- Il n'y a pas d'ensemble fini d'états nommés — le `state` d'une story est un objet libre (`Record<string, unknown>`) modifiable à la discrétion des straps via `update`.
- Il n'y a pas de transitions déclarées entre états — n'importe quel événement peut modifier n'importe quelle propriété du state à tout moment.
- Un strap est une **fonction pure** `(event, state) → effects` : c'est plutôt du style réducteur (Redux-like), sans notion de "quel état autorise quelles transitions".

**Ce que c'est vraiment :**

Le modèle est plus proche d'une combinaison de :
- **Event sourcing** : tous les effets passent par des événements matérialisés sur des pistes, ce qui permet le seek par replay.
- **Reactive dataflow** : les `listen` rules et straps forment un pipeline de transformation d'événements.
- **Timeline scheduling** : les helpers (`planned`, `live`) planifient des événements dans le temps de manière déterministe.

En résumé : le player est une FSM, mais la scène est un système réactif à base d'événements et d'état mutable non contraint.

---

## Projets open-source comparables

En cherchant projet par projet sur les dimensions clés :

**Pour le modèle scène + timeline : Theatre.js**

C'est le plus proche structurellement. Theatre.js a une séparation authoring/playback explicite, un modèle d'objets avec props animées sur une timeline, et un compilateur qui produit un artefact joué par un player. Mais il n'a pas de système événementiel réactif — il est purement orienté animation.

**Pour le pipeline événementiel (listen + straps) : XState**

La combinaison `événement → règle → effets` avec état immuable en entrée ressemble à un statechart XState simplifié. XState va plus loin (états nommés, guards, hiérarchie), mais le pattern de base est le même. **Zag.js** (construit sur les mêmes idées) est encore plus proche : des machines événementielles légères sans hiérarchie explicite.

**Pour la matérialisation + seek : EventStore / Eventsourcing.js**

Le pattern piste + replay est de l'event sourcing pur. Il n'y a pas de projet JS mainstream qui combine event sourcing avec un player visuel — c'est la partie la plus originale de Codplay.

**Pour les helpers temporels : RxJS**

`wait/delay/repeat/loop/stagger` avec handles cancellables sont des opérateurs RxJS (`delay`, `interval`, `take`, `zipWith`) rendus impératifs. **Redux-Saga** est aussi proche pour la séquentialité des effets asynchrones.

**Pour l'ensemble : pas d'équivalent direct**

Aucun projet open-source connu n'assemble ces quatre dimensions ensemble. La combinaison "document déclaratif compilé + réactivité événementielle + event sourcing pour le seek + scheduling temporel" est la proposition propre de Codplay. Les projets existants couvrent chaque dimension séparément.
