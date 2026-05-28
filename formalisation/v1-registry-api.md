# Registry API V1 - composants, services, modules

## Statut

Spec normative V1 pour le registry d'extension runtime expose par `codplay`.

## Objectif

Permettre l'enregistrement explicite de:

- composants runtime
- services partages
- modules runtime

avec une politique de collision uniforme, lisible et non silencieuse.

## Principe

Le registry est structure par famille:

- `codplay.component`
- `codplay.service`
- `codplay.module`

Chaque famille expose exactement deux operations:

- `register`
- `override`

## Contrat resultat

```ts
type RegistryError = {
  code: string
  message: string
  details?: Record<string, unknown>
}

type RegistryResult =
  | {
      ok: true
      status: "registered" | "overridden"
    }
  | {
      ok: false
      error: RegistryError
    }
```

## API minimale V1

```ts
type ComponentRegisterInput = {
  type: string
  component: RuntimeComponentClass
}

type ServiceRegisterInput<TService = unknown> = {
  name: string
  service: TService
}

type ModuleRegisterInput<TModule = unknown> = {
  name: string
  module: TModule
}

type ComponentRegistryApi = {
  register: (input: ComponentRegisterInput) => RegistryResult
  override: (input: ComponentRegisterInput) => RegistryResult
}

type ServiceRegistryApi = {
  register: <TService>(input: ServiceRegisterInput<TService>) => RegistryResult
  override: <TService>(input: ServiceRegisterInput<TService>) => RegistryResult
}

type ModuleRegistryApi = {
  register: <TModule>(input: ModuleRegisterInput<TModule>) => RegistryResult
  override: <TModule>(input: ModuleRegisterInput<TModule>) => RegistryResult
}

type CodplayRegistryApi = {
  component: ComponentRegistryApi
  service: ServiceRegistryApi
  module: ModuleRegistryApi
}
```

## Regles V1

1. `register`

- cree une declaration unique
- echoue si la cle existe deja
- n'ecrase jamais une declaration existante

2. `override`

- remplace explicitement une declaration existante
- echoue si la cle n'existe pas
- ne cree jamais implicitement une nouvelle declaration

3. Cles de registry

- un composant est adresse par `type`
- un service est adresse par `name`
- un module est adresse par `name`

4. Uniformite

- la semantique de `register` et `override` est identique sur les trois families
- les collisions sont toujours des erreurs explicites
- aucun mode `ignored` silencieux n'est autorise en V1

5. Temporalite

- les declarations sont faites avant leur usage runtime
- un composant consomme ensuite les services et modules deja enregistres
- un composant ne declare pas lui-meme un composant, un service ou un module

## Codes d'erreur suggeres

- composant deja enregistre: `RUNTIME_COMPONENT_ALREADY_REGISTERED`
- composant absent au override: `RUNTIME_COMPONENT_NOT_REGISTERED`
- service deja enregistre: `RUNTIME_SERVICE_ALREADY_REGISTERED`
- service absent au override: `RUNTIME_SERVICE_NOT_REGISTERED`
- module deja enregistre: `RUNTIME_MODULE_ALREADY_REGISTERED`
- module absent au override: `RUNTIME_MODULE_NOT_REGISTERED`

## Exemples

```ts
codplay.component.register({
  type: "text",
  component: TextComponent
})

codplay.service.register({
  name: "style",
  service: styleService
})

codplay.module.register({
  name: "move",
  module: moveModule
})
```

```ts
codplay.component.override({
  type: "text",
  component: CustomTextComponent
})
```

## Portee

- cette spec fixe la facade de registry et sa politique de collision
- elle ne fige pas encore la structure interne d'un `service`
- la structure et l'installation d'un `module` sont precisees dans `v1-module-api.md`
- elle s'aligne sur le modele existant de registry de composants du runtime
