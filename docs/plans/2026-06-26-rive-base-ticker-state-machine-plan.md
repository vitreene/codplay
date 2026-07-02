# Plan - `rive-base` aligne sur le ticker CodPlay avec state machine integree

## Statut

Proposition de plan a valider avant implementation.

## Reference externe

- Rive low-level API usage : `https://rive.app/docs/runtimes/web/low-level-api-usage`

Cette doc confirme le flux low-level cible:

- charger le runtime/WASM
- charger le fichier `.riv`
- instancier `Artboard`, `StateMachineInstance`, `LinearAnimationInstance` selon le besoin
- dans la boucle de rendu: avancer les instances, avancer l'artboard, dessiner, puis resoudre la frame
- detruire explicitement les instances creees (`delete()`)

Pour une state machine, l'ordre de base est:

- `stateMachine.advance(sec)`
- `artboard.advance(sec)`
- `draw(renderer)`

## Contexte

Le package `packages/authoring/components/rive` est deja branche au ticker CodPlay via un hub
`RenderAdapter`:

- `tick(info)` delegue a `instance._tick(info)`
- `prepareSeek()` delegue a `instance._prepareSeek()`
- `seek(info)` delegue a `instance._seek(info)`
- `rateChange(rate)` delegue a `instance.setRate(rate)`
- `stop()` delegue a `instance._stop()`

Points constates dans le code actuel:

1. `RiveBaseComponent` gere l'artboard et le draw frame par frame, mais pas la state machine comme
   capacite moteur de premier rang.
2. La state machine n'existe aujourd'hui que dans `CoachRiveComponent`, via
   `StateMachineService`, donc comme une specialisation locale, pas comme une partie canonique du
   moteur Rive sous CodPlay.
3. Le composant continue d'etre avance a chaque `tick()` tant que l'instance est vivante; les
   actions `broadcast.START/PAUSE/STOP` ne pilotent pas encore un vrai etat de playback moteur.
4. `prepareSeek()` reset les services internes, mais ne garantit pas un reset complet et
   deterministe de l'etat interne Rive de la state machine.
5. Le nettoyage low-level n'est pas complet: les instances creees cote runtime Rive ne sont pas
   explicitement detruites (`delete()`), contrairement a la recommandation Rive.
6. Le point positif a conserver est deja en place: le runtime Rive n'a pas son propre RAF et la
   frame se termine par `runtime.resolveAnimationFrame()`, ce qui est compatible avec une boucle
   pilotee par CodPlay.

## Probleme

`rive-base` pilote deja une partie du moteur via le ticker CodPlay, mais la state machine reste une
capacite "a part", branchee localement dans `rive-coach`.

Consequence:

- la boucle moteur est eparpillee entre base et specialisation
- `seek()` et `stop()` ne garantissent pas encore une reconstruction propre de l'etat state machine
- `START` / `PAUSE` / `STOP` n'ont pas encore une semantique de playback unifiee sur tout le
  moteur Rive
- le package `rive` n'offre pas encore un socle propre pour d'autres composants Rive reposant sur
  une state machine, hors cas `coach`

## Objectif

Faire de `rive-base` le socle canonique d'un moteur Rive entierement pilote par CodPlay:

- ticker unique = ticker CodPlay
- rate unique = rate CodPlay
- seek unique = cycle `prepareSeek()` / replay / `seek()` de CodPlay
- state machine integree au meme cycle moteur que l'artboard
- composants specialises (`rive-coach`) reduits a leur logique domaine (mapping viseme/emotion),
  pas a l'orchestration bas niveau du moteur

## Perimetre

Dans le scope:

- `packages/authoring/components/rive/src/rive-base-component.ts`
- `packages/authoring/components/rive/src/coach-rive-component.ts`
- `packages/authoring/components/rive/src/services/state-machine-service.ts`
- `packages/authoring/components/rive/src/rive-context.ts`
- `packages/authoring/components/rive/src/rive-types.ts`
- `packages/authoring/components/rive/src/create-rive-binding.ts`

Hors scope a ce stade:

- ajout d'un nouveau composant auteur Rive hors `rive` / `rive-coach`
- support d'animations lineaires Rive si elles ne sont pas deja utilisees
- refonte generale de l'API `ThirdPartyBinding`
- refonte du preload Rive au-dela des besoins directs du chantier

## Principe de conception

1. Le ticker CodPlay reste l'unique source d'avancement temporel.
2. La state machine ne doit plus etre traitee comme une logique annexe specifique a
   `rive-coach`, mais comme une capacite moteur Rive de premier rang.
3. Le composant specialise ne doit garder que la traduction domaine → inputs Rive.
4. Le seek doit etre deterministe: `play@t == seek@t` pour l'etat Rive visible.
5. Toute instance low-level Rive creee par le composant doit etre nettoyee explicitement.

## Cible d'architecture

### Etat cible du cycle moteur

Le cycle d'une instance Rive doit devenir:

- `update()` recoit un payload CodPlay
- le composant route les cles specifiques vers les services / inputs Rive
- `tick(info)` avance la state machine active s'il y en a une
- `tick(info)` avance ensuite l'artboard
- `tick(info)` dessine la frame
- `prepareSeek()` remet l'etat interne a une baseline propre
- `seek(info)` dessine l'etat deja reconstruit par le replay CodPlay

### Cible sur les roles

- `RiveBaseComponent`: cycle de vie, contexte Rive, rate, draw, playback state, reset/cleanup
- `StateMachineService`: encapsule une `StateMachineInstance` complete, pas juste un helper
  d'inputs
- `CoachRiveComponent`: mapping domaine (`viseme`, `emotion`) vers les inputs de la state machine

### Option de structure retenue

Deux options existent:

1. Integrer `stateMachine?` directement dans `RiveBaseComponent`
2. Introduire un niveau intermediaire `RiveStateMachineComponent` entre `RiveBaseComponent` et
   `CoachRiveComponent`

Decision retenue pour ce chantier: **option 2**.

On introduit donc un niveau intermediaire `RiveStateMachineComponent` entre `RiveBaseComponent` et
`CoachRiveComponent`. Cette structure garde `RiveBaseComponent` simple (artboard + render loop) et
rend explicite la couche qui ajoute la state machine au moteur.

## Etapes proposees

1. **Etendre les types low-level internes Rive**

   Completer `rive-context.ts` pour decrire correctement les instances creees et nettoyees:

   - `StateMachineInstance`
   - eventuels types d'inputs plus precis (`number`, `boolean`, `trigger`) si disponibles
   - surfaces `delete()` requises sur renderer / artboard / state machine instance

   Objectif: ne plus piloter la state machine a travers des duck types trop faibles orientes
   uniquement vers `asNumber()`.

2. **Refactorer `StateMachineService` en participant moteur complet**

   Le service doit devenir responsable de:

   - creation de la `StateMachineInstance`
   - `advance(sec)`
   - resolution des inputs par nom
   - `reset()` avec retour a une baseline propre
   - `destroy()` avec `delete()` de l'instance low-level

   Point a trancher pendant implementation:

   - soit `reset()` sait remettre l'instance dans un etat propre
   - soit le service doit recreer l'instance au reset/seek pour garantir le determinisme

3. **Introduire une couche composant pour la state machine**

   Ajouter un niveau explicite entre base et coach, par exemple `RiveStateMachineComponent`, qui:

   - etend `RiveBaseComponent`
   - lit `initial.stateMachine`
   - instancie `StateMachineService`
   - l'enregistre via `_addService()`
   - expose un acces protege pour les composants domaine qui ont besoin d'inputs nommes

   Objectif: faire de la state machine une capacite moteur standard, pas une logique locale a
   `CoachRiveComponent`.

4. **Introduire un vrai etat de playback moteur par instance**

   Ajouter un etat explicite du type:

   - `idle`
   - `playing`
   - `paused`
   - `stopped`

   Regles cibles:

   - `START` passe l'instance en `playing`
   - `PAUSE` passe l'instance en `paused`
   - `STOP` passe l'instance en `stopped` et reset l'etat moteur
   - `_tick()` n'avance que si l'etat est `playing`

   But: aligner la semantique Rive sur les autres moteurs sous CodPlay.

5. **Brancher proprement `broadcast` sur le moteur Rive**

   Aujourd'hui, `broadcast.START/STOP` est traite seulement dans `CoachRiveComponent`, et de facon
   incomplete.

   Le composant Rive doit implementer une semantique commune:

   - `START`: autoriser l'avance au tick
   - `PAUSE`: figer sans perdre l'etat courant
   - `STOP`: reset services + reset/recreation de la state machine + redraw baseline

   Ce comportement doit vivre dans la couche commune Rive, pas dans la seule specialisation
   `coach`.

6. **Rendre `prepareSeek()` / `seek()` deterministes pour la state machine**

   Cible seek:

   - `prepareSeek()` nettoie tout etat continu interne avant replay CodPlay
   - le replay d'events rehydrate les inputs/services
   - `seek()` materialise exactement l'etat reconstruit, sans interpolation

   Point critique:

   - si l'API Rive ne fournit pas de reset fiable de la `StateMachineInstance`, alors
     `prepareSeek()` devra recreer l'instance de state machine, voire le contexte artboard
     complet si necessaire

   Cette etape est la cle pour eviter une state machine qui "continue sa vie" a part du replay
   CodPlay.

7. **Conserver la regle CodPlay de rate sans double application**

   Le composant Rive doit continuer a suivre la regle `v1-render-adapter-spec.md` /
   `v1-rate-spec.md`:

   - moteur sans multiplicateur natif effectif -> utiliser `deltaMs * rate` via `_rate`
   - ne pas appliquer une seconde fois le rate dans la state machine ou ailleurs

   La state machine et l'artboard doivent etre avances par le meme `sec` deja scale.

8. **Completer le cleanup low-level avec la bonne temporalite**

   Le nettoyage low-level n'est **pas** a declencher agressivement a chaque `STOP`.

   Regle retenue:

   - un `STOP` remet l'instance a sa baseline fonctionnelle, mais ne detruit pas encore les objets
     low-level si la sequence n'est pas terminee
   - le cleanup destructif est preconise **apres l'event `sequence:end`**, ou a la destruction
     finale / unmount du composant
   - cette regle vaut comme politique generale pour les autres bibliotheques tierces egalement,
     pas seulement pour Rive

   Donc, au cleanup final seulement, detruire explicitement:

   - renderer
   - state machine instance
   - artboard instance si la surface low-level utilisee en cree une dedicacee par composant

   Point important:

   - le `file` precharge reste gere par le cache preload et ne doit pas etre detruit par une
     instance composant individuelle tant qu'il est partage
   - il faut eviter qu'un `STOP` fasse perdre des ressources ou instances encore utiles avant la
     fin effective de la sequence

9. **Amincir `CoachRiveComponent`**

   Une fois la couche state machine factorisee, `CoachRiveComponent` ne doit plus faire que:

   - recuperer les inputs nommes (`lips sync id`, `emotion`)
   - brancher les services domaine (`VisemeLipSyncService`, `EmotionService`)
   - router les cles domaine de `update()` vers ces services

   Il ne doit plus porter la responsabilite de l'orchestration moteur Rive.

10. **Mettre a jour les types auteur Rive**

   `rive-types.ts` doit refleter la cible:

   - `RiveInitial`
   - `RiveStateMachineInitial`
   - `RiveActionPayload`
   - `CoachRiveActionPayload`

   Eventuels enrichissements a prevoir si le chantier fait emerger de nouveaux champs auteur
   necessaires pour piloter le playback/state machine proprement.

## Verification attendue

Tests a prevoir ou ajuster:

1. **Tick pilote par CodPlay**

   - sans `START`, l'instance n'avance pas
   - avec `START`, la state machine et l'artboard avancent a chaque `tick()`

2. **Pause / resume / stop**

   - `PAUSE` fige la frame sans reset
   - `START` apres `PAUSE` reprend proprement
   - `STOP` remet l'instance a sa baseline

3. **Seek**

   - apres un `seek(t)`, l'etat visible est identique a l'etat obtenu apres lecture jusqu'a `t`
   - les inputs state machine reappliques par replay sont bien pris en compte

4. **Rate**

   - `setRate(2)` accelere le moteur sans double application du rate
   - `setRate(0.5)` ralentit de facon coherente

5. **Nettoyage**

   - destruction sans fuite evidente d'instances Rive low-level
   - pas de reuse d'instance stale apres `stop()` / remount

6. **Non-regression domaine coach**

   - `viseme` continue de piloter `lips sync id`
   - `emotion` continue de piloter l'input associe

## Risques / points a trancher avant codage

- **Reset fiable de state machine**: il faut verifier si une recreation d'instance est necessaire
  pour garantir `play@t == seek@t`, ou si un reset local suffit
- **Surface low-level reelle de `@rive-app/canvas`**: confirmer les methodes `delete()` et la forme
  exacte des inputs disponibles
- **Artboard partage vs instance dediee**: s'assurer que l'artboard manipule par un composant est
  bien isole par instance et ne partage pas un etat mutable cross-component via le cache preload
- **Semantique `START` initiale**: decider si un composant Rive doit commencer en `stopped` ou en
  `paused` avant le premier `broadcast.START`
- **Temporalite du cleanup final**: verifier ou brancher proprement le cleanup sur `sequence:end`
  ou sur la destruction finale effective du composant/binding, sans introduire de destruction trop
  precoce

## Criteres de succes

- la state machine participe au meme cycle moteur que l'artboard, sous le ticker CodPlay
- aucun RAF propre Rive n'existe
- `prepareSeek()` / `seek()` reconstruisent un etat deterministe
- `START` / `PAUSE` / `STOP` pilotent reellement le moteur Rive
- `CoachRiveComponent` ne porte plus l'orchestration moteur, seulement la logique domaine
- les instances low-level creees sont explicitement nettoyees au bon moment, apres `sequence:end`
  ou destruction finale, pas prematurement sur simple `STOP`

## Ordre recommande

1. etendre `rive-context.ts`
2. refactorer `StateMachineService`
3. introduire la couche state machine commune
4. ajouter le playback state (`playing` / `paused` / `stopped`)
5. brancher `broadcast`
6. corriger seek/reset deterministe
7. ajouter cleanup `delete()`
8. amincir `CoachRiveComponent`
9. ecrire/adapter les tests
