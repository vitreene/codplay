# Runtime Component Class Design Notes

## Statut de cette note

Note de travail non normative, nettoyee apres la session du 2026-05-27.

Les decisions de reference sont portees en priorite par:

- `formalisation/v1-component-api.md`
- `formalisation/v1-module-api.md`
- `formalisation/2026-05-27-session-handoff.md`

## Etat courant retenu

- le constructeur recoit le `perso` complet en lecture seule
- `report` remplace `warn`
- `render()` est one-shot et retourne en V1 `string | node`
- le runtime ne lit jamais implicitement un template dans `perso`
- `update()` est la couche auteur et recoit le patch brut resolu
- `_update()` est une methode interne et recoit le meme patch brut
- le runtime garde la gestion interne des events utilisateur
- pas de `destroy()` composant pour l'instant
- `ComponentServices` est une map ouverte injectee au composant
- `create-element` ne doit plus etre le contrat principal de construction

## Direction pour la base composant

- la base garde `perso`, `services`, `report`, `rootNode`
- la base peut exposer une methode runtime `_update(...)`
- `_update(...)` peut appliquer une logique commune locale si utile, puis passer la main a `update(...)` auteur
- il n'existe pas de pipeline commune canonique validee pour `_update()` en V1
- si plusieurs composants partagent un traitement du type `className` / `style` / `attr` / `content`, ce traitement peut vivre dans un helper ou un pack local, sans devenir une norme de base composant

## Point a verifier: list / move / flip

Le cas `list` est special.

- `move` n'est pas un simple patch local applique sur le root
- le runtime prepare un snapshot FLIP avant move
- le runtime applique le move
- le composant est ensuite mis a jour
- le runtime commit enfin le FLIP avec l'etat apres move

Sequence actuelle:

1. `prepareMove(...)` capture l'etat avant
2. `applyMoveForPerso(...)` applique le move reel
3. `component._update(...)` traite le patch resolu puis peut deleguer a `update(...)` auteur
4. `flipSession.commit()` calcule et emet les transitions

Donc:

- une pipeline `_update()` commune et normative ne peut pas absorber `move` comme un simple service ordinaire
- `move` + `flip` forment une orchestration transactionnelle autour du composant
- ce cas doit rester pilote par le runtime/orchestrateur, pas par la base composant standard

## Consequence design

- la base composant ne doit pas promettre une pipeline de services par defaut normative
- des traitements locaux partages restent possibles pour des familles comme `className`, `style`, `attr` ou `content`
- `move` ne doit pas faire partie d'un tel traitement local generique
- `flip` encore moins: il depend d'un etat avant/apres externe a l'instance seule
- `flip` ne doit pas etre expose comme capability composant auteur de premier niveau

## Hypothese de travail suivante

- `_update()` = methode interne pouvant appliquer un traitement local partage avant `update()` auteur
- `move` / `flip` = orchestration runtime ou module autour de `_update()`
- `list` reste un composant a contrat special, meme si sa couche auteur suit `render()` + `update()`
