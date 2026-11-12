# Premiers pas avec CodPlay

CodPlay permet de créer une **scène** animée et interactive dans une page web.
Une scène réunit des éléments, leur organisation et ce qui leur arrive pendant
la lecture. Vous décrivez ce qui apparaît, puis ce qui change avec le temps ou
les gestes du visiteur.

Ce guide construit une petite scène : une image apparaît en fondu dans une
carte, un message entre en glissant, puis un bouton permet de saluer et de
compter les clics. Vous allez ensuite l'exporter et la publier comme une page
web ordinaire.

## 1. Préparer son dossier

Nous allons réunir dans un petit projet la scène à écrire, son image et la
page qui permettra de la lire. Le dossier `premiere-scene/` contiendra ce
travail, et `site/` les fichiers destinés aux visiteurs.

La préparation se fait **à la racine de ce dépôt**, avec Node.js et npm
installés :

```sh
npm install
mkdir -p premiere-scene/site
```

Votre fichier de travail sera `premiere-scene/scene.ts`. Le dossier `site/`
recevra ensuite la page et les fichiers à publier.

## 2. Afficher un premier perso

Notre première scène affiche un message de bienvenue. Ce message est un
**perso** : un élément de la scène que nous pourrons animer et faire évoluer.
Un perso peut aussi représenter une image, un bouton ou un personnage.

Une **story** est un groupe de persos avec ses propres événements et les
informations qu'elle mémorise. Elle permet d'organiser une partie de la scène.
Ici, une seule story, appelée `main`, rassemble tout notre contenu.

Voici la déclaration de cette scène, dans `premiere-scene/scene.ts` :

```ts
import type { SceneDoc } from 'codplay'

export const scene: SceneDoc = {
  id: 'premiere-scene',
  stories: {
    main: {
      id: 'main',
      persos: [{
        id: 'message',
        type: 'tag',
        initial: {
          tag: 'p',
          content: 'Bienvenue !',
          move: '@root',
        },
      }],
    },
  },
}
```

`SceneDoc` est le type TypeScript qui décrit la forme d'une scène et aide à
vérifier son écriture. `id` donne un nom de repérage à chaque déclaration : ici,
la scène, la story et le message.

Un **composant** est une capacité réutilisable choisie par `type`. Il sait
représenter le perso et appliquer ses changements. Plusieurs persos peuvent
utiliser le même composant avec des contenus différents. Ici, `type: 'tag'`
choisit le composant HTML et `tag: 'p'` lui demande un paragraphe.

L'**état initial**, écrit dans `initial`, décrit les propriétés du perso au
départ : ici, son texte et son placement. Le champ **`move`** choisit où il
apparaît. `@root` désigne le conteneur de la page qui accueillera la scène.
Le résultat sera simplement :

> Bienvenue !

La partie « Lire la scène dans une page » permettra de voir cet exemple, ou
n'importe quelle étape suivante, dans le navigateur.

## 3. Organiser la scène avec un layout

Nous allons organiser le contenu dans une carte : l'image en haut, le message
au milieu et le bouton en dessous. Un **layout** est un composant de mise en
page : il décrit cette structure et les zones qui accueilleront les éléments.

La carte est elle-même un perso, nommé `card`. Dans le tableau `persos`, sa
déclaration prend place avant celle du message :

```ts
{
  id: 'card',
  type: 'layout',
  initial: {
    move: '@root',
    markup: `
      <article id="welcome-card" class="welcome-card">
        <div id="welcome-picture" data-part="picture"></div>
        <div id="welcome-copy" data-part="copy"></div>
        <div id="welcome-controls" data-part="controls"></div>
      </article>
    `,
  },
},
```

`markup` contient la structure HTML du layout. Une **part** est un emplacement
nommé dans cette structure, où d'autres persos peuvent venir se placer.

`data-part="picture"` crée une zone appelée `picture`, comme les zones `copy`
et `controls`. Chaque conteneur du markup possède son propre `id`.

Les zones `copy` et `controls` utilisent l'autre forme : `data-part` porté par
un élément HTML. Celui-ci reste leur conteneur et peut servir à regrouper ou
mettre en forme leur contenu. Chaque conteneur possède son propre `id`.

Le message rejoint maintenant la zone de texte de la carte : dans son état
`initial`, son placement devient `move: 'copy'` à la place de `move: '@root'`.
`move` utilise le nom de la zone, **sans `#`** : ce n'est pas un sélecteur CSS.

```text
Carte
├── picture   ← ancrage pour l'image, sans conteneur supplémentaire
├── copy      ← accueille le message
└── controls  ← accueillera le bouton
```

## 4. Ajouter une image

La zone `picture` va accueillir un petit paysage : deux montagnes sous un
soleil. Cette illustration est un fichier SVG local, conservé à côté de la
scène sous le nom `premiere-scene/landscape.svg` :

```svg
<svg id="landscape" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 160">
  <rect width="240" height="160" rx="16" fill="#dff3ff"/>
  <circle cx="180" cy="42" r="22" fill="#ffd166"/>
  <path d="M0 160 L70 62 L140 160 Z" fill="#79b99d"/>
  <path d="M85 160 L162 85 L240 160 Z" fill="#3e856e"/>
</svg>
```

Le perso `landscape` représente cette image dans la scène. Il utilise le
composant `img` et prend place dans la zone `picture` du layout. Voici sa
déclaration dans `persos`, après celle de la carte :

```ts
{
  id: 'landscape',
  type: 'img',
  initial: {
    src: './landscape.svg',
    alt: 'Deux montagnes vertes sous un soleil jaune',
    className: 'landscape',
    img: { style: { width: '100%', display: 'block' } },
    move: 'picture',
  },
},
```

`src` indique le fichier, ici à côté de `scene.ts`. `alt` décrit l'image pour
les personnes qui ne la voient pas. `move: 'picture'` la place dans la carte.
Les **styles** sont les propriétés de présentation, comme la taille ou la
transparence. Le groupe `img.style` règle l'image elle-même ; le `style` du
perso réglera son conteneur, que nous allons animer. `className` associe une
classe CSS au perso pour lui appliquer des règles de mise en forme.

L'export copiera l'image avec la scène. Il n'y aura pas de fichier à retrouver
sur un autre site.

## 5. Animer l'image et le message

Un **événement** signale que quelque chose arrive : un moment prévu dans la
scène est atteint, ou le visiteur clique. Il porte un nom que les persos
peuvent reconnaître.

Une **action** décrit le changement qu'un perso applique à la réception d'un
événement : changer un texte, apparaître ou se déplacer. Les actions d'un
perso sont regroupées dans `actions`, sous le nom de l'événement concerné.

Une **animation** fait évoluer progressivement une propriété entre une valeur
de départ et une valeur d'arrivée. C'est le cœur de CodPlay : un événement
lance l'action, puis CodPlay calcule les valeurs intermédiaires pendant la
durée choisie.

Nous allons faire apparaître l'image en **900 ms**, et faire entrer le message
avec un petit déplacement horizontal.

L'image commence invisible : son état `initial` reçoit
`style: { opacity: 0 }`. Son action `intro:show` décrit ensuite le fondu vers
une image entièrement visible. Le groupe `actions`, à côté de `initial`,
contient cette animation :

```ts
actions: {
  'intro:show': {
    style: {
      opacity: { from: 0, to: 1, duration: 900, ease: 'out(2)' },
    },
  },
},
```

Le message commence lui aussi invisible, légèrement décalé vers la gauche.
Son état `initial` reçoit `style: { opacity: 0, x: -24 }`. L'action
`intro:show` le ramène à sa position normale tout en le faisant apparaître.
Deux autres actions changeront ensuite son texte :

```ts
actions: {
  'intro:show': {
    style: {
      opacity: { from: 0, to: 1, duration: 900, ease: 'out(2)' },
      x: { from: -24, to: 0, duration: 900, ease: 'out(2)' },
    },
  },
  'message:ready': { content: 'Cliquez sur Saluer.' },
  'message:greeted': { content: 'Bonjour !' },
},
```

| Champ | Ce qu'il règle |
| --- | --- |
| `from` | La valeur de départ |
| `to` | La valeur d'arrivée |
| `duration` | La durée en millisecondes |
| `ease` | La façon d'accélérer ou de ralentir ; `out(2)` ralentit à l'arrivée |
| `opacity` | La transparence, de `0` pour invisible à `1` pour visible |
| `x` | Le déplacement horizontal ; ici, le message rejoint sa position normale |

Nous choisissons maintenant quand ces changements se produisent. Un
**eventime** est un événement auquel on donne une date dans la lecture.
La liste `eventimes` de la story `main`, déclarée à côté de `persos`, lance
l'animation puis affiche l'invitation à saluer :

```ts
eventimes: [
  { name: 'intro:show', startAt: 100 },
  { name: 'message:ready', startAt: 1_000 },
],
```

`startAt` donne la date en millisecondes depuis le début de la scène :
`startAt: 100` lance l'animation à 100 ms. Avec une durée de 900 ms, elle se
termine à 1 000 ms. Le second événement change alors le texte.

```text
0 ms               100 ms                    1 000 ms
Image invisible →  Début du fondu         →  Image visible
Message décalé  →  Glissement et fondu    →  Cliquez sur Saluer.
```

L'image et le message déclarent chacun une action `intro:show` : un seul
événement lance les deux animations. Les noms sont vos conventions ; c'est
leur correspondance exacte qui relie les événements aux actions.

**Un événement suffit pour lancer l'animation.** Il ne faut pas envoyer un
événement à chaque image : CodPlay fait évoluer les valeurs avec le temps de
la scène. Le CSS ajouté plus loin sert seulement à sa mise en forme.

## 6. Ajouter un bouton qui émet un événement

Le visiteur va maintenant pouvoir répondre à la scène. Un bouton **Saluer**
transforme son clic en événement, auquel le message réagit en affichant
**Bonjour !**.

Ce nouveau perso rejoint la zone `controls` de la carte. Sa déclaration prend
place dans `persos`, après celle du message :

```ts
{
  id: 'greet-button',
  type: 'tag',
  initial: {
    tag: 'button',
    attr: { type: 'button' },
    content: 'Saluer',
    move: 'controls',
  },
  emit: {
    click: { event: { name: 'message:greeted', visibility: 'story' } },
  },
},
```

Le groupe **`emit`** décrit les gestes qui produisent des événements.
`emit.click` associe ici le clic du visiteur à un événement CodPlay.

La **portée** d'un événement détermine à quels éléments il s'adresse.
`visibility: 'story'` le garde dans sa story : le message de notre groupe
pourra donc le recevoir.

Après l'apparition de l'invitation, un clic sur **Saluer** remplace le message
par **Bonjour !**. Plusieurs persos pourraient réagir au même événement en
déclarant chacun une action `message:greeted`.

```text
Clic sur Saluer → message:greeted → action du message → Bonjour !
```

## 7. Ajouter un strap pour calculer une réponse

Nous allons enrichir la salutation : chaque clic affichera son numéro, comme
« Bonjour ! Clic n° 1. », puis « Bonjour ! Clic n° 2. ».

L'**état de la story**, nommé `state`, regroupe les informations qu'elle
mémorise d'un événement à l'autre. Ici, il contient le nombre de salutations,
initialement égal à zéro.

Un **strap** est une fonction qui calcule une réponse à partir de l'événement
reçu et de cet état. Il peut proposer une mise à jour des informations et
produire des événements de réponse.

**`listen`** est la liste des règles d'écoute de la story. Dans notre exemple,
une règle reconnaît le nom de l'événement et désigne le strap à appeler.
L'événement de réponse transporte le texte à afficher dans **`data`**, le
groupe des données associées à cet événement.

Le bouton va désormais émettre `greeting:requested`. La story écoutera cet
événement pour appeler `greet`, qui augmentera le compteur et produira
`message:greeted` avec le texte à afficher.

Cette version complète de `premiere-scene/scene.ts` réunit la carte,
l'image, les animations et la salutation avec compteur. La **feuille de style**
`styleSheet` définit aussi la présentation de la carte, de l'image et du bouton :

```ts
import type { SceneDoc } from 'codplay'

export const scene: SceneDoc = {
  id: 'premiere-scene',
  stories: {
    main: {
      id: 'main',
      state: { greetings: 0 },
      persos: [
        {
          id: 'card',
          type: 'layout',
          initial: {
            move: '@root',
            markup: `
              <article id="welcome-card" class="welcome-card">
              <div id="welcome-picture" data-part="picture"></div>
                <div id="welcome-copy" data-part="copy"></div>
                <div id="welcome-controls" data-part="controls"></div>
              </article>
            `,
          },
        },
        {
          id: 'landscape',
          type: 'img',
          initial: {
            src: './landscape.svg',
            alt: 'Deux montagnes vertes sous un soleil jaune',
            className: 'landscape',
            style: { opacity: 0 },
            img: { style: { width: '100%', display: 'block' } },
            move: 'picture',
          },
          actions: {
            'intro:show': {
              style: {
                opacity: { from: 0, to: 1, duration: 900, ease: 'out(2)' },
              },
            },
          },
        },
        {
          id: 'message',
          type: 'tag',
          initial: {
            tag: 'p',
            className: 'message',
            content: 'Bienvenue !',
            style: { opacity: 0, x: -24 },
            move: 'copy',
          },
          actions: {
            'intro:show': {
              style: {
                opacity: { from: 0, to: 1, duration: 900, ease: 'out(2)' },
                x: { from: -24, to: 0, duration: 900, ease: 'out(2)' },
              },
            },
            'message:ready': { content: 'Cliquez sur Saluer.' },
            'message:greeted': { content: 'Bonjour !' },
          },
        },
        {
          id: 'greet-button',
          type: 'tag',
          initial: {
            tag: 'button',
            attr: { type: 'button' },
            className: 'greet-button',
            content: 'Saluer',
            move: 'controls',
          },
          emit: {
            click: { event: { name: 'greeting:requested', visibility: 'story' } },
          },
        },
      ],
      eventimes: [
        { name: 'intro:show', startAt: 100 },
        { name: 'message:ready', startAt: 1_000 },
      ],
      listen: [{ on: 'greeting:requested', straps: ['greet'] }],
      straps: {
        // Compte la demande et retourne le texte du prochain message.
        greet: ({ state }) => {
          const greetings = Number(state.greetings) + 1
          return {
            update: { greetings },
            events: [{
              name: 'message:greeted',
              data: { content: `Bonjour ! Clic n° ${greetings}.` },
            }],
          }
        },
      },
    },
  },
}

export const styleSheet = `
  .welcome-card {
    display: grid;
    gap: 1rem;
    max-width: 36rem;
    padding: 1.5rem;
    border: 1px solid #cbd5e1;
    border-radius: 1rem;
  }
  .landscape { width: 20rem; max-width: 100%; }
  .message { font-size: 1.25rem; margin: 0; }
  .greet-button { padding: 0.6em 1em; cursor: pointer; }
`
```

Voici le rôle des ajouts :

| Élément | Rôle dans cet exemple |
| --- | --- |
| `state` | Conserve le compteur de la story |
| `listen.on` | Reconnaît l'événement demandé |
| `listen.straps` | Nomme le strap à appeler |
| `greet` | Calcule la réponse ; ici, on utilise seulement son argument `state` |
| `update` | Demande la mise à jour du compteur, sans modifier directement l'état reçu |
| `events` | Produit l'événement de réponse |
| `data.content` | Fournit le texte qui remplace le contenu prévu dans l'action |
| `styleSheet` | Fournit le CSS associé à la scène |

```text
Saluer → greeting:requested → listen → greet
                                        ↓
                     compteur + 1 et message:greeted
                                        ↓
                            Bonjour ! Clic n° 1.
```

Un deuxième clic donnera **Bonjour ! Clic n° 2.**. Le strap calcule les valeurs ;
le composant affiche le résultat. Vous n'avez pas à modifier vous-même les
éléments HTML de la page.

## 8. Exporter la scène

Nous allons préparer une version de la scène que les visiteurs pourront lire.
L'**export** prépare la scène pour sa diffusion : il rassemble sa description,
son image, sa mise en forme et son strap dans un dossier prêt à charger par
le navigateur. Ce dossier constitue le **paquet de scène**.

Depuis la racine du dépôt, cette commande produit le paquet `bonjour` :

```sh
npm run export --workspace=codplay -- \
  --scene ./premiere-scene/scene.ts \
  --export ./premiere-scene/site/scenes/bonjour
```

Le dossier produit contient la scène, son CSS et ses fonctions, y compris le
strap. Gardez ce dossier entier : il contient aussi une copie de `landscape.svg`,
rangée automatiquement avec les ressources. La commande refuse une destination déjà
présente : pour un nouvel export, choisissez un nouveau dossier ou retirez
l'ancienne sortie générée après l'avoir sauvegardée si nécessaire.

Les fichiers source restent dans `premiere-scene/scene.ts`. Ils servent à
continuer votre travail ; le dossier exporté sert à la lecture et à la
publication.

## 9. Lire la scène dans une page

La scène va maintenant apparaître dans une page web. Cette page fournit son
conteneur d'affichage et charge le **player**, le lecteur CodPlay qui prépare
la scène et fait avancer sa lecture.

Son chargement crée une **instance** : un exemplaire de la scène en cours
d'utilisation dans la page. Sa **telco** est la télécommande qui permet de
lancer cet exemplaire, de le mettre en pause ou de recommencer.

Ces commandes construisent le player et le placent dans le dossier du site :

```sh
npm run build:player --workspace=codplay
mkdir -p premiere-scene/site/vendor
cp packages/codplay/dist/codplay.js premiere-scene/site/vendor/codplay.js
```

Dans `premiere-scene/site/index.html`, la page accueille la scène dans
`#scene` et propose un bouton **Rejouer** pour revoir l'animation :

```html
<!doctype html>
<html id="tutorial-page" lang="fr">
  <head id="tutorial-head">
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="icon" href="data:,">
    <title>Ma première scène CodPlay</title>
  </head>
  <body id="tutorial-body">
    <h1>Ma première scène</h1>
    <main id="scene" aria-label="Scène interactive"></main>
    <button id="restart" type="button">Rejouer</button>

    <script type="module">
      import { CodPlay } from './vendor/codplay.js'

      const player = new CodPlay()
      const instance = await player.load('./scenes/bonjour/', { root: '#scene' })
      await instance.telco.play()

      // Repart du début, avec un compteur de clics remis à zéro.
      async function restartScene() {
        await instance.telco.reset()
        await instance.telco.play()
      }
      document.getElementById('restart').addEventListener('click', restartScene)
    </script>
  </body>
</html>
```

`load()` charge le paquet et installe l'instance dans le conteneur `#scene`.
`instance.telco.play()` lance ensuite sa lecture.

Pour un aperçu local, si Python 3 est installé :

```sh
python3 -m http.server 8080 --directory premiere-scene/site
```

Ouvrez <http://localhost:8080>. Vérifiez d'abord le fondu de l'image et le
glissement du message. Après une seconde, cliquez plusieurs fois sur **Saluer**. Utilisez une adresse HTTP, plutôt que d'ouvrir `index.html` par un
double clic : le player doit charger les fichiers du paquet.

## 10. Mettre en pause, reprendre ou recommencer

Le bouton **Rejouer** de la page utilise `instance.telco` : il remet la scène
et son compteur à zéro, puis relance l'animation. Ce bouton appartient à la
page qui accueille la scène ; **Saluer** est, lui, un perso de la scène.

Par défaut, la lecture s'arrête après 30 secondes sans interaction. **Rejouer**
permet aussi de la relancer après cet arrêt.

Dans le script, la même télécommande permet de piloter la lecture :

```js
await instance.telco.pause()    // Mettre en pause.
await instance.telco.play()     // Reprendre.
await instance.telco.seek(0)    // Revenir au début et rester en pause.
await instance.telco.reset()    // Remettre la scène et le compteur à zéro.
await instance.telco.play()     // Lire cette nouvelle partie.
```

Ces lignes illustrent des commandes à utiliser séparément selon le besoin.
Un **seek** place la lecture à un instant donné pour retrouver l'apparence de
la scène à cet instant. Un **reset** commence une nouvelle partie et remet les
informations mémorisées à leur valeur initiale. Quand votre application retire
définitivement cette scène, `player.destroy()` libère ses ressources.

## 11. Publier

Votre site est prêt à être copié chez un hébergeur de fichiers statiques :

```text
site/
├── index.html
├── vendor/
│   └── codplay.js
└── scenes/
    └── bonjour/
        ├── export-manifest.json
        └── scene/
            ├── scene.json
            ├── functions.mjs
            ├── style.css
            └── assets/       ← contient la copie de landscape.svg
```

Publiez **le contenu du dossier `site/`**, en conservant cette organisation.
La page utilise des chemins relatifs : elle peut aussi être placée dans un
sous-dossier de votre site. Le serveur doit servir les fichiers `.js` et
`.mjs` comme des modules JavaScript.

Les visiteurs n'ont besoin ni de Node.js, ni de TypeScript : leur navigateur
charge le player et le paquet exporté. Vous pourrez ensuite ajouter d'autres
scènes à côté de `bonjour/`, avec le même player.

## Pour continuer

- Ajoutez un perso en lui donnant un autre `id`, puis son `type` et son état initial.
- Ajoutez une action de même nom sur plusieurs persos pour les faire réagir ensemble.
- Placez un événement dans `scene.eventimes` pour un changement commun aux stories ;
  gardez `story.eventimes` pour les changements locaux.
- Pour utiliser des composants Three.js, Rive ou Avatar, consultez le
  [guide des composants](../authoring/component-v2/README.md) et les
  [exemples de scènes](../demos/src/v2/demos/).

Les événements servent aux faits discrets, comme un clic ou une décision.
Pour suivre un pointeur, un scroll ou des mesures continues, le **mode capture**
reçoit les valeurs successives pendant le geste et permet de faire évoluer les
persos. Vous choisissez le résultat à conserver à la fin du suivi. Les valeurs
continues passent par ce suivi, jamais par un événement à chaque image. CodPlay
n'expose pas d'émetteur d'événements `loop`. Les animations utilisent le temps de la scène.
