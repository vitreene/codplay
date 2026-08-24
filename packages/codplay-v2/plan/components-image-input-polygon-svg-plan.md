# CodPlay V2 - image, input, polygon et materializer SVG

## Statut

Status: Fixe - tranche de portage V1 accepte le 2026-08-24
CodPlay version: V2 foundation
Implementation: complete pour l'acceptance path ci-dessous

Cette tranche est autorisee par la decision de portage V1 vers V2. Les contrats
ci-dessous sont la reference de l'implementation et de son acceptance path.

## Perimetre

La tranche ajoute les trois types core suivants dans le catalogue V2 :

- `img`, le composant image V1 avec conservation d'une node native par source ;
- `input`, le composant de reponse quiz V1 ;
- `polygon`, le composant SVG specialise V1.

Elle installe aussi une materialisation SVG partageant le circuit DOM structurel
de la materialisation HTML. Cette tranche ne modifie pas le runtime V1 et
n'ouvre pas Canvas, Three.js, Rive ou Flutter.

## Invariants V2

- `BaseComponent` reste substrat-neutre ; les trois composants markup heritent de
  `BaseHTMLComponent`.
- `render()` retourne le template complet. Le composant ne parse pas son
  template et ne cree pas la racine materialisee.
- Le materializer conserve la racine et tous les `data-part`. La definition du
  catalogue choisit les parts publiables ; le composant ne publie pas de methode
  `getOutletsSnapshot()`.
- Play, Seek et la reconstruction utilisent le meme `Component.update(state,
  timeMs)`.
- Les services HTML/SVG sont appliques par node. Une facade de service peut donc
  projeter le root et plusieurs parts sans partager par erreur l'etat de
  reconciliation entre ces nodes.

## Composant `img`

Le type auteur reste `img`, conformement au contrat V1. Sa forme V2 est :

```ts
type ImageInitial = {
  src?: string
  alt?: string
  img?: { className?: ClassNameValue; style?: StyleValue; attr?: AttrValue }
  className?: ClassNameValue
  style?: StyleValue
  attr?: AttrValue
}
```

`fitMode` est retire du contrat V2 : il n'est ni lu, ni traduit en
`object-fit`, ni expose par les types. Le style de l'element interne passe par
`img.style`.

L'image conserve la decision V1 node-per-src :

- une node `<img>` persistante est creee par source rencontree ;
- `src` est assigne une seule fois, a la creation de cette node ;
- un changement de source detache la node active et rattache la node cible ;
- les nodes restent conservees pendant un detach et un seek ;
- une source absente du jeu statique est creee paresseusement ; la validation de
  disponibilite de ressource reste du ressort de la frontiere preload V2, qui ne
  fournit pas encore de reporter de diagnostic au composant.

Le root reste un wrapper `<div>`. La prop `img` cible la node interne et les
services `className`, `style` et `attr` du root ciblent le wrapper.

## Composant `input` et capacite layout

`InputComponent.render()` retourne une racine `label` avec cinq parts :

```text
control, label, selection-icon, correction-icon, hint
```

La definition core declare les services `className`, `style`, `attr` et
`content`, ainsi que la dependance `markup`. `markup` est le nom de
l'implementation V2 deja fixe pour la capacite layout/parts montables ; aucun
second module `layout` n'est cree.

Seules les parts suivantes sont publiees comme cibles de montage :

```text
selection-icon, correction-icon
```

Les cibles publiques sont derivees de l'identite runtime du composant pour
eviter toute collision entre inputs :
`${componentId}__selection-icon-slot` et
`${componentId}__correction-icon-slot`. Les noms ci-dessus restent les noms
logiques des parts ; `control`, `label` et `hint` restent prives.

Les semantics V1 suivantes sont
portees : proprietes natives de l'input, listes de selections et de bonnes
reponses, desactivation des reponses, revelation de la correction, et classes
visuelles `idle`, `selected`, `disabled`, `revealed-correct`,
`revealed-incorrect` et `revealed-missed-correct`.

Le composant recoit un etat deja resolu. Le resolver V2 conserve les champs
specifiques des composants dans l'etat et fusionne les definitions de parts
imbriquees ; `InputComponent` ne reconstruit donc pas son etat logique depuis le
DOM ni depuis un historique d'actions local.

## Materializer SVG

`SvgComponentMaterializer` reutilise l'implementation structurelle DOM commune
au materializer HTML : materialisation de template, collecte de parts,
enregistrement markup, parentage, ordre, detach et destruction. Sa difference
contractuelle est l'identifiant `svg` et le controle du namespace SVG de la
racine.

Les services `attr`, `className`, `style` et `content` sont disponibles pour les
materializers `html` et `svg`. Les adapters existants savent deja projeter les
attributs, classes et styles sur les elements SVG ; ils deviennent scopes par
node pour supporter les parts internes.

La materialisation SVG reste une materialisation DOM : elle ne constitue pas une
interface generique pour Canvas ou Three.js.

## Composant `polygon`

`PolygonComponent` herite de `BaseHTMLComponent` et retourne un template SVG
contenant :

- une racine `<svg viewBox="0 0 100 100">` ;
- un `<path data-part="path">` pour la geometrie ;
- un `<text data-part="content">` pour le contenu.

La geometrie V1 (`sides`, `inner`, `outer`, `rotationDeg`, `inflexion`) et les
algorithmes de normalisation, resampling, interpolation et serialisation du
path sont portes dans un dossier Polygon V2 dedie et testes par parite de
resultat.

Le morph est un comportement specialise du composant, pas un nouveau Behavior
global ni un appel direct a Anime.js. L'occurrence d'action active et son
`startAt` sont transmis facultativement a `update()` ; la forme courante est
calculee a partir de `timeMs`, `delayMs`, `duration` et `ease`. Cela rend le
morph deterministe au seek et anime le meme path pendant Play. Sans occurrence
temporelle disponible, le composant applique directement la forme cible.

Le path et le texte sont projetes par les services de materialisation sur leurs
parts respectives. Le composant ne modifie jamais la racine d'un autre
composant.

## Acceptance path

La tranche est acceptee seulement lorsque les preuves suivantes passent :

1. typecheck et tests V2 complets ;
2. validation et enregistrement catalogue des types `img`, `input` et
   `polygon` ;
3. image : aucune reassignment de `src` lors des changements de source et du
   seek, `fitMode` absent du contrat ;
4. input : cinq parts materialisees, deux seules cibles publiques, montage et
   retrait atomique via `markup`, et etat natif/correction repetable ;
5. SVG : namespace reel, services sur root et parts, parentage structurel et
   destruction ;
6. polygon : sorties geometriques V1, refresh sans recreation de racine, morph
   a progression 0/1 et seek vers la forme finale.

Les README des nouveaux dossiers portent le statut de la tranche et restent
alignes avec ce document avant sa cloture.
