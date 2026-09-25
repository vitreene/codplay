# CodPlay V2 — plan d’intégration du composant scroll-container

> Statut : **Fixe** — décisions validées le 2026-09-24 ; implémentation en
> cours.
>
> Date : 2026-09-23
>
> Portée : providers de valeurs vivantes du scroll, composant scroll-container,
> observation IntersectionObserver, persistance optionnelle et fixture de démo
> V2.

## Autorité et dépendances

Ce document ordonne l’intégration ; il ne constitue pas encore une
spécification normative. Il applique les invariants de :

- [codplay-v2-plan.md](./codplay-v2-plan.md) ;
- [player-engine-plan.md](./player-engine-plan.md) ;
- [compiled-scene-plan.md](./compiled-scene-plan.md) ;
- [capture-authoring-plan.md](./capture-authoring-plan.md).

Ce plan et la spécification ciblée
[`../specs/scroll-container-spec.md`](../specs/scroll-container-spec.md) portent
les décisions actives. La note d’analyse du 2026-09-23 est obsolète et ne doit
pas être utilisée pour interpréter ou étendre ce contrat. Les gates de la
section 5 ont été validées le 2026-09-24 ; les tranches et leur validation
restent à réaliser.

## 1. Objectif

Introduire une première capacité CodPlay V2 qui :

1. matérialise un composant auteur scroll-container possédant un scrollport ;
2. publie une valeur continue progress normalisée dans [0, 1] ;
3. transmet cette valeur, en bêta, au circuit d’actions de capture sans écrire
   un event pour chaque sample ;
4. observe des descendants avec IntersectionObserver et produit des events
   ordinaires par transitions enter/leave ;
5. permet, en bêta, de fermer une activité scroll par le `endCapture` existant
   lorsque la persistance est déclarée ;
6. traverse les circuits V2 existants : build, CompiledScene, catalogue,
   player, materializer HTML, journal et démo V2.

La capacité doit rester une portée de géométrie et de présentation. Le scroll
ne devient ni l’horloge CodPlay, ni une collection d’events par notification
native.

## 2. Décision d’architecture

Les déclarations sont conjointes dans le même scroll-container, mais les
providers sont associés sous un propriétaire commun et ne dépendent pas l’un de
l’autre :

~~~text
scroll-container (propriétaire commun)
├─ ScrollProgressProvider
│  ├─ scroll → progress → emit.scroll.capture → CaptureAction[]
│  ├─ scrollend → endEmit → dernière valeur progress affichée
│  └─ persist optionnel → trajectoire → event persist-only
└─ IntersectionObservationProvider
   ├─ IntersectionObserver → ratio → observe.liveAction → input.data.ratio
   └─ IntersectionObserver → phase → enter/leave → RuntimePlayer.emit()
~~~

La relation formelle porte sur :

- l’occurrence du composant ;
- le même scrollRoot ;
- le même player et les mêmes registres player-locaux ;
- le même cycle d’attachement, de pause, de seek et de destruction ;
- la même queue d’émission pour les events d’observation.

Il n’existe pas de relation de données progress → IntersectionObserver ou
IntersectionObserver → progress. L’observer ne s’abonne pas au listener
scroll, progress ne produit pas les transitions d’intersection, et un event
enter/leave ne démarre ni n’arrête persist. La bêta ne fait pas entrer la
valeur progress dans les events d’observation ; cela reste le circuit distinct
du progress et de capture.

Le cycle de vie commun est porté par `AbstractLiveSourceProvider`, fourni par
le module externe optionnel de la capacité scroll. Cette classe est interne à
ce module ; elle n’est pas une primitive du core runtime. Les providers restent
des providers frères :

- ScrollProgressProvider utilise la sortie de publication de valeur et peut
  produire les samples consommés par le pont capture temporaire ;
- IntersectionObservationProvider utilise la sortie d’event discret et ne
  possède pas de trajectoire ;
- un adaptateur HTML compose les deux sous le propriétaire du composant.

### Frontière de matérialisation

Le raccord des sources HTML appartient à `runner-html`, pas au contrat commun
des modules CodPlay. Le hook est une factory d’adaptateur propre à
`HtmlPlayerRunner`, alimentée par la composition de l’hôte HTML. Il ne devient
pas une propriété de `RuntimeModuleServiceDefinition` ou de
`RuntimeModuleServiceContext`.

Le package optionnel scroll fournit séparément ses définitions de composant et
de module runtime, enregistrées dans le catalogue, et sa factory d’adaptateur
HTML, enregistrée auprès de l’hôte HTML. Le catalogue, `RuntimeEngine`,
`RuntimePlayer`, `CompiledScene` et leurs modules génériques ne dépendent ni de
`HtmlPlayerRunner`, ni de `HTMLElement`, ni d’un nœud DOM ou d’une surface
spécifique au scroll. Le canal générique des surfaces reste inchangé et ne
transporte pas cette racine HTML. La dépendance va du package d’intégration HTML
vers les ports existants de CodPlay et vers le contrat spécifique de
`runner-html`; aucune dépendance ne remonte de CodPlay vers le package optionnel.

`HtmlPlayerRunnerOptions` accepte une liste ordonnée de factories de sources
HTML. La façade HTML les reçoit dans une option dédiée de `CodPlayOptions`
(`htmlHost.sourceAdapterFactories`) et les transmet par `createInstanceHost` ;
cette option reste séparée de `CodPlayEngineOptions`, qui ne reçoit que les
définitions runtime. Chaque factory produit un adaptateur attaché à un player
par l’hôte.

Ce hook est générique aux sources HTML optionnelles : tout module qui a besoin
d’une source navigateur peut fournir une factory à l’hôte HTML. Il ne crée pas
de hook générique de module et n’étend pas les responsabilités des modules
runtime ; le scroll est le premier consommateur externe prévu.

Le contrat `HtmlSourceAdapterFactory` est défini et exporté par le sous-chemin
`codplay/runtime/runner-html`. Son contexte en lecture est
limité à `CompiledScene`, une lecture de `SolvedScene` courant, l’état et le
temps du player, un résolveur HTML par identité de perso, et le rapport de
diagnostics. Son port de commande expose `emit`, les opérations de capture et
`setLiveActions(sourceId, actions)` pour les sorties live qui ne sont pas des
events. Le player résout ces noms par l’index compilé commun et applique leurs
états via `RuntimeComponentRuntime.updateLive()` ; le port ne reçoit aucun node
DOM. Le
runner notifie lui-même l’adaptateur après présentation, avant/après seek, aux
changements de lecture, à `sequence:end` et à la destruction. La factory ne
reçoit ni instance brute de `HtmlPlayerRunner` ou `RuntimePlayer`, ni catalogue,
ni registre mutable de nœuds. Les nœuds ne sont accessibles que par le
résolveur HTML spécifique au hook ; ils ne sont ajoutés ni à
`RuntimeComponentSurfaceMap`, ni à `RuntimeModuleServiceContext`, ni à
`CompiledScene`. Seule la composition de façade HTML (`CodPlayOptions`,
`createInstanceHost` et `HtmlPlayerRunner`) connaît ce contrat de hook. L’hôte
conserve la propriété du player, des matérialisations et du cycle de vie.

## 3. Périmètre de la première tranche

### Inclus

- `AbstractLiveSourceProvider`, interne au module externe optionnel, pour le
  cycle de vie commun et l’invalidation des callbacks tardifs ;
- ScrollProgressProvider et IntersectionObservationProvider ;
- le type auteur et le composant optionnel scroll-container ;
- validation, sanitation, compilation et requirements du composant ;
- résolution, par le hook `runner-html`, du nœud HTML matérialisé du
  scroll-container à partir de l’identité compilée du perso ;
- une factory d’adaptateur HTML, raccordée par le hook spécifique à
  `runner-html`, qui installe le listener scroll, les observers, la coalescence
  et la queue ;
- émission des transitions par RuntimePlayer.emit() ;
- le pont bêta `scroll-temp-capture-bridge`, limité à l’adaptation de la
  source scroll vers `RuntimePlayer` et le contrat `capture` existant ;
- persistance optionnelle de l’activité par `endCapture`, avec l’extension de
  sortie `trackCommand` vers `actions` et le stockage du dernier progress en
  `captureState` pour son event de fin ordinaire ;
- tests unitaires, runtime, compilation, adapter et intégration ;
- une démo enregistrée dans le layout et le registry V2.

### Exclus

- providers React, fetch, MIDI, capteurs, Sighty ou autres sources
  extérieures ;
- registre générique de providers ;
- état dynamique global publié dans un scope story ou scene ;
- progress du parcours d’un sujet, ViewTimeline ;
- commande position → progress ou progress → position ;
- scroll pilotant le temps CodPlay ;
- animation CSS autonome, ScrollTimeline ou ViewTimeline comme prérequis ;
- accès auteur à un node DOM ou à un callback IntersectionObserver brut ;
- démo autonome construisant son player, son catalogue ou son journal.

Les providers externes restent une contrainte de non-couplage pour cette
tranche. Ils feront l’objet d’un plan distinct lorsqu’un besoin Sighty réel
sera engagé.

Le module scroll est une capacité optionnelle : il est fourni hors du core et
enregistré par `CodPlayEngineOptions.modules` (avec la définition de composant
par `CodPlayEngineOptions.components`). Lorsqu’il n’est pas enregistré, le core
ne charge ni le composant, ni les providers, ni leurs observateurs. Aucun
provider générique n’est ajouté au catalogue core. La factory HTML se raccorde
séparément dans la composition de l’hôte HTML ; elle n’est ni un module de
catalogue supplémentaire ni une propriété de `CodPlayEngineOptions`. Le point
d’entrée public du hook est
`CodPlayOptions.htmlHost.sourceAdapterFactories`, transmis à
`HtmlPlayerRunnerOptions` par l’hôte ; il reste propre à la façade HTML.

## 4. Contrats à figer

### 4.1 Classe mère du module externe

`AbstractLiveSourceProvider` est implémentée dans le module externe optionnel
scroll. Elle n’est pas ajoutée à `packages/codplay/src/runtime`, n’est pas
inscrite dans `RuntimeModuleServiceContext` et ne devient pas une API d’auteur
ou une API publique du core. Elle ne connaît ni React, ni l’API DOM, ni
IntersectionObserver, ni le format de replay.

Le module est absent tant qu’il n’est pas enregistré par
`CodPlayEngineOptions.modules`. Le composant scroll est enregistré dans le
même montage optionnel par `CodPlayEngineOptions.components`. Le catalogue core
et `createCoreRuntimeCatalog` restent inchangés.

La définition du module runtime ne fabrique pas son adaptateur HTML et ne reçoit
aucun port DOM. Le package scroll exporte sa factory HTML séparément ; l’hôte la
fournit à `HtmlPlayerRunner` par
`CodPlayOptions.htmlHost.sourceAdapterFactories`.
`RuntimeModuleService` reste donc utilisable par un player sans materializer
HTML, tandis que l’adaptateur scroll ne s’exécute que dans un host HTML qui le
compose. Le composant ne publie pas de surface DOM par le résolveur générique de
surfaces ; le nœud HTML de sa racine n’est visible que via le résolveur du hook.

Responsabilités communes :

- identité de l’occurrence et propriétaire ;
- attach, detach et destroy idempotents ;
- génération d’attachement pour invalider les callbacks tardifs ;
- diagnostics ;
- ordre et coalescence des notifications ;
- fermeture contrôlée avant destruction.

La classe ne définit aucun nouveau port CodPlay de sortie et ne devient pas une
API générique « source → action ». Le module réutilise les frontières V2
existantes : le pont scroll utilise `RuntimePlayer` et `capture`, tandis que
l’observation utilise `RuntimePlayer.emit()`. L’adaptateur HTML du module est
raccordé à la frontière runner déjà utilisée par les sources HTML ; il ne
reçoit ni runner parallèle, ni catalogue parallèle, ni accès auteur à des nodes.

### 4.2 ScrollProgressProvider

Le provider reçoit un scrollport déjà résolu par l’adaptateur HTML et publie
une seule valeur locale progress :

~~~text
progress = clamp(scrollOffset / (scrollExtent - viewportExtent), 0, 1)
~~~

Invariants :

- valeur finie dans [0, 1] ;
- 0 lorsqu’il n’existe pas d’étendue scrollable ;
- axe block par défaut, inline explicitement sélectionnable ;
- calcul initial au montage ;
- recalcul après scroll, resize et invalidation de géométrie autorisée ;
- plusieurs notifications avant une même présentation réduites à la dernière ;
- aucune notification de progress n’est ajoutée au journal ;
- le provider reste attaché pendant une pause temporelle et peut continuer sa
  présentation via `emit.scroll.capture` sans avancer le temps CodPlay.

La formule et la réduction sont testées sans DOM avant le raccord HTML.

### 4.3 IntersectionObservationProvider

Le provider reçoit le scrollport et les déclarations `observe` compilées depuis
les `emit.observe` des persos descendants. La cible est le perso qui porte la
déclaration ; aucun champ de référence vers ce perso n’est ajouté. Le root est
implicitement le premier parent scroll-container. Une référence `root`
optionnelle peut désigner un autre scroll-container parent lorsque plusieurs
ancêtres sont possibles ; toute référence qui ne désigne pas un tel parent est
invalide. Une déclaration hors de toute portée scroll-container est invalide.

Chaque déclaration observe possède :

- l’identité canonique story/perso déjà portée par le perso ;
- les options de zone `rootMargin`, `scrollMargin`, `threshold` (nombre ou
  tableau) et `trackVisibility` ; `delay` reste exclu de cette tranche ;
- les sorties enter et leave déjà déclarées ;
- un `liveAction` optionnel qui désigne l’unique TweenAction de ce perso.

La phase est réduite à inside ou outside. Le premier callback synchronise cette
phase sans émettre d’event ; une phase inchangée n’émet rien. Une transition
ultérieure valide est traitée dans l’ordre de déclaration, puis envoyée à
RuntimePlayer.emit() avec le temps logique capturé avant l’entrée dans la queue.
Chaque event `enter` ou `leave` accepte `once?: true`. Sans cette option, chaque
transition l’émet ; avec elle, l’adaptateur l’émet une fois au plus pendant la
vie du player, seek compris. Les events suivent le journal, listen, les straps
et les actions ordinaires existants.

À chaque notification, si `liveAction` est déclaré, le player fournit le ratio
natif dans `input.data.ratio` et met à jour cette TweenAction par
`actionTargetIndex` et le circuit live partagé avec capture. Cette sortie n’est
pas un event, ne déclenche ni listen ni strap et n’est pas appliquée pendant la
présentation d’un seek. Les présentations normales reprennent la dernière
valeur reçue de la source live ; le journal ne contient pas de ratio.

Le provider ne conserve jamais IntersectionObserverEntry, DOMRect ou node DOM.
Il ne transmet pas ces valeurs dans un event. Seul `intersectionRatio`, si
`liveAction` est déclaré, arrive à la fonction ACE sous `input.data.ratio`.

Les observers qui partagent exactement le même root et les mêmes options sont
mutualisés. La phase reste propre à chaque cible et à chaque règle.

La déclaration directe `emit.observe` suit le perso porteur. Après la première
matérialisation, l’adaptateur remonte une fois la chaîne de parents logiques :
il choisit le scroll-container parent le plus proche, ou l’ancêtre nommé par
`root`. Un move ultérieur ne relance pas cette recherche dans cette première
tranche. Le premier callback synchronise la phase sans event. La cible et ses
ancêtres viennent du graphe logique résolu, jamais d’une recherche d’ascendance
DOM.

### 4.4 Déclaration auteur du composant

La première surface auteur proposée est :

~~~ts
import type { TagInitial } from 'codplay/runtime/components'

type ScrollContainerInitial = Omit<TagInitial, 'content'> & Readonly<{
  values?: Readonly<{
    progress?: Readonly<{
      axis?: 'block' | 'inline'
      range?: 'scrollport'
    }>
  }>
}>

type ScrollObservationDeclaration = Readonly<{
  /** Optional logical reference used only to disambiguate the scroll root. */
  root?: string
  /** Optional TweenAction on the observed perso, given input.data.ratio. */
  liveAction?: string
  zone?: Readonly<{
    rootMargin?: string
    scrollMargin?: string
    threshold?: number | readonly number[]
    trackVisibility?: boolean
  }>
  enter?: readonly (AuthorEmitEvent & Readonly<{ once?: true }>)[]
  leave?: readonly (AuthorEmitEvent & Readonly<{ once?: true }>)[]
}>
~~~

Le profil reprend le composant `tag` : `tag` décrit l’unique élément HTML
racine, avec les services `className`, `style` et `attr`. Le composant ne
contient pas de layout ni de champ `content`. La racine matérialisée est le
scrollRoot ; le composant n’impose ni hauteur ni overflow. Le texte et les
autres contenus restent des persos descendants déclarés dans la même story et
sont placés dans ce conteneur par leur `move.target`.

La déclaration d’observation est portée par le `emit.observe` du perso observé,
et non par l’initialisation du conteneur :

~~~ts
emit: {
  observe: {
    zone: { threshold: 0.5 },
    enter: [{ name: 'chapter:card:enter', once: true }],
    leave: [{ name: 'chapter:card:leave' }],
  },
}
~~~

`delay` reste exclu de cette bêta ; les autres options de zone suivent les
formes natives autorisées par la spec.

Lorsque `root` est présent, il référence l’identité logique existante d’un
scroll-container parent ; il ne crée ni id de cible ni référence DOM. En son
absence, le provider retient le premier parent scroll-container.

La clé directe `observe` de `emit` est consommée par le provider
IntersectionObserver ; l’adaptateur d’events ordinaires l’ignore. `enter` et
`leave` réutilisent la forme `AuthorEmitEvent` existante. Le conteneur ne porte
  plus de tableau d’observations ni de référence vers le perso observé. La clé
`emit.observe` est sa propre déclaration directe ; la règle
`emit.scroll.capture` du conteneur reste la déclaration de progression.

Cette forme ajoute `AuthorScrollObservationDeclaration` aux valeurs de
`AuthorEmitDeclaration` et `CompiledScrollObservation` à
`CompiledEmitDeclaration`. La clé directe `observe` est compilée avec le perso
qui la porte et son chemin de déclaration. Le codec et l’adaptateur
`Perso.emit` la reconnaissent sans la faire passer dans le dispatch d’un event
DOM ordinaire. Il s’agit d’une
extension structurelle de `emit`, pas d’un nouvel event. `observe.liveAction`
réutilise une action TweenAction compilée ; la capture scroll conserve son
extension distincte `trackCommand` vers `actions`. Le contrat de fin et de
persistance de `capture` reste inchangé.

La bêta n’ajoute pas de champ `persist`, `maxKeyframes` ou de liste d’actions
de relecture au profil. La persistance est activée uniquement par la présence
d’un `endCapture` dans la déclaration `capture` existante.

### 4.5 Progression bêta : réemploi du contrat `capture`

`Perso.emit` est l’unique interface auteur de la bêta pour déclarer la source
scroll. La clé `scroll` est le trigger de cette source ; son bloc `capture`
réutilise le contrat existant qui transmet déjà une valeur à une action :

```text
scroll sample
  -> RuntimeCaptureSample
  -> trackCommand({ sample, samples, captureState })
  -> RuntimeCaptureAction[]
  -> actionTargetIndex
  -> resolveLiveCaptureActionState()
  -> RuntimeComponentRuntime.updateLive()
```

La sortie live de `trackCommand` doit autoriser une collection ordonnée de
`RuntimeCaptureAction` dont chaque élément reprend la forme commune
`{ name, data? }` des events. `name` désigne une action déjà déclarée, comme
`event.name` désigne un event déclaré. Aucun event ne peut être retourné par
cette sortie continue : les events restent produits par `endEmit`, `endCapture`
ou par les providers discrets déclarés. `captureState` et `updateState` restent
inchangés dans le contrat capture général et ne font pas partie de l’extension
scroll.

L’observation géométrique utilise elle aussi le circuit player commun des
actions live, mais sans ouvrir de session capture : l’adaptateur fournit le nom
compilé et `data.ratio` par `setLiveActions`.

Pour l’usage scroll, l’absence de `trackCommand` produit un warning auteur et
le pont n’applique aucune action live et ne fabrique aucun remplacement. Cette
règle ne rend pas `trackCommand` obligatoire dans le contrat capture global :
les captures qui n’ont pas de commande live conservent leur fonctionnement de
fin de capture existant.

Le pont interne `scroll-temp-capture-bridge` est limité à l’adaptation de la
source :

1. il reconnaît une déclaration `capture` portée par `Perso.emit` sous le
   trigger temporaire `scroll` ;
2. au premier sample, il émet une seule fois l’event de début par
   `RuntimePlayer.emit()`, puis appelle `beginCompiledCapture()` ;
3. il transmet chaque sample utile par `trackCapture()` ;
4. il laisse `trackCommand` choisir les actions existantes par `name` et
   construire leurs `data`, dans l’ordre retourné ;
5. il appelle `endCapture()` à `scrollend`, ou `cancelCapture()` au seek, au
   détachement, à la destruction ou en cas d’échec.

Le pont ne cherche aucune cible, n’appelle jamais directement `updateLive()` et
n’ajoute aucun event pour chaque notification scroll. Il n’est ni exporté par
le core, ni présenté comme contrat V2. Son unique but est de valider le
fonctionnement scroll avec le circuit capture actuel.

Exemple de déclaration bêta illustrant l’extension explicite du résultat live
de capture :

~~~ts
emit: {
  scroll: {
    event: { name: 'chapter:scroll:start' },
    capture: {
      trackOn: ['scroll'],
      endOn: ['scrollend'],
      trackCommand: ({ sample }) => ({
        actions: [{
          name: 'chapter:progress',
          data: { progress: sample.progress },
        }],
      }),
      endCapture: ({ samples }) => ({
        events: [{
          name: 'chapter:scroll:end',
          data: { samples },
        }],
      }),
    },
  },
}
~~~

Le contenu de `data`, la fonction `trackCommand` et la sortie `endCapture`
restent ceux du contrat capture, avec l’extension explicite de la sortie live
vers `actions`. La rétention durable d’une trajectoire scroll
au-delà de ce contrat est hors de cette bêta ; elle ne justifie pas une
interface auteur parallèle dans la présente tranche.

### 4.6 Persistance pendant la bêta et contrat durable

Le circuit de journalisation et de seek existant reste la seule destination des
events persistants. Pendant la bêta :

- une activité scroll est une session bornée par le premier sample et sa fin
  (`scrollend`, détachement ou destruction) ;
- `trackCapture()` reste transitoire et n’ajoute aucun sample au journal ;
- `endCapture()` est le seul point qui peut produire un event `persist-only` ;
- la réduction éventuelle des samples est réalisée par la fonction
  `endCapture` existante ;
- aucune extension de `RuntimeCaptureSession`, aucun réducteur parallèle et
  aucun second chemin de journal ne sont ajoutés.

La session actuelle conserve ses samples jusqu’à sa fermeture. Une valeur
scroll ambiante sans borne ou une rétention bornée intégrée au core capture ne
fait donc pas partie de la bêta. Une évolution de la rétention ou de la
relecture devra être traitée dans un plan distinct, avec preuve de
non-régression du contrat capture ; elle devra partir de
`emit.scroll.capture`, pas créer une déclaration concurrente.

### 4.7 Cycle de vie

Le cycle attendu est :

~~~text
player.init()
  → materialisation du scroll-container
  → résolution HTML du nœud scroll-root et des cibles par le hook
  → attach progress + observers
  → play / pause / seek
  → pont scroll-temp-capture-bridge pendant l’activité
  → fermeture éventuelle par endCapture
  → detach observers + listener
  → player.destroy()
~~~

Règles :

- initialisation silencieuse de la phase IO par défaut ;
- aucune émission IO hors de playing ou pendant seek ;
- la phase IO peut rester synchronisée pendant une pause ;
- la progression issue de `emit.scroll.capture` peut continuer pendant une
  pause sans avancer t ;
- une reprise ne rejoue pas les transitions survenues pendant la pause ;
- le seek suspend la queue source et annule la session temporaire avant la
  reconstruction ;
- après le commit du seek, une nouvelle capture de progress peut commencer ;
- une éventuelle trajectoire persistée est relue par le circuit capture
  existant, jamais par le viewport courant ;
- le hook observe `sequence:end` dans le callback public d’event existant,
  après présentation et avant la finalisation terminale du player ; il annule
  la session temporaire avant l’annulation technique des sources ;
- la destruction annule la session temporaire, puis déconnecte les observers
  et invalide la queue.

Le runtime actuel expose un destroy() synchrone tandis que la fermeture d’un
event peut traverser un dispatch asynchrone. La stratégie de flush au teardown
est une gate obligatoire : elle doit préserver la surface publique actuelle ou
faire l’objet d’une décision explicite avant toute modification de façade.

## 5. Décisions acceptées avant implémentation

Les décisions suivantes ont été explicitement retenues pour cette tranche :

1. les providers progress et IO sont frères sous le propriétaire commun du
   scroll-container ;
2. `AbstractLiveSourceProvider` appartient au module externe optionnel ; elle
   n’est ni une classe du core, ni une API publique, ni un registre de providers ;
3. le progress bêta passe par le cycle `capture` existant et sa sortie de fin ;
   la seule extension de ce contrat est la collection d’actions live ;
4. `scroll-temp-capture-bridge` est interne, explicitement temporaire et n’est
   pas exporté comme API ;
5. les transitions `IntersectionObserver` utilisent `RuntimePlayer.emit()` et
   ne passent pas par capture ; `liveAction` transmet le ratio au circuit
   commun des actions live sans event ;
6. le contrat des events de fin, `endCapture`, le journal et le seek restent
   inchangés ; capture et observation partagent le contrôleur générique des
   actions live et l’index compilé ;
7. la coexistence d’une session scroll et d’une capture existante est testée ;
8. toute régression de capture invalide la bêta et impose le retrait du pont ;
9. le type composant et le module scroll-container sont enregistrés comme
   capacité optionnelle, sans modification du catalogue core ni registre de
   providers ; son nœud DOM reste dans `runner-html` ;
10. la déclaration `emit.observe` est portée par le perso observé ; sans `root`,
   le premier parent scroll-container est utilisé, et `root` ne peut désigner
   qu’un autre parent scroll-container ;
11. `trackCommand` retourne une collection ordonnée d’actions live ; il ne
   retourne jamais d’event ; `captureState` et `updateState` ne sont pas modifiés
   par cette extension ;
12. une valeur dynamique ne devient pas un état logique global ;
13. l’évolution durable de la rétention/relecture de `emit.scroll.capture`, la
   rétention longue, position, view-progress et providers externes restent
   hors tranche.
14. l’injection d’un adaptateur de source est spécifique à `runner-html` et
    reste hors de `RuntimeModuleServiceDefinition`, `RuntimeModuleServiceContext`,
    `RuntimeCapabilityCatalog`, `RuntimeEngine` et `CompiledScene` ;
15. le contexte transmis à une factory HTML ne donne que des ports de lecture,
    commande et cycle de vie bornés ; l’adaptateur ne reçoit pas le runner, le
    player ou les registres de matérialisation bruts ;
16. le hook de source ne constitue pas la modularisation de `move`/FLIP. La
    frontière abstraite de placement, capture, trajectoire et composition reste
    celle à concevoir dans la tranche V2.5.
17. l’observation est déclarée directement dans `emit.observe`, portée par le
    perso cible ; aucune référence auteur vers la cible n’est ajoutée ailleurs ;
18. le root logique est résolu une seule fois après la première matérialisation,
    depuis le parentage résolu ; un move ultérieur ne rebinde pas l’observation
    dans cette tranche, et le seek n’émet aucun event d’observation ;
19. `observe.liveAction` désigne l’unique TweenAction du perso observé ; chaque
    callback passe `intersectionRatio` sous `input.data.ratio`, sans event ni
    entrée de journal. Aucune action live n’est appliquée pendant la
    présentation d’un seek ;
19. `once?: true` se déclare sur chaque event `enter`/`leave` et verrouille cet
    event jusqu’à la destruction du player ; le seek ne le réarme pas ;
20. la zone reprend les options `rootMargin`, `scrollMargin`, `threshold` sous
    forme native nombre/tableau et `trackVisibility` ; `delay` reste exclu.

La note exploratoire du 2026-09-23 n’est pas une autorité pour cette
implémentation. Toute découverte d’un contrat V2 incompatible reste toutefois
un motif d’arrêt et de revue avant modification du comportement concerné.

## 6. Ordre d’implémentation après validation

### Tranche 1 — spécification et contrats purs

Créer la spécification ciblée
packages/codplay/specs/scroll-container-spec.md, puis aligner les types
suivants :

- PersoTypeRegistry et CorePersoType ;
- types auteur scroll-container ;
- extension explicite de la sortie live de `trackCommand` vers des actions
  multiples, sans sortie d’event continue ;
- branche `observe` compilée de `emit`, portée par le perso observé, et
  raccord des déclarations `emit`/`capture` existantes ;
- diagnostics auteur et runtime ;
- absence de toute interface auteur parallèle à `emit.scroll.capture` ;
- périmètre explicite du pont temporaire.

Acceptance : les formes valides et invalides sont testées sans DOM ; les
fonctions sont extraites par le builder ; aucune classe runtime n’est instanciée
pendant la compilation.

### Tranche 2 — classes source-agnostiques du module externe

Créer l’entrypoint du module externe optionnel scroll, hors de
`packages/codplay/src/runtime`, contenant, après validation des noms :

- abstract-live-source-provider.ts ;
- scroll-progress-provider.ts ;
- intersection-observation-provider.ts ;
- scroll-source-types.ts ;
- index.ts.

L’entrypoint exporte seulement les définitions d’enregistrement nécessaires au
composant et au module (`RuntimeComponentDefinition` et
`RuntimeModuleServiceDefinition`). `AbstractLiveSourceProvider` et ses
spécialisations restent internes à cette capacité ; aucune de ces classes
n’est ajoutée au catalogue core ni importée par `createCoreRuntimeCatalog`.

Les classes ne lisent pas le DOM directement. Les tests couvrent :

- cycle attach/detach/destroy idempotent ;
- invalidation des callbacks tardifs ;
- formule et clamp de progress ;
- axes block et inline ;
- coalescence ;
- phases IO, seuil unique et initialisation silencieuse ;
- transitions en double ;
- ordre déterministe de plusieurs règles ;
- données d’event limitées à la forme sérialisable existante.

### Tranche 3 — composant et catalogue

Dans le package optionnel `@codplay/component-v2`, créer
`src/scroll-container/` avec :

- scroll-container-component.ts ;
- scroll-container-types.ts ;
- scroll-container-validation.ts ;
- index.ts.

Le composant réutilise le profil `TagComponent` et son matérieliseur pour créer
un seul élément HTML racine. Il n’ajoute pas de layout ni de markup interne. Le
nœud qu’il fait matérialiser est le scrollport défini par le contrat auteur ;
les contenus sont des persos placés dans ce parent par `move.target`.
`runner-html` résout cette racine par l’identité compilée du perso avec le
résolveur fourni au hook. Ne pas créer de `ScrollContainerSurface` dans
`RuntimeComponentSurfaceMap`, ni modifier le résolveur générique pour y faire
transiter un node DOM.

Enregistrer le composant et le module uniquement par les registries optionnels
`CodPlayEngineOptions.components` et `CodPlayEngineOptions.modules`. Ne pas
modifier `createCoreRuntimeCatalog` et ne pas charger la capacité lorsqu’elle
n’est pas enregistrée. Ne pas étendre `RuntimeComponentSurfaceMap` pour le
scrollport. Aucun accès direct au runner ou au catalogue depuis le composant.

Acceptance : un scroll-container est compilable, validé, matérialisé et
détruit comme les autres composants HTML ; son nœud racine persiste pendant
seek et detach. Le port HTML du hook le trouve par son identité canonique de
perso sans exposer de node DOM à un contrat générique.

### Tranche 4 — compilation des déclarations

Étendre src/scene/compiled avec un deriveur ciblé qui :

- valide la forme directe de `emit.observe`, les options, les events et que
  `root` nomme un scroll-container de la même story ;
- conserve la déclaration compilée sous la clé directe `observe` de
  `CompiledEmitDeclaration` ;
- conserve l’identité du perso et l’ordre des events enter/leave ;
- réutilise la forme d’event V2 existante pour enter et leave ;
- compile la branche `emit.observe` sans la faire passer dans les règles
  d’events DOM ordinaires ;
- conserve les déclarations `emit`/`capture` existantes pour le pont bêta ;
- dérive les requirements du composant et de ses modules ;
- refuse les nodes DOM, callbacks natifs et providers externes dans l’artefact ;
- conserve une forme JSON-safe et immutable.

Acceptance : les erreurs de déclaration, de root inconnu, de seuil, de
visibilité et de branchement produisent les diagnostics auteur prévus. La
relation d’ascendance est vérifiée une fois sur le graphe résolu après la
matérialisation initiale ; aucune résolution ne tourne sur le chemin chaud des
présentations.

### Tranche 5 — adaptateur HTML du module et raccord player

Créer dans le package optionnel scroll une factory d’adaptateur HTML qui compose
les deux providers, puis la raccorder par le chemin
`CodPlayOptions.htmlHost.sourceAdapterFactories` → `createInstanceHost` →
`HtmlPlayerRunnerOptions.sourceAdapterFactories` :

> Décision de frontière ajoutée le 2026-09-24 : le hook appartient exclusivement
> à `runner-html`. La façade HTML le fournit séparément des définitions
> `RuntimeModuleServiceDefinition`. Il n’ajoute aucun champ à
> `CodPlayEngineOptions`, au catalogue, au contexte des modules ou à
> `CompiledScene`. Le contrat `HtmlSourceAdapterFactory` reçoit seulement les
> vues de scène, les ports player bornés, le résolveur HTML par perso, les
> diagnostics et les notifications de cycle de vie décrits en §2.

L’hôte compose ensemble la définition de composant, la définition de module
runtime et la factory HTML du package scroll. Il crée un adaptateur par player,
après l’initialisation réussie et la matérialisation initiale. Le runner appelle
ses notifications de cycle de vie aux frontières de présentation, seek,
lecture et destruction. Il observe `sequence:end` dans le callback d’event
public déjà présent, après présentation de l’event mais avant la finalisation
terminale du player, puis avertit l’adaptateur avant l’annulation technique des
captures. Le runner relaie ensuite l’event au callback public de l’hôte. Ce
raccord réutilise le callback d’event courant et ne crée pas de deuxième
circuit d’events. L’adaptateur ne résout pas les destinations de
`move`, ne modifie pas `SolvedScene` et ne prend pas possession du graphe motion.

- résolution unique du scroll-root et de la cible depuis le graphe logique du
  premier solve, à partir du perso porteur de `emit.observe` ;
- listener scroll passif ;
- lecture des dimensions et réduction de progress ;
- coalescence vers la dernière valeur de la présentation ;
- création et mutualisation des IntersectionObserver ;
- queue unique et ordre compilé des émissions ;
- appel exclusif à RuntimePlayer.emit() pour les events IO ;
- raccord du `scroll-temp-capture-bridge` à
  `beginCompiledCapture`/`trackCapture`/`endCapture`/`cancelCapture` ;
- branchement aux transitions init, pause, seek, sequence end et destroy ;
- diagnostic des options natives non supportées.

Le runner ne crée ni player parallèle, ni journal, ni catalogue local. La démo
ne reçoit pas l’adaptateur et ne manipule aucun node source.

Acceptance : un faux IntersectionObserver vérifie le root sélectionné (parent
le plus proche ou `root` explicite), les options, le partage, la phase, la
queue, `once` et le teardown. L’ancêtre n’est pas recherché à nouveau après un
move. Un test HTML vérifie qu’un scroll
alimente l’action capture sans event par sample et qu’un enter/leave apparaît
dans le journal par le circuit normal. Les tests d’architecture vérifient que
`RuntimeModuleServiceDefinition`, `RuntimeModuleServiceContext`, le catalogue,
`RuntimeEngine`, `RuntimePlayer` et `CompiledScene` ne dépendent d’aucun type
`runner-html` ou DOM, que `RuntimeComponentSurfaceMap` ne reçoit pas de surface
DOM, que seule la composition de façade HTML connaît le hook, et que le raccord
n’ajoute aucun circuit événementiel. Le test de lifecycle vérifie notamment
que la notification du hook à `sequence:end` précède la finalisation terminale
du player et le teardown technique des sources.

### Tranche 6 — fermeture bêta et observation de la limite capture

Utiliser `endCapture` sans modifier son contrat de fin :

- transmettre les samples scroll à la fonction de fin existante ;
- produire au plus un event `persist-only` à la fermeture ;
- annuler la session au seek, à `sequence:end`, au détachement et à la
  destruction ;
- ne pas ajouter de réducteur core, de mémoire parallèle ou de circuit
  supplémentaire.

Acceptance : l’event de fin est inséré une seule fois, aucun sample intermédiaire
n’entre au journal, une fermeture annulée ne produit rien et le comportement de
capture existant reste inchangé. La rétention longue et la fusion durable de
`live` avec `capture` sont consignées comme travail ultérieur, sans être
implémentées dans cette tranche.

### Tranche 7 — démo V2

Créer packages/demos/src/v2/demos/scroll-container/ avec une scène qui :

- présente un texte assez long pour nécessiter le défilement dans un
  scroll-container ;
- étend le scroll-container à toute la largeur et toute la hauteur disponibles
  dans la zone de scène ; le texte défile à l’intérieur de cette zone ;
- place une image au milieu du texte ; son cadre fixe déclare `emit.observe`
  et l’image contenue reçoit les actions `translateX` des events `enter` et
  `leave`. Le cadre reste en place pendant que l’image glisse, afin que
  l’animation ne déplace pas la cible de l’observer. Le root margin rapproche
  ces transitions du milieu visible du scrollport pour que les deux mouvements
  se voient ;
- permet de répéter le parcours : chaque nouvel `enter` et `leave` est un event
  ordinaire, sans `once` ;
- fait varier la couleur de fond de chaque étape selon son ratio visible avec
  `emit.observe.liveAction`, les seuils IO déclarés et l’interpolation ACE ;
  chaque étape a une teinte de départ différente, puis son angle H tourne
  selon le ratio en OKLCH, tandis que L et C restent fixes ;
- transforme les trois blocs « étape » en titres de trois chapitres : les six
  textes existants de `CHAPTER_PASSAGES` restent inchangés et sont répartis deux
  par chapitre ; chaque titre reste sticky pendant son chapitre, puis se libère
  à sa fin pour laisser le titre suivant prendre sa place ; l’image reste entre
  les deux textes du chapitre du milieu ;
- ne crée aucun event ni entrée de journal pour les mises à jour de ratio ;
- rend visible une projection de progress obtenue par les actions de capture ;
- conserve la dernière valeur de progress après `scrollend` : `trackCommand`
  la garde dans `captureState`, puis un unique `endEmit` normal la réapplique
  via l’action compilée ; aucun event n’est émis par sample ;
- déclare au moins deux règles IO avec seuils distincts ;
- affiche les events enter/leave dans le journal commun ;
- exerce l’event de fin `endCapture` lorsqu’il est déclaré ;
- expose les points Play, pause, Seek et reset via la télécommande commune ;
- reste limitée à la construction et aux données de scène.

Adapter également la démo V2 existante
`packages/demos/src/v2/demos/position/story-four.ts` : son
`trackCommand` doit passer de la forme singulière `action`/`actionName` à
`actions: [{ name, data }]`, en conservant ses sorties `captureState` et
`updateState`. Les démos V1 qui importent `codplay-v1` restent hors de cette
adaptation.

Ajouter une seule entrée au registry V2 et le style propre à la démo. Le layout,
la façade, le journal, la précharge et le cycle de vie restent ceux déjà
possédés par packages/demos/src/v2/layout.

Acceptance : la démo exerce le vrai runner HTML, le vrai player, le vrai
materializer et le vrai journal ; aucun comportement n’est simulé dans le
module de démo. En descendant, le texte défile et l’image entre latéralement ;
en remontant, elle se rétracte avant de quitter la zone visible. Répéter le
parcours produit de nouveau ces mouvements et les events correspondants dans le
journal commun. La barre conserve la dernière progression après chaque arrêt du
scroll et les présentations suivantes ne la remettent pas à zéro. Les trois
titres de chapitre restent sous la barre de progression pendant leur propre
chapitre ; à la fin d’un chapitre, son titre quitte le haut du scrollport et le
suivant prend sa place.

### Extension demandée — fond des étapes selon leur visibilité

> Statut : **Fixe** — décision validée le 2026-09-25 ; implémentation en cours.

La demande est de faire varier la couleur de fond de chaque étape selon la
proportion visible de son élément. `emit.observe.liveAction` nomme une action
déjà déclarée dans `actions` sur le même perso. À chaque notification de
`IntersectionObserver`, le player lui fournit `input.data.ratio`, égal au
`intersectionRatio` compris entre 0 et 1. L’action live emprunte l’index compilé
et le même circuit d’application live que les actions de capture. Le nombre de
notifications dépend des seuils déclarés dans `zone.threshold`.

Cette transmission ne crée aucun event et n’ajoute aucune entrée au journal.
`enter` et `leave` gardent leur contrat actuel. Les callbacks sont ignorés et
les actions live ne sont pas appliquées pendant la présentation d’un seek ; les
présentations normales reprennent la dernière valeur reçue de la source live.
La démo produit `style.backgroundColor` avec l’interpolation couleur ACE ; la
couleur ne dépend pas d’un calcul CSS. Les trois étapes utilisent des teintes
de départ distinctes en OKLCH et font chacune tourner H de 90 degrés au fil du
ratio, avec L et C constants.

## 7. Matrice de validation

### Tests purs et compilation

- formule progress, bornes, absence d’overflow, axes et coalescence ;
- phase IO, initialisation, seuil, visibilité, transitions répétées et partage ;
- validation/sanitation du profil ;
- compilation, extraction des fonctions, codec et requirements ;
- `emit.observe.liveAction` compilé et validé, ratio transmis dans
  `input.data.ratio`, sans event/journal et sans action pendant le seek ;
- changement de `style.backgroundColor` selon le ratio natif et la fréquence
  des seuils IntersectionObserver ;
- tableau ordonné de `CaptureAction` produit par `trackCommand` et absence
  d’event par sample ;
- adaptation et non-régression de la démo V2 position qui utilise la capture ;
- event de fermeture `endCapture` et annulation sans sortie.

### Runtime et intégration

- source attachée après materialisation et détachée avant teardown ;
- progress transmis par `scroll-temp-capture-bridge` aux actions déjà déclarées,
  sans event par sample ;
- events IO routés par RuntimePlayer.emit() ;
- listen/straps exécutés une seule fois pour un event IO ;
- coexistence d’une session scroll avec la capture pointer existante ;
- aucune modification de la résolution ni de la présentation des captures
  existantes ;
- pause sans avance de t ;
- seek qui annule la session scroll sans fermer une autre capture ;
- absence de fuite de listener, observer, queue ou node ;
- destruction idempotente.

### Navigateur et démo

- Chromium, Firefox et Safari ;
- viewport et scrollport ;
- resize et contenu sans overflow ;
- plusieurs observers compatibles et règles simultanées ;
- prefers-reduced-motion sans suppression des events sémantiques ;
- Play puis Seek au même temps ;
- typecheck, tests, build et git diff --check.

La démo n’est déclarée valide qu’après le passage du chemin runtime réel et des
tests de frontière. Un symptôme visuel doit d’abord être attribué au contrat ou
au runtime avant toute correction locale de fixture.

## 8. Liste fermée des actions

Cette liste constitue le périmètre complet de l’intégration. Aucune action
implicite ne doit être ajoutée pendant l’implémentation.

### Contrat capture et consommateurs existants

- amender `capture-authoring-plan.md` pour la sortie live ordonnée
  `actions: readonly { name, data? }[]` ; conserver les contrats `endEmit`,
  `endCapture`, journal et seek ; interdire toute sortie d’event depuis
  `trackCommand` ;
- aligner les types auteur et runtime, le clonage de session, le stockage des
  actions actives, leur résolution par l’index compilé et leur application dans
  le circuit `updateLive` existant ;
- fixer et tester l’absence de sortie live, l’ordre de plusieurs actions et
  leur remplacement sans introduire de circuit concurrent ;
- produire le warning auteur prévu lorsqu’une déclaration scroll ne fournit pas
  `trackCommand`, sans rendre cette fonction obligatoire pour tout `capture` ;
- adapter la démo V2 `position/story-four.ts` et les tests capture qui utilisent
  encore `action`/`actionName` ; laisser les démos V1 sur leur contrat
  `codplay-v1`.

### Contrat auteur et compilation scroll

- créer `scroll-container-spec.md` et y figer la surface `scroll-container` ;
- déclarer directement `emit.observe` sur le perso et conserver cette entrée
  dans `CompiledEmitDeclaration` ainsi que dans son codec ;
- compiler l’observation depuis le perso porteur, avec root implicite égal au
- premier parent scroll-container au solve initial, et `root` optionnel limité
  à un parent scroll-container ; ne pas recalculer au reparentage ;
- conserver `enter` et `leave` sous la forme event existante, avec `once?: true`
  optionnel par event ; ne pas ajouter `initial`, `snapshot` ou `delay` ;
- faire ignorer l’entrée `observe` par l’adaptateur d’events DOM ordinaires ;
- produire les diagnostics de portée, root, seuil, options et branchement
  invalide avant le chemin chaud du player.

### Ratio de visibilité vers une action live

- ajouter `liveAction?: string` à la déclaration auteur et compilée de
  `emit.observe` ; vérifier que le nom désigne une action du perso observé ;
- fournir `intersectionRatio` sous `input.data.ratio` à chaque mise à jour
  reçue par l’observer, y compris son premier callback ;
- passer par l’index compilé existant et le circuit player commun d’application
  des actions live, sans resolver local à l’adaptateur HTML ;
- ne pas créer d’event, d’entrée de journal ou de donnée de seek pour ce ratio ;
- faire suivre la couleur de chaque étape à son ratio visible dans la démo, au
  moyen de `style.backgroundColor` et d’ACE.

### Composant et capacité optionnelle

- créer dans `@codplay/component-v2` le composant `scroll-container`, ses types,
  sa validation, sa racine HTML player-locale et sa définition d’enregistrement ;
- enregistrer composant et module uniquement par
  `CodPlayEngineOptions.components` et `.modules` ;
- ne pas modifier `createCoreRuntimeCatalog`, le catalogue core ou ajouter un
  registre générique de providers ;
- ne pas ajouter `ScrollContainerSurface` à `RuntimeComponentSurfaceMap` ;
- vérifier materialisation, seek, detach et destruction de la racine par
  l’identité canonique du perso et le port HTML existant.

### Module externe et providers

- créer l’entrypoint du module scroll externe optionnel ;
- y placer `AbstractLiveSourceProvider`, avec attach/detach/destroy idempotents,
  invalidation des callbacks tardifs, coalescence et fermeture ;
- implémenter `ScrollProgressProvider` : lecture scroll, formule [0, 1], axes,
  resize, overflow nul et dernière valeur par présentation ;
- implémenter `IntersectionObservationProvider` : targets issues de
  `emit.observe`, zone autorisée, mutualisation, phases et ordre des
  transitions, et ratios destinés à l’action live facultative ;
- exclure de leurs sorties tout node DOM, `IntersectionObserverEntry`, `DOMRect`
  et toute donnée native non sérialisable.

### Adaptateur HTML et pont temporaire

- définir `HtmlSourceAdapterFactory` et son contexte uniquement dans
  `runner-html`, sans champ dans les contrats communs des modules ou de
  l’engine ;
- transmettre les factories par
  `CodPlayOptions.htmlHost.sourceAdapterFactories` et
  `HtmlPlayerRunnerOptions.sourceAdapterFactories`, hors de
  `CodPlayEngineOptions` ;
- créer l’adaptateur par player après materialisation et résoudre scrollport et
  cibles persistantes par les ports de lecture HTML ;
- fournir les opérations de player nécessaires par un port restreint, sans
  passer l’instance `RuntimePlayer` ou `HtmlPlayerRunner` ;
- réutiliser l’index compilé et le contrôleur générique des actions live pour
  remplacer, réappliquer et retirer les sorties d’une source ;
- installer listener scroll, observers, queue unique et teardown ;
- envoyer les transitions IO par `RuntimePlayer.emit()` et les ratios par
  `setLiveActions`, sans fabriquer d’events de ratio ;
- raccorder `scroll-temp-capture-bridge` à
  `beginCompiledCapture`/`trackCapture`/`endCapture`/`cancelCapture` ;
- transmettre le progress aux `actions` live sans event par sample ;
- conserver `endCapture` comme seul point de persistance de la trajectoire
  scroll ; l’`endEmit` existant peut rétablir la dernière valeur affichée sans
  enregistrer de sample ;
- annuler le pont au seek, `sequence:end`, détachement, destruction et échec ;
- retirer le pont lorsque le contrat durable capture/live remplace explicitement
  ce raccord et que la non-régression capture est démontrée. Toute régression
  impose son maintien ou son retrait de la bêta.

### Démo et validation

- créer et enregistrer la démo `scroll-container` dans le layout V2 existant ;
- vérifier progress, actions multiples, observations enter/leave, event unique,
  fermeture `endCapture`, pause, seek, resize et destruction ;
- exécuter les tests purs, compilation/codec, runtime capture, adaptateur HTML,
  démo position, nouvelle démo, typecheck, build et contrôles navigateurs ;
- mettre à jour la spécification et le suivi avant tout passage à `Fini`.

## 9. Suivi

- [x] gates d’architecture acceptées le 2026-09-24 ;
- [x] spécification scroll-container créée et marquée Fixe ;
- [x] définitions optionnelles du composant et module scroll, factory HTML et
      enregistrement de la démo implémentés hors du catalogue core ; validation
      runtime encore requise ;
- [x] `scroll-temp-capture-bridge` implémenté comme raccord temporaire ; sa
      validation runtime reste à faire ;
- [ ] non-régression capture validée avec la suite existante ;
- [x] sortie live `actions: [{ name, data }]` intégrée ; tests ciblés capture,
      player, runner HTML et compilation passés (54 tests) ;
- [x] consommateurs V2 de `trackCommand` adaptés ;
- [x] providers, composant, validation, compilation, codec, hook `runner-html`
      et adaptateur scroll implémentés ; `ScrollContainerComponent` réutilise
      `TagComponent` pour une racine unique, et les enfants sont placés par
      `move.target` ; les tests d’acceptation restent à exécuter ;
- [x] hook injecté par l’hôte HTML hors des options engine/catalogue, avec
      commandes player bornées ;
- [x] fermeture `endCapture` raccordée ; validation runtime encore requise ;
- [x] démo V2 enregistrée avec texte long, observation du cadre image et actions
      `translateX` répétables ; le meter de progress utilise le canal ACE
      `scaleX`, la dernière valeur est réappliquée à la fin de chaque capture,
      le scrollport remplit la zone de scène disponible ; la démo fournit les
      couleurs hex directement à `prepareTween`, qu’ACE normalise à la
      préparation ; Firefox confirme le montage et les transitions après Play ;
      validation navigateur complète encore requise ;
- [x] typechecks de `codplay`, `component-v2` et `demos`, ainsi que
      `git diff --check`, passés le 2026-09-25 ;
- [x] `emit.observe.liveAction` transmet le ratio via `input.data.ratio` au
      circuit commun des actions live ; typechecks passés le 2026-09-25 ;
- [x] les trois titres utilisent des teintes OKLCH de départ distinctes et font
      tourner H selon leur ratio visible, en gardant L et C constants ; validation
      navigateur encore requise ;
- [x] les trois titres étape regroupent les six passages inchangés en trois
      chapitres ; chaque titre reste sticky jusqu’à la fin de son chapitre et
      cède la place au suivant ; validation navigateur encore requise ;
- [ ] tests comportementaux, build et navigateurs exécutés ;
- [ ] spécification et suivi mis à jour avant passage à Fini.

Le statut reste `Fixe` pour les décisions et `En cours` pour l’implémentation
jusqu’à validation de toutes les tranches, mise à jour de la spécification et
preuve du chemin runtime réel.
