# Elcé — entrée Remix SPA

## Statut

**En cours — routeur Remix et composition XState partagée vérifiés dans Safari le 7 octobre 2026 ; aucune surface auteur n’est encore portée hors du pont React.**

## Rôle

L’entrée Remix démarre le routeur navigateur de l’éditeur. Elle conserve temporairement les surfaces React déjà en place pendant leur portage progressif vers le runtime Remix. Le player Sighty/CodPlay reste à l’écart de ce portage et continue d’être lancé par le circuit de preview existant.

## Composition

- `app/remix/browser-entry.ts` compose l’unique acteur XState de l’éditeur, son store IndexedDB et l’attachement de persistance, puis appelle `run()` et attend le rendu initial.
- `app/remix/remix-spa-router.ts` définit les réponses d’interface avec le routeur Fetch client et le middleware `remix/spa`. `ElceSpaRoot` place le même acteur dans le Context Remix pour les surfaces auteur qui seront portées.
- `ReactEditorTempBridge` rend un hôte dédié portant `data-rmx-preserve-dom`. Le contenu de cet hôte appartient au renderer React tant que la migration des surfaces n’est pas achevée.
- `app/main.tsx` exporte `mountElceEditor(container, controller)`. Il monte l’interface auteur React avec l’acteur fourni ou le player de preview ; il ne crée ni acteur ni store.
- `server/api-router.ts` crée le routeur Fetch serveur distinct. Il ne possède encore aucun endpoint et aucun listener serveur n’est lancé ; routes et serveur arriveront avec les étapes SQLite et médias.

## Invariants

- La SPA compose un seul acteur XState ; le pont React reçoit cet acteur et le Context Remix conserve cette même référence. La migration ne crée pas de copie d’état éditorial ni de second circuit de commande.
- L’hôte React est un raccord temporaire de rendu, pas une nouvelle voie d’état ni un contrat produit. Il sera supprimé après le portage de toutes les surfaces auteur prévu à l’étape 4 du plan Remix.
- Le routeur API reste distinct du routeur SPA. La SPA ne remplace pas le document XState par des réponses serveur.
- Les données et les scènes du player ne sont pas modifiées par ce montage.

## Preuves

- `src/server/api-router.test.ts` exerce le routeur Fetch isolé et son fallback HTTP.
- Safari sur `http://localhost:5175/` affiche l’éditeur restauré depuis IndexedDB et son éditeur Tiptap après déplacement de la composition dans `browser-entry.ts`. Après rechargement à froid, aucune erreur de console n’est présente.
- `npm run typecheck --workspace=@codplay/elce`, `npm test --workspace=@codplay/elce` (164 tests) et `npm run build --workspace=@codplay/elce` passent. Le build émet encore un avertissement de chunk supérieur à 500 kB pendant la cohabitation temporaire des deux runtimes.
