# DGS — affichage collectif et frontières de la famille Elcé

Date : 20 octobre 2026.

Étude exploratoire du quatrième mode proposé : digital signage, abrégé DGS
dans cette conversation. Elle prolonge l’[étude des mods](2026-10-15-elce-mods-study.md),
l’[adaptation Quiz Hunt](2026-10-15-quiz-hunt-adaptation-study.md) et
la [note Quest](2026-10-15-quest-mod-note.md). Elle ne fixe aucun cahier des
charges, format documentaire, API ou programme d’implémentation.

DGS fait exception à la destination LMS retenue pour les autres projets
édités dans Elcé, après export compilé et injection SCORM. Ces étapes restent
hors du périmètre de la réflexion actuelle ; DGS conserve sa destination de
diffusion TV. Cette exception ne décide pas de sa propre chaîne d’export.

## Intention exprimée

Le mode DGS est un canal de diffusion TV. Les contenus sont regardés
collectivement ; le public n’interagit pas directement avec le lecteur et
ne choisit pas son parcours.
Un module de programmation remplace le Sommaire dans l’organisation de la
diffusion. Il combine un gestionnaire de pages et chapitres avec un calendrier.
Les contenus sont listés sans liens de navigation entre eux.

Les contenus dont le déroulement exige une action du public sortent du
périmètre DGS étudié. La possibilité de présenter une question puis sa réponse
après un délai de réflexion est laissée hors de cette réflexion. L’étude des
frontières communes n’impose pas d’adapter chaque contenu interactif à DGS.

Dans la construction envisagée, le scheduler fera appel à une ou plusieurs
classes TypeScript, ensuite employées par l’affichage. Le métier reste dans
ces classes ; le scheduler coordonne et l’affichage présente leurs résultats.
L’interface ne réimplémente pas les règles de programmation ou de diffusion.

Un contenu porte sa durée, ou sa durée est réglée par le scheduler. Une
séquence de diffusion organise un groupe : page 1 pendant 30 secondes,
chapitre A joué trois fois, puis page 2 pendant 45 secondes, par exemple.
Cette séquence peut être programmée à 8 h 45, 9 h 30 et 11 h 20, avec une règle
telle qu’un jour sur deux. Le calendrier organise les enchaînements entre
séquences ; celles-ci organisent leurs contenus internes. La même page peut
être référencée dans plusieurs passages sans devenir plusieurs contenus.

Une séquence peut aussi présenter plusieurs scènes en parallèle dans les zones
d’un même layout. Elle se termine lorsque chacune de ces scènes a signalé sa
fin de lecture. Cette [condition collective](2026-10-20-sequence-scheduler-study.md#fin-collective-dans-un-layout-à-plusieurs-zones)
complète les règles d’enchaînement successif et de durée imposée.

Le calendrier a par défaut un rythme hebdomadaire. Plusieurs calendriers,
par exemple semaine 1 et semaine 2, sont envisageables. La diffusion peut
commencer ou s’arrêter à une heure arbitraire dans une plage. Entre deux
émissions, un interlude présente typiquement un flux vidéo ou un Carousel
d’images. La sélection des calendriers, leur éventuelle alternance et le
comportement hors plage ne sont pas définis par ces exemples.

L’utilisateur précise ensuite la distinction entre un module `sequence`,
pour les boucles et règles d’enchaînement locales, et `scheduler`, pour leur
projection temporelle. L’[étude dédiée](2026-10-20-sequence-scheduler-study.md)
propose leurs responsabilités, leur modèle de données et leur composition
dans un mod. Leur contrat reste à discuter ; l’autonomie de `sequence` sans
calendrier est explicitement laissée ouverte.

## Plusieurs récepteurs pour un même projet

Le même projet DGS peut alimenter plusieurs récepteurs dans une salle, avec
des parties distinctes d’un même propos. L’association de chaque système de
diffusion à l’adresse d’un scheduler du projet détermine sa programmation.
L’[étude sequence/scheduler](2026-10-20-sequence-scheduler-study.md#diffusion-uniforme-et-diffusion-par-destination)
examine un module supplémentaire d’affectation, avec calcul serveur selon
l’heure locale de chaque récepteur.

Une [interface d’affectation des diffuseurs](2026-10-20-sequence-scheduler-study.md#identifier-les-diffuseurs-et-leur-affecter-un-programme)
permettrait de nommer « TV entrée » et « TV salle », de leur attribuer un
programme et de suivre leur présence. L’étude compare la configuration locale,
la déclaration suivie d’une association depuis l’administration et la préparation
de fiches avant installation. Le parcours reste à choisir.

L’étude conserve un même mod DGS. « Diffusion uniforme » et « diffusion par
destination » restent deux déclinaisons commerciales possibles ; leur
séparation éventuelle en mods distincts n’est pas décidée techniquement.

## Ce que DGS révèle du cœur commun

L’utilisateur confirme Learning et DGS comme intérêts prioritaires. Les
autres propositions restent secondaires et certaines ne seront pas réalisées.
La comparaison Learning/DGS doit donc guider en premier lieu le partage des
ressources et l’évaluation de son coût de validation.

Les quatre propositions constituent une famille cohérente de création et de
présentation de contenus. Elles emploient des objets éditoriaux voisins,
mais la décision d’afficher la suite change de propriétaire métier.

| Mode | Ce qui conduit les passages | Sens principal de l’état de lecture |
| --- | --- | --- |
| Learning | Ordre de lecture, navigation et contraintes de progression. | Profil, pages terminées, réponses et Évaluation. |
| Quiz Hunt | Choix d’épreuve et règles de jeu. | Tirage, succès, panier, temps et verdict. |
| Quest | Découvertes, choix et conséquences du récit. | Faits acquis, passages ouverts et choix pertinents. |
| DGS | Calendrier et déroulement des séquences programmées. | Diffusion courante, position dans une séquence et répétitions pertinentes. |

Le noyau plausible rassemble les BDC et leurs ressources, la construction
des vues, les identités et références, les commandes et leur historique,
les moyens de sauvegarde, ainsi que l’utilisation de Sighty/CodPlay. Les
éditeurs de contenu peuvent être largement communs. L’outil d’organisation
doit pouvoir présenter un Sommaire, des relations de jeu, un récit ou une
programmation selon l’expérience choisie. Le sens de chaque état reste propre
au mode, même si ses moyens d’enregistrement sont partagés.

La [cohérence des interfaces auteur](2026-10-15-elce-mods-study.md#cohérence-des-interfaces-et-continuité-dapprentissage)
est une justification centrale des mods. Les repères et gestes appris dans
les autres modes doivent faciliter la prise en main de DGS. L’auteur retrouve
les conventions des outils de contenu et apprend les fonctions propres à la
programmation TV. Le calendrier apporte sa surface métier en s’appuyant sur
cette continuité d’usage.

DGS renforce la distinction entre organisation des contenus et conduite de
leur lecture. Un chapitre peut regrouper des pages sans imposer la lecture du
chapitre suivant. Un ordre interne de présentation peut rester utile sans
devenir le parcours global de tous les modes.

Cette frontière est une cible d’étude. Le
[document actuel v5](../../specs/document-model-spec.md) donne effectivement à
`scenarioEntries` et aux ordres internes des chapitres le rôle de déterminer
l’ordre de lecture. Il porte aussi Sommaire et profil. L’Elcé actuel n’est
donc pas déjà un noyau indépendant des règles du mod Learning. L’extraction étudiée
doit préserver son comportement vérifié tout en attribuant cette politique
au mod Learning. Aucun changement de ce contrat n’est réalisé ici.

## Réemploi auteur et adaptation des contenus

Le [réemploi entre modes](2026-10-15-elce-mods-study.md#réemploi-auteur-entre-modes)
signifie récupérer les contenus par copie, puis adapter leur présentation.
Les BDC de destination sont par défaut des copies indépendantes. L’auteur
peut les remanier sans modifier les BDC du projet source. Le partage éventuel
d’une image comme ressource reste à discuter ; il ne change pas cette
indépendance des BDC et de leurs réglages.

Une Carte de communication récupérée dans un projet DGS peut ainsi recevoir
une autre mise en page ou une autre durée. Le texte d’une longue Section Flux
peut être récupéré puis réparti par l’auteur dans des présentations adaptées
à la télévision. Ces adaptations font partie du réemploi attendu. La
compatibilité recherchée facilite la récupération de la matière éditoriale
et son édition dans le mode destinataire ; elle n’exige pas la conservation
de la présentation ou du comportement de lecture du projet source.

La récupération d’un BDC composite concerne aussi ses enfants et les
ressources nécessaires à ses contenus. Certains contenus dépendent de
propriétés de profil ou de faits du mode d’origine : leur traitement doit
être compréhensible pour l’auteur qui adapte la copie. Les modalités de copie,
de traitement des dépendances et de récupération d’un type non proposé par
le mode destinataire restent à étudier. Aucune conversion automatique n’est
déduite de l’objectif de compatibilité.

La copie entre projets et les programmations multiples dans un projet DGS
ont des rôles différents. Une même page DGS peut rester référencée dans
plusieurs passages du calendrier sans être dupliquée à chaque diffusion.
Les passages ont leurs réglages et leur position de lecture ; leur forme et
le nombre d’occurrences runtime à conserver ne sont pas décidés. Aucun
circuit d’import entre mods n’est établi à ce stade.

## Temporalités et responsabilités

DGS articule l’heure du calendrier, la durée de présentation d’un contenu,
le temps logique d’une scène et le temps du média. Cette articulation permet
de partager les mécanismes pertinents sans donner au calendrier le contrôle
de chaque animation ou reconstruire un second transport vidéo.

La durée éditoriale d’un contenu et celle d’un passage programmé ont des rôles
distincts. Régler une page à 30 secondes dans une séquence peut laisser sa
durée propre disponible pour d’autres passages. La politique lorsqu’un
contenu dépasse cette durée ou finit plus tôt reste à définir.
La durée d’un chapitre dépend aussi du déroulement de ses pages ;
une durée finie ne se déduit pas de tout chapitre existant.

Une séquence DGS s’entend ici comme une organisation auteur de références à
des pages et chapitres, avec des passages successifs ou une composition par
zones. Ce niveau ne se confond ni avec la séquence du player CodPlay,
ni avec le BDC séquence envisagé pour l’intérieur d’une Diapo. La proximité
des mots ne démontre pas qu’un de ces circuits fournit le besoin DGS.

Comme pour les autres projets Elcé, les données auteur persistées sont
transformées par les builders et contributions du mod pour produire un
scénario Sighty, des scènes CodPlay, des actions et des guards. Le format de
séquence enregistré en BDD et cette production de lecture sont distincts.

Le scheduler est un module métier DGS : il interprète la programmation. Le
scénario produit, ses actions et guards conduisent la lecture et ses changements,
tandis que CodPlay garde les scènes, le
transport et le rendu. L’absence de choix du public laisse toute sa place à
ce circuit de passages automatiques. Le calendrier ne justifie pas un second
routeur, un catalogue runtime dupliqué ou un accès direct au DOM des médias.

L’orientation demandée pour
l’[état de lecture](2026-10-16-reading-state-ownership-study.md) reste
pertinente : son pilotage doit se faire au niveau du scénario Sighty, avec
des modules métier et techniques appelés par ce circuit. Le calendrier auteur
est une donnée de projet ; la diffusion courante est un état d’exécution.
La fenêtre d’affichage n’a pas à posséder cette logique. Le raccord des
échéances calendaires au cycle Sighty reste à définir.

## Appuis réels et limites actuelles

La [spécification Sighty](../../../sighty/specs/authoring-library-spec.md)
établit les routes explicites, les actions, le contexte et la réadmission des
scènes. Ces capacités permettent d’envisager une lecture automatique. Elles
ne certifient pas un ordonnanceur calendaire. Les transitions concurrentes
pendant `changing` sont rejetées : une échéance pendant un changement de vue
demanderait donc une politique explicite, sans file de compensation locale.

Les [builders Diapo](../../specs/diapo-scene-builder-spec.md) signalent notamment
`elce:page:finished` dès l’apparition du marqueur d’une Carte ou à l’apparition
de la dernière Carte du Carousel. Ce signal
sert la progression du mod Learning. Il ne mesure pas le temps nécessaire à la
diffusion complète : la dernière Carte vient seulement d’apparaître. Le
réutiliser comme échéance DGS écourterait certains contenus.

Le [Carousel](../../specs/carousel-bdc-spec.md) fournit déjà un déroulement
automatique à durées et répétitions finies. Il constitue un appui réel pour
le contenu des interludes. Le maintien d’un interlude jusqu’à une échéance,
son interruption et son éventuelle reprise ne sont pas certifiés par ce seul
comportement. La séquence DGS peut réutiliser les contenus et mécanismes
adaptés sans devenir un Carousel de pages.

Les vidéos Elcé utilisent actuellement le
[mode média indépendant](../../../codplay/specs/media-sync-v2-spec.md) et le
[STOP de sortie de page](../../specs/player-preview-spec.md#lecture-des-vidéos-et-sortie-de-page).
Leur temps n’est donc pas la durée de la scène. Le démarrage autonome,
l’interruption et les répétitions DGS demanderaient leur propre acceptation
sur le circuit média existant. Si « flux vidéo » désigne un direct, la
[décision média correspondante](../../../codplay/plan/media-preload-plan.md#décision-acceptée-application-non-planifiée--source-média-en-direct)
reste acceptée mais non appliquée. Une vidéo enregistrée ne certifie pas ce cas.
De même, le callback `schedule` du
[plan Player](../../../codplay/plan/player-engine-plan.md) ne constitue pas un
calendrier DGS établi.

## Contraintes qui pèseront sur le rapprochement

Le temps calendaire introduit des décisions que les autres modes peuvent
ignorer : que diffuser après un démarrage à 8 h 47 pour une émission prévue à
8 h 45, comment traiter un dépassement, et comment rejoindre la programmation
après une interruption. Une position de Seek ne suffit pas à décider quelle
émission diffuser après une arrivée tardive ; elle ne permet pas non plus de
reconstituer un direct passé.

Une alternance stricte un jour sur deux change de jours de semaine la semaine
suivante. Une grille hebdomadaire répétée à l’identique ne suffit donc pas ;
un cycle de plusieurs semaines ou une récurrence datée pourrait l’exprimer.
Posséder plusieurs calendriers ne définit pas encore lequel s’applique.
Ces questions précisent le domaine DGS sans justifier leur entrée dans le
cœur commun.

Le fonctionnement sans présence humaine et la lecture continue donnent
aussi plus de poids au cycle de vie des scènes, à la disponibilité des médias
et à la stabilité sur la durée. Ce sont des besoins à éprouver sur les
circuits réels. Le pilotage d’un parc d’écrans, leur synchronisation ou leur
alimentation ne sont pas des besoins établis dans cette proposition.

La famille reste cohérente si les évolutions communes améliorent effectivement
la création des contenus et leurs outils, tandis que chaque mode possède ses
règles de conduite. Le bénéfice diminuerait si chaque mode devait redéfinir
les BDC, copier les builders ou reprendre largement commandes, historique
et persistance. Imposer partout les parcours du mod Learning ou un moteur universel
de règles ferait porter leurs contraintes aux autres modes.

Un indice concret de validité serait de copier une Carte, puis un Carousel,
depuis un projet d’un autre mode vers DGS, d’adapter les copies avec les
outils communs et de vérifier que la source reste indépendante. Le traitement
des médias suivrait la politique à décider. Sauvegarde et présentations
réelles avec Sighty/CodPlay permettraient ensuite d’éprouver ce réemploi et
la frontière commune. La prise en main devrait aussi montrer que l’auteur
retrouve ses repères d’édition en passant à DGS et concentre son nouvel
apprentissage sur la programmation TV. Aucune tranche d’implémentation n’est
décidée par ces exemples.

L’analyse soutient un cœur éditorial partagé et des modes spécialisés avec
des interfaces auteur cohérentes. Cette continuité d’apprentissage est une
raison majeure de privilégier des mods face à une suite d’applications.
L’organisation technique doit soutenir cet objectif. Le partage de
Sighty/CodPlay seul ne démontrerait pas l’intérêt des mods. Aucun gain chiffré,
support DGS opérationnel ou compatibilité automatique entre mods n’est démontré.

Cette étude a relu les contrats et études cités. Elle n’a modifié aucun code
ni exécuté de test, build ou validation navigateur. Les spécifications et
les statuts d’implémentation restent ceux des travaux déjà suivis.
