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

### Catalogue des actions — suppression décidée le 2026-10-19

> Direction : **Fixe**. Application future : **non commencée**.

L'utilisateur a confirmé la suppression de `actionTargetIndex` et de ses
références, avec maintien du principe existant de découverte des actions.
Le [plan de découverte des actions](./action-discovery-plan.md) possède
l'application : inventaire, invariants, décisions de format et de motion,
tranches, acceptation et mise à jour des spécifications après vérification.
Il remplace la proposition antérieure portant sur ce catalogue. Aucun code
runtime n'a été modifié par le travail de planification.

Ce plan couvre aussi la copie globale construite par le contrôleur live et
interdit de reconstituer le catalogue sous un autre nom. La relation `1 -> n`
reste ouverte, y compris zéro destinataire. Les specs actuelles décrivent
encore l'implémentation avec index ; elles seront actualisées à l'acceptation.
La sémantique actuelle des valeurs d'actions live est conservée pour cette
suppression ; sa révision éventuelle constitue une décision distincte.

### Index d'activation des stories — proposition distincte

> Proposition : **A relire** ; aucune application engagée.

`storyActivationIndex` dérive des positions de `story.listen` où
`active === true`. Le dispatcher possède déjà les règles par nom et construit
aussi une map d'activation, complétée par un parcours des déclarations.
La [spécification d'isolation](../specs/story-isolation-spec.md) et le
[codec](../specs/compiled-codec-v2-spec.md) décrivent encore cet index.

La proposition consiste à consulter les règles story déjà sélectionnées pour
l'événement avant le filtre d'éligibilité, puis à retirer cet index et sa map
distincte. Préserver le refus des doublons, le réveil ciblé, la priorité des
règles story/scène et la transition atomique activation/reset. Décider le
format, puis vérifier journal, activation/désactivation, isolation, Play/Seek,
replay et lifecycle avec les gates du
[plan d'isolation](./story-isolation-plan.md). La décision sur le catalogue
des actions ne vaut pas validation de cette proposition d'activation.

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
- La suppression du catalogue des actions a passé les gates de son plan ;
  la proposition distincte sur l’index d’activation a été décidée et traitée.
- Les specs décrivent uniquement les comportements certifiés et le présent
  plan ne garde ensuite aucun travail ; retirer le plan à ce moment-là.

Une modification du cœur demeure soumise à un plan accepté et à l'autorisation
explicite requise par les règles du dépôt.
