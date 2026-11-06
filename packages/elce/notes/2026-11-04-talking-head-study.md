# Tête parlante — captation et narration synchronisée

Note d’étude du 4 novembre 2026. Elle rassemble le besoin, les références et
les constats techniques. Les décisions retenues, questions ouvertes, étapes
et critères d’acceptation appartiennent au [plan de cadrage](../plan/2026-11-04-talking-head-plan.md).
Ce travail documentaire ne certifie aucune nouvelle capacité runtime.

## Usage visé

Dans une page Diapo Elcé, une tête animée parle devant le fond d’un médaillon
flottant, déplaçable et redimensionnable au-dessus du Carousel. La tête dépasse
légèrement par le haut ; le fond ne constitue pas un cadre de découpe. Le
placement est responsive et le design reste à élaborer. Les cartes apparaissent
au début des mots choisis par l’auteur, la première étant visible dès zéro.
La voix validée fournit la durée du dispositif et la fin fonctionnelle de page.

L’interface auteur comporte deux parties :

- Un bouton Avatar ouvre une modale de prise : micro, caméra pour orientation
  de tête/regard, aperçu et nouvelle prise. Après la saisie, la voix enregistrée
  est transformée vers une voix choisie puis réécoutable. Le montage et les
  coupes sont reportés après le POC.
- Après validation, l’auteur place l’avatar sur la Diapo. Chaque carte dispose
  du transcript pour choisir son instant d’apparition. La carte reçoit le temps
  correspondant à l’occurrence sélectionnée. Remplacer la prise demande de
  réassocier manuellement les cartes dont les repères sont invalidés.

La prise produit une ressource audio, les mots horodatés, des extraits de
sous-titrage, des visèmes et les pistes de mouvement retenues. La conversion
vocale et les données temporelles doivent rester cohérentes.

Le Carousel narré ne propose pas de navigation entre cartes. Une télécommande
Play/Pause/progression peut prendre place dans la navigation ou sous la Diapo,
visuellement à la place des points ; elle reste techniquement hors scène.
Son inclusion et sa disposition restent au plan.

Il s’agit d’un module ajouté à l’application web Elcé. Son connecteur apporte
le bouton Avatar, l’attache de la prise à la page, le placement et les repères
des cartes ; le module partagé apporte captation, données de narration et
story Avatar. Le lecteur et les circuits documentaires existants sont
réutilisés. Le développement du POC sur Mac ne crée pas de variante Mac du
produit. Les traitements peuvent s’exécuter dans le navigateur, sur serveur
ou via un SaaS ; aucune application native ni installation d’outil sur le poste
auteur n’est prévue. La lecture mobile et SCORM ne font pas partie de ce POC.

Les extensions envisagées sont le rendu Three.js, le clignement, l’humeur,
l’orientation du corps, les mains, le montage, plusieurs personnages captés ensemble ou
successivement, et d’autres formats de page. Les commandes de navigation pour
afficher/masquer le transcript et contrôler le son sont aussi des évolutions.
Ces extensions orientent les frontières de données sans engager leur réalisation
dans le POC.

Une évolution à concevoir plus tard est un BDC audio simplifié, proche du BDC
Avatar, qui permette d’ajouter un son sans avatar. Son édition et sa lecture
restent à cadrer avant sa réalisation.

## Intégration auteur proposée — 5 novembre 2026

L’utilisateur propose un BDC Avatar comme point d’entrée vers la captation
sonore et les réglages de placement. Le Carousel détecte l’Avatar et propose
alors le transcript pour associer le début d’une carte à un mot horodaté.
Le cadrage est ouvert au lot 4 ; les comportements ci-dessous sont des
propositions d’interaction, sans modification des spécifications vérifiées.

Le BDC Avatar pourrait référencer une prise validée contenant l’audio final,
les occurrences de mots et les visèmes, et porter les réglages de son
apparition : position, taille et choix de lecture. La captation reste un
module réutilisable ouvert depuis cet éditeur. L’association des cartes
consulterait la prise de l’Avatar de la même Diapo ; le Carousel ne posséderait
pas une copie de son transcript ni un deuxième lecteur de voix.

Dans chaque vue, une commande « Synchroniser avec la voix » ouvrirait le
transcript. Choisir une occurrence fournirait son début horodaté ; la première
carte resterait à zéro. L’occurrence dans une prise identifiée permettrait de
distinguer les mots identiques. Retirer l’Avatar ou remplacer sa prise ne
conserve pas le lien aux occurrences : l’utilisateur a choisi de supprimer
ces associations tout en gardant leurs temps de déclenchement. L’association
et le temps doivent donc rester distincts ; un nouveau transcript ne récupère
pas automatiquement les liens précédents. L’ordre temporel des cartes doit
rester vérifiable après leur réorganisation.

Le placement retenu par l’utilisateur est un BDC Avatar de page, à côté du
Carousel, sans relation parent/enfant entre ces deux BDC. Il maintient la
séparation entre le réglage de la
narration et les contenus synchronisés, et permet de conserver un Avatar
lorsqu’on remplace le contenu principal. Elle demande toutefois une évolution
explicite du contrat documentaire : une Diapo est aujourd’hui limitée à un
seul BDC direct. La cardinalité proposée pour cette tranche est un Avatar par
Diapo ; cette limite reste distincte du placement accepté. Le BDC doit conserver
son emplacement unique et les circuits de commandes/historique existants.

Le découpage convenu est conservé : éditeur sur fichiers fournis au lot 4,
puis captation micro/caméra, conversion après saisie et réécoute au lot 5.
L’accès à la captation décrit le parcours cible du BDC Avatar ; il ne déplace
pas cette réalisation dans le lot 4. L’audio, Rive et les données de prise doivent
rejoindre les frontières média et documentaire existantes, après décision de
leur admission et de leur stockage.

## Références et observations

- [Présentation Contra](https://contra.com/p/vgBqssvc-viseme-tester-a-free-lip-sync-tool-for-rive-characters).
- [Viseme Tester AniMattor](https://www.animattor.co/viseme-tester), interface
  et inspecteur consultés dans Safari MCP le 4 novembre 2026.
- [Fichier fourni : my-matt-visemes.riv](https://2jprocess-my.sharepoint.com/:u:/p/asecher/IQDFVfWLPxbIR5tg4ZjwRZI4AWWhxsGkDq7g1FRoMsxFDJo?e=rc9iAt).
  L’utilisateur l’a aussi fourni à `/Users/Rve/Downloads/my-matt-visemes.riv`.
  Cette copie a été inspectée avec le runtime du dépôt dans une page locale
  isolée. Son empreinte est identique à celle lue sur SharePoint ; les mesures
  sont conservées dans la [preuve native](./assets/talking-head/rive-native-inspection.json).
- [Démo Rive CodPlay V2](../../demos/src/v2/demos/rive/main.ts) et sa
  [scène](../../demos/src/v2/demos/rive/scene.ts).

Le site AniMattor distingue génération vocale ElevenLabs, import audio et
microphone. Son mode micro annonce une estimation live des formes de bouche
depuis le son, sans clé API. Ce fonctionnement ne prouve pas une transcription
française horodatée. Les téléchargements audio/JSON sont désactivés avant
génération ; aucun de ces fichiers n’a été récupéré. Aucun appel payant,
enregistrement micro ou accès caméra n’a été effectué.

### Obtention de la timeline des visèmes dans la démo — 5 novembre

L’inspection de la page a révélé `window.__vtLib.buildTimeline(alignment,
lang)`, qui transforme localement un alignement de caractères en formes de
bouche. ElevenLabs ne renvoie donc pas les visèmes : il fournit les temps des
caractères, puis la démo applique son propre dictionnaire orthographique par
langue et son jeu de formes choisi.

- Pour le TTS, AniMattor appelle `POST /text-to-speech/{voice_id}/with-timestamps`
  et passe `alignment` — ou `normalized_alignment` — au générateur.
- Pour un son fourni, l’auteur saisit le transcript, puis la démo appelle
  `POST /forced-alignment`. Elle convertit la liste de caractères `{text,
  start, end}` en trois tableaux de caractères/débuts/fins et passe le résultat
  au même générateur. Ce parcours n’appelle pas Speech to Text pour reconnaître
  automatiquement le transcript.
- Le générateur parcourt les caractères dans l’ordre, cherche d’abord les
  graphèmes multi-caractères de la langue, puis une règle caractère par
  caractère avec repli sans diacritiques. Une règle peut produire plusieurs
  formes ; leur intervalle commun est réparti à parts égales. Les règles
  françaises contiennent notamment `an/am/en/em`, `on/om`, `ch`, `gn`, `qu`,
  ainsi que des terminaisons muettes. Les pauses, ponctuations et intervalles
  sont ensuite ramenés au repos, avec fusion des formes identiques contiguës.
- Pour le rig Avatar fourni, le jeu à retenir est Azure à 22 formes. L’export
  de la démo associe chaque forme à son index, sa propriété Rive, ses bornes
  temporelles et les lettres sources ; le projet contient déjà un exemple
  `v100`–`v121` pour cette cible.

Le microphone live est un parcours distinct : la démo annonce une estimation
depuis le son, sans transcript ni clé. Il ne produit pas cette timeline
française alignée ; celle-ci demande le TTS horodaté ou un transcript aligné
sur la prise. Cette distinction empêche de présenter l’estimation live comme
équivalente à la timeline exportée.

L’inspecteur du fichier en ligne `matt_visemes.riv` montre
`Matt_Visemes_SM`, 22 propriétés numériques ViewModel `v100` à `v121`,
`isTalking`, puis `headTilt`, `headX` et `headY`. L’interface emploie les IDs
de visèmes Azure et une valeur active de 100. Ce constat concerne le rig du
site ; le profil du fichier fourni a ensuite été vérifié nativement ci-dessous.
[Source : outil et inspecteur AniMattor](https://www.animattor.co/viseme-tester).

Le code caméra chargé par cette page confirme que les mouvements de tête ne
viennent pas d’un fichier annexe. Le navigateur ouvre une caméra vidéo seule
(640 × 480), charge MediaPipe Tasks Vision 0.10.1 et
`face_landmarker.task`, puis exécute un `FaceLandmarker` en mode vidéo (GPU,
repli CPU). Les landmarks du nez, du contour du visage et des yeux donnent les
axes X/Y et l’inclinaison. La première détection sert de centre ; chaque frame
convertit les écarts en valeurs 0–100 pour `headX`, `headY` et `headTilt`.
Le réglage Smoothing vaut 60 % par défaut et applique
`sortie = 0,6 × sortie précédente + 0,4 × cible` à chaque frame. Ces valeurs
sont écrites directement dans les Numbers Rive. Une option séparée projette
aussi les blendshapes ARKit sur les propriétés numériques correspondantes.

Les triggers `CONTACT_FACE_Trigger` et `CONTACT_HEAD_TRIGGER` et l’entrée
`CONTACT_isTracking` visibles dans l’inspecteur ne sont pas utilisés par la
boucle de suivi caméra. Celle-ci écrit les trois Numbers de tête. Le JSON
exporté reste la piste de visèmes/mots : il n’embarque ni frames caméra ni
keyframes de tête. Le fichier `.task` est le modèle de détection à exécuter,
pas une description des mouvements d’une prise. Pour rendre la tête rejouable,
CodPlay devra capturer et réduire cette piste séparément.

## Référence API ElevenLabs du 5 novembre 2026

L’inspection directe de la démo [AniMattor Viseme Tester](https://www.animattor.co/viseme-tester)
montre dix choix de voix intégrés au sélecteur, avec Aria sélectionnée avant
toute requête. La saisie de la clé permet à la démo d’appeler directement les
opérations choisies ; « Load my ElevenLabs voices » est une action distincte,
qui remplace la liste par les voix du compte. Elle appelle `GET /v1/voices`
avec `xi-api-key`. La démo ne traite donc pas le chargement de cette liste comme
un contrôle préalable à la synthèse.

La documentation des clés indique qu’elles peuvent être restreintes par
endpoint. L’essai de la clé présente dans Elcé a retourné, pour la liste des
voix sur les routes v1 et v2, HTTP 401 avec le code moderne `unauthorized`, le
statut historique `missing_permissions` et un message exigeant `voices_read`.
Ce résultat concerne la liste des voix ; il ne prouve pas que la même clé
échoue au TTS. Il est compatible avec le parcours de démo : si la permission
TTS est activée et `voices_read` ne l’est pas, les voix intégrées permettent
tout de même de demander une synthèse. Aucun appel de génération payant n’a été
fait pendant cet audit.

La documentation actuelle marque pourtant `GET /v1/voices` comme obsolète et
indique qu’il cesse de fonctionner si le workspace dépasse 500 voix. La liste
facultative d’Elcé utilise donc `GET /v2/voices`, avec `page_size` et les
curseurs de pagination documentés. Une erreur de permission à cette étape
laisse les dix voix de démonstration disponibles et ne bloque pas les autres
opérations. Le gestionnaire commun lit les champs d’erreur documentés
`detail.type`, `detail.code`, `detail.message` et `detail.request_id`, tout en
acceptant l’ancien `detail.status`. Il distingue la permission manquante pour
l’opération en cours d’une clé invalide, d’une limite de crédits ou d’une
erreur réseau ; aucune valeur de clé ne passe dans ses messages.

Le TTS de la démo appelle
`POST /v1/text-to-speech/{voice_id}/with-timestamps?output_format=mp3_44100_128`,
avec `xi-api-key`, `Content-Type: application/json` et `{text, model_id}`. Elle
utilise `alignment` ou, si absent, `normalized_alignment` pour l’alignement des
caractères. Les endpoints transcription, forced alignment et Voice Changer
restent des opérations indépendantes, chacune soumise à sa permission propre.
Les formes de requêtes Elcé suivent les endpoints officiels et centralisent
leur traitement d’erreur ; l’audio ne rejoint pas Elcé avant le choix explicite
de la piste finale.

La clé reste un secret et n’est pas exposée à Elcé. La case de mémorisation
facultative agit uniquement dans le `localStorage` du navigateur, conformément
au besoin provisoire exprimé ; un proxy de secrets reste une évolution
ultérieure.

Sources : [démo AniMattor](https://www.animattor.co/viseme-tester),
[authentification API](https://elevenlabs.io/docs/api-reference/authentication),
[permissions des clés](https://elevenlabs.io/docs/overview/administration/workspaces/api-keys),
[erreurs API](https://elevenlabs.io/docs/eleven-api/resources/errors),
[route v1 legacy](https://elevenlabs.io/docs/api-reference/legacy/voices/get-all),
[API paginée v2](https://elevenlabs.io/docs/api-reference/voices/search),
[TTS avec horodatages](https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps).

Les opérations audio documentées sont distinctes : Text-to-Speech avec
horodatage renvoie le son et un alignement caractère par caractère ; Speech to
Text peut renvoyer les mots horodatés ; Forced Alignment aligne un son sur le
texte fourni, caractère et mot ; Voice Changer transforme un son d’entrée vers
une voix choisie. Par inférence des réponses de ces API, elles ne fournissent
pas directement une piste de visèmes propre au rig Rive. Le module devra
reproduire la conversion locale observée dans la démo puis adapter ses repères
au profil de personnage. La branche
transformée doit être réalignée sur sa sortie audio avant d’en dériver les
visèmes ; l’alignement antérieur ne garantit pas les nouveaux temps.

Sources officielles : [authentification et clés](https://elevenlabs.io/docs/api-reference/authentication),
[TTS avec horodatages](https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps),
[Speech to Text](https://elevenlabs.io/docs/api-reference/speech-to-text/convert),
[Forced Alignment](https://elevenlabs.io/docs/api-reference/forced-alignment/create),
[Voice Changer](https://elevenlabs.io/docs/api-reference/speech-to-speech/convert).

## Circuits existants et frontières à examiner

### Rive : le ViewModel précède la nouvelle démo

Le [contrat Rive V2](../../codplay/specs/third-party-rive-spec.md) distingue
le host `rive`, propriétaire de la ressource, de l’artboard et du rendu,
du composant logique `rive-state-machine`, attaché par `rel`. Ce dernier
expose des inputs nommés numériques/booléens. Les noms du fichier ne sont
pas une sémantique lip-sync du runtime.

La démo actuelle emploie `coach.riv`, l’artboard `Coach model` et l’input
numérique `lips sync id`. Elle traduit les cues Rhubarb vers les valeurs du
coach. Son fichier audio et ses mots français horodatés sont déjà disponibles
dans le dépôt. Elle ne réalise pas la captation ni le STT.

Au début de l’étude, le module ne proposait que les inputs classiques ;
les propriétés ViewModel ne pouvaient pas être présumées accessibles par
`inputs`. Le composant distinct `rive-view-model` couvre désormais cette
frontière avec le fichier réel et la version Rive installée. Le mapping sémantique visème → propriétés du rig doit
rester distinct du mécanisme de binding. La nouvelle démo devra consommer ce
composant réutilisable ; une adaptation locale masquant le manque de binding
ne démontrerait pas la capacité CodPlay recherchée.

La preuve native du nouveau composant est bornée au rig fourni ; elle ne
ferme pas les autres parcours du
[plan des composants tiers](../../codplay/plan/2026-09-18-third-party-components-v2-plan.md).

### Inspection du fichier fourni avec Rive 2.38.3

Le 4 novembre 2026, une page d’inspection temporaire sur `127.0.0.1` a chargé
uniquement le fichier fourni, le JavaScript et le WASM de
`node_modules/@rive-app/canvas` **2.38.3**. Aucun outil natif n’est prévu pour
l’auteur par cette instrumentation de développement. Aucun composant du dépôt
n’a été modifié. Le fichier mesure **84 538 octets** ; son SHA-256 est
`e668aee807a3100c379838cd2b2cc81c3ab9215c71652d7dadd5f7b9b56cf67f`.

| Élément | Constat natif sur le fichier fourni |
| --- | --- |
| Artboard du personnage | `Matt Visemes`, repère natif 420 × 500. Les trois autres artboards sont des éléments de marque ; ils ne sont pas des personnages supplémentaires. |
| State machine | `Matt_Visemes_SM`. |
| ViewModel associé | `VisemesVM`. |
| Instance exportée | `Instance` ; `defaultInstance()` fournit les valeurs auteur attendues. |
| Bouche | 22 propriétés numériques `v100` à `v121` ; au repos `v100 = 100`, les autres valent zéro. |
| Parole | `isTalking`, booléen initialement faux. |
| Tête | `headX`, `headY`, `headTilt`, initialement à 50. Les valeurs 0 et 100 éprouvées modifient le rendu. Cela ne certifie pas toutes les plages admissibles. |
| Inputs legacy séparés | `Talking`, `CONTACT_FACE_Trigger`, `CONTACT_HEAD_TRIGGER`, `CONTACT_isTracking`. Ce ne sont pas des alias des propriétés ViewModel. |

La version déjà installée expose `File.viewModelByName`,
`File.defaultArtboardViewModel`, `ViewModel.defaultInstance`, les accesseurs
de propriétés et `StateMachineInstance.bindViewModelInstance` dans
[`rive_advanced.mjs.d.ts`](../../../node_modules/@rive-app/canvas/rive_advanced.mjs.d.ts).
Le fichier charge et le binding fonctionne avec cette version. Aucune mise à
jour de Rive n’est donc démontrée nécessaire pour ce périmètre.

### Runtime ESM pour Remix

Le build Remix refusait `@rive-app/canvas/rive.js` parce que le paquet
`@rive-app/canvas@2.38.3` expose ce point d’entrée CommonJS, sans runtime ESM.
L’option `scripts.external` de Remix conserve un import dans l’import map ; elle
ne convertit pas son format. L’API avancée bas niveau convenant déjà au host
CodPlay, le composant V2 emploie maintenant
`@rive-app/canvas-advanced-single@2.38.3` : son point d’entrée est
`canvas_advanced_single.mjs`, son initialiseur par défaut fournit le runtime,
et le module embarque son WASM. Le fichier installé mesure 2 703 300 octets.
Seul `@codplay/component-v2` change de dépendance ; le composant historique
dans `packages/authoring/components/rive` reste inchangé.

Safari a chargé `rive-preload.ts` depuis l’asset server Remix et initialisé le
runtime (`load` et `makeRenderer` disponibles). La démo CodPlay V2 a servi le
même module et le fichier Matt réel ; sa telco a basculé en lecture puis en
pause et retour au début. Le test du projet `Projet 2` dans Elcé n’exerce pas
encore cette story : la page lisible Page A est un flux avec Carousel et la
Diapo Page B est vide. L’aperçu standard ne transmet pas l’option temporaire
`temporaryRiveTalkingAvatarByPageId`. Ce raccord reste dans le plan.

Sources : [Remix — Assets](https://docs.remix.run/assets/),
[paquet canvas](https://github.com/rive-app/rive-wasm/blob/master/js/npm/canvas/package.json),
[paquet canvas-advanced-single](https://github.com/rive-app/rive-wasm/blob/master/js/npm/canvas_advanced_single/package.json),
[API bas niveau](https://github.com/rive-app/rive-wasm/blob/master/js/src/rive_advanced.mjs.d.ts).

L’[API Rive documentée](https://rive.app/docs/runtimes/web/data-binding)
sépare la définition du ViewModel de ses instances, recommande le binding sur
la state machine lorsqu’elle existe et précise que les valeurs liées sont
appliquées lors de son avancement. La documentation courante ne remplace pas
la surface exacte disponible en 2.38.3, qui a été vérifiée localement.

Les vérifications natives effectuées sont bornées :

- Le changement de forme de bouche et chacun des trois contrôles de tête
  modifient le buffer rendu. Le retour au repos retrouve exactement son hash
  initial, y compris après binding et avancement à delta nul.
- Deux artboards et deux instances exportées depuis le même fichier restent
  indépendants : modifier la tête et la bouche du premier ne change pas les
  valeurs initiales du second.
- Avec une pose ViewModel constante, à 1, 3 et 5 secondes, avancer par pas de
  1/60 s ou en un seul delta donne des écarts de rendu d’au plus **1/255** par
  canal, avec ou sans `isTalking`. Ce constat n’établit pas le rejeu d’une
  succession de changements de visèmes, de triggers ou de poses.

Ces résultats sont une inspection du runtime Rive natif, pas une acceptation
du chemin CodPlay, de son Seek, du preload ou de son cycle de vie. Ils ne
ferment aucune gate d’intégration du plan.

Le rendu contient un fond rectangulaire clair et n’expose pas de propriété
ViewModel permettant de le masquer. L’utilisateur a retenu de garder ce fond
pour la première démo et de préparer le médaillon ensuite. Aucune commande de
regard indépendante des trois contrôles de tête n’a été identifiée : le
mapping caméra doit préciser ce que ce rig peut effectivement restituer.

### Choix de composant et Seek narratif

Le binding ViewModel est désormais porté par un composant distinct dans le
package authoring, avec le cycle de state machine partagé. La surface et les
preuves vérifiées appartiennent à la
[spécification Rive](../../codplay/specs/third-party-rive-spec.md), pas à cette
étude. Le mapping visème → propriétés du rig reste une responsabilité du
profil de personnage. La nouvelle démo réutilise la piste Rhubarb et fait une
première correspondance vers les 22 ID documentés par
[Azure Speech](https://learn.microsoft.com/en-us/azure/cognitive-services/speech-service/how-to-speech-synthesis-viseme).
L’hypothèse `v100 + ID` vient des noms de propriétés et de `v100 = 100` au
repos ; le fichier ne fournit pas leur sémantique. Les regroupements des formes
Rhubarb vers ces ID sont donc provisoires et restent à vérifier visuellement
sur le rig réel.

Le choix de Seek privilégie l’intention narrative : CodPlay reconstruit les
contributions dues à T et le composant les transmet au rig. Les phases internes
libres de Rive ne justifient pas un rejeu complet depuis le début. Le delta
natif seul ne saurait garantir leur reconstruction exacte ; elles sont hors
de l’engagement retenu pour ce projet.

### Capture continue et réduction

Le [contrat de capture V2](../../codplay/specs/capture-v2-spec.md) sépare les
samples éphémères, les actions live et les événements de fin. Les samples ne
sont pas journalisés ; `endCapture` peut produire des événements persistants
reconstructibles. Ce circuit est source-agnostique ; le raccord caméra et ses
samples restent à définir pour ce besoin.

La démo [Stroke Path](../../demos/src/v2/demos/stroke-path/main.ts) applique
filtrage par distance et Douglas-Peucker avant stockage. Son
[plan](../../demos/plan/2026-09-23-stroke-path-v2-plan.md) précise les limites
expérimentales de la fixture. Elle prouve une piste de réduction, pas un
réducteur facial générique à recopier.

Pour une animation de tête, la réduction doit conserver le temps, les pauses
et les extrêmes, avec une erreur mesurée lors du rejeu ; une simplification
purement spatiale peut effacer une immobilité utile. L’objectif est un événement
final avec les données de la capture continue, sans événement par frame.
Les pistes de mots et visèmes discrets restent distinctes des échantillons
caméra bruts. La forme exacte des données réduites et de leur projection en
actions doit être qualifiée avant implémentation.

### Diapo, Carousel et horloge

Le [builder Diapo](../specs/diapo-scene-builder-spec.md) adopte actuellement
la story du Carousel comme story unique de page. Une Diapo contient au plus
un BDC direct. Le [Carousel](../specs/carousel-bdc-spec.md) conserve les durées
de ses vues ; un clic de navigation arrête sa progression automatique.
Sa dernière carte déclenche aujourd’hui `elce:page:finished`.

La narration introduit donc une évolution à concevoir explicitement : intégrer
la story Avatar prête à l’emploi à cette composition, conduire les cartes
depuis les mots et attendre la fin de voix pour la fin fonctionnelle de cette
Diapo. Ajouter simplement un deuxième BDC direct contredirait le contrat courant.
La décision de durée retenue est suivie au plan ; elle n’est pas encore
implémentée dans ces spécifications.

Le [module media-sync](../../codplay/specs/media-sync-v2-spec.md) possède déjà
le mode `master`, utilisé par l’audio de la démo Rive. Il fournit le circuit
à examiner pour une horloge commune voix/visèmes/mouvements/cartes, sans
temporisateur ou lecteur supplémentaire. La lecture live d’une source directe
reste un sujet distinct au [plan média](../../codplay/plan/media-preload-plan.md).

### Réemploi et persistance

L’organisation [core, ressources et mods](../mods/plan/2026-10-20-elce-mods-reconfiguration-plan.md)
attribue le métier réutilisable aux ressources et le raccord documentaire à
Learning. Le besoin dépasse aussi Elcé : le module de captation et ses données
doivent pouvoir être repris par Editor ou un autre projet. Un paquet partagé
et des connecteurs sont à examiner avant de retenir son emplacement physique.
Aucun registre de plugins ni nouveau mod n’est requis par le besoin décrit.

Le [document courant](../specs/document-model-spec.md) est en v10. Les
raccords passent par son contrôleur, ses commandes, son historique et les
circuits existants de [cache](../specs/document-store-spec.md),
[API et fichiers](../specs/project-api-spec.md). Le plan Mods conserve des
références historiques au v7 ; elles ne remplacent pas le contrat v10.

La gestion média actuelle admet image et vidéo :
`mediaTypeFromMimeType` rejette les autres MIME et le contrôleur HTTP utilise
cette admission. La constante `AUDIO` ne constitue pas une chaîne audio déjà
opérationnelle. Audio, `.riv` et données de pistes nécessitent donc une décision
d’admission et de stockage dans le circuit existant ; aucun dépôt parallèle
ne doit compenser ce manque.

## Reprise du Projet 3 — 5 novembre 2026

Le serveur confirme le Projet 3 à la révision 2 avec sa Diapo « Tête parlante —
Interstellar » et quatre Cartes. La preview standard sur 5175 monte le rig et
lit le MP3 ; les cartes suivent l’horloge master. Les commandes de diagnostic
appellent la telco de l’instance déjà montée par cette preview. Elles ne
construisent pas une composition de remplacement. Le Seek à 7,5 s présente la
deuxième carte avec l’audio à 7,5 s ; le retour à 1 s présente la première,
puis Pause conserve le temps et le canvas pendant 1,2 s. La sortie vers Page A
suspend l’ancien audio ; le retour réutilise son nœud, avec un seul canvas.
Le placement flottant actuel recouvre du texte ; son acceptation responsive
reste ouverte.

Le test builder narré passe, mais ne prouve que la présence déclarative de
`elce:page:finished` à 14 446 ms. En Play réel, le temps franchit cette date
sans notification publique et `finishedPages` reste vide. Une reproduction
CodPlay distincte, sans Elcé, Rive ou média, confirme la frontière :

- un `eventimes` auteur `test:compiled` à 100 ms, `visibility: 'public'`,
  applique bien l’action `content: 'compiled-reached'`, sans notification ;
- un événement `test:scheduled` à 150 ms injecté par `instance.events.emit`
  avec la même visibilité applique son action et publie sa notification ;
- à 349 ms, les deux actions sont projetées et seule la notification
  `test:scheduled` est reçue.

Cette comparaison n’établit pas un besoin de modifier CodPlay. La déclaration
Elcé utilisait une occurrence métier compilée au lieu du circuit de fin déjà
disponible. Après la précision de l’utilisateur, la correction reste dans
Elcé : `sequence:end` à 14 446 ms et une règle `listen.emit` publient
`elce:page:finished` avec `{ pageId }`. La fin terminale et le signal métier
gardent leurs rôles distincts ; le handler Sighty existant traite la fin de
page. La proposition d’étendre le moteur et son ajout au plan Player ont été
retirés. Aucune modification d’implémentation de CodPlay n’est nécessaire.

La preview réelle du Projet 3 vérifie ce raccord : un Seek à 14 446 ms ne
publie rien et ne termine pas la séquence ; une lecture depuis 13 500 ms
publie une seule fin métier à 14 446 ms, suspend la voix et marque la page
terminée sans navigation. Un reset suivi de la lecture complète republie une
seule fin à la même date. Le build Elcé passe et les suites ciblées conservent
68 succès sur 70, avec les deux échecs déjà relevés avant cette correction.
Le typecheck signale indépendamment une variable `title` inutilisée dans le
builder Graphe ; elle n’est pas modifiée dans ce travail.

Le serveur Remix sert le MP3 avec `Content-Type: audio/mpeg`, sans
`Content-Length` dans la réponse HEAD observée. Safari annonce `duration =
Infinity` et ne signale pas `ended` dans ce parcours. Ce constat média reste
à qualifier séparément ; la reproduction sans audio démontre qu’il n’explique
pas à lui seul la publication manquante.

Le [relevé](./assets/talking-head/elce-project-3-acceptance.json) conserve
les mesures, la reproduction et les deux échecs de tests avant modification
de cette reprise. Les actions restantes sont dans le
[plan](../plan/2026-11-04-talking-head-plan.md#g3--publication-de-la-fin-vocale).

## Évaluation préliminaire du local

Étude documentaire de faisabilité des traitements voix/caméra, sans modèle
d’analyse installé ni benchmark exécuté pour cette chaîne.
Le poste de développement est `arm64`, mais cela ne définit pas le déploiement
du module. Les possibilités à comparer sont l’inférence dans le navigateur et
sur un serveur, puis le SaaS selon le repli convenu. Les candidats Python ou
CLI ci-dessous concernent une éventuelle exécution serveur ; ils ne doivent
pas devenir des prérequis à installer chez l’auteur. La conversion vocale étant
effectuée après saisie, son temps réel simultané à la caméra et au STT n’est
pas une exigence du POC.

| Besoin | Candidats locaux et portée documentée | Limite à mesurer |
| --- | --- | --- |
| STT live français | `whisper.cpp` : exemple de transcription micro par fenêtres ; support Apple Silicon et Core ML. Employer un modèle multilingue. | Qualifier séparément navigateur et serveur : latence, texte provisoire/corrigé et charge avec la caméra. |
| Mots horodatés définitifs | `faster-whisper` expose `word_timestamps`; WhisperX propose un alignement spécifique au français. `whisper.cpp` qualifie ses timestamps mot d’expérimentaux. | Erreur des débuts de mots sur la voix réellement diffusée ; précision suffisante pour les cartes. |
| Visèmes | Plusieurs voies existent : [OpenFaceFX](https://github.com/OpenFaceFX/OpenFaceFX) transforme des phonèmes alignés en courbes Oculus/Meta à 15 formes ; [HeadTTS](https://github.com/met4citizen/HeadTTS) fournit audio TTS, mots et visèmes Oculus horodatés ; [HeadAudio](https://github.com/met4citizen/HeadAudio) estime ces formes depuis l’audio en direct. Rhubarb reste un comparateur A–H/X, pas l’unique option. | Mesurer le français, la qualité temporelle et l’obtention d’une piste éditable ; le rig Projet 3 emploie 22 canaux Azure, qui ne sont pas équivalents au jeu Oculus de 15 formes. Voir l’audit détaillé ci-dessous. |
| Tête/regard | MediaPipe Face Landmarker Web fournit landmarks, blendshapes et matrices faciales depuis la vidéo. | Correspondance tête/yeux vers les contrôles du rig, calibration, bruit et débit. Une orientation de tête n’est pas une estimation exacte du regard. |
| Conversion de voix | Seed-VC documente la conversion à partir d’une voix de référence et le support Apple Silicon ; w-okada distribue aussi des variantes Mac M1. Ces implémentations ne démontrent pas une exécution navigateur. | Qualifier une intégration web et les traitements serveur utilisables sans app native : qualité en français, ressources, délai après saisie, stabilité temporelle et voix proposées. |

Sources primaires : [whisper.cpp](https://github.com/ggml-org/whisper.cpp),
[faster-whisper](https://github.com/SYSTRAN/faster-whisper),
[WhisperX](https://github.com/m-bain/whisperX),
[Rhubarb](https://github.com/DanielSWolf/rhubarb-lip-sync),
[MediaPipe Face Landmarker](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker/web_js),
[Seed-VC](https://github.com/Plachtaa/seed-vc),
[w-okada](https://github.com/w-okada/voice-changer).

Seed-VC recommande un GPU pour le live et publie ses mesures sur NVIDIA ; elles
ne permettent pas de promettre la même performance sur ce Mac. Son dépôt est
archivé. La disponibilité d’un modèle constitue une piste d’essai, pas le choix
d’une dépendance de production. [Source](https://github.com/Plachtaa/seed-vc).

L’étude identifie des candidats pour chaque maillon, mais ne démontre pas
encore une chaîne web intégrée. Les réalisations natives/Python ne prouvent
pas une faisabilité côté navigateur. La qualification doit comparer la
faisabilité front et serveur, notamment pour la conversion après saisie,
avant de recommander une répartition des traitements ou un recours SaaS.

ElevenLabs documente STT français et timestamps mot via Scribe, ainsi qu’un
Voice Changer distinct. L’outil AniMattor ne prouve pas à lui seul l’intégration
de ces services à notre besoin. À la décision utilisateur du 6 novembre, le
STT local devient la voie prioritaire ; l’appel STT distant reste une option
explicite à décider, pas le repli implicite en cas d’échec local. Sources :
[STT ElevenLabs](https://elevenlabs.io/docs/overview/capabilities/speech-to-text/),
[Voice Changer](https://elevenlabs.io/docs/api-reference/speech-to-speech/convert).

## Audit local complémentaire et recommandations — 5 novembre 2026

Cet audit documentaire complète les candidats ci-dessus. À la décision du
6 novembre, la qualification STT/alignement local précède la finalisation de
leur raccord dans le parcours auteur. Aucun modèle n’a été installé ni mesuré ;
aucune dépendance locale n’est retenue. Le besoin reste une ressource autonome,
sans dépendance à Elcé, dont la sortie pourra alimenter la story Rive existante.

| Besoin | Candidat documenté | Atouts | Garde-fous avant choix |
| --- | --- | --- | --- |
| TTS dans le navigateur | [Kokoro-JS](https://github.com/hexgrad/kokoro/blob/main/kokoro.js/README.md) avec le modèle [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) | L’inférence peut fonctionner localement dans le navigateur avec WASM ou WebGPU. Le code et les poids déclarent Apache-2.0 ; le modèle compte 82 M de paramètres. | Le français ne dispose que d’une voix (`ff_siwis`), classée B- sur moins de 11 h d’audio ; le modèle précise que les langues peu représentées peuvent être faibles. Cette voix est liée à SIWIS sous CC BY : contrôler attribution et conditions avant redistribution. Kokoro fait du TTS, pas une conversion de la captation. Mesurer le téléchargement initial, la mémoire et la qualité dans les navigateurs visés. Sources : [voix Kokoro](https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md), [démo officielle locale](https://github.com/hexgrad/kokoro/tree/main/kokoro.js/demo). |
| TTS et repères phonétiques | [Piper](https://github.com/OHF-Voice/piper1-gpl), continuation actuelle du moteur local | Voix françaises disponibles en ONNX. L’API expose les alignements de phonèmes produits pendant la synthèse, piste utile pour dériver des visèmes sans réaligner une forme d’onde séparément. | Le moteur actuel est GPL-3.0 ; chaque voix a son propre MODEL_CARD et sa licence doit être vérifiée. Les alignements sont phonétiques, pas les occurrences de mots ni les visèmes Rive. Le dépôt ne certifie pas une exécution dans notre navigateur ni un déploiement Mac auteur. Sources : [alignements](https://github.com/OHF-Voice/piper1-gpl/blob/main/docs/ALIGNMENTS.md), [voix et licences](https://github.com/OHF-Voice/piper1-gpl/blob/main/docs/VOICES.md). |
| Transcription | [whisper.cpp](https://github.com/ggml-org/whisper.cpp) | MIT ; Apple Silicon, Metal/Core ML, WASM et exemple de flux micro documentés. Peut être essayé dans le navigateur ou derrière un service local. | Les horodatages fins au niveau des tokens sont expérimentaux ; ils ne suffisent pas à garantir les débuts de mots exigés par les cartes. Quantifier poids téléchargés, durée de calcul, mémoire et précision française. |
| Alignement mot par mot | [WhisperX](https://github.com/m-bain/whisperX) | BSD-2-Clause ; ajoute un alignement forcé wav2vec2, indique un modèle français et décrit l’exécution CPU sous macOS. La séparation transcription puis alignement convient aussi à un texte fourni par l’auteur. | C’est un chemin Python/serveur, pas une brique web déjà intégrée. Il faut vérifier le modèle d’alignement, ses termes, les accents, nombres, ponctuation et mots inconnus sur la voix finale ; les timestamps restent à corriger dans l’éditeur. |
| Transformation de voix | [OpenVoice V2](https://github.com/myshell-ai/OpenVoice) | Le dépôt annonce MIT pour V1/V2, clonage de timbre depuis une référence et prise en charge native du français. La procédure V2 associe les checkpoints OpenVoice à MeloTTS. | La procédure officielle d’installation est orientée Linux/Python ; une compatibilité Mac exploitable n’est pas établie. Le parcours documenté synthétise du texte avec un timbre de référence : vérifier qu’il satisfait bien la transformation de la voix enregistrée et conserve les paroles voulues. Chaque modèle/dépendance et droit sur la voix de référence reste à contrôler. Sources : [usage V2](https://github.com/myshell-ai/OpenVoice/blob/main/docs/USAGE.md), [MeloTTS français](https://huggingface.co/myshell-ai/MeloTTS-French). |
| Alternative de conversion de voix | [Seed-VC](https://github.com/Plachtaa/seed-vc) | Vraie conversion parole-vers-parole avec voix de référence ; le dépôt documente les Macs Apple Silicon et un modèle hors-ligne. | Dépôt archivé depuis novembre 2025 et GPL-3.0. À conserver comme point de comparaison de faisabilité, pas comme dépendance de production sans audit de maintenance, licence des poids et portage. |
| TTS et visèmes Oculus horodatés | [HeadTTS](https://github.com/met4citizen/HeadTTS) | TTS Kokoro local dans le navigateur (WebGPU/WASM) ou dans un service Node ; la réponse comprend l’audio, les mots et leurs temps, les phonèmes ainsi que les 15 IDs Oculus avec temps et durées. | Le dépôt déclare l’anglais comme seule langue prise en charge ; ce n’est pas une option pour la phrase française actuelle. Le premier chargement et la mémoire du modèle restent à mesurer. |
| Visèmes après prise, avec transcript connu | [OpenFaceFX](https://github.com/OpenFaceFX/OpenFaceFX) avec [Montreal Forced Aligner (MFA)](https://github.com/MontrealCorpusTools/mfa-models/blob/main/docs/source/acoustic/French/French%20MFA%20acoustic%20model%20v3_0_0.md) | OpenFaceFX produit des courbes JSON/CSV des 15 formes Oculus/Meta à partir de phonèmes horodatés, avec coarticulation et réduction des clés. Il lit les TextGrid MFA. Un modèle acoustique français MFA 3.0.0 est publié sous CC BY 4.0 ; OpenFaceFX est MIT et sa dépendance d’exécution est NumPy. Son Studio s’exécute aussi dans le navigateur via Pyodide. Cette génération applique la convention Oculus ; elle ne requiert pas l’ancien plugin OVRLipSync. | Candidat le plus proche d’une piste sauvegardable pour un son final et un transcript connu, mais aucun résultat français n’est validé. Vérifier la correspondance entre les phonèmes du modèle MFA français et la table OpenFaceFX, l’alignement sur les voix du Projet 3 et l’édition des clés. Son alignement « naive » sans modèle est une approximation de prototypage, pas la voie précise. |
| Estimation audio en direct pour prévisualisation | [HeadAudio](https://github.com/met4citizen/HeadAudio), intégré dans le [Space Hugging Face `victor/gemma-avatar`](https://huggingface.co/spaces/victor/gemma-avatar), [Talking Avatar](https://github.com/InterviewFlowAI/talking-avatar) et [lipsync-engine](https://github.com/Amoner/lipsync-engine) | HeadAudio est un AudioWorklet MIT qui émet directement les poids Oculus depuis le PCM ; le Space HF le raccorde à un avatar dans le navigateur, avec environ 50 ms annoncées. Talking Avatar est un modèle causal navigateur MIT d’environ 1 MB ; il anime un GLB à visèmes Oculus. lipsync-engine est un moteur MIT AudioWorklet/FFT qui émet des événements nommés Oculus avec `timeMs`, sans modèle à télécharger. | Ce sont des estimations audio, sans association transcript/mot ni piste phonétique pré-calculée. Le Space HF s’appuie sur un backend distant pour la conversation ; il démontre le raccord HeadAudio, pas une chaîne autonome locale. Le modèle HeadAudio fourni (`model-en-mixed.bin`) a été entraîné sur quatre voix HeadTTS et des phrases anglaises ; son dépôt juge sa VAD et sa précision encore faibles, surtout avec du bruit. Talking Avatar est entraîné en anglais : il déclare 82 % de formes correctes sur parole anglaise claire et approxime les sons français absents ; son API est un lecteur 3D, pas un export de cues. lipsync-engine relève une forme depuis les fréquences ; sa qualité française n’est pas documentée. |
| Audio vers expressions faciales, inférence locale | Exports HF de [LAM-Audio2Expression](https://huggingface.co/3DAIGC/LAM_audio2exp) : [ONNX navigateur `omote-ai/lam-a2e`](https://huggingface.co/omote-ai/lam-a2e), [variante CPU `myned-ai/wav2arkit_cpu`](https://huggingface.co/myned-ai/wav2arkit_cpu) et [Core ML Apple Silicon `enconvo/avatar-lipsync-1-coreml`](https://huggingface.co/enconvo/avatar-lipsync-1-coreml) | Inférence audio→52 blendshapes ARKit à 30 fps. L’export ONNX annonce WebGPU/WASM et des poids de 97 à 384 MB ; la variante CPU annonce 1,8 MB et 22× temps réel ; l’export Core ML annonce 72 MB et 11 ms pour deux secondes d’audio sur M1 Max. Les dépôts affichent Apache-2.0. | Les annonces de taille et de vitesse sont celles des cartes, pas des mesures réalisées ici. Le modèle n’émet ni les 15 visèmes Oculus, ni les 22 canaux Azure du rig Projet 3, ni les mots horodatés ; il faudrait qualifier un mapping et la conservation de la timeline. La carte ONNX précise que les données d’entraînement amont ne sont pas publiées ; la qualité française et le rendu sur notre voix/rig ne sont pas établis. Candidat d’essai, pas dépendance retenue. |
| API Oculus/Meta sur appareil | [Meta Movement SDK — audio-based face tracking](https://developers.meta.com/vr/documentation/unity/move-face-tracking/) | La documentation mise à jour en 2026 décrit des visèmes audio et les mêmes 15 formes Oculus via l’API Movement sur des casques Quest compatibles. | Dépend d’un casque et du SDK natif Meta ; ce n’est pas un moteur local général pour Safari/Elcé. Le plugin historique OVRLipSync est annoncé en fin de vie par Meta. |
| Comparateur historique | [Rhubarb Lip Sync](https://github.com/DanielSWolf/rhubarb-lip-sync) | MIT ; CLI macOS, traitement par fichier, JSON horodaté des formes A–H/X. La démo Rive actuelle connaît déjà son mapping. | Conserver comme référence de comparaison et pour reproduire la démo ; ses 8 formes ne sont pas les 15 visèmes Oculus ni les 22 formes Azure du rig Matt. Le projet [OpenLipSync](https://github.com/KyuubiYoru/OpenLipSync), autre piste ONNX de visèmes, a été archivé le 18 février 2026 et n’est plus maintenu. |

### Parcours TTS et conversion à comparer après le POC ElevenLabs

1. Pour un texte saisi, comparer ElevenLabs avec Kokoro-JS dans le navigateur et
   une voix française Piper. Contrôler la qualité française, les homophones,
   la ponctuation, le temps de synthèse, le poids téléchargé et la diversité
   réelle des voix. Kokoro est la première piste web locale ; sa voix unique
   française et sa licence de voix en limitent la portée.
2. Pour une captation micro, conserver l’original comme résultat par défaut.
   Comparer la conversion facultative OpenVoice V2 à ElevenLabs sur une même
   référence et un même passage, puis rejouer l’original quand l’auteur choisit
   de ne pas transformer. Seed-VC reste un témoin technique, pas la piste
   privilégiée.
3. Dans chaque branche, traiter comme définitif le son que l’auteur a choisi :
   prise brute, prise transformée ou synthèse TTS. Produire/corriger le
   transcript et ses débuts/fins sur ce son final, puis produire ses visèmes.
   La conversion peut modifier le débit et les durées ; les repères calculés
   avant elle ne sont pas réutilisables sans vérification. Sur les mêmes
   extraits français, comparer le parcours retenu de la démo AniMattor, les
   alignements phonétiques Piper et OpenFaceFX alimenté par les phonèmes MFA.
   Garder Rhubarb comme témoin A–H/X. HeadTTS fournit une comparaison directe
   audio/temps/visèmes seulement sur un texte anglais.
4. Évaluer deux placements des traitements : inférence locale dans le
   navigateur, sans clé ni aller-retour réseau après téléchargement des
   modèles ; ou service local déployé par l’application hôte. Le premier évite
   un coût d’inférence distant mais reporte poids et mémoire sur chaque
   navigateur. Le second centralise les modèles et leur exploitation, mais
   exige de déployer et maintenir ce service. L’audit n’a pas de mesure
   permettant encore de choisir.

La démo existante donne un chemin d’acceptation concret. La story
[`createRiveTalkingAvatarStory`](../../authoring/story/rive-talking-avatar/rive-talking-avatar-story.ts)
reçoit une piste voix, sa durée, des frames temporelles génériques et des
captions ; elle ne demande pas à Elcé de produire la prise. La
[démo Rive](../../demos/src/v2/demos/rive/scene.ts) fournit une
[phrase française et des mots horodatés](../../demos/src/v2/demos/rive/avatar-data/phrase-fr.ts),
un MP3 et des cues Rhubarb ; le Projet 3 fournit l’autre référence, avec son
[MP3](../src/assets/assets/talking-head/speech.mp3), son
[transcript et ses 22 valeurs Azure](../src/assets/assets/talking-head/visemes-2.json)
mappées au rig Matt. Pour l’intégration, conserver un format de résultat neutre
dans le module et laisser l’adaptateur Avatar traduire ce résultat vers le
profil du rig. Les deux fixtures permettent de comparer la cohérence temporelle
sans remplacer le runtime ni créer un second circuit d’animation.

La capture vidéo demeure hors de cette qualification audio. Lorsqu’elle sera
cadrée, la documentation Google de [Face Landmarker Web](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker?tab=Web)
décrit un traitement vidéo WASM produisant landmarks, blendshapes et matrices
faciales dans le navigateur. Cela fournit des mesures de mouvement, pas un
outil de prise/édition vidéo ni des frames du profil Rive à lui seul. Il faudra
séparer capture vidéo, extraction/réduction des mouvements et mapping au
personnage avant d’établir cette partie.

## Données et synchronisation à porter dans la conception

La séparation utile au POC est : prise source → traitements → prise
validée → données de lecture → adaptateurs de rendu et d’application.
Un montage pourra s’intercaler après le POC.
Elle ne définit pas encore un schéma JSON ni une API publique.

| Ensemble | Informations nécessaires à examiner |
| --- | --- |
| Prise | Identité, personnage/intervenant, audio source, durée, provenance des traitements et repère temporel. |
| Montage futur | Préparer la correspondance temps source/temps final pour les portions conservées, sans implémenter les coupes dans le POC. L’audio transformé existe déjà indépendamment de ce futur montage. |
| Parole | Occurrences de mots avec début/fin, segments de sous-titres, vocabulaire et intervalles de visèmes. |
| Animation | Pistes identifiées par personnage et canal ; données réduites conservant leurs temps, sans noms Rive imposés à la capture. |
| Rendu | Avatar choisi, ressource, profil de mapping propre au rig et placement du médaillon. |
| Connecteur Elcé | Page et Carousel concernés, références des cartes, occurrences sélectionnées et temps de présentation. |

Les nombres `v100` ou le nom `lips sync id` appartiennent au profil de rendu,
pas au transcript commun. Plusieurs mots identiques dans une phrase doivent
rester distinguables. Le remplacement d’une prise doit permettre de détecter
les associations devenues invalides.

Lors du montage futur, une coupe interne devra modifier ensemble audio,
mots, sous-titres, visèmes et mouvements. La conversion vocale du POC doit être évaluée sur sa conservation du
timing ; si elle le modifie, les pistes finales doivent être réalignées.
Une transcription correcte sur la prise source ne prouve pas la synchronisation
sur la voix transformée. Les mouvements caméra doivent aussi garder leur
correspondance avec ce montage final.

La qualification doit mesurer séparément la qualité du résultat et son délai
de disponibilité : aperçu de captation, conversion après saisie, réécoute et
données finales utilisables pour associer les cartes. Les performances restent
à mesurer avant de retenir l’implantation front, serveur ou SaaS.

Ces candidats enrichissent la comparaison des visèmes et de la conversion ; ils
ne remplacent pas le parcours AniMattor retenu dans le plan pour la production
des 22 visèmes Azure du rig fourni. La qualification STT/alignement local est
avancée avant de finaliser son raccord au parcours audio. En particulier, une
sortie Oculus à 15 formes doit rester identifiée comme telle jusqu’à ce qu’un
mapping et une acceptation visuelle dédiés soient convenus et mesurés.

## Séparation des capacités audio — 6 novembre 2026

La clé ElevenLabs ne représente pas une autorisation globale du module. Le
microphone, l’import local, les réglages et les traitements locaux restent
accessibles sans clé. Le TTS et la transformation vocale sont des opérations
distinguées ; chacune appelle son endpoint et traite sa propre erreur de
permission. Une permission STT manquante ne bloque donc ni ces opérations ni
les réglages.

Le STT doit privilégier une ressource locale. Quand le transcript est fourni,
aucun STT n’est nécessaire ; son alignement sur la prise reste une capacité
distincte, à qualifier localement pour obtenir les temps nécessaires aux mots
et aux caractères. La fabrication des visèmes est elle aussi locale : le
générateur AniMattor transforme les temps de caractères en formes Azure, et
ElevenLabs ne fournit pas cette timeline. Une seule action auteur peut
orchestrer ces étapes sans fusionner leurs fournisseurs ou leurs permissions.

Le code actuel appelle encore ElevenLabs STT quand le transcript manque et son
Forced Alignment quand les temps caractère manquent. Ces appels ne constituent
pas le parcours local visé. La table de candidats ci-dessus sert de point de
départ, pas de sélection : il faut requalifier les modèles et outils actuels
sur les prises françaises du Projet 3, leurs licences, leurs temps de calcul et
leurs sorties alignables avant d’intégrer le STT local. Aucun repli ElevenLabs
pour le STT ne devient implicite.
