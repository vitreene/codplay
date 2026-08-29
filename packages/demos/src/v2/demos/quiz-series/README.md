# Quiz — Série de 3 questions

> Statut : Fini
> Version CodPlay : V2 foundation

Cette démo porte la scène V1 « Quiz — Série de 3 questions » dans le flux V2.
Elle fournit uniquement la scène, ses données et sa feuille de styles. Les
straps propres à la scène et à ses stories sont déclarés dans cette scène ; le
layout V2 fournit le titre, la télécommande, le journal et le conteneur de
présentation.

La scène conserve trois questions — vrai/faux, choix unique et choix multiples
— ainsi que le calcul du score et la fenêtre de résultat. Sa feuille de styles
contraint la grille et les panneaux avec des dimensions fluides pour rester
utilisable dans la zone centrale responsive du layout.

## Injection externe du parcours automatique

Le parcours automatique est piloté depuis l’hôte, sans modifier la scène et
sans simuler des clics. Le layout commun rend le bouton `Auto` dans la telco
lorsque le module fournit une capacité `playback`. Cette capacité contient une
liste d’eventimes et, pour chaque eventime, sa cible `scene` ou `story` et
son `trackId`.

La séquence de cette démo désactive le track interactif, active le track
automatique, injecte les eventimes dans ce track déclaré, puis lance la lecture.
Elle reprend ainsi le pattern V1 tout en utilisant exclusivement les surfaces
publiques V2.

```ts
await instance.events.emit(
  {
    name: 'track:deactivate',
    data: { trackIds: ['quiz-series-interactive-track'] },
  },
  { scope: 'scene' },
)

await instance.events.emit(
  {
    name: 'track:activate',
    data: { trackIds: ['quiz-series-auto-track'] },
  },
  { scope: 'scene' },
)

await instance.events.emit(
  { name: 'quiz-series-q0:answer:vrai:selected', startAt: 2_000 },
  { scope: 'story', storyId: 'quiz-series-q0-story', trackId: 'quiz-series-auto-track' },
)

await instance.telco.play()
```

Les commandes `track:activate` et `track:deactivate` sans `startAt` sont
appliquées immédiatement par le dispatcher officiel ; les eventimes de
lecture avec `startAt` sont inscrits au temps courant augmenté de cet offset et
présentés par la reconstruction normale. La cible du track est fournie
séparément de l’eventime ; le nom de l’event ne détermine jamais sa cible.
