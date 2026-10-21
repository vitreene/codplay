# SCORM pour Sighty — intégration Elcé

**Statut : En cours — portée et isolation du dossier SCORM validées par
l’utilisateur ; réalisation autorisée. Le noyau SCORM doit être réutilisable par
Elcé et d’autres projets basés sur Sighty. L’export autonome Sighty est
maintenant livré et spécifié ; l’assemblage SCORM dédié doit le consommer sans
reconfigurer l’export simple.**

Ce plan suit le noyau SCORM partageable, son intégration à Elcé et les paquets
SCORM produits par Elcé. La session de lecture Elcé déjà implémentée est décrite
dans la [spécification SCORM](../specs/scorm-session-spec.md). La preview auteur
locale et réseau reste hors de ce circuit. Le format de l’entrée Sighty est
décrit dans la [spécification d’export Sighty](../specs/sighty-export-spec.md).

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
  `packageName` restent des paramètres facultatifs de nommage à finaliser.
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
  appelle Pipwerks, les types de version, le rendu générique du manifeste et
  les ressources de schéma. L’assemblage complet du package reste à réaliser.
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
- Le package sera vérifié depuis une intégration Sighty de test indépendante
  des modèles Elcé, puis depuis l’adaptateur Elcé. L’installation du package
  dans un dépôt extérieur au monorepo reste une preuve d’acceptation à produire
  après définition de son mode de distribution.

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
| `--masteryScore` | `80` ; appliqué aux SCO d’évaluation et à l’entrée de sommaire. La valeur zéro retombe sur 80 (`argv.masteryScore || 80`). | Le seuil auteur par chapitre de la [spécification Évaluation](../specs/chapter-evaluation-spec.md) gouverne le résultat et le seuil SCORM ; `0.8` (80 %) est le défaut Elcé. Si un seuil auteur manque dans un document ancien, appliquer la valeur de l’option, avec défaut 80. |
| `--licenseClient` | Absent ; lorsqu’il est fourni, renseigne `dataFromLMS` sous la forme `<valeur>||<titre du SCO>` ou `||accueil`. | Non repris : Elcé ne possède pas ce dispositif de licence distante par clé d’accès. |
| `--client` | `standard` ; participe au nom de package et à la configuration du lanceur. | Paramètre facultatif de nommage du fichier d’export ; règle à finaliser ultérieurement. |
| `--language` | `fr` ; sélectionne la configuration de langue, filtre les ressources localisées et participe au nom de package. | Réservé à l’évolution multilingue d’Elcé ; défaut actuel `fr`, sans autre langue à prendre en charge maintenant. |
| `--packageName` | Valeur explicite si fournie ; sinon `<client>_<slugify(title)>[_<language>]_scorm<cleanAndTrim(version)>`. Détermine le nom du dossier et du ZIP. | Paramètre facultatif de nommage du fichier d’export ; règle à finaliser avec `client`. |
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
4. **Résultat et interactions d’évaluation.** `REFRESH_EVALUATION_RESULT`
   appelle l’adaptateur Elcé lorsque la machine produit un résultat `success`
   ou `failure`, avec le chapitre, le score et le seuil effectifs. L’adaptateur
   remet les valeurs CMI au noyau partagé. À la sortie
   admise du chapitre terminé, une action Sighty transmet également les
   interactions validées du chapitre, selon le moment couvert par
   `Chapter.sendInteractions()` dans la référence. Les réponses et tentatives
   complètes restent dans l’état suspendu, y compris en SCORM 1.2.
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

- Le package `packages/sighty-scorm/` expose maintenant un noyau partageable :
  `ScormSession` est l’unique appelant Pipwerks, et le package contient les
  types génériques, le wrapper v1.1.7, les schémas et le renderer de manifeste.
  Le package ne dépend pas d’Elcé ; ses tests n’importent aucun modèle Elcé.
  L’adaptateur `packages/elce/src/scorm/elce-scorm-adapter.ts` conserve le
  codec, la réconciliation, le mapping du domaine et la contrainte de langue
  Elcé. Le parseur des options source et leur normalisation sont dans le package
  partagé ; l’entrée de commande et l’assemblage complet restent à intégrer au
  circuit SCORM dédié.
- Les actions Sighty exportables lisent l’adaptateur Elcé optionnel dans le
  contexte runtime, puis sauvegardent le signet après navigation admise et l’état
  complet après progression, réponses et profil via l’adaptateur Elcé. Celui-ci
  traduit les résultats d’évaluation et interactions validées vers la classe
  métier partagée. Le runtime ouvre la session
  et réconcilie l’état avant d’initialiser le player. Le runtime transmet aussi
  le choix `monoSco` et les identifiants de chapitres Évaluation pour produire
  les objectifs 2004 et l’agrégation des résultats comme dans la référence.
- La génération complète du package, son point d’entrée CLI exécutable, les
  manifestes complets et le ZIP restent à réaliser. Le rendu générique du
  manifeste est dans
  `packages/sighty-scorm/src/packaging/scorm-manifest.ts` ; ses fixtures
  n’établissent pas le contenu SCORM final. L’entrée Sighty est désormais
  spécifiée ; le lanceur SCORM doit charger ce paquet, extraire les données
  d’exécution Elcé nécessaires et y injecter le service au moyen du contexte
  runtime Sighty. Les schémas sont dans
  `packages/sighty-scorm/src/resources/schemas/`, mais leur copie vers la
  racine du package dépend de l’assembleur.
- Aucun changement n’a été apporté à la commande ou à la destination de l’export
  existant.

### Vérification du socle actuel

- Après intégration sur le commit de l’export Sighty, le typecheck Elcé et celui
  du package partagé passent. Les tests ciblés du codec, de l’adaptateur, du
  runtime, du builder de scénario, de la composition player et de l’export
  Sighty passent : 79 tests Elcé sur 8 fichiers et 29 tests SCORM partagés sur
  5 fichiers.
- Le build Elcé passe avec un avertissement de bundle JavaScript de 1,56 MB.
  `git diff --check` passe. La suite Elcé complète n’a pas été relancée après
  l’intégration des changements.
- `npm pack --dry-run` du package partagé inclut son point d’entrée, la CLI,
  le wrapper et les trois arbres de schémas (98 fichiers au total). L’installation
  depuis un autre dépôt n’a pas encore été vérifiée ; le mode de distribution
  reste à définir.
- Les trois arbres de schémas et le wrapper Pipwerks, désormais regroupés dans
  `packages/sighty-scorm/`, sont identiques aux fichiers correspondants de la
  référence (`diff -qr` et `cmp`).
- `xmllint` émet des diagnostics de liaison du namespace XML réservé pour cinq
  XSD source. Les fichiers sont conservés inchangés ; la validation des
  fixtures a néanmoins réussi pour SCORM 1.2, SCORM 2004 3e édition, 2004 4e
  édition `monoSco` et 2004 4e édition sans sommaire. Le diagnostic XSD 1.2
  reste affiché malgré la validation réussie.
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
   `summaryToLoad`; garder `fr` jusqu’à l’évolution multilingue. L’entrée CLI
   qui lance effectivement l’assembleur reste à créer avec celui-ci.

2. **Fixer le modèle d’état exporté — réalisé pour le runtime.** L’état SCORM
   versionné conserve
   les identifiants de pages terminées, la page courante, le profil nécessaire
   aux gardes, les réponses et les machines d’Évaluation. Réutiliser
   `EvaluationMachineState` et `reconcileProjectTestState` là où leur contrat
   couvre le cas ; ne pas dupliquer le calcul des scores. Le dépassement des
   limites `suspend_data` est signalé, jamais tronqué.

3. **Isoler le noyau partageable et l’adaptateur Elcé — session, options et frontière LMS réalisées ; commande/assemblage et publication à poursuivre.**
   `packages/sighty-scorm/` est un package public du monorepo. `ScormSession`
   centralise Pipwerks ; les schémas, le wrapper et le rendu générique de
   manifeste, le parseur CLI source-compatible et le résolveur d’options y sont
   regroupés. `packages/elce/src/scorm/` garde le codec et
   `ElceScormAdapter`, qui traduit `ProjectTestState` et
   `EvaluationMachineState`. Le package partagé ne dépend d’aucun type du
   domaine Elcé et ses tests sont autonomes. Ajouter le générateur/assembleur
   et l’entrée de commande SCORM dans le circuit dédié, puis définir le mode de
   distribution hors du monorepo avant la preuve d’installation externe.

4. **Raccorder le runtime du SCO et les actions Sighty — raccord Elcé réalisé et vérifié après extraction.** Placer les appels
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
   document ; le raccord à la configuration du lanceur généré dépend encore de
   l’assembleur du package.

5. **Produire les interactions et résultats — mapping Elcé vers le noyau partagé réalisé et vérifié.** Envoyer les réponses et issues
   depuis les données validées de la machine Évaluation Elcé. L’adaptateur
   traduit ces résultats en champs CMI via le noyau partagé. Mapper les éléments
   disponibles en SCORM 1.2 et SCORM 2004 3e/4e édition ; l’état suspendu reste
   la source de reprise des réponses et tentatives complètes. Chaque chapitre
   d’évaluation conserve son résultat et son seuil auteur ; le package rapporte
   ses SCO et objectifs au LMS selon le manifeste de la version choisie. En
   `monoSco`, l’adaptateur Elcé demande les objectifs par chapitre en 2004 et agrège les
   scores des chapitres d’évaluation pour le résultat global en 1.2 comme en
   2004, selon les branches de la référence. Le mapping est vérifié par faux
   adaptateur ; l’interopérabilité LMS reste à valider.

6. **Générer le manifeste et assembler le package — renderer indépendant réalisé, branche 2004v4 sommaire à réconcilier, consommation de l’export Sighty à intégrer.** Le rendu du manifeste SCORM utilise des fixtures détenues par ses tests ; le paquet autonome Sighty existant est l’entrée de l’assembleur. Reprendre l’ordre et les
  catégories de fichiers du générateur de référence : intégrer le paquet
  Sighty existant avec ses paquets de scènes et ses ressources, sans modifier
  leur circuit ; ajouter les ressources runtime utiles et l’arborescence
  complète de schémas versionnée déjà copiée sous
   `packages/sighty-scorm/src/resources/schemas/`, lanceur HTML par
   SCO, manifeste généré pour la version choisie et ZIP à racine conforme selon
   le comportement d’Elcé pour `--zip`. Pour chaque version et mode `monoSco`
   accepté, vérifier que `imsmanifest.xml` est à la racine du dossier et, si
   `--zip` est vrai, du ZIP ; vérifier également qu’il est bien formé et valide
   avec les schémas de l’édition. Chaque `identifierref` d’item désigne une
   ressource et chaque `href` de lancement ou fichier déclaré existe. Les
   scripts, styles, médias et autres dépendances du
   runtime sont présents en mode local. Charger le paquet `.sighty.zip` produit
   par l’export Elcé existant, en conserver les ressources et préparer le
   runtime Sighty avec le contexte d’adaptateur prévu, sans changer son circuit.
   Garder la
   sortie et les réglages de la commande d’export existante inchangés ; la
   commande SCORM utilise sa propre destination. Si le contrat révèle une
   incompatibilité concrète avec l’assemblage du package, consigner précisément
   cette limite et reporter la réconciliation sans ajouter d’exporteur
   parallèle. En mode `--absolutePath`, vérifier que
   les lanceurs ciblent l’hébergement externe attendu. Avant de connecter la
   génération 2004 4e édition avec sommaire en SCO séparés, réconcilier la
   divergence générateur/XSD consignée ci-dessus, sans masquer l’erreur ni modifier
   les fichiers de référence par anticipation. Importer ensuite les
   packages et vérifier reprise et résultat dans un LMS conforme en 1.2, en
   2004 3e édition et en 2004 4e édition. Comparer les packages reconstruits,
   l’état rétabli et les effets sur les gardes Sighty. Le contrôle de preview
   n’est pas un critère d’acceptation SCORM.

## Preuves à produire

- Vérifié : tests du codec Elcé, de l’adaptateur et de la classe métier partagée pour les trois éditions,
  reprise, tentatives, résultats, interactions, échecs d’écriture et fermeture.
- Vérifié : parcours du player Sighty avec faux LMS, restauration avant
  initialisation, sauvegarde après navigation admise et absence de session SCORM
  dans la preview auteur.
- À réaliser après assemblage : parcours Sighty exporté, nouvelle session et
  reprise avec les gardes attendues.
- À réaliser après intégration du paquet Sighty à l’assembleur SCORM : packages construits avec
  les options CLI retenues, manifeste à la racine,
  validation de schéma selon la version, tous les chemins du manifeste résolus,
  ressources runtime fermées en mode local. Vérifier aussi `--zip=true` avec un
  ZIP importable sans dossier parent supplémentaire et `--zip=false` avec le
  package complet en dossier et aucune archive.
- À réaliser dans un LMS : import et parcours pour chacune des trois versions et chaque mode
  `monoSco` accepté ; en mode distant, validation des URLs configurées par
  `--absolutePath`.

Ces preuves décriront le comportement vérifié dans les spécifications après
implémentation. Le présent plan reste la référence des décisions non appliquées.
