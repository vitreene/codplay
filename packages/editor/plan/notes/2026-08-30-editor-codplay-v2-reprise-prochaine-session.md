# Note de reprise — prochaine session éditeur / CodPlay V2

**Statut : En cours — note opérationnelle, aucun code autorisé par cette note.**  
**Cible : ed2 raccordé nativement à CodPlay V2.**  
**Date : 2026-08-30.**

## But de la reprise

Reprendre le chantier exactement au point où il a été laissé : qualifier la
frontière de géométrie nécessaire à l'authoring, puis seulement, après
validation explicite du contrat et de l'autorisation de modifier le core,
continuer l'intégration de l'éditeur à V2.

Cette note ne crée pas une nouvelle API et ne vaut pas autorisation de code.
Elle sert de feuille de route de la prochaine session et renvoie au plan qui
porte les tranches et leurs critères d'acceptation :

- [plan de reprise éditeur / CodPlay V2](../2026-08-30-editor-codplay-v2-reprise-report.md) ;
- [contexte des décisions déjà prises](./2026-08-30-editor-codplay-v2-context.md) ;
- [état de découverte CodPlay V2](../../../codplay/plan/notes/2026-08-26-decouverte-etat-codplay-v2.md) ;
- [plan de façade et d'instance](../../../codplay/plan/facade-engine-instance-plan.md) ;
- [contrat du runner HTML](../../../codplay/src/runtime/runner-html/README.md).

## État confirmé à l'ouverture de la session

- Le portage **abandonne V1**. Il n'y a ni patch legacy, ni protocole de
  compatibilité V1/V2 à conserver dans la nouvelle verticale.
- La machine xState de l'éditeur reste propriétaire de `EditorScene`, de la
  sélection, des commandes et du cycle de l'interface. Le bridge ne duplique
  pas cet état et ne le contourne pas.
- Le builder de l'éditeur produit déjà le `SceneDoc` V2 et s'appuie sur
  `packages/authoring/capsule-automation` pour les éléments actuellement
  couverts. Le modèle `scene.zones` existe ; la reprise de son traitement est
  postérieure à l'intégration V2, et sa preview appartient à l'éditeur, pas au
  player.
- `snapshot` est une capacité directe de l'instance CodPlay, au même niveau que
  `telco` : `instance.snapshot.get()`, `set(...)`, `clear()`. Le patch est
  logique, ciblé par `storyId`/`persoId` et `timeMs`, et ne porte pour l'instant
  que `state.style`. L'effacement est explicite ; aucune annulation automatique
  n'est imposée avant observation des manipulations réelles.
- Les dimensions structurées de l'éditeur sont transportées comme nombres
  `unitless` dans le contrat V2. CodPlay les qualifie selon sa configuration ;
  `cqw` est la valeur courante, héritée de la sémantique de racine observée en
  V1, mais aucune méthode V1 ni aucune qualification n'est conservée dans
  l'éditeur. Le materializer ne déduit pas la grammaire CSS et ne qualifie pas
  une chaîne libre. Les propriétés discrètes comme `object-fit`, `line-height`
  et les chaînes CSS composées ne sont pas transformées en longueurs par cette
  convention.
- Les CSS générés et les médias suivent deux chemins distincts : CSS immédiat
  par l'API `codplay.preload.css.set/clear`, médias par le preload/cache déjà
  disponible (`preload.load` puis `resources.register`). Aucun `Blob` CSS ni
  gestionnaire CSS dupliqué dans l'éditeur n'est prévu.
- Les briques de mesure existent déjà dans le runner HTML (`captureHtmlPose`,
  snapshots de layout, registre des nœuds persistants), mais la géométrie n'est
  pas encore arrêtée comme **port public V2** pour l'authoring. C'est le point
  d'arrêt actuel. Cette capacité est constitutive de la raison d'être de V2,
  pas une option facultative de Selection Frame.
- Aucun code n'a été modifié dans cette reprise documentaire ; les changements
  existants sont des mises à jour de plans et de notes et doivent être
  conservés. Ne pas réinitialiser le worktree.

## Porte d'arrêt : contrat de géométrie V2

Avant toute modification de `packages/codplay`, il faut arrêter et valider le
contrat de la sortie géométrique. Ne pas inventer un nom tel que
`instance.geometry` tant que les points suivants ne sont pas décidés :

1. **Sortie** : frame numérique immuable, sans node DOM, sans `NodePose`, sans
   `getComputedStyle` et sans mécanisme FLIP exposé à l'éditeur.
2. **Identité** : clé de story/item/personnage et comportement pour une cible
   absente, démontée ou non encore présentée.
3. **Repère** : coordonnées utilisées par l'overlay et les outils (référence de
   scène, viewport ou repère explicitement défini), avec unités et conversion
   `cqw` non ambiguës.
4. **Contenu** : au minimum le rectangle présenté et les champs nécessaires
   aux outils existants (ancrage, rotation/échelle si réellement consommés,
   révision ou timestamp de présentation). Ne pas ajouter de champs non
   justifiés par un consommateur.
5. **Observation** : lecture ponctuelle, notification ou les deux ; moment où
   le frame devient valide après `build`, `seek`, `resize`, `snapshot`,
   `rebuild`, montage et démontage.
6. **Cycle de vie** : invalidation et diagnostics lors d'un seek, d'un
   changement de sélection, d'une destruction ou d'un remplacement d'instance.
   La session de travail ne doit pas transporter silencieusement un frame vers
   un autre temps logique.
7. **Intégrité** : preuve que la mesure provient de la présentation courante
   et qu'elle reste cohérente pour parent/enfant, reparent et grille.

Si l'un de ces points reste ouvert, la session s'arrête à l'analyse et au
document de contrat. Toute correction observée ensuite sera classée avant code
:

- violation d'un contrat V2 déjà fixe : **bug V2** ;
- capacité absente mais requise par le contrat : **feature V2** ;
- hypothèse V1 encore présente dans l'éditeur : **correction éditeur** ;
- comportement non décidé : **écart de spécification**, à faire valider.

## Déroulé de la prochaine session

### S0 — reprise et état des preuves (lecture seule)

- Relire les cinq documents liés ci-dessus et le plan principal à partir de la
  section « Plan détaillé d'ouverture du chantier ».
- Vérifier le worktree et ne toucher qu'aux documents explicitement concernés.
- Inventorier les imports et appels V1 encore présents dans
  `scene-player-bridge.ts`, `decor-editor-bridge.ts`,
  `offset-editor-bridge.ts`, `sequence-editor-bridge.ts` et
  `decor-editor/mount.ts` (`AuthorApi`, `studio.load`, `getNodePose`,
  `setNodePose`, `subscribeToNode`, lectures de nœuds).
- Exécuter les tests existants sans modifier le code et consigner les résultats
  comme baseline. Les preuves prioritaires sont le builder de scène, la
  compilation, le runner HTML, la façade snapshot/preload, les machines xState,
  Decor et Selection Frame listées dans le plan principal.

### S1 — spécification de la géométrie (aucun code)

- Relire les consommateurs réels du Selection Frame et de l'overlay pour ne
  retenir que les champs effectivement nécessaires.
- Comparer ces besoins aux mesures internes du runner et documenter les écarts
  exacts : donnée manquante, mauvais repère, cycle de vie ou simple absence de
  façade.
- Rédiger le DTO, les opérations et les diagnostics dans une note de contrat,
  avec au moins les cas initial, seek, resize, snapshot, rebuild, montage,
  démontage, parent/enfant et reparent.
- Vérifier que la sortie reste numérique et logique : aucune référence à un
  élément DOM ne franchit la frontière V2.

### S2 — revue et autorisation

- Soumettre le contrat de géométrie pour validation.
- Demander séparément l'autorisation de modifier le core CodPlay V2 pour
  exposer cette capacité. L'autorisation déjà donnée pour `snapshot` et `cqw`
  ne couvre pas cette nouvelle frontière.
- Tant que cette validation n'est pas donnée, ne pas coder le runner, la façade
  ni le bridge. Une analyse complémentaire côté éditeur reste possible.

### C1 — feature core géométrie (uniquement après S2 validé)

- Transformer les mesures internes existantes en la sortie publique validée,
  sans remettre `RuntimePlayer`, `SolvedScene` ou des nœuds HTML à l'éditeur.
- Définir l'invalidation/recalcul après les événements autorisés et les
  diagnostics associés.
- Relayer la capacité par la façade d'instance et ajouter les tests navigateur
  sur le chemin réel `build → instance → seek/resize → frame`.

### E1 — preuve du builder et préparation de la verticale éditeur

- Vérifier dans le browser que `buildSceneDocV2` conserve les classes et
  données attendues, que `cqw` interpole simultanément position, dimensions et
  autres propriétés continues, et que les propriétés discrètes restent
  inchangées.
- Vérifier le passage `CodPlay.build → preload médias/CSS → resources.register →
  instance`, sans URL ni ressource inventée par le bridge.
- Conserver `scene.zones` et le signal de zone différée ; ne pas faire passer la
  preview des zones dans le player.

### E2 — remplacement du bridge V1 (après les preuves précédentes)

- Introduire le bridge V2 prévu par le plan, avec le flux réel : builder,
  `codplay.build`, preload média, `codplay.preload.css.set`, enregistrement des
  ressources, création d'une instance, puis `instance.telco`.
- Publier les handles vers la machine xState existante et conserver son
  ownership. Le rendez-vous `PLAYER_READY` doit être conservé ; le nom interne
  `instanceReady` est une décision de nettoyage à appliquer avec le bridge, pas
  une nouvelle machine.
- En cas d'échec de construction, preload ou montage, conserver l'ancienne
  instance et la feuille CSS précédente ; ne pas publier un état partiellement
  construit. Le slot CSS n'étant pas transactionnel, restaurer explicitement
  le texte précédent ou le vider s'il n'existait pas.
- Supprimer le circuit V1 et les lectures/écritures DOM, pas les contourner par
  un adaptateur de compatibilité.

### E3 — révision Decor et Selection Frame

- Faire produire à la session Decor un patch snapshot atomique (`state.style`)
  au lieu de `setNodePose`; lire la base par `snapshot.get` au lieu de
  `getPersoStates`; conserver cascade, copy-on-write et commit via xState.
- Réécrire les outils Selection Frame pour consommer le frame géométrique V2 et
  produire des deltas logiques. `getNodePose`, `setNodePose`,
  `subscribeToNode`, `TrackedSession` et le double protocole offset sortent du
  chemin V2.
- Garder l'overlay DOM de l'éditeur comme vue de travail ; seul le player cesse
  d'être une source de pose ou de style.

### Z1 — zones, après l'intégration V2

- Auditer le traitement interrompu de `scene.zones` dans
  `packages/authoring/capsule-automation`.
- Définir la preview visuelle dans l'éditeur, sans faire porter cette
  représentation au player et sans interpoler les classes CSS de zone.
- Réserver le démontage/clear des ressources de scène, notamment CSS, à la
  future note Sighty ; Sighty n'est pas dans le périmètre de cette reprise.

## Critères d'acceptation à préparer

La tranche ne pourra être présentée comme stable qu'après le chemin navigateur
réel, et non après un test isolé :

- une scène initiale, intermédiaire et finale vérifie simultanément `x`, `y`,
  `width`, `height`, rotation/échelle si consommées, et couleur continue ;
- `Play`, `Seek`, `resize`, rebuild, montage/démontage et remplacement
  d'instance gardent le même repère et les bonnes révisions de frame ;
- `snapshot.set/get/clear` ne touche ni au journal ni au `CompiledScene` et
  s'applique atomiquement au temps présenté ;
- médias déjà disponibles sont réutilisés, CSS est remplacé/effacé par slot,
  et un échec ne détruit pas l'instance précédente ;
- parent/enfant, reparent, grille et cible absente sont testés ;
- les gestes de l'éditeur fonctionnent sans import V1, sans node DOM fourni par
  V2 et sans écriture directe de style sur le player ;
- les tests de type, unitaires, intégration et navigateur pertinents passent.

Les zones ne sont pas un critère de complétude de cette première verticale :
elles restent explicitement en reprise postérieure.

## Règle de fin de session

Ne pas commencer une implémentation parce qu'un nom d'API paraît naturel ou
qu'une mesure interne existe déjà. La prochaine session doit se terminer soit
par un contrat de géométrie validé et une autorisation de feature core, soit par
un relevé documenté des écarts restant à décider. Aucun fallback V1 ne doit être
introduit entre ces deux états.
