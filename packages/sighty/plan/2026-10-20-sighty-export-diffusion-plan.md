# Export d’un scénario Sighty — suivi

## Statut

**Paquet de scénario et distribution autonome implémentés et vérifiés le
2026-10-21.** Le ZIP Elcé contient maintenant le loader, CodPlay, Sighty,
l’engine configuré et le paquet Sighty composé de ses scènes CodPlay intactes.
La création des scènes lazy et les opérations ultérieures de remplacement ou
rechargement runtime restent reportées.

**Profil compact : enquête terminée ; nettoyage des callbacks de Demo 5
terminé et vérifié le 2026-10-21.** La phase d’optimisation des exporteurs
selon le périmètre compact est engagée. La construction
répétée de la bibliothèque CodPlay par scène a été supprimée et vérifiée le
2026-10-21 ;
les autres optimisations de build et de taille restent à examiner.
Le focus reste la diffusion autonome optimisée. L’exfiltration lisible du
projet et SCORM restent hors de cette tranche.

## Décisions retenues

- Sighty réutilise `exportScenePackage()` de CodPlay pour chaque scène. Son
  CLI ne fait que construire le paquet parent et référencer les paquets
  enfants.
- Chaque scène garde son paquet CodPlay complet dans son propre répertoire.
  Le scénario et les paquets scène ne partagent ni ne fusionnent leurs
  fonctions.
- Le module de fonctions d’une scène ne contient que ses handlers et straps
  auteur atteignables, ainsi que leurs constantes ou modules auteur utiles.
  CodPlay et les bibliothèques tierces runtime restent hors du paquet scène ;
  ils relèvent du player/engine partagé ou du contrat de l’hôte.
- L’export de scénario seul conserve le build Sighty séparé et laisse
  `codplay` externe. L’option `--standalone --engine-config` réutilise les
  builders CodPlay, Sighty et engine pour une distribution autonome.
- La consommation suit le modèle CodPlay : `new Sighty(options)`, puis
  `await owner.load(path, { root })`. `load()` prépare le scénario et les
  ressources ; `runtime.initialize()` crée et monte les occurrences.
- L’export prend toutes les scènes directes connues. Il refuse les sources
  lazy sans appeler leur producteur.
- L’export de scénario reste le circuit existant. Une option de distribution
  autonome l’enveloppe sans modifier les paquets enfants CodPlay : elle ajoute
  une seule copie de `codplay.js`, `sighty.js` et de l’engine configuré.
- Les artefacts Sighty et engine de cette enveloppe importent le même
  `runtime/codplay.js` par un chemin relatif ; aucune import map ni dépendance
  hôte au player n’est nécessaire.
- `loader.mjs` est le point d’entrée : il construit le propriétaire Sighty
  avec les capacités de l’engine et accepte des surcharges d’options CodPlay
  ou runtime pour l’intégration hôte. Il appelle ensuite le `owner.load()` déjà
  existant sur le scénario racine et retourne les surfaces après préparation ;
  l’intégrateur appelle séparément `runtime.initialize()`.
- Le ZIP Elcé utilise cette distribution autonome. L’adaptation des scènes et
  des médias continue de passer par `createElcePlayerScenario` et le CLI
  Sighty existants.

### Ressources par couche — à appliquer après la phase callbacks

- Un paquet CodPlay de scène unique conserve ses ressources propres et leur
  déclaration d’adressage. Celle-ci doit distinguer les fichiers inclus dans
  le paquet des adresses distantes autorisées par le contrat retenu.
- Un paquet Sighty garde chaque paquet CodPlay de scène intact. Les ressources
  communes fournies par la configuration ou l’engine restent distinctes des
  ressources propres aux scènes ; un répertoire partagé à la racine peut les
  rendre accessibles sans les recopier dans chaque scène.
- Le manifeste doit exprimer cette séparation et les emplacements utilisés.
  Les noms de fichiers et la forme exacte du manifeste restent à fixer dans la
  tranche d’export correspondante.
- **Écart au contrat vérifié :** CodPlay V1 n’accepte actuellement que les
  ressources locales de scène et refuse les références distantes ; le mode
  Sighty autonome refuse aussi les bibliothèques engine `remote` ou `platform`.
  Une prise en charge distante exige une décision et une évolution explicites
  du contrat avant toute modification du code ou de la spécification.

## Tranche distribution autonome — terminée le 2026-10-21

### Invariants

- Garder `sighty.scenario-package.v1` et `codplay.scene-package.v1` inchangés.
- Garder chaque paquet scène dans son dossier, intégral et remplaçable ; ne
  recopier aucun player ni engine dans les paquets enfants.
- Ne pas appeler `runtime.initialize()` ni démarrer la lecture depuis le loader.
- Ne pas créer un second circuit d’export Elcé : le CLI Sighty appelle
  toujours l’exporteur CodPlay existant pour chaque scène.
- Ne pas modifier de capacité du runtime CodPlay ; les adaptations restent
  limitées aux outils de construction et à l’enveloppe Sighty.

### Paquet de distribution visé

```text
loader.mjs
distribution-manifest.json
README.md
runtime/
  codplay.js
  sighty.js
  engine.js
  engine-manifest.json
export-manifest.json
scenario.mjs
scenes/
  scene-0/   # paquet CodPlay inchangé
  scene-1/   # paquet CodPlay inchangé
```

Usage attendu après extraction et publication du dossier sur un serveur web :

```js
import { loadSightyPackage } from './loader.mjs'

const course = await loadSightyPackage({ root: '#player' })
await course.runtime.initialize()
```

### Travail et acceptance

- [x] Ajouter l’option d’enveloppe au CLI Sighty et composer les players et
  l’engine au moyen de leurs builders existants.
- [x] Réécrire uniquement l’import externe `codplay` en import relatif dans les
  deux bundles partagés ; vérifier que les deux utilisent le même fichier.
- [x] Générer le loader et le manifeste de distribution ; laisser le paquet de
  scénario et ses manifests existants inchangés.
- [x] Faire utiliser cette option par l’adaptateur Elcé avant ZIP ; vérifier
  un seul `codplay.js`, `sighty.js` et `engine.js` et aucun player dans un
  paquet scène.
- [x] Ajouter des tests de builder/export et d’intégration Elcé pour charger
  les chemins et contrôler l’initialisation différée.
- [x] Refaire la démo visuelle Demo 5 par le loader livré, puis vérifier dans
  Safari le chargement des ressources et le parcours réel après
  `runtime.initialize()`.
- [x] Mettre à jour ce document de suivi, la spécification Sighty et la
  spécification d’export Elcé avec les preuves vérifiées.

## Paquet produit

```text
loader.mjs
distribution-manifest.json
README.md
runtime/
  codplay.js
  sighty.js
  engine.js
  engine-manifest.json
export-manifest.json
scenario.mjs
scenes/
  scene-0/   # paquet CodPlay inchangé
  scene-1/   # paquet CodPlay inchangé
```

La sortie scenario-only historique reste :

```text
export-manifest.json
scenario.mjs
scenes/
  scene-0/   # paquet CodPlay inchangé
  scene-1/   # paquet CodPlay inchangé
```

Le manifeste parent associe chaque `SceneKey` au répertoire de son paquet
CodPlay. Dans la distribution autonome, le loader appelle `owner.load()` et
retourne les surfaces Sighty préparées ; l’application choisit ensuite quand
appeler `runtime.initialize()`.

## Démo visuelle d’acceptation — cours Demo 5

**Statut : vérifiée le 2026-10-21.** La page `sighty-export/` charge le paquet
autonome produit par le CLI Sighty : loader, unique player CodPlay, Sighty,
engine configuré et quinze paquets scène intacts. Le CLI utilise toujours
`exportScenePackage()` pour chaque scène ; aucune seconde composition de scène
ou de runtime n’est ajoutée.

La configuration d’engine scroll, l’adaptateur HTML, les styles de racine et
les événements d’initialisation restent ceux utilisés par Demo 5. La page
affiche le nombre de scènes directes préparées et le titre de la page courante.
La recette Safari vérifie la préparation sans occurrence, l’initialisation
explicite, le scroll qui déverrouille la navigation, les pages 1 à 3, le quiz,
le déverrouillage du chapitre 2, le reset et une nouvelle initialisation. Les
sources auteur du scénario et des scènes ne sont pas chargées à l’exécution.

Le composant scroll partagé importe `TagComponent` et ses helpers depuis
l'entrée racine publique `codplay`. Cette identité commune est requise parce que
le build d'engine externalise `codplay`, mais bundle les sous-chemins ; un import
depuis `codplay/runtime/components` recréait une classe que le player ne pouvait
pas matérialiser. Le correctif R9 du
[plan CodPlay](../../codplay/plan/2026-10-15-export-diffusion-plan.md#r9--composants-fournis-par-lengine)
est vérifié par la recette Safari ci-dessous.

La spécification de cette fixture et son acceptance visuelle sont décrites dans
[`sighty-export-demo-spec.md`](../../demos/specs/sighty-export-demo-spec.md).
Aucun test comportemental n'est ajouté aux sources de démonstration.

## Preuves réalisées

| Vérification | Résultat |
|---|---|
| Export de deux scènes : manifeste parent, paquets CodPlay, ressource locale, CSS de descripteur, callbacks du scénario, puis suppression des sources | Tests `tools/scenario-export/tests/cli.spec.mjs` réussis ; 5 tests |
| Construction de la bibliothèque CodPlay pour deux scènes, en scénario seul et en autonome | Un seul appel à `buildCodPlayLibrary()` dans chaque mode ; `CodPlay.build()` compile chaque scène ; paquets enfants sans bibliothèque ; test `tools/scenario-export/tests/cli.spec.mjs` |
| Refus d’une source lazy sans exécuter son producteur ni publier le paquet | Test CLI réussi |
| Préparation CodPlay sans occurrence et non-régression de `CodPlay.load()` | Tests ciblés CodPlay réussis ; 30 tests |
| Runtime et API Sighty existants | 54 tests et typecheck Sighty réussis |
| Plugin partagé `component-v2` après adoption de l'entrée racine `codplay` | 50 tests et typecheck réussis |
| Chargeur CodPlay du paquet scène | 17 tests ciblés réussis |
| Build Demo 5 autonome | Loader et trois artefacts runtime construits au même endroit ; paquet Sighty produit avec 15 scènes intactes ; build Vite des démos réussi |
| Chargement du paquet déplacé sans sources auteur dans Safari : aucun rendu avant `initialize()`, puis layout et scène enfant montés, callback disponible | Réussi le 2026-10-20 sur `http://127.0.0.1:5187/` ; aucun message console |
| Safari Demo 5 exporté | 15 scènes préparées sans occurrence ; page 1 rendue après `initialize()` ; scroll débloque Suivant ; pages 1–3, quiz correct, accès chapitre 2 et remise à zéro vérifiés ; aucun module `scenario.ts` ou scène auteur chargé |
| Distribution autonome | Tests Sighty CLI (5), CodPlay engine builder (4), Elcé exporter/client/API (6), typechecks et build Demo 5 réussis ; une copie de chaque runtime, imports relatifs vers CodPlay, loader sans initialisation |
| Safari paquet reconstruit | Le 2026-10-21 sur `http://127.0.0.1:5189/sighty-export/` : ressources runtime et 15 scènes chargées ; scroll, navigation et quiz réussis ; reset puis nouvelle initialisation réussis ; aucune erreur console ni réponse HTTP en échec. Capture : `/private/tmp/sighty-standalone-demo5-verified.png` |
| TypeScript CodPlay | Réussi le 2026-10-20 |
| Build scenario-only de `codplay.js` et `sighty.js` | Réussi le 2026-10-20 ; le mode scenario-only conserve `codplay` externe. Le mode autonome testé séparément utilise des imports relatifs vers son unique `runtime/codplay.js`. |
| Suite complète CodPlay | 793 tests réussis ; 7 échecs dans `facade.spec.ts`, `flip-stress-motion.spec.ts` et `sighty-layout.spec.ts`, hors export/loader modifiés. Les 30 tests ciblés d’export et de chargement passent. |

Le navigateur a validé le chemin réel de paquet, loader, préparation et
initialisation. Le réseau confirme les trois runtimes partagés et les paquets
scène ; l'intégration importe `messages.ts` pour partager l'événement de
présentation, mais aucune source `scenario.ts` ni module auteur de scène.
Le serveur, les paquets construits et la capture de prévisualisation étaient
temporaires ou générés et ne sont pas inclus au dépôt.

## Profil compact — enquête et périmètre cible

### Intention retenue

- Priorité à la diffusion : livrer les ressources requises pour exécuter le
  scénario, avec un loader comme entrée et sans circuit d’initialisation
  supplémentaire.
- Inclure toutes les scènes directes connues et leurs ressources. Aucune scène
  lazy n’est créée ou résolue pendant l’export.
- Garder chaque paquet CodPlay de scène autonome et complet afin de permettre
  ultérieurement son remplacement ou son rechargement isolé. Chaque scène garde
  donc son manifeste, son compilé, ses fonctions runtime, son CSS et les médias
  qu’elle référence ; les fichiers de scène ne sont ni aplatis ni dédupliqués
  entre paquets enfants.
- Garder une seule copie partagée de CodPlay, Sighty et de l’engine configuré à
  la racine. L’export ne lance pas `runtime.initialize()`.
- Préparer plus tard un profil lisible d’exfiltration de projet, avec lecteur
  facultatif. Ne pas ajouter maintenant ses fichiers source, son document
  Elcé ou son lecteur à la diffusion.
- Garder SCORM hors du format et du manifeste actuels jusqu’à sa tranche
  dédiée.

### Contenu exact visé pour la diffusion

À la racine :

- `loader.mjs`, unique entrée qui construit le propriétaire configuré puis
  appelle le chargement Sighty existant ;
- `distribution-manifest.json` et `export-manifest.json`, petits descripteurs
  de format et d’adressage ;
- `README.md`, mode d’emploi de l’entrée ;
- `runtime/codplay.js`, `runtime/sighty.js`, `runtime/engine.js` et
  `runtime/engine-manifest.json`, présents une seule fois. Le player et les
  modules runtime sont minifiés par leurs builders existants.

Pour chaque scène directe :

- son `export-manifest.json` CodPlay V1 et son `scene/scene.json` compilé ;
- uniquement le module de fonctions runtime nécessaire aux références
  réellement présentes dans le compilé, avec leurs dépendances d’exécution ;
- dans `functions.mjs`, uniquement les handlers et straps auteur atteignables,
  ainsi que leurs constantes ou modules auteur nécessaires ; CodPlay et les
  bibliothèques tierces runtime restent hors du paquet scène ;
- sa feuille CSS compilée et ses dépendances locales lorsqu’elles existent ;
- ses ressources et médias réellement référencés par le compilé ou son CSS.

Les capacités CodPlay sont fournies par l’unique player et l’engine partagés à
la racine de la distribution autonome. Toute bibliothèque tierce requise au
runtime relève de l’engine configuré ou d’une dépendance externe déclarée ; elle
ne doit pas être recopiée dans le paquet d’une scène. Une dépendance de build
qui n’est plus utilisée à l’exécution doit disparaître du bundle compact.

Pour le scénario : garder ses identifiants et métadonnées d’exécution, le graphe
`views`, les données auteur consommées, `showMode`, les actions et guards
référencés ainsi que les callbacks de reset réellement utilisés. Le catalogue
de scènes doit garder une entrée légère par `SceneKey` pour que le chargeur
puisse contrôler l’accord avec le manifeste enfant. La définition brute des
scènes ne doit pas être recopiée dans `scenario.mjs` lorsque les paquets CodPlay
en portent déjà le compilé ; les informations dont Sighty a encore besoin
(identifiants de stories, CSS et callbacks de reset) doivent rester disponibles
sans rebundler les constructeurs auteur.

À exclure du profil compact : le document source complet Elcé et son modèle de
document, le catalogue de médias inutilisés, les pages et médias de catalogue
non présents dans le scénario, les éditeurs et leurs composants, les
constructeurs auteur de scènes qui ne sont pas exécutés par le lecteur, les
exports inutilisés des modules source, les sources maps, tests, démos,
historique, dossiers de build et le lecteur d’exfiltration. Les choix de départ
et la progression de lecture appartiennent à l’initialisation et ne sont pas
sérialisés par l’export.

### Constats par propriétaire

#### Export CodPlay — contenu d’un paquet scène

Le contrat V1 place dans chaque enfant le compilé, le manifeste, le CSS et ses
dépendances, les médias référencés et `functions.mjs` si des fonctions sont
nécessaires. Le paquet ne porte pas le player. En distribution Sighty autonome,
le player CodPlay partagé est livré une seule fois à la racine sous
`runtime/codplay.js` ; il n’est donc pas absent du ZIP.

Le point d’optimisation du CLI CodPlay est `buildFunctionModule()` dans
`packages/codplay/tools/scene-export/cli.mjs` : son entrée bundler réexporte la
scène entière, puis le module final retrouve les callbacks par parcours
dynamique de `functionReferences`. Ce chemin masque les propriétés utiles au
tree-shaker. Dans Demo 5, les dix `functions.mjs` font ensemble 1 068 487
octets, sont déjà minifiés, et contiennent malgré tout du code
`AutoCapsule`/`capsule-automation` et les tables de couleurs.

La correction CodPlay doit rendre les références de fonctions statiques au
moment du build et n’embarquer que ces fonctions, `strapCollections` lorsqu’il
est explicitement exporté, et leurs dépendances réellement exécutées. Elle doit
garder les paquets scène autonomes : Demo 5 répète trois JPEG dans trois scènes
chacune, soit 1 341 298 octets de copies avant ZIP. Ce poids est le coût de
l’autonomie demandée ; supprimer ou déplacer ces octets hors des enfants
changerait le contrat de remplacement/rechargement. Le player minifié pèse
550 615 octets dans l’artefact observé ; sa réduction est un chantier séparé,
qui nécessite une analyse fiable des exigences des compilés et ne doit pas
retirer une capacité runtime par simple inspection d’un exemple.

#### Export Sighty — scénario et composition des paquets

Le CLI Sighty construit `scenario.mjs` depuis toute l’entrée auteur sans
minification. Il importe ensuite ce scénario à la construction, mais publie le
module bundlé d’origine. Dans Demo 5, `scenario.mjs` pèse 175 388 octets et
contient des sections source des catalogues de couleurs et de
`capsule-automation`, ainsi que le code qui construit les scènes.

Pour chaque scène dont aucune liaison source statique n’est trouvée,
`createSceneEntryModule()` réimporte le scénario et lit la scène par `SceneKey`.
Le CLI CodPlay rebundle alors ce graphe dans le `functions.mjs` de l’enfant.
Dans l’artefact Demo 5, les dix enfants font ainsi 1 068 487 octets de fonctions
liées aux scènes. Cette amplification est un problème de composition Sighty ×
CodPlay : Sighty doit fournir une entrée isolée pour chaque scène connue sans
réintroduire tout le module scénario dans chaque paquet ; CodPlay doit ensuite
tree-shaker les fonctions de cette entrée isolée.

Sighty doit conserver dans son payload compact le graphe `views`, les données
consommées par ce graphe, l’identité/version/`showMode`, les actions et guards
référencés, les clés de toutes les scènes directes ainsi que les callbacks de
scène effectivement utilisés par le runtime. Le compilé et les ressources de
chaque scène restent dans son paquet CodPlay. Les pages/scènes lazy restent
reportées.

Le runtime Sighty consulte actuellement les `SceneDoc` pour résoudre les slots
du layout et connaître les stories à cibler lors d’un reset, et lit
`onReset`/CSS sur la source scène. Toute suppression de `SceneDoc` redondant
doit donc être précédée d’une extraction et validation de ces métadonnées depuis
le paquet préparé, sans déplacer la création d’occurrences dans `load()`.

#### Adaptateur Elcé — entrée de projet et ressources

L’adaptateur Elcé ne doit pas devenir un second exporteur : il transforme le
document courant en scénario par `createElcePlayerScenario`, fournit les octets
des médias réellement référencés, appelle le CLI Sighty existant, puis zippe son
résultat. Le filtrage des médias est déjà porté par
`scenarioExportMediaIds()` ; le catalogue inutilisé n’est pas nécessaire au
lecteur.

La génération actuelle de l’entrée temporaire importe `ElceDocument` et
`createElcePlayerScenario`. Le CLI Sighty bundle donc le modèle et le graphe de
constructeurs auteur avec le scénario. Dans le profil compact, ces constructeurs
doivent s’exécuter pour produire les ressources, mais leurs implémentations,
`ElceDocument`, les éditeurs et le document de projet ne doivent pas se retrouver
dans le ZIP. La prévisualisation et l’export doivent continuer à partager le
même `createElcePlayerScenario` afin de ne pas créer une seconde définition du
parcours.

Le ZIP Elcé d’audit n’a pas pu être régénéré dans l’environnement courant :
Vitest échoue avant le test, car le paquet `ace` importé par
`packages/codplay/src/runtime/components/polygon/polygon-component.ts` est
absent de `node_modules`. Les mesures de tailles portent donc sur l’artefact
Demo 5 existant et non sur le poids exact d’un ZIP Elcé.

#### Mesures de référence — artefact Demo 5 disponible

L’export autonome observé contient 74 fichiers, soit 4 845 456 octets avant
ZIP et 3 065 586 octets après ZIP niveau 6. Il comprend 744 914 octets de
runtime partagé, 175 388 octets de `scenario.mjs` et 1 068 487 octets de
`functions.mjs`. Les ressources image, vidéo et CSS ne sont pas des sources
auteur et restent requises par les scènes du cours.

### Circuits de construction et engine — vérification du 2026-10-21

CodPlay conserve un seul circuit d’export de scène. `--engine-config` est
optionnel : lorsqu’il est fourni, l’exporteur le charge temporairement pour
valider les requirements de la scène ; il ne l’ajoute pas au paquet scène.
L’engine partagé du site est construit séparément par `build:engine`. Une scène
sans intégration tierce garde donc le même circuit d’export et n’a pas besoin
d’un circuit « sans engine » distinct.

Sighty appelle `exportScenePackage()` pour chacune de ses scènes directes,
qu’une distribution autonome soit demandée ou non. `--standalone` ajoute à la
racine le player CodPlay, Sighty, l’engine configuré et le loader ; il ne change
pas la construction des paquets enfants. Le scénario seul conserve ses
dépendances runtime externes pour l’hôte.

Le CLI Sighty impose toutefois actuellement `--engine-config` avec
`--standalone`, même si la configuration ne fournit aucune bibliothèque tierce.
Ce contrôle est une exigence du mode actuel, pas la preuve qu’un second
constructeur de scènes est nécessaire. **Décision à prendre avant toute
évolution :** garder cette exigence explicite, ou permettre un paquet autonome
core-only sans fichier de configuration auteur. Dans les deux cas, la
recommandation de construction reste un seul circuit CodPlay et une couche
engine optionnelle à la composition du paquet parent.

Un coût de construction distinct de la taille diffusée était confirmé : chaque
appel à `exportScenePackage()` reconstruisait la bibliothèque CodPlay. Le
compositeur Sighty en construit maintenant une seule et passe son module à
l’exporteur existant. Celui-ci appelle `CodPlay.build({ scene }, { export: true })`
pour compiler chaque scène avec un owner neuf. En mode scénario seul, la
bibliothèque temporaire est supprimée avant publication ; en mode autonome,
le même fichier devient `runtime/codplay.js`. Le test de deux scènes vérifie
une seule invocation de `buildCodPlayLibrary()` dans les deux modes et
l’absence de bibliothèque dans les paquets enfants.

### Décision sur les entrées de fonctions — 2026-10-21

L’utilisateur précise que toutes les valeurs variables nécessaires à une
fonction doivent être passées lors de son appel ; les constantes stables
peuvent être définies au niveau du projet et importées. Pour le profil compact,
cela signifie qu’un handler livré ne doit pas capturer une configuration
propre au document, à la scène ou à l’instance. L’audit ne demande pas de
remplacer les effets Sighty existants par des descriptions d’effets : les
opérations restent celles du contrat actuel et leurs capacités sont fournies
par le contexte d’appel.

Les gardes Sighty reçoivent `sceneKey`, `event`, `data`, `context` et `state` ;
les actions reçoivent `event`, `data`, `context`, `state` et `scenarioState`.
Les fonctions tween CodPlay reçoivent `progress` et le `data` de l’action ; les
straps reçoivent `event`, `state`, `meta` et `context`. La mise en œuvre doit
s’y limiter. Si un comportement existant exige une valeur dynamique sans canal
d’appel approprié, le plan doit documenter ce manque avant toute évolution de
runtime ; aucun argument ou service runtime nouveau n’est présumé.

L’audit de Demo 5 a relevé deux captures dynamiques et les a éliminées sans
modifier le runtime Sighty : les actions auteur lisent déjà leur identité depuis
le contexte d’appel, et le journal est observé par l’hôte via
`runtime.events.onEvent`. `onReset(keys)` ne fournit toujours pas d’identifiant
de scène ; les scènes quiz utilisent l’événement de reset générique et leur
`pageId` déjà présent dans l’état local. Le contrat Sighty reste inchangé.

`onTestStateChange` est un rappel de l’hôte Elcé utilisé par l’aperçu pour la
persistance auteur ; l’export de diffusion ne sérialise pas cette fonction et
ne persiste pas la progression. Il ne doit pas subsister comme capture dans
les handlers livrés.

### Porte d’implémentation

Les callbacks Sighty et les fonctions de scène peuvent être des fermetures
arbitraires : `Function.prototype.toString()` ne transporte pas leurs variables
capturées. Le compilateur actuel conserve leurs modules source pour préserver
ces fermetures. Le profil compact vise les seuls handlers référencés et leurs
dépendances, en donnant les valeurs propres au document et à la scène via les
arguments déjà disponibles. Les constantes stables restent des imports de
projet. La politique pour une fonction auteur qui capture une valeur dynamique
reste à décider : échec compact avec un diagnostic précis, ou conservation
d’un chemin historique distinct. Quelle que soit l’option retenue, pas de
transformation avec `toString()` ou `eval`.

L’implémentation doit étendre les outils CodPlay et Sighty en réutilisant leurs
circuits existants. Toute évolution éventuelle du runtime Sighty doit avoir un
item accepté avant le code. Aucun second exporteur Elcé ni changement
opportuniste du runtime CodPlay n’est prévu. Le test statique réalisé est
ciblé sur les factories effectivement utilisées ; l’acceptance du profil
compact devra aussi contrôler la sortie construite et le parcours réel.

### Audit de pureté et de captures — 2026-10-21

« Fonction pure » et « fonction sans capture lexicale » sont deux propriétés
différentes. Une fonction peut être sans effet de bord tout en dépendant d’une
configuration capturée ; une action peut être sans capture et rester
intentionnellement effectful parce qu’elle met à jour le contexte Sighty ou
envoie des événements.

Un contrôle statique par AST TypeScript sur les factories effectivement
utilisées a relevé ces captures :

| Callback | Valeurs capturées | Effets observés |
|---|---|---|
| Garde d’accès Elcé `createPageAccessGuard` | `document`, `pageIds`, `questionBdcByPage`, `previewStartPageId`, `evaluationResultPageIds` | Aucun effet direct relevé ; prédicat de lecture, paramétré par le document capturé |
| Garde de sortie Elcé `createPageExitGuard` | `document`, `pageIds`, `questionBdcByPage` | Aucun effet direct relevé |
| Actions inline `REFRESH_PRESENTATION`/`OPEN_MENU_DRAWER` et factories `createMarkPageFinished`, `createRecordQuestionResult`, `createRefreshEvaluationResult`, `createSaveProfileValues` et `createSubmitProfile` | `document` et/ou `onTestStateChange` | Appels à `context.updateContext()` et au callback de persistance optionnel |
| Strap carousel Elcé `createSelectionStrap` | `prefix`, `content`, `storyId`, `expandableViews` | Produit des mises à jour et événements déclaratifs sans les appliquer directement |
| Strap expansion Elcé `createViewportExpansionStrap` | L’objet `input`, qui contient l’identifiant de story, des collections de vues et des noms d’événements | Produit des mises à jour et événements déclaratifs |
| Reset Elcé de page | `questionReset` | Retourne une description d’événement sans effet direct |
| Straps de quiz Demo 5 (sélection, validation, reset) | `page`, `prefix` — résolus ; `question`, `pageId` viennent de l’état de story et les choix de l’événement | Produisent des mises à jour et événements à partir des entrées de strap |
| Actions du scénario Demo 5 | `onLog` — résolu ; les actions lisent leur contexte d’appel, le logger hôte observe l’événement public | Mettent à jour le contexte et publient les projections Sighty |
| Transform de titre Demo 5 | `headingTween` — résolu ; `fromHue`, `toHue` et `ratio` arrivent dans `data` | Calcul déterministe d’un patch de style, avec les constantes de couleur du projet |

Ce relevé statique ciblait les factories utilisées ; la première table Elcé
reste un audit des captures existantes pour une tranche ultérieure. Les
callbacks auteur de Demo 5 listés ci-dessus ne capturent plus de valeur propre
à une scène ou à une instance. Les actions Sighty effectful restent conformes
au contrat d’exécution existant via `context.updateContext()` et
`context.send()`.

L’absence de capture dynamique ne suffit pas, à elle seule, à faire éliminer
les constructeurs par le tree-shaker : le problème mesuré vient aussi des
graphes d’imports dynamiques et de la construction runtime des scènes. L’export
CodPlay a déjà un contrat vérifié qui préserve les closures dans un contexte
isolé par owner/paquet, sans `Function.toString()` ni `eval` ; le profil
compact doit donc s’y ajouter sans remplacer implicitement le format courant.

### Phase 1 — callbacks auteur de Demo 5

**Statut : Terminée et vérifiée le 2026-10-21.** Cette phase nettoie les
callbacks de scène de Demo 5. Les exporteurs restent hors de cette phase.

- [x] Remplacer le tween local capturé des titres par un calcul top-level qui
  reçoit les bornes de teinte et le ratio via `data`, en gardant le chemin ACE.
- [x] Nettoyer les straps de quiz qui capturaient `page` et `prefix` : leur
  fonction de module lit `question` et `pageId` dans l’état local, et les choix
  dans les données de l’événement. `pageTitle` n’est pas requis ; le logger
  hôte retrouve le titre depuis le catalogue avec `pageId`.
- [x] Retirer la capture de `onLog` des actions auteur ; l’hôte observe
  `COURSE_EVENTS.quizAnswered` par le canal existant `runtime.events`.
- [x] Rendre le reset quiz top-level : `onReset(keys)` émet un événement
  générique et chaque strap résout ses effets depuis son propre état local.
  Le contrat Sighty `onReset(keys)` reste inchangé.
- [x] Vérifier typecheck, build, feedback et journal des quiz, progression,
  reset complet et effacement de l’état local après réouverture dans le
  parcours réel Safari Demo 5 ; consigner l’observation dans la spécification.
- [ ] Poursuivre l’optimisation des exporteurs selon la tranche compacte et
  son acceptance, dans une étape ultérieure.

Acceptance requise avant de stabiliser le profil :

- décider si le profil compact est explicite et comment il traite les
  callbacks qui capturent des valeurs dynamiques ;
- ne produire que les callbacks atteignables depuis le compilé et le scénario,
  avec leurs imports réellement exécutés ;
- vérifier qu’un callback compact ne capture aucune donnée propre au document,
  à la scène ou à l’instance, et que les valeurs requises arrivent par ses
  arguments d’appel ;
- vérifier que le module scénario livré n’importe ni le document Elcé ni les
  constructeurs et catalogues auteur ;
- vérifier que chaque `functions.mjs` ne contient que les handlers référencés
  par son compilé et la fermeture de dépendances nécessaire ;
- charger un paquet déplacé, initialiser séparément, puis valider Play, Seek,
  reset, callbacks, CSS, assets et remplacement/remontage isolé d’un paquet
  scène ;
- comparer le ZIP avant/après sur Demo 5 et sur l’aperçu Elcé, en distinguant
  la taille source du ZIP ;
- conserver la suite de tests CodPlay/Sighty/Elcé et les vérifications
  navigateur pertinentes.

### Re-test Safari du 20 octobre 2026

Le premier chargement de `/sighty-export/` sur `127.0.0.1:5187` a signalé un
timeout de 10 secondes pendant le preload du MP4 de `scene-6`. Le fichier
répondait et le nœud vidéo a ensuite atteint `readyState = 4` avec
`canplaythrough`. Un chargement sur l’origine fraîche `localhost:5187` a
préparé les quinze scènes sans occurrence ; l’initialisation, le défilement,
la navigation vers le quiz, la bonne réponse, la remise à zéro et une nouvelle
initialisation depuis la première page ont été vérifiés. Le timeout initial
n’a pas été reproduit sur cette origine fraîche ; aucun changement de fixture
ou du runtime n’a été fait pour le masquer. Si ce timeout se reproduit, il
reste à examiner dans le preload vidéo CodPlay.

## Travail réalisé

- [x] Étendre le producteur CodPlay pour accepter une entrée de scène et
  l’origine des ressources séparément, tout en gardant le format de paquet
  scène V1.
- [x] Exposer dans CodPlay la préparation d’un paquet sans occurrence ; garder
  `CodPlay.load()` sur le même chemin avant sa création d’instance.
- [x] Ajouter le CLI Sighty qui bundle le module scénario et appelle l’exporteur
  CodPlay une fois par scène directe.
- [x] Ajouter le build séparé de la bibliothèque Sighty.
- [x] Charger le paquet dans un propriétaire Sighty et fournir ses surfaces
  `scenario` et `runtime` sans initialiser ni lancer la lecture.
- [x] Mettre à jour les spécifications et le guide d’usage avec le comportement
  livré et ses preuves.

## Suite reportée

La résolution et la création lazy de définitions pendant la lecture restent
hors V1. L’évolution devra décider comment fermer leurs dépendances et charger
un paquet scène à la demande. Aucun producteur lazy n’est invoqué par cet
export. Le paquet enfant intact permet d’étudier ultérieurement le remplacement
d’une scène sans modifier les paquets voisins ; aucune API de remplacement ou
de rechargement runtime n’est fournie dans cette tranche.

## Consommation depuis des projets tiers — décision du 2026-10-21

**Exigence acceptée :** les projets consommateurs sont extérieurs à ce dépôt et
appelleront CodPlay et Sighty comme des dépendances tierces, sous leurs noms
actuels, via un registre npm. Aucun package n’est prêt à être installé ou
publié sur npm maintenant ; cette décision fixe la cible future, pas une
autorisation de publication ni une preuve de disponibilité. Aucun numéro de
version de publication n’est choisi dans cette tranche.

Le code d’export doit s’appuyer sur les points d’entrée de package prévus pour
CodPlay et Sighty, jamais sur le voisinage du monorepo. CodPlay reste le
compilateur des paquets scène ; Sighty continue de composer le scénario en
réutilisant ce compilateur.

**Écarts à corriger dans le code source :**

- `packages/sighty/tools/scenario-export/cli.mjs` importe les trois outils
  CodPlay depuis `../../../codplay/...` au lieu de sous-chemins du package
  `codplay`.
- `packages/elce/src/export/elce-scenario-exporter.ts` localise le CLI Sighty
  par `MONOREPO_ROOT/packages/sighty/...` et l’exécute depuis la racine du
  monorepo.
- Les deux manifests devront exposer les sous-chemins d’outils utilisés par
  leurs consommateurs. Les déclarations de publication, les versions
  compatibles, les dépendances de production et l’éventuel changement de
  `private` restent à la tranche de préparation npm.

**Travail source autorisé dans la tranche actuelle :** exposer les seuls
sous-chemins nécessaires, faire résoudre CodPlay et Sighty par leurs
specifiers de package et supprimer les calculs de chemins vers le monorepo dans
l’adaptateur Elcé. Vérifier les exports et tests depuis les workspaces déjà
présents, sans installer, empaqueter pour installation ou publier de package.

**Acceptance différée jusqu’à la préparation npm :** installer les archives
publiées dans un projet temporaire hors du dépôt, puis appeler l’export Sighty
avec des entrées propres à ce projet et charger le paquet obtenu. Cette preuve
devra confirmer l’absence de dépendance au monorepo et l’utilisation de
`exportScenePackage()` CodPlay pour chaque scène. Les spécifications ne
déclareront le parcours externe vérifié qu’après cette acceptance.

### État de la frontière source — 2026-10-21

- [x] CodPlay expose dans son manifest les trois sous-chemins d’outils utilisés
  par le compositeur Sighty.
- [x] Le CLI Sighty importe ces sous-chemins par le package `codplay` ; le test
  les résout par les exports de package via le lien workspace, sans alias Vite
  vers les fichiers outils voisins.
- [x] Le manifest Sighty expose son CLI et l’adaptateur Elcé le résout par ce
  point d’entrée. Son processus et la normalisation des sources temporaires
  suivent le répertoire de travail appelant, sans `MONOREPO_ROOT`.
- [x] Vérifier les 56 tests Sighty, les 6 tests d’export Elcé ciblés, les
  typechecks Sighty/Elcé et `git diff --check`.
- [ ] Préparer les manifests à l’installation depuis un registre : dépendances
  nécessaires en production, versions compatibles et choix de `private`.
- [ ] Après préparation et autorisation de diffusion, installer les artefacts
  de registre dans un projet externe et exercer le parcours complet.

Aucune installation depuis le registre ni publication npm n’a été faite. Le
package CodPlay reste `private` et ses versions ne sont pas sélectionnées pour
publication ; le parcours d’installation externe reste non vérifié.
