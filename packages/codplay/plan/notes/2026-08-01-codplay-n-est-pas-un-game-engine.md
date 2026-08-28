# CodPlay n'est pas un game engine

## Statut

Decision de cadrage active. CodPlay V2.

## Objet

CodPlay partage certains concepts avec les game engines : scene graph, temps,
hierarchie, projection, etat derive et boucle de rendu. Cette proximite ne definit
pas son domaine. CodPlay est un systeme declaratif de scenes spatio-temporelles,
interactives, rejouables et projetables vers plusieurs substrats.

Le runtime V1 reste une reference normative pour les comportements a conserver,
les contrats, les invariants et les tests-oracles. V2 est une reecriture distincte :
elle ne reutilise pas le runtime V1 comme dependance d'execution.

## Difference de domaine

Un game engine simule principalement un monde en temps reel. Il gere souvent une
boucle de simulation, des entites, des collisions, de la physique, de l'IA, de la
navigation, du reseau ou des ressources de jeu.

CodPlay decrit et evalue principalement une scene visuelle et interactive. Son
probleme central est de repondre de maniere deterministe a :

```text
Quel est l'etat visuel et interactif de cette scene a l'instant t ?
```

Cette reponse doit rester compatible avec le play, le pause, le seek, le replay,
la capture et plusieurs substrats de projection.

CodPlay n'a pas pour objectif de simuler un monde physique. Une integration avec un
game engine externe reste possible, mais ce moteur serait alors un service ou un
substrat externe, pas l'identite de CodPlay.

## Pourquoi un Perso n'est pas une Entity ECS

Un `Perso` est une unite semantique de scene. Il peut representer un texte, une
image, un media, un groupe, un hote ou un objet porte par un composant. Il participe
a une declaration auteur, a une timeline, a une hierarchie et a une projection.

Une `Entity` ECS est generalement un identifiant pauvre auquel des composants de
donnees sont attaches. Sa signification vient surtout des systemes qui parcourent
les composants.

La correspondance suivante serait donc artificielle :

```text
Perso       -> Entity
style       -> ECS component
solve       -> ECS system
```

Elle perdrait plusieurs proprietes importantes de CodPlay :

- l'identite semantique et le contrat du perso;
- la difference entre declaration auteur, etat derive et sortie projetee;
- la distinction entre Behavior continu et Event ponctuel;
- la temporalite rejouable et le seek vers un instant arbitraire;
- la frontiere entre scene logique et substrat de rendu;
- la validation specialisee par type de composant.

Un ECS introduirait aussi une pression vers un etat mutable parcouru par plusieurs
systemes. Cela entrerait en tension avec l'etat derive par `f(t)`, la projection
deterministe et la regle d'unicite des ecrivains.

## Ce que CodPlay peut emprunter a l'ECS

CodPlay peut retenir des idees generales sans adopter l'architecture ECS :

- separer les donnees des traitements;
- donner a chaque traitement une responsabilite explicite;
- ordonner les traitements par dependances;
- propager des invalidations par dirty flags lorsque cela est mesurement utile;
- stocker des donnees compactes dans les boucles chaudes si un profilage le justifie.

Ces idees restent subordonnees aux contrats CodPlay. Elles ne justifient pas de
transformer les persos en entites generiques ou d'introduire un registre ECS.

## Benefices du modele CodPlay

### Determinisme temporel

L'etat visuel peut etre calcule a un instant `t` au lieu d'etre uniquement le
resultat d'une simulation avancee depuis le debut. Le seek, le replay et la capture
peuvent utiliser la meme logique.

### Separation de l'auteur et du runtime

`SceneDoc` exprime l'intention auteur. `CompiledScene` constitue l'artefact
canonique. Le runtime materialise, resout et projette sans reparser la declaration.

### Multi-substrat

Une meme scene logique peut etre projetee vers le DOM, le canvas, une capture ou un
outil de diagnostic. Le substrat ne devient pas la source de verite de l'etat.

### Interactions rejouables

Les comportements continus et les occurrences discretes peuvent etre traites
distinctement. Les straps, gestures et emissions peuvent produire des faits
temporels plutot que muter directement le rendu.

### Composants specialises

Chaque composant peut declarer ses capacites, ses services, ses proprietes et ses
regles de validation. CodPlay conserve ainsi une semantique riche au lieu de
reduire toute la scene a des colonnes de donnees generiques.

### Outils et inspection

La separation des artefacts facilite la validation, la serialisation, les
diagnostics, les snapshots, les comparaisons V1/V2 et les tests a instants nommes.

## Garde-fous d'implementation

- Ne pas appeler les persos des entites dans les contrats CodPlay.
- Ne pas introduire un ECS comme couche centrale du runtime.
- Ne pas laisser un renderer ou un composant devenir source de verite.
- Ne pas confondre un cache ou un dirty flag avec l'etat canonique.
- Ne pas importer le runtime V1 ; utiliser V1 comme reference comportementale et
  oracle de tests.
- Ne pas presenter la verticale temporaire comme l'architecture finale.

## Conclusion

CodPlay peut partager des algorithmes avec les game engines sans devenir un game
engine. Sa valeur est de combiner une scene declarative, un temps de premier ordre,
des comportements interactifs, une evaluation deterministe et une projection
multi-substrat. L'ECS est une source ponctuelle d'idees d'organisation, pas le
modele d'execution de CodPlay.
