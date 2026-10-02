# Plan — enregistrement des observations de scroll

**Statut : En cours.** `ScrollContainerComponent` possède les observers
`IntersectionObserver` de `emit.observe` et leur cycle de vie. Le comportement
reste enregistré par le composant, le module et la capacité scroll-container.

## Travail

- Déplacer la résolution des cibles, la création et le cycle de vie des
  observers dans `ScrollContainerComponent`.
- Retirer `CodPlayOptions.htmlHost`, `sourceAdapterFactories` et leurs usages.
- Émettre les events et actions live par les circuits player communs existants.
- Couvrir Play, Seek, reset, fin de séquence et destruction.
- Mettre à jour la spécification après implémentation et validations.

## Décision acceptée — observation initiale déclarative

Le premier callback `IntersectionObserver` continue de synchroniser la phase
sans produire d’événement par défaut. Une déclaration peut demander une sortie
initiale explicite avec `initial: 'enter'` ou `initial: 'leave'` : l’événement
correspondant n’est produit que si la première mesure est dans la phase
correspondante. Cette option reste portée par `emit.observe` et suit le même
circuit CodPlay que les transitions ultérieures. Elle permet à une page dont le
repère bas est déjà visible de signaler son achèvement sans lecture DOM ni
dispatch local dans l’application Elcé.

L’acceptation exige la couverture du type auteur, de la compilation, de la
validation JSON, du provider, de l’adaptateur HTML et du parcours Elcé/Sighty.

**État de cette décision :** appliquée et vérifiée par les suites
`codplay` (711 tests), `component-v2` (50 tests) et `elce` (31 tests), avec les
typechecks correspondants. Le parcours Safari Elcé confirme le routage du
repère après un défilement long ; le cas initial est exercé par le test de
composition avec le vrai adapter CodPlay et son ticker contrôlé.

## Point technique à résoudre avant le code

Le composant reçoit son node matérialisé, les actions compilées et le port de
capture. Il ne reçoit pas aujourd’hui les ports d’émission d’events ordinaires
et d’actions live. Raccorder le composant aux circuits player existants avant
tout changement de contrat ; aucun chemin parallèle.

## Régression de reset — 2026-09-30

Le reset remet à l'origine le scrollport via `ScrollContainerComponent.onReset()`,
mais `HtmlPlayerRunner` ne notifie pas les sources HTML et l'adaptateur conserve
les phases IntersectionObserver de la présentation précédente. Au premier
callback après reset, une image maintenant visible peut donc produire un faux
`enter` au lieu de synchroniser sa phase ; les valeurs live des titres doivent
également être rafraîchies depuis la nouvelle géométrie.

**Correction acceptée pour cette régression :** ajouter une notification de
reset au cycle existant des sources HTML. Après le reset des composants,
l'adaptateur réutilise ses bindings et racines initiaux, renouvelle les
observers et efface les phases ainsi que les actions live obsolètes. Il
invalide aussi les callbacks natifs en attente, conserve les règles `once` déjà
consommées et continue d'émettre les actions/events par les ports player
existants.

**Acceptation :** un test d'intégration avec `HtmlPlayerRunner` et des callbacks
IntersectionObserver contrôlés vérifie qu'après un reset une cible visible
synchronise sa phase sans event, qu'une cible quittée puis réadmise anime à la
transition suivante, et que le ratio du titre met encore à jour son action live.
Les suites complètes passent : 49 tests `component-v2` et 711 tests `codplay` ;
les typechecks `codplay`, `component-v2` et `demos`, ainsi que le build V2 des
démos, passent. Le parcours navigateur Sighty reste à valider : Firefox
headless échoue au préchargement d'une ressource Sighty ; Safari WebDriver
requiert un mot de passe administrateur pour `safaridriver --enable`.

## Régression visuelle du titre — 2026-09-30

`liveAction` reçoit le ratio natif de la cible. Le titre observé ne faisant
qu'une ligne, ce ratio parcourt `0 → 1` sur la hauteur du titre et condense le
changement de couleur en quelques pixels. Le comportement demandé est une
transition de son apparition jusqu'à environ 50 % de la hauteur du scrollport.

**Correction acceptée :** conserver le circuit `emit.observe`, ses seuils et
le ratio natif, mais observer un parent sticky haut de 50 % du scrollport. Le
texte garde son cartouche normal ; le parent sert uniquement de surface
géométrique à l'observer. Les actions restent dans la scène Sighty, sans
nouvelle sémantique runtime ni changement de spécification.

**Acceptation :** le ratio doit évoluer de 0 à 1 pendant le déplacement du
titre sur la moitié du scrollport ; la hauteur du cartouche, son stickiness,
la mise en page des paragraphes et les animations d'image restent inchangés.
Firefox, avec le CSS construit et un scrollport de 400 px, mesure la cible à
199 px : elle passe de ratio 0 à 0,99 au `scrollTop` 200, avec le titre au
milieu du scrollport. Le paragraphe commence juste sous le cartouche et le
sticky reste en place au défilement suivant. Le parcours complet Sighty reste
à valider : Firefox échoue au préchargement d'une ressource média et Safari
WebDriver requiert un mot de passe administrateur. Le typecheck et le build V2
des démos passent.

## Acceptation

- Aucun champ public `htmlHost` ni factory parallèle dans la façade ou le
  runner.
- Tests du composant et de l’intégration couvrant observations, Play, Seek,
  reset et destruction.
- Parcours navigateur des démos scroll-container et Sighty, typechecks et build.
