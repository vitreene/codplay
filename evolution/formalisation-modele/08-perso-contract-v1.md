# Perso contract V1

## But

Formaliser un mini contrat entre les trois objets qui sechainent dans la compilation des persos:

- `PersoSpec`
- `PlatformProfile`
- `RuntimePersoPlan`

Ce contrat sert a separer proprement intention scene, adaptation plateforme et execution player.

## Perimetre

Inclut:

- structure minimale des 3 objets
- regles de transformation
- diagnostics obligatoires

Exclut:

- details de rendu (DOM/canvas/native)
- details API host
- details de boucle runtime

## 1) PersoSpec (sortie builder core)

Role:

- decrire un perso de maniere portable, sans hypothese de plateforme

Contenu minimal:

- identite (`id`, `type`)
- etat initial logique (proprietes metier)
- actions par nom d'event
- transitions intentionnelles (ex: move, fade, media-play)
- metadata de contexte (story, tags, priorite eventuelle)

Contraintes:

- aucune primitive de rendu concrete
- aucun detail CSS/DOM/canvas specifique

## 2) PlatformProfile (entree adaptation plateforme)

Role:

- declarer les capacites et limites de la cible

Contenu minimal:

- identite de plateforme (`name`, `version`)
- capacites booleennes ou graduees (animation, layout, media, etc.)
- contraintes connues (precision, perf, limites)
- politiques de fallback activees

Contraintes:

- explicite et versionne
- pas d'inference opaque au runtime

## 3) RuntimePersoPlan (sortie adaptation plateforme)

Role:

- decrire comment le player doit executer le perso sur la cible

Contenu minimal:

- strategie de rendu choisie
- mapping actions -> primitives plateforme
- etat initial concret exploitable par le player
- instructions de transition resolues (ou fallback)
- diagnostics d'adaptation attaches au plan

Contraintes:

- executable tel quel par le player
- deterministe a entree egale

## Chaine de transformation

1. `SceneDoc` -> builder core -> `PersoSpec`
2. `PersoSpec` + `PlatformProfile` -> adapter plateforme -> `RuntimePersoPlan`
3. `RuntimePersoPlan` -> player runtime -> execution

Le player ne doit pas rejouer la logique de compilation.

## Regles V1

1. Regle d'intention

- `PersoSpec` exprime le "quoi"

2. Regle d'adaptation

- `PlatformProfile` contraint le "comment"

3. Regle d'execution

- `RuntimePersoPlan` fixe le "quand/comment appliquer" cote player

4. Regle de fallback

- toute capacite absente doit produire un fallback explicite et trace

5. Regle de non-couplage

- aucun champ plateforme ne remonte dans `PersoSpec`

## Diagnostics minimaux

Chaque adaptation doit pouvoir produire:

- `code` (stable)
- `level` (`info | warn | error`)
- `persoId`
- `message` (lisible)
- `details` (optionnel)

Cas typiques:

- capacite manquante avec fallback applique
- capacite manquante sans fallback possible
- substitution de strategie (ex: move -> simple transform)

## Exemple conceptuel

- intention scene: "deplacement anime"
- profile plateforme: "FLIP non supporte"
- plan runtime: "utiliser transform avec fallback degrade"
- diagnostic: `PERSO_ADAPT_FALLBACK_MOVE`

## Criteres d'acceptation V1

- meme `PersoSpec` + meme `PlatformProfile` => meme `RuntimePersoPlan`
- fallback toujours explicite et trace
- pas de details plateforme dans le contrat scene

## Points ouverts

- taxonomie finale des capacites plateforme
- format standard des transitions intentionnelles
- granularite des diagnostics selon mode player/debug
