# Perimetre du builder

## Pourquoi ce document

Le terme "runtime" recouvre plusieurs responsabilites. Pour eviter un bloc monolithique, ce document fixe la frontiere du composant appele ici `builder`:

- il compile une `SceneDoc` auteur en un objet lisible par le player
- il ne fait pas l'execution (tick, animation, media playback)
- il ne cree pas les nodes DOM/canvas/webgl

Le point est important pour la suite: la construction des persos (pas des nodes) peut faire partie du builder, mais doit rester separee des details d'execution.

## Constat a partir de la reference Eddy

Le builder Eddy melange aujourd'hui plusieurs etapes utiles mais heterogenes:

1. derivation de donnees manquantes
2. resolution de timeline/events
3. generation de styles CSS
4. construction des renderables/persos

Cette approche est efficace pour prototyper, mais elle couple des concerns differents.

## Frontiere cible proposee

Le `builder` devient un compilateur de scene en 2 couches explicites.

1. Core scene compiler (obligatoire)

- normalise les IDs et references
- compile les graphes contenu/signal/temps/scenario
- compile les regles `listen` (alias-only) par story
- prepare les plans eventimes (domaines + cues)
- construit les descripteurs de persos runtime (type, etat initial, actions)

Sortie: `CompiledScene` stable et independante du moteur de rendu.

2. Presentation compiler (optionnel selon integration)

- resout les configurations de presentation (theme, classes, tokens)
- peut materialiser des classes CSS deterministes
- peut enrichir les persos avec des references de style pre-calculees

Sortie: assets/styles + metadata de presentation, sans logique de playback.

## Reponse a la question "construction des persos"

Oui, la construction/resolution des persos doit faire partie du builder, avec une limite claire:

- inclus: structure, proprietes initiales, actions, references style
- exclu: creation de node concret (DOM/canvas), layout runtime effectif, animation loop

En d'autres termes: le builder produit des "plans d'objets", pas des instances de rendu.

## Position sur la generation CSS par configuration

La generation CSS appartient a la famille builder, mais pas au noyau de compilation narrative.

- si l'integration cible est web: un `presentation compiler` peut produire des classes
- si la cible change (native/canvas): cette partie est remplacable sans toucher au core scene compiler

Donc: oui au sein de l'ecosysteme builder, non dans le coeur unique obligatoire.

## Contrat entree/sortie (niveau general)

Entree:

- `SceneDoc` auteur (editeur/API/DSL)
- options de compilation (mode player, mode debug, feature flags)

Sortie:

- `CompiledScene` (consommable par player runtime)
- eventuellement `CompiledPresentation` (styles/tokens/assets)
- diagnostics de compilation (erreurs, warnings, traces)

Exports differees a prevoir:

- export diffusion player: scene compilee + dependances (medias, fontes, styles, tiers)
- export legacy: transformation vers un format cible externe (ex: XML) + rapport de conversion

Orientation V1 retenue:

- export diffusion par defaut en bundle complet
- export legacy par defaut en mode degrade + rapport
- phase debug: priorite aux logs/rapports de conversion
- integrite forte (hash/signature) a traiter en phase diffusion
- logs de conversion embarques dans l'artefact legacy

## Non-objectifs du builder

- pas de tick clock
- pas de dispatch runtime en boucle
- pas de state machine d'execution
- pas de creation/destruction de nodes runtime

## Placement de l'adaptateur temporaire

L'adaptateur de compatibilite n'est pas un composant coeur.

- il sort du runtime principal
- il va dans les exemples de tests de conception (hors smoke)
- il sert de support temporaire de verification uniquement

## Decision de structuration recommandee

Organiser le projet en modules explicites:

1. `scene-compiler-core`
2. `scene-compiler-presentation` (optionnel)
3. `player-runtime`
4. `examples/adapters` (temporaire)

Cette separation garantit une architecture evolutive et evite de figer des choix de rendu dans le modele narratif.
