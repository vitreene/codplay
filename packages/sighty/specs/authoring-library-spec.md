# Sighty — scénario, graphe de vues et runtime

## Statut

**En cours — réécriture de la navigation engagée le 2026-09-15.**

Cette spécification décrit le contrat actuellement exécuté par la première
verticale de la réécriture et distingue explicitement trois niveaux :

- l’API auteur, portée par la définition `scenario` ;
- l’API d’intégration, utilisée par l’application hôte qui instancie Sighty ;
- les types internes, produits et utilisés par Sighty pour exécuter le
  scénario.

La première verticale exécute déjà les conditions d’accès et de sortie par
portée (`accessBy`, `exitBy`, `onDenied`), les actions et guards définis sur le
scénario ou en ligne dans les vues, la résolution des données auteur, les
événements de vue `entry`, le reset, les sources de scènes lazy et les mutations versionnées. Ces
comportements sont décrits comme tels dans cette spécification. Une même
`SceneKey` peut avoir une occurrence CodPlay indépendante dans chaque slot
actif qui la sélectionne. Le pilotage d’une télécommande n’existe dans Sighty
que dans le contexte d’un couplage déclaré par le scénario : la scène
telco émet ses événements publics et Sighty règle en interne l’accrochage à la
liaison active. La persistance sérialisée d’un parcours
n’appartient pas à cette reprise et ne constitue pas un contrat Sighty actuel.
Lorsqu’une application hôte aura besoin de persister un parcours, cette
responsabilité relèvera de son intégration et non de Sighty.

La reconstruction et son ordre d’implémentation sont suivis dans le
[plan de reconstruction de la navigation](../plan/2026-09-15-sighty-navigation-reconstruction-plan.md).

## 1. Responsabilités et frontières

Sighty conduit un parcours de vues composé de scènes CodPlay. Il possède le
scénario, son index, la résolution des routes, la composition
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
scénario avec ses vues, ses guards, ses actions et son catalogue de `SceneDoc`.
Aucune démo ne recrée l’index ni le routeur de
Sighty. Leur priorité et leur statut de validation sont suivis dans les plans,
pas dans ce contrat.

## 2. Entrée publique unique

`Sighty` est l’unique point d’entrée du package. Une instance regroupe deux
surfaces publiques distinctes :

```ts
const sighty = new Sighty({
  scenario: { views, scenes, data, actions, guards },
  runtime: { root, instanceIds },
})

const diagnostics = sighty.scenario.validate()
await sighty.runtime.initialize()
await sighty.runtime.dispatch({ name: 'navigation:next' })
sighty.runtime.destroy()
```

`scenario` ne crée ni instance, ni player, ni montage. `runtime` exécute le
scénario validé et raccorde les scènes à CodPlay.

La définition `scenario` est l’unique représentation auteur conservée par
Sighty. Elle porte directement `views`, `guards`, `actions`, `scenes` et les
éventuelles `sceneSources` et `data`. `id`, `version`, `format` et `showMode`
sont également des propriétés directes du scénario. L’index des vues est
calculé depuis `scenario.views` pour la navigation et reconstruit après une
mutation ; il ne constitue pas une seconde définition du parcours. Le runtime
résout les noms d’actions et de guards sur cette même surface `scenario`.

## 3. API auteur publique

Cette section concerne uniquement ce que l’auteur écrit ou qu’un outil
d’authoring produit. Elle ne décrit ni l’index, ni la composition active, ni
les occurrences CodPlay.

### 3.1. Forme déclarative

Le champ direct `scenario.views` est un graphe récursif de listes et de maps :

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
  entry?: CodPlayEventime | readonly CodPlayEventime[]
  data?: Record<string, unknown>
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
  action?: `action:${string}:${string}` | SightyActionHandler
  go?:
    | { path: string }
    | { label: string }
    | { direction: 'next' | 'previous' | 'up' | 'down' }
  reset?: readonly string[]
}
```

`reset` demande des effets de reprise sur l’action qui la porte. Son absence
ne demande aucun reset. La liste doit contenir au moins une clé texte non vide ;
`all` doit apparaître seul. `context` est la clé Sighty intégrée. Les autres
clés sont transmises aux callbacks `onReset` des scènes et restent définies par
elles, par exemple `quiz` ou `solutions`.

Une `ViewList` utilise l’ordre déclaré pour `next` et `previous`, mais chaque
entrée possède un `id` stable. Une `ViewMap` utilise ses clés et son `start`.
Les graphes de `views` et de `slots` peuvent être imbriqués sans devenir une
liste plate de placements.

Une liste de vues utilise des `id` stables sur toutes ses entrées, y compris
celles de ses slots. Aucun format de placement antérieur n’est normalisé.

### 3.2. Scènes, slots et identifiants auteur

`SceneKey` désigne une scène fournie dans le scénario.
`SlotName` désigne le nom d’un slot déclaré dans la scène layout. `ViewId`
désigne la clé d’une vue de map ou l’identifiant stable d’une entrée de liste.

Une ressource de scène accepte un `SceneDoc` seul ou un descripteur
`{ sceneDoc, styleSheet?, onReset? }`. La feuille CSS texte est associée à la
scène sans devenir un champ de `SceneDoc`. `onReset(keys)` peut traduire les clés
de reprise en un `CodPlayEventime`, ou retourner `undefined` si la scène ne
prend pas en charge cette demande. Une source différée peut retourner l’une ou
l’autre forme ; son callback n’est disponible qu’une fois la source résolue.

Le scénario décrit ces références. Il ne décrit pas l’instance physique qui
sera créée pour les exécuter. Les formes `ViewAddress`, `SlotAddress`,
`OccurrenceId`, `BindingId`, `Generation` et `Revision` ne sont pas des champs
que l’auteur doit écrire.

### 3.3. Scénario et fonctions d’auteur

Le scénario auteur n’est pas limité par principe à JSON. Comme dans
CodPlay, l’API auteur peut exposer des fonctions ou d’autres mécanismes
exécutables dans la forme écrite par l’auteur.

La forme compilée/exportable est une représentation différente. À cette
frontière, les fonctions peuvent être extraites, référencées ou remplacées
par une représentation portable selon le contrat de compilation. Cette
contrainte appartient à l’export, pas à une interdiction artificielle imposée
au scénario auteur.

Les propriétés `scenario.actions` et `scenario.guards` nomment les fonctions
que les vues peuvent référencer. Une clé d’action enregistrée suit la forme
lisible `action:<domaine>:<verbe>` et une clé de guard suit la forme
`guard:<domaine>:<prédicat>` ; le préfixe et le rôle final rendent la différence
immédiate pour le lecteur et séparent explicitement ces registres des `SceneKey`
et des identifiants de vues.
Les clés des tables d’événements `actions` restent les noms d’événements et ne
prennent pas ces préfixes. Une vue peut aussi contenir directement une
fonction d’action ou de guard inline : elle est exécutée sans entrée de
registre et n’a donc pas de clé à nommer. Le runtime résout les références
dans les propriétés du scénario ; il ne reprend pas le modèle des scènes
compilées CodPlay. La représentation compilée/exportable de ces fonctions
reste une question de frontière d’export, pas une seconde exécution.

### 3.5. Politique d’affichage d’une scène

`showMode` est la propriété auteur qui règle le traitement d’une occurrence
lorsqu’une vue est admise. Elle accepte exclusivement `reset`, `maintain` ou
`rewind`. La valeur peut être placée sur le scénario, un graphe (notamment le
graphe d’un slot), une vue parente ou la vue active ; elle est héritée selon la
même priorité de portée que les conditions : vue active, graphe contenant,
puis vues parentes. Une valeur locale remplace la valeur héritée.

En l’absence d’une déclaration auteur, la valeur par défaut est `rewind`.
L’absence d’une déclaration n’empêche donc pas une scène nouvellement admise
de démarrer, tandis qu’une déclaration `maintain` ou `reset` modifie
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

Les portées auteur sont conservées par identité, même lorsqu’une vue et son
graphe `views` partagent le même chemin. Une `exitBy` héritée est évaluée pour
chaque sélection descendante qui sort ; garder sa vue parente active ne
supprime pas ce contrôle.

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

- `views`, `scenes`, `data`, `actions` et `guards` directement ;
- `sceneKeys`, `getScene(sceneKey)` et `getData(dataKey)` ;
- `getView(sceneKey)` ;
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

### 4.4. État courant du scénario

`runtime.scenarioState` expose une lecture générique de l’exécution sans
ajouter d’état de lecture à la surface auteur `scenario`. `current` retourne
toutes les sélections logiques actives avec `slotName`, une référence auteur
`view` de type `SightyViewReference` et `sceneKey`. `active` retourne la
sélection unique suivie par le pointeur interne `next`/`previous` ; elle permet
à l’application de lire la vue de parcours courant sans rechercher elle-même
un slot dans `current`. `context` retourne le contexte durable courant. Le
helper n’expose ni adresses de slot ni sélections internes. Ces valeurs sont
en lecture seule et ne permettent pas de modifier la composition.

`active` suit la sélection initiale, les navigations admises, la destination
réelle d’un repli `onDenied`, le reset et les mutations qui préservent ou
remplacent la composition. Il vaut `undefined` tant qu’aucune sélection ne
peut être suivie. `current` reste l’ensemble des slots actifs, y compris les
slots persistants du layout.

Le runtime crée une instance de la classe `SightyScenarioState` pour chaque
exécution ; les types publics `SightyScenarioSelection` et
`SightyScenarioStateApi` décrivent sa surface d’accès.

Le même helper est fourni aux handlers d’action dans leur paramètre
`scenarioState`. Une action peut ainsi mettre à jour le contexte (par exemple
`context.signet`), puis interroger les gardes qui lisent cette nouvelle valeur
avant d’envoyer les événements de présentation aux scènes actives.

`canAccess(reference, event)` résout une vue par `path` ou `label`, puis
réutilise la résolution de portée et l’évaluateur des conditions de
navigation. Une référence non résolue retourne `false` ; une vue sans
`accessBy` retourne `true`. Une sélection déjà active reste admise sans
réévaluer `accessBy`, comme lors d’une navigation qui la conserve. La méthode
retourne la décision d’accès de la garde ; elle n’applique pas le repli
`onDenied` et ne navigue pas.

`canExit(reference, event)` répond pour une sélection actuellement active ;
une référence absente ou inactive retourne `false`, et une vue sans `exitBy`
retourne `true`. Pour une vue gardée, la méthode transmet l’événement donné à
la même condition que la navigation. L’appelant fournit l’événement de sortie
qu’il souhaite présenter. La méthode ne résout pas de destination et ne
modifie pas la composition.

Les résultats sont asynchrones parce que les fonctions auteur de condition
peuvent renvoyer une promesse. Le helper partage avec `dispatch` les données
résolues, le contexte courant, l’état lisible CodPlay et l’évaluateur runtime ;
il ne crée donc pas un second circuit de guards. Les tests de contrat et le
parcours Demo 5 qui valident cette surface sont consignés dans
[`runtime-features.spec.ts`](../tests/runtime-features.spec.ts) et la
[spécification de la démo](../../demos/specs/sighty-scroll-course-demo-spec.md).

### 4.5. Montage et pilotage

La vue de départ du graphe racine porte la scène hôte dans `view.scene` et ses
slots. Sighty la déduit du scénario ; `runtime` ne reçoit ni propriété
`layout`, ni `storyId` séparé.

`runtime.initialize()` valide le scénario et compile les documents de scène,
puis demande à CodPlay de créer et d’initialiser les occurrences nécessaires via
`owner.instances.create` avant de monter la composition initiale. Il ne
réimplémente pas l’initialisation du player. Le preload est un service séparé :
il prépare et enregistre les ressources avant la création lorsqu’il est requis,
mais ne constitue pas une primitive d’initialisation CodPlay. Le runtime ne
démarre pas implicitement toutes les telcos. `runtime.play(sceneKey)` démarre
l’occurrence active ciblée, puis les sélections actuellement actives sous la
vue de cette scène, dans l’ordre parent-enfant. Pour la scène de la vue de
départ, ce chemin démarre toute la composition active ; il ne joue pas les
scènes auteur qui ne sont pas sélectionnées. `runtime.playAll(sceneKeys)` démarre les occurrences
nommées, une fois chacune et dans l’ordre fourni, sans parcourir leurs vues
descendantes. Les transitions de navigation démarrent leurs sélections
entrantes par le coordinateur commun et leur `showMode`. `runtime.updateContext`
met à jour le contexte utilisé par les gardes et les handlers d’action. Les
scènes reçoivent des événements déclarés dans `entry` ou envoyés explicitement
par une action Sighty. `runtime.reset()`
demande le reset logique CodPlay sur les occurrences existantes, restaure le
contexte initial et réconcilie la composition ; il ne recrée pas les
occurrences et ne déclenche pas le preload. `runtime.mutate` publie une
nouvelle version validée du graphe selon la politique `preserve`, `rewind`,
`reset` ou `reload`.

`runtime.styles` reçoit les feuilles CSS fournies par l’application hôte. Sighty
les enregistre par `owner.preload.css.set()` avant le montage. Une feuille
`styleSheet` fournie avec une scène suit ce même canal CSS, dans le slot stable
`sighty-scene:<SceneKey>`, avec `runtime.root` comme conteneur `@scope`. Les
scènes directes sont préparées avant le montage initial ; une scène différée
installe sa feuille avant la création de son occurrence. Quand une scène est
retirée du graphe, Sighty efface son slot CSS. La destruction de CodPlay retire
les feuilles restantes. Le test
[`runtime-features.spec.ts`](../tests/runtime-features.spec.ts) couvre les
sources directes et différées, le scope, le nettoyage à la destruction et le
retrait après mutation.

Le `reset` de `instance.telco` reconstruit l'état logique à zéro dans la même
instance CodPlay et efface les faits runtime de sa session. Les eventimes auteur
compilés ne sont pas effacés. Il ne produit pas `sequence:end`, n'exécute pas
son hook auteur et ne détruit ni ne remonte l'occurrence. Après un
`sequence:end`, le play CodPlay réutilise cette reconstruction avant de relancer
la lecture ; les actions auteur et le hook de `sequence:end` restent propres au
traitement de cet événement terminal.

Le mode de lecture par défaut est `rewind`. Le scénario et les portées auteur
peuvent le remplacer selon la règle de `showMode` décrite en §3.5.

Sighty transmet `runtime.codplay` à CodPlay sans modifier sa configuration
d’inactivité. L’option `runtime.codplay.engine.idle` est donc héritée selon le
contrat CodPlay lorsque l’application hôte la fournit ; l’absence de cette
option ne devient pas une valeur `false` injectée par Sighty et ne constitue
jamais un effet implicite de la telco.

Pour la composition et le parcours, la définition du scénario est la
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
pas une sortie implicite. Ces directions partent de la vue `scenarioState.active`
suivie par Sighty et ne nécessitent pas de `sourceSceneKey`. Si une liste est
imbriquée dans un graphe enfant et atteint sa borne, la recherche remonte au
graphe parent par défaut et peut sélectionner la vue sœur suivante ou
précédente. `up` et `down` restent des routes explicites vers un niveau parent
ou vers le départ d’un graphe enfant lorsque cette cible est adressable dans la
composition.

Une action peut porter une route, une référence `action:<domaine>:<verbe>`, une fonction
inline, ou les deux. Une référence est exécutée depuis `scenario.actions` après
la transition déclarée. Si elle porte aussi `reset`, la route est d’abord
résolue, admise et appliquée ; Sighty traite ensuite `reset`, puis exécute le
handler. Si la route est refusée, les effets de reprise et le handler ne sont
pas exécutés. Sans route, `reset` s’applique à la composition courante. Le
handler reçoit l’événement d’intégration et `send`, qui utilise la surface
publique d’événements de l’occurrence visée. Le handler ne crée pas de
destination absente du scénario et ne touche pas au DOM.

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
s’étend à la transaction : Sighty restaure le scénario et l’index précédents,
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

`SightyActionContext.send` utilise cette même passerelle pour cibler une
occurrence active. La passerelle capture la position CodPlay courante, émet
l’événement déclaré, restaure cette position et reprend la lecture si elle
était active ; les patches d’une présentation ponctuelle sont ainsi
matérialisés au point courant sans voie d’émission concurrente. Le test
`runtime.spec.ts` vérifie cette matérialisation sur le DOM.

Pour `reset`, Sighty restaure une copie du contexte initial lorsque la liste
contient `context` ou `all`. Il ne développe pas les autres clés et n’appelle
pas `telco.reset()` pour l’état métier des scènes. Pour chaque `SceneKey` qui
possède déjà une occurrence conservée, Sighty appelle son `onReset` une fois
avec la liste écrite par l’auteur. Si le callback retourne un événement, la
passerelle l’envoie à chaque occurrence conservée de cette clé, active ou
inactive, en ciblant chaque story déclarée. L’envoi réutilise la conservation
de position et d’état de lecture de la passerelle. Il ne crée pas d’occurrence
et ne résout pas une source différée uniquement pour effectuer un reset.
`all` restaure donc le contexte et est transmis tel quel aux scènes ; chaque
scène choisit les effets qu’elle associe à cette clé. Par exemple, elle peut
remettre à zéro un quiz sans exposer les solutions.

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

### 7.1. Événements d’entrée

Une vue peut déclarer `entry` avec un événement CodPlay ou une liste ordonnée
d’événements :

```ts
type GraphView = {
  entry?: CodPlayEventime | readonly CodPlayEventime[]
}
```

La déclaration appartient à la vue sélectionnée. À chaque admission de cette
sélection, Sighty transmet les événements dans l’ordre déclaré à la scène
active par sa passerelle CodPlay. L’événement est transmis tel quel, y compris
`event.data` ; CodPlay applique ensuite ses actions auteur pour cet événement.
Une liste vide ou un événement sans `name` est refusé par la validation du
scénario auteur.

Cette livraison suit le coordinateur de transition : la sélection est montée
et liée avant l’émission ; les événements `entry` sont envoyés avant que la
transition n’applique `showMode` et ne reprend la lecture de la scène. Les
déclarations et leurs événements imbriqués sont copiés lors d’une mutation du
scénario. Les tests de
[`runtime-features.spec.ts`](../tests/runtime-features.spec.ts) couvrent un
événement unique, une liste ordonnée, les actions CodPlay et la conservation de
`event.data`.

### 7.2. `data`

Sighty conserve une seule catégorie déclarative nommée `data`. Le terme
`meta` n’est pas une seconde catégorie dans l’API Sighty : la distinction
n’est pas suffisante et le vocabulaire `data` est déjà celui de CodPlay.

Les données de scénario et de vue sont des valeurs auteur statiques. Les vues
résolvent les valeurs du graphe, des vues parentes puis de la vue sélectionnée ;
une valeur locale remplace la valeur précédente. Ces données sont fournies aux
conditions et aux handlers d’action de Sighty. `runtime.updateContext` ne
convertit pas ces valeurs en événements de scène ; les transmissions aux
scènes utilisent `entry` ou l’envoi explicite par une action Sighty.

### 7.3. Conditions

Les conditions exécutées sont `accessBy` et `exitBy`, sous forme de fonction
inline ou de référence `guard:<domaine>:<prédicat>` dans `scenario.guards`, avec `onDenied` pour la route de repli d’un accès
refusé. Leur résolution par portée et la lecture de `data`, du contexte, de
l’état et de l’événement sont exécutées. Lorsqu’une vue contient plusieurs
scènes, son `exitBy` reste le garde de sortie de la transition : un refus sur
une sélection sortante bloque la vue entière. Cette verticale ne transforme
pas automatiquement une fin de scène en navigation.

### 7.4. Reset et sources lazy

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

### 7.5. Mutations du scénario

`runtime.mutate()` construit et valide une nouvelle version avant de remplacer
le scénario et l’index publiés. Les opérations disponibles sont l’ajout, la
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

### 7.6. Progression et état vivant

La progression reste une observation vivante de la telco. Elle ne passe ni par
`runtime.events`, ni par `dispatch`, ni par le journal normal des événements.
Le plan d’évaluation dédié à la progression reste la référence pour cette
question.

## 8. Validation de la tranche actuelle

La tranche actuelle est considérée comme en cours, avec les preuves suivantes :

- validation auteur sans exécution ;
- définition auteur unique `scenario` avec `views`, `guards` et `actions`
  directs, résolution des registres par le runtime et mutation versionnée de
  cette même définition ; les clés `action:<domaine>:<verbe>` et
  `guard:<domaine>:<prédicat>` sont
  validées, les fonctions inline restent admises ; les [tests auteur](../tests/authoring.spec.ts) et
  [tests de mutation](../tests/runtime-features.spec.ts) font partie des 47
  tests Sighty réussis, avec les typechecks Sighty/démos et le build démos
  après migration des cinq scénarios de démo ;
- index récursif du graphe auteur ;
- navigation `path`, `label`, `next` et `previous` avec héritage ;
- réconciliation des montages, conservation physique hors composition active,
  remplacement et détachement réels via la façade publique CodPlay ;
- remplacement de contenu dans un même slot physique, y compris lorsque les
  adresses logiques des vues diffèrent ;
- sérialisation des transitions et invalidation des scènes sorties ;
- conditions d’accès et de sortie par portée, repli `onDenied` et diagnostic
  des refus ;
- résolution des `data` héritées, événements `entry` et mises à jour du
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
- propriété `reset` des actions, restauration du contexte, ordre après la route
  et avant le handler, et callbacks `onReset` diffusés aux stories des
  occurrences conservées, actives et inactives ; les [tests de reset de
  relecture](../tests/replay-reset.spec.ts) et les validations auteur couvrent
  aussi les listes vides, les clés invalides et `all` combiné ;
- relais d’un événement public de scène par `runtime.events`, sans abonnement
  direct aux événements publics de l’instance telco ;
- nettoyage des instances, montages, abonnements, ressources et CSS lors d’une
  initialisation partiellement échouée ;
- typecheck Sighty et démos, build démos, tests de contrat Sighty et
  intégration du chemin runtime réel pour les scénarios déjà acceptés.

La propriété `reset` est couverte par 51 tests Sighty, le typecheck Sighty, le
typecheck et le build des démos. Le parcours navigateur Demo 5 après cette
modification reste à vérifier avec le MCP du navigateur ; son outil n’était
pas exposé dans cette session. Cette preuve reste ouverte dans le
[plan de relecture](../plan/2026-09-30-sighty-replay-reset-plan.md).

Restent à réaliser avant une stabilisation : la matrice complète des parcours
navigateur et la suite complète des vérifications de cycle de vie et de
ressources. Le smoke test MCP de Demo 4 est déjà exécuté sur l’instance active ;
sa disponibilité ne constitue donc pas une décision ou un blocage d’architecture.
La persistance reste une responsabilité de l’application hôte lorsqu’elle sera
intégrée ; elle ne sera pas ajoutée à l’API Sighty pour cette reprise.
