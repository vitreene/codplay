# Façade V2 — engine, instances et pilotage

## Statut

> Statut : En cours
> Version CodPlay : V2 foundation
> Contrat révisé le 2026-08-29 ; la base de façade est implémentée et le
> portage V1 de l’horizon ouvert est en cours de validation.

## Objet

Définir la frontière publique de CodPlay V2 pour :

- configurer les capacités communes ;
- créer un propriétaire `CodPlay`, son engine et son registre d'instances ;
- compiler séparément une `SceneDoc` en `CompiledScene` ;
- piloter une instance ;
- injecter des events dans une scène ;
- exposer les events publics produits par une instance ;
- utiliser l'assemblage HTML/DOM core sans faire entrer le DOM dans le cœur.

Le plan ne crée pas un second runtime. Les façades doivent déléguer aux briques
V2 existantes : `RuntimeCapabilityCatalog`, `RuntimeEngine`, `RuntimePlayer`,
`HtmlPlayerRunner` et la frontière interne `RuntimeMaterializer`. Cette dernière
n'est pas une option de la façade et ne permet pas de sélectionner un autre
substrat.

## Constat actuel

Les briques internes existent. L’assemblage public est engagé dans
`src/facade/`; la démo V2 commune l'utilise désormais :

| Brique | Rôle actuel | Limite actuelle |
|---|---|---|
| `RuntimeCapabilityCatalog` | registre unique des composants, services et modules | reste interne ; sa composition passe par la configuration de la façade |
| `RuntimeEngine` | ressources, horloge et ordre des instances ; transaction interne des seeks | est adapté par `EngineFacadeImpl` |
| `RuntimePlayer` | une scène compilée, lifecycle, events, capture et reconstruction | est adapté par `InstanceFacadeImpl` |
| `RuntimeMaterializer` | frontière interne de materialisation consommée par le runner HTML | n'est pas exposé dans les options d'instance et n'est pas sélectionnable par l'hôte |
| `HtmlPlayerRunner` | assemblage HTML, mouvement, capture pointeur et resize | reste interne à la façade ; le chemin public HTML/DOM est raccordé ; son `init()` est l'unique initialisation d'une instance |
| `RuntimeTelco` | adaptateur de pilotage local | branché sur les notifications du player, sans boucle propre |

`packages/demos/src/v2/layout/layout.ts` passe maintenant par la façade publique.
Il ne construit plus de catalogue et n'accède plus au runner.

## Références V2

- [`codplay-v2-plan.md`](./codplay-v2-plan.md) : catalogue composé à
  l’initialisation, séparation engine/player et assemblage HTML/DOM ;
- [`player-engine-plan.md`](./player-engine-plan.md) : frontière
  `CompiledScene -> Player`, horloge injectée, seek local et groupé ;
- [`notes/2026-07-28-decoupage-engine-instances-pilotage.md`](./notes/2026-07-28-decoupage-engine-instances-pilotage.md) : ressources
  partagées, instances, events comme contrat primaire, groupes et hôtes ;
- [`compiled-scene-plan.md`](./compiled-scene-plan.md) : compilation séparée
  du runtime et artefact immutable ;
- [`component-render-representation-plan.md`](./component-render-representation-plan.md) :
  materializer et séparation logique/substrat ;
- [`capture-authoring-plan.md`](./capture-authoring-plan.md) : injection
  source-agnostique et sorties de capture ;
- [`media-preload-plan.md`](./media-preload-plan.md) : preload externalisé,
  cache partagé et façade `run` autonome.

Pour l'accès d'authoring de l'éditeur, la référence comportementale est
[`v1-author-api-spec.md`](../../../docs/formalisation/v1-author-api-spec.md) :
elle fournit le vocabulaire des lectures d'authoring et des accès au nœud.
La cible V2 fixe la lecture d'état logique et l'écriture temporaire avant
materialisation ; le recours effectif au nœud HTML reste une capacité à vérifier
dans le chantier de reprise de l'éditeur.

## Référence V1 et adaptation V2

Sources V1 relues : [`PlayerApi`](../../codplay-v1/src/player/types.ts),
[`RendererApi`](../../codplay-v1/src/renderer/types.ts),
[`CodPlay`](../../codplay-v1/src/creator/creator-facade.ts),
[`PlayerFacade`](../../codplay-v1/src/player/create-player.ts),
[`RendererFacade`](../../codplay-v1/src/renderer/create-renderer.ts) et la
spécification [`Player API V1`](../../../docs/evolution/formalisation-archive/formalisation-modele-2026-05-06/45-player-api-v1.md).

| V1 | Décision de transposition V2 |
|---|---|
| `BuilderFacade` | reste une étape pure et séparée ; V2 l'expose sous `engine.builder.compile()` afin d'utiliser le catalogue configuré de cet engine, puis le runtime ne reçoit que `CompiledScene` |
| `CodPlay.load(SceneDoc)` | ne devient pas le chemin combiné V2 ; l'appelant compile explicitement avec `engine.builder.compile()` puis crée l'instance avec le résultat, sans mélanger compilation et instance |
| `PlayerFacade` / `PlayerApi` | devient la base de la façade d'instance : lifecycle, seek, events, observation |
| `RendererFacade.component/service/module` | est déplacée à la configuration de l'engine ; elle n'est plus exposée comme registre mutable du renderer ou de la démo |
| `RendererFacade` | est remplacée par la frontière interne de materialisation HTML/DOM ; aucun runner d'un autre substrat n'est ouvert en V2 |
| `CodPlay.telco` | devient la propriété `instance.telco`, qui regroupe le pilotage de l'instance sans posséder de chemin de commande parallèle |
| `onRuntimeEmit` | devient une sortie d'events V2 filtrée par le contrat de visibilité, et non une remontée de tout le journal interne |
| `ThirdPartyBinding` | devient une déclaration `foreign` de composant, service, module ou stratégie de preload selon la capacité concernée ; il ne fournit pas de materializer |

La V2 conserve les comportements utiles de V1, mais change les frontières : un
registre de capacités appartient à l'engine, une scène et son materializer
appartiennent à une instance, et un composant ne connaît jamais le catalogue.

## Modèle public proposé

Les exports et les regroupements ci-dessous constituent la surface arrêtée pour
la première implémentation de la façade.

```text
CodPlay
  ├─ configuration des capacités avant verrouillage
  ├─ accès explicite au service de preload
  ├─ registre de création, adressage et destruction des instances
  └─ engine
      ├─ compilation explicite via le builder lié au catalogue
      ├─ ressources partagées et source de temps
      ├─ avancement commun
      └─ diagnostics et observation des events de portée `public`

InstanceFacade
  ├─ une identité d'instance en lecture seule
  ├─ une racine HTML propre à l'instance
  ├─ propriété `telco` pour le lifecycle et le contrôle de scène
  ├─ propriété `events` pour l'injection et l'observation des events `public`
  └─ propriété `diagnostic` pour les diagnostics techniques
```

Le composant `layout` fait partie des composants core fournis par défaut. Quand
son template contient une zone `data-part`, cette zone peut être utilisée comme
cible par un autre perso. Toutes les zones du template sont publiées pour
`layout`, comme dans V1. La démo n'a donc pas à fournir une liste d'identifiants
ou à remplacer la définition du composant. Les composants qui gardent des zones
internes peuvent, eux, n'en publier qu'une sélection.

Les façades sont des adaptateurs de frontière. Elles ne réimplémentent ni
`materialize -> resolve -> solve`, ni le journal, ni les services, ni le graphe
de mouvement.

### Diagnostics et erreurs

Les erreurs de façade ne sont pas renvoyées sous la forme d'un résultat
`{ ok: false }`. Elles passent par la formalisation V2 existante et le
`DiagnosticCollector` de l'engine ou de l'instance concernée.

- une erreur qui empêche l'opération produit un diagnostic `error` ; l'opération
  est refusée ou interrompue et aucun état partiellement engagé n'est présenté ;
- une anomalie récupérable produit un diagnostic `warning` ; l'opération
  continue selon la règle prévue et aucun circuit de retour d'erreur n'est
  ajouté à la façade ;
- les diagnostics sont dédupliqués, rattachés à leurs références (`instanceId`,
  scène, story, perso, track lorsque disponibles) et exposés par
  `instance.diagnostic` ou la sortie configurée de l'engine.

Les méthodes peuvent conserver leurs retours normaux lorsqu'elles produisent
une donnée (`getState`, `getProgress`, création d'une instance, résultat de
preload). Ce retour normal ne devient jamais une enveloppe d'erreur. Un
adaptateur Sighty pourra agréger ou traduire les diagnostics dans son propre
protocole, sans modifier cette frontière CodPlay.

### Organisation des capacités d'instance

La règle de structure retenue pour l'instance est la même que pour `telco` :
une capacité d'instance possède une propriété dédiée. Les commandes et les
abonnements d'une même capacité ne sont donc pas ajoutés comme des méthodes
directes concurrentes sur `InstanceFacade`.

| Surface | Contenu | Justification de l'accès regroupé |
|---|---|---|
| `instance.telco` | lifecycle de lecture, temps, rate, progress publié et abonnements de la télécommande | une seule surface de commande, branchée sur le circuit de pilotage V2 |
| `instance.events` | injection d'un eventime et observation des events publics | l'event entrant et l'event sortant appartiennent au même contrat d'events, sans exposer le journal interne |
| `instance.diagnostic` | diagnostics techniques | cette capacité ne commande pas la scène et ne remonte pas les events publics |

Cette organisation s'applique aux capacités déjà prévues comme aux futures
capacités d'instance : une nouvelle capacité ne justifie pas l'ajout d'une
nouvelle méthode à plat. Les groupes `telco`, `events` et `diagnostic` sont
implémentés dans la façade publique.

La même convention de namespace s'applique à toute la façade : le nom de la
capacité porte le domaine et la méthode garde un nom local. Une méthode ne
répète donc pas dans son nom le domaine déjà porté par la propriété.

```text
const codplay = new CodPlay(options)
codplay.engine
codplay.preload
codplay.instances.create(options)
codplay.instances.get(instanceId)
codplay.instances.destroy(instanceId)
engine.resources.register(resources)
engine.events.emit(input)
engine.events.onEvent(listener)
```

Les opérations propres à l'objet `engine` restent directes lorsqu'elles ne
désignent pas une sous-capacité : `engine.start`, `engine.pause`,
`engine.stop`, `engine.advance` et `engine.destroy`.

La convention de namespace concerne l'adressage des capacités, pas
l'obligation d'extraire leurs méthodes. L'appel contractuel reste donc
`instance.telco.seek(timeMs)`, `instance.telco.play()` ou
`codplay.instances.create(options)`. Le seek n'est pas une méthode directe de
l'engine : la façade publique le porte par l'instance concernée.

Les accès qui restent directs sont limités à ce qui n'est pas une capacité
opérationnelle de l'instance :

- `instanceId`, valeur d'identité immuable utilisée pour l'adressage et les
  diagnostics ;
- les méthodes de coordination de l'engine (`start`, `stop`, `advance`), parce
  qu'elles concernent l'ordonnancement, et non une capacité interne d'une
  instance.

Le `CompiledScene`, le materializer, la racine et le contexte de substrat ne
sont pas des propriétés opérationnelles publiques de l'instance : ils sont
fournis à la création et restent encapsulés. `destroy` reste porté par
`codplay.instances.destroy()` afin que le propriétaire contrôle le teardown.

Il n'y aura donc pas de surface publique `instance.play()`, `instance.pause()`,
`instance.emit()`, `instance.beginCapture()` ou `instance.onDiagnostic()` en
parallèle des groupes ci-dessus. Une commodité à plat ne pourra être ajoutée
que si elle est démontrée comme un simple alias sans second circuit ; elle ne
fait pas partie de la cible actuelle.

## 1. Configuration de l'engine

### Responsabilités

Le propriétaire `CodPlay` configure, avant toute instance :

- les composants `core` déjà fournis ;
- les composants et capacités `foreign` ajoutés ou surchargés ;
- les services et leurs destinations de materialization ;
- les modules déclarés une fois et instanciés par player ;
- les ressources partagées et le cache de preload ;
- la source de temps : `frameScheduler` fourni à `CodPlay` pour son ticker
  interne, ou frames fournies par l'hôte via `advance()` ;
- la sortie des diagnostics ;
- le canal d'events sortants.

Les ajouts et overrides doivent être fournis à la façade pendant la
construction de `CodPlay`. La façade construit le catalogue unique, vérifie les
collisions puis le verrouille avant d'exposer l'engine et le registre
`codplay.instances` prêts à l'emploi.
L'appel interne de verrouillage n'est pas exposé au consommateur. Le
`RuntimeCapabilityCatalog` reste une dépendance interne : il n'existe pas de
registre public ni de mutation de catalogue après la création de l'engine.

### Invariants

- aucune mutation du catalogue après verrouillage ;
- toute tentative de `register` ou `override` après verrouillage est refusée ;
- aucun registre parallèle dans une démo, un runner ou un composant ;
- une définition de composant déclare ses services ;
- un module déclaré par l'engine est créé par instance ;
- les ressources partagées sont distinctes de l'état de chaque instance ;
- l'engine ne connaît ni DOM, ni racine de scène, ni `SceneDoc`.

La façade est l'unique entrée de composition du catalogue. Une démo ne peut
donc appeler ni `createCoreRuntimeCatalog`, ni `getComponent`, ni
`overrideComponent`, ni un constructeur runtime interne.

### API implémentée

La configuration de création doit fournir des groupes d'entrées équivalents à
`component`, `service` et `module` de V1 :

```text
new CodPlay({
  components: { register, override },
  services: { register, override },
  modules: { register, override },
  resources,
  frameScheduler,
})
  -> construit le catalogue
  -> construit le ticker interne depuis le scheduler hôte
  -> valide la configuration
  -> verrouille le catalogue en interne
  -> expose l'engine et le preload prêts à l'emploi
```

Les types et l'assemblage sont implémentés dans `src/facade/`. Une méthode
publique `engine.finalize()` n'est pas retenue : le catalogue est verrouillé
pendant `new CodPlay(options)` et ce détail reste interne. Le `TimeTicker` est
également construit à ce moment-là à partir du `frameScheduler` optionnel ; il
n'est pas exposé par le layout ou l'engine. Chaque instance
est assemblée par `HtmlPlayerRunner`, qui possède les détails de la
materialisation HTML/DOM. La façade ne reçoit pas de materializer et n'ouvre
aucun chemin de materialisation étranger.

L'initialisation publique délègue au runner complet : `createInstanceHost()` appelle
`HtmlPlayerRunner.init()` et transmet son rapport à la façade. La façade ne doit
jamais rappeler `RuntimePlayer.init()` sur `host.player` ; cet appel direct
initialiserait seulement la logique de scène et laisserait le graphe FLIP, la
présentation du mouvement et l'attachement de capture non préparés. Le player
logique reste l'objet piloté par `InstanceFacadeImpl`, mais son cycle
d'initialisation appartient au runner HTML.

## 2. Compilation et instanciation

La compilation reste indépendante :

```text
SceneDoc --SceneBuilder + snapshot de validation--> CompiledScene + functions
CompiledScene + codplay + instance options --------> InstanceFacade
```

La frontière publique de compilation reprend la méthode V1 `BuilderFacade.compile`,
mais elle est liée à l'engine qui porte le catalogue core/foreign :

```text
const codplay = new CodPlay(config)
const engine = codplay.engine
const build = engine.builder.compile({ scene })
const instance = codplay.instances.create({
  ...options,
  compiledScene: build.compiledScene,
  functions: build.functions,
})
```

`engine.builder.compile()` ne crée ni instance, ni materialisation, ni circuit
de lecture. Il valide et prépare seulement la scène avec les capacités qui
seront ensuite utilisées par ce même engine. Son résultat conserve
`compiledScene`, `functions` et les diagnostics ; en cas d'échec, il ne produit
aucun artefact utilisable.

La création d'une instance reçoit au minimum :

- un `instanceId` unique dans le propriétaire `CodPlay` ;
- un `CompiledScene` ;
- sa collection de fonctions ;
- sa racine HTML et ses cibles de montage ;
- ses racines et cibles de montage ;
- ses collections externes de straps uniquement lorsqu'une déclaration de la
  scène choisit explicitement la forme réutilisable ; les straps locaux sont
  déjà portés par le `CompiledScene` et sa collection de fonctions ;
- les ressources déjà déclarées disponibles par l'engine.

La racine HTML et les cibles de montage sont des données d'instance ; elles ne
doivent jamais être enregistrées dans le catalogue global. `HtmlPlayerRunner`
est l'unique assemblage public : il possède la materialisation HTML/DOM, la
présentation du mouvement et la source pointeur. Un composant peut rendre un
`svg` ou déclarer un `canvas` comme cible interne ; cela ne constitue pas une
sélection de materializer ni une ouverture de Canvas ou Three.js dans CodPlay.

Le registre `codplay.instances` et l'engine partagent le catalogue et l'horloge,
mais jamais la racine, le materializer ou l'état runtime d'une autre instance.
La destruction d'une instance passe une seule fois par
`codplay.instances.destroy()` et libère sa materialization sans détruire celles
des autres instances.

`engine.destroy()` est porté par la façade. Il orchestre, dans un ordre unique,
l'arrêt du ticker, la destruction ordonnée des instances et la libération des
ressources partagées. `RuntimePlayer.destroy()` reste le teardown interne d'une
instance ; il n'est pas exposé comme une seconde API de pilotage.

## 3. Pilotage de l'engine

L'engine façade est propriétaire de l'ordre commun, pas du scénario.

Concrètement, il ne sait pas ce que signifie `click`, `open`, `move` ou
`capture`. Il sait seulement quelle instance doit recevoir une commande et
dans quel ordre les instances doivent être avancées :

- `start()` lorsqu'il possède le ticker ;
- `pause()` qui suspend l'avancement en conservant l'état courant des
  instances ;
- `stop()` qui cesse l'emploi de la machine et arrête l'avancement, sans
  imposer de remise à `0` ni détruire les instances ;
- `advance(nowMs, marginMs?)` lorsque l'hôte fournit les frames ;
- coordination interne de l'enregistrement et du retrait ordonnés des instances ;
- coordination interne des seeks de players, sans méthode supplémentaire sur la
  façade ;
- état de l'engine et diagnostics d'opération.

Par exemple, avec deux instances `scene-a` et `scene-b` :

```text
event { instanceId: "scene-a", name: "open" }
  -> l'engine adresse scene-a
  -> scene-a résout listen, straps et actions
  -> scene-b n'est pas touchée

frame à 1000 ms
  -> l'engine avance scene-a puis scene-b
  -> chaque instance applique son propre rate et sa propre scène
```

Le seek groupé de `RuntimeEngine` reste une primitive interne du runtime. Il est
utilisé par les players pour leurs transactions de reconstruction ; il n'est
pas exposé comme `engine.seek()` par cette façade.

Ainsi :

- **adressage** = sélectionner une instance par son `instanceId` ;
- **ordonnancement** = imposer un ordre unique aux frames et aux phases
  `validate -> prepare -> commit -> present` ;
- **résolution de scène** = interpréter l'event, choisir les règles `listen`,
  exécuter les straps et produire l'état ; cela appartient à l'instance ;
- **ordre des éléments** = parentage et ordre HTML/DOM ; cela appartient au
  solveur et au materializer. Un contexte Three.js interne reste géré par le
  composant qui possède son nœud `canvas`.

`engine.pause()` suspend donc l'avancement partagé sans repositionner ni
détruire les instances. Quand l'engine possède le ticker, il l'interrompt.
Quand les frames sont fournies par l'hôte, celui-ci peut continuer à appeler
`advance()` : l'engine reçoit alors les frames mais tourne à vide et ne les
propage pas aux instances. Il ne crée ni ne relaie un ticker vers des engines
ou des instances enfants.

`engine.stop()` signifie que l'on cesse d'employer la machine. Il arrête le
ticker possédé par l'engine et cesse toute propagation des frames ; il ne
réinitialise pas obligatoirement le temps courant, ne détruit pas les
instances et ne détruit pas leurs hôtes HTML/DOM. Il ne s'agit pas d'un alias
de `engine.pause()` : `pause` suspend une utilisation reprenable, tandis que
`stop` clôt la propagation courante de l'engine. La pause d'une seule instance
reste `instance.telco.pause()`.

La remise à zéro éventuelle de la baseline technique du ticker ne constitue
pas une remise à zéro de la scène : elle sert seulement à éviter qu'une
reprise calcule un delta depuis une frame ancienne. Le temps logique et la
présentation des instances restent ceux du moment de l'arrêt.

La décision de façade est donc fixée : `pause` et `stop` interrompent la
propagation vers les instances, sans remise à zéro imposée ; `destroy` reste
seul responsable du teardown. Ces comportements sont raccordés par
`EngineFacadeImpl` au `RuntimeEngine` unique.

Une seule source temporelle est autorisée par engine : soit le ticker possédé
par `CodPlay` et démarré par `start()`, soit les frames fournies par `advance()`. `advance()` ne
doit pas être utilisé en parallèle d'un ticker possédé par l'engine ; cette
concurrence doit être refusée par un diagnostic.

La façade n'expose pas de seek au niveau de l'engine. Le seek public est
`instance.telco.seek(timeMs)` : il désigne une instance et délègue au runner
HTML déjà assemblé. La politique éventuelle de conversion d'un temps global
reste extérieure à cette façade.

La transaction interne de `RuntimeEngine.seek()` suit toujours :

```text
validate -> prepare -> commit -> present
```

Cette primitive interne ne détruit pas une instance parce qu'elle n'est pas
incluse dans une opération de seek.

Le seek groupé est atomique du point de vue de la présentation : toutes les
instances ciblées doivent terminer `validate` et `prepare` avant le moindre
`commit`. Ensuite seulement, les états préparés sont engagés puis présentés
une seule fois par instance. Une erreur de validation ou de préparation ne
change donc aucune présentation. L'implémentation doit également empêcher
qu'une erreur pendant `commit` ou `present` laisse un sous-ensemble présenté ;
ce point relève de la transaction interne du runtime, pas d'une nouvelle API.

## 4. Pilotage de l'instance

Le pilotage de l'instance n'est pas exposé par une série de méthodes à plat.
Il est regroupé dans la propriété `telco`, qui constitue la surface de
commande unique de l'instance :

```text
const { telco } = instance
telco.play()
telco.pause()
telco.togglePlay()
telco.setRate(rate)
telco.seek(timeMs)
telco.rewind()
```

La propriété `telco` est immédiatement disponible sur l'instance et ne
nécessite pas d'appel d'acquisition ou d'initialisation :

```text
const { telco } = instance
telco.play()
```

`RuntimePlayer.init()` reste une étape interne d'initialisation de l'instance :
validation des capacités et des ressources, reconstruction initiale et
première matérialisation. Elle ne fait pas partie de `telco`. De même,
`RuntimePlayer.refresh()` réapplique la scène résolue après un changement de
contexte du materializer ; ce n'est pas une commande de lecture et il ne fait
pas partie de `telco`.

`destroy()` reste une opération de teardown de l'instance et de son
materializer, pas une commande de lecture de la telco. Elle est donc portée par
le propriétaire de l'instance (`codplay.instances.destroy()` ou l'opération de
lifecycle retenue), tandis que `telco.destroy()` ne pourra désigner que la
libération de l'adaptateur de commande si celle-ci est nécessaire.

Le temps logique est fourni par l'engine. La telco ne crée pas de ticker et
ne déduit jamais son état du DOM. Dans le mode CodPlay normal, l'engine réveille
automatiquement son ticker partagé lorsqu'une instance passe en lecture et le
suspend lorsque le dernier lecteur est en pause. Ce réveil est interne à la
façade : l'hôte de la démo n'appelle pas `engine.start()` ou `engine.pause()`.

Les commandes générales `engine.start()` et `engine.pause()` restent cependant
disponibles pour une suspension ou une reprise volontaires de toute la
propagation partagée. Elles ne remplacent pas `instance.telco.pause()` : cette
dernière ne concerne que l'état de lecture de son instance. Le futur contexte
Sighty pourra les employer lorsque son rôle de pilote engine sera déclaré.

Le mode où un hôte fournit ses propres frames utilise `engine.advance()` et
doit être déclaré par le contrat de pilotage de cet hôte. La déclaration du
pilote engine de Sighty reste à formaliser avant d'activer ce mode ; elle devra
désactiver le réveil automatique du ticker CodPlay, sans supprimer le moteur ni
son API interne.

La telco regroupe également l'état et les abonnements nécessaires à la
télécommande : `getState`, `seek` pour l'écriture de la position, le progress
publié, `onChange` et `onProgress`. La façade expose un snapshot sérialisable
au minimum avec :

- `instanceId` ;
- lifecycle ;
- temps courant ;
- rate ;
- état initialisé / terminé ;
- revision.

### Progress comme capacité de la telco

La référence V1 vérifiée dans
[`TelcoApi`](../../codplay/src/telco/types.ts) et la spécification
[`Player API V1`](../../../docs/evolution/formalisation-archive/formalisation-modele-2026-05-06/45-player-api-v1.md)
ne définit pas de setter de progress distinct : `seek` écrit
la position, tandis que `onProgress` la publie. Le plan V2 conserve cette
séparation pour éviter deux commandes concurrentes visant le même temps :

```text
telco.seek(timeMs)
  -> écrit la position par le circuit de commande unique

telco.onProgress(listener)
  -> publie le temps courant et la durée
```

Le progress de la télécommande ne lit ni n'écrit le player directement. Il
utilise `telco.onProgress` pour afficher la position et `telco.seek(timeMs)`
pour écrire une nouvelle position. Un getter `telco.getProgress()` reste
optionnel, mais il est utile pour une lecture immédiate lorsque la lecture est
en pause ou lorsqu'aucune notification n'est attendue. Il lit le même état et
ne constitue pas une seconde source ni une seconde commande.

Le contrat CodPlay ne transporte pas de pourcentage : il fournit le temps
logique courant et la durée (`timelineMs`, `durationMs` dans l'état runtime).
La conversion en pourcentage relève exclusivement de la présentation de la
télécommande et ne fait pas partie de cette façade.

Les diagnostics sont publiés par `instance.diagnostic` et les sorties déjà
prévues. Ils ne sont pas encapsulés dans un résultat d'erreur. Le stockage d'un
rapport de « dernière opération » dans le snapshot est reporté : il ne sera
conçu que si un besoin concret est exprimé lors de la construction des démos
ou d'un consommateur V2.

Le `RuntimeTelco` existant est l'adaptateur interne de cette propriété. Il reçoit
une cible d'instance et s'abonne aux notifications déjà produites par le
player ; il ne possède ni ticker ni boucle de progression propre. Tant qu'un
consommateur observe l'état ou le progress, il conserve cette observation de la
cible. Une transition de lifecycle ou de `sequenceEnded` est relayée par
`onChange`, tandis que `onProgress` continue de publier la position. Ainsi, la
fin terminale désactive les commandes de seek du remote sans supprimer le
dernier état de progress ; `play` reste disponible pour le replay normal.

### Durée ouverte et horizon découvert — portage du concept V1

Le concept V1 d’horizon ouvert s’applique lorsqu’aucun média ni track borné ne
fournit de durée autoritative. Dans ce cas, `durationMs` est omis lors de la
création de l’instance : le player continue d’avancer avec les ticks et expose
comme durée le maximum entre la tête courante et les événements compilés ou
enregistrés dans le journal. Un eventime ajouté au journal étend donc
immédiatement l’horizon observable, tandis qu’un média ou une track bornée
conserve la durée fixe fournie par son circuit dédié.

Cette durée ouverte n’empêche pas la fin technique : lorsque le player reçoit
ou atteint un event `sequence:end` en lecture, il expose `sequenceEnded: true`,
borne la tête à cet event et suspend la progression. La telco relaie cet état
du player ; `play()` déclenche alors le replay normal du player depuis zéro. Un
`seek` qui traverse un `sequence:end` reste une projection et ne déclenche pas
la fin technique.

Cette adaptation ne crée pas une sémantique d’event supplémentaire et ne
préjuge pas de la propriété `idle`, qui fera l’objet d’une tranche distincte
après validation des démos concernées.

Toutes les commandes de lecture et de progress passent par `instance.telco`.
La télécommande et les démos ne peuvent pas appeler directement le player, le
runner ou l'engine pour remplacer ce circuit.

Les commandes ne sont pas exposées en parallèle comme méthodes directes de
l'instance : `play`, `pause`, `seek`, `emit` et le cycle capture ne constituent
pas une seconde surface de façade hors des capacités explicitement retenues.

## 5. Injection d'events

### Instance

L'eventime injecté reprend la structure déclarée dans une scène : un nom, un
`startAt` lorsqu'il est présent, des données éventuelles et des eventimes
enfants éventuels.
Il n'existe pas de forme `emit` distincte. L'instance reçoit en plus une cible
séparée, nécessaire parce qu'une déclaration de scène hérite déjà de la cible
de son story ou de sa track.

```text
instance.events.emit(eventime, target)
  -> validation de la cible par la façade
  -> entrée eventime unique du player
     -> immédiat : enregistrement à l'ancrage, présentation au prochain tick
     -> planifié : inscription à son temps dans le journal
  -> journal et reconstruction uniques
  -> materialize -> resolve -> solve
  -> component -> materializer
```

Les modes `apply-now` et `persist-only`, les cibles story/scene, l'ancrage et
les sorties de straps restent ceux du contrat V2. Une démo ne peut pas écrire
directement dans le journal ou dans le DOM pour remplacer cet appel.

`instance.events` prend le temps logique courant comme ancrage de l'appel.
Deux notions doivent rester distinctes :

- le mode d'application : une occurrence immédiate est enregistrée à l'ancrage
  courant et présentée au prochain tick normal ; une occurrence planifiée est
  inscrite dans le journal et sera lue lorsque la tête de lecture atteindra
  son temps ;
- le repère temporel : un `startAt` relatif se calcule depuis l'ancrage de la
  racine ou depuis le parent de l'enfant ; un temps absolu est une autre
  information et ne doit pas être déduit de la même propriété.

La convention proposée pour la forme externe — racine sans `startAt` pour une
occurrence immédiate, puis `startAt` relatifs pour les enfants — est cohérente
avec cette séparation, mais reste à valider comme contrat. Elle normaliserait
la racine à un offset nul sans modifier les offsets des enfants. Ainsi, un
appel ancré à 1 000 ms avec un enfant à 200 ms produit une occurrence enfant à
1 200 ms. L'arbre est ensuite aplati dans le journal unique ; il n'ouvre ni
timer, ni track, ni circuit de lecture parallèle.

« Immédiat » signifie donc « au prochain tick normal », jamais « pendant
l'appel ». `events.emit` ne garantit aucune matérialisation synchronique. Avec
un ticker externe, le prochain `advance` constitue ce tick ; si l'instance est
en pause, l'event reste enregistré jusqu'au prochain tick accepté après la
reprise. Le chemin public `instance.events.emit` utilise l'entrée eventime du
player ; le chemin interne historique `RuntimePlayer.emit()` conserve sa
sémantique propre aux entrées runtime déjà constituées et ne constitue pas une
seconde API publique.

Exception de commande officielle : un eventime racine sans `startAt`, sans
enfants, dont le nom est `track:activate`, `track:deactivate` ou `track:toggle`,
est traité comme une commande de sélection de tracks. Il passe par le
dispatcher live au temps courant afin d’appliquer immédiatement l’activité des
tracks, tout en conservant la commande dans le journal. Un eventime portant un
`startAt`, ou tout autre eventime, conserve la sémantique de timeline et n’est
pas pré-exécuté par la façade.

La forme publique reste celle d'un eventime déclarable dans une scène :
`name`, `startAt` relatif lorsqu'il est présent, sa portée nommée éventuelle,
`data` éventuel et `events` éventuels. Dans la convention proposée, seule la racine d'un eventime injecté
pourrait omettre `startAt` ; la normalisation ajoute alors l'offset nul avant
la frontière compilée. La façade ne doit pas exposer `CompiledEventime` comme
un contrat public et ne doit jamais exposer `applyAtMs`.

`CompiledEventime` reste la forme interne produite par la compilation de la
scène et utilisée par le runtime. Dans cette forme, `startAt` est toujours un
offset relatif numérique :

```ts
type CompiledEventime = Readonly<{
  name: string
  startAt: number
  visibility?: 'story' | 'scene' | 'public'
  data?: CompiledRecord
  events?: readonly CompiledEventime[]
}>
```

La compilation conserve la structure relative de l'eventime, mais peut
extraire les fonctions contenues dans ses données vers la collection de
fonctions compilées, puis détacher et figer l'artefact. Elle ne l'ancre pas au
temps courant et ne lui ajoute pas d'adresse runtime.

Il n'existe pas actuellement de `startAt` absolu dans la forme externe. La
valeur interne absolue `applyAtMs` n'est pas exposable. La notation
`startAt: "+200"` n'est donc ni définie ni acceptée par le codec actuel, qui
attend un nombre fini positif ou nul. Si un adressage absolu devient
nécessaire pour un emit runtime, il devra être spécifié séparément du contenu
récursif de l'eventime ; il ne faut pas surcharger `startAt` ou ajouter un
parseur implicite.

Écart constaté dans le socle : `SceneBuilder` traite actuellement les
eventimes par extraction générique et le `CompiledSceneCodec` les valide sur la
frontière d'encodage/décodage, mais la validation sémantique du builder ne
porte pas encore explicitement sur leur structure. Cette validation doit être
consolidée à la frontière de compilation, avec la même règle réutilisable par
la validation de l'eventime externe ; elle ne doit pas être redécouverte dans
le dispatcher.

Le plan fixe donc les contraintes suivantes, sans inventer la signature de la
façade :

- l'eventime public reste récursif et peut contenir des eventimes enfants ;
- l'adresse de l'instance et l'adresse story/scene/track sont séparées du
  contenu de l'eventime ;
- la portée nommée de l'eventime reste dans son contenu et est conservée pour
  chaque occurrence ;
- un track fourni doit être déclaré ; l'emit ne crée jamais de track ;
- la cible résolue est héritée par les occurrences produites par l'arbre ;
- l'enveloppe conserve un `instanceId` au niveau engine et le contexte
  `story`/`scene`/`track` au niveau de l'instance ; elle ne change pas la forme
  de l'eventime.

Le dispatcher interne actuel fournit seulement un point de comparaison : son
`RuntimeEventInput` porte encore `storyId`, `trackId` et l'ancien booléen
`cascade`, puis résout une cible story vers `story.trackId ?? storyId`, ou une
cible globale vers le track global. Ce nom interne est un écart à résorber ; il
ne constitue pas l'API CodPlay et ne doit pas réapparaître dans le contrat.

L'entrée publique ciblée est `engine.events.emit(input)`. `input` porte
`instanceId`, l'eventime racine et la cible de la scène. L'engine
ne résout pas l'eventime : il vérifie l'instance, lui transmet l'eventime et le
la cible, puis utilise le même circuit que
`instance.events.emit(eventime, target)`. L'event aboutit donc dans le
player de l'instance ciblée, puis dans son journal et sa reconstruction ; le
dispatcher interne n'est appelé que par le circuit central lorsque la
sémantique de l'entrée le requiert. Une erreur d'injection est publiée par le
diagnostic et il n'existe pas de journal d'events parallèle au niveau engine.

L'eventime ajouté reste un fait du `RuntimeTrackJournal`, donc il est pris en
compte par Play et par Seek. Un eventime daté dans le passé est résolu selon
les règles ordinaires de reconstruction ; `persist-only` conserve en plus sa
frontière de tête de lecture.

L'implémentation interne possède déjà l'opération d'aplatissement
`RuntimeTrackJournal.appendAnchoredEventimes()`. Elle transforme les offsets
relatifs en `applyAtMs`, qui est une donnée interne du journal, puis écrit les
occurrences sur un track déclaré. Le fait qu'elle ne lance pas `listen` ni les
straps au moment de l'insertion est correct pour un eventime de timeline :
l'occurrence doit être lue à son temps par la reconstruction normale. Elle
reste toutefois interne ; la façade doit lui fournir une entrée validée,
adressée et détachée.

Il faut une méthode interne unique d'intégration d'eventime dans le player.
Cette méthode est un adaptateur de forme, d'adresse et de calendrier ; ce
n'est ni un second dispatcher, ni un second journal, ni une nouvelle histoire
runtime. Elle utilise le journal runtime existant et la reconstruction commune.
Elle doit :

- recevoir la forme externe et l'adresse séparée ;
- valider récursivement la structure et les offsets avant toute écriture ;
- détacher/sanitizer l'arbre sans modifier l'objet fourni par l'appelant ;
- résoudre uniquement un story/scene/track déclaré ;
- convertir les offsets en occurrences runtime internes ;
- ajouter ces occurrences au journal unique, sans exposer `applyAtMs` ;
- conserver les mêmes règles de Play, Seek, `apply-now` et `persist-only`.

La façade `instance.events.emit` ne possède donc aucun comportement propre :
elle valide l'adresse puis délègue au player. `engine.events.emit` ne fait que
résoudre `instanceId` avant d'effectuer la même délégation. L'appelant écrit
un eventime avec la forme externe et obtient exactement les règles du circuit
central, sans relancer le player.

Pour un eventime immédiat, ce raccord est directement possible avec le circuit
actuel si la convention de racine sans `startAt` est retenue : insertion dans
le journal à l'ancrage courant, puis matérialisation selon la frontière de
présentation retenue. Il ne faut pas confondre cette frontière avec un temps
absolu public.

Pour un eventime daté ou futur, il n'y a pas de problème supplémentaire de
calendrier : l'eventime est ajouté à la timeline à `anchor + startAt`, puis la
reconstruction normale le lit lorsqu'elle atteint cette position. Il ne faut
pas appeler un dispatcher de live au moment de l'insertion pour simuler cette
lecture. Le player reste vivant ; seule sa timeline runtime est enrichie.

L'équivalence attendue est donc celle-ci : un eventime injecté à `t` doit être
lu comme le même eventime déclaré dans la scène à la même position relative.
Toute règle supplémentaire (`listen`, strap ou sortie) doit suivre cette
même sémantique de lecture ; elle ne doit pas être exécutée prématurément par
la façade.

Sont explicitement écartés : relancer ou reconstruire le player, appeler
`appendAnchoredEventimes()` comme chemin public, ou pré-exécuter les effets
d'un eventime futur au moment de son injection.

Écart actuel à résorber : `RuntimePlayerEmitInput`, dans
`src/runtime/player/capture/types.ts`, reprend encore `RuntimeEventInput` et
porte directement `storyId`, `trackId`, l'ancien booléen `cascade` et
`applyAtMs`. Il n'y a donc
pas encore d'enveloppe publique d'adressage ; la façade devra séparer cette
adresse du contenu eventime avant de traduire vers le dispatcher.

Les captures restent sur la même frontière :

```text
beginCapture -> trackCapture -> endCapture / cancelCapture
```

La source HTML, Canvas ou Three.js fournit les samples ; elle ne crée pas une
variante d'event DnD dans le cœur. Un emit immédiat et un emit daté passent par
le même journal et le même chemin de reconstruction. La capture reste
source-agnostique et conserve la frontière `persist-only`.

Le contrat capture du cœur ne crée pas pour autant une capacité publique
`instance.capture`. Dans cette tranche, les sources de capture existantes
restent raccordées au circuit runtime prévu à cet effet. Une saisie externe
pilotée directement par l'hôte n'est pas un besoin établi de la façade V2.

#### Note différée — capture externe

Si les exemples Sighty ou une future démo montrent qu'une source externe doit
ouvrir, suivre ou fermer une capture via la façade, il faudra alors reprendre
la définition d'une capacité dédiée. Cette reprise devra préciser son
adressage, son cycle et sa frontière avec les sources de materializer. Aucun
nom de propriété ni signature n'est retenu pour cette version.

### Engine

L'engine ne résout pas les règles de scène. Il fournit seulement l'adressage et
l'ordonnancement :

- une commande d'eventime porte un `instanceId` explicite ;
- elle porte l'eventime racine ; l'instance l'ancre à son temps logique courant
  et résout tous les `startAt` comme des offsets relatifs ;
- une série destinée à plusieurs instances est une série de commandes
  adressées, pas un eventime implicitement diffusé ;
- l'ordre de livraison est observable et déterministe ;
- un futur envoi atomique de plusieurs events devra être spécifié comme tel,
  sans être confondu avec le seek groupé.

Cette séparation évite que l'engine devienne un orchestrateur de scénario.

## 6. Emission et observation d'events

Le plan V2 retient les events comme contrat primaire pour l'orchestration. Il
faut donc distinguer :

1. les events internes du journal, qui restent privés à l'instance ;
2. les sorties d'events déclarées visibles par l'auteur ;
3. les diagnostics techniques.

La propriété `instance.diagnostic` fournit `onDiagnostic` ou une sortie de
diagnostics configurée. L'état de lecture destiné à la télécommande reste
publié par `instance.telco.onChange` ; il n'existe pas de second abonnement
`onStateChange` dans `instance.diagnostic`.

La formulation d'une « sortie autorisée » ne correspond pas à une whitelist
d'events. Tout eventime peut porter une portée nommée ; cette portée détermine
sa sélection et son exposition, pas le nom ou le type de l'eventime.

Les sources relues fixent les faits du circuit interne :

- l'event source est ajouté au journal une seule fois ;
- seuls les `emit` déclarés par une règle `listen` sont réinjectés ;
- les sorties des straps sont journalisées sur leurs tracks dédiées ;
- les events produits par `endCapture` ou `endEmit` passent par le dispatcher
  ordinaire ;
- les issues et warnings restent des diagnostics.

La direction V2 déjà consignée est une portée nommée :

- `story` : l'eventime reste dans la story qui le produit ;
- `scene` : il est sélectionné au niveau de la scène et materialisé pour ses
  stories selon les règles de la scène ;
- `public` : il sort de la scène et devient observable par l'hôte ou Sighty,
  sans que CodPlay le transmette à une autre scène.

`world` n'est pas retenu comme synonyme contractuel : il désigne déjà un
espace de coordonnées dans les plans de materialisation et de mouvement. Le
code actuel ne porte pas encore ce marqueur et `flattenAnchoredEventimes()` ne
le conserve pas ; ces deux points font partie de la migration prévue. Les
transforms ne modifient pas la portée d'un eventime.

### Extension acceptée le 2026-08-29 : contexte runtime sous `diagnostic`

Le besoin du journal commun des démos est une observation des events runtime,
pas un strap de scène et pas une nouvelle sortie d'event public. La façade
regroupe cette observation dans `instance.diagnostic` afin de conserver une
seule surface de contexte :

```ts
instance.diagnostic.onDiagnostic(listener) // warnings et erreurs
instance.diagnostic.onTrace(listener)      // events runtime enregistrés
```

`onTrace` ne publie pas un `Diagnostic` et ne modifie pas la sémantique de
`onDiagnostic`. Il reçoit une ligne pour chaque `RuntimeTrackEvent` accepté et
ajouté au journal par le circuit live : event source, event produit par un
transform ou un strap, et eventime injecté par l'hôte. La ligne expose le nom
et le contexte déjà porté par l'event (`instanceId`, identifiants, temps,
track, story, portée, données, contexte, métadonnées et mode d'insertion).

L'observation est faite après l'append réussi, une seule fois par occurrence.
Elle ne réexécute aucun `listen`, transform ou strap et ne produit rien lors
d'une reconstruction `seek`. Les erreurs d'abonnement restent publiées par le
canal diagnostic normal. Le layout peut donc s'abonner après la création de
l'instance et afficher le nom de chaque event sans modifier la `SceneDoc`, ses
tracks ou son routage.

## 7. Preload, telco et diffusion

- `RuntimePreload` reste une capacité externe au player et à l'instance ; le
  choix du manifeste et du moment du chargement appartient à l'hôte. Le
  service est créé par `CodPlay` et peut être appelé à tout moment, y compris
  après la création de l'engine.
- La façade publique `CodPlay` fournit cette capacité via `codplay.preload`,
  plutôt qu'un `instance.preload()` ou qu'un `init()` implicite.
- Le résultat d'un chargement est transmis explicitement à l'engine par son
  entrée de ressources (`engine.resources.register(...)`). Le transfert
  conserve les URLs chargées et les métadonnées du résultat preload ; il ne
  peut pas se réduire à une simple liste d'URLs. Cette entrée ne modifie pas
  le catalogue verrouillé : elle enregistre seulement des ressources
  disponibles pour les instances qui ne sont pas encore initialisées.
- Avant l'initialisation et la première présentation d'une scène, l'engine
  vérifie que toutes les ressources déclarées par sa `CompiledScene`, notamment
  les médias, sont disponibles. En cas de manque, l'instance ne passe pas à
  `ready` et ne démarre pas ; elle publie les diagnostics correspondants.
  Un preload ultérieur peut alors compléter les ressources avant une nouvelle
  tentative d'initialisation.
- Le cache de preload peut être partagé par l'engine avec comptage des
  références ; une instance reçoit seulement les ressources disponibles et
  les métadonnées nécessaires.
- `run()` reste une commodité de diffusion autonome qui enchaîne
  `preload -> init -> play`. Il ne devient pas le chemin obligatoire de
  Sighty ou de l'éditeur.
- `RuntimeTelco` est branchée sur `InstanceFacade.telco` et ne connaît ni
  `RuntimePlayer`, ni le catalogue, ni le materializer.

`new CodPlay(options)` est la seule entrée publique de création du service
preload. Aucune instance ne le déclenche dans `init()`, et aucune façade ne
crée une seconde matérialisation pour le charger.

## 8. Materialisation HTML et authoring

La façade V2 ne propose qu'une materialisation HTML/DOM :

- l'instance reçoit une racine HTML ;
- `HtmlPlayerRunner` construit et possède la frontière interne de
  materialisation ;
- aucune option `materializer`, aucun contexte de substrat et aucun
  materializer étranger ne font partie de l'API publique ;
- les services sont résolus selon la destination déclarée par le composant ;
- le calcul logique d'un `move` reste séparé de son application HTML ;
- les racines, mesures, resize et ressources techniques restent propres à
  l'instance et à son runner ;
- un composant spécialisé peut posséder un contexte interne (par exemple une
  scène Three.js attachée à un `canvas` qu'il a rendu), sans que ce contexte
  devienne une materialisation CodPlay ou un handle public générique ;
- les parts, outlets et surfaces déclarés par les composants sont résolus par
  les registres player-locaux existants ; ils ne créent pas un circuit de
  materialisation parallèle ;
- aucun second DOM ou catalogue n'est créé par la façade ;
- l'engine et la façade générique ne créent jamais de DOM.

### Snapshot d'édition

**Décision validée le 2026-08-30 — implémentation reportée au sous-plan de reprise ed2.**

L'instance V2 porte directement une capacité `snapshot`, au même niveau que
`telco`. Elle ne passe ni par `telco`, ni par `events`, ni par `diagnostic`, et
ne donne pas accès aux classes `RuntimePlayer`, `RuntimeMaterializer` ou au
catalogue. Elle est créée dans CodPlay et exposée par `InstanceFacade` ; aucun
package `authoring` ne la crée ni ne l'enveloppe. Elle ne connaît ni
`EditorScene`, ni `Decor`, ni un type authoring externe : l'éditeur lui fournit
seulement des patches logiques.

La référence comportementale reste
[`v1-author-api-spec.md`](../../../docs/formalisation/v1-author-api-spec.md),
mais sa surface node n'est pas reprise dans ce premier contrat V2. La cible V2
est définie par les règles ci-dessous.

#### Surface de lecture

La lecture principale est logique et indépendante du substrat :

```text
instance.snapshot.get()
  -> { timeMs, states: [{ target: { storyId, persoId }, state }] } | null
```

Cette lecture fournit l'état résolu du temps logique actuellement présenté par
l'instance, dans les unités du perso. En mode authoring, le snapshot est
capturé lors du `seek` qui présente ce temps ; il n'est pas recalculé à chaque
frame de lecture. Elle ne lit ni le DOM, ni `getComputedStyle`, ni une matrice
FLIP ou un overlay. Un perso peut être absent du DOM et rester lisible par
cette voie.

L'observation du cycle de lecture reste portée par `instance.telco`. La
capacité `snapshot` ne crée pas un second protocole de transport.

#### Écriture temporaire à un temps donné

`instance.snapshot.set()` doit accepter une preview temporaire décrite par :

```text
{
  target: { storyId, persoId },
  timeMs: t,
  state: Partial<Record<string, unknown>>
}
```

Cette écriture est un patch de preview appliqué avant la prochaine
matérialisation de l'état présenté. `timeMs` est le temps logique local de
l'instance ; ce n'est ni un `startAt` d'eventime, ni un event daté.

Ses invariants sont fixes :

- l'état est partiel et adressé par `{ storyId, persoId }` ;
- il reste dans les unités et la forme logique du perso, jamais dans la forme
  DOM d'un materializer particulier ;
- pour chaque propriété fournie, il remplace la valeur résolue correspondante
  avant materialisation ; les propriétés absentes restent celles de l'état
  résolu ;
- il ne passe ni par `telco`, ni par `events`, ni par le journal, ni par
  `persist-only` ;
- il ne modifie ni `CompiledScene` ni le journal ; le comportement de la
  preview lorsque l'instance change de temps reste une décision du circuit
  d'interaction ed2, pas une annulation automatique imposée par cette capacité ;
- sa conversion en décor, keyframe ou autre donnée persistante relève
  exclusivement de l'éditeur et de son canal de commandes.

`set()` remplace atomiquement l'ensemble de patches de preview courant ;
`clear()` l'efface de façon idempotente. L'abandon explicite appelle `clear()`.
Le devenir d'une preview au seek, au changement de sélection, au rebuild ou au
remplacement d'instance n'est pas fixé par ce contrat : l'éditeur devra le
qualifier à partir des usages réels avant de le stabiliser. Le contrat complet
des formes et des diagnostics est défini dans le plan de reprise de l'éditeur.
Cette capacité ne justifie pas la création d'un second circuit runtime.

#### Longueurs `cqw` ed2

**Décision validée le 2026-08-30 — implémentation reportée au sous-plan V2.**

Les champs structurés de longueur ed2 (`OffsetData.x/y/width/height` et
`OffsetData.translate.x/y`) deviennent dans `SceneDoc` une valeur explicite :

```ts
{ kind: 'length', unit: 'cqw', value: number }
```

`Decor.style`, CSS libre et propriétés custom restent des chaînes CSS opaques.
CodPlay ne déduit jamais une longueur depuis la grammaire CSS et ne maintient
aucune whitelist de propriétés. Cette valeur est logique : deux longueurs
`cqw` s'interpolent dans `resolve`, puis le materializer les projette en `px`
avec la largeur de la racine de scène (`100cqw`), y compris pour `y` et
`height`. Cette projection ne requalifie pas le CSS.

Une interpolation entre une longueur `cqw` et une valeur CSS incompatible est
rejetée avec diagnostic. L'implémentation doit préserver cette valeur dans le
snapshot, la contribution temporaire, Play, Seek et resize.

#### Accès éventuel au nœud matérialisé

La préférence actuelle est de ne pas rendre le nœud nécessaire à l'édition :
l'éditeur doit pouvoir écrire l'état logique temporaire avant materialisation.
Cette préférence ne constitue pas une exclusion définitive. Si une fonction
d'éditeur exige le nœud HTML courant, une capacité distincte sera spécifiée ;
elle ne rejoint pas la surface `snapshot`.

Dans ce cas :

- l'accès est une capacité optionnelle de la materialisation HTML/DOM ; il ne
  donne pas accès aux contextes internes éventuellement possédés par un
  composant, comme une scène Three.js ;
- la référence de nœud est remplaçable et ne constitue jamais l'état logique ;
- la pertinence et la forme finale de cette capacité seront vérifiées lors de
  la reprise de l'éditeur, sans invalider la surface d'état logique ci-dessus.

L'implémentation de cet accès est donc volontairement reportée au chantier
éditeur. Ce plan formalise la frontière et les invariants ; il ne déclenche
aucune modification du cœur V2 ni du materializer HTML à ce stade.

## 9. Interface publique cible et phases de réalisation

### 9.1 Interface CodPlay regroupée par thème

Cette surface est la façade V2 arrêtée. Les responsabilités et les frontières
sont contractuelles ; les classes `Runtime*`, les catalogues et les runners ne
font pas partie de cette interface.

#### Création et configuration

```text
new CodPlay(options) -> CodPlay
codplay.engine -> EngineFacade
codplay.instances -> CodPlayInstances
codplay.preload -> RuntimePreloadApi
codplay.destroy()
```

Le constructeur est l'unique point de composition du propriétaire CodPlay. Il
reçoit les capacités, les ressources, les diagnostics et, si nécessaire, le
`frameScheduler` de l'hôte. `CodPlay` construit le `TimeTicker` en interne ;
ni `TimeTicker`, ni `Ticker`, ni une factory de ticker ne sortent de la façade.

La compilation est accessible sur l'engine créé, comme méthode du builder
V1, afin de partager son catalogue configuré :

```text
engine.builder.compile({ scene }) -> CodPlayCompileResult
```

`options` regroupe :

```text
components:   { register, override }
services:     { register, override }
modules:      { register, override }
resources
frameScheduler?
pauseOnDocumentHidden?
preload?
```

`CodPlay` expose directement son service de preload sans l'attacher à une
instance :

```text
const codplay = new CodPlay(options)
const preload = codplay.preload
const result = await preload.load({
  manifest: manifestOrManifests,
  options: loadOptions?,
})
const engine = codplay.engine
if (result.ok) engine.resources.register(result.data)
```

La forme publique est fixée par `RuntimePreloadApi` :

```ts
type CodPlayPreloadOptions = Readonly<{
  cache?: RuntimePreloadCacheApi
  strategies?: Readonly<Record<string, RuntimePreloadStrategy>>
}>

type PreloadFacade = RuntimePreloadApi

type RuntimePreloadApi = {
  readonly state: RuntimePreloadState
  load(input: {
    manifest: RuntimePreloadManifestInput
    options?: RuntimePreloadOptions
  }): Promise<RuntimePreloadResult>
  cancel(): void
  release(urls: readonly string[]): void
  registerStrategy(type: string, strategy: RuntimePreloadStrategy): void
}
```

`RuntimePreloadManifestInput` accepte un manifeste ou un tableau de
manifestes. `RuntimePreloadOptions` porte `mode`, `timeout` et le `container`
de portée CSS. `RuntimePreloadResult` fournit les ressources chargées, les
ressources ignorées, les métadonnées et les warnings éventuels.

Le constructeur ne crée pas de singleton global : le cache est fourni par
l'hôte ou créé pour cette instance de service, puis peut être partagé explicitement. Le
résultat et ses métadonnées sont transmis à l'engine par une entrée de
ressources explicite ; ils ne sont jamais injectés implicitement par
`InstanceFacade.init()`.

Les entrées `register` et `override` sont acceptées uniquement pendant la
création de l'engine. Le catalogue core et les extensions `foreign` sont alors
composés, validés puis verrouillés en interne. L'interface ne propose pas de
`engine.register()` après création.

#### Instances et hôte HTML/DOM

```text
codplay.instances.create(options) -> InstanceFacade
codplay.instances.get(instanceId) -> InstanceFacade | undefined
codplay.instances.destroy(instanceId)
engine.destroy()
```

`options` contient notamment `instanceId`, `CompiledScene`, les fonctions
compilées, la racine HTML et les cibles de montage. L'assemblage CodPlay fournit
toujours le runner et la materialisation HTML/DOM. La création d'une instance
ne modifie pas le catalogue et ne partage ni racine ni état runtime avec une
autre instance. Aucun materializer n'est fourni par l'appelant.

#### Ticker et pilotage de l'engine

```text
engine.start()
engine.pause() // suspend la propagation, sans repositionner les instances
engine.stop() // cesse l'emploi de la machine, sans remise à zéro imposée
engine.advance(nowMs, marginMs?)
engine.events.emit(input)
```

`start` concerne le ticker construit par `CodPlay` ; `advance` est le point
d'entrée lorsque l'hôte fournit les frames. Dans ce second mode, le scheduler
de l'hôte reste sa propriété et n'est jamais répliqué par CodPlay. `pause` ou
`stop` peuvent laisser les appels `advance` arriver, mais aucune frame n'est
alors propagée aux instances. `emit` lit dans `input` l'`instanceId`, l'eventime et la cible
`scene`/`story`/`track`, puis transmet ces mêmes données à l'instance. Une
erreur d'injection est publiée par le diagnostic ; l'engine adresse et ordonne,
il ne résout pas les règles de scène.

#### Pilotage d'instance et telco

```text
const { telco } = instance
telco.play()
telco.pause()
telco.togglePlay()
telco.setRate(rate)
telco.seek(timeMs)
telco.rewind()
telco.getState()
telco.getProgress() // getter optionnel : temps courant et durée
telco.onChange(listener)
telco.onProgress(listener)
```

La telco ne connaît ni `RuntimePlayer`, ni `RuntimeEngine`, ni le catalogue.
Elle regroupe la surface de commande et d'observation utilisée par la
télécommande ; elle n'introduit aucun circuit concurrent. La destruction de
l'instance reste une opération de teardown du propriétaire, distincte de la
destruction éventuelle de l'adaptateur telco.

#### Events entrants et capture

```text
instance.events.emit(eventime, target)
```

La cible est donc un contexte de commande séparé ; elle ne modifie pas la
forme de l'eventime déclaré dans une scène. `engine.events.emit` reçoit
`instanceId` pour sélectionner l'instance, puis transmet la même cible
`story`/`scene`/`track` que celui utilisé par une scène. Il ne crée pas de
nouveau type de cible et ne déduit jamais le track à partir du nom de
l'eventime.

`instance.events.emit` reçoit un eventime racine pouvant contenir des eventimes enfants et une
cible `scene` ou `story` avec son `trackId` éventuel. Il utilise le temps
logique courant de l'instance comme ancrage et le journal unique. `startAt`
reste un offset relatif ; son omission à la racine vaut zéro. La cible n'est
jamais déduite du nom de l'eventime.
Les captures suivent la même frontière `begin -> track -> end / cancel`, sans
variante DnD dans la façade.

#### Observation et events sortants

La portée de l'eventime détermine sa visibilité :

- `story` reste interne à la story productrice ;
- `scene` est visible au niveau de la scène et suit la materialisation de ses
  stories ;
- `public` sort de la scène et est observable par l'hôte ou Sighty.

```text
instance.events.onEvent(listener)
instance.diagnostic.onDiagnostic(listener)
engine.events.onEvent(listener)
```

Les listeners retournent une fonction de désabonnement. `onEvent` ne remonte
que les eventimes de portée `public` ; les portées `story` et `scene` restent
dans le circuit de l'instance. Le journal interne ne devient jamais observable
par défaut. Les erreurs d'opération sont publiées par le diagnostic, jamais
retournées comme `{ ok: false }`.

#### Snapshot d'édition

`InstanceFacade` expose directement `snapshot`, décrit en §8, avec :

```text
snapshot.get()
snapshot.set([{ target: { storyId, persoId }, timeMs, state }])
snapshot.clear()
```

Cette capacité n'ouvre aucun handle runtime.

#### Preload et diffusion

`codplay.preload` rend la capacité externe utilisable par Sighty, l'éditeur et
la diffusion. `run()` est une commodité autonome qui peut
enchaîner `preload.load -> init -> play` avec ce même service. Ni `preload`, ni
`run` ne créent une seconde matérialisation DOM et ne deviennent des méthodes
cachées de l'instance.

### 9.2 Phases de réalisation regroupées par thème

#### Phase A — contrat public et registre — implémentée

- [x] valider les noms `CodPlay`, `engine` et `instance` ;
- [x] fixer l'usage du `DiagnosticCollector` pour les erreurs de façade : `error`
  si l'opération est bloquée, `warning` si elle peut continuer, sans enveloppe
  de retour `{ ok: false }` ;
- [x] valider le regroupement des capacités d'instance (`telco`, `events`,
  `diagnostic`) et la liste stricte des accès directs autorisés ;
- [x] valider `new CodPlay(options)`, l'injection du `frameScheduler` et les groupes
  `register/override` de composants, services et modules ;
- [x] refuser explicitement tout `register` ou `override` après le verrouillage du
  catalogue ;
- [x] fixer la frontière de l'hôte HTML/DOM par instance et des ressources partagées ;
- [x] appliquer la portée nommée des eventimes (`story`, `scene`, `public`) et
  réserver l'observation sortante aux events `public` ;
- [x] regrouper l'observation du contexte des events runtime sous
  `instance.diagnostic.onTrace`, sans modifier `onDiagnostic` ni `events.onEvent` ;
- [x] retenir les deux modes d'application : event non daté enregistré à l'ancrage
  et présenté au prochain tick ; event daté inscrit dans la timeline ;
- [x] retenir `startAt` comme offset relatif et ne pas exposer de temps absolu ;
  valider la convention d'une racine sans `startAt` pour l'immédiat ;
- [x] conserver la forme de la cible : `instanceId` au niveau engine,
  puis story/scene/track au niveau de l'instance ;
- [x] ne pas exposer les classes internes comme contrat public.

#### Phase B — engine, instances et hôtes HTML/DOM — implémentée pour la façade de base

- [x] créer les types de configuration, options d'instance, snapshots et résultats ;
- [x] exposer `engine.builder.compile({ scene })` avec le catalogue de l'engine et
  retourner `compiledScene`, `functions` et les diagnostics sans créer d'instance ;
- [x] encapsuler la création et le verrouillage du catalogue core/foreign ;
- [x] créer, ordonner et détruire les instances via `codplay.instances` ;
- [x] créer `engine.destroy()` avec la façade et lui faire orchestrer l'arrêt du
  ticker, le teardown idempotent de toutes les instances puis la libération
  des ressources partagées ;
- [x] déléguer `start`, `pause`, `stop` et `advance` à `RuntimeEngine` ;
- [x] faire respecter par `engine.pause` la suspension de la propagation sans
  repositionnement ;
- [x] faire respecter par `engine.stop` l'arrêt de la propagation sans remise à
  zéro imposée ;
- [x] refuser par diagnostic l'utilisation simultanée d'un ticker possédé et de
  `advance()` externe ;
- [x] fournir l'assemblage HTML/DOM par instance sans introduire de DOM ou
  catalogue secondaire ;
- [x] partager le catalogue et l'horloge entre les instances d'un même engine,
  sans partager leur racine ni leur état runtime ;
- [x] conserver le seek groupé comme transaction interne du runtime ; la façade
  ne l'expose pas et le seek public passe par `instance.telco` ;
- [x] garantir que `engine.start` réarme le ticker sans recréer d'instance ni de
  circuit de lecture ;
- [x] rendre le teardown idempotent : chaque instance et ses materializations sont
  détruites une seule fois.

#### Phase C — pilotage et telco — implémentée

- [x] regrouper `play`, `pause`, `togglePlay`, `setRate`, `seek` et `rewind` sous
  `instance.telco` ;
- [x] intégrer au même endroit la lecture du progress par `onProgress` et son
  écriture par `seek` ; le getter `getProgress` reste optionnel et fournit le
  temps courant ainsi que la durée, notamment lorsque l'instance est en pause ;
- [x] retenir la propriété telco immédiatement liée ; aucune variante d'acquisition
  différée ne sera exposée ;
- [x] ne pas exposer `RuntimePlayer.init()` dans la telco : l'initialisation est
  effectuée par le cycle de création de l'instance après validation des
  ressources ;
- [x] ne pas exposer `RuntimePlayer.refresh()` dans la telco : il reste une
  opération interne de réapplication liée au materializer ;
- [x] adapter `RuntimeTelco` à cette propriété d'instance ;
- [x] relayer par `onChange` les transitions de la cible, notamment
  `sequenceEnded`, et désactiver le seek du remote en purgeant ses demandes
  différées ;
- [x] retirer du remote V2 tout calcul de l'état publié et tout accès direct au runner ;
- [x] vérifier que la telco reste l'unique surface de commande de lecture ;
- [x] laisser le teardown de l'instance au propriétaire, hors commandes telco ;
- [x] ne pas créer de boucle de lecture ni de ticker dans la telco.
- [x] réveiller et suspendre automatiquement le ticker CodPlay depuis les
  commandes telco, sans exposer ce raccord au layout ou à la démo ; conserver
  les commandes générales de l'engine pour le futur hôte qui le déclarera comme
  pilote.

#### Phase D — events et capture — façade eventime implémentée ; capture publique hors tranche

- [x] appliquer le transport de cible séparée et les règles de ciblage
  `instanceId -> scene/story -> trackId` ;
- [x] valider et détacher la forme externe de l'eventime avant toute écriture dans
  le runtime ;
- [x] construire une méthode interne unique d'intégration d'eventime, sans
  exposer `CompiledEventime`, `applyAtMs`, le journal ou le dispatcher ;
- [x] normaliser la racine éventuellement sans `startAt` et additionner uniquement
  les offsets relatifs des enfants ; ne pas introduire de syntaxe
  `startAt: "+200"` sans décision de contrat ;
- [x] différer la présentation d'un event non daté au prochain tick normal, y
  compris lorsque ce tick est fourni par `engine.advance()` ; ne pas conserver
  la matérialisation synchrone actuelle comme comportement de façade ;
- [x] faire de `instance.events.emit` un simple accès au circuit d'entrée unique du
  player, puis faire déléguer `engine.events.emit` vers cette même entrée après
  adressage ;
- [x] étendre ce circuit central pour les occurrences datées sans relancer le
  player ni créer de dispatcher ou de journal parallèle ;
- [x] conserver les offsets relatifs des eventimes et exclure `applyAtMs` de l'API ;
- [x] conserver le cycle capture du cœur et ses sources runtime sans l'exposer par
  une nouvelle capacité de façade ;
- [x] garantir la frontière `persist-only` et la reconstruction commune au Play et
  au Seek.

#### Phase E — observation, preload et diffusion — base de façade implémentée

- [x] ajouter les diagnostics sous `instance.diagnostic`, l'état de lecture sous
  `instance.telco` et l'observation des events de portée `public` sous
  `instance.events` ;
- [x] exposer `instance.diagnostic.onTrace` pour les events live ajoutés au
  journal, sans strap attrape-tout ni journal parallèle ;
- [x] raccorder l'assemblage HTML/DOM core par défaut à la façade sans exposer
  `HtmlPlayerRunner` ni le catalogue ;
- [x] exposer `codplay.preload -> RuntimePreloadApi` depuis le propriétaire
  `CodPlay`, sans le rattacher à une instance de scène ;
- [x] fixer le transfert explicite des ressources et métadonnées preload vers
  l'engine ;
- [x] conserver `run()` comme option de diffusion autonome.

#### Phase F — migration et validation — en cours

- [x] migrer `packages/demos/src/v2/layout/layout.ts` ;
- [x] supprimer `createDemoRuntimeCatalog` ;
- [x] supprimer tout appel de démo à `createCoreRuntimeCatalog`, `getComponent`,
  `overrideComponent` et aux constructeurs runtime internes ;
- [x] vérifier que `flip-stress` reste une scène uniquement ;
- [x] vérifier que `layout` publie toutes les zones `data-part` de son template
  sans configuration portée par la démo ;
- [x] vérifier sur la façade les commandes telco, leur propagation vers le
  player HTML et la publication du progress ;
- [x] vérifier sur la façade le cycle public de l'engine (`start`, `pause`,
  `stop`, `advance`) : la pause et l'arrêt ne repositionnent pas l'instance et
  les frames externes suivent la même propagation ;
- [x] vérifier sur la façade l'injection directe et adressée des eventimes, leur
  attente du tick normal et la visibilité des events publics ;
- [x] vérifier que le contexte trace remonte les events live une seule fois,
  sans les rendre publics et sans bloquer le circuit si un observateur échoue ;
- [x] vérifier le transfert explicite du preload, y compris les ressources
  `skipped`, ainsi que les diagnostics non bloquants ;
- [x] inscrire les verticales V2 `runner` et `flip-nested` dans le registry
  commun, avec les scènes runner fournies comme modules sans runtime parallèle ;
- [x] vérifier la composition `foreign`, l'absence de registre secondaire et le
  teardown idempotent des instances ;
- [x] transposer l’horizon ouvert V1 : durée d’instance facultative, progression
  par ticks et extension par les événements compilés ou journalisés ;
- [x] vérifier que la télécommande officielle étend le curseur de seek lorsque
  `onProgress` découvre un nouvel horizon ;
- [x] exécuter la suite complète V2 : 80 fichiers et 508 tests passés ;
- [x] compiler l'application de démos V2 avec le layout public ;
- [x] vérifier dans Firefox headless les routes registry `runner` et
  `flip-nested`, avec Play et Seek via la télécommande commune ;
- [x] valider visuellement `flip-stress` dans le navigateur et conserver cette
  vérification séparée des tests de façade ; lecture lancée, temps avancé et
  aucune erreur console constatée dans Safari.

L'implémentation de `instance.snapshot` (lecture, preview temporaire et accès
éventuel aux nœuds) est reportée au chantier de reprise de l'éditeur. Elle ne
fait pas partie de l'implémentation actuelle de la façade V2 et ne bloque pas
sa clôture.

## État de travail

Le contrat de base est validé et son implémentation est terminée ; la
validation de l’horizon ouvert V1 est suivie dans la phase F.

Déjà implémenté :

- `new CodPlay(options)`, avec `codplay.engine`, `codplay.instances` et `codplay.preload` ; le
  `frameScheduler` est injecté au constructeur et le `TimeTicker` reste interne ;
- `engine.builder.compile({ scene })`, lié au catalogue configuré de l'engine ;
- composition unique core/foreign et verrouillage du catalogue ;
- création, adressage, pilotage et destruction des instances ;
- `instance.telco`, sa progression branchée sur les notifications du player,
  son horizon fixe ou découvert, et le cycle externe ou possédé de l'engine ;
- `instance.events`, `engine.events`, l'adressage séparé et l'eventime récursif ;
- diagnostics par le canal V2 existant, trace de contexte des events sous
  `instance.diagnostic` et transfert explicite des ressources ;
- tests de contrat du socle et absence de ticker propre à la telco.

Validation exécutée :

- `npm test --workspace=codplay` : 80 fichiers, 508 tests passés ;
- `npm run typecheck --workspace=codplay` : succès ;
- `npm run build --workspace=@codplay/demos` : succès ;
- le typecheck global des démos et celui de `@codplay/remote` restent bloqués
  par les erreurs V1/`typed-om-polyfill` préexistantes, sans erreur dans cette
  tranche ;
- `git diff --check` : succès.

Reste à valider dans ce plan : la suite complète après le portage de l’horizon
ouvert et le contrôle navigateur associé. La propriété `idle` est explicitement
hors de ce plan et sera traitée séparément.

La reprise séparée de l'accès authoring de l'éditeur reste un chantier
ultérieur, hors de ce plan.

Le [descriptif de découverte et d'état destiné aux agents](./notes/2026-08-26-decouverte-etat-codplay-v2.md)
est créé. Aucune API supplémentaire ne doit être ajoutée en dehors de ces
éléments.

## 10. Proposition de recentrage de la façade — à relire

Cette section conserve l'état implémenté ci-dessus comme référence actuelle. Elle
enregistre une proposition d'évolution de l'API utilisateur ; elle ne constitue
pas encore un contrat et ne doit pas être implémentée avant relecture.

### Avant — surface actuellement implémentée

La façade crée le propriétaire `CodPlay`, mais le parcours principal traverse
encore l'objet `engine` :

```ts
const codplay = new CodPlay({
  components,
  services,
  modules,
  resources,
  diagnosticOutput,
  frameScheduler,
  preload,
})

const engine = codplay.engine
const build = engine.builder.compile({ scene })
const instance = codplay.instances.create({
  ...options,
  compiledScene: build.compiledScene,
  functions: build.functions,
})

engine.resources.register(resources)
engine.events.onEvent(listener)
engine.start()
codplay.destroy()
```

Surface correspondante :

```text
codplay.engine.builder
codplay.engine.resources
codplay.engine.events
codplay.instances
codplay.preload
codplay.engine.start/pause/stop/advance/destroy
codplay.destroy()
```

### Après — façade orientée usage utilisateur

`CodPlay` devient l'API de parcours. Les options propres à la composition de
l'engine sont regroupées sous `options.engine`, tandis que les capacités
utilisées directement par l'appelant sont portées par `codplay` :

```ts
const codplay = new CodPlay({
  engine: {
    components,
    services,
    modules,
    resources,
    diagnosticOutput,
  },
  frameScheduler,
})

const build = codplay.build({ scene })
const instance = codplay.instances.create({
  ...options,
  compiledScene: build.compiledScene,
  functions: build.functions,
})

codplay.resources.register(definition)
codplay.events.onEvent(listener)
codplay.engine.start()
codplay.destroy()
```

Surface proposée :

```text
CodPlay
  ├─ build(...)
  ├─ components.register/override
  ├─ services.register/override
  ├─ modules.register/override
  ├─ resources.register/override
  ├─ instances
  ├─ events
  ├─ engine.start/pause/stop/advance   # pilotage technique avancé
  └─ destroy                           # teardown utilisateur
```

Le type d'options envisagé devient :

```ts
type CodPlayOptions = Readonly<{
  engine?: CodPlayEngineOptions
  frameScheduler?: CodPlayFrameScheduler
  pauseOnDocumentHidden?: boolean
}>

type CodPlayEngineOptions = Readonly<{
  components?: CodPlayCapabilityGroup<RuntimeComponentDefinition>
  services?: CodPlayCapabilityGroup<RuntimeComponentServiceDefinition>
  modules?: CodPlayCapabilityGroup<RuntimeModuleServiceDefinition>
  resources?: CodPlayResourceRegistration
  diagnosticOutput?: DiagnosticOutput
}>
```

Décisions à commenter avant modification du code :

- `build`, les registres `components`, `services`, `modules`,
  `resources` et `events` remontent sur `CodPlay` sans créer de second
  circuit ;
- `codplay.instances` reste le seul registre public de création, adressage et
  destruction des instances ;
- `codplay.preload` et son interface sont reportés ; ils ne sont pas justifiés
  par la proposition actuelle ;
- `codplay.engine` est réduit au pilotage technique avancé
  (`start`, `pause`, `stop`, `advance`) ;
- `codplay.destroy()` est le teardown utilisateur ; le maintien éventuel de
  `engine.destroy()` comme primitive publique reste à décider ;
- les options de composition de l'engine sont regroupées sous `options.engine`.

## 12. Amendement — choix build et registres complets — En cours

### 12.1 Décisions enregistrées

| Sujet | Décision |
|---|---|
| méthode de construction de l'artefact | codplay.build(input, options?) |
| codplay.compile(...) | non retenu |
| codplay.builder | supprimé de la surface proposée |
| preload | reporté ; interface non justifiée |
| registre d'instances | codplay.instances uniquement |
| pilotage technique | codplay.engine.start/pause/stop/advance |
| teardown utilisateur | codplay.destroy() |

### 12.2 Entrées de registre actuelles

| Entrée | Version actuelle |
|---|---|
| options.components.register[] | composition au constructeur |
| options.components.override[] | composition au constructeur |
| options.services.register[] | composition au constructeur |
| options.services.override[] | composition au constructeur |
| options.modules.register[] | composition au constructeur |
| options.modules.override[] | composition au constructeur |
| codplay.engine.resources.register(resources) | présent |
| codplay.engine.resources.override(resources) | absent |
| codplay.engine.builder.compile(input, options?) | présent |
| codplay.engine.events.emit(input) | présent |
| codplay.engine.events.onEvent(listener) | présent |
| codplay.instances.create(options) | présent |
| codplay.instances.get(instanceId) | présent |
| codplay.instances.destroy(instanceId) | présent |

Les groupes components, services et modules sont composés dans le même catalogue
que les registres directs. Le catalogue reste ouvert après `new CodPlay(options)`
et se verrouille à la première opération qui consomme ses définitions :
`codplay.build(...)` ou `codplay.instances.create(...)`. Les appels directs
`register/override` sont donc possibles entre la construction de la façade et
ce verrouillage, sans créer de catalogue parallèle. Après verrouillage, ils
retournent un `CodPlayRegistryResult` en échec et publient le diagnostic de
façade correspondant.

### 12.3 Registres proposés

#### Contrat commun register / override

~~~ts
type CodPlayRegistryError = Readonly<{
  code: string
  message: string
  details?: Readonly<Record<string, unknown>>
}>

type CodPlayRegistryResult =
  | Readonly<{
      ok: true
      status: 'registered' | 'overridden'
    }>
  | Readonly<{
      ok: false
      error: CodPlayRegistryError
    }>

type CodPlayRegistry<Definition> = Readonly<{
  register: (definition: Definition) => CodPlayRegistryResult
  override: (definition: Definition) => CodPlayRegistryResult
}>
~~~

#### Entrées complètes

~~~ts
type CodPlayComponents = CodPlayRegistry<RuntimeComponentDefinition>
type CodPlayServices = CodPlayRegistry<RuntimeComponentServiceDefinition>
type CodPlayModules = CodPlayRegistry<RuntimeModuleServiceDefinition>

type CodPlayResources = Readonly<{
  register: (registration: CodPlayResourceRegistration) => void
}>
~~~

Noms de familles V1 à comparer aux noms pluriels proposés :

~~~text
codplay.component.register(definition)
codplay.component.override(definition)
codplay.service.register(definition)
codplay.service.override(definition)
codplay.module.register(definition)
codplay.module.override(definition)
~~~

~~~text
codplay.components.register(definition)
codplay.components.override(definition)

codplay.services.register(definition)
codplay.services.override(definition)

codplay.modules.register(definition)
codplay.modules.override(definition)
~~~

#### Clés de registre

| Registre | Clé candidate | Définition candidate |
|---|---|---|
| codplay.components | type | RuntimeComponentDefinition |
| codplay.services | name | RuntimeComponentServiceDefinition |
| codplay.modules | id ou name | RuntimeModuleServiceDefinition |

### 12.4 CodPlayApi proposé

~~~ts
type CodPlayApi = Readonly<{
  readonly build: CodPlayBuildMethod
  readonly components: CodPlayComponents
  readonly services: CodPlayServices
  readonly modules: CodPlayModules
  readonly resources: CodPlayResources
  readonly instances: CodPlayInstances
  readonly events: CodPlayEvents
  readonly engine: CodPlayEngine
  destroy: () => void
}>

type CodPlayBuildMethod = (
  input: CodPlayCompileInput,
  options?: CodPlayCompileOptions,
) => CodPlayCompileResult
~~~

Les types CodPlayCompileInput, CodPlayCompileOptions et CodPlayCompileResult
peuvent rester nommés selon l'artefact de compilation ; seul le point d'entrée
utilisateur est renommé build.

### 12.5 Arbre proposé complet

~~~text
CodPlay
├── build(input, options?)
├── components
│   ├── register(definition)
│   └── override(definition)
├── services
│   ├── register(definition)
│   └── override(definition)
├── modules
│   ├── register(definition)
│   └── override(definition)
├── resources
│   └── register(registration)
├── instances
│   ├── create(options)
│   ├── get(instanceId)
│   └── destroy(instanceId)
├── events
│   ├── emit(input)
│   └── onEvent(listener)
├── engine
│   ├── start()
│   ├── pause()
│   ├── stop()
│   └── advance(nowMs, marginMs?)
└── destroy()
~~~

preload et son arbre load/state/cancel/release/registerStrategy sont exclus de
cet arbre jusqu'à justification de leur interface.

### 12.6 Mapping complet

| Version actuelle | Proposition |
|---|---|
| options.components.register[] | codplay.components.register(definition) |
| options.components.override[] | codplay.components.override(definition) |
| options.services.register[] | codplay.services.register(definition) |
| options.services.override[] | codplay.services.override(definition) |
| options.modules.register[] | codplay.modules.register(definition) |
| options.modules.override[] | codplay.modules.override(definition) |
| codplay.engine.resources.register(resources) | codplay.resources.register(registration) |
| codplay.engine.builder.compile(input, options?) | codplay.build(input, options?) |
| codplay.engine.events.emit(input) | codplay.events.emit(input) |
| codplay.engine.events.onEvent(listener) | codplay.events.onEvent(listener) |
| codplay.instances.create(options) | codplay.instances.create(options) |
| codplay.instances.get(instanceId) | codplay.instances.get(instanceId) |
| codplay.instances.destroy(instanceId) | codplay.instances.destroy(instanceId) |
| codplay.preload.* | reporté |
| codplay.engine.start/pause/stop/advance | codplay.engine.start/pause/stop/advance |
| codplay.destroy() | codplay.destroy() |

### 12.7 Points ouverts après la tranche components/services/modules

| Point | État |
|---|---|
| moment des register/override components/services/modules | avant le premier `build` ou `instances.create`; verrouillage ensuite |
| options.engine.components/services/modules versus registres directs | même catalogue et même circuit; options initiales puis appels directs |
| résultat RegistryResult versus diagnostics de façade | résultat structuré retourné; échec également publié en diagnostic |
| aliases V1 component/service/module versus noms pluriels proposés | noms pluriels retenus; pas d'alias singulier |
| implémentation des registres components/services/modules | implémentée; validée par tests de contrat |
| preload | chantier séparé |

### 12.8 Implémentation de la tranche directe

Les décisions suivantes sont maintenant appliquées dans `packages/codplay` :

| Élément | Implémentation |
|---|---|
| options de composition | `CodPlayOptions.engine` contient `components`, `services`, `modules`, `resources` et `diagnosticOutput` |
| construction | `codplay.build(input, options?)` appelle le `SceneBuilder` du catalogue unique |
| composants | `codplay.components.register/override(definition)` |
| services | `codplay.services.register/override(definition)` |
| modules | `codplay.modules.register/override(definition)` |
| résultat de registre | `{ ok: true, status }` ou `{ ok: false, error }`; l'échec est aussi publié au canal de diagnostic |
| verrouillage | le catalogue reste ouvert après construction, puis se verrouille au premier `build` ou `instances.create` |
| events | `codplay.events.emit/onEvent` |
| resources disponibles | `codplay.resources.register(CodPlayResourceRegistration)` |
| engine | `start/pause/stop/advance` uniquement sur la vue publique |
| teardown | `codplay.destroy()`; le `destroy` interne n'est pas exposé par `codplay.engine` |
| preload | conservé provisoirement sur `codplay.preload` pour les démos; son contrat reste hors de cette tranche |

Les registres directs et les groupes `options.engine.*` appellent les mêmes
méthodes de `RuntimeCapabilityCatalog`. Aucun catalogue ni circuit runtime
secondaire n'est créé. Les définitions sont donc utilisables par la validation,
la création des modules player-scoped et la matérialisation HTML après un seul
`build`.

Validation de la tranche :

- `npm test --workspace=codplay` : 73 fichiers, 474 tests passés ;
- `npm run typecheck --workspace=codplay` : succès ;
- `npm run build --workspace=@codplay/demos` : succès ;
- `git diff --check` : succès.
