# CodPlay V2 - points d'ancrage de layout

## Statut

> Status: En cours
> CodPlay version: V2 foundation
> Décision d'ouverture: 2026-09-12

La première implémentation et les tests ciblés sont en place. Le build complet
et la validation navigateur restent les gates ouvertes.

Cette tranche est autorisée pour implémenter l'enrichissement des templates
`layout` par un point d'insertion sans boîte supplémentaire. Elle complète la
capacité existante de parts/outlets ; elle ne remplace ni `data-part` sur un
élément, ni le conteneur propre du composant `slot`.

## Objectif

Permettre à un auteur de déclarer, dans le markup déjà fourni par un `layout`,
un point d'accès qui n'ajoute aucun conteneur DOM :

```html
<main id="layout-root">
  <!-- data-part="scene-b" -->
</main>
```

Le runtime transforme ce commentaire en cible logique de type `anchor`. Lors
du montage, la racine réelle du perso enfant est insérée avant le commentaire,
dans son parent existant. Le commentaire reste donc un repère structurel et ne
devient jamais un parent DOM.

## Périmètre accepté

- le materializer HTML découvre les marqueurs de commentaires et conserve leur
  nœud comme référence d'insertion ;
- le marqueur élémentaire `data-part` conserve son comportement actuel et
  produit une cible `outlet` ;
- le préfixe du marqueur de commentaire est configurable avant le token
  `part`, avec `data-` par défaut (`data-part`) ;
- la configuration est disponible depuis `HtmlPlayerRunner` et la façade
  d'instance ;
- la capacité `markup`, la résolution de placement et le materializer
  structurel transportent le type `anchor` ;
- la démo 1 exprime ses deux accès par des commentaires
  `<!-- data-part="..." -->`, dans un unique parent `main` identifié ;
- chaque parent élémentaire ajouté dans le markup auteur de la démo possède un
  `id` explicite.

## Invariants

- un commentaire d'ancrage ne possède pas de boîte, n'est pas appendable et ne
  peut pas servir de parent à un autre perso ;
- une cible d'ancrage insère les racines réelles du perso avant son commentaire,
  sans enveloppe générée ;
- l'ordre de déclaration des parts reste l'ordre du template et les collisions
  d'identifiants restent rejetées par `markup` ;
- le `slot` garde sa racine hôte et son contrat de contenu foreign ; l'ancrage
  place le slot, pas directement les racines foreign qu'il contient ;
- le cycle de vie, le pilotage et la destruction des scènes restent hors de
  cette capacité ;
- aucune nouvelle branche de démo ne remplace le chemin runtime commun.

## Validation et acceptation

La tranche doit être couverte par :

1. les tests du parseur HTML pour les marqueurs élémentaires, commentaires,
   ordre, conservation du commentaire et préfixe personnalisé ;
2. les tests de la capacité `markup` et du solveur pour le type `anchor` ;
3. un test du materializer structurel qui insère une vraie racine avant un
   commentaire sans créer de wrapper ;
4. la régression de la démo 1, vérifiant le parent `main` identifié, les deux
   hôtes `slot` et l'absence d'attribut `data-part` résiduel sur les éléments ;
5. le typecheck, les tests ciblés, le build des démos et `git diff --check`.

La validation navigateur reste à effectuer avant de considérer cette tranche
comme stabilisée.

## Suivi

- [x] Marqueurs élémentaires et commentaires découverts par le materializer.
- [x] Type `anchor` transporté par `markup`, le solveur et le graphe.
- [x] Insertion avant référence sans enveloppe générée.
- [x] Préfixe exposé par `HtmlPlayerRunner` et la façade d'instance.
- [x] Markup de la démo 1 réduit à un parent `main` identifié et deux points
  d'ancrage.
- [x] Tests ciblés, typecheck CodPlay et typecheck des démos V2.
- [x] Suite complète CodPlay (101 fichiers, 631 tests) et build des démos.
- [ ] Validation navigateur.
