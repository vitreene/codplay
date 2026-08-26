# Façade CodPlay V2

> Statut : En cours
> Version CodPlay : V2 foundation

## Rôle

La façade est l’entrée publique de CodPlay V2. Elle compose un engine, crée ses
instances et regroupe le pilotage d’une instance sous `telco`, l’injection et
l’observation des events sous `events`, et les diagnostics sous `diagnostic`.

```ts
const engine = codplay.engine.create(config)
const instance = engine.instances.create(options)

instance.telco.play()
instance.telco.seek(1_000)
instance.events.emit(eventime, address)
```

Le preload est créé séparément par `codplay.preload.create()`. Son résultat et
ses métadonnées sont transmis explicitement à l’engine avec
`engine.resources.register()`.

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
- l’engine fournit l’adressage, l’horloge et le seek groupé ;
- la façade ne crée ni DOM, ni journal, ni dispatcher parallèle ;
- les erreurs d’opération passent par les diagnostics V2 et ne sont pas
  transformées en enveloppes `{ ok: false }`.

Les classes `Runtime*`, le catalogue et les runners restent internes. Les
contrats de la façade et leurs décisions se trouvent dans
[`facade-engine-instance-plan.md`](../../plan/facade-engine-instance-plan.md).

## État

La façade de base est implémentée et couverte par les tests du package. Le
raccordement public de l’assemblage HTML/DOM core et la migration de la démo V2
restent à traiter dans la phase dédiée du plan ; ils ne doivent pas introduire
de second registre ou de second circuit de lecture.
