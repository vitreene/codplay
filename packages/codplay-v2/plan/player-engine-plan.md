# CodPlay V2 - contrats Engine et Player

## Statut

> Status: En cours
> CodPlay version: V2 foundation
> Review: required before render vertical

## Frontiere

Cette tranche pose uniquement la frontiere de consommation de `CompiledScene`.

```text
Engine capabilities + external time or TimeTicker
                 -> Player instance
                -> lifecycle and logical time
                -> future materialize/resolve/solve
```

Le player ne recoit pas `SceneDoc`, ne compile rien et ne cree pas de clock. Il ne
lit pas le DOM et ne cree pas de composant dans cette tranche.

## Engine

L'engine porte :

- les capacites disponibles, sous forme de noms de composants, services, modules et
  ressources;
- l'ordre d'avancement des instances;
- l'horloge fournie soit par `advance(nowMs)` pour les tests deterministes, soit par
  un `TimeTicker` injectable;
- le payload temporel du ticker, y compris `prevMs`, `deltaMs` et `marginMs`.

L'engine ne lance pas directement de RAF et ne decide pas du scenario. Quand il est
demarre avec `start()`, il consomme le ticker fourni ou un `TimeTicker` V2 par defaut.
Il refuse une instance dont les requirements compiles ne sont pas disponibles.

## Player

Une instance possede :

- un identifiant d'instance;
- un `CompiledScene` immutable;
- un lifecycle `idle -> ready -> playing <-> paused -> destroyed`;
- un temps logique avance par l'engine.

`seek` positionne le temps logique mais ne rejoue encore aucun event et ne resout
aucun perso. Ces comportements appartiennent aux tranches materialize/resolve/solve.

## RenderSync

`RenderSync` est la frontiere temporelle entre le player V2 et des adapters de rendu
externes. Il ne connait ni les composants ni le DOM. Il fournit `nowMs`, `deltaMs`,
`timelineMs`, `timelineDeltaMs` et `rate` dans l'ordre d'enregistrement des adapters.

Ses invariants sont :

- le premier tick apres l'initialisation d'une baseline a `deltaMs: 0`;
- `resume()` efface la baseline murale et rend le premier tick suivant nul;
- `seek()` appelle d'abord `prepareSeek`, puis etablit la nouvelle baseline;
- `stop()` efface la baseline;
- une erreur d'adapter n'interrompt pas les autres adapters.

`RuntimePlayer` pilote cette frontiere sur play, pause, reprise, seek, frame et
destruction. Les adapters restent optionnels tant que les contrats composants et
renderer ne sont pas ouverts.

## Hors perimetre

- composants et services runtime;
- montage et racine DOM;
- materialize, resolve et solve hierarchiques complets;
- events, listen, straps et effets;
- rendu, preload et media;
- demo produit et renderer de production;
- contrat DOM public.

## Verticale temporaire actuelle

La verticale `demos/validation/player` utilise un renderer DOM volontairement
simpliste au-dessus d'un sink memoire. Elle valide actuellement deux persos, les
patches de classe, un tween d'opacite et l'interpolation de `backgroundColor` via
l'adapter `parseColor` avant ACE. Ce dispositif reste explicitement temporaire :

- aucun composant V2 ne sera ouvert;
- aucun renderer de production ou contrat DOM ne sera defini;
- aucune capacite absente ne sera simulee pour faire fonctionner une demo;
- le sink sera remplace lorsque `materialize/resolve/solve` complets et le contrat composant
  seront stabilises.

La premiere tranche pipeline couvre `initial`, les eventimes, le registre statique
des tracks, le journal live, les controles d'activation, la propagation listen,
l'execution sequentielle des straps planned, les patches `className`, les tweens
`style` scalaires explicites et les couleurs normalisees. Elle ne pretend pas encore
resoudre la hierarchie, les composants ou le renderer de production.

La verticale de validite est couverte par un test sous `tests/runtime/`. La demo
reste un outil de validation interne et ne constitue pas encore un contrat produit.
