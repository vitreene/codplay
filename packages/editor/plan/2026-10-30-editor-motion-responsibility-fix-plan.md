# Correction des responsabilités mouvement

**Statut : Fini — correctifs ciblés et acceptation navigateur complétés le 31 octobre 2026. Aucun fichier CodPlay modifié.**

**Unités — portée confirmée par l’utilisateur.** Données auteur, palette et
sauvegarde restent en cqw. Les mesures physiques restent à la frontière DOM ;
aucune valeur auteur n’est convertie ou persistée en pixels.

## Décisions acceptées

- **1 — ACE fait référence.** Calcul local retiré ; les formes non acceptées
  par ACE produisent un diagnostic builder explicite.
- **2 — Un item, un perso.** Retirer la répartition hôte/enfant et les lectures
  et écritures snapshot doubles ; conserver les composants et surfaces natifs.
- **3 — Autorité géométrique.** Endpoints issus du document et du geste courant,
  sélection issue de la présentation courante ; retirer le cache des visites.
- **4 — Phase pendant un geste overlay.** Risque jugé bénin par l’utilisateur ;
  correction dépriorisée, aucun élargissement de périmètre.
- **5/6 — Présentation et conversion.** Editor possède la conversion contenu/
  cadre ; CodPlay conserve `move`. Regrouper cette adaptation dans le composant
  item de l’owner Editor. Le cadre et la représentation native sont ses parts
  privées ; leur séparation est nécessaire aux tailles animées sur des fenêtres
  différentes. Style auteur en règle CSS, contribution motion inline ; preview
  dans le même `snapshot.set`, avec inversion affine ACE de la pose publiée.
- **Core exclu.** Refus explicite utilisateur : CodPlay est partagé entre
  projets. Aucun changement local dans `packages/codplay`. La contrainte durable
  est enregistrée dans `AGENTS.md`. Le défaut général reproduit du présentateur
  reste distinct de la correction des propriétaires dans Editor.

## Actions appliquées

| Fichiers / propriétaire | Remplacement et résultat | État |
| --- | --- | --- |
| `motion-editor/easing.ts`, validation builder | Parseur ACE unique et diagnostic avant scène partielle | Appliqué ; [contrat](../specs/motion-easing-spec.md) |
| `builder-v2`, `item-presentation`, `scene-player-bridge.ts` | Un perso natif par item ; conversion commune, aucune translation issue du décor | Appliqué ; [contrat et preuves](../specs/item-presentation-spec.md) |
| `decor-editor-bridge.ts`, géométrie et insets | Un état/patch, pas de fusion ni de cache d’endpoints alimenté par sélection ; dimensions de contenu du snapshot ; réinitialiser le segment dérivé au chargement d’un document | Appliqué ; [orientation](../specs/path-tangent-orientation-spec.md) |
| `editor-coordination-bridge.ts` | Retrait du détour `durée − 2 ms` ; fin adoptée par le transport existant | Appliqué ; tests et horloge publique navigateur |
| `motion-editor/overlay.ts` | Retirer l’identité KF des parts de ghost réutilisables absentes de la projection courante ; éviter une adresse périmée après reload/changement de segment | Appliqué ; régression ciblée verte |
| `builder-v2`, `scene-player-bridge.ts`, coordination | Pour un endpoint CSS absent, garder la cascade auteur/app prioritaire, sinon mesurer une fois le style calculé de l’objet natif à sa pose initiale et réutiliser cette valeur dans le tween ACE générique | Appliqué ; [contrat et preuves](../specs/decor-style-interpolation-spec.md) |
| Tests propriétaires | Images, média, parent/enfant/reparent, preview/clear, Seek, reset, destruction, resize, Undo/Redo et reload | Réalisé dans les périmètres ci-dessous |

**Arrondi CSS — appliqué et vérifié.** La conversion commune conserve les
   valeurs auteur en cqw et résout les bordures au ratio de pixels de la
   fenêtre. Elle émet les mêmes insets en nombres pour les overlays et en
   expressions CSS `round` pour le composant responsive. Le padding conserve
   ses fractions. Les tests couvrent px/cqw à la frontière CSS et les ratios
   1/2 ; les données auteur, la palette et la sauvegarde ne changent pas.
   Les gestes/ghosts passent à 1328, 1100 et 1024 px sans relever les seuils.
   Le défaut initial à 1100 (bordure calculée 16,4 px, native 16 px, ghost
   1,138 px) est résolu ; les trois parcours ont un écart maximal inférieur
   à 0,59 px, y compris pour le ghost courant.


## Acceptation rAF Safari — validée le 31 octobre

Dans Safari Technology Preview visible, le fixture réel des ponts Editor
[`tangent-editing.html`](../tests/browser/tangent-editing.html) a été joué de
0 à 5 s avec l’horloge rAF naturelle (`document.hidden === false`). Play/Pause
arrête la tête à 384 ms ; elle reste stable après 500 ms. Deux Seek au terminal
conservent la même pose et le même style de cadre ; Stop répété revient à 0 ;
le replay naturel atteint de nouveau 5 s. L’écart item/CS maximal observé est
0,207. Le fixture n’utilise pas la persistance SQLite.

## Preuves consolidées au 31 octobre

- Editor : **49 fichiers, 527 tests**, typecheck et build réussis ; avertissement
  de taille du bundle conservé. `git diff -- packages/codplay` est vide.
- CodPlay, suites ciblées existantes : **8 fichiers, 100 tests** réussis
  (composants, matérialisation, motion, média et parent/enfant/reparent).
- Safari, fixture item indépendante : **4 scénarios** avec/sans chemin et padding
  asymétrique, pose 5 s/bordure 2 s, taille courante indépendante ; Play/Seek,
  preview/clear, resize 800→640→800, fin et Seek répété, reset et destruction.
  Les valeurs CSS auteur de padding sont en cqw. Les deux scénarios path vérifient
  que la preview laisse le transform motion intact et que sa donnée privée
  n’entre pas dans le snapshot de base. Les 4 parcours restent validés via
  `engine.advance` ; Safari rapporte `document.hidden === true`.
- Safari, ponts Editor : rotation/pivot/resize/bordure/déplacement/insertion,
  couleur, Undo/Redo, rechargement JSON et Stop répété ; item/CS et ghosts courants < 0,59 px à
  1328 × 775, 1100 × 780 et 1024 × 775. Après rééquilibrage des rayons ACE,
  la scène initiale garde un raccord de 0,1074° et l’insertion tournée de 20°
  un raccord de 0,0681°, 0,0681° et 0,0701° aux trois viewports. Play rAF
  traverse le KF à chaque taille, page visible. Ces fixtures n’écrivent pas
  dans SQLite.
- Après retrait des identifiants périmés, Safari valide les parcours `editing`
  (17 contrôles) et `decor` (4 contrôles) dans le fixture des ponts Editor ; les
  ghosts exposés correspondent à la projection courante et l’écart item/CS
  maximal mesuré est 0,584 px.
- Safari, promotion après chargement : un KF décor est promu en pose, puis un
  document avec les mêmes IDs est chargé et la promotion est répétée. Le bridge
  repart du path du nouveau document ; preview et commit restent à moins de
  0,02 unité CSS d’écart.
- Safari, ghosts : chaque ghost des trois KFs pose de la fixture est vérifié à
  son temps auteur contre l’item présenté ; l’écart maximal est inférieur à
  0,21 unité CSS.
- Le bloc texte `Tangent test` de ce fixture reçoit aussi le centrage horizontal
  et vertical du décor initial ; Safari confirme ses styles calculés (`center`,
  `flex`, `center`, `center`) après rechargement et pendant le replay.
- La fixture de ponts comptait encore deux KFs pose dans ses assertions après
  l’ajout d’une troisième pose et d’un KF décor indépendant. Ses comptages sont
  alignés sur la scène réellement construite ; les seuils géométriques restent
  inchangés.

Les causes restent dans l’[audit](./notes/2026-10-30-editor-responsibility-audit.md).
Ce périmètre accepte les corrections ciblées, pas la refonte générale par
catalogue du builder Decor, dont le plan reste `A relire`. Le
[plan mouvement](./2026-09-02-motion-editor-v2-plan.md) conserve ses autres portes.

## Interpolation de propriétés CSS absentes à la source — appliqué et vérifié le 31 octobre

Les paires auteur déjà résolues continuent d'emprunter le tween ACE générique ;
le stress test vérifie `2cqw → 8cqw` et le snapshot à mi-parcours `5cqw`. Pour
un endpoint CSS absent, le builder émet une demande de mesure pour les seules
propriétés visées. Le bridge stage l'occurrence native avec le même owner,
seek chaque item concerné une fois à sa pose initiale, mesure l'élément réel,
puis compile la scène finale avec ces defaults transitoires. La cascade auteur
reste prioritaire ; aucune valeur mesurée n'est gardée entre compilations,
sérialisée ou ajoutée à l'état auteur. Le player CodPlay et ACE restent
l'unique circuit temporel ; aucun canal par propriété n'est créé. La palette
continue de lire le snapshot après `seekApplied`. Les longueurs auteur, palette
et sauvegarde restent en cqw. Aucun fichier CodPlay n'est modifié.

Le test builder vérifie la demande, l'action ACE `{ from: '0cqw', to: '8cqw' }`
et le snapshot à `4cqw`, sans densifier le décor source. Le test du bridge vérifie
la capture d'un défaut CSS fourni par classe d'application. Safari Technology
Preview exécute la vraie palette, le commit sparse au KF de `2 500 ms`, puis un
seek à `1 250 ms` : décor cible `8cqw`, décor source absent, snapshot et style
natif `4cqw`. Le contrat complet et ses limites sont dans la
[spécification d'interpolation](../specs/decor-style-interpolation-spec.md).

Au 31 octobre, la suite Editor passe à **49 fichiers, 525 tests** ; typecheck,
build Vite et `git diff --check` passent. La console Safari ne rapporte aucune
erreur ou alerte pendant le parcours. La mesure physique reste à la frontière
DOM et n'entre pas dans les données auteur, la palette ou la sauvegarde.
