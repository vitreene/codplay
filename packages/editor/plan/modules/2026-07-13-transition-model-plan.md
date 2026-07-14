# Plan — modèle de transitions complet (nommée / décor / Sustain)

Périmètre : implémente `../2026-06-11-sequence-editor-grid-spec.md` §2.2 (section transitions, réécrite ce jour) — le modèle normatif est là-bas, ce document ne fait qu'organiser sa construction. Trois chantiers distincts, chacun peut être livré et vérifié indépendamment ; ordre proposé, pas obligatoire.

**Régression identifiée à l'origine de ce chantier** : `CLIP.DRAW_END` (`sequence-editor/machine.ts`) matérialisait autrefois une transition nommée (`{kind:'named', name:'fade', durationMs}`) sur les kf `intro`/`outro` à la fin d'un tracé de clip. La réécriture de cette session (migration modèle plat + architecture par émission) a perdu cette écriture — `createNamedKeyframe` ne pose plus que `{id, timeMs, name}`, jamais de transition. Ce plan ne se contente pas de la restaurer telle quelle : l'ancien code écrivait `transitionOut` pour intro ET outro (contredit la règle « intro n'a que transitionIn », maintenant explicite dans le spec) — donc reconstruction correcte, pas un retour en arrière.

---

## Chantier 1 — Résolution de timing correcte (Builder), déclenché par les transitions nommées et raccourcies

Déjà investigué en détail cette session (voir `/Users/Rve/.claude/plans/flickering-fluttering-cake.md`, conservé comme référence technique) : `capsule-automation/src/core/resolve-events.ts` déclenche toujours l'action intro en avant depuis `childRange.startMs`, jamais en la faisant se terminer AU kf. Le mécanisme lui-même (dans `capsule-automation`) est correct et cohérent — c'est `build-scene.ts` qui doit lui fournir la bonne borne.

**Fichiers** :
- `packages/editor/src/builder/build-scene.ts`, `resolveCapsule()` : `lockedIntroMs = (kf.timeMs + preRollMs) − (transitionIn?.durationMs ?? 0)` ; `lockedOutroMs = kf.timeMs + preRollMs` (jamais de soustraction côté outro — §2.2). `preRollMs` = `max(0, max sur tous les items de transitionIn.durationMs du premier kf)`, calculé une fois par `buildSceneDoc()`, retourné dans `BuildSceneResult`.
- `packages/editor/src/app/bridges/scene-player-bridge.ts` : `player.seek({timelineMs: timelineMs + preRollMs})`, valeur mise en cache à chaque `rebuild()` réussi.
- **Nouveau, propre à ce chantier (pas dans le plan précédent)** : la transition d'état de décor raccourcie (`kind:'interpolated'`, `direction`) doit aussi influencer le déclenchement — une transition avec `direction:'before'` doit se terminer AU kf destination (même logique de recul que pour `transitionIn` nommée) ; `direction:'after'` (défaut) garde le comportement historique (débute au kf source, inchangé).

**Tests** : `build-scene.spec.ts` — cas déjà identifiés (kf à t=0 avec transitionIn, préroll multi-items, capsule imbriquée) + nouveau cas `direction:'before'` sur une transition interpolée.

## Chantier 2 — Matérialisation de la transition nommée (restaure + corrige la régression)

**Fichiers** :
- `sequence-editor/commands.ts` : `setTransitionIn`/`setTransitionOut` existent déjà (purs setters) — vérifier qu'ils appliquent la règle d'exclusivité intro/outro (un kf `intro` ne peut recevoir que `transitionIn`, refuser/no-op sinon plutôt que d'accepter silencieusement une donnée invalide).
- `sequence-editor/machine.ts`, `CLIP.DRAW_END` (~L766-796) : après `createNamedKeyframe` pour intro/outro, ajouter les commandes `setTransitionIn`/`setTransitionOut` correspondantes avec un preset par défaut (à définir — voir point ouvert ci-dessous) plutôt que la mutation locale de l'ancien code (cohérent avec l'architecture par émission déjà en place, commandes explicites, pas de mutation de tableau).
- **Point ouvert, à trancher avant d'écrire le code** : quel preset/durée par défaut à la matérialisation automatique ? L'ancien code codait `fade` en dur. Le Builder respecte Principe B (pas de défaut inventé) — un défaut posé ICI, dans `sequence-editor` (côté éditeur, pas Builder), est-il légitime comme « réglage d'auteur implicite au geste » (comme `TIME_STEP_MS`/`DEFAULT_TRANSITION_DURATION_MS` déjà dans `constants.ts`, §1.6 du spec), ou doit-il rester absent tant que l'auteur ne choisit pas explicitement un preset dans un panneau dédié (pas encore construit) ?

## Chantier 3 — Fusion aux bords de capsule (presets `capsule-automation`)

**Fichiers** :
- `packages/authoring/capsule-automation/src/config/capsule-types.ts` ou nouveau champ de comportement : un enfant en première/dernière position d'une capsule qui a elle-même une transition d'entrée/sortie voit SA transition passer à `cut`. Mécanisme exact (preset par type de capsule vs. règle générique déclarative) à concevoir — lecture de `resolve-events.ts`/`resolve-placement.ts` nécessaire avant de coder (même rigueur que Chantier 1 : tracer le mécanisme réel, ne pas supposer).
- Package partagé, hors `packages/codplay` mais avec d'autres consommateurs (`packages/demos`) — changement à valider pour ne rien casser côté ces autres appelants.

## Chantier 4 — Rendu

**Fichiers** :
- `sequence-editor/render/track-row.ts` : remplacer la bande rectangulaire (`seq-row__transition`, construite plus tôt cette session) par un triangle (rampe) + surface reliant l'extrémité de la transition au kf — géométrie exacte à concevoir (pas de trace de l'original dans ce dépôt, reconstruction depuis la description).
- Nouvelle représentation pour `Sustain` (pas encore de rendu du tout — à concevoir : probablement une bande sur toute sa portée `fromKeyframeId`→`toKeyframeId`, visuellement distincte d'une transition de décor puisque ce n'est pas un état de décor).
- Dépend du Chantier « marge de rendu » déjà validé (`/Users/Rve/.claude/plans/flickering-fluttering-cake.md`, Gap C) pour la cohérence géométrique globale (`geometry.ts` partagé) — à faire avant ou en même temps, pas après (le triangle a les mêmes problèmes de bord que le losange).

## Chantier 5 — `Sustain` (modèle + commandes + Builder)

Le plus gros morceau, notion neuve. Pas détaillé ici en profondeur — nécessite son propre passage de conception (types exacts dans `app/commands/types.ts` vs `sequence-editor/types.ts`, commandes `sequence-editor/commands.ts`, résolution Builder vers Codplay). À ouvrir comme chantier séparé une fois 1-4 stabilisés, pas en parallèle — trop de surface pour avancer à l'aveugle sur les cinq à la fois.

---

## Ordre proposé

1. Chantier 1 (timing Builder) — le plus contraint/vérifiable par test, fondation des autres.
2. Chantier 4, partie « marge de rendu » seule (déjà spécifiée dans le plan précédent) — indépendant, débloque une vraie vérification visuelle live pour la suite.
3. Chantier 2 (matérialisation) — dépend de la réponse au point ouvert (preset par défaut).
4. Chantier 4, partie triangle — dépend de 1+2 pour avoir de vraies données à dessiner.
5. Chantier 3 (fusion aux bords) — indépendant des autres, peut se faire à tout moment mais touche un package partagé, prudence.
6. Chantier 5 (Sustain) — en dernier, conception propre séparée.

Chaque étape vérifiée (tests + rendu Safari) avant la suivante — pas d'avancée groupée.
