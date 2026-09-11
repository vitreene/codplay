# CodPlay V2 — hôte de contenu foreign (`slot`)

## Statut

> Status: En cours — profil auteur, manifeste, surface HTML, module `replace`
> `fade` et première surface publique de montage implémentés et testés ;
> une première fixture Sighty de montage est testée ; les politiques générales
> interinstances et de cycle de vie restent à valider ; le pilotage des scènes
> relève de Sighty.
> CodPlay version: V2 foundation
> Décision d'ouverture: 2026-09-11
> Plan: [`../plan/foreign-scene-component-plan.md`](../plan/foreign-scene-component-plan.md)

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
la [note du modèle déclaratif Sighty](../../sighty/notes/2026-08-17-modele-fichier-declaratif.md)
et suivi dans le [plan de première implémentation Sighty](../../sighty/plan/2026-09-10-premiere-implementation-plan.md).
Il constitue un parcours consommateur et une preuve d'intégration du composant,
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
le chemin `stories.<story>.persos[<index>].name`. Il ne démarre pas de player et
ne lit pas le DOM.

`resolveSlotManifestEntry(manifest, slot, { sceneId?, storyId?, referencePath? })` exige une
correspondance exacte. Il retourne une entrée unique ou un diagnostic
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

Le handle `detach` est idempotent. Une relation active est limitée à une
adresse d'hôte et à une instance enfant ; une seconde relation concurrente est
rejetée par diagnostic. La destruction de l'une des deux instances détache la
relation avant son teardown, sans détruire l'autre instance. Les règles de
remontage automatique, de composition multi-racines et d'intégration Sighty
restent hors de cette tentative.

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

- Le module partagé `replace` est raccordé aux hooks V2 pour le profil `slot` et
  fournit la transition `fade`. La présence de `replace.split` est acceptée
  pour compatibilité de déclaration puis ignorée ; elle n'active aucune
  stratégie de split.
- La surface est disponible dans le runtime HTML interne et une première
  façade `codplay.instances.mount` l'exerce pour les racines matérialisées
  directes d'un enfant, sans enveloppe visible supplémentaire.
  L'intégration Sighty, les remontages et les représentations multi-racines
  restent à valider. Le pilotage du cycle de vie des scènes appartient à Sighty
  et ne fait pas partie du composant `slot`.
- Le code qui possède la représentation foreign conserve ses racines, ses
  ressources et son chargement. Dans la V2 actuelle, ce code n'est pas une
  classe core d'adaptation : c'est le propriétaire ou fournisseur de la
  représentation, qui consomme la surface `foreignContent` lorsqu'un raccord
  d'application est fourni. Il ne décide pas du clone de transition.
  Pour une scène CodPlay, Sighty possède la décision de créer, piloter,
  démonter ou détruire l'occurrence ; le player CodPlay en exécute les
  opérations.
- Le clone utilisé par `replace` est un instantané DOM de présentation,
  possédé temporairement par la surface de présentation HTML et détruit à la
  fin ou à l'annulation de la transition. Il ne charge, ne pilote et ne
  détruit aucun contenu foreign et ne prolonge pas la propriété de ses racines.
- Cet instantané n'est pas une stratégie générique pour toutes les
  représentations foreign : `cloneNode(true)` ne reproduit pas le contexte de
  navigation ni l'état rendu d'une iframe. Le comportement futur d'un
  `replace` sur une iframe devra choisir entre un remplacement immédiat sans
  transition et un élément visuel de substitution par défaut. Cette décision
  reste ouverte et aucun de ces deux comportements n'est implémenté dans la
  présente tranche.

## Raccord V2 de `replace`

Le catalogue core déclare `replace` comme module player-scoped requis par le
type `slot`. Le runtime composant appelle ses hooks génériques
`beforeComponentUpdate` et `afterComponentUpdate` autour de `component.update()`.
Le module résout une surface de présentation par `componentId`, capture
`hostRoot` avant la mise à jour et enregistre une animation `fade` dans le même
cycle d'horloge que les animations de composant.

La surface de présentation HTML est distincte de `foreignContent`. Elle crée
un instantané DOM marqué transitoire, supprime ses identifiants et handlers
inline, puis le retire à la fin ou à l'annulation. Elle ne reçoit aucune
opération de chargement, de pilotage ou de destruction d'une ressource foreign.
Une mise à jour `seek` ou de capture géométrique annule les sessions et ne
rejoue pas une transition passée.

Pour `slot`, `replace` est limité à `fade` et `replace.split` est un champ de
compatibilité sans effet. Il est conservé dans la déclaration compilée, ne
produit aucun diagnostic et n'active jamais un split de la représentation
opaque. Les profils split de composants spécialisés restent hors de ce
contrat.

## Validation effectuée

Le test `tests/runtime/components/slot-component.spec.ts` couvre le nom racine,
le défaut `div`, l'absence de service textuel, l'attachement/détachement de
plusieurs racines et l'acceptation de `replace.split` sans diagnostic. Le test
`tests/scene/authoring/slot-manifest.spec.ts` couvre la découverte, l'absence et
la collision de noms. Le typecheck CodPlay, le typecheck des démos V2 et la
suite CodPlay existante passent pour cette tranche.

Le test `tests/runtime/capabilities/replace-module.spec.ts` exerce le chemin
réel `SceneBuilder → RuntimePlayer → hooks V2 → HtmlComponentMaterializer` :
un instantané sortant est animé par `fade`, le nouveau contenu reste porté par
la surface `foreignContent`, puis l'instantané et ses styles transitoires sont
supprimés.

Le test `tests/facade/foreign-mount.spec.ts` exerce la première surface publique
avec deux instances CodPlay réelles : adressage du `slot`, insertion directe de
la racine matérialisée enfant, seek indépendant, détachement idempotent et
nettoyage lors de la destruction de l'enfant.

Le test `tests/facade/sighty-demo.spec.ts` exerce la fixture Sighty A/B avec un
layout et deux instances enfants réelles : résolution des noms `A` et `B` par le
manifeste, montage des deux racines et démontage/remontage indépendant de A.
Cette fixture est une preuve consommateur séparée du contrat générique `slot` ;
elle ne fixe ni politique de fin de scène ni support foreign multi-racines.
