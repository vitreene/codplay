# Corpus XML des projets standards récents

Le lot comprend **133 XML dans huit projets**. Les 132 fichiers lisibles
comptent **61 chapitres, 1 077 pages et 3 215 balises `<sequency>` directement
sous `<page>`**. Les 71 autres fichiers lisibles sont des configurations (16),
traductions (28), sous-titres (8) et sommaires (19).

## Liste des projets

Les huit dossiers de `projets standards recents` ci-dessous constituent le
corpus canonique pour généraliser les règles d’import et mesurer leur
couverture. Les chemins exacts sont dans `projects[].xml_roots` du
[dictionnaire](dictionnaire-corpus-xml.json). SAMERA et SPIE fournissent les
cas de référence des premières transcriptions.

| Projet | XML | Chapitres | Pages | `<sequency>` de page |
| --- | ---: | ---: | ---: | ---: |
| AMIANTE_2024 | 13 | 7 | 53 | 145 |
| AS BTP-INDUSTRIE-LOGISTIQUE | 26 | 8 | 357 | 1 277 |
| BRUIT | 11 | 6 | 45 | 107 |
| HALTE_AUX_CHUTES_2023 | 21 | 7 | 174 | 458 |
| PREVENROUTE_2021 | 20 | 10 | 179 | 577 |
| RISQUE_CHIMIQUE_2024 | 10 | 5 | 74 | 293 |
| ROUTEECO_2019 | 15 | 6 | 57 | 186 |
| TMS | 17 | 12 | 138 | 172 |

Le parcours retient les dossiers dont le chemin se termine par
`1-PROD/public/content/xml`, y compris celui de TMS sous `1-PROD/MULTIMEDIA`,
et le dossier `1-PROD_save2024/public/content/xml` d’AS BTP. L’index signale
la traduction polonaise d’AS BTP (`lang/pl.xml`) comme illisible à la ligne
1615. Une ouverture de section CDATA y est écrite `<![CDAT[` au lieu de
`<![CDATA[`. Les fréquences excluent ce fichier et comptent une seule fois
le `config/interface.xml` identique dans BRUIT et RISQUE_CHIMIQUE_2024.
Elles couvrent 131 documents distincts.

## Attributs et actions de perso

Le relevé détaillé couvre 577 `<tween>` de chapitre, 114 dans les
configurations, 76 attributs `destination` et 483 attributs de callback.
Les transpositions ci-dessous sont des recettes candidates. Elles partent du
perso qui doit changer, du fait qui déclenche le changement et de ses valeurs
dans le repère source. La sortie envisagée est une déclaration sur ce perso
avec `initial` pour la pose et `actions` pour les changements. Un temps connu
donne un `eventime`. Un clic donne une émission de story à laquelle les persos
concernés peuvent répondre par la même clé d’action.
[Scène auteur](../../../../codplay/specs/scene-authoring-spec.md) ·
[Actions temporelles](../../../../codplay/specs/action-sequence-tween-v2-spec.md) ·
[Émission HTML](../../../../codplay/specs/perso-emit-v2-spec.md)

| Attributs source | Transposition à qualifier | Condition ou écart à relever |
| --- | --- | --- |
| `properties`, `override`, `cssClass`, `cssStyle`, `textColor`, `textSize`, `backgroundColor` | Résoudre les propriétés et classes du projet. Reconstituer la présentation du texte ou du bloc, y compris couleur, taille et graisse. Porter les valeurs initiales dans le profil du perso et les changements dans ses actions. | `properties` apparaît 2 839 fois dans les chapitres. Les configurations contiennent aussi des tweens. Il faut résoudre leurs références et leurs priorités avant de produire la pose ou une transition. |
| `x/y`, `left/top/right/bottom`, dimensions, `centered`, `scale`, rotations | Reconstituer d’abord le repère et l’ancrage. Une animation de position peut fournir une transition `style.x`/`y` après projection. Une rotation 2D peut fournir `style.rotate`. | `x/y` d’un tween XML peuvent exprimer une position absolue, alors que les canaux `style.x/y` CodPlay sont des translations. Conserver le sens de `left/top`, des pourcentages et des expressions comme `m9m5p5Txt4 +h+50`. Les longueurs auteur destinées à Editor sont rapportées au canevas en `cqw`. |
| `alpha`, `effect`, `timeEffect`/`effectTime`, `effectTimeOut`, `effectEase` | Pour un effet identifié, déclarer les bornes et la durée sur les canaux du perso. Un `alpha` animé devient une interpolation d’opacité. Avec `time="0"`, le changement s’exprime comme une action instantanée. | Préserver la valeur de départ, le sens entrée/sortie et la courbe. La parité d’une courbe nommée doit être vérifiée. `fromRight,toBottom` porte deux intentions à qualifier séparément. |
| `delay`, `duration`, `showAfter`, `mustBeCompleted` | Donner à chaque action son point de départ et, selon le cas, sa fin de visibilité ou sa condition de progression. | Un délai d’élément, un délai de tween et le début d’une section ont des origines distinctes. La durée de visibilité d’un item, la durée d’une animation et la fin effective du média jouent des rôles différents. |
| `<tween>` et `destination`, avec `time`, `repeat`, `repeatDelay`, `yoyo` | Ramener les formes compatibles à des changements par canal, avec `from`, `to`, `duration` et une courbe vérifiée. Garder les étapes distinctes si elles partent à des temps différents. | Le corpus contient 48 `repeat` de tween, dont 7 à `-1`. Vérifier les répétitions, l’alternance et leur condition d’arrêt. `AMIANTE_2024/03_dta.xml:67` contient deux clauses `destination` séparées par `||`. Garder les deux clauses et vérifier leur chronologie côté lecteur. |

Voir les contrats de [transformation](../../../../codplay/specs/transform-properties-v2-spec.md),
[d’unités](../../../../codplay/specs/unit-values-v2-spec.md) et
[d’interpolation ACE](../../../../codplay/specs/ace-calculation-v2-spec.md).

## GSAP et appels métier

L’analyse syntaxique relève **57 appels `gsap.to` répartis dans 51 attributs**.
Le relevé distingue la forme de l’appel et ses arguments. Il trouve 20 appels
avec `duration` dans l’objet, 14 avec une durée en deuxième argument et 23
sans durée explicite. Dix-sept ciblent un tableau de sélecteurs et quatorze
utilisent au moins une valeur relative (`+=` ou `-=`). Les formes `set` et
`fromTo` restent candidates quand un autre lot les fournit. La démo SPIE
fournit déjà un exemple vérifié de traitement de `TweenMax.to` avec un clic.
[Spécification des transcriptions](../../../../demos/specs/course-motion-import-spec.md)

| Forme ou exemple | Traduction candidate |
| --- | --- |
| `gsap.to('#jauge_aiguille',{rotation:100,duration:2})` dans `PREVENROUTE_2021/09_eco_conduite.xml:592` | La déclaration de l’aiguille et les tweens précédents (lignes 584–586) donnent la pose candidate à la frontière. Si l’aiguille est toujours présente et revenue à 125°, l’apparition du texte déclenche sur ce perso `style.rotate: { from: 125, to: 100, duration: 2000 }`. Restent à vérifier le départ effectif et la courbe source. |
| `gsap.to(['#button2',…],0.3,{scale:0.38,opacity:0.6})` dans `AS BTP/04_obligations.xml:551` | Un fait de survol peut déclencher des actions de 300 ms sur chacun des boutons visés. Le fait de sortie a ses propres actions. Vérifier le support du déclencheur HTML et les départs quand les deux gestes s’interrompent. |
| Valeur relative, durée implicite, `autoAlpha`, saturation ou profondeur | Résoudre la pose précédente, la durée et la sémantique du canal avant de proposer un `from`/`to`. Des changements d’opacité et de visibilité peuvent être nécessaires ensemble. Signaler le canal, la valeur ou la phase qui reste indéterminée. |
| `showItem('correction1')`, `hideItem('zoneClick')`, `launchPopup(...)` | Décrire le fait métier émis et le perso ou la story qui répond. Pour rendre un item visible, déclarer l’action correspondante du côté du destinataire, au moment réel du déclencheur. Qualifier le cycle de la popup quand elle porte du contenu ou conditionne la progression. |
| `goNext()`, `gotoSummary()`, `exit()` | Décrire une demande de navigation adressée au parcours ou à son hôte. Identifier la destination et l’effet sur la lecture avant de la rattacher à une fin de story ou de scène. |
| `setRatingScore`, `setRatingScoreByStatus`, `toggleStatePropOnQuizz` | Relier l’émission au modèle de quiz et à son état de correction. Conserver les paramètres et vérifier le calcul du score ou la condition de réponse. |
| `playInterfaceSounds('ok')` combiné à `showItem('correction1')` dans `BRUIT/04_proteger.xml:107` | Le retour et la révélation peuvent répondre au même fait si leur entrée et leur synchronisation sont vérifiées. Le média porte l’action de lecture et le perso révélé porte le changement de visibilité. |
| `stopCurrentSequencyAction();startSequencyAction('casque')` dans `AS BTP/04_obligations.xml:551` | L’intention du clic est de remplacer le retour actif. Un événement métier peut porter `casque`, avec une réaction qui respecte l’ordre arrêt puis démarrage. Vérifier le retour média et le comportement des clics répétés. |
| Routine spécifique ou mutation DOM dans `onCreate` | Relever le déclencheur, les éléments lus ou modifiés et les effets attendus. L’agent peut proposer une réalisation adaptée, par exemple une valeur initiale si l’effet est uniquement statique. Une routine à effets liés reste une entrée entière du bilan. |

Pour un temps auteur connu, l’`eventime` porte directement le changement ou
les changements synchrones. Pour une interaction, `Perso.emit` fournit le fait
et `listen` intervient si une décision, une condition ou une émission dérivée
est nécessaire. Les actions et le journal portent les données de restitution.
Les attributs `onCreate`, `onShowForced`, `onHideForced` et `onStart` demandent
de qualifier leur phase source avant de choisir le circuit. Les 23 valeurs
`oneClick="Y"` sont des réglages de proposition, rangés dans les attributs.
Le relevé lit la syntaxe des expressions XML sans les exécuter.
[Pipeline et journal V2](../../../../codplay/specs/event-pipeline-v2-spec.md)

## Interpréter une cible

Le même import peut rencontrer une **cible d’effet**, un **point d’ancrage**,
un **destinataire métier** ou une **part d’un composant**. On résout d’abord
la référence dans le document source, puis on choisit le perso, la part ou le
groupe qui porte l’effet dans la scène. Une clé d’action commune permet aux
persos concernés de réagir au même fait. Pour un vrai contenant de placement,
vérifier le contrat `move` et le repère. Pour une forme interne d’un SVG,
le cas SPIE montre une transposition par `currentColor` sur le layout porteur.
[Contrat move](../../../../codplay/specs/move-v2-spec.md) ·
[Cas SPIE](../../../../demos/specs/course-motion-import-spec.md#page-spie-page004)

- **Dans une section.** 217 `targetItem` correspondent à un `id` explicite
  dans la même `<sequency>`. Au total, 216 des 234 `targetItem` sont contenus
  dans un `<sequencyAction>`. Dans `HALTE_AUX_CHUTES_2023/01_physiqueChutes.xml:200`,
  la réussite du quiz porte deux changements instantanés sur `quizNeutre` et
  `quizOk`. La recette candidate associe ces deux actions à la réussite, et
  rattache le retour sonore à ce même fait si sa synchronisation est vérifiée.
- **Entre sections.** Dix autres `targetItem` correspondent à un `id` d’une
  autre `<sequency>` de la même page. Dans `07_utilisationPIRL.xml:85`, `group1`
  est déclaré à la ligne 70 dans la section précédente. Il faut garder son
  identité et vérifier sa présence au temps du nouveau déclencheur avant de
  choisir comment le représenter entre stories ou sections Editor.
- **Référence calculée.** Les sept `targetItem` restants ont chacun un candidat
  par nom de fichier sans extension et aucun `id` XML correspondant. Dans
  `RISQUE_CHIMIQUE_2024/01_introduction.xml:528`, `112_02` correspond à
  `112/112_02.png`, déclaré à la ligne 521 avec `showAfter="Y"`. La page `page112`
  semble former une galerie où les images précédentes sont replacées à chaque
  nouvelle apparition. Vérifier la convention d’identité du lecteur puis
  conserver l’intention de la galerie avec les IDs de persos choisis.
- **Référence déclarative.** Les 75 `itemToShow` de propositions correspondent
  à un `id` dans la même section. La sélection de réponse fournit le fait et
  le perso révélé porte son action. Les trois `sequencyActionIfSelected`
  correspondent aussi à un `id` local, porté par une action de retour.

Le motif `<img>` avec un `<tween targetItem>` à délai absent ou nul apparaît
11 fois sur quatre pages. Le seul cas qui porte aussi `alpha`, dans
`07_utilisationPIRL.xml`, combine opacité et échelle d’un conteneur hérité de
la section précédente. Pour `p02`, le départ commun de l’icône et du fond peut
être porté par une seule occurrence avec une action distincte sur chacun des
deux persos. Le choix dépend du déclencheur et de l’effet observé pour le cas
considéré.

## Interactions répétées

L’analyse compare une interaction à partir de son déclencheur, des rôles
des cibles, de l’ordre des effets et des conditions d’état. Les identifiants,
ressources, délais et valeurs qui varient deviennent des paramètres si les
relations sont établies. Une boucle à la génération peut développer une
table lisible en déclarations `emit` et `actions`. Pendant la lecture, une
interaction réelle fournit le fait à journaliser et chaque perso destinataire
exécute son action. Les conditions de progression utilisent l’état de story.
[Scène auteur](../../../../codplay/specs/scene-authoring-spec.md) ·
[Pipeline événementiel](../../../../codplay/specs/event-pipeline-v2-spec.md)

| Exemple | Partie commune | Paramètres et points à vérifier |
| --- | --- | --- |
| SPIE `02-transmission.xml`, `page004`, lignes 106–110 | Cinq clics ouvrent chacun une liste, colorent une forme SVG et animent une icône. | Une entrée par cercle garde le délai, la liste, la forme, l’icône et ses valeurs. `c05` anime en 850 ms, avec une rotation de 45° et une échelle de 1,3. Les quatre autres durent 500 ms et tournent de −15° ou 15°. Conserver l’ordre de consultation libre, la prise en compte de chaque liste une seule fois et la fin après la dernière ouverture, ses transitions et l’audio. |
| AS BTP `04_obligations.xml`, `page_408`, lignes 551–563 et 574–594 | Sept boutons déclarent chacun le même survol et la même sortie sur les six autres boutons. Le clic demande l’arrêt du retour courant puis le démarrage de son propre retour. | Une entrée par bouton garde ses références, sa pose, son délai et son retour audio. Déduire les six destinataires à partir du groupe vérifié et du bouton survolé. Conserver les deux transitions de 300 ms et leurs valeurs. Vérifier les survols rapides, le remplacement du retour au clic et la signification de `mustBeCompleted` et `checkIfCompleted` côté lecteur. |

Ces deux cas servent à qualifier des recettes locales. Une règle générale
demande des exemples indépendants et un cas proche où une différence de
comportement oblige à garder une déclaration propre à l’élément.

## Variantes que les XML permettent de distinguer

| Forme observée | Répartition | Conséquence pour l’étude d’import |
| --- | --- | --- |
| `<data>` avec des `<page>` en enfants directs | 61 chapitres, 8 projets | La page est une unité d’inventaire commune aux huit projets. |
| Une ou plusieurs `<sequency>` directes | 430 pages en ont une, 584 en ont plusieurs | Les sections successives sont majoritaires. Il faut conserver leur ordre et leurs frontières. |
| `<page>` sans `<sequency>`, avec des `<sound>` directs | 63 pages de TMS, dans 6 chapitres | Les 176 `<sound>` concernés contiennent des éléments enfants et n’ont aucun fichier dans le texte ni attribut `src`. Le nom de la balise ne suffit donc pas à identifier un média ou une horloge. |
| `<sound>` et `<video>` directement sous `<sequency>` | 2 811 sections avec seulement `sound`, 126 avec seulement `video`, 66 avec les deux et 212 sans ces deux enfants directs | Le regroupement repère les sections à vérifier pour le choix du média directeur. La voix, la fin de lecture et la progression demandent une vérification du comportement source. |
| `<img>`, `<sub>`, `<container>` | Les trois balises apparaissent dans les 8 projets. On relève 557 conteneurs imbriqués sur 395 pages. | Cataloguer d’abord les éléments et leur hiérarchie. Les classes, propriétés, traductions et coordonnées restent à résoudre dans le contexte du projet. |
| `<quizz>` | 403 `choice` et 41 `true-false` sur 476 quiz. Parmi les `choice`, 151 déclarent plusieurs propositions correctes. | Les deux modèles couvrent 93 % du lot. Relever aussi l’ordre, les réponses, la correction et les renvois aux retours. `drag-drop`, `linking`, `slider`, `controllerItem` et `dropdown` forment le reste. |
| `<sequencyAction>` | 1 077 occurrences sur 353 pages, dans les 8 projets | Garder les actions déclenchées par une réponse ou un clic dans l’inventaire. Par exemple, une proposition référence `r1`, dont l’action joue son propre fichier audio. |
| Références d’animation | 1 579 `<snapFLA>` sur 349 pages et dans les 8 projets, dont 920 dans AS BTP. `<svg>` apparaît 7 fois et `<snapSVG>` 3 fois. | Étudier `snapFLA` tôt pour mesurer l’effort d’import. Le comptage des balises `<svg>` mesure leur écriture explicite dans le lot. |

Les répertoires servent à regrouper les formes observées. La version du
lecteur reste indéterminée avec les seules données inventoriées. Les marques
`scormVersion` relevées concernent le format de diffusion déclaré.

## Particularités d’AS BTP

Les 11 sommaires comprennent un sommaire principal et 10 variantes sous
`clients/`. Les attributs `profile`, `client` et `themeId` renseignent la
sélection et le regroupement des pages. Trois `<sequency>` déclarent aussi
`languageParameter="fr"` et `client="!fastt"` dans `03_risques.xml`, aux
lignes 1254, 1336 et 1418. L’inventaire doit garder ces conditions à leur
niveau d’origine pour pouvoir reconstituer un parcours client.

## Consultation du dictionnaire

- `documents` donne les chemins relatifs à la racine du corpus, le type de
  document et l’ordre des pages avec leurs lignes. `document_profiles` décrit
  les signatures des racines et de leurs enfants directs.
- `tags`, `paths`, `attributes`, `attribute_forms`, `attribute_sets` et
  `classes` recensent les formes par type de document. Les clés préfixées par
  `chapter |` isolent les chapitres.
- `motifs` donne les occurrences, pages de chapitre et fichiers concernés,
  avec les comptes par projet et des exemples sourcés. Les catégories de
  valeurs sont déduites de leur écriture XML.
- `references`, `declared_media_paths` et `declared_external_files` relèvent
  les valeurs de référence. Le lot contient 5 208 couples projet/chemin
  ressemblant à un média et 259 couples projet/chemin de données ou scripts.
  Les cibles restent à résoudre. Les exemples donnent le fichier, la ligne
  et la colonne de la balise ouvrante, numérotées à partir de 1.
- `action_evidence` enregistre les callbacks exacts, leurs appels et arguments
  dans l’ordre de lecture, les tweens et clauses `destination` rencontrés, et
  les références d’élément avec leurs candidats XML. Les lignes de section,
  le nom du bloc d’action englobant et les candidats par nom de fichier servent
  à retrouver le contexte. Les scripts référencés restent hors de cette lecture.

L’étude s’arrête aux XML. Les médias, styles et scripts référencés n’ont pas
été ouverts. Le lot n’a produit aucune scène et ne mesure pas encore la
couverture d’une conversion exécutable.

[Dictionnaire du corpus XML](dictionnaire-corpus-xml.json)
