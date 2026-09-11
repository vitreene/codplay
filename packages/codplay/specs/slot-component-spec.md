# CodPlay V2 — hôte de contenu foreign (`slot`)

## Statut

> Status: En cours — profil auteur, manifeste et surface HTML implémentés ;
> module `replace`, orchestration interinstances et façade publique restent à
> définir et valider.
> CodPlay version: V2 foundation
> Décision d'ouverture: 2026-09-11
> Plan: [`../plan/foreign-scene-component-plan.md`](../plan/foreign-scene-component-plan.md)

## Rôle

`slot` est un composant core HTML qui fournit une racine hôte simple pour une
représentation foreign. Il peut recevoir une scène CodPlay, une iframe, un flux
vidéo ou tout autre contenu rendu par un adaptateur. Le composant ne connaît ni
la provenance ni la structure de ce contenu.

Le perso porte son identité de composition dans `name`, à la racine du perso :

```ts
{
  id: 'body-host',
  name: 'body',
  type: 'slot',
  initial: { move: '@root' },
}
```

`name` est requis, stable et distinct de `id`. Il n'est pas dans `initial`, ne
peut pas être modifié par une action et n'est pas transmis au service de
contenu textuel. La compilation conserve ce nom dans `CompiledPerso`.

Une déclaration de `name` dans `initial` ou dans une action est rejetée (`name`
reste une propriété racine immuable).

La racine est `<div>` lorsque `initial.tag` est absent. `tag`, `className`,
`style` et `attr` sont les seules données de la première tranche. Le composant
ne déclare pas le service `content` de `TagComponent` : `initial.content` est
une référence foreign opaque et sérialisable, validée sans interprétation.

Les valeurs foreign acceptées sont récursivement composées de chaînes, nombres
finis, booléens, `null`, tableaux et objets simples. Elles ne peuvent contenir
ni nœud DOM, ni player, ni fonction.

## Découverte d'auteur

`slotManifest(scene, { storyId? })` parcourt un `SceneDoc` ou un `CompiledScene`
et retourne, dans l'ordre des déclarations, le nom, la story, le `perso.id` et
le chemin `stories.<story>.persos[<index>].name`. Il ne démarre pas de player et
ne lit pas le DOM.

`resolveSlotManifestEntry(manifest, slot, { sceneId?, storyId?, referencePath? })` exige une
correspondance exacte. Il retourne une entrée unique ou un diagnostic
`AUTHOR_SLOT_NAME_UNKNOWN` / `AUTHOR_SLOT_NAME_AMBIGUOUS` avec les noms et les
déclarations candidates. L'application auteur peut afficher ce diagnostic
comme warning ou erreur selon son parcours ; aucune sélection par approximation
n'est autorisée.

## Surface HTML

Après `materializeComponent`, le catalogue peut publier la surface
`foreignContent` du composant :

```ts
type ForeignContentSurface = {
  attach(roots: readonly unknown[], referenceRoot?: unknown): void
  detach(): void
}
```

`attach` écrit chaque racine dans `hostRoot` par `appendChild`, ou par
`insertBefore` lorsque `referenceRoot` est une racine déjà attachée, et remplace
la relation précédente. `detach` appelle `removeChild` uniquement pour les racines
que cette relation possède, sans détruire la ressource ou l'instance qui les a
fournies. Le materializer détache la relation lorsque le perso est démonté ou
détruit. Les racines foreign ne sont pas inscrites comme persos, parts ou
cibles CodPlay.

Le conteneur, `hostRoot` et les racines foreign doivent coordonner leurs règles
CSS selon les choix de l'application auteur. Le composant core n'impose aucune
couleur, dimension, ratio, débordement, alignement ou classe de présentation.

## Limites actuelles

- Le module partagé `replace` n'est pas encore raccordé aux hooks V2 ; la
  présence de `replace.split` est rejetée explicitement par la validation du
  profil `slot`.
- La surface est disponible dans le runtime HTML interne ; la façade publique
  d'adressage entre instances et l'orchestration Sighty restent à définir.
- L'adaptateur conserve la propriété du contenu foreign et décide de son
  chargement, de son cycle de vie et de sa capacité de clonage.

## Validation effectuée

Le test `tests/runtime/components/slot-component.spec.ts` couvre le nom racine,
le défaut `div`, l'absence de service textuel, l'attachement/détachement de
plusieurs racines et le rejet de `replace.split`. Le test
`tests/scene/authoring/slot-manifest.spec.ts` couvre la découverte, l'absence et
la collision de noms. Le typecheck CodPlay, le typecheck des démos V2 et la
suite CodPlay existante passent pour cette tranche.
