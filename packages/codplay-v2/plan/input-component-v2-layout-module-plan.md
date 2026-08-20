# CodPlay V2 - InputComponent et module layout

## Statut

Status: Reporte - contrat generique du module uniquement  
CodPlay version: V2 foundation  
Review: required before implementation

## Perimetre reporte

La reecriture de `InputComponent` n'est pas une tranche actuelle. Ce document
conserve uniquement les exigences generiques que le module `layout` devra pouvoir
supporter plus tard pour un composant autre que `layout`.

## Objectif futur

Reecrire `InputComponent` V1 dans le contrat composant V2 et lui permettre
d'exposer certains parts internes comme cibles de montage via le module `layout`.

Le composant doit conserver deux categories de parts :

```text
parts internes
  control, label, hint
  -> utilises uniquement par InputComponent

outlets de montage
  selection-icon, correction-icon
  -> ciblables par des persos enfants
```

Le composant ne publie aucune methode `getOutletsSnapshot()` et n'enregistre pas
lui-meme ses outlets. La materialisation et le module runtime s'en chargent.

## Constat V1

V1 utilise un template partiel :

1. `BaseComponent` construit une racine `label` ;
2. `InputComponent` injecte `INPUT_TEMPLATE` dans `innerHTML` ;
3. `InputComponent` appelle directement `collectDataParts()` ;
4. `InputComponent` appelle directement `setPart()` ;
5. `getOutletsSnapshot()` publie deux parts avec des IDs derives du perso.

Cette chaine est hors du contrat V2. Elle repete la materialisation dans le
composant et melange parts internes et outlets.

## Contrat auteur V2

`InputComponent.render()` retourne le template complet :

```ts
render(): string {
  return `
    <label>
      <input data-part="control" />
      <span data-part="label"></span>
      <span data-part="selection-icon" aria-hidden="true"></span>
      <span data-part="correction-icon" aria-hidden="true"></span>
      <span data-part="hint"></span>
    </label>
  `
}
```

La definition runtime du composant declare les services necessaires dans le
catalogue unifie :

```ts
  {
    type: 'input',
    services: ['className', 'style', 'attr'],
    modules: ['markup'],
  }
```

Le contrat V2 actuel ne comporte pas `init()`. L'etat initial est applique par
`update()` apres materialisation.

## Repartition des parts

La materialisation produit un registre interne :

```text
partId -> nodeRef
```

Le type de composant `input` declare au runtime les parts qu'il autorise comme
outlets :

```text
input mountable parts:
  selection-icon
  correction-icon
```

Les parts `control`, `label` et `hint` restent internes. Cette declaration est une
propriete de la definition runtime du type `input`, pas une donnee auteur et pas
une methode appelee par le composant.

## Modification du module layout

Le module garde son identifiant `layout` et son comportement
`RuntimeModuleService`. Son etat doit etre generalise : il ne doit plus parler
uniquement de composants `layout`, mais de proprietaires de parts montables.

Les types deviennent conceptuellement :

```ts
type MountablePartRegistration = Readonly<{
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
  parts: readonly MountablePartRegistration[]
}>
```

Le module doit fournir :

- enregistrement d'un composant proprietaire ;
- enregistrement d'un sous-ensemble de parts montables ;
- resolution par identifiant opaque exact ;
- retrait atomique d'un composant et de ses parts ;
- verification des collisions ;
- enumeration des cibles pour le placement.

Le module ne doit pas recevoir ni manipuler les parts internes non montables.

## Materialisation runtime

La frontiere interne a construire est :

```text
Component.render()
  -> template string
  -> materializer
  -> node racine + registre de parts
  -> definition runtime du type
  -> selection des parts montables
  -> facade service `layout`
  -> instance module layout du player
```

Le composant ne doit pas appeler `registerComponent()`, `registerPart()` ou
`getOutletsSnapshot()`. Ces operations appartiennent au runtime de materialisation
et au module.

## Reecriture de update()

V1 reconstruit `ResolvedInputState` a partir de l'etat precedent du composant :

```text
previous component state + action -> next state
```

V2 doit recevoir l'etat complet deja resolu :

```text
PersoState(t) -> InputComponent.update(state) -> parts internes
```

`update()` doit :

- appliquer les proprietes du root ;
- configurer le part `control` ;
- mettre a jour `label` et `hint` ;
- appliquer les classes, styles et attributs des icons ;
- mettre a jour le contenu visuel selon `visualState` ;
- ne jamais reconstruire l'etat logique depuis le DOM ;
- ne jamais appeler le module layout pour monter les enfants.

Les fonctions V1 de resolution visuelle peuvent etre conservees si elles deviennent
pures et recoivent l'etat V2 complet au lieu d'un historique mutable local.

## Definition runtime du type input

La definition du type devra porter :

- `type: 'input'` ;
- la factory `InputComponent` ;
- les services `className`, `style`, `attr` ;
- la dependance module `layout` ;
- la table interne des parts montables `selection-icon` et `correction-icon` ;
- le validateur des formes `InputInitial` et `InputState`.

Cette declaration derive `layout` dans `CompiledRequirements.modules` comme pour
le type `layout`. Le `perso` input ne declare pas le module.

## Compatibilite avec les persos V1

Les persos enfants existants conservent leur intention :

```ts
{
  id: 'answer-selection-icon',
  type: 'tag',
  initial: {
    content: 'OK',
    move: { target: 'quiz-question-1__answer-a__selection-icon' }
  }
}
```

L'identifiant reste une valeur opaque. Sa forme et son prefixe ne sont pas
interpretes par le module.

## Tests requis

- materialisation du template complet `input` ;
- conservation des cinq parts dans le registre interne ;
- publication uniquement des deux parts montables ;
- resolution d'un enfant dans `selection-icon` ;
- resolution d'un enfant dans `correction-icon` ;
- absence d'acces runtime aux parts `control`, `label` et `hint` ;
- collision d'un outlet avec un autre composant ;
- retrait atomique des outlets lors du retrait d'un input ;
- update repetable depuis deux `PersoState(t)` identiques ;
- seek/reconstruction sans dependance a l'etat precedent du composant.

## Ordre d'implementation futur

1. Generaliser les types et l'etat pur du module `layout`.
2. Ajouter la selection generique des parts montables dans la definition d'un composant.
3. Construire le materializer V2 qui conserve `node` et les parts.
4. Reprendre `InputComponent` dans une tranche ulterieure.
5. Ajouter la verticale de test input/layout dans cette tranche ulterieure.
6. Reprendre une demo quiz comme preuve de bout en bout.

## Hors perimetre

- handles publics ;
- interrogation imperative du controle input ;
- gestion de focus ou de selection ;
- nouvelle horloge composant ;
- modification du runtime V1.
