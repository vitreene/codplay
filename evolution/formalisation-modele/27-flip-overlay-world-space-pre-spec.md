# FLIP overlay world-space pre-spec

## Statut

Pre-spec exploratoire. Pas de code dans ce document.

## Contexte

La base `play/pause/seek` + FLIP est maintenant exploitable, mais un cas visuel reste fragile:

- deux lists se chevauchent avec un ordre de pile stable (une devant l'autre)
- un item transfere vers la list derriere
- pendant la transition, l'item est masque par le contenu de depart

Effet observe:

- rupture visuelle (l'item "disparait" partiellement)
- incoherence `play` vs `seek` sur certains passages intermediaires

## Probleme a resoudre

Le FLIP actuel anime le node dans son contexte local de parent. Dans les cas de stack/clip complexes:

- la geometrie mesuree peut etre correcte
- mais le rendu final reste faux car la couche visuelle n'est pas au bon niveau de z-order

Besoin cible:

- permettre une simulation de position "au-dessus" des lists pendant la transition
- conserver un resultat deterministic et iso `play`/`seek`

## Contraintes non negociables

1. pipeline animation unique (animejs adapter)
2. `play/pause/seek` pilotent toutes les transitions
3. pas de branche speciale non seekable pour FLIP
4. FIRST/LAST restent bases sur mesures reelles
5. comportement deterministic (meme entree -> meme sortie)

## Terminologie

- `world-space`: coordonnees scene/globales (viewport ou root runtime)
- `local-space`: coordonnees dans le parent DOM courant
- `overlay layer`: couche temporaire au-dessus des lists
- `ghost`: representation temporaire animee d'un item
- `anchor`: etat de reference d'un item a un instant cle

## Solutions possibles

## Option A - Ghost overlay (clone visuel)

Principe:

- au debut d'un FLIP de transfer/reparent, creer un `ghost` dans un overlay global
- animer le ghost en world-space
- garder le vrai node cache ou neutralise temporairement
- a la fin, supprimer le ghost et reveler le vrai node dans sa destination

Avantages:

- controle complet du z-order (ghost toujours au-dessus)
- limite les effets de clipping/stacking contexts parents
- logique claire pour les cas inter-list

Limites:

- gestion de style/mesure plus couteuse (snapshot visuel)
- synchronisation stricte ghost <-> vrai node (content, size, opacity)
- accessibilite/focus a traiter (ghost non interactif)

Compatibilite seek:

- bonne si le ghost est pilote par la meme timeline adapter
- necessite de stocker les seeds world-space de chaque transition

## Option B - Hoist temporaire du vrai node (portal runtime)

Principe:

- deplacer temporairement le vrai node vers un container overlay (portal)
- animer en world-space
- rattacher au parent final en fin de transition

Avantages:

- pas de duplication visuelle (pas de clone)
- etat style unique sur le vrai node

Limites:

- fort impact sur invariants de parentage runtime
- risque de casser logique composant/list pendant la transition
- plus sensible aux regressions `move`, `mounted`, `detached`

Compatibilite seek:

- possible mais delicate (parent logique != parent DOM temporaire)

## Option C - FLIP world-space sans overlay

Principe:

- conserver les nodes dans leur parent
- calculer deltas full world-space + compensation parent dynamique
- tenter de corriger uniquement par canaux transform/size

Avantages:

- pas de couche visuelle supplementaire
- moins de mecanique runtime nouvelle

Limites:

- ne resout pas totalement les problemes de z-order/masquage
- peut rester faux quand clip/stacking contexts dominent

Compatibilite seek:

- bonne mathematiquement, mais insuffisante visuellement dans le cas cible

## Option D - Hybrid: world-space + proxy parent

Principe:

- garder le vrai node
- appliquer transitions compensees sur item + proxies parent
- synchroniser parents/enfants en cascade

Avantages:

- limite la duplication DOM

Limites:

- complexite tres elevee
- risque fort de desynchronisation `play/seek`
- maintenance difficile

Compatibilite seek:

- fragile sans cache d'ancres robuste

## Recommandation pre-spec

Direction recommandee: **Option A (Ghost overlay)** en V1.1.

Raisons:

- c'est la solution la plus robuste contre le masquage par pile
- elle preserve mieux la lisibilite architecturale
- elle se prete bien a une evolution vers cache seek performant

## Spec fonctionnelle cible (si Option A retenue)

Pour un FLIP de transfer inter-lists:

1. capturer FIRST/LAST du vrai node
2. creer un ghost dans `overlay layer`
3. cacher le vrai node pendant le PLAY du ghost
4. animer le ghost en world-space
5. en fin de transition, detruire le ghost et reveler le vrai node a destination

Regles de pile:

- overlay au-dessus des containers list
- z-index du ghost deterministic par ordre stable de touched set

Regles de clipping:

- ghost non soumis au clipping des parents list

## Exigence critique: coherence play/seek

Pour `seek(t)` au milieu d'une transition:

1. retrouver l'etat d'ancrage au debut de la transition active
2. re-evaluer la chaine parent (si parent lui-meme en transition)
3. positionner ghost/item a `progress(t)` dans le meme repere world-space

Cela impose un modele de donnees par transition:

- `startWorldRect`
- `endWorldRect`
- `startParentChainSnapshot`
- `endParentChainSnapshot`
- `duration`, `delay`, `easing`

## Strategie cache (evolution proposee)

Objectif: reduire le cout de recalcul sur scrubbing intensif.

Niveau 1 - cache seeds (obligatoire)

- conserver les metadonnees immuables d'une transition FLIP
- invalidation: rebuild scene, changement structurel des parents, resize global significatif

Niveau 2 - cache ancres temporelles (optionnel)

- checkpoints world-space a pas fixe (ex: 50ms)
- seek lit le checkpoint precedent + interpolation courte

Niveau 3 - cache chaine parent (optionnel avance)

- memoriser matrices composees parentales par fenetre temporelle
- utile pour cascades parent/enfant en transition simultanee

## Impacts spec a prevoir

Si adoption:

- amendement `25-flip-runtime-core-v1.md` (section world-space/overlay)
- amendement `26-player-orchestration-v1.md` (cycle de vie ghost + seek replay)
- ajout policy logs (ghost create/destroy, fallback local, invalidation cache)

## Critere d'acceptation minimal

1. item transferre toujours visible pendant transition inter-lists superposees
2. meme rendu a `t` entre lecture continue et `seek(t)`
3. parent et enfant en transition gardent coherence spatiale
4. aucune regression sur pause/reprise/rewind
5. fallback propre si overlay indisponible

## Plan de validation (sans code ici)

Suite de tests cible:

- cas A: list avant -> list arriere, transfert simple
- cas B: parent en mouvement + enfant transferre
- cas C: seek aleatoire (0%, 25%, 50%, 75%, 100%) vs play reference
- cas D: scrubbing rapide aller-retour
- cas E: resize viewport pendant transition

Mesures:

- ecart pixel max item attendu/reel
- ecart pixel max parent/enfant
- derive cumulee apres 20 seeks successifs

## Decision gate propose

Avant implementation:

- valider Option A comme trajectoire principale
- valider format seed/cache minimal
- definir seuils d'acceptation visuelle (px)

Apres PoC court:

- confirmer que la coherence `play/seek` est atteinte
- sinon, re-evaluer Option B seulement sur sous-cas strictement necessaires
