# Revue priorité 0 — contrats V2

> Status: Fixe
> CodPlay version: V2 foundation
> Date de revue: 2026-08-20

## Objet

Cette revue fige les contrats V2 déjà implémentés et testés. Elle ne clôt pas
CodPlay V2 et n'ouvre aucune compatibilité avec un autre runtime.

Le gel porte uniquement sur les tranches délimitées ci-dessous. Une capacité
explicitement ouverte reste hors contrat tant qu'une spécification et une
verticale de test ne l'ont pas ouverte.

## Contrats gelés

| Domaine | Contrat gelé | Preuve actuelle |
|---|---|---|
| CompiledScene | enveloppe versionnée, données compilées distinctes de l'auteur, références de fonctions externes, requirements, racines candidates et codec JSON structurel | tests `tests/scene/compiled/` |
| Validation | catalogue projeté depuis les déclarations runtime, guards ordonnés, diagnostics structurés et sanitation structurelle | tests `tests/scene/validation/` |
| Engine / Player | player alimenté par un `CompiledScene`, lifecycle, horloge injectée, seek local et seek groupé par phases `validate → prepare → commit → present` | tests `tests/runtime/engine/` et `tests/runtime/player/runtime-player.spec.ts` |
| Pipeline runtime | `emit → journal → materialize → resolve → solve`, ordre déterministe, straps séquentiels, sorties planifiées bornées et relecture sans réexécution | tests `listen`, `runtime-event-dispatcher`, `strap-*`, `pipeline` |
| Move / List | graphe structurel immuable, targets opaques, ordre complet par target, deltas `mount/unmount/move`, modes d'ordre, politiques V1 `reorderOnMove/Add/Remove` et détachement des descendants | tests `move-state`, `presentation-graph`, `pipeline`, `runtime-player` |
| Motion | graphe temporel par item, FIRST/LAST exacts, modes `local` et `reparent`, retargeting continu au chevauchement, résolution absolue sans historique de DOM | tests `tests/runtime/motion/` |
| Runner HTML | même circuit pour Play et Seek, host de mesure isolé, materialisation locale/reparent, overlays hiérarchiques, resize ; persistance des materialisations auteur jusqu'au teardown final | `tests/runtime/runner/html-player-runner.spec.ts` et démo runner |

## Limites volontairement ouvertes

Ces limites ne sont pas des ambiguïtés du contrat gelé : elles constituent les
prochaines tranches V2.

- migrations de schema et extensions de validation portées par les services ;
- renderer de production et materializer DOM/SVG final ;
- familles de composants supplémentaires et JSX V2.5 ;
- annulation et générations obsolètes des straps asynchrones ;
- contrat `live`, renderer continu et composition additive des tweens ;
- canal authoring ; la capture continue et la capacité list/DnD sont clôturées
  pour la tranche de validation V2 ;
- bindings tiers ; la tranche V2 `media-sync`/preload est implémentée et le
  composant V2 `media` conserve sa persistance `node-per-src` ;
- `Replace`, diffusion et broadcast.

## Règle de statut après revue

- `Fixe` signifie que le contrat de la tranche est stable ; cela n'implique pas
  que toutes les extensions soient implémentées.
- `En cours` signifie qu'une extension de contrat ou une capacité nécessaire
  reste à construire.
- `A relire` ne doit pas rester sur une décision déjà utilisée par une tranche
  active et validée. Il peut rester sur une décision future dont l'implémentation
  n'est pas engagée et qui doit être relue avant son ouverture.

## Validation de la revue

La revue est considérée comme vérifiée lorsque les commandes V2 suivantes
restent vertes :

```text
npm run test --workspace=@codplay/codplay-v2
npm run typecheck --workspace=@codplay/codplay-v2
npm run build:runner --workspace=@codplay/codplay-v2
```

Vérification actualisée le 2026-08-24 : les tests V2, le typecheck et les builds
des démos runner/player passent ; `git diff --check` est propre.

## Relecture de cohérence documentaire — 2026-08-24

La séparation `BaseComponent`/`BaseHTMLComponent` et la migration de la tranche
HTML ont été relues contre le code et les tests V2. Les documents qui décrivaient
encore `render()` ou les services HTML sur `BaseComponent` ont été corrigés. Le
contrat suivant est maintenant fixe pour la tranche actuelle :

```text
BaseComponent
  -> perso + update(state, timeMs)

BaseHTMLComponent
  -> BaseComponent
  -> render() + services HTML + racines/parts materialisées
```

Les décisions suivantes restent ouvertes et bloquent uniquement l'ouverture des
extensions correspondantes :

| Décision | État | Ouverture bloquée |
|---|---|---|
| Factory/catalogue réellement indépendant du substrate HTML | À spécifier avant une factory Canvas, Three.js ou Rive ; le catalogue actuel reste la tranche HTML | materializers et familles de composants non HTML |
| Dépendances de compilation du sanitizer markup et des services | À traiter avant une généralisation de la frontière scene/services/runtime | compilation ou services indépendants du markup HTML |
| Surface typée entre modules runtime et composants | À spécifier avant d'ajouter des capabilities qui récupèrent des composants par identifiant | nouvelles capabilities transversales |

Les marqueurs `Review: required` restants concernent uniquement des extensions non
engagées : renderer continu, defaults de couleur, `InputComponent`, composants
hybrides, et contrat `Behavior/live`. Ils ne bloquent pas la tranche HTML relue.
