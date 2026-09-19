# CodPlay V2 - contrats Engine et Player

## Statut

> Status: En cours — transaction synchrone atomique de Seek et préparation
> motion par occurrence.
> CodPlay version: V2 foundation
> Review: frontière Engine/Player et seek groupé validés le 2026-08-20 ; la
> préparation géométrique synchrone par occurrence définie dans
> [`motion-live-discovery-invalidation-plan.md`](./motion-live-discovery-invalidation-plan.md)

### Nettoyage structurel de `RuntimePlayer` — 2026-09-19

La façade publique reste dans `runtime-player.ts` et conserve les contrats
Engine/Player. Les responsabilités internes déjà présentes sont isolées dans
`src/runtime/player/runtime-player/` :

- `scene-state.ts` reconstruit l'état logique, la timeline structurelle et les
  synchronisations du store de straps ;
- `presentation.ts` coordonne la présentation composant/module/materializer,
  les occurrences de move et le replay de présentation du seek ;
- `capture-controller.ts` possède les sessions de capture, les actions live et
  les mises à jour d'état transitoires ;
- `seek-controller.ts` possède la transaction de seek et ses phases de
  validation, commit, présentation et rollback ;
- les modules purs `eventime-routing.ts`, `motion-occurrences.ts`,
  `sequence-end.ts` et `snapshot-values.ts` portent uniquement leurs calculs
  spécialisés.

Le découpage ne crée ni second player, ni second journal, ni circuit de
présentation. `RuntimePlayer` reste l'orchestrateur de l'horloge, du journal,
du lifecycle et des appels publics. Les valeurs et contrats n'ont pas été
modifiés ; la validation repose sur la suite runtime existante, indépendante
des démos. Le nettoyage reste rattaché au statut `En cours` tant que les
responsabilités restantes du player n'ont pas fait l'objet d'une revue dédiée.

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
- un indicateur terminal `sequenceEnded`, distinct de l'état `paused`;
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

`sequence:end` est la borne technique terminale lorsqu'elle est atteinte en
lecture. Le player arrête alors sa progression, annule les captures actives,
met les services de module en pause, conserve la tête à la borne et passe à
`paused` avec `sequenceEnded: true`. `pause`, `seek` et `emit` sont refusés dans
cet état. Un `play` ultérieur reconstruit la scène à zéro, réinitialise le
terminal et relance la séquence ; ce n'est donc pas une simple reprise à la
dernière position.

La même règle s'applique à une occurrence `sequence:end` compilée dans un track
et à une occurrence live ajoutée au journal. Un `seek` qui franchit la borne ne
la joue pas et ne pose pas le terminal : il ne fait que projeter l'état demandé.

Lorsqu'une occurrence compilée est atteinte en lecture, le player la promeut
une seule fois dans le `RuntimeTrackJournal` avec son identifiant d'event
déterministe, puis la fait passer par le `RuntimeEventDispatcher` existant.
Les règles `listen`, les straps, les émissions déclarées et la reconstruction
suivent donc le même circuit que pour un event live. La materialisation retire
la copie compilée déjà promue afin que l'occurrence ne soit pas appliquée deux
fois. La publication des events `public` précède le nettoyage terminal ; aucun
flux continu, index d'eventimes ou API de façade supplémentaire n'est ajouté.

L'audit de cette frontière confirme que les façades d'instance et d'engine,
le monitor `idle` et la fin de capture délèguent tous à `RuntimePlayer.emit()`.
La materialisation, la timeline structurelle et la préparation motion relisent
les eventimes pour leurs propres projections ; elles ne dispatchent pas une
seconde fois l'événement. `compileMotionSchedule()` reste un utilitaire de
planification motion autonome, non appelé par le player/runner actuel ; sa
réévaluation éventuelle relève d'une tranche motion distincte et n'est pas
réintroduite dans le circuit `sequence:end`.

## Interface de cycle de vie de la scène

La forme V2 de `SceneDoc.init`, `SceneDoc.onStart` et
`SceneDoc.onSequenceEnd` conserve l'interface runtime V1 :
`(scene, options)`, avec `options.schedule(story)`. Le builder extrait ces
fonctions dans `CompiledScene`; le player les invoque respectivement à
l'initialisation, au passage `ready -> playing` et après le nettoyage terminal.

La frontière V2 transmet aux callbacks la vue compilée et immuable de la scène.
Les eventimes de scène et de story étant déjà compilés avant l'exécution, toutes les
stories déclarées sont disponibles dès l'initialisation et `schedule` est
volontairement sans effet dans cette version. Cette différence est celle de la
frontière `SceneDoc -> CompiledScene` ; elle ne doit pas être contournée par un
track ou une API parallèle dans une scène.

## Seek de portee

Le player sait seeker une cible locale. La portee et la conversion eventuelle depuis une ligne de
temps globale appartiennent a Sighty ou a l'hote. Pour un seek de plusieurs instances, l'engine
doit recevoir une cible par membre, reconstruire tous les membres de la portee, puis presenter une
seule fois. Il ne doit pas recevoir une suite d'ordres locaux independants.

Par exemple, si Sighty cible `3000` sur une ligne globale et qu'une scene selectionnee est montee
a `1000`, sa cible locale est `2000`. Une scene non selectionnee reste inchangee. La politique
« toutes les scenes a 3000 local » est possible, mais doit etre declaree explicitement par Sighty ;
elle n'est pas une consequence du nom `seek(3000)`.

La sémantique de Seek reste atomique pour toute la portée : aucune instance ne
publie une reconstruction partielle. La transaction interne est synchrone :
elle calcule les scènes et la préparation motion dans la même tâche, puis
commit et présente l’ensemble une seule fois. Le navigateur ne peint pas avant
le retour de cette tâche ; aucune horloge ne progresse pendant le calcul. La
façade publique `instance.telco.seek()` conserve sa promesse existante comme
enveloppe de commande.

`RuntimeEngine.seek()` collecte les diagnostics par instance après la validation
du groupe et le commit de présentation, puis les publie par la sortie de
diagnostics prévue. Sighty peut donc agréger ou router ces diagnostics sans que
CodPlay interprète sa portée ni sa timeline globale.

La première frontière engine est en place : `RuntimeEngine.seek()` orchestre les
cibles locales par phases `validateSeek`, `prepareSeek`, `commitSeek` puis
`presentSeek`, toutes synchrones. Le player individuel utilise ce chemin
commun. Il reconstruit `materialize -> resolve -> solve`, prépare les modules et
les groupes motion nécessaires, puis committe le résultat avant la présentation
unique. Le solve structurel et le graphe parent/enfant restent ouverts pour les
moves compilés ; les transforms d’ancêtres, les mesures et le materializer de
production relèvent de leur tranche respective.

Cette hierarchie, les composants, les transforms et le renderer ne sont pas des manques du seek.
Ce sont des producteurs ou consommateurs d'etat situes de part et d'autre de sa frontiere. Le seek
doit reconstruire l'etat disponible et le transmettre ; il n'a pas a implementer les capacites que
le solve ou le renderer ne supportent pas encore.

## Évaluation logique et présentation

> Statut : En cours — extension générique en validation

La reconstruction de `state(t)` et la présentation d'un composant sont deux
optimisations distinctes :

- le player reconstruit lorsque le temps franchit une frontière connue, qu'un
  fait du journal est nouveau ou qu'une action core reste dépendante du temps ;
- entre ces frontières, il peut réutiliser le dernier `SolvedScene` en mettant
  seulement à jour `timeMs` ;
- `RuntimeComponentRuntime` compare séparément l'état et l'intention d'action,
  hors `elapsedMs`, puis appelle `Component.update()` uniquement lorsqu'une
  nouvelle donnée logique est présentée ;
- une animation calculée par un composant est présentée par son flux enregistré
  et par l'horloge du player, sans forcer une reconstruction logique ni créer
  un event supplémentaire.

La réutilisation ne contourne ni `seek`, ni les modules qui possèdent une
horloge native, ni la présentation motion : ces frontières reçoivent toujours
la position courante. L'acceptance exige des tests ciblés sur l'absence de
reconstruction après endpoint, le changement d'état, le morph composant, le
seek avant/arrière et les parcours Play/Seek existants.

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
Les démos V2 ne sont pas une dépendance de cette verticale et ne possèdent pas
de circuit runtime distinct :

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
