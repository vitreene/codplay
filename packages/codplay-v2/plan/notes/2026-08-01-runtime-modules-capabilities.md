# Modules runtime et capacites V2

## Statut

Status: En cours  
CodPlay version: V2 foundation

## Decision

V2 conserve le module V1 comme point d'extension, mais separe quatre niveaux :

1. une definition de module enregistree dans le catalogue engine ;
2. une instance de module creee par player ;
3. un etat pur et testable porte par cette instance ;
4. un backend ou un adapter de projection eventuel.

Le module n'est donc ni un composant unique, ni un singleton de module. Une capacite
peut etre fournie par plusieurs implementations et instanciee une fois par player.

## List

`list` garde un statut de **capacite cross-layer** : sa particularite est
contractuelle, pas une exception codee dans l'engine. Elle coordonne un etat
logique, un ensemble d'elements affectes, une mesure groupee et une projection
visuelle. Elle ne doit donc pas etre reduite a un service stateless ordinaire,
mais elle ne doit pas non plus imposer un renderer au move core.

`ListCapabilityState` est l'etat pur de la premiere capacite list V2. Il consomme
les deltas generiques `mount`, `unmount` et `move` du move core et porte les
politiques `reorderOnMove`, `reorderOnAdd` et `reorderOnRemove`.

Le futur module list devra :

- declarer la capacite `list` au catalogue engine ;
- creer une instance par player ;
- enregistrer les cibles list et leurs configurations ;
- reconcilier un `SolvedScene` initial ou un delta de placement ;
- calculer l'ensemble affecte par une operation de parentage ou de reorder ;
- coordonner une phase `beforeUpdate`/mesure sur cet ensemble ;
- preparer un nouvel etat avant un seek groupe ;
- committer son etat avec le player ;
- exposer un snapshot a un composant ou un backend, sans devenir leur source DOM.

## Frontieres

- `CompiledRequirements.modules` declare une dependance de capacite ;
- l'engine valide et fournit la definition du module ;
- le player possede l'instance et son cycle de vie ;
- le move core produit les transitions de parent et de montage ;
- le module list applique l'ordre de ses containers ;
- le coordinateur render du module list mesure les elements concernes en batch ;
- le renderer ou le composant projette le snapshot ;
- aucune communication directe entre scenes n'est introduite.

## Seek

Un seek ne rejoue pas les effets du module. L'instance prepare un etat list
determine a partir du snapshot solve ou des deltas, puis le committe avec les
autres instances. Une preparation asynchrone future devra rester bornee a la
transaction de portee et ne jamais presenter un sous-ensemble.

## Suite

Le catalogue runtime doit encore recevoir le contrat `RuntimeModuleDefinition`,
la fabrique d'instances par player et la validation des modules compiles. Cette
tranche ne doit pas reintroduire le melange V1 entre declaration `install(host)`
et instance runtime.

Le contrat de coordination FLIP V2 est specifie dans
`../flip-list-coordination-plan.md`. Tant que cette tranche n'existe pas, seule la
partie `State` est implementee ; aucun hook `beforeUpdate` DOM ne doit etre simule
dans la demo.
