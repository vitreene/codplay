# CodPlay V2 - image, input, polygon et materialisation HTML/DOM

## Statut

Status: Fixe - tranche de portage V1 accepte le 2026-08-24
CodPlay version: V2 foundation
Implementation: complete — extension du contrat polygon validée le 2026-08-29

Cette tranche est autorisee par la decision de portage V1 vers V2. Les contrats
ci-dessous sont la reference de l'implementation et de son acceptance path.

## Perimetre

La tranche ajoute les trois types core suivants dans le catalogue V2 :

- `img`, le composant image V1 avec conservation d'une node native par source ;
- `input`, le composant de reponse quiz V1 ;
- `polygon`, le composant SVG specialise V1.

Le composant `polygon` produit du balisage SVG, pris en charge par l'unique
materialisation HTML/DOM. Cette tranche ne modifie pas le runtime V1 et n'ouvre
pas de materialisation Canvas, Three.js, Rive ou Flutter.

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

## Organisation des profils core

Chaque composant core suit la meme frontiere de donnees :

```text
<component>/
  <component>-types.ts       # profil *Initial du perso et etat compile
  <component>-validation.ts  # validation SceneDoc + sanitation pure
  <component>-component.ts   # projection runtime
  index.ts                   # surface publique du dossier
```

`BaseComponentData` declare les champs communs `content`, `className`, `style`
et `attr`. Les profils `*Initial` des composants sont les types des
`perso.initial` recus par leurs classes et constituent la reference humaine de
la donnee acceptee. Les validateurs restent a la frontiere dynamique de
`SceneDoc`; les sanitation callbacks publies dans `RuntimeCapabilityCatalog`
completent les defaults et normalisent les formes une seule fois dans le
builder, avant `CompiledScene`.

La classe runtime ne revalide pas les donnees auteur. Ses gardes restantes sont
des gardes de substrat ou d'effet externe (node DOM, horloge native, ressource
preload), pas des controles de profil.

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

La classe core declare les services `className`, `style`, `attr` et `content`,
tandis que la definition du catalogue porte la dependance `markup`. `markup` est le nom de
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

## SVG dans la materialisation HTML/DOM

`HtmlComponentMaterializer` prend en charge le template SVG de `polygon` comme
n'importe quel template HTML : materialisation du template, collecte des parts,
enregistrement markup, parentage, ordre, détachement et destruction. Le parsing
DOM conserve le namespace SVG réel de la racine et de ses descendants ; aucun
materializer SVG distinct ni aucun identifiant `svg` n'est introduit.

Les services `attr`, `className`, `style` et `content` sont disponibles pour les
nœuds HTML et SVG via le même materializer HTML/DOM. Les adapters existants
savent déjà projeter les attributs, classes et styles sur les éléments SVG ; ils
restent attachés aux nœuds désignés par le composant.

Le contexte Three.js éventuel d'un composant spécialisé reste la propriété de ce
composant et n'est pas créé par le materializer.

## Composant `polygon`

`PolygonComponent` herite de `BaseHTMLComponent` et retourne un template SVG
contenant :

- une racine `<svg viewBox="0 0 100 100">` ;
- un `<path data-part="path">` pour la geometrie ;
- un `<text data-part="content">` pour le contenu.

La geometrie V1 (`sides`, `inner`, `outer`, `rotationDeg`, `inflexion`) est
decrite dans `polygon-types.ts`. `polygon-validation.ts` valide et complete le
profil au build ; `polygon-geometry.ts` ne recoit ensuite que des nombres
compiles et porte les derives geometriques, le resampling, l'interpolation et
la serialisation du path. Il ne contient plus de fallback auteur ni de garde de
valeur `unknown`.

Le morph est un comportement specialise du composant, pas un nouveau Behavior
global ni un appel direct a Anime.js. L'occurrence d'action active et son
`startAt` sont transmis facultativement a `update()` ; la forme courante est
calculee a partir de `timeMs`, `delayMs`, `duration`, `ease` et `sampleCount`.
Lorsque le runtime fournit `registerAnimation`, le composant enregistre alors
un flux de presentation cadence par l'horloge du player ; le runtime n'applique
que les echantillons dont la valeur differe. Le morph reste ainsi deterministe
au seek et anime le meme path pendant Play sans rappeler `update()` a chaque
tick. Un appel direct du composant sans ce callback conserve la projection
immediate utile aux tests de la classe.

Le path et le texte sont projetes par les services de materialisation sur leurs
parts respectives. Le composant ne modifie jamais la racine d'un autre
composant.

## Extension du contrat polygon acceptée le 2026-08-29

`polygon` est un composant spécialisé : ses propriétés métier et leurs
conséquences de rendu lui appartiennent. Le contrat V2 étend donc le profil
polygon avec `diameter`, en plus des propriétés géométriques déjà présentes.

Les contrôles émettent directement un seul événement sémantique par paramètre,
sous le nom `polygon:<parameter>` ; aucun suffixe `:raw` ni transform de scène
n'est nécessaire. Le payload DOM conserve la valeur native générique `value`.
Les actions des persos intéressés diffusent ce même événement ; chacun réalise
sa projection au plus près de lui. `PolygonComponent` associe le nom de son
action à sa propriété (`sides`, `inner`, `outer`, `inflexion`, `diameter`),
normalise la valeur et projette le chemin SVG ou `width`/`height` en pixels.
Le contrôle et son `output` projettent leur propre `value`. Aucun patch CSS,
événement `polygon:update` ou duplication `polygon:value:*` n'est produit par
la scène.

Cette spécialisation reste interne au composant et réutilise le service `style`
existant ; elle ne crée pas de service polygon global. Elle constitue le modèle
V2 pour une propriété propre à un composant qui doit produire plusieurs effets
de présentation.

### Écart non normatif de la démo morph

La démo conserve dans `packages/demos/src/v2/demos/polygon/main.ts` une fonction
nommée `createMorphStrap` qui alterne deux séquences à l'aide d'un état local
capturé par fermeture. Elle est déclarée dans `StoryDoc.straps` et appelée par la
règle `listen.straps`. Cet état local est une tolérance propre à cette fixture et
ne constitue pas un contrat V2. Dans une implémentation normative, l'état de
l'alternance appartient à la `StoryDoc` et passe par le state runtime ; il ne
vit pas dans la fonction de production d'événements.

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
7. polygon : une propriété `diameter` dynamique est normalisée et projetée par
   le composant, sans événement `polygon:update`, suffixe `:raw`, transform de
   scène, `polygon:value:*` ni calcul CSS dans la scène ; un seul événement
   `polygon:<parameter>` est diffusé aux persos intéressés.

Les README des nouveaux dossiers portent le statut de la tranche et restent
alignes avec ce document avant sa cloture.
