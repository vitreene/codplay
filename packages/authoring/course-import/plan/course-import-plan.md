# Plan — Pont d’import des projets de formation

## Objectif et statut

> **En cours** — implémenter le moteur générique dans
> `packages/authoring/course-import`, à partir des règles transversales du
> corpus canonique. Les transcriptions SAMERA `p02` et SPIE `page004` restent
> des cas d’essai dans `packages/demos`; elles ne sont ni des règles ni des
> dépendances du moteur.

Le contrat du moteur générique est décrit dans
[`course-import-engine-spec.md`](../specs/course-import-engine-spec.md). Les
transcriptions de démonstration et leurs observations sont décrites dans
[`course-motion-import-spec.md`](../../../demos/specs/course-motion-import-spec.md).

## Décisions acceptées

- `course-import` est un projet d’outillage indépendant qui traite des projets
  source maintenus en parallèle. La conversion et la préparation des livrables
  s’exécutent en amont, en ligne de commande. Une interface simple pourra
  appeler le même outil.
- Le sommaire XML fournit l’organisation scénario → chapitres → pages.
  Le convertisseur s’appuie sur cet ordre pour découper les livrables en
  modules, généralement un par chapitre. CodPlay exécute chaque page
  convertie en `SceneDoc` avec ses stories. L’édition se fait dans Editor.
- Le moteur propose des classes réutilisables dont les méthodes correspondent
  à des règles ou tâches identifiées. Le skill documentera leur usage et la
  préparation des fichiers. L’agent analyse un projet, choisit le découpage,
  exécute l’outil et traite les écarts consignés dans le bilan.
- Le code général vit dans `packages/authoring/course-import/src`. Aucun
  convertisseur, identifiant, style ou ressource propre à SAMERA, SPIE ou à une
  autre fixture de démo n’entre dans ce moteur. Les démos exercent ses règles
  depuis leurs propres modules.
- `PageConverter` retourne un `SceneDoc` partiel ou complet avec un rapport
  structuré. Il applique seulement les règles dont les valeurs, la cible, le
  déclencheur et la chronologie sont déterminés; les autres formes restent dans
  le rapport avec leur provenance et la raison du blocage.
- La première tranche couvre les balises communes `<page>`, `<sequency>`,
  `<img>`, `<sub>`, `<container>` et `<sound>`, les références explicites aux
  propriétés/traductions, les tweens littéraux simples, les appels GSAP
  littéraux simples et les appels de visibilité à cible résolue. Elle signale
  les cibles calculées, fonctions métier inconnues, styles non résolus et
  chronologies ambiguës. Le modèle pédagogique complet des quiz reste hors
  périmètre; la conversion réutilisable des zones visuelles cliquables dessinées
  par un ou plusieurs masques SVG est acceptée comme règle générique à cadrer
  dans l’action 3.
- Les callbacks sont analysés sans exécution. Un même déclencheur source peut
  devenir une émission et plusieurs actions destinataires. Les répétitions
  structurellement équivalentes sont regroupées en recette paramétrée dans le
  rapport; elles ne sont pas réécrites en boucle opaque dans la scène.
- Les huit dossiers de projets standards récents recensés dans le
  [corpus canonique](#corpus-canonique-et-dictionnaire-xml) déterminent le
  périmètre de généralisation et de mesure de couverture du moteur.
- Le mapping cible est une page XML vers un `SceneDoc` et chaque élément
  `<sequency>` vers une `StoryDoc` de cette scène.
- La conversion est une fonctionnalité d’auteur indépendante. La démo choisit
  la page source et transmet les entrées au convertisseur. Le montage, le
  chargement des styles et les commandes de lecture restent dans le layout V2.
- Les démos de transcription servent de fixtures d’acceptation hors du moteur.
  Le code générique ne les importe pas et ne dépend pas de leurs identifiants,
  styles, ressources ou routines. Une démo peut appeler le moteur et fournir
  ses résolveurs de projet; `course-motion-import` doit exercer `PageConverter`
  sur les éléments dont la conversion est générique au lieu de les reconvertir
  localement.
- Pour le futur moteur, les propriétés, classes, polices et médias se résolvent
  depuis les sources du projet. Les règles propres à un format source sont
  isolées des méthodes communes de conversion.
- Le convertisseur sert de trousse à outils à l’agent qui transcrit un projet.
  Il traduit les cas stables et fournit les raccourcis applicables aux appels
  dont le comportement est établi. Pour une routine propre au projet, il émet
  une alerte et documente l’écart. L’agent chargé de la transcription choisit
  ensuite une réalisation adaptée à CodPlay.
- Les quiz et évaluations sont reportés à une tranche de reconstruction
  fondée sur les modèles Elcé et leur projection CodPlay. Le bilan du pilote
  repère leur emplacement et leurs dépendances à la narration.
- La lecture vidéo standard est un cas direct du composant `media` V2.
  L’import résout la source et transcrit ses réglages de lecture et de
  présentation selon le profil existant. Une voix ou un son particulier porté
  par la vidéo est l’indice source à examiner pour le choix de `master`.
- Les séquences de narration de `p02` se jouent dans leur ordre source.
  La fin effective de chaque audio ouvre la séquence suivante. Le média
  `master` conduit l’horloge CodPlay. Un perso sans `duration` reçoit
  `display: none` 500 ms après la frontière d'une story intermédiaire, pour
  laisser son image de fond chevaucher l'entrée de la story suivante; l'état
  visuel de la dernière story est conservé à la fin de la scène. Un perso avec
  `duration` se masque à sa propre échéance.
- Le prototype `?demo=course-motion` prend sa source dans le projet standard
  `02_circulation.xml`, page2. Les transcriptions SAMERA `p02` et SPIE
  `page004` sont des fixtures distinctes; elles ne sont pas la scène comparée
  par ce prototype. La démo utilise le player V2 partagé et aucun service local
  de playback.
- Le prototype motion de `?demo=course-motion` utilise la première séquence
  de `02_circulation.xml/page2` (`p2_1.mp3`). Ses deux panneaux `effectPanelCircle`
  sont appelés par les conteneurs source `panel1_1` et `panel1_2`. Leur
  transition automatique est hors du travail actif; cette localisation est le
  seul constat conservé. La suite expérimentale ajoute la séquence source
  `p2_2.mp3` et son quiz visuel à la même démo. La transcription du modèle de
  question, de sa validation et de ses retours reste distincte de la règle
  générique de zone cliquable à masque SVG.
- Le quiz visuel de `02_circulation.xml/page2` a un seul choix source, déclaré
  correct. Son hit-area reprend le cadre converti de l’image `zone1`; le même
  clip SVG masque le perso `input` et son voile rouge à la sélection. Le PNG
  teinté n’est pas superposé comme une deuxième couche. « Valider » confirme la
  réponse et déclenche `bonne.mp3`. L’action source `failed` référence
  `mauvaise.mp3`, mais aucun choix faux n’est déclaré : le POC ne crée pas de
  zone erronée ni de branche d’échec fictive. Les coordonnées du `<prop>` restent
  validées, mais ne positionnent pas le hit-area CodPlay. Le parcours
  `change → listen/straps → actions` reprend celui exercé par `quiz-series`. Le
  `<sub>` `m2p2_txt1` est résolu depuis le fragment français de la source; son
  HTML riche est porté par un perso `text`. Taille, couleur, alignement,
  placement, Raleway et son interlignage viennent du XML et de la feuille
  source. Aucun changement du core CodPlay n’est prévu.
- Les longueurs rapportent le canevas source `1600 × 788` à `cqw`. `scale`
  devient une dimension de boîte pour `img`; aucune transformation CSS `scale`
  n’est ajoutée à l’image.
- `delay` et `duration` sont des paramètres temporels standards du corpus,
  écrits comme nombres en secondes. Pour les éléments visuels, le délai d’un
  enfant s’ajoute à celui de ses conteneurs de la même séquence; sa durée règle
  sa visibilité et hérite de celle du conteneur si elle n’est pas déclarée.
  Les usages de `duration` sur `<sequency>` et `<tween>` gardent leur rôle
  distinct de durée de séquence et de durée d’interpolation. Une durée
  absente ou nulle hérite du conteneur, comme dans le lecteur source. `PageConverter`
  porte le calcul temporel commun des profils visuels pris en charge; le
  contexte reste propriétaire des effets source, des repères et des rôles
  médias.
- Les conteneurs imbriqués conservent leur position source dans le canevas.
  Le conteneur `is-flex-list is-vertical` reste un `layout` avec son style de
  flux; le contrat du composant `list` porte sur l’ordre structurel, pas sur ce
  rendu flex.
- Décision ouverte — identifier les icônes à réduire et leur dimension cible;
  le XML donne actuellement 200 px aux croix SVG et un facteur `scale` aux
  images météo.
- Les classes `message is-link`, `message-body` et `bullet` suivent les styles
  Bulma/SAMERA du projet source; les textes héritent du bloc, puis les valeurs
  explicites de couleur, taille et graisse priment.
- Les images et SVG sans `id` reprennent la convention calculée par le player
  source. Les identifiants source dupliqués sont refusés; une collision entre
  identifiants calculés est suffixée de façon déterministe. La détection des
  collisions entre stories reste ouverte.
- Le panneau `message is-link` suit la palette Bulma source (`#eff1fa`,
  `#485fc7`, `#3850b7`); le texte hérite Futura et du poids déclaré par ses
  classes source.
- Les tests possèdent leurs propres fragments simple, enchaîné et avec pause.
  Ils ne chargent pas la scène de démo. Aucun cas d’essai supplémentaire n’a de
  route visible.
- Aucun changement du core CodPlay.

## Livrables et ordre d’implémentation accepté

| Étape | Propriétaire et résultat attendu |
| --- | --- |
| **1. Lire les sources** | `CourseSourceReader`, utilisable depuis Node : parse XML avec provenance, indexe le sommaire, résout une page par chapitre/ID, propriétés, traductions et ressources. Les collisions d’ID entre chapitres restent distinctes. |
| **2. Appliquer les règles** | `PageConverter` consomme le contexte résolu et produit un `SceneDoc` plus un rapport. Chaque règle a une méthode dédiée (`convertImage`, `convertText`, `convertContainer`, `convertMedia`, `convertTween`, `convertGsapCall`, `convertVisibilityCall`). Un écart ne bloque pas les autres règles sûres de la page. |
| **3. Analyser les répétitions** | `factorRepeatedInteractions` regroupe les callbacks équivalents, distingue leurs paramètres et produit une recette pour l’agent. Il ne déduit pas une sémantique métier d’un nom de fonction. |
| **4. Produire les fichiers** | Ajouter ensuite une CLI qui choisit projet, sommaire, chapitre/page et cible. Valider `SceneDoc` via le builder CodPlay et l’exporteur existants; cadrer séparément l’écriture `EditorScene` et l’incorporation des médias. |
| **5. Documenter et traiter un projet entier** | Écrire le skill après vérification des commandes et formats. L’agent utilise le rapport et les recettes, traite les blocages un par un, puis livre les scènes regroupées par module et son bilan. |

Les transcriptions de démo restent indépendantes du moteur et fournissent des
fixtures de comparaison. Le moteur lui-même parse le XML côté Node et ne dépend
pas de `DOMParser` ni d’un navigateur.

La sortie éditable dépend de la représentation des sections dans Editor et
du raccord de ses [médias persistants](../../../editor/specs/editor-sqlite-persistence-spec.md#limites-actuelles).
La vérifier à l’ouverture puis à la réouverture avec les médias.

## Prérequis de mise en production

La première tranche du convertisseur valide ses livrables dans Editor et
CodPlay. Avant sa mise en production, valider dans Elcé le
[plan distinct de lecture des modules source](../../../elce/plan/external-course-module-plan.md).
Le catalogue de modules et les droits restent reportés. Les exports directs
d’Editor vers Elcé seront définis selon le projet retenu.

## Actions

1. **Prototype motion — En cours, raccord partiel.**
   `course-motion-import/main.ts` conserve la sélection standard de
   `02_circulation.xml/page2/p2_1`. Son adaptateur passe les éléments génériques
   par `CourseSourceReader` et `PageConverter` avec les résolutions de
   ressources, propriétés, canevas, géométrie et tweens de ce projet.
   `PageConverter` calcule le `delay` cumulatif et l’héritage du `duration` des
   profils visuels. Il fournit les frontières de visibilité communes; les
   sorties animées restent ajustées par l’adaptateur.
   Garder dans l’adaptateur de démo le mapping des effets `growDown`, `fromLeft`
   et `toLeft`, le panneau `effectPanelCircle`, les chemins, dimensions
   intrinsèques et règles de couleur propres à cette source. Le quiz p2_2 et la
   correction p2_3 restent assemblés par leurs convertisseurs dédiés; réutiliser
   le moteur pour leurs images et textes quand le profil générique suffit.
   La scène CodPlay est vérifiée dans Brave au Seek de 1 500 ms et en Play
   jusqu’au quiz p2_2; la console ne signale pas d’erreur ni d’avertissement
   Vite. Il reste à lancer le lecteur source dans Brave et comparer Play, Seek
   et les transitions avant de finaliser la spécification de démo.
2. **Quiz visuel et suite Circulation — En cours, hors moteur.** Dans
   `?demo=course-motion`, transcrire `p2_2` et `p2_3` de
   `02_circulation.xml/page2`. Le bouton CodPlay « Valider » est un perso
   interactif qui émet l’événement story ordinaire; le strap valide la réponse,
   arrête la narration p2_2 et joue `bonne.mp3`. Il active/réinitialise
   immédiatement la story distincte `page2-sequence-3`, qui reste visuellement
   inactive pendant ce retour sonore. Son listener planifie `p2_3:play` après
   la durée de `bonne.mp3`; cet événement lance `p2_3.mp3` et la croix SVG
   locale (tween fini de 958 ms), puis l’image `2_2b.jpg` apparaît 1,5 s après
   et reçoit deux cycles d’opacité finis. Aucun contrôle de télécommande,
   minuteur ni changement du core n’est ajouté.
   `2_2a.jpg` source porte `showAfter="Y"`; le perso image doit donc rester
   dans le stage parent, hors du layout de quiz masqué après le retour sonore.
   Le layout de quiz est transparent pour laisser cette image visible pendant
   la question.
   Le hit-area p2_2 suit le cadre converti de `zone1`. À la sélection, le même
   perso `input` dessine le voile rouge à travers son clip SVG; le PNG teinté
   n’est pas superposé. Les images de présentation traversent les pointeurs
   afin que seul le composant `input` reçoive le clic. Le parcours de sélection
   est accepté lorsque des points sur le haut, le buste, les côtés et les jambes
   ciblent ce radio pendant Play et que son `change` applique le voile à la même
   silhouette. La sélection CodPlay et son hit-testing SVG sont vérifiés dans
   Brave; la comparaison source reste ouverte.
   Brave confirme la référence toujours visible sous la croix à l’arrivée, puis
   sous `2_2b.jpg` pendant ses clignotements. Les `showAfter="Y"` source sur la
   croix et l’image expliquent qu’elles restent superposées après le blink.
   À l’entrée de p2_2, l’image de fond `IMG_0565` de p2_1 est masquée sur la
   track `main`, à 8 626,508 ms; le lecteur source retire le fond précédent à
   cette frontière. Brave compare les deux lecteurs jusqu’à `sequence:end`.
   Seek à 8 000 ms conserve le fond et Seek à 8 700 ms le masque. Après la fin,
   « Lire » relance depuis zéro; « Revenir au début » envoie un `rewind` rejeté
   après `sequence:end`, donc le replay est validé via « Lire ». Le placement
   et la persistance de l’image cible après le quiz sont vérifiés dans CodPlay;
   la croix SVG et les deux clignotements restent des rendus expérimentaux à
   comparer au lecteur source.
3. **Zones visuelles cliquables — conception acceptée, contrat à préciser.**
   Comparer le POC `02_circulation.xml/page2/p2_2` avec
   `AS BTP-INDUSTRIE-LOGISTIQUE/1-PROD_save2024/public/content/xml/07_evaluation.xml/page_7102`.
   Ce dernier déclare cinq `prop` correctes, chacune avec `x/y`, `oneClick` et
   `itemToShow=zoneN`; cinq images PNG `zoneN` servent de révélations dans une
   séquence suivante. Ce cas confirme les choix multiples à cliquer et leur
   révélation; il n’emploie pas de masque SVG et ne prouve pas un hit-testing
   sur la transparence des PNG. Relever dans les deux formes le lien à
   l’illustration, les repères géométriques et les ressources de masque ou de
   révélation. Définir la conversion générique des zones en composants `input`
   et leur circuit d’événement CodPlay existant; garder le modèle complet de
   question, la validation et les retours pédagogiques hors de cette règle.
   Reprendre ensuite `p2_2` pour exercer le hit-testing SVG. Utiliser une
   fixture de test autonome pour exercer plusieurs choix et révélations selon
   le motif de `page_7102`; son conteneur `panZoom` reste une règle distincte.
   Les tests possèdent leurs fixtures. La règle reste hors spécification et
   hors implémentation tant que le mapping des masques, les repères et
   l’acceptation ne sont pas établis. La skill
   `.agents/skills/course-import-visual-interactions/SKILL.md` guide l’analyse
   de ces sources sans présenter leurs formes comme un contrat de conversion.
4. **Moteur générique — En cours.** Les lecteurs XML, sommaire, propriétés,
   textes, styles et appels, le convertisseur `SceneDoc`, les recettes
   d’interactions et le rapport sont implémentés dans `course-import/src`.
   Le typecheck passe. Reste à exercer chaque règle et un cas voisin autonome
   sur des entrées indépendantes, puis à valider les scènes par le builder et
   le player. Les cas non résolus restent dans le rapport.
5. **Préparation des livrables — à faire.** Ajouter une CLI qui choisit
   projet, sommaire, chapitre/page et cible; valider `SceneDoc` via le builder
   CodPlay existant et cadrer séparément l’écriture `EditorScene` et la copie
   des médias.
6. **Import direct vers Editor — À cadrer.** Concevoir la projection
   depuis les données source résolues vers le document auteur et le catalogue
   de médias Editor. Voir le parcours et les prérequis ci-dessous.
7. **Agrégation et responsive — à cadrer séparément.** Définir l’assemblage
   de scènes par chapitre ou projet et le reflow selon le ratio d’écran.

## Corpus canonique et dictionnaire XML

Les huit dossiers de la [liste des projets](../notes/corpus-xml/synthese-corpus-xml.md#liste-des-projets)
forment le corpus canonique. Le [dictionnaire](../notes/corpus-xml/dictionnaire-corpus-xml.json)
donne les chemins XML exacts dans `projects[].xml_roots` et recense 133 XML
et 1 077 pages. Les essais SAMERA et SPIE servent à vérifier la restitution
des cas déjà travaillés. Les autres règles candidates restent à relire.

1. **Recenser les documents.** Analyser des lots de fichiers XML seuls,
   groupés par projet et version quand ils sont connus. Identifier les
   chapitres, configurations et textes par leur structure. Relever les
   doublons et les fichiers illisibles. Cataloguer les chemins média et les
   références externes tels qu’ils sont déclarés, sans ouvrir leurs cibles.
   Cette phase s’arrête à l’inventaire, avant toute construction de scène.
2. **Relier les attributs aux intentions de conversion.** Relever les
   valeurs et leur contexte par balise. Pour chaque changement, documenter
   le déclencheur, la pose ou valeur de départ, le changement et sa cible.
   Pour chaque callback, conserver l’ordre des appels, les arguments et les
   candidats de résolution. Voir la [lecture par actions](../notes/corpus-xml/synthese-corpus-xml.md#attributs-et-actions-de-perso).
3. **Livrer le dictionnaire.** Fournir un index de documents, un dictionnaire
   structuré des formes et motifs, et une synthèse des motifs répandus,
   concentrés dans un projet ou rares. L’agent peut retrouver les exemples
   sans relire tout le corpus et qualifier les motifs dont le sens dépend
   du lecteur. Un nouveau lot enrichit ces sorties et rend visibles les
   nouvelles formes et variantes.
4. **Qualifier les règles candidates.** Vérifier l’intention source et la
   restitution pour chaque règle ci-dessous. Conserver dans le bilan les
   cibles, phases de déclenchement et paramètres restant à résoudre.

### Règles candidates pour la narration motion design — à qualifier

Les autres transpositions du tableau restent à qualifier. La lecture des
paramètres numériques `delay` et `duration` pour les éléments visuels est
acceptée selon la décision ci-dessus; elle ne généralise pas les rôles de ces
attributs sur les sections, tweens ou interactions.

L’ordre proposé part des valeurs source résolues et va jusqu’aux réactions.
Le [parcours d’import](#parcours-dimport-dun-chapitre--à-relire) décrit les circuits à
réutiliser. Les exemples détaillés restent dans la [synthèse du corpus](../notes/corpus-xml/synthese-corpus-xml.md#attributs-et-actions-de-perso).

| Règle | Appliquer quand | Sortie et vérification |
| --- | --- | --- |
| **Résoudre les éléments et la présentation** | L’élément, ses références et son repère sont identifiés à partir des fichiers du projet. | `<img>` ou SVG statique vers `img`, `<sub>` vers `tag` avec texte résolu, `<container>` vers `layout`. Porter pose, couleur, taille et graisse dans l’état du perso. Comparer l’héritage et le rendu sur `p02`, puis sur un autre thème. |
| **Créer les sections et rattacher le média directeur** | La `<sequency>` et ses conditions de fin sont établies. Le média a une source et son rôle est connu. | Garder l’ordre des sections. Utiliser `media` avec `master` quand sa lecture pilote la section. Vérifier sur `p02` la fin effective du son, le recouvrement visuel entre sections et la dernière vue. Respecter les conditions interactives de SPIE. Qualifier les `<sound>` de TMS qui englobent des éléments. |
| **Transcrire un tween ou un effet déclaratif** | Le canal, les valeurs, la pose de départ et l’origine du délai sont résolus. Un seul segment ou des segments à la chronologie établie. | Déclarer une action instantanée pour `time="0"`, ou une transition `from`/`to` à durée connue. Convertir en millisecondes et projeter les positions dans le repère du perso. Reprendre les effets d’entrée vérifiés dans `p02`. Vérifier début, milieu et fin en Play et Seek. |
| **Relier un déclencheur à ses destinataires** | `targetItem` ou un sélecteur littéral désigne un perso résolu et présent, et le fait déclencheur est identifié. | Déclarer le changement sur le perso cible. Un fait commun donne une clé commune aux persos concernés. Choisir `eventime` pour une date auteur et `Perso.emit` pour une interaction HTML vérifiée. Prendre l’icône et le fond de `p02` comme exemple de départ commun et les révélations SPIE comme preuve du parcours interactif. |
| **Transcrire un appel GSAP simple** | Appel reconnu, cible explicite, paramètres littéraux, durée et départ établis, canaux et courbe compatibles. Pour un tableau de cibles, ces conditions valent pour chaque perso. | Transformer l’interpolation en actions `from`/`to` sur les persos. Vérifier l’appel de `page004` SPIE. Étendre aux survols d’AS BTP une fois le déclencheur et les interruptions qualifiés. |
| **Traduire un appel de visibilité** | `showItem` ou `hideItem` désigne un perso unique et l’effet sur son affichage est établi. | Raccorder le fait déclencheur à une action de visibilité sur ce perso. Exercer `showItem` sur une liste de `page004` et vérifier l’affichage, le flux du contenant et l’état après Seek. |

Les phases source ambiguës, les cibles entre sections ou à identité calculée,
les répétitions dont l’arrêt reste à définir et les routines propres à un
projet donnent une entrée de reprise pour l’agent. Utiliser `page112` de
RISQUE CHIMIQUE pour qualifier la persistance et le déplacement des images
entre sections. Pour `launchPopup`, la navigation et l’arrêt suivi du
démarrage d’un retour, établir d’abord l’effet métier et son destinataire.

## Parcours d’import d’un chapitre — À relire

**Entrées.** XML du chapitre, ordre des pages, propriétés et traductions,
médias, styles et canevas du projet. Examiner les fonctions déclarées et le
lecteur source quand ils expliquent un effet observable. Le chapitre est
l’unité de bilan. Chaque page, et si besoin chaque section, reste une unité
de conversion et de reprise.

1. **Inventorier.** Résoudre les références et conserver l’emplacement source,
   les identifiants, l’ordre, les temps relatifs et les dépendances entre
   éléments. L’inventaire est commun aux sorties Editor et CodPlay.
2. **Convertir les cas connus.** Le moteur applique des règles reproductibles
   avec des conditions d’application explicites. Il produit directement les
   données `EditorScene` représentables. Pour chaque règle, couvrir aussi un
   cas proche hors périmètre afin de vérifier qu’il est signalé. La démo
   garde le parcours `SceneDoc` pour comparer le rendu et les comportements.
3. **Reprendre les écarts.** L’agent traite un cas à la fois à partir du bilan.
   Il identifie le résultat voulu dans le XML, le CSS, les fonctions ou le
   lecteur source. Il compare les capacités des modèles cibles, applique une
   recette connue ou propose une adaptation locale avec ses conséquences.
   Une routine spécifique est documentée dans son ensemble. Quand sa
   restitution exige une décision ou une capacité absente, elle reste ouverte.
4. **Vérifier et relancer.** Rejouer la page ou la section touchée, comparer les
   résultats attendus puis actualiser son statut. Conserver les adaptations
   validées dans des données distinctes de la sortie générée et les rattacher
   aux IDs source. Une relance présente les différences et signale les
   conflits avec les corrections existantes ou les modifications faites dans
   Editor. Appliquer la reprise sur les éléments concernés après comparaison.
   Transformer une recette en règle après vérification sur des exemples
   indépendants et validation de son périmètre. Reprendre ensuite le blocage
   suivant.

### Livrables du chapitre

| Livrable | Contenu et critère |
|---|---|
| **Scènes et ressources** | Documents `EditorScene` prêts à importer une fois leur ouverture, leur édition et la réouverture avec médias vérifiées. Le manifeste garde l’ordre des pages et sections, la correspondance des IDs, les fichiers et les statuts. Un `SceneDoc` peut être fourni pour lecture de référence ou quand la sortie Editor manque, avec son statut propre. |
| **Recettes pour l’agent** | Pour chaque famille, préciser comment reconnaître le cas, où chercher, la transposition permise et comment la vérifier. Garder le départ commun de `p02` comme exemple local. Pour SPIE, distinguer l’icône entière de la forme interne ciblée dans le SVG. |
| **Bilan des écarts et blocages** | Résumé lisible par chapitre et entrées structurées avec ID stable, emplacement source, effet attendu, résultat obtenu, impact, action suivante et état. Distinguer les pages prêtes, partielles et bloquées, avec un statut pour chaque cible. Indiquer ce qui bloque l’ouverture, la lecture ou seulement une partie de la restitution. |

### Séquence du pilote

1. Extraire la lecture commune à partir de SAMERA et produire un premier
   `EditorScene` pour la section 1 de `p02`. Comparer avec la démo puis vérifier
   une modification du texte et du timing. La réouverture avec médias dépend
   du catalogue Editor et valide la livraison importable.
2. Exécuter le bilan sur `02_acces` entier. Valider `p01` pour vidéo et
   narration, puis `p02` avec ses quatre sections dès que le modèle les
   représente. Signaler les activités reportées, comme le glisser-déposer
   de `p03`, et relever leurs dépendances avec les sections de narration.
3. Passer sur le cas SPIE pour éprouver la localisation des styles et les
   combinaisons SVG, clics et tweens.
4. Prendre un chapitre de narration du corpus canonique pour éprouver les
   règles au-delà des essais de référence. Prendre un blocage réel, le traiter
   par recette ou adaptation locale et relancer la conversion ciblée. Vérifier
   que les résultats des autres pages et les corrections déjà validées sont
   conservés. Le bilan avant/après est la preuve de la boucle de reprise.

## Moteur de conversion — En cours

Les étapes suivantes cadrent le moteur générique de narration motion design.
Les références aux pages d’essai et aux projets du corpus servent uniquement
à mesurer la couverture; elles ne définissent ni règles ni dépendances du
paquet `course-import`.

1. **Sélectionner les cas source.** Prendre les pages de narration dans les
   huit dossiers canoniques pour qualifier les règles et mesurer leur
   couverture. Distinguer les pages reproductibles, les écarts documentés
   et les cas bloquants. Qualifier `page112` de RISQUE CHIMIQUE pour les
   éléments animés entre sections et `page_408` d’AS BTP pour les interactions
   répétées. Rejouer les essais SAMERA et SPIE concernés en complément.
2. **Lire le contexte source.** Sélectionner une page par chapitre et ID.
   Résoudre les valeurs par défaut, propriétés globales et locales, textes et
   médias dans leur contexte. Relever l’ordre de fusion source, notamment
   `override`, la fusion de `cssClass`/`cssStyle` et les tweens des propriétés.
   Fournir le canevas, la langue et les métadonnées médias depuis les entrées
   du projet. Remplacer les contraintes `p02` et « quatre séquences » par les
   contraintes établies pour les familles de pages couvertes.
3. **Localiser et reconstituer les styles.** Les classes varient selon le
   projet. Relever pour chacune son point d’emploi et les règles trouvées
   avec leur fichier, leur position et leur sélecteur. Partir du CSS compilé
   du projet, de ses imports et ressources, puis conserver la cascade,
   l’héritage, les sélecteurs
   composés et les pseudo-éléments sur le markup converti. Adapter les
   sélecteurs lorsque le DOM diffère. Alimenter la géométrie et le mode
   d’affichage avec les valeurs résolues. Les conventions qui déclenchent
   un comportement du lecteur source relèvent de l’adaptateur.
   Par exemple, lire le tween de `fullOut` dans les propriétés et résoudre
   `message is-link` dans les feuilles source. Examiner la réutilisation du
   compilateur CSS d’export pour imports, URL et polices à la préparation, et
   du chargement CSS déjà isolé par instance côté player. Vérifier les styles
   reconstruits sur le DOM produit, en prenant le rendu source comme référence.
4. **Convertir les balises stables.** Réutiliser les convertisseurs extraits
   pour `<img>` et `<svg>` vers `img`, `<sub>` vers `tag` et `<container>`
   vers `layout`. Convertir `<sound>` et `<video>` en `media` avec le `tag`
   `audio` ou `video`, le `src` résolu, le placement et les actions de lecture
   correspondant aux déclencheurs source. Choisir la synchronisation selon
   le rôle du média. Les médias qui pilotent la story utilisent `master`, et
   ceux qui suivent sa timeline utilisent `auto`. Pour une vidéo, rechercher
   si sa voix ou son signal sonore sert de référence aux événements de la
   story. Si ce rôle est ambigu, le signaler dans le rapport. Dans
   `02_acces/p01`, la vidéo déclarée à `volume="0"` suit la piste `<sound>`
   séparée. Les règles d’avancement et de persistance se traitent au niveau
   de la story. L’adaptateur résout le
   dialecte source et transmet les valeurs, IDs et références aux
   [profils V2](../../../codplay/specs/component-materialization-v2-spec.md).
   Voir les [modes et commandes média](../../../codplay/specs/media-sync-v2-spec.md).
   Valider le résultat avec le [builder](../../../codplay/specs/scene-authoring-spec.md).
5. **Analyser les appels et proposer des raccourcis.** Lire les appels
   depuis leurs points d’entrée XML, y compris leurs déclencheurs et, quand
   elle est accessible, la définition de la fonction appelée. Analyser le
   code source sans l’exécuter. Pour une cible résolue et des paramètres
   connus, convertir les formes GSAP simples (`set`, `fromTo`, `to` si l’état
   de départ est établi) en patch ou en transition `from`/`to` CodPlay.
   Associer les appels d’affichage et de masquage reconnus à une action du
   perso cible, déclenchée par un `eventime` si le temps est connu ou par le
   circuit live si le déclencheur est interactif. Conserver la distinction
   entre opacité, visibilité et retrait de la mise en page. Appliquer ces
   raccourcis lorsque le comportement de l’appel complet est compris. Si un
   tween participe à une routine propre au projet, documenter la routine
   entière sans en générer une traduction partielle ou un remplacement.
6. **Factoriser les interactions répétées.** Comparer les déclencheurs, les
   destinataires, l’ordre des effets et les conditions d’état. Quand ces
   relations se répètent, proposer une table de paramètres et générer les
   déclarations `emit` et `actions` dans le document auteur à partir de cette
   table. Préserver la provenance, les délais et les variantes de chaque
   entrée. Si la répétition dépend d’un état de consultation ou d’un média
   actif, réutiliser le circuit de story. Qualifier les sept boutons
   d’AS BTP `page_408` et comparer au comportement vérifié des cinq
   révélations de SPIE `page004`.
   Comparer les destinataires, l’ordre et les effets en Play, Seek et replay,
   avec un clic répété et deux interactions rapprochées. Garder les
   différences inexpliquées au bilan. Voir les
   [exemples du corpus](../notes/corpus-xml/synthese-corpus-xml.md#interactions-répétées).
7. **Produire le rapport de reprise.** Pour chaque cas laissé en suspens,
   indiquer le fichier et la ligne de l’appel ou de la déclaration, la page,
   la story et l’élément disponibles, l’extrait, le déclencheur et le résultat
   observable attendu. Relier le point d’appel à sa définition quand elle est
   trouvée. Décrire les effets et dépendances observés, les incertitudes et
   l’impact de l’écart sur la scène. Pour `Chrono`, relever le départ à
   l’apparition, l’évolution de la valeur et la mise à jour du texte formaté.
   Le rapport structuré, utilisable hors démo, distingue les cas convertis,
   les routines à reprendre et les blocages. Relever les interactions
   factorisables et leurs variantes. Repérer les quiz et évaluations à
   reconstruire et signaler toute transition de narration qui en dépend.
   Définir sur le corpus les écarts qui autorisent une sortie partielle.
8. **Valider l’indépendance et la couverture.** Sélectionner au moins deux
   pages réelles de narration par chapitre et ID via le même parcours de
   démo. Afficher les diagnostics dans le journal partagé. Sur des fixtures indépendantes,
   exercer deux thèmes pour les mêmes classes, les propriétés locales et leurs
   priorités, les polices et URL relatives, un tween GSAP et une action de
   visibilité reconnus, puis une routine du type `Chrono` signalée avec son
   origine et ses effets, sans action de substitution générée. Vérifier que
   l’élément stable est conservé quand seul son appel est à reprendre. Pour
   la vidéo de `p01`, vérifier le chargement, le démarrage au repère source,
   le rendu et le Seek dans le player partagé. Vérifier aussi un cas de vidéo qui conduit la story par
   sa voix ou son signal sonore. Mesurer les pages de narration rendues et
   les écarts par famille. Dénombrer séparément les activités reportées.

Après chaque tranche vérifiée, mettre à jour la spécification de conversion
avec le point d’entrée utilisé et les cas effectivement couverts.

## Reconstruction des quiz et évaluations — Reportée

- Reprendre les données pédagogiques du XML, dont l’énoncé, l’ordre des
  réponses, la correction, les médias qui portent le sens et les retours
  déclarés. Relever le barème, le seuil et les tentatives pour l’évaluation.
- Reconstruire les contenus avec le [bloc Question](../../../elce/specs/question-bdc-spec.md)
  et le [chapitre Évaluation](../../../elce/specs/chapter-evaluation-spec.md).
  Leurs modèles Elcé portent l’édition et les règles métier, avec leur
  projection CodPlay pour le parcours de réponse. Qualifier ultérieurement
  les écarts de modèles, dont les propositions illustrées de `06_quizz/q15`.

## Import direct de SAMERA dans Editor — À cadrer

- **Lecture commune, deux sorties.** Réutiliser l’analyse XML et la résolution
  des propriétés, textes, styles et ressources. Garder les séquences, délais
  relatifs, IDs et références entre éléments à cette frontière. La démo produit
  un `SceneDoc` depuis ces données. L’import Editor produit directement un
  `EditorScene` avec ses items, contenus, décors et keyframes. Le
  [Builder Editor](../../../editor/specs/editor-v2-integration-spec.md) produit
  ensuite le `SceneDoc` pour la preview. Les longueurs auteur restent en `cqw`.
- **Premier essai.** Importer la première séquence de `02_acces/p02` dans
  un `EditorScene` ordinaire, avec une timeline locale et un master. Comparer
  sa preview à la démo pour les images, le panneau de textes et le fondu du
  fond.
- **Départ commun, cas local.** Dans la troisième séquence de `p02`, à 4 s, l’entrée de
  `rain.png` et le changement d’opacité de `fond02` partagent le même départ.
  Le lecteur source encode ce lien en imbriquant un tween `targetItem` sous
  l’image. La démo actuelle produit deux occurrences au même temps. La sortie
  CodPlay cible est une occurrence et une action distincte sur chaque perso,
  avec sa durée propre. Pour la sortie Editor, vérifier si les keyframes de
  départ peuvent partager le [même marqueur auteur](../../../editor/specs/sequence-editor-v2-cues-markers-spec.md)
  et rester synchronisés quand ce marqueur est déplacé. Conserver les délais
  explicites quand le tween ciblé a un départ décalé. Rechercher les variantes
  dans le dictionnaire avant de proposer un regroupement comme règle générale.
- **Prérequis médias.** Raccorder l’import des fichiers au catalogue
  `media_resources` et lier leur identité stable au `Content.mediaId`.
  La [persistance Editor](../../../editor/specs/editor-sqlite-persistence-spec.md#limites-actuelles)
  couvre déjà le document et les références. L’import des octets et leur
  résolution après réouverture restent des prérequis.
- **Sections d’une scène.** Editor projette aujourd’hui un `EditorScene` en
  une seule `StoryDoc`. Pour garder `p02` sous une seule identité, étudier
  quatre sections ordonnées, chacune avec ses blocs, sa timeline et sa
  narration. Un sélecteur `Section 2 / 4` dans le layout présenterait la
  section active via le parcours actuel à une story. Préciser le stockage,
  la portée de l’historique, le partage des ressources et la lecture des
  documents à une section. Définir séparément la lecture enchaînée de la page.
- **Acceptation dans Editor.** Reprendre `02_acces/p02` et `02_acces/p01`
  pour couvrir la succession des narrations et la coexistence vidéo/son.
  Modifier un texte et un repère temporel, remplacer un média, vérifier
  Play et Seek, puis rouvrir les scènes depuis SQLite et retrouver les médias
  et les modifications. Sur `p02`, vérifier aussi l’ordre des quatre sections
  et qu’une modification en section 2 laisse intacte la section 1. Le rapport
  identifie les éléments dont la représentation auteur reste à traiter.

## Critères d’acceptation de la page `p02`

- Le XML intégré est exactement la page `p02`; ses quatre stories gardent leur
  ordre, leurs délais, leurs ressources, leurs textes et leurs tweens source.
- Chaque audio master conduit l'horloge de sa séquence; le début de la story
  suivante et `sequence:end` suivent la fin effective de la piste, sans avance
  de l'horloge liée au démarrage du média.
- À la fin du son, la story suivante commence et son image d'entrée est visible
  pendant son fondu de 500 ms avant que le stage précédent et ses éléments
  sans `duration` soient masqués; cela évite un frame de page vide. Le stage et
  les éléments sans durée de la dernière story conservent leur état visible à
  `sequence:end`. Les persos avec durée se masquent à leur propre échéance.
- La scène est acceptée par le builder et les ressources locales référencées
  existent.
- La validation utilise le player et le cycle de vie V2 partagés, avec Seek,
  Play, contrôle des transitions audio/visuelles et console navigateur.
- La spécification décrit seulement le mapping et le comportement effectivement
  exercés sur `p02`.
- Le panneau de la première story apparaît à la position source (`x=900`,
  `y=100`); textes et blocs restituent les couleurs, tailles, graisses, classes,
  marqueurs et styles hérités du thème source.
- Les icônes gardent leurs écarts visuels source et ne se chevauchent pas quand
  les illustrations ne se chevauchent pas dans la scène d’origine.

## Validation

- [x] SPIE `page004` dans Brave. Sur le player partagé, Seek reconstruit les
      canaux du nuage et l’état avant/après clic. Les cinq clics pendant Play
      révèlent les listes et interpolent les transformations et le `fill`.
      À 25 051 ms, la vue persiste. Replay et rechargement repartent des listes
      masquées. Le resize conserve les positions relatives et l’état cliqué.
- [x] SPIE : comparer au lecteur source la taille des dessins issus des SVG,
      les phases du globe, les clics répétés et le clic après la narration.
      Voir les [mesures SPIE](../../../demos/notes/spie-transmission-import-notes.md#comparaison-dans-brave).
- [ ] SPIE : aligner le cadrage SVG et le retrait du globe sur les mesures.
      Qualifier la trajectoire des titres.
- [x] SPIE : dans Brave, quatre listes ouvertes et un clic répété laissent la
      story active après la narration. La cinquième révèle son contenu puis
      termine la scène. Si les cinq listes sont ouvertes pendant la narration,
      la scène attend la fin du son. Le journal publie un `sequence:end` par
      cycle. Seek reconstruit les ouvertures et le replay les efface.
- [x] Typecheck V2 des démos.
- [x] Build de production des démos.
- [x] Tests de façade de l’import, incluant le build des sept persos et le
      player sur une image et deux segments.
- [x] Test du player sur les styles continus x/y :
      `packages/codplay/tests/runtime/runner-html/player-runner.spec.ts`
      (19 tests réussis).
- [x] Brave : scène source chargée; Seek à `1,5 s`, `3 s` et `5,25 s`; la pose
      de `circu02` progresse; Play atteint la durée native de `8,626508 s`.
      Les trois images et l’audio répondent; aucune erreur console d’exécution n’est relevée.
- [x] Palette observée avec les valeurs de repli du thème source; la sortie
      n’emploie pas de transformation `scale` sur les images.
- [x] Spécification alignée sur le XML source et les sept persos convertis de
      la première fixture motion.
- [x] Page p02 intégrée et compilée; le test façade couvre les quatre stories,
      leurs offsets audio, les frontières de masquage, le tween ciblé et le
      contenu traduit.
- [x] Browser Brave : Play, Seek aux transitions des stories 2 et 3, alpha
      tween cible, masquage des éléments sans durée après le fondu aux frontières
      intermédiaires, retour au début et rechargement de scène.
- [x] Ressources locales de p02 chargées; aucune erreur d’exécution dans la
      console. Le seul 404 observé concerne `/favicon.ico`.
- [x] Browser Brave après correction : panneau à `x=56.25cqw`, `y=6.25cqw`
      (`x=900`, `y=100` source); `is-flex-list` vertical, `bullet` flex et
      marqueurs rendus à 14 s dans le player partagé.
- [x] Typecheck et build après le portage des styles; Brave confirme Futura,
      poids 400, taille `h4`, couleurs héritées, fond/liseré Bulma et marqueurs
      dans les stories 1 et 2.
- [x] Typecheck et build après synchronisation master : Brave à ×1 confirme
      l'alignement horloge/audio, la transition sans frame vide (stages 1 et 2
      chevauchés pendant l'entrée de 500 ms), puis `sequence:end` à 74 710 ms
      avec le stage 4 et sa dernière image visibles. À ×2, la story 2 suit
      l'audio à 2× sans dérive.
- [ ] Comparer l’espacement et le chevauchement des icônes à l’affichage source;
      les styles calculés des textes et panneaux sont vérifiés sur le thème V1.

