# Façade CodPlay V2

> Statut : En cours
> Version CodPlay : V2 foundation

## Rôle

La façade est l’entrée publique de CodPlay V2. Une instance `CodPlay` possède
un engine technique et expose directement la construction, les registres de
capacités, les resources, les events et les instances. Le service de preload
reste séparé jusqu’à la révision de son contrat.

```ts
const codplay = new CodPlay({
  engine: {
    components: { register: componentDefinitions },
    services: { register: serviceDefinitions },
    modules: { register: moduleDefinitions },
  },
  frameScheduler,
})
const instances = codplay.instances
const build = codplay.build({ scene })
if (build.ok) {
  const instance = instances.create({
    ...options,
    compiledScene: build.compiledScene,
    functions: build.functions,
  })

  instance.telco.play()
  instance.telco.seek(1_000)
  instance.events.emit(eventime, address)
}
```

`CodPlay` construit le ticker interne à partir du `frameScheduler` fourni par
l’hôte. Le ticker, son horloge et leurs factories ne font pas partie de la
surface publique. Les options propres au catalogue sont regroupées sous
`options.engine`.

Les registres `codplay.components`, `codplay.services` et `codplay.modules`
alimentent le même catalogue core/foreign. Ils acceptent `register` et
`override` après la construction de `CodPlay`, jusqu’au premier `build()` ou
`instances.create()`. Chaque opération retourne `{ ok, status }` en succès ou
`{ ok: false, error }` en échec et publie aussi le diagnostic correspondant.

Les modules V2 existent : le catalogue core fournit `markup`, `list` et
`media-sync`, et les modules étrangers sont enregistrables via
`codplay.modules.register/override`.

Le registre des instances appartient au propriétaire `CodPlay` :
`codplay.instances.create()`, `codplay.instances.get()` et
`codplay.instances.destroy()`. `CodPlay` conserve les ressources, les events et
le pilotage de l'horloge partagée ; seul le pilotage technique reste sous
`codplay.engine`.

La construction est explicite et précède l'instanciation :

```ts
const build = codplay.build({ scene })
const instance = codplay.instances.create({
  ...options,
  compiledScene: build.compiledScene,
  functions: build.functions,
})
```

`codplay.build()` valide et prépare un `SceneDoc` avec le catalogue
core/foreign de l'engine. Il ne crée ni instance, ni materialisation, ni
lecture. En cas d'échec, il retourne uniquement le rapport de diagnostics ;
en cas de succès, il fournit le `CompiledScene` et la collection de fonctions
à transmettre à `codplay.instances.create()`.

`instance.telco.play()` réveille automatiquement le ticker central CodPlay et
`instance.telco.pause()` le suspend lorsque plus aucune instance ne joue. Le
consommateur n'a donc pas à appeler `engine.start()` ou `engine.pause()` pour
une lecture locale. Ces commandes générales restent disponibles :
`engine.pause()` suspend volontairement la propagation de toutes les instances
et `engine.start()` la reprend. Un hôte, comme Sighty, peut donc les employer
pour son pilotage général, avec la déclaration de pilote prévue par son
contexte.

Le preload est fourni par `codplay.preload`. Son résultat et
ses métadonnées sont transmis explicitement à l’engine avec
`codplay.resources.register()`.
Dans ce transfert, les URLs de `loaded` comme de `skipped` sont disponibles pour
l’engine ; `skipped` signifie que le cache a déjà fourni la ressource.

Une feuille CSS générée en mémoire peut être remplacée directement dans un
slot scoped, sans passer par le cache des ressources :

```ts
codplay.preload.css.set({ slot: 'editor-scene', cssText, container: mountTarget })
codplay.preload.css.clear('editor-scene')
```

Ce canal est distinct du preload URL des médias et des autres ressources ; il
est adapté aux reconstructions fréquentes de l’éditeur.

## Frontières

- le catalogue core/foreign est composé à la création puis verrouillé au
  premier `build()` ou `instances.create()` ;
- le `CompiledScene`, la racine HTML et l’état runtime appartiennent à une
  instance ;
- chaque instance utilise l’assemblage HTML/DOM core de CodPlay ; aucun
  materializer étranger n’est fourni ou sélectionné par la façade ;
- un composant peut contenir un `canvas` ou une représentation SVG dans son
  rendu HTML et exposer des cibles déclarées, sans ouvrir une materialisation
  Canvas, Three.js ou autre ;
- `codplay.events` fournit l’adressage partagé et `codplay.engine` fournit
  l’horloge ; les opérations de seek restent
  portées par `instance.telco` et utilisent la transaction interne du runtime ;
- `CodPlay` reçoit le `frameScheduler` de l’hôte et garde `TimeTicker` interne ;
- la façade ne crée ni DOM, ni journal, ni dispatcher parallèle ;
- les erreurs de pilotage et d'instance passent par les diagnostics V2 ; les
  seuls `{ ok: false }` de la façade sont les résultats structurés des
  registres de capacités.

`instance.diagnostic.onDiagnostic()` observe les warnings et erreurs. La même
surface expose `instance.diagnostic.onTrace()` pour le contexte des events
runtime ajoutés au journal live ; cette trace ne devient pas un diagnostic et
ne réexécute jamais la scène. `instance.events.onEvent()` reste réservé aux
eventimes de portée `public`.

Le chemin HTML/DOM est fourni par défaut. Le composant core `layout` expose
toutes les zones `data-part` écrites dans son template ; le composant `input`,
qui possède aussi des zones internes, n'en expose qu'une sélection. Cette
différence est définie par le catalogue core et n'est pas configurée par les
démos.

Les classes `Runtime*`, le catalogue, `EngineFacadeImpl`, `InstanceFacadeImpl`,
les runners, `TimeTicker` et les factories de démo restent internes. Les contrats
de la façade et leurs décisions se
trouvent dans
[`facade-engine-instance-plan.md`](../../plan/facade-engine-instance-plan.md).

## État

La tranche de registres directs est implémentée et testée. La démo V2 utilise
`codplay.build`, `codplay.resources` et `codplay.instances` ; elle ne construit
plus de catalogue, de runner ou de télécommande internes. Le contrat
`resources.override` reste reporté avec la définition de ressource associée.

L'accès authoring de l'éditeur est un chantier ultérieur et ne fait pas partie
de cette façade.
