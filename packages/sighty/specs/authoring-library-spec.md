# Sighty — scénario, graphe de vues et runtime

## Statut

Tranche navigation : façade unique, navigation déclarative récursive et
références d'actions exécutables implémentées ; acquisition lazy, données,
guards et reprise restent à affiner.

La structure récursive, les identifiants stables de `ViewList`, les routes de
base, le changement de branche et l'exécution des références d'action sont
couverts par les tests Sighty et par la fixture Demo 4. La voie d'erreur et les
sources acquises à la demande ne sont pas encore des capacités exécutables.

Le modèle de conception de référence est
[`2026-08-17-modele-fichier-declaratif.md`](../notes/2026-08-17-modele-fichier-declaratif.md).
La présente spécification en fixe la première partie exécutable et ses limites.

## Point d'entrée public

`Sighty` est l'unique classe d'entrée de la librairie. Une instance regroupe
deux surfaces nommées :

- `scenario`, qui possède le fichier, le catalogue de scènes, les données et
  les requêtes d'authoring ;
- `runtime`, qui possède l'exécution CodPlay et le parcours du graphe.

```ts
const sighty = new Sighty({
  scenario: { file, scenes, data },
  runtime: {
    root,
    instanceIds,
    layout: { sceneKey: 'layout', storyId: 'main' },
  },
})

const { scenario, runtime } = sighty
const diagnostics = scenario.validate()

await runtime.initialize()
await runtime.dispatch({ name: 'navigation:next' })
runtime.mountSlot('main', 'sceneB')
runtime.detachSlot('main')
runtime.destroy()
```

Une référence `ViewAction.action` est résolue dans le catalogue fourni à la
surface `runtime` :

```ts
const sighty = new Sighty({
  scenario: { file, scenes },
  runtime: {
    root,
    instanceIds,
    layout: { sceneKey: 'scene-layout', storyId: 'main' },
    actionCatalog: {
      'project:show-chapter': ({ send }) => send(
        'scene-layout',
        { name: 'layout:show-chapter' },
        { scope: 'story', storyId: 'main' },
      ),
    },
  },
})
```

Le fichier conserve uniquement le nom de la référence et sa destination
déclarée. Le handler est écrit dans le code de l'application. Il peut envoyer
une action à une scène via `send`, mais il ne crée pas de DOM et ne choisit pas
une destination absente du scénario. Toute référence présente dans le fichier
doit être enregistrée avant `runtime.initialize()` ; sinon l'initialisation
échoue avec un diagnostic explicite.

Les options de runtime décrivent uniquement le raccordement à CodPlay et les
handlers externes du scénario : racine de scène, identifiants d'occurrence,
scène layout, catalogue d'actions, preload et observations facultatives. Elles
ne décrivent ni contrôles de page, ni journal, ni présentation.

## Fichier auteur

La forme cible de `SightyFile.views` est un `SightyViewGraph` récursif :

```ts
type ViewGraph = ViewList | ViewMap

type ViewList = ViewListEntry[]

type ViewListEntry = ViewDefinition & {
  id: string
}

type ViewMap = {
  start: string
  views: Record<string, ViewDefinition>
  actions?: Record<string, ViewAction>
}

type ViewDefinition = {
  view: {
    scene?: string
    views?: ViewGraph
    slots?: Partial<Record<string, ViewGraph>>
  }
  actions?: Record<string, ViewAction>
}

type ViewAction = {
  action?: string
  go?:
    | { path: string }
    | { label: string }
    | { direction: 'next' | 'previous' | 'up' | 'down' }
}
```

`ViewList` utilise l'ordre déclaré pour `next` et `previous`, mais chaque entrée
possède un `id` stable : une route ne désigne jamais un index. `ViewMap` utilise
ses clés identifiées et son `start`. Les `views` et les graphes de slots sont
récursifs ; ils ne sont pas des listes plates de placements.

Les fichiers historiques portant l'ancien tableau de placements sont
normalisés par `scenario.getViewGraph()` vers cette forme interne. Cette
compatibilité permet aux démos existantes de migrer sans créer un second
parcours d'exécution. La forme cible ne contient ni source de scène, ni chemin
de fichier, ni propriété auteur `graph`.

Les propriétés `format`, `version`, `id` et `resources.scenes` restent
acceptées uniquement pour les fichiers historiques ; elles ne sont pas
nécessaires dans la définition de projet cible.

## Surface `scenario`

`scenario` expose :

- `file`, `scenes` et `data` ;
- `sceneKeys`, `getScene(sceneKey)` et `getData(dataKey)` ;
- `getView(sceneKey)`, qui recherche récursivement le premier noeud portant la
  scène demandée ;
- `getViewGraph()`, qui retourne le graphe récursif normalisé consommé par
  Sighty ;
- `getSlotNames(sceneKey)` ;
- `validate()`, qui vérifie les ressources de scènes, les graphes, les départs
  de `ViewMap` et les routes `path`.

Cette surface ne crée ni DOM, ni player, ni montage.

## Surface `runtime`

`runtime` porte le cycle CodPlay commun : compilation, preload, création des
occurrences, montage des départs de la branche active, pilotage, démontage et
destruction.

### Réception et navigation

`runtime.dispatch({ name, sourceSceneKey?, data? })` reçoit une intention ou un
fait. Les événements publics des instances CodPlay sont transmis
automatiquement au même point d'entrée ; une application extérieure peut
également appeler `dispatch`.

Pour résoudre un événement, Sighty explore les portées des vues actives, de la
plus spécifique à la plus générale :

1. la définition de la vue active ;
2. le `ViewGraph` qui la contient ;
3. les vues parentes et leurs graphes, en remontant vers la racine.

Lorsqu'une composition porte plusieurs scènes, la portée la plus spécifique de
la branche active est examinée avant l'action héritée d'une branche sœur ; la
scène source départage les portées de même niveau. La première action dont la
destination est résolue est retenue. La tranche exécutable applique sa
destination `go` :

- `path` cible un noeud déclaré par son chemin séparé par `/` ;
- `label` cible la clé d'un noeud identifié ;
- `direction` utilise l'ordre du graphe actif pour `next` et `previous` ; une
  `ViewList` est adressée par l'`id` stable de ses entrées.

Si une action directionnelle atteint une borne de `ViewList`, Sighty poursuit
la recherche du même événement dans les portées parentes. Une action héritée
peut alors déclarer la sortie du niveau, par exemple un chemin vers le
sommaire. Cette remontée est une résolution en cascade ; elle ne synthétise
pas une direction `up` et l'émetteur ne calcule aucune destination. Si aucune
action héritée ne résout la destination, la sélection courante reste inchangée.

Les directions `up` et `down` sont reconnues par le type et le runtime couvre
les descentes vers `view.views` ainsi que la compatibilité interne avec
`view.graph`. Les cas de graphes imbriqués complexes restent à éprouver.

Quand une route change la sélection d'un slot, Sighty :

1. met en pause les occurrences quittées si elles sont encore lisibles ;
2. retire les slots qui ne sont plus dans la branche active, sans détruire
   leurs instances ;
3. met à disposition les slots requis par la branche cible ;
4. monte les scènes correspondant aux noeuds de la branche cible ;
5. appelle `telco.rewind()` pour chaque occurrence nouvellement montée ;
6. démarre avec `telco.play()` chaque occurrence nouvellement montée.

Une occurrence déjà sélectionnée est conservée et n'est ni réinitialisée ni
relancée. Une fin de séquence ne reçoit pas de commande de pause supplémentaire.
Cette règle garantit qu'une scène auxiliaire nouvellement remontée, par exemple
une telco, reste active et peut recevoir les événements DOM de sa propre scène.
La notification de changement de sélection intervient après cette remise à
zéro et ce démarrage, afin qu'un message adressé à une occurrence nouvellement
montée soit ancré à son nouveau départ, jamais à une position antérieure.

Après l'activation de la destination, Sighty exécute la référence `action` de
l'action résolue dans `runtime.actionCatalog`. Le handler reçoit l'événement
original et une fonction `send(sceneKey, eventime, target)` qui utilise la
surface publique d'événements de l'occurrence visée. Une action sans `go` peut
ainsi seulement envoyer un message ou effectuer le traitement prévu par son
catalogue ; elle n'invente pas de route.

### Montage explicite et observation

`runtime.mountSlot(slotName)` monte le départ du graphe déclaré dans le slot
actif.
`runtime.mountSlot(slotName, childSceneKey)` sélectionne une scène déclarée
dans ce graphe. Cette aide de montage ne décide pas d'une route et ne démarre
pas la scène ; la navigation événementielle est portée par `dispatch`.

`runtime.getMountedSceneKey(slotName)` lit la sélection courante. Une application
peut observer ses changements avec `runtime.onSlotChange(slotName, listener)`.
Cette observation ne crée ni DOM ni état de présentation.

### Persos de layout, carrousel et slots

`runtime.layout.storyId` désigne la story CodPlay dans laquelle Sighty résout
les persos `slot` du layout. Cette propriété ne transforme pas les branches du
scénario en stories et ne nécessite pas une story par composition.

Une même story peut contenir plusieurs persos `layout` ordinaires. Ils peuvent
former un carrousel en partageant un point d'accès ; leurs actions déclarées
portent alors les positions, classes et événements de présentation. Ces persos
ne sont ni des `View`, ni des sélections de scénario, ni des occurrences
supplémentaires du layout.

Sighty ne crée pas le markup de ces persos et ne choisit pas leur présentation.
Il résout le slot déclaré dans la story configurée, monte la scène sélectionnée
dans ce slot et envoie les événements prévus par le catalogue d'actions. La
scène layout et CodPlay exécutent les actions de rendu qui leur appartiennent.
Un slot peut être déplacé par ses propres actions vers le point d'accès d'une
autre composition ; la sélection de la scène qu'il reçoit reste une décision
du scénario et de Sighty.

### Progression

Sighty n'expose pas de progression globale. La progression reste une capacité
de la scène ou de sa telco auteur. Une composition peut relayer un événement de
seek vers l'instance sélectionnée en utilisant les surfaces CodPlay publiques.

### Limites de cette tranche

Les références `action` du fichier sont exécutées par le catalogue fourni au
runtime ; la séquence reste écrite dans le handler externe et est attendue
avant la fin de `dispatch`. Une référence absente du catalogue invalide
l'initialisation. Les `guards`, la
résolution des `data` et `meta`, le `context`, le `state`, la sauvegarde et la
restauration feront l'objet de tranches Sighty dédiées. Ils ne doivent pas être
simulés dans une démo.

Le catalogue externe accepté par cette première tranche contient des
`SceneDoc` déjà résolus. La même clé est utilisée par le scénario et le
runtime, mais les factories, sources lazy ou distantes, l'acquisition à la
demande et la libération sélective restent à spécifier et à tester.

Le runtime ne construit pas les composants de page et ne crée pas de circuit de
commande propre à une démonstration. Les contrôles, le journal et les features
sur mesure restent dans l'application auteur.

La classe interne du runtime n'est pas exportée comme une seconde entrée. Elle
est créée par `Sighty` et accessible uniquement par `sighty.runtime`.

## Structure interne

La séparation DRY/KISS/SRP est conservée derrière la façade unique :

- `sighty.ts` assemble les deux surfaces publiques ;
- `scenario.ts` possède les ressources et le graphe normalisé ;
- `view-graph.ts` parcourt et normalise les graphes ;
- `runtime.ts` porte l'exécution CodPlay et la navigation ;
- `authoring-validation.ts` porte la validation récursive ;
- `types.ts` porte les contrats partagés.

Les modules internes ne sont pas exposés comme sous-chemins du package : la
surface publique passe par `@codplay/sighty`.
