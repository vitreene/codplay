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

## Réservation visuelle après une ligne de texte

Un `layout` peut déclarer `initial.flowReservations` pour des `outlet` déjà
présents dans son markup :

```ts
flowReservations: [{ partId: 'image-slot', blockSize: 'calc(75% + 2rem)' }]
```

Après l'attachement du template, le composant mémorise pour chaque part son
parent et son frère suivant dans le markup initial. Ces références gardent les
points logiques stables même quand un placement précédent a coupé des nœuds de
texte. Avant chaque calcul, les slots retournent à ces positions et les
fragments de texte adjacents sont réunis. Le composant retire alors
temporairement la réservation, cherche avec des `Range` temporaires la fin de
la ligne visuelle qui contient chaque point, puis place **le même élément** à
cette fin de ligne. Les réservations sont traitées dans l'ordre du markup. Le
slot flotte sur toute la largeur et son `padding-bottom` prend la valeur
`blockSize`. Le texte situé après le point logique finit donc sa ligne avant
le bloc. Aucun élément ni perso supplémentaire n'est créé ; la cible
`data-part` et son éventuel enfant restent les mêmes.

Le composant observe la largeur de son layout avec `ResizeObserver`. Un
changement de largeur refait le placement à partir des points logiques ; les
changements de hauteur dus aux réservations ne déclenchent pas de boucle.
Après un seek, un reset ou un replay, le même calcul peut être demandé : il
reste idempotent et garde l'ordre initial des slots. C'est important quand
Sighty rejoue une scène conservée avec son mode `rewind`. `destroy()` retire
l'observation. La capture des positions attend que la racine soit attachée au
document ; la prendre pendant `initialize()`, quand le template est encore
dans un fragment détaché, perdrait les bonnes références de parent.

Le test ciblé
[`layout-flow-reservation.spec.ts`](../tests/runtime/components/layout-flow-reservation.spec.ts)
vérifie l'attachement différé, la conservation du slot et de son enfant, le
recalcul après un changement de largeur, l'ordre stable de plusieurs slots
après des calculs répétés et la libération de l'écouteur. La
prévisualisation Elcé dans Safari du 2026-10-03 exerce le vrai player : à
`846 px` puis `670 px` de colonne, le texte reste continu, l'image est montée
une seule fois dans le slot, et le média garde `16 px` de marge au-dessus et
au-dessous. Avant correction, le cycle réel A → B → A dans Safari déplaçait
les deux vidéos avant le texte. Après correction, le même parcours garde un
`innerHTML`, un ordre des nœuds et un texte identiques sur A avant et après le
passage par B. Le test `HtmlPlayerRunner.seek(0)` vérifie aussi que le cycle
`afterSeek` appelle bien `refresh()` tout en conservant les deux slots et leurs
persos. Les autres validations d’intégration restent ouvertes dans le
[plan](../plan/layout-inline-flow-plan.md).

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
