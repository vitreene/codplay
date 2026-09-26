# Rationale — domaine de CodPlay

CodPlay décrit et évalue des scènes visuelles interactives selon un temps
logique. Son contrat central consiste à reconstruire l'état d'une scène pour
une position demandée et à présenter cet état par Play ou Seek.

CodPlay ne simule pas un monde physique en temps réel. La physique, les
collisions ou l'intelligence d'un moteur de jeu peuvent rester la responsabilité
d'une intégration externe, hébergée par les capacités CodPlay prévues pour les
projections tierces.

Un `Perso` conserve une identité et un sens propres dans une scène, avec un
état initial, des actions, des événements et une place dans la hiérarchie. Il
participe à la compilation et à la projection temporelle. Le réduire à une
entité de données générique effacerait cette frontière de déclaration, de
reconstruction et de présentation.

Les contrats actuels sont définis par la
[spécification de scène](../../specs/scene-authoring-spec.md), la
[spécification événementielle](../../specs/event-pipeline-v2-spec.md), la
[reconstruction logique](../../specs/runtime-reconstruction-v2-spec.md) et
la [spécification Engine/Player](../../specs/engine-player-v2-spec.md). Cette
note conserve la rationale de domaine ; elle ne crée pas de règle
d'implémentation ni de contrat ECS.
