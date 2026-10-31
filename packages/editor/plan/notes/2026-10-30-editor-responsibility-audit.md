# Audit des responsabilités de l’éditeur

Analyse du 30 octobre 2026, sur `db605645`, principalement des changements
Editor du commit `a782319b`, replacés dans les travaux des 28–30 octobre.
L’audit initial ne modifiait aucun code applicatif ni test. Les décisions de correction demandées
après cet audit restent dans le
[plan ciblé](../2026-10-30-editor-motion-responsibility-fix-plan.md), relié au
[plan mouvement](../2026-09-02-motion-editor-v2-plan.md).

## Référence de lecture

Le circuit établi est `EditorScene → builder V2 → CodPlay.build → instance`.
Le contrôleur et la façade documentaire possèdent les mutations et l’historique ;
CodPlay possède la résolution et la présentation du mouvement ; le bridge
adapte les intentions et les coordonnées ; les overlays présentent les artefacts.
`snapshot.get()` exclut la preview et `presentation.get()` fournit la pose numérique.

Sources relues : [organisation V2](../2026-09-01-editor-v2-organization-plan.md),
[orientation](../../specs/path-tangent-orientation-spec.md), plans mouvement et
[builder Decor](../2026-09-04-decor-builder-projection-plan.md), contrats de
[façade](../../../codplay/specs/facade-v2-spec.md),
[move](../../../codplay/specs/move-v2-spec.md),
[motion](../../../codplay/specs/motion-frame-v2-spec.md) et
[ACE](../../../codplay/specs/ace-calculation-v2-spec.md), ainsi que les contrats
de timeline, décor, contrôleur, commit de phase et reconstruction Remix.

## 1. Deux évaluateurs d’easing : divergence exécutée

`src/motion-editor/easing.ts:25` résout les Bézier par dichotomie locale au lieu
de passer par `parseEase`, utilisé pour les chaînes. Le builder reçoit pourtant
`normalizeMotionEasing()`, qui émet `cubic-bezier(...)`.

Contrôle exécuté avec les modules réels : pour les paramètres
`0.25, 0.1, 0.25, 1`, à une progression de `0.5`, le calcul Editor renvoie
`0.8024033876046366`, tandis que
`parseEase('cubic-bezier(0.25,0.1,0.25,1)')` lève
`ace: courbe d'easing inconnue « cubic-bezier »`.
Le catalogue de `packages/codplay/src/ace/easings.ts:222` ne publie pas ce nom.
Le test Editor `tests/motion-editor/easing.spec.ts` valide seulement le résultat
local pour cet objet, sans faire consommer sa représentation par ACE.

C’est un circuit parallèle effectif qui masque une incompatibilité de frontière.
Le support contractuel de cette forme doit être clarifié avant correction ;
aucune extension CodPlay n’est autorisée par cet audit.

## 2. Un item devient deux persos : projection et preview divergent

`src/builder-v2/build-scene.ts:618` change la représentation d’un item portant
un chemin : hôte `list` pour la pose, enfant pour le visuel. Le bridge reconstruit
la même décision dans `motionVisualIdForItem()` (`:292`), répartit les previews
dans `toSnapshotPatches()` (`:1634`) et fusionne les états dans `snapshotState()`
(`:260`). `presentedContentBoxFrameForItem()` (`:1479`) choisit également sa
conversion selon cette représentation.

La répartition n’a pas une définition unique : les actions de décor du builder
(`splitMotionHostActions`, `:700`) mettent seulement `x/y` sur l’hôte ; une
propriété de décor `rotate`, `scaleX/Y` ou `transform-origin` reste sur l’enfant.
La preview (`decor-editor-bridge.ts:1639`) dirige ces mêmes clés vers l’hôte.
La fusion de lecture donne ensuite priorité au style de l’enfant. Le builder,
la preview et la lecture n’appliquent donc pas le même partage des propriétés.

Le runtime CodPlay reste exercé ; il ne s’agit pas d’un second player. En revanche,
un second contrat implicite de représentation s’est installé entre trois chemins.
La spécification d’orientation et le plan mouvement ne formalisent pas ce
dédoublement hôte/enfant. La correction regroupe maintenant cette représentation dans le composant item
Editor ; le builder et le bridge ne décident plus de deux identités runtime.

## 3. Le store commun publie une pose issue de plusieurs autorités

`decor-editor-bridge.ts:1232` reconstruit les endpoints depuis la cascade auteur.
Pour l’endpoint sélectionné, `:1245` préfère le candidat commité, puis la preview,
puis la présentation, puis la pose auteur. `:1260` préfère ensuite un endpoint
en cache à la pose auteur pour les autres points. Ce cache est alimenté lors
de la sélection et invalidé par l’identité de scène ou la largeur de racine.

Ainsi, la source d’un endpoint dépend de sa visite antérieure : une pose jamais
visitée est reconstruite, une pose visitée peut venir d’une présentation conservée.
Le store commun unifie la distribution, mais ne résout pas cette concurrence.
Le bridge calcule aussi tangentes et interpolation de rotation
(`:1298`, `resolveTangentGestureProjection`, `authoredRotationAtGestureStart`).
L’emploi des primitives ACE partagées est légitime pour dessiner et éditer un
chemin ; il ne garantit pas que cette composition locale soit celle du player.

Autre différence de règle : `resolveMotionOverlayGhosts()` (`:1434`) préfère
le segment sortant avec path au segment entrant, alors que la sélection d’un
KF après le premier privilégie son segment entrant (`resolveMotionPair`, `:1129`).
Ces choix doivent être confrontés à des segments de tangentes différentes.
L’écart visuel après différentes séquences de sélection reste à reproduire ;
le mécanisme de dépendance à la visite est établi par lecture du code.

## 4. Deux sessions de geste, une seule garde de commit

Le cadre passe par `previewFrame → controller.applyPatch → snapshot.set`, puis
`commitSelectionFrameDrop`. La surface de déplacement de l’overlay passe par
son propre `DragState`, `draftTargetFrame` et `moveDrag`, puis `onDrop` seulement
au relâché (`src/motion-editor/overlay.ts:631`, `:677`, `:725`).

La garde de `flushNow()` (`decor-editor-bridge.ts:945`) ne consulte que
`selectionFrame.isGestureActive()`. Le début du geste de l’overlay ne suspend
pas le timer de phase et n’est pas signalé au bridge. Un décor de palette en
attente peut donc être commité par le timer de 4 s pendant ce geste. Le scénario
à rejouer est : modifier la palette, commencer un déplacement avant le flush,
maintenir le pointeur au-delà du délai, puis relâcher ou annuler.

L’overlay possède aussi une seconde écriture de ses segments : après `onDrop`,
il réécrit `segment/segments` (`:731`), bien que le callback puisse avoir déjà
publié la projection par le store auquel il est abonné (`:824`). Le partage
géométrique ne couvre donc pas toute la vie de l’aperçu et de son acceptation.
Ces conflits de câblage sont établis ; leur parcours navigateur reste ouvert.

## 5. La coordination répare la présentation du runtime par le transport

`EditorCoordinationBridge.requestPause()` (`:198`) inspecte les décors pour
détecter un path, puis force `durée − 2 ms → durée` afin de remplacer la pose
live terminale. Le Stop répété évite également un Seek identique
(`src/sequence-editor/mount.ts`, `onStopClick`).

Ces comportements sont maintenant explicitement décrits dans la spécification
d’orientation : leur retrait direct serait une modification de contrat.
Ils restent des compensations Editor d’un problème de présentation runtime.
Le transport connaît ainsi le contenu graphique de la scène pour obtenir une
pose correcte, alors que la spécification motion attribue cette pose à CodPlay.
Le défaut historique de Seek traité dans le runtime est distinct de cette
compensation terminale ; ne pas les confondre.

## 6. Deux producteurs d’actions peuvent écrire la translation

`buildInterpolationActions()` construit des actions de décor et de pose.
Lorsqu’une bordure change, il ajoute une compensation `x/y` aux actions de décor,
puis la supprime axe par axe si un segment pose chevauchant écrit déjà cet axe
ou possède un path (`src/builder-v2/build-scene.ts:815`).

Le décor devient ainsi producteur d’une translation, en concurrence avec le
canal pose. Le filtrage traite la collision des sorties après construction.
Ce point est déjà reconnu comme piste non contractuelle dans P4 du plan mouvement.
`resolveDecorationStyleAtTime()` (`decor-resolution.ts:133`) évalue par ailleurs
une chaîne temporelle locale pour fournir la bordure utilisée par la pose.
Il réutilise ACE et le résolveur de fenêtre, mais réimplémente le parcours des
événements indépendamment de la matérialisation runtime.
La parité sur fenêtres raccourcies et changements de bordure reste à démontrer.

## Reproductions Safari du 30 octobre après demande de correction

Le serveur configuré est `safari-mcp`, lancé par Safari Technology Preview
`safaridriver --mcp`. L’inventaire de session expose ses outils callable ;
les contrôles suivants utilisent `evaluate_javascript` dans un onglet servi
par Vite sur `127.0.0.1:5174`, sans toucher au document SQLite.

**Point 5 :** un `HtmlMotionPresentationHost` réel reçoit une pose locale à
`x = 40 px`, `width = 20 px`. Sa première présentation écrit bien
`matrix(1, 0, 0, 1, 40, 0)` et `width: 20px`, avec priorité `important`.
Une écriture auteur remplace ensuite ces propriétés par `rotate(46deg)` et
`width: 99px`. Le commit de la même frame laisse ces deux remplacements en
place. `LocalMotionPresenter.prepare()` et `apply()` comparent seulement leurs
valeurs calculées aux caches ; la couche de contribution n’est pas rappelée.
Cette reproduction isole la frontière fautive sans la coordination Editor.
Elle explique pourquoi un détour temporel peut rétablir la pose : il invalide
la comparaison de matrice. Le contrôle de la fin naturelle après correction
devra néanmoins exercer le player complet.

**Point 6 :** une scène de test indépendante contient un bloc sans path,
avec deux KFs pose à 0/5 s et un KF décor à 2 s. La pose va de `(10,10)` à
`(50,10)` cqw ; la bordure passe de `0.6cqw` à `2cqw` sur les deux premières
secondes. Le builder et le player réels, dans une racine de 800 px, donnent à
2,5 s `x = 28.7cqw`, `y = 8.7cqw`, plus `2cqw` de bordure, soit un contenu
à `(30.7,10.7)` au lieu de `(30,10)` : écart de 5,6 px sur chaque axe.
L’action pose interpole ses endpoints compensés sur 5 s ; l’action bordure
utilise 2 s. Le défaut existe sans le couple hôte/enfant et sans trajectoire.
La suppression d’une des actions concurrentes ne suffit donc pas : la
projection doit décider comment composer les coordonnées dans le repère retenu.

**Limite du raccord à un seul élément :** une action native peut composer la
pose et la bordure au même temps sans dérive sur un déplacement sans path.
Cela ne suffit pas à préserver la taille du contenu pendant `move` : la
présentation motion possède les dimensions capturées aux endpoints et les
interpole, tandis que la bordure peut suivre une autre fenêtre. Une nouvelle
écriture logique de largeur ne remplace pas cette propriété du présentateur.
Cette contrainte explique la composition actuelle : un perso possède un cadre
motion et une représentation native privée dont les dimensions restent celles
du contenu courant. Les deux canaux ne sont plus répartis entre persos.

**Frontière de présentation retenue :** les styles auteur du cadre passent par
une règle CSS privée formatée avec le service style natif ; le présentateur
motion possède les contributions inline. Une simple comparaison locale de styles
ne règle pas cette concurrence après capture/resize. La preview `snapshot.set`
exprime le candidat dans l’ancre privée à partir de l’inverse ACE de la pose
publiée. Le transport peut alors abandonner le détour temporel terminal sans
modifier le présentateur partagé. Le défaut général reproduit plus haut reste
inchangé dans CodPlay ; son identification n’autorise aucune intervention core.

Les comportements implémentés et leurs preuves sont dans les spécifications
[easing](../../specs/motion-easing-spec.md),
[présentation](../../specs/item-presentation-spec.md) et
[orientation](../../specs/path-tangent-orientation-spec.md). Les acceptations
encore ouvertes sont uniquement suivies au plan ciblé.

## Validation et limites

- Depuis `packages/editor`, les suites ciblées ont passé 13 fichiers/120 tests ;
  la suite complète a passé 47 fichiers/494 tests le 30 octobre 2026.
- Le contrôle d’easing ci-dessus établit une divergence malgré ces tests verts.
- Les constats statiques initiaux ne certifiaient pas les symptômes UI ; les
  corrections et leurs validations ultérieures sont reliées ci-dessus.
- L’écriture documentaire reste centralisée : les commits étudiés rejoignent
  `RUN_TRANSACTION` et la façade pure. Le port de candidat décor est prévu par
  le plan ; sa présence seule n’est pas un contournement. Le store de géométrie
  reste une projection éphémère, pas un second document.
- Le problème structurel se concentre sur la résolution et le raccord
  auteur/preview/présentation. Déplacer les fonctions du gros bridge dans
  plusieurs fichiers ne supprimera pas ces responsabilités concurrentes.
