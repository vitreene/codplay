# Acceptation de `CompiledScene`

> Statut : **En cours**. La forme de scène, le build structurel et la
> frontière JSON sont décrits par leurs spécifications. Ce plan conserve les
> comportements restant à décider ou à certifier.

## Autorité

Les contrats vérifiés sont dans la [spécification auteur de scène](../specs/scene-authoring-spec.md),
la [spécification du codec JSON](../specs/compiled-codec-v2-spec.md), la
[spécification de reconstruction logique](../specs/runtime-reconstruction-v2-spec.md)
et les spécifications des capacités concernées. Ces documents déterminent
l'interprétation de leurs comportements ; ce plan ne les redéfinit pas.

Le chemin de build actuel utilise le snapshot de validation du catalogue,
normalise le document et produit un `CompiledScene` immuable avec ses
requirements et index dérivés. Les fonctions auteur restent dans la collection
séparée du résultat de build. Les plans spécialisés gardent les décisions
relatives aux payloads des features.

Le contexte de conception sur la normalisation, le snapshot du catalogue et la
séparation des frontières est conservé dans la
[note de cohérence](./notes/2026-07-31-scene-coherence-boundaries.md). Cette
note n'est pas normative ; les spécifications et les gates ci-dessous font foi.

## Décisions et preuves

### Index dérivés et actions vivantes — analyse du 2026-10-19

> Proposition : **A relire**. Analyse demandée par l'utilisateur ; aucune
> suppression ni modification runtime effectuée ou autorisée par cette analyse.
> Les spécifications actuelles restent applicables jusqu'à une évolution
> implémentée et vérifiée selon un plan accepté.

#### Constats et propriétaires

Les deux champs sont entièrement dérivables depuis les déclarations compilées.
Ils n'énumèrent ni les événements futurs ni les valeurs futures des actions :

| Champ | Donnée source | Consommateurs recensés |
|---|---|---|
| `actionTargetIndex` | Clés de chaque `perso.actions`, y compris l'auto-référence `null` | Construction des cibles d'actions live, validation de l'unicité d'une `observe.liveAction`, fonction `compileMotionSchedule`, codec et validation de cohérence |
| `storyActivationIndex` | Positions des règles `story.listen` avec `active === true` | Construction de la map d'activation du dispatcher, codec et validation de cohérence |

`actionTargetIndex` est une recension systématique de toutes les associations
nom d'action/perso des stories conservées au build. Sa dérivation ne consulte
ni les straps ni les eventimes pour sélectionner les noms réellement utilisés.
Elle inclut donc les abonnements qui ne recevront jamais d'événement. Les
« targets » de cet index sont les persos abonnés, pas les cibles de placement
`move.target`. Pour un nom donné, la liste comporte de zéro à autant de persos
déclarants que la scène en contient ; les occurrences runtime ne sont pas
énumérées. Le volume de l'index est proportionnel au nombre total de ces
associations, puis celles-ci sont reprises dans la map du contrôleur live.
Le risque identifié est cette matérialisation exhaustive et redondante du
routage `1 -> n`, sans borne contractuelle de cardinalité, même pour des noms
jamais sollicités. Aucun coût mesuré ni expansion infinie n'est établi ici.

Le [builder](../src/scene/compiled/scene-builder.ts) les produit aussi sans
l'option d'export. Dans le parcours V2 auteur, le
[layout partagé](../../demos/src/v2/layout/layout.ts) appelle `build()` avant
`instances.create()` : l'absence des champs dans `SceneDoc` ne signifie donc
pas que ce parcours les évite. Le paquet JSON n'est pas un second runtime.

Le circuit normal [materialize](../src/runtime/player/pipeline/materialize.ts)
résout déjà `perso.actions[event.name]` sans `actionTargetIndex`.
Le [résolveur commun](../src/runtime/player/pipeline/action-resolution.ts)
conserve le payload runtime : une déclaration `null`/`true` permet de prendre
`event.data` comme action ; un objet est fusionné avec ces données. L'index
n'établit donc pas une fermeture sur les valeurs runtime possibles.

Le [dispatcher](../src/runtime/player/pipeline/runtime-event-dispatcher.ts)
indexe déjà toutes les règles `listen` par nom. Il reconstruit en plus une map
d'activation depuis `storyActivationIndex`, avec un parcours de `listen` en
l'absence d'index et un second parcours inconditionnel de ces règles. Le codec
refuse pourtant l'absence de l'index dès qu'une activation est déclarée.

Le [contrôleur live](../src/runtime/player/live-actions/live-action-controller.ts)
transforme l'index sérialisé en une seconde map portant les valeurs déclarées.
La [validation de scroll](../src/scene/compiled/semantic-validator.ts) s'en sert
pour vérifier que le nom d'une action d'observation appartient au seul perso
observé. Cette contrainte doit subsister si le champ disparaît.

La fonction exportée
[`compileMotionSchedule`](../src/runtime/motion/motion-schedule.ts) utilise
`actionTargetIndex` pour les faits du journal, mais ses seuls appels recensés
dans le dépôt sont ses tests. Le runner HTML consomme les occurrences issues
de la matérialisation canonique dans son
[contrôleur motion](../src/runtime/runner-html/player-runner/motion-controller.ts),
conformément à la [spécification motion](../specs/motion-frame-v2-spec.md).
Le statut de cette fonction exportée reste à décider ; ce constat ne suffit
pas à autoriser sa suppression ni à conclure sur d'éventuels usages externes.

La V1 possède elle aussi un `CompiledScene`, sans ces deux index. Son
[dispatch](../../codplay-v1/src/core/events/dispatch.ts) cherche les clés dans
les listeners ; son
[player capture](../../codplay-v1/src/player/create-player.ts) recherche les
persos déclarant le nom parmi les stories montées. Son
[contrat capture](../../../docs/formalisation/v1-capture-spec.md) décrit ce
routage ouvert par nom. Les frontières de montage V1 ne doivent pas être
transposées en un nouveau filtre V2 sans décision : les contrats V2 de portée,
d'isolation et de capture restent les références.

#### Proposition de suppression, à valider

1. Retirer les deux champs du builder, du type et de la frontière JSON, ainsi
   que les validations destinées seulement à comparer ces copies à leur source.
   Décider la version du schéma et le sort des artefacts déjà produits ; le
   codec actuel exige `actionTargetIndex` et l'index des activations déclarées.
2. Pour l'activation, utiliser les règles story déjà sélectionnées par le
   dispatcher et y rechercher `active === true` avant le filtre d'éligibilité.
   Supprimer la map d'activation distincte ; conserver le refus des doublons,
   la priorité story/scène, le réveil ciblé et l'atomicité activation/reset.
3. Dans le contrôleur live existant, résoudre les destinataires depuis les
   déclarations `perso.actions` au traitement des sorties de source, sans
   reconstruire un catalogue global d'actions. Conserver l'ordre des actions
   et des destinataires, le fan-out actuel et le même circuit de résolution
   et d'update des composants. Mesurer le coût si cette recherche devient
   significative pour les sources continues ; aucun besoin de cache n'a été
   établi par cette analyse.
4. Vérifier l'unicité d'une `observe.liveAction` depuis les déclarations lors
   de la validation, sans transporter cet index dans l'artefact. Décider le
   devenir de `compileMotionSchedule` sans réintroduire un second circuit de
   découverte motion ou un scan général du journal dans le runner.

**Décision distincte encore ouverte : sémantique des actions vivantes.**
Le plan signalait déjà le couplage qui emploie les valeurs déclarées de
`perso.actions` comme commandes live. Les spécifications actuelles de
[capture](../specs/capture-v2-spec.md) et de
[scroll](../specs/scroll-container-spec.md) décrivent cet usage. Supprimer
l'index seul ne le supprime pas. Distinguer la suppression des données
redondantes, réalisable en préservant ce contrat, d'une éventuelle révision de
la relation entre abonnement par nom et valeur d'action appliquée. Cette
seconde évolution exige sa propre décision et ses preuves ; aucune nouvelle
forme de commande n'est proposée comme contrat par cette analyse.

#### Acceptation proposée

- Artefact issu de `build()` et round-trip JSON sans aucun des deux champs ;
  chargement du paquet exporté et exécution par le même player que le parcours
  auteur ; politique de schéma testée.
- Événements à payload runtime, auto-référence `null`, fan-out multi-perso et
  multi-story, ordre des actions live, retrait d'une source et restauration de
  l'état logique ; capture et observation empruntent les composants réels.
  Couvrir explicitement zéro, un et plusieurs destinataires pour un même nom,
  les noms émis par des straps et les abonnements jamais sollicités, sans
  exiger une liste préalable des destinations de ces émissions.
- Réveil d'une story inactive, refus des activations ambiguës, activation/reset
  atomique, désactivation idempotente, événements de scène et faits conservés
  dans le journal ; mêmes frontières par Play et Seek.
- Motion par occurrence sur événements statiques et runtime, Seek/replay,
  `persist-only`, reset, parent/enfant et reparent ; absence de recours à un
  catalogue de mouvements futurs. Couvrir resize et lifecycle des sources et
  composants, puis typechecks, suites concernées, build et parcours navigateur.
- Après application et vérification seulement, mettre à jour les specs scène,
  codec, isolation, capture et scroll et leurs preuves. Coordonner les gates
  ouvertes avec les plans isolation et motion, sans les déclarer closes ici.

État initial contrôlé le 2026-10-19 : six suites existantes (`scene-builder`,
`codec`, `pipeline`, `story-isolation`, `runtime-capture-player`,
`motion-schedule`), **100 tests réussis**. Cette preuve porte sur le
comportement actuel, pas sur la suppression proposée ; aucune validation
navigateur de cette proposition n'a été effectuée.

Toute application reste hors du travail d'export en cours, soumise à un plan
accepté et à l'autorisation explicite de modification du cœur.

### CSS associé à une scène

Contrat éditeur vérifié : une ressource peut porter `{ sceneDoc, styleSheet }`.
`styleSheet` est du texte CSS associé, pas un champ de `SceneDoc`. Le bridge
éditeur le transmet à `preload.css.set()` ; le service applique `@scope` et
retire le slot à la destruction. Aucun champ `SceneDoc` parallèle n'est
nécessaire. Le contrat éditeur reste décrit par
[`build-scene.ts`](../../editor/src/builder-v2/build-scene.ts),
[`scene-player-bridge.ts`](../../editor/src/app/bridges/scene-player-bridge.ts)
et les suites de Sighty.

### Fermeture CSS de l'export

**Paquetage CSS associé et importé : vérifié.** Le CLI capture l'export nommé
`styleSheet` et les imports `.css`, développe les imports locaux et les
`url()` dans les fichiers CSS, expose les classNames trouvés et remet les
dépendances au paquetage. Les noms, sélecteurs, règles et valeurs de scène ne
sont pas renommés. La copie exportée ne change que les URL nécessaires à la
relocalisation. `CodPlay.load()` remet les dépendances au preload existant,
installe le CSS dans le `head` sous le scope de `root` et retire le slot avec
l'instance. Les preuves sont dans la
[spécification du paquet de diffusion](../specs/scene-package-export-v1-spec.md).

Les `url()` image des valeurs `style` de la scène sont des références de build
export : le builder fournit leurs chemins d'occurrence et le paquetage réécrit
seulement la copie compilée. Les valeurs source restent disponibles au moteur
CodPlay.

**Export diffusion V1 :** les valeurs `style` restent dans le `CompiledScene`
pour le moteur ; elles ne sont pas converties en classes CSS. Le paquetage
relocalise uniquement les URL locales remontées par le builder dans la copie
de diffusion. Cette règle préserve la cascade inline et les `className`
temporels. Le détail d'exécution est suivi au
[plan d'export](./2026-10-15-export-diffusion-plan.md#r5--css-associé-importé-et-incorporé).

### Références média du paquet de diffusion

Pour l'export, la compilation possède la fermeture des références présentes
dans les données de scène. `CodPlay.build(input, { export: true })` prolonge
le dérivateur des ressources et retourne leurs chemins compilés dans
`resourceReferences`, hors JSON `CompiledScene`. Le paquetage consomme ces
chemins ; il ne parcourt pas la scène pour en découvrir d'autres. Le mode auteur
`build(input)` garde sa dérivation ordinaire.

#### Tranche média — sources de `img`, `media`, `tag` et styles inline

**Statut : implémentée et vérifiée pour les images/audio/vidéo et les images CSS des styles inline.** Le build
export reconnaît `img.src`, `img.img.attr.src`, `media.src` et les sources
`tag.attr.src` des balises natives `img`, `audio`, `video` et `source`, dans
l'état initial, les actions directes et leurs étapes statiques. Les types
incompatibles, extensions ou adresses hors périmètre, sources `poster`/`srcset`,
références de ressources dans `layout.markup` et ressources natives non prises
en charge donnent des diagnostics contextualisés bloquants.

Les références et leur ordre proviennent du même compilé que le runtime. Elles
ne modifient ni la scène auteur ni le schéma JSON. Le paquetage copie les
fichiers locaux et relocalise uniquement ces chemins sur une copie du compilé.
Le chargeur réutilise les circuits CodPlay existants de préparation et preload.
Les preuves ciblées sont dans la
[spécification de paquet média](../specs/scene-package-export-v1-spec.md) et
ses suites `scene-builder`, `scene-package-loader`, `resource-packager` et
`cli`.

La compilation des feuilles CSS et de leurs dépendances locales est traitée par
la fermeture de paquet décrite ci-dessus. Pour l'export V1, les styles de scène
ne sont pas convertis en classes ; la disponibilité effective des fontes est
suivie au plan d'export.

### Sémantique de `SceneDoc.defaults`

La propriété apparaît dans le type auteur, la normalisation et la donnée
compilée, mais aucun test ne certifie de règle qui l'applique et aucun
consommateur n'a été trouvé dans `packages/codplay/src`. Elle n'est donc pas un
mécanisme de defaults certifié par les specs.

Décider si cette propriété a un rôle V2. Si elle est conservée, préciser les
champs auxquels elle s'applique et sa priorité par rapport aux valeurs
explicites, aux actions déjà résolubles et aux defaults des composants/services.
La hiérarchie envisagée dans les versions précédentes de ce plan n'est pas un
contrat. Aucun code ne doit l'interpréter avant la décision et son parcours
d'acceptation.

### Manifeste `rootNodeIds` et montage page-level

L'implémentation actuelle dérive des candidats de racine depuis les placements
`@root` de `initial` et des actions, puis le runner crée des cibles de racine
par story contenant un candidat. Ce comportement n'est pas encore fixé par une
spécification ni directement asserti dans les tests du runner. Le builder
possède un test de fixture qui attend `['quiz-layout']` ; les tests de pipeline couvrent la
résolution temporelle des placements, mais aucun test du runner ne couvre
directement l'interprétation de `rootNodeIds`.

Parcours restant :

1. Tester la dérivation en ordre de déclaration, avec placements de racine dans
   `initial`, dans une action seulement, et avec plusieurs candidats.
2. Tester dans le runner réel l'attachement, le détachement et le réattachement
   à `@root` / `@off` aux frontières temporelles, puis par Seek avant et après
   ces frontières.
3. Vérifier l'ordre de plusieurs racines et l'unique propriétaire du montage
   page-level, sans seconde insertion par une façade.
4. Après ces preuves, fixer dans une spécification dédiée ou dans celle de
   reconstruction le sens exact de `rootNodeIds` et son raccord au montage
   HTML ; mettre à jour l'index général.

La règle envisagée est que la liste ordonnée unique nomme les persos qui
peuvent atteindre la racine par un placement auteur. Cette lecture reste une
hypothèse jusqu'à l'acceptation ci-dessus ; elle ne remplace pas l'état de
placement résolu au temps demandé.

## Critères de clôture

- La décision sur `SceneDoc.defaults` est explicite : propriété définie et
  testée, ou rôle écarté de la tranche V2.
- La profondeur de découverte des sources auteur est décidée et testée ; le
  commentaire du helper et la spécification décrivent le même comportement.
- La dérivation du manifeste et son interprétation au runner sont testées sur
  les placements initiaux et temporels.
- Le montage page-level, son ordre et ses transitions Play/Seek ont une preuve
  d'intégration réelle.
- Les specs décrivent uniquement les comportements certifiés et le présent
  plan ne garde ensuite aucun travail ; retirer le plan à ce moment-là.

Une modification du cœur demeure soumise à un plan accepté et à l'autorisation
explicite requise par les règles du dépôt.
