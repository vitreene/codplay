# Elcé sommaire profils contraintes et qualifications

## Objet

L’extension proposée personnalise les parcours de lecture à partir d’un profil
renseigné par le lecteur. Le Sommaire devient aussi la surface auteur pour
configurer la présentation du projet et les contraintes de ses chapitres et
pages. Les BDC peuvent recevoir des contraintes similaires et leurs contenus
peuvent reprendre des valeurs du profil. Les qualifications étendent ce besoin
à un dévoilement progressif fondé sur la progression et les résultats.

Le cadrage fonctionnel a été traduit en étapes dans le
[plan Sommaire et profils](../plan/2026-10-14-elce-sommaire-profils-plan.md).
Les formats internes sont intégrés pour relecture ultérieure ; la spécification
dédiée conserve les comportements implémentés et vérifiés.

L’[étude des raccords](2026-10-14-sommaire-profils-etude-raccords.md) conserve
les raisons des frontières techniques retenues. Les formats internes et la
validation restante sont suivis dans le plan dédié.

L’[inventaire technique](2026-10-14-sommaire-profils-inventaire-technique.md)
conserve le relevé des tables, interfaces et formats étudiés.

## Périmètre fonctionnel

Le Sommaire est unique et spécial, situé au niveau supérieur du projet et hors
de l’ordre précédent/suivant. Son interface auteur contient le titre, la
description, une image de fond et deux options
d’affichage non exclusives : dans la zone menu du layout général et comme
page racine du projet. Les deux présentations portent les mêmes informations.
La première présentation racine contient un bloc de liste défilant, disposé
en colonnes sur une page. L’auteur choisit d’afficher uniquement les niveaux ou
également les pages. En mode « niveaux seuls », les chapitres sont affichés sans leurs
pages internes ; les pages autonomes de la racine restent visibles.

Après validation du profil au lancement normal, la consultation commence sur
le Sommaire racine s’il est activé ; sinon elle commence sur la première page
retenue.

À la fin d’un chapitre, l’auteur choisit entre rejoindre la première page du
chapitre suivant et revenir au Sommaire. Dans ce dernier cas, le bouton porte
le libellé « Sommaire » plutôt que « Suivant ».
L’option de retour au Sommaire exige sa présentation racine ; elle n’ouvre pas
le menu comme destination de remplacement.

L’auteur choisit un paramètre « accès permanent au Sommaire ». Lorsqu’il est
activé, le lecteur peut y revenir pendant un chapitre sans terminer la page
courante ; ce retour ne valide ni page ni chapitre. En mode « niveaux seuls »,
cliquer un chapitre ouvre sa première page retenue si son accès est autorisé.

L’auteur choisit par une option quelles propriétés apparaissent dans la page
Profil. Cette page collecte plusieurs valeurs sans correction ni score ; le
choix intégré est un Formulaire séparé du BDC Question. Elle peut être omise
lorsque toutes les données nécessaires au profilage sont obtenues par une
évaluation. Les règles testent directement les propriétés ; aucun profil nommé
regroupant des conditions n’est prévu.
La page Profil peut demander un pseudo, un âge, un genre grammatical ou des
choix tels qu’une catégorie de métier et des habilitations. L’auteur définit
pour chaque propriété un type texte, nombre, choix multiple ou choix unique,
un terme, un libellé et, le cas échéant, les libellés des choix. Le genre
grammatical concerne les accords masculin/féminin, sans civilité.

Le lecteur renseigne son profil initial une fois pour toute la consultation et
ne peut pas le modifier manuellement pendant celle-ci. Un changement manuel
nécessiterait de recommencer entièrement la consultation ; cette possibilité
est hors périmètre actuel. La future qualification par évaluations pourra
compléter ou remplacer ces mêmes propriétés ; elle est différée.
Le filtrage par profil est une règle de masquage à la construction de la
consultation. Il définit un ensemble stable de contenus retenus ; les accès
évoluent ensuite selon les conditions de lecture. Le lecteur construit cette
projection une seule fois pour le Sommaire, les scènes, les routes et
l’Évaluation ; le contrat vérifié est dans la spécification dédiée.

Depuis le Sommaire, l’auteur définit des contraintes au niveau des pages ou
des chapitres. Toutes les pages sont visibles par défaut. Les contraintes de
profil autorisent ou interdisent selon un choix, une comparaison numérique
ou l’égalité/différence avec un texte.
Une contrainte de profil est une condition d’accès ; le refus est généralement
présenté par le masquage. Masquer l’entrée ne remplace pas la décision d’accès.
Les contraintes de lecture conditionnent
l’accès à l’achèvement d’un autre chapitre, par règle générale et exceptions,
ou au cas par cas. Les contenus exclus par le profil disparaissent du Sommaire
et du parcours. Ceux dont un prérequis de lecture reste insatisfait sont visibles
mais verrouillés. La page « Aide » illustre une exception toujours accessible.

L’éditeur présente la liste sélectionnable des entrées face aux règles à
appliquer. Sans sélection, les règles portent sur tout le projet. Sélectionner
un chapitre sélectionne son contenu ; retirer des éléments produit une
sélection partielle. Le chapitre possède trois états : tout, rien, partiel.

Les valeurs du profil sont enregistrées avec un utilisateur. Ce stockage doit
permettre ultérieurement de rattacher des résultats d’évaluation. Les valeurs
sont disponibles dans le contexte Sighty ; une action transmet une valeur à
une scène, par exemple un pseudo dans un titre. L’auteur peut également
insérer des étiquettes de profil dans les contenus, substituées en lecture.
Chaque BDC peut recevoir une contrainte de masquage par profil à la
construction, selon les mêmes critères. La visibilité évolutive des BDC sera
revue avec la réalisation différée des qualifications.

### Qualifications et dévoilement progressif

À l’issue d’une progression ou de résultats à un ou plusieurs questionnaires,
le lecteur acquiert une qualification ouvrant de nouvelles parties du document.
L’auteur présente cette capacité comme une évolution des contraintes de lecture
et comme un profil construit progressivement à partir d’évaluations.

Une partie du document peut ainsi compléter le profil à la place ou en
complément du formulaire initial. Exemple : un profil partiel est renseigné,
puis un ou deux chapitres de positionnement évaluent le lecteur. Selon leurs
résultats, de nouveaux chapitres deviennent accessibles et les chapitres de
positionnement peuvent être masqués par les mêmes règles.

Le modèle doit pouvoir accueillir plusieurs étapes successives de dévoilement,
sans limiter le scénario à un seul positionnement initial. Un jeu de rôles et
ses règles de progression illustrent ce besoin. Cela introduit une visibilité
évolutive, à distinguer du masquage initial et du verrouillage de lecture déjà
cadrés. Les qualifications peuvent compléter ou remplacer les mêmes propriétés
que celles du profil initial. Par exemple, une évaluation renseigne `grade`
selon le nombre de réponses justes : 1 à 5 donnent « junior », 6 à 10 « medium »,
plus de 10 « senior ». Ces plages illustrent le besoin, sans imposer les seuils
du futur mécanisme ni décider le cas zéro. Dans cet exemple, `grade` est alimenté
par l’évaluation et n’est pas accessible dans le formulaire de profil.

La réalisation des qualifications est reportée. Les critères d’affectation par
plages, les règles d’acquisition et les changements de visibilité seront cadrés
dans un futur travail. Le modèle prépare l’alimentation des propriétés par la
saisie initiale puis par les résultats, sans figer leurs valeurs.
Le modèle des propriétés du profil couvre donc aussi des propriétés absentes
de la page Profil. Une option choisit lesquelles sont présentées à la saisie ;
les mêmes références servent aux résultats, contraintes et étiquettes. La page
de collecte n’est pas imposée au profil : une évaluation peut fournir toutes
ses données nécessaires.

L’orientation retenue est un profil dynamique dans le contexte du scénario.
Le résultat d’une évaluation amende ce contexte ; les gardes exploitent ensuite
les propriétés mises à jour pour décider de la visibilité et de l’accès.
Cette évolution doit prolonger le contexte et le circuit de gardes existants,
sans créer une seconde définition du profil ou un circuit autonome de droits.

La traduction d’une qualification dynamique en affichage reste à cadrer dans
ce travail différé. Le contrat Sighty exécute les gardes d’accès et de sortie ;
il ne garantit pas un masquage du rendu après une simple mise à jour du contexte,
et une sélection déjà active reste admise. Le futur travail devra donc définir
la mise à jour du Sommaire, des BDC et de la page active en réutilisant les
décisions des mêmes gardes.

Une évolution ultérieure introduit des ACL pour les fonctions de profil,
l’éditeur et l’accès universel des administrateurs.

## Circuits existants à réutiliser

Le [modèle documentaire](../specs/document-model-spec.md) possède une séquence
racine ordonnée mêlant pages autonomes et chapitres. Chaque chapitre conserve
son ordre de pages. Les pages du catalogue restent hors scénario. Les formats
de page actuellement définis sont Flux et Diapo ; le Sommaire proposé est une
extension de ce modèle. Son rôle spécial hors précédent/suivant est accepté,
et son modèle unique est maintenant décrit dans la spécification Sommaire et
profils.

Le [lecteur](../specs/player-preview-spec.md) utilise la composition réelle
Sighty/CodPlay. Menu et navigation reprennent la séquence documentaire. La
prévisualisation auteur commence sur la page éditée. Progression, réponses et
historique restent locaux à la session ; un nouvel instantané remonte la
composition.

[Sighty](../../sighty/specs/authoring-library-spec.md) possède les gardes
d’accès et de sortie, le contexte et les actions. Les helpers `canAccess` et
`canExit` utilisent le même évaluateur que la navigation. La condition la plus
spécifique est retenue : les gardes parentes ne sont pas automatiquement
cumulées. Les contraintes Elcé doivent exprimer leurs règles métier en
réutilisant ce circuit.

Mettre à jour le contexte Sighty ne transmet pas automatiquement ses valeurs
aux scènes. Une transmission utilise les événements d’entrée ou l’envoi
explicite depuis une action Sighty. Les données auteur statiques `data`
restent distinctes des valeurs courantes de profil.

Le [calcul d’Évaluation](../specs/chapter-evaluation-spec.md) utilise les pages
Question du chapitre. Une réponse absente compte comme incorrecte. Les actions
Recommencer/Relire et la visibilité des réponses restent partiellement
intégrées, selon la [machine d’Évaluation](../specs/evaluation-machine-spec.md).

Le [stockage des projets](../specs/project-api-spec.md) dispose déjà de tables
relationnelles SQLite et d’un circuit local de synchronisation. Le
[plan de stockage](../plan/2026-10-06-elce-local-first-synchronisation-plan.md)
exclut actuellement les comptes et les données de lecture du périmètre initial
et évoque SCORM pour les résultats ultérieurs. La persistance des lecteurs
élargit donc ce périmètre et demande de préciser cette articulation.

## Analyse des frontières

### Un Sommaire unique et deux présentations

Une configuration unique au niveau projet évite de dupliquer titre,
description, média, options et règles entre menu et page racine. Les deux
présentations peuvent adapter leur disposition tout en partageant les entrées
et les états d’accès.

Le rôle spécial hors précédent/suivant permet un retour explicite au Sommaire
sans l’insérer entre deux pages de contenu. L’image de fond devrait réutiliser
le registre média existant.

La première réalisation utilise un bloc défilant, avec une disposition en
colonnes, sur une seule page Sommaire. La pagination automatique devrait
composer avec les options d’affichage, la navigation page/chapitre, la taille
disponible et les choix typographiques ; le bloc défilant garde ces dimensions
simples pour cette première version. La validation visuelle restante est
suivie dans le plan dédié.

### Liste rendue par un composant externe

La liste du Sommaire est acceptée comme composant externe accueilli dans
un `slot` CodPlay, afin de simplifier sa gestion. Le composant prendra la forme
d’une classe ou d’une fonction, conservera les propriétés actuelles du Sommaire
et facilitera son stylage. Ce travail est distinct ; si le développement des
fonctionnalités impose de modifier le Sommaire actuel, il faut engager ce
travail au même moment.
L’externalisation du rendu ne doit pas dupliquer l’ordre des entrées, le
catalogue, les conditions d’accès ou la navigation. Le composant affiche une
projection du parcours ; ses interactions empruntent l’admission Sighty.

Le [composant slot](../../codplay/specs/slot-component-spec.md) accueille une
représentation foreign opaque. La façade `instances.mount` vérifiée monte les
racines d’une instance CodPlay enfant ; elle ne certifie pas le montage public
d’un widget HTML générique. Elcé utilise des scènes CodPlay enfants montées
dans les slots Sighty. Les tests de composition couvrent leur montage, leurs
routes et leur destruction ; la validation navigateur reste au plan actif.

Le montage, les routes et la destruction sont couverts par les tests de
composition. Défilement, colonnes, clavier et focus restent des aspects de
validation visuelle ; le Sommaire et le menu partagent les décisions Sighty.

### Définition du profil et valeurs du lecteur

La définition du formulaire appartient au projet ; les réponses appartiennent
au lecteur et à leur portée de lecture. Un identifiant stable de propriété
permet de renommer son terme ou son libellé sans casser les contraintes et
étiquettes. Les choix ont eux aussi des identifiants distincts de leurs
libellés.

Les propriétés du profil sont définies indépendamment de leur affichage dans
la page Profil. L’auteur choisit par une option leur présence dans cette page.
Leur alimentation par évaluation reste une réalisation différée. Le BDC
Question impose une réponse juste/faux et un score ; il ne convient donc pas
comme propriétaire de la collecte Profil. Le Formulaire recueille plusieurs
propriétés sur une même page et valide globalement les champs obligatoires et
les types, sans bonne ou mauvaise réponse, correction ou score. Son contrat et
son raccord sont décrits dans la spécification Sommaire et profils.

Les quatre types proposés suffisent pour une première version. L’auteur choisit
le caractère obligatoire ou facultatif de chaque propriété. L’interface de
création du profil accepte une valeur par défaut pour une propriété facultative.
Un champ facultatif laissé vide prend cette valeur par défaut : elle devient
la valeur utilisée par les contraintes et les étiquettes. Le défaut n’est pas
obligatoire : sans défaut, un champ facultatif vide reste absent. Une étiquette
qui le référence rend alors du texte vide. Le formulaire unique et les
conditions directes sur ses réponses évitent une seconde définition sous forme
de profils nommés.

Substituer une valeur et produire des variantes grammaticales sont deux
capacités distinctes. « Bienvenue, Alex » relève de la substitution. Des
variantes de blocs de texte selon le genre et le pluriel sont souhaitées mais
différées : leur conception complexe sera traitée ultérieurement.

### Disponibilité visibilité et accès

Le masquage par profil intervient à la construction de la consultation. Les
contenus masqués disparaissent du Sommaire et du parcours présenté. Dans
l’ensemble retenu, une entrée est disponible ou visible mais verrouillée par
un prérequis de lecture. L’explication du verrou à présenter au lecteur reste
à préciser.

La contrainte de profil comporte une seule condition à la fois. Pour un choix,
elle utilise « est » ou « n’est pas » et vise une ou plusieurs options. Le
critère courant est « au moins une correspondance ». Ce critère doit être une
option explicite dans le modèle et le code, sans sélecteur dans l’interface
actuelle, pour pouvoir ajouter d’autres critères de sélection ensuite.
La structure prépare cette extension ; les autres critères et les combinaisons
complexes restent différés jusqu’à un besoin explicite.

Les nombres utilisent `<`, `>`, `=` et `!=` ; le texte utilise uniquement `=`
et `!=`, avec comparaison insensible à la casse et aux espaces de début et de
fin. Cette normalisation concerne la comparaison, sans imposer de modifier la
valeur affichée. Pour les choix, « n’est pas » signifie aucune correspondance
avec les options de la condition. Une valeur absente ne satisfait aucune
comparaison, y compris `!=` et « n’est pas ».

Les règles sont héritées par défaut. Une exception locale remplace
explicitement la règle héritée de la même famille et conserve les autres
familles : une exception de lecture ne change pas le masquage par profil.
Masquer un chapitre masque tout son contenu : une exception de profil sur une
page ne peut pas la rendre visible dans ce chapitre masqué.

### Achèvement du parcours personnalisé

Seules les pages et Questions retenues pour le profil comptent dans
l’achèvement et le score. Si un chapitre contient trois pages dont une masquée,
l’achèvement porte sur les deux autres sans consigner la troisième comme lue.
Une Question exclue ne reçoit ni réponse fictive ni pénalité pour absence de
réponse. Le raccord au calcul actuel devra distinguer une Question exclue d’une
Question retenue mais sans réponse.

Après masquage des BDC, une page sans BDC retenu est retirée automatiquement
du parcours. Un chapitre sans page retenue est retiré à son tour. Ces retraits
ne produisent ni progression ni réponses fictives.

Un Carousel dont tous les enfants sont masqués est retiré de la consultation
avant ce traitement des pages et chapitres vides. Ce cas limite doit être évité
par l’auteur ; le document éditorial conserve ses contenus.

Une règle générale « libérer après lecture du chapitre précédent » désigne
le précédent chapitre retenu après filtrage. Dans l’ordre C → A → B, si A est
masqué, B attend l’achèvement de C. Le chapitre masqué n’est ni un prérequis
résiduel ni un chapitre artificiellement achevé.

Si un prérequis nomme explicitement A alors qu’A est exclu pour le lecteur,
l’incohérence doit être signalée à l’auteur et corrigée. Cette exigence concerne
uniquement les dépendances explicites. Une règle qui crée une boucle de
prérequis est refusée et l’auteur voit la chaîne à corriger. Le profil fixe
évite une modification de l’ensemble retenu pendant le parcours.

La première page du chapitre suivant doit suivre le parcours retenu pour le
profil. Le retour au Sommaire avant l’achèvement dépend du paramètre auteur
« accès permanent au Sommaire ».

### Sélection et édition des règles

Appliquer une règle à un chapitre entièrement sélectionné crée une règle
héritée, qui concerne aussi les pages ajoutées ensuite. Une sélection partielle
applique la règle aux seules pages choisies. Le traitement d’une page déplacée
doit préserver la distinction entre règle héritée du chapitre et règle propre
à la page.

Sans sélection, l’interface devrait rendre explicite la portée « Tout le
projet ». Une sélection multiple doit distinguer les règles communes et les
valeurs différentes, et préciser les opérations ajouter, remplacer et retirer.
Un aperçu avec un profil d’essai aiderait à comprendre les effets des règles.

### Étiquettes et cycle de lecture

Les étiquettes pourraient être des éléments structurés du contenu éditable,
référençant une propriété stable. Le
[JSON Tiptap](../specs/section-editor-spec.md) reste la source d’édition de la
Section et son HTML exporté sert au builder. La personnalisation doit préserver
ce circuit et définir le rendu en lecture et en édition. Une étiquette sans
valeur ni défaut est remplacée par du texte vide en lecture.
Les étiquettes couvrent tous les champs de contenu
textuel, dont les titres, Sections, Cartes et Questions.

Les valeurs fixes du profil sont transmises aux scènes selon le circuit
existant, avec un rendu cohérent à l’entrée de page, à la réadmission, à la
relecture et au seek. Le traitement du reset doit préserver la contrainte de
profil initial pour la consultation lecteur. Le changement manuel de ce
profil par le lecteur reste hors périmètre. Le cycle d’acquisition des
qualifications et son effet sur la présentation restent à préciser. La
reconfiguration du profil de test par l’auteur possède un cycle distinct.

### Utilisateurs résultats et futurs droits

Une identité lecteur peut porter ses valeurs de profil par projet. Les
tentatives et résultats devraient être rattachés séparément pour conserver
plusieurs évaluations et leurs versions. La table utilisateur ne devrait pas
réduire cette histoire à un seul score.

Pendant la phase de test, le lecteur est anonyme. Dans le fonctionnement
définitif, un utilisateur complet déjà existant sera fourni à Elcé. Les besoins
de cette intégration seront complétés progressivement. La gestion d’un lot
d’utilisateurs de test reste différée.

En mode auteur, un utilisateur de test est persistant. Une modale expose tous
les paramètres disponibles pour reconfigurer son profil et permet de remettre
sa progression à zéro. Cet outil de simulation auteur est distinct de la
consultation lecteur, où le profil initial reste fixe. Sans RAZ, la
reconfiguration conserve progression et réponses puis reconstruit le parcours
avec le nouveau profil. Les contenus désormais masqués sont ignorés ; les
nouveaux contenus restent à lire. La RAZ progression efface progression et
réponses mais conserve le profil. La RAZ profil remet les champs à leur défaut,
ou à vide sans défaut, et conserve progression et réponses. Ces deux actions
sont indépendantes.
Profil, progression et réponses sont conservés après fermeture et réouverture.
La pérennisation de cet outil au-delà de la phase de test est envisagée.

Les résultats de test sont précaires : changer les seuls libellés d’une Question
conserve sa réponse. Changer ses choix, leurs identités ou la correction invalide
uniquement la réponse incompatible et les résultats qui en dépendent.

La modale auteur permet aussi d’activer ou de désactiver le profilage pour la
prévisualisation. Le désactiver ignore les conditions de profil et les
contraintes de lecture pour permettre l’exploration libre. Si le profilage est
actif et que la page éditée est exclue, signaler cette exclusion et donner accès
à la modale pour ajuster le profil ou désactiver le profilage, sans afficher la
page interdite. Ce mode auteur ne définit pas le comportement de consultation
du lecteur.

Décision mise à jour le 27 octobre : l’état de test reste stocké sur le serveur
dans un enregistrement séparé du document, mais la preview ne sauvegarde aucune
modification de consultation. Elle peut lire l’état initial ; son prévol
`PUT` réseau est refusé. Le schéma, la révision et les permissions vérifiées
sont décrits dans la [spécification Sommaire et profils](../specs/summary-profile-spec.md).
Les réponses déclaratives du profil ne peuvent pas prouver des droits
d’administration : les futures ACL doivent utiliser les permissions de
l’utilisateur fourni.

## Références actuelles

Le [plan Sommaire et profils](../plan/2026-10-14-elce-sommaire-profils-plan.md)
porte l’ordre de réalisation et la validation navigateur encore attendue. La
[spécification dédiée](../specs/summary-profile-spec.md) décrit les
comportements vérifiés. Les qualifications, variantes grammaticales et ACL
restent différées.
