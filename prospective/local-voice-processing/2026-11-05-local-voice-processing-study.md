# Étude — traitements vocaux locaux, alignement et visèmes

Cette note rassemble la recherche documentaire des 4 au 6 novembre 2026
sur les traitements vocaux locaux et leur comparaison avec les services
distants. Elle complète l’[étude Tête parlante](../../packages/elce/notes/2026-11-04-talking-head-study.md).
Les décisions, travaux et critères de qualification restent dans le
[plan Tête parlante](../../packages/elce/plan/2026-11-04-talking-head-plan.md).

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
[`createRiveTalkingAvatarStory`](../../packages/authoring/story/rive-talking-avatar/rive-talking-avatar-story.ts)
reçoit une piste voix, sa durée, des frames temporelles génériques et des
captions ; elle ne demande pas à Elcé de produire la prise. La
[démo Rive](../../packages/demos/src/v2/demos/rive/scene.ts) fournit une
[phrase française et des mots horodatés](../../packages/demos/src/v2/demos/rive/avatar-data/phrase-fr.ts),
un MP3 et des cues Rhubarb ; le Projet 3 fournit l’autre référence, avec son
[MP3](../../packages/elce/src/assets/assets/talking-head/speech.mp3), son
[transcript et ses 22 valeurs Azure](../../packages/elce/src/assets/assets/talking-head/visemes-2.json)
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

