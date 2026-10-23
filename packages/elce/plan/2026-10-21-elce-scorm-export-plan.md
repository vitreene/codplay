# SCORM pour Sighty — intégration Elcé

**Statut : En cours — portée et isolation du dossier SCORM validées par
l’utilisateur ; réalisation autorisée. Le noyau SCORM doit être réutilisable par
Elcé et d’autres projets basés sur Sighty. L’export autonome Sighty est
maintenant livré et spécifié ; l’assemblage SCORM dédié le consomme sans
reconfigurer l’export simple. Le mode multi-SCO `monoSco=false` produit
maintenant un manifeste et un lanceur par chapitre pour SCORM 1.2, 2004v3 et
2004v4 ; le runtime garde chaque parcours dans son chapitre. Le document Demo5
est enregistré comme projet distinct dans le catalogue Elcé. Une première
ouverture a déclenché une boucle de rendu dans `ProjectApplication` et laissé
le document en lecture seule. Après les filtrages de souscription, la page
observée dans le navigateur est éditable et sans erreur de console ; l’ouverture
à froid et l’attente d’un verrou concurrent restent à valider. Les packages
générés ne sont pas encore validés dans un LMS qui conserve les écritures CMI.**

Ce plan suit le noyau SCORM partageable, son intégration à Elcé et les paquets
SCORM produits par Elcé. L’assemblage local mono-SCO et multi-SCO à partir de
l’export Sighty existant est implémenté pour les trois éditions. La génération,
les fichiers de lancement, le manifeste et les XSD des trois packages
multi-SCO Demo5 sont vérifiés hors LMS. La reprise et les résultats dans un LMS
qui conserve les données, l’ouverture éditable du projet Demo5, la distribution
du package partagé hors du monorepo et les branches de sommaire non validées
restent à vérifier ou réconcilier. La
session et le runtime d’un package Elcé sont décrits dans la
[spécification SCORM](../specs/scorm-session-spec.md), l’assemblage générique
dans la [spécification du package partagé](../../sighty-scorm/specs/scorm-package-assembler-spec.md).
La preview auteur locale et réseau reste hors de ce circuit. Le format de
l’entrée Sighty est décrit dans la
[spécification d’export Sighty](../specs/sighty-export-spec.md).

`packages/sighty-scorm/` désigne le package compagnon qui apporte SCORM aux
contenus exécutés avec Sighty. C’est un package distinct du runtime Sighty et
réutilisable par les projets basés sur Sighty ; ce n’est ni un sous-module de
Sighty ni une couche spécifique à Elcé. Elcé en est un consommateur : son
adaptateur traduit les modèles métier, et les actions de page Sighty sont les
points d’appel. À l’export, le package SCORM assemble le contenu fourni par le
projet en un package LMS ; à la lecture, `ScormSession` communique avec l’API du
LMS. Ces deux parcours sont séparés.

## Portée retenue

- Reprendre toutes les versions proposées par la CLI de référence : SCORM 1.2,
  SCORM 2004 3e édition et SCORM 2004 4e édition. `2004v4` reste la valeur par
  défaut. Les deux éditions 2004 sont des choix d’export à part entière.
- Régler version et options au moment de l’export avec des paramètres
  facultatifs issus d’un ensemble prédéfini. Le lecteur exporté ne demande pas
  ces choix à l’apprenant.
- Prendre la CLI de référence comme inventaire, puis transposer ses options
  selon leur rôle dans Elcé. Le titre proviendra d’une propriété Elcé à définir ;
  les options de sommaire régleront l’exposition par défaut de son accès, que le
  LMS hôte pourra aussi gérer. `licenseClient` n’est pas repris. `client` et
  `packageName` restent des paramètres facultatifs conservés pour la
  compatibilité CLI ; l’interface Elcé applique la convention de nom de
  téléchargement décrite dans la
  [spécification d’export SCORM](../specs/scorm-export-spec.md).
  `summaryToLoad` est ignoré pour l’instant. `language` est réservé à une
  évolution multilingue, avec `fr` comme défaut actuel. `monoSco` reste
  l’unique option de découpage ; aucun paramètre concurrent de nombre de SCO
  n’est ajouté. `absolutePath`, absent par défaut, conserve le mode distant de
  la CLI de référence : les lanceurs ciblent l’hébergement configuré et les
  fichiers `dist` ne sont pas embarqués dans ce mode.
- Garder la même bibliothèque d’accès SCORM que le projet de référence :
  Pipwerks SCORM API Wrapper. Reprendre la provenance, la version et la licence
  du fichier effectivement utilisé avant de l’intégrer au paquet.
- Produire un package SCORM complet en reprenant la chaîne d’assemblage du
  générateur de référence : manifeste à la racine, lanceur HTML pour chaque SCO,
  fichiers applicatifs et ressources nécessaires, définitions de schéma propres
  à l’édition choisie, puis ZIP contenant directement cette racine si `--zip`
  est activé. `--zip` contrôle effectivement la création de l’archive et vaut
  vrai par défaut. `--absolutePath`, lorsqu’il est fourni, produit comme dans la
  CLI de référence des lanceurs distants sans embarquer les fichiers `dist` ;
  sans cette option, le package local complet est assemblé.
- Regrouper tous les appels Pipwerks dans une seule classe métier du noyau SCORM
  partageable. Les intégrations de projet lui transmettent leur état et leurs
  résultats ; elles ne contactent pas directement l’API SCORM.
- Reprendre au niveau de la page, les pages terminées, les réponses, l’état des
  tentatives et les valeurs de profil nécessaires pour reconstruire le même
  parcours. Le signet ne mémorise ni la position de défilement, ni le temps des
  médias.
- Sighty garde la navigation et l’admission des événements. Les actions Sighty
  liées aux changements admis appellent l’adaptateur Elcé, qui transmet l’état
  d’Évaluation au noyau métier SCORM partagé. Les scènes ne connaissent pas
  SCORM. Aucun changement du cœur CodPlay n’est inclus.
- La parité des interactions de Question avec le comportement effectif du
  projet de référence est une exigence prioritaire. Les réponses hors chapitre
  d’Évaluation sont écrites immédiatement ; celles d’un chapitre d’Évaluation
  sont conservées puis écrites à la fin du chapitre. Le projet de référence
  n’écrit ces interactions qu’en SCORM 2004. Elcé transmet l’identifiant, le
  type, la description, les réponses attendue et apprenant, l’horodatage, la
  latence, la pondération effectivement écrite et le résultat. Le temps logique
  `timeMs` de la scène Question passe par l’événement public Sighty existant et
  reste conservé par réponse dans l’état d’Évaluation repris par `suspend_data`
  en 2004. En 1.2, l’adaptateur retire ces seules métadonnées d’interaction du
  `suspend_data`, en conservant réponses et tentatives. Aucun compteur parallèle
  n’est ajouté.
- Les sources du noyau partageable sont regroupées dans un package dédié
  `packages/sighty-scorm/` : classe métier qui appelle Pipwerks, wrapper,
  modèles génériques, CLI, assembleur, schémas et ressources de génération.
  `packages/elce/src/scorm/` ne garde que l’adaptation des états et évaluations
  Elcé et son raccord au lecteur Sighty. Le package partagé expose son point
  d’entrée pour les autres projets basés sur Sighty ; son mode de distribution
  hors du monorepo reste à définir avant publication. Le package produit est
  écrit dans son dossier de sortie configuré.
- La commande `package-scorm` est une option de génération distincte de
  l’export existant. Elle produit son propre dossier de package SCORM, avec son
  arborescence normative, et ne modifie ni la commande, ni les options, ni la
  destination de l’export existant.
- L’assemblage SCORM consomme le paquet autonome `.sighty.zip` produit par
  l’export Elcé existant, selon le contrat de sa spécification. Il utilise cet
  artefact comme entrée de son propre package et ne reconfigure ni le format, ni
  les options, ni la CLI, ni la destination de l’export simple.

## Frontière du noyau partageable

- Le noyau SCORM ne dépend pas de modèles Elcé comme `ProjectTestState` ou
  `EvaluationMachineState`. Le package partagé possède l’unique classe qui
  appelle Pipwerks, les types de version, le rendu générique du manifeste, les
  ressources de schéma et l’assembleur Node générique. L’assembleur reçoit le
  paquet Sighty et les fichiers de runtime préparés par son projet appelant.
- Elcé garde son adaptateur de données, sa réconciliation avec le document, son
  calcul d’évaluation et les actions de page qui transmettent les états admis.
  Un autre projet Sighty fournit son propre raccord applicatif sans modifier le
  noyau ni dupliquer le circuit Pipwerks.
- L’application fournit au package partagé le contenu exportable, le titre et
  les choix propres à son projet. Le noyau conserve les règles SCORM et les
  options de génération communes ; il ne lit pas le modèle auteur Elcé.
- L’export autonome Sighty est implémenté et son format est décrit dans la
  [spécification Elcé](../specs/sighty-export-spec.md) et la
  [spécification Sighty](../../sighty/specs/authoring-library-spec.md#paquet-de-diffusion).
  Le package SCORM consomme cet artefact existant ; il ne définit pas de
  projection parallèle du scénario.
- L’assembleur générique est vérifié indépendamment des modèles Elcé. Le
  runtime SCORM du paquet est ensuite exercé avec les métadonnées Sighty Elcé et
  un faux LMS. L’installation du package dans un dépôt extérieur au monorepo
  reste une preuve d’acceptation à produire après définition de son mode de
  distribution.

## Circuit de référence observé

La CLI de référence consomme les options suivantes. Le tableau distingue son
comportement de la transposition décidée pour Elcé ; les options non retenues
pour l’instant restent visibles afin de ne pas les confondre avec une
fonctionnalité Elcé.

| Option source | Défaut ou comportement de référence | Décision de transposition Elcé |
| --- | --- |
| `--version` | `2004v4` ; valeurs : `1.2`, `2004v3`, `2004v4`, avec alias `2004.3`, `2004 3rd Edition`, `2004.4` et `2004 4th Edition`. Elles choisissent les arbres `scorm12edition`, `scorm20043rdedition` et `scorm20044thedition`. | Reprendre les trois versions et les alias source ; défaut `2004v4`. |
| `--title` | Titre `titleApp` extrait de `content/xml/lang/fr.xml`. | Le titre exporté proviendra d’une propriété Elcé à définir ; cette propriété est à venir. |
| Option source `needSummary` | Faux ; implique l’inclusion du sommaire. Quand `monoSco` est faux, retire les chapitres d’évaluation comme SCO séparés et les fournit au sommaire pour la sélection de chapitre. | `false` masque par défaut l’accès au sommaire ; `true` l’affiche. Le LMS hôte peut gérer cet accès à la place du lecteur. Le choix utilise les réglages [`data.summary`](../specs/summary-profile-spec.md) existants. |
| Option source `withSummary` | Faux ; ajoute l’entrée de sommaire et règle les objectifs et visibilités des SCO. | `false` n’ajoute pas de SCO sommaire ; `true` inclut le sommaire exporté. L’accès du lecteur suit l’option `needSummary` ou la gestion du LMS hôte. |
| `--monoSco` | Faux ; la version 1.2 avec sommaire force ce mode. Seul, sans option de sommaire, il déclenche un package par SCO. | Reprendre les branches source : défaut faux, package multi-SCO ; vrai sans sommaire, un package par SCO ; sommaire en 1.2, SCO unique de sommaire forcé. En 2004, conserver les branches sommaire et mono-SCO de la source. |
| `--masteryScore` | `80` ; appliqué aux SCO d’évaluation et à l’entrée de sommaire. La valeur zéro retombe sur 80 (`argv.masteryScore || 80`). | Direction acceptée et implémentée : en lecture SCORM, une valeur LMS non nulle prévaut sur le seuil auteur (`cmi.scaled_passing_score` en 2004, `cmi.student_data.mastery_score` en 1.2), comme dans Shell. Si le LMS ne fournit pas de seuil utilisable, garder le seuil auteur ; s’il manque, appliquer l’option d’export, défaut 80. La preview reste gouvernée par le seuil auteur. Tests unitaires et d’intégration avec faux LMS passants ; validation LMS réelle restante. |
| `--licenseClient` | Absent ; lorsqu’il est fourni, renseigne `dataFromLMS` sous la forme `<valeur>||<titre du SCO>` ou `||accueil`. | Non repris : Elcé ne possède pas ce dispositif de licence distante par clé d’accès. |
| `--client` | `standard` ; participe au nom de package et à la configuration du lanceur. | Paramètre CLI facultatif conservé pour la compatibilité avec la référence ; non exposé dans l’interface Elcé. |
| `--language` | `fr` ; sélectionne la configuration de langue, filtre les ressources localisées et participe au nom de package. | Réservé à l’évolution multilingue d’Elcé ; défaut actuel `fr`, sans autre langue à prendre en charge maintenant. |
| `--packageName` | Valeur explicite si fournie ; sinon `<client>_<slugify(title)>[_<language>]_scorm<cleanAndTrim(version)>`. Détermine le nom du dossier et du ZIP. | Paramètre CLI facultatif conservé ; le nom téléchargé depuis l’interface suit la convention Elcé dédiée. |
| `--absolutePath` | Absent ; lorsqu’il est fourni, ajoute une barre oblique finale et produit un lanceur distant sans copier les fichiers `dist`. | Reprendre ce comportement : absent, le package local complet est assemblé ; fourni, la valeur sert de base aux lanceurs distants et les fichiers `dist` ne sont pas copiés. |
| `--zip` | Commentaire source : défaut vrai. Le code actuel fait `argv.zip || true`, donc force vrai même pour une valeur fausse. | Contrôle réellement la création de l’archive ; défaut vrai. Une valeur fausse laisse le dossier du package sans créer le ZIP, conformément à la clarification Elcé. |
| `--summaryToLoad` | Absent ; chemin d’un sommaire XML dans `dist`, utilisé pour sélectionner les chapitres à exporter. | Ignoré pour l’instant. |

Le paramètre de version et les réglages de package sont résolus à l’assemblage,
tandis que la classe métier de runtime lit et écrit les données de l’apprenant
via Pipwerks.

Le découpage Elcé suit ces branches de la CLI : sans sommaire, `monoSco=false`
produit un package multi-SCO et `monoSco=true` produit un package par SCO ; avec
un sommaire en 1.2, le générateur force le SCO sommaire unique. En 2004, le mode
sommaire conserve les branches de manifeste et de visibilité de la référence.
Les accès au sommaire suivent le réglage par défaut retenu dans Elcé ou la
gestion du LMS hôte.

Forme de commande proposée, avec les mêmes options et conventions que la
référence ; les valeurs montrées sont un exemple :

```sh
npm run package-scorm -- --version=2004v4 --monoSco --title="Formation"
```

La classe de référence lit le signet et l’état suspendu au lancement, écrit le
signet et les résultats pendant la consultation, puis sauvegarde et termine la
session à la sortie. Elle envoie les interactions d’une évaluation à la fin du
chapitre. Elle ne restaure que l’identifiant et le résultat des interactions ;
Elcé doit conserver ses réponses choisies et ses tentatives dans l’état
suspendu pour satisfaire la reprise retenue ici.

## Emplacements d’appel SCORM dans Elcé

Dans la référence, l’initialisation du parcours crée le gestionnaire SCORM et
lit la position avant de choisir la route initiale ;
`src/scorm/ScormManager.js` centralise l’accès Pipwerks. `src/views/Lesson.js`
écrit la position, la progression et les résultats, `src/views/SelectParcours.js`
enregistre le profil dans l’état suspendu, `src/struct/Chapter.js` restaure et
transmet les interactions d’évaluation, et `src/index.js` termine la session à
la fermeture. Elcé reprend ces moments avec les actions déjà déclarées par son
scénario Sighty et un adaptateur de projet dans
`packages/elce/src/scorm/`. Celui-ci transmet les états Elcé au noyau partagé
`packages/sighty-scorm/`, qui possède l’unique classe appelant Pipwerks. Le
runtime Elcé de lecture assure l’ouverture et la fermeture de sa session ; la
CLI et l’assembleur du package partagé ne démarrent pas ce runtime et n’ouvrent
pas de session LMS. La CLI fabrique le package, tandis que le runtime du SCO
démarre une session LMS lors de la lecture.

Les points d’appel sont les suivants :

1. **Au lancement du SCO, ouverture et restauration avant Sighty.** Quand le
   LMS lance un SCO déjà produit, son lanceur HTML démarre le runtime Elcé
   `scorm-player-runtime.ts`. Celui-ci passe par l’adaptateur Elcé puis le
   noyau métier partagé pour ouvrir la session et lire l’état suspendu et le
   signet. Il fournit le
   `ProjectTestState` restauré et le `startPageId` à `ElcePlayerComposition`
   avant l’initialisation Sighty. Ce raccord appartient au démarrage du SCO,
   car la page de reprise doit être connue avant l’entrée dans le scénario. Ce
   démarrage est distinct de la commande CLI qui a généré le package. La preview
   n’instancie pas ce runtime et ne crée pas de session SCORM.
2. **Changement de page et signet.** Les actions de navigation Sighty
   (`NAVIGATION_NEXT`, `NAVIGATION_PREVIOUS` et sélection d’une page depuis le
   sommaire) s’exécutent après la transition admise. Leur handler lit la page
   active dans `scenarioState` puis appelle l’adaptateur Elcé pour enregistrer
   son identifiant par le noyau partagé. Les destinations sommaire, profil et page vide ne sont pas
   enregistrées comme pages courantes. Aucun listener parallèle de slot n’est
   nécessaire pour ce signet.
3. **Fin de page, réponses, progression et profil.** Les handlers existants
   `MARK_PAGE_FINISHED`, `RECORD_QUESTION_RESULT`, `SAVE_PROFILE_VALUES` et
   `SUBMIT_PROFILE` appellent l’adaptateur Elcé après avoir validé l’événement
   et mis à jour le contexte Sighty. L’adaptateur transmet l’état sérialisable
   complet issu du `ProjectTestState` au noyau partagé, incluant pages
   terminées, valeurs de profil, réponses et tentatives. Les écritures sont
   attendues dans les handlers afin de préserver leur ordre.
4. **Résultat et interactions de Question.** `RECORD_QUESTION_RESULT` reçoit
   `timeMs` par l’événement public CodPlay propagé par Sighty. Pour une question
   hors Évaluation, il appelle l’adaptateur Elcé qui transmet l’état de lecture
   et l’interaction immédiatement au noyau partagé. Dans une Évaluation, il
   conserve les métadonnées dans la réponse sérialisée ; `REFRESH_EVALUATION_RESULT`
   remet ensuite le chapitre, le score, le seuil et toutes ses interactions au
   noyau au moment de l’envoi du résultat. Cette séparation suit les deux
   chemins de la référence, sans appel SCORM dans les scènes. Les interactions
   CMI sont écrites uniquement en 2004v3/v4. En 1.2, le noyau écrit le résultat
   et le score ; les réponses et tentatives restent dans `suspend_data`.
5. **Fermeture du SCO.** `scorm-player-runtime.ts` passe par l’adaptateur Elcé
   depuis le cycle de destruction du player et le signal navigateur de fin de
   page. Le noyau partagé effectue la dernière sauvegarde, le commit et la
   terminaison une seule fois. La CLI de génération n’intervient pas dans cette fermeture.

La classe métier de `packages/sighty-scorm/` est l’unique module qui appelle
directement Pipwerks. L’adaptateur Elcé est fourni aux actions Sighty, qui
restent dans
`packages/elce/src/builders/scenario/scenario-builder.ts`.
`scorm-player-runtime.ts` transmet une instance de l’adaptateur à
`ElcePlayerComposition`, qui la fournit au builder de scénario pour ses
handlers ; les autres lecteurs ne la reçoivent pas. Les scènes continuent de
publier leurs événements métier existants, notamment la réponse à une Question ;
elles ne connaissent ni SCORM ni la classe métier. La preview construit le même
scénario sans fournir cette dépendance. Aucun listener externe ne duplique les
transitions de page, et aucun circuit d’événements parallèle n’est ajouté.

## Composition du package, calquée sur le générateur de référence

Le générateur de référence suit cette chaîne dans
`scripts/scoPackager.js`, `scripts/lib_scoPackager/buildPackage.js`,
`scripts/lib_scoPackager/schemas/scorm12.js`,
`scripts/lib_scoPackager/schemas/scorm2004.js` et
`public/template_scorm.html` :

1. Il choisit les définitions de schéma pour SCORM 1.2, SCORM 2004 3e édition ou
   SCORM 2004 4e édition.
2. Il prépare un dossier par package, ou plusieurs dossiers selon le mode de
   découpage retenu par la CLI.
3. En mode local, il copie `static`, les dossiers de contenu partagés et les
   ressources des pages retenues ; il filtre les variantes de langue quand une
   langue est sélectionnée.
4. Il copie récursivement dans le package l’arborescence de définitions de
   l’édition choisie : les fichiers XSD/DTD nécessaires et leurs sous-dossiers.
5. Il génère un lanceur HTML par SCO depuis le même template. Ce lanceur charge
   le runtime, le wrapper Pipwerks, les scripts et la feuille de style, avec la
   configuration de version, langue, contenu et SCO.
6. Il génère `imsmanifest.xml` avec le générateur correspondant à la version,
   puis peut archiver le contenu du dossier du package à la racine du ZIP.

Le package local Elcé devra donc avoir cette forme logique :

```text
<package>/
  imsmanifest.xml
  <lanceur-de-chaque-SCO>.html
  <XSD-et-DTD-de-l’édition-choisie à la racine>
  common/..., extend/..., unique/..., vocab/... (si présents)
  static/...
  content/<paquet-de-scène-CodPlay>/export-manifest.json
  content/<paquet-de-scène-CodPlay>/scene/scene.json
  content/<paquet-de-scène-CodPlay>/scene/assets/...
```

Chaque paquet de scène CodPlay est copié comme unité sous la racine de contenu
du SCO, afin de conserver ses chemins relatifs. Ces copies appartiennent à la
sortie SCORM ; le dossier de sortie de l’export simple reste indépendant et
intact.

Comme dans la référence, l’assemblage génère le ZIP avec `imsmanifest.xml` à
sa racine lorsque `--zip` est vrai. Dans le code source observé,
`argv.zip || true` neutralise la valeur fausse ; Elcé doit faire piloter la
création du ZIP par l’option, avec `true` comme défaut. Quand elle vaut faux, le
dossier complet du package reste disponible sans archive ZIP.

Le runtime chargé par le SCO regroupe Elcé, Sighty et CodPlay ainsi que leurs
dépendances front-end nécessaires ; le wrapper Pipwerks chargé par le lanceur
reste celui déjà utilisé par la référence. La génération SCORM prend le paquet
Sighty autonome existant comme entrée, en conserve les paquets de scènes
CodPlay et les ressources avec leurs chemins relatifs. Elle n’effectue pas un
second scan ou une seconde compilation des scènes et n’écrit pas dans la sortie
de l’export existant.

### Entrée de génération : export Sighty existant

L’export Elcé produit déjà le paquet Sighty autonome décrit dans la
[spécification d’export Sighty](../specs/sighty-export-spec.md) : loader,
runtime, `scenario.mjs` et paquets de scènes CodPlay. La commande SCORM devra
consommer cette sortie comme entrée de génération, puis produire son dossier et
son archive SCORM distincts. Elle ne doit pas rappeler un sérialiseur parallèle
ni modifier l’export simple.

Le loader Sighty permet à l’application hôte de fournir le contexte runtime.
Elcé y injecte l’adaptateur sous la clé
`ELCE_SCORM_PROGRESS_SINK_CONTEXT_KEY` ; les actions de page exportées lisent
ce service optionnel. La preview et l’export Sighty simple ne fournissent pas
l’adaptateur et n’ouvrent aucune session LMS. Le lanceur du SCO devra charger
le paquet Sighty existant et injecter l’adaptateur dans ce contexte avant
`runtime.initialize()`.

Le runtime SCORM source actuel reçoit un `ElceDocument` et en dérive les
identifiants de chapitres d’évaluation et les pages de chaque chapitre. Le SCO
exporté ne contient pas ce document auteur ; le lanceur SCORM devra obtenir ces
identifiants depuis les données d’exécution Elcé conservées dans le scénario
Sighty compact, puis réconcilier l’état suspendu avec les pages du paquet. Cette
extraction et sa validation font partie de l’assembleur et du runtime du SCO ;
elles ne changent pas le contrat ni le circuit d’export Sighty.

Le générateur copie toutes les définitions de schéma de l’édition, pas une
sélection manuelle de quelques XSD. En SCORM 2004, le manifeste doit être à la
racine, être bien formé et valider contre les schémas de Content Packaging et
les extensions SCORM/Sequencing qu’il utilise ; les schémas de support requis
par le manifeste accompagnent le package. L’archive ZIP doit elle aussi
présenter `imsmanifest.xml` à sa racine. Ces critères seront vérifiés pour 1.2,
2004 3e édition et 2004 4e édition, puis complétés par l’import et l’exécution
dans un LMS.

## Propriétaires et raccords

| Besoin | Propriétaire |
| --- | --- |
| Réponses, tentatives et calcul du résultat | [Machine d’Évaluation Elcé](../specs/evaluation-machine-spec.md) et types `EvaluationMachineState` |
| Progression, signet et valeurs du lecteur | Modèle d’état Elcé et événements Sighty du [builder de scénario](../src/builders/scenario/scenario-builder.ts) |
| Appels API SCORM | Classe métier du noyau `packages/sighty-scorm/`, seule à appeler Pipwerks ; adaptateur Elcé et actions Sighty comme points d’appel métier |
| Raccord au runtime Sighty | Adaptateur Elcé et actions de navigation/page pour les états admis ; runtime du SCO pour ouverture, restauration et fermeture |
| Session LMS, schémas et rendu générique du manifeste | Package partagé `packages/sighty-scorm/` ; il contient la classe de session, le wrapper, les types neutres, les schémas et le renderer |
| CLI et génération complète du paquet | À compléter dans le circuit SCORM dédié, sans intervenir dans l’export simple |
| Entrée du package SCORM | Paquet autonome `.sighty.zip` de l’export Elcé existant, consommé selon sa spécification sans exporteur parallèle ni reconfiguration |

L’état serveur utilisé par la popup auteur reste séparé du transport SCORM.
`ProjectTestStateSession` et le cycle de vie de `PopupPlayer` ne sont pas des
points d’intégration SCORM. Le lecteur dans le paquet exporté reçoit une
instance de l’adaptateur Elcé au démarrage du SCO, via le contexte runtime
Sighty. Celui-ci ouvre la classe métier partagée et traduit son état suspendu ;
le runtime fournit l’état restauré à Sighty, tandis que les actions de page
reçoivent uniquement l’interface de l’adaptateur.

## État actuel de l’implémentation

- Le package `packages/sighty-scorm/` expose le noyau partageable :
  `ScormSession` est l’unique appelant Pipwerks, et le package contient les
  types génériques, le wrapper v1.1.7, les schémas, le renderer de manifeste et
  `assembleScormPackage()`. L’assembleur préserve les fichiers du paquet
  Sighty en mode local, ajoute le manifeste, les schémas, le wrapper et les
  fichiers fournis par le projet, puis produit le ZIP optionnel. Il ne dépend
  pas des modèles Elcé. L’adaptateur
  `packages/elce/src/scorm/elce-scorm-adapter.ts` conserve le codec, la
  réconciliation et le mapping du domaine Elcé. Le parseur d’options reprend
  les options source retenues.
- Les actions Sighty exportables lisent l’adaptateur Elcé optionnel dans le
  contexte runtime, puis sauvegardent le signet après navigation admise et l’état
  complet après progression, réponses et profil via l’adaptateur Elcé. Celui-ci
  traduit les résultats d’évaluation et interactions validées vers la classe
  métier partagée. Le runtime ouvre la session
  et réconcilie l’état avant d’initialiser le player. Le runtime transmet aussi
  le choix `monoSco` et les identifiants de chapitres Évaluation pour produire
  les objectifs 2004 et l’agrégation des résultats comme dans la référence.
- La commande `npm run package-scorm --workspace=@codplay/elce -- <parcours.sighty.zip> [options]`
  consomme l’export Sighty sans le reconstruire. Elle crée le runtime Elcé du
  SCO, le lanceur, le dossier dédié `-=scorm_packages=-` et, par défaut, le ZIP
  à manifeste racine. Pour l’archive Demo5 de test, les modes mono-SCO avec
  sommaire produisent un paquet vérifié pour 1.2, 2004v3 et 2004v4. `--zip=false`
  garde le dossier sans ZIP. Le lanceur initialise la session LMS, restaure
  l’état avant l’affichage et utilise le loader Sighty existant.
- Le paquet Sighty actuel décrit le scénario Elcé complet. La branche
  `monoSco=false` ajoute un lanceur par chapitre et transmet son `chapterId` au
  runtime, sans projeter ni reconstruire le scénario Sighty. Le manifeste
  2004v4 `withSummary=true` sans mono-SCO conserve la divergence XSD déjà
  relevée ; cette branche reste refusée jusqu’à réconciliation.
- Aucun changement n’a été apporté à la commande ou à la destination de l’export
  existant.

### Export SCORM depuis l’interface — décision acceptée

- Le bouton « Exporter » ouvre une modale qui garde deux actions distinctes :
  « Exporter le scénario » conserve l’export existant ; « Exporter en SCORM »
  lance le paquetage SCORM. Le libellé du scénario ne révèle pas le nom de sa
  bibliothèque d’exécution. Les actions ont le même style, occupent la largeur
  de leur libellé et sont centrées ; la fermeture utilise une icône croix.
- L’action SCORM expose exactement SCORM 1.2 ou SCORM 2004 (4e édition), et une
  seule case `monoSCO` décochée par défaut. Le défaut de génération reste celui
  de la CLI de référence. Le choix `monoSco` conserve ses branches source ; si
  celles-ci produisent plusieurs packages, l’archive téléchargée les regroupe
  comme fichiers ZIP séparés à extraire avant l’import LMS.
- Le parcours SCORM appelle d’abord l’export Sighty existant et transmet son
  ZIP à une route API distincte qui invoque le générateur SCORM existant. Il ne
  modifie ni la route ni le téléchargement simple du scénario.
- Pour chaque SCO de chapitre, le titre visible dans le manifeste et celui de
  l’onglet du lanceur reprennent le nom auteur du chapitre (`chapter.name`).
  L’identifiant technique (`chapter.id`) reste utilisé pour les chemins,
  références et identifiants stables du manifeste. Le nom auteur est donc
  conservé dans les métadonnées runtime compactes du scénario Sighty.
  Implémenté et vérifié le 22 octobre : le test du générateur inspecte le
  manifeste et le lanceur d’un package réel, et les tests de scénario vérifient
  la conservation de `name`.
- Le nom de base téléchargé suit exactement
  `[nom]-scorm[-monosco]-[YYYY-MM-DD]([version]).zip`. `monosco` apparaît
  seulement si l’option est cochée ; l’édition SCORM reste entre parenthèses.
  Le client reprend le nom reçu dans `X-Elce-Scorm-Filename`. Les suffixes
  `(1)`, `(2)` ajoutés en cas de collision sont ceux du navigateur et ne font
  pas partie du nom construit par l’API. Les noms internes des packages
  générés par la CLI restent inchangés.
- Pendant la génération Sighty et l’assemblage SCORM, l’éditeur reste en mode
  écriture. Chaque export part du snapshot document/médias capturé à son
  démarrage ; les commandes auteur ultérieures restent dans l’acteur actif et
  suivent la synchronisation habituelle. L’export n’écrit pas dans la base du
  projet, donc aucune suspension dédiée de la synchronisation n’est requise.
- Vérifié : options et libellés de la modale dans Brave ; l’export simple
  conserve sa route et son action ; les tests ciblés de l’interface, du client
  et du contrôleur API passent ; typecheck et build passent. Le test de
  `ProjectApplication` maintient chacun des deux traitements d’export en
  attente, modifie le scénario par une commande d’interface et vérifie que
  l’éditeur reste actif tandis que le snapshot exporté ne change pas.
- Vérifié le 22 octobre : l’API ancienne sur `127.0.0.1:5181` répondait `404`
  à `POST /api/exports/scorm`. Après son redémarrage avec le code courant,
  l’interface a produit l’export Sighty (`200`), puis l’export SCORM 2004v4 avec
  `monoSCO` décoché (`200`, `application/zip`, un package). Un ZIP de
  validation construit depuis le Sighty de Demo5 passe `unzip -t` et contient
  `chapter-1.html`, `chapter-2.html` et `chapter-final.html`. L’import dans un
  LMS reste à vérifier.
- Vérifié le 22 octobre : le code source construit le nom sous la forme
  `[nom]-scorm[-monosco]-[YYYY-MM-DD]([version]).zip`, et le client exige
  l’en-tête `X-Elce-Scorm-Filename`. Une génération réelle a toutefois
  téléchargé `null.zip` : la réponse de l’instance locale n’exposait pas cet
  en-tête, contrairement au contrat testé. L’archive a été renommée
  `Demo-5-comparaison-Elce-scorm-2026-10-22(2004v4).zip`, passe `unzip -t` et
  contient les trois lanceurs de chapitre. Il reste à redémarrer ou reconstruire
  l’application/API locale puis à refaire un téléchargement depuis l’interface
  pour valider le nom réellement servi.
- Pour chaque nouvelle version importée dans le LMS à des fins de validation,
  renommer le premier titre de la première page avec un repère propre à cette
  version, puis confirmer visuellement ce repère dans le LMS avant les tests.

### Vérification du socle et du paquet de test

- Les typechecks Sighty, SCORM partagé et Elcé passent. Les suites Sighty et
  SCORM partagé passent, respectivement 60 tests sur 6 fichiers et 37 tests sur
  6 fichiers. Les tests Elcé ciblant l’adaptateur, les actions de scénario, les
  scènes Question et le player réel passent : 76 tests sur 4 fichiers. Le build
  Elcé passe avec l’avertissement de bundle JavaScript volumineux.
- `npm pack --dry-run --cache=/private/tmp/npm-cache-sighty-scorm` inclut le
  wrapper, les schémas, le renderer et l’assembleur (100 fichiers). La
  distribution et l’installation depuis un dépôt extérieur au monorepo ne sont
  pas encore vérifiées.
- Les trois arbres de schémas et le wrapper Pipwerks, désormais regroupés dans
  `packages/sighty-scorm/`, sont identiques aux fichiers correspondants de la
  référence (`diff -qr` et `cmp`).
- Les trois ZIP Demo5 mono-SCO passent `unzip -t`. Le contrôle de contenu
  confirme le manifeste à la racine, le runtime et le wrapper présents, et les
  71 entrées du paquet Sighty conservées avec leurs chemins et octets. Les ZIP
  multi-SCO régénérés le 21 octobre depuis le projet Demo5 courant passent aussi
  `unzip -t` ; le document contient trois chapitres et chaque édition contient
  trois lanceurs et trois ressources `sco`. Leurs manifestes 1.2,
  2004v3 et 2004v4 passent la validation XSD par schémas composites temporaires
  qui importent les namespaces déclarés.
  `xmllint` conserve son diagnostic de liaison du namespace XML réservé dans
  un XSD 1.2 source, sans invalider le résultat.
- Le test CLI `--zip=false` produit le dossier SCORM sans archive. Le test de
  scénario vérifie l’initialisation globale masquée, l’entrée dans le chapitre
  lancé, le refus des autres chapitres et les limites précédent/suivant. Le
  test du runtime vérifie l’injection de `chapterId` et la restauration filtrée.
- La suite complète Elcé compte 418 tests réussis et un échec sans lien SCORM :
  `sqlite-project-persistence.test.ts` reçoit `EPERM` en ouvrant son serveur
  local `127.0.0.1` dans cet environnement. L’import et le comportement des
  trois packages dans un LMS restent à tester.
- Divergence à résoudre avant l’assemblage de la branche SCORM 2004 4e édition
  `withSummary=true`, `monoSco=false` : le générateur de référence
  `scripts/lib_scoPackager/schemas/scorm2004.js` émet des éléments
  `adlseq:objectives` et `adlseq:objective`, absents de
  `packages/sighty-scorm/src/resources/schemas/scorm20044thedition/adlseq_v1p3.xsd`.
  La fixture correspondante échoue donc à la validation XSD (`No matching
  global element declaration`), tandis que les autres branches vérifiées
  passent. Reproduire à l’identique le générateur de référence pour cette
  branche et exiger simultanément sa validation par l’arbre XSD associé sont
  incompatibles en l’état. Aucun XSD copié ni manifeste source n’a été corrigé
  ou contourné.

## Étapes et critères d’acceptation

1. **Appliquer la transposition CLI définie — résolveur et parseur réalisés.** Le
   parseur et le résolveur couvrent les trois versions et
   leurs alias, avec `2004v4` par défaut. Appliquer les branches `monoSco` et les
   options de sommaire décrites dans le tableau. `--zip=false` est conservé
   correctement avec `true` par défaut. Ne pas ajouter `licenseClient` ni
   `summaryToLoad`; garder `fr` jusqu’à l’évolution multilingue. La commande
   est en place ; ses branches incompatibles avec le scénario Sighty complet
   sont décrites à l’étape 6.

2. **Fixer le modèle d’état exporté — réalisé pour le runtime.** L’état SCORM
   versionné conserve
   les identifiants de pages terminées, la page courante, le profil nécessaire
   aux gardes, les réponses et les machines d’Évaluation. Réutiliser
   `EvaluationMachineState` et `reconcileProjectTestState` là où leur contrat
   couvre le cas ; ne pas dupliquer le calcul des scores. Le dépassement des
   limites `suspend_data` est signalé, jamais tronqué.

3. **Isoler le noyau partageable et l’adaptateur Elcé — session, options, assemblage local et CLI réalisés ; distribution externe à définir.**
   `packages/sighty-scorm/` est un package public du monorepo. `ScormSession`
   centralise Pipwerks ; les schémas, le wrapper et le rendu générique de
   manifeste, le parseur CLI source-compatible et le résolveur d’options y sont
   regroupés. `packages/elce/src/scorm/` garde le codec et
   `ElceScormAdapter`, qui traduit `ProjectTestState` et
   `EvaluationMachineState`. Le package partagé ne dépend d’aucun type du
   domaine Elcé et ses tests sont autonomes. `assembleScormPackage()` et
   `package-scorm` sont dans le circuit dédié. Définir le mode de distribution
   hors du monorepo avant la preuve d’installation externe.

4. **Raccorder le runtime du SCO et les actions Sighty — lecture et navigation raccordées ; validation LMS restante.** Placer les appels
   aux emplacements décrits dans « Emplacements d’appel SCORM dans Elcé » :
   ouverture et restauration avant l’initialisation Sighty, signet depuis les
   actions de navigation après transition admise, progression/réponses/
   tentatives/résultats depuis les handlers Sighty après mise à jour de leur
   état, et fermeture depuis le cycle de vie du player du SCO. Attendre les
   écritures depuis les handlers. N’ajouter aucun listener de slot pour
   dupliquer le suivi du signet ; garder le runtime du SCO absent de la preview
   et ne placer aucun appel SCORM dans une scène. La CLI de génération reste un
   processus distinct qui produit le package sans démarrer la lecture. Le
   runtime prend aussi le réglage `monoSco` et les identifiants d’évaluation du
   document. Le lanceur généré transmet ces options et charge ce runtime avant
   d’initialiser Sighty. Respecter le cycle déjà employé par
   `ElcePlayerComposition.initialize()` : après `runtime.initialize()`, jouer
   `scene-layout`, envoyer `PRESENTATION_REFRESH`, puis seulement sélectionner
   une page de reprise. `runtime.initialize()` seul monte la composition mais
   ne joue pas les scènes actives ; il ne suffit donc pas à activer les
   événements et animations. Transmettre aussi au loader, par son option
   `codplay.htmlHost`, le `createScrollContainerSourceAdapter` déjà fourni par
   le player Elcé : il résout les observers de bas de page et les transitions
   qui dépendent du scrollport. Le lanceur doit aussi fournir au player un host
   `.elce-player-stage` borné au viewport du SCO : le Sighty ZIP ne contient
   pas le CSS de l’application auteur qui dimensionne ce host. En multi-SCO,
   transmettre au runtime la table `chapterId`/`ITEM-*` issue des identifiants
   conservés du manifeste pour activer les passages inter-chapitres.

### Écarts de lecture avec le projet de référence — 22 octobre 2026

L’exigence utilisateur est de reprendre à 100 % les fonctions communes du
projet de référence. L’inspection de `ScormManager`, `Lesson` et du package LMS
actif distingue les raccords désormais corrigés des écarts encore ouverts.

- **Passage entre SCO — raccordé, package LMS à mettre à jour.** « Suivant » en
  fin de chapitre et « Précédent » au début appellent maintenant l’action de
  page Sighty. L’adaptateur transmet l’`ITEM-*` stable du manifeste au noyau,
  qui demande le choix CMI, committe et termine le SCO. Les tests de scénario et
  de runtime contrôlent le routage et la conservation des identifiants. La page
  LMS inspectée le 22 octobre reste toutefois dans l’ancienne archive : son
  lanceur ne contient pas `chapterScoIdentifiers`. L’API LMS accepte la
  destination, mais cette version n’a pas la table nécessaire pour activer le
  bouton. Aucun fichier installé dans la LMS n’a été modifié dans cette
  correction.
- **Durée SCORM — raccordée aux horloges existantes.** L’adaptateur lit
  `telco.getProgress().timelineMs` sur l’instance persistante de `scene-layout`
  et transmet la valeur à `cmi.session_time` ou `cmi.core.session_time`. La
  telco publique n’expose pas `getCurrentTimeMs()` ; les tests précédents
  simulaient à tort cette méthode absente et ne reproduisaient donc pas le
  runtime exporté. Le test de fermeture utilise désormais la surface publique
  réelle et vérifie l’écriture de `session_time`. Aucun timer n’est ajouté.
  Cette durée de session reste indépendante de la latence `timeMs` de chaque
  Question.
- **Piste pour la suite — timer général CodPlay.** L’utilisateur signale qu’une
  fonction peut être accrochée à ce timer et que ce raccord pourrait aussi
  fournir le temps. Examiner cette possibilité pour une évolution de la mesure
  SCORM ; elle n’est pas implémentée et ne modifie pas le raccord courant tant
  que son contrat et son adéquation à la durée du SCO ne sont pas vérifiés.
- **Progression et complétion — alignées en tests.** Le 2004 multi-SCO rapporte
  la position 1-based de la page courante, pas le nombre de pages déjà finies ;
  il n’écrit le statut de complétion qu’au repère bas de la dernière page. En
  `monoSco`, l’avancement global compte les chapitres terminés et l’objectif du
  chapitre courant reçoit sa propre progression et complétion. En 1.2, aucun
  statut `incomplete` n’est écrit sur une simple page consultée ; le statut du
  chapitre est transmis à sa fin. Les tests vérifient aussi la page-question
  sans réponse et l’absence de mesure 2004 en 1.2.
- **Première révélation d’image — preuve LMS encore ouverte.** Le runtime livré
  dans la session contient l’émission initiale retenue jusqu’à `PLAYING`, et le
  scénario Elcé déclare l’entrée d’observation pour Cartes et Graphes. La page
  actuellement visible est déjà reprise au dernier écran : les images y sont
  opaques `1`, ce qui ne prouve pas leur animation d’entrée. Une nouvelle
  entrée depuis une page initiale doit encore montrer la transition dans la
  LMS.
- **Réception du seuil LMS — implémentée, validation LMS réelle restante.** La
  référence lit l’entrée, les statuts, le seuil LMS (`cmi.scaled_passing_score`
  en 2004 et `cmi.student_data.mastery_score` en 1.2), le nom et les objectifs.
  Elcé lit le mode, le signet, `suspend_data` et maintenant le seuil LMS ; ses
  tentatives sont restaurées depuis son état JSON. Par exigence utilisateur
  de parité, une valeur LMS non nulle remplace le seuil auteur pendant la
  lecture SCORM ; si elle manque, le seuil auteur reste appliqué. La preview
  conserve le seuil auteur. La classe métier SCORM lit et normalise la valeur, le service de
  progression existant la transmet à la machine d’Évaluation, et les résultats
  suspendus sont recalculés sans perdre les réponses ni les tentatives. Les
  tests du noyau partagé (24) et Elcé (67) passent ; vérifier ce résultat dans
  les éditions 1.2 et 2004 d’un LMS réel.
- **Autres lectures LMS à comparer.** Shell lit aussi le nom apprenant et les
  objectifs CMI. Le nom sert au jeton de contenu `$$studentName`, qui n’a pas
  d’équivalent auteur actuel dans Elcé. Les objectifs CMI servent à reconstruire
  l’état des chapitres dans Shell ; Elcé restaure progression, réponses et
  tentatives depuis `suspend_data`, sans fallback vers les objectifs LMS si cet
  état manque. Vérifier l’acceptation de ce cas de reprise par le contrat Elcé.
  `launch_data` reste lié au mécanisme de licence distant que l’utilisateur a
  déclaré absent d’Elcé.
- **Options CLI non paritaires encore connues.** La branche source
  `2004v4 + withSummary + !monoSco` est refusée car le XSD embarqué ne reconnaît
  pas les éléments émis par le générateur de référence ; `absolutePath` reste
  à valider sur son hébergement distant.

Les tests ciblés du noyau SCORM, de l’adaptateur, des actions et gardes Sighty
passent. L’acceptation d’ensemble reste En cours tant que le package à jour
n’a pas été importé et que la première animation n’a pas été vue dans une
nouvelle entrée LMS. La priorité du seuil LMS passe les tests avec faux LMS ;
sa confirmation dans un LMS réel reste requise.

   **Session LMS consultée le 22 octobre 2026, Demo5 2004v4 multi-SCO.** Le
   runtime du package contient déjà `runtime.play('scene-layout')`,
   `PRESENTATION_REFRESH` et l’adaptateur HTML du scroll-container. Le repère
   bas a marqué les quatre pages du chapitre comme terminées. Dans la session
   `/learner/session/4c1cae24-db12-4cd9-93df-a0d26584ffc9/course/106702/lesson/113550`,
   le LMS est en mode `normal` et `suspend_data` contient la réponse correcte
   au Quiz du chapitre 1, mais `cmi.completion_status` reste `incomplete` et
   `cmi.progress_measure` reste à `0`. La cause dans l’adaptateur est que le
   calcul de progression et de complétion n’était émis qu’en `monoSco`. Le
   runtime transmet maintenant les pages du chapitre lancé et ses pages
   Question : le 2004 écrit la fraction de pages complètes et son
   `completion_status`; le 1.2 écrit `cmi.core.lesson_status`, en conservant le
   résultat `passed`/`failed` d’un chapitre d’Évaluation. Une page n’est
   complète que si le repère bas a été vu et si une Question présente a reçu
   une réponse. Un test du runtime réel avec faux LMS confirme qu’un SCO de
   Quiz reste incomplet après le seul défilement puis devient terminé à
   l’enregistrement de la réponse, sans attendre les autres chapitres.
   L’import corrigé et le déverrouillage du chapitre suivant restent à valider
   dans la LMS.

   Les scènes du package contiennent les observations et actions de révélation
   des Cartes. Les racines de Carte et de Graphe ancré déclarent maintenant
   `initial: 'enter'`; leurs tests vérifient cette déclaration selon le contrat
   d’observation CodPlay. Après que l’utilisateur a rechargé la session, la
   page est revenue en lecture à la page 3/4. La vérification visuelle par
   défilement reste en attente ; l’auto-review avait refusé le clic de
   navigation susceptible d’écrire dans les données CMI.

5. **Produire résultats et interactions — comportement de référence implémenté et vérifié.**
   Le résultat et le score globaux sont écrits dans les trois éditions. En 1.2,
   réponses et tentatives restent dans `suspend_data` et aucune interaction CMI
   n’est écrite. En 2004v3/v4, les interactions hors Évaluation sont transmises
   dès la validation ; celles d’Évaluation à la fin du chapitre. Les deux
   chemins écrivent `id`, `type`, `description`,
   `correct_responses.0.pattern`, `learner_response`, `timestamp`, `latency`,
   `weighting` et `result`. L’identifiant suit `<pageId>_0`. Vrai/Faux utilise
   le type `true-false` et les libellés ; Choix et Choix multiple utilisent le
   type `choice` et les indices de réponses à partir de `1` dans l’ordre auteur.
   La description CMI reprend le texte de la Question et les propositions
   numérotées dans l’ordre auteur. Le relais Sighty transmet le temps de scène
   CodPlay existant ; une Question d’Évaluation jouée par le player réel vérifie
   qu’il avance et qu’il est
   conservé par réponse, sans ajouter de timer. Le noyau formate la latence en
   `PT<minutes>M<secondes>S`, arrondie vers le bas à la seconde, et la date au
   format de la référence. La pondération effectivement écrite est `0`. Les
   métadonnées des interactions d’Évaluation sont conservées dans l’état
   suspendu SCORM 2004 pour leur envoi après reprise. En 1.2, réponses et
   tentatives sont conservées mais ces métadonnées sont omises ; les états
   antérieurs restent décodables. Les tests Sighty, Elcé et du noyau partagé
   couvrent les chemins immédiat et différé, les formats CMI, la réponse reprise
   et l’absence d’interactions 1.2. L’interopérabilité des écritures dans un LMS qui persiste
   les valeurs reste à valider.

6. **Générer le manifeste et assembler le package — mono-SCO et multi-SCO générés ; validation LMS restante.**
   `assembleScormPackage()` consomme les octets du paquet Sighty existant,
   conserve ses fichiers en mode local, ajoute le runtime et le lanceur Elcé,
   le wrapper Pipwerks, tous les schémas de l’édition et le manifeste. La CLI
   `package-scorm` écrit son propre dossier et, si `--zip` est vrai, un ZIP dont
   `imsmanifest.xml` est à la racine. Les packages Demo5 de test vérifient cette
   chaîne pour SCORM 1.2, 2004v3 et 2004v4 avec sommaire et SCO unique.
   `--zip=false` a été exercé par la CLI et laisse le dossier complet sans
   archive. L’export Sighty simple reste inchangé. Les nouveaux packages Demo5
   mono-SCO et multi-SCO passent `unzip -t`.

   Les identifiants du manifeste sont maintenant fournis par le générateur Elcé
   au lieu d’être aléatoires : les nouveaux projets dérivent leur manifeste,
   leur organisation, leurs items et leurs ressources de l’identifiant stable
   du scénario et des identifiants de SCO. Les chapitres Demo5 déjà installés
   reprennent les UUID observés dans leur manifeste 2004v4 ; l’ajout d’un SCO
   n’altère pas les identifiants des chapitres existants. Les tests vérifient
   deux générations, l’ajout d’un chapitre et les valeurs installées. La CLI a
   assemblé un ZIP de fixture avec l’identité de scénario Demo5 : les trois
   chapitres, le manifeste et l’organisation correspondent aux UUID de la LMS.
   La nouvelle archive issue du document Demo5 et son import de mise à jour
   restent à vérifier dans la LMS.

   Le scénario Sighty complet reste l’entrée de l’assembleur. Pour reprendre la
   branche de référence `monoSco=false` sans reconfigurer l’export autonome,
   le package contient un lanceur par chapitre dans un même manifeste ; chaque
   lanceur transmet son `chapterId`. Le runtime Elcé conserve le scénario
   complet, mais ses gardes et actions de navigation Sighty limitent le SCO à
   `chapter.pageIds` : démarrage, reprise, sommaire de pages et transitions
   restent dans le chapitre lancé. Le scénario initialise d’abord sa page
   globale par défaut, conteneur masqué, puis le runtime sélectionne la première
   page du chapitre demandé avant d’afficher le player. Chaque SCO conserve
   ainsi son propre état LMS, selon l’isolation SCORM du LMS. Les chapitres
   d’évaluation gardent leurs actions et interactions CMI dans leur SCO. Le
   mode `monoSco=true` garde le parcours complet. Les lanceurs, ressources du
   manifeste, limites de navigation, restauration filtrée et trois éditions
   sont vérifiés par tests, XSD et inspection des ZIP. La reprise et les
   résultats séparés restent à valider dans un LMS réel.

   La branche
   2004v4 avec sommaire et SCO séparés garde la divergence de schéma source
   consignée ci-dessus. En mode
   `--absolutePath`, le lanceur référence l’hébergement fourni mais son
   chargement depuis cet hébergement reste à vérifier.

   La route locale 2J ouvre le cours en mode `browse` avec une API simplifiée
   qui n’enregistre pas les écritures ; elle ne valide donc pas la reprise, la
   progression ni la remontée des évaluations. Le projet distinct « Démo 5 —
   comparaison Elcé » est présent dans l’API et dans la liste de l’éditeur. Le
   21 octobre, une ouverture a produit plus de 10 000 erreurs
   `handle.update() infinite loop detected in ProjectApplication` en cascade et
   laissé l’interface en « Lecture seule ». Le document stocké
   compte 11 pages ; sa première Section contient deux ancres média. Un rendu
   temporaire de ce même document dans `ProjectApplication`, avec médias et
   ratios d’image simulés et une session contrôlée, passe en lecture seule et
   en édition : il ne reproduit pas la boucle. Un nouveau test d’intégration
   avec une image déjà décodée traverse le véritable éditeur Tiptap, l’événement
   Section et l’acteur ; le ratio est enregistré une fois et le flux se
   stabilise. La cause exacte de la boucle initiale reste à établir. Les
   souscriptions de `ProjectApplication` et `RemixPageEditor` ignorent maintenant les snapshots
   qui laissent leur modèle de vue inchangé ; leurs tests valident aussi les
   doublons de résumé projet et d’URL média, sans reproduire le plantage réel.
   L’acquisition du verrou natif dispose maintenant d’un secours testé
   unitairement : si la demande reste pendante cinq secondes, Elcé affiche les
   commandes de reprise existantes. À la vérification navigateur suivante, la
   page ouverte sur « Démo 5 — comparaison Elcé » affichait « Synchronisé » et
   son éditeur ProseMirror était `contenteditable=true` ; DevTools n’a renvoyé
   aucune erreur ni alerte. Cette observation confirme un état éditable, mais
   ne reproduit ni l’ouverture à froid ni l’attente d’un verrou concurrent.
   L’utilisateur a confirmé le seuil de cinq secondes. Ces deux parcours
   restent à valider dans le navigateur.
  Ne pas modifier le document ni « Projet 1 »
   pour contourner cette erreur. Aucun des trois packages multi-SCO n’a encore
   été importé dans un LMS qui conserve les écritures CMI. Le contrôle de
   preview n’est pas un critère d’acceptation SCORM.

## Preuves à produire

- Vérifié : tests de la classe métier SCORM, du relais d’événements publics
  Sighty, de l’action Elcé, de son codec et d’une Question d’Évaluation jouée
  par le player réel. Ils couvrent les interactions immédiates et différées, la
  latence par réponse, les formats de choix et les champs CMI 2004, l’absence
  d’interactions en 1.2, la reprise, les tentatives, les résultats, les erreurs
  et la fermeture.
- Vérifié : parcours du player Sighty avec faux LMS, restauration avant
  initialisation, sauvegarde après navigation admise et absence de session SCORM
  dans la preview auteur.
- Vérifié : parcours Sighty exporté avec faux LMS, session, restauration,
  navigation vers la page conservée, sauvegarde et fermeture.
- Observé par l’utilisateur : le package Demo5 2004v4 mono-SCO installé dans la
  route locale 2J remonte un résultat d’évaluation. Cette observation porte sur
  le package déjà installé, pas sur les nouveaux packages multi-SCO. L’API est
  en mode `browse` et ne valide pas la persistance CMI.
- Vérifié : archives SCORM mono-SCO avec sommaire et multi-SCO par chapitre
  pour les trois éditions, manifeste à la racine, références de lancement
  résolues, runtime présent, validation XSD et conservation des fichiers
  Sighty. Vérifiés aussi `--zip=true` et le dossier seul de `--zip=false`.
- Observé dans le manifeste installé de Demo5 le 22 octobre : l’identifiant du
  manifeste, de l’organisation, des items et des ressources sont des UUID
  existants à préserver. Le générateur Elcé les réutilise maintenant dans la
  branche SCORM et donne des identifiants déterministes aux nouveaux projets et
  chapitres.
- Session LMS consultée le 22 octobre après reprise : `chapter-2`, page 3/3,
  `cmi.mode=normal`, `cmi.completion_status=completed`,
  `cmi.progress_measure=1` et `cmi.location=chapter-2-synthesis`. Le repère bas
  est dans le scrollport, mais `Suivant` reste désactivé. Une lecture du
  lanceur inline montre qu’il ne passe pas `chapterScoIdentifiers`; en même
  temps, `adl.nav.request_valid.choice` vers l’`ITEM-*` suivant vaut `true`.
  Le blocage est donc dans l’ancienne archive installée, qui ne fournit pas la
  table de destinations au runtime, et non dans le statut LMS ni le repère de
  fin. Le runtime actuel et les tests de scénario construisent cette table à
  partir des identifiants stables du manifeste.
- Le runtime SCORM servi dans cette session inclut déjà la conservation des
  observations initiales jusqu’à `PLAYING`. Les Cartes et Graphes déclarent
  `initial: 'enter'`, et un test ciblé du vrai `HtmlPlayerRunner` valide la
  conservation puis l’émission après démarrage. Les images de la page reprise
  ont `opacity=1`; cela ne permet pas d’observer l’animation d’entrée. Le
  contrôle visuel en LMS reste à faire depuis une entrée fraîche. Aucun fichier
  installé dans la LMS n’a été modifié dans cette correction.
- Vérifié : le chemin CLI complet a généré un ZIP à partir d’un paquet Sighty
  temporaire portant l’identifiant Demo5. Le manifeste racine contient les
  identifiants exacts déjà installés pour son manifeste, son organisation et
  ses trois chapitres ; `unzip -t` valide l’archive. Le runtime SCORM
  multi-SCO a été rebâti après l’ajout du contrôle des réponses. À réaliser :
  produire l’archive depuis le document Demo5 et confirmer qu’un import LMS la
  reconnaît comme mise à jour.
- Vérifié : les 39 tests du package partagé SCORM passent ; les 426 tests Elcé
  des 65 fichiers hors du test de persistance SQLite passent. Ce test restant
  échoue dans le sandbox avant exécution lorsqu’il tente d’écouter sur
  `127.0.0.1` (`EPERM`) ; il ne couvre pas les fichiers modifiés dans cette
  tranche. Les typechecks Elcé et SCORM passent.
- Enquête navigateur du 21 octobre : une ouverture a produit plus de 10 000
  mises à jour ; le même document Demo5 passe dans un rendu contrôlé qui
  simule les médias et le mode lecture seule. Une vérification ultérieure de
  l’éditeur ouvert confirme `contenteditable=true`, « Synchronisé » et aucune
  erreur/alerte de console. Elle ne reproduit pas encore l’ouverture à froid ni
  le verrou concurrent et n’attribue donc pas la cause initiale à la Section
  ou aux ancres.
- Vérifié par tests ciblés : une image Photo déjà décodée met à jour son ratio
  par le chemin Section Tiptap → acteur, puis se stabilise en moins de 20
  snapshots. Les abonnements auteur filtrent les snapshots identiques et
  conservent les mises à jour de vue utiles. Le test de verrou laisse une
  demande Web Lock pendante et confirme l’affichage du secours après cinq
  secondes. La validation navigateur de ces changements reste en attente.
- À réaliser : ouvrir Demo5 à froid sans toucher à ses contenus ni à « Projet
  1 », puis confirmer que l’éditeur reste éditable sans boucle. Reproduire aussi
  un Web Lock réellement retenu et confirmer l’apparition des commandes après
  cinq secondes.
- À réaliser dans un LMS qui conserve les écritures CMI : import et parcours
  des trois éditions, reprise, progression, résultats et interactions. En mode
  distant, vérifier les URLs configurées par `--absolutePath`.
- À réaliser dans un LMS qui conserve les écritures CMI : importer les packages
  multi-SCO des trois éditions et valider séparément chaque chapitre, les
  reprises, la progression et les évaluations.
- À réconcilier avant activation : manifeste 2004v4 avec sommaire et SCO
  séparés.

Ces preuves décriront le comportement vérifié dans les spécifications après
implémentation. Le présent plan reste la référence des décisions non appliquées.
