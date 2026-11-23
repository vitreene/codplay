# Transcription de pages XML dans CodPlay V2

## Fixture SAMERA `p02` — hors route active

### Rôle

Cette section décrit le convertisseur conservé pour la page `p02` du cours
SAMERA `02_acces.xml`. Une page source produit un `SceneDoc`; chaque
`<sequency>` produit une story de ce document. Ce fixture n’est pas la scène
comparée par la route `?demo=course-motion`, qui utilise le cours standard
`02_circulation.xml`, page2. Les règles SAMERA ci-dessous restent propres à
`convertLegacyPage`.

Le document source retenu est conservé dans
[`page-p02.xml`](../src/v2/demos/course-motion-import/page-p02.xml). Ses
propriétés XML et ses traductions françaises sont dans
[`source-properties.xml`](../src/v2/demos/course-motion-import/source-properties.xml)
et
[`source-text-fr.xml`](../src/v2/demos/course-motion-import/source-text-fr.xml).
Les ressources de cette page sont copiées dans
[`public/assets/course-access/02_acces`](../public/assets/course-access/02_acces).

### Modèle de page et de temps

`convertLegacyPage` accepte un document `<page id="p02">` contenant un
`<default />` suivi de quatre `<sequency>`, chacune commençant par un fichier
audio connu. Il conserve leur ordre source dans les stories
`p02-sequence-1` à `p02-sequence-4`. Chaque story possède son stage `layout`
et son audio `media` en mode `master`, qui conduit l'horloge CodPlay depuis la
position native de cette piste. À la fin du son, la story suivante commence.
Son stage et son image d'entrée apparaissent pendant que le stage précédent
reste visible le temps du fondu d'entrée de 500 ms; le stage précédent et ses
éléments sans durée sont ensuite masqués. Cela garde toujours une image visible
pendant la transition. Le stage de la dernière story et ses éléments sans durée
restent visibles à `sequence:end`.

Le début d’une story est le cumul des durées audio précédentes. Les temps des
éléments et des événements sont relatifs à la story puis décalés à ce début.
Les durées lues dans les fichiers MP3 sont :

| Story | Audio | Début global | Durée |
|---|---|---:|---:|
| `p02-sequence-1` | `02_02_01.mp3` | 0 ms | 24 493,708 ms |
| `p02-sequence-2` | `02_02_02.mp3` | 24 493,708 ms | 20 026,667 ms |
| `p02-sequence-3` | `02_02_03.mp3` | 44 520,375 ms | 10 618,667 ms |
| `p02-sequence-4` | `02_02_04.mp3` | 55 139,042 ms | 19 570,667 ms |

La fin de la dernière piste fixe `sequence:end` à 74 709,709 ms. Un élément
sans `duration` reçoit un événement `display: none` 500 ms après la fin de sa
story intermédiaire, y compris si le XML porte `showAfter="Y"`; les éléments
sans durée de la dernière story n'ont pas d'événement de masquage. Pour les
images avec une durée, la sortie commence 100 ms après son échéance et
`display: none` est appliqué 500 ms plus tard. Les délais d’éléments imbriqués
s’ajoutent à ceux de leurs conteneurs.

### Éléments et ressources convertis

- `<img>` utilise le composant image partagé; les chemins source sont résolus
  dans les médias locaux et les dimensions intrinsèques sont définies par
  [`main.ts`](../src/v2/demos/course-motion-import/main.ts).
- `<svg>` est représenté par le même composant image, à ses dimensions et
  coordonnées source.
- `<container>` devient un `layout` imbriqué. `<sub>` devient un `tag` contenant
  la traduction française correspondante. Les positions `x/y` et dimensions
  des conteneurs sont projetées en `cqw` sur le stage; les classes source sont
  conservées. Pour `p02`, `is-flex-list` garde son flux flex vertical et
  `bullet` garde son affichage flex et son marqueur pendant l’affichage.
- Le stage reprend la famille Futura et ses poids 300, 400 et 700. Les textes
  héritent de la couleur de leur bloc, sauf si une propriété source
  `textColor` la remplace; une couleur `0x...` devient une couleur CSS `#...`.
  `textSize` est rapporté au canevas en `cqw`; la propriété `h4` de p02 vaut
  24 px source, soit `1.5cqw`. Le poids normal est 400; `is-bold` et
  `font-bold` appliquent 700, `font-semibold` 600 et `font-extrabold` 800.
- Les classes Bulma du bloc p02 gardent leurs valeurs de présentation :
  `message.is-link` fond `#eff1fa`, taille 16 px source (`1cqw`), coins 4 px;
  `message-body` couleur `#3850b7`, liseré gauche `#485fc7` de 4 px source et
  padding `1.25em 1.5em`. Les attributs `backgroundColor` suivent la même
  conversion des couleurs `0x...`.
- Les propriétés référencées par la page sont résolues depuis le fichier
  source. Les contenus CDATA contenant `&nbsp;` conservent l’espace
  insécable.
- Les images et SVG sans `id` reçoivent le même identifiant de chapitre et de
  chemin formaté que le lecteur source; une collision calculée dans une story
  reçoit un suffixe stable. Les identifiants source dupliqués sont refusés.
- Les coordonnées et dimensions source sont rapportées au canevas
  `1600 × 788` en `cqw`.
- Les effets d’entrée `fromRight`, `grow` et `growDown`, les valeurs d’alpha,
  les tweens d’alpha locaux et les tweens `targetItem` d’alpha présents dans
  `p02` sont convertis en actions d’éléments et événements CodPlay.

### Limites

La conversion ne couvre que les balises, propriétés et tweens rencontrés dans
`p02`; les balises non reconnues et les attributs non acceptés par leur
convertisseur sont refusés. Les quiz, fonctions, vidéos, autres langues,
l’agrégation de pages ou de chapitres, et le reflow selon le ratio d’écran ne
sont pas définis par cette conversion. Les collisions d’identifiants entre
stories et le canevas source rapporté en `cqw` sans redistribution des
éléments restent hors contrat.

### Références d’implémentation et d’acceptation

- [`legacy-page-converter.ts`](../src/v2/demos/course-motion-import/legacy-page-converter.ts)
  construit les stories, le décalage des temps, les éléments et les fins de
  story. Les coordonnées de conteneur, l’héritage des styles texte et
  l’affichage des classes flex sont vérifiés dans le player de `p02`.
- [`style.css`](../src/v2/demos/course-motion-import/style.css) et les polices
  locales sous [`fonts`](../public/assets/course-access/fonts) projettent le
  thème Futura et les classes Bulma utilisées par p02.
- [`legacy-image-converter.ts`](../src/v2/demos/course-motion-import/legacy-image-converter.ts)
  convertit les images, leur alpha et leurs trajectoires.
- [`course-motion-import.spec.ts`](../../codplay/tests/facade/course-motion-import.spec.ts)
  porte ses propres XML et valeurs de test et vérifie la compilation et le
  player partagé pour les mouvements d’image.
- La route `?demo=course-motion` charge les ressources source; Play, Seek,
  retour au début et rechargement de scène passent par les commandes V2
  partagées. La synchronisation master des quatre audios, les frontières entre
  stories, les tweens ciblés, le chevauchement visuel de 500 ms et la
  persistance de la dernière image sont exercés dans le navigateur connecté.

## Page SPIE `page004`

La démo `?demo=spie-transmission` sélectionne `02-transmission/page004`.
Elle fournit le fragment XML source, ses traductions françaises, les
propriétés utilisées et les médias à la
[transcription de page](../src/v2/demos/spie-transmission-import/transcribe-page-004.ts).
Le layout V2 partagé construit et monte la scène. La narration `04_01.mp3`
dure 25 050,667 ms et conduit le temps de la story en mode `master`. À la fin
du média, le ticker du player prend le relais tant que la story est active.
La vue subsiste à `sequence:end` avec l’état atteint pendant la lecture.

- Les SVG ordinaires utilisent `img`. Leur `viewBox` donne le rapport entre
  largeur et hauteur. La position de référence est le centre de l’image,
  rapporté au canevas source `1600 × 788`. Les textes hors flux et les listes
  gardent leurs coordonnées auteur.
- Les `<tween>` restituent les positions absolues en déplacements relatifs
  à la pose initiale. Les canaux distincts peuvent évoluer en même temps
  sur un même perso. Le nuage exerce opacité, position et échelle.
- Les cinq attributs `onClick` lus par
  [click-actions.ts](../src/v2/demos/spie-transmission-import/click-actions.ts)
  déclarent une liste, une forme SVG et une icône. La première demande
  d’ouverture d’une liste inscrit sa consultation dans l’état de la story et
  émet une occurrence de révélation. Cette occurrence applique les actions à
  la liste et à l’icône. Une demande répétée conserve l’état atteint.
  L’ouverture de la dernière liste encore fermée planifie le `sequence:end`
  public après ses transitions et la fin de la narration.
- Les cinq icônes ciblées sont des `layout` portant du SVG inline. La forme
  identifiée dans la source prend `fill="currentColor"`. La couleur vient
  d’une transition sur le layout et la rotation et l’échelle s’appliquent au
  layout entier. Les identifiants source des formes ciblées restent distincts
  des identifiants des persos. Les actions de clic se reconstruisent en Seek
  à partir des occurrences de la story, qui conservent aussi les ouvertures
  déjà réalisées à l’instant visé. À `sequence:end`, la vue persiste et les
  clics cessent d’appliquer ces actions. Le replay repart avec les listes
  fermées.

La transcription porte sur cette page et les formes d’appel qu’elle utilise.
La feuille associée adapte les classes et polices de cette page à ses persos.
Les [notes SPIE](../notes/spie-transmission-import-notes.md) relèvent les cas
à étudier pour étendre cette transcription.

## Circulation `02_circulation`, page2 — quiz visuel

### Première séquence p2_1 — import générique et effets de source

La route de comparaison utilise la page standard `02_circulation.xml/page2`,
pas le fixture SAMERA `p02`. Le fragment de séquence p2_1 est enveloppé dans
une page puis lu par `CourseSourceReader`; `PageConverter` fournit les persos
`img`, `layout` et audio `media`, leurs chemins résolus, la géométrie et les
événements de timing communs. Le résolveur de cette source utilise le canevas
`1600 × 788`, convertit `scale` des images en dimensions, et place les images
par leur centre source. Le média audio démarre en mode `master` à l’instant 0.

Les délais d’images et de panneaux sont convertis en secondes, additionnés dans
les conteneurs visuels, puis fusionnés avec leurs effets d’apparition. Les
durées déterminent le début de sortie; l’adaptateur de la scène retire la
frontière de masquage générique et applique la sortie `toLeft` ou la fermeture
locale du panneau avant de masquer le perso. Le `<tween>` d’image est résolu
par `PageConverter` à partir du timing effectif de son image; le résolveur
source fournit ses bornes de position et sa courbe. `effectPanelCircle`, ses
couleurs, et les effets `growDown`, `fromLeft` et `toLeft` restent dans
`legacy-page-sequence-converter.ts` et `legacy-image-converter.ts`.

Les images utilisent `type: 'img'`; leur élément natif a
`object-fit: contain` dans cette transcription. La route `?demo=course-motion`
monte la séquence dans le layout et le player V2 partagés.

La route `?demo=course-motion` ajoute à la première séquence animée de page2
la séquence `p2_2` et son arrêt interactif. Le fragment source retenu est
[`page2-sequence-2.xml`](../src/v2/demos/course-motion-import/page2-sequence-2.xml).
La narration `p2_2.mp3` commence à 8 626,508 ms et dure 4 469,683 ms.

### Transcription de l’épisode

- L’image `p2/2_2a.jpg` devient le perso image
  `img_02_circulation_p2_2_2a`. Elle reprend `x="center"`, `y="390"` et
  `scale="1.4"`; son rendu `img` garde `object-fit: contain`. Source
  `showAfter="Y"` oblige à la conserver pendant l’épisode de correction : le
  perso image est placé dans le stage parent de la page, hors du layout
  `course-motion-p2-2-stage` qui porte les contrôles du quiz. Le layout du quiz
  reste transparent pour laisser voir cette illustration pendant la question.
- À l’entrée de p2_2, l’événement story
  `course-motion-p2-1:background:hide` masque en `display: none` le fond
  `img_02_circulation_p2_IMG_0565`. Il est placé à 8 626,508 ms sur la track
  de p2_1, la frontière où le lecteur source retire les éléments de la
  séquence précédente. Un Seek avant cette occurrence conserve le fond;
  après elle, le fond reste masqué.
- L’image alpha `p2/2_2a_zone.png` n’est pas montée comme une couche au-dessus
  de l’illustration. Ses dimensions intrinsèques (79 × 183) et son placement
  source (`x="697"`, `y="335"`, `scale="1.4"`) fournissent le cadre de la
  zone interactive via le convertisseur d’image partagé par la démo.
- Le `<sub>` source référence `m2p2_txt1`, résolu depuis le fragment français
  [`page2-text-fr.xml`](../src/v2/demos/course-motion-import/page2-text-fr.xml).
  Son contenu HTML `<b>` est conservé dans le perso `text`
  `course-motion-p2-2-prompt`; le placement horizontal, la largeur, l’ordonnée
  et l’alignement viennent du `<sub>`, avec la taille et la couleur du
  `<default>` source. Le stage reprend la famille Raleway et l’interlignage
  `1.2` de la feuille source; ses poids 300, 400 et 700 sont servis depuis les
  polices copiées dans
  [`public/assets/course-motion-import/02_circulation/fonts`](../public/assets/course-motion-import/02_circulation/fonts).
- Le `<prop>` n’a pas d’identifiant source. Le lecteur source le numérote à la
  lecture; CodPlay lui donne l’identité technique
  `course-motion-p2-2-hotspot`. Le choix utilise le composant `input` radio.
  Le bouton de validation est le perso
  `course-motion-p2-2-validate`.
- La réponse source porte `x="590"`, `y="202"`, `width="80"`,
  `scale="1.4"` et référence `zone1`. Le SVG de `m2p2_txt2_zone` (viewBox
  `80 × 190`) fournit la forme réelle du clic via le clip inline
  [`page2-hotspot-clip.svg`](../src/v2/demos/course-motion-import/page2-hotspot-clip.svg).
  Les attributs de placement du `<prop>` restent lus et validés, mais le cadre
  CodPlay suit celui de l’image `zone1` afin que la surface interactive soit
  alignée sur la zone visuelle. Le chemin est normalisé sur le cadre de cette
  image en `objectBoundingBox`, puis converti en `cqw`.
- Le perso `input` utilise ce même clip SVG pour le hit-testing et pour son voile
  rouge semi-transparent à la sélection. Le rendu et la zone cliquable partagent
  ainsi une forme unique; aucun perso image `zone1` superposé n’est nécessaire.
  Les images de présentation, y compris la croix de correction, ont
  `pointer-events: none` afin qu’elles ne capturent pas le pointeur.
- « Valider » confirme le seul choix déclaré, désactive le contrôle et joue
  `bonne.mp3` via un perso `media` indépendant. La fin de séquence est planifiée
  après la narration et le feedback de réussite, selon celui qui se termine le
  plus tard.
- Le XML déclare aussi une action `failed` avec `mauvaise.mp3`, mais ne déclare
  aucune réponse fausse. Cette page ne produit donc pas de hotspot d’erreur ni
  de branche d’échec accessible.

Le convertisseur reste local à la démo; ces observations ne définissent pas
une règle du moteur générique. Les coordonnées `cqw` suivent la largeur du
stage CodPlay courant. La comparaison conserve les repères relatifs au stage,
mais ne normalise pas les marges et l’origine propres aux deux lecteurs.

Dans la première séquence p2_1, le XML appelle `effectPanelCircle` sur les
conteneurs `panel1_1` et `panel1_2`. Ces deux emplacements ne définissent ici
aucune règle de transition CodPlay.

La conversion est implémentée dans
[`page2-visual-quiz-converter.ts`](../src/v2/demos/course-motion-import/page2-visual-quiz-converter.ts)
et assemblée dans [`main.ts`](../src/v2/demos/course-motion-import/main.ts).
Elle réutilise le lecteur de traductions de
[`legacy-page-converter.ts`](../src/v2/demos/course-motion-import/legacy-page-converter.ts),
le `input`, le parcours `Perso.emit` et le player V2 partagés; le style de page
est déclaré dans [`style.css`](../src/v2/demos/course-motion-import/style.css).
Le core CodPlay ne porte aucune logique particulière à ce quiz.

### Suite de correction p2_3

Le fragment [`page2-sequence-3.xml`](../src/v2/demos/course-motion-import/page2-sequence-3.xml)
contient `p2_3.mp3`, le `snapFLA` `croix_rouge_snap_canvas.js` à `x=660`,
`y=320`, `scale=0.6`, `loop="N"`, `showAfter="Y"`, et l’image
`p2/2_2b.jpg`, retardée de 1,5 s, positionnée au centre à `y=390`,
`scale=1.4`, avec l’effet source `blink` et `showAfter="Y"`.
Il est transcrit en story distincte `page2-sequence-3` par
[`page2-sequence-3-converter.ts`](../src/v2/demos/course-motion-import/page2-sequence-3-converter.ts).

- Le clic sur « Valider » suit l’événement ordinaire du perso `tag` et le
  strap de validation émet `course-motion-p2-3:start`, ciblé sur cette story.
  Son listener `active: true` et `reset: true` ouvre la période de projection;
  il planifie ensuite les événements story de lecture et de correction.
- `course-motion-p2-3:play` survient après le retour `bonne.mp3`, soit
  1 513,8 ms après validation. Il démarre `p2_3.mp3` en mode `master` et anime
  la croix pendant 958,333 ms. Le perso `img` de la croix est une
  représentation SVG locale de l’animation SnapFLA source; elle n’exécute pas
  le fichier JavaScript SnapFLA.
- L’image `2_2b.jpg` apparaît 1,5 s après le début de p2_3. Son effet `blink`
  est rendu par deux cycles d’opacité finis, puis l’image reste visible.
  `sequence:end` est planifié à la durée de la narration p2_3, après la fin du
  retour `bonne.mp3`.

L’activation de la story de correction a lieu au clic de validation; son audio,
sa croix et son image restent dans leurs états initiaux jusqu’aux événements
planifiés après le retour sonore. La séquence n’ajoute ni commande de lecture
au layout, ni action de télécommande. La croix SVG et le clignotement sont des
transcriptions expérimentales des deux éléments source; ils ne prétendent pas
reproduire le runtime SnapFLA ni son effet CSS. Le layout du quiz peut être
masqué après le retour `bonne.mp3` sans masquer l’image `2_2a.jpg`. À l’arrivée,
la croix se superpose à cette image de référence; l’image corrigée `2_2b.jpg`
arrive ensuite au-dessus, clignote deux fois, puis reste visible. Pendant son
clignotement, l’image de référence demeure visible en dessous. La source marque
la croix et l’image corrigée `showAfter="Y"`; ainsi, à la fin du clignotement,
les deux restent présentes et la croix demeure au-dessus de l’image corrigée.
