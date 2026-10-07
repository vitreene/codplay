# Elcé — entrée Remix SPA

## Statut

**En cours — routeur Remix, composition XState partagée et cycle de vie d’une vue abonnée vérifiés dans Safari le 7 octobre 2026 ; aucune surface auteur de production n’est encore portée hors du pont React.**

## Rôle

L’entrée Remix démarre le routeur navigateur de l’éditeur. Elle conserve temporairement les surfaces React déjà en place pendant leur portage progressif vers le runtime Remix. Le player Sighty/CodPlay reste à l’écart de ce portage et continue d’être lancé par le circuit de preview existant.

## Composition

- `app/remix/browser-entry.ts` compose l’unique acteur XState de l’éditeur, son store IndexedDB, l’attachement de persistance et une instance de `EditorActionsFacade`, puis appelle `run()` et attend le rendu initial.
- `app/remix/remix-spa-router.ts` définit les réponses d’interface avec le routeur Fetch client et le middleware `remix/spa`. `EditorContextProvider` place le même acteur et la même façade d’actions dans le Context Remix pour les surfaces auteur portées.
- Les routes retournent toutes `#elce-remix-route-root` avec le même hôte `ReactEditorTempBridge`. La preuve temporaire ajoute seulement sa vue comme sœur de cet hôte ; cette arborescence commune permet à `data-rmx-preserve-dom` de garder le DOM React lors de la navigation.
- `ReactEditorTempBridge` rend un hôte dédié portant `data-rmx-preserve-dom`. Le contenu de cet hôte appartient au renderer React tant que la migration des surfaces n’est pas achevée.
- `app/main.tsx` exporte `mountElceEditor(container, controller, actions)`. Il monte l’interface auteur React avec l’acteur et la façade fournis, ou le player de preview ; il ne crée ni acteur, façade ni store.
- `AppLayout` utilise `selectEditorViewModel(snapshot)` pour lire les valeurs dérivées et `EditorActionsFacade` pour les commandes ; les whitelists, événements DOM, état visuel des dépôts et autres gestes restent encore dans cette vue React jusqu’au découpage des surfaces.
- `app/remix/editor-lifecycle-proof-temp.ts` est une preuve temporaire, accessible sur `/?__remixProof=1`. Elle lit le contexte Remix, dérive le modèle depuis le snapshot XState, s’abonne après son rendu initial, appelle `handle.update()` aux changements et désabonne son acteur lorsque le signal du `Handle` est annulé. La route et le composant seront retirés après que les surfaces Carte et Section portées couvrent elles-mêmes ce cycle.
- `server/api-router.ts` crée le routeur Fetch serveur distinct. Il ne possède encore aucun endpoint et aucun listener serveur n’est lancé ; routes et serveur arriveront avec les étapes SQLite et médias.

## Invariants

- La SPA compose un seul acteur XState ; le pont React reçoit cet acteur et le Context Remix conserve cette même référence. La migration ne crée pas de copie d’état éditorial ni de second circuit de commande.
- La façade d’actions est assemblée une fois avec cet acteur ; les vues Remix et React appellent le même circuit XState. Le snapshot gardé par une vue Remix sert uniquement à son rendu et n’est pas une seconde source métier.
- L’hôte React est un raccord temporaire de rendu, pas une nouvelle voie d’état ni un contrat produit. Il sera supprimé après le portage de toutes les surfaces auteur prévu à l’étape 4 du plan Remix.
- Le routeur API reste distinct du routeur SPA. La SPA ne remplace pas le document XState par des réponses serveur.
- Les données et les scènes du player ne sont pas modifiées par ce montage.

## Preuves

- `src/server/api-router.test.ts` exerce le routeur Fetch isolé et son fallback HTTP.
- Safari sur `http://localhost:5175/` affiche l’éditeur restauré depuis IndexedDB et son éditeur Tiptap après déplacement de la composition dans `browser-entry.ts`. Après rechargement à froid, aucune erreur de console n’est présente.
- [`editor-lifecycle-proof-temp.test.tsx`](../src/app/remix/editor-lifecycle-proof-temp.test.tsx) vérifie le rendu d’un changement de sélection et l’appel à `unsubscribe()` au démontage dans le runtime Remix.
- Safari MCP sur `/?__remixProof=1` vérifie que la vue Remix reçoit la création d’une page déclenchée dans l’interface React ; la suppression par l’interface remet le document d’essai à son état initial. Le lien de retour et l’historique SPA démontrent le démontage puis le remontage de la vue en conservant l’hôte React.
- `npm run typecheck --workspace=@codplay/elce`, `npm test --workspace=@codplay/elce` (169 tests) et `npm run build --workspace=@codplay/elce` passent. Le build produit un bundle minifié de 1,718.92 kB (496.65 kB gzip), avec l’avertissement Vite habituel au-dessus de 500 kB pendant la cohabitation temporaire des deux runtimes.
