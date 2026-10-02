# Elcé — présentation du POC

Date : 2026-10-01.

Source : présentation initiale fournie par le porteur du projet.

Cette note reformule l’intention du projet et les besoins exprimés. Les
décisions à prendre et la préparation du plan de construction sont suivies
dans le [plan de cadrage](../plan/2026-10-01-elce-construction-plan.md).

## Intention

Elcé est un POC de player et d’éditeur combinés. L’utilisateur construit
lui-même sa projection : il organise son scénario, crée le contenu de ses
pages, puis le donne à lire dans le player.

Un document Elcé comporte deux grandes parties :

- l’organisation des pages : créer, déplacer, structurer, supprimer,
  consigner et paramétrer ;
- la création du contenu de chaque page.

Le projet couvre ainsi deux sujets complémentaires : l’éditeur de scénario
et de pages, et le player du scénario.

## Point de départ

La démo 5 de Sighty fournit une première approche du résultat recherché,
pour le fonctionnement du player et les besoins en contenus. Son parcours
existant est décrit dans la
[spécification de la démo de cours scrollable](../../demos/specs/sighty-scroll-course-demo-spec.md).

Une version plus élaborée du player sera construite après la définition du
modèle de construction des pages du POC. Une première étape consiste à
réaliser une démo d’éditeur capable de créer une page selon les principes
présentés ci-dessous.

L’interface doit évoquer un page builder comme Elementor pour WordPress,
avec des fonctionnalités beaucoup plus simples.

## Composition d’une page

Une page est un enchaînement d’un ou plusieurs nodes. Trois types sont
envisagés :

| Type de node | Intention |
| --- | --- |
| Flux de texte | Contenu de type page web, de longueur libre, avec texte enrichi, sections titrées et contenus insérés dans le flux. |
| Diapo | Contenu contraint à l’écran, sans défilement, pouvant proposer des onglets pour un diaporama d’images ou de cartes. |
| Quiz | Question, réponses, indication des réponses justes, illustration facultative et mode de résolution. |

Le node Flux de texte constitue le minimum requis pour le POC.

## Flux de texte

### Structure et édition

Le flux peut être découpé en sections, afin de placer des titres au-dessus
des textes. La description du node distingue deux zones :

- une zone titre ;
- une zone contenu.

Chaque zone permet une saisie de texte enrichi basique :

- niveaux HTML `h1` à `h6` et paragraphe `p` ;
- gras, italique et souligné ;
- indice et exposant.

La formulation d’origine pour les options de paragraphe est : « gauche —
centré — souligné — justifié ». La clarification de cette liste est suivie
dans le sujet 4 du plan de cadrage.

Aucune autre option d’enrichissement n’est demandée pour cette version.
Selon la difficulté, l’édition pourra s’appuyer sur une bibliothèque externe
ou sur une réalisation spécifique ; ce choix appartient au cadrage technique.

### Contenus ancrés au texte

La présentation générale mentionne des images, des vidéos et des conteneurs
dans le flux. La description détaillée prévoit des images, des vidéos et des
exergues. Une exergue est un texte très court qui met en valeur un terme au
sein d’un contenu plus conséquent.

Le mécanisme visuel envisagé repose sur une ancre placée dans le texte. Une
technique CSS réserve un espace visuel sous la ligne qui contient cette
ancre ; le contenu associé vient s’y insérer en superposition.

L’intention est de garder le contenu lié à sa position dans le texte tout en
préservant la continuité du texte. Ce mécanisme constitue une intention à
étudier et à éprouver lors de la construction.

## Diapo

Un node Diapo reste contenu dans l’écran, sans scroll. Il peut comporter des
onglets pour parcourir des images ou des cartes.

La génération des diaporamas doit utiliser `capsule-automation`. Une capsule
diffuse une série de cartes, dont les structures peuvent être différentes.
Une carte est une structure minimale de document : par exemple, un
conteneur avec une illustration à gauche et un titre accompagné de texte à
droite.

Deux cartes sont prévues pour commencer :

- **Carte photo** : une photo ou une vidéo en plein cadre.
- **Carte message** : un surtitre, un titre, un sous-titre, un message et une
  note de pied de carte. Chaque élément est facultatif, avec au moins un
  élément de titre ou de texte.

## Quiz

Le quiz doit reprendre la structure employée dans la démo 5 de Sighty.
L’auteur choisit ou renseigne :

- le type : vrai/faux, choix unique ou choix multiples ;
- la question ;
- les réponses et l’indication des réponses justes ;
- une image ou une vidéo facultative ;
- le mode de résolution.

## Layouts et présentation

Chaque node utilise une carte comme format de layout. À terme, le choix du
layout, associé à des décors graphiques CSS, doit garantir le résultat visuel
et son adaptation aux différentes tailles d’écran.

Les animations d’apparition et de transition sont largement automatisées.
Pour ce POC, elles sont pilotées par des configurations, sans API à manipuler
par l’utilisateur.

## Passage entre les pages

La page porte la responsabilité du passage à la page suivante. Les modes
évoqués sont la fin du défilement (`scroll-end`), un délai et un signal de fin
de scène. Leur articulation avec l’enchaînement des nodes et le parcours
Sighty sera précisée dans le plan de cadrage.
