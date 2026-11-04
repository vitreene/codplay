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
| Visèmes | Rhubarb propose un reconnaisseur phonétique indépendant de la langue et une sortie JSON de formes de bouche. La démo possède déjà un mapping Rhubarb. | Analyse de fichier, pas garantie de visèmes live ; granularité et qualité sur les 22 formes du rig. |
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

Le repli demandé reste le dispositif de référence si l’analyse locale échoue
ou conduit à une complexité disproportionnée, après constat documenté.
ElevenLabs documente STT français et timestamps mot via Scribe, ainsi qu’un
Voice Changer distinct. L’outil AniMattor ne prouve pas à lui seul l’intégration
de ces services à notre besoin. Sources :
[STT ElevenLabs](https://elevenlabs.io/docs/overview/capabilities/speech-to-text/),
[Voice Changer](https://elevenlabs.io/docs/api-reference/speech-to-speech/convert).

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
