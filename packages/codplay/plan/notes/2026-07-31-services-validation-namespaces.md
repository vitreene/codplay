# CodPlay V2 - services comme namespaces de donnees

## Statut

Status: Fixe pour la déclaration composant/services V2
CodPlay version: V2 foundation
Review: frontière implémentée le 2026-08-25

## Decision

Un nom de service est a la fois :

- le nom de la capacite declaree par le composant ;
- le namespace de donnees dans `initial` et les actions ;
- le point d'application du validateur ;
- le point de traitement de la valeur dans `update`.

Exemples : `style`, `className`, `attr`, `content`, `layout`, `media` ou une capacite de domaine.

Il n'existe pas de concept parallele `propertyGroups`. Un service peut declarer la forme de son payload et, si
necessaire, les validateurs de ses proprietes internes (`style.opacity`, `layout.orientation`, etc.).

## Composant et update

Un composant peut regrouper ses methodes internes d'`update` qui traitent une meme source sous le namespace du
service correspondant. `update` est le seul distributeur des valeurs recues; les methodes internes n'introduisent
pas de routage concurrent et ne deviennent pas des points d'entree supplementaires.

Les proprietes structurelles comme `id`, `name` et `type` restent hors service. Les proprietes de mise a jour
communes utilisent les services existants. Un namespace commun (`core`, `common` ou `base`) reste a choisir si
des proprietes partagees ne justifient pas un service distinct; `default` est reserve a la discussion des valeurs
par defaut et n'est pas retenu comme nom provisoire.

## Validation et compilation

Une classe de composant est la source unique de son type de service et de son
ordre d'application. Le `RuntimeCapabilityCatalog` reste la source unique des
definitions, validateurs et adapters de materializer. Il expose dans
`validationSnapshot()` la liste statique portée par la classe ; aucune seconde
liste `services` n'est rédigée dans la définition du catalogue.

Au runtime, le composant appelle `this.services.declare([...])`. Le catalogue
résout alors chaque nom dans son registry unique et vérifie que la déclaration
effective correspond à la liste statique du composant. Aucune classe runtime ni
aucun service instancié n'est transmis au build.

Les validateurs core des services communs sont obligatoires. Un validateur de composant peut rester absent dans la
premiere tranche; cette absence produit un warning auteur detaille. Un type de composant ou un service necessaire
mais inconnu est une erreur de capacite.

Les definitions de service portent ensemble le nom, la surface de donnees, la
validation, la normalisation, les defaults et l'adapter de materializer
necessaires. Une extension non HTML déclare ses services dans sa classe et
enregistre les adapters correspondants dans le même catalogue.
