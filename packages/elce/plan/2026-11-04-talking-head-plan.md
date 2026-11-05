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
- Micro + caméra tête/regard ; nouvelle prise, conversion vers une voix choisie
  après saisie, puis réécoute. Corps, mains et montage reportés.
- Évaluer navigateur et serveur avant le repli SaaS de référence. Aucune app
  native ni installation d’outil sur le poste auteur.
- Voix finale = durée et fin fonctionnelle de la page. Première carte à zéro,
  suivantes au début du mot choisi ; occurrences distinguées. Au retrait de
  l’Avatar ou au remplacement de sa prise, supprimer les associations aux mots
  et conserver les temps de déclenchement correspondants. Une nouvelle
  association reste un geste explicite de l’auteur : sélectionner un mot du
  nouveau son remplace le temps conservé par le début de cette occurrence.
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
  les mods et d’autres projets. Préparer 3D, multi-personnages et montage futur.
- Dans Elcé et Editor, les widgets sont des stories ou scènes produites par
  des factories depuis un objet de configuration, puis ajoutées au projet ;
  chaque éditeur proposera à terme son catalogue. La tête parlante est le
  premier widget visé ici ; le minuteur existant est un autre candidat à
  configurer. Le modèle de widgets attend la collecte de toutes les contraintes
  des candidats ; ce POC documente celles de la tête parlante sans décider
  l’emplacement des configurations, des factories, des stories ou du catalogue.
- Capture V2 et données réduites dans un événement final, sans event par frame.
  Autres formats de page, lecture mobile et SCORM hors POC.

## Ordre de réalisation

| Lot | Propriétaire et résultat attendu |
| --- | --- |
| 0 — Fini | `authoring/component-v2/src/rive/view-model/` : composant distinct, cycle de state machine partagé, Seek narratif et durée de vie native vérifiés. |
| 1 — Fini | `demos/src/v2/demos/rive-view-model/` : rig, MP3 et JSON fournis, voix maître, visèmes et mots synchronisés ; animations internes Rive préservées. Démo validée par l’utilisateur. La piste caméra reste au lot 5. |
| 2 — Fini | `authoring/component-v2/src/rive/` porte les composants ; `authoring/story/rive-talking-avatar/` porte la story réutilisable et son guide ; `isTalking` reste le booléen canonique. |
| 3 — En cours | `resources/bdcs/carousel/reading/`, `resources/pages/diapo/`, `mods/learning/reading/`, `mods/learning/preview/` et `src/server/elce-local-server.ts` : assembler la factory Avatar et le Carousel sur une Diapo réelle du Projet 3, avec quatre cartes et les occurrences retenues du transcript. Brancher la preview standard à la seule page de démonstration via le mapping temporaire par `pageId` ; servir les assets Rive et audio depuis le boundary Remix existant. La voix maître règle la durée, l’avatar reste responsive, les points Carousel sont absents et la fin publique est émise à la fin de la voix. Garder les pages ordinaires inchangées. Pas de modèle persistant de widget ni de catalogue. |
| 4 — En cours, cadrage | Éditeurs Diapo/Carousel + commandes/persistance sur les fichiers fournis : BDC Avatar à côté du Carousel, réglages de placement et association des cartes aux occurrences du transcript. La captation micro/caméra reste au lot 5. |
| 5 | Module de prise web + connecteur Elcé : micro/caméra, conversion après saisie, réécoute et attribution des ressources à la page. |

Le pont temporaire du lot 3 est nommé
`LearningPlayerOptions.temporaryRiveTalkingAvatarByPageId`. Il sert au POC
sur fichiers et sera supprimé ou remplacé après la collecte des contraintes
des candidats widgets et l’acceptation de leur modèle ; il n’est pas un champ
du document Elcé. Le document de test MCP doit rester un document Elcé réel,
créé et conservé par le serveur de projets ; le fixture en mémoire est écarté.

## Décisions restantes

- **T2 :** mesurer qualité, délai, mémoire et synchronisation des traitements
  navigateur/serveur avant de choisir les modèles ou le repli SaaS. Étude à
  conduire dès le cadrage ; choix requis avant le lot 5.
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
  Le placement recouvre aussi
  une partie du texte : réserver un espace lisible fait partie de l’acceptation
  responsive restante. Preuves et analyse dans l’[étude](../notes/2026-11-04-talking-head-study.md#reprise-du-projet-3--5-novembre-2026).
- **T4 :** schéma persistant des prises/pistes et admission audio/Rive/données
  dans le catalogue média Elcé ; préparer le montage futur. L’emplacement du
  module de captation reste à choisir avant le lot 5.
- **T5 :** format et précision de réduction temporelle ; restitution du regard
  selon les capacités réelles du rig, sans contrôle indépendant identifié.
- **D1/D2 :** la télécommande est intégrée à la barre de navigation et le
  démarrage manuel est appliqué. Le placement responsive du médaillon et
  l’affichage initial du rig restent à qualifier. L’emplacement permanent de
  la configuration attend l’examen du modèle de widgets.

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
3. **Télécommande appliquée et vérifiée ; placement de l’avatar restant** —
   `resources/pages/diapo/rive-talking-avatar-poc/` : achever le placement
   responsive lisible et l’affichage du rig avant Play ;
   `mods/learning/reading/navigation-remote/` et le layout de navigation
   portent la télécommande partagée `@codplay/remote`,
   avec attente d’un clic Play pour le Projet 3. Vérifier qu’avant ce clic,
   le temps reste à zéro, la voix est suspendue et la première carte est visible.
   L’option temporaire `autoStart` porte le choix ; le démarrage initial joue
   les seules scènes actives autorisées par `runtime.playAll`, puis
   l’observation du slot suspend la page narrée à chaque entrée manuelle.
   Détruire l’ancienne télécommande au changement de page et à la destruction.
   Tester Play/Pause, Seek, replay, sortie/retour, largeur étroite et absence de
   télécommande sur les pages ordinaires. Aucun changement de modèle
   documentaire, d’éditeur ou de moteur.
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
Le placement et l’affichage initial de l’avatar restent à traiter ; le lot 3
reste En cours.

## Lot 4 — intégration auteur : implémentation En cours

Décision utilisateur du 5 novembre : présenter l’Avatar comme un BDC pour
accéder à la captation et aux réglages, dont la position ; sa présence active
dans le Carousel l’accès au transcript et le choix d’un mot horodaté.
Le BDC Avatar est placé dans la Diapo à côté du Carousel. Il n’est ni une vue
ni un enfant du Carousel. Le lot 4 conserve les fichiers audio, transcript et
visèmes fournis ; le module de captation micro/caméra, la conversion après
saisie et la réécoute restent au lot 5, selon l’ordre convenu.
Décision du 5 novembre sur le retrait de l’Avatar ou le remplacement de sa
prise : supprimer les liens aux occurrences du transcript, en conservant
leurs temps de déclenchement. Ne pas conserver d’associations « À réassocier »
ni reporter automatiquement les liens sur les mots d’une nouvelle prise.
Chaque carte peut ensuite être réassociée au nouveau son : le choix d’une
occurrence de son transcript enregistre la nouvelle association et remplace
son temps de déclenchement par le début de cette occurrence. La première
carte reste à zéro.
Rationale et interactions proposées dans l’
[étude](../notes/2026-11-04-talking-head-study.md#intégration-auteur-proposée--5-novembre-2026).

Décision utilisateur : **un seul Avatar par Diapo pour cette version**, frère
du Carousel. L’Avatar peut être conservé au catalogue ; Flux et placement
enfant ne sont pas proposés dans cette tranche. Le contenu principal conserve
son unique emplacement. Le modèle transversal des widgets reste ouvert.

Actions du lot 4 — acceptées par la demande de poursuite :

Préparation de l’exécution :

- **Acquis :** BDC frères, prise sur fichiers fournis, temps conservés après
  retrait/remplacement et réassociation explicite au nouveau son ; fond
  réglable sur le rig transparent.
- **Schéma de cette tranche :** document v11, migration additive depuis v10 ; payload
  `avatar` propre à la ressource, avec référence de profil, prise identifiée
  (audio référencé dans `medias`, durée, occurrences et piste fournie) et
  réglages de placement/lecture. Le rig fourni reste une ressource applicative
  du profil ; l’audio rejoint le circuit média existant. Le transcript est
  conservé une seule fois dans la prise. L’entrée Carousel porte un temps de
  début et une association facultative à la prise et à son occurrence ; les
  durées ordinaires gardent leur rôle actuel. La projection temporelle
  réutilise le builder Carousel et la factory Avatar existants.
  `avatar.take` contient `id`, `audioMediaId`, `durationMs`, `words` et
  `frames` adaptés au profil fourni. `avatar` porte aussi `profileId`,
  `autoStart` et `placement` (position, largeur, fond facultatif).
  `CarouselBdcEntry.cue` contient `startAtMs` et `word` facultatif
  `{ avatarBdcId, takeId, wordIndex }`. Aucun transcript copié dans le Carousel.
  Le retrait/remplacement efface seulement `cue.word`. L’import de prise
  utilise la file XState et le stockage média commun ; SQLite porte un détail
  Avatar JSON et les repères des entrées.
- **Propriétaires à étendre :** `resources/bdcs/avatar/` pour données,
  validation, adaptation du fichier et éditeur ; modèle/commandes Learning
  pour placement et mises à jour atomiques ; file d’import et API média
  existantes pour l’audio ; codec et SQLite pour la migration et la
  persistance. Aucun catalogue, historique ou lecteur parallèle.
- **Gates :** cardinalité arrêtée et schéma décrit ci-dessus ; conserver
  les spécifications documentaires actuelles tant que l’évolution n’est pas
  implémentée et vérifiée. Le modèle transversal de widgets et la captation
  restent hors de cette tranche.

1. `resources/bdcs/avatar/`, document et commandes Learning : ajouter le BDC
   Avatar et ses placements acceptés, la référence de prise et les réglages
   responsive. Réutiliser commandes XState, historique, catalogue et
   persistance existants ; prévoir la migration des documents sans Avatar.
2. Éditeurs Avatar et Carousel : utiliser la prise fournie et ouvrir ses
   réglages depuis le BDC Avatar. Préserver le point d’entrée prévu vers le
   futur module de captation sans le présenter comme déjà disponible.
   Dans chaque vue Carousel, sélectionner
   une occurrence du transcript de cette prise ; conserver la première carte
   à zéro. Un mot répété reste distinguable. Au retrait de l’Avatar ou au
   remplacement de sa prise, supprimer l’association et conserver le temps
   correspondant dans la même commande documentaire. Permettre ensuite de
   choisir un mot du nouveau son pour remplacer ensemble l’association et
   le temps de la carte. Ne pas copier le transcript dans le Carousel.
3. Builders Diapo/Carousel et preview Learning : produire la configuration de
   la factory existante depuis le document et retirer le mapping temporaire
   par projet/page. Conserver la voix maître, la télécommande de navigation,
   le démarrage choisi et la fin publique par le circuit déjà vérifié.
4. Acceptation : créer et régler un Avatar dans l’éditeur réel, associer les
   cartes (dont un mot répété), vérifier Play/Pause/Seek/replay et fin vocale ;
   retrait/remplacement doivent supprimer les associations en conservant
   exactement les temps. Undo/Redo doit restaurer ensemble la prise, les
   associations et les temps. Réassocier une carte à un mot du nouveau son
   doit remplacer son temps conservé par le début du mot choisi, sans modifier
   les autres cartes ; rechargement et preview doivent restituer
   l’état enregistré. Tests avec leurs propres
   prises, typecheck/build et navigateur ; transférer seulement les résultats
   vérifiés aux spécifications propriétaires.

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
  La piste de tête issue de capture caméra reste au lot 5.
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
  Undo/Redo et rechargement avec ressources/placement/repères restaurés.
- Reprise du 5 novembre : **68 tests passent sur 70** dans les suites Diapo,
  player et session preview. Le test narré passe. Échecs avant toute modification
  de cette reprise : attente du perso Question `:prompt` et absence du groupe
  d’observation de la Carte ancrée. Typecheck/build non rejoués à ce gate ;
  aucune correction d’implémentation appliquée pendant cette reprise.
- Tests des frontières concernées, typechecks/builds et navigateur réels avant
  transfert des comportements vérifiés aux spécifications propriétaires.
- Aucune modification du core CodPlay autorisée par ce plan ; toute lacune
  demande reproduction indépendante, plan accepté et autorisation explicite.
