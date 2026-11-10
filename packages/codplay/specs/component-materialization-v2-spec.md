# CodPlay V2 — composants et matérialisation HTML

> Version de référence : CodPlay V2 — 2026-11-10.

## Périmètre certifié

Cette spécification décrit les frontières composants et les comportements
HTML/DOM couverts par les tests ciblés. Les contrats propres à un composant
restent dans sa spécification. Les mesures et la présentation motion relèvent
de la [spécification motion](./motion-frame-v2-spec.md).

## Bases de composant

[`BaseComponent`](../src/runtime/components/base-component.ts) est la base
générique : elle ne déclare pas `render()`. La spécialisation
[`BaseHTMLComponent`](../src/runtime/components/base-html-component.ts) déclare
`render(): string` et expose sa racine matérialisée. Le test de frontière
confirme qu’un composant générique peut être mis à jour sans représentation
markup et que le composant HTML conserve `node === null` avant matérialisation.

Le runtime appelle `BaseComponent.initialize()` après la matérialisation de la
racine HTML et avant le premier update logique. Les composants qui possèdent une
source continue peuvent y attacher leurs listeners à cette racine. Le runtime
leur fournit alors, si nécessaire, le port player-scoped optionnel
`captureSources` ; le contrat du port partagé est décrit dans la
[spécification capture](./capture-v2-spec.md).

Le runtime transmet aussi aux composants les frontières `beforeSeek()`,
`afterSeek()`, `onSequenceEnd()` et `onReset()` pour suspendre, reprendre ou
retirer leurs sources selon le cycle du player. `destroy()` libère leurs
ressources au teardown. Le test d’intégration du scroll vérifie ces frontières
avec un vrai `HtmlPlayerRunner` et une racine DOM matérialisée.

Le test du runtime composant confirme que les instances sont conservées pendant
les synchronisations de snapshots et détruites au teardown final. Un échantillon
de présentation temporelle peut être appliqué par `presentAt()` sans répéter
l’update logique. Les règles de projection tierce et de résolution de cibles
sont dans la [spécification du pont cible](./third-party-target-bridge-spec.md).

## Services et modules

### Définition et enregistrement d'un composant

Une `RuntimeComponentDefinition` associe un nom `type` à la classe du composant,
aux IDs de modules requis et à `validateInitial`. La classe expose sa liste
statique `declaredServices` et déclare les mêmes services à sa construction.
La définition peut également fournir `validateAction`, `validatePerso`,
`sanitizeInitial` et `sanitizeAction` pour les frontières auteur concernées.
Le build utilise ces déclarations avant de produire les données compilées ;
le player ne revalide pas les profils auteur à chaque update.

La définition est fournie dans `engine.components.register` à la construction
de `CodPlay`, ou à `codplay.components.register(definition)` avant le
verrouillage du catalogue. Les services, modules et bibliothèques
associés sont enregistrés sur le même propriétaire. La façade décrit le
[verrouillage et l'override explicite](./facade-v2-spec.md#propriétaire-préparation-et-instances).

`libraries` déclare les dépendances préparées par l'engine avant l'initialisation.
`targetProvider` publie une cible opaque ; `runtimeProfile: 'attached'` permet
à un composant logique de dépendre d'un host sans placement `move`. Ces deux
champs suivent le [contrat du pont cible](./third-party-target-bridge-spec.md).
`surfaces` expose des opérations de composant au runtime. Les champs
`mountableParts` et `mountablePartResolver` sélectionnent les parts utilisables
par le placement ; ils ne changent pas leur découverte dans le template.

### Application de l'état

`update()` reçoit un `ComponentUpdateInput` contenant l'état résolu et
`timeMs`. Selon la capacité, le runtime lui fournit également `target`, les
occurrences `activeActions` et `registerAnimation`. Une animation enregistrée
par le composant est échantillonnée au temps du player ; sa phase `content`
précède les animations de phase `commit` des hosts de rendu. Le composant
conserve ses ressources natives et les libère à sa destruction.

### Résolution des services

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
permises. Un composant auteur peut encapsuler son propre style. Les
implémentations de
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

`tag` applique `content` par le service du même nom, avec une chaîne rendue
comme texte et une propriété de nœuds gérée par ce service. `text` est le
composant de texte enrichi : il applique `className`, `style` et `attr` par les
services, puis écrit son contenu HTML dans sa racine persistante. La propriété
de contenu du service `tag` et l'écriture HTML de `text` sont deux projections
distinctes. Les deux composants utilisent le module `replace-text` pour leurs
transitions, selon la [spécification texte](./replace-text-v2-spec.md).

Les services HTML testés appliquent les valeurs courantes de `className`,
`style`, `attr` et `content` à leur nœud. Ils retirent les valeurs gérées qui
disparaissent du nouvel état et gardent leur état géré isolé par nœud. Pour
`content`, une chaîne inchangée conserve son nœud texte ; un enfant élément est
remplacé par un nœud texte même si son texte visible est identique.

Le service `content` conserve, par nœud hôte, les références des nœuds qu'il a
produits ou explicitement reçus comme contenu. Une valeur `null` retire
uniquement ces nœuds lorsqu'ils appartiennent encore à cet hôte. Un hôte qui
n'a jamais reçu de contenu géré conserve donc ses enfants montés par le
materializer ; un nœud déplacé vers un autre parent n'est pas retiré par le
nettoyage de son ancien hôte. Une chaîne gérée inchangée garde son nœud texte
et les enfants montés indépendamment à côté de lui. Un remplacement explicite
par un autre texte ou élément garde la sémantique de remplacement du contenu.
L'état géré reste local au service et ne crée ni donnée auteur ni circuit de
placement supplémentaire.

La projection accepte aussi les méthodes focalisées d’une action via
[`htmlElementMethod`](./html-element-method-spec.md). Les valeurs de fermeture
`aria-hidden="true"` et `inert` sont validées après le focus de retour dans le
même passage synchrone du materializer HTML.

Le contexte de scène distingue `phase`, qui marque une capture géométrique
explicite, de `componentPhase`, qui relaie la phase de mise à jour du composant
à la projection. À la présentation finale d’un Seek, `componentPhase` vaut
`'seek'` tandis que `phase` n’est pas transformée en `geometry-capture` : le
chemin motion reçoit ainsi ses occurrences, et chaque projection peut filtrer
localement ses propres effets. Les étapes de reconstruction intermédiaires
restent des captures géométriques explicites.

[`HtmlComponentMaterializer`](../src/runtime/runner-html/component-materializer.ts)
projette le placement et l’ordre résolus sur les nœuds réels. Les tests
couvrent le montage, le réordonnancement et le détachement vers des cibles de
racine, d’outlet et de perso. Une ancre commentaire reçoit les enfants avant
elle, sans enveloppe ; tous les nœuds d’un fragment sont montés ou détachés
ensemble.

## Preuves

- [`facade.spec.ts`](../tests/facade/facade.spec.ts) vérifie l'enregistrement
  direct des définitions, leurs services et modules, l'override explicite et
  le verrouillage du catalogue avant l'exécution.
- [`base-component.spec.ts`](../tests/runtime/components/base-component.spec.ts)
  vérifie les deux frontières de base.
- [`runtime-component-runtime.spec.ts`](../tests/runtime/components/runtime-component-runtime.spec.ts)
  vérifie la persistance des instances, le teardown et l'échantillonnage de
  présentation sans nouvel update logique.
- [`scroll-container-player-integration.spec.ts`](../../authoring/component-v2/tests/scroll-container-player-integration.spec.ts)
  vérifie l’initialisation d’une source sur la racine matérialisée et ses
  frontières seek, fin de séquence, reset et teardown dans le runner réel.
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
  vérifie l’application et la réconciliation des services HTML, le nettoyage
  du seul contenu possédé, la conservation des enfants et le reparent d'un
  élément anciennement reçu comme contenu.
- [`tag-content-ownership.spec.ts`](../tests/runtime/runner-html/tag-content-ownership.spec.ts)
  traverse `SceneBuilder`, le player et le runner HTML avec une fixture
  autonome : identité des enfants après update du parent, reparent, Seek,
  resize, reset/replay et destruction.
- [`html-element-method.spec.ts`](../tests/runtime/runner-html/html-element-method.spec.ts)
  vérifie que les méthodes HTML restent inhibées pendant Seek même si cette
  phase est transmise séparément du contexte motion.
- [`html-component-materializer-scene.spec.ts`](../tests/runtime/player/html-component-materializer-scene.spec.ts)
  vérifie la projection de l’ordre, du parentage, des ancres et des fragments.
- [`mount-targets.spec.ts`](../tests/runtime/player/mount-targets.spec.ts)
  vérifie les identifiants opaques et le refus de doublons de cibles.

## Limites

Le chemin de matérialisation utilise directement le parseur DOM ; ce contrat
ne garantit pas une sanitation des templates. Le pont tiers, les composants
spécialisés, le DnD et la présentation FLIP relèvent de leurs spécifications
dédiées.
