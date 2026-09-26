# CodPlay V2 — parts de layout et points d'ancrage

## Périmètre vérifié

Le contrat ci-dessous décrit les points `anchor` et `outlet` découverts dans
le markup d'un composant `layout`. Le parcours d'acceptation de la tranche est
décrit dans le [plan associé](../plan/layout-part-marker-plan.md).

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

Le parseur de template accepte un préfixe configurable avant le token `part` ;
sa valeur par défaut est `data-`. Le test unitaire vérifie directement que le
préfixe `__` reconnaît `<!-- __part="scene-b" -->`. Le transport de cette option
depuis `HtmlPlayerRunner` et la façade d'instance n'a pas encore de test dédié ;
il reste une gate du [plan](../plan/layout-part-marker-plan.md). Le marqueur
élémentaire reste `data-part`, forme conservée dans les démos.

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

## Preuves du contrat

- `tests/runtime/runner-html/template-materializer.spec.ts` vérifie la
  découverte des deux marqueurs, leur ordre, la conservation du commentaire et
  le préfixe configurable ;
- `tests/runtime/capabilities/markup-capability.spec.ts` et
  `tests/runtime/player/pipeline.spec.ts` vérifient le type `anchor` et sa
  résolution ;
- `tests/runtime/player/html-component-materializer-scene.spec.ts` vérifie
  l'insertion des racines avant le commentaire sans enveloppe générée ;
- `tests/facade/sighty-demo.spec.ts` couvre la fixture de démonstration.

Validation ciblée exécutée le 2026-09-25 depuis `packages/codplay` :

```text
node ../../node_modules/vitest/vitest.mjs run \
  tests/runtime/runner-html/template-materializer.spec.ts \
  tests/runtime/capabilities/markup-capability.spec.ts \
  tests/runtime/player/pipeline.spec.ts \
  tests/runtime/player/html-component-materializer-scene.spec.ts \
  tests/facade/sighty-demo.spec.ts
5 fichiers, 49 tests réussis
```
