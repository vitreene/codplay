# CodPlay V2 — réservation d’un contenu ancré après une ligne de texte

## Statut

**En cours — direction acceptée le 2026-10-03 ; image, resize, répétition des
réservations et cycle navigateur vérifiés ; validation d’intégration restante.**

L’utilisateur demande que le player garde son markup auteur et recalcule la
position visuelle du bloc par un écouteur. Le composant `scroll-container`
conserve son seul tag ; le `layout` monté à l’intérieur possède le markup et
les parts concernées. La spécification vérifiée des parts reste l’autorité pour
leur découverte et pour le montage des persos. Ce plan ajoute une capacité de
présentation à ce même composant, sans circuit de montage parallèle.

## Invariants et contrat à réaliser

- `layout.initial` peut déclarer une liste de réservations associées à des
  `data-part` déjà présents dans son `markup`. La déclaration donne la hauteur
  relative et les marges ; elle ne crée pas d’élément.
- Le slot reste la même cible de montage CodPlay et conserve son éventuel
  perso enfant. Le HTML source et le graphe des persos restent inchangés.
- Le `layout` conserve la position logique initiale du slot, puis calcule la
  fin de la ligne visuelle après cette position et y replace la même part dans
  le DOM de présentation. La réserve occupe la largeur de la colonne et
  l’espace vertical sous la ligne, sans interrompre le texte qui la précède.
- Les positions source restent stables d'un calcul à l'autre. Un seek, un reset
  ou un replay peut demander le même recalcul sans changer l'ordre ni la
  composition de la scène.
- La position est recalculée après matérialisation et à chaque changement de
  largeur du texte. L’écouteur appartient au composant et est libéré à sa
  destruction. Les changements de hauteur dus à la réserve ne provoquent pas
  de boucle de recalcul.
- `position-anchor` peut continuer à placer le perso enfant dans cette réserve.
  Le composant ne crée, ne clone et ne met à jour aucun perso.

## Acceptation

1. **Vérifié :** tests ciblés de l’attachement différé, du déplacement, du
   recalcul après changement de largeur, de la cible et de son enfant uniques,
   de la destruction, et de l’ordre de deux réservations après un second
   calcul.
2. **Vérifié :** le parcours réel de la preview Safari fait A → B → A. Après
   retour sur A, le `innerHTML`, l’ordre des nœuds et le texte sont identiques
   à l’état initial ; les deux slots média gardent leurs positions. Le test
   `HtmlPlayerRunner.seek(0)` vérifie aussi que `afterSeek` appelle `refresh()`
   et que le recalcul préserve les deux slots et leurs enfants.
3. **Vérifié pour l’image :** preview Elcé dans Safari à `846 px` et `670 px`
   de colonne, marges de `16 px`, texte avant/après continu, un seul slot et
   un seul perso. Safari a également vérifié le cycle A → B → A d’une page avec
   deux vidéos ancrées.
4. **Vérifié :** typecheck CodPlay et Elcé, build Elcé, suite CodPlay complète
   (`109` fichiers, `715` tests) et suite Elcé complète (`10` fichiers,
   `48` tests) le 2026-10-03. Un build CodPlay autonome n’est pas défini dans
   ses scripts ; le typecheck et le build Elcé compilent son usage réel.

Deux défauts sont maintenant cernés. La capture initiale attend
`isConnected` ; la capturer dans un fragment détaché faisait disparaître le
slot au premier calcul. Le test navigateur A → B → A a ensuite montré que les
`Range` vivants utilisés comme points logiques dérivaient après les coupes des
nœuds texte. Le layout conserve désormais le parent et le frère suivant de
chaque slot, réunit les fragments de texte avant un nouveau calcul et garde
l’ordre de plusieurs réservations. Les tests ciblés et le cycle réel Safari
vérifient que le replay conserve le même markup de scène et le même ordre.

Le contrat et les preuves du replay sont inscrits dans la spécification du
composant `layout` et dans la spécification d’intégration Elcé. Ce plan reste
En cours jusqu’à la validation des autres cas d’intégration listés ci-dessus.
