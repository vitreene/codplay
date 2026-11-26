# CodPlay V2 — présentation des transitions `replace`

> Version de référence : CodPlay V2 — 2026-11-10.

## Rôle et propriétaires

Les capacités `replace-slot`, `replace-text` et `replace-media` choisissent
une présentation temporaire autour de l'état ou de la relation demandé par le
player. Elles ne remplacent pas le composant persistant ni son état logique.

Le player et `RuntimeComponentRuntime` possèdent la chronologie des actions,
leurs animations et la reconstruction par Seek. Le module replace prépare une
`ComponentAnimation` puis utilise le même échantillonneur et le même cycle de
fin que les autres animations de composant. La surface HTML ne possède que les
instantanés DOM, leur géométrie, les fragments texte, les représentations média,
les masques SVG, les styles de transition et le rendu H-i-C du profil `burn`.
Elle ne décide pas quelle scène,
ressource ou occurrence entrante doit être sélectionnée.

Lors d'un montage externe, l'application hôte — Sighty pour ses scènes — choisit
l'occurrence entrante, son profil et le moment de demander le montage. Elle
conserve la décision de cycle de vie des instances. La façade publique CodPlay
exécute la relation explicitement demandée ; la présentation replace n'ordonne
pas `play`, `pause`, `seek` ou `destroy` sur l'instance enfant et n'en prend pas
la propriété.

## Horloges

Les remplacements déclarés sur une action utilisent le temps logique du player
et sont reconstruits depuis la timeline lors d'un Seek.

La présentation demandée autour de `instances.mount({ replace })` utilise une
horloge d'opération : son temps est la somme des `deltaMs` effectivement reçus
sur les frames du `TimeTicker` partagé par le moteur. Ce temps ne dépend pas de
la position logique du player hôte. Un Seek, un reset ou un replay de l'hôte ne
le modifie pas. La transition progresse uniquement lorsqu'une frame du ticker
est distribuée ; si l'hôte est en pause, les frames d'un autre player peuvent
continuer de la faire progresser. Sans frame, elle reste figée.

Les deux horloges empruntent le circuit `RuntimePlayerEventController` →
`RuntimePlayerPresentation` → `RuntimeComponentRuntime` et le même
échantillonneur `ComponentAnimation`. Les modules replace ne créent ni boucle
`requestAnimationFrame`, ni temporisateur, ni source d'horloge propre. La forme
de `RuntimeEngineOptions` n'est pas étendue pour ces transitions.

## Calcul des poses

Les valeurs de pose et leurs easings sont préparés et résolus avec ACE via
`prepareTween`/`resolveTween`. Les couleurs de rouleau utilisent les
adaptateurs ACE de couleurs. La conversion des valeurs échantillonnées en
styles, unités `rem`, géométrie DOM et masque SVG appartient à la surface HTML.
La propagation texte/média réutilise `computeReplaceStaggerDelays`.

Pour le recalage des fragments texte, l'adaptateur lit les matrices CSS calculées
dans le DOM, puis compose les transforms et reporte les offsets avec les
opérations ACE `multiplyMatrix`, `invertMatrix` et `transformPoint`. La surface
ne maintient pas de circuit parallèle de calcul matriciel.

L'implémentation de présentation est répartie par propriétaire dans
`runtime/runner-html/replace-presentation/` : sessions, géométrie et DOM,
texte, frames/cellules média, poses, masques, rendu HTML-in-Canvas,
normalisation de profil et identifiants. `replace-presentation-surface.ts`
reste la porte d'export de la surface HTML. Le shader `burn` est dans
[`html-in-canvas-burn/burn-renderer.ts`](../src/runtime/runner-html/replace-presentation/html-in-canvas-burn/burn-renderer.ts).

## Cycle de vie des vues

- Les transitions classiques utilisent des instantanés temporaires. H-i-C
  présente les états DOM natifs dans des slots. Le composant et le player
  restent propriétaires de l’état persistant.
- Les vues sont retirées à la fin, à l'annulation, lors du remplacement d'une
  session ou au teardown de leur propriétaire.
- `replace-media.split: 'cells'` garde un clone source et le média cible
  persistant dessous, puis applique une seule grille de masques SVG au clone
  source ; la cible reste sans masque. En intro seule, la grille masque la
  cible. `replace-slot.split: 'cells'` réutilise cette même géométrie, ce même
  masque source et ce même cycle de session. Aucun circuit de clones/canvases
  par cellule n'est utilisé. La vidéo média clonée est figée à sa position de
  départ ; le nœud cible reste possédé et piloté par son composant.
- La grille `replace-slot` accepte une forme, `cellSize` en pourcentage de la
  largeur du slot (prioritaire sur `cellX`/`cellY`), une ou deux dimensions de
  grille, `staggerPattern`, `direction` et `stagger`. Sans pattern, ou avec
  `manhattan`, la propagation conserve le calcul par distance et l'origine de
  `direction`. `row-wave` démarre les cellules individuellement de gauche à
  droite, rangée après rangée ; `column-wave` les démarre de haut en bas,
  colonne après colonne. Les vagues excluent `direction`. La durée effective
  comprend toute l'enveloppe `stagger`. Un resize recalcule la grille et
  rééchantillonne la progression courante par le hook de mise à jour du
  composant.
- Le reflow repositionne ou reconstruit la présentation depuis les mesures
  actuelles tout en gardant la progression échantillonnée.
- Le profil entier `burn` dispose de sa session H-i-C avant toute création de
  snapshot classique. Un canvas `content="drawable"` dans la racine shadow du
  composant porte deux wrappers `drawable` avec un slot sortant nommé et un
  slot entrant par défaut. Les médias natifs restent des enfants directs de la
  racine persistante : leurs sélecteurs CSS et leur propriétaire sont conservés.
  La session réattache temporairement le média sortant détaché par la mise à
  jour, avec le marqueur transitoire existant qui le protège de la matérialisation.
  Elle le rattache avant le contrôle de disponibilité de l'entrée : la sortie
  reste donc dessinable dès le premier `paint`, y compris pendant la reprise
  asynchrone du circuit média existant. Le renderer ne charge aucune ressource.
  Aucun état média n'est cloné ou transformé en snapshot 2D sur ce chemin.
- Avant l'affichage du canvas, le renderer amorce ses deux textures existantes
  avec la frame native sortante déjà disponible (`img`, `video` ou composition
  canvas d'une interruption) et dessine la sortie à progression zéro. Ce dessin
  précède le premier `paint` H-i-C : la bascule DOM → canvas ne révèle donc pas
  de framebuffer vide. L'amorçage utilise le calcul de fit média partagé dans
  un viewport WebGL entier ; H-i-C utilise ensuite le viewport complet et une
  texture DOM allouée à la taille entière supérieure. Ces conversions distinctes
  ne garantissent pas l'alignement sous-pixel entre les phases. Cet amorçage ne
  crée ni clone DOM, ni canvas 2D, ni
  lecteur, ni texture supplémentaire ; les paints suivants remplacent ces
  textures avec les wrappers DOM vivants. Il ne charge aucune ressource.
- Le renderer charge les wrappers avec `texElementSubImage2D` sur `paint`, puis
  applique le shader et synchronise leur géométrie via `updateElementGeometry`.
  Le média entrant continue donc à fournir ses frames natives. Seule la
  progression reçue de `ComponentAnimation` fait avancer la transition ;
  `requestPaint` demande un rendu sans introduire une horloge locale.
  Le montage et les demandes de rendu dimensionnent le canvas avant que le
  navigateur peigne ses wrappers. L'upload et le dessin gardent ensuite cette
  taille. Cette stabilité du backing store ne garantit pas celle du cadrage
  entre amorçage natif et texture DOM. Le dessin
  ne redimensionne jamais le canvas après l'upload des textures.
- La surface vérifie les primitives H-i-C, WebGL2 et le programme shader avant
  de monter cette présentation. Leur absence sélectionne immédiatement le
  profil classique `mask-reveal` circulaire. `burn` est entier et exclut
  `split: 'cells'`. Son canvas reste dans le rectangle de la racine ; un reflow
  reprend la progression courante aux dimensions actuelles.
- Lors d'une interruption après le premier `paint`, le renderer redessine ses
  textures courantes puis lit immédiatement la composition par `readPixels`.
  Cette image devient la sortie de la transition suivante, sans passer par
  `cloneSnapshotNode` et sans dépendre du tampon de présentation conservé par
  le navigateur. Cette garantie ne couvre pas les interruptions reconstruites
  par Seek avant tout premier `paint` H-i-C : les textures d'amorçage ne portent
  alors que la sortie, sans la composition intermédiaire des deux états DOM.
- Fin, annulation, perte de contexte et teardown retirent le canvas, les
  listeners, les textures et le programme, puis libèrent explicitement le
  contexte. Aucun renderer ou historique de frames n'est conservé. La racine
  shadow, indétachable selon le DOM, reste réduite à un slot ordinaire sans
  ressources graphiques. Les attributs temporaires des médias sont restaurés
  et seul le contenu courant reste présenté. Le périmètre H-i-C vérifié porte
  sur les images et vidéos ; les relations foreign imbriquées ne sont pas
  certifiées par cette présentation.
- L'interruption texte repart de la composition visible. Le player conserve
  séparément la reconstruction de l'état logique de la timeline.
- La disponibilité asynchrone d'une frame média peut redemander un échantillon
  à la même position player afin de construire la vue entrante. Elle ne modifie
  pas le temps logique ni la progression de l'animation ; le ticker reste leur
  seule horloge.

Les comportements spécifiques de contenu, de segmentation et de capture média
restent définis dans [remplacement texte](./replace-text-v2-spec.md),
[remplacement média](./replace-media-v2-spec.md) et [slot](./slot-component-spec.md).
Le catalogue JSON et sa sélection auteur sont définis dans
[replace-presets](./replace-presets-v2-spec.md).

## Preuves

- [`foreign-mount.spec.ts`](../tests/facade/foreign-mount.spec.ts) pilote le
  `TimeTicker` avec des frames contrôlées : progression d'opération pendant
  la pause de l'hôte, indépendance du Seek/reset, absence de progression
  sans frame et retrait des vues à la fin.
- [`replace-presentation.spec.ts`](../../sighty/tests/replace-presentation.spec.ts)
  vérifie la sélection du profil entrant ou du profil du slot et la
  progression exclusivement sur les frames distribuées.
- [`replace-presentation-surface.spec.ts`](../tests/runtime/runner-html/replace-presentation-surface.spec.ts)
  vérifie les poses texte en `rem`, les transforms ACE, le chroma, les formes
  SVG, le reflow et le nettoyage.
- [`replace-module.spec.ts`](../tests/runtime/capabilities/replace-module.spec.ts)
  traverse `SceneBuilder` et `HtmlPlayerRunner` : formules de contenu,
  profils CSS/JSON, masques média, resize à temps constant, interruption
  A→B→C, gel de la copie vidéo et retry de frame à position player constante.
- La démo [`replace-carousel`](../../demos/src/v2/demos/replace-carousel/main.ts)
  exerce `burn` sur les chemins image et vidéo de `replace-media` : l'aller à
  1 500 ms dure 900 ms, puis le retour démarre à 4 000 ms après 1 600 ms de pause.
- Les contrôles navigateur H-i-C sur deux images opaques vérifient les états
  initiaux et finaux, leur mélange sans transparence à mi-parcours, le transfert
  de composition, le resize et le nettoyage sur perte de contexte. Une série de
  24 fins/annulations vérifie la libération des 24 contextes et le retrait des
  présentations. La lecture vidéo est observable par les callbacks natifs de
  frames pendant la transition.
- [`burn-session.spec.ts`](../tests/runtime/runner-html/html-in-canvas-burn/burn-session.spec.ts)
  vérifie la conservation du nœud sortant pendant la préparation d'une image
  ou vidéo entrante, son retrait à l'annulation, la transmission du média natif
  d'amorçage et les fits `cover`/`contain`/`fill`. Seule la frontière GPU est
  remplacée dans jsdom ; le contrôle du premier paint et du cadrage relève du
  parcours navigateur réel `replace-carousel`. L'absence de frame vide entre
  DOM et canvas se vérifie par enregistrement du compositeur, sans readback GPU
  dans les frames observées : un readback peut masquer ce défaut de bascule.
