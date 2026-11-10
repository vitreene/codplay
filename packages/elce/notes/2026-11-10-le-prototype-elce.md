# Le prototype Elcé

## Fonctionnalités

elce est un editeur orienté contenus.

à la différence du Shell, il ne s’appuie que moderement sur du motion design, et privilégie la lecture du contenu.

Cela oriente son usage : pas de timeline, pas de son (il y a des exceptions), lecture avec scroll de pages.

voir analyse sur confluence.

l’interface cherche à se rapprocher d’un editeur de contenus comme Elementor pour Wordpress. Il se focalise sur les contenus, plutot que le decor. les réglages de styles sont tres modérés.

Ce sont des intentions, et pas des limites.

## Usage de l’IA

le projet est conçu à l’aide d’ia, qui est principalement chargée de :

- m’aider à structure l’architecture du projet, sur la. base des intentions que je lui soumets ;
- écrire le code.

Cela permet d’augmenter la portée du projet, de tenter des fonctionnalités qui auraient été mises de coté sinon, et d’en etendre la surface.

## Architecture

quelques librairies pour l’app

- remix pour le framework, acces backend et interface frontend
- xState pour la gestion des états.
- bdd : sqlite.

Elcé s’appuie sur deux librairies maison :

- Codplay, lecteur de scenes, sequenceur d’events et gestion des animations.
- Sighty, coordonne les circuits de lecture du scénario.

Ces deux librairies constituent le moteur d’affichage des projets.

Elce gere la lecture, l’edition et la sauvegarde des projets.

L’editeur compile en temps reel les données du document pour le transformer en rendu Sighty/Codplay.

Elce est conçu pour etre modulaire et extensible :

- on peut ajouter de nouveaux blocs de contenus spécialisés;
- les modes permettent de construire des produits nouveaux partageant le prototype Elcé.

## Commercialisation et diffusion

- les mods permettent de créer des versions bien cloisonnées : une version gratuite, par exemple, une version « pro », une version « interne ».
- peut exister comme produit independant, ou comme extension de 2jLearning. le couple est une afaire de definition, pas de contrainte technique.
- l’interface connue pour un mod sert pour un autre.
- la nature low-cost incite à un chemin d’auto-inscription du service.
- accès à un catalogue premium de ressources 2j professionnelles (micro-modules)

## passer du prototype au produit commercial :

- definition des périmetres de l’app : modules et fonctionnalités retenues.
- mode gratuit : engagement progressif, auto-decouverte. confidentiel ou public
- valider les choix ergonomiques, revoir et peaufiner l’interface
- enrichir l’eco-systeme : acces à des banques d’images, modeles de style, layouts…
- assistance ia

## Un éco-système

(lié à architecture)

un ensemble de librairies et d’apps cohérentes

un moteur : codplay

- event-based
- deterministe
- independant de sa projection (html, canvas)
- extensible : composants core et add-ons
- pilotable

un orchestrateur : Sighty

- construit et exploite un graphe de scenes
- scenes imbriquées
- gardes d’accès
- graphe dynamique, ajout et update de scenes
- controle l’etat de lecture

des apps :

- un éditeur de scènes motion design ;
- Elcé : un éditeur de parcours de bases documentaires , se décline en modes.
  - learning,
  - hunt,
  - tv,
  - …

## en résumé :

**Sighty est le moteur de parcours et le routeur des scènes**. Il prend un scénario de vues, décide quelles scènes sont accessibles et actives, puis orchestre la navigation et l’état de lecture en session.

**CodPlay** construit et rend les scènes. **Sighty** décide quand elles entrent dans le parcours et coordonne leur présentation via CodPlay. L’application hôte reste propriétaire du document métier et de sa sauvegarde.

Formulation courte : *« Sighty orchestre le parcours de scènes CodPlay à partir d’un scénario : routes, gardes, navigation et état de lecture. »*
