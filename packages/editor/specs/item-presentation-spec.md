# Présentation des items Editor

## Identité et propriétaires

Le builder V2 produit un perso par item. Un chemin conserve le type natif
`tag`, `img` ou `media`, le parent et l’identité de cet item. Les capsules
conservent leur composant `list` et leur circuit de placement.

L’owner créé par `scene-player-bridge.ts` utilise `EDITOR_ENGINE_OPTIONS`.
Ses adaptations de composants délèguent le contenu, les images et les médias
aux classes natives et conservent leurs validateurs et modules. La surface
`media` publiée est celle du composant média natif. Les autres owners CodPlay
conservent leur catalogue.

Un composant item possède un cadre motion, une ancre privée et la racine du
composant natif. Ces parts appartiennent au même perso et au même état.
Les classes de placement restent sur le cadre ; les classes auteur restent
sur la représentation native. Les identifiants de cadre sont propres à chaque
instance, y compris pendant un rebuild avec deux scènes simultanément montées.
Le champ technique `editorFrameClassName` est exclu de la capture Decor auteur.

## Géométrie

Les longueurs auteur, les contrôles de palette et les données sauvegardées
restent en cqw. Le document et le snapshot logique conservent les coordonnées
et dimensions du contenu ; les mesures physiques restent dans la projection DOM. Le canal pose produit les translations ; le canal décor produit
les propriétés décoratives. Le builder ne compense pas une bordure par des
actions `x/y` supplémentaires.

`projectItemStyle` possède la conversion contenu/cadre. Il réutilise les
insets et la conversion affine communs de `motion-editor`, avec bordure et
padding. À la frontière CSS, il conserve séparément la bordure et le padding :
la bordure suit l’[arrondi CSS aux pixels physiques](https://www.w3.org/TR/css-values-4/#snap-a-length-as-a-border-width),
le padding conserve ses fractions. Les projections CSS responsive et numérique
partagent le même ratio de pixels de la fenêtre. Le CSS utilise `round` ; aucune
mesure d’item ni cache historique ne fournit les insets. Les services
HTML natifs formatent les styles de chaque part.

La taille de contenu courante est appliquée à la représentation native,
centrée dans le cadre motion. `move` conserve les dimensions et la pose de ses
frontières capturées. Une bordure animée sur 2 s et une pose sur 5 s gardent
ainsi leurs horloges et leurs responsabilités respectives.

Pour afficher le CS, le bridge combine la pose numérique publiée par CodPlay
avec les dimensions de contenu du même snapshot logique et les insets courants.
Il ne déduit pas ces dimensions de la taille interpolée du cadre motion.
Les endpoints auteur et leur indépendance aux visites sont décrits dans la
[spécification d’orientation](./path-tangent-orientation-spec.md).

## Présentation et preview

Le composant applique la géométrie auteur dans une règle CSS privée, formatée
par le service style natif. Le présentateur motion possède les contributions
inline du cadre. La libération de ces contributions lors d’une capture révèle
la règle auteur courante. Ce partage préserve aussi une pose motion identique
lors d’une nouvelle présentation logique.

La preview passe par `snapshot.set` sur l’unique perso. Le bridge transmet le
candidat affiché et, lorsqu’une pose motion est publiée, son inverse affine
calculé par ACE dans `--editor-item-preview-inverse`. Le composant exprime ce
candidat dans son ancre privée ; la contribution inline motion reste intacte.
Cette donnée est éphémère et absente de `snapshot.get()` et du document.
`snapshot.clear` rétablit le centrage normal et la pose publiée.

## Défaut du bloc texte

`assignType('text')` applique une seule fois le preset texte à `item.initialDecorId`.
Il centre le contenu horizontalement avec `text-align: center` et verticalement
avec `display: flex`, `align-items: center` et `justify-content: center`. Les
décors de keyframes restent clairsemés : ils héritent de ces valeurs initiales
et ne les recopient que si l’auteur les modifie. Une rotation de pose tourne le
bloc et son texte ensemble, sans changer leur centrage relatif.

Le preset utilise le circuit décor existant ; il ne crée pas de canal temporel
par propriété. Sa définition est dans
[`default-decor-presets.ts`](../src/app/commands/default-decor-presets.ts), son
application dans [`base-commands.ts`](../src/app/commands/base-commands.ts).
`base-commands.spec.ts` vérifie son application à la création, et le
[plan de layering](../plan/2026-07-17-decor-keyframe-layering-plan.md) consigne
sa validation Safari visible.

La coordination adopte la fin de lecture sans inspecter les chemins ni
traverser `durée − 2 ms`. Un dépassement lié à l’outro virtuelle conserve le
Seek existant vers la durée auteur. Les Stop répétés conservent leur garde.

## Preuves et portée

- [`item-component.spec.ts`](../tests/item-presentation/item-component.spec.ts) :
  état unique, horloges indépendantes, isolation entre owners et instances,
  identité des images après changement de source/reparent/Seek/reset,
  surface média native, rate, commandes et destruction.
- [`geometry.spec.ts`](../tests/motion-editor/geometry.spec.ts) et
  [`border-insets.spec.ts`](../tests/motion-editor/border-insets.spec.ts) :
  dimensions de contenu indépendantes du cadre, affine, pivot et unités mixtes.
- [`motion-path.spec.ts`](../tests/builder-v2/motion-path.spec.ts),
  [`player-interpolation.spec.ts`](../tests/builder-v2/player-interpolation.spec.ts)
  et [`decor-properties-stress.spec.ts`](../tests/builder-v2/decor-properties-stress.spec.ts) :
  builder et player réels, état complet et absence de translations décoratives.
- [`scene-player-bridge-v2.spec.ts`](../tests/scene-player-bridge-v2.spec.ts) :
  fin de lecture par le transport monté, absence de Seek compensateur,
  Seek terminal répété et Stop.
- [`decor-editor-bridge-v2.spec.ts`](../tests/decor-editor-bridge-v2.spec.ts) :
  exclusion du placement technique lors de la capture auteur.
- Safari MCP, 30 octobre 2026,
  [`item-presentation-fixture.ts`](../tests/browser/item-presentation-fixture.ts) :
  quatre scénarios avec/sans chemin et padding asymétrique ; pose 5 s,
  bordure 2 s, largeur de contenu 200 px à mi-parcours puis 160 px après resize
  de 800 à 640 px. Seek après détour, Play/Seek au même temps, preview et clear,
  absence d’écriture sur le transform motion pendant la preview, fin et Seek
  terminal identique, reset et destruction sont vérifiés. La lecture utilise
  le port public `engine.advance`.
- Safari MCP, fixture des ponts Editor : rotation, pivot, resize, bordure,
  déplacement, insertion, couleur, Undo/Redo, rechargement JSON et Stop répété.
  Aux viewports 1328 × 775, 1100 × 780 et 1024 × 775, les écarts item/CS
  et ghosts observés restent inférieurs à 0,59 px.

L’acceptation rAF naturelle dans Safari reste au
[plan d’acceptation](../plan/2026-10-30-editor-motion-responsibility-fix-plan.md).
