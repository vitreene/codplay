# Notes — construction de l'app (discussion, non normatif)

Matière de travail du plan `../2026-07-10-app-construction-plan.md` : origine, hypothèses, points non tranchés. Rien ici n'est une décision.

## Origine (2026-07-10)

Recadrage utilisateur : les chantiers 1-7 du plan général ne sont que des préalables à la construction de l'app elle-même ; l'app passe devant les points 8/9 — le décor attend. Séquence dictée : contrôleur général, maquette de page recevant les composants, récupération/adaptation des composants d'Eddy, sauvegarde provisoire localStorage, backend prisma-sqlite ensuite (« on élaborera les modèles à ce moment-là »). Autres cadres posés dans la même séance : pas de code avant un plan lisible et complet ; nouvelle interface en React, exceptions vanilla sequence-editor et codplay ; l'app a sa propre page index, démos hors périmètre.

## Hypothèses et points non tranchés

- **Backend — architecture react-router** : « pour écrire plus tard les données en backend, une architecture react-router pourrait servir » — piste pressentie, pas une décision ; se tranche à l'ouverture de l'étape 5. Le plan en retient une conséquence déjà ferme : le point d'entrée mince (étape 1), pour que le basculement du mode de service ne touche que cette couche.
- **Ordre des composants (étape 3)** : non fixé ; arbitré composant par composant avec l'utilisateur.
- **Périmètre de la récupération Eddy** : non fixé. Le plan général actait « seuls chutier + whisper réemployés » ; la formulation du recadrage (« récupérer les composants de Eddy et les adapter ») est plus large. Se règle sur invitation, composant par composant. Contexte : Eddy est un prototype porteur d'erreurs de design/code insolubles — la valeur d'une consultation est de voir comment un souci y a été abordé, la réponse n'étant pas forcément la bonne ; d'où la règle « jamais une référence » du cadre du plan.
- **Apparence du layout** : proportions et détail visuel pilotés par l'utilisateur en séance ; le plan ne fixe que la structure en cinq régions.
- **Versions des paquets (étape 1)** : arrêtées au moment de l'installation, avec l'autorisation.
- **Définition du contrôleur général** : désigné comme **fondamental** par l'utilisateur — sa définition et sa mise au point priment sur le reste. Le document de définition (états, contexte, événements, frontières) s'écrit et se valide à l'ouverture de l'étape 2, avant le code — la convention « cœur » du plan en fait une exigence ; la forme exacte de ce document reste libre. (Les qualificatifs d'importance de ce genre restent ici, dans la discussion — jamais dans le plan.)

## Modèle de données de l'app : EditorScene, item, content, capsule (2026-07-10)

Matière préparant une spec normative à venir (racine de `plan/`). Rien ici n'est tranché, sauf mention explicite.

### Point de départ (dicté)

ITEM relie un ensemble de données :
- il porte les informations de placement dans sequence-editor : son ordre, son parent, les liens avec les kf et les décors ;
- il est relié à un tableau de « décors » ;
- si son type est capsule : la liste des items enfants ;
- il est relié à « content », qui décrit le contenu de l'item (texte, média…). Distinction content/décor héritée de la pratique Eddy : content décrit le contenu comme decor décrit l'habillage. Question ouverte posée : content pourrait s'appliquer aussi à capsule, mais une autre structure serait peut-être plus adaptée.

« Capsule » retient les réglages qu'elle pousse sur ses enfants (distribution selon son sous-type).

### Existant à raccorder (état 2026-07-10)

- **item-model-spec** (fermée) : item = un perso au build + un `TrackNode` timeline + un `ItemType` ; id unique de bout en bout (TrackNode = dedit = perso). **§4 : pas de champ parent — l'arbre porte le nesting.** `itemType` doit remplacer `contentType` (pas encore fait : `sequence-editor/types.ts` porte toujours `contentType`).
- **capsule-spec** (fermée) : `CapsulePatch` §10 = exactement « les réglages poussés » (`behavior`, `defaultTransitionIn/Out`, `sequencing`, `staggerMs`, `grid`) ; distribution par sous-type §3 ; zones `card` §11 ; capsule racine §6.
- **`EditorScene`** (code, `sequence-editor/types.ts`) : `id`, `title`, `durationMs` + `durationSource`, `tracks` (arbre `TrackNode`), `decors` (`Record<id, EditorDecor>`), `rootDecorId`, `cues`, `markerTracks`, `audio`. Les décors sont déjà une table normalisée référencée par `Keyframe.decorId`.
- **Trou confirmé** : content n'existe pas dans le modèle — l'incrément Builder actuel le fait passer dans le décor (`build-scene.ts` : `content: introDecor?.data.content`, plus `style` au même endroit). La distinction content ≠ decor n'est pas encore matérialisée.

### Proposition en discussion

- **EditorScene (app)** = le document possédé par le contrôleur général : identité (`id`, `title`), temps (`durationMs`, `durationSource`, `audio`), items (l'arbre `tracks`), `decors` (table), **`contents` (table symétrique à `decors`)**, `cues`, `markerTracks`, `rootDecorId`.
- **Item** = l'entité de liaison : id (= id du perso), `itemType`, ses keyframes (placement/ordre), ses décors atteints via `keyframe.decorId`, son `contentId` → `contents` (items feuilles).
- **Content** typé par `ItemType` : `text` → `{text}`, `image`/`media`/`video` → `{src, …}` ; formes exactes à poser avec le mapping Builder.
- **Capsule** : pas de content — son contenu, ce sont ses enfants (`children`). Sa structure propre absorbe au passage :
  - `TrackNode.distribution` (`TrackDistribution` : `mode`/`staggerInMs`/`staggerOutMs`) — recouvre les réglages de distribution ; une seule structure, sinon on recrée une double déclaration qui dérive (précédent vécu : le `CapsuleKind` dupliqué, cicatrice commentée dans `types.ts`) ;
  - le `TrackNode.grid` provisoire (marqué « TEMPORARY, demo only » dans le code) → la grille de la capsule.

  > **MISE À JOUR (2026-07-12) — la structure capsule cible est `CapsuleDef`, pas `CapsulePatch`.** Ce passage disait « structure propre = `CapsulePatch` ». Décision finale : le modèle porte **un seul** type capsule, `CapsuleDef`, **sur l'item** (`Item.capsule`), statique (défini une fois). `CapsuleDef` **absorbe** ce que dedit appelait `CapsulePatch` (behavior, transitions par défaut, distribution, grille) — plus de dualité def/patch, et la capsule **sort du décor** (elle n'est pas keyframée). Détail : `app/2026-07-11-ed2-document-model.md`. `CapsulePatch` reste le **nom de code actuel de dedit** (`decor-editor/types.ts`) — c'est un point de migration, pas la cible.

### Points à trancher

1. **Parent et ordre** : champs portés par l'item (modèle plat/relationnel, à la Eddy/prisma : `parentId` + `order` sur l'item, arbre dérivé) **vs** dérivés de l'arbre (décision actuelle, item-model-spec §4). Exemple discriminant — déplacer un item d'une capsule A vers B : plat = deux champs changent ; arbre = retrait de `A.children`, insertion dans `B.children`. Impacts : backend relationnel, forme des mutations du contrôleur, consommation par sequence-editor. Si le plat est retenu : réouverture explicite d'item-model-spec §4, pas un patch silencieux.
2. **Content en table normalisée** référencée par id (symétrie avec `decors` — lecture directe de « j'ai distingué content comme je le fais pour decor ») **vs** embarqué dans l'item.
3. **Les décors d'un item** : uniquement atteints via ses keyframes, ou **aussi** un décor de base par item, hors keyframe (précédent existant : `rootDecorId` joue ce rôle pour la capsule racine) ?
4. **Formes de Content par `ItemType`** — à poser une fois 1-3 tranchés.

### L'état d'item vit dans le contrôleur central (question utilisateur, 2026-07-10)

Question posée : l'état d'item est aujourd'hui dispersé dans les composants — ne devrait-il pas vivre dans le contrôleur central ?

**Orientation : oui** — et c'est déjà la ligne du plan (« le contrôleur possède le document en cours ; toute mutation passe par un événement de la machine »). L'état d'item — type, content, keyframes, décors référencés, enfants et réglages de capsule — **est** le document : il vit une seule fois, dans le contexte du contrôleur général. C'est le remède direct au problème insoluble d'Eddy (état dispersé entre composants React et machines) qui a fondé la règle « XState possède l'état, React ne rend que ».

Conséquences concrètes, à porter dans le document de définition du contrôleur (étape 2) :
- **Aucun module ne possède de copie maîtresse.** Le sequence-editor actuel porte `scene: EditorScene` (et `selection`) dans le contexte de sa propre machine (`SequenceEditorContext`) — dans l'app, il ne sera plus propriétaire : il reçoit le document du contrôleur (projection en lecture) et émet des **intentions** de mutation (déplacer un kf, créer un item…) que le contrôleur applique ; le document mis à jour redescend. Refonte du branchement à prévoir — c'est le pont « îlot vanilla » de l'étape 2/3, sa forme exacte (acteur enfant invoqué, snapshot par événement…) appartient à la définition du contrôleur.
- **Ce qui reste local aux modules** : uniquement l'éphémère du geste — interaction en cours, viewport, survols. La frontière est déjà dans le plan (« le contrôleur ne possède pas l'état éphémère des gestes internes »).
- **La sélection est partagée** (timeline, panneau d'édition, dedit ensuite) → contrôleur, déjà acté.
- **Bénéfice type** : éditer le texte d'un item dans le panneau d'édition pendant que la timeline l'affiche = une seule mutation au contrôleur, les deux vues se mettent à jour ; aucune synchronisation croisée module-à-module.
- **Le Builder et l'acteur de persistance lisent le même document** au même endroit — un seul point de vérité pour construire et pour sauvegarder.

À confirmer comme décision lors de l'écriture de la définition du contrôleur ; la spec du modèle (section précédente) dira alors explicitement que l'EditorScene est possédé par le contrôleur.

### Sequence-editor comme fonction pure ? (question utilisateur, 2026-07-10)

Précision de cadrage : la pureté visée porte sur **les données item**, pas sur l'état interne du module (viewport, drag en cours, montage DOM — hors sujet ici).

Sur ce seul plan : **oui.** Toute mutation des données item que le sequence-editor sait produire (créer/déplacer/supprimer un kf, réordonner, créer un item…) s'exprime comme fonction pure `(EditorScene, intention) → EditorScene`. Le module **exporte** ces fonctions comme bibliothèque pure ; le contrôleur les applique sur le document qu'il possède. Le savoir métier timeline reste dans le module, la propriété du document reste centrale, et la mutation ne dépend que de ses entrées — pas de l'instance montée.

Ce que ça garantit sur les données : rejouer la même suite d'intentions sur le même `EditorScene` de départ redonne le même `EditorScene` — testable sans DOM, et socle de la restauration localStorage et du build reproductible.

Précédent maison exact : `zone-model.ts` (selection-frame) = fonctions pures `(state, args) → state`, séparées de la machine et du rendu. Sequence-editor suivrait le même partage pour ses mutations de données. L'état interne du module (comment il rend, comment il capture un geste) reste sa cuisine, hors de cette pureté.

### Édition d'un décor par action directe sur le DOM, avec enregistrement (question utilisateur, 2026-07-10)

Cas : un item est sélectionné, son kf aussi ; l'auteur change la couleur de fond dans la palette. Il existe un mécanisme d'aperçu direct sur l'élément DOM sélectionné — la donnée doit tout de même être enregistrée. Process voulu.

**Le décor est le seul cas où l'édition modifie le DOM en direct.** Content (texte, src) et réglages capsule passent par le contrôleur puis re-rendent ; le décor a en plus un aperçu immédiat sur l'élément monté, pour que l'auteur voie la couleur pendant qu'il la choisit. Cet aperçu ne remplace jamais l'enregistrement — il le précède visuellement.

**Ce que dedit fait déjà (état 2026-07-10, à réutiliser tel quel comme brique)** :
- `DecorPatch.style` est une **carte ouverte de valeurs CSS finales** (`Record<string,string>`) — la couleur de fond y est une chaîne (`background`/`background-color` → `"oklch(...)"` ou `"linear-gradient(...)"`), résolue par la palette AVANT d'être stockée, jamais gardée comme valeur intermédiaire (`decor-editor/types.ts`, commentaire du `DecorPatch`).
- Le contrôleur dedit expose `applyStyleValue(path, value)` (et `applyPatch(patch)`) : il **écrit la donnée** dans l'écart puis appelle `emitDecorChange()`. Le rendu DOM est **abonné** à ce changement (`onDecorChange`) — l'élément se met à jour parce que la donnée a changé, pas par une écriture DOM parallèle non enregistrée. Donnée et pixel ne divergent donc jamais.

**Process cible dans l'app (le décor édité appartient à un kf d'un item sélectionné)** :
1. Sélection = `{item, keyframe}` dans le contrôleur central ; ce kf porte un `decorId` → le `DecorPatch` cible dans `EditorScene.decors`.
2. L'auteur bouge le sélecteur de couleur : **aperçu live** immédiat sur l'élément DOM de la scène (couleur appliquée à l'élément monté) — retour visuel continu pendant le geste, encore aucune donnée écrite. C'est l'éphémère du geste, local, comme un drag de kf.
3. **Au commit** (relâché / valeur validée) : le module émet une **intention** au contrôleur — « poser `background` = `<css>` sur le décor du kf K de l'item I ». Le contrôleur applique la mutation pure sur `EditorScene.decors[decorId].style` (même famille que `applyStyleValue`, mais la donnée maîtresse vit dans le contrôleur, pas dans une machine dedit autonome).
4. Le document mis à jour redescend → le rendu reflète la valeur **enregistrée** (l'aperçu live et la donnée coïncident maintenant). L'acteur de persistance voit la mutation et sauve.
5. Un seek/rechargement rejoue le décor depuis la donnée — l'aperçu live n'était qu'un doublon visuel transitoire, jamais une source de vérité.

Question ouverte (granularité du commit) : chaque valeur validée = une intention (simple, historisable finement) vs un lot par session d'édition d'un décor. À trancher — piste par défaut : une intention par valeur validée, l'aperçu couvrant le continu du geste. Précisée par le scénario ci-dessous (commit débouncé, pas au relâché strict).

### Scénario du flux d'édition dedit → content/decor/capsule, preview live + commit différé (à figer avant de coder — Eddy posait souci ici)

Intention (dictée) : dedit devient le **pilote unique** de l'édition d'un objet sélectionné — il transmet ses données à **content, decor ET capsule** (plus seulement decor), tout en pilotant la preview temps réel. À la sélection d'un objet, il **récupère ses infos** depuis le document. Principe de la prévisu immédiate : la donnée n'est **stockée/consolidée qu'en async**. Le stockage général peut rester sync, mais le stockage (local ou distant) et la reconstruction de scène sont **toujours différés**. Exemple canonique : un slider de couleur émet N valeurs que la preview suit ; seule la **valeur finale** est enregistrée, après un **court temps de pause à doser**. Flux complexe — sur lequel Eddy achoppait.

**Ce qui rend ce flux délicat (le piège d'Eddy)** : trois cadences se superposent — le geste (dizaines d'événements/s), la consolidation de la donnée (une fois, à la pause), la persistance/reconstruction (différée). Les mélanger = soit écrire la donnée à chaque tick (rafales d'écritures, reconstructions inutiles, historique pollué), soit lier la preview à la donnée maîtresse (la scène se reconstruit sous les doigts). Le remède est de **séparer nettement les trois** et de ne laisser communiquer que par des points de bascule explicites.

**Trois plans, trois cadences** :
1. **Preview (synchrone, à chaque tick, non enregistrée)** — dedit applique la valeur directement sur l'élément DOM de la scène. Pur retour visuel, éphémère, local ; ne touche jamais le document. Coût nul côté données.
2. **Consolidation de la donnée (débouncée, une fois par salve)** — quand le flux d'événements se calme pendant un délai à doser (« court moment de pause »), OU sur fin de geste franche (`pointerup`, blur, Entrée) qui court-circuite l'attente, dedit émet **une** intention finale au contrôleur avec la **dernière** valeur. Le contrôleur applique la mutation pure sur la bonne table selon la cible : `contents` (si content), `decors[decorId]` (si aspect/décor), `Item.capsule` (`CapsuleDef`, si réglage capsule — statique, sur l'item). Une salve = une entrée d'historique, jamais N.
3. **Persistance / reconstruction (différée, en aval de 2)** — l'acteur de persistance, abonné au contrôleur, observe la mutation consolidée et écrit (localStorage puis backend). La reconstruction de scène (rebuild/seek) est elle aussi déclenchée par la donnée consolidée, jamais par la preview. Toujours différée, même si l'écriture elle-même est synchrone.

**À la sélection d'un objet** : le contrôleur porte la sélection ; dedit lit le document et **récupère les infos** de l'objet (son content, le `DecorPatch` du kf courant, le `CapsulePatch` si capsule) pour peupler ses champs. Lecture seule à ce stade — aucune écriture. C'est le remplacement du modèle actuel où dedit tient sa propre copie.

**Déroulé de l'exemple (slider de couleur sur l'item sélectionné, son kf sélectionné)** :
1. Sélection `{item, kf}` déjà dans le contrôleur ; dedit a lu la couleur courante et affiche le sélecteur dessus.
2. Drag du slider → à chaque `input`, dedit résout la valeur CSS finale (la palette produit déjà des chaînes finales, pas d'intermédiaire — `DecorPatch.style` est une carte de CSS final) et l'**applique en preview** sur l'élément. Le document ne bouge pas. La donnée maîtresse (couleur enregistrée) est encore l'ancienne.
3. L'auteur s'arrête ~D ms (D à doser), ou relâche : dedit émet **une** intention « `background` = `<dernière valeur>` sur le décor du kf K de l'item I ». Fin de geste franche = commit immédiat sans attendre D.
4. Contrôleur → mutation pure sur `decors[…].style` → document à jour → la preview et la donnée coïncident (le rendu depuis la donnée confirme la couleur déjà visible ; pas de saut visuel puisque identique).
5. Persistance différée : l'acteur écrit la valeur consolidée. Un rechargement rejoue la couleur enregistrée.

**Règles invariantes du scénario** :
- La preview n'est **jamais** une source de vérité ; démonter/remonter depuis le document seul redonne l'état consolidé, pas la dernière frame de preview non commitée.
- **Une salve de geste → au plus une mutation** du document (débounce + coalescence sur la dernière valeur).
- Le **délai D est un réglage** (config, dosable), pas une constante en dur — cf. règle projet « config réglable plutôt qu'en dur ». Valeur de départ à proposer (ordre de grandeur ~150–250 ms) au moment du réglage, pas figée ici.
- **Fin de geste franche prime sur le délai** : `pointerup`/blur/Entrée commitent tout de suite ; abandon (Échap) annule la preview et n'émet aucune intention — la donnée reste l'ancienne.
- Le canal est le **même** pour content, decor, capsule : seule la table cible de la mutation change côté contrôleur. Dedit ne sait pas où c'est stocké, il émet une intention typée par la cible.

**Points à doser / trancher (avant code)** :
- Valeur de départ de D et éventuelle différenciation par type de champ (un slider continu vs un champ texte vs une case à cocher — la case peut committer sans délai).
- Granularité d'historique : une entrée par salve consolidée (retenu par défaut ci-dessus) — confirmer.
- Sort d'un abandon en cours d'édition d'un champ non-continu (texte tapé puis Échap) : rollback preview + pas d'intention.
- Convergence content/capsule dans `DecorPatch` (point déjà ouvert ci-dessus) : ce scénario suppose trois cibles distinctes (`contents`, `decors`, `CapsulePatch`) — il faut que le modèle les sépare pour que « dedit émet une intention typée par la cible » ait un sens.

**Point de convergence à trancher (soulevé par ce cas)** : le `DecorPatch` actuel porte aussi `text`, `capsule`, `zone` — donc dedit stocke déjà **du contenu** (`text`) et **des réglages capsule** dans le décor. Cela recoupe la table `contents` et le `CapsulePatch` de la section « Modèle de données ». À réconcilier dans la spec : soit content/capsule sortent du `DecorPatch` (le décor ne garde que l'habillage), soit on assume ce recouvrement. Ne pas laisser deux endroits stocker la même donnée (cf. la double déclaration `CapsuleKind` déjà vécue). Non résolu ici — à décider avec les points 1-4 de la section modèle.

### Périmètre de dedit et forme de stockage du CSS (2026-07-10)

#### Dedit agglomère tout ce qui concerne l'item (acté)

On parle couramment de « style » parce que c'est le cas le plus courant, mais dedit est l'éditeur de **tout ce qui concerne l'item** — pas seulement `style` :
- `style` (le plus courant), `classes` (classnames),
- **positions portées par la capsule**, `flex-position` (l'appui flex — `FlexAnchor`/`PositionPatch` actuels),
- **assignation à une zone** (référence par nom),
- **accès aux presets** (decor presets),
- plus tard : **micro-transitions**.

Et dedit gère la **multisélection** : il édite « l'item **ou les items** » — le flux d'édition (preview live + commit débouncé, section précédente) doit donc s'appliquer à une sélection multiple, l'intention émise portant sur N cibles. À intégrer au scénario : une salve de geste sur une multisélection → une intention couvrant les N objets (pas N intentions), preview appliquée sur les N éléments.

Conséquence pour le contrôleur : la sélection qu'il porte peut être multiple ; « dedit récupère les infos de l'objet sélectionné » devient « des objets », avec la question de l'affichage d'un champ quand les valeurs divergent entre items (état « mixte ») — classique d'un inspecteur multi-cible, à traiter au niveau dedit, pas au modèle.

#### CSS stocké comme objet opaque, pas comme couple clé:valeur (position de départ, peut-être prématuré)

Position de l'utilisateur, explicitement donnée comme piste (« peut-être trop tôt ») : stocker les CSS comme **objet opaque** — « certainement pas un couple key:value » structuré et validé, plutôt un **objet JSON** confié à dedit. Raison : il sera toujours impossible de décrire correctement l'ensemble des props CSS (900+) ; mieux vaut confier à **dedit** le choix des props qu'il gère individuellement (via la palette) et laisser le reste en option dans `custom`. Le modèle ne cherche pas à typer/valider les propriétés CSS une par une.

Ce que ça recoupe de l'existant (état 2026-07-10) : `DecorPatch.style` est **déjà** une carte ouverte `Record<string,string>` de valeurs CSS finales, le domaine ne connaissant **aucune** propriété nommée en dur (commentaire du `DecorPatch`, `decor-editor/types.ts`). L'esprit « dedit décide des props, le modèle ne les type pas » est donc déjà en place. La nuance apportée aujourd'hui : aller jusqu'à un **objet opaque** (voire une chaîne JSON) plutôt qu'une `Record` structurée.

**Précision décisive (2026-07-10) : l'objet opaque concerne le STOCKAGE BDD, pas ce qui est envoyé au player — deux représentations distinctes.** « Quand je récupère un item en BDD, je n'ai pas besoin de query sur un détail des CSS, je prends tout. » Le CSS n'est donc jamais un axe de requête : c'est une **colonne opaque** (blob JSON / champ texte) qu'on lit et écrit en bloc avec l'item. Aucune table `css_property`, aucun index sur une prop, aucune jointure — le grain de requête, c'est l'item, pas la propriété.

Ce que ça tranche (la question de forme n'est plus ouverte, elle est **résolue par séparation des représentations**) :
- **Représentation BDD** : opaque, non typée, prise en bloc. La forme concrète (colonne JSON native ou `TEXT` stringifié) se choisira à l'ouverture de l'étape backend selon prisma/sqlite — mais dans les deux cas, opaque et non requêtable par prop, c'est acté.
- **Représentation runtime** : `Record<string, unknown>` structuré, exigé par le player (`PersoState.style`, `codplay/src/runtime/types.ts`, appliqué par `applyStylePatch`) — fait vérifié.
- **Représentation éditeur (contrôleur, en mémoire)** : celle que dedit manipule et que la preview/les intentions font vivre — pratiquement une `Record<string,string>` (déjà le cas), directement utilisable et directement sérialisable vers l'opaque BDD sans transformation lourde.
- **Le Builder** convertit vers le runtime (`EditorScene → SceneDef`), comme il le fait déjà. La sérialisation vers l'opaque BDD est un simple dump de la représentation éditeur (l'acteur de persistance, section flux d'édition).

**Statut** : orientation actée — objet opaque = choix de stockage BDD (item pris en bloc, CSS non requêtable), distinct du format runtime structuré. Reste à la spec/étape backend : la forme physique exacte côté prisma-sqlite (JSON natif vs TEXT), sans enjeu sur le principe. Le modèle continue de ne pas typer les propriétés CSS individuellement ; dedit reste seul maître des props gérées vs `custom`.

### Ciblage de zone cross-capsule : neutralisé en v1 par filtrage (2026-07-10)

Remarque de l'utilisateur : chaque zone d'une scène a son propre `id`, donc cibler une zone pour un item est simple (référence par id). Mais cela **rend possible** de cibler une zone sur une capsule **différente** de celle où se trouve l'item. Codplay sait gérer le reparent ; **grid-sequence, non** — il ne saurait pas quoi faire de cet item ciblant une zone hors de sa capsule. Décision : **neutraliser pour le moment en filtrant les zones proposées à celles de la capsule parente** de l'item.

**Précision d'état → tranchée : on aligne dedit sur selection-frame (2026-07-10).** Deux modèles de zone coexistent aujourd'hui :
- `selection-frame` (module à jour, celui de `ZoneDef.container`) : `ZoneDef.id` **stable**, l'attache référence l'`id`, jamais le nom (`zone-model.ts`, commentaire).
- `dedit` (pas encore migré — point 8 parqué) : `DecorPatch.zone: string | null` = référence **PAR NOM**, et `ZoneDef` y est `{name, coords}` **sans id** (`decor-editor/types.ts:73`, `zones.ts`).

**Décision** : dedit s'aligne sur selection-frame — référence de zone **par id**. Facilité par le fait que **rien n'a encore été codé** côté dedit pour ce ciblage (le `zone: string` actuel est une déclaration de type non exercée) : ce n'est pas une migration de données existantes, juste adopter le bon modèle avant d'écrire. La spec du modèle actera : la référence de zone d'un item est un **id** unique dans la scène. C'est justement ce passage à l'id (vs nom, qui n'a de sens que dans une capsule) qui **crée** la possibilité du ciblage cross-capsule — d'où le filtrage v1 ci-dessus.

**Décision v1 : filtrer (retenu), et pas seulement pour une raison technique.** Au-delà du fait que grid-sequence ne sait pas reparenter, une assignation de zone qui déclencherait un reparent serait un **effet de bord invisible** : l'auteur croit poser un décor et l'item changerait de parent dans l'arbre (donc de contexte de distribution, de timing, de grille). Couplage caché — exactement le genre d'« erreur insoluble » à ne pas réimporter. Le filtrage préserve un invariant lisible : **assigner une zone ne déplace jamais un item**. L'éditeur ne propose que les zones de la capsule parente ; les zones des autres capsules ne sont pas listées.

**Piste reparent dans grid-sequence — idée « ligne de fracture », consignée mais reportée post-v1 (2026-07-10).** Côté runtime le reparent est un acquis : Codplay sait déplacer un item d'un parent à l'autre par une **transition de mouvement**, identique à celle d'une zone à l'autre (cf. démo FLIP — mécanisme déjà employé dans le repo). Le problème n'est donc pas le rendu de scène, mais sa **représentation dans grid-sequence**. Idée de l'utilisateur pour la représenter :
- La ligne de temps (tm) de l'item **s'interrompt brusquement** à l'instant du reparent, sur la durée de la transition, puis **reprend sur la nouvelle position** (nouvelle capsule) — une « ligne de fracture ».
- Un **indicateur sur la tm signale le saut**.
- L'item est donc **représenté deux fois** dans grid-sequence, sur des segments **disjoints** (accessibles séparément, chacun dans le contexte de sa capsule).

**Report assumé** : la complexité de gestion (un même item à deux emplacements d'arbre sur des intervalles distincts, l'édition de chaque segment, la cohérence timing/sélection) fait reporter cette idée — en attendant de voir si elle est **jamais utile** à produire pour cet éditeur. D'ici là, le filtrage (zones de la capsule parente uniquement) reste la position par défaut, réversible. Ne pas construire cette représentation tant qu'un besoin réel ne l'appelle pas.

### Variantes d'orientation des zones/grilles → chantier distinct (extrait 2026-07-11)

Toute la conception des variantes d'orientation (zone et grille de capsule variables selon portrait/landscape, mécanisme `@container (orientation:)`, génération par la classe métier `AutoCapsule`, approche Eddy écartée, couplage grille↔surfaces) a été **extraite** vers un chantier autonome, exécutable en parallèle de la construction de l'app : plan `../2026-07-11-zone-orientation-variants-plan.md`, discussion `2026-07-11-zone-orientation-variants-discussion.md`. Le traitement vit dans la classe métier, pas dans l'app.

**Ce que l'app garde de ce sujet** : un **élément d'interface pour faire basculer l'orientation de la scène** en aperçu (auteur) — bascule portrait/landscape sans redimensionner la fenêtre, via une classe sur la racine de scène. Le rendu réel est du CSS pur généré côté classe métier ; l'app ne fait que proposer ce contrôle de simulation. Détail du mécanisme : voir le chantier distinct.

### Architecture « decor » : classe métier + machine + rapport au runtime central (question utilisateur, 2026-07-11)

Question : decor gère tous les aspects structurels de la géométrie d'un item, fait appel à dedit et aux helpers de position Codplay ; comme partout, il faut une **classe métier + une machine XState** pilotant les interfaces (celle de dedit, provisoire, et celles de Codplay). L'architecture est-elle assez définie ou faut-il y revenir en détail ? Comment fonctionne-t-elle avec le **runtime central** ?

**Clarification de vocabulaire à poser d'abord (sinon même piège qu'Eddy : un mot fusionnant deux responsabilités).** « decor » désigne trois choses qu'il faut distinguer :
1. **La donnée `DecorPatch`** — l'écart structurel/habillage d'un item (style, classes, position, zone, textAutoSize…), qui vit dans le document possédé par le contrôleur central.
2. **L'éditeur dedit** — `DecorEditorController` (classe métier) + `decorEditorMachine` (machine XState), qui **existent déjà** (`packages/editor/src/decor-editor/`). Contexte : `patch`/`chain`/`items`/`zones`/`orientationContext` ; événements `VISUAL_POSITION.TOGGLE`, `ZONE_MODE.TOGGLE`. C'est déjà « classe métier + machine » comme le reste du projet.
3. **Les outils de géométrie** — côté **authoring**, pas runtime : `flex-anchor-tool.ts`, `grid-placement-adapter.ts` (selection-frame), `resolve-placement.ts` (capsule-automation). dedit s'y relie via `PositionPatch`/`FlexAnchor`.

Donc « decor fait appel à dedit » est un raccourci trompeur : dedit **est** l'éditeur de la donnée decor ; il n'y a pas un « decor » séparé qui appellerait dedit. Il y a : une donnée (DecorPatch) + son éditeur (dedit, déjà classe+machine) + des outils de géométrie (authoring). Ne pas créer une quatrième entité « contrôleur decor » par-dessus dedit — ce serait le doublon de responsabilité à éviter.

**État réel (vérifié 2026-07-11)** : dedit a déjà sa classe métier (`DecorEditorController`) et sa machine (`decorEditorMachine`). L'architecture « classe métier + machine pilotant les interfaces » **existe** au niveau dedit — elle n'est pas à créer, mais à **raccorder** au contrôleur central selon le modèle déjà décrit plus haut (flux d'édition preview live + commit débouncé).

**Comment ça fonctionne avec le runtime central — deux « centraux » à ne pas confondre** :
- **Le contrôleur central de l'app** (machine XState racine, section « L'état d'item vit dans le contrôleur central ») possède le document. dedit devient un **éditeur piloté** : à la sélection il lit la donnée decor de l'item/kf depuis le contrôleur (peuple ses champs) ; pendant un geste il fait la **preview live** locale ; au **commit débouncé** il émet une **intention** typée (cible : `decors[decorId]`) que le contrôleur applique. La machine de dedit garde son état **éphémère de geste** (panneau actif, mode zone/position, tracé en cours) — jamais la donnée maîtresse. Même partage que sequence-editor : le module est fonction pure sur la donnée + un état de geste local.
- **Le runtime Codplay** (le player) est un autre « central », mais c'est le **séquenceur d'événements**, pas le possesseur du document d'édition. Il ne voit jamais `DecorPatch` : le **Builder** convertit la donnée decor consolidée en `SceneDef` (style → `Record` runtime, classes, placement → CSS via AutoCapsule). Le player ne connaît que le résultat compilé. dedit ne parle donc **pas** directement au runtime pour persister — il parle au contrôleur ; le runtime est réalimenté par le Builder (rebuild/seek) en aval. La **preview live** est la seule chose que dedit applique directement sur le DOM monté par le player, et c'est de l'éphémère non consolidé (cf. scénario du flux d'édition).

**Réponse à « suffisant ou à approfondir »** : l'architecture de principe est **suffisamment définie** (classe+machine dedit existent ; rôle du contrôleur central posé ; frontière runtime via Builder posée). Ce qui reste, et qui est un **détail à reprendre**, n'est pas l'architecture mais **le raccordement** :
- dedit tient aujourd'hui sa donnée dans le contexte de sa propre machine (`patch`/`chain`) — comme sequence-editor tient `scene`. Le passage « le contrôleur central possède, dedit lit et émet des intentions » est une **refonte de branchement** à spécifier (forme des intentions decor, projection lue, débounce). Même chantier de pont que pour sequence-editor.
- La cohérence des trois interfaces que dedit pilote (sa palette provisoire ; le cadre de sélection selection-frame ; l'éditeur de zones) passant toutes par le **même** point d'intention vers le contrôleur — à poser, pour ne pas avoir trois chemins d'écriture.
- Détail dépendant du modèle non encore tranché : la convergence `text`/`capsule` hors de `DecorPatch` (points ouverts de la section modèle) conditionne quelles intentions dedit émet et vers quelles tables.

Conclusion : pas besoin de redéfinir l'architecture ; besoin de **spécifier le pont dedit ↔ contrôleur central** (au moment du contrôleur, étape 2 du plan app), en réutilisant le patron du pont sequence-editor. À traiter là, pas maintenant.

### Sélection d'un décor : deux accès pour un même acte (kf ou item sur le player) + édition sans kf sélectionné (question utilisateur, 2026-07-11)

**La sélection d'un décor a deux portes qui sont en fait la même.** On active un décor aussi bien en sélectionnant un **kf** (dans la timeline) qu'en sélectionnant un **item sur le player**. Ce sont deux accès au même objet : un item est **toujours visible** grâce à la position de la timeline, et un décor est **toujours appliqué** à l'item. Donc sélectionner l'item (via le player) ou sélectionner un de ses kf revient à désigner « le décor actif de cet item à cet instant ».

- **Conséquence architecture** : la sélection vit dans le **contrôleur central**, alimentée par **deux émetteurs** — la timeline (sélection de kf) et le cadre de sélection sur le player. Les deux convergent vers la même sélection `{item, (kf?)}`. (Vérifié : le player expose `subscribeToNode(persoId, cb)` — pas de sélection par clic native ; c'est **selection-frame**, accroché par `subscribeToNode`, qui fournit le clic sur l'item. La porte « player » passe donc par selection-frame, pas le player nu.)
- Les deux accès ne sont pas deux états à synchroniser : c'est **une** sélection dans le contrôleur, que deux vues peuvent initier et que toutes reflètent.

**Cas à trancher : sélectionner un item SANS kf particulier — que fait une modification de décor ?** Deux directions possibles :
1. **Modifier le décor crée un kf** à la position courante de la timeline.
2. **La modification s'applique au décor actuellement actif** (le kf en vigueur à cet instant, ou le décor de base), sans créer de kf.

**Décision par défaut retenue : création de kf VOLONTAIRE** (option proche de 2 pour l'édition courante ; la création de kf est un acte explicite). Raison : les outils d'édition proposent généralement que la création d'un kf soit volontaire, pour éviter les erreurs d'évaluation (un réglage qui pose un kf involontaire change l'animation à l'insu de l'auteur). Précédent du domaine : l'auto-keyframe est partout un opt-in explicite (mode à activer), jamais le comportement implicite. **Mais** : exigence d'un système assez **souple** pour proposer d'autres directions si celle-ci ne satisfait pas à l'usage.

**Mécanisme pour cette souplesse : une façade de commandes côté code** (piste de l'utilisateur, retenue comme la bonne forme). Idée : l'édition de décor ne code pas en dur « ça crée un kf » ou « ça modifie l'actif » ; elle passe par une **façade de commandes** (ex. `applyDecorEdit`, `commitDecorValue`, `promoteToKeyframe`…) dont l'**implémentation de la politique** (créer un kf vs modifier l'actif vs autre) est un point unique, remplaçable. Bénéfice : la politique « kf volontaire » est le défaut, mais changer de politique = changer l'implémentation de la façade, pas réécrire les appelants. Permet d'éprouver la meilleure approche **à l'usage avec les utilisateurs**, sans refonte.
- **Lien avec le flux d'édition existant** : cette façade est le **côté contrôleur** des intentions décrites plus haut (preview live + commit débouncé). L'intention « poser telle valeur de décor » arrive du module ; la **façade décide** de sa traduction en mutation du document — création de kf, écriture sur le kf courant, ou décor de base. Les modules (dedit, cadre) n'ont pas à connaître cette politique : ils émettent une intention de valeur, la façade tranche.
- **À poser en spec (quand le contrôleur est écrit)** : le jeu de commandes de la façade, le point d'injection de la politique (par défaut « kf volontaire »), et le fait que les deux accès de sélection (kf / item-sur-player) aboutissent au même appel de façade. Ne pas figer la politique dans les appelants — c'est tout l'intérêt.

**Rappel — pourquoi selection-frame passe par une fonction (`subscribeToNode`), et ce que ça garantit.** Le node DOM d'un item est **susceptible d'être effacé/reconstruit pendant l'édition** (seek, rebuild, réattachement). selection-frame ne tient donc jamais une référence DOM directe : il s'abonne par `subscribeToNode(itemId, cb)` et reçoit les apparitions/disparitions (`handleElementNode(node | null)`), l'état machine `suspended`/`idle` couvrant le node absent (vérifié dans `selection-frame.ts`). La sélection est indexée par **identité stable de l'item (`itemId`)**, pas par le node — donc **elle survit à la reconstruction** : le cadre se recale sur le nouveau node quand il réapparaît, sans perdre la sélection. C'est une garantie à préserver dans le contrôleur central : la sélection porte des **ids** (item, kf), jamais des nodes ; les deux émetteurs (timeline, cadre) et le réattachement de node ne remettent jamais en cause l'objet sélectionné.

**Statut** : sélection unifiée = acté (une sélection au contrôleur, deux émetteurs), **par id, stable à la reconstruction de node**. Politique d'édition sans kf = « kf volontaire » par défaut, **derrière une façade de commandes** pour rester révisable à l'usage. Détail (noms de commandes, forme de la politique) à écrire avec le contrôleur central.

### Undo/redo : décision d'architecture maintenant, construction plus tard (question utilisateur, 2026-07-11)

Question posée : avec XState + des commandes, faut-il se poser **maintenant ou plus tard** la question d'un undo/redo pour l'éditeur ? On peut en **parler plus tard** — mais l'éditeur est voulu **grand public, simple à employer**, et undo/redo en fait partie comme fonction **naturelle** attendue.

**Réponse (posée maintenant, construite plus tard)** : c'est une décision d'**architecture** à prendre maintenant même si la fonctionnalité se construit après — parce que le modèle déjà retenu soit prépare le terrain, soit le condamne, et on est justement en train de le poser.

- **Ce qui prépare naturellement l'undo/redo (déjà dans nos choix)** : le contrôleur central **possède le document** ; **toute** mutation passe par une **intention/commande** appliquée à un point unique ; le flux d'édition **coalesce** une salve de geste en **une** mutation (commit débouncé) — donc une entrée d'historique = une action perçue par l'auteur, pas N micro-écritures. Ces trois traits sont exactement le socle d'un undo/redo propre. On les a pris pour d'autres raisons ; ils servent aussi celle-ci.
- **Ce qu'il faut décider maintenant (pas construire)** : le **modèle d'historique**. Deux familles classiques —
  - **snapshots** du document (immutable, un instantané par commit) : simple, robuste, coûte de la mémoire ; très naturel puisque le document est déjà la seule vérité et que les mutations sont pures `(EditorScene) → EditorScene`.
  - **commandes inversibles** (chaque commande sait s'annuler) : économe, mais chaque commande doit porter son inverse — plus de discipline.
  - Le fait que nos mutations sont déjà **pures et centralisées** rend les **snapshots** particulièrement peu coûteux à mettre en place (empiler l'état avant/après commit), ce qui colle au « grand public, simple ». Piste par défaut : snapshots par commit, sans l'implémenter tout de suite.
- **La façade de commandes (section précédente) est le point d'ancrage** : si toute mutation passe par la façade, l'historique s'y branche en un seul endroit (empiler au commit, rejouer au undo) — sans toucher les appelants. C'est la raison supplémentaire de tenir la façade comme **unique voie d'écriture** du document.
- **XState** : l'historique n'a **pas** à vivre dans la machine (une machine qui mémorise tout son passé devient lourde) ; il vit à côté, comme **acteur/service** branché sur les commits — même patron que l'acteur de persistance. La machine émet/applique, l'historien observe.

**Statut** : undo/redo = **exigence assumée** (éditeur grand public). **Pas construit maintenant.** Décision d'architecture prise : historique **hors machine**, branché sur la **façade de commandes** au commit, modèle par **snapshots** en piste par défaut (mutations pures + document unique le rendent bon marché). À implémenter plus tard ; d'ici là, **ne rien faire qui empêche ce branchement** — surtout : garder la façade comme voie d'écriture unique et les mutations pures/centralisées.

### Undo/redo dès la première version : difficulté réelle ? (question utilisateur, 2026-07-11)

Question : si le terrain est prêt, y a-t-il une difficulté à réaliser l'undo/redo **dès la construction de cette première version** ?

**Réponse honnête : le mécanisme d'historique est simple ; la difficulté n'est pas là, elle est dans ce que « annuler » doit faire hors du document.** Détail.

**Ce qui est effectivement simple (le terrain est prêt sur ces points)** :
- Le document est la seule vérité, les mutations sont **pures** `(EditorScene) → EditorScene`, tout passe par la façade → empiler un snapshot avant/après chaque commit et rétablir au undo est trivial. **Vérifié** : le Builder est une transformation **pure** `EditorScene → {sceneDoc, styleSheet}`, rejouable à volonté (pas d'effet de bord, file plate, aucune dépendance à un état antérieur). Donc « rétablir un document » est bien défini.
- L'historien est un acteur à côté de la machine, branché en un point (la façade). Rien de structurellement nouveau.

**Où est la vraie difficulté (pas dans l'historique — dans la réalisation d'un undo côté runtime/îlots)** :
1. **Ce que le document ne capture pas.** Un snapshot restaure l'`EditorScene`, mais pas ce qui vit **hors** du document : le DOM monté par le player, l'état des îlots vanilla (viewport/scroll de la timeline, cadre de sélection), la position de lecture. Restaurer le document impose de **réappliquer** ces conséquences : rebuild → player, recalage des îlots. Ce n'est pas de l'historique, c'est de la **réconciliation post-restauration** — la même que celle qu'il faut déjà pour la restauration localStorage et pour toute mutation qui change la structure. Donc si le pont « le document redescend → les vues se re-projettent » est fait proprement (ce que le modèle exige déjà), l'undo **réutilise ce chemin** ; s'il ne l'est pas, l'undo le révélera brutalement.
2. **Coût d'un rebuild par undo.** Rétablir un document = potentiellement recompiler la scène (Builder → player). Acceptable pour un éditeur grand public (undo n'est pas dans une boucle chaude), mais à ne pas déclencher à tort à chaque micro-frappe — d'où l'importance du **commit débouncé** : une entrée d'historique = une action, donc un rebuild par undo, pas par tick.
3. **Périmètre : qu'est-ce qui est annulable ?** Décision produit à cadrer — le déplacement d'un kf, une édition de décor : oui. La sélection, le scroll, la bascule d'aperçu d'orientation : probablement **non** (ce ne sont pas des mutations du document, ils ne devraient pas polluer l'historique). C'est justement pour ça que **seules les mutations passant par la façade** entrent dans l'historique : la frontière « document vs éphémère » qu'on tient déjà **est** la frontière « annulable vs non ». Bien tenue, elle donne l'undo gratuitement ; mal tenue (un état d'UI qui se retrouve dans le document), elle pourrit l'historique.

**Conclusion** : réaliser l'undo/redo dès la v1 est **faisable et pas coûteux en soi**, à **une condition** — que le chemin « mutation → document → re-projection des vues (rebuild player + recalage îlots) » soit construit proprement de toute façon. Or il l'est déjà **exigé** par le modèle (contrôleur possède le document ; restauration localStorage ; îlots pilotés). **L'undo/redo n'ajoute donc presque pas de surface neuve : il consomme le même chemin de réconciliation.** Le risque n'est pas l'historique, c'est de bâcler cette re-projection ailleurs et de croire que « c'est l'undo qui est dur ». Recommandation : ne pas l'implémenter **au tout début** (squelette/contrôleur), mais l'ajouter **dès que le pont document→re-projection tourne** (après le premier montage réel d'une scène pilotée par le contrôleur, étape 3) — à ce moment le coût marginal est faible et ça valide le pont. Le construire **avant** ce pont serait prématuré (rien à réconcilier encore).

### Élargissement de périmètre : multi-scènes, users, chutier filtré, texte, ressources tierces (2026-07-11)

Points qui **changent le périmètre de l'app**, énoncés alors qu'on approche la réalisation. À intégrer au plan app et/ou en chantiers dédiés.

- **Multi-scènes** : l'app doit gérer **plusieurs scènes** qu'on ouvre/sauvegarde (pertinent surtout avec le backend). Eddy le fait. Conséquence sur le modèle déjà posé : le contrôleur central ne possède plus « le » document mais **un document courant parmi plusieurs**, avec ouverture/fermeture/liste. localStorage (étape 5) et backend (étape 6) deviennent multi-documents. À anticiper dès le contrôleur (l'identité de scène, le cycle ouvrir/sauver) sans tout construire.
- **Users** (évolution naturelle, surtout avec backend) : des utilisateurs ayant accès à **leurs propres scènes et ressources**. Pas v1 immédiat, mais oriente le modèle backend (scène et ressource appartiennent à un user) — à garder en tête à l'étape 6, ne pas cimenter un modèle mono-user.
- **Chutier filtré** : aujourd'hui (Eddy) le chutier répertorie **toutes** les ressources importées, quelle que soit la scène. Il faudra **très vite un filtrage** pour ne montrer que les ressources **de la scène courante**, avec la possibilité d'aller **chercher** celles d'autres scènes (donc un filtrage de fond, pas un cloisonnement dur). Lié au multi-scènes et aux users.
- **Texte** : le traitement du texte est aujourd'hui **succinct** (dedit : un champ `text` + `textAutoSize`). Un **gros point** est à faire, probablement un **module dédié avec son propre plan et sa spec**. À sortir en chantier distinct le moment venu (comme l'orientation) — noté, pas ouvert.
- **Ressources tierces** : pouvoir importer des ressources **non-core** (lottie, rive…) **en fonction de ce que le player peut gérer**. Recoupe [[project-dynamic-component-registry]] (registre dynamique de composants tiers, chantier déjà identifié, pas ouvert) et la règle preload ([[feedback-third-party-preload-rule]]). L'import est conditionné par la capacité runtime — le chutier/éditeur ne propose que ce que le player sait rendre.

**Statut** : périmètre élargi acté (multi-scènes, users à terme, chutier filtré, texte en module dédié futur, ressources tierces). Le multi-scènes touche le contrôleur central dès l'étape 2 (document courant parmi N) ; le reste s'échelonne (chutier avec le composant chutier, users/backend étape 6, texte et tierces en chantiers dédiés).

### Récupération du chutier depuis Eddy — principe actif à reconstruire (2026-07-11)

Décision : à l'approche de la réalisation, récupérer les composants **chutier** puis **whisper** d'Eddy, l'un après l'autre. Pour le chutier : sans doute fonctionnel dans Eddy, avec du **déchet sur les règles xstate/react**. N'en récupérer que le **principe actif** et le **reconstruire** — établi clairement **après analyse**. Avec ed2, l'usage du chutier **évoluera rapidement** (filtrage par scène, users, ressources tierces).

**Analyse du principe actif (Eddy `parts/chutier/index.tsx`, 328 lignes, un seul fichier — code écarté, concept retenu)** :

*Ce que fait le chutier (principe actif à garder)* :
1. **Zone de dépôt / import** : glisser-déposer + bouton d'upload de fichiers ; l'upload POST renvoie des `Content` (ressources) ajoutées à l'état. C'est la fonction cœur : faire entrer des ressources dans le projet.
2. **Typage des ressources à l'import** : liste de types acceptés — image, audio, vidéo, **et déjà les tierces** (`.lottie`, `.glb`/`.gltf`, `.riv`). Confirme que l'import de tierces est un besoin présent, pas hypothétique.
3. **Classement par type** : les ressources sont groupées (image / son / vidéo / texte / autres) et présentées en onglets. « autres » = fourre-tout des types non-core (lottie/rive/3D).
4. **Source de glissement** : chaque ressource est un élément **draggable** portant une charge (payload) MIME dédiée — c'est ainsi qu'on dépose une ressource dans la scène/timeline. Le chutier est la **source** d'un drag vers l'éditeur.
5. **Traitements dérivés à l'import d'un son** : déclenche transcription (whisper → cues) et extraction de **waveform**. Point de couplage avec whisper (le second composant à récupérer).

*Ce qui confirme l'élargissement de périmètre annoncé* :
- **Le filtrage scène/toutes-scènes est DÉJÀ amorcé, mais à l'envers** : le chutier fusionne `allContents` (toutes les ressources, toutes scènes) et `sceneContents` (ressources de la scène courante) dans une Map — donc il montre déjà **tout**, la scène courante n'étant qu'une surcouche. C'est précisément le « répertorie toutes les ressources quelle que soit la scène » à corriger : dans ed2, **défaut = ressources de la scène**, avec une action pour **aller chercher** celles des autres scènes (le `allContents` devient un mode de recherche explicite, pas la vue par défaut).
- Les tierces sont déjà dans les types acceptés et dans le groupe « autres » — mais Eddy les accepte **en dur** ; dans ed2 l'acceptation doit être **conditionnée par ce que le player sait rendre** ([[project-dynamic-component-registry]]).

*Le déchet xstate/react à ne pas reprendre (à reconstruire proprement)* :
- Logique d'upload, d'appels réseau (`fetch /api/...`), de transcription et de waveform **mélangée dans le composant React** — état local (`isUploading`, `error`) + effets asynchrones + `send` à la machine entremêlés. Dans ed2 : l'import (I/O, réseau) et les traitements dérivés (whisper, waveform) sont des **acteurs/services**, pas du code dans le rendu ; le composant chutier ne fait que rendre + émettre des intentions (déposer un fichier → intention d'import ; glisser une ressource → payload de drag). React ne rend, XState/les acteurs possèdent l'état et orchestrent l'I/O.
- `Content` d'Eddy (`id` numérique, `type` en chaîne libre `img`/`sound`/…) est le modèle **Eddy**, pas celui d'ed2 : à réconcilier avec la table `contents` du modèle ed2 (ids stables, `ItemType`). Ne pas reprendre le schéma Eddy.

*Ce qui évolue vite avec ed2 (donc à ne pas figer)* : filtrage par scène (défaut) + recherche cross-scènes ; acceptation des tierces pilotée par le registre runtime ; appartenance à un user (backend) ; le chutier comme source de drag vers un éditeur dont les cibles (timeline, zones) sont plus riches qu'Eddy.

**Principe actif retenu, à reconstruire** : un panneau qui (a) **importe** des ressources (drag-drop + bouton), (b) les **classe par type**, (c) les **présente filtrées par scène** (défaut) avec recherche cross-scènes, (d) sert de **source de drag** vers l'éditeur, (e) **délègue** l'I/O et les traitements dérivés (whisper/waveform) à des acteurs — jamais dans le rendu. Reconstruit sur le modèle ed2 (contrôleur possède l'état, composant = rendu + intentions), pas porté depuis Eddy.

**À retenir en plus : le drag-drop depuis le BUREAU vers le chutier** (import par glisser un fichier de l'OS, pas seulement le bouton) — brique de la super-feature ci-dessous.

### Super-feature « wow » (fin de cycle) : lot d'images déposé sur la scène → carousel auto (question utilisateur, 2026-07-11)

Idée pour la fin de cycle : **glisser-déposer un lot d'images depuis le bureau sur la scène du player** déclenche automatiquement — (1) leur **import** (comme le chutier), (2) la création d'une **capsule carousel**, (3) leur **intégration comme items**, (4) **répartis selon les réglages par défaut**. Une **macro** enchaînant des briques existantes, destinée à la démo comme effet « facile / wow » (l'app fait en un geste ce qui prend normalement plusieurs étapes).

**Évaluation : faisable en fin de phase, et le choix du carousel est le bon (pas un hasard heureux).** Vérifications :
- **Import** = le drag-drop bureau→chutier du principe actif ci-dessus. Existe (à reconstruire proprement), pas nouveau.
- **Création programmatique de capsule + items = au niveau APP, donc capsule/item — jamais story/perso.** (Correction : ma première formulation citait `SceneDocEditor.createStory/createPerso`, ce qui était une **fuite de couche**. Ces API sont celles du **Builder**, pas de l'app.) Côté app on manipule **capsule et item** ; **story et perso sont des side-effects mécaniques** que le **Builder** produit en aval à la compilation. **Vérifié** : `SceneDocEditor`/`createPerso`/`createStory` n'apparaissent **que** dans `build-scene.ts` (+ son README), nulle part ailleurs côté app — la frontière est réelle et propre. La macro crée donc des **items** (depuis les ressources importées) et une **capsule carousel** dans l'`EditorScene` (l'arbre `tracks` + la table `contents`), via la **façade de commandes** ; le Builder les transforme ensuite en story/perso sans que l'app le nomme ni l'appelle. La macro scripte des **mutations du document app**, pas des API de construction Codplay.
- **« Répartis selon les réglages par défaut » — point sensible, mais résolu par le choix du carousel.** Règle du projet : pas de défaut de distribution inventé ; toute capsule non-`carousel` **exige** une `distribution` explicite, sinon le Builder lève (Principe B). **MAIS** le carousel est **le seul sous-type avec un défaut structurel légitime** : sa grille est forcée à 1×1, donc ses enfants **doivent** se succéder — le défaut n'est pas inventé, il découle de la structure (**vérifié**, commentaire Builder : « Only `carousel` has a real structural default »). Donc une macro qui crée un **carousel** n'enfreint pas l'interdiction de défaut : c'est précisément le type qui se distribue sans réglage à fournir. Choisir carousel plutôt que grille/rangée n'est pas cosmétique — c'est ce qui rend la macro **légale** vis-à-vis du Principe B.
- **Réconciliation post-création** = la macro produit des mutations du document (import + création) via la façade → le pont document→re-projection (rebuild player) affiche le carousel. Même chemin que tout le reste ; et **une entrée d'historique** cohérente (la macro est **une** action annulable si elle passe par la façade en un commit — à cadrer : un seul undo doit défaire toute la macro, pas item par item).

**Points à cadrer (pas bloquants, fin de cycle)** :
- La macro doit être **une** transaction/commit (un undo défait tout le lot), pas N mutations séparées — sinon l'effet « wow » laisse un historique en miettes.
- Cible du drop = la **scène du player** (pas le chutier) : détecter un lot d'images déposé sur la surface scène → router vers la macro plutôt que vers un simple import. Distinguer « déposer sur le chutier » (import seul) de « déposer sur la scène » (macro).
- Ordre/nommage des items dans le carousel = ordre du lot déposé (déterministe).
- Ne concerne que les **images** dans la version démo (lot homogène) — un lot mixte est une extension, pas la macro « wow » de base.

**Statut** : super-feature **faisable, à faire en fin de cycle** (après chutier + création d'items + carousel + façade + undo tous en place — elle ne fait que les composer). Le choix du carousel la garde conforme au Principe B (pas de défaut inventé), et il est **intentionnel** (pas un choix par commodité). Reportée à la fin, comme prévu ; rien à construire avant que ses briques existent.

**Note jointe au concept macro — réglages capsule par défaut hors sélection (2026-07-11)** : évolution potentielle — transformer les **réglages de capsule** (aujourd'hui `CapsulePatch`, éditables sur une capsule sélectionnée) en **interface de réglages par défaut disponible hors de toute sélection de capsule**, comme le font certaines apps (on règle « ce que sera une nouvelle capsule » avant même d'en créer une). Ces défauts par défaut alimenteraient la macro (le carousel créé prend les réglages par défaut courants) et la création manuelle. Pas ouvert — note attachée au concept macro.

### La « macro » est-elle un concept de première classe, ou juste un mot pour une opération unique ? (question utilisateur, 2026-07-11)

Question : le concept de macro a-t-il une raison d'exister **dans cette app** (concept de première classe), ou n'est-ce que le **terme** commode pour désigner une opération unique (le lot→carousel) ?

**Position : concept de première classe — et la raison vient de ce qu'on a déjà construit, pas d'une envie d'abstraire.** Une « macro » n'est rien d'autre qu'une **commande composite** : plusieurs mutations enchaînées, committées **en un seul geste** (donc **un seul undo**). Or on a **déjà** posé les deux pièces qui en font un concept naturel plutôt qu'un cas particulier :
- **La façade de commandes** est la voie d'écriture unique du document, et chaque commande = une entrée d'historique. Une macro est exactement une commande qui **regroupe** d'autres mutations sous un seul commit. Le mécanisme d'« action annulable atomique » qu'on veut pour le lot→carousel est le **même** que pour toute commande — la macro n'ajoute pas de machinerie, elle réutilise la transaction de la façade.
- **Le commit débouncé** produit déjà « une action perçue par l'auteur = une mutation ». Une macro généralise ce principe à « plusieurs mutations liées = une action ».

**Ce qui fait pencher vers première classe (pas juste un mot)** : le motif « enchaîner N mutations en une action annulable » **se répète** au-delà du lot→carousel —
- lot d'images → carousel (la démo « wow ») ;
- coller/dupliquer un ensemble d'items ;
- appliquer une **card** (poser d'un coup un jeu de zones — déjà dans le vocabulaire) ;
- une future action « créer une capsule pré-remplie » depuis les réglages par défaut (note ci-dessus) ;
- import multiple depuis le chutier.
Dès qu'il y a plusieurs de ces cas, « macro » désigne une **catégorie de commande** (transaction groupée), pas une opération. Le nommer concept de première classe = se donner **un** mécanisme (commande transactionnelle : ouvrir → empiler N mutations → commit unique) réutilisé, plutôt que recoder l'atomicité à chaque fois.

**Nuance à tenir (ne pas sur-concevoir)** : première classe **côté mécanisme** (la façade sait faire une commande transactionnelle), **pas** forcément côté UX. Rien n'oblige à exposer « les macros » à l'auteur comme un objet éditable/enregistrable (ça, ce serait un vrai chantier — macros utilisateur programmables, hors sujet). Ici : une macro est une **commande transactionnelle définie en code**, invoquée par un geste (drop d'un lot, coller…). Le concept vaut pour l'**atomicité et l'historique**, pas pour un éditeur de macros.

**Statut** : « macro » = concept de première classe **au sens mécanisme** (commande transactionnelle groupée via la façade, un undo), parce que le motif se répète (lot→carousel, coller, card, import multiple…). **Pas** un système de macros utilisateur (hors sujet). Concrètement : la façade doit offrir une **commande transactionnelle** (grouper N mutations sous un commit) — à poser avec la façade/undo, l'un ne va pas sans l'autre. Le lot→carousel en est alors la première instance, pas un cas isolé.

### Principe d'architecture émergent : développer l'app par COMPOSITION de commandes, pas par hard-coding (2026-07-11)

Constat (utilisateur) : la réflexion sur la macro fait basculer d'une **recherche d'effet** (le « wow » du lot→carousel) vers un **système puissant pour développer les fonctionnalités de l'app simplement** — parce qu'une fonctionnalité devient la **combinaison propre d'un ensemble d'opérations**, pas leur **hard-coding**. À creuser et retenir.

C'est plus large que la macro : c'est un **principe de conception de l'app entière**. Une fonctionnalité nouvelle = composer des **commandes de base** (mutations élémentaires du document via la façade) en une commande de plus haut niveau, éventuellement transactionnelle. On n'écrit pas un chemin de code dédié par feature ; on **assemble** des opérations qui existent déjà.

**Pourquoi c'est cohérent avec tout ce qui précède (pas une idée neuve plaquée)** — les décisions déjà prises **sont** les prérequis de ce principe :
- **façade = voie d'écriture unique** → il y a un vocabulaire d'opérations bien défini à composer ;
- **mutations pures `(EditorScene) → EditorScene`** → elles se **chaînent** sans effet de bord caché, donc se composent de façon prévisible ;
- **commit débouncé + commande transactionnelle** → une composition = une action annulable ;
- **document unique possédé par le contrôleur** → toutes les opérations agissent sur le même état, pas de coordination inter-modules.
Ces quatre traits, pris pour d'autres raisons, **font exactement** une algèbre de commandes composables. Le principe n'est pas à ajouter — il est déjà rendu possible ; il reste à en **profiter délibérément**.

**Ce que ça implique concrètement** :
- Soigner le **jeu de commandes de base** (les mutations élémentaires : créer item, attacher, poser décor, créer capsule, placer en zone…) pour qu'il soit **complet et orthogonal** — c'est lui le vrai investissement ; les features de haut niveau en découlent par composition. Un jeu de base bancal = retour au hard-coding.
- Une feature se spécifie alors comme **une séquence de commandes** (lisible, testable comme telle), pas comme un algorithme opaque. La macro lot→carousel en est l'exemple : import⁺ → créer capsule carousel → créer/attacher items → commit.
- Bénéfice de test : composer des commandes pures se teste par entrée→sortie sur le document, sans DOM (comme `zone-model.ts`, le Builder).

**Garde-fou (ne pas basculer dans l'excès inverse)** : tout n'est pas une composition de commandes. Les **gestes** (géométrie, preview) et l'**éphémère** restent hors de cette algèbre — elle porte les **mutations du document**, pas l'interaction. Et « composer plutôt que hard-coder » ne veut pas dire tout rendre générique d'emblée : on extrait une commande réutilisable **quand un motif se répète** (comme la transaction, née de la macro), pas par anticipation spéculative.

**Statut** : principe d'architecture **retenu** — l'app se développe par composition de commandes de base sur le document, via la façade ; le vrai investissement est un **jeu de commandes de base complet et orthogonal**. Émerge de la réflexion macro, cohérent avec façade/mutations pures/transaction/document unique déjà décidés. À creuser lors de l'écriture de la façade (définir le vocabulaire de commandes) ; ne concerne que les mutations du document, pas les gestes/éphémère.

### Terrain vierge pour l'app, fondations éprouvées dessous — et c'est un axe de rédaction (2026-07-11)

Constat (utilisateur) : le code de l'app n'étant **pas encore écrit**, on n'est **pas tenu par de l'existant** — bon terrain pour poser le principe de composition de commandes proprement. Et : c'est un **vrai axe de rédaction** (pas seulement une réflexion — ça structure la spec/le plan à écrire).

**Précision qui rend le constat exact (et le terrain d'autant meilleur)** : la liberté est réelle **côté app**, pas totale partout. Distinguer :
- **Ce qui est vierge (aucune dette, liberté de conception)** : l'**app elle-même** — contrôleur central, façade de commandes, vocabulaire de commandes, jeu de composants React. **Vérifié** : `packages/editor/src/app` **n'existe pas** — rien n'est écrit, on conçoit la façade et les commandes sans contrainte héritée.
- **Ce qui existe et est éprouvé (fondations, à composer, pas à refaire)** : les **briques** que les commandes piloteront — Builder pur (`EditorScene → SceneDef`), `zone-model` (fonctions pures), dedit (classe+machine), selection-frame, capsule-automation, le runtime Codplay. **Vérifié** : 37 fichiers de test dans editor + authoring — ces fondations sont stables et couvertes.

Donc « pas tenu par l'existant » = vrai pour l'**architecture d'app** (on invente le vocabulaire de commandes librement) ; les **opérations de base**, elles, s'appuient sur des mutations dont la forme est déjà connue et testée. C'est précisément ce qui fait le **bon terrain** : liberté de composition **au-dessus** de fondations stables — ni page blanche risquée, ni legacy contraignant. On dessine l'algèbre ; les éléments qu'elle manipule existent.

**Comme axe de rédaction (ce que ça change pour la spec du modèle à écrire)** : le principe de composition devient une **section structurante** de la spec, pas une remarque —
- définir le **vocabulaire de commandes de base** (les mutations élémentaires du document) comme une partie normative à part entière ;
- exprimer les **features de haut niveau comme séquences de commandes** (macro lot→carousel, coller, appliquer une card…) plutôt que comme algorithmes ;
- poser la **façade** (voie unique + transaction) comme l'interface de ce vocabulaire ;
- garder hors de cette algèbre les gestes/éphémère (frontière déjà tenue).
Rédiger dans cet ordre — commandes de base d'abord, compositions ensuite — reflète où est le vrai investissement.

**Statut** : acté — l'app est un terrain vierge (spec/code à écrire sans dette), posé sur des briques éprouvées (37 specs) à **composer, pas refaire**. Le principe de composition de commandes est un **axe de rédaction** de la future spec du modèle : vocabulaire de commandes de base comme section normative, features exprimées en séquences de commandes.

### Récupération de whisper depuis Eddy — principe actif (2026-07-11)

Second composant à récupérer (après chutier). whisper = **transcription audio locale** (dans le navigateur, via `@huggingface/transformers` + un worker) produisant des **cues** temporelles (segments texte horodatés) à partir d'un fichier son importé. Sert la timeline (cues = repères temporels, cf. `sequence-editor`) et se déclenche à l'import d'un son dans le chutier.

**Analyse (Eddy `app/whisper/`, ~2600 lignes au total — code écarté, principe retenu)** :

*La bonne surprise : le cœur est DÉJÀ propre et réutilisable.* `transcribe-to-cues.ts` (243 lignes) est une **fonction pure d'orchestration**, sans React : `transcribeAudioFileToCues(file) → { cues, totalDurationSec }`. Elle fait exactement ce qu'il faut et **dans la bonne forme** —
- décode le fichier en `AudioBuffer` (16 kHz mono), passe au worker whisper, mappe les chunks whisper `{text, timestamp:[start,end]}` en cues `{name, text, start, end}` triées ;
- le worker (`worker.js`) porte le modèle ONNX (`whisper-small_timestamped`), isolé du thread principal ;
- garde-fous réels : `AbortSignal` (annulation), vérification que le modèle supporte les word-timestamps (`*_timestamped`), nettoyage du worker.
Ce fichier est **quasi reprenable tel quel** (au mapping de types près) — c'est de la logique pure, pas du déchet.

*Le déchet xstate/react à ne pas reprendre* : `hooks/useTranscriber.ts` (216 lignes) — tout l'état de transcription (busy, progression du chargement du modèle, chunks partiels) dans un **hook React** avec `useState`/`useMemo`, `alert()` pour les erreurs, `console.log` résiduels. C'est l'anti-pattern ed2 : dans ed2, ce cycle (charger le modèle, progresser, transcrire, produire les cues) est un **acteur/service** (une machine invoquée, ou un acteur promis) branché sur le contrôleur ; la progression est un état observable de cet acteur, pas un `useState`. Les composants React de démo whisper (`AudioManager`, `Transcript`, `Modal`, `AudioRecorder`…) sont du **démonstrateur autonome** d'Eddy — non pertinents pour ed2, qui n'a pas besoin d'une UI whisper séparée : la transcription se déclenche à l'import d'un son et alimente les cues de la timeline.

*Recoupements/faits à connaître* :
- whisper est **couplé au chutier** : c'est à l'import d'un son que la transcription (et la waveform) se déclenchent — donc l'acteur whisper est invoqué par le **flux d'import** (acteur d'import du chutier), pas par une UI dédiée.
- Modèle exécuté **en local** (WebGPU/wasm), chargement lourd la première fois (d'où la « progression » à exposer). C'est une **ressource lourde à charger une fois** — même logique de singleton que d'autres ressources runtime ; ne pas recharger le modèle par transcription.

*Mécanique précisée (utilisateur, 2026-07-11 — tranche le mapping laissé ouvert ci-dessus)* :
- **Déclenchement = au chargement d'un SON.** Le son est **analysé pour voir si de la voix peut en être extraite** et convertie en cues.
  - **Extraction audio d'une vidéo = HORS PÉRIMÈTRE (utilisateur, 2026-07-11).** Notée, écartée. Fait établi (code Eddy) : whisper part d'un `AudioBuffer` (`decodeAudioData(file.arrayBuffer())`, audio pur) ; il ne « cherche » pas une piste dans une vidéo. Extraire l'audio d'un conteneur vidéo côté navigateur est un sujet technique en amont, non traité par Eddy — **hors périmètre**, pas à prototyper ici. **La transcription porte sur le son uniquement.**
- **La voix extraite donne des cues, un cue par mot avec deux bornes `start` et `end`.**
- **Placement synchrone dans le grid editor** : le son (ou la vidéo) est placé dans le grid editor ; **en synchrone**, ses cues sont placés dans la **piste réservée** de ce média (la piste de cues — `sequence-editor` : `EditorScene.cues`, `TextCue`).
- **Mapping concret (résolu)** : **chaque `start` ET chaque `end` devient un cue à `timeMs` unique** — donc un mot `{start, end}` produit **deux** cues ponctuels, pas un segment. Chaque cue est **aimanté** (`SnapPoint.source: 'cue'` existe déjà — le cue est déjà une cible d'aimantation dans `sequence-editor`, aucune extension du modèle de snap nécessaire). Cela colle exactement au `TextCue {id, timeMs, label}` ponctuel existant : whisper produit start+end, on en fait deux cues ponctuels aimantés. **Plus de point de mapping ouvert.**
- **Extension future (notée, pas v1)** : convertir les **textes extraits en sous-titrage**. Le texte des mots est donc à conserver (le `label`/texte du cue le porte déjà), en vue de ce sous-titrage ultérieur — mais le sous-titrage lui-même est hors périmètre immédiat.

  **→ Chantier post-v1 distinct, spec à part (utilisateur, 2026-07-11) : création / gestion de sous-titres. DEUX versants.**
  - **Versant Codplay — le rendu** : un chantier sur le **composant média** (`MediaComponent`), **peut-être un modèle de perso particulier** dédié aux sous-titres. Aujourd'hui aucune gestion de piste texte / `<track>` / WebVTT (**vérifié** — capacité entièrement nouvelle). C'est là que les sous-titres s'**affichent** sur la vidéo.
  - **Versant ed2 — l'édition** : un **éditeur** pour (a) **corriger les erreurs de transcription** (whisper se trompe — le texte extrait doit être éditable) et (b) **fixer les bornes des phrases**.

  **Les grains de granularité temporelle — ils COEXISTENT, ne se remplacent pas (utilisateur, 2026-07-11)** : la même source audio se décline en plusieurs grains superposés, chacun pour un usage —
  - **grain-mot** — produit par whisper (start/end → deux cues ponctuels aimantés). **Conservé** (base d'aimantation, points d'accroche).
  - **grain-phrase** — **ajouté** par-dessus (pas une transformation du grain-mot, une couche de plus) : regrouper des mots en phrases, ajuster début/fin. Sert le **sous-titrage**. Les cues mots aimantés sont les points d'accroche pour poser ces bornes.
  - **grain-phonème** — **futur**, conçu avec **Rhubarb** (ou d'autres modèles de lip-sync). Rattaché au composant **avatar** (dont la démo est déjà réalisée — cf. [[project-avatar3d-hypothesis]]). Sert la synchronisation labiale (visèmes). Ajouté quand on abordera le composant avatar, pas maintenant.

  Donc trois grains superposés (mot ⊂ phrase, + phonème), dérivés de l'audio, pour trois usages (aimantation / sous-titres / lip-sync avatar). Chacun s'ajoute, aucun ne remplace le précédent.
  - **Lien avec whisper** : les cues extraits (texte + `timeMs`) sont la **matière source** des deux versants — d'où la conservation du texte dès maintenant. Mais toute la **création/gestion/édition/rendu** des sous-titres fait l'objet d'une **spec séparée, post-v1**. À ne pas ouvrir maintenant ; juste préserver la matière (texte + bornes des cues mots) qui l'alimentera.

**Principe actif retenu, à reconstruire** : (a) une **fonction pure** `son → cues` (le `transcribe-to-cues` d'Eddy est un bon point de départ, quasi tel quel ; entrée = son uniquement, extraction audio vidéo hors périmètre) ; (b) un **acteur/service** de transcription (chargement du modèle une fois, progression observable, annulation) branché sur le contrôleur, invoqué au **chargement d'un son** dans le chutier ; (c) **aucune UI whisper dédiée** — la sortie **place les cues dans la piste réservée du son** dans le grid editor, en synchrone ; chaque `start`/`end` de mot = **un cue ponctuel aimanté** (`TextCue`), le texte conservé pour le sous-titrage futur. Le worker + modèle ONNX sont repris comme ressource technique. Le hook React et les composants démo d'Eddy sont écartés.

**Point ouvert à cadrer (non bloquant)** : la transcription est **asynchrone et lourde** (chargement du modèle + inference), mais le média doit pouvoir être **placé tout de suite** dans le grid editor — les cues arrivent **après**, se posent dans la piste réservée quand la transcription rend. Donc : placement du média immédiat, remplissage de la piste de cues différé (état « transcription en cours » observable sur la piste). À articuler avec le flux d'import (la transcription est une suite de l'import, pas un préalable au placement).

### Arbitrages du modèle de données — tranchés (utilisateur, 2026-07-11)

Réponses aux points ouverts (parent/ordre, content, décor, DecorPatch, changement de content). Vérifiés contre Eddy (invitation explicite pour le modèle de relation) et le sequence-editor ed2.

#### 1. Parent / ordre — modèle relationnel, ordre par CLÉ TEXTUELLE FRACTIONNAIRE

**Eddy n'est PAS normatif ici** : il a *testé* un procédé, pas forcément le bon. Ce qui suit s'inspire de la forme relationnelle mais **rejette explicitement** l'approche d'ordre qu'Eddy avait retenue — Eddy est ici le **contre-exemple** qui motive la décision, pas la référence dont on part.
- **Ce qu'Eddy avait essayé, et qui n'allait pas (leçon, pas modèle)** : la capsule portait une **liste d'ids d'items**, chaque item une **ref à son parent**, l'ordre par un **`Int`** (« n° de slot »). Défaut : changer l'ordre / déplacer dans la hiérarchie **forçait à renuméroter tous les items** de la capsule. Une **table de jointure** aurait été trop lourde pour ce seul besoin d'ordre. → à ne pas refaire.
- **Décision ed2 (le choix propre) : ordre par clé textuelle fractionnaire.** On trie **alphabétiquement** : `"a"`, `"b"`, … ; insérer entre `"a"` et `"b"` donne `"ab"`, etc. Une insertion/déplacement ne touche **qu'un** item (sa clé), jamais la fratrie — pas de renumérotation, pas de table de jointure. (Pattern « fractional indexing » : clé intercalable à l'infini.) C'est ce qui **résout** le défaut qu'Eddy avait rencontré.
- **Parent** : chaque item porte une **ref à son parent** ; l'ordre parmi les frères = la clé textuelle. Modèle **plat** (parent + clé), l'**arbre** que sequence-editor consomme en est *dérivé*. Tranche le point 1 originel en faveur du plat. Rouvre item-model-spec §4 (« pas de champ parent, l'arbre porte tout ») — **à mettre à jour**.

#### 2. Content — objet à part entière, référence la source, transporte des infos (texte notamment)

Décision utilisateur ; Eddy avait exploré une forme comparable, mais ne vaut **pas** validation (il a testé, pas prouvé) — au mieux une illustration qu'une telle forme est tenable.
- **content est un objet à part** qui **référence la source** dont se sert l'item (le média, le fichier…).
- Il **transporte d'autres infos**, notamment pour le **texte**. (Illustration Eddy, non normative : il y stockait `inner`, `lang`, un `timestamp` JSON annoté « words, visemes » — signe que la forme peut porter les grains mot/phrase/phonème, sans que le schéma Eddy soit à copier.)
- Table `contents` séparée dans le modèle ed2 : content = *ce que l'item montre* + les métadonnées de cette source, distinct du décor.

#### 3. Décor — décor initial OBLIGATOIRE + suivants liés aux kf (calqué sur le perso)

La définition du décor a évolué : **au début** le lien décor↔item était forcément par kf ; **désormais** on se calque sur le **perso** —
- un **décor initial, obligatoire** (l'état de base de l'item), **plus** les décors suivants liés aux **kf**.
- **L'état initial correspond à l'état « transition d'intro terminée »** : la toute première insertion d'un item (pendant la transition d'intro) est **déjà à un état enrichi** (l'intro amène *vers* cet état initial, pas depuis un néant).
- **À VALIDER (point ouvert soulevé par l'utilisateur)** : « normalement on a travaillé sequence-editor pour en tenir compte, mais il faut valider. » **Vérification faite** : côté ed2, le décor par kf existe (`Keyframe.decorId`) et il y a **un précédent de décor sans kf** — mais **seulement pour la capsule racine** (`EditorScene.rootDecorId`, « posé une seule fois »), **pas** au niveau d'un item ordinaire. `TrackNode` (l'item) **n'a pas encore** de champ « décor initial ». Donc : le modèle « décor initial obligatoire par item » **n'est pas encore porté** dans sequence-editor — le précédent existe (racine) mais pas généralisé à l'item. **À faire / valider explicitement**, ce n'est pas acquis.

#### 4. DecorPatch n'est pas une référence — le modèle « Décor » contient TOUT ; content est la voie de construction de l'app

- **`DecorPatch` a été introduit pour construire dedit — ce n'est PAS une référence de modèle.** Ne pas raisonner à partir de sa forme actuelle.
- **Le modèle « Décor » (le vrai) contient TOUT** : les paramètres d'aspect **et** les paramètres de capsule. (Donc ma « convergence à trancher » — sortir capsule/texte du DecorPatch — était mal posée : le décor *contient* l'aspect et la capsule ; ce n'est pas le texte/contenu qui y est mêlé à tort.)
- **Tous les types générés par l'app passent par content** — pas seulement texte/capsule que je citais. **« C'est par là qu'on bâtit l'app. »** content est la voie de construction : chaque type d'item référence sa source/données via content.
- **Capsule définie une seule fois** : on **ne change pas** le fonctionnement d'une capsule « en route » — sa définition est **temporelle par nature**, donc figée à la définition (pas de mutation de sous-type/distribution en cours de vie). Simplifie le modèle : la capsule est posée, pas reconfigurée dynamiquement.

#### 5. Changement de content en cours de vie — PAS dans l'éditeur (v1)

- Codplay **sait** gérer un changement de content d'un item ; **mais ed2 n'en a pas besoin** pour le moment. **Décision : pas de changement de content dans l'éditeur.** Un item montre un content, fixe.
- **Exception traitée ailleurs (sujet texte)** : un **dispositif prenant un tableau de textes** pour faire vivre une **suite de phrases** dans un même item (sous-titres par ex.) est **possible**, mais ce sera une **interface spécifique** (chantier texte), pas le cas général. L'app vise la **simplicité** pour l'utilisateur ciblé — cette capacité (content variable) n'est pas adaptée au cas courant, donc réservée à un dispositif dédié.

**Ce qui reste à cadrer en spec** (pas des blocages, des précisions) : concilier parent+clé-fractionnaire avec la vue arbre de sequence-editor (mettre à jour item-model-spec §4) ; **valider/porter** le décor initial obligatoire au niveau item (point 3, pas encore fait hors racine) ; forme exacte de content par type (texte porte plus que la source).

#### 6. Ce que l'ITEM porte en propre — le modèle de données pour sa représentation timeline (utilisateur, 2026-07-11)

Jusqu'ici on a dit ce que l'item **relie** (content, décor, zones — par référence). Il faut rendre explicite ce qu'il **porte en propre** : les données nécessaires à sa **représentation dans la timeline**. Deux natures à distinguer nettement.

**A. Données propres de l'item (portées directement, sa représentation timeline)** :
- **id** — identité stable, de bout en bout (= id du perso au build).
- **type** (`itemType`) — texte / image / média / vidéo / capsule ; ouvre les propriétés éditables et détermine le perso au build.
- **clé d'ordre** — la clé textuelle fractionnaire (point 1) : place parmi les frères.
- **parent** — ref au parent (point 1) ; l'arbre en est dérivé.
- **keyframes** — la liste des kf de l'item : chaque kf porte `{ timeMs, decorId, transitionIn?, transitionOut?, name?, markerId? }`. C'est le cœur de la représentation timeline — *quand* l'item change, et vers *quel* décor.
- **décor initial** (point 3, à porter) — le décor de base obligatoire, hors kf, état « intro terminée ».
- **transitions** — portées **par kf** (`transitionIn`/`transitionOut` : `{kind:'named'|'interpolated', durationMs, …}`) : comment l'item entre/sort/change à chaque kf.
- **visible** — état d'affichage dans l'éditeur (propriété d'édition, pas de rendu).
- **si capsule** : **sous-type** (`capsuleType`), **distribution** (`{mode, staggerInMs?, staggerOutMs?}`), **grille** — les réglages spatio-temporels poussés sur les enfants (définis **une fois**, point 4) ; et ses **enfants** (dérivés de parent+ordre, pas une liste portée — cf. point 1, on ne porte pas de liste d'ids).

**B. Données reliées (référencées, pas portées)** : content → `contents` ; décors → `decors` (par kf + initial) ; zone(s) → `zones` (par id).

**État réel vs cible (vérifié dans `sequence-editor/types.ts`)** — `TrackNode` porte déjà : `id`, `kind`, `label`, `visible`, `contentType?`, `capsuleType?`, `distribution?`, `children?`, `keyframes[]` ; `Keyframe` porte `{id, timeMs, decorId, transitionIn?, transitionOut?, name?, markerId?}`. **Écarts avec les arbitrages** :
- pas de **clé d'ordre** ni de **ref parent** (aujourd'hui l'ordre = position dans `children[]`, le modèle « arbre » ; à migrer vers plat + clé fractionnaire, point 1) ;
- `contentType` (énum en dur) est à remplacer par `itemType` + une ref **content** (point 2, item-model-spec §3 le prévoyait déjà) ;
- pas de **décor initial** au niveau item (point 3) ;
- `grid?` sur `TrackNode` est explicitement **provisoire/démo** (à porter dans les réglages capsule, `CapsulePatch.grid`).
Ces écarts sont les points de **migration** du modèle actuel vers le modèle cible — à faire, pas à redécider.

### Réglages capsule — interface conceptuellement séparée de decor (utilisateur, 2026-07-12, rédactionnel seulement)

**Rappel de cadre : on est ici dans le RÉDACTIONNEL des tâches à accomplir — rien n'est patché dans le code pour le moment.** Ce qui suit décrit une décision de conception à porter plus tard, pas un changement de code immédiat.

Décision : **séparer conceptuellement les réglages capsule de decor** (côté édition, comme on l'a déjà fait côté modèle où la capsule a quitté `Decor` pour `Item.capsule`). Les réglages capsule sont **une interface à part** :
- elle **continuera probablement d'être portée par la barre d'édition conçue pour dedit** (même contenant, même surface d'édition) ;
- mais elle **ne relève plus de decor** — elle édite `CapsuleDef` (sur l'item, statique), pas un décor variable par keyframe.

**État actuel (vérifié — « si ce n'est déjà fait » : ce n'est PAS fait)** : dedit traite tous les panneaux uniformément (`panelsForTypes`, `controller.ts`) ; le plan UI dedit note qu'« un item capsule reçoit les mêmes panneaux qu'image/média » (`dedit-demo.ts`) — les réglages capsule ne sont donc **pas** séparés du décor aujourd'hui, ils passent par la même mécanique de panneaux, adossés à `CapsulePatch`.

**Ce que ça implique (à porter, pas maintenant)** :
- Le **panneau capsule** devient une interface distincte qui édite `CapsuleDef` — pas un panneau de décor parmi d'autres. Il vit dans la même barre d'édition, mais son intention va vers `Item.capsule`, jamais vers `decors`.
- Cohérent avec le flux d'édition déjà décrit : dedit émet une **intention typée par la cible** — `decors` pour l'aspect, `Item.capsule` (`CapsuleDef`) pour les réglages capsule, `contents` pour le contenu. La séparation d'interface est le pendant, côté UI, de la séparation déjà faite dans le modèle.
- Impact sur le plan UI dedit (`modules/2026-07-08-dedit-shadcn-ui-plan.md`, « Panneau capsule ») : à reformuler quand ce chantier s'ouvrira — le panneau capsule cible `CapsuleDef`, pas `CapsulePatch`, et n'est pas conceptuellement un panneau de décor.

**Statut** : décision de conception actée (séparation capsule/decor jusque dans l'interface) ; **rédactionnel seulement, aucun code touché**. À concrétiser au chantier UI dedit / intégration.

### Établissement du contenu — à part, à la création de l'item (utilisateur, 2026-07-12, rédactionnel)

**Toujours rédactionnel, aucun code touché.** Suite logique de la séparation capsule/decor : le **contenu est lui aussi à part** de decor. Il ne s'édite pas dans dedit — il s'**assigne à la création de l'item**, par des gestes d'interface dédiés (c'est déjà le cas par nature : un item naît *avec* son content).

Trilogie qui se dessine, trois responsabilités d'édition séparées (même barre possible, cibles distinctes) :
- **aspect** → decor (dedit), variable par keyframe ;
- **réglages capsule** → `Item.capsule` (`CapsuleDef`), panneau dédié, statique ;
- **contenu** → `Content`, **assigné à la création**, gestes dédiés (ci-dessous).

**Correction (utilisateur, 2026-07-12) — PAS le mécanisme Eddy (clic → item par défaut projeté).** ed2 a un mécanisme **plus intuitif et unifié** : un bouton ouvre un **mode « création de… »**, et l'utilisateur **trace d'abord un rectangle sur la scène**, puis renseigne le contenu. On **trace toujours d'abord, on renseigne ensuite** — plus de « projeter un élément par défaut ». C'est le mode création de selection-frame (tracer → générer un item depuis la géométrie, `onCreate`/`attachItem`, `docs/plans/2026-07-03-selection-frame-variantes-plan.md`), **généralisé à tous les types**.

**Les voies de création** :

1. **Créer par tracé (bouton → mode « création de… »)** — geste unique décliné par type :
   - **texte** : bouton → mode création → l'utilisateur trace un rectangle → **saisit le texte**.
   - **capsule** : bouton → mode création → trace un rectangle → **renseigne les paramètres de la capsule**.
   - **image** : ramenée dans le **moule commun** — bouton « image » → **tracé** → **sélectionner l'image dans le cadre** (la sélection de source est l'étape « renseigner », comme le texte / les params). Le « sélectionner l'image d'abord, puis tracer » n'est plus la voie de base mais un **raccourci** (voir ci-dessous).
   Dans tous les cas : tracer le rectangle vient **avant** de renseigner le contenu/les paramètres. L'item naît de la géométrie tracée, le content/les réglages se remplissent ensuite.

   **L'asymétrie image, résolue par les commandes (utilisateur, 2026-07-12).** Constat : « sélectionner image → tracé » inversait l'ordre des autres (source *avant* tracé). Résolution : le mouvement commun se décompose en **deux commandes indépendantes** —
   - (a) `createItem(type, géométrie)` — le tracé produit un item du type, **sans content encore assigné** ;
   - (b) `assignContent(itemId, source)` — renseigner : texte saisi, params capsule, **ou image choisie**.

   Vu ainsi, l'image ne fait **rien de spécial** : son étape « renseigner » est « choisir l'image ». Et « sélectionner l'image d'abord » devient un **raccourci** qui ne fait qu'**inverser l'ordre de collecte** de deux commandes indépendantes (la source est prête avant le tracé, donc (b) s'applique dès que (a) a créé l'item). Résultat identique ; seul l'ordre des entrées change. **Pas confus** — c'est justement le bénéfice de la base de commandes : deux ordres = **une** paire de commandes invoquée différemment, pas deux chemins de code.

   **Condition unique à tenir** : `createItem` doit pouvoir produire un item **temporairement sans content** (un item image tracé mais pas encore pourvu). C'est un **état transitoire valide** — cohérent avec « le content est à part, assigné à la création, pas un préalable à l'existence de l'item ». Si au contraire le modèle exigeait un content dès la création, les deux ordres divergeraient vraiment et là ce serait confus. Donc : **l'item naît sans content, l'assignation est une seconde commande** — c'est ce qui rend la tolérance des deux ordres gratuite.

### Tout item naît en type `bloc`, puis se différencie (utilisateur, 2026-07-12)

Généralisation qui **unifie la création** et donne un nom à l'« état transitoire sans content » ci-dessus.

- **Création = toujours un `bloc`.** `bloc` est le **type sans contenu** ; `createItem` produit toujours un `bloc`. Une **seconde phase** lui assigne un **type différencié** (texte, image, capsule…).
- **Les « boutons » sont des presets d'une même opération** : *créer un `bloc` + le différencier vers tel type*. « Créer texte » = créer un bloc puis le typer texte ; idem image, capsule. Un seul mécanisme de création, plusieurs presets.
- **`bloc` revient à sa définition d'origine.** **Renverse item-model-spec §5** qui dit aujourd'hui « `bloc` n'est PAS une valeur distincte — un bloc est un `text` à contenu vide ». Décision : c'était une **convenance sans objet** ; `bloc` redevient le **type fondateur** (sans contenu), et `text` une **différenciation** parmi d'autres. → `ItemType` gagne `'bloc'` comme valeur ; §5 à réécrire au chantier concerné (spec normative, pas patchée ici).
- **`bloc` = valeur d'`ItemType`** (pas un « type null ») : c'est une différenciation explicite, cohérente avec le fait que le type est un **axe de résolution vers un composant** (voir hypothèse ci-dessous), pas seulement « a-t-il du contenu ».

**Changement de type — NON en v1, mais la structure le prépare :**
- La structure `bloc → différenciation` **permettrait** de changer le type d'un item déjà différencié (ex. image → texte), avec **risque de destruction** de contenu. **ed2 v1 n'autorise PAS ce changement** — sauf le seul cas `bloc → autre chose` (la différenciation initiale), qui est **invisible à l'utilisateur** (il croit créer un texte, pas « créer un bloc puis le typer »).
- **Bénéfice différé** : le jour où le changement de type s'avère utile, la structure est déjà là — on **lèvera une restriction**, on ne refera pas le modèle. C'est la raison de fond de ce choix : préparer sans ouvrir.

**Hypothèse de contexte (utilisateur — approfondit le pourquoi de cette interface, PAS une feature à faire) :** le modèle `bloc → type` ouvrirait aussi la **création de types spécialisés** résolus par des **composants distincts, sans suppression du contenu**. Exemple : un **texte « graphique »** géré par un composant qui rendrait un **SVG** au lieu d'un tag HTML — même contenu textuel, rendu différent. **Invisible à l'utilisateur** quant au mécanisme, mais il verrait apparaître des **options liées à ce choix**, cohérentes de son point de vue. Ce que ça révèle pour la conception : **le type différencié détermine aussi quel composant rend le contenu** (pas seulement quel contenu) — d'où l'intérêt de `bloc` comme socle et du type comme axe de résolution vers un composant. Hypothèse illustrative, à ne pas construire ; sert à cadrer l'interface qu'on conçoit.

**Statut** : décision actée (tout item naît `bloc`, presets = différenciation ; renversement de item-model §5 ; pas de changement de type hors `bloc→X` en v1). Structure choisie pour préparer le changement de type futur sans l'ouvrir. **Rédactionnel — rien codé** ; §5 à réécrire quand son chantier s'ouvre.

### Modèle général d'extensibilité d'ed2 : un item + un objet de capacités par type (utilisateur, 2026-07-12)

Le raisonnement `bloc → texte graphique` se généralise en **modèle**, et il tient.

**Le patron.** Un **type différencié** peut porter des **capacités propres** qui ne vont **pas dans Content** (le contenu reste le contenu) mais dans un **objet dédié au type**. **Parallèle avec capsule** : la capsule est déjà exactement ça — un item dont les capacités spécifiques sont décrites par un objet dédié (`CapsuleDef`). Donc **capsule n'est pas un cas particulier, c'est la première instance** du patron.

Forme :
- ce que **tout** item porte : id, type, place (parent+ordre), keyframes ;
- ce qu'il **relie** : content (→ contents), décor (→ decors), zone (→ zones) ;
- ce qu'un **type différencié ajoute** : un **bloc de définition propre au type** — `CapsuleDef` (capsule), un futur `GraphicTextDef` (texte graphique), etc. `Item.capsule?` est le **premier membre** d'une famille `Item.<typeDef>?`.

**Loi de croissance d'ed2 (le point central).** L'enrichissement d'ed2 passe par **ce type de construction**, qui a un **symétrique côté runtime** : définir un nouveau type d'item côté auteur va **de pair** avec construire le **perso Codplay et le composant** qui le rendent. Les deux moitiés d'un même geste —
- **côté ed2 (auteur)** : nouveau type dans `ItemType` + son objet de capacités (`<type>Def`) + les options d'interface associées ;
- **côté Codplay (runtime)** : le perso + composant qui rend ce type (**vérifié** : `registerComponent`/`overrideComponent` existent, `renderer`/`runtime-component-orchestrator` — le registre est prévu pour cette extensibilité) ;
- **le Builder** fait la jonction (type ed2 → perso Codplay), comme déjà pour tous les types.

C'est cohérent de bout en bout avec l'acquis : le type = **axe de résolution vers un composant** (dit plus haut), la frontière Builder, l'extensibilité du registre Codplay. « Enrichir ed2 » a désormais une **forme régulière**, pas du cas par cas.

**Réserve de discipline (pour que le modèle reste sain, pas déborde).** L'objet de capacités décrit **les capacités PROPRES au type** — ce que ce type sait faire et que les autres ne savent pas. Il ne reprend **ni** le contenu (→ Content), **ni** l'aspect (→ Decor), **ni** la structure temporelle (→ keyframes). `CapsuleDef` respecte déjà ça (distribution/grille/sous-type = propre à « être un conteneur », rien d'autre). Tant que chaque `<type>Def` reste aussi discipliné, le modèle tient ; le jour où l'un porte du style ou du contenu, c'est le **signal d'un mauvais découpage** — à corriger, pas à laisser (cf. la séparation qu'on vient de faire en sortant `text`/`capsule` de Decor).

**Statut** : **modèle d'extensibilité retenu** — item + objet de capacités par type différencié (capsule = 1re instance), avec symétrique runtime (perso + composant) et le Builder en jonction. Forme régulière de croissance d'ed2. Hypothèses (texte graphique, autres types) = illustrations, pas features. **Rédactionnel — rien codé.**

### La symétrie complète : services Codplay ↔ Decor ; le substrat de rendu ↔ l'éditeur (utilisateur, 2026-07-12)

La **réserve de discipline** ci-dessus (l'objet de capacités ne reprend pas l'aspect, qui est « relié ») a son **exact miroir côté Codplay** : les **services**.

**Services = capacités transverses, côté runtime.** Un composant Codplay déclare des **services** — des capacités **partagées par plusieurs composants** (`style`, `className`, `attr`). **Vérifié** : *tous* les composants (`text`, `image`, `media`, `layout`, `list`, `input`, `polygon`, `tag`) déclarent `['className', 'style', 'attr']` — ce sont les capacités communes, pas propres à un type. C'est **exactement** ce que `Decor` regroupe côté modèle (style, classes…). La correspondance est structurelle :

| côté modèle ed2 | côté Codplay (runtime) |
|---|---|
| **transverse, relié** (Decor : style, classes, position) | **services** partagés (`style`, `className`, `attr`) |
| **propre au type** (`<type>Def` : CapsuleDef…) | **le composant** lui-même (sa logique de rendu propre) |

Les deux découpages sont **le même**, vus des deux rives de la frontière : ce qui est mutualisé d'un côté l'est de l'autre ; ce qui est spécifique d'un côté l'est de l'autre. Le Builder relie les deux.

**Pourquoi Decor fusionne les capacités du HTML — et ce que ça implique (le point profond).** `Decor` regroupe des capacités **du HTML** parce que **le HTML est son espace de rendu naturel**. Donc `Decor` est **lié au substrat de rendu**, pas intrinsèque à ed2. **Codplay, lui, est indépendant du substrat** (un composant déclare des services, il n'impose pas HTML).

Conséquence prospective (hypothèse de cadrage, **pas** un projet) : on pourrait imaginer un **« ed3 » où tous les composants sont rendus en SVG**, un **« ed4 » via canvas**… Chacun aurait **son propre `Decor`** (les capacités de *son* substrat — attributs SVG, opérations canvas), mais le **même modèle** (item + `<type>Def`, services transverses, Builder en jonction, création par `bloc` + différenciation). **L'éditeur choisit son espace de rendu ; le modèle et Codplay ne changent pas.** Ça situe précisément ce qui est propre à ed2 (le substrat HTML, donc *ce* Decor) vs ce qui est le modèle réutilisable (tout le reste).

**Statut** : symétrie services↔Decor actée comme **fait de conception** (mutualisé/spécifique se correspond des deux côtés). `Decor` = lié au substrat HTML d'ed2, pas au modèle ; d'où ed3/ed4 concevables sur le même modèle avec un autre substrat (hypothèse illustrative). **Rédactionnel — rien codé.**

2. **Glisser un média du chutier → la scène (player)** : crée un item avec ce média comme **source (content)**, posé à l'endroit du drop, **au premier plan géométriquement**. (Voie drag, complémentaire du tracé.)

3. **Glisser un média du chutier → le sequence-editor** : crée un item avec ce média comme source, inséré **à l'endroit du drop dans l'arbre de la scène** (position/parent selon le point de dépôt). Même création, cible « arbre » au lieu de « géométrie scène ».

**Bonus texte** : pour un item texte, un **champ éditable apparaît sur la scène** (édition in-situ, sur le player) **et** un autre existe **dans dedit** — deux points de saisie du même `Content.text`. (Cohérent avec « le texte est dans Content ».)

**Ce que ça pose (à porter, pas maintenant)** :
- L'**assignation de content** est une affaire de **création d'item**, pas d'un panneau dedit. dedit n'assigne pas le content ; il édite l'aspect d'un item qui a déjà son content.
- Ces gestes sont des **commandes** (créer item + source, à telle position) — dans l'esprit du jeu de commandes de base composable déjà acté. Le drop chutier→scène et chutier→timeline sont deux commandes de création qui diffèrent par la **cible de position** (géométrie plein-cadre-premier-plan vs place dans l'arbre).
- Le mode édition lancé par « créer texte/capsule » = la bascule vers l'édition in-situ + dedit sur l'item neuf.

**Statut** : décision de conception (contenu à part, assigné à la création ; 3 voies + bonus texte in-situ). Briques partiellement présentes (mode création selection-frame, chutier source de drag) mais pas réunies. **Rédactionnel — rien codé.** À concrétiser à l'intégration (étape 3 du plan app : chutier, création, sequence-editor) et au chantier texte (pour l'édition in-situ).

### Deux points à creuser après les axes d'architecture (utilisateur, 2026-07-12)

#### A. Édition du décor + gestes = actions les plus fréquentes → traitement de première importance

Nuance à l'axe 3 (composition de commandes) et à sa limite (« les gestes/l'éphémère restent en dehors »). Constat : l'**édition du décor** et les **gestes de géométrie** (déplacer, redimensionner, changer une couleur au curseur) sont les **actions les plus courantes** de l'utilisateur — celles dont il a le plus besoin, et qui font le **ressenti utilisateur**. Les ranger comme simple « éphémère jetable » les sous-estime.

- Ce n'est **pas** une contradiction de l'axe : le flux d'édition du décor déjà conçu (aperçu live + commit débouncé, avec la façade côté contrôleur) **est** la réponse. Mais il mérite d'être reconnu comme un **chemin de première importance**, pas un cas dérivé.
- **Point à creuser** : peut-être un **sous-traitement dédié, uniquement sur la partie décor** — soigner particulièrement la fluidité de l'aperçu, la latence du geste, le dosage du débounce, le confort. Important pour le ressenti, à approfondir au moment de l'édition décor (pas une refonte d'axe, un approfondissement de ce chemin précis).
- **Statut** : point ouvert, à creuser. Rédactionnel.

#### B. Module « story-comme-média » — une story vue comme un média paramétrable

Hypothèse d'un **module « story »** : inclure une **story Codplay** que l'éditeur voit comme un **média** (un item d'un type particulier). Non modifiable dans son fonctionnement interne (boîte noire, du moins au début), mais **paramétrable**.

- **Forme** : une **fonction de construction** qui **met à disposition de l'app une interface de configuration**. La story déclare ce qu'elle expose comme paramètres.
- **Exemple concret** : la démo **chrono** (`chrono-story.ts` existe — vérifié) devient un média dont on règle les **bornes** (durée) et l'**aspect** (couleur…). Le fonctionnement interne (le décompte) n'est pas accessible ; seul le paramétrage l'est.
- **Le point fort — ça VALIDE le modèle des types (axe 7)** : `story` serait un **type d'item** avec son **objet de capacités** (`StoryDef` = les paramètres exposés), son **composant côté runtime** (la story compilée elle-même), le **Builder en jonction**. Ce n'est **pas une exception** au modèle — c'est une **nouvelle instance** du patron « type + objet de capacités + composant ». Que le module s'y insère sans forcer est la preuve que le modèle tient. Le paramétrage suit la spécification des types déjà décrite.

- **La NOUVEAUTÉ à creuser — schéma de configuration auto-déclaré** : capsule a un `CapsuleDef` à champs **fixes** (kind, distribution, grille), connus d'avance. Une story-média est différente : son objet de capacités est **déclaré par la story elle-même** (le chrono dit « je me paramètre par durée + couleur »). Donc le type `story` n'a pas un `StoryDef` figé, mais un `StoryDef` **dont la forme est fournie par chaque story importée** — un **schéma de configuration fourni par le composant**. C'est un cran de généralité au-dessus de capsule : le type déclare ses paramètres dynamiquement, et l'interface de configuration se **génère depuis ce schéma**. Reste dans l'esprit du modèle (type + objet de capacités), mais introduit la notion de schéma auto-déclaré — à spécifier quand ce module s'ouvrira.
- **Non modifiable, paramétrable seulement** (v1) : cohérent avec « boîte noire » — l'éditeur ne touche pas l'intérieur de la story, il ne fait que remplir les paramètres qu'elle expose.

- **Statut** : hypothèse de module, non ouverte. Valide et enrichit l'axe 7 (types). Point neuf à spécifier le moment venu : le **schéma de configuration auto-déclaré par le composant** (vs les objets de capacités à champs fixes comme `CapsuleDef`). Rédactionnel — rien codé.

#### C. La story-média est un mécanisme d'extension par briques métier — et le véhicule de l'interactivité dans ed2 (utilisateur, 2026-07-12)

La story-média n'est **pas un type de plus** : c'est **potentiellement explosif pour les usages** de l'app. C'est un **mécanisme d'extension par briques métier clé en main**. Ce que ça change :

**1. Un nouveau registre d'usage.** Exemple : un module **quiz** où l'utilisateur entre questions, réponses, logique succès/échec. Et au-delà : tout ce qui a une logique interne (sondage, formulaire, mini-jeu…). L'app cesse d'être un éditeur de scènes *animées* pour devenir un éditeur de scènes *avec des comportements encapsulés*.

**2. L'interactivité : Codplay la résout ; ed2 n'est PAS ENCORE prêt — les modules story sont une étape intermédiaire. (Précision utilisateur, 2026-07-12.)** Ne pas dire « l'interactivité entre dans ed2 » sans nuance, mais **surtout ne pas dire « jamais ed2 »** :
- **Codplay résout l'interactivité — il a été créé pour ça.** La logique interactive (events, straps, réactif) vit dans Codplay.
- **Ed2 n'est pas « exclu par principe » — il n'est PAS PRÊT.** Ce n'est **pas** une frontière permanente, c'est un **état d'avancement** : il n'y a **rien d'écrit aujourd'hui** dans ed2 pour tenir compte de l'interactivité (un composant qui interrompt le fil, une timeline qui représente une attente…). Sa vocation simple explique qu'on n'ait pas commencé, pas qu'on n'y viendra jamais.
- **Les modules story sont une ÉTAPE INTERMÉDIAIRE** — pas la solution qui dispenserait ed2 de gérer l'interactivité, mais la **première marche** : une brique interactive clé en main (quiz…), configurée sans qu'ed2 ait encore à modéliser l'interruption du fil. Un palier pour y venir **progressivement**.
- **Ce qui reste vrai** : quand l'interactivité sera prise en charge, l'**interruption du fil d'une scène** touchera **ce qu'ed2 gère : le fil temporel** (timeline, seek). Construire la logique restera à Codplay ; représenter/éditer l'interruption du déroulé sera à ed2 — mais **rien n'est écrit pour ça aujourd'hui**, c'est à concevoir le moment venu.
- **Le point technique (à concevoir plus tard)** : ed2 orchestre un déroulé linéaire (la scène se joue de bout en bout selon le temps). Un composant qui **interrompt** ce déroulé (pause jusqu'à un événement) casse cette hypothèse ; la timeline devra un jour représenter « ici, le fil s'arrête et attend ». Pas modélisé aujourd'hui.
- **Objectif éloigné** : à garder en vue, pas à traiter maintenant. La story-média (quiz) est le premier cas concret qui amorcera ce chemin.

**3. La doctrine produit qui unifie tout : cacher la complexité de construction, laisser le bénéfice de l'usage.** L'utilisateur d'ed2 (grand public, posé dès le début) ne construit **pas** la logique d'un quiz — il remplit questions, réponses, règles. La complexité vit dans la story (faite par un auteur avancé en Codplay) ; l'utilisateur final n'en voit que l'**interface de configuration** (le schéma auto-déclaré, point B).

**Trois couches d'acteurs (rendues explicites par ce système)** :
- **le développeur Codplay** construit les briques (stories interactives, composants) ;
- **l'app ed2** les intègre par le patron *type + schéma auto-déclaré* (axe 7 + point B) ;
- **l'utilisateur grand public** les assemble et les configure, sans voir la mécanique.

**Horizon ouvert (signalé, PAS tranché) — l'interactivité change ce qu'est une « scène ».** Jusqu'ici une scène ed2 se **joue** (déroulé temporel, seek, diffusion autonome). Une scène avec un quiz **réagit** : le succès/échec branche sur quelque chose (une autre scène ? un état ? un score ?). Ça touche le concept futur de **chapitre** ([[project-chapitre-concept]] : série de scènes depuis un scénario) et le `scene.state` déjà exposé. La story-média interactive est peut-être le **premier fil reliant « scène » à « parcours »**. Non tranché — horizon que ce système ouvre, à garder en vue sans le construire.

**Statut** : la story-média est reconnue comme **axe d'usage majeur** (pas un simple module) — extension par briques métier, entrée de l'interactivité, doctrine « complexité cachée / usage offert », trois couches d'acteurs. Ouvre l'horizon scène→parcours (à ne pas construire, à ne pas perdre). Rédactionnel — rien codé.

### Sortie attendue

Une spec normative nouvelle (racine de `plan/`) définissant EditorScene, item, content et capsule au sens de l'application, s'appuyant sur item-model-spec et capsule-spec sans les dupliquer. Le pourquoi des choix restera ici. **Les arbitrages du modèle sont désormais tranchés (section ci-dessus)** — la spec peut être écrite ; restent à porter dans le code deux points (parent §4, décor initial item).
