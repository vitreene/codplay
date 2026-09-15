# Sighty — scénario, graphe de vues et runtime

## Statut

**En cours — réécriture de la navigation engagée le 2026-09-15.**

Cette spécification décrit le contrat actuellement exécuté par la première
verticale de la réécriture et distingue explicitement trois niveaux :

- l’API auteur, écrite dans le fichier de déclaration ;
- l’API d’intégration, utilisée par l’application hôte qui instancie Sighty ;
- les types internes, produits et utilisés par Sighty pour exécuter le
  scénario.

Les conditions d’accès, les conditions de fin de vue, la résolution complète
des `data`, la sauvegarde et les sources lazy ne sont pas encore exécutées.
Elles restent des tranches de conception et d’implémentation séparées. Cette
spécification ne transforme pas ces propositions en comportements disponibles.

Le modèle de conception de référence est la
[note du modèle de fichier déclaratif](../notes/2026-08-17-modele-fichier-declaratif.md).
La reconstruction et son ordre d’implémentation sont suivis dans le
[plan de reconstruction de la navigation](../plan/2026-09-15-sighty-navigation-reconstruction-plan.md).

## 1. Responsabilités et frontières

Sighty conduit un parcours de vues composé de scènes CodPlay. Il possède le
fichier de scénario, son index, la résolution des routes, la composition
logique active et l’admission des événements. CodPlay possède la compilation,
les occurrences de scènes, leur telco, leur rendu, leurs ressources et les
montages entre surfaces CodPlay.

Sighty ne crée pas de markup, ne recherche pas d’élément HTML et ne déplace pas
les racines rendues. Il demande les montages au moyen de la façade publique
CodPlay et conserve seulement les handles nécessaires à leur détachement.

Les démos sont des chemins d’acceptation. Elles fournissent un fichier, un
catalogue de `SceneDoc` et, lorsque le scénario le demande, des actions de
présentation. Elles ne recréent pas l’index ni le routeur de Sighty.

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
  guards?: Record<string, string>
  data?: Record<string, unknown | DataBinding>
}

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
`action` et le catalogue d’actions d’intégration. Elle ne prétend pas encore
fixer la syntaxe des fonctions d’auteur pour les actions ou les conditions.

### 3.4. Conditions de parcours

Deux usages fonctionnels sont retenus pour les guards, même si leur syntaxe
exacte reste à arrêter :

1. une condition d’accès à une page ou à une section ; lorsqu’elle est
   refusée, le parcours va à la page suivante ou à une échappatoire déclarée ;
2. une condition de fin de vue ; elle empêche la sortie de la vue tant que
   l’ensemble attendu n’est pas établi. Les scènes impliquées peuvent
   produire chacune un événement discret qui alimente, par exemple, un
   compteur. Lorsque la condition est satisfaite, la navigation peut repartir
   vers la suite déclarée.

La fin d’une scène n’est pas, par elle-même, la fin d’une vue. Une scène
passive ne contribue pas à l’ensemble attendu. La condition peut être
réévaluée après une mise à jour du state ou après un événement, selon le
mécanisme qui sera validé avec sa justification.

Les termes situationnels tels que `accessBy` ou `exitBy` restent des exemples
de vocabulaire et ne sont pas des champs normatifs. La réécriture courante ne
introduit ni `access.guard`, ni `filterBy`, ni un autre mécanisme non décidé.
Le mode automatique éventuellement nommé `auto`, ainsi que les conventions
`scene:end` et `sequence:end`, restent également à évaluer. Ils ne sont pas
des comportements implicites de cette tranche.

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

La surface de sortie ne possède pas de `emit` parallèle : l’entrée vers Sighty
reste `dispatch`. L’abonnement retourne une fonction de désabonnement ; les
erreurs d’un observateur ne doivent ni interrompre les autres observateurs ni
le routage du scénario. La destruction supprime les abonnements et les
livraisons ultérieures.

`runtime.getInstance(sceneKey)` est conservé comme surface d’intégration
CodPlay publique pour les contrôles de scène encore nécessaires aux démos,
notamment la telco. Il ne fait pas partie de l’API auteur et ne doit pas être
utilisé pour contourner la publication Sighty des événements destinés à
l’application hôte. Une surface Sighty spécialisée de telco pourra remplacer
ce raccord lorsqu’elle sera définie dans un plan accepté.

### 4.4. Montage et pilotage

`runtime.initialize()` valide le fichier, compile les `SceneDoc`, précharge
les ressources, crée les occurrences et monte la composition initiale. Il ne
démarre pas implicitement toutes les telcos ; `runtime.play(sceneKey)` et
`runtime.playAll()` pilotent le démarrage explicite.

`mountSlot` et `detachSlot` sont des aides d’intégration pour le montage
explicite. Les changements de scénario passent par `dispatch`. La sélection
courante d’un slot est lisible par `getMountedSceneKey` et observable avec
`onSlotChange`.

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
même nom appartenant à des branches distinctes restent indépendants.

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
sélections sortantes sont invalidés avant le détachement. Les occurrences
sortantes sont mises en pause lorsqu’elles sont encore en lecture. Pour un
changement de sélection dans le même slot physique, Sighty demande à
`owner.instances.mount` le remplacement CodPlay lorsque le slot déclare une
transition `replace`; CodPlay conserve alors la présentation sortante pendant
le montage de l’entrante. Sans cette transition, l’ancien montage est détaché
avant le nouveau. Les sorties qui n’ont pas d’entrante sont détachées, puis la
composition logique est publiée.

Une sélection conservée garde son occurrence et sa position. Une sélection
entrante provenant d’une scène absente de la composition est rembobinée puis
démarrée explicitement. En cas d’échec de montage, Sighty restaure la
composition précédente et ne publie pas la composition partielle.

Les demandes concurrentes empruntent une seule chaîne de navigation. Une
demande provenant d’une liaison devenue obsolète est abandonnée avant son
effet.

### 6.3. Événements de scène

CodPlay notifie ses événements déclarés `public` selon son propre contrat
d’observation. Sighty n’ouvre pas un second journal et ne transforme pas une
progression continue en événements normaux. Il vérifie l’appartenance de la
scène à la composition active, publie l’enveloppe Sighty, puis envoie la même
demande au coordinateur de navigation.

Cette verticale ne fixe pas encore la transformation automatique d’un fait de
fin de scène en intention de navigation. Si elle est retenue, elle devra
réutiliser `dispatch` et être traitée dans la tranche des guards et des fins de
vue.

## 7. Données, guards et fonctionnalités différées

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

La tranche de navigation accepte le champ de déclaration pour préserver la
forme auteur, mais ne résout pas encore son héritage, son injection dans les
scènes ou son lien avec `ScenarioContext`. Ces comportements feront l’objet
d’une décision et de tests dédiés.

### 7.2. Conditions

Le type auteur conserve un emplacement général pour les `guards` afin de ne
pas perdre le besoin exprimé par le modèle. La présente tranche ne lui attribue
pas de structure situationnelle ni de comportement implicite. La prochaine
tranche devra fixer : l’attachement de la condition d’accès et de la condition
de fin de vue, leur héritage, leur combinaison, leur échappatoire et le
mécanisme de réévaluation.

### 7.3. Progression et état vivant

La progression reste une observation vivante de la telco. Elle ne passe ni par
`runtime.events`, ni par `dispatch`, ni par le journal normal des événements.
Le plan d’évaluation dédié à la progression reste la référence pour cette
question.

## 8. Validation de la tranche actuelle

La tranche actuelle est considérée comme en cours, avec les preuves suivantes :

- validation auteur sans exécution ;
- index récursif et normalisation v1 ;
- navigation `path`, `label`, `next` et `previous` avec héritage ;
- montage et détachement réels via la façade publique CodPlay ;
- remplacement de contenu dans un même slot physique, y compris lorsque les
  adresses logiques des vues diffèrent ;
- sérialisation des transitions et invalidation des scènes sorties ;
- abonnement hôte `runtime.events.onEvent`, données publiques et
  désabonnement, avec isolation des erreurs d’observateur ;
- relais Demo 3 branché sur `runtime.events`, comme les relais Demo 2 et
  Demo 4, sans abonnement direct aux événements publics de l’instance telco ;
- nettoyage des instances, montages, abonnements, ressources et CSS lors d’une
  initialisation partiellement échouée ;
- typecheck et tests Sighty, ainsi que les intégrations Demo 2, Demo 3 et Demo 4.

Restent à réaliser avant une stabilisation : les guards, les fins de vue, les
`data` dynamiques, les occurrences multiples d’une même `SceneKey`, le
couplage télécommande spécialisé, la validation navigateur/Safari et la suite
complète des vérifications de cycle de vie et de ressources.
