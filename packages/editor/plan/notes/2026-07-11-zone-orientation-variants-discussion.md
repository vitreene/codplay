# Discussion — Variantes d'orientation des zones et grilles

Matière de réflexion du plan `../2026-07-11-zone-orientation-variants-plan.md`. Extraite du document de discussion de l'app (`2026-07-10-app-construction-discussion.md`), ce sujet étant un chantier capsule-automation autonome et non de la construction d'app. Rien ici n'est normatif.

## Origine (dictée, 2026-07-10)

À la création d'une assignation de position sur la capsule, se donner la possibilité de créer **plusieurs variantes d'une zone** — **même id, plusieurs définitions** — la définition choisie dépendant d'une **condition @media, réelle ou simulée**. La seule qui doit exister dans l'app : l'**orientation vertical/horizontal**. Problème CSS de fond : CSS ne gère pas directement l'orientation d'un **élément**, seulement celle du viewport.

Extension (2026-07-10) : pour les grilles, définir aussi **les paramètres qui génèrent les enfants** par orientation — permettre à une **permutation** d'inverser rows/cols (6×2 horizontale → 2×6 verticale). Décision (2026-07-11) : c'est une feature à faire, dans la continuité du point orientation ; les sous-grilles internes d'un conteneur par orientation restent hors périmètre.

## Où c'était amorcé (repo, 2026-07-10)

- **spec ouverte** = `docs/plans/2026-07-03-selection-frame-variantes-plan.md`, § « Surfaces et contraintes » : **surface** = réalisation géométrique d'une zone sous une contrainte ; **contrainte** = règle CSS/condition d'environnement sélectionnant la surface active ; « une zone peut avoir plusieurs surfaces, une seule active par contrainte ». Point capital : le module d'édition n'édite **qu'une surface à la fois** ; l'association `zone → { contrainte: surface }` vit dans la **data éditeur/modèle**, pas dans le module. La feature est donc côté modèle + classe métier, pas selection-frame.
- **dedit** : embryon `ZoneDef` en deux formes dont `{ name; contexts: Record<OrientationContext, ZoneCoords> }`, `OrientationContext = 'horizontal' | 'vertical'` — multi-surface par orientation, mais coords cqw (ancien modèle), pas réconcilié avec l'id stable.

## Mécanisme CSS — vérifié MDN (2026-07-11)

`@container (orientation: landscape | portrait)` est un descripteur **standard** de container query. L'orientation est évaluée sur la **propre boîte du conteneur** (ratio width/height), **pas sur le viewport** — réponse exacte au problème de fond. Descripteurs de taille de `@container` : `width`, `height`, `inline-size`, `block-size`, `aspect-ratio`, `orientation`. Baseline « largement disponible » depuis février 2023, réserve MDN habituelle. Plus lisible que le `@container (aspect-ratio <= 1/1)` d'Eddy (même effet, intention dite directement). CSS pur, zéro JS pour le rendu réel.

## Approche Eddy (concept seulement, code écarté — invitation explicite ; superseded pour le sélecteur CSS par `orientation:`)

- Deux variantes par zone, `portrait`/`landscape`, chacune `{row,col,rowSpan,colSpan}`. Une orientation par défaut ; variante non-défaut seulement si éditée (mono-définition sinon, coût nul).
- Double détermination : **réelle** (container query aspect-ratio) + **simulée** (classe sur la racine `.ed-preview-orientation--portrait/--landscape` qui force la variante) ; la simulée l'emporte quand présente.
- **Rôle du JS chez Eddy, minimal et suffisant** : le JS ne sert qu'à **injecter une classe sur le container root** ; cette classe pilote ensuite tout en pur CSS. Une ligne JS, léger et acceptable — pas un échec de la préférence CSS compilé.
- **À écarter d'Eddy** : l'encodage des variantes dans un **nom de classe tokenisé** (`ed-posv1-p(r..-c..)-l(r..-c..)`) parsé par regex, familles de tokens parallèles (`cell-span-*`, `cell-r*c*`…). Stockage-dans-la-chaîne refusé : dans ed2 la variante est une **donnée structurée**, et `AutoCapsule` génère les règles à partir d'elle.

## Points de conception

- **id / nom** : id permanent (identité, attache) ; nom = libellé par **ordre** (`z-01`, `z-02`…), pas par position — le nom peut changer et n'est qu'un intermédiaire vers la classe CSS générée. Ne pas attacher sur le nom.
- **Double classe = cas classique CSS** : plusieurs classnames sur un élément, chacun à portée contextuelle (base + `@container`). La double définition n'existe que si l'auteur varie ; sinon classe unique sans contexte (règle déjà posée). La duplication de règles ne touche donc que les zones/grilles réellement variées — pas d'explosion générale (inquiétude initiale surdimensionnée, corrigée).
- **Couplage grille ↔ surfaces (point dur)** : si la grille change de forme entre orientations (6×2 ↔ 2×6), une zone `r5c1` d'une 6×2 n'existe pas dans une 2×6 → changer la grille par orientation force à définir/dériver le placement correspondant. À traiter, pas esquiver.
- **Lien `CapsulePatch.grid` / `GRID_MODE`** : `grid:{rows,cols,gap}` et le mode par sous-type deviennent des valeurs potentiellement par orientation. À rapprocher de `rangee`/`derived` (dérive déjà sa dimension de l'orientation + nb d'enfants) — ici rendu explicitement éditable.

## Contexte, cœur, et strap (2026-07-10/11)

Codplay = séquenceur d'événements aveugle au contexte ; résolution du contexte uniquement dans les composants / le CSS. Donc l'orientation ne peut pas être une capacité **cœur**. Le runtime n'a aujourd'hui aucune infra `@container`/`aspect-ratio`/`matchMedia`/`ResizeObserver` — cohérent, pas un manque. Le « strap qui émet des events type ResizeObserver » est un **strap régulier**, pas une fonction cœur — aucun souci d'architecture. Rendu réel = CSS pur (aucun JS) ; le strap/ligne JS ne sert que la classe racine (simulation d'aperçu, forçage éventuel de diffusion). L'hypothèse « strap scène comme canal » reste à évaluer, mais le rendu réel n'en dépend pas.

`AutoCapsule` (`capsule-automation`, via `core/resolve-placement.ts` / `core/build-grid.ts`) = la classe métier dédiée qui produit déjà le placement/grille ; c'est elle qui portera la génération conditionnelle.

## Partition auteur / diffusion

- **Auteur (app)** : définition des variantes, simulation d'aperçu, observation d'orientation — côté éditeur. Ce que l'app garde de ce chantier : un **élément d'interface pour faire basculer l'orientation de la scène** (aperçu).
- **Diffusion (player seul)** : autonomie, sans app. Rendu réel = CSS généré (`@container`), zéro JS ; forçage éventuel = classe racine par une ligne JS.

## Points ouverts (repris dans le plan)

Nommage `portrait/landscape` vs `vertical/horizontal` ; orientation par défaut ; étendue v1 côté grille (inversion rows/cols seule vs jeu complet) ; 100 % `@container` vs `@container` + classe-root (confort de génération, pas faisabilité).
