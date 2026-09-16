# Sighty — scénario, graphe de vues et runtime

## Statut

**En cours — réécriture de la navigation engagée le 2026-09-15.**

Cette spécification décrit le contrat actuellement exécuté par la première
verticale de la réécriture et distingue explicitement trois niveaux :

- l’API auteur, écrite dans le fichier de déclaration ;
- l’API d’intégration, utilisée par l’application hôte qui instancie Sighty ;
- les types internes, produits et utilisés par Sighty pour exécuter le
  scénario.

La première verticale exécute déjà les conditions d’accès et de sortie par
portée (`accessBy`, `exitBy`, `onDenied`), la résolution des `data` `entry` et
`live`, le reset, les sources de scènes lazy et les mutations versionnées. Ces
comportements sont décrits comme tels dans cette spécification. Une même
`SceneKey` peut avoir une occurrence CodPlay indépendante dans chaque slot
actif qui la sélectionne. Le pilotage d’une télécommande n’existe dans Sighty
que dans le contexte d’un couplage déclaré par le fichier scénario : la scène
telco émet ses événements publics et Sighty règle en interne l’accrochage à la
liaison active. La persistance sérialisée d’un parcours
n’appartient pas à cette reprise et ne constitue pas un contrat Sighty actuel.
Lorsqu’une application hôte aura besoin de persister un parcours, cette
responsabilité relèvera de son intégration et non de Sighty.

Le modèle de conception de référence est la
[note du modèle de fichier déclaratif](../notes/2026-08-17-modele-fichier-declaratif.md).
La reconstruction et son ordre d’implémentation sont suivis dans le
[plan de reconstruction de la navigation](../plan/2026-09-15-sighty-navigation-reconstruction-plan.md).

## 1. Responsabilités et frontières

Sighty conduit un parcours de vues composé de scènes CodPlay. Il possède le
fichier de scénario, son index, la résolution des routes, la composition
logique active et l’admission des événements. Il coordonne également une
présentation physique interne, qui peut conserver une relation de montage
indépendamment de cette composition logique. CodPlay possède la compilation,
les occurrences de scènes, leur telco, leur rendu, leurs ressources et les
montages entre surfaces CodPlay.

Sighty ne crée pas de markup, ne recherche pas d’élément HTML et ne déplace pas
les racines rendues. Il demande les montages au moyen de la façade publique
CodPlay et conserve dans un registre interne les relations physiques et les
handles nécessaires à leur remplacement ou à leur détachement effectif.

La composition logique et la présentation physique sont deux représentations
distinctes d’un même scénario : une sortie logique ferme sa liaison et retire
la sélection de la composition active, mais ne signifie pas à elle seule que
les racines doivent être démontées. Cette distinction permet à un layout de
présenter des carousels, des scènes parallèles ou des imbrications sans que le
routeur Sighty présume leur structure visuelle.

Les démos sont des fixtures de validation non normatives. Elles fournissent un
fichier, un catalogue de `SceneDoc` et, lorsque le scénario le demande, des
actions de présentation. Aucune démo ne recrée l’index ni le routeur de
Sighty. Leur priorité et leur statut de validation sont suivis dans les plans,
pas dans ce contrat.

## 2. Entrée publique unique

`Sighty` est l’unique point d’entrée du package. Une instance regroupe deux
surfaces publiques distinctes :

```ts
const sighty = new Sighty({
  scenario: { file, scenes, data },
  runtime: {
    root,
    instanceIds,
    layout: { sceneKey: 'scene-layout', storyId: 'main' },
  },
})

const diagnostics = sighty.scenario.validate()
await sighty.runtime.initialize()
await sighty.runtime.dispatch({ name: 'navigation:next' })
sighty.runtime.destroy()
```

`scenario` ne crée ni instance, ni player, ni montage. `runtime` exécute le
scénario validé et raccorde les scènes à CodPlay.

## 3. API auteur publique

Cette section concerne uniquement ce que l’auteur écrit ou qu’un outil
d’authoring produit. Elle ne décrit ni l’index, ni la composition active, ni
les occurrences CodPlay.

### 3.1. Forme déclarative

La forme de travail actuelle est un graphe récursif de listes et de maps :

```ts
type ViewGraph<SceneKey, SlotName> =
  | readonly ViewListEntry<SceneKey, SlotName>[]
  | {
      start: string
      views: Record<string, GraphView<SceneKey, SlotName>>
      actions?: Record<string, ViewAction>
      showMode?: 'reset' | 'maintain' | 'rewind'
    }

type ViewListEntry<SceneKey, SlotName> =
  GraphView<SceneKey, SlotName> & { id: string }

type GraphView<SceneKey, SlotName> = {
  view: {
    scene?: SceneKey
    views?: ViewGraph<SceneKey, SlotName>
    slots?: Partial<Record<SlotName, ViewGraph<SceneKey, SlotName>>>
  }
  actions?: Record<string, ViewAction>
  coupling?: CouplingDescriptor<SlotName>
  accessBy?: SightyCondition
  exitBy?: SightyCondition
  onDenied?: RouteTarget
  data?: Record<string, unknown | DataBinding>
  showMode?: 'reset' | 'maintain' | 'rewind'
}

type CouplingDescriptor<SlotName> = {
  couplingId: string
  controllerSlot?: SlotName
  controlledSlot: SlotName
  commands: Record<string, TelcoCommand | readonly TelcoCommand[]>
}

type TelcoCommand =
  | 'play'
  | 'pause'
  | 'togglePlay'
  | 'setRate'
  | 'seek'
  | 'rewind'
  | 'reset'

type ViewAction = {
  action?: string
  go?:
    | { path: string }
    | { label: string }
    | { direction: 'next' | 'previous' | 'up' | 'down' }
}
```

Une `ViewList` utilise l’ordre déclaré pour `next` et `previous`, mais chaque
entrée possède un `id` stable. Une `ViewMap` utilise ses clés et son `start`.
Les graphes de `views` et de `slots` peuvent être imbriqués sans devenir une
liste plate de placements.

La forme historique de fichier v1, qui contient un tableau de placements, est
normalisée à la frontière du scénario vers ce même graphe. Elle ne crée pas un
second exécuteur.

### 3.2. Scènes, slots et identifiants auteur

`SceneKey` désigne une scène fournie par l’application autour du fichier.
`SlotName` désigne le nom d’un slot déclaré dans la scène layout. `ViewId`
désigne la clé d’une vue de map ou l’identifiant stable d’une entrée de liste.

Le fichier décrit ces références. Il ne décrit pas l’instance physique qui
sera créée pour les exécuter. Les formes `ViewAddress`, `SlotAddress`,
`OccurrenceId`, `BindingId`, `Generation` et `Revision` ne sont pas des champs
que l’auteur doit écrire.

### 3.3. Fichier et fonctions d’auteur

Le fichier de déclaration n’est pas limité par principe à JSON. Comme dans
CodPlay, l’API auteur peut exposer des fonctions ou d’autres mécanismes
exécutables dans la forme écrite par l’auteur.

La forme compilée/exportable est une représentation différente. À cette
frontière, les fonctions peuvent être extraites, référencées ou remplacées
par une représentation portable selon le contrat de compilation. Cette
contrainte appartient à l’export, pas à une interdiction artificielle imposée
au fichier auteur.

La tranche de navigation actuellement exécutée utilise les références
`action` et le catalogue d’actions d’intégration. Les conditions peuvent être
des fonctions d’auteur ou des références résolues par le catalogue de
conditions d’intégration. La représentation compilée/exportable de ces
fonctions reste une question de frontière d’export, pas une seconde exécution.

### 3.5. Politique d’affichage d’une scène

`showMode` est la propriété auteur qui règle le traitement d’une occurrence
lorsqu’une vue est admise. Elle accepte exclusivement `reset`, `maintain` ou
`rewind`. La valeur peut être placée sur le fichier, un graphe (notamment le
graphe d’un slot), une vue parente ou la vue active ; elle est héritée selon la
même priorité de portée que les conditions : vue active, graphe contenant,
puis vues parentes. Une valeur locale remplace la valeur héritée.

L’option d’intégration `runtime.showMode` se place entre la valeur par défaut
du runtime et `file.showMode`. La valeur par défaut intégrée est `rewind`.
L’absence d’une déclaration auteur n’empêche donc pas une scène nouvellement
admise de démarrer, tandis qu’une déclaration `maintain` ou `reset` modifie
explicitement le comportement d’une réadmission.

- `reset` demande le reset logique CodPlay de l’occurrence conservée pour cette
  liaison ; il ne détruit ni ne recrée l’instance. La remise à zéro de l’état
  logique et des entrées runtime de la session suit le contrat CodPlay ; les
  eventimes auteur compilés restent ceux de la scène. Demo 4 ne conserve donc
  pas les entrées utilisateur d’une réadmission.
- `maintain` conserve l’occurrence, sa position, son état de lecture, son
  débit et son état logique. Une réadmission reprend uniquement si elle était
  en lecture au moment de sa sortie.
- `rewind` conserve l’occurrence et son état logique, appelle
  `telco.rewind`, puis démarre la scène admise.

La politique ne s’exécute que pour une sélection entrante d’une transition de
vue. Elle ne s’exécute pas sur un `play`, `pause`, `seek`, changement de
progression ou changement d’état de lecture. `runtime.initialize()` conserve
son contrat de ne pas démarrer implicitement toutes les telcos ; les entrées
issues d’une navigation admise passent, elles, par le coordinateur de
transition unique qui livre les données puis termine la lecture selon
`showMode`.

### 3.4. Conditions de parcours

La verticale exécutable retient deux usages distincts :

1. `accessBy` admet une entrée lorsqu’il renvoie vrai. La déclaration la plus
   spécifique parmi la vue, les graphes contenants et les vues parentes est
   utilisée. En cas de refus, `onDenied` est résolu comme une route déclarée ;
   à défaut, la route `next` est essayée. Une absence de cible ou une boucle de
   redirection produit un diagnostic et aucune composition partielle.
2. `exitBy` autorise la sortie d’une vue active lorsqu’il renvoie vrai. La
   condition la plus spécifique applicable est évaluée avant la
   réconciliation physique ;
   un refus bloque la transition.

Une condition reçoit l’événement de la demande, la `SceneKey`, les `data`
résolues, le contexte courant et l’état lisible de l’occurrence. Elle ne
modifie aucune de ces valeurs et ne fabrique pas de destination.

Les champs `accessBy`, `exitBy` et `onDenied` sont donc le vocabulaire exécuté
par cette verticale, tout en restant soumis à la validation de la forme
exportable. La fin d’une scène n’est pas, par elle-même, la fin d’une vue.
`scene:end` est un signal fonctionnel adressé à Sighty : la scène indique
qu’elle a terminé et laisse Sighty décider de la suite ; ce signal ne détache
ni ne libère l’occurrence. `sequence:end` conserve le comportement CodPlay
existant : il termine la séquence du player, arrête sa lecture, annule ses
captures actives, appelle le hook de fin et publie l’état de transport. Il ne
détruit ni l’instance, ni le montage, ni ses ressources. Un changement de vue
peut ensuite modifier la composition logique ; il ne provoque pas par lui-même
le détachement physique d’un montage qui reste possédé par la présentation.
Les deux signaux peuvent être associés à une action `go`
déclarée dans la vue, ou être observés par l’application hôte qui réinjecte une
intention avec `runtime.dispatch`. Dans les deux cas, l’admission Sighty reste
l’unique chemin de navigation ; l’émission d’un signal n’entraîne aucune
navigation implicite.

## 4. API d’intégration publique

L’application hôte porte la logique métier que Sighty projette. Elle fournit
les scènes et les options d’exécution, envoie des événements vers Sighty et
peut souscrire aux événements que Sighty rend accessibles à l’extérieur.

### 4.1. Surface `scenario`

La surface `scenario` expose :

- `file`, `scenes` et `data` ;
- `sceneKeys`, `getScene(sceneKey)` et `getData(dataKey)` ;
- `getView(sceneKey)` et `getViewGraph()` ;
- `getSlotNames(sceneKey)` ;
- `validate()`.

Elle réalise la normalisation et la validation auteur, mais aucun travail de
rendu ou d’exécution.

### 4.2. Entrée vers Sighty

`runtime.dispatch` est le point d’admission des événements et intentions
fournis par l’application hôte :

```ts
await sighty.runtime.dispatch({
  name: 'navigation:next',
  data: { origin: 'remote' },
})
```

La `sourceSceneKey`, lorsqu’elle est utilisée, est une identité auteur stable.
L’application ne fournit pas de génération, d’adresse interne, d’identifiant
d’occurrence ou de handle. Les demandes sont sérialisées par un coordinateur
unique et ne deviennent pas un historique permanent.

Lorsqu’une entrée externe fournit `sourceSceneKey`, cette scène doit posséder
une liaison active unique. Une source inactive ou ambiguë est ignorée avant la
résolution de l’action ; le nom de scène ne permet pas de contourner
l’invalidation d’une liaison sortie.

### 4.3. Sortie vers l’application hôte

La surface de sortie est le pendant de `dispatch` :

```ts
const unsubscribe = sighty.runtime.events.onEvent((event) => {
  host.receive(event.name, event.data, event.sourceSceneKey)
})
```

L’événement actuellement exposé est :

```ts
type SightyPublicEvent<SceneKey extends string = string> = {
  name: string
  sourceSceneKey?: SceneKey
  data?: Readonly<Record<string, unknown>>
}
```

Cette enveloppe ne contient ni player, ni montage, ni handle, ni adresse,
génération ou révision interne. Elle peut transporter les événements publics
de télécommande, les intentions de navigation et les informations produites
par une interaction de scène, y compris un formulaire, lorsque la scène les
déclare comme événements publics CodPlay.

Sighty écoute les événements publics des instances CodPlay. Pour une scène
active, il les adapte, les rend disponibles à l’hôte et les place dans le
même coordinateur d’admission que `dispatch`. Un événement d’une scène sortie
est abandonné avant publication et avant tout effet de navigation.

L’écoute interne est attachée à la liaison active de la sélection, et non à la
durée de vie générale de l’instance CodPlay. Elle est ouverte après le commit
d’une entrée et fermée avant le détachement d’une sortie. Une même `SceneKey`
peut ainsi être conservée ou réadmise sans laisser une ancienne liaison
recevoir les événements de la composition courante.

Cette écoute interne ne constitue pas une API de pilotage supplémentaire. Elle
est activée par la déclaration de couplage et l’admission de la composition ;
la scène telco reste la source de ses événements publics. Les événements
optionnels `on` et `off` peuvent être déclarés par cette scène lorsqu’un
scénario veut activer volontairement une fonctionnalité. Sighty les laisse
emprunter le même circuit d’événements ; il ne les fabrique pas et n’ajoute pas
de cycle automatique d’activation ou de désactivation.

La surface de sortie ne possède pas de `emit` parallèle : l’entrée vers Sighty
reste `dispatch`. L’abonnement retourne une fonction de désabonnement ; les
erreurs d’un observateur ne doivent ni interrompre les autres observateurs ni
le routage du scénario. La destruction supprime les abonnements et les
livraisons ultérieures.

`runtime.getInstance(sceneKey)` reste un sélecteur d’intégration permettant
d’atteindre l’instance dont l’interface `CodPlayTelco` est canonique lorsque la
scène est unique dans la composition active. Ce sélecteur n’est pas une
seconde API de commande : la telco CodPlay est le seul port d’exécution et
d’observation, que Sighty ne recopie pas. Les démos ne doivent pas introduire
une voie de commande concurrente.

`runtime.getInstanceAt(slotAddress)` accepte le chemin auteur dérivé d’un slot
et permet de viser son occurrence active lorsque la même `SceneKey` apparaît
plusieurs fois ; l’instance
retournée expose la surface `instance.telco` complète de CodPlay, c’est-à-dire
l’interface `CodPlayTelco` et le port telco unique
(`commandInFlight`, `rate`, `getState`, `getProgress`, `play`, `pause`,
`togglePlay`, `setRate`, `seek`, `rewind`, `reset`, `onChange` et `onProgress`). Le
chemin est dérivé de la déclaration ; il ne
permet pas de fournir une génération, une liaison ou un handle interne. Ces
surfaces ne font
pas partie de l’API auteur et ne doivent pas être utilisées pour contourner la
publication Sighty des événements destinés à l’application hôte.

### 4.4. Montage et pilotage

`runtime.initialize()` valide le fichier et compile les `SceneDoc`, puis
demande à CodPlay de créer et d’initialiser les occurrences nécessaires via
`owner.instances.create` avant de monter la composition initiale. Il ne
réimplémente pas l’initialisation du player. Le preload est un service séparé :
il prépare et enregistre les ressources avant la création lorsqu’il est requis,
mais ne constitue pas une primitive d’initialisation CodPlay. Le runtime ne
démarre pas implicitement toutes les telcos ; `runtime.play(sceneKey)` et
`runtime.playAll()` pilotent le démarrage explicite. `runtime.updateContext`
met à jour le contexte et réévalue les liaisons `data` live. `runtime.reset()`
demande le reset logique CodPlay sur les occurrences existantes, restaure le
contexte initial et réconcilie la composition ; il ne recrée pas les
occurrences et ne déclenche pas le preload. `runtime.mutate` publie une
nouvelle version validée du graphe selon la politique `preserve`, `rewind`,
`reset` ou `reload`.

Le `reset` de `instance.telco` reconstruit l'état logique à zéro dans la même
instance CodPlay et efface les faits runtime de sa session. Les eventimes auteur
compilés ne sont pas effacés. Il ne produit pas `sequence:end`, n'exécute pas
son hook auteur et ne détruit ni ne remonte l'occurrence. Après un
`sequence:end`, le play CodPlay réutilise cette reconstruction avant de relancer
la lecture ; les actions auteur et le hook de `sequence:end` restent propres au
traitement de cet événement terminal.

L’option d’intégration `runtime.showMode` fournit le défaut de l’instance ;
elle est surchargée par `file.showMode`, puis par les portées auteur selon la
règle de `showMode` décrite en §3.5.

Sighty transmet `runtime.codplay` à CodPlay sans modifier sa configuration
d’inactivité. L’option `runtime.codplay.engine.idle` est donc héritée selon le
contrat CodPlay lorsque l’application hôte la fournit ; l’absence de cette
option ne devient pas une valeur `false` injectée par Sighty et ne constitue
jamais un effet implicite de la telco.

Pour la composition et le parcours, le fichier déclaratif du scénario est la
surface publique auteur. Les changements de sélection passent par les routes,
actions et mutations déclarées, résolues par `dispatch` ou `mutate`. Le
montage et le détachement physiques sont des opérations internes du
réconciliateur ; aucune primitive `mountSlot` ou `detachSlot` n’appartient à
l’API d’intégration Sighty. La sélection courante d’un slot reste observable
par `getMountedSceneKey` et `onSlotChange` ; ces observations ne permettent pas
de modifier directement la composition.

## 5. Types internes

Les types suivants sont dérivés par Sighty et ne sont pas exportés comme
contrats à construire par l’auteur ou l’application :

- l’index immuable des graphes, des entrées et des slots ;
- `ActiveSelection` et `ActiveComposition` ;
- les chemins complets des vues et des slots ;
- les générations et l’état des liaisons actives ;
- les plans `retained`, `entered` et `exited` d’une transition ;
- les handles de montage, les instances CodPlay et l’état d’exécution local.

L’index est construit une seule fois pour une version de scénario. La
composition active est une map interne par adresse de slot ; deux slots de
même nom appartenant à des branches distinctes restent indépendants. Le
registre de présentation physique est séparé de cette map : il peut contenir
une relation conservée pour une sélection sortie, sans la rendre active ni lui
rouvrir une liaison.

## 6. Navigation exécutable

### 6.1. Résolution des actions

Pour chaque événement admis, Sighty examine les sélections de la composition
active et les portées suivantes, de la plus spécifique à la plus générale :

1. la vue sélectionnée ;
2. le graphe qui la contient ;
3. les vues parentes et leurs graphes.

Une action locale est essayée avant une action héritée. La source de scène
départage les actions de même niveau. Une route `path` désigne une adresse
déclarée, une route `label` une clé non ambiguë et une route directionnelle le
voisin du graphe approprié.

`next` et `previous` suivent l’ordre d’une liste. À une borne, Sighty poursuit
la recherche de la même intention dans les portées parentes ; il ne fabrique
pas une sortie implicite. `up` et `down` sont des routes explicites vers un
niveau parent ou vers le départ d’un graphe enfant lorsque cette cible est
adressable dans la composition.

Une action peut porter une route, une référence `action`, ou les deux. Une
référence est exécutée dans `runtime.actionCatalog` après la transition
déclarée. Le handler reçoit l’événement d’intégration et `send`, qui utilise la
surface publique d’événements de l’occurrence visée. Le handler ne crée pas de
destination absente du fichier et ne touche pas au DOM.

### 6.2. Composition et cycle de transition

Une route résolue produit d’abord une composition cible. Sighty calcule alors
les sélections conservées, entrantes et sortantes. Les événements des
sélections sortantes sont invalidés avant toute modification physique. Les
occurrences sortantes sont mises en pause lorsqu’elles sont encore en lecture.
Pour un changement de sélection dans le même slot physique, Sighty demande à
`owner.instances.mount` le remplacement CodPlay lorsque la relation qui occupe
le host appartient encore à une sélection active de la composition précédente
et sort dans cette même transition. CodPlay conserve alors la présentation
sortante pendant le montage de l’entrante. Sans cette transition, l’ancien
montage est détaché avant le nouveau. Une relation conservée après une sortie
logique antérieure ne constitue pas une sortie active de la transition
courante : si un nouveau child doit reprendre son host, Sighty détache cette
relation puis monte l’entrante sans lui appliquer `replace`. Une sortie qui n’a
pas d’entrante dans le même host reste enregistrée dans la présentation
physique ; elle est retirée de la composition logique et sa liaison est fermée,
mais ses racines restent disponibles pour le layout. Le détachement effectif
intervient donc lors d’un conflit de host, d’un remplacement, d’une
reconstruction physique ou de la destruction du runtime.

Cette conservation physique n’expose aucun état `active`/`inactive` et ne
change pas les méthodes d’observation publiques : `getMountedSceneKey`,
`getInstanceAt` et le couplage ne voient que la composition logique publiée.
Lorsqu’une même occurrence revient, Sighty réutilise la relation physique
conservée puis applique le `showMode` de la nouvelle admission ; il ne crée
pas d’instance pour effectuer un reset.

Une sélection conservée garde son occurrence et sa position. Deux sélections
actives qui portent la même `SceneKey` ne partagent ni instance, ni telco, ni
état de lecture, ni liaison d’événements. Une sélection entrante provenant
d’une scène absente de la composition est préparée puis traitée par le
`showMode` effectif de sa portée ; en l’absence de déclaration, le défaut
`rewind` est appliqué. En cas d’échec de montage, Sighty restaure la
composition précédente et ne publie pas la composition partielle.

Lorsque le `showMode` effectif vaut `reset` pour une occurrence conservée, le
reset CodPlay est demandé après le montage et l’ouverture de la liaison, mais
avant la livraison des `data` d’entrée. Les données de la nouvelle admission
ne sont donc pas effacées par le reset de la session précédente. Une occurrence
nouvelle n’est pas resetée : elle suit directement la livraison d’entrée puis
le démarrage prévu.

Lorsqu’une mutation échoue après avoir modifié l’exécution, le même principe
s’étend à la transaction : Sighty restaure le fichier et l’index précédents,
les occurrences et montages physiques, les liaisons, les ressources détenues
et l’état de lecture capturé. Les occurrences inchangées sont réutilisées ;
une restauration destructive recrée uniquement celles qui existaient avant la
mutation. Les ressources introduites par la tentative sont libérées selon le
contrat de preload CodPlay.

Les demandes concurrentes empruntent une seule chaîne de navigation. Une
intention qui peut modifier la composition obtient un verrou d’admission
interne avant d’entrer dans cette chaîne ; tant que la machine est dans la
phase `changing`, une nouvelle intention de transition est rejetée avec la
valeur `false` et n’est pas mise en attente. Cela empêche un contrôle rapide
de programmer une seconde transition contre une composition déjà en cours de
réconciliation. Les commandes discrètes qui ne changent pas de vue peuvent
continuer à attendre dans la même file et sont réévaluées à leur exécution.
Une demande provenant d’une liaison devenue obsolète est abandonnée avant son
effet.

### 6.3. Événements de scène

CodPlay notifie ses événements déclarés `public` selon son propre contrat
d’observation. Sighty n’ouvre pas un second journal et ne transforme pas une
progression continue en événements normaux. Il vérifie l’appartenance de la
scène à la composition active, publie l’enveloppe Sighty, puis envoie la même
demande au coordinateur de navigation.

`scene:end` et `sequence:end` peuvent être utilisés comme clés d’actions dans
la déclaration auteur. Une action attachée à la sélection concernée peut donc
porter `go`, auquel cas la résolution et la transition suivent exactement le
même chemin qu’une intention hôte. Une écoute d’intégration peut également
observer l’événement public et appeler `runtime.dispatch`; elle ne peut pas
sélectionner directement une autre vue.

Le couplage d’une télécommande est une déclaration de vue distincte des
`data`. `controllerSlot`, lorsqu’il est fourni, désigne le slot source relatif
à la vue qui porte la déclaration ; `controlledSlot` désigne le slot cible.
Chaque clé de `commands` est un nom d’événement public CodPlay et sa valeur est
une commande telco, ou une séquence de commandes telco exécutées dans l’ordre
par l’interface `CodPlayTelco` unique. `SightyTelcoCommand` est uniquement le
vocabulaire déclaratif du couplage ; Sighty ne fournit pas une interface
concurrente. Il vérifie la cible et le binding, puis délègue l’exécution à ce
port. `on` et `off` restent des événements publics optionnels de la scène telco
lorsque le scénario les utilise pour activer volontairement une fonctionnalité ;
ils ne deviennent ni des commandes Sighty implicites, ni un mécanisme parallèle
d’ouverture ou de fermeture du binding.
Les commandes `setRate` et `seek` lisent respectivement `{ rate }` et
`{ timeMs }` dans `event.data`. Pour un composant d’entrée CodPlay, `seek`
accepte également la valeur native `{ value }`, numérique ou textuelle. Sighty
vérifie les liaisons actives avant chaque commande et ferme le couplage avec la
liaison sortante.

## 7. Données, conditions et fonctionnalités différées

### 7.1. `data`

Sighty conserve une seule catégorie déclarative nommée `data`. Le terme
`meta` n’est pas une seconde catégorie dans l’API Sighty : la distinction
n’est pas suffisante et le vocabulaire `data` est déjà celui de CodPlay.

La forme `DataBinding` actuelle est :

```ts
type DataBinding = {
  from: string
  update: 'entry' | 'live'
  event?: string
}
```

La verticale résout les déclarations du graphe du moins spécifique au plus
spécifique : données de scénario, portées de graphe, vues parentes puis vue
active. Une valeur locale remplace la valeur précédente. Un binding `from`
résout un chemin pointé dans `context` ou `data` ; un chemin non préfixé essaie
d’abord le contexte puis les données de scénario.

À l’entrée d’une sélection, les valeurs déclarées sont livrées par un
événement CodPlay de la scène. `update: 'live'` est réévalué après
`runtime.updateContext`, tandis que `update: 'entry'` est livré à l’admission
de la sélection. L’événement explicite du binding est utilisé, avec
`data:update` comme valeur par défaut. Sighty ne modifie pas l’état interne de
la scène pour injecter ces données.

### 7.2. Conditions

Les conditions exécutées sont `accessBy` et `exitBy`, sous forme de fonction ou
de référence de catalogue, avec `onDenied` pour la route de repli d’un accès
refusé. Leur résolution par portée et la lecture de `data`, du contexte, de
l’état et de l’événement sont exécutées. Lorsqu’une vue contient plusieurs
scènes, son `exitBy` reste le garde de sortie de la transition : un refus sur
une sélection sortante bloque la vue entière. Cette verticale ne transforme
pas automatiquement une fin de scène en navigation.

### 7.3. Reset et sources lazy

`runtime.reset()` remet le contexte fourni à la construction et demande le
reset logique CodPlay sur les occurrences conservées. Il repart de l’ancre
initiale et réconcilie la composition sans détruire ni recréer les instances.
Les builds et ressources déjà préparés restent réutilisables par le runtime ;
le reset n’est donc ni un simple `telco.rewind` ni une opération de preload.

Une source de scène directe est compilée pendant l’initialisation. Une source
lazy est résolue une seule fois lorsqu’une vue qui la référence doit entrer,
puis son document est mis en cache par le scénario. La même source sert à la
compilation, au preload et à l’acquisition de l’occurrence ; une source absente
ou invalide fait échouer l’opération sans publier de composition incohérente.

### 7.4. Mutations du scénario

`runtime.mutate()` construit et valide une nouvelle version avant de remplacer
le fichier et l’index publiés. Les opérations disponibles sont l’ajout, la
modification, le retrait, le masquage et l’affichage d’une vue, ciblés par
`path` ou `label` auteur.

- `preserve` conserve la sélection active encore déclarée et les occurrences
  compatibles ;
- `rewind` rembobine les occurrences de la composition résultante ;
- `reset` réconcilie la composition depuis l’ancre initiale après le reset
  logique CodPlay des occurrences existantes ;
- `reload` réacquiert explicitement les ressources connues avant cette
  réconciliation ; il ne doit pas être déduit d’un reset.

Une mutation refusée ou échouée restaure la version précédente et ne laisse ni
instance, ni montage, ni ressource introduite par la tentative. La persistance
sérialisée d’un `RuntimeState` reste hors de cette verticale.

### 7.5. Progression et état vivant

La progression reste une observation vivante de la telco. Elle ne passe ni par
`runtime.events`, ni par `dispatch`, ni par le journal normal des événements.
Le plan d’évaluation dédié à la progression reste la référence pour cette
question.

## 8. Validation de la tranche actuelle

La tranche actuelle est considérée comme en cours, avec les preuves suivantes :

- validation auteur sans exécution ;
- index récursif et normalisation v1 ;
- navigation `path`, `label`, `next` et `previous` avec héritage ;
- réconciliation des montages, conservation physique hors composition active,
  remplacement et détachement réels via la façade publique CodPlay ;
- remplacement de contenu dans un même slot physique, y compris lorsque les
  adresses logiques des vues diffèrent ;
- sérialisation des transitions et invalidation des scènes sorties ;
- conditions d’accès et de sortie par portée, repli `onDenied` et diagnostic
  des refus ;
- résolution des `data` héritées, livraisons `entry`/`live` et mise à jour du
  contexte ;
- reset réel, résolution lazy mise en cache et mutations versionnées avec les
  quatre politiques de rechargement ;
- rollback d’une mutation après création d’une occurrence, échec de montage ou
  reconstruction destructive, avec restauration physique de la composition ;
- validation du descripteur `coupling`, exécution des sept commandes telco et
  invalidation de la source dès sa sortie ;
- occurrences indépendantes et accès exact par chemin de slot lorsque la même
  `SceneKey` est active plusieurs fois ;
- abonnement hôte `runtime.events.onEvent`, données publiques et
  désabonnement, avec isolation des erreurs d’observateur ;
- relais d’un événement public de scène par `runtime.events`, sans abonnement
  direct aux événements publics de l’instance telco ;
- nettoyage des instances, montages, abonnements, ressources et CSS lors d’une
  initialisation partiellement échouée ;
- typecheck, tests de contrat Sighty et intégration du chemin runtime réel.

Restent à réaliser avant une stabilisation : la matrice complète des parcours
navigateur/Safari et la suite complète des vérifications de cycle de vie et de
ressources. Le smoke test Safari MCP de Demo 4 est déjà exécuté sur l’instance
active ; sa disponibilité ne constitue donc pas une décision ou un blocage
d’architecture. La persistance reste une responsabilité de l’application hôte
lorsqu’elle sera intégrée ; elle ne sera pas ajoutée à l’API Sighty pour cette
reprise.
