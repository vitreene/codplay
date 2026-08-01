# CodPlay V2 - contrat du module layout

## Statut

Status: En cours  
CodPlay version: V2 foundation  
Review: LayoutComponent implementation authorized; runtime integration remains pending

## Positionnement

`layout` reutilise le comportement `RuntimeModuleService`. Il n'introduit pas un
troisieme type de runtime.

```text
RuntimeModuleServiceCatalog
  -> definition id: layout
  -> une instance par player
  -> etat interne par composant layout
```

Le module ne cree pas de composant, ne parse pas de template et ne lit pas le DOM.
Le composant materialise son template et remet au module les identites de ses
cibles internes. Le module conserve la relation logique entre un composant et ses
outlets ; un backend de projection associe ensuite ces cibles a des nodes reels.

## Identifiants

Un outlet porte un identifiant opaque. Le module compare les valeurs exactes et ne
deduit aucune semantique de leur forme.

```text
page-layout:content
content
```

Ce sont deux identifiants valides. Leur unicite dans la scene est une contrainte du
registre de cibles, pas une convention de nommage du module.

## Etat pur

L'etat pur du module porte :

- les composants proprietaires enregistres par leur identifiant ;
- les parts montables declares par chaque composant ;
- la relation identifiant de cible -> proprietaire ;
- la resolution d'une cible vers sa declaration logique.

```ts
type MountablePartDeclaration = Readonly<{
  id: string
  ownerId: string
  storyId: string
  componentType: string
  partId: string
  kind: 'outlet'
}>

type ComponentMountRegistration = Readonly<{
  componentId: string
  storyId: string
  componentType: string
  parts: readonly MountablePartDeclaration[]
}>

class LayoutCapabilityState {
  registerComponent(registration: ComponentMountRegistration): void
  unregisterComponent(componentId: string): void
  resolveTarget(targetId: string): MountablePartDeclaration | undefined
  getComponentParts(componentId: string): readonly MountablePartDeclaration[]
  getAllTargets(): readonly MountablePartDeclaration[]
}
```

`registerComponent()` refuse :

- un composant deja enregistre ;
- une cible dont l'identifiant existe deja dans la scene ;
- une cible dont `ownerId`, `storyId` ou `componentType` ne correspond pas au
  composant enregistre.

`unregisterComponent()` retire le composant et toutes ses parts montables. Les
cibles ne restent jamais dans le registre apres le retrait de leur proprietaire.

## Instance module

`createLayoutModuleServiceDefinition()` implemente la definition compatible avec
`RuntimeModuleServiceCatalog`. Chaque appel `create()` construit une nouvelle
`LayoutCapabilityState` et expose les operations layout suivantes :

- `registerComponent()` ;
- `unregisterComponent()` ;
- `resolveTarget()` ;
- `getComponentParts()` ;
- `getAllTargets()`.

L'implementation se trouve dans
`src/runtime/capabilities/layout/layout-capability.ts`. La factory d'integration
qui remet une vue scopee de cet etat au composant reste a definir ; elle ne doit
pas modifier le contrat generique du catalogue pour y ajouter des methodes layout.

## Frontiere composant

La dependance du composant passe par la facade de services :

```text
LayoutComponent
  -> services.declare(['layout'])
  -> runtime associe l'instance du module layout scopee au player
```

Le composant ne recoit pas directement un module dans son constructeur et n'appelle
pas les operations d'enregistrement des outlets. La facade `declare()` est la meme
frontiere de declaration que pour les services V1 ; le runtime associe cette
declaration a l'instance `RuntimeModuleService` `layout`.

Le composant conserve sa racine et son template. La definition runtime du type
selectionne les parts montables ; elle peut donc etre reutilisee par `layout`,
`input` ou tout autre composant qui expose des cibles de montage :

```ts
class LayoutComponent extends BaseComponent {
  render(): string {
    return `
      <section>
        <main data-part="page-layout:content"></main>
        <aside data-part="page-layout:aside"></aside>
      </section>
    `
  }

  update(input: ComponentUpdateInput): void {
    this.services.apply(this.node, input.state)
  }
}
```

Le composant ne publie pas une methode normative `getOutletsSnapshot()`. La
frontiere de publication est le binding du module `layout`.

## Placement

Le flux cible est :

```text
Component template
  -> materialized part registry
  -> selection des parts montables par la definition du type
  -> LayoutModuleService registration
  -> opaque mount target registry
  -> SolvedPerso.placement.targetId
  -> backend de montage
```

Le module ne decide pas l'ordre des enfants, ne fait pas de FLIP et ne mute pas le
DOM. Il fournit la declaration logique qui permet au placement et au backend de
resoudre leur cible.

## Dependance du type

Le type `layout` est enregistre avec une dependance module `layout`. Cette
dependance est une propriete de la definition runtime du type, pas une propriete
arbitraire du `perso`.

La declaration doit alimenter :

- le validateur de composant ;
- `CompiledRequirements.modules` ;
- la validation de disponibilite par `RuntimeEngine` ;
- la creation de l'instance par `RuntimeModuleServiceCatalog`.

## Etat de la tranche

Le contrat du module et l'etat pur sont implementes dans
`src/runtime/capabilities/layout/layout-capability.ts`. La prochaine implementation
autorisee est `LayoutComponent`, avec le contrat composant suivant :

- `render()` retourne un template string ;
- `this.node` conserve la racine materialisee ;
- `update()` applique l'etat du layout a `this.node`.

Une fonction `init()` optionnelle est reportee a une etude V2.5 pour les usages
avances. Elle ne fait pas partie de l'implementation V2 actuelle.

Le branchement du composant au `RuntimePlayer` et au backend de montage reste une
tranche distincte.

## Hors contrat de cette tranche

- creation de composants V2 ;
- injection finale du binding dans `LayoutComponent` ;
- adaptation d'un node materialise vers un backend DOM ;
- mutation du parentage ;
- FLIP et mesure ;
- integration du module dans `RuntimePlayer`.
