# CodPlay V2 - contrats Engine et Player

## Statut

> Status: Fixe
> CodPlay version: V2 foundation
> Review: frontière Engine/Player et seek groupé validés le 2026-08-20; le renderer de production reste une tranche suivante

## Frontiere

Cette tranche pose uniquement la frontiere de consommation de `CompiledScene`.

```text
Engine capabilities + external time or TimeTicker
                 -> Player instance
                -> lifecycle and logical time
                -> materialize -> resolve -> solve
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

`seek` positionne le temps logique sans rejouer les straps ni les effets. Les
erreurs et anomalies de l'opération passent par le `DiagnosticCollector` de
l'engine ou du player : `error` bloque la présentation, `warning` permet de
continuer lorsque la règle le permet. Le seek ne renvoie pas d'enveloppe
`{ ok: false }`. La reconstruction des persos appartient aux tranches
materialize/resolve/solve.

`RuntimePlayer.emit()` est l'entree live unique. Il append l'event et les sorties
du dispatcher dans le `RuntimeTrackJournal`, puis reconstruit l'etat courant.
`seek` ne repasse jamais par `listen`, transform ou strap : il relit le meme journal
par `materialize -> resolve -> solve`.

## Seek de portee

Le player sait seeker une cible locale. La portee et la conversion eventuelle depuis une ligne de
temps globale appartiennent a Sighty ou a l'hote. Pour un seek de plusieurs instances, l'engine
doit recevoir une cible par membre, reconstruire tous les membres de la portee, puis presenter une
seule fois. Il ne doit pas recevoir une suite d'ordres locaux independants.

Par exemple, si Sighty cible `3000` sur une ligne globale et qu'une scene selectionnee est montee
a `1000`, sa cible locale est `2000`. Une scene non selectionnee reste inchangee. La politique
« toutes les scenes a 3000 local » est possible, mais doit etre declaree explicitement par Sighty ;
elle n'est pas une consequence du nom `seek(3000)`.

Le seek V2 reste synchrone. Une future disponibilite asynchrone devra bloquer ou mettre en attente
la portee entiere, jamais presenter un sous-ensemble reconstruit.

`RuntimeEngine.seek()` collecte les diagnostics par instance après la validation
du groupe et le commit de présentation, puis les publie par la sortie de
diagnostics prévue. Sighty peut donc agréger ou router ces diagnostics sans que
CodPlay interprète sa portée ni sa timeline globale.

La premiere frontiere engine est en place : `RuntimeEngine.seek()` orchestre les cibles locales par
phases `validateSeek`, `prepareSeek`, `commitSeek` puis `presentSeek`. Le player individuel utilise
ce chemin commun. Le player reconstruit `materialize -> resolve -> solve` pendant la validation,
met le resultat en attente, puis le committe avant presentation. Le solve structurel et le graphe
parent/enfant sont ouverts pour les moves compilés; les transforms d'ancêtres, les mesures et la
materializer de production reste une capacité de sa tranche respective.

Cette hierarchie, les composants, les transforms et le renderer ne sont pas des manques du seek.
Ce sont des producteurs ou consommateurs d'etat situes de part et d'autre de sa frontiere. Le seek
doit reconstruire l'etat disponible et le transmettre ; il n'a pas a implementer les capacites que
le solve ou le renderer ne supportent pas encore.

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
destruction. Le `RuntimeMaterializer` reste optionnel pour les usages purement
logiques ; un materializer de production ne peut être ajouté qu'avec son contrat.

## Hors perimetre

- composants et services runtime;
- montage et racine DOM;
- familles de composants et services complets;
- rendu, preload et media;
- demo produit et renderer de production;
- contrat DOM public.

## Verticale de validation actuelle

La verticale `tests/runtime/vertical-validity.spec.ts` traverse le flux avec un
`RuntimeMaterializer` de test. Elle valide actuellement un perso, les patches de
classe, un tween d'opacite et le flux `materialize -> resolve -> solve` ainsi que
les deltas generiques `mount/unmount/move` lorsque les tests concernés les ouvrent.
La demo `packages/demos/src/v2/demos/player` reste un banc visible et ne possède pas de circuit
runtime distinct :

- la demo est un banc de validation visible, pas une contrainte de compatibilite du runtime ;
- si elle entre en conflit avec un contrat V2, le contrat runtime prime et la demo doit etre
  adaptee, isolee ou retiree ;
- toute rupture volontaire de la demo doit etre signalee dans le suivi de la tranche concernee.

- aucune famille supplémentaire de composants ne sera ouverte dans cette verticale;
- aucun renderer de production ou contrat DOM ne sera defini;
- aucune capacite absente ne sera simulee pour faire fonctionner une demo;
- les observations de rendu passent par l'interface `RuntimeMaterializer`, jamais par un sink
  concurrent du player.

La tranche runtime actuelle couvre `initial`, les eventimes, le registre statique
des tracks, le journal live, les controles d'activation, la propagation listen,
l'execution sequentielle des straps planned, les patches `className`, les tweens
`style` scalaires explicites, les couleurs normalisees, les placements et le graphe
parent/enfant. Elle ne pretend pas encore couvrir toutes les familles de composants,
les transforms d'ancetres dependantes du substrat ni le renderer de production.

La verticale de validite est couverte par un test sous `tests/runtime/`. La demo
reste un outil de validation interne et ne constitue pas encore un contrat produit.
