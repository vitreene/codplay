# CodPlay V2 — présentation des transitions `replace`

> Version de référence : CodPlay V2 — 2026-11-10.

## Rôle et propriétaires

Les capacités `replace-slot`, `replace-text` et `replace-media` choisissent
une présentation temporaire autour de l'état ou de la relation demandé par le
player. Elles ne remplacent pas le composant persistant ni son état logique.

Le player et `RuntimeComponentRuntime` possèdent la chronologie des actions,
leurs animations et la reconstruction par Seek. Le module replace prépare une
`ComponentAnimation` puis utilise le même échantillonneur et le même cycle de
fin que les autres animations de composant. La surface HTML ne possède que les
instantanés DOM, leur géométrie, les fragments texte, les représentations média,
les masques SVG et les styles de transition. Elle ne décide pas quelle scène,
ressource ou occurrence entrante doit être sélectionnée.

Lors d'un montage externe, l'application hôte — Sighty pour ses scènes — choisit
l'occurrence entrante, son profil et le moment de demander le montage. Elle
conserve la décision de cycle de vie des instances. La façade publique CodPlay
exécute la relation explicitement demandée ; la présentation replace n'ordonne
pas `play`, `pause`, `seek` ou `destroy` sur l'instance enfant et n'en prend pas
la propriété.

## Horloges

Les remplacements déclarés sur une action utilisent le temps logique du player
et sont reconstruits depuis la timeline lors d'un Seek.

La présentation demandée autour de `instances.mount({ replace })` utilise une
horloge d'opération : son temps est la somme des `deltaMs` effectivement reçus
sur les frames du `TimeTicker` partagé par le moteur. Ce temps ne dépend pas de
la position logique du player hôte. Un Seek, un reset ou un replay de l'hôte ne
le modifie pas. La transition progresse uniquement lorsqu'une frame du ticker
est distribuée ; si l'hôte est en pause, les frames d'un autre player peuvent
continuer de la faire progresser. Sans frame, elle reste figée.

Les deux horloges empruntent le circuit `RuntimePlayerEventController` →
`RuntimePlayerPresentation` → `RuntimeComponentRuntime` et le même
échantillonneur `ComponentAnimation`. Les modules replace ne créent ni boucle
`requestAnimationFrame`, ni temporisateur, ni source d'horloge propre. La forme
de `RuntimeEngineOptions` n'est pas étendue pour ces transitions.

## Calcul des poses

Les valeurs de pose et leurs easings sont préparés et résolus avec ACE via
`prepareTween`/`resolveTween`. Les couleurs de rouleau utilisent les
adaptateurs ACE de couleurs. La conversion des valeurs échantillonnées en
styles, unités `rem`, géométrie DOM et masque SVG appartient à la surface HTML.
La propagation texte/média réutilise `computeReplaceStaggerDelays`.

Pour le recalage des fragments texte, l'adaptateur lit les matrices CSS calculées
dans le DOM, puis compose les transforms et reporte les offsets avec les
opérations ACE `multiplyMatrix`, `invertMatrix` et `transformPoint`. La surface
ne maintient pas de circuit parallèle de calcul matriciel.

L'implémentation de présentation est répartie par propriétaire dans
`runtime/runner-html/replace-presentation/` : sessions, géométrie et DOM,
texte, frames/cellules média, poses, masques, normalisation de profil et
identifiants. `replace-presentation-surface.ts` reste la porte d'export de la
surface HTML.

## Cycle de vie des vues

- Les vues sortante et entrante sont des instantanés temporaires ; l'état
  persistant est toujours mis à jour par le composant et le player.
- Les vues sont retirées à la fin, à l'annulation, lors du remplacement d'une
  session ou au teardown de leur propriétaire.
- `replace-media.split: 'cells'` garde un clone source et le média cible
  persistant dessous, puis applique une seule grille de masques SVG au clone
  source ; la cible reste sans masque. En intro seule, la grille masque la
  cible. `replace-slot.split: 'cells'` réutilise cette même géométrie, ce même
  masque source et ce même cycle de session. Aucun circuit de clones/canvases
  par cellule n'est utilisé. La vidéo média clonée est figée à sa position de
  départ ; le nœud cible reste possédé et piloté par son composant.
- La grille `replace-slot` accepte une forme, `cellSize` en pourcentage de la
  largeur du slot (prioritaire sur `cellX`/`cellY`), une ou deux dimensions de
  grille, `staggerPattern`, `direction` et `stagger`. Sans pattern, ou avec
  `manhattan`, la propagation conserve le calcul par distance et l'origine de
  `direction`. `row-wave` démarre les cellules individuellement de gauche à
  droite, rangée après rangée ; `column-wave` les démarre de haut en bas,
  colonne après colonne. Les vagues excluent `direction`. La durée effective
  comprend toute l'enveloppe `stagger`. Un resize recalcule la grille et
  rééchantillonne la progression courante par le hook de mise à jour du
  composant.
- Le reflow repositionne ou reconstruit la présentation depuis les mesures
  actuelles tout en gardant la progression échantillonnée.
- L'interruption texte repart de la composition visible. Le player conserve
  séparément la reconstruction de l'état logique de la timeline.
- La disponibilité asynchrone d'une frame média peut redemander un échantillon
  à la même position player afin de construire la vue entrante. Elle ne modifie
  pas le temps logique ni la progression de l'animation ; le ticker reste leur
  seule horloge.

Les comportements spécifiques de contenu, de segmentation et de capture média
restent définis dans [remplacement texte](./replace-text-v2-spec.md),
[remplacement média](./replace-media-v2-spec.md) et [slot](./slot-component-spec.md).
Le catalogue JSON et sa sélection auteur sont définis dans
[replace-presets](./replace-presets-v2-spec.md).

## Preuves

- [`foreign-mount.spec.ts`](../tests/facade/foreign-mount.spec.ts) pilote le
  `TimeTicker` avec des frames contrôlées : progression d'opération pendant
  la pause de l'hôte, indépendance du Seek/reset, absence de progression
  sans frame et retrait des vues à la fin.
- [`replace-presentation.spec.ts`](../../sighty/tests/replace-presentation.spec.ts)
  vérifie la sélection du profil entrant ou du profil du slot et la
  progression exclusivement sur les frames distribuées.
- [`replace-presentation-surface.spec.ts`](../tests/runtime/runner-html/replace-presentation-surface.spec.ts)
  vérifie les poses texte en `rem`, les transforms ACE, le chroma, les formes
  SVG, le reflow et le nettoyage.
- [`replace-module.spec.ts`](../tests/runtime/capabilities/replace-module.spec.ts)
  traverse `SceneBuilder` et `HtmlPlayerRunner` : formules de contenu,
  profils CSS/JSON, masques média, resize à temps constant, interruption
  A→B→C, gel de la copie vidéo et retry de frame à position player constante.
