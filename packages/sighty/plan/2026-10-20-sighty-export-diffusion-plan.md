# Export d’un scénario Sighty — suivi

## Statut

**Paquet de scénario et distribution autonome implémentés et vérifiés le
2026-10-21.** Le ZIP Elcé contient maintenant le loader, CodPlay, Sighty,
l’engine configuré et le paquet Sighty composé de ses scènes CodPlay intactes.
La création des scènes lazy et les opérations ultérieures de remplacement ou
rechargement runtime restent reportées.

**Profil compact : callbacks et paquets compilés implémentés et vérifiés le
2026-10-21.** CodPlay ne conserve dans `functions.mjs` que les fonctions
référencées et leurs dépendances auteur. Le scénario Sighty V2 ne livre plus
les `SceneDoc` ; chaque paquet enfant reste un paquet CodPlay autonome et
contient sa scène compilée dans `scene/scene.json`. Elcé groupe ses callbacks
runtime par scène et son scénario ne livre plus le document ni ses
constructeurs. La construction répétée de la bibliothèque CodPlay par scène a
également été supprimée.

Sur l’export `Projet-1.sighty-2` fourni, les quatre `functions.mjs` passent de
864 232 à 42 748 octets bruts (−95,05 %) et de 244 438 à 13 588 octets gzip
calculés fichier par fichier (−94,44 %). `scenario.mjs` passe de 421 067 à
71 121 octets (−83,11 %). Le ZIP autonome compact Elcé obtenu pèse 323 199
octets. Les tests et spécifications de cette tranche sont à jour.

Le suivi reste ouvert pour les décisions et évolutions de ressources locales,
distantes et partagées par l’engine, ainsi que pour l’acceptance depuis un
projet installé hors du monorepo. L’exfiltration lisible et SCORM restent hors
de cette tranche.

## Décisions retenues

- Sighty réutilise `exportScenePackage()` de CodPlay pour chaque scène. Son
  CLI ne fait que construire le paquet parent et référencer les paquets
  enfants.
- Chaque scène garde son paquet CodPlay complet dans son propre répertoire ;
  son `scene/scene.json` contient le `CompiledScene`. Le scénario et les
  paquets scène ne partagent ni ne fusionnent leurs fonctions.
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

### Décision acceptée — nom du module d’intégration Elcé

Le fichier qui fournit les capacités et options d’intégration Elcé ne doit pas
s’appeler simplement `engine.js`, nom qui le confond avec le moteur CodPlay
contenu dans `codplay.js`. Le ZIP Elcé le nomme `runtime/elce-engine.js` et
`runtime/elce-engine-manifest.json`. Le CLI Sighty reste générique : il accepte
un nom de module facultatif, dont la valeur par défaut conserve
`runtime/engine.js` pour les autres consommateurs.

- [x] Ajouter `--engine-name` au CLI Sighty, l’utiliser pour le module, son
  manifeste et l’import du loader ; conserver le nom générique par défaut.
- [x] Faire passer `elce-engine` par l’adaptateur Elcé et vérifier les chemins
  du ZIP, du manifeste de distribution, du manifeste CodPlay et du loader.
- [x] Mettre à jour les spécifications Sighty et Elcé après validation des
  tests concernés.

### Décisions ouvertes — ressources par couche

**Orientation retenue par l’utilisateur, à implémenter dans une tranche
ultérieure :** le manifeste d’un paquet scène doit indiquer si ses ressources
sont incluses localement ou référencées à distance. Dans une distribution
Sighty, chaque paquet CodPlay garde ses ressources propres ; celles que fournit
l’engine restent communes et doivent être adressées depuis la couche partagée,
éventuellement par un dossier de ressources à la racine. Une scène unique
diffusée sur une page peut avoir toutes ses ressources dans son propre paquet.

Restent à définir dans la tranche ressource : les champs et chemins exacts du
manifeste, la résolution des URL distantes, et la façon dont l’engine référence
les ressources communes. **Contrat actuellement vérifié :** CodPlay V1 accepte
les ressources locales de scène et refuse les références distantes ; le mode
Sighty autonome refuse aussi les bibliothèques engine `remote` ou `platform`.
Ne pas faire passer l’orientation acceptée pour un comportement déjà livré.

## Tranche distribution autonome — terminée le 2026-10-21

### Invariants

- Garder `codplay.scene-package.v1` inchangé et le loader compatible avec les
  anciens manifests `sighty.scenario-package.v1`. L’export compact produit un
  manifeste Sighty V2 distinct.
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

Avant compact, `buildFunctionModule()` réexportait la scène entière au bundler,
puis retrouvait les callbacks par parcours dynamique de `functionReferences`.
Ce chemin empêchait le tree-shaker d’éliminer le code auteur inutilisé ; les
sorties contenaient notamment `AutoCapsule`, `capsule-automation` et les tables
de couleurs. Le CLI utilise maintenant le namespace ESM explicite
`sceneFunctions`, relie les callbacks requis par identité et génère des imports
statiques. Le format conserve chaque paquet CodPlay autonome. Les médias
répétés entre paquets restent donc le coût assumé de cette autonomie ; ils ne
sont pas dédupliqués entre scènes.

#### Export Sighty — scénario et composition des paquets

Avant le format compact V2, le CLI Sighty publiait le graphe auteur complet,
avec les catalogues, les constructeurs et les `SceneDoc`. Il produit désormais
le graphe runtime et les callbacks référencés dans `scenario.mjs` ; les scènes
compilées et leurs ressources restent dans les paquets CodPlay enfants. Le
format compact fournit au CLI CodPlay le module de fonctions groupé de la
scène, et non le scénario auteur entier. `functionReferences` sélectionne les
callbacks nécessaires en maintenant chaque enfant autonome.

Sighty doit conserver dans son payload compact le graphe `views`, les données
consommées par ce graphe, l’identité/version/`showMode`, les actions et guards
référencés, les clés de toutes les scènes directes ainsi que les callbacks de
scène effectivement utilisés par le runtime. Le compilé et les ressources de
chaque scène restent dans son paquet CodPlay. Les pages/scènes lazy restent
reportées.

Le runtime compact lit les slots du layout et les IDs de stories depuis les
`CompiledScene` préparées par `owner.prepare()`. Les callbacks `onReset` restent
dans les métadonnées du scénario et la CSS est préparée par le paquet CodPlay.
Cette préparation ne crée aucune occurrence : `runtime.initialize()` reste
l’étape qui compose les scènes.

#### Adaptateur Elcé — entrée de projet et ressources

L’adaptateur Elcé ne doit pas devenir un second exporteur : il transforme le
document courant en scénario par `createElcePlayerScenario`, fournit les octets
des médias réellement référencés, appelle le CLI Sighty existant, puis zippe son
résultat. Le filtrage des médias est déjà porté par
`scenarioExportMediaIds()` ; le catalogue inutilisé n’est pas nécessaire au
lecteur.

L’entrée temporaire d’Elcé réutilise toujours le producteur partagé avec la
preview pour construire le scénario et les scènes. Le CLI n’expédie que le
graphe d’exécution et les références nécessaires ; `ElceDocument`, les
constructeurs auteur et l’éditeur restent hors du ZIP. Les callbacks de scène
Elcé sont regroupés par module, et leurs paramètres spécifiques sont stockés
dans l’état compilé.

Le ZIP Elcé compact a été généré depuis le même document et les mêmes octets
média que l’export fourni par l’utilisateur ; le poids de sortie autonome est
323 199 octets. Les tailles comparatives détaillées sont consignées plus bas.

#### Mesures de référence — artefact Demo 5 disponible

L’export autonome observé contient 74 fichiers, soit 4 845 456 octets avant
ZIP et 3 065 586 octets après ZIP niveau 6. Il comprend 744 914 octets de
runtime partagé, 175 388 octets de `scenario.mjs` et 1 068 487 octets de
`functions.mjs`. Les ressources image, vidéo et CSS ne sont pas des sources
auteur et restent requises par les scènes du cours.

#### Référence fournie par l’utilisateur — export Elcé non optimisé

L’export `Projet-1.sighty-2` contient 12 scènes. Quatre paquets ont un
`functions.mjs` : `scene-3` (215 142 octets, 2 références), `scene-8`
(215 576 octets, 5 références), `scene-9` (217 464 octets, 8 références) et
`scene-10` (216 050 octets, 3 références). Le total initial est de **864 232
octets pour 18 références**. Une compression gzip niveau 9, appliquée à chaque
fichier séparément pour fournir un repère comparable, donne 244 438 octets ;
ce chiffre n’est pas la taille d’un ZIP.

Chaque fichier n’expose que `functionReferences` et
`createScenePackageContext` comme exports ESM, mais contient environ 405
déclarations `function` détectées par scan lexical. Les quatre modules ont
environ 203 Ko de contenu de lignes identique entre eux. C’est un indicateur
fort de code de construction partagé et réembarqué, pas une mesure directe des
octets supprimables. La comparaison après export compact est consignée dans la
section « Résultat compact Elcé » ci-dessous.

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

Le CLI Sighty impose actuellement `--engine-config` avec `--standalone`, même
si la configuration ne fournit aucune bibliothèque tierce. Ce contrôle est une
exigence du mode actuel, pas la preuve qu’un second constructeur de scènes est
nécessaire. **Décision à prendre avant toute évolution :** garder cette
exigence explicite, ou permettre un paquet autonome core-only sans fichier de
configuration auteur. Dans les deux cas, la recommandation de construction
reste un seul circuit CodPlay et une couche engine optionnelle à la composition
du paquet parent.

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
capturées. La règle auteur retenue par l’utilisateur est que les valeurs
dynamiques arrivent par les paramètres d’appel ; les constantes stables sont
définies au niveau projet et peuvent être importées. Le profil compact utilise
des exports ESM auteur groupés et garde leurs imports transitifs. Il ne
reconstruit jamais une fonction par `toString()` ou `eval`. Cette règle est
vérifiée par audit des callbacks concernés et leurs tests ; le bundler ne
prétend pas détecter automatiquement une capture dynamique arbitraire.

**Précision du circuit CodPlay, vérifiée le 2026-10-21 :** `CodPlay.build(...,
{ export: true })` produit `functionReferences` sous la forme `{ ref, path }` et
vérifie que chaque chemin désigne encore la même fonction auteur. C’est la
source d’autorité pour savoir quelles fonctions sont présentes et requises.
L’exporteur réimporte toutefois le module scène entier, puis résout ces chemins
à l’intérieur de `createScenePackageContext()` ; ces chemins ne sont pas des
exports ESM que le tree-shaker peut sélectionner. Un essai Vite local montre
qu’un accès littéral à une propriété imbriquée conserve les propriétés voisines
de l’objet, tandis qu’un import ESM nommé élimine les exports inutilisés. Le
chemin compact établit maintenant un lien statique entre les références
compilées et les exports du module de fonctions auteur.

**Décision utilisateur du 2026-10-21 :** toutes les fonctions d’une scène sont
regroupées dans un unique module auteur, qui produit l’unique
`scene/functions.mjs` de son paquet. Le compact ne doit pas imposer un fichier
par callback ni disséminer les fonctions entre paquets. `functionReferences`
reste la vérification que chaque fonction requise par la scène est bien
présente. **Décision utilisateur du 2026-10-21 :** le module de scène désigne
explicitement le groupe avec `export * as sceneFunctions from
'./scene-functions.js'`. L’exporteur associe les fonctions compilées aux
exports de ce namespace par identité, puis génère des imports ESM nommés pour
les seules fonctions requises et les straps externes réellement déclarés. Vite
ferme leurs imports auteur transitifs et élimine les exports inutilisés. Un
namespace déclaré mais incomplet bloque l’export avec un diagnostic ; sans
namespace, le chemin historique continue de préserver les fermetures. Aucun
code de construction de scène ne doit entrer dans le chemin compact.

**Travail accepté et exécuté :** étendre les CLI CodPlay et Sighty ainsi que
l’adaptateur Elcé en réutilisant leurs circuits d’export, sans modifier
`packages/codplay/src`. Les tests vérifient l’identité des références, le
tree-shaking, les imports transitifs, les contextes indépendants, le parcours
historique à fermetures, les paquets compilés et les callbacks du scénario.
Les spécifications ont été mises à jour avec les comportements vérifiés ; les
questions de ressources non implémentées restent dans la section ouverte.

**CodPlay compact — implémenté et vérifié le 2026-10-21 :** le namespace
`sceneFunctions` active le chemin compact de l’exporteur, sans changement du
runtime CodPlay. Le test CLI prouve la sélection par identité, l’inclusion d’une
constante importée, le retrait d’un callback et de sa dépendance inutilisés,
l’exclusion du constructeur de scène et le renouvellement des fonctions par
contexte. Le test historique vérifie toujours ses fermetures, imports différés,
assets et straps. Les 15 tests CLI et 5 tests d’acceptance paquet sont passés ;
le typecheck CodPlay est passé.

**Décisions utilisateur du 2026-10-21 :** l’export de diffusion est compact,
non rééditable et utilisable depuis un point d’entrée unique (`loader.mjs`).
L’export reçoit une table de build `SceneKey → module auteur groupé` pour les
scènes issues de factories, exécute ces factories pendant la construction et
publie chaque scène concrète dans son paquet CodPlay autonome. Le paquet
CodPlay enfant contient la seule représentation de scène livrée : sa
`CompiledScene` et les ressources runtime décrites par son manifeste. Le
`SceneDoc`, le code des factories et les CSS/médias déjà copiés dans l’enfant
ne sont pas recopiés dans `scenario.mjs`.

Le scénario compact conserve son graphe `views`, ses données et ses actions,
guards et callbacks `onReset` nécessaires à l’exécution. Sighty lit les slots
du layout et les identifiants de stories depuis les `CompiledScene` déjà
préparées ; `owner.prepare()` fournit les ressources et CSS des paquets enfants.
La forme auteur utilisée en mémoire reste inchangée et
`runtime.initialize()` demeure le seul appel qui crée les occurrences.

**Travail accepté et exécuté :** adapter le packaging Sighty et le chargement
des paquets pour consommer les seules scènes compilées, sans modifier le
runtime CodPlay ni créer un circuit d’export Elcé parallèle. Les tests
contrôlent le contenu livré, l’absence de `SceneDoc` et de factory dans
`scenario.mjs`, les références `onReset`, les slots et stories lus depuis le
compilé, l’absence d’occurrence avant `runtime.initialize()` et le parcours
après initialisation.

### Résultat de l’audit des captures — 2026-10-21

Le compact sépare les valeurs dynamiques de leurs callbacks : la configuration
du scénario issue du document va dans `scenario.data`, les paramètres propres
à une scène vont dans son état compilé, et les constantes stables restent des
imports de projet. Les handlers et fonctions de scène sont top-level dans les
groupes auteur désignés par `scenarioFunctions` et `sceneFunctions`.

`onTestStateChange` sert uniquement à la persistance de la preview : l’export
construit le scénario sans cette option, donc ses closures ne sont pas livrées.
Les actions exportées conservent les effets prévus par Sighty, tels que la mise
à jour du contexte et l’envoi d’événements. Les actions Demo 5 observent leur
contexte d’appel ; l’hôte consomme les événements par `runtime.events`.

Les tests des actions et fonctions de scène vérifient les paramètres d’appel
et leur comportement. Le chemin compact ne reconstruit aucune fonction par
`Function.toString()` ou `eval`.

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
- [x] Terminer l’optimisation des exporteurs selon la tranche compacte ; le
  résultat Sighty/Elcé et les validations Demo 5 sont consignés ci-dessous.

Acceptance du profil compact :

- [x] Le namespace auteur `sceneFunctions` est l’opt-in compact ; les valeurs
  dynamiques viennent des paramètres d’appel et les constantes de projet sont
  des imports. Le bundler ne prétend pas détecter arbitrairement les captures.
- [x] Produire uniquement les callbacks atteignables depuis le compilé et le
  scénario, avec leurs imports auteur nécessaires.
- [x] Garder les données de scène dans l’état d’exécution et les valeurs
  variables dans les paramètres d’appel ; conserver les constantes projet
  comme imports.
- [x] Vérifier que le scénario compact ne livre ni document Elcé, ni `SceneDoc`,
  ni constructeurs auteur ; vérifier que chaque paquet contient son
  `CompiledScene` dans `scene/scene.json`.
- [x] Vérifier par identité les callbacks requis et le retrait des exports
  inutilisés, du constructeur et des dépendances auteur inutilisées.
- [x] Vérifier sur Demo 5 le loader distribué, la préparation sans occurrence,
  l’initialisation explicite, la navigation et le quiz dans Safari.
- [x] Comparer l’export `Projet-1.sighty-2` fourni avec l’export compact sur le
  même document et les mêmes médias ; distinguer octets bruts, gzip et ZIP.
- [x] Exécuter les tests export CodPlay, la suite Sighty et les validations
  Elcé ciblées et complètes, avec typechecks et build.

Hors de cette acceptance : une API runtime de remplacement/rechargement de
scène. Les paquets restent indépendants pour faciliter cette évolution, mais
cette API n’est pas introduite ici. La séparation des ressources distantes et
communes à l’engine reste une décision ouverte consignée plus haut.

### Résultat compact Elcé — export de référence fourni

La comparaison réutilise le document du ZIP non optimisé
`/Users/Rve/Downloads/Projet-1.sighty-2` et reconstruit les octets médias depuis
ses paquets scène. Le paquet compact contient toujours une scène CodPlay V1
autonome par scène directe, avec son `CompiledScene` dans
`scene/scene.json`.

| Contenu comparé | Ancien export | Export compact | Réduction |
|---|---:|---:|---:|
| Quatre `functions.mjs`, brut | 864 232 octets | 42 748 octets | 95,05 % |
| Quatre `functions.mjs`, gzip niveau 9 par fichier | 244 438 octets | 13 588 octets | 94,44 % |
| `scenario.mjs`, brut | 421 067 octets | 71 121 octets | 83,11 % |
| ZIP Elcé autonome compact | — | 323 199 octets | — |

Le ZIP compact n’a pas de mesure ZIP ancienne comparable dans cette exécution.

Les validations réalisées sont : 59 tests Sighty et typecheck ; 15 tests du
CLI export CodPlay et typecheck ; 81 tests Elcé ciblés, typecheck et build ;
385 tests Elcé au total réussis sur l’exécution complète et le rerun autorisé
du fichier qui ouvre un serveur local. Ce fichier a été relancé séparément
après que l’environnement sandbox a refusé son `listen` local pendant le run
complet.

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

**Corrections vérifiées dans les workspaces :**

- Le CLI Sighty importe les outils CodPlay par les sous-chemins déclarés du
  package `codplay`.
- L’adaptateur Elcé résout le CLI Sighty par son entrée de package et exécute
  depuis le répertoire de travail appelant, sans calcul de chemin vers le
  monorepo.
- Les manifests exportent les sous-chemins utilisés par ces deux outils.
  Dépendances, versions compatibles, déclarations de publication et choix de
  `private` restent à la préparation npm.

**Travail source exécuté dans la tranche actuelle :** exposer les seuls
sous-chemins nécessaires, résoudre CodPlay et Sighty par leurs specifiers de
package et supprimer les calculs de chemins vers le monorepo dans l’adaptateur
Elcé. Les exports et tests ont été vérifiés dans les workspaces présents.
Conformément à la décision utilisateur, aucun package n’a été installé depuis
un registre, préparé pour publication ou publié.

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
- [x] Revalider les 59 tests Sighty, les tests d’export Elcé ciblés, les
  typechecks Sighty/Elcé et `git diff --check` pendant la tranche compacte.
- [ ] Préparer les manifests à l’installation depuis un registre : dépendances
  nécessaires en production, versions compatibles et choix de `private`.
- [ ] Après préparation et autorisation de diffusion, installer les artefacts
  de registre dans un projet externe et exercer le parcours complet.

Aucune installation depuis le registre ni publication npm n’a été faite. Le
package CodPlay reste `private` et ses versions ne sont pas sélectionnées pour
publication ; le parcours d’installation externe reste non vérifié.
