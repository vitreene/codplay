# Tête parlante — plan d’action

**Lot 0 Fini**, accepté et réalisé le 4 novembre 2026. `rive-view-model`, son
Seek narratif et l’avancement de la state machine à travers les broadcasts
persistants sont couverts par la
[spécification Rive](../../codplay/specs/third-party-rive-spec.md).
Les lots suivants restent à réaliser ; leur cadrage est suivi ici et leur
rationale dans l’[étude](../notes/2026-11-04-talking-head-study.md).

## Décisions retenues, non appliquées

- Module web réutilisable, connecteur Elcé vers Diapo/Carousel ; lecture par
  les circuits existants. Mac est le poste de développement, sans variante OS.
- Micro + caméra tête/regard ; nouvelle prise, conversion vers une voix choisie
  après saisie, puis réécoute. Corps, mains et montage reportés.
- Évaluer navigateur et serveur avant le repli SaaS de référence. Aucune app
  native ni installation d’outil sur le poste auteur.
- Voix finale = durée et fin fonctionnelle de la page. Première carte à zéro,
  suivantes au début du mot choisi ; occurrences distinguées. Réassociation
  manuelle des repères invalidés après remplacement de prise.
- Aucune navigation Carousel. Télécommande Play/Pause/progression éventuelle,
  techniquement hors scène. Affichage du transcript et commande son reportés.
- Avatar déplaçable/redimensionnable, placement responsive. Garder le fond du
  rig pour la première démo ; ensuite fond de médaillon avec tête dépassant.
- Captation, données, rendu et connecteurs séparés pour réemploi dans Editor,
  les mods et d’autres projets. Préparer 3D, multi-personnages et montage futur.
- Capture V2 et données réduites dans un événement final, sans event par frame.
  Autres formats de page, lecture mobile et SCORM hors POC.

## Ordre de réalisation

| Lot | Propriétaire et résultat attendu |
| --- | --- |
| 0 — Fini | `authoring/component-v2/src/rive/rive-state-machine-component.ts` : effets d’horloge des broadcasts appliqués une fois par occurrence active ; les visèmes conservent le delta natif entre images. |
| 1 — Fini | `demos/src/v2/demos/rive-view-model/` : copie distincte sur le rig fourni et `rive-view-model`, synchronisée avec le MP3 et le JSON pour bouche/mots. Aucune piste de tête capturée dans ce lot ; préserver les animations internes Rive. Brancher la caméra au lot 5. Finir à la durée du MP3 ; conserver l'original et le layout partagé. |
| 2 | Module partagé à localiser : story Avatar prête à intégrer, profil Rive et preuve de réemploi autonome. |
| 3 | Builders Diapo/Carousel + connecteur Learning : démo narrée sur fichiers, cartes synchronisées et fin à la fin de voix. |
| 4 | Éditeurs Diapo/Carousel + commandes/persistance : placement et association au transcript sur fichiers de démo. |
| 5 | Module de prise web + connecteur Elcé : micro/caméra, capture de tête pour `headX`/`headY`/`headTilt`, conversion après saisie, réécoute et attribution des ressources à la page. Réduire la piste caméra en un événement rejouable selon T5. |

## Décisions restantes

- **T2 :** mesurer qualité, délai, mémoire et synchronisation des traitements
  navigateur/serveur avant de choisir les modèles ou le repli SaaS. Étude à
  conduire dès le cadrage ; choix requis avant le lot 5.
- **T3 :** composition story Avatar/Carousel et remplacement de la fin actuelle
  par la fin de voix, avec le même player et le signal public existant.
- **T4 :** emplacement du module partagé, schéma des prises/pistes et admission
  audio/Rive/données dans le circuit média existant ; préparer le montage futur.
- **T5 (lot 5) :** définir le format et la précision de réduction temporelle
  de la piste caméra pour un seul événement rejouable. La référence calcule les
  valeurs depuis MediaPipe à chaque frame et n’exporte aucune piste de tête ;
  préserver le temps, les pauses et les extrêmes au Seek.
- **D1/D2 :** inclusion/emplacement/seek de la télécommande ; design du médaillon
  et placement responsive après la première démo.

## Acceptation et clôture

- Lot 0 clos : 72 tests du package, 20 régressions parent/cible, typechecks
  composants/démos/core et build des démos réussis. Le
  [relevé Safari](../notes/assets/talking-head/rive-player-acceptance.json)
  couvre le rig réel, preload/player, Play/Seek, événements au même instant,
  broadcasts, pause/reset, resize CSS, isolation, remontage et destruction.
  Persistance applicative et intégration Elcé restent dans les lots suivants.
- Correctif R1 vérifié : Safari MCP a observé `lastTimeMs = 0` aux événements
  de visème vers 7,4–8,3 s, sous le même `avatar:start` actif depuis zéro.
  `rive-state-machine-component.ts` ne réinitialise désormais son horloge qu’à
  l’activation d’une occurrence de broadcast. Le test d’intégration vérifie deux
  deltas consécutifs de 100 ms ; un `STOP` persistant ne recrée pas la machine
  à chaque mise à jour. Sur le rig réel, après Seek à 7 400 ms et Play à ×0,25,
  680 images ont gardé un delta maximal de 5,67 ms, sans retour à zéro aux
  frontières des visèmes. La spécification Rive et l’acceptation
  navigateur sont mises à jour.
- Lot 1 : le rig est copié dans `demos/public/avatars/`; le MP3 et le JSON
  originaux sont conservés dans `public/assets/talking-head/` et
  `demos/rive-view-model/avatar-data/`. Le texte du JSON correspond au texte
  fourni ; ses 152 visèmes et 41 mots couvrent 14,396 s sans trou ni
  chevauchement. Le MP3 dure 14,445714 s ; la scène finit à 14 446 ms. La démo
  utilise directement chaque `property`/`value`, les temps de mots, la voix
  comme média maître et le décalage bouche de 50 ms. Safari a chargé le rig et
  l’audio réels, lu la piste jusqu’à sa fin, puis vérifié un Seek à 7 500 ms
  avec l’audio à 7,5 s et le sous-titre « l'espace ».
  L’export ne contient pas de piste de tête. Le code du testeur charge
  MediaPipe FaceLandmarker et écrit les valeurs caméra filtrées par frame dans
  `headX`, `headY` et `headTilt`; il n’utilise pas les triggers de l’inspecteur
  pour cette boucle. Le modèle `.task` sert à détecter le visage, pas à décrire
  une prise. La démo est acceptée comme preuve voix/visèmes/sous-titres ; le
  la piste de tête capturée par caméra est reportée au lot 5 et reste soumise à
  T5. Les animations internes du rig restent exécutées pendant la lecture et
  ne sont pas garanties pixel-identiques après Seek.
- Le constat de rollback de preview d’opacité est suivi en **S1, à analyser**
  dans le [plan tiers](../../codplay/plan/2026-09-18-third-party-components-v2-plan.md).
  Il ne bloque pas le binding ViewModel ; aucune correction de styles n’est
  incluse dans ce lot.
- Elcé : mots répétés, remplacement de prise, fin de voix après la dernière
  carte, sortie/retour sans son résiduel, annulation/refus micro-caméra,
  Undo/Redo et rechargement avec ressources/placement/repères restaurés.
- Tests des frontières concernées, typechecks/builds et navigateur réels avant
  transfert des comportements vérifiés aux spécifications propriétaires.
- Aucune modification du core CodPlay autorisée par ce plan ; toute lacune
  demande reproduction indépendante, plan accepté et autorisation explicite.
