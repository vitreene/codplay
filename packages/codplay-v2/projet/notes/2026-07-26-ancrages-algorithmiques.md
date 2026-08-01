# Ancrages algorithmiques — à quels modèles établis les processus V2 se rattachent

Note de réflexion (2026-07-26). Recul théorique : rattacher les processus conçus *ad hoc* pour la V2
(`2026-07-16-solve-project-moteur-custom.md`) à des algorithmes/modèles informatiques établis. Double
but : **valider** que les intuitions ne sont pas isolées (elles ont un nom, une littérature), et
**emprunter** des techniques éprouvées plutôt que réinventer. Aucun code.

**Avertissement directeur** (esprit de la session) : ces modèles sont des sources de **vocabulaire et
d'invariants**, PAS des frameworks à importer. Emprunter les *concepts nommés* pour rigoriser ce qui est
déjà conçu — comme on a emprunté les *algos purs* d'anime sans son runtime. Le modèle "pur" a souvent
des lourdeurs que la conception V2 évite déjà intelligemment.

## Table de correspondance

| Processus V2 | Modèle(s) établi(s) | À en tirer |
|---|---|---|
| **`f(t)`** (état = fonction du temps) | **FRP** (Behavior/Event) ; fonctions pures + mémoïsation ; timeline stateless (three.js, Theatre.js, After Effects) | Typage Behavior/Event (voir focus ci-dessous) ; théorie du *glitch* pour le solve hiérarchique |
| **Fenêtres de validité** + seek réversible | **Interval/segment trees** (`O(log n)` « quel intervalle contient t ») ; **step functions** ; **temporal/bitemporal databases** (validity intervals) | Interval tree = structure directe pour interroger toute dimension discrète à `t` ; bitemporel (valid-time vs transaction-time) = réponse toute faite au cas seek-back/invalidation |
| **Solve hiérarchique** (parents→enfants) | **Scene graph traversal** (matrices le long de l'arbre) ; **tri topologique** ; **dirty-flagging / incremental computation** | Le dirty-flagging est LA version établie de « ne recomposer que ce qui bouge » — le mécanisme de coupe-par-reflow du seek-FLIP en est une réinvention partielle |
| **Solve/project** (calcul ≠ rendu) | **Retained mode vs immediate mode** ; **virtual DOM / reconciler** (React/Flutter/Elm/SwiftUI) ; **ECS** (Entity-Component-System) | Le reconciler/diffing s'applique directement à `project` (ne muter que le changé) ; l'ECS = modèle mûr pour « plusieurs producteurs écrivent un état, un système le rend » (→ écrivains multiples du PersoState : solve/capture/geste) |
| **Projection** (substrat abstrait) | **Adapter/Bridge (GoF)** ; **backend abstraction / HAL** ; **tagless-final / interpréteurs** | *Capability negotiation* : un backend déclare ce qu'il sait faire → confirme « measure optionnel par substrat » |
| **Scrubbing** (debounce + cache segment) | **Debounce/throttle** ; **LOD temporel** (approché en mouvement, précis à l'arrêt) ; mémoïsation à invalidation par intervalle | Le LOD a des heuristiques éprouvées pour *quand* basculer approché↔précis (étage lourd debouncé) |
| **Straps async / materialize / seek** | **Event sourcing** ; **CQRS** ; **actor model** | Gisement le plus riche — voir ci-dessous |
| **Moteur solve pur** (interpolation) | Courbes de Bézier/Penner ; keyframe interpolation ; splines | Déjà emprunté à anime (algos purs) |

## Les trois ancrages à plus fort rendement

### A. Event sourcing / CQRS — pour materialize / seek / `f(t)`

Le rattachement le plus fort. **Event sourcing** = « l'état n'est pas stocké, il est dérivé d'un *log*
d'events ; on rejoue/projette le log ». C'est **littéralement** la matérialisation : les straps
produisent des events écrits dans les tracks (le log) ; l'état à `t` = **projection** du log ; le seek =
**replay** ; `f(t)` = projection à un instant. **CQRS** = séparer le *write model* (play : les straps
émettent) du *read model* (seek : l'état projeté) — exactement play vs seek.

Solutions matures pour les cas ouverts V2 :
- **snapshots** (matérialiser des états intermédiaires pour ne pas rejouer depuis 0) = optimisation du
  seek + lecture de segment ;
- **projection** (dériver un read-model du log) = `f(t)` ;
- **correction d'historique** (invalider un event passé) = le cas seek-back (`onSeekBack`) ;
- **projection idempotente vs side-effect** (event sourcing distingue *projeter* de *déclencher*) =
  exactement « relire une sortie ≠ ré-exécuter un strap ».

Le vocabulaire seul (event store, projection, snapshot, read/write model) rigoriserait les specs.

### B. Scene graph + dirty-flagging — pour le solve hiérarchique & le seek-FLIP

30 ans de techniques pour composer une hiérarchie transformée efficacement (Unity, Three.js, le DOM).
Le **dirty-flagging** (un nœud modifié marque ses descendants "dirty", on ne recompose que le dirty) est
**précisément** l'optimisation cherchée pour le seek-FLIP sous ancêtres mobiles — la version établie et
complète du mécanisme de coupe-par-reflow. Le **tri topologique** nomme l'ordre « parents avant
enfants » du solve hiérarchique. La **matrix caching** nomme la composition d'ancêtres.

### C. FRP — Behavior vs Event — pour typer le PersoState

Voir focus détaillé ci-dessous. En bref : la distinction continu/discret découverte empiriquement dans
`f(t)` **est** le fondement de la FRP, avec une théorie de composition déjà faite.

---

## Focus — Behavior vs Event (FRP)

Distinction fondatrice de la programmation fonctionnelle réactive (Conal Elliott, *Functional Reactive
Animation*, 1997). Elle sépare **deux natures de "valeur qui change dans le temps"** que le sens commun
confond — exactement la séparation redécouverte empiriquement dans `f(t)`.

### Behavior — valeur CONTINUE, définie à tout instant

```
Behavior a  ≈  (Time → a)
```

Une **fonction du temps** : valeur à **n'importe quel `t`**, sans trou. Position d'un item, couleur en
cours d'interpolation, opacité pendant un fade. On peut l'**échantillonner** (`sample`) à un `t`
arbitraire.
- interrogeable partout (`behavior(t)` toujours défini) ;
- pas d'identité d'occurrence (« la position à 3.7s » = un point d'une fonction, pas un événement) ;
- composable analytiquement (`positionComposée = parent ∘ enfant` = le solve hiérarchique).

→ **C'est l'étage `solve`.** Les interpolations sont des behaviors. `capturePersoStatesMirror` qui
"évalue l'état à t" **est** `sample(behavior, t)`.

### Event — valeur DISCRÈTE, à instants ponctuels

```
Event a  ≈  [(Time, a)]   -- suite d'occurrences datées
```

(Au sens FRP ; apparenté mais ≠ l'event runtime codplay.) Une **suite d'occurrences ponctuelles**, PAS
de valeur "entre". Clic, `emit`, déclenchement de strap, `move`.
- défini seulement aux instants d'occurrence ;
- a une identité d'occurrence (chaque occurrence = un fait daté distinct) ;
- ne s'échantillonne pas — se **filtre** / se **replaye** (itérer sur les occurrences ≤ t).

→ **C'est la catégorie "effets / straps / emissions"** — le non-interrogeable de `f(t)`, rejoué/filtré.

### Le pont — les combinateurs décrivent TES mécanismes

- **`stepper : a → Event a → Behavior a`** — transforme des occurrences discrètes en behavior EN
  ESCALIER (« la valeur reste celle de la dernière occurrence jusqu'à la suivante »). **C'est
  littéralement la fenêtre de validité.** Un `move` (event) → `placement(t)` (behavior escalier) via
  `stepper`. La réversibilité gratuite vient de ce que le behavior produit est interrogeable à tout `t`.
- **`snapshot/sample : Behavior a → Event b → Event (a,b)`** — au moment où un event tick,
  échantillonne un behavior. **C'est exactement la capture** : le geste live tick (event) →
  échantillonne l'état (behavior) → occurrence `persist-only`. La capture EST un `snapshot` FRP.
- **`accumulate/foldp`** — dérive un behavior de l'accumulation d'events (fold sur le passé) = ce que
  le seek fait en rejouant, = la "projection" de l'event sourcing.

### Pourquoi ça résout un problème ouvert — la dichotomie devient un TYPE

`f(t)` disait « état visuel = interrogeable ; effets = rejoués ». La FRP en donne la raison **typée**,
garantie **par construction** :

> Ce qui est interrogeable à tout `t` **est** un Behavior. Ce qui est ponctuel/rejoué **est** un Event.
> Ce ne sont pas deux traitements qu'on choisit — ce sont **deux types**, et le type détermine si une
> donnée s'échantillonne ou se rejoue.

Typer le `PersoState` en **Behaviors** (position, style, opacité…) et le reste en **Events** (emissions,
straps) rend **impossible par le type** de les confondre : la capture ne peut pas échantillonner un
event, le seek ne peut pas rejouer un behavior. La discipline `f(t)` (straps jamais rejoués, sorties
relues) cesse d'être une convention à tenir — elle devient une **propriété du système de types**. C'est
le gain concret pour la V2.

### Limite honnête

La FRP "pure" (Elliott) a un coût : échantillonnage naïf de behaviors composés coûteux ; temps continu
idéalisé vs frames discrètes (les FRP modernes — Reflex, push-pull — ont réintroduit du discret pour la
perf). Donc : emprunter la **distinction de types (Behavior/Event) et les combinateurs** comme
vocabulaire et invariants, **pas le moteur FRP**. Même règle que partout.

---

## Où se situe codplay V2 parmi ces familles

**Codplay V2 ne se superpose à AUCUNE référence — il occupe un croisement que peu de projets habitent.**
Ce n'est pas un signe qu'il réinvente la roue : c'est le signe qu'il adresse un objet — *une scène
spatio-temporelle animée, interactive, éditable ET rejouable frame-exacte, portable multi-substrat* —
qu'aucune lib mono-facette ne couvre.

### La formule

> **Codplay V2 = le modèle de rendu de Flutter** (retained-mode, substrat abstrait, composants par
> plateforme = la Projection) **+ le modèle temporel de l'event-sourcing** (état = projection d'un log
> d'events, seek = replay, `f(t)`) **+ la réactivité de la FRP** (behaviors continus / events discrets
> typés) — **appliqués à la scène animée et interactive.** Aucune des trois briques n'est neuve ; leur
> **assemblage sur le même objet** est rare.

### Le croisement — ce que chaque famille NE fait pas

| Famille | A | N'a PAS |
|---|---|---|
| **React / Flutter / SwiftUI** | déclaratif dans l'**espace**, substrat abstrait | pas de temps de 1er ordre (`t` implicite = « maintenant » ; pas de `f(t)`, pas de seek/segment) |
| **Theatre.js / GSAP / After Effects** | déclaratif dans le **temps** (timeline, seek, `f(t)`) | pas réactif (timeline **fermée** ; pas de straps, pas d'interaction qui réécrit l'histoire) |
| **Moteurs de jeu / ECS** | état ≠ rendu, temps réel | pas de reproductibilité par seek (simulent **en avant**, pas rejouables frame-exact par évaluation) |
| **Event sourcing / CQRS** | temps, log, replay, projection | domaine **données**, pas rendu visuel animé |

Codplay V2 est à l'**intersection de ces quatre absences** : déclaratif espace **ET** temps ; réactif
(straps) **ET** reproductible (seek/`f(t)`) ; rendu visuel **ET** event-sourcing du live. Chaque
référence en occupe *une facette* ; codplay les compose parce que son objet l'exige.

### Le parent technique vs le parent spirituel

- **Parent technique le plus proche : Flutter.** Même architecture de rendu (retained-mode), même
  frontière cœur/plateforme, même composants-par-substrat = Projection. **Modèle à étudier pour
  l'implémentation de solve/project et de la Projection.** Différence : Flutter n'a pas le temps de 1er
  ordre — codplay ajoute l'axe temporel que Flutter n'a pas.
- **Parent spirituel : Elm + event-sourcing.** L'obsession de la pureté, du « moins d'état », de la
  reproductibilité déterministe, de « l'état dérivé jamais accumulé » — c'est l'ADN Elm/event-sourcing
  plus que React (qui a hooks, état local mutable, effets). La réticence aux stores, « `f(t)` = moins
  d'état », l'insistance déterministe : sensibilité **Elm**.

### La lucidité (le positionnement dit aussi les DETTES à ne pas hériter)

Se rapprocher d'une famille = savoir quoi étudier ET quoi **ne pas** copier :
- de **Flutter/React** : ne pas hériter l'état local mutable des composants ni le `t` implicite (codplay
  veut `t` explicite et composants sans état propre) ;
- de **Theatre.js/timelines** : ne pas hériter la timeline fermée (codplay est réactif) ;
- de **l'event-sourcing** : ne pas hériter l'immuabilité totale ni le replay-depuis-0 coûteux (la
  matérialisation + `f(t)` les évitent déjà — d'où snapshots/évaluation plutôt que replay pur) ;
- de la **FRP** : ne pas hériter le moteur continu coûteux (emprunter les types, pas l'échantillonnage
  naïf).

Codplay V2 n'est donc « un React de plus » ni « un Theatre.js de plus » : c'est ce qu'on obtient en
prenant au sérieux, **simultanément**, les trois exigences (espace déclaratif, temps rejouable,
réactivité) que ces familles traitent séparément.

## Ces modèles aiguillent l'ÉCRITURE, pas seulement le vocabulaire

Chaque référence induit des décisions de code **vérifiables** (types, signatures, invariants-tests),
pas une ambiance. Exemples : FRP → les *types* `Behavior<T>`/`EventStream<T>` du `PersoState` (la
discipline « straps jamais rejoués » devient non-compilable à violer) ; event-sourcing → la séparation
`appendEvent` (write) / `project(log,t)` (read pure) + `kind: 'state'|'effect'` + snapshots (= lecture
de segment) ; scene-graph → `worldTransform` avec **dirty-flag** (remplace le « remonter au stable »
ad-hoc du seek-FLIP) ; reconciler → `project` qui **diffe** (le « un seul set » devient un set par
delta). Méthode : pour chaque module, emprunter les **types + signatures + invariants** du modèle qui
le gouverne (pas son runtime), transcrire les invariants en **tests**, refuser explicitement les
**dettes** (§ lucidité : état mutable React, replay-depuis-0, échantillonnage FRP naïf).

**Corollaire (durci 2026-07-26)** : appliquer ces modèles suppose une réécriture totale. Les
spécifications, contrats et tests V1 restent la référence comportementale et les oracles de V2,
mais aucun code du runtime V1 ne doit être réemprunté dans le chemin d'exécution V2 — les types de
base changent de forme, et un module V1 mutatif serait une « pièce rapportée ».

## EN RÉSERVE — prochaine étape possible (non écrite)

**Esquisse des types + invariants du `PersoState`** dérivée de FRP (Behavior/Event) et de la frontière
solve/project : le premier morceau *écrit* de la V2, au seul niveau contrat/types (aucun runtime), pour
tester concrètement si ces références aiguillent l'écriture. **Mise en réserve à la demande de l'auteur**
(2026-07-26) — l'auteur doit d'abord réfléchir à l'ensemble ; franchir ce pas quitterait la phase
projet pour le contrat de code. Ne pas l'écrire sans feu vert explicite.

## Limite de l'ancrage ECS

L'ECS est un modele de comparaison pour la separation donnees/traitements et pour
l'organisation de systemes specialises. Il ne constitue pas une architecture cible
pour CodPlay. Un `Perso` est une unite semantique de scene, avec une declaration,
une timeline, une hierarchie et une projection; une entity ECS est principalement un
identifiant auquel des composants de donnees sont attaches.

La reduction `Perso -> Entity`, `style -> ECS component`, `solve -> ECS system`
perdrait la semantique du perso, la distinction Behavior/Event, la rejouabilite de
`f(t)` et la frontiere entre etat logique et substrat. Elle favoriserait aussi un
etat mutable parcouru par plusieurs systemes, en tension avec la projection
deterministe et l'unicite des ecrivains.

CodPlay peut emprunter a l'ECS des idees locales — responsabilites de traitement,
ordre par dependances, dirty flags et donnees compactes dans les boucles chaudes —
sans introduire de registre ECS ni de runtime d'entites. Voir la note dediee
`2026-08-01-codplay-n-est-pas-un-game-engine.md`.

## Statut

Mise en correspondance conceptuelle, non engageante. Vocabulaire ET aiguillage d'écriture (types/
signatures/invariants), pas des frameworks à importer. Rendement décroissant : Event sourcing/CQRS (A) >
Scene graph/dirty-flag (B) > FRP Behavior/Event (C, focus ci-dessus). Lié :
`2026-07-16-solve-project-moteur-custom.md`, `2026-07-26-etat-fonction-de-t.md`,
`2026-07-26-seek-flip-ancetres-mobiles.md`, `2026-07-26-conduite-chantier-v2.md` (§1 réécriture totale).
