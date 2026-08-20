# CodPlay V2 - services comme namespaces de donnees

## Statut

Note de decision pour la future tranche composants. Elle fixe le contexte a respecter sans ouvrir cette tranche
maintenant.

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

Une declaration de composant doit etre la source unique de son type, de ses services, de sa capacite runtime et de
sa definition de validation optionnelle. La forme retenue est un descripteur unique
consomme par le runtime et `RuntimeCapabilityCatalog.validationSnapshot()`. Aucune
seconde liste `services` ne doit etre redigee pour la validation.

Les composants ne declarent pas leurs services par un appel runtime. La definition
enregistree est la seule source de verite. Son snapshot est remis au moteur de
validation de `CompiledScene`; aucune classe runtime ni aucun service instancie n'est
transmis au build.

Les validateurs core des services communs sont obligatoires. Un validateur de composant peut rester absent dans la
premiere tranche; cette absence produit un warning auteur detaille. Un type de composant ou un service necessaire
mais inconnu est une erreur de capacite.

Le chantier composants sera ouvert plus tard. A ce moment, les definitions de service devront porter ensemble le
nom, la surface de donnees, la validation, la normalisation, les defaults et le traitement `update` necessaires.
