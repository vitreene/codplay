# ELcé V2 — étude d’une organisation en mods

Date : 15 octobre 2026.

Étude préparatoire consolidée. La destination V2 et la progression générale
sont retenues ; les solutions techniques et les réalisations restent à
définir. Compléments : [adaptation Quiz Hunt](2026-10-15-quiz-hunt-adaptation-study.md),
[note Quest](2026-10-15-quest-mod-note.md) et
[étude DGS et frontières de la famille](2026-10-20-dgs-mod-study.md).

Le [sujet Mods](../index.md) réunit ces notes. La
[reconfiguration proposée](2026-10-20-elce-reconfiguration-study.md) décrit
la séparation du noyau, des ressources communes et des dispositifs du mod Learning. Le
[plan dédié](../plan/2026-10-20-elce-mods-reconfiguration-plan.md)
réunit les conclusions et les décisions retenues ou encore à préciser.

L’[étude technique Learning](2026-10-20-learning-extraction-study.md)
détaille l’analyse du code, les fichiers mixtes et les raccords envisagés.
Le v5 est le format de départ ; son évolution et la future fixation du format
de référence sont distinguées dans le plan unique.

## Intention et définition

Deux intérêts motivent les mods : raconter des histoires différentes avec un
outil auteur unique, Elcé, et confronter ces expériences pour mieux identifier
le cœur d’ELcé. Le mod Learning actuel ne définit pas à lui seul ce cœur.
La cohérence des interfaces auteur et le transfert des apprentissages sont
une justification centrale du choix des mods face à une suite d’applications.

Un mod est un ensemble cohérent de règles métier, modèles de chapitre,
layout, widgets et réglages. Il prend en charge les interdépendances que
l’auteur ne peut pas facilement composer lui-même. Il se distingue donc
du BDC composable et d’un simple canevas initial : sa cohérence doit être
maintenue pendant l’édition et la lecture.

Idéalement, le mod pourrait se limiter à une composition de modules capables
d’interagir. Ce cap lointain guide les choix actuels pour faciliter l’ajout de
fonctionnalités en préservant les usages existants. L’[étude des API internes](2026-10-20-mod-composition-internal-api-study.md)
propose une construction progressive à partir des façades, des machines à états
et des circuits existants. Les interfaces se précisent selon les besoins réels ;
les règles d’interaction entièrement déclaratives sont hors de portée de l’étude.

Le métier est toujours implémenté dans des classes TypeScript, appelées par
les machines ou les autres dispositifs concernés. Les façades raccordent les
intentions et l’interface assure leur présentation, sans implémentation métier.
Le scheduler DGS utilisera ainsi des classes ensuite employées par l’affichage.

Plusieurs mods peuvent être disponibles ; un document reste associé à un
seul mod. Le mod porte sur le projet entier. Ses réglages et modèles peuvent
évoluer ; son identité ne change pas. L’évocation d’un choix à la création
exprime conceptuellement le chargement des ressources nécessaires par un
noyau commun ; elle ne fixe pas l’interface définitive. Les
versions de définition, les données et le traitement des projets actuels
restent à préciser. La composition de plusieurs mods et leur remplacement
dans un document sont hors du concept retenu.

## Priorités et portée des exemples

L’utilisateur précise que Learning et DGS constituent ses intérêts prioritaires.
Quiz Hunt, Quest et le cours partagé sont des exemples secondaires ; certains
mods évoqués ne verront pas le jour. Leur étude éclaire les frontières sans
constituer un programme de réalisation de toutes ces expériences.

Le découpage doit permettre à tous les mods concernés de bénéficier d’une
évolution commune. Sa contrepartie est le coût de validation des usages et
configurations qui dépendent du composant modifié. Ce coût fait partie des
critères de pertinence de la mutualisation.

## Destination des projets et limite de cette étude

L’utilisateur précise que, à l’exception de DGS, tous les projets édités
dans Elcé ont vocation à être déployés dans un LMS après export compilé et
injection SCORM. Cette destination concerne le mod Learning, Quiz Hunt, Quest et
l’exemple de cours partagé. DGS conserve sa destination de diffusion TV.

Tous ces mods hors DGS suivent le même modèle : Elcé est l’application
auteur ; l’export compilé constitue le player exécuté dans le LMS ; le LMS
prend en charge l’enregistrement des apprenants et de leurs résultats.
Les règles de lecture du player restent propres au mod.
La compilation d’export, l’injection SCORM et le déploiement
LMS restent hors du périmètre de cette réflexion sur les mods. Cette
orientation de destination n’établit pas leur implémentation. L’[étude du
transit des données](2026-10-15-scorm-data-flow-study.md) reste une étude
distincte de la fabrication de l’export.

## Cohérence des interfaces et continuité d’apprentissage

L’utilisateur demande que les interfaces restent cohérentes d’un mod à
l’autre afin de faciliter l’apprentissage et la prise en main. Cette
continuité d’usage fait partie de l’intention produit des mods et des
critères qui doivent guider la séparation du cœur.

Un auteur doit pouvoir réemployer les repères et gestes appris dans un mode
lorsqu’il en découvre un autre. Les conventions communes à préciser concernent
notamment le vocabulaire, les commandes d’édition, la sélection des objets,
les réglages de BDC, les médias et les retours d’action. Les outils partagés
doivent conserver une logique d’utilisation cohérente au fil des modes.

Les surfaces propres à chaque mode, comme le calendrier DGS ou les relations
de Quest, introduisent les apprentissages nécessaires à leur métier en
s’appuyant sur ces conventions communes. L’auteur qui sait éditer une Carte
doit retrouver ce savoir-faire en DGS ; l’apprentissage nouveau porte alors
sur sa programmation et les contraintes de présentation propres à ce mode.
La forme précise de ces interfaces reste à concevoir.

Cette continuité constitue une valeur directe pour l’auteur, en complément
du réemploi des contenus et des mécanismes techniques. L’intérêt des mods
doit donc être évalué aussi par la facilité à passer d’un mode à l’autre.
Cette orientation n’est pas encore un comportement inter-mods implémenté
ou vérifié.

## Réemploi auteur entre modes

L’utilisateur précise que réutiliser signifie récupérer les contenus, puis
adapter leur présentation aux contraintes du mode destinataire. Par défaut,
les contenus et leurs BDC sont dupliqués : la copie devient indépendante de
la source et peut être remaniée par l’auteur. Cette orientation n’exige ni
présentation identique ni reprise du comportement de lecture d’origine.

Le partage éventuel des ressources reste à discuter. Une image pourrait être
commune à plusieurs projets, tandis que chaque BDC qui la présente serait
dupliqué et conserverait ses propres réglages. Cette possibilité ne décide
pas d’un stockage partagé ni d’une synchronisation entre contenus.

La compatibilité recherchée facilite la récupération de la matière éditoriale
et son adaptation avec les outils du mode destinataire. Les différences de
présentation font partie du travail auteur attendu. Le choix définitif du
mod d’un projet reste compatible avec cette circulation par copie. Aucun
circuit de copie entre mods n’est implémenté par cette étude.

## Cœur ELcé et spécialisations

La logique chapitre/page et celle de la plupart des BDC sont constitutives
d’ELcé. L’utilisateur distingue le Graphe statistique, sans décider son
extraction. Les mods doivent retrouver cette substance éditoriale, ainsi
que les circuits de commandes, références, médias et historique.

| Élément | Responsabilité commune à préserver | Spécialisation envisageable |
| --- | --- | --- |
| Chapitres et pages | Organisation documentaire, identités, contenus et relations cohérentes | Modèles de chapitre, rôles des pages et chemins de lecture. |
| BDC | Logique éditoriale et composable, ressources et intégration documentaire | Enrichissement du BDC commun ou variantes adaptées à un mod. |
| Interface auteur | Repères, gestes et conventions cohérents pour les outils partagés | Surfaces et réglages propres au métier du mod. |
| Règles | Mécanismes identifiés de conditions et références vérifiables | Faits métier, décisions et conséquences propres à l’expérience. |
| Lecture | Projection des contenus et utilisation de Sighty/CodPlay | Layout, widgets, navigation et politiques de progression. |
| Projet et test | Commandes, historique, sauvegarde, synchronisation et infrastructure de preview | Données de progression, réconciliation, reset et sens du test de page. |

Pour Question, enrichir le BDC et créer des variantes spécialisées sont deux
voies ouvertes. Une variante peut avoir ses données, son éditeur et son
builder ; elle n’est pas nécessairement un preset. Le choix dépend des
gestes auteur et des comportements, avec mutualisation des mécanismes
réellement communs. Un type unique n’est pas imposé.

Une capacité peut naître dans Quiz Hunt puis être réutilisée par Quest sans
devenir une fonction du cœur. Il faut identifier son propriétaire, ses
données, ses entrées, ses effets et ses dépendances ; sa localisation peut
évoluer. Partager un mécanisme temporel ne partage pas automatiquement les
règles de temps. Ce réemploi n’installe pas deux mods dans le document.

## Extensions envisagées et services applicatifs

Des BDC dédiés pourront intégrer des composants externes en s’appuyant sur
les capacités CodPlay prévues à cet effet. D’autres BDC pourront accueillir
des scènes préconçues, accessibles par un catalogue dédié et élaborées dans
un autre outil ; le projet `editor` est le candidat cité pour cette création.
Ce sont deux exemples d’extensions prévues, dont les BDC restent à concevoir.
Ils illustrent les ressources que les mods peuvent sélectionner, sans définir
une classification des extensions.

Les utilisateurs, les catalogues de ressources personnelles ou partagées,
le partage et les ACL sont des services applicatifs envisagés, hors du
périmètre de cette étude. La gestion des utilisateurs et des ACL participe
du chantier plus large d’un produit commercialisé : les droits d’accès
pourraient concerner des mods, des BDC ou des options avancées. Cette offre
et ses mécanismes d’accès restent à étudier dans ce chantier distinct. La
[frontière proposée](2026-10-20-elce-reconfiguration-study.md#extensions-envisagées-par-des-bdc-dédiés)
distingue leur fourniture de contenus, leur intégration par les BDC et leur
emploi par les mods. Ces extensions ne sont pas des prérequis à Learning/DGS.

## Ce qui relève du mod Learning

Les principaux candidats à l’extraction sont ses politiques d’expérience :

- le layout titre/contenu, le tiroir de Sommaire et précédent/suivant ;
- l’interprétation de l’ordre documentaire comme parcours principal ;
- la progression `endpage | free`, les pages terminées et prérequis ;
- l’offre Standard/Évaluation, ses réglages et contenus initiaux ;
- le score, les tentatives, reprises et issues du modèle Évaluation ;
- le déroulement profil → projection → Sommaire ou première page ;
- les créations auteur par défaut et l’interprétation actuelle de l’état test.

Les règles de calcul d’Évaluation peuvent évoluer et ne s’imposent pas aux
autres modèles de chapitre. Les propriétés typées, comparateurs et ET/OU
du profil ne doivent pas être emportés entièrement avec le Sommaire : leur
réemploi pour le dévoilement est à examiner. Flux/Diapo sont des rendus dont
le partage se discute séparément de l’appartenance des BDC au cœur.

Chapitres/pages et chemins de lecture sont distincts. Plusieurs chemins
peuvent rejoindre une même page sans dupliquer ses contenus. Une
représentation en graphe serait adaptée au non-linéaire ; le Sommaire
actuel représente le parcours ordonné du mod Learning. Le graphe auteur et une
éventuelle carte lecteur ont des rôles différents, notamment pour le
dévoilement. Leur forme et leurs gestes d’édition restent ouverts.

## Quatrième mode étudié : DGS

L’[étude DGS](2026-10-20-dgs-mod-study.md), ajoutée le 20 octobre 2026,
examine DGS comme canal de diffusion collective sur télévision. Le calendrier et les
séquences programmées y conduisent les passages entre pages et chapitres,
sans choix du public. Les interludes occupent les intervalles entre émissions.

Ce cas renforce la distinction entre la substance éditoriale commune et les
politiques de lecture : progression pour le mod Learning, règles de jeu pour Quiz
Hunt, découvertes et choix pour Quest, programmation horaire pour DGS.
Le réemploi auteur vise la récupération des contenus par copie, puis
l’adaptation de leur présentation aux contraintes DGS. Les BDC de destination
sont indépendants de ceux du projet source ; le partage éventuel d’images
reste une question distincte.
DGS sélectionne les contenus adaptés à une lecture autonome ; les contenus
exigeant une interaction du public sortent du périmètre étudié. La possibilité
d’une présentation question/réponse temporisée est laissée hors de cette
réflexion. Cette sélection, les durées et l’heure calendaire précisent les
frontières de la famille.

Cette analyse ne décide ni extraction technique ni réalisation DGS. Le
document v5 lie encore l’ordre éditorial et l’ordre de lecture ; la frontière
commune reste à construire. Le choix définitif du mod d’un projet et le
réemploi de contenus entre projets sont deux préoccupations distinctes.

## Autre exemple cité : cours partagé et réponses des participants

L’utilisateur ajoute un exemple de mod sans souhaiter le développer davantage
à ce stade : un cours partagé présente des Questions sur un écran principal.
Chaque participant dispose d’une application sœur pour répondre parmi les
choix fermés proposés. Le LMS enregistre les apprenants et leurs résultats.
Un mécanisme distinct collecte les réponses ; des échanges avec le mod
permettent l’affichage dynamique des résultats.

Les deux applications principales ont des rôles distincts : Elcé est
l’éditeur qui construit le cours dans ce mod ; son export compilé constitue
le player de diffusion exécuté dans le LMS. Ce player prend en charge les
interactions entre les joueurs et la plateforme pendant la lecture collective.
L’application des participants appartient au dispositif complémentaire de
participation.

Ce cas illustre une frontière supplémentaire : Elcé reste l’outil auteur,
avec les contenus et les conventions d’interface communs aux mods. Le player
issu de l’export échange avec le dispositif de participation et présente les
résultats. L’enregistrement des apprenants et de leurs résultats relève du
LMS ; le mécanisme de collecte des réponses reste distinct du cœur éditorial.
Le contenu du cours, les réponses des participants et les résultats d’une
diffusion relèvent de responsabilités distinctes.

La séparation entre application auteur et player est compatible avec le
concept de mod. La continuité d’apprentissage concerne les interfaces
d’Elcé adaptées aux différents modes ; leurs lecteurs peuvent avoir des
responsabilités adaptées à leur usage. Le cours partagé suit la destination
LMS commune aux projets hors DGS ; ses échanges avec la plateforme de
participation restent une responsabilité distincte. Aucun protocole, format
d’échange ou programme de réalisation n’est défini par cet exemple.

## Appui réel sur Sighty

La [spécification Sighty](../../../sighty/specs/authoring-library-spec.md)
décrit les capacités actuelles. L’approche doit prolonger ses circuits,
sans second routeur, catalogue runtime ou bus d’événements.

| Besoin | Capacité existante et limite |
| --- | --- |
| Raccord du métier | Sighty accepte des fonctions dans `scenario.actions` et `scenario.guards`, enregistrées ou inline. Pour Elcé, ces raccords appellent les classes TypeScript qui implémentent le métier. Les gardes lisent sans modifier l’état. |
| Faits de lecture | Le handler dispose de `updateContext`. Ce changement ne navigue pas et ne reprojette pas automatiquement les scènes ; `data` reste une donnée auteur statique. |
| Disponibilité et présentation | `scenarioState.canAccess/canExit` réutilise les gardes ; `entry` et `send` livrent des événements de scène. `send` ordinaire vise les scènes actives ; les bindings sortis sont fermés. |
| Parcours dynamique | `runtime.mutate` ajoute/modifie/retire/masque/affiche des vues selon une politique explicite. Une source déclarée peut être résolue à l’admission, puis mise en cache. L’ajout au catalogue d’une définition inconnue après initialisation n’est pas établi. |
| Portées | Une garde locale remplace celle héritée ; les actions sont résolues par priorité. Ni cumul implicite des gardes ni diffusion à toutes les règles. |

`canAccess` ne décide pas de la visibilité, n’applique pas `onDenied` et ne
réévalue pas l’accès d’une sélection déjà active. Les mutations ont leur
rollback ; une suite contexte/mutation/envois n’a pas de transaction globale
garantie. Une transition concurrente pendant `changing` est rejetée.

Le langage de règles proposé concerne d’abord l’expression auteur de
conditions et conséquences, traduites dans ces ports. Les comparaisons
existent déjà dans [profile-rules.ts](../../src/domain/summary-profile/profile-rules.ts).
Les règles et décisions métier sont implémentées dans des classes TypeScript,
appelées par les machines et les autres raccords concernés. Un état durable
identifié facilite sauvegarde et reset ; son propriétaire reste explicite.

## Frontières Sighty relevées par l’étude

**Décision puis navigation.** Aujourd’hui `go` précède le handler ; une route
refusée n’exécute pas ce dernier. Une interaction « valider et poursuivre »
ne peut donc pas modifier le contexte avant la garde de sa propre route.
Une garde peut parfois décider depuis l’événement, mais cela ne règle pas
tous les effets métier ou les données nécessaires à l’entrée. L’évolution
éventuelle doit distinguer effets autonomes et effets conditionnés à la
transition : un indice peut rester acquis après refus, une dépense peut
dépendre du franchissement. L’ordre actuel est spécifié, pas un défaut
d’implémentation établi.

**Mutation depuis une décision.** `mutate` est une API runtime, absente du
contexte du handler. La lecture du [contrôleur](../../../sighty/src/runtime/controller.ts),
du [navigation manager](../../../sighty/src/runtime/navigation-manager.ts) et
du [coordinateur](../../../sighty/src/runtime/operation-coordinator.ts) signale
une dépendance circulaire potentielle si un handler attend une mutation
publique placée derrière lui dans la même file. Ce cas reste à reproduire ;
aucun contrat de réentrance n’est acquis.

**Neutralisation.** La scène continue d’exister sans être visible. Il faut
préciser ce qui subsiste : définition, occurrence, état local, temps et
liaison d’événements. `hide-view` conserve la déclaration, mais une occurrence
inutilisée peut être détruite ; une sortie logique ferme la liaison et
suspend la lecture sans imposer le démontage ; un masquage visuel seul ne
suspend ni temps ni événements. Ce n’est pas un nouveau `showMode` décidé.

Les [tests runtime existants](../../../sighty/tests/runtime-features.spec.ts)
couvrent notamment ajout de vue dynamique, masquage, contexte et accès.
Ils ne certifient pas encore une intégration de règles de mods.

## Reconfiguration et frontières documentaires

La progression retenue — besoins Sighty nécessaires, extraction du mod Learning,
puis réalisation des mods — est reprise dans le
[plan de reconfiguration](../plan/2026-10-20-elce-mods-reconfiguration-plan.md).
Ses propositions techniques restent à relire. Les plans Sighty conservent
la responsabilité des changements runtime ; cette étude n’autorise aucun
changement CodPlay.

La nouvelle étude de reconfiguration décrit les raccords au document, aux
commandes, à l’interface, aux ressources et au lecteur. L’adaptation Quiz Hunt
conserve les constats propres au jeu.

Le [document actuel v5](../../specs/document-model-spec.md) ne porte pas de mod
et rejette les versions antérieures. Identité du mod, version de définition
et version documentaire sont distinctes. Le choix définitif demande un
contrôle dans les commandes, l’historique, la copie et la transaction serveur
de remplacement, ainsi qu’un aller-retour effectif SQLite. Avant la fixation
du format de référence, les données d’essai sont recréables en cas de changement ;
les évolutions ultérieures demanderont un traitement des données existantes,
suivi au plan. Un mod inconnu ne doit pas être supposé Learning.

L’[état test](../../specs/summary-profile-spec.md#état-test-auteur-et-serveur)
est séparé du document et utilise déjà révisions/ETags. Son contenu métier
et sa réconciliation devront correspondre au mod. La reprise intersessions
d’une partie reste à choisir ; elle est distincte de la sauvegarde du projet.
Le sens de la page de départ et de la synchronisation de la
[preview](../../specs/player-preview-spec.md) est également à préciser.

## Critères d’intérêt de l’organisation

Le coût initial de séparation, le travail métier propre à chaque mod et le
coût récurrent de l’organisation doivent être distingués. Le critère retenu
est qu’un nouveau mod concentre le travail sur son expérience. Des reprises
larges et répétées du document, de l’éditeur, du lecteur et de la persistance
signaleraient une frontière insuffisante.

La cohérence des interfaces auteur et la continuité d’apprentissage sont
des critères centraux de l’intérêt des mods. L’alternative d’applications
distinctes partageant des modules doit être évaluée sur cette même exigence.
La valeur doit apparaître dans la facilité de prise en main d’un nouveau
mode, dans le réemploi des contenus et dans les évolutions communes des outils.
Un changement du noyau bénéficie à l’ensemble des mods qui l’utilisent ; un
changement d’une ressource bénéficie aux mods qui la sélectionnent. La validation
doit suivre ces dépendances et leurs interactions. Les modules communs ne
suppriment pas les preuves d’intégration propres à chaque mod concerné.
La découverte du cœur reste utile même si une intégration est écartée.
Aucun gain de coût ni délai de réalisation n’est démontré à ce stade.

Les décisions encore ouvertes, l’ordre des travaux et les preuves attendues
sont centralisés dans le plan dédié. La validité permanente des références
et la complétude nécessaire pour jouer restent deux notions distinctes.

La séparation ne termine pas les fonctionnalités déplacées : les raccords
Recommencer/Relire et la visibilité des réponses d’Évaluation restent
incomplets selon la [spécification actuelle](../../specs/evaluation-machine-spec.md).
Les spécifications continuent à décrire les comportements vérifiés. Cette
étude n’a modifié aucun code ni exécuté de validation d’intégration.
