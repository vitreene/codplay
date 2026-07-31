# CodPlay V2 - frontieres de coherence Scene

## Statut

Decision active pour la fondation `SceneDoc -> CompiledScene`.

Cette note est une reference interne de chantier. Elle ne constitue pas une API
auteur et ne doit pas etre recopiee dans les README de modules.

## Normalisation

`normalizeSceneDoc()` est volontairement responsable de la completion structurelle
avant les guards :

- `undefined` devient la representation canonique attendue (`{}`, `[]` ou absence
  semantique selon le champ);
- le document auteur n'est jamais mute;
- `actions[perso.id] = null` est ajoute systematiquement;
- une valeur auteur presente sur cette cle interne est remplacee par le sentinel
  canonique.

Ce remplacement n'est pas un false positive de validation. Le sentinel est une
route interne de ciblage du perso, pas un payload d'action auteur.

Les validateurs de payload ne doivent pas envoyer `actions[perso.id] = null` au
validateur d'action. Les donnees arbitraires envoyees a cette route apparaissent au
runtime, dans le payload d'execution, pas dans le sentinel compile.

## Configuration et comportement

`src/scene/config/` ne contient que des constantes declaratives : chemins,
tokens et tables produit. Il ne contient ni factory de payload, ni resolver, ni
validateur.

Les helpers executables de validation vivent dans `src/scene/validation/` et
consomment les constantes de `config/`.

Cette separation est une frontiere de dependances, pas une regle de nommage
cosmetique.

## Snapshot du catalogue

Le snapshot de `ValidationCatalog` a le niveau d'immutabilite suivant :

- les `Map` sont copiees au moment du snapshot;
- une registration ulterieure ne modifie pas le snapshot deja remis au builder;
- le contrat TypeScript expose `ReadonlyMap`;
- aucun freeze runtime profond n'est applique au snapshot, car cette frontiere est
  interne et synchrone, et un freeze profond ajouterait une complexite sans risque
  d'execution etabli.

Le freeze runtime est reserve a `CompiledScene`, qui est un artefact de sortie
partage avec le player et dont l'immutabilite fait partie du contrat de diffusion.

## Ressources

Le premier deriveur V2 conserve la regle V1 de base :

- lire `perso.initial.src`;
- lire les `src` de premier niveau dans `perso.actions[*]`;
- deduire le type par extension depuis la table de configuration;
- ignorer les extensions non reconnues tant que la politique de diagnostic des
  ressources dynamiques n'est pas formalisee.

Le deriveur ne parcourt pas arbitrairement les objets imbriques et ne deduit pas un
type `asset` ou `media` depuis le type du perso.

## Validation

- Les chemins de diagnostic sont des donnees dans `config/` et sont resolus par des
  helpers dans `validation/`.
- Les guards actuels recoivent une donnee canonique; la validation d'une forme brute
  hors du contrat TypeScript releve d'une future frontiere codec/import.
- Le catalogue de validation est capability-only : il ne porte ni composant
  instancie, ni node, ni service runtime.

## Regle d'audit

Avant de signaler une incoherence, verifier si la situation est une decision
intentionnelle de normalisation ou une convention interne documentee ici. Ne pas
requalifier automatiquement une completion canonique en correction silencieuse, ni
exiger une immutabilite runtime profonde pour toute structure TypeScript readonly.

## Valeurs couleur

Le parseur couleur est une preparation ACE pure, independante du DOM. Il produit
`ColorValue` en `srgb` pour les noms CSS, les formes hexadecimales et `rgb/rgba`.
Il ne convertit pas vers `oklch` et ne modifie pas le renderer.
