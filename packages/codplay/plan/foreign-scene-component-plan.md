# CodPlay V2 — composant core de contenu foreign

## Statut

- **Statut : En cours — première tranche d'implémentation autorisée le 2026-09-11**
- **Version : CodPlay V2 foundation**
- **Implémentation : tranche profil/validation et surface HTML d'attachement en cours**
- **Nom de travail : `ForeignContentComponent` / type auteur `slot`**

Ce plan définit un composant du core CodPlay et la capacité de remplacement de
contenu dont il a besoin. Le type auteur `slot` désigne sa fonction d'hôte ; la
capacité `foreign-content` désigne la représentation opaque qu'il expose. Le
plan ne définit pas d'orchestrateur d'application ni de composition de vues.

Le nom du fichier est conservé pour éviter une nouvelle rupture de liens. Le
composant n'est toutefois pas un composant « scène » spécialisé : une scène
CodPlay est son premier usage, aux côtés d'une iframe, d'un flux vidéo ou d'un
autre contenu pris en charge par son propriétaire de représentation.

L'autorisation d'implémenter a été donnée le 2026-09-11. La tranche engagée
couvre le type auteur `slot`, la validation du `name` racine, le manifeste de
découverte, la surface HTML qui attache/détache des racines foreign et le
module partagé `replace` raccordé aux hooks V2 pour le chemin `fade`. Le
profil `slot` accepte `replace.split` mais l'ignore. L'orchestration
interinstances et l'exposition de la surface par la façade publique restent à
traiter ; aucune de ces capacités n'est présentée comme déjà disponible.

La spécification de la tranche effectivement codée est suivie dans
[`../specs/slot-component-spec.md`](../specs/slot-component-spec.md).

## Séparation avec la démonstration Sighty A/B

Ce document porte sur l'expression de besoin et le plan d'implémentation du
composant core `slot`. Cette expression est générique : la scène CodPlay est un
premier consommateur du contenu foreign, au même titre qu'une iframe, un média,
un flux ou toute autre représentation attachable.

La description détaillée du scénario A/B appartient à la [note du modèle
déclaratif Sighty](../../sighty/notes/2026-08-17-modele-fichier-declaratif.md),
et son exécution est suivie dans le [plan de première implémentation
Sighty](../../sighty/plan/2026-09-10-premiere-implementation-plan.md). Dans ce
plan CodPlay, ce scénario n'apparaît qu'à deux titres : comme exemple de
consommation et comme parcours d'intégration réel. Il ne fixe ni le nombre de
slots, ni le nombre de scènes, ni le style, ni l'orchestrateur du composant.

Si la démo révèle une capacité manquante, le besoin doit être reformulé en
termes génériques du contrat core avant toute modification du runtime. Les
choix propres à A/B restent dans le périmètre Sighty et ne peuvent pas être
ajoutés implicitement au profil `slot`.

## Expression de besoin du composant

Le composant est un **hôte d'exposition** très simple :

```text
SlotComponent (`ForeignContentComponent`)
  └─ racine HTML : <div> par défaut (tag configurable)
       └─ content foreign opaque
```

Il se comporte comme un `TagComponent` pour sa racine. Il reçoit une balise
(`div` par défaut) et, lorsqu'il sert de point d'accueil à une composition,
déclare l'identité de son slot hôte. Il expose ensuite les services visuels
ordinaires : `className`, `style` et `attr`. Le core possède cette racine et
fournit les points d'exécution des états d'apparition, de disparition et des
animations déclarées ; il ne choisit pas pour autant leur style, leur
dimensionnement ou leur mise en page. Ces choix appartiennent à l'auteur de la
scène ou à un composant auteur qui les encapsule.

Le contenu est différent d'un contenu de tag : le composant **ne l'interprète
pas**. Il ne parcourt pas l'arbre d'une scène enfant, ne connaît pas l'API d'un
player, ne lit pas le contenu d'une iframe et ne pilote pas le flux vidéo. Le
propriétaire de la représentation fournit ou retire le contenu via la surface
`foreignContent`, et le materializer réalise l'écriture DOM dans la racine. Le
composant fournit la frontière technique d'exposition par sa boîte ; les choix
visuels de cette boîte et du contenu restent ceux de l'auteur.

Les cas de contenu visés sont :

- une ou plusieurs racines d'une instance CodPlay enfant ;
- une iframe d'un site externe ;
- une vidéo ou un flux broadcast fourni par une capacité externe ;
- tout autre contenu dont un materializer peut fournir une représentation
  attachable.

Le composant ne crée ni player, ni catalogue, ni ticker. Une scène enfant reste
une instance CodPlay autonome. Son temps, ses ressources, son cycle de vie et
ses events sont possédés par le propriétaire de cette instance (Sighty ou une
application), pas par le composant hôte.

### Vocabulaire de la frontière foreign

« Propriétaire de la représentation foreign » désigne ici le code applicatif ou
la capacité qui détient les racines persistantes et les ressources d'un contenu
non interprété par CodPlay. Ce n'est pas une classe `Adapter` fournie par le
core V2 : à ce stade, la surface concrète est `ForeignContentSurface`, et le
code qui la consomme reste à définir dans le raccord d'application/Sighty.
Pour une scène CodPlay, ce propriétaire est Sighty pour la décision de cycle de
vie et le player enfant pour ses racines et ressources ; pour une iframe ou un
flux, c'est le code qui les crée et les détient.

Ce propriétaire n'a pas à déclarer une capacité de clonage. Le clone de
`replace` est un instantané visuel temporaire créé par le materializer HTML,
piloté par le module `replace` uniquement via une surface de présentation, et
détruit par cette même surface. Il ne charge ni ne pilote la représentation
foreign et ne transfère jamais sa propriété.

## Bases normatives relues

Les décisions de ce plan reprennent les contrats suivants.

| Référence | Règle reprise |
| --- | --- |
| [`2026-08-01-composant-v2-contract.md`](./notes/2026-08-01-composant-v2-contract.md) | `BaseComponent`/`BaseHTMLComponent`, `render()` one-shot, racine possédée par le composant, `update()` comme entrée d'état unique et absence d'opinion visuelle implicite dans le core. |
| [`component-render-representation-plan.md`](./component-render-representation-plan.md) | Le materializer crée et conserve les nœuds HTML ; le composant ne reconstruit jamais l'état depuis le DOM. |
| [`2026-08-01-runtime-modules-capabilities.md`](./notes/2026-08-01-runtime-modules-capabilities.md) | Une capacité stateful est enregistrée au catalogue puis instanciée par player ; elle n'est pas un helper local. |
| [`../../../docs/formalisation/v1-component-api.md`](../../../docs/formalisation/v1-component-api.md) | Le composant déclare les services dont il a besoin et les applique dans `update()` ; la racine HTML reste dans la frontière de materialization. |
| [`../../../docs/formalisation/v1-perso-spec.md`](../../../docs/formalisation/v1-perso-spec.md) | `name` est une propriété racine du perso, distincte de l'`id` runtime ; le profil `slot` en fait une clé de composition stable. |
| [`../../../docs/formalisation/v1-module-api.md`](../../../docs/formalisation/v1-module-api.md) | Un module peut avoir une face runtime et une face composant ; le runtime le sélectionne par hooks et capacités, sans branche métier dédiée. |
| [`../../authoring/capsule-automation/src/core/build-grid.ts`](../../authoring/capsule-automation/src/core/build-grid.ts) | L'artefact `sceneRoot` existant fournit une classe de remplissage (`ac-scene-root`) ; il constitue une piste de réutilisation à vérifier, pas une dépendance implicite du core. |
| [`../../../docs/plans/2026-06-09-replace-plan.md`](../../../docs/plans/2026-06-09-replace-plan.md) §3–§4.1, §7–§11 | La propriété `replace` accompagne un changement de `content` ou de `src` ; `replace-simple` capture l'état sortant dans un clone temporaire, anime et nettoie. |
| [`../../../docs/formalisation/2026-06-10-replace-module-emit-spec.md`](../../../docs/formalisation/2026-06-10-replace-module-emit-spec.md) §2–§3 | Les circuits sync/async, les événements techniques et la reprise déterministe au seek appartiennent au module, pas au composant. |
| [`../../codplay-v1/src/runtime/modules/replace/index.ts`](../../codplay-v1/src/runtime/modules/replace/index.ts) et [`apply-simple.ts`](../../codplay-v1/src/runtime/modules/replace/apply-simple.ts) | Implémentation V1 de référence : hooks `beforeUpdate`/`afterUpdate`, session de clones, transition groupée et nettoyage idempotent. |
| [`../../demos/src/v1/codplay/replace-carousel-demo.ts`](../../demos/src/v1/codplay/replace-carousel-demo.ts) et sa scène | Fixture utilisateur montrant un changement déclaré avec `replace`, sans appel direct au DOM ou au module. |
| [`./notes/2026-07-28-decoupage-engine-instances-pilotage.md`](./notes/2026-07-28-decoupage-engine-instances-pilotage.md) §5 | Le perso hôte suit les conditions ordinaires d'un perso et ignore la nature de son contenu ; les instances restent indépendantes. |
| [`../projet/notes/2026-07-27-emetteurs-et-events-user-complexes.md`](../projet/notes/2026-07-27-emetteurs-et-events-user-complexes.md) §6 | Un flux direct est à `now` ; seul son hôte est dans la timeline et son régime de non-relecture est déclaré. |

Le dernier document est dans `packages/codplay/projet/notes` ; le lien reste
relatif à ce plan pour que la source de la décision soit visible.

## Séparation des responsabilités

| Élément | Possède | Ne fait pas |
| --- | --- | --- |
| `ForeignContentComponent` | La racine HTML, les services visuels, l'exposition et les points d'exécution des états et animations déclarés | Lire ou transformer le contenu foreign, choisir une politique CSS par défaut, créer un player, router un event vers une autre scène |
| Propriétaire de la représentation foreign (raccord d'application) | Les racines persistantes, les ressources, le chargement et les opérations propres au support ; il consomme `foreignContent` pour demander le montage/démontage | Choisir le style de la boîte hôte, créer un clone de transition, gérer la présentation ou imposer une politique visuelle au composant |
| Module `replace` | La session de remplacement, la demande d'instantané de présentation, les transitions, l'annulation et le nettoyage | Connaître une classe de composant, charger/cloner le contenu foreign ou gérer le player du contenu |
| `TagComponent` / `ImageComponent` / autres composants compatibles | Leur rendu et leurs services propres | Réimplémenter la mécanique de clone du module `replace` |
| Composant auteur de l'application | Une structure et une opinion de style si l'auteur souhaite les encapsuler | Faire passer cette opinion pour une règle du core ou modifier le contenu qu'il ne possède pas |
| `HtmlComponentMaterializer` | La création des racines, l'écriture DOM effective du montage/détachement, l'instantané DOM temporaire de présentation et les références de materialization | Interpréter la provenance du contenu foreign ou décider du cycle de vie de la ressource fournie par son propriétaire |
| Player de la scène enfant | Son état, sa timeline, ses racines et ses ressources, ainsi que l'exécution de son teardown | Décider seul quand l'occurrence doit être créée, montée, pilotée ou détruite, ou connaître la scène hôte |
| Sighty ou l'application hôte | Les instances, leurs relations, le choix du contenu et le pilotage du cycle de vie des occurrences | Manipuler directement le DOM ou installer un player parallèle dans le composant |

## Décision de frontière du cycle de vie (2026-09-11)

Pour une scène CodPlay hébergée, Sighty possède la politique et le pilotage du
cycle de vie de l'occurrence : création, montage, démarrage, pause/reprise,
seek, démontage, remontage et destruction. CodPlay fournit les opérations
d'instance, l'ordonnancement de l'engine et l'exécution du teardown ; le
composant `slot` fournit uniquement la boîte et la relation d'attachement de
ses racines foreign. Il ne crée ni ne détruit le player enfant et ne transforme
pas un détachement DOM en décision de survie.

Cette décision permet une première tranche limitée au scénario Sighty A/B. Elle
ne prétend pas figer toutes les politiques de fin, de reprise ou d'échec : la
démo doit exercer le chemin réel, puis fournir les faits permettant d'affiner
ces règles dans le plan Sighty sans élargir le contrat générique de `slot`.

Le composant est donc un perso ordinaire du point de vue de la scène hôte. La
relation « cette représentation vient de telle instance » est une association
runtime externe ; elle ne transforme pas le composant en layout et ne donne pas
à la scène hôte une API sur la scène enfant.

Le materializer HTML ne sait donc pas si la représentation montée vient d'une
scène CodPlay, d'une iframe ou d'un flux. Il projette la racine et les opérations
DOM demandées par le composant et les capacités. Pour une scène CodPlay,
Sighty décide quand arrêter, détacher ou détruire l'occurrence ; pour les autres
supports, la décision relève du propriétaire de la représentation. Elle ne
peut jamais être déduite du seul fait que le contenu est monté dans une racine
HTML.

## Profil auteur et frontière runtime

Le profil de la première tranche est fixé ci-dessous à deux niveaux clairement
séparés : la déclaration structurelle du slot et la représentation foreign
résolue à la frontière runtime.

La règle `name` appartient au profil auteur générique du composant `slot`. Les
paragraphes qui mentionnent `view.slots` précisent uniquement le raccord d'un
consommateur Sighty ; ils ne transforment pas ce modèle de composition en
contrat obligatoire pour les autres contenus foreign.

### Déclaration générique du slot

Pour un perso de type `slot`, `name` est requis, résolu avant la compilation et
ne peut pas être modifié par une valeur `initial` ou une action. `name` existe
déjà à la racine de `PersoDoc` et de `CompiledPerso` ; le profil `slot` en
resserre la règle de stabilité et recopie sa valeur une fois lors de la
normalisation et de la compilation. Il ne fait pas partie de `initial`, n'est
pas une entrée de `update()` et ne peut pas être remplacé par une mise à jour de
contenu. Le champ `content` reste réservé à la représentation foreign elle-même.

Cette déclaration est un invariant du composant, quelle que soit l'application
qui consomme sa surface. Elle ne présuppose ni `view.slots`, ni Sighty, ni une
scène CodPlay enfant.

### Raccord Sighty du consommateur

Le raccord Sighty est une règle de consommation de ce composant, pas une
extension de son contrat. Un slot Sighty ne doit pas être déduit de
l'identifiant du perso ni d'un élément DOM. Si une vue Sighty déclare
`slots.body`, la scène hôte doit déclarer explicitement l'identité `body` sur le
composant `slot` qui accueille cette vue. Cette identité est portée par la
propriété racine `name` du perso :

```ts
{
  id: 'body-host',
  name: 'body',
  type: 'slot',
  // `initial` absent : la racine reste un <div>.
}
```

Ici, `body-host` est l'identifiant du perso CodPlay et `body` est le nom du
slot Sighty : ces deux identifiants sont volontairement distincts. Le champ
`content` n'est pas utilisé pour nommer le slot.

La règle est bijective pour une composition donnée : pour chaque clé
`view.slots.<slotName>`, il existe exactement un composant `slot` de la scène
hôte avec `name === <slotName>` ; inversement, chaque composant `slot`
utilisé comme hôte Sighty est référencé par une clé de `view.slots`. Une clé
absente, une valeur différente ou plusieurs composants pour le même slot sont
des erreurs de validation de la composition, avant la création des instances.

`name` est donc une déclaration structurelle de composition, pas un état du
composant ni le contenu DOM d'une scène enfant. Il ne devient ni un `data-part`,
ni un outlet, ni une donnée envoyée au service de contenu textuel de `TagComponent`.
CodPlay valide sa forme sérialisable ; le validateur de composition Sighty
établit la correspondance dans les deux sens : chaque clé de `view.slots` désigne
un composant `slot` dont `name` porte explicitement le même nom, et un composant
déclaré pour un slot ne peut pas rester sans clé Sighty dans une composition qui
l'emploie. L'égalité accidentelle entre `perso.id` et le nom du slot ne constitue
pas cette déclaration.

### Découverte des slots par l'auteur

Le nom d'un slot peut être difficile à retrouver lorsqu'il est produit par une
étape de génération de la scène. Il ne doit donc être ni deviné à partir du
`perso.id`, ni recherché dans le DOM. La compilation de la scène hôte doit
produire un manifeste d'auteur à partir des déclarations `type: 'slot'` et
`name`, après l'expansion des données générées. Ce manifeste expose, pour
chaque slot, au minimum son nom, sa story, le `perso.id` porteur et le chemin de
déclaration dans la scène.

Le helper d'authoring direct de la première tranche est exporté par le module
CodPlay ; son éventuel regroupement sous une propriété de façade reste une
décision distincte :

```ts
import { slotManifest } from 'codplay'

const slots = slotManifest(hostScene, {
  storyId: 'main',
})

// Valeur sérialisable retournée par le helper :
// [
//   {
//     slot: 'body',
//     storyId: 'main',
//     persoId: 'body-host',
//     sourcePath: 'stories.main.persos[0].name',
//   },
// ]
```

`slotManifest` lit le document ou le manifeste compilé ; il ne démarre pas de
player, ne consulte pas le DOM et ne crée pas d'adresse runtime. L'auteur peut
reprendre la valeur `slot` exacte pour écrire ou vérifier la clé
`view.slots.<nom>`, y compris lorsque le nom provient d'une génération. Le
helper est une aide d'authoring et de validation : son appel n'est pas
sérialisé dans `SceneDoc`, `CompiledScene` ou le fichier Sighty, qui restent des
données déclaratives.

`resolveSlotManifestEntry` fournit la résolution exacte et son diagnostic
structuré ; l'application auteur choisit le canal d'affichage (warning ou
erreur) sans ajouter un second catalogue de slots.

Si le nom demandé n'existe pas, ou si plusieurs composants portent le même nom
dans la portée demandée, le validateur de composition qui s'appuie sur ce
manifeste doit publier un diagnostic explicite dans le canal d'authoring. Le
message contient le nom demandé, la scène et la story visées, le chemin de la
référence erronée, les noms disponibles et le chemin de chaque déclaration
candidate. Par exemple :

```text
Slot "body" introuvable dans la scène "host", story "main".
Référence : view.slots.body
Slots disponibles dans cette portée : "header", "footer".
Déclarations trouvées : stories.main.persos[1].name = "header" ;
stories.main.persos[2].name = "footer".
```

Une correspondance impossible empêche le montage et reste donc un diagnostic
`error` de validation CodPlay. Le canal d'authoring de Sighty peut le traduire
en warning visible et actionnable, avec ce même détail, sans créer un second
circuit de diagnostic ; il ne doit jamais laisser une zone vide ni choisir un
slot par approximation. Un nom généré est découvrable si sa génération est
terminée avant la production du manifeste ; une génération runtime qui ne
produit aucune déclaration sérialisable est hors de ce contrat et doit être
signalée comme telle.

Dans le cas d'une iframe, d'un flux broadcast ou d'un autre contenu foreign,
`initial.content` peut porter une référence sérialisable propre à la capacité
concernée. Il n'existe pas de valeur universelle à inventer dans le composant :
la forme de cette référence est validée par le propriétaire de la représentation
qui sait la résoudre.

### Référence déclarative

La scène et les eventimes doivent conserver une valeur de contenu sérialisable,
mais le composant n'en tire aucune sémantique de type. Une forme `{ kind, id }`
n'apporte rien à `ForeignContentComponent` : elle ne change ni son rendu, ni son
exposition, ni ses transitions. Elle ne serait utile qu'à un résolveur externe,
et sa place éventuelle est donc dans le contrat de la capacité ou de l'hôte,
jamais dans le contrat du composant.

La forme exacte de cette référence reste à arrêter avec le raccord
`foreign-content`. La seule contrainte retenue ici est qu'elle ne contienne
jamais une `HTMLElement`, un `RuntimePlayer`, une fonction de construction ou un
objet mutable. Le builder et le codec devront valider et conserver la forme
finalement retenue dans `CompiledScene`, tandis que la résolution vers une valeur
runtime opaque restera hors de l'artefact sérialisable.

### Valeur runtime opaque

À la frontière de materialization, la référence est résolue en une valeur
opaque fournie par le propriétaire de la représentation. Le contrat à arrêter
doit permettre au materializer de :

1. recevoir du propriétaire une représentation ordonnée (une ou plusieurs
   racines) dans le runtime ;
2. monter ces racines dans la racine du composant ;
3. les retirer sans détruire la ressource ou le player qui les possède ;
4. signaler une disponibilité asynchrone si le support en a besoin ;
5. offrir au module `replace` une surface de présentation qui peut, si le
   support HTML le permet, créer un instantané DOM temporaire de la racine
   hôte. Cette opération ne clone ni ne pilote une ressource foreign et ne
   demande aucune décision de clonage au propriétaire du contenu.

Le composant ne reçoit pas les détails de ces opérations. Il demande seulement
que le contenu courant soit exposé dans sa racine. Le contenu foreign peut être
un fragment à plusieurs racines ; la racine du composant reste l'hôte
structurel, et une capacité de transition peut la choisir comme cible lorsque
la transition est déclarée. Ce choix n'ajoute aucune règle CSS implicite.

### Point d'insertion DOM et ownership

La référence sérialisée n'est jamais le nœud qui sera inséré. Elle permet de
résoudre l'instance et la cible logique ; l'insertion arrive ensuite, à la
frontière HTML de l'instance hôte.

Le point d'insertion est la racine déjà materialisée du perso hôte de type
`slot` de l'instance parent (`hostRoot`). Cette racine est créée par
[`HtmlComponentMaterializer.materializeComponent`](../src/runtime/runner-html/component-materializer.ts#L52), puis conservée dans le
registre de materialization du player hôte. Sighty ne la recherche pas avec
`querySelector` et ne reçoit pas le nœud.

Pour une scène enfant, le chemin CodPlay retenu comme cible de la phase
d'adressage est le suivant ; la surface publique entre instances reste à
arrêter avant son implémentation :

1. Sighty adresse le perso hôte avec `{ instanceId, storyId, persoId }` et
   adresse séparément l'instance enfant.
2. Une surface runtime de mode hôte résout cette adresse en `hostRoot` et
   demande à l'instance enfant une représentation de ses racines persistantes.
   Cette surface est interne à CodPlay ; sa forme publique reste à fixer.
3. Le propriétaire de la représentation fournit les racines à la surface
   `foreignContent`; le `HtmlComponentMaterializer` est le writer DOM de la
   frontière HTML. Pour
   un hôte vide, l'opération réelle est équivalente à :

   ```ts
   // Runtime uniquement : ni Sighty ni le composant n'exécutent ce code.
   for (const childRoot of childRepresentation.roots) {
     hostRoot.appendChild(childRoot)
   }
   ```

   Si une représentation doit être placée avant une racine déjà attachée, la
   même surface utilise `hostRoot.insertBefore(childRoot, referenceRoot)`.
4. Le raccord conserve les racines attachées et fournit le détachement associé :

   ```ts
   // Détachement de l'attachement, sans destruction de l'instance enfant.
   if (childRoot.parentNode === hostRoot) hostRoot.removeChild(childRoot)
   ```

   La propriété des racines et leur destruction restent celles du player enfant ;
   le raccord ne possède que la relation d'attachement. `hostRoot` reste la
   racine du composant parent, qui conserve le contrôle de ses états et
   animations déclarés.

Il n'existe pas de méthode DOM standard `element.insertNode`. Pour les persos
d'une même scène, cette écriture existe déjà dans
[`HtmlComponentMaterializer.reconcileStructuredNode`](../src/runtime/runner-html/component-materializer.ts#L221) : elle appelle
`parent.insertBefore(...)` lorsqu'une racine de référence est présente, sinon
`parent.appendChild(...)`, puis `parent.removeChild(...)` au détachement. Le cas
foreign entre deux players ne peut pas réutiliser directement la map
`persoNodes` de cette réconciliation, car chaque player possède son propre
materializer. Il faut donc arrêter une surface d'attachement CodPlay qui appelle
ces mêmes primitives pour le raccord foreign.

Lors d'un `replace`, la surface de présentation HTML crée un instantané
temporaire de `hostRoot` et le module le garde visible le temps de sa
disparition. Cet artefact ne devient ni une racine de l'instance enfant ni un
perso ; il ne possède aucune ressource et son retrait est séparé du
détachement de la représentation persistante.

## Rendu et comportement ordinaire

Le composant suit le modèle de `TagComponent` :

- `render()` retourne un tag simple ; l'absence de `tag` produit `div` ;
- aucun `markup`, `data-part` ou outlet n'est créé par ce composant ;
- `update()` applique `className`, `style`, `attr` et la valeur de contenu
  résolue par la capacité opaque ;
- l'état logique vient toujours de `SolvedPerso.state` ; le DOM courant ne sert
  jamais de source de vérité ;
- une animation d'apparition ou de disparition déclarée agit sur la racine hôte
  par les services prévus, sans valeur CSS implicite ni règle de placement
  choisie par le core ;
- l'instance de contenu conserve son propre cycle de vie et ne reçoit pas les
  events du clone de transition.

Sans propriété `replace`, un changement de contenu suit la politique ordinaire
du propriétaire de la représentation : le nouveau contenu remplace l'ancien
dans la racine. Le
composant ne déduit pas automatiquement une transition.

### Principe de présentation

Le core fournit une structure et des capacités ; il ne porte pas une opinion
visuelle. Le `div` par défaut est une décision de structure HTML, pas une
feuille de style. Le composant n'impose donc ni couleurs, ni dimensions, ni
mode d'affichage, ni ratio, ni débordement, ni alignement. Une transition comme
`replace: 'fade'` n'est exécutée que parce qu'elle est déclarée par l'auteur ;
elle ne constitue pas un style implicite du composant.

Un composant auteur peut encapsuler une opinion de style lorsque l'application
le souhaite. Cette opinion est alors documentée et appliquée par ce composant
ou par la feuille de l'application ; elle ne devient pas une règle du
composant core `slot`.

### Recommandations CSS d'intégration

Le montage des racines foreign ne garantit pas à lui seul leur adaptation
visuelle. La coordination entre le **conteneur parent**, la racine hôte
`hostRoot` et les racines fournies par le contenu (`foreignRoot`) relève de
l'application auteur qui intègre le composant :

- le conteneur parent fournit la place disponible selon son layout et ses
  propres contraintes ;
- `hostRoot`, racine du perso `slot`, expose cette boîte et porte les propriétés
  de visibilité, de transition et de présentation choisies pour l'hôte ;
- chaque `foreignRoot` reçoit les règles nécessaires pour s'inscrire dans
  `hostRoot`, sans que le composant inspecte sa structure.

Pour commencer, l'application auteur peut tester des règles comme
`width: 100%`, `height: 100%`, `min-width: 0`, `min-height: 0`, `display: block`
et, lorsque le contenu emploie des unités `cqw`/`cqh`, un contexte
`container-type: size` établi par l'hôte. Elle choisit aussi, selon le support,
la politique de ratio (`contain`, `cover` ou conservation naturelle), de
positionnement et de débordement. Rien de cela ne peut être déduit du seul fait
que la racine est un `<div>`. `move.resize` règle une dimension de déplacement ;
il ne remplace pas les règles d'intégration du contenu foreign. Une information
destinée au contenu peut être propagée par le CSS choisi (contexte de requête,
propriétés custom ou classes générées), sans mesure DOM cachée dans le
composant.

Le composant core continue d'appliquer `className` et `style` à `hostRoot` et
d'exposer les racines au materializer. L'application auteur choisit et applique
les classes ou styles nécessaires aux `foreignRoot`, par le propriétaire de la
représentation ou par sa
propre feuille de présentation ; Sighty ne modifie aucune racine DOM. Une iframe,
une scène CodPlay et une vidéo peuvent ainsi recevoir des règles différentes
tout en partageant le même hôte.

`packages/authoring/capsule-automation` fournit déjà, pour un artefact marqué
`sceneRoot`, la classe `ac-scene-root` et une feuille qui combine remplissage,
bornes minimales, débordement et contexte de requête de taille. L'application
auteur peut la réutiliser si elle couvre son cas et si la feuille générée est
chargée par son canal CSS. Cette sortie ne définit pas l'adaptation d'une
iframe, d'un flux ou d'une représentation à plusieurs racines ; son
`overflow: hidden` reste une décision de découpe à accepter ou non selon le
support et l'effet visuel.

La comparaison avec `capsule-automation`, ainsi que la définition d'éventuelles
classes helpers ou de règles supplémentaires, appartient donc à l'application
auteur. Ces recommandations ne créent ni service CSS obligatoire dans CodPlay,
ni gate d'implémentation du composant. Si un helper est retenu, il doit rester
dans la frontière d'authoring ou de présentation de l'application jusqu'à ce
qu'une extension core fasse l'objet d'un plan séparé et accepté.

## Capacité partagée `replace`

### Positionnement

`replace` est un **module runtime partagé**, analogue à `move` par son accroche
au cycle runtime. Les services `style`, `className`, `attr` de la racine
fournissent les patches stateless ; `replace` conserve une session de
présentation, coordonne plusieurs animations et doit donc être instancié une
fois par player.

Le module est enregistré par le `RuntimeCapabilityCatalog` core. Un composant
ne l'installe pas lui-même. La définition runtime du composant déclare la
capacité requise et le runtime fournit l'instance du module, selon le modèle
V2 des `RuntimeModuleServiceDefinition` et
`RuntimeModuleServiceInstance`.

La capacité doit être réutilisable par tout composant qui expose une cible de
remplacement compatible : `tag`, `text`, `img`, `media`, `foreign` ou un futur
composant. Le module ne teste pas `instanceof ForeignContentComponent` et ne
contient aucune branche liée à Sighty.

### Contrat du module partagé et profil de contenu `foreign-content`

La propriété d'action reprend la forme simple de V1, sous réserve de la
validation V2 du catalogue :

```ts
{ replace: 'fade' }

{
  replace: {
    transition: 'fade',
    duration?: number,
  },
  content: /* nouvelle valeur */,
}
```

Cette forme est le profil accepté par le composant `slot` lorsqu'il expose la
capacité `foreign-content` dans cette version : il ne fournit que
`replace-simple` avec une transition `fade`. La propriété `replace.split` peut
être présente pour conserver une déclaration compatible avec le module partagé,
mais elle n'a aucune sémantique pour une représentation opaque et est ignorée
par le profil `slot`, sans diagnostic de rejet. Le runtime normalise alors la
commande sur `replace-simple` ; aucune logique de split n'est activée.

La spécification V1 générale documente aussi les variantes
`replace-split-text` et `replace-split-cells`, sélectionnées par `split`. Cette
extension reste une capacité future du module partagé pour des composants qui
la déclareront explicitement (`text`, `img`, etc.) ; elle n'est pas une capacité
du composant `slot` opaque. Le support de `src` des images et de toute
propriété propre à un autre composant continue d'être validé par la cible
correspondante.

### Cycle `replace-simple`

Pour un changement de `content` associé à `replace`, le chemin attendu est :

1. **`beforeUpdate`** — le module demande à la surface de présentation HTML un
   instantané DOM de `hostRoot`. La surface crée par défaut un `cloneNode(true)`
   temporaire, sans identité logique ; les identifiants et handlers inline en
   sont retirés, puis la copie est rendue insensible aux events et au
   placement. La géométrie est capturée dans le parent et la racine réelle est
   masquée pendant la préparation.
2. **Mise à jour composant** — `ForeignContentComponent.update()` applique les
   services de la racine. Le propriétaire de la représentation peut, par sa
   surface `foreignContent`, détacher les anciennes racines et monter la
   nouvelle représentation ; l'instantané sortant reste figé et ne contient
   pas une seconde instance vivante.
3. **`afterUpdate`** — le module demande à la surface de présentation d'animer
   la racine réelle et l'instantané sortant. Il ne charge, ne pilote et ne
   clone aucun player ou contenu foreign.
4. **Finalisation** — lorsque le groupe de transitions est terminé, le module
   supprime le clone temporaire, retire les styles de positionnement, restaure
   la visibilité de la racine et laisse le nouveau contenu comme représentation
   active.

L'instantané de l'ancien hôte est un artefact de présentation appartenant à la
surface HTML pendant la transition. Il ne gère rien, n'est jamais un perso, ne
possède ni `perso.id` ni `componentId`, n'entre dans aucun registre et n'a
aucune existence pérenne. Il est supprimé par `finish`, `cancel`, seek ou
destruction. La V1 créait aussi une représentation entrante clonée pour
certaines intros ; cette tranche V2 ne le fait pas : la racine réelle porte le
nouveau contenu, ce qui évite de confondre une copie visuelle avec une seconde
instance foreign.

Cette mécanique ne peut pas être déduite comme une règle pour tout contenu
foreign. En particulier, `cloneNode(true)` sur une iframe copie son élément DOM
mais pas son contexte de navigation ni son rendu courant ; le snapshot ne peut
donc pas fournir une transition fiable dans ce cas. Le contrat futur devra
arrêter, pour ces représentations, soit un remplacement immédiat sans
transition, soit un élément visuel de substitution par défaut. Aucun fallback
et aucune détection spécifique ne sont ajoutés dans cette tranche.

Une nouvelle demande sur la même racine annule et nettoie la session précédente
avant d'en créer une autre. Les sessions sont indexées par cible runtime et par
occurrence d'action ; elles ne sont jamais enregistrées comme des persos ou des
parts.

### Asynchronisme, seek et replay

La disponibilité d'une ressource foreign peut être asynchrone. Comme dans la
spécification `replace` V1, le callback ne modifie pas directement le DOM hors
du pipeline : il ré-entre par un event technique ou une opération de module
déterministe, avec l'identité de la cible et la génération de la session. Une
réponse tardive d'une ancienne session est ignorée ou diagnostiquée.

Au seek, le player reconstruit l'état logique à `t`. Il ne rejoue pas les
callbacks de remplacement passés. Les clones temporaires sont supprimés ou
reconstruits selon la fenêtre de présentation demandée ; avant, pendant et
après la transition doivent converger vers la même représentation qu'en Play.
Un clone n'est jamais conservé dans `CompiledScene`, le journal ou le registre
des cibles.

## Transposition du module dans l'architecture V2

Le V1 expose `install(host)` et des hooks `beforeUpdate`/`afterUpdate`. La V2
possède déjà un catalogue de modules instanciés par player, mais son contrat
`RuntimeModuleServiceInstance` ne porte pas encore la coordination de
remplacement. La transposition devra donc arrêter, avant le code, une extension
générique de cette frontière :

1. le catalogue enregistre le module `replace` et ses validateurs de commande ;
2. le composant `slot` déclare la capacité `replace` requise ; les autres
   composants pourront la déclarer lorsqu'ils exposeront le même contrat ;
3. le runtime composant diffuse un contexte `beforeUpdate` puis `afterUpdate`
   autour de `component.update()` ;
4. le materializer publie une surface typée de présentation qui crée et détruit
   l'instantané DOM temporaire ; la surface `foreignContent` reste séparée et
   conserve la relation avec les racines persistantes ; les écritures
   `appendChild`/`insertBefore` restent dans la frontière HTML ;
5. le module maintient ses sessions par player et remet ses
   `ComponentAnimation`/transitions à la présentation commune ;
6. les événements techniques et la finalisation réutilisent le journal et la
   résolution d'events existants.

Le runtime reste un routeur. Il ne doit pas appeler
`replace.applyForeignContent()` dans une branche spéciale et le composant ne
doit pas importer l'implémentation du module. Le nom exact de la surface et la
forme des hooks sont une décision de la phase 0 ; aucune API improvisée ne doit
être ajoutée au core avant cette validation.

## Adressage : comment Sighty ou la scène cible le composant ?

### Ce que signifie l'identifiant

L'identifiant d'un composant est le `perso.id` logique, dans la portée de sa
story et de son instance. Il faut le distinguer de :

- `RuntimeComponentIdentity.componentId`, clé interne actuellement qualifiée
  par la story (par exemple `storyId:persoId`) ;
- l'identifiant DOM éventuel, qui n'est pas une API de routage ;
- l'identité du contenu foreign, qui change quand le contenu est remplacé.

Un `id` seul est donc suffisant **dans une story déjà sélectionnée d'une seule
instance**. Il n'est pas suffisant pour une adresse globale : deux stories ou
deux instances peuvent porter le même `perso.id`.

### Pistes compatibles avec CodPlay

| Origine de la demande | Adresse proposée | Usage |
| --- | --- | --- |
| Une scène cible son propre perso | `eventime.name === perso.id`, avec une cible story/track existante | Reprend la convention V1 documentée dans `v1-perso-spec.md` ; l'action reste déclarée sur le perso. |
| Authoring ou snapshot d'une instance | `{ storyId, persoId }` | Reprend `CodPlaySnapshotTarget`; aucun node n'est exposé. |
| Sighty cible une instance hôte | `{ instanceId, target: { scope: 'story', storyId, trackId? }, eventime: { name: persoId, data } }` | Reprend `CodPlayEventInput` et `codplay.events.emit`; une fois l'instance sélectionnée, `instance.events.emit` reçoit le même eventime et la même cible sans `instanceId`. |
| Runtime interne du player | `{ instanceId, storyId, persoId }` ou la clé `componentId` déjà qualifiée | Réservé aux registres internes ; non publié comme sélecteur DOM. |
| Nouveau contenu | Valeur de contenu sérialisable validée par la capacité | Identifie la valeur foreign, jamais la cible hôte ; une génération d'occurrence protège les callbacks tardifs. |

### Recommandation

Il n'est pas nécessaire d'introduire un `foreignId`, un `slotId` global ou une
API `component.setContent()` :

1. la scène utilise son `perso.id` dans l'eventime ciblé et le module est choisi
   par la capacité du composant ;
2. Sighty utilise l'`instanceId` existant, une cible story/track existante et
   `eventime.name = persoId` pour adresser le perso hôte ;
3. Sighty adresse séparément l'instance CodPlay enfant. Le composant hôte ne
   devient jamais un canal parent-enfant ;
4. le payload transporte une référence de contenu sérialisable, résolue par la
   frontière runtime appropriée ;
5. pour une lecture/snapshot local, `{ storyId, persoId }` reste l'adresse
   canonique, comme dans la façade V2 actuelle.

Cette convention répond à la question « l'id suffit-il ? » : **oui dans sa
portée CodPlay locale, non hors de cette portée**. Elle réutilise les adresses
déjà présentes au lieu d'ajouter une identité au composant uniquement pour
Sighty.

### Annexe consommateur (non normative) : chemin Sighty → hôte `slot` → scène enfant

L'exemple suit la forme déclarative `SightyFile` / `ViewGraph` proposée dans la
note Sighty du 2026-08-17. Une vue porte la scène hôte et son champ `slots`
décrit les vues à accueillir ; aucune table d'instances ni commande impérative
n'est ajoutée au fichier.

Cet exemple ne constitue pas une exigence supplémentaire du composant `slot`.
Il montre comment le scénario Sighty A/B peut consommer ses primitives lorsque
le raccord interinstances aura été décidé et implémenté. Les détails de la
démonstration et ses critères propres restent dans les documents Sighty.

La forme `start`/`views` de `ViewMap` n'est nécessaire que pour plusieurs vues
nommées ou des transitions dans un même graphe. Pour une composition fixe, une
`ViewList` contenant une seule `ViewDefinition` suffit ; c'est la forme utilisée
ici.

```ts
const sightyFile = {
  format: 'sighty',
  version: 1,
  id: 'composed-view',

  resources: {
    scenes: {
      host: './host.scene',
      child: './child.scene',
    },
    data: {},
  },

  // Une ViewList suffit quand la composition ne change pas de vue.
  views: [
    {
      view: {
        scene: 'host',
        slots: {
          body: [{ view: { scene: 'child' } }],
        },
      },
    },
  ],
}
```

Dans `host.scene`, la story active déclare le composant qui accueille le slot :

```ts
const hostSceneExcerpt = {
  id: 'host-scene',
  stories: {
    main: {
      id: 'main',
      persos: [
        {
          id: 'body-host',
          name: 'body',
          type: 'slot',
          // `initial` absent : la racine du composant est un <div>.
        },
      ],
    },
  },
}
```

La correspondance se lit ainsi, dans cet exemple :

```text
clé du slot Sighty       : body
composant de la scène   : id = body-host, type = slot
référence portée par lui: name = body
adresse CodPlay obtenue : { instanceId: host-1, storyId: main,
                             persoId: body-host }
```

La valeur `body` est la référence explicite du slot. L'identifiant `body-host`
sert à adresser le perso dans CodPlay. Le champ `content` reste disponible pour
la représentation foreign elle-même.
Sighty peut ainsi retrouver le composant en lisant les déclarations de la scène
hôte, sans chercher un nœud DOM. Si plusieurs stories ou plusieurs persos
rendent une clé ambiguë, la résolution doit exiger une portée explicite et ne
peut pas choisir un nœud au hasard.

Le cheminement runtime correspondant est le suivant :

```text
1. Sighty résout `host` et `child` dans `resources.scenes`.
   Chaque document est compilé séparément par CodPlay ; aucune scène n'est
   fusionnée dans l'autre.

2. Sighty entre dans l'unique vue de la composition et crée l'instance CodPlay
   de `host` avec la racine HTML fournie par l'application. Le player hôte matérialise
   `body-host` comme un composant `slot` ordinaire ; sa racine <div>, son
   identité logique et sa référence `name = 'body'` sont maintenant
   connues du runtime.

3. Sighty lit la clé `body` de la vue racine, parcourt les composants `slot`
   déclarés par la story `main` et retient celui dont `name` vaut
   `body`. Dans cet exemple, c'est `body-host` ;
   l'adresse runtime obtenue est :
   { instanceId: 'host-1', storyId: 'main', persoId: 'body-host' }.
   Cette correspondance est logique ; Sighty ne cherche pas un élément dans le
   DOM.

4. Sighty entre dans l'unique vue du slot et prépare l'instance CodPlay de
   `child`. Il lui associe l'adresse d'hôte précédente par la surface de
   montage en mode hôte. Cette surface résout, côté CodPlay, la racine
   materialisée du perso parent (`hostRoot`) et les racines persistantes
   présentées par l'enfant ; elle ne doit pas devenir un `querySelector` Sighty.

5. Le raccord CodPlay remet ces deux surfaces au propriétaire de la
   représentation `foreign-content` du parent. Celui-ci demande le montage via
   la surface, qui écrit dans le DOM : pour chaque racine enfant,
   `hostRoot.appendChild(childRoot)` (ou `hostRoot.insertBefore(childRoot,
   referenceRoot)` pour conserver une position). Au démontage, il exécute le
   `removeChild` correspondant. Le composant parent anime et expose sa boîte ;
   il ne lit ni le player ni les persos de l'enfant.

6. L'engine ordonne le tick du parent avant celui de l'enfant. Sighty pilote
   ensuite les deux instances par leurs façades : pause, reprise, seek et
   destruction de l'enfant ne sont pas des actions implicites du perso parent.

7. Le montage initial ne passe pas par un eventime de contenu : il vient de la
   relation déclarée dans `view.slots`. Si une composition utilise plus tard un
   `ViewMap` et remplace sa vue active, Sighty décide de conserver, remplacer ou
   détruire l'instance enfant, puis demande le nouveau montage. Pour une mise à
   jour de contenu déjà exposé, un eventime adressé au parent peut déclencher
   `replace` ; sa surface de présentation crée seulement l'instantané technique
   de la représentation sortante pendant la transition.
```

Quand une mise à jour doit passer par la scène parent, elle reprend la façade
CodPlay existante. Le nom du perso est porté par `eventime.name` selon la
convention de ciblage locale ; `target` porte la story et la track :

```ts
await codplay.events.emit({
  instanceId: 'host-1',
  target: { scope: 'story', storyId: 'main' },
  eventime: {
    name: 'body-host',
    data: {
      // Référence sérialisable acceptée par `foreign-content` ; sa forme reste
      // définie par la capacité et ne contient ni DOM ni player. Elle est
      // résolue par le propriétaire de la représentation, qui demande ensuite
      // l'appendChild/insertBefore via la surface dans la racine du perso
      // `body-host`.
    },
  },
})
```

La story hôte doit avoir déclaré l'action correspondant à cet eventime. Le
pipeline `materialize → resolve → solve → runner` sélectionne alors le perso,
et `ForeignContentComponent.update()` reçoit la valeur. Le materializer fournit
la surface `foreignContent` au propriétaire de la représentation ; celui-ci
détache les anciennes racines et demande l'insertion des nouvelles avec
`appendChild` ou `insertBefore`, puis la présentation `replace` capture
l'instantané de l'hôte si une transition est demandée. Sighty ne
touche pas au DOM et n'appelle pas le composant par une méthode impérative. Une
commande adressée à l'enfant utilise un autre `instanceId` : le parent et
l'enfant ne se parlent pas directement.

La façade publique actuelle de `instances.create` accepte une racine HTML pour
une instance autonome, mais ne définit pas encore le descripteur de montage
d'une instance dans un perso. C'est précisément la surface à arrêter en phase
0 : l'exemple rend le raccord nécessaire explicite sans faire passer une
opération conceptuelle pour une API déjà disponible.

Les events qui remontent vers Sighty suivent la visibilité V2 (`public`) et le
canal d'observation existant. CodPlay ne route pas directement un event vers une
autre scène.

## Invariants

- Le composant est une forme core réutilisable, pas un layout et pas une API
  Sighty.
- Sa racine est un tag HTML simple, `div` par défaut ; aucune zone nommée, aucun
  `markup` et aucun outlet ne font partie de son profil.
- Le composant possède l'exposition de la racine ; le propriétaire de la
  représentation foreign possède le contenu opaque et ses ressources internes.
- Quand il sert d'hôte Sighty, le composant de type `slot` déclare un `name`
  racine requis et stable ; la clé `view.slots` correspondante doit être
  identique et la correspondance ne se déduit jamais du `perso.id`. Le champ
  `content` reste réservé à la représentation foreign.
- La découverte auteur passe par un manifeste issu de ces déclarations et par
  le helper d'authoring retenu ; elle expose le nom, la portée et le chemin de
  chaque slot sans consulter le DOM ni un player. Un nom absent ou ambigu
  produit un diagnostic explicite avec les valeurs disponibles.
- Le core ne choisit aucune politique CSS de remplissage, de ratio, de
  débordement ou d'alignement. L'application auteur coordonne, selon ses
  besoins, le conteneur parent, `hostRoot` et les `foreignRoot` fournis par le
  propriétaire de la représentation ; ses règles sont explicites et ne sont
  pas déduites par une inspection DOM du composant.
- L'insertion d'une représentation foreign se fait dans la racine materialisée
  du perso hôte, via la surface `foreignContent` et ses primitives
  (`appendChild` ou `insertBefore`) ; Sighty ne manipule aucun nœud DOM.
- Une scène CodPlay enfant reste une instance séparée avec son temps, son
  journal, ses events et son teardown.
- `replace` est une capacité stateful partagée, sélectionnée par hooks et
  capacités, jamais une branche codée dans le composant ou dans Sighty.
- Dans cette version, le profil `slot`/`foreign-content` ignore
  `replace.split` : sa présence ne produit pas de diagnostic et n'active jamais
  une logique de split ; la commande est exécutée comme `replace-simple`.
- À l'arrivée d'un nouveau contenu avec transition, un clone temporaire de la
  représentation sortante peut disparaître indépendamment de l'instance qui
  possède le contenu ; comme tout clone d'overlay de `move`, il n'est jamais un
  perso, une materialisation auteur, une cible d'event ou de placement, ni une
  ressource persistante.
- Les callbacks asynchrones sont réintroduits dans le circuit déterministe et
  ne peuvent pas réanimer une session obsolète.
- Play, seek, replay, annulation et destruction nettoient les clones et les
  styles transitoires de façon idempotente.
- Aucun DOM, player ou fonction de construction n'entre dans `SceneDoc`,
  `CompiledScene` ou un event sérialisé.
- Une adresse publique inclut l'`instanceId` quand plusieurs instances sont
  possibles ; un `perso.id` n'est jamais interprété globalement.

## Phases et gates

| Phase | Statut | Preuve attendue |
| --- | --- | --- |
| 0. Relecture du contrat | **Validée le 2026-09-11** | Le type `slot`, le `name` racine, le manifeste, le diagnostic de découverte, l'absence d'opinion CSS du core et la frontière materializer sont acceptés pour l'ouverture de l'implémentation. Les décisions encore ouvertes restent listées dans les phases suivantes. |
| 1. Profil et validation | **En cours** | Le type de perso, le défaut structurel `div`, le `name` racine, la référence foreign sérialisable, le manifeste et l'ignorance de `replace.split` sont raccordés au catalogue et au builder. La correspondance `view.slots`/`name` reste à exercer dans Sighty. |
| 2. Surface opaque et materializer | **En cours** | La surface `foreignContent` attache/détache des racines HTML ordonnées dans la racine materialisée du `slot`, avec nettoyage au démontage. Sighty décide du cycle de vie des occurrences ; l'asynchronisme, l'ownership technique interinstances et la façade publique restent à raccorder. |
| 3. Module `replace` partagé | **En cours** | Module core player-scoped, hooks génériques V2, instantané temporaire de l'ancien hôte, transition `fade`, annulation, finalisation et absence de fuite. `replace.split` est ignoré par le profil `slot`. |
| 4. Composants compatibles | **En cours** | La même capacité est exercée par `slot` et `img` sans duplication de clone ; `tag` et les autres composants compatibles restent à examiner. |
| 5. Adressage CodPlay | À engager | Le chemin Sighty → adresse d'hôte → surface `foreign-content` → instance enfant est exercé avec les façades existantes, et l'insertion `appendChild`/`insertBefore` est observée au bon `hostRoot` ; aucune API DOM ou route interscène parallèle. |
| 6. Play, seek et lifecycle | À engager | Sighty pilote Play/Seek/replay, interruptions, remount et destruction ; CodPlay exécute chaque instance de façon idempotente et les players enfant et hôte gardent leur indépendance. |

## Acceptance path du composant core

La validation doit passer par le runtime réel et le materializer HTML. Elle ne
doit pas être remplacée par un setter local.

### Preuves propres au composant core

1. Compiler un perso `slot` sans `tag` et vérifier que sa racine est un
   `div`, puis appliquer `className`, `style` et `attr` par les services core.
   Vérifier aussi que `name` est déclaré à la racine et reste stable.
2. Monter une représentation opaque simple, puis un fragment à plusieurs
   racines, et vérifier que le composant ne dépend ni de leur type ni de leur
   structure interne.
3. Monter une scène CodPlay enfant réelle dans la racine, piloter séparément
   l'hôte et l'enfant, puis vérifier que pause, seek, rate et destroy ne
   traversent pas implicitement la frontière.
4. Remplacer le contenu avec `{ replace: 'fade' }`, vérifier la capture de
   l'ancien hôte, l'animation, l'absence d'event/target sur le clone et son
   nettoyage final.
5. Compiler une action `foreign` qui contient `replace.split` et vérifier que le
   builder l'accepte sans diagnostic de rejet, puis que le runtime exécute le
   chemin `replace-simple` sans activer de logique de split.
6. Répéter le remplacement et interrompre une transition ; vérifier qu'aucun
   clone, style de positionnement ou callback obsolète ne subsiste.
7. Exercer le même module sur un `tag` ou une image pour prouver que la capacité
   n'est pas liée au composant `slot`.

### Parcours consommateur Sighty A/B

Les points suivants valident l'intégration du composant dans le scénario décrit
par Sighty. Ils ne sont pas des contraintes supplémentaires du contrat core.

8. Résoudre la relation Sighty entre `view.slots.body` et le perso
   `body-host` dont `name` vaut `body`, obtenir l'adresse
   `{ instanceId, storyId, persoId }`, monter l'instance enfant par la surface
   hôte CodPlay, puis vérifier que ses racines deviennent des enfants de la
   racine `hostRoot` par `appendChild`/`insertBefore`. Au démontage, vérifier que
   ces racines seules sont retirées et que le parent et l'enfant restent
   pilotables séparément.
9. Adresser le perso par event local puis par la façade engine avec
   `instanceId` et cible story ; vérifier la séparation entre identité hôte et
   référence du nouveau contenu.

### Preuves génériques complémentaires et validation globale

10. Tester un contenu asynchrone avec une disponibilité tardive et vérifier la
   réintégration déterministe, puis les seeks avant, pendant et après la fenêtre
   de transition.
11. Exécuter les tests ciblés, typechecks, build et parcours navigateur réel,
    avec les vérifications Safari applicables.
12. Exercer le helper d'authoring sur un slot dont le nom est généré avant la
    compilation, puis sur un nom absent et sur une collision. Vérifier que le
    manifeste retourne les noms et chemins effectifs et que le diagnostic
    indique la portée, la référence demandée et la liste des candidats, sans
    inspection DOM ni sélection implicite.

### Preuves obtenues pour la première tranche (2026-09-11)

- `slot` est enregistré dans le catalogue core avec `name` comme invariant de
  perso, `div` comme défaut structurel et sans service `content` textuel.
- `slotManifest` et `resolveSlotManifestEntry` découvrent les noms déclarés,
  leurs chemins et les erreurs inconnues ou ambiguës.
- `HtmlComponentMaterializer` publie la surface `foreignContent`. Son
  `attach()` écrit les racines dans `hostRoot` par `appendChild`, son `detach()`
  retire seulement ces racines et la destruction nettoie la relation sans
  détruire les nœuds fournis.
- Les tests ciblés du composant, du manifeste, du catalogue, du builder, du
  materializer et du module média passent ; le typecheck CodPlay et celui des
  démos V2 passent également.

Cette première sous-tranche de profil et de surface ne prouve pas encore le remplacement animé, le raccord Sighty
entre deux instances, la résolution asynchrone du contenu ou l'exposition de
la surface par la façade publique. Ces points restent `En cours` ou `À engager`
et ne doivent pas être simulés dans la démo.

### Preuves obtenues pour le raccord `replace` (2026-09-11)

- Le catalogue core enregistre le module player-scoped `replace` et le profil
  `slot` le requiert ; le runtime composant diffuse désormais les hooks V2
  `beforeComponentUpdate` et `afterComponentUpdate` autour de `update()`.
- `HtmlComponentMaterializer` publie une surface de présentation distincte de
  `foreignContent`. Elle crée un instantané DOM transitoire, marqué pour être
  ignoré par la réconciliation structurelle, puis le supprime à la fin, à
  l'annulation, au seek ou à la destruction. Cet instantané n'est ni une
  ressource ni une instance foreign.
- Le test réel
  `tests/runtime/capabilities/replace-module.spec.ts` vérifie le chemin
  `SceneBuilder → RuntimePlayer → hooks V2 → HtmlComponentMaterializer`, le
  fondu `fade`, le montage d'une nouvelle racine foreign et la disparition de
  l'instantané. Il vérifie également qu'un `replace.split` est accepté puis
  exécuté par le chemin simple.
- Le même test exerce le module partagé sur `img` : le wrapper et sa source
  sortante utilisent la même surface de présentation, sans clone spécialisé
  dans `ImageComponent`.

Cette tranche ne prouve pas encore l'exercice du module sur `tag`, le raccord
Sighty entre deux instances, la résolution asynchrone du contenu ou
l'exposition de la surface par la façade publique. Ces points restent `En
cours` ou `À engager` et ne doivent pas être simulés dans la démo.

### Parcours d'intégration recommandé pour une application auteur

L'application qui intègre le composant peut monter une représentation CodPlay,
une iframe et un média dans un même hôte contraint, puis varier la taille du
conteneur. Elle vérifie alors ses propres règles de remplissage, de ratio, de
débordement et de contexte `cqw`/`cqh` sur les racines concernées. Elle peut
comparer la couverture réelle de `ac-scene-root` et, si nécessaire, définir ses
classes helpers dans sa frontière d'authoring ou de présentation. Ce parcours
valide l'intégration choisie par cette application ; il ne constitue pas une
acceptance CSS supplémentaire du composant core.

## Hors périmètre de cette tranche

- la machine d'état, le catalogue de scènes et les politiques de survie d'un
  orchestrateur d'application ;
- une communication directe scène hôte ↔ scène enfant ;
- l'ajout d'un protocole réseau ou d'une API de diffusion distante ;
- l'inspection, le split ou l'animation des persos internes d'une scène child ;
- la relecture d'un flux direct : son régime `now`, son `rate` et son absence de
  tampon restent ceux de la capacité de flux déclarée ;
- les materializers Canvas, Three.js ou autres supports non HTML ;
- l'acceptation de `replace-split-text` et `replace-split-cells` par le profil
  `foreign` dans la première tranche ; `replace.split` est accepté mais ignoré
  par `slot` ;
- la stratégie de `replace` pour une iframe ou une autre représentation dont
  le snapshot DOM ne restitue pas l'état rendu ; le choix entre absence de
  transition et élément de substitution par défaut reste à décider ;
- la destruction automatique du player qui possède le contenu ;
- une nouvelle identité globale pour remplacer les adresses CodPlay existantes.

Toute extension de support doit fournir son propre raccord de représentation et
préciser les ressources qu'il possède. La capture de transition relève de la
surface de présentation HTML ; l'extension ne doit pas introduire de branche
locale dans une application ni affaiblir le contrat du composant core.
