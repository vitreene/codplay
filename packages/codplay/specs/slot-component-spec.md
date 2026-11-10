# CodPlay V2 — hôte de contenu foreign (`slot`)

> Version de référence : CodPlay V2 — 2026-11-10.

## Périmètre vérifié

Cette spécification décrit le profil `slot`, son manifeste, sa surface HTML,
ses profils `replace-slot` et le montage public entre instances.

## Rôle

`slot` est un composant core HTML qui fournit une racine hôte simple pour une
représentation foreign. Il peut recevoir une scène CodPlay, une iframe, un flux
vidéo ou tout autre contenu rendu par son propriétaire de représentation. Le
composant ne connaît ni la provenance ni la structure de ce contenu.

## Portée du contrat

Le composant fournit une boîte HTML hôte, accepte une représentation foreign
opaque et expose les services et la surface d'attachement définis ci-dessous.
La nature du contenu, le nombre d'instances qui le fournissent et la politique de
composition appartiennent au propriétaire de la représentation et à
l'application qui l'intègrent.

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
`style` et `attr` sont les données visuelles de la racine. Le composant
ne déclare pas le service `content` de `TagComponent` : `initial.content` est
une référence foreign opaque et sérialisable, validée sans interprétation.

Les valeurs foreign acceptées sont récursivement composées de chaînes, nombres
finis, booléens, `null`, tableaux et objets simples. Elles ne peuvent contenir
ni nœud DOM, ni player, ni fonction.

## Découverte d'auteur

`slotManifest(scene, { storyId? })` parcourt un `SceneDoc` ou un `CompiledScene`
et retourne, dans l'ordre des déclarations, le nom, la story, le `perso.id` et
le chemin `stories.<story>.persos[<index>].name`. Si le slot possède un profil
`initial.replace` valide, l'entrée conserve aussi sa transition, sa durée, sa
forme de masque, `split` et les réglages de grille. Sighty s'en sert comme profil
de repli lorsqu'une vue entrante ne déclare pas `replace`. La découverte ne
démarre pas de player et ne lit pas le DOM.

La découverte du manifeste et la normalisation runtime partagent le même
parseur de profil explicite. Le manifeste conserve uniquement les champs
déclarés ; le runtime ajoute ensuite les valeurs par défaut de transition.

`resolveSlotManifestEntry(manifest, slot, { sceneId?, storyId?, referencePath? })`
exige une correspondance exacte. Il retourne une entrée unique ou un diagnostic
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

La surface `foreignContent` ne crée, ne démarre, ne met en pause, ne seek ni ne
détruit une instance foreign. Lorsqu'il s'agit d'une scène CodPlay enfant,
Sighty décide de son cycle de vie et ordonne les opérations publiques
correspondantes ; `slot` ne fait qu'exposer sa boîte et gérer la relation
d'attachement. Un détachement ne vaut donc pas, à lui seul, une destruction de
l'instance enfant.

Le conteneur, `hostRoot` et les racines foreign doivent coordonner leurs règles
CSS selon les choix de l'application auteur. Le composant core n'impose aucune
couleur, dimension, ratio, débordement, alignement ou classe de présentation.

## Surface publique interinstances

Le montage public expose une scène enfant par la
façade d'instances, sans publier de nœud DOM :

```ts
const mount = codplay.instances.mount({
  host: { instanceId: 'layout-1', storyId: 'main', persoId: 'body-host' },
  childInstanceId: 'child-1',
})

mount.detach()
```

`host` est une adresse logique complète. CodPlay résout le composant `slot`,
demande au player enfant ses racines matérialisées de premier niveau et les
attache directement via `ForeignContentSurface`. Si aucune racine n'est fournie
à `instances.create`, CodPlay possède un conteneur interne détaché pour la
matérialisation ; ce conteneur n'est jamais exposé ni inséré dans le `slot`.
Les racines rendues restent possédées par l'enfant ; `mount` ne crée pas
d'enveloppe supplémentaire, ne démarre, ne met en pause, ne seek ni ne détruit
aucune instance.

Pendant le montage, `hostRoot` devient la racine effective de la scène enfant :
CodPlay y résout ses cibles `@root` et y rattache le fallback du présentateur
motion lorsqu'une scène multi-racines n'a pas de conteneur story unique. Au
détachement, CodPlay restaure la racine fournie à `instances.create`, ou son
conteneur détaché interne si aucune racine n'avait été fournie. Le slot reste
ainsi la cible de projection dans la même scène, sans créer de seconde cible ni
modifier la scène auteur.

Le handle `detach` est idempotent. Une relation active est limitée à une
adresse d'hôte et à une instance enfant ; une seconde relation concurrente est
rejetée par diagnostic. La destruction de l'une des deux instances détache la
relation avant son teardown, sans détruire l'autre instance. Les règles de
remontage automatique et d'orchestration Sighty ne sont pas définies par ce
contrat de montage.

## Propriété du montage

Le runner et le matérialiseur CodPlay possèdent les racines rendues et leur
insertion dans un slot. L'application adresse la relation par
`instances.mount`, puis conserve la décision de créer, piloter ou détruire
les occurrences. Le montage réutilise directement les racines matérialisées ;
il n'introduit pas d'enveloppe d'application entre l'enfant et son host.
Le HTML statique de la page et ses contrôles appartiennent à l'application.

## Limites actuelles

- Le module `replace-slot` gère les vues du `slot`. Les capacités distinctes
  `replace-text` et `replace-media` et leurs limites vérifiées sont décrites
  dans les spécifications de [texte](./replace-text-v2-spec.md) et de
  [média](./replace-media-v2-spec.md), tandis que le circuit partagé est décrit
  dans la [spécification de présentation replace](./replace-presentation-v2-spec.md).
- Les valeurs historiques `replace.split: 'letter' | 'word' | 'line'` restent
  acceptées puis ignorées ; `replace.split: 'cells'` active la grille SVG de
  masque décrite dans la section replace.
- La surface est disponible dans le runtime HTML interne et la façade
  `codplay.instances.mount` l'exerce pour les racines matérialisées directes
  d'un enfant, sans enveloppe de montage. Le composant ne pilote pas le cycle
  de vie des scènes ; ce pilotage appartient au propriétaire des instances.
- Le code qui possède la représentation foreign conserve ses racines, ses
  ressources et son chargement. Dans la V2 actuelle, ce code n'est pas une
  classe core d'adaptation : c'est le propriétaire ou fournisseur de la
  représentation, qui consomme la surface `foreignContent` lorsqu'un raccord
  d'application est fourni. Il ne décide pas du clone de transition.
  Pour une scène CodPlay, Sighty possède la décision de créer, piloter,
  démonter ou détruire l'occurrence ; le player CodPlay en exécute les
  opérations.
- Les vues clonées par `replace-slot` sont des instantanés DOM temporaires,
  possédés par la surface HTML et détruits à la fin ou à l'annulation de la
  transition. Un calque transitoire les clippe au rectangle courant du `slot` ;
  il ne modifie ni les racines montées ni la préparation de scène. Ces copies
  ne chargent, ne pilotent et ne détruisent aucun contenu foreign.
- Cet instantané est une présentation DOM temporaire ; il ne définit pas la
  représentation ni le cycle de vie du contenu foreign.

## Raccord V2 de `replace-slot`

Le catalogue core déclare `replace-slot` comme module requis par le type `slot`.
Le runtime composant appelle les hooks `beforeComponentUpdate` et
`afterComponentUpdate` autour de `component.update()`. Le module capture la vue
sortante, laisse le composant appliquer son nouvel état, capture la vue entrante
et enregistre les transitions d'actions dans la timeline du player.

Pour `codplay.instances.mount({ replace })`, le demandeur choisit la relation,
le profil et le moment du montage. La façade CodPlay exécute cette relation ;
le module `replace-slot` ne décide pas du cycle de vie de l'instance. Il crée
les vues sortante et entrante autour du rattachement explicite, puis échantillonne
la présentation avec le temps d'opération cumulé à partir des frames du
`TimeTicker` partagé. Ce n'est pas une horloge locale : sans frame la transition
reste figée. Elle peut progresser si le player hôte est en pause et qu'un autre
player maintient le ticker actif. Un `seek`, un reset ou un replay du player
hôte ne recale ni n'annule cette progression. Un nouveau remplacement, une mise
à jour normale qui change le contenu du slot, un détachement ou la destruction
d'une instance nettoie la présentation active. Un refresh géométrique conserve
la session et recale le calque sur le nouveau rectangle. Les transitions
d'actions du slot restent, elles, reconstruites par seek à partir de la timeline.
Les propriétaires des présentations et leurs deux horloges sont détaillés dans
la [spécification de présentation replace](./replace-presentation-v2-spec.md).

La surface ne modifie pas `foreignContent`. Les vues temporaires sont des
instantanés du DOM ; leurs identifiants et handlers inline sont supprimés.
Elles sont placées dans un calque transitoire, limité au rectangle mesuré du
`slot` et repositionné à chaque échantillon pour suivre son redimensionnement.
Le calque et les vues sont retirés à la fin ou à l'annulation ; la racine
persistante redevient visible avec l'état logique courant. Les ressources
foreign non clonables gardent leur limite connue.

Les profils et leurs valeurs par défaut sont :

| Profil | Effet dans le rectangle du slot | Durée par défaut |
|---|---|---:|
| `fade` | Les vues sortante et entrante passent simultanément de visible à masquée et inversement. | 300 ms |
| `fade-in` | La vue sortante reste visible ; l'entrante apparaît progressivement. | 300 ms |
| `mask-reveal` | Révèle l'entrante avec un masque centré. Formes `circle` (défaut), `star`, `diamond`, ou chemin SVG `{ path, viewBox }`. Avec `split: 'cells'`, le masque se répète sur une grille. | 900 ms |
| `curtain` | La sortante glisse vers le haut ; l'entrante remonte depuis le bas. | 1000 ms |
| `wipe` | L'entrante fixe est révélée du bord droit vers la gauche ; la sortante se décale légèrement vers la gauche. | 900 ms |
| `slide-over` | L'entrante remonte par-dessus la sortante, qui recule et s'assombrit. | 1100 ms |
| `stack` | La sortante recule et s'assombrit ; l'entrante remonte comme un panneau, puis s'efface pour exposer la racine persistante. | 2000 ms |

Une durée auteur remplace la valeur par défaut via `duration`, en
millisecondes. Sans grille, `shape` s'emploie avec `mask-reveal`. Avec
`split: 'cells'`, il décrit la forme répétée par le masque SVG pour les profils
slot. La déclaration personnalisée `path` est intégrée dans un masque alpha
SVG ; `viewBox` fournit les quatre valeurs numériques de son repère.

```ts
replace: {
  transition: 'mask-reveal',
  shape: { path: 'M50 0 L100 100 L0 100 Z', viewBox: '0 0 100 100' },
  duration: 900,
}
```

`replace.split: 'cells'` anime une seule grille SVG sur la vue sortante clonée,
au-dessus de la scène entrante persistante et non masquée. Les cellules
gardent leur position ; seule la forme est transformée. Ce circuit réutilise
la même session, le même échantillonnage et les mêmes règles source-cible que
`replace-media.split: 'cells'`, sans clone média ni canvas par cellule.
`mask-reveal` utilise le cercle si aucune forme n'est fournie ; les autres
profils utilisent des rectangles si aucune forme n'est fournie.

`cellSize` est un pourcentage responsive de la largeur mesurée du slot et prime
sur `cellX`/`cellY`. Sans `cellSize`, deux axes fixent les comptes exacts ; si
un seul axe est donné, l'autre est déduit du ratio du slot ; sans dimensions,
la grille vaut 4 × 3. `staggerPattern` choisit `manhattan`, `row-wave` ou
`column-wave`. Omettre le pattern revient à `manhattan`, où `direction` choisit
l'origine spatiale et `stagger` l'enveloppe des départs. `row-wave` lance
individuellement les cellules de gauche à droite rangée après rangée ;
`column-wave` les lance de haut en bas colonne après colonne. Ces vagues excluent
`direction`. La durée effective inclut l'enveloppe complète. Un resize recalcule
les cellules en gardant la progression courante.
Les anciennes valeurs `letter`, `word` et `line` restent des champs inertes
pour `replace-slot`.

Les profils `curtain`, `wipe`, `slide-over` et `stack` reprennent les durées
Interlude retenues pour ces effets. Leur usage de `split: 'cells'` ne découpe
pas le contenu opaque : il répète le masque sur la grille.

Dans ce contrat, une « session » est l'état runtime temporaire qui relie les
vues d'une transition, son horloge et son nettoyage. Ce n'est ni un perso, ni
une story, ni une donnée d'auteur.

Une seule session de présentation `replace-slot` peut être active pour un hôte
à un instant donné. Si un nouveau remplacement intervient avant la fin du
précédent, le runtime annule et nettoie d'abord cette session, puis capture la
présentation courante comme vue sortante du nouveau remplacement. Les sessions
ne se superposent donc pas.

Pour `slot`, `replace.split: 'cells'` active la grille de masque décrite ci-dessus.
Les valeurs historiques `letter`, `word` et `line` restent acceptées sans
diagnostic, conservées dans la déclaration compilée et sans effet sur le contenu
opaque.

## Preuves du contrat

- [`slot-component.spec.ts`](../tests/runtime/components/slot-component.spec.ts)
  couvre le nom racine, le défaut `div`, l'absence de service textuel,
  l'attachement/détachement multi-racines et les réglages de grille.
- [`slot-manifest.spec.ts`](../tests/scene/authoring/slot-manifest.spec.ts)
  couvre la découverte, les noms absents ou ambigus, les sept profils et la
  conservation des options de masque, grille et propagation.
- [`replace-module.spec.ts`](../tests/runtime/capabilities/replace-module.spec.ts)
  traverse le builder, le player et le matérialiseur pour la grille responsive,
  le masque source unique, le reflow et le nettoyage à la fin ou au Seek.
- [`replace-presentation-surface.spec.ts`](../tests/runtime/runner-html/replace-presentation-surface.spec.ts)
  couvre les profils, le masque personnalisé et le calque borné au slot.
- [`foreign-mount.spec.ts`](../tests/facade/foreign-mount.spec.ts) vérifie le
  montage logique, les racines directes, le Seek indépendant, le détachement
  idempotent, le teardown, le montage répété et la restauration du root.
  Les captures motion compilées/live utilisent le hostRoot de l'enfant
  multi-racines. Les transitions de montage conservent leur temps d'opération
  pendant le Seek et le reset de l'hôte.
- [`motion-container.spec.ts`](../tests/runtime/runner-html/motion-container.spec.ts)
  vérifie le rebinding des identités de conteneur capturées.
- Les tests consommateurs
  [`replace-presentation.spec.ts`](../../sighty/tests/replace-presentation.spec.ts)
  et [`sighty-demo4.spec.ts`](../tests/facade/sighty-demo4.spec.ts) exercent la
  sélection de profil et le montage/démontage indépendant des scènes enfants.
