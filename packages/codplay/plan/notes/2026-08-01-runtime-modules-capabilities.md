# Modules runtime et capacites V2

## Statut

Status: En cours  
CodPlay version: V2 foundation

## Decision

Terminology decision: existing plans and V1 references keep the word `module`.
In the V2 runtime API, `module` becomes `RuntimeModuleService`. This is an API
rename, not a mass rewrite of the planning corpus or the compiled
`CompiledRequirements.modules` field.

V2 conserve le module V1 comme point d'extension, mais separe quatre niveaux :

1. une definition de module enregistree dans le `RuntimeCapabilityCatalog` compose a l'initialisation ;
2. une instance de module creee par player ;
3. un etat pur et testable porte par cette instance ;
4. une interface `Materializer` ou un adaptateur de materialisation eventuel.

Le module n'est donc ni un composant unique, ni un singleton de module. Une capacite
peut etre fournie par plusieurs implementations et instanciee une fois par player.

## List

`list` garde un statut de **capacite cross-layer** : sa particularite est
contractuelle, pas une exception codee dans l'engine. Elle coordonne un etat
logique, un ensemble d'elements affectes, une mesure groupee et une materialisation
visuelle. Elle ne doit donc pas etre reduite a un service stateless ordinaire,
mais elle ne doit pas non plus imposer un renderer au move core.

La capacite list V2 consomme les deltas generiques `mount`, `unmount` et `move`
du move core et porte les politiques `reorderOnMove`, `reorderOnAdd` et
`reorderOnRemove`. Son instance fournit une politique de frontière à la
`StructuralTimeline`; l'ordre structurel reste porté par `SolvedGraph` et
`StructuralTimeline`, sans reducer list concurrent.

La tranche list implementee :

- declarer la capacite `list` au catalogue engine ;
- creer une instance par player ;
- enregistrer les cibles list et leurs configurations V1 ;
- consommer les deltas de placement via une politique structurelle pure ;
- laisser `SolvedGraph` et `StructuralTimeline` produire l'ordre complet ;
- laisser le materializer projeter cet ordre sur les materialisations auteur ;
- laisser le runner capturer explicitement les layouts avant/apres sur les
  materialisations visibles et le motion graph projeter
  la transition ;
- ne jamais devenir une source DOM, un cache historique ou un second circuit de
  relecture.

## Frontieres

- `CompiledRequirements.modules` declare une dependance de capacite ;
- l'engine valide et fournit la definition du module ;
- le player possede l'instance et son cycle de vie ;
- le move core produit les transitions de parent et de montage ;
- la `StructuralTimeline` applique la politique list et produit l'ordre complet ;
- le runner HTML mesure les layouts avant/apres dans son circuit FLIP ;
- le materializer projette cet ordre et cette présentation sur le substrat ;
- aucune communication directe entre scenes n'est introduite.

## Seek

Un seek ne rejoue pas les effets du module. La politique list est réévaluée dans
la construction déterministe de la timeline, puis le player relit le snapshot
structurel avec les autres couches. Aucune préparation DOM ou présentation
partielle n'est ajoutée au seek.

## Suite

`RuntimeCapabilityCatalog`, `RuntimeModuleServiceDefinition` et la creation/destruction des
instances par player sont maintenant en place. L'initialisation depuis le snapshot
solve, le routage des deltas, la reconciliation staged de seek et la politique
structurelle list sont egalement en place. La derivation de
`CompiledRequirements.modules` vient des declarations de capacites des
composants ; la validation de disponibilite reste au runtime engine. Cette
tranche ne reintroduit pas le melange V1 entre declaration `install(host)` et
instance runtime.

Le contrat de coordination FLIP V2 est specifie dans
`../flip-list-coordination-plan.md`. La mesure et la projection restent dans le
runner/materializer ; aucun hook `beforeUpdate` DOM ni circuit de demo n'est
ajoute au module list.
