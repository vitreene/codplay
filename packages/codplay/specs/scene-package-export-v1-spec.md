# CodPlay V2 — paquet de diffusion média et CSS V1

## Périmètre vérifié

Cette spécification couvre le format de paquet scène v1 et les familles
vérifiées : scène compilée, ressources locales image/audio/vidéo, feuille de
style associée, faces `@font-face` locales et transport des fonctions auteur.
Le paquet est chargé par le player CodPlay distribué séparément via
`CodPlay.load()`. Les fonctions auteur référencées sont empaquetées avec la
scène dans `scene/functions.mjs` ; elles ne font pas partie du player. Une
intégration jsdom et une vérification Brave du 2026-10-19, après déplacement
du paquet et suppression des sources, vérifient `init`, `onStart`,
`onSequenceEnd` et les callbacks de capture. Brave a chargé les paquets médias
et fonctions depuis une origine HTTP distincte, avec cache froid et sans accès
aux sources auteur.
Le paquet est vérifié pour le catalogue des composants core ; les composants
non core et capacités tierces ne sont pas certifiés. Le suivi des étapes
restantes est dans le
[plan d'export](../plan/2026-10-15-export-diffusion-plan.md).

## Entrée et production du paquet

Le CLI accepte un module `.js`, `.mjs`, `.ts` ou `.mts`, qui exporte le
`SceneDoc` sous le nom `scene` ou comme export par défaut. Il peut aussi
exporter une feuille associée sous forme de texte CSS avec `styleSheet` et
importer des feuilles `.css` par effet de bord. Le CLI développe leurs imports
CSS locaux et déclare leurs fichiers `url()` dans le paquet. Les préprocesseurs
CSS, les modules CSS et les dépendances CSS distantes sont refusés.

```sh
npm run export --workspace=codplay -- \
  --scene ./src/scene.ts \
  --export ./public/exports/ma-scene
```

Le CLI construit dans un répertoire temporaire voisin de la destination, puis
publie par renommage. Il refuse une destination déjà présente et retire son
répertoire temporaire à l'échec. Le paquet contient :

```text
ma-scene/
  export-manifest.json
  scene/scene.json
  scene/functions.mjs             # si la scène contient des fonctions
  scene/style.css                 # si la scène exporte ou importe du CSS
  scene/assets/<source-path-sha256-20-hex>.<extension>
```

Le player est séparé du paquet scène. `npm run build:player --workspace=codplay`
produit la bibliothèque ESM minifiée depuis `packages/codplay/src/index.ts` dans
`packages/codplay/dist/codplay.js`. Le site la déploie à une URL propre au
player, l'importe une fois et peut charger plusieurs paquets scène avec le même
owner. Le CLI construit une copie temporaire du player pour compiler la scène,
puis la supprime avant de publier le paquet. Le manifeste scène ne référence
pas le player. Si la scène contient des fonctions auteur, `CodPlay.load()`
importe `scene/functions.mjs` depuis le paquet scène.

Lorsque des fonctions sont extraites, `export-manifest.json` décrit le module
`scene/functions.mjs` et chaque couple `{ ref, path }`. Le module bundlé exporte
ces mêmes références ainsi que `createScenePackageContext()`, qui renvoie
`{ functions, strapCollections }`. Le bundler ferme les imports locaux statiques
et différés et les assets importés, sans `toString`, `eval` ni compilation de
scène au chargement.

Le code de `scene/functions.mjs` est une ressource du paquet scène. Le player
séparé charge sa fabrique depuis le dossier donné à `load()` et transmet les
fonctions restaurées au runtime existant comme callbacks. Le build du player
n'incorpore pas les fonctions d'une scène donnée.

Quand il existe, `styleSheet` du manifeste recense les classNames conservés,
les dépendances image/font empaquetées et les faces `@font-face` dans leur ordre
source. Chaque face expose sa famille, sa source, son poids, son style, son
stretch, ses axes variables, sa plage Unicode et son mode d'affichage. Les
sources de faces utilisent les mêmes URL du paquet que `scene/style.css`.

Les références de scène sont résolues depuis le dossier du module `--scene`.
Un chemin URL à un seul slash initial, comme `/assets/image.jpg`, est résolu
depuis ce même dossier après retrait du slash ; les chemins `//`, les schémas
distants et les chemins système absolus ne sont pas acceptés.
Les `url()` de `styleSheet` utilisent ce même dossier ; ceux d'une feuille
importée utilisent le dossier de cette feuille. Les imports CSS utilisent le
dossier de leur feuille déclarante. Les imports imbriqués, avec query ou
fragment, sont refusés. Les octets source ne sont pas transformés.
Les occurrences d'une même source canonique
partagent un fichier empaqueté ; deux sources distinctes gardent des chemins
distincts même si leur nom ou leur contenu est identique. Le compilé auteur
n'est pas modifié : le paquetage réécrit une copie par les chemins d'occurrence
rendus par le builder, puis réconcilie `resources.entries` et
`requirements.resources` avant de valider le codec. Le CSS exporté conserve ses
classNames, sélecteurs, déclarations et ordre ; seuls les `url()` locaux sont
relocalisés dans la copie de diffusion.

## Fermeture média par compilation

`CodPlay.build(input, { export: true })` active les diagnostics stricts de cette
tranche et retourne `resourceReferences` à côté du `CompiledScene`. Chaque
référence contient l'URL, son type et le chemin exact vers chaque occurrence
dans le payload compilé. Ces métadonnées ne sont pas ajoutées au JSON du
`CompiledScene`. `build(input)` sans option export conserve le parcours auteur.

Quand le module de scène importe un fichier local avec Vite `?url`, le bundler
de l'export ramène cette URL à un chemin relatif du fichier `--scene` avant
d'appeler `build(..., { export: true })`. Le builder déclare alors l'image et
ses occurrences exactes ; le paquetage la copie par ce manifeste comme toute
autre ressource image. Le CLI ne parcourt pas le SceneDoc pour retrouver
l'import. Les URLs `data:` écrites directement dans la scène restent hors de
la fermeture.

| Composant | Sources empaquetées |
|---|---|
| `img` | `initial.src`, `initial.img.attr.src` et leurs équivalents dans les actions directes ou les étapes statiques |
| `media` | `initial.src` et les `src` des actions directes ou étapes statiques ; chaque URL est classée séparément par son extension audio ou vidéo, sans modifier `tag` |
| `tag` natif `img`, `audio`, `video` ou `source` | `attr.src` initial et dans les actions compilées |
| styles de perso | `url()` local référençant une image dans les valeurs `style` compilées |

Les extensions d'image prises en charge sont celles du builder pour PNG, JPG,
JPEG, WebP, GIF, SVG et AVIF. Le builder prend en charge MP4, WebM et OGV pour
la vidéo, AAC, FLAC, M4A, MP3, OGA, OGG et WAV pour l'audio. Une extension
inconnue, un type incompatible, une URL calculée ou une adresse avec schéma
produit le diagnostic bloquant `CODPLAY_EXPORT_MEDIA_REFERENCE_UNSUPPORTED`.
Le paquetage échoue aussi si un fichier local manque, si un chemin d'occurrence
ne correspond plus au compilé ou si le manifeste ne ferme pas les ressources.

Pour éviter un paquet incomplet, le build export bloque aussi les références
hors de cette fermeture : `src` d'une balise autre que `img`, `audio`, `video`
ou `source`; `poster` et `srcset`; `link[href]`, `object[data]`,
`iframe/frame[srcdoc]`, `image/use[href]`; les éléments `script` et `style`;
les ressources cachées dans `layout.markup`. Ces refus sont contextualisés par
scène, story, perso et chemin. Les `url()` des valeurs `style` de la scène sont
compilées à part des feuilles CSS et ne modifient que la copie de diffusion.
Un `a[href]` reste un lien de navigation et n'entre pas dans le manifeste de
ressources ou les assets du paquet, même avec `download` ou une valeur définie
par une action future. L'export suit les ressources typées émises par le
compilateur et leurs consommateurs preload existants ; il ne déduit pas un type
générique de fichier depuis un lien.

Le compilateur de feuille capture les imports CSS locaux, développe leurs
`@import` à leur position et conserve `layer()`, `supports()` et le texte des
qualificatifs media. Il bloque les cycles, `@namespace`, les chemins ou schémas
non locaux, les fichiers absents, `scope()` ou les modificateurs mal placés
dans un `@import`, les faces sans famille/source et les sources `local()` de
`@font-face`. Il refuse les modules CSS au lieu d'en remplacer les exports par
une valeur vide. Les URL de `@font-face src` gardent le type `font` dans le
manifeste, sont envoyées au preload existant et leurs faces sont déclarées dans
le manifeste dans l'ordre source. Les classNames CSS sont recensés sans être
renommés. Les valeurs `style` de la scène restent dans le `CompiledScene` et
ne sont pas converties en classes CSS par l'export V1. Le paquet conserve les
valeurs destinées au moteur ; seules les URL locales recensées par le builder
sont relocalisées dans la copie de diffusion. Le contrat CSS est suivi dans le
[plan d'export](../plan/2026-10-15-export-diffusion-plan.md#r5--css-associé-importé-et-incorporé).

## Transport des fonctions de scène

`build(input, { export: true })` expose les chemins structurés `functionReferences`
à côté du `CompiledScene`, sans les ajouter à son JSON. Le CLI vérifie chaque
chemin, associe sa référence au module auteur bundlé et bloque les chemins
absents ou divergents. Les tests vérifient les callbacks de cycle de vie,
transforms, actions et capture au niveau de l'extraction.

Le module `scene/functions.mjs` initialise son graphe bundlé quand
`createScenePackageContext()` est appelé et renvoie les fonctions vivantes avec
les collections de straps séparées `{ scene, stories }`. Les appels d'un même
propriétaire au même paquet canonique réutilisent le contexte et ses closures ;
un autre propriétaire reçoit un contexte isolé. `CodPlay.destroy()` libère les
contextes retenus par ce propriétaire. `load()` vérifie les références et les
collections, puis transmet les deux aux options de l'instance existante.

L'acceptation navigateur confirme qu'un callback `scene.onStart` restauré par
le paquet s'exécute après `instance.telco.play()`, avec son helper importé et
l'asset `?url` inline disponibles. Le test
[`scene-package-export-acceptance.spec.mjs`](../tests/facade/scene-package-export-acceptance.spec.mjs)
exporte ensuite un paquet CLI, le déplace hors du projet source, supprime les
sources et exécute `init`, `onStart`, `onSequenceEnd`, `initCaptureState`,
`trackCommand` et `endCapture` via le loader et les événements DOM jsdom. Ce
test prouve aussi que le module de fonction est importé depuis le paquet déplacé
et ne contient pas d'import vers les sources.

Une vérification navigateur supplémentaire charge un paquet temporaire dans
l'onglet existant de la démo `scene-export` : un clic DOM traverse un transform
de story, un strap externe de story, un événement transformé en portée scène et
un strap externe de scène. Les deux sorties publiques sont reçues par
`instance.events.onEvent`. Le 2026-10-19, Brave a chargé les paquets média/CSS
et fonctions depuis `http://127.0.0.1:5173`, alors que le site intégrateur était
sur `http://localhost:5173`. Le paquet fonctions avait été exporté, déplacé et
privé de ses sources ; le serveur statique de test ne servait que les deux
dossiers de paquets. Les requêtes du manifeste, de la scène, de la feuille CSS,
des images, de l'audio, de la vidéo et de `scene/functions.mjs` ont réussi sans
imports de ressources dans le site. Les images étaient décodées, audio/vidéo à
`readyState = 4`, CSS installée ; `init`, `onStart`, `initCaptureState`,
`trackCommand`, `endCapture` et `onSequenceEnd` se sont exécutés. Le player
était importé séparément. Le suivi de cette preuve est dans le
[plan R8](../plan/2026-10-15-export-diffusion-plan.md#r8--fonctions-de-scène-et-imports).

## Chargement et démarrage

La page importe séparément le player, crée un propriétaire partagé, puis charge
une occurrence dans un sélecteur CSS ou un `HTMLElement` :

```ts
import { CodPlay } from '/vendor/codplay/codplay.js'

const player = new CodPlay()
const instance = await player.load('/exports/ma-scene/', { root: '#scene' })
await instance.telco.play()
```

`load()` lit et valide le manifeste et `scene/scene.json`, restaure sur une
copie les URL empaquetées par leurs chemins compilés, charge la feuille CSS
optionnelle, puis réutilise `engine.prepareScene()`, `preload.load()` en mode strict `author`,
`resources.register()` et `instances.create()`. Il ne lance pas la lecture.
Les dépendances CSS sont ajoutées au manifeste passé au preload avant la
création de l'occurrence. `preload.css.set()` installe la feuille dans
`document.head` sous le scope de `root`; le slot de l'occurrence est retiré à sa
destruction. Avant de créer l'instance, `load()` vérifie que les faces CSS
réellement exposées correspondent aux descripteurs du manifeste, puis attend
que chacune atteigne `loaded`. Pour une face active, il attend le `FontFace`
créé par la feuille ; pour une face sous une condition inactive, il charge sa
source empaquetée dans un `FontFace` temporaire, sans l'ajouter globalement.
Une face absente ou en erreur rejette `load()`.
L'instance est rendue lorsque les images matérialisées sont chargées et
décodées et que les nœuds audio/vidéo matérialisés ont atteint
`readyState >= 3`. Une erreur de chargement rejette `load()`.

Plusieurs `load()` sur un même propriétaire retournent des occurrences
distinctes et réutilisent son engine. L'ajout de cette méthode ne change pas
`build()`, `preload.load()` manuel ni `instances.create()` du parcours auteur.

## Composition livrée

La tranche V1 utilise le catalogue CodPlay core par défaut du CLI. Le paquet
scène contient les requirements compilés, tandis que le player séparé fournit
les composants, services et modules core correspondants. Une scène qui ne
requiert que ces capacités peut être chargée avec ce player.

Une scène qui nomme un type de composant absent du catalogue échoue pendant
`CodPlay.build(..., { export: true })` avec `AUTHOR_COMPONENT_TYPE_UNKNOWN`.
Le CLI ne publie alors pas la destination. L'entrée d'export ne permet pas
d'inscrire ou remplacer des définitions de composants, services, modules ou
bibliothèques. La composition de capacités externes et les intégrations tierces
ne font pas partie du contrat vérifié de cette tranche.

## Preuves

- [`player-build/cli.mjs`](../tools/player-build/cli.mjs) produit le player
  ESM minifié à part du paquet scène. [`cli.spec.mjs`](../tools/scene-export/tests/cli.spec.mjs)
  vérifie que le manifeste n'a pas de champ `library` et que l'export ne publie
  pas `codplay.js`.
- La démo [`scene-export`](../../demos/scene-export/) importe une fois le player
  séparé et appelle deux fois `load()` sur le même paquet. Dans le navigateur,
  les deux occurrences sont prêtes avant Play puis démarrent ensemble ; la
  requête player réussit indépendamment des requêtes manifeste, scène, CSS et
  médias.
- [`scene-builder.spec.ts`](../tests/scene/compiled/scene-builder.spec.ts)
  vérifie les références et chemins retenus, les diagnostics de fermeture et
  les URLs dans les styles de scène sans changement du build auteur ; les
  références de fonctions couvrent les callbacks de scène, transforms,
  actions et capture.
- [`scene-package-loader.spec.ts`](../tests/facade/scene-package-loader.spec.ts)
  vérifie la restauration des URL, le preload strict, l'attente de `decode()` et
  `canplay`, l'envoi des ressources image/font CSS au preload, les descripteurs
  et l'attente de la face CSS avant la création, le rejet/cleanup en cas d'échec,
  la fabrique de fonctions, le partage/isolation de contexte par propriétaire,
  le passage de ses fonctions et straps à l'instance, la création d'occurrences
  distinctes et la coexistence d'une instance auteur.
- [`resource-packager.spec.mjs`](../tools/scene-export/tests/resource-packager.spec.mjs)
  vérifie la copie, le hash de nom, le dédoublonnage, la réécriture exacte et
  l'absence de mutation du compilé source, ainsi que la conservation des autres
  champs logiques du CompiledScene.
- [`stylesheet-compiler.spec.mjs`](../tools/scene-export/tests/stylesheet-compiler.spec.mjs)
  vérifie les imports transitifs, qualificatifs, dépendances `url()` et refus
  d'imports cycliques, distants ou incomplets, ainsi que l'ordre/descripteurs des
  faces et le type `font` de leurs sources.
- [`cli.spec.mjs`](../tools/scene-export/tests/cli.spec.mjs) vérifie que les
  CSS importés et leur image locale entrent dans le paquet produit ; les tests
  de fonctions vérifient les imports auteur statiques/différés, l'identité des
  références aliasées, les closures et les contextes isolés de la fabrique.
  Il vérifie aussi que le CLI refuse `AUTHOR_COMPONENT_TYPE_UNKNOWN` sans
  publier une scène qui demande un composant externe. Deux exports du même
  projet gardent le même manifeste, les mêmes chemins et les mêmes octets hors
  `createdAt` ; l'interruption SIGINT ne publie pas de destination partielle et
  permet une relance.
- [`scene-package-export-acceptance.spec.mjs`](../tests/facade/scene-package-export-acceptance.spec.mjs)
  vérifie le chargement d'un paquet CLI déplacé après suppression des sources,
  les callbacks de scène et de capture depuis `scene/functions.mjs`, l'échec
  puis le retry d'import, l'échec et le nettoyage d'un preload média, et le
  réemploi des médias initiaux/futurs au seek arrière, reset, relance et
  destruction sans nouvel appel natif `load()`.
- [`démonstration de diffusion`](../../demos/scene-export/README.md) exporte
  maintenant `createScene()` depuis
  `packages/demos/src/v2/demos/preload-media/main.ts`, avec sa feuille CSS et
  deux images, un audio et une vidéo locaux. Dans Brave, deux appels
  `CodPlay.load()` sur le même propriétaire retournent des occurrences prêtes :
  les images sont décodées et les médias sont prêts avant Play. Après lancement,
  les deux timelines atteignent leur fin, les images apparaissent et les médias
  avancent. Les fichiers sont servis depuis le paquet. Un seek A à 5 000 ms
  pendant la lecture repositionne sa vidéo à 3 s (milieu de la vidéo de 5,889 s)
  et la met en pause ; B continue à avancer. Cette preuve porte sur les sources
  initiales de cette scène ; les médias futurs, le seek arrière/replay et le
  cycle de vie restent ouverts au plan R3.
- `cli.spec.mjs` vérifie aussi qu'une image locale importée par Vite `?url` est
  ramenée à son fichier source, déclarée par le compilateur et copiée dans le
  paquet par son occurrence exacte.

## Limites

Cette spécification ne certifie pas encore l'extraction de styles statiques de
scène en classes, la visibilité hors-root de sources vidéo futures, les
téléchargements, les
composants non core ou les capacités tierces et leurs dépendances. Le test
attendu en échec reproduit la vidéo future laissée hors du root ; le plan R3
consigne ce correctif CodPlay distinct. Les valeurs de scène ne sont pas
mutées ; les références CSS, les sources de fontes et les fonctions référencées
sont transportées dans la copie exportée.
