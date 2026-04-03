# Perso custom actions V1

## Statut

Version de reference V1 (stabilisee) pour le lien entre:

- une action de scene sur un perso
- le module qui pilote ce perso
- l'application visuelle standard par le player

## 1) Idee simple

Une action peut contenir trois parties:

- une demande metier au module (`cmd`)
- une cible interne optionnelle (`targetId`)
- des changements visuels standards (`style`, `className`, `attr`, `move`)

Le player traite toujours ces parties dans le meme ordre.

## 2) Table de correspondance des modules (`ModuleRegistry`)

### 2.1 Regles

- au demarrage, la table fournie par l'hote complete la table interne
- si un type est redeclare, la definition fournie au demarrage remplace la definition interne
- a la fin de l'init, il ne reste qu'un seul module par type
- la table est figee pendant toute la scene

### 2.2 Type de perso non connu

- si un perso reference un type absent de la table:
  - le perso est ignore
  - un warning est emis

### 2.3 Modules integres

- les modules integres restent montes en permanence

### 2.4 Mode debug

En mode debug, le player expose:

- la liste des types detectes
- le module choisi pour chaque type
- la liste des persos ignores

## 3) Contrat action V1

Champs supportes:

- `cmd?: { name: string, ... }`
- `targetId?: string`
- `style?: Record<string, unknown>`
- `className?: string | { add?: string, remove?: string }`
- `attr?: Record<string, unknown>`
- `move?: string | { mode?: string, targetId?: string }`

Regles:

- si `cmd` est present, `cmd.name` est obligatoire
- une action peut etre:
  - module seulement
  - visuelle seulement
  - mixte

## 4) Sequence d'integration d'un perso module

1. lire `item.type`
2. trouver la classe module dans `ModuleRegistry`
3. si absente: ignorer le perso + warning
4. creer `runtimeItemId`
5. creer l'instance module
6. appeler `init(...)`
7. appeler `render(...)` pour recuperer la racine
8. monter la racine dans la scene
9. appeler `start()`
10. enregistrer les references runtime

Fin de vie:

1. appeler `destroy()`
2. retirer la racine
3. nettoyer les references runtime

## 5) Sequence d'execution d'une action

Pour chaque action resolue sur un perso:

1. si `cmd` existe: appeler `update({ command: cmd, nowMs })`
2. determiner la cible visuelle
3. appliquer `style/className/attr/move` sur la cible valide

Ordre impose V1:

1. commande module
2. resolution de cible
3. patch standard

## 6) Resolution de cible (`targetId`)

Deux modes de module existent:

- `root-only`
- `exposed-targets`

### 6.1 Mode `root-only`

- sans `targetId`: cible = `root`
- avec `targetId` different de `root`:
  - cible ignoree
  - warning

### 6.2 Mode `exposed-targets`

- sans `targetId`: cible = `root`
- avec `targetId`: le player appelle `resolveActionTarget(targetId)`
  - si une cible est retournee: patch standard applique
  - si `null`: patch standard ignore + warning

Regles supplementaires:

- `targetId = root` peut etre traite directement par le player
- les cibles exposees peuvent changer dans le temps
- la resolution est faite a chaque action

## 7) Event unique, plusieurs persos

- ordre des persos: ordre de declaration dans la story
- pour chaque perso, ordre interne fixe:
  1. `cmd`
  2. resolution de cible
  3. patch standard
- un echec sur un perso ne bloque pas les persos suivants

## 8) Warnings V1

- `W_MODULE_TYPE_NOT_FOUND`
  - cause: type absent de `ModuleRegistry`
  - effet: perso ignore
- `W_TARGET_FORBIDDEN_BY_ROUTE`
  - cause: `targetId` interdit en mode `root-only`
  - effet: cible ignoree
- `W_TARGET_NOT_FOUND`
  - cause: cible introuvable au moment de l'action
  - effet: patch standard ignore sur cette cible
- `W_CMD_REJECTED`
  - cause: commande module refusee
  - effet: partie visuelle maintenue

Payload minimum recommande:

- `runtimeItemId`
- `itemType`
- `eventName`
- `actionKey`
- `targetId` (si present)
- `cmdName` (si present)

## 9) API player concernee

Entrees:

- `createPlayer({ moduleRegistry, moduleOverrides, debug })`
- `init(scene)`
- `destroy()`
- `dispatchTechnicalEvent(event)`

Sorties:

- `onModuleEvent(listener)`
- `onModuleWarning(listener)`
- `getModuleDebugSnapshot()` (si debug actif)

## 10) Evenements techniques vers module

Idee simple:

- en plus des actions de scene, le player peut transmettre des evenements techniques utiles au module

Contrat V1:

- entree player: `dispatchTechnicalEvent(event)`
- distribution: vers les modules actifs concernes
- format d'evenement technique minimum:
  - `viewport:resize`
  - `viewport:orientation`
  - `viewport:safe-area`

Regles:

- ces evenements ne remplacent pas les actions de scene
- ils ne changent pas l'ordre d'execution `cmd -> cible -> patch standard`
- un module peut ignorer un evenement technique sans bloquer la scene
- en cas de probleme de traitement, emission d'un warning

## 11) Classe base module

Methodes attendues:

- `init(...)`
- `start()`
- `update({ command, nowMs })`
- `render(...)`
- `onTechnicalEvent(event)`
- `getActionRouteMode()`
- `resolveActionTarget(targetId)`
- `destroy()`

Champs runtime utiles:

- `runtimeItemId`
- `itemType`
- `moduleConfig`
- `rootNode`
- `status`

## 12) Invariants V1

- meme pipeline pour modules integres et modules custom
- `targetId` est local au perso courant
- le player ne traverse pas les sous-noeuds internes sans API module
- la table des modules reste stable pendant la scene
