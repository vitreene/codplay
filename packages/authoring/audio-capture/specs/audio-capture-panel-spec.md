# Audio Capture — panneau auteur

## Périmètre vérifié

`@codplay/audio-capture` fournit un panneau web réutilisable. Elcé l’héberge
dans l’éditeur, mais le sélecteur de voix et les contrôles de capture restent
dans le module partagé.

Au premier affichage, le sélecteur contient les dix voix présentes dans la
démo AniMattor et sélectionne George. Une liste de voix de compte n’est donc
pas requise pour choisir une voix de démo. Une clé et un texte non vides
activent le contrôle de génération ; le contrôle ne lance pas la requête avant
un clic.

La clé reste en mémoire par défaut. La case facultative contrôle sa sauvegarde
dans le `localStorage` du navigateur. Quand elle reste décochée, aucun token
n’est écrit dans ce stockage ni dans le projet Elcé.

Le transcript reste modifiable. Pour un audio capté ou importé, l’auteur saisit
ou colle le texte, comme dans la démo AniMattor. « Préparer et insérer » refuse
un texte vide avant tout appel réseau et conserve la piste pour permettre sa
saisie. Si le texte a changé ou si les temps caractère manquent, l’action
appelle Forced Alignment, puis produit les visèmes localement. Elle n’appelle
pas le STT. Le panneau présente une seule action « Préparer et insérer » pour
préparer les fichiers de l’Avatar ; il n’expose pas de boutons séparés de
transcription et d’alignement. La transformation vocale reste une option
explicite distincte.

La zone principale présente les onglets « Capture », « Piste audio » et
« Réglages », dans cet ordre. Si une clé est déjà disponible, Capture est
sélectionné à l’ouverture ; sans clé et sans piste, Capture reste également
sélectionné. Les trois onglets restent visibles : Piste audio est désactivé
jusqu’à ce qu’une piste soit disponible et Réglages reste accessible. Les
sources de Capture sont toujours accessibles, avec ou sans clé : TTS et
transformation attendent la clé, tandis que Micro, Caméra et Charger audio
restent disponibles. Une piste créée ou chargée active et sélectionne Piste
audio. À la réouverture, Piste audio reste sélectionné si une piste existe ;
sinon Capture est sélectionné. Ses sources sont les onglets « Générer une
voix », « Micro », « Caméra » et « Charger audio ». L’onglet Caméra affiche
l’action de démarrage de la capture ; aucun réglage de suivi n’est exposé.
Le panneau « Charger audio » ne répète pas son titre : il présente seulement
l’action « Choisir un fichier ».

« Préparer et insérer » est l’action principale de Piste audio : le bouton a
un fond coloré, une taille supérieure aux commandes secondaires et un texte
renforcé. La zone ne présente pas de textes explicatifs statiques ; elle garde
les libellés et les retours courts liés aux actions.

## Frontières du module

- `src/ui/audio-capture-element.ts` possède le panneau et les états des
  contrôles auteur.
- `src/audio/types.ts` porte les temps de mot et de caractère partagés par les
  traitements fournisseurs et le calcul local des visèmes.
- `src/elevenlabs/voices.ts` porte les voix de démo et la liste optionnelle du
  compte.
- Chaque opération ElevenLabs est isolée : `text-to-speech.ts`,
  `speech-to-text.ts`, `forced-alignment.ts` et `voice-transformation.ts`.
  `speech-to-text.ts` reste une capacité indépendante exposée par le module,
  mais le flux auteur courant ne l’appelle pas. Le transcript fourni est aligné
  séparément par `forced-alignment.ts`. Le remplacement futur du STT ne change
  pas le contrat générique de timing ni le générateur local de visèmes.
- `src/timeline/french-azure-viseme-timeline.ts` produit localement les
  visèmes depuis les temps caractère, sans dépendre d’un module ElevenLabs.
- `src/elevenlabs/request.ts` centralise l’envoi et l’interprétation des
  erreurs ElevenLabs.
- `src/elevenlabs/api-key-storage.ts` possède la mémorisation facultative dans
  le navigateur.

Le token ne fait partie ni d’un événement Elcé, ni du document projet, ni des
métadonnées de prise. Le panneau l’envoie au fournisseur depuis le navigateur.

## Preuves et limites

- Le 5 novembre 2026, Safari MCP vérifie dans Elcé l’activation du bouton TTS
  avec une valeur temporaire non persistée et un texte, puis le retour à une
  entrée vide. Aucun appel ElevenLabs n’est lancé ; la case mémoire reste
  décochée et le stockage local sans clé.
- Le 6 novembre 2026, Safari confirme les dix choix prédéfinis avec George
  sélectionné. Aucun appel ElevenLabs n’a été lancé.
- `npm run typecheck` passe dans `packages/authoring/audio-capture/`.
- Le 6 novembre 2026, les typechecks Audio Capture et Elcé passent après le
  raccord du flux auteur à la démo : texte requis avant toute requête, sans
  appel STT ; un transcript fourni passe par Forced Alignment si ses temps
  manquent. La réponse réelle de Forced Alignment et le transfert complet au
  BDC Avatar restent à accepter dans le plan talking-head.
- Le 6 novembre 2026, Safari sur le Projet 3 confirme l’action unique
  « Préparer et insérer » et l’absence de boutons séparés de transcription et
  d’alignement. Les appels ElevenLabs et le transfert réel restent à accepter
  dans le plan talking-head ; aucun appel API n’a été lancé pendant ce contrôle.
- Le 6 novembre 2026, Safari confirme les onglets « Réglages »/« Capture » et
  les trois onglets de source dans Capture, sans textes d’aide statiques. Le
  panneau a été ouvert avec une clé déjà mémorisée. Aucun appel API n’a été
  lancé.
- Le 6 novembre 2026, Safari MCP vérifie l’affichage sans clé en vidant
  temporairement le champ en mémoire, sans déclencher d’événement ni modifier
  le stockage, puis en restaurant sa valeur. Capture reste sélectionné, les
  trois sources sont visibles, Piste audio reste visible et désactivé, le TTS
  est désactivé et le microphone reste disponible. Aucun appel API ni
  changement du document n’a eu lieu.
- Le 6 novembre 2026, après changement vers « Réglages », fermeture et
  réouverture de la modale, Safari confirme que « Capture » est le premier
  onglet et qu’il est à nouveau sélectionné. La valeur de la clé n’a pas été
  lue ni affichée ; aucun appel API ni changement du document n’a eu lieu.
- Le 6 novembre 2026, Safari confirme l’ordre Capture/Piste audio/Réglages,
  l’état désactivé de Piste audio sans piste, puis sa sélection après chargement
  d’un WAV local temporaire. « Préparer et insérer » apparaît avec le fond,
  la taille et le poids typographique de l’action principale. Le bouton n’a pas
  été déclenché ; aucun appel ElevenLabs ni aucune insertion au projet n’a eu
  lieu.
- Le 6 novembre 2026, Safari confirme les sources « Micro » et « Caméra » dans
  la modale du Projet 3. Le panneau Caméra affiche « Commencer la capture » sans
  réglage de suivi. Aucun appareil n’a été démarré pendant ce contrôle visuel ; le flux média réel reste
  dans l’acceptation du [plan talking-head](../../../elce/plan/2026-11-04-talking-head-plan.md).
- Le 6 novembre 2026, à un viewport de 390 × 844 px, Safari confirme une
  modale de 358 × 672 px sans débordement horizontal. Les quatre sources
  s’affichent sur deux colonnes ; aucun appareil n’a été démarré pendant ce contrôle.
- Le 6 novembre 2026, Safari confirme que la source « Charger audio » présente
  seulement le bouton « Choisir un fichier », sans légende répétée. Le sélecteur
  natif n’a pas été ouvert pendant ce contrôle.
- Le chargement des voix de compte et les réponses réelles de TTS, Forced
  Alignment et transformation vocale ne sont pas certifiés par ces preuves.
  Le STT n’est pas appelé dans le flux auteur courant. L’acceptation reste dans le
  [plan talking-head d’Elcé](../../../elce/plan/2026-11-04-talking-head-plan.md#lot-5--module-audio-réutilisable--phase-1-en-cours).
