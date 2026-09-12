# CodPlay V2 — parts de layout et points d'ancrage

## Statut

> Status: En cours
> CodPlay version: V2 foundation
> Première tranche: 2026-09-12

Cette spécification décrit l'enrichissement du markup d'un composant `layout`
par des points d'accès sans conteneur. Elle complète la capacité `markup`
existante et ne modifie pas le contrat du composant `slot`.

## Rôle

Un `layout` fournit un markup auteur qui peut exposer des cibles de montage.
Le materializer HTML découvre ces cibles, conserve les références nécessaires et
projette ensuite la parenté résolue par CodPlay. Le composant `layout` ne crée
pas lui-même les nœuds DOM et le markup auteur ne reçoit aucune enveloppe
générée pour un point d'accès.

## Marqueurs auteur

Deux formes appartiennent au même espace d'identifiants de parts :

```html
<main id="layout-root">
  <section data-part="content"></section>
  <!-- data-part="scene-b" -->
</main>
```

- `data-part="content"` sur un élément désigne un `outlet`. Le materializer
  consomme l'attribut et publie l'élément comme cible ; l'élément reste dans le
  markup et constitue sa propre boîte de montage.
- `<!-- data-part="scene-b" -->` désigne un `anchor`. Le materializer conserve
  le nœud commentaire comme référence et publie une cible sans boîte DOM.
- Les deux formes sont découvertes dans l'ordre du template. Un identifiant
  vide, une collision ou une part non autorisée sont traités par les mêmes
  validations de la capacité `markup`.
- Le commentaire est conservé jusqu'à la destruction de la materialisation qui
  le contient. Il n'est pas transformé en élément et ne peut pas devenir le
  parent DOM d'un autre perso.

Le nom de l'attribut de commentaire est configurable par un préfixe placé avant
le token `part` :

```ts
new HtmlPlayerRunner({
  // ...
  partMarkerPrefix: '__',
})
```

La valeur par défaut est `data-`. La configuration ci-dessus reconnaît donc
`<!-- __part="scene-b" -->`. Le marqueur élémentaire reste `data-part`, qui est
la forme explicite conservée dans les démos.

## Placement d'un ancrage

Lorsqu'un perso vise une cible `anchor`, le solveur conserve le propriétaire
logique de la part comme `parentKey`. Le materializer HTML résout ensuite :

```text
cible anchor (commentaire)
  -> parentNode du commentaire + commentaire comme référence
  -> insertion des racines réelles du perso par insertBefore
```

Les racines sont insérées avant le commentaire, dans leur ordre résolu. Aucun
`div`, fragment enveloppe ou autre élément n'est fabriqué. Plusieurs ancrages
qui partagent le même parent restent des points distincts, car chacun possède
sa propre référence.

Une cible `outlet` conserve le comportement précédent : le nœud désigné devient
directement le parent structurel. Les cibles `root`, `host` et `perso` ne sont
pas requalifiées par cette extension.

## Frontière avec `slot`

Un `slot` monté sur un ancrage est lui-même la racine réelle insérée avant le
commentaire. Son conteneur hôte reste nécessaire et reste animé comme perso.
Les racines de contenu foreign continuent d'être attachées à l'intérieur de ce
conteneur par la surface `foreignContent`. L'ancrage ne donne aucun accès direct
à ces racines et ne change ni leur propriété ni leur cycle de vie.

## Convention d'identification du markup

Tout élément parent écrit dans un markup auteur doit porter un `id` explicite.
Un point d'ancrage est l'exception de structure attendue : il s'écrit comme un
commentaire précisément parce qu'il ne doit pas introduire un conteneur anonyme.

## Validation

La première tranche est couverte par les tests du parseur, de la capacité
`markup`, du solveur, du materializer structurel et de la démo 1. La suite
complète CodPlay, le typecheck CodPlay, le typecheck V2 des démos et leur build
passent. La validation navigateur et les cas de composition plus larges restent
à effectuer ; le statut de la spécification demeure donc `En cours`.
