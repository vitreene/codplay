# Plan — clôture du runtime Sighty

## Statut

**En cours.** Les corrections de surface ci-dessous sont intégrées et vérifiées.
Le CSS auteur des scènes de diffusion est intégré ; deux décisions runtime restent ouvertes.

## Intégration vérifiée

- La vue de départ du graphe racine désigne la scène hôte par `view.scene` ;
  `runtime.layout` et `storyId` ont disparu.
- `scenario.actions` et `scenario.guards` portent les fonctions référencées par
  les vues. Les vues acceptent aussi les fonctions inline.
- `showMode` est défini dans le scénario ; le défaut runtime est `rewind`.
- `onPreloadWarning` a disparu de Sighty. Les erreurs runtime non bloquantes
  vont à `console.warn` ; les avertissements de preload restent dans le résultat
  du service preload.
- `runtime.styles` reçoit le CSS fourni par l’application et le transmet à
  `CodPlay.preload.css.set()` ; son application et son nettoyage sont testés.
- Une ressource de scène peut associer `{ sceneDoc, styleSheet }`. Sighty
  compile le document et installe le CSS sur `runtime.root` via le canal `@scope`
  existant, avant le montage ; une scène retirée libère son slot.

## Travail restant

- Valider l’action de portée héritée : une action de vue complète les actions
  événementielles descendantes qui n’en déclarent pas ; une action locale reste
  prioritaire. L’utiliser pour les routes de Demo 5. Acceptation : tests de
  résolution et parcours navigateur de la navigation du cours.
- Décider si une mutation peut remplacer `view.scene` sur la vue de départ ;
  la scène hôte doit alors être recréée, ou le patch refusé.
- Définir comment l’application reçoit le résultat de preload lorsque Sighty
  lance lui-même `preload.load()` ; ne pas réintroduire un callback Sighty.

## Acceptation réalisée

- `npm run typecheck --workspace=@codplay/sighty`
- `npm run typecheck --workspace=@codplay/demos`
- `npm run test --workspace=@codplay/sighty`
