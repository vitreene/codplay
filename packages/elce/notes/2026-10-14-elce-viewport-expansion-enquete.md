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
taille du viewport. Décision utilisateur : son fond est noir et opaque pour
masquer le projet derrière lui. Le contenu original
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

### Commandes natives et déclencheur vidéo

Safari Technology Preview sur le lecteur Elcé `localhost:5175` a été sondé le
14 octobre avec une vidéo MP4 temporaire produite par `MediaRecorder` et
`controls` natif. Un clic sur la commande Play produit, au document, des
événements `pointerdown`, `pointerup` et `click` dont `target` est `VIDEO` et
dont `composedPath()` ne révèle que l’élément vidéo et ses ancêtres. Le chemin
DOM est donc identique à un clic de surface ; le déclencheur actuel basé sur
`pointerdown` ne peut pas préserver cette distinction.

Le balisage natif et les événements DOM observés n’exposent pas de part dédiée
aux commandes UA. Décision utilisateur : un bouton séparé « Agrandir », affiché
au survol en haut à droite de la vidéo, déclenche l’ouverture ; il ne dépend pas
de la distinction impossible entre commande et surface vidéo. Le plan garde à
valider la conservation des commandes pendant le mode agrandi et l’effet
`leave`/`PAUSE` causé par le déplacement. L’élément d’essai a été retiré de la
page après le relevé.

Le même test Safari a vérifié l’observation liée à la vidéo Flux. Un target
enfant d’un root observé passe à `isIntersecting: false` quand `move` le
reparent hors de ce root, même si sa boîte fixed recouvre le root ; son retour
produit `isIntersecting: true`. Le builder Flux déclare respectivement
`leave → PAUSE` et `enter → START`. Ces transitions artificielles changeraient
la lecture native à l’ouverture puis au retour. La tranche vidéo doit les
supprimer pendant les deux mouvements tout en conservant les transitions de
visibilité dues au scroll ; ce point est suivi dans l’action 4 du plan.

### Graphe comme projection viewport

Le builder extrait SVG/table dans un perso `layout` distinct ; le titre et le
commentaire restent dans la figure source. Les tests du player réel passent
pour un Graphe direct, ancré dans un slot Flux, et enfant d’un Carousel. Ils
vérifient le retour de focus, la présence du texte éditorial, le maintien du
slot d’ancrage et la navigation Graph↔image en sautant la vue texte. La
validation visuelle Safari de ces placements reste à faire.

Les captures géométriques internes éventuelles de motion restent à analyser :
elles ne doivent pas réassigner une source identique ou modifier la lecture
native. Ce contrôle de continuité n’ajoute pas un parcours utilisateur de
Seek/replay à Elcé. Si le cœur est modifié, ses obligations de non-régression
propres restent suivies dans son plan propriétaire.

## Diagnostic de l’interpolation

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
et Graphe.

Safari MCP, le 14 octobre 2026, ouvre la preview réelle du serveur Elcé dans
une seule instance Safari Technology Preview. Sur la page contenant un
Carousel Photo, une cible DOM temporaire est insérée sous
`.elce-flux-scrollport`, dans la scène de la page. Avec `position: fixed`,
`inset: 0` et un niveau d’empilement élevé, son rectangle égale le viewport
`1280 × 756 px`. `elementFromPoint()` retourne cette cible au-dessus du bandeau
de preview, du menu, du titre, de la navigation et aux bords du viewport. Les
ancêtres incluent `overflow: auto` et `overflow: hidden`, mais aucun
`transform`, `perspective`, `filter`, `contain`, `will-change` ou contexte
d’isolation ; ils ne contraignent pas cette projection fixe. Une seconde
mesure sur le viewport étroit effectif `390 × 760 px` donne le même résultat.
L’image du Carousel utilisée pour la mesure charge avec une taille intrinsèque
de `339 × 450 px`. Safari rapporte également un `404` sans URL dans sa console ;
une autre image de la page a `naturalWidth: 0`, mais l’association entre cette
ressource et le `404` n’est pas confirmée. La cible temporaire est retirée à la
fin de chaque mesure.

Dans cette même preview, déplacer temporairement la racine média de la vue
Photo du Carousel vers cette cible puis la remettre à sa place conserve le
cadre source à `916 × 515 px` et la hauteur du Flux à `1355 px`. Le slot parent
garde donc sa réserve pour ce cas Carousel. Cette manipulation DOM ne passe
pas par l’action CodPlay `move` et ne couvre pas encore une image directe ou
ancrée.

Cette preuve valide la projection CSS et son empilement dans le lecteur réel ;
la manipulation DOM initiale ne validait pas le perso CodPlay `layout` ni le
`move` réel. Le circuit d’agrandissement est intégré aux builders Flux et
Diapo. Les tests de composition couvrent le chemin `emit` → événement → strap →
actions pour les images directes, ancrées, de Question et de Carousel Diapo.

Le défaut Safari venait du root motion conservé à la création. Dans Sighty,
l’occurrence enfant est créée avant que la racine DOM du slot existe. Le montage
résout ensuite ce slot et le transmet explicitement au runner comme root effectif
de la scène enfant : les cibles `@root`, le résolveur motion et le présentateur
utilisent le même nœud. Au détachement, la racine de création est restaurée.
Cette relation est vérifiée par les tests compilé/live de
[foreign-mount](../../codplay/tests/facade/foreign-mount.spec.ts) et le test du
[résolveur motion](../../codplay/tests/runtime/runner-html/motion-container.spec.ts).

Le compte rendu utilisateur signale que l’interpolation du Carousel apparaît
dans un petit cadre isolé en haut à gauche, puis que le plein viewport le
remplace. La mesure Safari du 2026-10-14, avant l’alignement de la couche,
reproduit et explique le défaut :

| Élément | Rectangle Safari à `1280 × 756` |
| --- | --- |
| Slot racine effectif `#elce-document-content-region` | `(285, 137)`, `982 × 541`, `position: static` |
| Photo avant agrandissement | `(318, 163)`, `916 × 515` |
| Cible `-frame` fixed | `(0, 0)`, `1280 × 756` |
| Couche overlay créée sous le slot | `(0, 0)`, `1280 × 756`, `offsetParent: #elce-document-body` |
| Clone en fin de mouvement, juste avant son retrait | `(-285, -137)`, `1280 × 756` |

Les poses du clone sont localisées par rapport au slot ; à l’endpoint, le point
viewport `(0, 0)` devient donc `(-285, -137)`. La couche `position: absolute`
est enfant du slot mais, celui-ci étant `static`, son origine CSS est celle du
body/viewport. Les mesures à chaque frame montrent le clone glisser vers les
valeurs négatives pendant environ `300 ms`, alors que la vraie cible fixed reste
à `(0, 0)` et devient visible à la fin. Cela correspond précisément au petit
cadre en haut à gauche puis au remplacement observés. La taille de la cible
était correcte ; c’est l’origine écran de la couche overlay du présentateur
CodPlay qui ne correspond pas au repère de la racine motion.

Cette preuve est Safari sur le vrai player, pas une projection DOM simulée. Le
correctif appartient au présentateur motion CodPlay ; le plan propriétaire
`move` reçoit une action dédiée pour aligner le repère de la couche et valider
les frames initiale, intermédiaires, finale et inverse. Aucun contrat de
spécification n’est ajouté avant que ce comportement soit implémenté et vérifié.

### Mesure Safari du déplacement dans la couche alignée

Dans Safari Technology Preview visible, au viewport CSS de `1024 × 664 px`
(`devicePixelRatio: 2`), la photo source mesure `(318, 206)`, `660 × 371.25 px`.
La cible fixed et le contenu monté dedans mesurent déjà `(0, 0)`,
`1024 × 664 px`. La couche overlay a la matrice `translate(285px, 137px)`, ce
qui la place dans le repère de la racine motion décalée.

Les frames capturées en `requestAnimationFrame` montrent l’aller continu : à
25 ms, le clone mesure `(206.3, 133.6)`, `787.9 × 474.1 px` ; à 97 ms,
`(81.2, 52.6)`, `931.1 × 589.3 px` ; à 181 ms, `(16.8, 10.9)`,
`1004.8 × 648.5 px` ; à 297 ms, `(0, 0)`, `1024 × 664 px`. La couche atteint
son opacité finale, puis le clone est retiré une fois superposé à la vraie
cible. Le retour suit le trajet inverse : à 22 ms, `(100.4, 65)`,
`909.1 × 571.6 px` ; à 134 ms, `(270.3, 175.1)`, `714.6 × 415.1 px` ; à
302 ms, le clone rejoint `(318, 206)`, `660 × 371.25 px`, avant son retrait.

Le petit cadre isolé en haut à gauche n’apparaît pas sur ces deux parcours.
L’alignement racine→couche résout le décalage mesuré avant correction ; le
comportement de la cible reste bien celui demandé : elle occupe le viewport
avant le déplacement, tandis que `move` interpole le clone entre la taille de
la source et celle de la cible. La capture finale montre la photo centrée,
conservant son ratio, sur fond noir.

Le scroll du Flux restait actif dans le premier parcours Safari. Le scrollport
vit dans la story de page ; le strap d’agrandissement vit dans la story du
Carousel. Sa sortie `visibility: 'scene'` déclenche bien les règles de scène,
mais reste sur la track de sa story et n’est pas matérialisée dans l’autre
story. Le builder Elcé émet maintenant une requête depuis le strap puis utilise
un `listen.emit` de scène pour publier le verrouillage ou le déverrouillage sur
la track globale, conformément au pipeline existant. Ce relais ne modifie pas le
cœur CodPlay.

La régression réelle du Carousel et le test d’image directe passent. Dans Safari,
le scrollport a `overflow-y: hidden` pendant l’agrandissement ; un geste de
scroll ne le déplace pas. Après Échap, il revient à `overflow-y: auto`, l’image
retourne à sa source et le focus lui est rendu.

Le parcours façade Flip Stress échoue encore sur `seek(1500)` sans overlay ;
quatre assertions dépendant de Seek échouent aussi dans `facade.spec.ts`. Ces
anomalies restent distinctes au [plan CodPlay motion](../../codplay/plan/motion-live-discovery-invalidation-plan.md).
