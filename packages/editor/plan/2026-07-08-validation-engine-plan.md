# Plan — Moteur de validation métier (ed2)

**Périmètre** : nouvelle pièce, `packages/authoring/scene-factory/` — colocalisée avec `SceneDocEditor` et `CapsuleDistribution`, les deux autres classes métier du Builder. Valide la sortie du Builder (`SceneDef`) avant compilation, pour des règles spécifiques à ed2 que ni `SceneDocEditor` ni le validateur Codplay existant ne couvrent.
**Origine** : question exploratoire de l'utilisateur (2026-07-08) sur l'utilité d'un moteur de validation métier, en regard du principe acté que `SceneDocEditor` reste un pur helper de squelette (`2026-07-08-scenedoceditor-audit-plan.md` §1) — pas l'endroit pour ces règles.
**Dépend de** : `2026-07-08-builder-plan.md` (valide sa sortie), `2026-07-08-scenedoceditor-audit-plan.md`.

---

## 1. Pourquoi

Plusieurs échecs identifiés au fil du travail sur ed2 sont aujourd'hui **silencieux ou mal tracés** :

- `move.parentId` qui ne résout rien → la capsule/l'item n'est jamais monté, sans erreur claire (`AUTHOR_LAYOUT_OUTLET_NOT_FOUND` est un fourre-tout générique, déclenché au runtime, pas au build).
- Deux persos qui partagent par erreur un nom d'action → les deux réagissent au même eventime, sans avertissement (cf règle eventime/action, `2026-07-08-builder-plan.md` Principe A).
- Une référence de transition nommée (`ref`) absente du catalogue capsule-automation → résolue à `null` silencieusement (`resolveEventDefinition` dans capsule-automation).
- Invariants de la capsule racine (`move:'@root'` exigé à la fois côté story et côté perso) non vérifiés — un seul mal posé et la capsule racine n'est jamais montée, sans indication.

Le validateur Codplay existant (`BuilderValidator`) ne couvre que des cas génériques et transverses à tout Codplay (`AUTHOR_TRACKS_INVALID`, doublons `listen`, identité d'id) — rien de spécifique aux conventions ed2.

## 2. Ce que ce n'est pas

- **Pas dans `SceneDocEditor`** — qui reste un pur helper de squelette (structure + défauts), jamais un moteur de règles (principe acté, `2026-07-08-scenedoceditor-audit-plan.md` §1).
- **Pas dans le Builder lui-même** — le Builder oriente/orchestre la construction ; la validation est une étape séparée qu'il invoque, pas une responsabilité qu'il porte en interne mélangée à la construction.
- **Pas un remplacement du `BuilderValidator` Codplay** — celui-ci continue de tourner à la compilation (`BuilderFacade.compile()`) pour ses propres règles génériques. Le moteur ed2 s'exécute **avant**, sur des règles que Codplay ne peut pas connaître (elles dépendent des conventions ed2 : capsule racine, nommage d'actions, catalogue de transitions).

## 3. Règles identifiées (point de départ, pas la liste finale)

| Règle | Détecte |
|---|---|
| Intégrité référentielle des `move.parentId` | Toute cible de move qui ne résout vers aucun id réel de la scène construite |
| Unicité des noms d'action par story | Deux persos partageant un même nom de clé dans `actions` (collision, cf Principe A) |
| Invariants de la capsule racine | Capsule racine absente, dupliquée, ou `move` pas `'@root'` à la fois côté story et côté perso |
| Existence des `ref` de transition | Toute référence à une transition nommée (`fade`, etc.) absente du catalogue capsule-automation résolu |
| Cohérence de mapping ItemType → type perso | Types perso non enregistrés dans le registre Codplay (ex. `'image'` au lieu de `'img'`) |

## 4. Architecture

- Règles = **fonctions pures**, testables indépendamment, prenant le `SceneDef` (et éventuellement le contexte ed2 source — `EditorScene`, catalogues) en entrée, produisant une liste de diagnostics.
- Format de diagnostic aligné sur les conventions déjà en place dans le projet (`AutoCapsuleDiagnostic{level,code,message,childId}`, `ApiWarning`) — `{level, code, message, context}`, `context` rattachant le diagnostic à l'origine ed2 (id d'item, nom de zone, etc.), pas seulement à l'id perso Codplay.
- Invoqué par le Builder **après** construction via `SceneDocEditor`, **avant** `BuilderFacade.compile()`/`CodPlay.load()` — un échec bloquant arrête l'envoi au player, avec un diagnostic exploitable côté éditeur (pas une erreur runtime Codplay générique à décoder).

## 5. Ordre

1. Écrire les règles une fois le Builder minimal (premier item, cf `2026-07-08-builder-plan.md` étape 3) fonctionnel — les règles se testent contre ses propres cas.
2. Étendre au fur et à mesure que de nouveaux échecs silencieux sont identifiés pendant la construction du Builder (capsule imbriquée, zones) — liste de règles ouverte, pas figée à ce document.
