# Conversion de la page SAMERA `p02`

## Rôle

Cette spécification décrit l’import de la page `p02` du cours SAMERA
`02_acces.xml` dans une scène CodPlay V2. Une page source produit un
`SceneDoc`; chaque `<sequency>` produit une story de ce document. La démo
`?demo=course-motion` exerce la conversion avec le player, le builder, les
composants et le cycle d’instance V2 partagés.

Le document source retenu est conservé dans
[`page-p02.xml`](../src/v2/demos/course-motion-import/page-p02.xml). Ses
propriétés XML et ses traductions françaises sont dans
[`source-properties.xml`](../src/v2/demos/course-motion-import/source-properties.xml)
et
[`source-text-fr.xml`](../src/v2/demos/course-motion-import/source-text-fr.xml).
Les ressources de cette page sont copiées dans
[`public/assets/course-access/02_acces`](../public/assets/course-access/02_acces).

## Modèle de page et de temps

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

## Éléments et ressources convertis

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

## Limites

La conversion ne couvre que les balises, propriétés et tweens rencontrés dans
`p02`; les balises non reconnues et les attributs non acceptés par leur
convertisseur sont refusés. Les quiz, fonctions, vidéos, autres langues,
l’agrégation de pages ou de chapitres, et le reflow selon le ratio d’écran ne
sont pas définis par cette conversion. Les collisions d’identifiants entre
stories et le canevas source rapporté en `cqw` sans redistribution des
éléments restent hors contrat.

## Références d’implémentation et d’acceptation

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
