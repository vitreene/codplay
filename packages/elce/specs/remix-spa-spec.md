# Elcé — entrée Remix SPA

## Statut

**En cours — routeur Remix, composition XState partagée, cycle de vie d’une vue abonnée et preuves temporaires Carte/Section vérifiées dans Safari le 7 octobre 2026 ; aucune surface auteur de production n’est encore portée hors du pont React.**

## Rôle

L’entrée Remix démarre le routeur navigateur de l’éditeur. Elle conserve temporairement les surfaces React déjà en place pendant leur portage progressif vers le runtime Remix. Le player Sighty/CodPlay reste à l’écart de ce portage et continue d’être lancé par le circuit de preview existant.

## Composition

- `app/remix/browser-entry.ts` compose l’unique acteur XState de l’éditeur, son store IndexedDB, l’attachement de persistance, `ProjectSyncCoordinator`, `ProjectEditorLock` et une instance de `EditorActionsFacade`, puis appelle `run()` et attend le rendu initial.
- L’acteur démarre suspendu. La persistance et la synchronisation sont attachées après acquisition du Web Lock du document ; seule la fenêtre propriétaire reçoit l’événement XState qui autorise les commandes.
- `app/remix/remix-spa-router.ts` définit les réponses d’interface avec le routeur Fetch client et le middleware `remix/spa`. `EditorContextProvider` place le même acteur et la même façade d’actions dans le Context Remix pour les surfaces auteur portées.
- Les routes retournent toutes `#elce-remix-route-root` avec le même hôte `ReactEditorTempBridge`. La preuve temporaire ajoute seulement sa vue comme sœur de cet hôte ; cette arborescence commune permet à `data-rmx-preserve-dom` de garder le DOM React lors de la navigation.
- `ReactEditorTempBridge` rend un hôte dédié portant `data-rmx-preserve-dom`. Le contenu de cet hôte appartient au renderer React tant que la migration des surfaces n’est pas achevée.
- `app/main.tsx` exporte `mountElceEditor(container, controller, actions)`. Il monte l’interface auteur React avec l’acteur et la façade fournis, ou le player de preview ; il ne crée ni acteur, façade ni store.
- `AppLayout` utilise `selectEditorViewModel(snapshot)` pour lire les valeurs dérivées et `EditorActionsFacade` pour les commandes ; les whitelists, événements DOM, état visuel des dépôts et autres gestes restent encore dans cette vue React jusqu’au découpage des surfaces.
- `app/remix/editor-lifecycle-proof-temp.ts` est une preuve temporaire, accessible sur `/?__remixProof=1`. Elle lit le contexte Remix, dérive le modèle depuis le snapshot XState, s’abonne après son rendu initial, appelle `handle.update()` aux changements et désabonne son acteur lorsque le signal du `Handle` est annulé. La route et le composant seront retirés après que les surfaces Carte et Section portées couvrent elles-mêmes ce cycle.
- `app/editor/card/remix-card-editor-proof-temp.ts` est une preuve temporaire, accessible sur `/?__remixCardProof=1`. Elle présente les Cartes directes de Diapo et les Cartes enfants de Carousel du document courant. Les deux utilisent `RemixCardEditorFields`, les champs/presets Carte et les règles partagées de média ; les commandes passent respectivement par `EditorActionsFacade.createCardEditorActions()` et `createCarouselEditorActions()`, qui délèguent à la façade Carte existante. Ce rendu de preuve ne remplace pas encore les surfaces de production React.
- `app/editor/section/remix-section-editor-proof-temp.ts` est une preuve temporaire, accessible sur `/?__remixSectionProof=1`. `SectionTiptapAdapter` monte `@tiptap/core` dans le cycle `ref` Remix ; la toolbar, le titre et l’édition de Carte ancrée sont rendus par Remix et ses mixins `on`. ProseMirror reste propriétaire du DOM WYSIWYG et des événements internes de dépôt/déplacement. Toutes les transactions continuent vers la même `EditorActionsFacade` et le même acteur XState ; aucune API React de Tiptap ou React n’est importée dans ce parcours.
- L’adaptateur conserve les NodeViews et l’instance ProseMirror lorsqu’un import média termine sans modifier le JSON de Section : les rappels enregistrés par les ancres relisent la source courante et rafraîchissent l’aperçu image/vidéo en place.
- Les vues de preuve ne sont montées que lorsque la route reçoit l’acteur et la façade auteur. Le player de preview peut conserver les paramètres de preuve dans son URL ; avec un acteur nul, le routeur ignore ces paramètres et laisse le montage du lecteur suivre son circuit habituel.
- `RemixCardEditorFields` rend les SVG de `lucide-static` sous forme d’éléments Remix natifs : `DOMParser` lit le SVG fourni par la bibliothèque, puis le helper crée les éléments SVG avec leurs attributs et leurs enfants. Il n’insère pas les chaînes d’icône dans le DOM par `innerHTML`.
- `server/api-router.ts` expose le routeur Fetch serveur séparé ; `createElceHttpServer()` l’assemble au dépôt SQLite, au FileStorage Remix et au listener local.

## Invariants

- La SPA compose un seul acteur XState ; le pont React reçoit cet acteur et le Context Remix conserve cette même référence. La migration ne crée pas de copie d’état éditorial ni de second circuit de commande.
- Les fenêtres de même origine se partagent un Web Lock par document. La fenêtre non propriétaire garde sa surface inert et restaure la cache IndexedDB partagée seulement après acquisition ; le contrat est détaillé dans la [spécification d’accès entre fenêtres](./editor-window-access-spec.md).
- La façade d’actions est assemblée une fois avec cet acteur ; les vues Remix et React appellent le même circuit XState. Le snapshot gardé par une vue Remix sert uniquement à son rendu et n’est pas une seconde source métier.
- L’hôte React est un raccord temporaire de rendu, pas une nouvelle voie d’état ni un contrat produit. Il sera supprimé après le portage de toutes les surfaces auteur prévu à l’étape 4 du plan Remix.
- Le routeur API reste distinct du routeur SPA. La SPA ne remplace pas le document XState par des réponses serveur.
- Les données et les scènes du player ne sont pas modifiées par ce montage.

## Preuves

- `src/server/api-router.test.ts` exerce le routeur Fetch isolé et son fallback HTTP.
- Safari sur `http://localhost:5175/` affiche l’éditeur restauré depuis IndexedDB et son éditeur Tiptap après déplacement de la composition dans `browser-entry.ts`. Après rechargement à froid, aucune erreur de console n’est présente.
- Safari Technology Preview confirme le verrou exclusif entre deux onglets, le transfert explicite par `BroadcastChannel`, l’état inert devant un verrou retenu et la reprise après rechargement ; aucun changement documentaire n’a été fait durant cet essai.
- [`editor-lifecycle-proof-temp.test.tsx`](../src/app/remix/editor-lifecycle-proof-temp.test.tsx) vérifie le rendu d’un changement de sélection et l’appel à `unsubscribe()` au démontage dans le runtime Remix.
- Safari MCP sur `/?__remixProof=1` vérifie que la vue Remix reçoit la création d’une page déclenchée dans l’interface React ; la suppression par l’interface remet le document d’essai à son état initial. Le lien de retour et l’historique SPA démontrent le démontage puis le remontage de la vue en conservant l’hôte React.
- [`remix-card-editor-proof-temp.test.tsx`](../src/app/editor/card/remix-card-editor-proof-temp.test.tsx) exerce les placements direct et Carousel avec le runtime Remix, modifie le titre et le message par les façades, vérifie les parents, teste le changement de preset sans perte et confirme la présence de l’icône SVG Lucide.
- [`remix-section-editor-proof-temp.test.tsx`](../src/app/editor/section/remix-section-editor-proof-temp.test.tsx) exerce dans le runtime Remix le titre, l’insertion de contenu, l’état actif H3/italique, la commande gras, le dépôt d’image jusqu’à la persistance, le rendu de l’aperçu et le déplacement natif d’ancre par XState. Il vérifie que la même instance Editor et le même DOM ProseMirror restent montés après chaque mise à jour.
- Safari MCP sur `/?__remixCardProof=1` confirme la présence simultanée d’une Carte directe et d’une Carte enfant, leur édition par les commandes réelles, la conservation des champs après changement de preset, le rendu des SVG Lucide et l’absence d’erreur console. Les pages créées pour ce contrôle ont été supprimées après vérification.
- Safari Technology Preview via MCP sur `/?__remixSectionProof=1` confirme l’édition Tiptap dans Remix. Le contrôle cible explicitement `#elce-remix-section-proof .ProseMirror` pour distinguer cette instance de celle de l’éditeur React temporaire. Le lien « Recharger la frame » navigue vers `&frame=2` en conservant exactement le même élément ; une seule instance ProseMirror reste dans la preuve Remix et la console ne signale aucune erreur. Aucun document de l’auteur n’a été modifié pendant cette vérification.
- [`remix-spa-router.test.ts`](../src/app/remix/remix-spa-router.test.ts) vérifie qu’un paramètre temporaire de preuve ne monte aucune vue auteur quand le routeur est créé sans acteur, comme dans le player popup. Safari MCP confirme que « Prévisualiser » ouvre bien « Lecture Elcé » malgré le paramètre de preuve conservé dans l’URL ; après rechargement froid, le lecteur réel s’affiche sans erreur de console.
- `npm run typecheck --prefix packages/elce`, `npm test --prefix packages/elce` (176 tests) et `npm run build --prefix packages/elce` passent. Le build produit un bundle minifié de 1,557.29 kB (446.26 kB gzip), encore avec l’avertissement Vite au-dessus de 500 kB pendant la cohabitation temporaire des runtimes.
