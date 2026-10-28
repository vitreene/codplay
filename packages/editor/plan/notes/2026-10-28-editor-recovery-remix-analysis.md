# Éditeur — état retrouvé et adaptation au modèle technique Elcé

**Date : 28 octobre 2026.** Analyse du dépôt et contrôles exécutés depuis
`packages/editor`, sans modification des sources applicatives. Les propositions
sont à relire dans le [plan d’adaptation](../2026-10-28-editor-remix-history-plan.md) ;
elles ne constituent pas des contrats vérifiés.

## 1. Le point de reprise réel

Éditeur est une application auteur assemblée, encore présentée dans une interface
de validation. Son intégration CodPlay V2 est avancée mais ouverte.

| Domaine | État retrouvé | Référence |
| --- | --- | --- |
| Document | `EditorScene` appartient au contrôleur XState ; commandes pures et transactions constituent la voie d’écriture. | [Modèle](../app/2026-07-11-ed2-document-model.md), [façade](../../src/app/commands/facade.ts) |
| Timeline | Module autonome, commandes émises au centre, synchronisation post-commit ; le temps auteur reste possédé par `sequence-editor`. | [Contrat SE](../2026-06-11-sequence-editor-grid-spec.md), [organisation V2](../2026-09-01-editor-v2-organization-plan.md) |
| Décor et cadre | Palette, preview par snapshot V2, cadre de sélection et overlays raccordés ; commits par transactions centrales. | [Dedit](../2026-07-07-dedit-spec.md), [organisation V2](../2026-09-01-editor-v2-organization-plan.md) |
| Mouvement | KFs `pose`/`decor`, chemins, ghosts, capture sparse, rotation/pivot et copy-on-write présents ; P2/P2-D/P2-E/P4/P6 ouverts. | [Plan mouvement](../2026-09-02-motion-editor-v2-plan.md) |
| Builder Decor structuré | Proposition `A relire`, non engagée ; projection de `zone` différée. | [Plan builder](../2026-09-04-decor-builder-projection-plan.md) |
| Interface | Entrée et cinq vues React : layout, menu provisoire et trois conteneurs de modules. Chutier et vrai parcours projet restent à faire. | [Entrée](../../src/app/main.tsx), [layout](../../src/app/layout/AppLayout.tsx) |
| Undo/Redo | Absent du contrôleur ; l’étape 4 du plan de construction est une intention. | [Construction](../app/2026-07-10-app-construction-plan.md) |
| Sauvegarde entre sessions | Aucun adaptateur de stockage dans le circuit applicatif ; `LOAD_SCENE` est vide, `SCENE_LOADED` reçoit une scène en mémoire. Un round-trip de sérialisation ne prouve pas une sauvegarde navigateur. | [Contrôleur](../../src/app/controller/controller-machine.ts), construction étape 5 |

La dernière entrée Git touchant le package est `dcbf8f8c` du 15 octobre
(audit documentaire d’export). Des commits de septembre ont encore modifié
l’intégration mouvement : juillet et le rapport du 30 août ne suffisent pas
pour reprendre. Le plan général conserve notamment React/shadcn, le builder
V1 et une ancienne organisation documentaire. Les plans V2 détaillés portent
le suivi actuel ; leurs décisions ouvertes ne deviennent pas des specs.

## 2. Contrôles actuels et divergences

Commandes exécutées le 28 octobre depuis `packages/editor` :

| Contrôle | Résultat |
| --- | --- |
| `../../node_modules/.bin/vitest run` | 43 fichiers : 41 passent, 2 échouent ; 452 tests réussis, 3 échecs sur 455. |
| `../../node_modules/.bin/tsc --noEmit -p tsconfig.json` | TS2353 sur `builder-v2/build-scene.ts:580`, champ média `master`. |
| `npm run build` | Réussite ; JS 889,67 kB minifiés, 254,80 kB gzip ; avertissement de taille Vite. |

Les échecs traversent trois frontières :

1. **Média**, `tests/builder-v2/build-scene.spec.ts:561`. Le builder et son test
   emploient `initial.master`. Le [contrat media-sync](../../../codplay/specs/media-sync-v2-spec.md)
   exige `sync: 'auto' | 'master' | 'independent'` et refuse l’ancien champ.
   Ce décalage explique aussi le typecheck. La projection du rôle
   `EditorScene.masterItemId` doit être réalignée côté builder éditeur dans
   une tranche acceptée, sans compatibilité core.
2. **Transition capsule**, `tests/builder-v2/build-scene.spec.ts:200`.
   `swipe-right` attend `x: 250`, reçoit `-250`. La
   [table capsule](../2026-07-08-capsule-spec.md) décrit une entrée `250 → 0`,
   alors que le [catalogue partagé](../../../authoring/capsule-automation/src/config/event-definitions.ts)
   fournit `-250 → 0`. C’est une divergence contrat/implémentation : changer
   simplement le test ou le catalogue masquerait un choix non relu. Le
   composant partagé est hors du portage d’interface ; une décision et, si
   nécessaire, une tranche distinctes sont requises.
   La décision de reprise est désormais fixée dans le plan : le catalogue
   partagé fait référence ; les attentes éditeur seront alignées sur lui et
   le résultat apprécié lors des tests, sans modifier ce composant.
3. **Fin de lecture**, `tests/scene-player-bridge-v2.spec.ts:420`. Après
   création/déplacement de KFs et lecture jusqu’à la fin,
   `coordination.presentation.get()?.timeMs` est absent au lieu de `5000`.
   Signal déjà consigné le 15 octobre ; cause non établie ici. Examiner la
   frontière fin de lecture → instance → présentation → overlays, sans
   attribuer d’emblée le défaut à React ou au core.

Aucun correctif n’a été appliqué. Le build ne certifie pas l’intégration.
Configuration MCP locale et inventaire complet de 83 outils inspectés :
`safari-mcp` est configuré et callable, avec lecture, interactions, JavaScript,
console et réseau. Aucun onglet n’était ouvert au contrôle ; aucun parcours
navigateur Éditeur n’a été exécuté ici. L’inventaire ne fournit pas de geste
physique de glisser-déposer. L’acceptation native reste ouverte.

## 3. Ce qui revient d’Elcé

La [spec Remix Elcé](../../../elce/specs/remix-spa-spec.md) décrit une entrée
`remix/spa`, une composition explicite, un acteur auteur unique, des façades
d’intentions et des vues JSX sans React. Le package déclare et possède
`remix@3.0.0-rc.4`, Node minimal 24.3.0 au constat initial. La cible fixée
depuis par l’utilisateur est `remix@3.0.0`, avec le même runtime ; le portage
doit en vérifier les exports et prérequis. XState est déjà à la même version
déclarée dans les deux applications (`^5.32.2`) : l’évolution porte sur les
responsabilités et les raccords, sans changement de version identifié.

La composition crée les ressources ; le routeur reçoit une racine composée.
Le contexte transmet acteur et façades. La vue observe le snapshot, demande
son rendu par `handle.update()` et désabonne à la fin de son cycle de vie.
Éditeur peut reprendre ce patron sans importer Learning, ses mods, ses verrous,
IndexedDB, son API ou son serveur SQLite.

Le [contrat d’historique Elcé](../../../elce/specs/document-history-spec.md)
fournit aussi une référence : historique dans le même acteur que le document,
états avant/après, branche Redo, limite de 100 gestes et durée de session. Son
[acceptation globale](../../../elce/plan/2026-10-11-elce-undo-redo-plan.md)
reste ouverte sur certaines commandes et frontières projet.

## 4. Surface du portage Remix

Les imports React sont limités à `src/app/main.tsx` et `src/app/layout/`.
Aucune bibliothèque shadcn n’est copiée dans `src/app/ui/` ; `@base-ui/react`
est déclaré sans import observé. Le portage est plus restreint que l’ancienne
intention de refonte.

| Surface | Adaptation proposée |
| --- | --- |
| Entrée et composition | Remplacer `createRoot` par Remix SPA ; créer acteur, façade player et coordination hors du rendu. |
| Layout et menu | Vues Remix et façade d’intentions typée ; conserver le menu de validation tant que son remplacement fonctionnel n’est pas décidé. |
| Trois conteneurs React | Hôtes Remix stables ; créer les bridges existants une fois, les détruire au démontage. Aucun remontage sur update documentaire. |
| JSX et outillage | `jsxImportSource: 'remix/ui'`, lancement adapté, retrait des dépendances React inutilisées du seul workspace éditeur. |
| Contrôles standards | Employer les primitives réellement exportées par la version retenue, selon les besoins présents. |

Le Remix installé exporte notamment `button`, `input`, `select`, `checkbox`,
`radio`, `menu`, `popover`, `tabs`, `accordion`, `combobox`, `listbox` et
`toggle` sous `remix/ui/*`. Les exports et guides locaux ont été lus.
`button()` et `input()` sont des mixins pour éléments natifs, pas des API React.
Elcé emploie encore beaucoup de HTML natif : portage du runtime et substitution
des contrôles standards sont deux aspects à distinguer.

`sequence-editor/`, `decor-editor/`, `motion-editor/`, Selection Frame et les
autres composants d’authoring non React restent inchangés. Le player reste
CodPlay. Leurs hôtes, la composition et les bridges applicatifs peuvent être
adaptés. La propriété de leurs sous-arbres DOM doit être éprouvée au montage,
à l’actualisation et au démontage, avec le mécanisme de préservation Remix.

## 5. Contrôleur et façades

Deux circuits existent déjà : `commands/facade.ts` route les transformations
pures d’`EditorScene` ; `EditorPlayerCommandFacade` pilote l’instance CodPlay,
avec `EditorCoordinationBridge` pour relier les ports des modules au contrôleur.
Une façade d’intentions à la manière d’Elcé devient l’entrée des vues, sans
remplacer ces circuits et sans conserver de second document :

```text
Vue Remix → façade d’intentions → contrôleur XState
                                  ├─ commandes pures → document + historique
                                  └─ échos existants → bridges → modules autonomes

Temps auteur / transport → coordination → façade player → instance CodPlay V2
```

Le journal runtime CodPlay n’est pas l’historique des gestes auteur.

## 6. Frontières de l’undo/redo

**Enregistrement.** `sceneCommitted` est aussi émis après sélection,
désélection et fin de scrub, avec document inchangé. L’historien doit entourer
l’application réussie des commandes/transactions dans le contrôleur, filtrer
les opérations sans effet et conserver une entrée par transaction ; s’abonner
indifféremment à cet événement enregistrerait l’éphémère.

**Ordre des gestes.** Le bridge décor conserve commandes/candidats, avec flush
d’inactivité à 4 s et frontières explicites. `flushNow()` refuse de committer
pendant un geste du cadre. Le
[contrat de phase existant](../app/2026-07-17-phase-commit-selection-recovery-plan.md)
et les raccords plus récents du mouvement V2 possèdent déjà les frontières
de commit/abandon des flux concernés. L’historique doit s’y raccorder ; sa
construction ne justifie pas de rouvrir leur définition. Pour une capture
continue, conserver uniquement les extrémités évite d’enregistrer une suite
d’échantillons techniques comme autant de gestes auteur. Les candidats en
attente restent à vérifier dans ce même circuit. Le délai texte Elcé de
500 ms ne justifie pas une seconde temporisation.

**Restauration.** Réinstaller le document dans le contrôleur puis utiliser
l’écho post-commit et le rebuild V2 existants. `SCENE.LOAD` change de scène et
réinitialise le playhead : il ne convient pas à Undo dans la scène courante.
Préviews, candidats et références invalidées se réconcilient à cette frontière
applicative, sans patch du DOM final ni réécriture des modules spécialisés.

**Sélection et temps.** L’ancien plan Éditeur exclut l’éphémère ; Elcé conserve
une sélection avant/après. La décision fixée dans le plan préserve temps
auteur courant, borné si la durée change, et sélection encore valide ; les
références supprimées sont nettoyées. Cette différence de contrat illustre
pourquoi partager une implémentation d’historique ne découle pas du seul
besoin commun d’Annuler/Rétablir.

**Pertinence du partage.** Dans la base `develop` de cette reconstruction,
[`app/history/document-history.ts`](../../../elce/src/app/history/document-history.ts)
dépend du document Elcé, de ses sélections page/chapitre/Section et des
commandes de fusion média. L’audit initial sur `elce-mods` avait lu une forme
générique sous `core/history/` ; cette extraction n’appartient pas à la base
actuelle. Le mécanisme commun de piles avant/après reste court, tandis que les
frontières de geste, ressources retenues et règles de restauration sont des
responsabilités du cœur applicatif de chaque éditeur. La proposition révisée
est donc un historique local au contrôleur Éditeur, avec Elcé comme référence
de fonctionnement. Elle prolonge le circuit de commit Éditeur existant et ne
crée pas un second propriétaire documentaire. Un package commun imposerait
ici une abstraction et une modification d’Elcé sans nécessité établie ; son
extraction est retirée de la proposition. Le point 3 du plan reste à relire.

Le [plan de reconstruction](../2026-10-28-editor-remix-history-plan.md) suit
désormais la persistance provisoire du modèle actuel, préalable au chantier de
sauvegarde pérenne laissé ouvert. L’historique reste de session. Les futurs
imports médias demanderont leur contrat de rétention, sans reprendre dès
maintenant toute l’infrastructure Elcé.

## 7. Ordre de travail proposé

Qualifier les échecs et aligner les attentes de transition sur le catalogue
partagé ; conserver les frontières applicatives existantes ; porter
composition et hôtes Remix ; raccorder les intentions ;
intégrer l’historique ; accepter sur le vrai parcours auteur. Builder Decor
structuré, zones et refonte visuelle dedit restent séparés. Le
[plan](../2026-10-28-editor-remix-history-plan.md) porte les actions et portes.
