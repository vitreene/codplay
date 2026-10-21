# CodPlay V2 — paquet de diffusion V1

## Périmètre vérifié

Cette spécification couvre le format de paquet scène v1 et les familles
vérifiées : scène compilée, ressources locales image/audio/vidéo, feuille de
style associée, faces `@font-face` locales, fonctions auteur et ressources
tierces dont les entrées preload et occurrences exactes sont déclarées.
Le paquet est chargé par le player CodPlay distribué séparément via
`CodPlay.load()`. Les fonctions auteur référencées sont empaquetées avec la
scène dans `scene/functions.mjs` ; elles ne font pas partie du player. Une
intégration jsdom et une vérification Brave du 2026-10-19, après déplacement
du paquet et suppression des sources, vérifient `init`, `onStart`,
`onSequenceEnd` et les callbacks de capture. Brave a chargé les paquets médias
et fonctions depuis une origine HTTP distincte, avec cache froid et sans accès
aux sources auteur.
Le paquet porte les requirements compilés et les ressources de la scène. Il ne
contient ni ne modifie les définitions de composants, services, modules,
bibliothèques ou stratégies de preload : le site les fournit par son engine
partagé avant `load()`. Une démo navigateur vérifie une scène exportée qui
combine Rive et Three.js ainsi configurés ; les deux hosts sont matérialisés
avec les classes de base du player importé une seule fois. Le build séparé de
l'engine vérifie les modes `package`, `remote` et `platform`. Le parcours Avatar
vérifie le transport de vrais GLB/FBX déclarés par le producteur ; les formats
à dépendances binaires non déclarées restent hors de la V1.

Une acceptance composite combine dans un paquet déplacé des médias de scène,
une feuille CSS avec une fonte locale, des fonctions de scène et des composants
core. Le chargeur les prépare avant Play. Brave confirme cette combinaison avec
cache froid depuis une origine distincte du player ; les sources ne sont pas
servies à l'intégration.

## Entrée et production du paquet

Le CLI accepte un module `.js`, `.mjs`, `.ts` ou `.mts`, qui exporte le
`SceneDoc` sous le nom `scene` ou comme export par défaut. Il peut aussi
exporter une feuille associée sous forme de texte CSS avec `styleSheet` et
importer des feuilles `.css` par effet de bord. L'option facultative
`--engine-config <fichier.js|fichier.ts>` fournit au compilateur le catalogue
statique que le site utilisera pour son owner ; elle sert à valider les
requirements, puis n'est ni copiée dans le paquet ni inscrite par `load()`.
L'engine et ses stratégies de preload restent configurés par le site. Le CLI
développe les imports CSS locaux de la scène et déclare leurs fichiers `url()`
dans le paquet. Les préprocesseurs CSS, les modules CSS et les dépendances CSS
distantes sont refusés.

```sh
npm run export --workspace=codplay -- \
  --scene ./src/scene.ts \
  --export ./public/exports/ma-scene
```

Le producteur `exportScenePackage()` accepte aussi une entrée-adaptateur, le
nom de son export `scene` et le fichier source qui porte les chemins relatifs
des ressources. L’export Sighty l’appelle une fois par scène directe dans un
sous-répertoire dédié. Cette adaptation conserve le format et le contenu du
paquet CodPlay V1 ; elle ne crée pas de second paquetage de scène.

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

### Build séparé de l'engine du site

Le site construit son engine avec les définitions et stratégies existantes :

```sh
npm run build:engine --workspace=codplay -- \
  --engine-config ./src/engine.ts \
  --output ./public/codplay-engine
```

Le module de configuration exporte `engineCapabilities` et, si nécessaire,
`preloadStrategies`. Les entrées existantes de `engine.libraries.register`
portent `module` et `delivery`. `package` embarque l'import dans le bundle
engine ; `remote` le réécrit vers l'URL ESM indiquée ; `platform` conserve le
specifier externe, par exemple pour une import map. Pour un même specifier dans
un engine, le mode et l'URL distante doivent être identiques.

Le build produit `engine.js` et `engine-manifest.json` à part du player et du
paquet scène. Il garde `codplay` externe afin que les définitions de composants
utilisent les mêmes classes que le player importé par le site. Il publie depuis
un dossier temporaire voisin de la destination ; si le remplacement échoue,
l'ancienne sortie est restaurée. Le build ne modifie pas les classes ou le
chargement CodPlay : `engine.prepareScene()` prépare toujours les bibliothèques
requises par le compilé.

La bibliothèque distante doit exposer les exports attendus par la définition
engine et autoriser son chargement depuis le site. Le chargement d'un module
externe reste déclenché par la définition library lors de la préparation de la
scène, pas par le simple import du player ou du bundle engine. Les trois modes
sont testés avec Three.js ; un échec de bibliothèque requise fait échouer
`load()` avant la création de l'occurrence.

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

## Ressources déclarées par une intégration

Le module source peut fournir les entrées preload qu'il possède dans
`preloadManifest` et relier chacune à son champ exact dans `scene` via
`preloadResourceOccurrences` :

```ts
export const preloadManifest = {
  entries: [{ url: '/models/avatar.glb', type: 'three-glb' }],
}

export const preloadResourceOccurrences = [{
  entryIndex: 0,
  storyId: 'main',
  persoId: 'avatar',
  path: ['initial', 'src'],
}]
```

Le builder valide l'index, le story/perso, le chemin et l'URL contre la scène
compilée. Une référence absente, périmée, non locale ou sans occurrence exacte
produit un diagnostic de compilation ; le CLI ne recherche pas ces champs en
parcourant la scène. La ressource et ses chemins d'occurrence entrent ensuite
dans `CompiledScene.resources` et le manifeste du paquet, puis sont réécrits
sur la copie de diffusion. Le schéma JSON du CompiledScene ne change pas.

À `load()`, les entrées reviennent au service preload déjà configuré sur
l'engine du site. L'intégration tierce existante reçoit ensuite les octets
préchargés via son cache et ses composants habituels. L'export n'ajoute ni
stratégie, ni composant, ni parseur de binaire.

La démo Avatar fournit les entrées `three-glb` et `three-fbx` avec leurs champs
`initial.src` exacts. Un test navigateur a chargé depuis le paquet les vrais
`avatarsdk.glb` et `hero-walk.fbx` ; le GLB utilisé contient son buffer et ses
images incorporés. L'export V1 ne découvre pas les URI secondaires cachées dans
un GLB/FBX : un `.gltf` multi-fichiers ou des textures FBX latérales ne sont pas
certifiés.

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

`scenePath` désigne la racine publiée du paquet. Il peut être un chemin local à
la page ou une URL HTTP(S) vers les fichiers du paquet hébergés à distance,
notamment dans un dépôt ou sur son serveur de publication. `load()` lit le
manifeste puis résout la scène, les fonctions, la CSS et les assets relativement
à cette racine. L'hôte distant doit servir ces fichiers et autoriser CORS pour
le site intégrateur. Le test E12 et la vérification Brave depuis une origine
distincte couvrent ce chargement. Cela ne rend pas distantes les références de
ressources inscrites dans la scène : leurs sources suivent la règle D6 et leur
ouverture aux URL distantes reste une évolution R13.

`load()` lit et valide le manifeste et `scene/scene.json`, restaure sur une
copie les URL empaquetées par leurs chemins compilés et charge la feuille CSS
optionnelle. Il réutilise ensuite l'engine et le service preload configurés sur
le propriétaire : `engine.prepareScene()` reçoit les requirements compilés,
`preload.load()` charge les ressources, `resources.register()` remet leurs
handles aux composants, puis `instances.create()` prépare l'occurrence. Il ne
recherche ni n'inscrit de définition ou de stratégie depuis le paquet et ne
lance pas la lecture. Une définition ou bibliothèque requise mais absente de
l'engine suit les diagnostics de compilation ou de préparation déjà en place.
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
Après destruction de l'owner, un nouvel owner peut charger le même paquet dans
un autre root et reçoit une occurrence indépendante ; les identifiants générés
sont locaux à chaque owner. Ce cycle est vérifié par
[`scene-package-loader.spec.ts`](../tests/facade/scene-package-loader.spec.ts).
Cette suite charge aussi une occurrence de diffusion à côté d'une instance
auteur préexistante, puis détruit l'occurrence de diffusion ; l'objet, l'état et
le DOM auteur restent inchangés.
Une URL de paquet mal formée est rejetée avant toute requête. Un JSON de scène
refusé par le codec est rejeté avant `engine.prepareScene()`, le preload et la
création d'instance. `CodPlay.destroy()` retire les occurrences et leurs slots
CSS ; une vérification Brave sur `/scene-export/` confirme que les slots d'un
autre owner restent présents. Les refus avant préparation et création sont
couverts par `scene-package-loader.spec.ts`.

## Composition livrée

Le CLI compile avec le catalogue CodPlay core, ou avec le module statique
fourni par `--engine-config` lorsque la scène utilise des intégrations tierces.
Le paquet conserve les `requirements` issus du compilateur ; il ne transporte
ni les classes de composants ni les bibliothèques runtime. Le site configure
une fois le même catalogue sur l'owner partagé avant `load()`. Les clés sont
celles du moteur : `component.type`, `service.name`, `module.id` et
`library.id`. La première définition enregistrée pour une clé reste active ;
un remplacement demande l'override explicite déjà prévu par les registres de
l'engine. Des versions incompatibles s'isolent dans des owners distincts.

La démo de diffusion fournit les définitions et stratégies Rive/Three par un
module d'intégration du site. Ce module importe les classes de base depuis le
specifier `codplay`, résolu vers la même URL ESM que le player. Cela conserve
une identité de classe unique pour les hosts HTML reconnus par le matérialiseur.
Le paquet de scène reste distinct et contient la scène, ses fonctions et ses
ressources.

La livraison tierce relève du build séparé de l'engine décrit ci-dessus ; le
paquet de scène n'inscrit aucune définition. La démo fournit ses définitions
Rive/Three à l'owner, et le paquet contient la scène, ses fonctions et ses
ressources locales.

## Preuves

- [`player-build/cli.mjs`](../tools/player-build/cli.mjs) produit le player
  ESM minifié à part du paquet scène. [`cli.spec.mjs`](../tools/scene-export/tests/cli.spec.mjs)
  vérifie que le manifeste n'a pas de champ `library` et que l'export ne publie
  pas `codplay.js`.
- La démo scene-export importe une fois le player séparé et charge une scène
  Rive + Three.js. Après le build de production et reload cache froid dans Brave
  le 2026-10-20, load() rend deux canvases dans le même root et le statut passe
  à ready. Play fait avancer la scène ; la trace réseau contient une seule
  requête vers /codplay-player/codplay.js, le bundle engine séparé, le fichier
  Rive et l'audio du paquet. Le WASM Rive est demandé à l'URL configurée par
  son package. Aucune erreur console n'est relevée. L'engine et les définitions
  Rive/Three sont fournis par le site ; le paquet contient la scène et ses
  ressources.
- [`scene-builder.spec.ts`](../tests/scene/compiled/scene-builder.spec.ts)
  vérifie les références et chemins retenus, les diagnostics de fermeture et
  les URLs dans les styles de scène sans changement du build auteur ; les
  références de fonctions couvrent les callbacks de scène, transforms,
  actions et capture. Une fixture vérifie aussi le lien exact entre une entrée
  preload personnalisée et son chemin compilé.
- [`scene-package-loader.spec.ts`](../tests/facade/scene-package-loader.spec.ts)
  vérifie la restauration des URL, le preload strict, l'attente de `decode()` et
  `canplay`, l'envoi des ressources image/font CSS au preload, les descripteurs
  et l'attente de la face CSS avant la création, le rejet/cleanup en cas d'échec,
  la fabrique de fonctions, le partage/isolation de contexte par propriétaire,
  le passage de ses fonctions et straps à l'instance, la création d'occurrences
  distinctes, la coexistence d'une instance auteur et l'absence d'instance/root
  après échec de préparation d'une bibliothèque requise.
- [`engine-builder.spec.mjs`](../tools/engine-build/tests/engine-builder.spec.mjs)
  vérifie les trois modes de livraison, leurs imports, le manifeste engine et
  le refus atomique de métadonnées invalides.
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
  `createdAt` ; il refuse de remplacer un dossier existant sans toucher ses
  fichiers. L'interruption SIGINT nettoie le staging et le build temporaire,
  puis permet une relance vers la même destination.
- [`scene-package-export-acceptance.spec.mjs`](../tests/facade/scene-package-export-acceptance.spec.mjs)
  vérifie le chargement d'un paquet CLI déplacé après suppression des sources,
  les callbacks de scène et de capture depuis `scene/functions.mjs`, l'échec
  puis le retry d'import, l'échec et le nettoyage d'un preload média, et le
  réemploi des médias initiaux/futurs au seek arrière, reset, relance et
  destruction sans nouvel appel natif `load()`. Une fixture composite détenue
  par la suite réunit image et vidéo, CSS avec image et fonte, callbacks de scène
  et composants core ; elle vérifie leur transport et leur préparation avant
  Play après déplacement et suppression des sources. Cette preuve déterministe
  complète l'essai navigateur sur les ressources réelles de la démo ci-dessous.
- L'acceptance Brave E12 du 2026-10-19 charge un paquet composite depuis une
  origine distincte du player avec cache froid. La fonte atteint `loaded`,
  l'image est décodée, la vidéo atteint `readyState = 4` dans le root, la CSS
  conserve son scope et `init`, `onStart`, `onSequenceEnd` s'exécutent. Le
  player séparé est demandé une fois ; les fichiers du paquet viennent de son
  origine, avec une réponse vidéo `206 Range` et aucune erreur console.
- Les appels répétés à `load()` et la création d'occurrences distinctes sont
  couverts par `scene-package-loader.spec.ts` et
  `scene-package-export-acceptance.spec.mjs`; la démo conservée sert maintenant
  à vérifier la composition réelle Rive + Three.js, pas le parcours de deux
  occurrences média.
- `cli.spec.mjs` vérifie aussi qu'une image locale importée par Vite `?url` est
  ramenée à son fichier source, déclarée par le compilateur et copiée dans le
  paquet par son occurrence exacte.
- La scène Avatar V2 fournit des entrées preload et leurs chemins exacts. La
  vérification navigateur avec de vrais fichiers charge le GLB et le FBX depuis
  le paquet, pas depuis `/avatars/` ; les tests compiler/CLI vérifient le
  diagnostic si une entrée personnalisée n'est pas reliée à sa scène.

## Limites

Cette spécification couvre uniquement les familles et comportements vérifiés
dans ses sections précédentes. Le paquet V1 copie les ressources locales dont
les références sont émises par le compilateur ou déclarées par leur producteur.
Les ressources d'une scène chargées depuis une origine distante restent une
évolution ultérieure (R13) ; cela ne limite pas l'hébergement distant du paquet
via `scenePath`. Les fichiers tiers opaques ne sont pas analysés pour
découvrir leurs propres sous-ressources ; le producteur doit les déclarer et
relier leurs champs au compilateur.

Deux paquets fournissant des définitions différentes sous la même clé peuvent
partager un owner, mais la première définition active est celle qui sera
utilisée par les deux scènes ; un override explicite suit le registre existant.
Un site qui doit isoler des versions incompatibles les charge dans des owners
différents. Le partage coordonné avec Sighty reste hors tranche. Les valeurs de
scène ne sont pas mutées ; le CSS, les fontes, les fonctions et les ressources
déclarées sont transportés dans la copie exportée.
