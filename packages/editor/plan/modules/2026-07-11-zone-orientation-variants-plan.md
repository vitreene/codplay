# Plan — Variantes d'orientation des zones et grilles (capsule-automation)

**Périmètre** : donner à une capsule et à ses zones des définitions qui varient selon l'**orientation** du conteneur (portrait/landscape) — placement d'une zone, et forme de la grille de capsule (ex. permutation 6×2 ↔ 2×6). Le traitement est réalisé dans la **classe métier** (`AutoCapsule`, `packages/authoring/capsule-automation/`) : elle génère le CSS conditionnel à partir d'une donnée structurée de variantes ; l'éditeur ne fabrique aucun token.

**Indépendance** : ce chantier ne dépend pas de la construction de l'app (`2026-07-10-app-construction-plan.md`) et s'exécute **en parallèle**. Il touche la classe métier, le modèle de données des zones/grilles, et la génération CSS — pas la coquille React ni le contrôleur.

**Discussion associée** : `notes/2026-07-11-zone-orientation-variants-discussion.md` (origine, vérification MDN, approche Eddy écartée, points ouverts).

## Décisions

- **Mécanisme CSS = `@container (orientation: landscape | portrait)`** (descripteur standard de container query, vérifié MDN 2026-07-11). L'orientation est évaluée sur la **propre boîte du conteneur** (ratio width/height), pas sur le viewport — c'est ce qui résout « CSS ne gère pas l'orientation d'un élément ». CSS pur, aucun JS pour le rendu réel. Baseline largement disponible depuis février 2023.
- **Donnée de variante = structurée**, jamais encodée dans un nom de classe. Une zone garde son **id** stable ; sa définition devient une table de surfaces par contrainte. Le **nom** est un libellé par ordre (`z-01`, `z-02`…), qui n'est qu'un intermédiaire vers la classe CSS générée.
- **La double définition est l'exception** : tant que l'auteur ne définit pas de position particulière pour la seconde orientation, la classe reste **unique et sans contexte** (règle déjà posée, `2026-07-03-selection-frame-variantes-plan.md`). La duplication de règles ne concerne que les zones/grilles réellement variées.
- **La classe métier (`AutoCapsule`) génère le CSS** — placement conditionnel des zones ET forme de grille conditionnelle. Elle produit déjà le placement par lignes mono-surface ; la génération *conditionnelle* est l'ajout de ce chantier.
- **Rendu réel = CSS pur** via `@container (orientation:)`. **Simulation/forçage = une classe sur la racine**, poussée par une ligne JS (rôle minimal, modèle validé). La classe de simulation l'emporte quand présente ; sinon le `@container` réel s'applique.
- **Portée** : variantes d'orientation sur les **zones** (placement) et sur la **grille de capsule** (forme, paramètres générateurs d'enfants — inversion rows/cols au moins). **Hors périmètre** : les sous-grilles internes d'un conteneur variables par orientation (extension latérale, pas ce raisonnement).

## Nature du contexte : pourquoi ce n'est pas dans le cœur Codplay

Codplay est un séquenceur d'événements aveugle à son contexte de lecture ; la résolution du contexte (taille, aspect, orientation) vit **uniquement dans les composants / le CSS généré**, jamais dans le cœur. L'orientation réelle est donc portée par du **CSS pur** (`@container`), sans aucune capacité cœur ajoutée. Le seul JS éventuel (pousser une classe d'orientation sur la racine, pour la simulation ou un forçage de diffusion) prend la forme d'un **strap régulier** au niveau scène — pas une fonction cœur.

## Étapes

1. **Modèle de données des variantes** — une zone : `id` stable + table de surfaces par contrainte (`{ [orientation]: placement }`), défaut mono-surface. Une grille de capsule : forme par orientation (`{ portrait: {rows,cols,gap}, landscape: {...} }`), défaut mono-forme. Fonctions pures de lecture/écriture, testées. Réconcilier l'embryon dedit (`ZoneDef.contexts: Record<OrientationContext, ZoneCoords>`, coords cqw) avec la forme par id/pistes.
2. **Génération CSS conditionnelle dans `AutoCapsule`** — étendre la classe métier pour émettre, par zone/grille variée, les règles sous `@container (orientation: portrait|landscape)`, et la règle de base hors contexte pour le cas mono-surface. Vérifier ce qui existe déjà (placement par lignes mono-surface) vs ce qui est à ajouter (branche conditionnelle). Tests sur le CSS produit.
3. **Couplage grille ↔ surfaces** — quand la grille change de forme entre orientations (6×2 ↔ 2×6), garantir que le placement des zones/enfants reste valide dans chaque forme (une zone `r5c1` d'une 6×2 n'existe pas dans une 2×6). Décider : placement par orientation obligatoire dès que la grille varie, ou dérivation. Point de conception central de ce chantier.
4. **Simulation / forçage par classe racine** — le levier CSS (classe racine plus spécifique que le `@container`) + le point d'injection (une ligne JS, strap régulier au niveau scène). Le rendu réel n'en dépend pas ; c'est l'aperçu éditeur et un éventuel forçage de diffusion.
5. **Démo** — une capsule dont la grille et une zone changent à la bascule d'orientation, rendu réel piloté par le redimensionnement du conteneur (container query), et simulation par bascule de classe. Validation visuelle utilisateur.

## Points à trancher (avant/pendant l'écriture)

- Nommage des orientations dans la donnée : `portrait`/`landscape` (aligné sur `@container` et Eddy) vs `vertical`/`horizontal` (aligné sur l'`OrientationContext` dedit). Trancher un seul vocabulaire.
- Orientation par défaut (celle de la surface mono, sans contexte).
- Étendue v1 côté grille : seulement l'inversion rows/cols, ou le jeu complet de paramètres générateurs par orientation.
- 100 % `@container` vs `@container` + classe-root selon confort de génération (prototype de confort, pas de faisabilité — l'approche est connue).

## Lien avec les autres documents

- `docs/plans/2026-07-03-selection-frame-variantes-plan.md` — § « Surfaces et contraintes » : vocabulaire (surface, contrainte, une seule active par contrainte ; le module d'édition n'édite qu'une surface à la fois, l'association `zone → {contrainte: surface}` vit dans la data).
- `2026-07-08-capsule-spec.md` §10 (`CapsulePatch.grid`), §11 (zones `card`) — les valeurs qui deviennent variables par orientation.
- `2026-07-08-dedit-zonedef-migration-plan.md` — la migration `ZoneDef` doit tenir compte de la table de surfaces (pas seulement `id`).
- La spec du modèle ed2 (à écrire) référence ce chantier pour la forme data des variantes ; l'app ne garde qu'un **élément d'interface de bascule d'orientation de la scène** (aperçu auteur).
