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
| Dépendances de compilation du sanitizer markup et des services | Restructurées le 2026-08-24 : sanitizer dans `scene/validation`, contrats de binding dans `services`, adapters HTML dans `runtime/runner` | profils de compilation et services indépendants d'HTML |
| Surface typée entre modules runtime et composants | Fixée le 2026-08-24 : registre de surfaces déclaré par le catalogue, résolveur typé dans le contexte module, aucune classe exposée | nouvelles surfaces à ajouter à la map de contrats |

Les marqueurs `Review: required` restants concernent uniquement des extensions non
engagées : renderer continu, defaults de couleur, composants hybrides, et contrat
`Behavior/live`. La tranche `img`/`input`/`polygon` et le materializer SVG DOM
sont maintenant ouverts par le plan de portage dédié.

## Restructuration des frontières — direction validée le 2026-08-24

La tranche de restructuration conserve exactement la sémantique HTML actuelle et
ne crée aucun nouveau materializer. Elle corrige uniquement la direction des
imports :

```text
services
  -> contrats de validation et contrats de binding runtime sans import runtime

scene/validation
  -> sanitation compilée du markup et validation des données

runtime/catalog et runtime/runner
  -> assemblage des contrats et définitions/adapters HTML
```

Décisions d'implémentation :

- `MarkupAttributeSanitizer` reste un contrat de service ; l'algorithme de
  sanitation du template est déplacé dans `scene/validation` car il intervient
  avant la création du `CompiledScene`.
- Les types `RuntimeComponentService*` sont définis dans la couche services,
  sans dépendre de `RuntimeCapabilityCatalog`.
- Les définitions `HTML_*_SERVICE` sont des bindings runtime HTML et sont
  enregistrées depuis `runtime/runner`; les déclarations pures restent dans
  `src/services`.
- `runtime/capabilities/markup` conserve uniquement l'état de parts/outlets et
  la materialization runtime ; il ne possède plus le sanitizer de compilation.

La preuve d'acceptation est : aucune importation `src/services -> src/runtime`,
aucune importation `src/scene -> src/runtime/capabilities`, même snapshot de
validation, même sortie compilée, et tests/typecheck/builds V2 inchangés au
plan comportemental.

## Registre des surfaces de composants — direction validée le 2026-08-24

Les modules runtime ne récupèrent plus un composant par identifiant sous la
forme `unknown`. Chaque déclaration de composant peut publier des surfaces
opérationnelles dans la `RuntimeComponentSurfaceMap`; le
`RuntimeComponentRuntime` les conserve avec l'instance montée et expose au
contexte module un `RuntimeComponentSurfaceResolver`.

La première surface est `media`. Elle est typée par les opérations dont
`media-sync` a besoin (`seekTo`, `play`, `pause`, `stopAt`, lecture de position,
durée et état de pause, avec fenêtre, transition et rate optionnels). Le
catalogue core relie explicitement la déclaration `media` à cette surface. Le
module ne dépend donc ni de `BaseComponent`, ni de `MediaComponent`, ni d'une
inspection de méthodes à l'exécution.

Invariants :

- le resolver est player-local et reste valide avant et après le mount initial ;
- une surface absente renvoie `undefined` et ne déclenche aucun fallback par
  duck typing ;
- le provider de surface appartient à la déclaration du composant, pas au
  module qui la consomme ;
- une nouvelle famille de surfaces ajoute un contrat typé à la map et son
  provider, sans élargir le contexte module à une classe concrète.

La preuve d'acceptation est : aucune occurrence de `getComponentById` dans le
contexte module ou `media-sync`, aucun cast `unknown as MediaSyncRuntimeComponent`
pour résoudre une surface, tests de la registry et de `media-sync` verts, et
validation typecheck/build V2 inchangée.

## Utilitaires partagés — direction validée le 2026-08-24

Les fonctions communes sont regroupées par contrat dans `src/shared`, avec des
sous-dossiers spécialisés et des exports explicites :

- `values` pour le clonage récursif de valeurs JSON-like ;
- `ordering` pour la comparaison lexicographique des chemins numériques ;
- `numbers` pour les gardes numériques sans effet de bord.

Les consommateurs conservent leurs types métier et délèguent uniquement
l'algorithme commun. Les lectures d'événements pointeur et les parseurs de
matrices HTML restent dans leurs domaines tant que leurs contrats ou leurs
formats diffèrent ; ils ne sont pas fusionnés dans un dossier utilitaire
global.

La preuve d'acceptation est : chaque algorithme retenu n'a plus qu'une
implémentation, les tests de parité couvrent les cas limites, les imports
restent orientés vers `shared` sans dépendance inverse et les tests/typecheck
V2 restent verts.

## Découpage des points chauds — direction validée le 2026-08-24

La restructuration des quatre points chauds identifiés est une opération
interne de maintenance V2. Elle ne modifie ni le circuit d'exécution, ni les
contrats publics, ni les invariants de la tranche HTML.

Les façades publiques restent stables :

- `RuntimePlayer` conserve son entrée depuis `runtime/player` ;
- `HtmlMotionPresentationHost` et `HtmlListDndPreview` conservent leurs
  imports depuis `runtime/runner` ;
- `createMediaSyncModuleService` conserve sa factory et sa surface typée.

Les responsabilités sont réparties par domaine :

- `runtime/player/capture`, `runtime/player/modules`,
  `runtime/player/scene` et `runtime/player/diagnostics` portent les sous-
  domaines du player sans créer un second player ou un second journal ;
- `runtime/runner/html-motion-presentation` sépare les ressources d'overlay,
  les transformations et l'orchestration de présentation ;
- `runtime/runner/html-list-dnd-preview` sépare les types, la géométrie, les
  effets transitoires et le contrôleur de preview ;
- `runtime/capabilities/media-sync` sépare l'état, la lecture des broadcasts
  et la synchronisation de lecture, sous une seule factory player-scoped.

Invariants de réalisation :

- un déplacement de fichier ne constitue pas une nouvelle frontière runtime ;
- les façades peuvent réexporter les implémentations internes, mais aucun
  chemin parallèle ne doit être introduit ;
- chaque module spécialisé conserve un seul rôle et ne devient pas un dossier
  `utils` générique ;
- les helpers de pointeur et les parseurs de matrices restent dans leur domaine
  tant que leurs contrats diffèrent ;
- les tests continuent de traverser les entrées publiques existantes et
  valident le même circuit Play, Seek, capture, materialization et lifecycle.

La preuve d'acceptation est : les imports publics existants restent valides,
les responsabilités sont localisées dans les dossiers correspondants, aucune
classe ou service concurrent n'est créé, et les tests, le typecheck, les
builds V2 ainsi que `git diff --check` restent verts.

Vérification du découpage le 2026-08-24 : `npm run test
--workspace=@codplay/codplay-v2` passe avec 69 fichiers et 418 tests ; le
typecheck, `build:runner`, `build:player` et `git diff --check` passent.
