# Intégration du cycle de capture des sources dans le cœur

> Statut : A relire. La direction — déplacer le cycle de vie commun des
> captures source dans CodPlay core — répond à la demande du 2026-09-26. La
> forme du port et les divergences de comportement entre sources restent à
> décider avant toute modification du cœur.

## Autorité et périmètre

La [spécification capture](../specs/capture-v2-spec.md) fait autorité sur les
sessions, samples, actions live, événements de fin, visibilité, journal et
seek. La [spécification scroll-container](../specs/scroll-container-spec.md)
fait autorité sur la mesure DOM, les frontières `scroll`/`scrollend`, les
annulations de la source et son caractère optionnel.

Le plan porte uniquement sur l'intégration du cycle de vie source. La mesure
du scroll, les listeners DOM, les observers et la déclaration optionnelle
restent dans `authoring/component-v2`. Le cœur reçoit des règles compilées et
des samples typés ; il ne dépend pas de `Element`, d'`IntersectionObserver` ni
du module `scroll-container`.

La migration `cascade` vers `visibility` est déjà appliquée et certifiée dans
la spécification capture. Elle n'est pas rouverte par ce plan.

## Constat établi et preuves

- Le [contrôleur de capture du player](../src/runtime/player/runtime-player/capture-controller.ts)
  possède déjà les sessions, leur état, les actions live et le routage des
  sorties par le dispatcher commun.
- Le [port HTML source](../src/runtime/runner-html/source-adapter.ts) expose
  aujourd'hui `emit`, `beginCompiledCapture`, `trackCapture`, `endCapture` et
  `cancelCapture` aux adaptateurs optionnels.
- L'[adaptateur pointeur](../src/runtime/capture/sources/html-pointer-capture-source-adapter.ts)
  orchestre l'ouverture asynchrone, les événements en attente, le tracking,
  la fin et l'annulation autour du contrôleur commun.
- L'[adaptateur scroll](../../authoring/component-v2/src/scroll-container/scroll-container-source-adapter.ts)
  possède une seconde orchestration de cette séquence avec `CaptureActivity`,
  `pendingSamples` et les mêmes commandes du port.
- Les tests de l'[adaptateur pointeur](../tests/runtime/capture/html-pointer-capture-source-adapter.spec.ts)
  couvrent l'ordre des samples en attente, le filtrage par pointeur, l'état
  final et le teardown. Le test de portée scroll
  [scroll-container-capture-visibility.spec.ts](../../authoring/component-v2/tests/scroll-container-capture-visibility.spec.ts)
  vérifie actuellement le routage de l'événement de départ ; il ne couvre pas
  tout le cycle scroll.

Le doublon est donc dans l'orchestration des sources. Le stockage des sessions,
les mises à jour live, le journal et le dispatcher restent communs aujourd'hui.

## Direction proposée

Créer dans le cœur un contrôleur source de capture partagé, possédé par le
player/runner et accessible aux adaptateurs par un port borné de haut niveau.
Une source lui transmet la règle compilée, la cible de story, les métadonnées
source et les commandes `track`, `end` ou `cancel`. Le contrôleur prend en
charge l'ouverture via l'event déclaré et `RuntimePlayer.emit()`, la création
de session compilée, l'identifiant, la file des samples reçus pendant
l'ouverture, puis la fin ou l'annulation. Les effets de capture continuent de
passer par `RuntimePlayerCaptureController` et le dispatcher existants.

Le pointeur et le scroll consomment ce même cycle. Ils gardent uniquement la
détection de leurs frontières natives et la conversion en samples. La factory
scroll reste optionnelle et ne devient pas un composant du catalogue core.
L'adaptateur ne peut ni écrire directement dans l'état live ni créer un
journal, un dispatcher ou un contrôleur de capture parallèle.

La forme exacte du port reste `A relire` avant implémentation. Le contrat visé
doit permettre de soumettre des samples et une fin pendant que l'event de
départ est encore en attente, sans perdre leur ordre ; l'annulation doit
empêcher une ouverture tardive après un seek ou un teardown.

## Décisions préalables à la mise en œuvre

1. **API du port source.** Décider si le runner fournit un handle de session
   (`start`/`track`/`end`/`cancel`) ou une surface équivalente. Le port ne
   transmet pas `RuntimePlayer` brut et n'expose pas les détails internes du
   `CaptureController`.
2. **Échec de l'event de départ.** Le scroll annule l'ouverture si `emit`
   échoue ; l'adaptateur pointeur signale actuellement l'échec puis poursuit
   l'ouverture. Choisir et spécifier une sémantique commune avant de refactorer.
3. **Propriété des sessions en attente.** Le cœur doit suivre aussi bien les
   ouvertures asynchrones que les captures déjà ouvertes, et les annuler au
   seek, à `sequence:end` et à la destruction. Définir l'ordonnancement avec
   les hooks existants du `HtmlPlayerRunner`.
4. **Données de fin.** Préserver les métadonnées propres à chaque source et la
   surcharge d'état final utilisée par l'adaptateur pointeur ; le scroll
   conserve ses métadonnées `scroll`/`scrollend`.

Ces points sont `A relire` et bloquent toute modification de `packages/codplay`
tant que le contrat de l'intégration n'est pas accepté.

## Étapes et preuves attendues

1. **Valider le contrat du contrôleur source.** Décider les quatre points
   ci-dessus et définir le propriétaire de l'annulation avant de modifier le
   code.
2. **Implémenter le contrôleur commun dans le cœur.** Réutiliser la résolution
   `visibility`, le dispatcher, `RuntimePlayerCaptureController` et les hooks
   de cycle de vie existants. Ne pas ajouter de stockage d'état ou de route
   événementielle parallèle.
3. **Raccorder les deux sources.** Faire utiliser le nouveau port par les
   adaptateurs pointeur et scroll. Retirer les files, états d'ouverture et
   opérations capture dupliqués de l'adaptateur scroll. Conserver dans chaque
   adaptateur uniquement la reconnaissance des événements natifs, le
   filtrage propre à la source et la conversion en sample.
4. **Tester le cycle partagé.** Couvrir l'ordre de la file d'ouverture, les
   soumissions multiples, une fin pendant l'ouverture, un échec d'ouverture,
   une annulation en attente, les erreurs de tracking, la fin unique et le
   teardown. Vérifier les invariants du pointeur : appariement `pointerId`,
   events `trackOn`/`endOn`, état final et callbacks de preview.
5. **Tester scroll sur le chemin réel.** Faire traverser à la fixture la
   factory optionnelle, le runner, le player et le journal : premier sample,
   samples ordonnés, `scrollend`, `endEmit`, `endCapture`, actions live, seek,
   `sequence:end` et destruction. Vérifier les cibles implicite, `story`,
   `scene` et `public`.
6. **Valider l'intégration visible.** Rejouer la démo
   [`scroll-container`](../../demos/src/v2/demos/scroll-container/main.ts)
   dans le navigateur visible et vérifier progress live, fermeture unique,
   journal, replay/seek et teardown. La démo reste une fixture et ne reçoit
   aucune logique qui compense le runtime.
7. **Mettre les contrats à jour après preuve.** Étendre les spécifications
   capture et scroll uniquement avec les comportements vérifiés, mettre à jour
   la carte de fonctionnement et retirer ce plan lorsque toute décision et
   validation résiduelle est close.

## Critères de clôture

- Un seul contrôleur du cœur coordonne l'ouverture, la file de samples, le
  tracking, la fin et l'annulation des captures déclenchées par une source.
- Les adaptateurs pointeur et scroll ne contiennent plus de seconde
  orchestration du cycle de capture.
- Seek, `sequence:end`, destruction et erreur ne peuvent laisser une ouverture
  pendante ni produire un event de fin après annulation.
- La capture scroll réelle conserve ses sorties, ses cibles `visibility`, ses
  actions live et le journal certifiés.
- Les tests ciblés et suites concernées, typechecks CodPlay/component-v2/démos,
  build des démos et parcours navigateur requis passent. Les preuves sont
  consignées dans les spécifications et le plan n'a plus de décision ouverte.
