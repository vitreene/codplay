# Positionnement d’un bdc ancré dans un Flux

## Statut

**En cours — ratio image, resize, vidéo réelle et retour A → B → A avec deux
vidéos vérifiés dans Safari le 2026-10-03 ; autres interactions restent à valider.**

Cette spécification décrit le raccord entre l’ancre métier Elcé, la cible
`data-part` de CodPlay et le positionnement visuel du bdc. Le placement
structurel et le placement visuel du slot sont faits par CodPlay ; le builder
Elcé fournit la déclaration de réservation. Le circuit Elcé d’ancrage ne lit
pas la géométrie du DOM.

## 1. La cible structurelle CodPlay

L’export Tiptap contient une ancre métier. Le builder Flux la remplace par un
slot inline qui reste une cible `data-part` CodPlay :

```html
<p id="section-text-1">
  Avant
  <span
    id="page-a:bdc-image-1:anchor-flow-slot"
    class="elce-flow-slot"
    data-part="page-a:bdc-image-1:anchor"
    style="display:inline-block;width:0;height:0;position:static;
      --elce-anchor-padding:81.75%;
      padding-bottom:calc(var(--elce-anchor-padding) + 1rem);
      margin-inline-end:100%;vertical-align:baseline;
      anchor-name:--anchor-page-a-bdc-image-1-anchor;"
  ></span>
  après
</p>
```

Le `span` est le seul point de montage. Il ne crée pas de perso et ne porte
aucun contenu média. `projectFluxPlayerMarkup()` conserve le texte, supprime
les attributs d’édition et recopie la valeur métier dans la variable CSS
`--elce-anchor-padding`. L’image `1200 × 981 px` de l’exemple donne `81.75%`.
Le composant `layout` remplace le style inline au montage par une réservation
calculée après la ligne visuelle. Le nom CSS est produit par
`anchorNameFor(partId)` ; il ne sert pas d’identifiant DOM ou de cible CodPlay.

Le perso média du `SceneDoc` vise cette même part :

```ts
{
  id: 'page-a-bdc-image-1-image',
  type: 'img',
  initial: {
    src: source,
    className: 'elce-flux-image',
    style: {
      position: 'absolute',
      'position-anchor': '--anchor-page-a-bdc-image-1-anchor',
      'inset-inline-start': 0,
      'inset-inline-end': 0,
      'inset-block-start': 'calc(anchor(top) + 1rem)',
      width: '100%',
      height: 'auto',
      aspectRatio: '1.22324159',
    },
    move: { target: 'page-a:bdc-image-1:anchor' },
  },
}
```

CodPlay résout `move.target` et insère la racine réelle du perso dans le
slot. Elcé ne recherche pas cette racine avec un sélecteur pour la déplacer
et ne fabrique pas d’hôte parallèle. Le même circuit est utilisé pour une
vidéo, avec le ratio `16 / 9`. L’image utilise `object-fit:cover` ; son cadre
et la réserve du flux partagent le ratio calculé depuis le padding de l’ancre.

## 2. Réservation de la ligne visuelle par le layout CodPlay

Le builder ajoute à `layout.initial.flowReservations` la part du slot et la
hauteur `calc(ratio + marge haute + marge basse)`. Cette déclaration ne
modifie pas `layout.markup`. Une fois la scène montée, le composant `layout`
conserve le parent et le frère suivant de chaque slot comme repères logiques.
Avant chaque calcul, il restaure les mêmes slots à ces repères et réunit les
fragments de texte produits au passage précédent. Il mesure ensuite la fin de
la ligne visuelle et y déplace **ce même slot**, qu’il rend flottant pleine
largeur avec la hauteur réservée. Un `ResizeObserver` sur le layout relance ce
calcul quand la largeur du texte change. Le recalcul après seek/replay de la
scène reste idempotent : il restitue le même ordre et le même contenu.
La [spécification CodPlay du layout](../../codplay/specs/layout-component-spec.md)
détaille ce mécanisme et son cycle de vie.

Le paragraphe du slot est `position: relative`. Le slot garde `anchor-name` ;
le seul perso média garde `position-anchor` et `anchor(top)`, ce qui le place
dans la réserve avec la marge haute de configuration. La marge basse demeure
après son bord inférieur.

Pour une largeur de texte `W`, la réservation image est
`W × paddingBottom / 100`; pour l’exemple `81.75%`, elle vaut `W × 0,8175`.
Une vidéo 16:9 garde `W × 0,5625`. `anchor(top)` est essentiel :
`anchor(bottom)` placerait le bdc après la réservation et ferait dépasser son
bas de la boîte de paragraphe.

Dans l’éditeur, le NodeView lit les dimensions intrinsèques de l’image chargée,
calcule `hauteur / largeur × 100 %`, puis met à jour l’attribut `paddingBottom`
par une transaction Tiptap. `SectionEditor` transmet cette modification au
circuit de commandes XState déjà utilisé pour les changements de texte. Le
même padding dimensionne le bdc en `cover` et la réserve du builder player.

La marge `ANCHOR.DEFAULT_BDC_MARGIN_TOP` est injectée dans la déclaration
`inset-block-start`. Elle reste une constante de configuration et n’est pas
éditable dans le POC.

## 3. Frontière CodPlay respectée

Le runtime CodPlay conserve le parse du markup, la découverte de `data-part`,
la résolution de `move`, la matérialisation du perso et le placement visuel du
slot. Le builder Elcé émet le `SceneDoc` et les valeurs déclaratives du layout.

Il n’y a dans ce circuit :

- aucun `getBoundingClientRect`, `Range`, `getClientRects`, `offset*` ou
  `ResizeObserver` dans le circuit Elcé d’ancrage ;
- aucun accès aux snapshots géométriques internes du runner CodPlay ;
- aucun déplacement manuel de nœud par l’application Elcé ; le layout CodPlay
  déplace sa propre part de présentation ;
- aucun événement, perso ou journal parallèle.

Les snapshots et lectures de géométrie utilisés par le runner motion restent
internes à CodPlay, conformément aux spécifications `layout`, `move` et
`scroll-container`.

## Preuves

- `flux-anchor-player-markup.test.ts` vérifie le slot `data-part`, le nom CSS
  d’ancre et la conservation du pourcentage de réservation.
- `flux-scene-builder.test.ts` vérifie le `move.target` CodPlay, les styles du
  perso image et la déclaration `flowReservations` du layout.
- `layout-flow-reservation.spec.ts` vérifie deux réservations dans un même
  texte et leur ordre stable après un second calcul.
- `elce-anchor-extension.test.ts` vérifie le NodeView sans largeur d’ancre,
  son `anchor-name`, le `position-anchor` du bdc et la poignée.
- Safari confirme que l’image réelle de `1200 × 981 px` met à jour le
  `padding-bottom` de l’ancre à `81.75%` et le cadre à `1.22324159 / 1`, avec
  `object-fit:cover`. Après rechargement, ces valeurs restent dans le document
  Elcé ; le slot player réserve `calc(81.75% + 2rem)` et contient une seule
  image. Le typecheck et le build passent.
- Safari confirme aussi une image unique dans la preview réelle, `846 px` puis
  `670 px` de largeur, `16 px` de marge en haut et en bas, le texte continu
  avant le média et sa reprise après celui-ci. Un démontage/remontage de la
  preview conserve un seul slot et un seul perso.
- Le cycle réel A → B → A a reproduit le déplacement des deux vidéos avant le
  texte au retour sur A. Après correction, Safari refait le cycle dans la vraie
  preview : le `innerHTML`, la structure des nœuds, le texte et l’ordre des deux
  slots sont identiques avant et après. Le test `HtmlPlayerRunner.seek(0)` vérifie
  que `afterSeek` appelle `refresh()` et conserve aussi les enfants des slots.
- Safari confirme le 3 octobre 2026 le parcours d’une vidéo MP4 réelle déposée
  par l’éditeur : une ancre et un bdc sont sauvegardés, puis restaurés après
  rechargement IndexedDB. Le player monte le perso CodPlay `media` dans le slot
  existant, avec une réserve `56.25%` et un cadre `16 / 9`. Le contrôle Play
  démarre le clip. Le fichier d’essai mesure `442 × 300 px` et dure `5,89 s` ;
  la surface d’édition emploie `contain`, le player `cover`. L’édition de texte
  près de l’ancre, la parité de cadrage et le Seek direct des contrôles vidéo
  restent à valider dans le plan actif. Le replay de page A → B → A est vérifié
  séparément et n’est pas désactivé.

## Limites

Cette tranche vérifie le ratio de l’image et l’import, la persistance et le
montage d’une vidéo réelle. Le cycle A → B → A avec deux vidéos après correction
est vérifié ; l’édition de texte près de l’ancre, le Seek direct des contrôles
vidéo et le rendu visuel combiné de plusieurs ancres après resize restent à
éprouver avant de clore le lot. Le navigateur cible du POC doit
conserver le support des propriétés CSS utilisées ici.
