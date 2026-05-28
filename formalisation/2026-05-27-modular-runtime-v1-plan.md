# Modular Runtime V1 Plan

Date: 2026-05-27

## Statut

Plan de travail V1.

Ce document est volontairement autonome.
Il resume:

- le but recherche
- les decisions deja prises
- le perimetre V1
- le critere de report si l'implementation demande trop de reecriture

## Objectif

Pour V1, le but est de proposer une structure runtime modulaire pour Codplay:

- registry unifie
- separation entre composants, services et modules
- contrat composant clarifie pour les auteurs de composants custom
- cas `move` traite comme premier cas de module runtime a double accroche

Le but n'est pas de forcer une reecriture immediate du runtime si le cout est trop eleve.

## Intention V1

La cible V1 est d'abord une cible de structure et de spec.

L'implementation ne sera faite que si elle peut:

- fonctionner a egalite avec la structure actuelle
- ne pas casser les comportements actuels
- ne pas demander une reecriture profonde de l'orchestrateur ou du player

Sinon, l'implementation est explicitement reportee a plus tard.

## Decisions deja prises

### Registry

Le registry cible est unifie par famille:

- `codplay.component.register(...)`
- `codplay.component.override(...)`
- `codplay.service.register(...)`
- `codplay.service.override(...)`
- `codplay.module.register(...)`
- `codplay.module.override(...)`

Regles:

- `register` cree une declaration unique
- collision sur `register` => erreur
- `override` remplace explicitement
- `override` sur une cle absente => erreur
- pas de legacy a entretenir; les anciennes declarations seront realignees ensuite sur ce modele

References:

- `formalisation/v1-registry-api.md`

### Composants

Direction retenue pour le design auteur:

- le constructeur recoit le `perso` complet en lecture seule
- `report` remplace `warn`
- `render()` est one-shot et construit le rendu initial
- `update()` est la couche auteur
- les mecanismes runtime internes comme la gestion des events utilisateur ne font pas partie de l'API auteur

Le contrat definitif n'est pas encore fige dans une spec finale complete, mais ces decisions sont retenues comme base.

### Services

Un `service` est un ensemble de fonctions partagees reutilisables par les composants.

Regle cle:

- un service ne patch pas le runtime global

Autrement dit, un service peut aider un composant a appliquer des comportements ou transformations locales, mais n'installe pas de logique dans l'orchestrateur ou le player.

### Modules

Un `module` peut avoir une double accroche:

1. une accroche runtime app
2. une accroche composant

Le premier cas de reference est `move`.

Regles:

- un composant ne declare jamais lui-meme un module
- un module est installe au niveau runtime via le registry `codplay.module`
- apres installation, le composant peut consommer une capability locale fournie par ce module

Reference:

- `formalisation/v1-module-api.md`

## Cas de reference: `move`

`move` est le principal indicateur de faisabilite de l'architecture modulaire V1.

Pourquoi:

- `move` ne se comporte pas comme un simple helper local
- `move` depend d'un ancrage runtime global
- `move` a aussi besoin d'un support local cote composant, en particulier pour `list`
- `flip` intervient autour de `move` mais ne doit pas etre expose dans l'API composant

### Audit deja etabli

La logique `move` d'execution est aujourd'hui concentree principalement dans:

1. `src/runtime/components/runtime-component-orchestrator.ts`
   - normalisation de `move`
   - application des moves initiaux
   - application des moves resolus
   - orchestration avant/apres autour des updates

2. `src/player/create-player-utils.ts`
   - transport de `story.initial.move` vers `RuntimePersos.storyMovesByStoryId`

3. `src/runtime/types.ts`
   - `MoveValue`
   - `MoveCommand`
   - `MoveFlipMode`

4. `src/runtime/config.ts`
   - `move.rootToken`

5. `src/runtime/modules/list-flip/create-list-flip-module.ts`
   - support interne avant/apres pour les transitions FLIP

6. `src/animation/types.ts`
   - transport de payloads contenant `move`

### Conclusion d'audit

Aucune autre partie applicative majeure de Codplay ne semble avoir besoin de logique `move` metier directe.

En particulier, il n'y a pas de besoin metier direct repere dans:

- la facade player publique
- le telco local
- le registry
- le builder, hors transport de donnees auteur

### Consequence

Si l'extraction modulaire de `move` exige une reecriture trop importante de l'orchestrateur, de l'etat runtime ou du support FLIP, l'implementation doit etre reportee apres V1.

## Strategie V1

La strategie retenue est:

1. ecrire les specs completes
2. mesurer les ecarts entre ces specs et le runtime existant
3. n'implanter que ce qui peut etre branche sans chirurgie lourde
4. reporter le reste

## Plan de travail

### Phase 1 - Figer les specs

Figer et valider:

- registry unifie
- API module
- contrat composant
- frontiere `services` / `modules`

Objectif:

- etablir une cible claire avant toute implementation

### Phase 2 - Cartographier les ecarts reels

Pour chaque candidat:

- registry
- composants
- services
- modules
- `move`

analyser:

- ce qui existe deja
- ce qui peut etre renomme/rebranche sans changer le comportement
- ce qui demanderait une reecriture structurelle

Objectif:

- separer ce qui est faisable en V1 de ce qui doit etre reporte

### Phase 3 - Definir le critere go / no-go d'implementation

Implementation autorisee seulement si:

- le comportement final reste equivalent a l'existant
- l'orchestrateur n'a pas besoin d'etre massivement reecrit
- `move` peut etre isole sans destabiliser `list`, `layout`, `mounted`, `flip`
- les tests existants restent pilotables sans chantier transversal majeur

Sinon:

- spec conservee
- implementation reportee

### Phase 4 - Prioriser les implementions les moins intrusives

Ordre recommande si implementation partielle:

1. registry unifie
2. declaration des composants alignee sur le registry
3. contrat composant clarifie
4. structure des services
5. API module
6. extraction de `move`

Objectif:

- attaquer d'abord les couches peu intrusives
- garder `move` comme dernier seuil de complexite

### Phase 5 - Utiliser `move` comme test de faisabilite

`move` sert de seuil de difficulte.

Si modulariser `move`:

- force trop de reecriture dans `RuntimeComponentOrchestrator`
- force une refonte lourde de `list` / `layout` / `flip`
- ou casse la stabilite des tests

alors la conclusion V1 doit etre:

- architecture modulaire specifiee
- implementation de `move` reportee post-V1

### Phase 6 - Decision finale V1

A la fin du cycle de spec:

1. soit certaines couches sont implementees car peu couteuses
2. soit la modularisation reste une cible de spec uniquement

Dans les deux cas, la decision doit etre explicite.

## Regle de prudence

Le projet ne doit pas forcer un remaniement profond du runtime uniquement pour satisfaire la nouvelle architecture en V1.

Priorite V1:

- clarte de la structure cible
- stabilite des comportements existants
- lisibilite des specs

Avant toute implementation lourde, il faut pouvoir dire clairement:

- ce qui est deja compatible avec l'existant
- ce qui est reportable sans ambiguite

## References

- `formalisation/v1-registry-api.md`
- `formalisation/v1-module-api.md`
- `formalisation/v1-move-separation-policy-state-backend-dom.md`
- `formalisation/runtime-component-class-design-notes.md`
