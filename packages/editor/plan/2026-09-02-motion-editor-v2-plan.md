# Plan V2 — éditeur de mouvement

**Statut : En cours — implémentation autorisée le 2026-09-02, périmètre intra-capsule**  
**Cible :** `ed2` avec la façade CodPlay V2  
**Date :** 2026-09-02

Ce document prépare la feature « éditeur de mouvement ». L'implémentation est
engagée sur le périmètre validé : déplacement intra-capsule, sans reparentage
et sans modification du sequence-editor dans cette tranche. Il deviendra la
base d'une spécification V2 maintenue avec les preuves d'acceptation.

### État de l'implémentation (2026-09-02)

Le premier vertical slice est en cours :

- `Decor.path?: string` est ajouté au modèle V2 et reste segment-local au décor
  du KF cible ; son absence représente une droite ;
- le pont `decor-editor` monte un overlay modulaire hors scène avec zone
  centrale de 12 px exclue, ghost géométrique, ligne/arc SVG, inversion des
  rôles et remise à la droite par double-clic ;
- un drag central depuis un KF réel crée le KF cible à `+500 ms` dans une seule
  transaction, conserve le `parentId` et place la tête de lecture sur la cible ;
- le builder valide le path et le transmet à la frontière `move.transition`
  CodPlay V2, avec `pathAnchor: 'center'` pour conserver l'ancrage visible ;
  cette extension explicite du contrat CodPlay V2 ne modifie ni le
  sequence-editor ni le parentage ;
- la protection copy-on-write du `path` inclut le cas où un premier KF partage
  `initialDecorId`, tandis que les éditions CS ordinaires conservent le partage
  historique attendu par le contrat du décor ;
- l'overlay reste masqué tant qu'aucune scène/sélection ne fournit de segment,
  le point médian et le path se mettent à jour pendant le drag, et le calcul
  d'arc reste sur le petit arc (`largeArc=0`) pour éviter une contre-courbe
  quasi fermée ;
- le runtime V2 consomme `pathAnchor: 'center'` pour les segments issus de
  l'éditeur : le centre affine visuel suit le tracé affiché malgré rotation ou
  redimensionnement, sans stocker une AABB ;
- le CS ne lit pas la position DOM de l'item et ne maintient pas un lecteur de
  path parallèle : le bridge appelle les primitives ACE pures avec le même
  path préparé, le même easing et le même temps absolu que CodPlay, puis
  projette la pose logique courante sur le centre présenté ;
- l'import direct des primitives ACE par l'éditeur est explicitement un raccord
  **temp** de la première tranche, pas une surface V2 normative ; la décision
  de frontière (façade CodPlay ou bibliothèque ACE indépendante) est différée
  jusqu'à la stabilisation de la trajectoire ;
- la feuille de projection HTML soustrait désormais l'origine de layout non
  transformée capturée séparément de l'origine affine : le `transform` auteur
  n'est donc pas retiré une seconde fois et le centre rendu reste sur le path ;
- la poignée de durée/presets, le champ numérique, les collisions et l'undo/redo
  applicatif restent explicitement dans les tranches suivantes ; aucune règle
  implicite n'est ajoutée pour ces cas.

Les tests ajoutés couvrent la géométrie pure, la validation/compilation du path
et le geste réel du bridge sous jsdom. La validation visuelle finale doit encore
être réalisée dans **Safari Technology Preview** sur le serveur existant
`127.0.0.1:5174`.

Un smoke test a toutefois été effectué le 2026-09-02 dans l'onglet existant de
**Safari Technology Preview** : au lancement sans scène, le bouton
`data-motion-path-control` et le path sont masqués ; la démo « Test position +
couleur » se charge, la sélection affiche le CS et la surface centrale, puis
le second KF affiche le ghost source et le path. L'endpoint du path ajouté à
la scène coïncide avec le centre mesuré de l'item actif (écart inférieur à
`0,03 px`). Après correction de la projection HTML, un seek à `2,5 s` sur un
arc courbé donne un centre d'item à moins de `0,10 px` du path rendu et la
poignée médiane à moins de `0,10 px` de ce même path. Un drag synthétique du
point médian met à jour sa position et le `d` SVG avant le relâchement, avec un
arc `largeArc=0` ; la console ne contient aucun avertissement après nettoyage.
Ce contrôle utilise des `PointerEvent` synthétiques pour le drag ; Safari Technology Preview signale alors
`NotFoundError` sur `setPointerCapture` sans neutralisation de test (événement
non trusted), ce qui ne constitue pas une preuve de geste natif. La porte P7
reste donc ouverte pour le drag réel, le tactile et la matrice complète
Play/Seek/rebuild.

Le même onglet a ensuite validé la couture CS/ACE sur le segment courbe existant :
KF cible sélectionné à 5 s, puis seek à 2,5 s, le `d` SVG est resté inchangé et
les centres du CS et de l'item sont restés confondus à moins de `0,03 px`. Les
tests d'intégration couvrent aussi un détour de seek (`500 → 250 → 500`) qui
reproduit exactement la transform ACE de l'item et un seek interne qui ne
reconstruit pas les extrémités du path depuis le snapshot interpolé.

## 1. Autorité et périmètre V2

La référence est exclusivement le modèle V2/ed2 et les contrats V2 déjà relus :

- [plan d'organisation de l'éditeur V2](./2026-09-01-editor-v2-organization-plan.md) ;
- [spécification V2 de dedit](./2026-07-07-dedit-spec.md), notamment son
  interface `SelectionFrameV2`, son canal `instance.snapshot` et son statut
  `isTemporary` ;
- [modèle de document ed2](./app/2026-07-11-ed2-document-model.md) ;
- [représentation et commandes du sequence-editor](./2026-06-11-sequence-editor-grid-spec.md) ;
- [contrat des modifieurs V2 du Selection Frame](../../authoring/selection-frame/src/v2/types.ts)
  et son [guide de composition](../../authoring/selection-frame/GUIDE.md) ;
- [canal Decor unique et trajectoire déclarative encore ouverte](./2026-07-25-decor-unified-channel-plan.md),
  §C ; cette section est le point d'intégration ed2, pas une invitation à
  recréer une géométrie de trajectoire. La décision utilisateur de faire du
  `Decor.path` optionnel le porteur canonique de tout trajet non rectiligne
  (segment entrant du KF, puis trajet vers une zone de capsule) remplace ici la
  direction provisoire « propriété du move » ; le modèle normatif ed2 et le
  contrat du patch dedit sont alignés sur cette décision ;
- [contrat de trajectoire V2](../../codplay/plan/move-contract-plan.md) et
  [module `runtime/motion`](../../codplay/src/runtime/motion/README.md), qui
  fournissent déjà le path SVG `M/L/A`, sa normalisation et son parcours.
- [compilateur de path SVG V2](../../codplay/src/scene/compiled/move-path-compiler.ts)
  et [fixture `flip-stress`](../../demos/src/v2/demos/flip-stress/main.ts), qui
  montrent respectivement la conversion auteur → path préparé et l'emploi réel
  d'arcs SVG avec `arc-length`.
- [documentation d'interface fournie pour l'éditeur de mouvement](https://chatgpt.com/share/6a97ef3a-6094-83eb-93b2-852481c2edd6),
  qui fait foi pour la présentation de la poignée et du champ de durée ; ce
  plan ne redéfinit pas ces options.

Les versions antérieures, leurs API et leurs circuits ne sont pas normatifs et
ne seront pas portés comme une seconde voie. Le `Move` structurel V2 du runtime
(`target`, parentage, ordre, reparentage) est également distinct de la présente
feature : déplacer visuellement un item entre deux poses d'un même item ne doit
pas être transformé en changement de parent ou d'ordre.

Le Selection Frame (CS) est déjà, par son contrat V2, une surface d'authoring
hors scène. La présente feature reprend ce contrat sans le modifier. Le ghost et
le path rendu suivent la même frontière : ce sont des artefacts de positionnement
temporaires, ni des items de scène, ni des enfants de capsule. La description
déclarative du path, elle, est une capacité optionnelle de chaque `Decor` et
peut être sérialisée ; elle ne doit jamais être confondue avec l'overlay visuel
qui la projette. Cette capacité décrit le segment entrant vers le KF auquel le
Decor est référencé. Une droite n'est pas enregistrée : l'absence de `path`
signifie la trajectoire droite par défaut. Le même porteur servira plus tard
pour un déplacement vers la position d'une zone de capsule ; l'interface de ce
cas reste reportée à la définition de l'éditeur de zones. La trajectoire doit
réutiliser la capacité CodPlay V2 existante (`prepareSvgPath`/`resolvePath` et le
runtime de présentation), sans nouvelle grammaire ni nouveau solveur de path.
Leur cycle de vie visuel est celui du CS : ils sont montés, actualisés et retirés
avec la même session d'overlay, sans cycle parallèle à définir.

## 2. Objectif utilisateur

Sur un item posé à un keyframe, l'auteur doit pouvoir choisir entre :

1. **repositionnement** : réutiliser la capacité existante du CS pour modifier
   la pose de l'item au keyframe courant (translation/transform ou aire de
   grille, selon le décor) ;
2. **déplacement** : créer un nouveau keyframe cible à partir de la pose source,
   interpoler la position selon une trajectoire et avancer la tête de lecture
   jusqu'à ce nouveau keyframe.

Les deux opérations sont un geste souris/trackpad de cliquer-déplacer ; leur
différence vient de la zone d'interaction retenue par l'authoring : une bande
intérieure de 12 px est réservée au repositionnement et la zone centrale au
déplacement. Le CS conserve la priorité sur cette bande et ses poignées ; le
pointeur indique le rôle courant. Après le lâcher
d'un déplacement :

- le chemin reste visible ;
- la pose source devient un ghost ;
- la pose cible devient active et porte le Selection Frame ;
- les propriétés de décor et la pose cible restent éditables ;
- un clic sur le ghost source inverse source/cible ;
- un clic sur le chemin ouvre l'édition du chemin ;
- le point médian d'une droite peut être tiré pour former une courbe ;
- un double-clic sur ce point remet le chemin droit.

La durée par défaut annoncée est `500 ms`. Elle détermine le temps du nouveau KF
cible (`target.timeMs = source.timeMs + durationMs`) : il n'y a pas, dans cette
première définition, une durée de mouvement indépendante du placement du KF. Une
poignée au point cible propose des durées prédéfinies ; une valeur précise est
saisissable dans la zone de décor. Changer cette durée déplace le KF cible et la
tête de lecture avec lui. Le KF reste ensuite un KF normal : il peut être
modifié ou supprimé par les commandes ordinaires du sequence-editor.

## 3. État vérifié avant la feature

| Frontière | État V2 constaté | Manque pour l'éditeur de mouvement |
| --- | --- | --- |
| Document ed2 | `Item.keyframes[]` contient `timeMs`, `decorId`, `transitionIn/out`; `Decor.offset` porte la pose unitless (`translate`, dimensions, rotation, échelle, axe). Le CS sait déjà produire le patch de pose du KF courant. | Le champ `Decor.path` est maintenant présent dans le modèle V2 pour un trajet non rectiligne ; son absence signifie une droite. Il s'applique au segment entrant du KF cible et ne remplace pas les transitions de visibilité. La durée reste liée à `target.timeMs - source.timeMs`. |
| `decor-editor` | Le bridge résout la cascade, projette la pose en px, fait `snapshot.set()` pendant la preview, puis committe par commande xState. Les temps interpolés restent éditables et le candidat temporaire survit à un seek/rebuild selon le contrat V2. | Il n'y a ni état source/cible, ni ghost, ni sélection d'un segment, ni édition de chemin/durée. |
| `SelectionFrameV2` | Le cadre neutre émet `move`, `resize`, `rotate`, `pivot`; la rotation et l'axe sont des modifieurs réutilisables. Le cadre ne connaît ni document, ni player, ni unités. | Le repositionnement réutilise ce canal existant. Seul le routage de l'autre intention (déplacement temporel) et la surface path/ghost doivent être ajoutés sans mettre le vocabulaire métier dans le cadre neutre. |
| `sequence-editor` | La machine et les commandes sont pures ; elle sait créer, déplacer et supprimer des KFs et afficher les bandes de transitions. | Aucun événement « create/edit motion segment », aucune durée de déplacement et aucun éditeur de chemin. |
| Builder V2 | `buildInterpolationActions` produit des tweens de style (y compris les canaux de pose) entre KFs adjacents ; `Transition` peut déjà porter une durée et un easing. | Le builder ed2 ne branche pas encore une relation de path sur l'interpolation de pose. Il faut adapter le segment ed2 vers le contrat V2 existant, sans réimplémenter la géométrie. |
| Runtime V2 | `runtime/motion` résout déjà une trajectoire immuable à temps absolu ; le contrat V2 accepte une transition SVG `M/L/A`, la normalise et utilise `arc-length` par défaut. Play et Seek partagent le même graphe. | Le travail porte sur l'adaptateur ed2 et la frontière de présentation, pas sur un nouveau moteur de trajectoire. Le `Move` structurel ne doit toutefois pas être détourné pour représenter ce déplacement de pose. |
| Capsules | La capsule orchestre la fenêtre temporelle de ses enfants ; la racine implicite représente la scène et n'est pas un item sélectionnable. | Le prototype vise les KFs documentaires réels d'un item ; le trajet vers une zone de capsule réutilisera le même `Decor.path`, mais son interface et la question des KFs virtuels restent dans la tranche zones. |

## 4. Sémantique du premier incrément

### 4.1 Repositionnement et déplacement

Le **repositionnement** n'est pas une nouvelle capacité : il réutilise le CS et
son canal de pose au keyframe courant. Selon le décor, le patch modifie la
translation/transform ou l'aire de grille. Il reste local à ce KF et ne crée ni
segment ni KF supplémentaire.

Le **déplacement** est le même type de geste physique (cliquer-déplacer), mais
sur la zone d'interaction dédiée à cette intention. Il produit une relation
temporelle `source → cible` pour un même item :

1. la pose du KF source est le point de départ ;
2. le point de lâcher donne la pose du nouveau KF cible ;
3. le nouveau KF est créé à `source.timeMs + durationMs`, avec `durationMs =
   500` par défaut ;
4. la tête de lecture se place sur le KF cible ;
5. le source devient ghost et la cible devient l'item actif avec le CS ;
6. l'auteur peut alors modifier normalement le décor cible (pivot, rotation,
   resize, couleur, aire de grille, etc.) ;
7. la cible peut ensuite être déplacée ou supprimée par les commandes ordinaires
   du sequence-editor.

Le segment ne change ni `parentId`, ni `order`, ni la visibilité structurelle de
l'item. Sa durée est dérivée de l'écart temporel entre les deux KFs. Modifier la
durée modifie donc `target.timeMs`, avance la tête de lecture et conserve la
relation source/cible ; déplacer ultérieurement le KF par la timeline suit la
même règle temporelle.

La donnée de trajectoire est portée par le `Decor` référencé par le KF cible,
selon la décision utilisateur. Le champ `path` est optionnel : il est écrit
uniquement lorsque le trajet diffère de la droite source→cible ; son absence
représente cette droite. Le champ décrit le segment entrant vers ce KF, sans
devenir un item de scène, et le décor conserve ainsi un seul porteur de
transition. La règle de portée et d'isolation lorsque les décors sont partagés
reste à arrêter avec le copy-on-write habituel (un path ne doit pas se propager
par inadvertance à un autre segment). La durée reste dérivée des temps des KFs
et les transitions nommées d'entrée/sortie gardent leur rôle de visibilité.

Une affectation ultérieure d'un item à une zone de capsule utilisera le même
champ `Decor.path` pour consigner son trajet vers la pose de la zone. Sa surface
d'interface et ses règles de résolution sont volontairement renvoyées au
chantier de définition des zones ; cette tranche ne préjuge pas de ce panneau.
Le `zoneId` reste une affectation discrète au KF cible : le `path` décrit
uniquement la transition visuelle vers la pose résolue de la zone et ne devient
pas une interpolation de classe ou de grille.

### 4.2 Géométrie du chemin

La trajectoire n'est pas à inventer dans l'éditeur : elle réutilise le contrat
CodPlay V2 existant, dont la forme auteur est un chemin SVG et dont le runtime
prépare les segments `M`, `L` et `A`. L'éditeur ne persiste donc pas un tableau
de pixels ni un solveur concurrent ; il écrit dans le décor cible la description
SVG attendue par `prepareSvgPath`, puis laisse CodPlay la normaliser et la
résoudre. La fixture `flip-stress` sert de référence d'usage : ses chemins
`M … A …` sont déclarés côté auteur puis compilés, jamais reparsés par le
runtime HTML.

Première tranche de l'éditeur :

- dans l'overlay, chaque extrémité est attachée au centre visuel de la pose
  source ou cible ; le builder consigne `pathAnchor: 'center'` dans la
  transition V2, afin que le runtime suive ces mêmes centres affines sans
  sérialiser un centre en pixels ;
- le chemin par défaut est une droite ;
- l'édition ne possède qu'un point de contrôle au milieu ;
- déplacer ce point définit l'arc circulaire passant par les trois points
  centre-source, point médian et centre-cible ; l'orientation et le choix
  petit/grand arc en découlent avant encodage SVG `A` ;
- si les trois points sont colinéaires (ou si les extrémités sont confondues),
  le trajet reste une droite et aucun `path` n'est enregistré ;
- le double-clic sur le point supprime le champ `path` et restaure la droite
  implicite ;
- le point de contrôle est une donnée d'authoring projetée, jamais une mesure
  DOM persistée ;
- la compilation/résolution réutilise `prepareSvgPath`/`resolvePath`, avec la
  normalisation V2 `[0,0] → [1,0]` et le parcours `arc-length` par défaut du
  runtime.

Le repère d'affichage peut rester celui de la scène/du parent résolu ; les
coordonnées SVG auteur sont normalisées par CodPlay et ne doivent pas stocker
des pixels de viewport dans le document. Les capsules imbriquées doivent
réutiliser la composition de poses déjà fournie par le runtime, sans créer un
nouveau repère de trajectoire. Il ne faut pas en déduire que les items sont
modélisés par leur « top-left » : dans V2, la pose auteur reste affine
(`origin` + matrice + dimensions). Le centre affiché par l'overlay est dérivé
de cette pose affine dans le repère de présentation choisi ; il ne devient pas
une mesure de bounding box persistée ni une origine normative de CodPlay.

Une capture ponctuelle d'ancre monde peut rester la couture de présentation
prévue par le runtime pour caler un artefact d'overlay. Elle ne sert ni à
construire la pose auteur, ni à alimenter la trajectoire à chaque frame ; les
dimensions locales et la pose affine restent les données de référence.

Le runtime HTML expose `rect.left/top` comme des valeurs AABB dérivées et peut
encore s'en servir pour les transitions qui ne déclarent pas d'ancrage. Pour le
segment ed2, `pathAnchor: 'center'` calcule les extrémités depuis
`origin + matrix × (dimensions locales / 2)` puis reconstruit l'origine affine
à chaque frame ; aucune bounding box n'est la source de vérité et aucun pixel
de viewport n'est persisté. L'invariant à la frontière est que la pose
présentée suit le path que l'interface montre, avec des extrémités et un point
intermédiaire concordants, y compris après rotation et redimensionnement.

### 4.3 États d'édition proposés

Le module de mouvement porte un état éphémère distinct du document :

```text
idle
  ├─ repositioning (pose du KF courant via le CS existant)
  └─ drawing-motion (source active, cible/ghost suit le pointeur)
       └─ target-active (lâcher validé, nouveau KF et chemin)
            ├─ source-active (clic sur le ghost source)
            ├─ path-editing (clic/drag du point de contrôle)
            └─ duration-editing (poignée ou champ numérique, déplacement du KF)
```

Le repositionnement suit directement le canal V2 existant du CS : preview logique
par `instance.snapshot`, puis commande de décor au commit. Le déplacement ajoute
le KF cible et sa relation de trajectoire au commit du drop ; la tête de lecture
est ensuite alignée sur ce KF. Tant que la souris n'est pas relâchée, `Échap`
annule le tracé et ne produit aucun KF, décor ou path. Après le drop, l'annulation
et le rétablissement relèvent du mécanisme undo/redo de l'application ; la
création du KF, du décor porteur et du path doit constituer une transaction
annulable cohérente. Aucun simple Play/Seek ne justifie le remplacement d'une
instance.

La session d'overlay reste donc distincte du document après le drop ; son cycle
de vie est celui du CS hôte et suit ses règles de désélection, reconstruction et
destruction.

### 4.4 Source, cible et décor

Après le lâcher, la cible active reçoit le Selection Frame V2, la tête de lecture
se place sur son `timeMs` et le source devient ghost. Le déplacement du cadre
cible et les panneaux de décor modifient le décor de la cible par le même canal
que toute autre édition. Le chemin de position ne doit pas écraser les
dimensions, la rotation, l'axe, la couleur ou les autres propriétés que l'auteur
édite à la cible : la trajectoire de translation et la pose finale du décor sont
deux canaux distincts. La poignée de durée ne change pas la pose cible ; elle
change l'intervalle temporel et donc le `timeMs` du KF cible.

Le statut temporaire continue de signifier « pas encore de décor documentaire »
et non « lecture seule ». Si le geste crée un KF, sa capture doit conserver à la
fois les valeurs interpolées au temps visé et l'intervention utilisateur,
conformément au mécanisme actuel de capture d'insertion. Le KF créé est ensuite
un KF ordinaire : les commandes existantes de modification et suppression
restent la voie normative.

### 4.5 Ghost et artefacts d'authoring

Le ghost et le path sont des projections de la surface d'authoring et ne
deviennent jamais des items de scène. Pour la première tranche, le ghost est
géométrique : un outline pointillé de la boîte et de sa transformation, avec un
fond transparent. L'outline est le signal principal, car l'item source peut
déjà être transparent ; aucun remplissage translucide n'est requis.
Il peut afficher le centre, les extrémités et les repères nécessaires au path,
mais il ne porte pas le CS lorsque la cible est active. Le CS reste attaché à
l'item actif, conformément à son contrat existant ; après un clic sur le ghost
source, les rôles s'inversent et le CS suit le nouvel actif.

Une projection ultérieure du contenu exact serait une extension d'overlay
séparée. Elle ne doit ni cloner ni muter un nœud du player et n'est pas requise
pour accepter cette première tranche. Le ghost et le path sont attachés à la
même session de CS : ils suivent son montage, ses mises à jour et sa destruction.

## 5. Architecture modulaire proposée

La séparation suivante respecte la règle des modifieurs réutilisables :

```text
motion-geometry (fonctions pures : centres, normalisation, courbe, hit-test)
        │
        ├─ motion-overlay / motion modifier réutilisable
        │     (zones central/bord, chemin, point de contrôle, ghost, curseurs)
        │
        ├─ decor-editor bridge
        │     (source/cible, projection px↔unitless, snapshot, commit/abandon)
        │
        └─ sequence-editor adapter
              (création du KF cible, durée, affichage et déplacement timeline)
                         │
                         ▼
                    builder ed2 → CodPlay V2 motion
```

La localisation exacte reste à arrêter après les réponses :

- les primitives sans document ni player peuvent vivre dans un package authoring
  dédié (`packages/authoring/motion-editor`) ;
- la composition avec `SelectionFrameV2` doit rester une capacité indépendante,
  au même titre que `createRotationModifier()` ;
- la sémantique ed2 (KFs, snapshot, décor, capsules) reste dans
  `packages/editor`, jamais dans le package bas niveau ;
- le ghost géométrique de première tranche est rendu par l'overlay ; aucune
  projection fidèle du contenu n'est requise pour ouvrir cette feature.

Le point de routage central/bord devra être générique : le cadre neutre ne doit
pas connaître « mouvement temporel » ou « repositionnement ed2 ». Il peut exposer
une politique de réservation/ownership du corps et des bandes de bord, ou le
module peut monter une surface d'interaction dédiée ; le choix dépend du conflit
avec les poignées resize/rotation et doit être testé sous rotation/échelle.

### 5.1 Frontière ACE — décision différée après stabilisation de la trajectoire

ACE appartient actuellement au dépôt CodPlay et fournit les primitives pures
partagées par le builder, le runtime et l'éditeur. Le raccord `temp` actuel
(`ace` aliasé vers `packages/codplay/src/ace`) est conservé uniquement pour
éviter de dupliquer le solveur pendant les essais de path, de centre et de
seek. Il ne doit pas être présenté comme un contrat public V2.

Après validation de la géométrie et de la couture Play/Seek/rebuild, ouvrir une
décision d'architecture entre deux options :

- **frontière façade CodPlay** : exposer une capacité pure et typée depuis la
  frontière publique CodPlay, sans la rattacher à `instance.telco`, au DOM ou à
  un état de player ; cette option conserve la propriété CodPlay mais élargit
  sa surface publique et exige une décision du plan du core ;
- **bibliothèque ACE indépendante** : extraire les primitives sans état dans un
  package partagé par CodPlay et l'éditeur ; cette option clarifie la
  réutilisation mais impose un contrat de package, de version et de dépendance.

Invariant pour les deux options : un seul préparateur/résolveur canonique, les
mêmes paramètres (`arc-length`, précision et easing) pour builder, runtime et
overlay, et aucune lecture DOM pour calculer la trajectoire. La décision devra
être accompagnée d'une migration des imports, des tests et du build ; elle ne
doit pas être simulée par un second solveur. Tant que cette décision n'est pas
prise, le raccord `temp` reste isolé, le plan demeure `En cours` et aucune
refonte du core n'est engagée.

## 6. Décisions à prendre avant le code

### Décisions fixées pour le prototype d'usage

- Aucun outil supplémentaire n'est introduit pour l'instant : le geste reste
  porté par la flèche de sélection et sa surface d'authoring.
- À titre d'hypothèse testable, une bordure intérieure de `12 px` mesurée depuis
  le bord de l'item est réservée au repositionnement via le CS ; la partie
  centrale restante déclenche le déplacement temporel. Les curseurs sont
  distincts au survol.
- Cette séparation est volontairement modulaire et révisable après les tests
  d'usage. Les petites dimensions et autres cas limites de largeur de bande sont
  différés ; ils ne doivent pas conduire à une règle implicite dans cette
  tranche.
- Une collision temporelle est un cas rare (la durée initiale est courte). Pour
  l'expérimentation de fusion prévue en seconde étape, le KF/Decor le plus
  récent surcharge les propriétés déjà définies dans le décor conservé. Si le
  nouveau KF dépasse un autre KF sur la timeline, l'ordre chronologique fait de
  ce KF dépassé la nouvelle source et la durée se déduit des deux temps. Ce cas
  doit d'abord être testé en réel car l'effet peut être perturbant ; il n'est
  pas une porte de la première tranche.
- Tout `Decor` peut porter un champ `path` optionnel pour son segment entrant.
  Une trajectoire droite est implicite et n'est donc pas enregistrée ; les
  options de choix de path et d'easing viendront plus tard. L'affectation d'un
  item à une zone de capsule réutilisera ce même champ, mais son interface est
  reportée au chantier des zones.
- Dans l'interface, le path est représenté entre les centres visuels des poses.
  Le builder consigne `pathAnchor: 'center'` ; le runtime dérive les mêmes
  centres affines et reconstruit l'origine de l'item sans persister de pixels.
- L'orientation ou la taille suivant la tangente du path ne sont pas fabriquées
  par l'éditeur : la capacité sera d'abord construite et stabilisée dans
  CodPlay, puis seulement exposée par l'éditeur.
- Le support tactile vise les tablettes dès que la surface de geste sera
  implémentée ; la multi-sélection est prévue dans une tranche ultérieure.
- Le déplacement démarré depuis un état `isTemporary` est une évolution
  ultérieure. L'édition CS à un temps temporaire et sa capture lors de la
  création volontaire d'un KF restent, elles, conformes au contrat V2 existant.
- Les transitions nommées d'entrée et de sortie restent attachées aux bornes de
  visibilité du premier et du dernier KF ; la trajectoire ne les modifie pas par
  effet de bord.
- `Échap` annule uniquement un tracé non relâché. Après le drop, undo/redo est
  une responsabilité de l'application et doit regrouper l'opération documentaire.

### Questions reportées hors du premier incrément

1. **Portée du `Decor.path` — décision appliquée dans cette tranche.** Le champ est
   strictement attaché au segment entrant du KF cible, n'est pas hérité par les
   KFs suivants et fait l'objet d'un fork copy-on-write si le décor est partagé.
   L'absence de `path` représente la droite implicite ; la remise à la droite
   supprime le champ (aucun sentinelle `null`). La durée demeure dérivée des KFs
   et les transitions nommées de visibilité restent hors du `path`. Les règles de
   partage volontaire d'un même trajet seront précisées avec la persistance et
   les zones, sans modifier le premier geste.

Les collisions et l'état temporaire sont donc explicitement reportés à une
évolution testée séparément ; ils ne bloquent pas le premier geste source KF →
KF cible.

2. **Frontière ACE.** ACE reste une brique CodPlay partagée pendant la mise au
   point de la trajectoire. L'arbitrage entre appel par une capacité pure de la
   façade CodPlay et extraction dans une bibliothèque indépendante est reporté
   après la validation géométrique et Play/Seek/rebuild. Le raccord `temp`
   actuel n'autorise ni API publique improvisée ni second solveur.

### Importantes mais non bloquantes pour le premier prototype validé

3. **Easing temporel.** Le parcours spatial `arc-length` est fourni par le runtime
   V2. Pour la première tranche, quel défaut employer (linéaire ou défaut ed2),
   sachant que le sélecteur d'easing viendra ultérieurement dans le décor ?
4. **Clics sur overlay.** Quelle tolérance de hit-test pour le path et son point
   médian ? Le clic sur le path sélectionne-t-il toujours le segment sous le CS,
   et le double-clic du point de contrôle doit-il produire une commande undoable ?

## 7. Découpage d'implémentation

Le plan est `En cours` et l'implémentation du premier incrément est autorisée.
Les portes ci-dessous restent des critères d'acceptation : elles ne réouvrent
pas le périmètre validé et ne justifient aucune modification opportuniste du
`sequence-editor` ou du core CodPlay. La seule extension core de cette tranche,
`MoveTransition.pathAnchor`, est explicitement documentée et limitée à
l'alignement affine du path.

### P0 — Contrat et scénarios acceptés — Fait pour le premier incrément (2026-09-02)

- répondre aux questions §6 ;
- figer les termes, la source/cible, la propriété documentaire dans le décor
  cible, la relation durée/`timeMs`, le routage centre/bord, le `path` optionnel
  du décor (droite implicite), la conversion arc SVG, la convention visuelle du
  centre dans l'overlay et le ghost ;
- produire un diagramme des états et des invariants ;
- confirmer l'adaptation au contrat de trajectoire CodPlay V2, avec l'extension
  ciblée `MoveTransition.pathAnchor` (`center`/`aabb`) nécessaire pour aligner
  la pose rendue sur le path visible ; cette extension ne modifie ni la
  géométrie ACE ni le parentage.

**Porte :** spécification V2 du segment, de la surface ghost géométrique et de
la règle de sélection des deux intentions validées.

### P1 — Domaine pur et géométrie — Fait pour le premier incrément (2026-09-02)

- types sérialisables du segment et de la capacité path du décor (après décision
  P0) ;
- centres visuels source/cible calculés pour l'overlay depuis les poses affines,
  conversion du point de contrôle vers l'arc circulaire SVG existant,
  droite/arc et hit-test ; une droite reste représentée par l'absence de `path`,
  et aucune coordonnée AABB de viewport n'entre dans les données auteur ;
- la durée reste exposée par la constante `500 ms` du premier geste ; la poignée,
  les presets et le champ numérique sont différés à la tranche durée dédiée,
  selon la documentation d'interface fournie ;
- tests sans DOM, player ni document mutable.

**Porte :** invariants mathématiques, limites, double-clic de remise à zéro et
parcours temporel couverts.

### P2 — Surface modulaire et gestes — Première tranche implémentée (2026-09-02)

- modifieur/capacité réutilisable pour le chemin, le point de contrôle, les
  ghosts et les curseurs ;
- routage d'essai `12 px` intérieur / centre sans casser repositionnement,
  resize, rotation, pivot et poignées ; politique remplaçable après validation
  d'usage ;
- états drawing/source-active/target-active/path-editing sont couverts par
  l'overlay ; `duration-editing` reste différé avec la durée ;
- utilisation systématique de `gesture-session`, `overlay-pose` et
  `handle-geometry` existants ;
- aucun accès au document ou au nœud player.

**Porte :** tests de gestes droits, tournés, redimensionnés, annulés et tactiles
sur tablette ; la multi-sélection reste hors de cette porte et sera couverte
dans une tranche ultérieure.

### P3 — Intégration `decor-editor` — Première tranche implémentée (2026-09-02)

- projection des poses source/cible en px locaux puis retour unitless au bridge ;
- preview par `snapshot.set()` et abandon par `snapshot.clear()` ;
- édition du décor cible par le Selection Frame et les panneaux existants ;
- bascule source/cible et maintien du chemin ;
- déplacement de la tête de lecture sur le KF cible après le drop ;
- capture d'un candidat interpolé et d'une intervention simultanée reste couverte
  par le pont existant ; le déplacement depuis un candidat temporaire est différé
  conformément au périmètre validé ;
- commit xState avec une seule voie d'historisation.

**Porte :** tests bridge/machine et preuve qu'aucun accès node/player ni écriture
documentaire n'a lieu avant commit.

### P4 — Intégration `sequence-editor` — Différé explicitement

- événements et commandes purs de création/édition/suppression du segment et de
  son décor porteur ;
- ajout du KF cible à `source.timeMs + durationMs` selon la règle P0 ;
- affichage de la durée et de la relation source→cible ;
- poignée de presets et champ précis selon la documentation d'interface fournie ;
- déplacement du KF et de la tête de lecture lors d'une modification de durée ;
- modification et suppression ultérieures du KF par les commandes ordinaires ;
- émission d'une transaction d'application regroupant création du KF, décor
  porteur et path pour l'undo/redo ;
- maintien des bornes de visibilité, transitions héritées et capsule racine.

**Porte :** machine, rendu SVG et contrôleur restent décor-agnostiques et ne
possèdent aucune deuxième scène.

### P5 — Builder et runtime V2 — Adaptateur implémenté, preuve navigateur restante

- traduire le segment ed2 vers la frontière de trajectoire CodPlay V2
  (`prepareSvgPath`, puis `pathAnchor: 'center'` sur le canal de présentation
  qui consomme le path) ;
- réutiliser ACE et le graphe de mouvement à travers une frontière V2 explicite ;
  ne pas détourner le `Move` structurel ;
- dépendre d'une capacité CodPlay d'orientation ou de taille suivant la tangente,
  à construire et stabiliser dans un plan CodPlay préalable ; l'éditeur ne fera
  ensuite qu'exposer cette capacité, dans une tranche dédiée ;
- vérifier à cette frontière que le centre visuel rendu suit le centre du path
  affiché, sans imposer au runtime le repère de l'overlay ni introduire de
  mesure DOM par frame ; cette preuve est couverte par le champ V2
  `MoveTransition.pathAnchor` (`center`/`aabb`) et le test de pose affine ;
- faire coexister trajectoire de position, dimensions, rotation, couleur et
  transitions de visibilité ;
- préserver la résolution absolue identique Play/Seek, sans mesure DOM par frame ;
- l'extension ciblée de `packages/codplay` reste limitée à la donnée de contrat
  `pathAnchor`, à sa propagation pure dans le graphe et à la couture de capture
  HTML `layoutOrigin` nécessaire pour appliquer cette pose sans décalage ; elle
  ne crée ni nouveau moteur de path, ni mesure DOM par frame, ni circuit V1.

**Porte :** tests builder, player, Play, Seek, relecture, chevauchement et
rebuild ; aucune instance ne doit être remplacée pour un simple play/seek.

### P6 — Capsules, persistance et non-régression — À compléter

- items feuilles, capsules imbriquées, parent commun et racine implicite ;
- conserver le même porteur `Decor.path` pour un futur trajet vers une zone de
  capsule, sans construire ici l'interface ni la résolution des zones ;
- sérialisation/désérialisation du décor porteur et diagnostics de données
  invalides ;
- KFs documentaires réels pour le premier geste ; le déplacement depuis un état
  temporaire et les KFs virtuels restent des évolutions séparées ;
- expérimentation ultérieure des collisions : fusion avec override du plus
  récent, source recalculée selon l'ordre chronologique si un KF est dépassé,
  durée déduite ; validation UX avant d'en faire une règle stabilisée ;
- sélection, désélection, seek, abandon, reprise de lecture et redimensionnement
  de scène ;
- multi-sélection dans une tranche ultérieure, avec support tactile conservé pour
  la surface de geste dès le premier prototype tablette.

**Porte :** matrice complète de tests et documentation V2 mise à jour avant
clôture.

### P7 — Validation visuelle — Smoke exécuté, porte native restante

Sur le serveur déjà disponible en `127.0.0.1:5174`, sans lancer d'autre serveur,
rejouer dans **Safari Technology Preview** :

1. poser/sélectionner un item sur un KF ;
2. vérifier les curseurs et la distinction central/bord, au pointeur et sur une
   tablette tactile ;
3. repositionner par le CS au KF courant et vérifier qu'aucun KF n'est ajouté ;
4. tirer la zone de déplacement, observer la droite, le ghost géométrique à
   outline pointillé et fond transparent, puis le nouveau KF ;
5. lâcher, vérifier le déplacement de la tête de lecture et l'inversion
   source/cible, puis tourner/redimensionner et modifier le décor cible ;
6. régler une durée prédéfinie puis une durée précise, vérifier que le KF et la
   tête de lecture avancent ensemble ;
7. cliquer le ghost source et le chemin, courber puis réinitialiser le chemin ;
   vérifier que la droite réapparaît sans champ `path` dans le décor cible ;
8. modifier puis supprimer le KF dans la timeline par les commandes ordinaires ;
9. seek avant, pendant et après le segment, puis Play/Pause ;
10. recharger/rebuild et vérifier la persistance et l'absence de saut.

Le smoke du 2026-09-02 couvre les étapes 1, 4, 5 (création et rôles), 7 (arc
et état du décor) et une lecture jusqu'à la fin. Les étapes de geste natif,
tactile, durée, collision, édition/suppression timeline et relecture
seek/rebuild restent à exécuter manuellement avant de stabiliser la tranche.

L'automatisation ne doit pas être annoncée comme preuve tant que les contrôles
nécessaires de Safari Technology Preview ne sont pas activés. La preuve doit
inclure les rectangles/états observables et les erreurs console, pas seulement
une impression sur une frame.

## 8. Matrice d'acceptation minimale

| Cas | Résultat attendu |
| --- | --- |
| Drag central dans la zone de déplacement | Un nouveau KF cible est créé selon `source.timeMs + durationMs` ; la tête de lecture s'y place et source/cible sont distinguées. |
| Drag dans la bande de repositionnement | Le patch de pose du CS modifie seulement le KF courant ; aucun segment ni KF implicite n'est créé. |
| Collision temporelle (seconde tranche) | Fusion selon les règles du décor : le plus récent surcharge les propriétés déjà définies ; si un KF est dépassé, la source est recalée selon l'ordre chronologique et la durée se déduit. La compréhension de cette interaction doit être validée visuellement avant stabilisation. |
| Resize/rotation/pivot de la cible | Le ghost source reste stable ; le décor cible reçoit les patches par le canal V2 existant. |
| Courbe | L'arc SVG passe par le point médian déplacé ; pour une droite, le champ `path` reste absent ; le double-clic supprime un éventuel path et restaure exactement la droite implicite. |
| Durée | La poignée et le champ modifient le delta temporel ; le KF cible et la tête de lecture avancent ensemble ; la timeline et le décor affichent la même donnée. |
| Décor porteur | Un path non rectiligne est enregistré une seule fois dans le décor du KF cible ; une droite n'ajoute aucun champ `path`, aucun path n'est copié vers le source ou les transitions de visibilité. |
| Échap avant le drop | Le tracé est annulé sans créer de KF, de décor ni de path. |
| Undo/redo après le drop | L'application annule/rétablit en une seule transaction la création du KF, du décor porteur et du path. |
| Seek/Play | Même pose à même temps absolu ; pas de branche DOM historique, pas de remplacement d'instance pour une simple lecture. |
| Seek/rebuild pendant preview | Le candidat non persistant est annulé ou restauré suivant la règle P0, jamais écrit silencieusement dans le document. |
| Premier/dernier KF et capsule | Les transitions de visibilité et la distribution de capsule restent conformes à leurs contrats V2 ; le chemin ne change pas les bornes par effet de bord. |
| Parent transformé/redimensionnement | Le chemin et les ghosts restent dans le repère d'affichage décidé, sans pixels AABB persistés ; le centre visuel rendu reste aligné sur le path malgré la transformation. |
| Donnée invalide | Diagnostic V2 explicite ; aucune trajectoire partiellement interprétée. |

## 9. Risques à traiter explicitement

- **Confusion avec le `Move` runtime :** un chemin d'animation de pose entre KFs
  ne doit pas déclencher une politique de parentage, d'ordre ou de reparentage.
- **Conflit de gestes :** le corps du cadre sert déjà le repositionnement et émet
  `move`, tandis que les bords portent les poignées `resize` et le modifieur
  rotation réserve parfois un point. Le déplacement temporel doit utiliser une
  zone distincte sans casser ces capacités ; la priorité doit être déclarée et
  testée, jamais déduite d'un z-index.
- **Ghost géométrique :** le ghost est volontairement neutre et hors scène. Son
  outline pointillé à fond transparent doit rester lisible même lorsque l'item
  source est transparent ; aucun clone de nœud, lecture DOM ou second circuit de
  materialization n'est admis.
- **Durée et `timeMs` :** la durée du déplacement est le delta entre les KFs et
  non une durée de transition de visibilité. Le builder doit éviter de réutiliser
  `transitionIn/out` comme raccourci documentaire.
- **Décor porteur :** le path est une capacité optionnelle de tout décor, portée
  par le segment entrant du KF qui le référence ; une droite est implicite. Les
  règles de décor (référence par KF, fusion et réutilisation) doivent empêcher
  qu'un path segment-local soit hérité ou partagé par inadvertance et qu'une
  collision crée deux chemins concurrents pour une même transition.
- **Capsules :** un KF virtuel est calculé par distribution et n'est pas un état
  documentaire ; le rendre implicitement éditable changerait le contrat de la
  capsule.
- **Arc et redimensionnement :** des coordonnées pixels persistées seraient
  fausses après resize. Le chemin doit rester une description SVG V2 dans le
  repère normalisé retenu et être projeté pour l'affichage ; l'arc circulaire
  est défini par les deux centres et le point médian, avec repli droit dans les
  cas dégénérés.
- **Repères overlay/runtime :** le centre du path est la convention visuelle
  partagée par l'overlay et `pathAnchor: 'center'`. Le runtime conserve son
  repère affine interne, mais dérive les mêmes centres et reconstruit l'origine
  sans faire de `rect.left/top` une source de vérité ni les persister. Les tests
  de rotation et redimensionnement couvrent cette couture ; aucune mesure DOM
  n'est effectuée par frame.

**Le plan reste `En cours`.** Les décisions de sémantique, de durée par défaut,
de routage expérimental, de portage dans le décor et de réutilisation du path V2
sont intégrées et autorisent le premier vertical slice. La poignée de durée, les
collisions, l'undo/redo applicatif, les KFs temporaires et la refonte du
`sequence-editor` restent des évolutions séparées. La frontière d'appel d'ACE
(façade CodPlay ou bibliothèque indépendante) est également une décision
postérieure à la mise au point de la trajectoire ; le raccord `temp` actuel ne
préjuge pas de cette décision. La validation visuelle et la matrice de
non-régression doivent encore être exécutées avant de stabiliser la
spécification V2.
