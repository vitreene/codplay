# CodPlay V2 — hôte de contenu foreign (`slot`)

## Périmètre vérifié

Cette spécification décrit la tranche vérifiée du profil `slot` : manifeste,
surface HTML, profils `replace-slot`, première surface publique de montage et
fixture Sighty A/B. Le suivi des décisions d'extension est dans le
[plan foreign](../plan/foreign-scene-component-plan.md).

## Rôle

`slot` est un composant core HTML qui fournit une racine hôte simple pour une
représentation foreign. Il peut recevoir une scène CodPlay, une iframe, un flux
vidéo ou tout autre contenu rendu par son propriétaire de représentation. Le
composant ne connaît ni la provenance ni la structure de ce contenu.

## Portée du contrat

Cette spécification décrit le besoin générique du composant `slot`, sans le
déduire d'un orchestrateur ni d'une démonstration particulière. Le composant
doit fournir une boîte HTML hôte, accepter une représentation foreign opaque et
exposer les services et la surface d'attachement définis ci-dessous. La nature
du contenu, le nombre d'instances qui le fournissent et la politique de
composition appartiennent au propriétaire de la représentation et à
l'application qui l'intègrent.

Le scénario A/B de la première démonstration Sighty est décrit séparément dans
la [note du modèle déclaratif Sighty](../../sighty/notes/2026-08-17-modele-fichier-declaratif.md).
La reconstruction actuelle de la navigation Sighty est suivie dans le
[plan de référence Sighty](../../sighty/plan/2026-09-15-sighty-navigation-reconstruction-plan.md).
Ce scénario constitue un parcours consommateur et une preuve d'intégration du composant,
pas son expression de besoin. Ses deux zones, ses trois scènes, ses choix
visuels et son orchestration ne deviennent donc pas des contraintes
intrinsèques du profil `slot`. Le même contrat doit rester utilisable pour une
iframe, un média, un flux ou une autre représentation foreign.

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

## Première surface publique interinstances

La première tentative de raccord CodPlay expose une scène enfant par la
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
remontage automatique et d'intégration Sighty restent hors de cette tentative.

## Interdiction de fabrication HTML par Sighty

Le runtime Sighty qui décrit et orchestre une composition ne fabrique pas le
DOM de ses scènes. Il lui est interdit de créer une racine enfant, une
enveloppe de montage ou un wrapper avec `document.createElement`, `innerHTML`,
`appendChild` ou une primitive équivalente, et de déplacer lui-même une racine
dans un `slot`. Il lui est également interdit de rechercher le `slot` par
inspection du DOM pour contourner l'adressage logique.

La racine du `slot`, les racines matérialisées des scènes et leur insertion
appartiennent au runner/materializer HTML CodPlay. `instances.mount` réaffecte
si nécessaire les cibles racines du player enfant, puis attache directement
ses racines matérialisées dans l'hôte. Une classe ou un élément tel que
`sighty-child-root`, ajouté uniquement pour rendre ce raccord possible, est
donc interdit. Le HTML statique de la page et ses contrôles de démonstration
restent du ressort de la page de démo ; ils ne constituent pas la composition
des scènes ni un substitut au materializer.

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

## Validation effectuée

Le test `tests/runtime/components/slot-component.spec.ts` couvre le nom racine,
le défaut `div`, l'absence de service textuel, l'attachement/détachement de
plusieurs racines, l'acceptation des réglages de grille et le rejet d'une taille
invalide. Le test
`tests/scene/authoring/slot-manifest.spec.ts` couvre la découverte, l'absence et
la collision de noms, ainsi que la conservation des sept profils, d'une forme de
masque personnalisée et les réglages `cellSize`/`direction`/`stagger`/
`staggerPattern`. Le test
`tests/runtime/capabilities/replace-module.spec.ts` traverse le player pour le
masque source unique, la grille responsive, le reflow pendant la transition et
le retrait du clone et du masque. La fixture Sighty
`packages/sighty/tests/replace-presentation.spec.ts` couvre aussi le profil de
page entrante à travers `instances.mount({ replace })`. Les validations ciblées
des modules, de la surface HTML, du montage public et du consommateur Sighty
passent avec le typecheck CodPlay et celui des démos V2.

Le test `tests/runtime/capabilities/replace-module.spec.ts` exerce le chemin
réel `SceneBuilder → RuntimePlayer → hooks V2 → HtmlComponentMaterializer` :
les vues restent séparées du contenu `foreignContent`, sont échantillonnées par
la timeline et nettoyées à la fin ou au seek. Le test
`tests/runtime/runner-html/replace-presentation-surface.spec.ts` couvre les
cinq profils visuels, le masque personnalisé et le calque qui borne les vues au
slot.

Le test `tests/facade/foreign-mount.spec.ts` exerce la première surface publique
avec deux instances CodPlay réelles : adressage du `slot`, insertion directe de
la racine matérialisée enfant, seek indépendant, détachement idempotent et
nettoyage lors de la destruction de l'enfant. Il vérifie aussi qu'une scène
multi-racines créée sans `root` utilise le `hostRoot` pour ses captures motion
compilées et live, que l'overlay est retiré au détachement et que le montage
peut être répété. Une instance créée avec un `root` explicite retrouve cette
racine après détachement et remontage. `tests/runtime/runner-html/motion-container.spec.ts`
vérifie le rebinding des identités de conteneur capturées.
Le test de montage vérifie également `mask-reveal` et `stack` avec un
remplacement externe dont l'horloge continue pendant le seek et le reset de
l'hôte.

Le test `tests/facade/sighty-demo4.spec.ts` exerce la fixture Sighty A/B avec un
layout et deux instances enfants réelles : résolution des noms `A` et `B` par le
manifeste, montage des deux racines et démontage/remontage indépendant de A.
Cette fixture est une preuve consommateur séparée du contrat générique `slot` ;
elle ne fixe ni politique de fin de scène ni support foreign multi-racines.

Une validation navigateur Brave a exercé la surface publique `instances.mount`
avec `curtain` et rendu simultanément les cinq profils dans des slots dont les
parents laissaient déborder leur contenu. Le calque clippe les glissements au
slot et son rectangle suit le redimensionnement.

La suite CodPlay complète reste à accepter : cinq assertions FLIP échouent dans
`tests/facade/facade.spec.ts` et `tests/facade/flip-stress-motion.spec.ts`. Les
mêmes assertions échouent sur l'état de référence, avant cette tranche ; elles
restent suivies dans le plan sans être attribuées à `replace-slot`.
