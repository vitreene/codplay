# Tête parlante — plan d’action

**Lots 0 à 2 Finis**, le 4 novembre 2026. Le composant, sa
démo et la factory réutilisable sont couverts par les spécifications
[Rive](../../codplay/specs/third-party-rive-spec.md) et
[story d’avatar](../../authoring/story/specs/rive-talking-avatar-story-spec.md).
Les lots 3 à 5 restent à réaliser ; leur cadrage est suivi ici et leur
rationale dans l’[étude](../notes/2026-11-04-talking-head-study.md).

## Décisions retenues, non appliquées

- Module web réutilisable, connecteur Elcé vers Diapo/Carousel ; lecture par
  les circuits existants. Mac est le poste de développement, sans variante OS.
- Capacités audio distinctes : capture Micro, capture Caméra et import locaux ; TTS, STT,
  alignement et transformation vocale gardent chacun leur opération. Le flux
  auteur pour un son importé ou capté suit la démo AniMattor : l’auteur saisit
  ou colle le transcript, puis l’alignement séparé produit les temps. L’action
  « Préparer et insérer » ne transcrit pas automatiquement. STT reste une
  opération isolée, hors de ce flux auteur, jusqu’à décision sur son usage. Les
  visèmes Azure 22 sont générés localement depuis les temps caractère, selon la
  démo. Garder une seule action
  « Préparer et insérer » comme orchestration auteur, sans fusionner les
  permissions ni les fournisseurs sous une validation globale de clé. Le token
  n’est utilisé que par l’appel ElevenLabs choisi et reste en mémoire par
  défaut ; sa mémorisation dans le `localStorage` du navigateur est facultative.
  Il ne rejoint jamais le document, l’API projet, les médias ni SQLite. Le
  proxy de secrets robuste reste une évolution ultérieure.
- Aucune clé n’est nécessaire pour le micro, l’import audio, les traitements
  locaux ou la génération de visèmes. Une erreur de permission ElevenLabs ne
  bloque que l’opération distante concernée. Le fournisseur STT local et la
  voie d’alignement caractère restent à qualifier avant de remplacer les appels
  distants présents dans le code. Aucun modèle local ne devient une dépendance
  sans qualification. Aucune app native ni installation d’outil.
- Aucune navigation Carousel. Si l’auteur demande une télécommande
  Play/Pause/progression, il choisit aussi le démarrage automatique ou l’attente
  de Play explicite. Les commandes restent visuellement hors scène et pilotent
  la telco intégrée à la lecture de la scène ; les pages ordinaires gardent
  leur comportement actuel. Affichage du transcript et commande son reportés.
- Choix accepté le 5 novembre pour la démo du Projet 3 : **attendre un clic
  sur Play**. Présenter la première carte et l’avatar au repos à zéro ; démarrer
  ensemble voix, visèmes et progression des cartes par la telco existante au
  clic. L’attente de Play est appliquée et vérifiée ; l’affichage du rig avant
  le premier Play reste à qualifier.
- Emplacement accepté le 5 novembre : télécommande dans la barre de navigation
  du lecteur. Réutiliser `@codplay/remote` sur la telco de la page active ;
  garder les boutons Précédent/Suivant et le statut de page. Le montage reste
  extérieur à la Diapo et disparaît sur les pages sans narration.
- Alignement appliqué et vérifié le 5 novembre : centrer verticalement tous les éléments
  de la barre sur écran large, avec le compteur après le curseur sur la même
  ligne. Modifier uniquement le CSS de navigation ; vérifier les centres des
  boutons, du curseur et du compteur dans la preview, puis conserver
  l’adaptation en deux lignes sur petit écran.
  Safari confirme un centre commun à 724 px sur écran large et un centre
  commun par rangée à 390 px, sans débordement. Test de styles et build réussis.
- Avatar déplaçable/redimensionnable, placement responsive. Utiliser le rig
  transparent fourni par l’utilisateur ; permettre de lui attribuer un fond
  dans les réglages. Le médaillon avec tête dépassant reste à traiter après
  la première démo.
- Remplacement du rig appliqué et vérifié le 5 novembre : reprendre
  `dist/avatars/my-matt-visemes.riv` dans la source
  `src/assets/avatars/my-matt-visemes.riv`, sous le même nom. Préserver le
  profil et les pistes ; vérifier l’empreinte servie par Elcé et le rendu
  dans la preview réelle. Le fichier fourni et sa copie de sauvegarde dans
  `dist/avatars` sont conservés.
  La source et l’URL Remix servent le SHA-256
  `5b475e49eae9fcd63e759c75c4d1866d74c75b0d367240fd0236e009894c5e4a`.
  Safari vérifie le rig avec son profil existant, Play/Pause et Seek ;
  le canvas contient le personnage et un fond transparent.
- Captation, données, rendu et connecteurs séparés pour réemploi dans Editor,
  les mods et d’autres projets. Le rendu 3D/multi-personnages et le montage
  restent des évolutions futures.
- Dans Elcé et Editor, les widgets sont des stories ou scènes produites par
  des factories depuis un objet de configuration, puis ajoutées au projet ;
  chaque éditeur proposera à terme son catalogue. La tête parlante est le
  premier widget visé ici ; le minuteur existant est un autre candidat à
  configurer. Le modèle de widgets attend la collecte de toutes les contraintes
  des candidats ; ce POC documente celles de la tête parlante sans décider
  l’emplacement des configurations, des factories, des stories ou du catalogue.
- Capture V2 et données réduites dans un événement final, sans event par frame.
  Autres formats de page, lecture mobile et SCORM hors POC.
- **Après la tranche en cours — direction acceptée, cadrage différé :** concevoir
  un BDC audio simplifié, proche du BDC Avatar, pour ajouter un son sans avatar.
  Cadrer son éditeur et sa lecture avant d’en établir le plan de réalisation ;
  cette évolution ne fait pas partie du lot 4.

## Ordre de réalisation

| Lot | Propriétaire et résultat attendu |
| --- | --- |
| 0 — Fini | `authoring/component-v2/src/rive/view-model/` : composant distinct, cycle de state machine partagé, Seek narratif et durée de vie native vérifiés. |
| 1 — Fini | `demos/src/v2/demos/rive-view-model/` : rig, MP3 et JSON fournis, voix maître, visèmes et mots synchronisés ; animations internes Rive préservées. Démo validée par l’utilisateur. |
| 2 — Fini | `authoring/component-v2/src/rive/` porte les composants ; `authoring/story/rive-talking-avatar/` porte la story réutilisable et son guide ; `isTalking` reste le booléen canonique. |
| 3 — En cours | `resources/bdcs/carousel/reading/`, `resources/pages/diapo/`, `mods/learning/reading/`, `mods/learning/preview/` et `src/server/elce-local-server.ts` : composer le Carousel et le BDC Avatar persistant sur la Diapo réelle du Projet 3, avec quatre cartes et les occurrences retenues du transcript. Servir les assets Rive et audio depuis le boundary Remix existant. La voix maître règle la durée, le Carousel n’affiche pas ses points et la fin publique est émise à la fin de la voix. Garder les pages ordinaires inchangées. |
| 4 — En cours, cadrage | Éditeurs Diapo/Carousel + commandes/persistance sur les fichiers fournis : BDC Avatar à côté du Carousel, réglages de placement et association des cartes aux occurrences du transcript. La capture audio et le suivi facial restent au lot 5. |
| 5 — En cours | `packages/authoring/audio-capture/` : module audio réutilisable, fournisseur ElevenLabs et connexion par token ; proposer la captation microphone seule ou la captation caméra audio+image, avec suivi facial synchronisé et un seul événement final. |

Le premier POC utilisait le pont
`LearningPlayerOptions.temporaryRiveTalkingAvatarByPageId`. Le lot 4 l’a
remplacé par le BDC Avatar persistant du document Elcé ; cette option ne figure
plus dans le code. Le modèle transversal des widgets reste ouvert sans
remettre en cause le BDC retenu pour cette tranche. La preview de validation
utilise le document Projet 3 conservé par le serveur de projets, pas un fixture
en mémoire.

## Lot 5 — module audio réutilisable : phases 1 et 2 En cours

Le périmètre utilisateur du 5 novembre remplace l’entrée micro/caméra
indifférenciée : le module autonome commence par audio ; TTS, STT et
transformation vocale utilisent actuellement leurs opérations ElevenLabs
séparées. Le STT local reste l’évolution visée, après qualification. Le 6
novembre, l’utilisateur a demandé deux modes de captation en direct : Micro
(son seul) et Caméra (son et images simultanés), avec le suivi de tête intégré
à la capture et sans réglages visibles. La décision est de ne pas conserver les
images ; seules la piste audio et sa timeline de tête rejoignent le BDC Avatar.
Les candidats STT et alignement sont dans
l’[étude talking-head](../notes/2026-11-04-talking-head-study.md#audit-local-complémentaire-et-recommandations--5-novembre-2026),
à requalifier sur les sons français du Projet 3 avant de finaliser le parcours.
La référence aux endpoints et à la frontière de clé est dans la même
[étude](../notes/2026-11-04-talking-head-study.md#référence-api-elevenlabs-du-5-novembre-2026).

1. **Implémentation corrigée ; acceptation ElevenLabs en cours** —
   `packages/authoring/audio-capture/` : reprendre le premier panneau réel
   d’AniMattor. Il propose dix voix prédéfinies, avec George sélectionné, avant
   tout appel de compte ; la synthèse peut donc appeler directement son endpoint
   avec une voix choisie. « Charger mes voix » est une action distincte et
   facultative. AniMattor appelle `GET /v1/voices`, mais la documentation
   ElevenLabs marque cette route obsolète ; Elcé emploie l’API actuelle paginée
   `GET /v2/voices`. Si la clé n’a pas `voices_read`, garder les voix
   prédéfinies, signaler que cette permission manque seulement pour la liste du
   compte, et laisser les autres opérations disponibles selon leurs propres
   permissions. Ne jamais traiter le résultat du chargement de voix comme une
   validation globale de la clé. Un gestionnaire partagé lit les propriétés
   d’erreur actuelles (`code`, `type`, `message`, `request_id`) et l’ancien
   `status`, puis indique l’opération concernée sans prétendre qu’une clé est
   invalide si l’API ne le dit pas. La clé reste en mémoire par défaut et peut
   être mémorisée uniquement dans le `localStorage` après opt-in ; elle ne passe
   jamais au document/projet, à son API, aux médias, à SQLite ni aux journaux.
   Le raccord reste indépendant d’Elcé ; l’app fournit seulement le point
   d’entrée Capture live et son style. L’appel navigateur direct demeure une
   étape locale provisoire ; l’étude d’un proxy de secrets robuste est
   ultérieure. Contrat de référence et constat de l’API dans l’
   [étude talking-head](../notes/2026-11-04-talking-head-study.md#référence-api-elevenlabs-du-5-novembre-2026).
2. **En cours — opérations audio et raccord de sortie.** Séparer le TTS, le
   STT, l’alignement et la transformation vocale, chacun raccordé à son
   opération propre. Le module conserve le STT ElevenLabs comme capacité
   indépendante, sans l’appeler dans le flux auteur courant. Le même module garde
   l’enregistrement microphone, la capture caméra et l’import audio locaux.
   Micro enregistre le son seul ; Caméra utilise son et image en direct pour
   suivre la tête pendant la prise, sans réglages visibles. La génération des
   visèmes reste locale et n’appelle pas ElevenLabs. L’auteur
   réécoute et choisit la piste
   finale. Après une génération TTS, une icône permet de télécharger le MP3 ;
   son commentaire ID3v2.4 contient le texte exact prononcé en UTF-8. Cette
   métadonnée est ajoutée à la copie téléchargée, sans modifier la piste
   utilisée pour l’aperçu ou l’insertion. L’action unique « Préparer et
   insérer » orchestre les traitements requis, fabrique le son et le JSON de
   timeline, puis attend l’application de la prise dans le BDC. Elle ne présume
   pas qu’une clé autorise chaque opération. Les boutons séparés de
   transcription et d’alignement sont retirés ; la transformation reste une
   option explicite. Pour un audio capté ou importé, « Préparer et insérer »
   exige un transcript saisi ou collé, puis appelle Forced Alignment si ses
   temps caractère manquent. Il ne fait aucun appel STT. Le module STT reste
   isolé et disponible indépendamment du flux auteur. Le fournisseur local
   reste à qualifier avant tout choix d’intégration STT.
   Le connecteur Elcé utilise l’import média et la commande de prise déjà
   présents ; placement et réglages de l’Avatar sont conservés. La clé reste
   dans le navigateur et n’accompagne jamais les fichiers. Les onglets sont
   ordonnés « Capture », « Piste audio », « Réglages ». Avec une clé et sans
   piste, Capture est sélectionné ; après génération, enregistrement ou
   chargement, Piste audio est activé et sélectionné. À la réouverture, il reste
   sélectionné si la piste existe. Sans piste, Capture est sélectionné même
   sans clé ; Capture, Piste audio désactivé et Réglages restent visibles. Les
   sources TTS, Micro, Caméra et Charger audio restent accessibles ; seules
   les opérations ElevenLabs requièrent une clé. L’action
   « Préparer et insérer » est visuellement principale. Garder les libellés et
   retours nécessaires, sans textes explicatifs ajoutés. « Charger audio »
   présente seulement « Choisir un fichier », sans légende ni libellé répété ;
   le bouton ouvre directement le sélecteur natif pendant son clic utilisateur
   (`showPicker`, avec repli navigateur). Après le choix, la piste est ajoutée
   et sélectionnée dans « Piste audio » sans appel API.
   Si le transcript est vide, conserver la piste et demander le texte avant
   tout appel réseau ; l’auteur peut le saisir ou le coller puis relancer
   l’action.
   La modale garde les
   mêmes dimensions entre ses onglets, avec des limites responsive ; son
   contenu défile à l’intérieur si nécessaire.
3. **En cours — timeline des visèmes selon la démo.** Dans
   `packages/authoring/audio-capture/`, reprendre `buildTimeline` et les règles
   françaises Azure 22 d’AniMattor. Le TTS garde son alignement caractère ; pour
  une prise, « Préparer et insérer » transcrit seulement si le texte est vide,
  puis force l’alignement caractère du son final, y compris après transformation.
   Générer les 22 propriétés `v100`–`v121` et le JSON `words`/`visemes` attendu
   par Elcé. Les règles retenues sont celles du français du Projet 3 ; aucune
   timeline n’est produite à partir d’une estimation micro live. L’acceptation
   restante compare la timeline générée à la phrase française de référence et
   vérifie le transfert et la lecture dans le BDC Avatar.
4. **En cours — captation Micro ou Caméra.** L’interface et le circuit sont
   implémentés dans `packages/authoring/audio-capture/src/`. Micro demande et
   enregistre le son seul. Caméra suit la séquence AniMattor : depuis le clic,
   demander d’abord la vidéo seule, afficher l’aperçu après accord, puis
   demander le microphone séparément. Un refus caméra indique où autoriser le
   site dans le navigateur et libère le flux. MediaPipe suit le visage pendant
   la prise, avec les réglages par défaut et sans contrôle visible. Le
   `MediaRecorder` reçoit uniquement la piste audio ; les images
   restent dans le flux utilisé en direct et ne sont jamais écrites dans la
   prise. Les échantillons `headX`, `headY`, `headTilt` sont gardés en mémoire,
   recalés sur la durée audio finale et inclus dans le JSON de timeline transmis
   avec l’audio par l’unique événement `audio-capture-insert`. Aucun événement
   n’est émis par échantillon. La vue Caméra inclut l’Avatar Rive cible du BDC,
   côte à côte avec l’aperçu caméra, et lui applique en direct les mêmes valeurs
   `headX`, `headY`, `headTilt`. Le module partagé reçoit l’URL du runtime et
   le profil Rive en configuration ; il n’embarque aucun chemin d’asset Elcé.
   Le rendu cible est
   libéré à l’arrêt ou à la fermeture ; la prise ne conserve toujours que le
   son et la timeline. Dans
   `packages/elce/src/resources/bdcs/avatar/domain/avatar-service.ts`,
   `headMotion` est adapté en patches ViewModel et fusionné aux frames déjà
   portées par `AvatarTake`. Ne pas modifier `packages/codplay/`.

   Acceptation restante : confirmer dans Safari normal, avec le site réglé sur
   « Demander », que Micro n’ouvre pas la caméra ; que Caméra demande l’accès
   vidéo avant le micro, affiche l’aperçu
   après autorisation, puis enregistre l’audio et suit les images pendant la
   même prise ; que le refus caméra indique les réglages du site ; que
   l’arrêt/fermeture libère tous les appareils ; et que l’événement final ne
   contient que l’audio et la timeline. Valider la
   restitution des mouvements par Play et Seek dans l’Avatar. Le 6 novembre,
   les typechecks Audio Capture et Elcé ainsi que le build Elcé passent ; Safari
   confirme l’onglet Caméra et l’absence de réglages visibles sans démarrer un
   appareil. À 390 × 844 px, Safari confirme quatre sources sur deux colonnes,
   une modale de 358 × 672 px et aucun débordement horizontal. La captation
   réelle et la restitution restent à accepter.
   Contrôle MCP du 6 novembre : la capture a démarré sans dialogue caméra et
   sans visage détecté ; arrêt et rechargement ont libéré les pistes et supprimé
   la piste locale temporaire. Ce contrôle ne valide pas le dialogue réel.
   Contrôle comparatif du 6 novembre : dans la même session Safari MCP, le
   bouton `Start camera` d’AniMattor démarre sans dialogue visible, affiche la
   même mire vidéo 640 × 480 et indique `No face in view`. Le parcours Elcé
   suit donc la séquence observée dans la démo ; la source caméra simulée de
   cette session ne valide ni la permission native ni le suivi d’un visage réel.
   Implémentation de la cible ajoutée le 6 novembre ; typechecks Audio Capture
   et Elcé ainsi que le build Elcé passent. Acceptation restante : dans Brave,
   démarrer Caméra avec une vraie caméra ; vérifier que l’aperçu et la cible
   apparaissent ensemble et que les mouvements du visage modifient le Rive en direct ;
   arrêter et fermer la modale pour confirmer la libération des ressources.

Acceptation de la phase 1 : Safari confirme que « Capture » est le premier
onglet et devient la sélection par défaut à l’ouverture/réouverture avec une
clé, ainsi que les quatre sources : TTS, Micro, Caméra et Charger audio, sans
textes explicatifs statiques. La Caméra a été vérifiée dans le contrôle du
6 novembre. « Piste audio » se place entre Capture et Réglages ; il est
désactivé tant qu’aucune piste n’existe et devient sélectionné après création
ou chargement. « Préparer et insérer » est visuellement l’action principale.
La modale garde les dimensions mesurées sur chaque onglet : 608 ×
672 px en largeur normale et 411 × 672 px en largeur réduite. Le 6 novembre,
Safari MCP vérifie sans exposer la clé que Capture reste sélectionné et ses
trois sources visibles, que Piste audio reste visible mais désactivé sans piste,
que le TTS est désactivé et que le microphone reste disponible. La sélection
réelle d’un fichier sans clé, l’aperçu et l’activation de Piste audio restent à
vérifier sans appel API.
Les voix prédéfinies sont visibles dès l’ouverture, avec George sélectionné ;
avec une clé saisie, la génération devient disponible
après saisie du texte sans charger les voix du compte. « Charger mes voix »
remplace les choix par les voix du compte quand `GET /v2/voices` réussit.
Quand cette opération retourne `voices_read` manquant, les voix prédéfinies
restent sélectionnées et disponibles, et le message désigne seulement la
permission de lister le compte. Les erreurs modernes et anciennes sont
distinguées sans exposer la clé ; chaque erreur inclut la référence de requête
si l’API la fournit. Une clé non mémorisée ne reste qu’en mémoire ; une
mémorisation cochée écrit aussitôt uniquement dans le `localStorage` du
navigateur, et le décochage efface cette entrée. Inspection des données
envoyées au serveur projet : aucun token dans le document, l’API, les médias,
SQLite ni les journaux. Ces vérifications ne génèrent pas d’audio facturé.

`npm run typecheck` du module réussit. Safari confirme dix voix prédéfinies,
George sélectionné et l’absence d’appel API pendant ce contrôle. L’ancienne
requête réelle de liste avait indiqué `voices_read` manquant ; l’acceptation
reste ouverte pour le chargement v2 dans l’interface et pour les opérations
autorisées par la clé. Aucun TTS payant n’a été envoyé.

Acceptation restante de la phase 2 : qualifier le STT local et l’alignement du
français sur l’audio capté ou importé, sans clé ElevenLabs ; vérifier que la
génération locale Azure 22 reçoit les temps caractère sans appel API. Vérifier
séparément le TTS et la transformation vocale ElevenLabs, chaque erreur restant
liée à sa propre opération. Comparer les fichiers créés par « Préparer et
insérer » à la sortie de la démo, puis suivre le transfert, la persistance, la
réouverture et la lecture du BDC Avatar sans envoyer le token à Elcé. Vérifier
aussi le téléchargement TTS : bouton visible seulement
pour la voix générée, fichier MP3 lisible et texte associé présent dans le
champ commentaire ID3. L’icône est intégrée au module ; cette acceptation reste
à faire sur un TTS réel. Aucun appel TTS réel n’a été envoyé pendant ce travail.
Pour « Charger audio », vérifier dans Safari que l’action ouvre le sélecteur,
que le fichier choisi crée une piste locale avec aperçu et nom, puis sélectionne
« Piste audio » sans appel ElevenLabs. Le 6 novembre, l’utilisateur a signalé
que le bouton ne déclenchait pas le sélecteur. Le code ouvre maintenant le
sélecteur natif depuis le gestionnaire du bouton ; l’ouverture réelle et le
choix d’un fichier restent à vérifier en Safari normal ; l’ouverture du
sélecteur depuis Safari MCP n’est pas une preuve fiable.
Les opérations payantes de TTS et de transformation attendent un essai
explicitement autorisé ; aucune génération payante n’a été tentée pendant la
correction du connecteur. Le typecheck de `audio-capture` et celui d’Elcé
passent depuis le 6 novembre après retrait du `title` inutilisé du builder
Graphe. Safari confirme la présentation de l’action unique ; l’acceptation
navigateur de l’insertion réelle reste à faire. Safari confirme aussi les trois
onglets dans l’ordre demandé, Piste audio désactivé sans piste puis sélectionné
après chargement d’un WAV local temporaire, et le style principal du bouton
« Préparer et insérer ». Le bouton n’a pas été déclenché ; aucun appel
ElevenLabs ni transfert au BDC n’a eu lieu pendant ce contrôle.

Acceptation du flux de préparation encore requise : transcript vide, aucune
requête STT et piste conservée ; transcript fourni, Forced Alignment appelé si
nécessaire, puis génération locale des visèmes et transfert au BDC Avatar. La
démo AniMattor confirme le parcours texte fourni puis alignement forcé. Le STT
reste hors de ce parcours ; son usage ultérieur sera cadré séparément.

## Décisions restantes

- **T2 — qualification du fournisseur local :** comparer sur les
  mêmes prises françaises le STT et l’alignement mot/caractère locaux, en
  commençant par les candidats de l’étude et en vérifiant les options plus
  récentes. Mesurer la précision, le temps, la mémoire, la licence et la forme
  éditable de sortie ; ne pas intégrer de modèle avant ce contrôle. Générer
  localement les 22 visèmes Azure du rig ; garder OpenFaceFX + MFA français
  (15 formes Oculus) comme piste distincte, sans supposer l’équivalence des
  jeux. HeadAudio/Talking Avatar restent des candidats d’estimation live et
  Rhubarb un témoin A–H/X. Détails et limites dans la
  [note d’étude](../notes/2026-11-04-talking-head-study.md#audit-local-complémentaire-et-recommandations--5-novembre-2026).
- **T3 :** relever les contraintes de composition Avatar/Carousel et de fin à
  la durée de voix avec le player et le signal public existants. Le modèle de
  widgets sera réexaminé après collecte des contraintes des autres candidats.
  Le diagnostic MCP initial du 4 novembre a révélé l’échec avant montage :
  les ressources MP3 et Rive étaient chargées, puis Sighty échouait à créer
  la scène avec `Runtime library "rive" is not available in the engine`.
  Sighty prépare maintenant les bibliothèques déclarées par les scènes directes
  avant leur création ; le
  [plan Sighty](../../sighty/plan/2026-09-16-sighty-circuit-unification-plan.md)
  suit tests, typecheck, build et acceptance MCP. Le navigateur monte le rig
  Rive ; les seeks telco à 1 s/7,5 s changent le canvas, le temps et la carte.
  À 7,5 s, Pause maintient le canvas et le temps pendant 1,2 s. Au rechargement,
  `LearningPlayer.initialize()` appelle explicitement
  `runtime.api.play(ELCE_SCENARIO.LAYOUT_SCENE)` : le démarrage passe par
  CodPlay. Dans le montage final, la voix et l’avatar suivront la telco intégrée
  à la lecture de la scène ; le fixture appelle la telco réelle pour éprouver
  ce chemin, sans créer une commande de lecture parallèle. La page reste cachée
  dans cette session ; Play naturel et fin de voix restent à vérifier.
  Décision acceptée, à appliquer au lot 3 : quand l’auteur demande la
  télécommande, il choisit si la lecture commence à l’entrée ou attend un Play
  explicite. Les pages ordinaires gardent le comportement existant ; le champ
  temporaire et son emplacement permanent restent à décider avec le modèle des
  widgets. L’intégration ESM est appliquée : `component-v2` utilise
  `@rive-app/canvas-advanced-single@2.38.3`, tandis que le composant séparé
  `packages/authoring/components/rive` conserve `@rive-app/canvas`. Le détail
  technique et les preuves sont dans l’[étude](../notes/2026-11-04-talking-head-study.md).

  Reprise du 5 novembre : « Projet 3 », révision serveur 2, contient la Diapo
  « Tête parlante — Interstellar » et ses quatre cartes. Les assets sont servis
  sur 5175 et la preview standard monte l’avatar. Play, Pause, Seek avant/arrière
  et sortie/retour sont observés dans le player réel. La déclaration actuelle
  de fin doit être raccordée au signal de fin existant, selon G3 ci-dessous.
  Le rendu observé recouvre une partie du Carousel. La composition sans
  recouvrement est appliquée au lot 4. Preuves et analyse dans l’[étude](../notes/2026-11-04-talking-head-study.md#reprise-du-projet-3--5-novembre-2026).
- **T4 :** schéma persistant des prises/pistes et admission audio/Rive/données
  dans le catalogue média Elcé ; préparer le montage futur. Le module partagé
  est localisé dans `packages/authoring/audio-capture/` ; l’attache de la piste
  finale réutilise le service média Elcé existant.
- **T5 — acceptation restante :** vérifier la précision de la piste caméra et
  sa restitution par Play/Seek sur le rig réel ; la collecte conserve les
  échantillons du détecteur dans une seule charge utile finale. La commande de
  regard reste hors de cette tranche.
- **D1/D2 :** la télécommande est intégrée à la barre de navigation et le
  démarrage manuel est appliqué. Le placement responsive est maintenant
  vérifié dans le lot 4 pour le réglage haut droite sur grand et petit
  viewport. Avant le premier Play, la première carte est visible à zéro mais
  le canvas du rig ne peint pas encore l’Avatar ; ce point reste à qualifier.
  L’emplacement permanent de la configuration attend l’examen du modèle de
  widgets.

## G3 — publication de la fin vocale

**En cours — correction Elcé acceptée le 5 novembre.** Déclarer la fin dans
la scène et utiliser le circuit existant. Le test navigateur indépendant
confirme que `sequence:end` à la date voulue exécute `listen.emit` et publie
`elce:page:finished` avec `{ pageId }`. La proposition de modifier CodPlay est
retirée ; aucun changement de son moteur n’est nécessaire ni autorisé.

1. **Appliqué, vérifié dans la preview réelle** —
   `resources/pages/diapo/rive-talking-avatar-poc/` : remplacer l’eventime métier
   inadapté par `sequence:end` à la durée vocale et une règle `listen.emit`
   publiant `elce:page:finished` avec `{ pageId }`. Conserver les règles Carousel
   et les données de narration. Le signal métier existant reste celui traité
   par Sighty ; la fin ne déclenche aucune navigation automatique.
2. `elce` — tests de composition avec leurs propres valeurs : vérifier la fin
   publique à la durée vocale, l’absence de fin à la dernière carte, et le
   traitement Sighty qui termine la page sans naviguer. Conserver les fins
   Carte/Quiz/Carousel ordinaires. Les deux échecs relevés avant modification
   de cette reprise restent à qualifier dans leurs circuits propriétaires.
3. **Télécommande vérifiée ; affichage initial du rig restant** —
   `mods/learning/reading/navigation-remote/` et le layout de navigation
   portent la télécommande partagée `@codplay/remote`. Play/Pause, Seek, replay,
   sortie/retour, largeur étroite et absence de télécommande sur les pages
   ordinaires sont vérifiés dans les tests et la preview Projet 3. Le mode
   Manuel du Carousel laisse le temps à zéro et la première carte visible avant
   Play ; le mode Automatique est l’unique source d’auto-démarrage. Le champ
   temporaire Avatar `autoStart` du POC est ignoré. Le placement responsive
   haut droite est vérifié dans le lot 4 ; seul le canvas du rig avant Play reste
   à qualifier. Aucun changement CodPlay.
4. Compléter les tests Elcé de construction et composition, typecheck et build,
   puis navigateur sur le Projet 3 : Play/Pause, Seek,
   replay, fin vocale, resize, sortie/retour, destruction et rechargement.
   Transférer seulement les comportements vérifiés aux spécifications
   propriétaires ; garder le lot 3 En cours tant que ces critères échouent.

L’utilisateur ouvre le cadrage des éditeurs (lot 4) le 5 novembre ; les
acceptations encore ouvertes du lot 3 restent suivies sans être déclarées finies.

Preuves de la correction de fin : test builder narré réussi ; navigateur réel
à 14 446 ms, Seek sans fin et reset/lecture complète réussis. Build Elcé réussi
(avertissement de taille des chunks). Les suites ciblées gardent 68 succès sur
70 et les deux échecs déjà relevés ; typecheck bloqué par `title` inutilisé
dans `resources/bdcs/statistical-graph/reading/statistical-graph-scene-builder.ts`.
Télécommande : 20 tests réussis (transport réel, scénario, styles) ; les trois
suites Diapo/player/preview gardent leurs 68 succès et les deux échecs connus.
Le build passe ; le typecheck conserve la seule erreur `title` du Graphe.
La preview réelle confirme Play/Pause/Seek/replay, retrait/retour, attente à
zéro et barre sans débordement à 1280 × 756 et 390 × 844. Le test de styles
conserve ses assertions sémantiques ; le hash global de l’ancienne extraction
CSS est retiré, car la feuille s’enrichit de la télécommande.
Le placement haut droite est vérifié dans la preview du Projet 3 en grand et
petit viewport ; le rig reste invisible avant le premier Play. Le lot 3 reste
En cours pour l’acceptation vocale complète et ce rendu initial.

## Lot 4 — intégration auteur : implémentation En cours

Décision utilisateur du 5 novembre : présenter l’Avatar comme un BDC pour
accéder à la captation et aux réglages, dont la position ; sa présence active
dans le Carousel l’accès au transcript et le choix d’un mot horodaté.
Le BDC Avatar est placé dans la Diapo à côté du Carousel. Il n’est ni une vue
ni un enfant du Carousel. Le lot 4 conserve les fichiers audio, transcript et
visèmes fournis ; le module de captation audio, la conversion après saisie, la
captation caméra et la réécoute restent au lot 5.
L’association de mots et la migration v12 sont appliquées ; leur contrat est
dans la [spécification Avatar](../specs/avatar-bdc-spec.md#association-aux-cartes-du-carousel).
L’acceptation projet, Undo/Redo et rechargement reste au lot 4, action 4.

Décision utilisateur : **un seul Avatar par Diapo pour cette version**, frère
du Carousel. L’Avatar peut être conservé au catalogue ; Flux et placement
enfant ne sont pas proposés dans cette tranche. Le contenu principal conserve
son unique emplacement. Le modèle transversal des widgets reste ouvert.
En lecture narrée, le Carousel remplit toute la zone de page. La racine Diapo
est une grille 1/1 : l’Avatar flotte au-dessus dans la même cellule, selon ses
réglages haut/bas et gauche/droite, avec sa marge et sa largeur responsive. Le
player ne réserve pas d’espace au Carousel pour l’Avatar.

Décisions d’édition précisées le 5 novembre : le BDC Avatar reprend le style
commun des BDC, avec une action de suppression par icône et un slider de largeur
à cinq tailles, de 10 à 60 %. Le mode Automatique/Manuel du Carousel pilote
le démarrage de la page ; la case Avatar `autoStart` n’est pas proposée et son
ancienne valeur persistée est ignorée. La prise existante conserve son audio et
affiche son transcript. Son entrée « Capture live » ouvre une modale dédiée ;
l’import fichier par fichier disparaît de l’éditeur, la capture réelle restant
au lot 5. Chaque carte après la première a son propre radio caché par occurrence,
avec le temps du mot comme valeur. L’interface affiche seulement le mot associé
et remplace le champ de durée ; aucune heure de début n’est affichée. Une
occurrence choisie doit suivre les associations des cartes précédentes, mais
peut dépasser les associations suivantes : celles qu’elle dépasse sont alors
supprimées et les durées recalculées. Aucun sélecteur global de transcript dans
le Carousel. La première carte commence à zéro, conserve une durée ordinaire et
ne reçoit pas de mot associé.
Décision utilisateur du 5 novembre sur l’association : la liste des mots reste
ouverte par défaut, entourée d’un bord sur toute la largeur, sous la barre de
réglages et séparée du champ de durée. Une icône de repli se place en haut à
droite du cadre.
Révision auteur acceptée : conserver seulement le titre principal « Avatar » ;
placer Capture live en bouton coloré plus grand, à droite du lecteur audio sur
sa ligne ; afficher le transcript avant son bilan statistique et rapprocher les
deux. Rendu Safari vérifié le 5 novembre ; contrat transféré dans la
[spécification Avatar](../specs/avatar-bdc-spec.md#éditeur-de-lavatar).

**Réordonnancement — code appliqué, acceptation en cours.** Le service Carousel
et la commande Learning existants gardent les associations avec leur carte,
retirent celle de la vue devenue première et recalculent les durées. L’action 4
vérifie les déplacements vers l’index 0 depuis les 2e, 3e et 4e cartes, le
retour d’un ordre valide et la persistance dans le Projet 3.

**Implémentation appliquée ; acceptation en cours.** La façade passe l’identifiant
déplacé à la commande `bdc.carousel.update` existante ; Learning recalcule les
durées et valide les liens conservés. Dans Safari, la vraie commande Learning
a été appliquée en mémoire à une copie désérialisée du Projet 3 : les
déplacements 3e→1re et 4e→1re laissent une première carte sans association ;
le déplacement 4e avant 3e conserve son lien
`Saturne` mais le rend hors ordre et non sélectionnable, puis le retour le
réactive. Aucune donnée du Projet 3 n’a été écrite. Le build et le
typecheck Elcé passent depuis le 6 novembre, après retrait de la variable
locale `title` inutilisée. Le drag UI, la sauvegarde/réouverture
et la suite complète restent à vérifier. Le rejet API observé séparément
atteint `assertAvatarContent` ; le document local examiné est valide, mais le
document entrant qui a déclenché ce rejet n’a pas été capturé.
Dans l’éditeur Projet 3, Safari vérifie que les 41 occurrences de la carte 2
sont affichées dans une zone compacte pleine largeur bordée, séparée des
réglages, avec la flèche de bascule en haut à droite. Le cadre est ouvert par
défaut ; le repli masque les mots et inverse la flèche, puis le déploiement
rouvre la liste.

Actions du lot 4 — acceptées par la demande de poursuite :

Préparation de l’exécution :

- **Acquis :** BDC frères, prise sur fichiers fournis, durées conservées après
  retrait/remplacement et réassociation explicite au nouveau son ; fond
  réglable sur le rig transparent.
- **Schéma de cette tranche :** document v12, migration additive depuis v11 ; payload
  `avatar` propre à la ressource, avec référence de profil, prise identifiée
  (audio référencé dans `medias`, durée, occurrences et piste fournie) et
  réglages de placement/lecture. Le rig fourni reste une ressource applicative
  du profil ; l’audio rejoint le circuit média existant. Le transcript est
  conservé une seule fois dans la prise. L’entrée Carousel garde `durationMs`
  comme source de vérité. Sa référence facultative à la prise et à l’occurrence
  identifie le mot associé ; le temps du mot sert à recalculer les durées au
  moment de l’édition, sans être persisté comme début absolu. La migration v12
  convertit les anciens débuts absolus en durées par vue avant de retirer leur
  champ temporel.
  `avatar.take` contient `id`, `audioMediaId`, `durationMs`, `words` et
  `frames` adaptés au profil fourni. `avatar` porte aussi `profileId` et
  `placement` (position, largeur, fond facultatif). Le mode du Carousel est
  l’unique réglage de démarrage de la page ; l’ancien `avatar.autoStart` stocké
  reste ignoré pour compatibilité.
  `CarouselBdcEntry.cue` contient seulement `word` facultatif
  `{ avatarBdcId, takeId, wordIndex }`. Aucun transcript copié dans le Carousel.
  Le retrait/remplacement matérialise les durées de la prise courante puis
  efface les associations. La prise existante garde
  l’audio et le transcript ; la capture future réutilisera la file XState et le
  stockage média commun. SQLite porte un détail Avatar JSON, la durée dans
  `duration_ms` et l’association de mot dans `cue_json`.
- **Propriétaires à étendre :** `resources/bdcs/avatar/` pour données,
  validation, adaptation du fichier et éditeur ; modèle/commandes Learning
  pour placement et mises à jour atomiques ; file d’import et API média
  existantes pour l’audio ; codec et SQLite pour la migration et la
  persistance. Aucun catalogue, historique ou lecteur parallèle.
- **Gates :** cardinalité et schéma de cette tranche sont arrêtés. Transférer
  aux spécifications propriétaires uniquement les comportements implémentés et
  vérifiés ; garder l’affichage initial du rig et l’acceptation restante ouverts
  dans ce plan. Le modèle transversal de widgets et la captation restent hors
  de cette tranche.

1. **Appliqué** — `resources/bdcs/avatar/`, document et commandes Learning :
   ajouter le BDC Avatar et ses placements acceptés, la référence de prise et les réglages
   responsive. Réutiliser commandes XState, historique, catalogue et
   persistance existants ; prévoir la migration des documents sans Avatar.
2. **Appliqué** — Éditeurs Avatar et Carousel : utiliser la prise fournie et
   ouvrir ses réglages depuis le BDC Avatar. Garder le son de la prise et montrer son
   transcript. Remplacer l’import de fichiers par l’entrée Capture live et sa
   modale dédiée, sans présenter la captation du lot 5 comme disponible.
   Dans l’éditeur de chaque carte, sélectionner une occurrence du transcript
   avec un bouton radio caché, dont la valeur est le temps de l’occurrence ;
   afficher seulement le mot choisi dans le contrôle de l’association. Un mot
   répété reste distinguable. Recalculer et enregistrer `durationMs` à partir
   des mots associés ; un choix futur est permis même s’il dépasse les cartes
   suivantes et efface alors leurs associations devenues impossibles. Ne pas
   persister de début absolu. Au retrait de l’Avatar
   ou au remplacement de sa prise, convertir les anciens débuts en durées,
   supprimer les associations et conserver ces durées dans la même commande
   documentaire. Ne pas copier le transcript dans le Carousel.
3. **Appliqué, rendu partiellement accepté** — Builders Diapo/Carousel et
   preview Learning : produire la configuration de la factory existante depuis
   le document et retirer le mapping temporaire
   par projet/page. Quand la prise est configurée, placer la factory Avatar
   et le Carousel dans la même cellule 1/1 de la racine Diapo ; le Carousel
   remplit son conteneur et l’Avatar flotte au-dessus sans réserver sa place.
   Conserver la voix maître, la télécommande de navigation, le démarrage choisi
   par le mode Carousel et la fin publique par le circuit déjà vérifié.
4. **En cours — acceptation** : créer et régler un Avatar dans l’éditeur réel,
   associer les cartes (dont un mot répété), vérifier Play/Pause/Seek/replay et
   fin vocale ;
   retrait/remplacement doivent supprimer les associations en matérialisant
   les durées obtenues à partir de la prise courante. Undo/Redo doit restaurer
   ensemble la prise, les associations et les durées. Réassocier une carte à
   un mot du nouveau son doit recalculer les durées concernées à partir des
   occurrences actives, sans conserver de début absolu ; rechargement et preview
   doivent restituer l’état enregistré. Les tests ciblés, typecheck et build
   passent. Dans le Projet 3, Safari MCP confirme le clic d’association,
   l’effacement d’un lien dépassé, la recalculation des durées, Undo et la
   persistance après rechargement. Restent à vérifier Play/Pause/Seek/replay,
   le retrait/remplacement avec Undo/Redo, la fin vocale et le Carousel plein
   cadre avec l’Avatar dans ses positions aux deux tailles de viewport. Garder
   le lot En cours jusqu’à validation de ces critères.

   Le 5 novembre, Safari MCP a aussi vérifié l’agencement de l’éditeur du
   Projet 3 en lecture seule : titre Avatar seul, capture colorée à droite du
   lecteur sur sa ligne, transcript avant le bilan avec 6 px d’écart. Aucune
   donnée du projet n’a été modifiée.

   Le 8 novembre, `avatar-authoring.test.ts` et le test auteur ciblé vérifient
   la migration v11→v12, la conversion des associations en `durationMs`, le
   remplacement de prise, les réassociations et le réordonnancement-retour.
   Safari MCP vérifie le choix réel d’un mot plus tardif sur la deuxième carte :
   l’association dépassée de la troisième est retirée, sa durée devient
   1,193 s, et les mots postérieurs restent sélectionnables. Deux Undo
   restaurent les valeurs initiales ; le rechargement confirme le document
   synchronisé. Les critères de lecture et d’overlay restent ouverts. Dans le
   fichier complet de l’éditeur, un échec distinct persiste dans le déplacement
   catalogue d’une Carte : `dispatchDrag` reçoit une cible absente (ligne 725).

Contrôle navigateur du 5 novembre : la preview standard du Projet 3 confirme
que le Carousel a exactement le rectangle de la racine Diapo à 1280 × 756 et
390 × 844. À la demande d’agrandir le slider, ses valeurs sont maintenant
10/20/30/45/60 %. La mesure du canvas avec le réglage courant à 30 % vérifie
que le bord peint du rig en haut à droite reste à 16 px du coin choisi, y
compris à 390 × 844, sans débordement horizontal. Le réglage enregistré du
Projet 3 est resté à 30 %. Un contrôle DOM temporaire à 60 % exerce le cran
maximal : l’Avatar recouvre alors une partie du texte sur grand écran ; il reste
un overlay et le Carousel garde toute sa zone. Le fond transparent du rig est
compensé dans la projection, comme le précise la
[spécification Avatar](../specs/avatar-bdc-spec.md). Les mesures sont dans le
[relevé d’acceptation](notes/assets/talking-head/elce-project-3-acceptance.json).
Avant Play, le temps reste à zéro et la première carte est visible, mais le
canvas ne peint pas encore le rig. L’acceptation des autres positions et de
l’affichage initial restent ouvertes ; le lot 4 reste En cours.
Le build Elcé du 5 novembre passe avec `vite build --emptyOutDir false`, en
préservant `dist/avatars/` ; l’avertissement de taille de chunk préexiste. Le
typecheck Elcé passe depuis le 6 novembre après retrait de la variable locale
`title` inutilisée dans `statistical-graph-scene-builder.ts:72`.

## Acceptation et clôture

- Lot 0 clos : 72 tests du package, 20 régressions parent/cible, typechecks
  composants/démos/core et build des démos réussis. Le
  [relevé Safari](../notes/assets/talking-head/rive-player-acceptance.json)
  couvre le rig réel, preload/player, Play/Seek, événements au même instant,
  broadcasts, pause/reset, resize CSS, isolation, remontage et destruction.
  Persistance applicative et intégration Elcé restent dans les lots suivants.
- Lot 1 clos : la démo emploie le MP3 de 14,445714 s et les 152 visèmes /
  41 mots du JSON fourni. Elle utilise directement les propriétés/valeurs,
  le décalage bouche de 50 ms et la voix maître. Play, Seek et animations
  natives ont été vérifiés dans Safari MCP ; l’utilisateur valide le rendu.
- Lot 2 clos : composants dans `component-v2`, story autonome dans le package
  `authoring/story/rive-talking-avatar/`, guide dans ce dossier, fin de scène
  laissée à l’appelant et booléen `isTalking` unifié. **72 tests component-v2
  et 4 tests story** passent ; leurs typechecks et celui des démos passent,
  ainsi que le build Vite. Safari MCP vérifie Play/Pause, Seek à 7,5 s et
  retour par 1 s, replay, libération/remontage et cadre responsive à 1280 × 720
  et 800 × 900. Après séparation, la démo charge le subpath `@codplay/story/rive-talking-avatar` ; le Seek à 7,5 s et le retour par 1 s restituent les
  temps audio et sous-titres attendus. Contrat dans la
  [spécification](../../authoring/story/specs/rive-talking-avatar-story-spec.md),
  mesures dans le [relevé Safari](../notes/assets/talking-head/rive-talking-avatar-story-acceptance.json).
- Le constat de rollback de preview d’opacité est suivi en **S1, à analyser**
  dans le [plan tiers](../../codplay/plan/2026-09-18-third-party-components-v2-plan.md).
  Il ne bloque pas le binding ViewModel ; aucune correction de styles n’est
  incluse dans ce lot.
- Elcé : mots répétés, remplacement de prise, fin de voix après la dernière
  carte, sortie/retour sans son résiduel, annulation/refus micro-caméra,
  Undo/Redo et rechargement avec ressources, placement et durées restaurés.
- Reprise du 5 novembre : **68 tests passent sur 70** dans les suites Diapo,
  player et session preview. Le test narré passe. Échecs avant toute modification
  de cette reprise : attente du perso Question `:prompt` et absence du groupe
  d’observation de la Carte ancrée. Typecheck/build non rejoués à ce gate ;
  aucune correction d’implémentation appliquée pendant cette reprise.
- Tests des frontières concernées, typechecks/builds et navigateur réels avant
  transfert des comportements vérifiés aux spécifications propriétaires.
- Aucune modification du core CodPlay autorisée par ce plan ; toute lacune
  demande reproduction indépendante, plan accepté et autorisation explicite.
