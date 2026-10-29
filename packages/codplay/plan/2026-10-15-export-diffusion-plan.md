# Export d'une scène CodPlay — feuille de route d'exécution

> Périmètre : **paquet de diffusion V1 d'une scène CodPlay V2**.
> Statut : **Fini pour la V1 (2026-10-20)**. La scène, ses ressources locales,
> le CSS, les fontes, les fonctions et les références preload Avatar déclarées
> sont vérifiés. Le player, l'engine du site et le paquet scène sont séparés.
> R13 reste une évolution ultérieure : ressources de scène lues depuis une
> origine distante. Sighty et Elcé sont hors de cette tranche.

## Décision de portée — 2026-10-20

Les définitions de composants, services, modules et bibliothèques appartiennent
à l'engine partagé, configuré une fois par le site avec le contrat existant
`new CodPlay({ engine })`. Plusieurs scènes chargées par ce propriétaire
utilisent ce même catalogue. Le paquet de scène ne transporte ni n'inscrit ces
définitions. Aucune factory ni second chemin de construction n'est accepté.

R9 est vérifiée avec les définitions directes de l'intégration fournies par
l'engine du site. R10 et R12 sont implémentées et vérifiées ; le paquet de scène
n'inscrit pas de composants. Les références exactes des ressources tierces
viennent du manifeste preload et de leurs occurrences déclarées.

## 1. Livrable

- [x] Première version diffusable vérifiée : scène compilée, CSS scoped,
  fontes/médias et fonctions lorsqu'elles sont référencées. Les composants,
  services, modules et bibliothèques runtime relèvent de l'engine partagé
  fourni par le site. Le player CodPlay reste un artefact séparé.
- [x] R10 : `build:engine` produit séparément l'intégration du site. Les entrées
  library existantes déterminent le module embarqué, distant ou fourni par la
  plateforme ; le player et le paquet scène restent distincts.
- [x] Charger le module de démonstration depuis un site intégrateur avec le player CodPlay. Le site
  fournit seulement le chemin du module et son conteneur ; il ne reconstitue pas
  sa liste de ressources ni sa composition.
- [x] `player.load(scenePath, { root })` prépare le module et retourne une
  instance seulement lorsque ses éléments requis sont disponibles et prêts.
  Le site lance ensuite cette occurrence avec `instance.telco.play()`.
- [x] Le module réutilise la compilation et les circuits de player/preload
  CodPlay existants là où leurs contrats couvrent le besoin ; aucun second
  moteur, catalogue ou circuit de lecture n'est introduit.
- [x] Le `SceneDoc` auteur et le `CompiledScene` source ne sont pas mutés ; le
  paquetage réécrit une copie. Pour partager exactement le scénario Rive avec
  le paquet combiné, son constructeur de scène a été extrait de `rive/main.ts`
  dans `rive/scene.ts` sans changer ses données ni son comportement.

### Portée clarifiée par l'utilisateur — 2026-10-16

Le module d'export est une distribution autonome d'une scène, chargée par le
player CodPlay. Son critère de réussite est la fermeture de toutes les
dépendances nécessaires à une lecture fidèle, puis leur disponibilité avant le
démarrage : données compilées, styles, fontes, médias, fonctions, composants,
modules et dépendances de bibliothèques. La fermeture inclut les ressources
requises aux états initiaux et aux actions futures.

La compilation de l'éditeur constitue un précédent pour déterminer quels
éléments le player doit recevoir. Son résultat et son cycle auteur restent
distincts du module de diffusion : l'export doit produire un artefact
transportable et autonome, sans modifier le mode auteur.

Les classes et styles CSS proviennent de la scène/éditeur et servent directement
au moteur CodPlay. L'export conserve les classNames et la sémantique des règles.
Les styles de scène servent au moteur CodPlay et restent dans le `CompiledScene`.
Pour l'export V1, ils ne sont pas convertis en classes CSS : le compilateur a
déjà fourni ces valeurs au player, et une règle de classe pourrait changer leur
priorité face aux classNames temporels ou au CSS global inconnu de la page hôte.
La copie de diffusion ne relocalise que les URL locales remontées par le
compilateur. Elle ne mute ni le document auteur ni le `CompiledScene` source.
La feuille exportée porte le `styleSheet` associé et ses classNames déclarés.
Les faces `@font-face` compilées sont décrites dans le manifeste.

Le parcours externe retenu est un owner `CodPlay` qui charge un ou plusieurs
modules par `.load(scenePath, { root })`; `root` accepte un sélecteur ou un nœud.
Chaque appel retourne l'instance prête de cette occurrence, lancée par sa
`telco`. L'owner porte l'engine partagé. Le constructeur et le parcours auteur
existants restent inchangés.

### Responsabilités retenues — compilation, paquet, chargement

La compilation est propriétaire de l'identification et de la validation des
dépendances de la scène. Toute référence qu'elle ne peut pas reconnaître,
résoudre ou inclure doit remonter comme diagnostic contextualisé et bloquer la
production d'un paquet incomplet. Le paquetage copie les sorties de compilation
et les fichiers qu'elles déclarent ; il ne découvre ni ne répare des références
de scène. Cette règle vaut pour les médias de la première verticale et pour le
CSS et ses dépendances dans la tranche suivante.

`player.load(scenePath, { root })` lit le paquet produit, prépare ses dépendances
avec les circuits CodPlay existants et restitue la scène dans `root`. Il ne
recompile pas la scène, ne complète pas son manifeste et ne démarre pas la
lecture. Il retourne l'instance quand la préparation requise est terminée ; le
site déclenche ensuite `instance.telco.play()`.

Hors tranche : scénario/fonctions Sighty, document Elcé, menu d'éditeur, ZIP,
publication et persistance d'une session de lecture. L'utilisateur indique que
le compilateur Sighty suivra ensuite le même principe ; ne pas modifier son
implémentation pendant cette tranche.

L’extension à l’export de scénario Sighty demandée le 2026-10-20 est suivie
dans le [plan de diffusion Sighty](../../sighty/plan/2026-10-20-sighty-export-diffusion-plan.md),
au statut `V1 implémentée` ; les scènes lazy restent reportées. La V1 décrite
ici reste limitée à CodPlay.

### Ordre de réalisation demandé — 2026-10-16

La première verticale porte sur les médias de scène ; la tranche CSS suit. La
fermeture média couvre les sources statiques de `img` et `media` dans
l'état initial et les actions futures, puis les sources des balises natives
`tag` selon leur nom et leurs attributs réels. La source des références reste
`CompiledScene.resources`, produit par le circuit de compilation existant ;
l'exporteur ne parcourt pas la scène une seconde fois. `preload.load()` reçoit
ce manifeste et charge ses entrées ; il ne découvre pas les références de la
scène. Toute forme absente ou non résolue est un diagnostic de compilation ;
elle bloque le paquet et se traite dans le circuit propriétaire de compilation,
dont le [plan CompiledScene](./compiled-scene-plan.md) suit déjà le cas
`initial.attr.src`. La tranche CSS suit la même responsabilité de diagnostic.

Cette verticale copie les octets dans le dossier exporté et relocalise une
copie du compilé et de son manifeste ; la scène auteur et le résultat de build
d'origine restent intacts. `resources.entries` et `requirements.resources`
restent cohérents. Le player réutilise le preload et le handoff du consommateur ;
`load()` attend les médias requis et ne démarre pas la lecture.

La tranche média avait bloqué les feuilles CSS tant que R5 n'était pas
implémentée. R5 capture maintenant `styleSheet` et les imports `.css`, ferme
leurs imports et URL locales, puis remet la feuille, ses dépendances et les
descripteurs de fontes au chargeur. R6 attend les faces CSS locales avant de
créer l'instance. R5 conserve les styles de scène dans les données compilées ;
R8 ferme les fonctions auteur ; R9 confirme que composants, services, modules
et bibliothèques sont fournis par l'engine partagé, jamais par le paquet.
L'intégration Rive/Three de la démo est fournie par le site. Le build séparé
`build:engine` applique les trois modes D10. R12 relie au compilateur les
ressources Three/Avatar du manifeste preload sans modifier les composants.

## 2. Contrats et propriétaires

| Sujet | Contrat actuel | Circuit à prolonger |
|---|---|---|
| Compilation | [Scène auteur](../specs/scene-authoring-spec.md) | `src/scene/compiled/scene-builder.ts`, `src/scene/config/scene-build.ts` |
| Sérialisation | [Codec](../specs/compiled-codec-v2-spec.md) | `src/scene/compiled/codec.ts`, `types.ts`, `semantic-validator.ts` |
| Fonctions | [Scène](../specs/scene-authoring-spec.md), [straps](../specs/strap-execution-v2-spec.md), [cycle player](../specs/engine-player-v2-spec.md) | `src/scene/compiled/function-extractor.ts`, `capture-compiler.ts` |
| Composition | [Façade](../specs/facade-v2-spec.md), [composants](../specs/component-materialization-v2-spec.md) | `src/facade/facade-types.ts`, catalogue et registres existants |
| Ressources | [Preload](../specs/preload-v2-spec.md) | Découverte du builder ; `src/runtime/preload/` pour les comportements de chargement concernés |
| Bibliothèques | [Préparation tierce](../specs/third-party-library-spec.md) | Requirements, `engine.prepareScene`, intégration propriétaire |
| Rive | [Rive](../specs/third-party-rive-spec.md) | `packages/authoring/component-v2/src/rive/` |
| Three.js | [Three.js](../specs/third-party-threejs-spec.md) | `packages/authoring/component-v2/src/threejs/core/` |
| Avatar | [Avatar](../specs/third-party-avatar-spec.md) | `packages/authoring/component-v2/src/avatar/` |
| Décisions runtime ouvertes | [CompiledScene](./compiled-scene-plan.md), [média](./media-preload-plan.md) | Les référencer ici ; ne pas les remplacer par un contournement d'export |
| Build disponible | [Audit de build](../../../docs/projet/notes/build-size-audit/2026-10-07-poids-build-codplay-sighty.md) | Configuration du [script Vite](../../../docs/projet/notes/build-size-audit/measure-builds.mjs) |

Les chemins `src/…` sont relatifs à `packages/codplay`.
Avant reprise : lire le [guide V2](./notes/2026-08-26-decouverte-etat-codplay-v2.md).

### Constats relus — éditeur, compilation et disponibilité

- [`buildSceneDocV2`](../../editor/src/builder-v2/build-scene.ts) produit
  séparément `sceneDoc` et `styleSheet`; son `preloadManifest` est vide. Il
  emploie les noms de classes des artefacts de capsule, et produit aussi des
  valeurs `style`/`className` et des actions temporelles.
- [`createScenePlayerBridge`](../../editor/src/app/bridges/scene-player-bridge.ts)
  donne le précédent de préparation : `CodPlay.build()`, preload strict de
  `compiledScene.resources`, enregistrement des ressources, installation
  séparée du `styleSheet`, création de l'occurrence. Ce parcours sert à
  comparer ce dont le player a besoin ; il ne génère pas le module autonome.
- Le parcours auteur existant de `deriveResources()` relève `src` dans les
  valeurs initiales et actions directes. `RuntimePreload.load()` reçoit ensuite
  le manifeste compilé, le fusionne/déduplique et choisit une stratégie par
  entrée ; il ne parcourt ni `SceneDoc` ni `CompiledScene`.
- Pour l'export, le builder possède un passage média strict, activé seulement
  par `build(input, { export: true })`. Il émet les `CompiledResource` et les
  chemins exacts des occurrences dans `resourceReferences`, hors JSON
  `CompiledScene`. Le paquetage consomme ces références compilées ; il ne
  reparcourt pas la scène. Le build auteur sans option garde son parcours.
- Ce passage reconnaît pour cette tranche les références `img`, `media` et
  `tag` natif, leurs sources statiques futures et les extensions acceptées ;
  les formes non fermées sont des diagnostics bloquants contextualisés.
  `CompiledResource` et le codec n'ont pas reçu de nouveau champ.
- `img` déclare `src` dans son profil, tandis que `media` déclare `src` et
  `tag: 'audio' | 'video'`; leurs actions peuvent changer les sources. Le
  builder actuel classe toute propriété `src` reconnue uniquement par extension,
  même si le type du perso ne correspond pas à son consommateur.
- `ImageComponent` crée ses nœuds `<img>` et affecte chaque source lui-même ;
  le preload image attend le chargement et `decode()` mais ne remet pas ce nœud
  au composant. La disponibilité du média préchargé et celle de l'image de
  l'occurrence doivent donc être prouvées ensemble avant le retour de `load()`.
- `TagComponent` rend le nom de balise initial et applique `attr`; son service
  `content` utilise `textContent`, pas un fragment HTML. Les références média
  des tags viennent donc des attributs par balise et des persos enfants, sans
  parseur de chaîne HTML.
- Le manifeste de scène et les requirements sont des données distinctes de la
  composition des bibliothèques : `engine.prepareScene()` prépare les
  `requirements.libraries`; les ressources de scène passent par
  `preload.load()` puis `resources.register()`. Le codec refuse un manifeste
  incohérent avec `requirements.resources`.
- Le preload a des stratégies natives image, audio, vidéo, fonte et CSS, et
  accepte des stratégies d'intégration. Les comportements certifiés restent
  limités par la [spec preload](../specs/preload-v2-spec.md). Le mode `author`
  échoue si une ressource n'est pas disponible ; le mode `broadcast` peut
  réussir avec avertissement et ne suffit donc pas à la garantie de complétude.
- La stratégie `font` construit actuellement la famille `FontFace` depuis le
  nom de fichier. Elle ne prouve pas à elle seule le chargement de la face
  portant le nom déclaré par le CSS de la scène. `preload.css.set()` installe
  synchroniquement le texte et ne fournit pas de signal d'attente des fontes.
  Le chemin `CodPlay.load()` vérifie maintenant séparément les faces CSS
  déclarées ; le preload général reste inchangé.
- [`HtmlPlayerRunner.run()`](../src/runtime/runner-html/player-runner/runtime-runner.ts)
  enchaîne `engine.prepareScene()`, `preload.load()`, l'enregistrement des
  ressources, `init()` puis le démarrage automatique. Le nouveau `load()` doit
  conserver les mêmes frontières de préparation et de propriété tout en
  retournant une instance prête avant Play ; il ne faut pas réutiliser un chemin
  qui démarre déjà la lecture ni créer un runner parallèle.
- Rive et Three déclarent leurs types et stratégies dans leur propre
  intégration ; le builder core ne peut pas inventer leurs types depuis une
  extension. Les fonctions auteur, elles, sont extraites en références dans le
  compilé et restent dans une collection de fonctions vivantes hors de son JSON.
  Le module exporté doit fermer ces deux frontières sans ajouter un second
  registre ou une seconde implémentation de preload.

Le parcours vérifié est le suivant : le builder produit les références et
occurrences exactes, le CLI ferme les fichiers locaux déclarés, puis `load()`
prépare et restitue l'instance avant lecture. R2–R8 couvrent les ressources
locales, le CSS, les fontes et les fonctions déclarées ; R9–R12 couvrent
l'engine partagé, ses bibliothèques et les ressources preload tierces. R13 est
la seule évolution différée de cette feuille de route.

## 3. P0 — décisions à fixer avant le code dépendant

Les signatures D1 et D5 sont retenues et vérifiées pour le paquet V1.
La fermeture CSS R5 a ses décisions de transport, de scope et de conservation
des styles de scène appliquées. R6 ferme les faces CSS locales. R8 ferme les
fonctions couvertes ; R9–R12 sont vérifiées avec l'engine du site et les
ressources déclarées par leurs producteurs. Aucune décision P0 ne bloque la V1.

| ID | Décision | Proposition à examiner | Débloque |
|---|---|---|---|
| D1 | Entrée et commande | **Retenu :** CLI Node `--scene <fichier.js|ts>` et destination `--export <dossier>`. Le module fournit le `SceneDoc` et le CSS associé par `styleSheet`. Les chemins médias/`styleSheet` partent du dossier de `--scene`; les URL d'une feuille importée partent de cette feuille. Le paquet contient `export-manifest.json`, `scene/scene.json`, les fichiers optionnels `scene/style.css`, `scene/functions.mjs` et les assets hashés. Les définitions runtime sont fournies par l'engine du site, configuré pour les scènes de son owner. Le player CodPlay est distribué séparément. Aucun IO disque dans `CodPlay.build`. | E1/E2/R5/R8/R9 |
| D2 | Fermeture et anomalies de ressources | **Retenu :** la compilation identifie et valide les références de scène/CSS, produit leurs métadonnées et remonte les formes inconnues/non résolues comme diagnostics contextualisés. Le paquetage consomme ces sorties, copie les fichiers déclarés et refuse toute compilation en erreur ; aucun scanner de scène ni correctif parallèle dans l'exporteur. Les médias et dépendances CSS suivent cette règle. | E3–E7 |
| D3 | Occurrences et disponibilité | **Vérifié :** `CodPlay.build(input, { export: true })` expose les ressources et chemins d'occurrences hors du JSON `CompiledScene`, y compris les entrées preload tierces dont le producteur déclare les chemins exacts. Le build auteur sans cette option conserve son parcours. Le paquetage ne réécrit que ces chemins sur une copie et le chargeur les applique avant codec, préparation et preload. Le schéma CompiledScene reste inchangé. | E3/E4/R12 |
| D4 | Fonctions | **Retenu le 2026-10-16 :** métadonnées de chemins exacts hors `CompiledScene`; module ESM exportant une fabrique de contexte `{ functions, strapCollections }`; un contexte partagé par propriétaire CodPlay et paquet, isolé des autres propriétaires et conservé jusqu'à `CodPlay.destroy()`. | E11/E12 avec fonctions |
| D5 | Intégration du module | **Retenu :** `const player = new CodPlay()`, `const instance = await player.load(scenePath, { root })`, puis `await instance.telco.play()`. `root` accepte un sélecteur CSS ou un nœud DOM. `scenePath` accepte un chemin relatif à la page ou une URL HTTP(S) vers le dossier du paquet ; `load()` résout le manifeste, la scène et ses modules/fichiers depuis cette base, restitue la scène dans `root`, retourne l'occurrence après préparation et ne démarre pas la lecture. Un hébergement distant doit servir les fichiers du paquet et autoriser CORS pour le site intégrateur. Le parcours auteur courant reste inchangé. | E2/E12 |
| D6 | Adresses des sources de scène | **Vérifié pour la V1 :** les références locales relatives ou web-root à un seul slash sont résolues depuis le dossier de `--scene` et copiées. Les références non locales ne sont pas embarquées dans cette tranche. Cela ne restreint pas l'URL distante de `scenePath` ; l'ouverture aux URL distantes de ressources de scène est l'évolution R13. Le mode `remote` D10 concerne uniquement les bibliothèques runtime. | E4 |
| D7 | Capacités | **Retenu :** les identités `component.type`, `service.name`, `module.id` et `library.id` relèvent du catalogue d'un owner CodPlay. Plusieurs scènes chargées par le même owner utilisent ces définitions partagées. La première définition enregistrée pour une clé reste active ; un override intentionnel se configure via les registres publics ou dans `new CodPlay({ engine: { <family>: { override: [...] } } })` avant le premier `build()`/`load()`. Les conflits d'identité entre owners distincts sont isolés par deux owners CodPlay. Le paquet scène n'ajoute ni ne remplace de définition. | E8 |
| D8 | Sortie | **Première tranche :** écrire dans un dossier de staging voisin, publier par renommage après validation, et refuser si la destination existe. Aucun écrasement ni sortie finale partielle. | E1/E13 |
| D9 | Séparation player/scène | **Retenu le 2026-10-19 :** le paquet scène ne contient pas `codplay.js` et ne choisit pas le player. Le build player autonome est une sortie séparée (`packages/codplay/dist/codplay.js`) produite par `npm run build:player --workspace=codplay`; un site importe une seule copie et charge un ou plusieurs chemins de scène avec `player.load()`. Le CLI peut utiliser un build temporaire pour compiler, mais le retire avant publication. | E1/E2 |
| D10 | Livraison des bibliothèques tierces | **Retenu et implémenté le 2026-10-20 :** chaque entrée existante de `engine.libraries.register` porte `module` et `delivery`: `{ mode: 'package' }`, `{ mode: 'remote', url }` ou `{ mode: 'platform' }`. `build:engine` construit séparément l'engine ESM du site en appliquant ces métadonnées ; les modules restent hors du paquet scène et du player. Le runtime CodPlay continue de préparer les mêmes définitions par `engine.prepareScene()`. | R10/R11 |

- [x] L'utilisateur a autorisé l'implémentation du plan CodPlay, du contrat
  `CodPlay.load()` et du premier export média, puis a explicitement demandé la
  poursuite et la documentation de la tranche CSS.
- [x] Les contrats D1–D10 sont appliqués pour la V1 : ressources locales
  compilées, CSS/fontes, fonctions, engine partagé et modes de livraison tierce.
- [x] D4 retenue ; références de fonctions structurées, module ESM de contexte,
  cache owner/paquet et passage à `instances.create()` implémentés et couverts
  par tests. Les preuves navigateur couvrent `onStart`, un transform et des
  straps externes de story/scène reçus via le journal, ainsi que Seek/replay du
  paquet cible. Le paquet déplacé vérifie aussi dans Brave `init`, `onStart`,
  `onSequenceEnd` et les callbacks de capture, après suppression des sources.
- [x] D7 confirme que l'engine partagé porte les identités `component.type`,
  `service.name`, `module.id` et `library.id`; le paquet scène ne fait pas
  d'inscription. La démo Rive/Three vérifie les hosts sur le même player.
- [x] D10 applique les trois modes de livraison aux entrées library existantes
  via le build séparé de l'engine ; aucune inscription n'est faite par paquet.

**D7 — catalogue partagé de l'engine :** les clés sont `component.type`,
`service.name`, `module.id` et `library.id`. Le site configure ces définitions
dans `new CodPlay({ engine })` ou via les registres publics avant son premier
`build()`/`load()`. Toutes les scènes d'un owner utilisent ce catalogue ; le
paquet scène ne l'étend pas. R9 vérifie ce chemin avec les hosts Rive et Three.
Les métadonnées de livraison sont consommées uniquement par `build:engine` ;
les mêmes définitions continuent d'être préparées par `engine.prepareScene()`.

**Décision D4 retenue — 2026-10-16 :** le builder retourne, à côté du
`CompiledScene`, une entrée par référence extraite contenant son `ref` et son
chemin structuré exact depuis l'export `scene` (`string | number` par segment).
Le CLI utilise ces chemins pour produire un module ESM qui exporte une fabrique
de contexte. À chaque appel, cette fabrique initialise le module de scène et ses
dépendances bundlées, puis relie chaque `ref` à la fonction présente au chemin
exact. Elle retourne ensemble `{ functions, strapCollections }`. Le chargeur
vérifie que chaque référence attendue résout vers une fonction ; il ne recompile
ni ne parcourt la scène. Le code source n'est pas reconstruit avec `toString`,
`eval` ou `new Function`. Un chemin absent, une valeur qui n'est plus une
fonction ou une dépendance que le bundler ne peut pas fermer bloque l'export.

**Portée des closures retenue :** `CodPlay.load()` crée et mémorise un seul
contexte par propriétaire CodPlay et chemin canonique du paquet. Les appels
`load()` suivants du même propriétaire et du même paquet réutilisent donc les
mêmes `functions`, `strapCollections` et état mutable capturé ; un autre
propriétaire CodPlay reçoit un contexte neuf et isolé. Cela suit la frontière
existante du mode auteur : un `build()` fournit une collection de fonctions et
le propriétaire peut la fournir à plusieurs `instances.create()`. Le paquet
équivaut à cette collection compilée ; `load()` en assure la réutilisation
interne sans ajouter d'option publique. Le contexte reste attaché au propriétaire
jusqu'à `CodPlay.destroy()` ; détruire une occurrence ne libère pas un contexte
qui peut encore être partagé par d'autres occurrences.

Pour respecter cette isolation malgré le cache de modules ESM par URL, le
module exporté doit différer l'initialisation du code auteur à l'appel de la
fabrique. Le code de la scène et ses dépendances locales fermées sont exécutés
dans le contexte créé, pas à l'import du module du paquet. La fabrique est
appelée une fois par couple propriétaire/paquet ; les instances suivantes
reçoivent les deux collections issues de ce même appel. Les dépendances qui
doivent être fournies par le catalogue CodPlay ou par un adaptateur tiers
restent soumises à D7 ; elles ne sont pas dupliquées dans le paquet.

Pour les déclarations de straps externes par nom, l'entrée exporte
`strapCollections` dans la forme existante `{ scene, stories }`. La fabrique
retourne ces straps avec les fonctions afin de préserver leurs identités et
closures communes. Le paquet les transmet à l'instance sans fusionner les
portées ; une déclaration nommée sans fonction disponible bloque l'export via
le validateur de straps existant.

Cette décision fixe la portée des closures. Les imports différés bundlables sont
vérifiés par la suite CLI. L'exécution navigateur des straps externes et les
effets de bord au moment d'instancier le contexte restent suivis par R8 ; les
dépendances externes restent soumises à D7.

Pour chaque décision acceptée, inscrire ici : date, portée, signatures retenues,
exemple d'entrée/sortie, fichiers core autorisés et première preuve exigée.
Ne pas remplacer ces informations par « faire au plus simple ».

## 4. Format du paquet V1 en cours

```text
<destination>/
  export-manifest.json
  scene/scene.json
  scene/functions.mjs                    # si fonctions auteur
  scene/style.css                         # optionnel
  scene/assets/<sha256 du chemin source canonique>.<ext>
```

- [x] Format et CLI implémentés pour les médias et CSS R5 ; la disponibilité
  effective des faces CSS locales est vérifiée par R6.
- [x] Le player est produit séparément par `npm run build:player --workspace=codplay`
  dans `packages/codplay/dist/codplay.js` ; le build a été vérifié le
  2026-10-20 et `--export` ne publie aucun player.
- [x] Outillage `tools/scene-export/` et tests ciblés créés.
- [x] Fixtures des suites ciblées possédées par les tests et indépendantes des
  scènes/valeurs de la démo.
- [x] Régressions du builder et du loader dans les suites propriétaires de
  `packages/codplay/tests/`.
- [x] Réutiliser la configuration Vite utile ; l'export ne lance pas les
  six mesures/ZIP de l'audit et n'ajoute pas un second circuit de build.
- [x] La tranche CSS déclare son parseur PostCSS comme dépendance directe du
  paquet CodPlay.
- [x] R8 réutilise le bundler Vite déjà déclaré par CodPlay ; aucune dépendance
  de build supplémentaire n'est nécessaire pour le module de fonctions.
- [x] R10 réutilise Vite déjà disponible dans le workspace ; aucune dépendance
  ou registre runtime parallèle n'a été ajouté.

### Suites d'acceptation de la V1

Les tests déterministes possèdent leurs fixtures. Les preuves navigateur
utilisent en complément les vrais assets des démos Rive, Three et Avatar.

| Emplacement | Suite ou ajout | Couverture |
|---|---|---|
| `packages/codplay/tests/scene/compiled/` | `scene-builder.spec.ts` | Ressources et occurrences média, séquences statiques, refus contextualisés, build auteur inchangé |
| `packages/codplay/tests/facade/` | `scene-package-loader.spec.ts` | URL restaurées, refus d'un chemin invalide et d'un compilé codec invalide avant création, preload strict média/CSS, attente image/audio, scopes distincts, nettoyage, coexistence auteur |
| `packages/codplay/tools/scene-export/tests/` | `resource-packager.spec.mjs` | Sources canoniques distinctes, copie, chemins hashés, cohérence références/manifeste/requirements, source intacte |
| Idem | `stylesheet-compiler.spec.mjs` | Imports CSS, qualificatifs, dépendances URL, cycles et refus de références incomplètes |
| Idem | `cli.spec.mjs` | CSS, `styleSheet`, asset transitif ; module de fonctions, closures, imports et straps |
| Idem | Compléments de `cli.spec.mjs` | Fermeture exacte des fichiers, cohérence manifeste/CompiledScene/requirements, hash de chemin source, stabilité des fichiers/octets hors `createdAt`, absence de publication après échec/interruption, relance après SIGINT |
| `packages/codplay/tools/engine-build/tests/` | `engine-builder.spec.mjs` | Modes `package`/`remote`/`platform`, import différé, manifeste et refus atomique d'une métadonnée invalide |
| `packages/codplay/tests/facade/` | `scene-package-export-acceptance.spec.mjs` | Déplacement vers un projet indépendant après suppression des sources, callbacks de scène/capture dans `scene/functions.mjs`, import/preload en échec et retry, médias futurs, seek/reset/relance/destruction, absence de nouveaux appels preload, anomalie hors-root attendue en échec |
| `packages/codplay/tests/facade/` | `scene-package-loader.spec.ts` | R6 ; famille, descripteurs, attente et rejet des faces déclarées |
| `packages/codplay/tests/scene/compiled/` | `scene-builder.spec.ts` | Manifeste preload personnalisé, occurrence exacte, diagnostic si la référence ne peut être fermée |
| `packages/codplay/tests/facade/` | `scene-package-loader.spec.ts` | Bibliothèque préparée une fois par owner, owners distincts isolés, aucun instance/root après échec de chargement |

Les fixtures de fichiers proviennent des tests : images, fontes avec droit de
redistribution, courts médias, documents et modèles possédés par la fixture.
Ne pas télécharger des assets de démo pour remplir les assertions. La fixture
navigateur composite appartient au nouvel outil et importe ses sorties construites.

## 5. Procédure commune à chaque référence de fichier

Exécuter dans cet ordre pour chaque famille du §6.

1. **Associer** : partir d'une entrée et de ses occurrences émises par le
   circuit de compilation. Le plan d'export ne rescane pas la scène. Si une
   occurrence manque, rouvrir D2 et corriger son producteur propriétaire avant
   de poursuivre.
2. **Classifier** : entrée typée du manifeste preload, dépendance CSS, module
   exécutable, binaire d'intégration ou lien de navigation. Un téléchargement
   isolé n'entre dans le paquet que si un consommateur existant le déclare par
   le circuit de ressources typées ; copier ne signifie pas ajouter une entrée
   preload.
3. **Résoudre** : calculer les chemins locaux depuis le fichier qui déclare la
   scène ou la feuille CSS, selon D6. Refuser toute source non locale.
4. **Lire** : lire les octets du fichier local déclaré ; un fichier absent ou
   illisible bloque la compilation du paquet.
5. **Identifier** : dédupliquer par chemin source canonique. Deux fichiers de
   même nom dans des dossiers différents restent distincts.
6. **Fermer** : suivre les déclarations du compilateur et les imports/URL CSS
   locaux traités par R5. Pour une ressource tierce opaque, le producteur doit
   fournir chaque fichier et occurrence attendus ; le collecteur ne parse pas
   les binaires pour en deviner d'autres.
7. **Nommer** : produire un chemin stable sans collision sous `scene/assets/`
   à partir du chemin source canonique.
8. **Réécrire** : modifier uniquement les chemins d'occurrence fournis par le
   compilateur, dans une copie du CompiledScene. La scène auteur et le résultat
   de build restent intacts. Pour le CSS, seuls les `url()` locaux sont
   réécrits ; classNames, sélecteurs, déclarations et ordre sont conservés.
9. **Fixer la base de lecture** : URL effective du paquet, jamais la page hôte.
   Le CSS injecté en mémoire ne bénéficie pas de l'URL de sa feuille source.
10. **Vérifier** : même URL effective dans payload, manifeste preload,
    `requirements.resources`, cache et composant. Codec valide après réécriture ;
    IDs, relations, placements et index temporels inchangés.
11. **Écrire et tracer** : octets finaux, source, consommateurs, destination,
    MIME, taille, SHA-256 final. Rapport de construction uniquement, aucun
    catalogue/registre runtime supplémentaire.
12. **Refuser l'incomplet** : fichier absent, référence non relocalisable,
    dépendance non traitée ou capacité manquante = erreur avec propriétaire
    et cause ; aucun dossier final annoncé réussi.

## 6. Matrice par ressource

### R1 — artefact compilé

- [x] Compiler par le catalogue configuré ; ne pas reconstruire le compilé à la lecture.
- [x] Conserver schéma, date de build, racines, requirements et index.
- [x] Relocaliser une copie en maintenant payload/manifeste/requirements cohérents.
- [x] Encoder à la production puis décoder/valider au chargement du paquet.
- [x] Tester la scène source et le compilé d'origine inchangés ; incohérence
  ressources/requirements refusée.
- [x] Comparer tout l'état logique avant/après transport pour une fixture
  générale ; `tools/scene-export/tests/resource-packager.spec.mjs` neutralise
  uniquement les chemins de ressources attendus et compare le reste du compilé.

**Propriétaires :** builder/codec. **Étapes :** E2/E3/E12.

### R2 — images raster et SVG

- [x] Utiliser les références compilées `img.initial.src`, `img.img.attr.src`
  et leurs valeurs d'action directes ou séquencées. L'exporteur ne les
  redécouvre pas.
- [x] Copier les octets sans conversion ; relocaliser seulement la copie
  compilée et maintenir `resources.entries` et `requirements.resources`
  cohérents. Ne pas muter la scène auteur ni le résultat de build d'origine.
- [x] Prouver que `load()` attend l'image matérialisée et son `decode()` avant
  de retourner l'instance.
- [x] Tester image initiale et future, deux dossiers avec le même basename,
  référence source partagée et fichier absent.
- [x] Navigateur cache froid : images décodées avant le retour, dimensions
  présentes et sources lues sous le chemin du paquet.
- [x] Après `load()` prêt, désactiver le réseau puis lancer la scène et ses
  actions image ; l'image empaquetée reste disponible.
- [x] Pour une scène V2 qui importe une image locale avec Vite `?url`, résoudre
  cet import vers le fichier source avant compilation, puis laisser les
  références du builder et le paquetage existant copier l'image. `cli.spec.mjs`
  vérifie l'occurrence compilée et les octets.
- [x] Tester le parcours média A → B → A, le seek arrière, `reset()`, relance,
  destruction et l'absence de nouveaux appels `HTMLMediaElement.load()` dans
  `tests/facade/scene-package-export-acceptance.spec.mjs`.
- [x] Vérifier dans un test propriétaire que l'export CLI est déplacé dans un
  projet externe après suppression des sources, puis chargé via le chemin du
  paquet. Dans Brave, un paquet média/CSS déplacé a aussi été chargé depuis
  une origine HTTP distincte à cache froid ; images, audio et vidéo venaient
  des chemins internes au paquet.

**Arrêt :** remonter à la compilation un diagnostic pour toute référence média
absente du manifeste ou occurrence impossible à relocaliser sans altérer une
autre donnée ; ne pas produire le paquet incomplet.

### R3 — audio et vidéo

- [x] Aligner la classification export du composant `media` sur le circuit
  existant : inférer le type de chaque URL par extension, comme
  `deriveResources()` ; conserver le champ `tag` de la scène.
- [x] Résoudre les URL locales `/assets/...` de cette démo depuis le dossier
  source temporaire `--scene`, sans changer leurs chemins dans le `SceneDoc`.
- [x] Vérifier que `resourceReferences` comprend `media.initial.src` et les
  valeurs `src` des actions directes ou séquencées. Le builder classe aussi les
  sources futures aux extensions audio/vidéo acceptées.
- [x] Copier les octets statiques et réécrire sur une copie toutes les
  occurrences compilées correspondantes, le manifeste et
  `requirements.resources`. Préserver `sync`, contrôles, broadcasts, valeurs
  d'action et ordre temporel ; valider le round-trip du codec après relocalisation.
- [x] Réutiliser `preload.load()` en mode strict et `resources.register()` ;
  le handoff du composant `media` adopte le même nœud préchargé. Aucun second
  preload n'est ajouté.
- [x] La readiness de la balise média matérialisée est testée jusqu'à
  `canplay`; l'image est testée jusqu'à `decode()`. Le browser demo couvre les
  médias `media` et le tag image ; les URL audio/vidéo tardives sont incluses.
- [x] Démo HTTP statique/cache froid : sources initiales et futures d'image,
  audio et vidéo ; réponses média `206 Range` observées.
- [x] Distinguer les requêtes Range normales ; le parcours ne requiert pas une
  requête vidéo unique.
- [x] Après `load()` prêt, désactiver le réseau puis lancer la scène et les
  changements audio/vidéo futurs ; les nœuds prêts lisent les URL du paquet.
- [x] Test propriétaire `it.fails` reproduit qu'un nœud vidéo futur préchargé
  reste hors du `root`; le comportement runtime attendu n'est pas satisfait.
- Anomalie CodPlay distincte, reproduite avec deux occurrences : après preload,
  un nœud vidéo futur peut rester visible hors du `root`. Elle concerne la
  présentation runtime après mise à disposition des octets ; son correctif
  appartient à un chantier CodPlay séparé et ne bloque pas la fermeture ni la
  publication du paquet V1.
- [x] Vérifier le handoff avec deux occurrences, Seek au milieu de la vidéo,
  actions futures hors réseau, replay/reset et destruction. Brave repositionne
  A à 3 s sur un seek à 5 000 ms tandis que B continue ; le test
  `scene-package-export-acceptance.spec.mjs` passe 5 tests avec une attente
  d'échec connue pour le nœud vidéo futur hors root. Ce défaut reste isolé dans
  le point précédent et n'est pas corrigé par l'export.

**Vérification occurrence — 2026-10-19.** La démo de vérification exportait la
scène `preload-media` deux fois avec `CodPlay.load()`. Les tests d'acceptation
couvrent aussi les références futures, le Seek arrière, Reset, replay et
destruction ; la démo finale a depuis été remplacée par le scénario simultané
Rive/Three. L'anomalie de visibilité du nœud vidéo reste hors scope comme décrit
ci-dessus.

**Seek vidéo en cours — 2026-10-19.** Dans cette même page, après le lancement
des deux occurrences, le seek A à 5 000 ms a été déclenché quand sa vidéo était
en lecture (`currentTime ≈ 0,599 s`, `paused = false`). La vidéo A a été
repositionnée à `3 s` puis mise en pause ; A indiquait `paused · 5000 / 8000
ms`. B continuait sa lecture (`3338 / 8000 ms`, vidéo à `≈ 1,403 s`). La vidéo
commence à 2 000 ms dans la timeline et dure 5,889 s : 5 000 ms cible son
milieu. Cela valide le seek d'une source initiale empaquetée et l'isolation de
l'autre occurrence. Les tests ciblés couvrent en plus les sources futures, le
seek arrière, Reset, replay et destruction.

Observation Chromium : la passe en ligne a enregistré un nouveau `206 Range`
sur la source audio et vidéo lors de leur activation future ; la passe hors
réseau, coupé après `load()`, a quand même joué ces sources et leurs actions.
La disponibilité préalable est prouvée pour ce cas. Le chargement réseau
supplémentaire à l'activation en ligne reste une observation du parcours
runtime, sans correctif inclus dans l'export.

**Tests média et portabilité — 2026-10-19.**
`scene-package-export-acceptance.spec.mjs` construit une scène test propriétaire
avec une source vidéo initiale et une source future. Le vrai preload retient
deux nœuds ; après `load()`, `seek(150)`, `seek(0)`, `reset()`, relance et
destruction réutilisent ces ressources sans nouvel appel natif `load()`. Le
test attendu en échec reproduit séparément la vidéo future montée hors du root.
Le même fichier exporte un autre paquet avec le CLI, le déplace dans un projet
site indépendant, supprime le dossier source, puis le charge à partir d'une
origine HTTP simulée sans cache applicatif ; cette vérification couvre aussi
les callbacks empaquetés R8. Elle ne remplace pas l'acceptation dans un
navigateur réel avec cache froid ni les traces réseau.

**Anomalie runtime CodPlay consignée — hors scope export.** Avant Play, le nœud
préchargé de la source vidéo future (`#t=0.5`) reste dans `document.body` avec
son style de preload effacé ; son rectangle mesuré est `1472×828`, hors du
`root` de scène. Le parcours initial, puis deux chargements séquentiels sur un
même owner, reproduisent ce placement. Les deux appels retournent des IDs et des
roots distincts, mais les nœuds vidéo futurs restent visibles hors de ces
roots. `MediaComponent.ensureStaticSourceNodes()` prend chaque handle avant la
première présentation ; le composant attache la source active seulement, tandis
que le nœud futur conserve son parent de preload après
`clearRuntimePreloadPresentation()`.

Le correctif partagé toucherait au cycle de vie de `MediaComponent` utilisé par
le mode auteur. L'utilisateur exclut ce correctif du chantier d'export : ne pas
modifier `MediaComponent`, ni ajouter un adaptateur export pour le contourner.
Conserver cette observation pour un correctif CodPlay distinct, avec sa propre
analyse causale et un commit séparé. Elle ne bloque pas la fermeture et la
publication des ressources exportées ; aucun changement de composant ou
contournement n'est inclus ici.

**Arrêt :** remonter à la compilation un diagnostic pour un direct, une playlist
segmentée, du DRM ou un flux sans fin sans contrat accepté. Ne pas produire le
paquet ; un succès tolérant `broadcast` ne prouve pas la disponibilité.

### R4 — médias déclarés par un perso `tag`

**Statut : implémenté pour les formes retenues.** Le
[plan CompiledScene](./compiled-scene-plan.md#références-média-du-paquet-de-diffusion)
décrit le propriétaire des références ; la
[spécification de paquet média](../specs/scene-package-export-v1-spec.md)
décrit le format consommé.

- [x] Compiler `attr.src` des tags natifs `img`, `audio`, `video` et `source`
  en références typées et chemins d'occurrence.
- [x] Refuser par diagnostic les ressources natives hors fermeture, dont
  `poster`, `srcset`, `link[href]`, `object[data]`, `iframe/frame[srcdoc]` et
  les éléments `script`/`style`.
- [x] Le paquetage écrit les références compilées dans le manifeste, puis
  `CodPlay.load()` les transmet au preload existant. Le paquetage ne découvre
  pas de champs `attr`.
- [x] Prouver `load()` prêt avant lecture pour les tags image et audio via
  décodeur et événement `canplay` ; le navigateur confirme l'image native dans
  le paquet.

**Arrêt :** référence native média absente du manifeste ou readiness non
vérifiée. Aucun scan ni collecteur parallèle côté exporteur.

### R5 — CSS associé, importé et incorporé

**Paquetage/transmission : implémenté et vérifié.** `styleSheet` reste séparé
du `SceneDoc`; les imports `.css` sont capturés par le CLI. Les dépendances
locales `@import` sont développées en place en conservant `layer()`,
`supports()` et le texte media; les `url()` sont attribuées au compilateur et
copiées par le paquetage sans rescanner les règles. La feuille manifeste les
classNames existants, sans les renommer. La copie de diffusion ne change que
les URL nécessaires à la relocalisation. Le chargeur passe les assets CSS au
preload existant, installe le texte par `preload.css.set()` dans le `head` sous
le scope du root, puis retire le slot avec l'occurrence.

- [x] Capturer `styleSheet` et les feuilles `.css` importées ; développer les
  `@import`/`url()` locaux et remettre les dépendances déclarées au paquetage.
- [x] Recenser les classNames définis sans changer leur identité.
- [x] Préserver les règles et l'ordre des imports CSS testés, à l'exception des
  URL relocalisées.
- [x] Réutiliser le canal CSS existant, scoper par root et nettoyer par instance.
- [x] Refuser cycles, imports distants/manquants, `@namespace`, `scope()` dans
  `@import`, imports imbriqués ou fragmentés, modules CSS, sources `local()` de
  fonte et chemins CSS non résolus.
- [x] Couvrir imports, asset CSS, erreurs/cycles, double scope, destruction et
  scope navigateur dans la démo de diffusion.
- [x] Prouver l'ordre entre plusieurs imports JS et entre les imports et
  `styleSheet` dans `cli.spec.mjs`.
- [x] Décider la portée V1 : les propriétés `style` restent dans le
  `CompiledScene` et ne sont pas converties en classes CSS. Elles sont déjà
  disponibles au moteur ; seule la relocalisation des `url()` locales
  recensées par le compilateur s'applique à la copie exportée. Cette règle
  préserve la priorité inline et les `className` temporels.
- [x] Vérifier que le paquet conserve les autres propriétés `style` et ne
  réécrit que le token `url()` local dans la copie compilée.

La readiness des faces `@font-face` appartient à R6 et n'est pas prouvée par
la seule copie des fontes ou la disponibilité de leurs octets. R5 est **Fini**
pour le contrat CSS de diffusion V1 : règles `styleSheet` scoper, classNames
conservés, dépendances CSS relocalisées et styles de scène conservés dans le
compilé.

**Arrêt :** anomalie CSS détectée mais non attribuée au compilateur, règle
non-relocatable ou dépendance absente.

### R6 — fontes

- [x] Classer chaque URL de `@font-face src` comme ressource `font`, copier les
  octets locaux et la transmettre au preload avant la création de l'instance.
  Le compilateur refuse `local()` et les sources non locales/non résolues.
- [x] Extraire les faces CSS et leurs descripteurs depuis le CSS compilé dans
  l'ordre source : famille, source, poids/plage, style, stretch, axes variables,
  `unicode-range` et `font-display`. Le paquetage relocalise aussi `src` dans le
  manifeste.
- [x] Après installation du CSS scoped, vérifier ses `CSSFontFaceRule` contre
  le manifeste puis attendre les objets `FontFace` actifs déclarés par cette
  feuille. Pour une condition inactive, charger la source dans un `FontFace`
  temporaire non enregistré. Rejeter `load()` si un descripteur ne correspond
  pas, si la face requise manque ou si son chargement échoue.
- [x] Vérifier une vraie fonte WOFF2 locale sans fallback système : la démo et
  les tests possèdent leurs fixtures, la famille déclarée est `loaded` avant le
  retour de `load()`, et la présentation initiale l'emploie.
- [x] Confirmer dans Brave que `@font-face` sous le `@scope` utilisé rejoint
  `document.fonts` et atteint `loaded`, sans modifier le preload général.
  L'acceptation utilise la fonte empaquetée de la démo ; elle ne dépend pas de
  `local()` ni d'une fonte système.

**Arrêt :** face absente, substitution système silencieuse ou instance rendue
disponible avant la fonte requise.

### R7 — ressources définies par le circuit preload

**Décision utilisateur du 2026-10-16 :** l'export suit les ressources et types
définis par le circuit preload existant. Il ne découvre pas de fichiers à
partir de `a[href]` et ne crée pas un type générique `file`, `document` ou
`download`. Les liens HTML restent des liens de navigation, même s'ils portent
`download` ou apparaissent dans une action future ; ils ne sont ni ajoutés au
manifeste preload ni copiés comme assets de scène.

Le manifeste `CompiledResource` porte un type et une URL. Le preload dispose de
stratégies natives et accepte des stratégies personnalisées fournies par le
propriétaire d'une intégration. Chaque catégorie existante relève donc de son
circuit propriétaire : R2–R6 pour les médias/CSS/fontes ; R9–R12 configurent
les intégrations tierces par l'engine. Aucun consommateur générique de documents
ou téléchargements n'est défini par la spécification preload actuelle.

- [x] Vérifier le contrat `a[href]` : la compilation export conserve l'attribut
  dans le `CompiledScene`, sans produire d'entrée preload ni de référence
  paquetable.
- [x] Ne pas créer de stratégie ni de famille d'assets générique dans R7.
- [x] Retirer PDF, fichiers sans extension et binaires inconnus de la matrice
  d'acceptation : aucun consommateur preload ne les déclare.
- [x] Preuve : `tests/scene/compiled/scene-builder.spec.ts`, cas
  `keeps navigation hrefs outside the preload resource manifest in export builds`;
  la suite ciblée a passé 3 fichiers et 41 tests le 2026-10-16.

**Clôture :** aucune verticale autonome de fichiers génériques pour la V1.
Un futur type de fichier doit être déclaré par son consommateur et sa stratégie
preload existants, puis traité dans le plan du propriétaire concerné.

### R8 — fonctions de scène et imports

Le code auteur référencé appartient au paquet `scene` (`scene/functions.mjs`).
Il n'est pas incorporé au player CodPlay ; le player charge la fabrique du
paquet et remet les fonctions au runtime existant comme callbacks.

- [x] Produire les chemins exacts des fonctions de scène prises en charge par
  le contrat d'export : callbacks de cycle de vie, transforms, actions,
  collections de straps et capture.
- [x] Inclure `strapCollections` externes nommées dans la fabrique et conserver
  leurs scopes `scene`/`stories`; refuser les collections absentes ou mal
  formées pendant le build/load.
- [x] Associer les références au module bundlé ; couvrir imports statiques et
  différés, asset `?url`, closures, état de factory et fonctions `async`.
- [x] Préserver l'identité lorsque plusieurs références visent le même objet
  fonction.
- [x] Vérifier les chemins/références produits et refuser les références
  absentes, divergentes ou associées à une collection invalide.
- [x] Interdire `toString`, `eval`, compilation de scène à la lecture, IDs
  devinés depuis un parcours recopié et suppression de fonctions.
- [x] Tests CLI et loader : helper importé, closure de factory, alias de fonction,
  état partagé dans un contexte, contexte neuf isolé, straps et cas refusé.
- [x] Navigateur : un clic DOM traverse un transform de story, son strap externe,
  l'événement transformé vers la portée scène, puis le strap externe scène ; les
  deux sorties publiques sont observées sur le journal de l'instance.
- [x] Depuis le paquet de `components-scene`, vérifier dans Brave le Seek à
  `2000 ms` (sélection), le Seek à `3200 ms` (réponse révélée), `reset()`
  (retour à `0 ms` et état initial), la fin à `3800 ms`, puis le replay par le
  même `telco.play()` (retour à `0 ms`, nouvel état `playing`). L'occurrence et
  son owner de vérification sont détruits après le test.
- [x] Tester `init`, `onStart`, `onSequenceEnd` et les callbacks de capture
  après déplacement du paquet et suppression de ses sources, en passant par le
  loader réel et les événements DOM ; les fonctions restent dans le fichier du
  paquet scène.

La démo autonome conservée dans `packages/demos/scene-export/` exporte
actuellement la scène V2 `preload-media`, pour vérifier la disponibilité des
médias et du CSS. Les fixtures temporaires R8 sont supprimées après vérification.

**Preuve navigateur des straps externes, 2026-10-16.** Un paquet et une scène
de vérification temporaires ont été chargés dans l'onglet existant
`http://localhost:5173/scene-export/` : le clic DOM a exécuté le transform de
story, le strap externe de story, puis l'événement transformé et le strap
externe de scène. `instance.events.onEvent` a reçu `package:story-strap` et
`package:scene-strap`. Le paquet temporaire a été supprimé après l'essai ; la
démo conservée exporte `components-scene.ts`. Aucun fichier runtime CodPlay
n'a été changé pour cette vérification.

**Preuve fonctions empaquetées depuis un autre site HTTP, 2026-10-19.** Le test
`tests/facade/scene-package-export-acceptance.spec.mjs` construit puis déplace
un paquet CLI, supprime les fichiers sources, vérifie que le module de fonctions
est autofermé et absent du player, puis charge le paquet et exécute les
callbacks de cycle de vie et de capture. L'échec d'import ne crée pas
d'occurrence ; un retry réussi réutilise le même ID. La preuve traverse le
loader et le runtime jsdom, sans modifier le moteur. Dans Brave, deux paquets
ont été servis depuis `http://127.0.0.1:5173` alors que la page intégratrice
restait sur `http://localhost:5173`. Le paquet média/CSS a été copié depuis la
sortie de démo ; le paquet fonctions a été exporté vers un staging, déplacé sous
le dossier de test, puis privé de ses sources. Le serveur statique ne servait
que ces deux dossiers. En cache froid, le manifeste, la scène, la feuille CSS,
deux images, l'audio, la vidéo et `scene/functions.mjs` ont répondu HTTP 200 ou
206. `CodPlay.load()` a retourné deux occurrences prêtes sous un owner ; les
images étaient décodées, audio/vidéo à `readyState = 4`, la feuille installée.
La trace a confirmé `init`, `onStart`, `initCaptureState`, `trackCommand`,
`endCapture` et `onSequenceEnd`. Aucune requête de source auteur n'a été émise ;
le player était importé séparément. Le test et cette preuve ne modifient pas le
runtime CodPlay.

**Arrêt :** closure non reconstructible ou dépendance à l'éditeur, au DOM de
construction, à un objet natif vivant ou à une API absente.
Une scène sans fonction ne constitue pas une preuve R8.

### R9 — composants fournis par l'engine (Vérifiée pour la première version)

- [x] Un owner `CodPlay` possède le catalogue partagé. Le site fournit les
  composants, services, modules et bibliothèques avec `new CodPlay({ engine })`
  ou les registres existants avant le premier `build()`/`load()`.
- [x] Le compilateur peut recevoir `--engine-config` pour valider la scène avec
  le même catalogue. Ce fichier sert à la compilation uniquement ; il n'est
  pas copié dans le paquet et `load()` n'inscrit aucune définition.
- [x] La démo fournit les définitions et stratégies Rive/Three par un module
  distinct du paquet scène. Son import `codplay` est résolu vers l'unique
  `/codplay-player/codplay.js` utilisé par le site.
- [x] Preuve Brave : la scène exportée combine le `.riv`, un host Rive et le
  host Three/WebGL dans un seul root. Les deux classes host héritent de la même
  `BaseHTMLComponent` du player ; le réseau montre une seule URL player.
- [x] Le registre conserve sa règle existante : une définition par identité,
  première inscription gagnante et remplacement seulement par override
  intentionnel. Les conflits de versions s'isolent dans des owners distincts.

Le paquet ne contient pas de module de capacités. Un besoin absent du catalogue
doit être corrigé dans la configuration d'engine du site ; l'export ne construit
pas de classe de composant et ne renomme pas une identité.

#### R9 — identité des composants HTML hérités (correctif accepté, 2026-10-20)

La recette visuelle Sighty Demo 5 a révélé qu'un composant d'engine qui importe
`TagComponent` depuis `codplay/runtime/components` embarque une seconde copie
de cette classe dans le bundle d'engine. Ses instances héritent alors d'une
seconde `BaseHTMLComponent` et échouent à la matérialisation du player, malgré
l'externalisation de l'entrée `codplay`.

Le correctif étend l'API racine `codplay` avec `TagComponent` et ses helpers
`sanitizeTagInitial` / `validateTagInitial`, puis fait importer cette API
racine au composant scroll partagé. Le sous-chemin reste utilisable ailleurs ;
les intégrations qui fournissent des composants HTML au player importent leurs
classes de base depuis `codplay`. Cela prolonge le contrat d'identité R9 déjà
vérifié pour `BaseHTMLComponent` et conserve un seul player et un seul circuit
de matérialisation.

Vérifié le 2026-10-20 : `TagComponent` et ses deux helpers sont exportés depuis
l'entrée publique racine ; le composant scroll partagé importe ses classes et
helpers depuis cette entrée. Les typechecks CodPlay, component-v2 et démos
passent ; les 50 tests component-v2 passent ; les builds séparés produisent le
player et l'engine ; Safari initialise le paquet Demo 5, matérialise le
scrollport, débloque la navigation au repère bas et parcourt le quiz avec une
seule URL player.

### R10 — modes de livraison des bibliothèques tierces (Vérifiée)

Décision retenue : chaque entrée de bibliothèque existante dans
`engine.libraries.register` porte le specifier `module` et son `delivery` :
`{ mode: 'package' }`, `{ mode: 'remote', url }` ou
`{ mode: 'platform' }`. Un build séparé de l'engine lit ces métadonnées et
produit l'intégration ESM du site. Le mode `package` laisse le bundler embarquer
le module ; `remote` externalise le specifier vers l'URL ESM indiquée ;
`platform` conserve le specifier externe pour sa résolution par l'import map ou
le mécanisme de modules de la plateforme. L'objet engine produit conserve les
mêmes `RuntimeLibraryDefinition` et stratégies preload. Le player CodPlay et le
paquet scène restent des artefacts séparés ; `load()` ne découvre ni n'inscrit
de bibliothèque.

- [x] Implémenter un `build:engine` atomique prenant `--engine-config` et
  `--output`; lire les métadonnées depuis les entrées library existantes, sans
  registre parallèle ni modification des classes Rive/Three.
- [x] Implémenter les trois modes en conservant les IDs de bibliothèque de
  `CompiledScene.requirements.libraries` et en laissant leur préparation à
  `engine.prepareScene()`.
- [x] Prouver package, remote et platform avec le module Three.js réel depuis
  l'engine construit ; le navigateur charge remote depuis `esm.sh` et résout
  platform par import map.
- [x] Vérifier la préparation unique par owner, l'isolation entre owners et le
  refus d'un chargement indisponible sans instance/root partiel.
- [x] Vérifier la bibliothèque Rive embarquée et son WASM chargé par l'URL
  configurée par l'intégration ; les bibliothèques et leurs dépendances restent
  distinctes des assets du paquet scène.

### R11 — ressources et rendu Rive (Vérifiée pour les assets testés)

- [x] Le `.riv` de la scène est déclaré par le compilateur et copié dans le
  paquet ; la stratégie `rive` existante le précharge via le service configuré
  par le site.
- [x] La vraie scène de diffusion combine un host Rive rendu et l'audio depuis
  le paquet. Le host reçoit la classe de base du player unique via l'intégration
  configurée sur l'engine.
- [x] La démo affiche les diagnostics `severity: error` d'une commande. Dans le
  paquet Rive séparé, Play fait avancer l'audio et les sous-titres sans
  diagnostic ; Pause, Reset et Destroy réussissent.
- [x] Le CLI exporte séparément la scène utilisée par la démo V2 Rive ; son
  manifeste ferme le `.riv` et l'audio dans `scene/assets/`.
- [x] Vérifier au navigateur le paquet Rive séparé : le vrai `.riv` et le MP3
  du paquet sont prêts avant Play ; le canvas et le texte des actions changent
  pendant la lecture sans diagnostic ; Pause, Reset et Destroy réussissent et
  retirent canvas, média et feuille scopée.
- [x] Vérifier le mode package pour la bibliothèque Rive et la disponibilité
  du WASM distant configuré par le package. Le mode remote ESM est vérifié avec
  Three ; le `.riv` n'est pas analysé pour découvrir des dépendances cachées.

Le Seek Rive à 9 000 ms pendant Play a aussi été reproduit dans la démo auteur.
C'est un comportement du player existant, sans lien avec la fermeture des
ressources ; il reste suivi dans un correctif CodPlay séparé. Aucun changement
de composant ou de player n'est inclus dans l'export.
### R12 — modèles, textures et animations Three.js/Avatar (Vérifiée pour les références déclarées)

- [x] La scène combinée de diffusion rend le host Three/WebGL et sa grille via
  les définitions directes configurées dans l'engine du site.
- [x] Le CLI exporte séparément la scène V2 `threejs-grid` : ses trois
  fonctions sont empaquetées ; cette grille procédurale n'a pas de ressource
  binaire à copier.
- [x] Vérifier au navigateur le paquet Three séparé : le vrai module Three
  crée un canvas WebGL2, Play anime la grille, Seek à 4 000 ms réussit, Play,
  Pause, Reset et Destroy passent sans diagnostic et retirent canvas et CSS.
- [x] Fermer les ressources Avatar déclarées par son manifeste preload, avec
  les occurrences exactes produites par son module de scène.

**Preuve navigateur Rive + Three — 2026-10-20.** Le paquet Rive séparé
charge le vrai document Rive et son audio, rend le canvas et permet la lecture.
Le paquet Three séparé rend le canvas WebGL2 et anime la grille. La scène
combinée charge les deux hosts dans une seule occurrence et un seul root, avec
le player importé une fois ; les deux hosts partagent sa classe de base. Le
WASM Rive vient de l'URL configurée par l'intégration. Les modes package,
remote et platform sont vérifiés par R10. Cette preuve couvre la mise à
disposition des ressources et leur passage aux intégrations existantes.
- [x] Réutiliser bibliothèque, stratégies `three-glb`/`three-fbx`, composants et
  cache existants ; ne pas ajouter opportunément GLB/FBX à la table core.
- [x] Vérifier sur le GLB réel que buffer et images sont incorporés ; les
  formats multi-fichiers restent hors de la preuve V1.
- [x] Relier la déclaration du producteur aux chemins compilés par des
  occurrences explicites ; aucun scanner binaire n'est ajouté.
- [x] Préserver les URL sources et relocaliser les occurrences compilées ; le
  preload existant fournit les octets aux loaders sans second chargement export.
- [x] Valider le GLB incorporé et le FBX d'animation réel depuis le paquet.
- [x] Confirmer au navigateur les requêtes des deux fichiers depuis le paquet,
  sans accès aux chemins source `/avatars/`.

Les ressources GLB/FBX secondaires ne sont pas découvertes par analyse binaire.
La V1 est certifiée pour les fichiers explicitement déclarés ; le modèle Avatar
testé contient son buffer et ses images dans le GLB. Les formats multi-fichiers
et les textures FBX latérales restent hors de la preuve V1.

### R13 — ressources de scène depuis une origine distante (évolution ultérieure)

La V1 copie les ressources locales déclarées. L'évolution ultérieure demandée
permettra aux ressources d'une scène d'être lues depuis une origine distante.
Elle ne concerne pas l'hébergement du paquet lui-même : `scenePath` accepte
déjà une URL distante, vérifiée en E12. Le mode `remote` de R10 concerne les
bibliothèques runtime, pas les assets de scène.

Aucune règle technique ni prise en charge des URL distantes d'assets n'est
incluse dans cette tranche. À rouvrir avec un plan d'acceptation dédié ; la V1
refuse les sources non locales prévues par D6.

R5 ferme les imports `.css` de premier niveau, les `@import` locaux et les
`url()` locaux. Préprocesseurs, modules CSS, sources distantes, `@namespace`,
imports imbriqués ou avec query/fragment, chemins absents et sources
`@font-face local()` sont refusés à la compilation. R6 vérifie la readiness des
faces locales avant de créer l'instance.

La compilation export refuse aussi les références de ressources natives qui ne
font pas partie de R2–R4 : `src` hors `img`, `audio`, `video` et `source`,
`link[href]`, `object[data]`, `iframe/frame[srcdoc]`, `image/use[href]` et les
éléments `script`/`style`. Les mêmes familles dans `layout.markup` bloquent le
build. Les liens `a[href]` restent des liens de navigation, pas des dépendances
préchargées.

## 7. Ordre d'exécution et clôture V1

Les étapes E1–E14 sont réalisées pour le périmètre V1. Les références locales,
le CSS, les fontes, les fonctions, les bibliothèques tierces et les ressources
preload Avatar déclarées ont leurs preuves ciblées. R13 reste une évolution
ultérieure et n'est pas un critère de clôture de cette version.

| Étape | Prérequis | Opérations | Sortie exigée avant la suite | État |
|---|---|---|---|---|
| E0 | Aucun code | État Git, specs §2, baseline tests et circuits | Échecs initiaux consignés, propriétaires identifiés | Consigné |
| E1 | D1/D8/D9 | Build player séparé et CLI `tools/scene-export/` | `build:player` produit la bibliothèque ESM ; `--export` publie le paquet scène et ses modules optionnels | Vérifiée : build, test CLI et navigateur |
| E2 | E1 + D5 | R1, API `player.load(scenePath, { root })` | L'instance est retournée prête, sans démarrer ; sa telco lance la lecture | Vérifiée en tests et navigateur |
| E3 | D2/D3 | `CodPlay.build(..., { export: true })`, références typées hors JSON | Sources R2–R4 et erreurs contextualisées ; pas de scan côté exporteur | Vérifiée pour les médias retenus |
| E4 | E3 + D6 | Procédure §5 appliquée aux fichiers locaux des R2–R4 | Copie stable, relocalisation et refus si référence/fichier manque | Vérifiée pour les médias locaux |
| E5 | E4 | R2 et références image natives de R4 | Image initiale prête avant lecture et champs non pris en charge refusés | Première preuve faite ; Seek/replay/reset/reprise vérifiés sur `components-scene` |
| E6 | E5 | R3/R4, audio/vidéo et readiness native | Sources initiales/futures chargées avant lecture et diagnostics vérifiés | Tests couvrent preload initial/futur, seek arrière, reset/replay/destruction ; Brave vérifie deux occurrences prêtes puis lues. Seule reste l'anomalie runtime connue du nœud vidéo futur hors root, reportée au correctif CodPlay séparé |
| E7 | E6 | R5 puis R6 | CSS transitif, scope, assets, styles de scène conservés et faces locales vérifiés | Vérifiée pour le contrat CSS V1 |
| E8 | E7 + D7 initiale | Export core initial et refus compilateur d'un type absent | Baseline core exportable ; `AUTHOR_COMPONENT_TYPE_UNKNOWN` bloque un type absent du core et du paquet | Vérifiée : `components-scene`, CLI 6/6 |
| E9 | E8 + D7 | R9–R11 | Intégration Rive fournie par l'engine et export de sa ressource `.riv` | Paquet Rive séparé et scène combinée Rive/Three vérifiés ; D10 vérifié pour package/remote/platform |
| E10 | E8 + dépendances E9 nécessaires | R12, fichiers explicitement déclarés | Vrais loaders/preload ; ressources Three/Avatar déclarées reliées à la scène | Grille Three et ressources réelles GLB/FBX Avatar exportées et chargées depuis le paquet ; les sous-ressources binaires non déclarées restent hors scope |
| E11 | E2 + D4 retenue | Métadonnées, module bundlé, restauration et acceptance R8 | Références/closures, straps, Seek/replay, occurrences, cycle de vie et capture vérifiés | Vérifiée pour les références couvertes par R8 |
| E12 | E3–E8/E11 | Fixture composite et chargement §8 | Médias, CSS/fontes, fonctions et composants core prêts ensemble depuis un paquet déplacé | Vérifiée : jsdom et Brave, origine distincte, cache froid |
| E13 | E12 | Vérification statique, publication, erreur/annulation/relance | Uniquement un paquet complet publié ; destination existante et sources préservées | Vérifiée : stabilité, fermeture, refus de remplacement, interruption propre et relance |
| E14 | E13 + R9–R12 | Checks §9, specs, README, suivi | Implémentation/contrats/tests/statuts alignés pour la V1 | Fini ; les limites restantes sont explicitement hors scope V1 |

La compatibilité entre versions de player et format de paquet n'est pas
nécessaire à la V1 ; elle devra être décidée avant de faire évoluer leurs
contrats indépendamment.

### Gate E11 — acceptance des fonctions

Les métadonnées structurées, le bundler et leur raccord au loader sont
implémentés. Le parcours des straps, Seek/replay, plusieurs occurrences, les
callbacks de cycle de vie et la capture sont vérifiés pour les références
couvertes par R8.

Les chemins de fonctions, les refus contextualisés, les straps après `listen`,
le parcours DOM → transform → strap → action via le journal, `init`,
`onSequenceEnd` et les callbacks de capture sont vérifiés par les suites
CLI/loader et les preuves navigateur consignées plus haut. La démo
`components-scene` confirme Seek, replay/reset et deux occurrences distinctes
du même owner ; détruire la première laisse la seconde montée et capable de
Seek. E11 est vérifiée pour les références couvertes par R8. L'acceptation HTTP
distincte est vérifiée pour les familles média/CSS/fonctions de cette tranche.

**Prototype préparatoire exécuté le 2026-10-16.** Une
fixture temporaire hors dépôt est passée par `CodPlay.build()` et par un bundle
ESM Vite importé dans un contexte Node neuf. Les chemins de fonction étaient
fournis manuellement dans cette preuve : les références `scene.init` et
`scene.onStart` ont retrouvé le même objet fonction ; des closures issues d'un
helper importé ont conservé leurs valeurs capturées et un état mutable partagé ;
une fonction `async` a gardé son résultat ; les straps externes scène et story
ont gardé leurs portées séparées. Le bundle d'exécution n'a pas appelé
`CodPlay.build()`.

Cette preuve confirmait la faisabilité du transport ; les métadonnées fournies
manuellement ont depuis été remplacées par les chemins structurés du builder.
Elle n'avait pas validé l'import navigateur, le cycle de vie entre appels
`load()` ni les fonctions de capture. Les deux premiers éléments et le refus
d'un import de fonction sans instance partielle sont couverts par les preuves
R8 et `scene-package-export-acceptance.spec.mjs` ; l'essai Brave du 2026-10-19
valide aussi les callbacks après déplacement et suppression des sources.

## 8. Initialisation côté site

### Forme vérifiée pour la V1

L'owner CodPlay garde son rôle d'engine partagé. Chaque `load()` charge un
module-scène et retourne l'instance de cette scène ; la lecture appartient à sa
telco existante.

```js
import { CodPlay } from '/vendor/codplay/codplay.js'

const player = new CodPlay()
const root = document.querySelector('#scene')
const instance = await player.load('/exports/ma-scene/', { root })

await instance.telco.play()
```

- `root` accepte un sélecteur CSS ou un nœud DOM.
- `scenePath` désigne le module autonome exporté. Le site ne réénumère pas ses
  ressources et n'importe pas séparément ses médias, fontes, fonctions ou
  composants.
- `load()` valide le manifeste et la scène compilée,
  restaure les URL du paquet sur une copie, appelle `engine.prepareScene`, puis
  utilise `preload.load()` en mode `author`, `resources.register()` et le
  registre d'instances. Il attend les images matérialisées décodées et les
  sources audio/vidéo matérialisées prêtes ; les actions statiques futures et
  les ressources tierces dont les occurrences exactes sont déclarées sont
  aussi préchargées. Les images CSS et les faces `@font-face` locales sont
  préparées avant création. Les ressources binaires cachées et sources distantes
  restent hors scope V1.
- La résolution réussie de `load()` ne lance pas la lecture. L'appelant démarre
  uniquement l'occurrence retournée avec `instance.telco.play()`.
- Plusieurs appels `load()` sur le même owner partagent son engine et retournent
  des instances distinctes. Le test ciblé vérifie la sérialisation des
  chargements concurrents, les bibliothèques préparées une fois par owner et
  l'isolation entre owners.
- Le constructeur auteur, `build()`, la préparation et `instances.create()`
  existants conservent leurs chemins. L'extension autorisée de la façade ajoute
  seulement `load()` et ne modifie pas le démarrage auteur.

### Séquence de préparation

Les étapes 1 à 9 sont implémentées pour les familles couvertes par R2–R12.
L'engine est fourni par le site ; le paquet ne modifie pas ses registres.

1. Résoudre `scenePath` comme base du module exporté, indépendamment de l'URL de
   la page hôte.
2. Charger et valider le point d'entrée, le compilé, ses fonctions, ses
   requirements et le manifeste de fermeture. Refuser une référence non résolue.
3. Le site configure à l'avance les composants, services, modules,
   bibliothèques et stratégies sur l'engine partagé. `load()` n'enregistre ni
   ne remplace aucune définition.
4. Appeler `engine.prepareScene(compiledScene)` pour les bibliothèques requises ;
   tout échec de préparation rejette `load()` avant la création d'instance.
5. Précharger les ressources de scène via le service CodPlay existant, puis
   adopter leurs handles par les composants propriétaires. Aucun fichier
   requis ne doit commencer un chargement tardif seulement au premier Play.
6. Installer le CSS de scène par le canal existant, conserver les classnames,
   puis attendre la disponibilité effective de ses dépendances, dont les fontes.
7. Créer l'instance avec le compilé et les fonctions de la scène, les capacités
   provenant de l'engine partagé et le root. Résoudre `load()` seulement quand
   toutes ses dépendances sont prêtes.
8. En cas de dépendance absente ou de preload incomplet, rejeter `load()` avec
   l'étape et la ressource concernées ; aucune instance partiellement prête
   n'est rendue lançable. Libérer les seules ressources acquises par cet appel.
9. L'appelant lance l'instance retournée avec sa telco. Les autres instances du
   même owner restent inchangées.

Les signaux de disponibilité de la V1 sont vérifiés par leurs propriétaires :
images décodées, faces de fonte chargées, médias prêts, ressources preload
transmises aux stratégies tierces, et bibliothèques prêtes avant matérialisation.
Le paquet ne prétend pas fermer les dépendances binaires non déclarées ni les
sources d'assets distantes.

### Acceptation spécifique du module et de `load()`

- [x] Test jsdom : le CLI produit un paquet, celui-ci est déplacé dans un
  projet indépendant, les sources sont supprimées, et le loader lit le paquet
  depuis une origine HTTP simulée sans cache applicatif ni import manuel de
  ressources. `scene/functions.mjs` est chargé depuis le dossier déplacé.
- [x] Brave : refaire le parcours depuis `localhost:5173`, en chargeant les
  paquets depuis `127.0.0.1:5173` avec un chemin unique et `Cache-Control:
  no-store`. Le serveur ne sert que les dossiers exportés ; les sources auteur
  du paquet fonctions sont supprimées et aucun import source n'est demandé.
- [x] Depuis cette origine HTTP distincte, charger les paquets sans imports
  manuels de ressources. Les traces réseau ne montrent que le player séparé et
  les fichiers sous les deux dossiers de paquets.
- [x] Dans la portée des composants core, vérifier ensemble CSS/classnames, fonte,
  médias, fonctions et composants core après déplacement du paquet ; `load()`
  attend les ressources et les callbacks de scène s'exécutent. Preuves CLI,
  loader et navigateur ci-dessus.
- [x] Vérifier la scène exportée combinée : `load()`, Play, Pause, rendu
  Rive/WebGL2, ressources du paquet, un seul player et la même classe
  `BaseHTMLComponent` pour les deux hosts.
- [x] Exporter séparément par CLI les scènes V2 Rive et `threejs-grid` avec
  leur engine configuré.
- [x] Vérifier les paquets Rive et Three séparés, puis la scène simultanée ;
  résultats et limites sont consignés en R11/R12. Les trois modes D10 et les
  fichiers Avatar GLB/FBX déclarés sont vérifiés.
- [x] Borner la V1 aux familles de ressources effectivement déclarées et
  vérifiées par R2–R12 ; les extensions futures et ressources distantes ne sont
  pas annoncées comme prises en charge.
- [x] Pour la verticale média, observer que `load()` ne résout qu'après la
  préparation et le preload effectifs. Avant la résolution, l'appelant ne peut
  pas lancer cette instance.
- [x] Pour les médias de la démo, `instance.telco.play()` et les actions futures
  fonctionnent après coupure réseau ; aucune ressource hors paquet n'est requise.
- [x] Refaire cette acceptation depuis le site et les dossiers de paquets
  déplacés, avec cache froid ; les traces couvrent les fichiers du paquet et
  le player séparé. La preuve de ressources média réelles est conservée sous R3.
- [x] Deux `load()` concurrents du même paquet sur un owner donnent des
  instances et des roots distincts ; le preload est sérialisé. Le test est
  dans `tests/facade/scene-package-loader.spec.ts`. La vérification navigateur
  du 2026-10-16 a aussi détruit la première occurrence et confirmé que la
  seconde restait montée et utilisable.
- [x] Les tests du chargeur vérifient deux occurrences du même paquet sous un
  owner partagé ; l'ancienne vérification navigateur de 2026-10-19 a aussi
  observé leur lecture indépendante. La démo conservée est maintenant une
  occurrence combinant Rive et Three, avec les deux intégrations sur le même
  engine.
- [x] Le test déterministe dans `tests/facade/scene-package-loader.spec.ts`
  confirme qu'une avance d'horloge atteint les deux occurrences, puis que
  pause/seek/destruction de A laissent B avancer. La suite ciblée passe :
  10 tests réussis.
- [x] Erreur d'import de `scene/functions.mjs` : aucune instance partielle,
  contexte rejeté retiré et retry réussi sous le même ID ; erreur de preload
  vidéo : nœuds temporaires supprimés et aucune instance créée. Preuves dans
  `scene-package-export-acceptance.spec.mjs`.
- [x] Acceptance composite déterministe : le CLI exporte un paquet réunissant
  image et vidéo de scène, image CSS, fonte locale, fonctions et composants
  core à partir de fixtures possédées par la suite. Après déplacement et
  suppression des sources, `load()` attend les preloads avant de retourner
  l'instance. Cette suite ne remplace pas l'essai avec les médias réels ci-après.
- [x] Brave, acceptance avec ressources réelles, 2026-10-19 : rebuild de la
  démo `packages/demos/scene-export/` depuis la scène V2 `preload-media` et ses
  fichiers existants `uBMXdJ0AyY.mp3`, `LcXkmXyuZQ.mp4`,
  `35c8ec5a07fc.jpg` et `28970388742_2f75d527d6_z.jpg`. Chaque fichier empaqueté
  est identique octet par octet à sa source (`cmp` et SHA-256). Après reload
  sans cache, les deux occurrences sont prêtes ; les images sont décodées et la
  vidéo empaquetée atteint `readyState = 4` (`5,889222 s`). Play avance les
  occurrences et révèle les deux images. Seek A pendant la lecture à 5 000 ms
  place le MP4 réel à `3,0 s` ; A reste en pause tandis que B avance à
  `4 490 ms`. Les requêtes MP3/MP4 viennent des chemins d'assets du paquet
  (`206 Range`), aucune source auteur n'est demandée et la console ne contient
  pas d'erreur.
- [x] Brave, cache froid : la page de vérification sur `localhost:5173` charge
  ce paquet depuis l'origine distincte `[::1]:5173`. Le player reste sur
  `localhost`; manifeste, scène, fonctions, CSS, fonte, images et vidéo viennent
  du paquet. La fonte est `loaded`, l'image décodée, la vidéo prête dans le root,
  puis `init`, `onStart` et `onSequenceEnd` s'exécutent. Les réponses initiales
  du paquet sont 200, la vidéo utilise 206 Range, sans erreur console. La page
  et le paquet de test temporaires ont été supprimés ; `/scene-export/` est
  restaurée.
- [x] Refuser un `scenePath` mal formé avant toute requête ; refuser un
  `CompiledScene` invalide avant préparation moteur, preload et création
  d'instance. Preuves dans `tests/facade/scene-package-loader.spec.ts`.
- [x] Brave : charger une occurrence depuis le paquet existant puis détruire son
  owner ; le root et son slot CSS sont retirés, les slots CSS de l'autre owner
  restent présents. Vérifié sur `/scene-export/` le 2026-10-19.
- [x] Valider la non-régression du parcours auteur ciblée avant mise à jour de
  la spécification : l'instance auteur préexistante conserve objet, état et DOM
  lorsqu'une scène exportée est chargée et détruite à côté.

### Non-régression du mode auteur — preuves de la tranche média

Le constructeur auteur `new CodPlay(options)`, `build()`, le preload et la
création des occurrences restent inchangés. Cette tranche ajoute `load()` sans
déplacer leurs étapes ni imposer une initialisation de diffusion. Le test
`scene-package-loader.spec.ts` charge un paquet à côté d'une occurrence auteur
existante et vérifie que son état et son DOM restent inchangés.

| Parcours existant | Comportement à préserver |
|---|---|
| `packages/editor/src/app/bridges/scene-player-bridge.ts` | Build auteur, CSS, preload, ressources et remplacement de l'occurrence |
| `packages/editor/src/app/commands/editor-player-command-facade.ts` | Lecture, pause et Seek via la telco de l'instance sélectionnée |
| `packages/sighty/src/runtime/state.ts` | Composition CodPlay fournie par Sighty ; les occurrences restent sélectionnées par Sighty |
| `packages/demos/src/v2/layout/layout.ts` | Construction par options/capacités et lecture via la telco de l'occurrence |
| `src/facade/engine-facade/instance-registry.ts` | Création et initialisation existantes |
| `src/facade/instance-facade.ts`, `clock-controller.ts` | La telco cible une occurrence ; l'engine arbitre l'horloge partagée |

L'autorisation et le périmètre de cette tranche sont consignés en §3/D1–D8.
Tout élargissement des fichiers core autorisés exige un plan accepté propre à
la nouvelle famille.

**Preuves ciblées :**

- [x] `build()` auteur et `instances.create()` conservent leur usage ; aucun
  chargement de paquet n'est déclenché par le parcours auteur.
- [x] Un test vérifie qu'une instance auteur préexistante garde son objet, son
  état et son DOM pendant le chargement média.
- [x] Les chargements concurrents testés retournent des instances distinctes
  et sérialisent les opérations de preload du même propriétaire.
- [x] Parcours croisé vérifié : Seek/replay/reset du paquet, destruction d'une
  occurrence sans interrompre l'autre, destruction d'une occurrence diffusée
  sans modifier une instance auteur, puis chargement du même paquet par un
  nouvel owner. L'API n'a pas d'opération de remplacement ; aucune n'est
  introduite par l'export. Les échecs de la suite auteur complète restent
  consignés en V3 et ne sont pas corrigés dans ce chantier.

## 9. Acceptation finale

### États de démo par étape

- Pour chaque étape d'implémentation, produire un seul état de démo temporaire
  qui exerce le chemin runtime réel concerné. À l'étape suivante, le remplacer
  ou le supprimer ; ne pas conserver les états intermédiaires.
- Réutiliser aussi les démos existantes lorsque leur scénario vérifie le
  comportement concerné. Elles complètent la vérification, sans remplacer les
  tests avec leurs propres fixtures ni servir de contournement au runtime.
- Conserver uniquement la démo finale de diffusion dans `packages/demos/`, à
  part de `src/v2/layout` et du sélecteur régulier ; elle exerce le paquet
  exporté via `CodPlay.load()` comme fixture d'acceptation.

### V1 — dossier et publication

- [x] Imports statiques/différés et fichiers requis tous résolus dans la sortie :
  `cli.spec.mjs` importe le module empaqueté avec le loader ESM natif, appelle
  l'import différé et vérifie l'asset bundlé ; l'acceptance réimporte le paquet
  déplacé après suppression des sources.
- [x] Aucun chemin workspace, TS source, bare import non résolu ou CDN requis
  dans le module de fonctions : l'acceptance vérifie l'absence du dossier source
  et de toute instruction `import` résiduelle ; la preuve Brave ne demande que
  le player séparé et les fichiers des paquets.
- [x] Une seule copie CodPlay ; fonctions et données du même build. Le paquet
  n'inclut pas `codplay.js` ; la démo et l'acceptance HTTP chargent les données
  de scène séparément du player.
- [x] Cohérence fichier/manifeste/CompiledScene/requirements ; le test CLI
  relit les octets finaux, vérifie le hash SHA-256 du chemin source utilisé pour
  nommer l'asset et compare les hashes des octets entre deux exports.
- [x] Première version sans hash d'intégrité du contenu : le hash SHA-256 du
  chemin source sert uniquement au nom stable de l'asset. Le test compare les
  octets copiés aux sources ; `export-manifest.json` ne promet pas de vérifier
  leur intégrité après publication.
- [x] Liens externes distingués des dépendances requises : `a[href]` reste une
  navigation dans le compilé sans entrée preload ni fichier copié (test du
  builder, R7).
- [x] Deux exports de la même entrée : chemins, manifeste, asset et hashes des
  octets sont stables ; le CompiledScene est égal après normalisation de
  `createdAt`. Le CLI ne permet pas encore de fixer cette date.
- [x] Aucun paramètre CLI `createdAt` dans cette version : le champ du
  CompiledScene reste temporel. Les tests comparent les octets exportés après
  normalisation de ce seul champ ; tous les fichiers et autres octets restent
  stables.
- [x] Une compilation invalide et une interruption SIGINT ne publient pas de
  destination partielle ni de répertoire temporaire ; une relance vers la même
  destination réussit.
- [x] Une destination déjà présente est refusée sans modifier ses fichiers ni
  créer de sortie de staging.

### V2 — navigateur

- [x] Avant MCP : configuration locale + inventaire vivant **complet**, noms et
  descriptions ; comparer serveurs configurés et outils exposés. Sans outil
  exposé d'un serveur configuré, garder sa validation en attente.
- [x] Page intégratrice `/scene-export/` sur `localhost:5173`, paquets déplacés
  sous `/exports/external-origin-acceptance/{media,functions}/` sur
  `127.0.0.1:5173`, puis chargement répété sans imports de ressources.
- [x] Conserver une démo de diffusion dans `packages/demos/`, à part du layout
  et du sélecteur V2. L'état final combine les scènes auteur V2 Rive et
  `threejs-grid`. L'adaptateur CLI est temporaire ; les sources auteur ne sont
  pas modifiées.
- [x] Le paquet de production courant contient le CompiledScene, CSS, le vrai
  document Rive et son audio ; l'engine du site est un bundle distinct, comme le
  player qui n'est importé qu'une fois.
- [x] Preuve navigateur sur `/scene-export/` après build cache froid : une
  occurrence contient les hosts Rive et Three dans le même root ; leurs deux
  canvases sont présents, l'audio est prêt et Play fait avancer la scène. Le
  réseau sépare player, engine, paquet scène et WASM configuré par Rive, sans
  erreur console.
- [x] Acceptation média de l'étape précédente : deux appels `load()` ont rendu
  des occurrences prêtes avec images décodées et audio/vidéo à `readyState = 4`.
  Seek au milieu de la vidéo et lecture indépendante des deux occurrences ont
  été vérifiés avant remplacement de cet état temporaire par la démo finale.
- [x] Brave : depuis l'origine `localhost:5173`, charger des paquets déplacés
  depuis `127.0.0.1:5173`, cache froid et serveur source auteur indisponible.
  Manifeste, scène, CSS, images, audio, vidéo et fonctions viennent des dossiers
  exportés ; les callbacks de cycle de vie et capture s'exécutent.
- [x] L'anomalie du nœud vidéo d'une source future préchargée hors du root est
  reproduite par `it.fails` et reportée par l'utilisateur à un futur correctif
  CodPlay distinct. Elle n'est ni corrigée ni contournée par l'export ; la
  clôture de ce correctif reste séparée.
- [x] Fermer les contrôles R8 couverts sur le paquet `components-scene` et le
  paquet temporaire à fonctions sans modifier le moteur ; noter toute anomalie
  runtime à part dans le plan du correctif CodPlay concerné.
- [x] Vrais événements DOM → player → callbacks de scène/capture ; le parcours
  transform → strap → journal est couvert par la preuve navigateur R8 ci-dessus.
- [x] Sur `components-scene` exportée : Play, Seek avant/après action,
  replay/reset, deux occurrences du même owner et destruction d'une occurrence
  sans interrompre l'autre.
- [x] Pause, resize et destruction : Brave vérifie Play/Pause à 1100×800,
  puis un changement de viewport à 800×600 pendant la lecture sans arrêter
  l'instance ; Destroy vide ensuite le root et retire les canvases et médias.
  L'export ne modifie pas la politique de visibilité du player.
- [x] Parent/enfant, ordre et reparent exclus avec raison : le paquetage ne
  réécrit que les chemins d'URL fournis par le compilateur ; il ne change ni
  l'arbre de scène, ni `rel`, ni les références de montage.
- [x] Pas de persistance de parcours ajoutée : le test
  `scene-package-loader.spec.ts` détruit le premier owner puis charge le même
  paquet dans un nouvel owner et un autre root. Le navigateur confirme aussi
  le chargement froid du paquet déplacé, sans accès aux sources auteur.

### V3 — commandes

Existantes depuis la racine :

```sh
npm run typecheck --workspace=codplay
npm run test --workspace=codplay
git diff --check
```

Si `component-v2` est affecté :

```sh
npm run typecheck --workspace=@codplay/component-v2
npm run test --workspace=@codplay/component-v2
```

- [x] E1/E2 : commandes réelles du nouvel outil, de ses tests, du build V2 et du
  consommateur consignées ci-dessous.
- [x] Lancer les suites propriétaires du builder, du chargeur, de l'exporteur
  et du build engine ; conserver l'échec attendu du défaut runtime séparé.
- [x] Construire/typechecker les consommateurs touchés par une surface publique
  modifiée, sans corriger leurs symptômes par un circuit local parallèle.

Commandes exécutées depuis la racine :

```sh
npm run export --workspace=codplay -- --scene <scene.ts> --export <dossier>
npm run build:player --workspace=codplay
npm run build:engine --workspace=codplay -- --engine-config packages/demos/scene-export/engine-config.ts --output packages/demos/public/codplay-engine
npm run test --workspace=codplay -- tests/scene/compiled/scene-builder.spec.ts tests/facade/scene-package-loader.spec.ts tests/facade/scene-package-export-acceptance.spec.mjs tools/scene-export/tests/cli.spec.mjs tools/engine-build/tests/engine-builder.spec.mjs
npm run typecheck --workspace=codplay
npm run scene-export:build --workspace=@codplay/demos
npm run typecheck --workspace=@codplay/demos
npm run build --workspace=@codplay/demos
git diff --check
```

Validation finale du 2026-10-20 :

- La commande ciblée builder/loader/export/engine passe : 5 fichiers, 75 tests
  réussis et 1 échec attendu documenté pour le défaut vidéo runtime hors-root.
- Les typechecks CodPlay et démos passent. Le build d'engine, l'export de la
  scène Rive + Three et le build de production des démos passent.
- Brave, sur le port standard 5173 après rechargement sans cache : la scène passe
  à ready, montre les deux canvases, et Play avance la timeline. La trace réseau
  contient une seule requête player, le bundle engine, le manifeste et les
  ressources du paquet ; le WASM Rive configuré répond 200. Aucune erreur console.
- Les validations R10 testent les modes package/remote/platform avec Three,
  l'import map, le chargement différé et l'échec sans instance/root partiel.
- La preuve R12 charge depuis un paquet les vrais avatarsdk.glb, hero-walk.fbx
  et MP3. Le GLB contient son buffer et ses 14 images ; aucune requête source
  /avatars/ n'est émise.
- Le test auteur/diffusion vérifie que charger et détruire une occurrence de
  diffusion à côté d'une occurrence auteur ne modifie ni son objet, ni son état,
  ni son DOM. Les composants Rive, Three et Avatar n'ont pas été modifiés.
### V4 — documentation et statut

- [x] Spécification propriétaire mise à jour avec les comportements média/CSS,
  fonctions, engine tiers et ressources Avatar vérifiés ; limites non couvertes
  marquées explicitement.
- [x] Spécification de paquet alignée avec les preuves navigateur, les tests,
  les modes d'engine et les références preload exactes.
- [x] README : commande réelle, exemple `styleSheet` et intégration dans un site.
- [x] V1 terminée et index du plan général mis à jour. R13 est une évolution
  ultérieure hors de la portée certifiée ; Sighty et Elcé restent hors tranche.

## 10. État initial connu — preuves du 15 octobre 2026

- `npm run build` racine cible codplay-v1 ; `codplay` V2 n'a pas de script build.
- Audit Vite : six builds/ZIP vérifiés. CodPlay minifié **397 492 octets**,
  ZIP **106 731**, aucun import externe ; sans ressources ni intégrations.
  [Mesures locales](../../../dist/build-size-audit-tSwVrc/measurements.json).
- Sonde initiale : `img.initial.src` découvert ; `tag.initial.attr.src` et
  fond CSS manquaient alors au manifeste. Ces références sont maintenant
  couvertes par leurs circuits compilateur/preload. Le PDF lié et le binaire
  inconnu restent hors paquet conformément au contrat R7 : aucun consommateur
  preload ne les déclare.
- Fonctions extraites vivantes ; leur JSON produit `{}`. Closure fonctionnelle
  en mémoire, aucun module portable encore produit.
- Baseline builder/codec/engine/façade : **67 succès, 4 échecs sur 71** avant code,
  révision `fb1e9515329d4a56773af536a8743331fef850c9`.
  `tests/facade/facade.spec.ts:450`, `480`, `508`, `590` : overlay motion au Seek,
  préparation après reset, resize et reset story.
- Commande depuis `packages/codplay` :

```sh
node ../../node_modules/vitest/vitest.mjs run \
  tests/scene/compiled/scene-builder.spec.ts \
  tests/scene/compiled/codec.spec.ts \
  tests/facade/facade.spec.ts \
  tests/runtime/engine/runtime-engine.spec.ts
```

Ces preuves ne certifient aucun export ni chargement navigateur. Cette rédaction
ne modifie aucune source, aucun test et aucune spec de comportement vérifié.
