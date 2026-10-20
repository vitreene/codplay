# Sequence et scheduler — premières frontières pour DGS

Date : 20 octobre 2026.

Cette étude prolonge l’[intention DGS](2026-10-20-dgs-mod-study.md) et la
[composition des modules](2026-10-20-mod-composition-internal-api-study.md).
L’utilisateur distingue un module `sequence`, qui représente des boucles de
lecture locales et leurs règles d’enchaînement, et un module `scheduler`, qui
en donne une projection temporelle. Cette distinction constitue le point de
départ. Les structures et responsabilités proposées ci-dessous servent à la
discussion ; elles ne définissent aucune API disponible ni format persistant.
Les décisions ouvertes sont centralisées dans
le [plan des mods](../plan/2026-10-20-elce-mods-reconfiguration-plan.md#sequence-et-scheduler).

## Deux questions métier différentes

`sequence` répondrait à « que présenter ensuite, selon quelles règles
locales ? ». Une séquence décrit des passages successifs ou des scènes
présentées en parallèle dans plusieurs zones, leurs répétitions et leurs
conditions de fin. Son origine temporelle est locale :
le début de son exécution. Elle n’a pas besoin de connaître lundi ou 8 h 45
pour décrire page 1, trois lectures du chapitre A, puis page 2.

`scheduler` répondrait à « quelle séquence doit être diffusée à cet instant
du calendrier ? ». Il référence les séquences, applique les programmations
et détermine leurs occurrences datées. Pour construire une grille, il utilise
les informations temporelles calculées par `sequence`. Il ne recalcule pas
son ordre interne ou ses règles de répétition.

L’autonomie de `sequence` vis-à-vis du calendrier est une piste de composition :
un mod pourrait demander son exécution sans sélectionner `scheduler`. Cela
n’impose ni de l’ajouter à Learning, ni d’en faire un module universel dès le
premier usage DGS. L’utilisateur demande explicitement de laisser cette
question ouverte dans l’étude. Son classement initial peut rester près de DGS.

| Élément | Responsabilité proposée | Données consommées |
| --- | --- | --- |
| Contenus Elcé | Posséder pages, chapitres, BDC et leurs builders. | Données éditoriales canoniques. |
| `sequence` | Décrire les règles locales et contribuer à leur génération en scénario ; fournir les calculs métier nécessaires aux actions et guards. | Références de contenu, composition par zones et réglages de passage. |
| `scheduler` | Projeter les programmations dans le calendrier et déterminer la diffusion attendue. | Références de séquence, calendrier et projections locales. |
| Assemblage DGS | Produire le scénario, les scènes, actions et guards ; raccorder le calendrier au circuit de lecture existant. | Document auteur, contributions des builders, résultats métier et contexte de diffusion. |
| Sighty / CodPlay | Conduire le parcours puis exécuter les scènes et médias. | Scénario et scènes construits par les contributions retenues. |

L’assemblage DGS est un rôle de composition, pas nécessairement un troisième
module. Il évite que deux dispositifs décident séparément du passage suivant.
Le scheduler choisit la séquence autorisée par le calendrier. Les règles
locales de cette séquence sont traduites par Elcé dans le scénario produit ;
Sighty conduit ensuite son parcours.

## Des classes métier, un état possédé par le circuit appelant

Une classe TypeScript `Sequence` pourrait porter les règles locales pour
vérifier les données auteur, préparer leur génération et calculer une projection
de durée. Les actions et guards du scénario produit appelleraient les classes
métier pour les calculs nécessaires en lecture, notamment la fin collective.
Une classe `Schedule` pourrait porter les règles calendaires : développer
les récurrences sur un intervalle borné et déterminer les occurrences attendues.
Ces noms illustrent des responsabilités ; leurs méthodes restent à définir.

Les mêmes classes fourniraient les calculs au calendrier auteur, au service
de diffusion et au lecteur pour les parties exécutées localement.
L’interface afficherait leur résultat et transmettrait ses intentions par les
façades. Une machine éventuelle organiserait les attentes et les transitions,
en déléguant les règles à ces classes. Aucun acteur supplémentaire n’est
justifié par la seule existence de deux modules.

À l’édition, le document, la file des commandes et l’historique conservent leur
propriétaire commun. À la lecture, l’orientation déjà demandée place le
pilotage de l’état au niveau du scénario Sighty, avec les modules appelés par
ses actions. Une classe métier peut recevoir un état et produire une décision
sans devenir propriétaire d’un second état mutable du lecteur.

## Document auteur et production du scénario

Comme pour les autres projets Elcé, le mod décrit une intention éditoriale
enregistrable, puis Elcé la transforme pour produire la lecture.

| Niveau | Contenu et rôle |
| --- | --- |
| Document auteur persisté | Contenus, séquences, calendriers et réglages modifiables par l’auteur ; source de référence pour l’édition et la sauvegarde en BDD. |
| Production de lecture | Scénario Sighty avec ses vues, scènes CodPlay, données de lecture, actions et guards, générés depuis ce document par les builders et contributions du mod. |

La forme documentaire et sa projection vers les tables doivent être définies
pour la persistance. La forme des objets attendus par Sighty appartient à la
génération. Le [contrat actuel des projets](../../specs/project-api-spec.md)
distingue déjà le document structuré échangé et sa projection relationnelle ;
le format DGS reste à définir.

### Données auteur de sequence

Les informations ci-dessous décrivent ce que l’auteur doit pouvoir conserver.
Elles ne fixent ni noms de champs, ni tables, ni format de scénario Sighty.

| Information éditoriale | Sens |
| --- | --- |
| Identité et nom | Retrouver et référencer la séquence éditée. |
| Passages successifs | Ordre et identité des emplois de contenus dans le cas linéaire. |
| Contenu d’un passage | Référence à une page ou un chapitre existant. |
| Composition par zones | Layout, contenus affectés aux zones et règle de fin collective ; les références de scènes produites seront établies à la génération. |
| Répétition d’un passage | Nombre total de lectures ; 3 signifie trois lectures, pas une lecture plus trois reprises. |
| Condition de fin | Durée imposée ou fin de présentation fournie par le contenu selon un contrat à établir ; attente de toutes les fins pour le cas par zones. |
| Répétition de la séquence | Une lecture, un nombre fini de cycles, ou une boucle jusqu’à une interruption extérieure. |

Les deux niveaux de répétition ont des effets différents : répéter le
chapitre A trois fois produit A, A, A dans un cycle ; répéter la séquence
reprend aussi les autres entrées. Leur vocabulaire devra être lisible dans
l’interface et dans les données.

Exemple d’intention auteur, sans forme de stockage imposée : la séquence
« Informations du matin » contient les passages suivants et joue trois cycles.

| Ordre | Contenu référencé | Durée par lecture | Nombre de lectures |
| --- | --- | --- | --- |
| 1 | Page Accueil | 30 secondes | 1 |
| 2 | Page Informations | 45 secondes | 2 |

Le budget nominal d’un cycle serait ici 120 secondes, et celui des trois
cycles 360 secondes. Ces sommes n’incluent aucun coût implicite de chargement
ou de transition. Le point de départ du décompte et le traitement de ces coûts
doivent être décidés avant de promettre six minutes de diffusion effective.

Un passage est distinct du contenu : deux entrées peuvent référencer la même
page avec des durées différentes, sans la copier ni changer sa durée propre.
Une référence à un chapitre ne fixe pas encore la façon dont ses pages
consomment un budget : durée par page, durée du chapitre ou fin naturelle
demandent une décision explicite. L’exemple initial « chapitre A trois fois »
doit rester représentable sans deviner cette répartition.

### Fin collective dans un layout à plusieurs zones

L’utilisateur rappelle un cas déjà décrit dans la
[première intention Sighty, §6.1](../../../sighty/notes/2026-07-28-sighty-premiere-intention.md#61-affichage-dynamique-digital-signage) :
un layout est divisé en zones, chacune présentant une scène. Dans ce cas,
la fin naturelle de la séquence attend le signal de fin de chacune des scènes.
La séquence doit donc aussi représenter cette composition parallèle ; le
modèle linéaire illustré plus haut ne suffit pas à couvrir les usages exprimés.

**Fin de séquence = fin scène A ET fin scène B ET fin scène C.**

La « somme des fins » signifie ici que toutes les fins attendues sont réunies.
Si les scènes démarrent ensemble et signalent leur fin à 10, 20 et 30 secondes,
la séquence se termine à 30 secondes. Une première fin ne suffit pas ; le
dernier signal attendu satisfait la condition collective.

Le document auteur conserve la composition par zones et sa règle de fin.
La génération produit les scènes, vues, actions et guards nécessaires à cette
règle. À la lecture, les actions et guards concernés appelleraient la classe
métier de `sequence` pour évaluer les fins reçues pour cette exécution.
Une même occurrence terminée ne compte qu’une fois ; une fin d’un cycle
précédent ne satisfait pas le cycle suivant. Ces faits sont un état de lecture,
distinct du document auteur ; leur pilotage reste au niveau du scénario Sighty.

Le [contrat Sighty actuel](../../../sighty/specs/authoring-library-spec.md)
permet de faire remonter `scene:end` sans quitter la vue ni libérer la scène.
Les actions du scénario produit seraient raccordées à ces signaux ; lorsqu’un
changement de vue doit suivre la fin collective, il passe par l’admission
Sighty existante. Le signal CodPlay `sequence:end` termine, lui, la séquence
technique d’un player : il ne désigne pas cette condition collective DGS.
Le raccord exact et la forme des données restent à qualifier, sans nouvelle
API ni agrégation automatique supposée dans Sighty.

La fin réelle est constatée sur le récepteur. Le serveur peut en prévoir
l’heure si les durées et départs des scènes sont connus ; sinon la projection
conserve une fin inconnue. Si une décision serveur doit dépendre de cette
fin constatée, un retour du récepteur sera nécessaire ; son protocole reste
à définir. Le scheduler garde la responsabilité de la programmation calendaire.

Ce cas concerne les zones d’un même layout sur un récepteur. Il ne suppose
aucune synchronisation entre les récepteurs associés à des schedulers distincts.

### Données auteur de scheduler

| Donnée candidate | Sens |
| --- | --- |
| Identité du calendrier | Programmation réutilisable, interprétée dans le contexte local du récepteur. |
| Identité de la programmation | Distinguer plusieurs emplois d’une même séquence. |
| Référence de séquence | Séquence à diffuser, conservée dans son propriétaire. |
| Règle de récurrence | Jours de semaine ou intervalle de jours ancré sur une date, selon les formes retenues. |
| Heure locale de début | Par exemple 8 h 45 chez le récepteur ; son fuseau effectif est fourni par le contexte de diffusion. |
| Période de validité | Bornes de dates éventuelles de cette programmation. |
| Borne de fin éventuelle | Fenêtre de diffusion à distinguer de la durée propre de la séquence. |
| Références d’interlude | Contenu ou séquence à présenter dans les intervalles concernés, selon la politique retenue. |

Le calendrier référencerait « Informations du matin » à 8 h 45, 9 h 30 et 11 h 20.
Ces trois emplois ne créeraient ni trois séquences auteur ni trois copies
des pages. Le scheduler produirait des occurrences datées à partir des règles.
Une projection sur la journée ou la semaine visible suffit ; il n’a pas à
stocker une liste infinie d’occurrences.

Une alternance « un jour sur deux » demande un ancrage de date et ne se réduit
pas à une liste de jours de semaine. Plusieurs calendriers n’indiquent pas
encore lequel est actif. Les jours et dates de programmation sont également
interprétés localement. Le contexte du récepteur permet de convertir ces
horaires en occurrences datées.

### Génération Elcé pour la lecture

Les builders et contributions du mod transforment les données auteur en
scénario Sighty et scènes CodPlay, avec les actions et guards associés.
Le [builder Diapo actuel](../../specs/diapo-scene-builder-spec.md#fin-fonctionnelle-de-diapo)
illustre déjà cette chaîne : il produit la scène et son signal public ;
`buildScenario` raccorde ce signal à une action Sighty.

| Intention auteur DGS | Production à étudier |
| --- | --- |
| Références de pages et chapitres | Scènes construites par les builders compatibles et références dans les vues Sighty. |
| Layout et contenus par zones | Scènes et surfaces CodPlay, avec leur composition dans les vues et slots Sighty. |
| Ordre et répétitions | Graphe de vues, routes et actions correspondant aux règles retenues. |
| Durée imposée ou fin collective | Signaux, actions et guards appelant les classes métier ; leur raccord exact reste à qualifier. |

`sequence` fournit donc des données auteur et des contributions à cette
génération. Son modèle persisté ne constitue pas un programme que lirait un
interpréteur de séquences distinct de Sighty. Les paramètres utiles en lecture
peuvent être projetés dans le scénario et transmis aux classes par ses actions.
Les builders doivent établir les références entre contenus auteur et éléments
produits ; leur correspondance exacte reste à définir.

Preview et player exporté doivent partager cette génération et les mêmes
règles de lecture. La [forme auteur Sighty](../../../sighty/specs/authoring-library-spec.md#33-scénario-et-fonctions-dauteur)
peut contenir des fonctions ; leur conditionnement pour l’export est une
frontière distincte, qui ne fixe pas le schéma BDD du projet Elcé.

### Projections calculées et état de diffusion

Les projections seraient des résultats dérivés : passage local prévu,
durée connue ou non, occurrence datée et intervalle concerné. Elles ne
deviendraient pas une deuxième source éditoriale à synchroniser avec le document.
Les productions de lecture peuvent être publiées ou conservées comme artefacts
dérivés ; leur éventuel stockage ne les confond pas avec le document éditable.

La connaissance temporelle mérite une représentation explicite : durée finie
calculable, durée non encore connue, ou boucle sans fin propre. Une durée
inconnue ne vaut ni zéro ni une durée infinie. Une borne de calendrier peut
limiter une boucle sans en changer les règles internes.

L’état courant pourrait identifier la programmation et son occurrence,
l’exécution de séquence, le passage, les compteurs de répétition, les fins de
scènes déjà reçues dans une composition par zones et les faits temporels utiles
à sa reprise. Il doit distinguer présentation demandée et
présentation admise. Les handles de scènes, abonnements et minuteurs sont
des ressources d’exécution, pas des données auteur ni des valeurs durables.
La projection sérialisable et son besoin de conservation restent à décider.

## Projection serveur selon l’heure locale du récepteur

Le principe retenu est une programmation en heure locale : la même séquence
prévue à 8 h 45 est attendue à 8 h 45 à Tokyo et à 8 h 45 à New York, pour le
même jour local et la même édition du programme. Le fuseau effectif appartient
au contexte de diffusion ; le calendrier conserve ses horaires locaux.

La variante étudiée place le calcul calendaire sur le serveur. Le récepteur
fournit son identité et son fuseau, ou son identité permet de retrouver ce
contexte. Le serveur combine son horloge et ce fuseau pour déterminer la date
et l’heure locales, sélectionner le calendrier applicable et calculer les
occurrences à exécuter.

La réponse envisagée est une description de diffusion adaptée au récepteur :

| Donnée | Rôle |
| --- | --- |
| Version du programme | Identifier l’édition publiée utilisée. |
| Identité des occurrences | Distinguer chaque diffusion et conserver une exécution lors d’une actualisation qui renvoie la même occurrence. |
| Productions de lecture | Désigner les scénarios, scènes, actions et guards produits par Elcé pour les séquences à diffuser, avec les ressources ou leurs références. |
| Échéances datées | Déterminer les débuts et changements programmés pour ce contexte local. |
| Ressources | Permettre le chargement des scènes et médias nécessaires. |
| Prochaine actualisation | Renouveler la projection servie au récepteur. |

Les échéances peuvent être transportées en UTC après résolution dans le fuseau
du récepteur : elles sont alors propres à cette exécution locale. Le serveur
peut fournir plusieurs prochaines diffusions pour permettre leur préparation.
Le récepteur charge les productions Elcé et les exécute par Sighty/CodPlay.
La répartition des séquences entre scénarios, leur activation et le transport
de ces productions restent à qualifier ; le nom des champs et le protocole
de cet échange ne sont pas fixés.

## Diffusion uniforme et diffusion par destination

Dans une même salle, deux récepteurs peuvent présenter des parties distinctes
d’un même propos, issues du même projet DGS. Le projet permet de déterminer
l’association d’un système de diffusion à l’adresse d’un scheduler distinct.
Le réseau local transporte alors des diffusions adaptées à ces associations.

| Usage étudié | Récepteur | Scheduler associé dans le projet | Présentation |
| --- | --- | --- | --- |
| Diffusion uniforme | A et B | Scheduler commun | Même programmation dans leur contexte local. |
| Diffusion par destination | A | Scheduler accueil | Séquences de présentation générale. |
| Diffusion par destination | B | Scheduler détails | Séquences complémentaires du même projet. |

Les adresses désignent les programmations à consulter. Plusieurs adresses de
scheduler peuvent être servies par le même service, avec les mêmes classes
métier. Les pages, chapitres et séquences restent les contenus du projet et
sont référencés par ses différentes programmations.

Un module supplémentaire d’affectation des destinations est une piste à
étudier dans DGS. Son rôle serait de décrire l’association récepteur/adresse
de scheduler et de fournir ce contexte au service de diffusion et au lecteur.
Une association directe suffit à représenter l’exemple. L’intérêt d’ajouter
des destinations logiques, des groupes ou une gestion de parc reste à établir.
Les règles calendaires restent dans `scheduler`, et les enchaînements locaux
dans `sequence`.

La sélection serveur prend donc en compte le scheduler associé au récepteur,
en plus de son heure locale. Deux récepteurs ayant le même fuseau et la même
heure peuvent recevoir des séquences différentes. Cette association doit aussi
participer à l’identification de la réponse et de sa réutilisation en cache.

L’étude reste dans un même mod DGS. « Diffusion uniforme » et « diffusion par
destination » pourraient devenir deux mods ou offres distincts pour une raison
commerciale ; cette possibilité ne décide pas aujourd’hui d’un découpage
technique en deux mods. Le contrat d’affectation, l’emplacement de sa
configuration et le besoin éventuel de coordination entre écrans sont les
points ouverts SQ10/SQ11 du plan.

### Identifier les diffuseurs et leur affecter un programme

L’affectation suppose une interface de préparation et de suivi des diffuseurs.
L’utilisateur propose deux appareils nommés « TV entrée » et « TV salle »,
chacun associé à un programme. Ici, « programme » désigne la programmation
du projet accessible par le scheduler concerné ; la discussion n’introduit
pas un nouveau format éditorial. L’interface peut proposer son nom, puis
résoudre son adresse technique.

Le diffuseur désigne le lecteur qui se déclare : navigateur de la TV,
application installée ou boîtier relié à l’écran, selon le matériel retenu.
La procédure ci-dessous reste une proposition, sans API disponible.

| Information envisagée | Rôle |
| --- | --- |
| Identité technique conservée par le lecteur | Retrouver le diffuseur après redémarrage, indépendamment de son nom ou de son adresse IP. Le support de conservation dépendra du lecteur. |
| Nom lisible | Identifier l’usage ou le lieu : « TV entrée », « TV salle ». Un renommage conserve l’association au même diffuseur. |
| Programme affecté | Référence à la programmation du projet et au scheduler qui la sert. |
| État observé | Attente d’affectation, dernière présence, chargement, lecture confirmée ou erreur remontée. |

**Piste 1 — Configuration sur le diffuseur.** Au premier lancement, un
formulaire demande le service de diffusion s’il n’est pas préconfiguré,
le nom du diffuseur et le programme à consulter. Par exemple : « TV entrée »
et « Accueil ». Le lecteur conserve son identité et retrouve sa configuration
aux lancements suivants. Cette piste convient avec une télécommande, un
clavier ou un dispositif de configuration utilisable sur place. La procédure
concerne l’installation ; la diffusion destinée au public reste autonome.

**Piste 2 — Déclaration puis association depuis l’administration.** Le lecteur
démarre avec l’adresse d’un service connu et s’y déclare. Il apparaît parmi
les diffuseurs à associer et affiche un code sur la TV. Dans l’administration,
l’opérateur reconnaît cet écran par le code, lui donne le nom « TV entrée »
et choisit « Accueil ». Un QR code affiché sur la TV pourrait aussi ouvrir
la même fiche d’association sur le téléphone de l’opérateur. Le code sert
à l’association initiale ; l’identité durable du lecteur reste distincte.
Le lecteur récupère ensuite l’affectation et la diffusion correspondante.

Cette deuxième piste est la recommandation de départ de l’étude : elle permet
de préparer plusieurs écrans depuis l’administration avec peu de saisie sur
les TV. L’apparition automatique résulte de la déclaration du lecteur auprès
du service. Elle suppose donc son démarrage et la connaissance de ce service.

**Faisabilité entièrement web.** Le parcours de déclaration puis association
peut employer une page de lecture sur chaque diffuseur, une administration
web et un service HTTP. La page demande son association, affiche le code
fourni par le service, puis récupère le programme choisi par l’administrateur.
Des requêtes périodiques avec [Fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch)
suffisent pour ces échanges et les remontées de présence ; une connexion
permanente n’est pas une condition du parcours.

Un identifiant peut être conservé dans le stockage du navigateur, par exemple
[localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API),
pour retrouver l’association après fermeture et réouverture. Il identifie
l’installation du lecteur pour cette origine ; l’effacement des données
demanderait une réassociation. Il ne constitue pas une identité matérielle.

L’étude suppose le diffuseur configuré en mode kiosque pour ouvrir le lecteur
web dans les conditions nécessaires à une diffusion autonome. La configuration
de ce mode et de l’équipement relève de l’installation, hors du périmètre de
cette étude. Le parcours étudié commence avec le lecteur web lancé dans cet
environnement et connaissant l’adresse du service de diffusion.

**Piste 3 — Préparation avant installation.** L’opérateur crée à l’avance une
fiche « TV salle », lui attribue « Informations de la salle », puis obtient
un lien ou un code d’installation. Le lecteur utilise ce lien ou ce code à
son premier lancement pour s’associer à la fiche préparée. Cette variante
inverse l’ordre de la deuxième piste et convient lorsque les affectations
sont connues avant la mise en place des écrans.

Ces parcours peuvent employer le même circuit métier d’affectation. Dans la
variante centralisée proposée, le service conserve l’affectation de référence ;
le formulaire local et l’administration la modifient par ce circuit commun.
Le lecteur peut transmettre sa présence et la configuration effectivement
appliquée lors des échanges de diffusion déjà envisagés, sans imposer un
second canal de communication. Un programme demandé reste distinct du
programme dont le lecteur confirme le démarrage.

Le suivi pourrait afficher « connecté », « en lecture » et « dernière présence
à … ». La présence est déduite de contacts renouvelés et d’un délai à définir.
Ces informations décrivent le lecteur ; connaître l’allumage physique de la
TV demanderait une capacité matérielle supplémentaire, à qualifier si nécessaire.

**Découverte locale complémentaire.** Un agent ou service local pourrait
annoncer et rechercher les diffuseurs par DNS-SD/mDNS, qui prévoit la découverte
de services nommés sur le lien local
([RFC 6763, §1](https://www.rfc-editor.org/rfc/rfc6763.html#section-1)).
Cette option dépend du logiciel installé et du réseau. Une page web ordinaire
ne fournit pas directement les sockets UDP nécessaires à cette approche ;
Chrome expose ces capacités dans les Isolated Web Apps
([documentation Direct Sockets](https://developer.chrome.com/docs/iwa/direct-sockets)).
Le matériel et le conditionnement du lecteur doivent être connus avant de
retenir cette piste. La découverte du service de diffusion lui-même peut
également relever de l’installation.

Dans le découpage envisagé, les programmes restent des données du projet DGS ;
les présences et associations aux lecteurs relèveraient du contexte de
déploiement. Le module d’affectation porterait leurs règles dans des classes
TypeScript, appelées par les façades et machines concernées. Le scheduler
continuerait à résoudre le calendrier. L’administration peut être une surface
DGS de la même application et le service peut être hébergé avec celui de
diffusion. Cette piste ne décide ni d’une application supplémentaire ni des
utilisateurs et ACL, toujours hors de l’étude.

L’identité persistante, le parcours d’installation retenu, la conservation
des affectations, le suivi de présence et la réassociation après remplacement
ou réinitialisation restent les décisions ouvertes SQ10 du plan.

## Fonctionnement envisagé

1. L’auteur construit ses contenus avec les ressources compatibles, puis
   compose une séquence par références et la programme dans un calendrier.
   Ces données auteur sont conservées par le circuit documentaire.
2. Elcé génère le scénario Sighty, les scènes, actions et guards depuis ce
   document avec les builders et classes concernés. Les classes métier
   fournissent aussi les diagnostics et la projection de grille ; une durée
   impossible à calculer reste visible comme telle.
3. Dans la variante serveur, le récepteur consulte l’adresse de scheduler qui
   lui est associée. Le serveur résout cette programmation dans son contexte
   local et retourne les occurrences et ressources correspondantes.
4. Le lecteur prépare la composition produite et ses ressources. Le scénario
   Sighty conduit l’enchaînement local ; ses actions et guards appellent les
   classes métier nécessaires. L’état avance selon le résultat réellement
   admis ; une intention envoyée ne constitue pas une présentation réussie.
5. Les faits de lecture et échéances reçues repassent par ce circuit.
   L’actualisation renouvelle la projection de diffusion du même scheduler.

La façon de traduire une décision métier en route déclarée Sighty reste à
qualifier. Le contrat actuel exécute un handler après sa route éventuelle :
on ne peut pas supposer qu’il calcule d’abord une destination arbitraire.
L’admission refuse également une nouvelle transition pendant `changing`.
Le raccord devra traiter ces limites sans second routeur ou file locale
destinée à masquer les refus.

Quatre temporalités restent séparées : heure civile du calendrier, temps
écoulé de la séquence, temps logique d’une scène et temps des médias.
Un réveil de minuteur tardif ou un retour d’onglet suspendu ne prouve pas que
tous les passages intermédiaires ont été diffusés. La décision de rattraper,
repartir ou rejoindre la position attendue appartient au métier à arrêter.
Un temps local de séquence ne se convertit pas automatiquement en Seek CodPlay.

## Ajout dans un mod

L’assemblage du mod sélectionnerait les contributions nécessaires :

- données, validation et classes métier de chaque module ;
- façades et commandes raccordées au commit documentaire existant ;
- surfaces auteur, notamment liste de séquences et calendrier ;
- codec et projection persistante possédés par la composition du mod ;
- génération du scénario, des scènes, actions et guards, puis raccord au
  contexte de diffusion et gestion du cycle de vie.

La définition logicielle du mod exprime les capacités choisies ; les séquences
et calendriers d’un projet sont les contenus de ces capacités. Aucun format
déclaratif général de module n’est nécessaire pour commencer : des raccords
TypeScript explicites peuvent suffire lorsque la tranche sera acceptée.

`sequence` dépendrait de la lecture des références de contenu et des
informations nécessaires à leur présentation. `scheduler` dépendrait de la
surface métier de `sequence` et d’une source de temps fournie par la composition.
`sequence` ne dépendrait pas de `scheduler`. Le passage réel reste possédé par
Sighty et les scènes par CodPlay.

Supprimer une page référencée ou une séquence programmée implique plusieurs
invariants dans un seul geste documentaire. Les règles devront être vérifiées
avant le commit commun ; des suppressions réparées par notifications après
coup ne remplacent pas cette cohérence. Les projections et caches devront
tenir compte des données éditoriales dont ils dépendent.

L’arrêt du lecteur devra fermer les sources d’échéances et abonnements du
raccord. Une réponse tardive d’une exécution quittée ne doit pas faire avancer
sa remplaçante. Les ressources restent attachées au cycle de vie qui les possède.

## Circuits existants à prolonger et lacunes à qualifier

| Référence relue | Appui et limite pour cette étude |
| --- | --- |
| [Document](../../specs/document-model-spec.md) et [historique](../../specs/document-history-spec.md) | Un document, commandes pures et un commit ordonné. Le v5 reste un document Learning, pas un format DGS déjà disponible. |
| [API projets](../../specs/project-api-spec.md) | Persistance explicite des données ; ajouter un champ TypeScript ne suffit pas à le conserver dans SQLite. |
| [Carousel](../../specs/carousel-bdc-spec.md) | Circuit automatique interne aux BDC Carte/Graphe. Ses enfants et son placement ne représentent pas une liste de pages/chapitres. Le contenu reste réemployable, sans étendre son rôle par analogie. |
| [Diapo](../../specs/diapo-scene-builder-spec.md#fin-fonctionnelle-de-diapo) | `elce:page:finished` correspond notamment à l’apparition de la dernière Carte, pas à sa durée complète d’exposition. Le contrat de fin de présentation DGS manque. |
| [Preview et vidéos](../../specs/player-preview-spec.md#lecture-des-vidéos-et-sortie-de-page) | Médias indépendants et STOP de sortie réels. Démarrage autonome, répétition et interruption DGS restent à éprouver ; aucune commande DOM n’est déduite de ce besoin. |
| [Sighty](../../../sighty/specs/authoring-library-spec.md) | Actions, routes, événements et admission existants. `scene:end` est une fin fonctionnelle sans navigation implicite ; `sequence:end` termine la séquence technique du player. Aucune agrégation des fins par zones, aucun scheduler calendaire ni restauration complète sérialisée ne sont acquis. |
| [État de lecture](2026-10-16-reading-state-ownership-study.md) | Pilotage demandé au niveau du scénario ; raccord de restauration et de persistance encore à appliquer. |

Le module proposé concerne les passages de pages et chapitres ainsi que les
compositions par zones. Il ne remplace ni les séquences techniques CodPlay ni
l’éventuel BDC séquence interne à une Diapo. La fin collective est une règle
demandée ; son raccord aux signaux réels, le cas des chapitres et les récurrences
restent des sujets de contrat à préciser avant leur implémentation. La présente
proposition n’en déduit aucun événement, service ou port moteur nouveau.

Cette tâche produit une étude et le suivi des questions au plan. Aucun code,
spécification vérifiée, test logiciel ou comportement navigateur n’est modifié
ou validé par sa rédaction.

## Points discutés et cas envisagés

Les pistes ci-dessous conservent le détail de l’exploration. Les décisions
ouvertes correspondantes sont regroupées sous les mêmes références dans
le [plan des mods](../plan/2026-10-20-elce-mods-reconfiguration-plan.md#sequence-et-scheduler).

| Réf. | Piste discutée | Exemple pour préciser le comportement |
| --- | --- | --- |
| SQ1 | Laisser ouverte l’autonomie de `sequence` : usage réservé à DGS ou sélection possible sans calendrier dans un mod. Distinguer cette décision de la séparation logique des responsabilités. | Un cas d’usage concret et son propriétaire ; exercice sans scheduler seulement si cette composition est retenue. |
| SQ2 | Format documentaire à persister et projection BDD des passages, zones, références et répétitions ; transformation distincte vers les vues et scènes produites, avec la correspondance des identités. | Sauvegarder puis rééditer l’intention auteur ; en dériver une composition Sighty dont la lecture conserve cette intention ; même contenu employé plusieurs fois sans copie implicite. |
| SQ3 | Durée propre, durée de passage et contrat des signaux de fin. Appliquer la fin collective demandée aux scènes des zones. Préciser le cas chapitre, le départ du décompte, le coût des transitions et chargements, la fin précoce, le dépassement et le maintien d’un contenu terminé. Le signal Learning existant n’est pas une fin de diffusion DGS. | Fin collective seulement après toutes les fins attendues, quel que soit leur ordre ; doublon sans effet et fin d’un ancien cycle ignorée. Dernière Carte exposée pendant toute la durée attendue, sans détourner `elce:page:finished`. |
| SQ4 | Projection temporelle : durée finie calculable, inconnue ou boucle ; calcul adapté aux passages successifs ou aux scènes parallèles, selon leurs départs et durées connus. | Sommes pour les passages successifs ; dernière fin attendue pour les scènes parallèles ; impossibilité de projection exacte rendue explicite ; borne calendaire distincte de la durée de la séquence. |
| SQ5 | Formes calendaires : fuseau, semaine, récurrence datée ancrée, périodes de validité, heures ambiguës ou absentes, plages traversant minuit et choix entre plusieurs calendriers. | Trois horaires pour une séquence ; un jour sur deux au changement de semaine ; changement d’heure et minuit selon le périmètre retenu. |
| SQ6 | Arrivée tardive, reprise après arrêt ou suspension, horloge corrigée ; fenêtre de diffusion et chevauchement ; interruption immédiate ou à une borne ; interlude et comportement hors plage. Définir aussi pause auteur et pause de diffusion si proposées. | Démarrage à 8 h 47 pour 8 h 45 ; échéance pendant un contenu ou une transition ; absence de rattrapage implicite ; résultats attendus définis avant les tests. |
| SQ7 | Génération des routes, actions et guards raccordés à l’admission Sighty : ordre route/handler, confirmation, refus pendant `changing`, signaux de présentation et réponses tardives. Préciser l’arbitrage entre échéance et fin locale. | Scénario produit réellement exécuté, changement de vue et refus sans avancement fictif ; aucun interpréteur DGS parallèle ni file locale de compensation. Qualifier les lacunes chez leur propriétaire avant tout travail dépendant. |
| SQ8 | Document auteur, productions de lecture et état d’exécution distincts : éventuelle conservation des artefacts, identité d’occurrence, position utile et politique de restauration ; réconciliation après modification auteur. | Aller-retour du document via le stockage réel, productions régénérées depuis la bonne révision, état restauré selon les règles acceptées et aucun handle sérialisé. |
| SQ9 | Contributions des modules dans le mod : classes métier, façades, commandes, vues auteur, codec, persistance et assemblage de lecture. Définir suppression d’un contenu référencé ou d’une séquence programmée avant commit. | Un geste cohérent et annulable, références valides, sauvegarde/réouverture ; calendrier et lecteur utilisent les mêmes règles ; pas de propriétaire documentaire supplémentaire. |
