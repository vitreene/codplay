# Elcé — notes d’enquête sur l’agrandissement viewport

> Notes de travail conservées pour leur contexte technique et leur justification.
> Le périmètre actif, les décisions et les actions relèvent du [plan de réalisation](../plan/2026-10-14-elce-viewport-expansion-plan.md) ; ces notes ne définissent pas de contrat.

## Contrats relus et circuits à conserver

| Sujet | Référence et propriétaire existant | Conséquence pour l’étude |
| --- | --- | --- |
| Image | [Composant `img`](../../codplay/specs/image-component-v2-spec.md) | Conserver le nœud par source, `alt` et les services de racine et d’image interne. |
| Vidéo indépendante | [Contrat `media.sync`](../../codplay/specs/media-sync-v2-spec.md), [preload](../../codplay/specs/preload-v2-spec.md) | Contrat appliqué : `media` en mode `sync: 'independent'`, avec broadcasts conservés. Préserver source, nœud natif et ressources. La continuité pendant l’agrandissement reste à prouver. |
| Graphe | [BDC Graphe](../specs/statistical-graph-spec.md) | Préserver SVG ou tableau, noms accessibles, données et placements existants. |
| Placement interpolé | [Move](../../codplay/specs/move-v2-spec.md), [motion](../../codplay/specs/motion-frame-v2-spec.md) | Réutiliser placement, capture de bornes et présentation motion. |
| Cible de montage | [Layout](../../codplay/specs/layout-component-spec.md), [matérialisation](../../codplay/specs/component-materialization-v2-spec.md) | Un perso `layout` peut publier une part cible dans le même runtime. |
| Interactions | [Perso.emit](../../codplay/specs/perso-emit-v2-spec.md), [capture](../../codplay/specs/capture-v2-spec.md), [événements](../../codplay/specs/event-pipeline-v2-spec.md), [straps](../../codplay/specs/strap-execution-v2-spec.md) | Les interactions rejoignent le dispatcher et le journal existants. |
| Sélection Carousel | [Carousel Elcé](../specs/carousel-bdc-spec.md) | Étendre le circuit événement → strap → actions déjà utilisé par les points. |
| Pages et instances | [Flux](../specs/flux-scene-builder-spec.md), [Diapo](../specs/diapo-scene-builder-spec.md), [preview](../specs/player-preview-spec.md) | Respecter montage, conservation des scènes et navigation Sighty. |
| Composition externe | [Façade CodPlay](../../codplay/specs/facade-v2-spec.md) | `register` et `override` utilisent le catalogue unique, verrouillé au premier build ou à la création d’instance. |

Le [guide de reprise V2](../../codplay/plan/notes/2026-08-26-decouverte-etat-codplay-v2.md)
a été relu après identification des plans détaillés.

## Capacité et perso : deux niveaux à distinguer

Un perso est une occurrence dans la scène, avec son état, ses actions et sa
représentation éventuelle. Une capacité fournit une définition de composant,
des services ou un module au catalogue. Une capacité externe peut donc fournir
un composant instancié comme perso régulier ; ces options ne sont pas exclusives.

La question préalable est de savoir si le dispositif exige une nouvelle
responsabilité runtime, ou seulement une composition auteur des contrats
existants. Le fait qu’il serve à plusieurs contenus ne prouve pas à lui seul
qu’un nouveau module runtime soit nécessaire.

## Ancrage documentaire et point de présentation viewport

Le contrat vérifié d’ancre Elcé sert à placer une Carte ou un Graphe enfant
sur un point inline d’une Section. Le slot, sa réservation de Flux et sa part
CodPlay constituent le placement de ce BDC dans le texte. Le CSS Anchor
Positioning aligne ce BDC sur la ligne ; cette mécanique ne fournit pas une
boîte qui couvre le lecteur entier.

La cible de présentation viewport relève donc d’un rôle distinct. Décision
actée : la cible reste dans la même scène que l’élément agrandi. C’est sa
projection `position: fixed` qui doit occuper le viewport ; sa position
structurelle dans la scène n’est pas son emplacement visuel d’arrivée.

## Hypothèse `move` vers une cible viewport

La cible à tester est un perso `layout` de la scène active, avec
`position: fixed; inset: 0` et un niveau d’empilement qui le place devant les
slots de menu, titre et navigation. Il fournit une projection mesurable à la
taille du viewport ; son fond peut être transparent. Le contenu original
rejoint cette cible de la même scène avec une transition `move`, puis rejoint
sa cible d’origine avec la transition inverse.
La destination de retour et la présentation ordinaire viennent de la scène
auteur ; elles ne sont pas reconstruites en lisant un ancien état DOM.

L’élément « invisible » ne doit pas rendre son contenu invisible ni supprimer
sa géométrie. Il faut distinguer l’absence de décor d’un état `display: none`,
d’un détachement `@off`, ou d’une invisibilité/opacité transmise aux enfants.
La cible doit rester résoluble aux bornes pertinentes du mouvement.

`@root` désigne la racine de l’instance de page et n’est pas, à lui seul, le
viewport du navigateur. `position: fixed` peut donner à un descendant cette
référence viewport en l’absence d’un ancêtre qui établit un autre contenant
fixe ([CSS Positioned Layout](https://drafts.csswg.org/css-position/)).
Les règles CSS sur l’overflow excluent les descendants dont le contenant est
le viewport ou un ancêtre de l’élément ([CSS Overflow](https://drafts.csswg.org/css-overflow/)).
Le layout Elcé et sa région de contenu ont `overflow: hidden`, mais leur CSS
ne déclare pas de `transform`, `contain` ni `will-change`. Il faut encore
vérifier dans le lecteur réel les wrappers Sighty/CodPlay et le contexte
d’empilement de l’instance active : un ancêtre qui établit un contenant fixe
peut ancrer la cible ailleurs qu’au viewport, et une couche parent peut
empêcher son niveau d’empilement de couvrir les commandes Elcé. C’est un gate
de la première fixture. Si la projection échoue, identifier le blocage du
circuit dans cette scène et arrêter cette tranche jusqu’à sa résolution par
le plan propriétaire. Un hôte externe, un déplacement inter-instance ou un
portail ne constitue pas une solution de repli retenue.

La cible ne justifie pas une nouvelle enveloppe autour de chaque BDC. Réutiliser
les racines et réserves présentes avant d’envisager une structure supplémentaire.

## Vidéo libre et temps de présentation

La durée d’un `move` règle l’interpolation visuelle. Elle ne doit pas devenir
le temps de lecture de la vidéo, ni lui imposer un positionnement, une vitesse
ou une pause. Ouvrir ou fermer l’agrandissement préserve la lecture ou la pause
native, le temps courant et le son ; cela ne relance pas la ressource.

Le [choix G5 de Quiz Hunt](../../demos/plan/2026-10-09-quiz-hunt-sighty-reconstruction-plan.md#g5--vidéo-native-de-la-question)
utilise un perso `tag` vidéo et ses contrôles natifs, sans broadcasts média
`START`/`STOP`. Il éclaire l’origine de l’intérêt pour une lecture indépendante,
mais ne définit pas le raccord Elcé.

Pour l’indépendance d’horloge vidéo, le composant retenu est `media` avec la relation
`sync: 'independent'`, en conservant ses commandes broadcast. La vidéo suit
son propre temps ; CodPlay ne la synchronise pas à son temps de scène et elle
ne fournit pas l’horloge CodPlay. Les commandes explicites restent possibles.
Les commandes retenues sont `START`, `PAUSE` et `STOP`. La mention de `PLAY`
a été corrigée par l’utilisateur en `START` ; un éventuel alias reste
facultatif et non décidé. Leur application est vérifiée dans la [spécification média](../../codplay/specs/media-sync-v2-spec.md).

Ce mode est implémenté et appliqué aux vidéos Elcé. Le STOP de sortie et le
retour à zéro sont vérifiés dans la [spécification preview](../specs/player-preview-spec.md#lecture-des-vidéos-et-sortie-de-page). Une vidéo enregistrée peut être
indépendante ; le type de source et la relation d’horloges sont des
préoccupations distinctes.

Les captures géométriques internes éventuelles de motion restent à analyser :
elles ne doivent pas réassigner une source identique ou modifier la lecture
native. Ce contrôle de continuité n’ajoute pas un parcours utilisateur de
Seek/replay à Elcé. Si le cœur est modifié, ses obligations de non-régression
propres restent suivies dans son plan propriétaire.

## Preuves de l’enquête et limites

La lecture des contrats a été complétée sur leurs lacunes par :
[`ImageComponent`](../../codplay/src/runtime/components/image/image-component.ts),
[`MediaComponent`](../../codplay/src/runtime/components/media/media-component.ts),
[catalogue core](../../codplay/src/runtime/catalog/create-core-runtime-catalog.ts),
[catalogue de capacités](../../codplay/src/runtime/catalog/runtime-capability-catalog.ts),
[conteneur motion](../../codplay/src/runtime/runner-html/motion-container.ts),
[présentateur overlay](../../codplay/src/runtime/runner-html/motion-presentation-host/overlay-presenter.ts),
[builder Carousel](../src/builders/carousel/carousel-scene-builder.ts),
[builder Carte](../src/builders/card/card-bdc-scene-builder.ts),
[builder Graphe](../src/builders/statistical-graph/statistical-graph-scene-builder.ts)
et [composition du lecteur](../src/player/elce-player-composition.ts).

Vérifications existantes rejouées le 14 octobre 2026 depuis `packages/codplay` :

```text
node ../../node_modules/vitest/vitest.mjs run tests/facade/facade.spec.ts \
  -t 'registers and overrides components, services, and modules through one public catalog'
1 test réussi ; 24 tests non sélectionnés.

node ../../node_modules/vitest/vitest.mjs run \
  tests/runtime/components/image-input-polygon.spec.ts \
  tests/runtime/runner-html/motion-container.spec.ts \
  tests/runtime/runner-html/motion-presentation-host.spec.ts
3 fichiers, 29 tests réussis.
```

Ces 30 tests vérifient des mécanismes déjà présents. Ils ne prouvent pas la
fonctionnalité d’agrandissement, son intégration Elcé ou ses extensions vidéo
et Graphe. Aucun parcours navigateur de cette fonctionnalité n’a été réalisé.
Les spécifications vérifiées restent inchangées ; aucun parcours navigateur de
l’agrandissement n’a encore eu lieu. Les comportements ajoutés par ce projet
seront décrits dans sa spécification après validation complète.
