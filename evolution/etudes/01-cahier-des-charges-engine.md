# Cahier des charges - Engine scene/story (V1)

## 1) But produit

Construire un player de scene interactif capable de jouer une suite de stories selon:

- un scenario predefini
- des actions utilisateur en temps reel
- des evenements enregistres puis rejoues

Le moteur vise:

- la coherence temporelle
- la modularite des actions
- le rejeu deterministe
- une logique evenementielle basee sur des machines d'etat

## 2) Perimetre fonctionnel

Le player doit gerer:

- event utilisateur (click, move, orientation, etc.)
- multitrack (langues, piste user, pistes dynamiques)
- activation/desactivation de pistes
- actions statiques, transitions, transitions derivees
- stories instanciables
- propagation d'evenements a l'echelle scene
- preload medias avant lecture
- pilotage standard (`init`, `play`, `pause`, `seek`, `rewind`)

## 3) Objets metier

### Scene

Ensemble de stories + scenario global + table d'eventime.

### Story

Groupe de persos relie entre eux, instanciable, avec eventimes locaux.

### Perso

Description d'un element rendu (audio, video, image, texte, html, lottie, threejs, script, story, list, etc.).

Contient:

- `id`
- `type`
- `initial`
- `actions`
- `emit`
- `listen` (optionnel)
- `media` (si type media)

### Strap

Objet sans rendu direct. Produit des donnees evolutives dans le temps, exploitees par des persos.

### Eventime

Evenement date (`startAt`) pouvant contenir des enfants (cascade relative). Aplati au runtime.

### Track

Couche temporelle superposable. Peut etre active/desactivee.

### Playable

Contrat commun de pilotage pour une story ou un media:

- `play`
- `pause`
- `seek`
- `rewind`

## 4) Decisions produit validees (V1)

1. IDs runtime namespaces pour les instances story: oui.
2. Portee click: generale scene. Un event peut etre ecoute par plusieurs persos/straps.
3. Tracks superposees avec activation/desactivation dynamique.
4. Rejeu: inclut les evenements utilisateur autorises et enregistres sur piste user dediee.
5. Ordre:
   - map initial: ordre fourni par l'auteur
   - events user: toujours ajoutes apres les events existants a temps equivalent
   - a 1000, 1001, 1010: traites dans le meme tick si la fenetre temporelle les couvre
6. Pipeline transitions derivees: oui.
7. Strap: logique par instance.
8. `listen` conditionnel: oui, version simple (egalite).
9. Callback `emit`: emet un event; la modif scenario se fait dans le traitement d'event.
10. Tolerance temporelle/catch-up: oui.
11. Plugin:
    - gere side-effects
    - peut modifier une transition
    - ne peut pas emettre d'event
    - ne peut pas annuler une action
12. Deux modes runtime: player et debug.
13. Convention de nom d'event: libre (editeur/script).
14. Matching event/action V1: egalite exacte (pas de wildcard).
15. Ordre entre cibles qui ecoutent le meme event: ordre de declaration.
16. Sync media: seuil de correction 80 ms, priorite au media master actif.
17. Commandes globales sequence (`play/pause`) prioritaires sur commandes media locales.
18. `seek`/`rewind`: option `rebuild`, valeur par defaut `state`.
19. `init` detruit l'etat precedent; `revert` ne detruit pas.
20. Record user: explicite, valeur par defaut `false`.
21. Record user V1: mode `finalOnly` par defaut (on garde le resultat, pas toute la duree du geste).
22. Preload medias obligatoire avant demarrage.
23. Rebuild:
    - mode `state`: ne fait pas de re-upload/reload media
    - mode `full`: autorise reset complet + preload complet
    - le choix du mode est fourni par l'editeur/hote
24. Politique echec preload:
    - mode editor: degrade autorise
    - mode player: blocage
25. Les medias suivent la sequence; au seek, on applique selon l'etat logique du media.
26. Si media est logiquement `paused`, il reste en pause apres seek.
27. Les instances restent en memoire pendant la vie de la sequence.
28. Story et media suivent les principes de machine d'etat (traces de transitions).
29. Fin story:
    - `story -> ended` force `ended` sur tous les enfants
    - si tous les enfants bloquants sont `ended`, story peut passer `ended`
30. Enfant `loop: infinite` non bloquant par defaut (`blocksStoryEnd = false`).
31. `rewind` reinitialise aussi les straps.
32. `type=list` est un conteneur d'enfants avec auto-animation `add/remove/move`.
33. Le plugin `list` est cree au moment du `createElement` puis expose au player.
34. En `rebuild=state`, les nodes ne sont pas recrees (`nodeRef` stable).

## 5) Exigences non fonctionnelles

- Determinisme de rejeu (meme entree -> meme sortie)
- Trace lisible en mode debug
- API claire pour l'editeur
- Separation nette: orchestration / animation / rendu
- Dependance externe minimale

## 6) Contraintes techniques

- Moteur d'animation cible: animejs
- Hors animejs: pas de dependance runtime obligatoire en V1
- Resolution temporelle: 10 ms
- Ticker par raf (60 fps cible)

## 7) Hors perimetre

- Conception de l'editeur (autre projet)
- Reprise directe du code legacy
- Support runtime direct du format legacy (`persos` + `eventtimes`)
- Couverture complete de tous types media en V1
