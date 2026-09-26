# CodPlay V2 — composants et matérialisation HTML

## Périmètre certifié

Cette spécification décrit les frontières composants et les comportements
HTML/DOM couverts par les tests ciblés. Les contrats propres à un composant
restent dans sa spécification. Les mesures et la présentation motion relèvent
des [plans motion](../plan/runner-flip-integration-study.md) et de leurs
spécifications dédiées.

## Bases de composant

[`BaseComponent`](../src/runtime/components/base-component.ts) est la base
générique : elle ne déclare pas `render()`. La spécialisation
[`BaseHTMLComponent`](../src/runtime/components/base-html-component.ts) déclare
`render(): string` et expose sa racine matérialisée. Le test de frontière
confirme qu’un composant générique peut être mis à jour sans représentation
markup et que le composant HTML conserve `node === null` avant matérialisation.

Le test du runtime composant confirme que les instances sont conservées pendant
les synchronisations de snapshots et détruites au teardown final. Un échantillon
de présentation temporelle peut être appliqué par `presentAt()` sans répéter
l’update logique. Les règles de projection tierce et de résolution de cibles
sont dans la [spécification du pont cible](./third-party-target-bridge-spec.md).

## Services et modules

[`RuntimeCapabilityCatalog`](../src/runtime/catalog/runtime-capability-catalog.ts)
crée les services déclarés par la classe du composant pour le materializer
choisi. Un service déclaré mais indisponible pour ce materializer est rejeté ;
le snapshot de validation provient des mêmes inscriptions que le runtime. Les
tests confirment que les services non déclarés ne sont pas instanciés et que le
composant applique ses patches via cette façade.

Les noms de services sont aussi les namespaces de données du composant dans
`initial` et les actions : ils relient le profil validé par le build à la même
capacité appliquée par `update()`. La classe du composant déclare les services
qu'elle consomme ; cette déclaration et l'ordre d'application sont partagés
avec le catalogue et le runtime. Aucun groupe parallèle de propriétés n'est
nécessaire dans la scène.

Les instances de services de module sont locales à un player. Deux players
reçoivent deux instances indépendantes ; une définition de module manquante ou
dupliquée est rejetée par le catalogue.

### Parts internes et cibles de montage

La matérialisation découvre les parts du template ; la définition runtime du
composant choisit ensuite lesquelles deviennent des cibles publiques. Une part
découverte mais non sélectionnée reste interne au composant. `InputComponent`
exerce cette séparation : ses parts `control` et `label` restent internes,
tandis que ses deux slots d'icône sont publiés.

Le module `markup` est une capacité runtime instanciée par player. Il conserve
les identifiants de cible comme des chaînes opaques, expose ses inscriptions au
registre de placement et retire les cibles quand le composant est désinscrit.
Les tests vérifient l'égalité exacte des identifiants, le refus d'un doublon,
l'isolation entre deux players, le retrait des cibles et la conversion des
parts `outlet` et `anchor` vers les déclarations du player. Les détails des
marqueurs et de leur placement sont dans la [spécification layout](./layout-component-spec.md).

Les composants qui possèdent un substrat non HTML ne traversent pas le
materializer HTML avec du markup vide ou une représentation factice ; cette
frontière est décrite dans la [spécification du pont des cibles tierces](./third-party-target-bridge-spec.md).

Les composants core n'ajoutent pas de thème visuel implicite : le style de
présentation reste dans les valeurs auteur et les feuilles de l'application.
Les classes nécessaires à la structure ou à l'état d'un composant restent
permises. Cette décision, confirmée pour CodPlay le 2026-09-11, n'empêche pas un
composant auteur d'encapsuler son propre style. Les implémentations de
[`tag`](../src/runtime/components/tag/tag-component.ts),
[`img`](../src/runtime/components/image/image-component.ts),
[`input`](../src/runtime/components/input/input-component.ts) et
[`polygon`](../src/runtime/components/polygon/polygon-component.ts) montrent
les valeurs d'état et les classes structurelles consommées ; leurs tests
respectifs sont dans `tests/runtime/components/`.

## Lecture des templates

[`materializeTemplateString`](../src/runtime/runner-html/template-materializer.ts)
lit un template via le parseur DOM du navigateur et retourne soit une racine,
soit la collection ordonnée de ses racines réelles. Plusieurs racines ne
produisent pas d’enveloppe supplémentaire.

Les attributs `data-part` désignent des outlets : l’attribut est consommé et la
référence vers l’élément est conservée. Un commentaire de la forme
`<!-- data-part="id" -->` désigne une ancre. Son préfixe peut être configuré.
Les outlets et ancres sont classés et conservés dans leur ordre de lecture.

## Services HTML et structure de scène

Les services HTML testés appliquent les valeurs courantes de `className`,
`style`, `attr` et `content` à leur nœud. Ils retirent les valeurs gérées qui
disparaissent du nouvel état et gardent leur état géré isolé par nœud. Pour
`content`, une chaîne inchangée conserve son nœud texte ; un enfant élément est
remplacé par un nœud texte même si son texte visible est identique.

[`HtmlComponentMaterializer`](../src/runtime/runner-html/component-materializer.ts)
projette le placement et l’ordre résolus sur les nœuds réels. Les tests
couvrent le montage, le réordonnancement et le détachement vers des cibles de
racine, d’outlet et de perso. Une ancre commentaire reçoit les enfants avant
elle, sans enveloppe ; tous les nœuds d’un fragment sont montés ou détachés
ensemble.

## Preuves

- [`base-component.spec.ts`](../tests/runtime/components/base-component.spec.ts)
  vérifie les deux frontières de base.
- [`runtime-component-runtime.spec.ts`](../tests/runtime/components/runtime-component-runtime.spec.ts)
  vérifie la persistance des instances, le teardown et l’échantillonnage de
  présentation sans nouvel update logique.
- [`runtime-capability-catalog.spec.ts`](../tests/runtime/catalog/runtime-capability-catalog.spec.ts)
  vérifie les services déclarés, leur compatibilité avec le materializer et le
  snapshot partagé par le build et le runtime.
- [`scene-builder.spec.ts`](../tests/scene/compiled/scene-builder.spec.ts)
  vérifie la validation des namespaces de services à la compilation.
- [`module-catalog.spec.ts`](../tests/runtime/engine/module-catalog.spec.ts)
  vérifie l'indépendance des instances de modules par player et les définitions
  absentes ou dupliquées.
- [`markup-capability.spec.ts`](../tests/runtime/capabilities/markup-capability.spec.ts)
  vérifie les identifiants opaques, l'isolation player-local, le retrait des
  cibles et leur conversion vers le registre de montage.
- [`template-materializer.spec.ts`](../tests/runtime/runner-html/template-materializer.spec.ts)
  vérifie les marqueurs, les ancres et les racines multiples.
- [`component-materializer.spec.ts`](../tests/runtime/runner-html/component-materializer.spec.ts)
  vérifie l’application et la réconciliation des services HTML.
- [`html-component-materializer-scene.spec.ts`](../tests/runtime/player/html-component-materializer-scene.spec.ts)
  vérifie la projection de l’ordre, du parentage, des ancres et des fragments.
- [`mount-targets.spec.ts`](../tests/runtime/player/mount-targets.spec.ts)
  vérifie les identifiants opaques et le refus de doublons de cibles.

Validation ciblée exécutée le 2026-09-25 depuis `packages/codplay` :

```text
node ../../node_modules/vitest/vitest.mjs run \
  tests/runtime/components/base-component.spec.ts \
  tests/runtime/components/runtime-component-runtime.spec.ts \
  tests/runtime/runner-html/component-materializer.spec.ts \
  tests/runtime/runner-html/template-materializer.spec.ts \
  tests/runtime/player/html-component-materializer-scene.spec.ts \
  tests/runtime/player/render-sync.spec.ts \
  tests/runtime/player/mount-targets.spec.ts
7 fichiers, 43 tests réussis
```

Validation complémentaire exécutée le 2026-09-25 depuis `packages/codplay` :

```text
node ../../node_modules/vitest/vitest.mjs run \
  tests/runtime/catalog/runtime-capability-catalog.spec.ts \
  tests/runtime/engine/module-catalog.spec.ts
2 fichiers, 7 tests réussis
```

Le contrôle des composants core et de leurs catalogues a aussi passé :
`tests/runtime/components/`, `runtime-capability-catalog.spec.ts` et
`module-catalog.spec.ts` — 11 fichiers, 33 tests.

Validation complémentaire exécutée le 2026-09-25 depuis `packages/codplay` :
`tests/runtime/capabilities/markup-capability.spec.ts` et
`tests/runtime/components/image-input-polygon.spec.ts` — 2 fichiers, 11 tests
réussis.

## Limites

Cette spécification ne fixe pas une politique de sanitation des templates :
cette politique est en revue dans le [plan de matérialisation](../plan/component-render-representation-plan.md),
car le chemin testé utilise directement le parseur DOM. Les autres limites,
notamment le pont tierce, les composants spécialisés, le DnD et la présentation
FLIP, restent décrites par leurs contrats dédiés.
