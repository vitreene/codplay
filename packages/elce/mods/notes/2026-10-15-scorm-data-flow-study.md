# SCORM — étude du transit des données d’Évaluation

Date : 15 octobre 2026.

Précision du 16 octobre 2026 : un seul circuit de lecture, avec un contexte
**auteur** ou **diffusion**. Il n’existe pas de situation métier « test »
distincte. Les identifiants actuels `ProjectTestState`, `onTestStateChange`
et `ProjectTestStateSession` désignent le code existant ; ils ne définissent
pas un troisième contexte. Leur vocabulaire et leur périmètre sont à
réexaminer dans l’étude, sans renommage de code à ce stade.

Étude préparatoire indépendante. Les responsabilités et raccords proposés
ne sont pas encore implémentés ; aucun code n’est modifié par cette note.

L’utilisateur précise, le 20 octobre 2026, que tous les projets édités dans
Elcé, à l’exception de DGS, ont vocation à être déployés dans un LMS après
export compilé et injection SCORM. Cette destination est commune au mod Learning,
à Quiz Hunt, à Quest et à l’exemple de cours partagé. La fabrication de
l’export et l’injection SCORM restent hors du périmètre de la réflexion sur
les mods ; les propositions de raccord de données ci-dessous restent une
étude distincte, sans implémentation.

Pour tous les mods présentés hors DGS, l’utilisateur précise le même modèle :
Elcé est l’application auteur, l’export compilé constitue le player exécuté
dans le LMS, et le LMS est responsable de l’enregistrement des apprenants
et de leurs résultats. Dans l’exemple particulier du cours partagé,
l’application des participants et le mécanisme distinct de collecte des
réponses forment le dispositif de participation associé à ce player.
Aucun raccord technique n’est décidé par cette répartition des rôles.

Cette étude porte sur la collecte, le résultat métier et leur transit vers
une destination de sauvegarde ou de transmission. L’export du projet
exécutable relève d’un projet distinct, non traité ici. Sa fabrication et
son packaging restent hors périmètre ; le découpage SCO est examiné ici
pour ses conséquences concrètes sur le raccord des données et le périmètre
de lecture.

La configuration actuelle est le contexte auteur : la base conserve l’état
de lecture. En diffusion hors ELcé, un raccord SCORM, aujourd’hui non câblé,
pourrait remplacer cette destination pour les données de lecture. Il ne
s’agit pas de créer un registre apprenant dans ELcé ni une double écriture
BDD/SCORM du contexte auteur.

| Contexte | Contenu exécuté | Destination des données recueillies |
| --- | --- | --- |
| Auteur dans ELcé, actuellement | Projet et lecteur | API/BDD de l’état de lecture du projet, déjà raccordée. |
| Diffusion hors ELcé dans le LMS, à préparer | Player issu de l’export compilé du projet | API SCORM fournie par l’hôte LMS, raccord non câblé. |

Le chapitre conserve sa responsabilité de calcul du résultat métier.
L’affichage du BDC Résultat, la conservation de l’état de lecture et la
transmission à la destination du contexte sont distincts. Le format de
restitution doit conserver le sens du résultat produit par le modèle de
chapitre.

La granularité document entier ou suivi par chapitre est retenue comme une
option du projet d’export distinct. Ici, les résultats doivent rester
identifiables par chapitre pour permettre leur exploitation selon cette
option. Le raccord concret à cette option est examiné ci-dessous.

## Circuit actuel et limite

Le [BDC Question](../../specs/question-bdc-spec.md) publie
`elce:question:answered` avec identifiants de page/BDC, réponses présentes,
sélectionnées/attendues et résultat. Le
[constructeur de scénario](../../src/builders/scenario/scenario-builder.ts)
valide la source, conserve les réponses dans le contexte Sighty et alimente
`evaluationStates[chapterId]` via la machine métier. Le raccord
`onTestStateChange` passe par la composition du lecteur jusqu’à la
[session actuelle de persistance](../../src/app/player/project-test-state-session.ts), qui
enregistre les instantanés avec contrôle de révision.

La tentative est actuellement clôturée par `COMPLETE` à l’admission de la
page portant le BDC Résultat, lorsque ses réponses requises sont présentes.
Le handler actualise le contexte puis envoie l’événement de présentation.
Ce comportement est décrit dans la
[spécification Évaluation](../../specs/evaluation-machine-spec.md). Le résultat
ne doit donc pas être assimilé à la dernière réponse seule.

Cet état de lecture est une valeur courante par projet en contexte auteur.
Il peut être réconcilié et recalculé après édition. Sa nature ne constitue
pas un manque de registre apprenant à combler dans ELcé. Le raccord actuel
ne possède pas de contrat d’accusé SCORM ; plusieurs handlers notifient
sans attendre la sauvegarde. Aucune transmission SCORM n’a été trouvée
dans les packages examinés.

## Où placer le raccord

L’utilisateur fixe la responsabilité étudiée : **tout le traitement de
l’état de lecture, son enregistrement et sa transmission doit être piloté
au niveau du scénario Sighty**. La popup n’a pas à recevoir les états pour
les enregistrer, y compris en mode auteur. Elle reste un conteneur
d’affichage ; les opérations métier doivent emprunter le scénario.

Le chemin proposé est : **Question → action Sighty → modèle métier du
chapitre → contexte Sighty → appel du module de destination depuis l’action
Sighty**. Ce module réalise les échanges API/BDD en contexte auteur ou SCORM en
diffusion. La différence de protocole ne déplace pas la responsabilité de
déclenchement vers le conteneur du lecteur.

La [composition du lecteur](../../src/player/player-composition-types.ts)
reçoit actuellement l’état initial et `onTestStateChange` ; la popup branche
ce callback sur sa session BDD. C’est le circuit observé, pas la répartition
à conserver. Les recommandations précédentes de brancher SCORM dans la
popup, ou de lui laisser la sauvegarde BDD, sont retirées.

Les fonctions de `scenario.actions` peuvent déjà appeler un module métier
ou technique. L’évolution à étudier consiste à y regrouper les opérations
de restauration, enregistrement, reset et transmission, avec une destination
configurée pour la session. Le raccord de restauration initiale et de cycle
reste à préciser dans les ports existants ; aucune nouvelle phase runtime
ni API n’est définie ici. Ce choix d’architecture est non implémenté et ne
modifie pas les contrats actuellement vérifiés.

Le BDC recueille et affiche ; le modèle de chapitre calcule et définit la
clôture ; l’action Sighty conduit la mise à jour et appelle le module de
destination ; celui-ci traduit et exécute les échanges. Les champs `cmi.*`
restent dans le module SCORM, sans connaissance de ce protocole dans les BDC
ou le cœur générique du moteur. Les identifiants apprenant/session fournis
par le LMS appartiennent au contexte de diffusion.

Les données transmissibles comprennent l’identification du chapitre et de
la tentative, l’achèvement, la réussite et le score avec ses bornes lorsqu’il
a un sens. Réponses détaillées, temps et version du contenu peuvent les
compléter selon le besoin. Le modèle actuel possède déjà réponses, numéro
de tentative et résultat ; les données supplémentaires et leur correspondance
SCORM restent à décider. Un historique apprenant dans ELcé n’est pas un
préalable à ce raccord.

La clôture produit un instantané stable de la tentative. Une reprise ou une
édition ultérieure ne devrait pas réécrire silencieusement une tentative
déjà publiée. Retour sur la page Résultat, restauration et relecture ne
doivent pas créer une nouvelle tentative ; une reprise d’envoi doit retrouver
la même identité. Politique de conservation et choix dernière/meilleure
tentative restent des décisions métier de diffusion. Cela n’impose pas de
conserver cet historique dans la base de l’application auteur.

## Raccord concret selon le périmètre SCO

Le point métier identifié est dans l’action Sighty existante. La proposition
reste une étude, sans écriture de code :

1. `createRecordQuestionResult` retrouve déjà `page.chapterId` et actualise
   `evaluationStates[chapter.id]` avec la réponse acceptée.
2. `createRefreshEvaluationResult` applique `COMPLETE`, actualise ce même
   enregistrement, puis appelle actuellement `onTestStateChange` avant la
   présentation. À cet endroit, l’action devrait piloter l’enregistrement
   ou la transmission avec le module de destination, sans remonter l’état
   à la popup pour lui déléguer cette opération.
3. Les champs `context.result`, `context.attempt` et `context.answers` de
   l’état d’Évaluation fournissent résultat, tentative et réponses.
   L’opération doit distinguer nouvelle clôture, état restauré, relecture
   et transmission déjà traitée.

La configuration de diffusion doit fournir le périmètre de l’unité lancée
(document ou chapitre identifié) et l’association des identifiants ELcé
aux entrées SCORM. Ce sont des données de raccord à définir ; elles ne
sont pas des options déjà présentes dans le lecteur. Le module de destination
est utilisé par la logique du scénario pour sa session, sans être possédé
par une scène Résultat ou par la popup.

| Configuration | Sélection dans l’état existant | Destination envisagée, exemple SCORM 2004 |
| --- | --- | --- |
| SCO correspondant à un chapitre | `evaluationStates[chapterId]` pour le chapitre lancé | Score et réussite de ce chapitre alimentent `cmi.score.scaled` et `cmi.success_status` du SCO. Son achèvement suit la règle de complétion du chapitre. |
| SCO correspondant au document | Résultats identifiés de chaque chapitre | Association stable chapitre → `cmi.objectives.n.id`, puis score et statut de l’objectif correspondant. Le score/statut principal du SCO résulte d’une politique documentaire explicite. |

Le raccord ne doit pas utiliser la position d’un chapitre dans le tableau
comme identité ni remplacer le résultat global par celui du dernier chapitre
visité. La politique globale peut désigner une Évaluation ou définir une
agrégation ; elle reste à décider. L’option de suivi par chapitre peut
également utiliser les objectifs internes d’un SCO document si la
restitution attendue du LMS le permet.

Le callback actuel est une notification d’instantané, pas une confirmation
de sauvegarde. Dans la cible étudiée, la logique du scénario doit pouvoir
suivre les résultats en attente ou confirmés et les erreurs de destination.
Le numéro de tentative seul ne distingue pas une nouvelle session ; son
identification et la restauration restent à cadrer. Ces besoins ne demandent
pas de recalculer le score dans le module de destination.

Si le choix technique est effectivement plusieurs SCO, le périmètre des
données ne suffit pas : le scénario de lecture doit aussi correspondre au
chapitre lancé. `startPageId` ne fait aujourd’hui que choisir un départ ;
il ne borne pas le document à ce chapitre. Il faudra définir la projection
transmise au constructeur existant, avec traitement des pages racines,
liens interchapitres, prérequis et état partagé. Aucun tel bornage n’est
acquis dans le contrat actuel. Les dépendances d’état entre chapitres doivent être examinées avant de
séparer les unités.

La préparation côté ELcé consiste donc à garder les résultats identifiables
par chapitre et à faire piloter leur restitution par le scénario Sighty.
Le choix des
unités et leur fabrication relèvent ensuite du projet de diffusion. Aucun
nouveau circuit de collecte, d’évaluation ou de navigation n’est nécessaire
pour la seule transmission des résultats.

## Ce que SCORM peut transporter

Le [guide ADL pour programmeurs, chapitres 4–6, 14 et 16](https://lms.technology/archived/adlnet/adlnet.gov/assets/uploads/SCORM_Users_Guide_for_Programmers.pdf)
décrit API, résultats, interactions et reprise. En SCORM 2004, score,
achèvement et réussite sont distincts ; les objectifs peuvent porter des
résultats internes au SCO, et les interactions le détail des réponses.
`suspend_data` sert à la reprise, pas à un relevé de notes interprété par le
LMS. La restitution des détails dans les rapports dépend du LMS. En 1.2,
`cmi.core.lesson_status` réunit des états que 2004 sépare ; l’adaptateur doit
donc avoir une politique explicite selon la version cible
([documentation SAP](https://help.sap.com/docs/successfactors-learning/implementing-cross-domain-content-delivery/scorm-1-2-to-2004-run-time-environment-rte-changes?locale=en-US&state=PRODUCTION&version=2605)).

L’association aux champs SCORM est assurée par le module de destination
appelé depuis les actions Sighty ; sa configuration effective selon l’option
d’export relève de la diffusion. Les résultats restent identifiables par
chapitre.

## Quand transmettre et quoi vérifier

La publication doit suivre la clôture métier de la tentative, en distinguant
« résultat calculé » et « écriture confirmée par l’API LMS ». Le raccord
actuel à la page Résultat est le point d’observation existant ; l’éventuelle
indépendance de cette clôture vis-à-vis d’une page visible reste à décider.
Une simple modification de contexte, un montage DOM ou un Seek ne constitue
pas un événement de publication.

La logique du scénario piloterait les appels au module SCORM pour ouvrir la
session, écrire et demander le commit aux étapes utiles ; le raccord de
terminaison au cycle de sortie reste à cadrer.
La [note ADL sur la communication runtime](https://adlnet.gov/assets/uploads/ADL_CrossDomainScripting_1_0.pdf)
distingue `LMSCommit/LMSFinish` en 1.2 et `Commit/Terminate` en 2004. Le commit
du résultat doit être tenté pendant la session, sans dépendre uniquement de
la fermeture de l’onglet. Échec d’envoi, reprise et absence d’API doivent
rester observables, sans effacer le résultat métier ni simuler une confirmation.
Les `SetValue` successifs ne doivent pas être supposés transactionnels.

Le contrat de sortie doit préciser données, identité de tentative, clôture,
relecture, reprise d’envoi et confirmation/erreur de destination. Le raccord
SCORM devra suivre la version retenue par le projet de diffusion. Une
Évaluation sans Question rend aujourd’hui un résultat nul : aucune note
fictive ne doit être fabriquée pour la transmission.

Les preuves propres au transit portent sur succès, échec suivi de retry,
relecture, retour au résultat, plusieurs chapitres et changement de destination,
avec confirmation ou erreur d’enregistrement. La validation de l’export
exécutable appartient au projet distinct ; le mode auteur ne certifie pas
une intégration LMS. Aucun contrat implémenté n’est modifié par cette étude.
