# CodPlay V2 — plan d’intégration du composant scroll-container

> Statut : **A relire** — ce plan doit être validé avant toute modification de
> packages/codplay.
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
- [capture-authoring-plan.md](./capture-authoring-plan.md) ;
- [2026-09-23-scroll-driven-animations-analysis.md](./notes/2026-09-23-scroll-driven-animations-analysis.md).

La note d’analyse fournit les décisions de conception du domaine. Le présent
plan les transforme en tranches de code, de tests et de validation. Le plan ne
peut passer à Fixe qu’après résolution des gates de la section 5 et accord
explicite sur les décisions proposées.

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
│  └─ persist optionnel → trajectoire → event persist-only
└─ IntersectionObservationProvider
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

## 3. Périmètre de la première tranche

### Inclus

- `AbstractLiveSourceProvider`, interne au module externe optionnel, pour le
  cycle de vie commun et l’invalidation des callbacks tardifs ;
- ScrollProgressProvider et IntersectionObservationProvider ;
- le type auteur et le composant optionnel scroll-container ;
- validation, sanitation, compilation et requirements du composant ;
- une surface HTML player-locale typée pour le scrollport ;
- un adaptateur HTML de source qui installe le listener scroll, les observers,
  la coalescence et la queue ;
- émission des transitions par RuntimePlayer.emit() ;
- le pont bêta `scroll-temp-capture-bridge`, limité à l’adaptation de la
  source scroll vers `RuntimePlayer` et le contrat `capture` existant ;
- persistance optionnelle par `endCapture`, avec la seule extension de la sortie
  live `trackCommand` vers `actions` ;
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
provider générique n’est ajouté au catalogue core.

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

Chaque règle possède :

- l’identité compilée du perso porteur et une identité interne générée à partir
  du chemin de déclaration et de l’ordre ; ces identités ne sont pas des champs
  supplémentaires de la déclaration ;
- un seuil unique ;
- les options natives de zone autorisées ;
- les sorties enter et leave déjà déclarées.

La phase est réduite à inside ou outside. Le premier callback synchronise cette
phase sans émettre d’event ; une phase inchangée n’émet rien. Une transition
ultérieure valide est traitée dans l’ordre de déclaration, puis envoyée à
RuntimePlayer.emit() avec le temps logique capturé avant l’entrée dans la queue.
Les events suivent le journal, listen, les straps et les actions ordinaires
existants.

Le provider ne conserve jamais IntersectionObserverEntry, DOMRect ou node DOM
dans un event et ne capture pas automatiquement la géométrie ou progress. Les
données éventuelles restent celles des `AuthorEmitEvent` déjà déclarés.

Les observers qui partagent exactement le même root et les mêmes options sont
mutualisés. La phase reste propre à chaque cible et à chaque règle.

### 4.4 Déclaration auteur du composant

La première surface auteur proposée est :

~~~ts
type ScrollContainerInitial = Readonly<{
  markup: string
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
  zone?: Readonly<{
    rootMargin?: string
    scrollMargin?: string
    threshold?: number
    trackVisibility?: boolean
  }>
  enter?: readonly AuthorEmitEvent[]
  leave?: readonly AuthorEmitEvent[]
}>
~~~

Le markup fournit la racine du composant et doit contenir une racine
explicitement identifiée, par exemple
<section id="chapter-scroll-root"></section>. La racine matérialisée est le
scrollRoot ; le composant n’impose ni hauteur ni overflow. Le contenu et les
cibles restent des persos descendants déclarés dans la même story.

La déclaration d’observation est portée par le `emit.observe` du perso observé,
et non par l’initialisation du conteneur :

~~~ts
emit: {
  observe: {
    zone: { threshold: 0.5 },
    enter: [{ name: 'chapter:card:enter' }],
    leave: [{ name: 'chapter:card:leave' }],
  },
}
~~~

`delay` n’est pas exposé dans cette bêta : c’est une temporisation native de
notification sans contrat CodPlay propre pour le replay ou le seek.

Lorsque `root` est présent, il référence l’identité logique existante d’un
scroll-container parent ; il ne crée ni id de cible ni référence DOM. En son
absence, le provider retient le premier parent scroll-container.

La variante `observe` du contrat `emit` est consommée par le provider
IntersectionObserver ; l’adaptateur d’events ordinaires l’ignore. `enter` et
`leave` réutilisent la forme `AuthorEmitEvent` existante. Le conteneur ne porte
plus de tableau d’observations ni de référence vers le perso observé. Cette
variante est exclusive de `event`/`capture` sur la règle concernée ; la règle
`emit.scroll.capture` du conteneur reste la déclaration de progression.

Cette forme ajoute une branche ciblée à `AuthorEmitRule` et à sa forme
compilée : `observe` est compilé avec le perso qui le porte et son chemin de
déclaration. Le codec et l’adaptateur `Perso.emit` doivent la reconnaître sans
la faire passer dans le dispatch d’un event DOM ordinaire. Il s’agit d’une
extension structurelle de `emit`, pas d’une nouvelle API live. Elle implique
uniquement l’extension de la sortie live de `trackCommand` vers `actions` ; le
contrat de fin et de persistance de `capture` reste inchangé.

La bêta n’ajoute pas de champ `persist`, `maxKeyframes` ou de liste d’actions
de relecture au profil. La persistance est activée uniquement par la présence
d’un `endCapture` dans la déclaration `capture` existante.

### 4.5 Progression bêta : réemploi du contrat `capture`

`Perso.emit` est l’unique interface auteur de la bêta pour déclarer la source
scroll. La clé `scroll` est le trigger de cette source ; son bloc `capture`
réutilise le contrat existant qui transmet déjà une valeur à une action. Il
n’existe donc pas de propriété `live`, de port d’action live ou de seconde
forme de déclaration à ajouter :

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
  → résolution de la surface scroll-root et des cibles
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
- après le commit du seek, une nouvelle branche peut commencer ;
- une éventuelle trajectoire persistée est relue par le circuit capture
  existant, jamais par le viewport courant ;
- sequence:end annule la session temporaire avant l’annulation technique des
  sources ;
- la destruction annule la session temporaire, puis déconnecte les observers
  et invalide la queue.

Le runtime actuel expose un destroy() synchrone tandis que la fermeture d’un
event peut traverser un dispatch asynchrone. La stratégie de flush au teardown
est une gate obligatoire : elle doit préserver la surface publique actuelle ou
faire l’objet d’une décision explicite avant toute modification de façade.

## 5. Gates avant implémentation

Les points suivants doivent être acceptés avant de passer le plan à Fixe :

1. les providers progress et IO sont frères sous le propriétaire commun du
   scroll-container ;
2. `AbstractLiveSourceProvider` appartient au module externe optionnel ; elle
   n’est ni une classe du core, ni une API publique, ni un registre de providers ;
3. le progress bêta passe par le cycle `capture` existant et sa sortie de fin ;
   la seule extension de ce contrat est la collection d’actions live ;
4. `scroll-temp-capture-bridge` est interne, explicitement temporaire et n’est
   pas exporté comme API ;
5. `IntersectionObserver` utilise exclusivement `RuntimePlayer.emit()` et ne
   passe pas par capture ;
6. le contrat des events de fin, `endCapture`, le journal et le seek restent
   inchangés ; le contrôleur et le résolveur ne changent que pour distribuer la
   collection d’actions live ;
7. la coexistence d’une session scroll et d’une capture existante est testée ;
8. toute régression de capture invalide la bêta et impose le retrait du pont ;
9. le type scroll-container et sa surface sont enregistrés comme capacité
   optionnelle, sans modification du catalogue core ni registre de providers ;
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

Tant que ces gates ne sont pas validées, aucune classe runtime, aucun nouveau
type de composant et aucune démo ne doit être ajouté.

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

Créer src/runtime/components/scroll-container/ avec :

- scroll-container-component.ts ;
- scroll-container-types.ts ;
- scroll-container-validation.ts ;
- index.ts.

Le composant dérive de BaseHTMLComponent, déclare les services HTML déjà
existants et publie une surface player-locale ScrollContainerSurface. Cette
surface fournit le scrollport interne à l’adaptateur ; elle ne devient pas une
API de façade ni une sortie auteur.

Enregistrer le composant et le module uniquement par les registries optionnels
`CodPlayEngineOptions.components` et `CodPlayEngineOptions.modules`. Ne pas
modifier `createCoreRuntimeCatalog` et ne pas charger la capacité lorsqu’elle
n’est pas enregistrée. Étendre la map des surfaces et le résolveur de
composants uniquement pour cette capacité typée. Aucun accès direct au runner
ou au catalogue depuis le composant.

Acceptance : un scroll-container est compilable, validé, matérialisé et
détruit comme les autres composants HTML ; ses racines persistent pendant seek,
detach et reparentage ; sa surface disparaît au teardown final.

### Tranche 4 — compilation des déclarations

Étendre src/scene/compiled avec un deriveur ciblé qui :

- valide le perso porteur, son premier parent scroll-container et la référence
  `root` optionnelle lorsqu’elle est présente ;
- conserve les identités de règles et l’ordre des déclarations ;
- réutilise la forme d’event V2 existante pour enter et leave ;
- compile la branche `emit.observe` sans la faire passer dans les règles
  d’events DOM ordinaires ;
- conserve les déclarations `emit`/`capture` existantes pour le pont bêta ;
- dérive les requirements du composant et de ses modules ;
- refuse les nodes DOM, callbacks natifs et providers externes dans l’artefact ;
- conserve une forme JSON-safe et immutable.

Acceptance : les erreurs de cible, de seuil, de visibilité et de persistance
produisent les diagnostics prévus ;
aucune validation n’est reportée au chemin chaud du player.

### Tranche 5 — adaptateur HTML du module et raccord player

Créer dans le module externe un adaptateur HTML dédié, instancié à la frontière
`HtmlPlayerRunner` déjà utilisée par les sources HTML, qui compose les deux
providers :

- résolution de la surface scroll-root et des cibles persistantes à partir du
  perso porteur de chaque déclaration `emit.observe` ;
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

Acceptance : un faux IntersectionObserver vérifie le root, les options, le
partage, la phase, la queue et le teardown ; un test HTML vérifie qu’un scroll
alimente l’action capture sans event par sample et qu’un enter/leave apparaît
dans le journal par le circuit normal.

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

- construit une longue surface dans un scroll-container ;
- rend visible une projection de progress obtenue par les actions de capture ;
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
module de démo.

## 7. Matrice de validation

### Tests purs et compilation

- formule progress, bornes, absence d’overflow, axes et coalescence ;
- phase IO, initialisation, seuil, visibilité, transitions répétées et partage ;
- validation/sanitation du profil ;
- compilation, extraction des fonctions, codec et requirements ;
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
- ajouter la branche `emit.observe` à `AuthorEmitRule`, `CompiledEmitRule` et
  leurs codecs ;
- compiler l’observation depuis le perso porteur, avec root implicite égal au
  premier parent scroll-container et `root` optionnel limité à un parent ;
- conserver `enter` et `leave` sous la forme event existante ; ne pas ajouter
  `initial`, `snapshot` ou `delay` ;
- faire ignorer les règles `observe` par l’adaptateur d’events DOM ordinaires ;
- produire les diagnostics de portée, root, seuil, options et branchement
  invalide avant le chemin chaud du player.

### Composant et capacité optionnelle

- créer le composant `scroll-container`, ses types, sa validation, sa surface
  player-locale et sa définition d’enregistrement ;
- enregistrer composant et module uniquement par
  `CodPlayEngineOptions.components` et `.modules` ;
- ne pas modifier `createCoreRuntimeCatalog`, le catalogue core ou ajouter un
  registre générique de providers ;
- vérifier materialisation, seek, detach, reparentage et destruction de la
  racine et de la surface.

### Module externe et providers

- créer l’entrypoint du module scroll externe optionnel ;
- y placer `AbstractLiveSourceProvider`, avec attach/detach/destroy idempotents,
  invalidation des callbacks tardifs, coalescence et fermeture ;
- implémenter `ScrollProgressProvider` : lecture scroll, formule [0, 1], axes,
  resize, overflow nul et dernière valeur par présentation ;
- implémenter `IntersectionObservationProvider` : targets issues de
  `emit.observe`, zone autorisée, mutualisation, phases et ordre des
  transitions ;
- exclure de leurs sorties tout node DOM, `IntersectionObserverEntry`, `DOMRect`
  et toute donnée native non sérialisable.

### Adaptateur HTML et pont temporaire

- créer l’adaptateur à la frontière `HtmlPlayerRunner`, sans player, catalogue
  ou journal parallèle ;
- résoudre le scrollport et les cibles persistantes après materialisation ;
- installer listener scroll, observers, queue unique et teardown ;
- envoyer exclusivement les transitions IO par `RuntimePlayer.emit()` ;
- raccorder `scroll-temp-capture-bridge` à
  `beginCompiledCapture`/`trackCapture`/`endCapture`/`cancelCapture` ;
- transmettre le progress aux `actions` live sans event par sample ;
- conserver `endCapture` comme seul point de persistance scroll ;
- annuler le pont au seek, `sequence:end`, détachement, destruction et échec ;
- retirer le pont lorsque le contrat durable capture/live remplace explicitement
  ce raccord et que la non-régression capture est démontrée. Toute régression
  impose son maintien ou son retrait de la bêta.

### Démo et validation

- créer et enregistrer la démo `scroll-container` dans le layout V2 existant ;
- vérifier progress, actions multiples, observations enter/leave, fermeture
  `endCapture`, pause, seek, resize et destruction ;
- exécuter les tests purs, compilation/codec, runtime capture, adaptateur HTML,
  démo position, nouvelle démo, typecheck, build et contrôles navigateurs ;
- mettre à jour la spécification et le suivi avant tout passage à `Fini`.

## 9. Suivi

- [ ] gates d’architecture acceptées ;
- [ ] spécification scroll-container créée et marquée Fixe ;
- [ ] module externe scroll enregistré comme capacité optionnelle sans
      modification du catalogue core ;
- [ ] `scroll-temp-capture-bridge` validé comme contournement temporaire ;
- [ ] non-régression capture validée avec la suite existante ;
- [ ] sortie live `actions: [{ name, data }]` intégrée et validée ;
- [ ] consommateurs V2 de `trackCommand` adaptés ;
- [ ] providers source-agnostiques implémentés et testés ;
- [ ] composant, catalogue, surfaces et compilation intégrés ;
- [ ] adaptateur HTML raccordé au player ;
- [ ] fermeture `endCapture` validée pour la bêta ;
- [ ] démo V2 enregistrée et validée ;
- [ ] tests, typecheck, build et navigateurs exécutés ;
- [ ] spécification et suivi mis à jour avant passage à Fini.

Le statut reste A relire jusqu’à validation explicite de ce plan. Aucun code
du core, aucune classe de provider, aucun composant et aucune démo ne doit être
créé avant cette validation.
