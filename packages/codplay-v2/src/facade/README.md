# Façade CodPlay V2

> Statut : Fini
> Version CodPlay : V2 foundation

## Rôle

La façade est l’entrée publique de CodPlay V2. Elle compose un engine, crée ses
instances et regroupe le pilotage d’une instance sous `telco`, l’injection et
l’observation des events sous `events`, et les diagnostics sous `diagnostic`.

```ts
const engine = codplay.engine.create(config)
const build = engine.builder.compile({ scene })
if (build.ok) {
  const instance = engine.instances.create({
    ...options,
    compiledScene: build.compiledScene,
    functions: build.functions,
  })

  instance.telco.play()
  instance.telco.seek(1_000)
  instance.events.emit(eventime, address)
}
```

La compilation est explicite et précède l'instanciation :

```ts
const build = engine.builder.compile({ scene })
const instance = engine.instances.create({
  ...options,
  compiledScene: build.compiledScene,
  functions: build.functions,
})
```

`engine.builder.compile()` valide et prépare un `SceneDoc` avec le catalogue
core/foreign de l'engine. Il ne crée ni instance, ni materialisation, ni
lecture. En cas d'échec, il retourne uniquement le rapport de diagnostics ;
en cas de succès, il fournit le `CompiledScene` et la collection de fonctions
à transmettre à `engine.instances.create()`.

`instance.telco.play()` réveille automatiquement le ticker central CodPlay et
`instance.telco.pause()` le suspend lorsque plus aucune instance ne joue. Le
consommateur n'a donc pas à appeler `engine.start()` ou `engine.pause()` pour
une lecture locale. Ces commandes générales restent disponibles :
`engine.pause()` suspend volontairement la propagation de toutes les instances
et `engine.start()` la reprend. Un hôte, comme Sighty, peut donc les employer
pour son pilotage général, avec la déclaration de pilote prévue par son
contexte.

Le preload est créé séparément par `codplay.preload.create()`. Son résultat et
ses métadonnées sont transmis explicitement à l’engine avec
`engine.resources.register()`.
Dans ce transfert, les URLs de `loaded` comme de `skipped` sont disponibles pour
l’engine ; `skipped` signifie que le cache a déjà fourni la ressource.

## Frontières

- le catalogue core/foreign est composé et verrouillé pendant la création de
  l’engine ;
- le `CompiledScene`, la racine HTML et l’état runtime appartiennent à une
  instance ;
- chaque instance utilise l’assemblage HTML/DOM core de CodPlay ; aucun
  materializer étranger n’est fourni ou sélectionné par la façade ;
- un composant peut contenir un `canvas` ou une représentation SVG dans son
  rendu HTML et exposer des cibles déclarées, sans ouvrir une materialisation
  Canvas, Three.js ou autre ;
- l’engine fournit l’adressage et l’horloge ; les opérations de seek restent
  portées par `instance.telco` et utilisent la transaction interne du runtime ;
- la façade ne crée ni DOM, ni journal, ni dispatcher parallèle ;
- les erreurs d’opération passent par les diagnostics V2 et ne sont pas
  transformées en enveloppes `{ ok: false }`.

Le chemin HTML/DOM est fourni par défaut. Le composant core `layout` expose
toutes les zones `data-part` écrites dans son template ; le composant `input`,
qui possède aussi des zones internes, n'en expose qu'une sélection. Cette
différence est définie par le catalogue core et n'est pas configurée par les
démos.

Les classes `Runtime*`, le catalogue et les runners restent internes. Les
contrats de la façade et leurs décisions se trouvent dans
[`facade-engine-instance-plan.md`](../../plan/facade-engine-instance-plan.md).

## État

La façade V2 foundation est implémentée, testée et vérifiée manuellement dans
Safari. La démo V2 utilise maintenant ce chemin public : elle ne construit plus de
catalogue, de runner ou de télécommande internes. Le test de façade vérifie
également que deux zones `data-part` quelconques d'un `layout` deviennent des
cibles utilisables, sans enveloppe DOM ajoutée.

L'accès authoring de l'éditeur est un chantier ultérieur et ne fait pas partie
de cette façade.
