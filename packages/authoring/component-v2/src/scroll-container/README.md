# scroll-container

Le composant `scroll-container` transforme un élément HTML de la scène en zone de
défilement. Il utilise le `tag`, la taille et les styles fournis par l’auteur ;
il ne crée pas une interface supplémentaire.

Il fournit deux fonctions indépendantes :

- une progression numérique du défilement, utilisable par une capture
  `emit.scroll` ;
- l’observation de la visibilité des persos placés dans la zone, avec
  `emit.observe` et les événements `enter` / `leave`.

Ces fonctions lisent la géométrie réelle du navigateur. Elles ne font pas
avancer le temps CodPlay.

## Enregistrer la capacité

La capacité est optionnelle. Une application qui l’utilise enregistre le
composant, son module et l’adaptateur HTML :

~~~ts
import { CodPlay } from 'codplay'
import {
  SCROLL_CONTAINER_COMPONENT_DEFINITION,
  SCROLL_CONTAINER_MODULE_DEFINITION,
  createScrollContainerSourceAdapter,
} from '@codplay/component-v2'

const codplay = new CodPlay({
  engine: {
    components: { register: [SCROLL_CONTAINER_COMPONENT_DEFINITION] },
    modules: { register: [SCROLL_CONTAINER_MODULE_DEFINITION] },
  },
  htmlHost: {
    sourceAdapterFactories: [createScrollContainerSourceAdapter],
  },
})
~~~

Ces trois éléments ont des rôles distincts :

- la définition du composant permet de matérialiser `type: 'scroll-container'` ;
- la définition du module déclare la capacité requise par la scène ;
- l’adaptateur HTML relie les observations logiques aux éléments du navigateur.

Dans une application qui enregistre déjà d’autres capacités, ajoutez ces
éléments aux listes existantes. Sans cet enregistrement, l’engine ne crée pas
le composant et ne branche pas les observations.

## Déclarer le scrollport

Le composant reprend le profil du composant `tag`. L’élément indiqué par
`initial.tag` est le scrollport réel :

~~~ts
const scene = {
  id: 'reading-scene',
  stories: {
    main: {
      id: 'main',
      initial: { move: '@root' },
      persos: [
        {
          id: 'reading-scroll',
          type: 'scroll-container',
          initial: {
            tag: 'section',
            attr: { id: 'reading-scroll' },
            style: {
              height: '24rem',
              overflowY: 'auto',
            },
            move: { target: '@root' },
          },
        },
        {
          id: 'first-paragraph',
          type: 'tag',
          initial: {
            tag: 'p',
            content: 'Le texte se trouve dans le scrollport.',
            move: { target: 'reading-scroll' },
          },
        },
      ],
    },
  },
}

const build = codplay.build({ scene })
if (!build.ok) throw new Error('La scène est invalide.')
~~~

Le composant ne crée pas de conteneur supplémentaire, ne choisit pas la
hauteur et ne force pas `overflow`. Les autres persos sont placés dans la zone
par leur `move.target`.

Le parent logique est aussi important que le DOM final : les observations
recherchent leurs ancêtres dans le graphe de la scène, pas avec des sélecteurs
CSS. Le composant n’accepte pas `initial.content`. Le contenu est porté par des
persos enfants comme `tag` ou `img`.

## Progression du défilement

La progression est facultative et se configure dans `initial.values` :

~~~ts
values: {
  progress: {
    axis: 'block',
    range: 'scrollport',
  },
},
~~~

`axis` vaut `block` par défaut. Utilisez `inline` pour une zone qui défile
horizontalement. `range` accepte uniquement `scrollport`.

La valeur est calculée à partir de la géométrie :

~~~text
progression = offset / (scrollExtent - viewportExtent)
~~~

Elle est limitée entre 0 et 1. Si le contenu ne dépasse pas la fenêtre, elle
vaut 0. Le calcul se refait après la matérialisation, lors d’un scroll, après
un redimensionnement et lors d’une invalidation de géométrie autorisée.

Les notifications d’une même présentation sont regroupées : seule la mesure
la plus récente est publiée.

La progression seule ne produit pas d’événement public. Pour ouvrir une
activité de défilement, déclarez une capture `emit.scroll` sur le perso
`scroll-container`.

## Capturer une activité de défilement

Une capture commence au premier échantillon utile et se termine à l’événement
natif `scrollend` :

~~~ts
{
  id: 'reading-scroll',
  type: 'scroll-container',
  initial: {
    tag: 'section',
    attr: { id: 'reading-scroll' },
    style: { height: '24rem', overflowY: 'auto' },
    values: { progress: { axis: 'block', range: 'scrollport' } },
    move: { target: '@root' },
  },
  emit: {
    scroll: {
      event: { name: 'reading:scroll:start' },
      capture: {
        trackOn: ['scroll'],
        endOn: ['scrollend'],
        trackCommand: ({ sample }) => ({
          captureState: { progress: sample.progress },
        }),
        endEmit: { name: 'reading:scroll:progress' },
        endCapture: ({ samples }) => ({
          events: [{
            name: 'reading:scroll:end',
            data: { sampleCount: samples.length },
            mode: 'persist-only',
          }],
        }),
      },
    },
  },
}
~~~

Le circuit suit cet ordre :

1. le composant lit la géométrie du scrollport et regroupe les mesures ;
2. au premier échantillon, le circuit de capture ouvre la session et émet
   l’événement de début ;
3. `trackCommand` reçoit chaque mesure retenue et peut mettre à jour un état ou
   demander une action live ;
4. `scrollend` ferme la session ; `endEmit` et `endCapture` produisent les sorties
   prévues par la capture.

Les actions retournées par `trackCommand` sont des actions live déjà déclarées
dans la scène. Elles ne créent pas un événement supplémentaire et n’ajoutent
pas de ligne au journal. Les données de captureState peuvent être réutilisées
par `endEmit` ou `endCapture`.

Un seek, la fin de la séquence, une erreur ou la destruction du player annule
la session sans fabriquer d’événement de fermeture. Lors d’un reset, l’axe
configuré revient à 0, puis la source est rattachée. La capture reste dans le
circuit commun du player : le composant ne possède ni journal ni dispatch
parallèle.

## Observer un perso enfant

Une observation est déclarée directement sur le perso à observer, pas sur le
scrollport. Elle remplace la forme ordinaire `event` pour la clé `observe` :

~~~ts
{
  id: 'chapter-card',
  type: 'tag',
  initial: {
    tag: 'article',
    content: 'Une carte dans la lecture.',
    move: { target: 'reading-scroll' },
  },
  emit: {
    observe: {
      enter: [{ name: 'chapter-card:enter', once: true }],
      leave: [{ name: 'chapter-card:leave' }],
    },
  },
}
~~~

Sans `root`, le runtime prend le premier ancêtre logique de type
`scroll-container`. Pour choisir un ancêtre précis, indiquez son id :

~~~ts
emit: {
  observe: {
    root: 'reading-scroll',
    enter: [{ name: 'chapter-card:enter' }],
    leave: [{ name: 'chapter-card:leave' }],
  },
},
~~~

`root` est un id logique de perso dans la même story. Ce n’est pas un sélecteur
CSS et il ne déclenche pas une recherche arbitraire dans le DOM. La compilation
vérifie que l’id désigne un `scroll-container` de la même story ; au runtime,
une référence qui n’est pas un ancêtre réel produit un diagnostic et n’est pas
branchée.

### Comment un événement est produit

Le navigateur appelle IntersectionObserver lorsqu’une cible franchit une zone
de visibilité. L’adaptateur traduit chaque entrée en une phase simple :

- `inside` lorsque la cible est visible dans le root ;
- `outside` lorsqu’elle ne l’est plus.

Le flux est ensuite :

~~~text
IntersectionObserver
  -> adaptateur HTML
  -> fournisseur de phases
  -> RuntimePlayer.emit()
  -> journal, listen, straps et actions ordinaires
~~~

Le composant ne transmet pas d’objet DOM dans l’événement. Les données
`event.data` restent celles déclarées par l’auteur. La visibilité de sortie
(`story`, `scene` ou `public`), le mode (`apply-now` ou `persist-only`) et le nom de
l’événement gardent le contrat ordinaire de CodPlay.

Le premier callback synchronise toujours la phase. Par défaut, il ne produit
aucun événement :

| Première phase mesurée | Sans initial | Avec initial: enter | Avec initial: leave |
| --- | --- | --- | --- |
| inside | rien | émet enter | rien |
| outside | rien | rien | émet leave |

Après cette première mesure, un événement est produit uniquement lorsqu’il y a
un changement de phase :

- outside -> inside choisit les événements de enter ;
- inside -> outside choisit les événements de leave ;
- une phase inchangée ne produit rien.

Les événements sont traités dans l’ordre des déclarations compilées. Plusieurs
événements dans le même tableau sont donc émis dans leur ordre d’écriture.
Les émissions n’ont lieu que lorsque le player est en lecture. Un seek met les
observations en silence et ne rejoue pas les transitions vues pendant la
reconstruction.

`once: true` limite cet événement à une seule émission pendant la vie du player.
Une pause, un seek ou un reset ne réarme pas cette limite.

### Régler la zone observée

`observe.zone` reprend les options utiles d’IntersectionObserver :

~~~ts
zone: {
  rootMargin: '0px 0px -40% 0px',
  scrollMargin: '0px',
  threshold: [0, 0.5, 1],
  trackVisibility: false,
},
~~~

- `rootMargin` agrandit ou réduit la zone du scrollport ;
- `scrollMargin` applique une marge aux conteneurs de défilement imbriqués ;
- `threshold` accepte un nombre ou une liste de valeurs entre 0 et 1 ;
- `trackVisibility` demande, lorsque le navigateur le permet, une visibilité
  réellement affichée et pas seulement une intersection géométrique.

Les marges acceptées sont des longueurs CSS en px ou en %. Une option non
prise en charge par le navigateur produit un diagnostic et l’observation
concernée n’est pas branchée.

## Mettre à jour l’interface avec le ratio visible

`liveAction` est différent de `enter` et `leave`. Il ne produit pas d’événement :
il met à jour une `TweenAction` du perso observé avec le ratio visible courant,
compris entre 0 et 1.

~~~ts
{
  id: 'chapter-title',
  type: 'tag',
  initial: {
    tag: 'h2',
    content: 'Titre de chapitre',
    move: { target: 'reading-scroll' },
  },
  emit: {
    observe: {
      liveAction: 'chapter-title:visibility',
      zone: { threshold: [0, 0.25, 0.5, 0.75, 1] },
      enter: [{ name: 'chapter-title:enter' }],
      leave: [{ name: 'chapter-title:leave' }],
    },
  },
  actions: {
    'chapter-title:visibility': {
      duration: 1,
      fn: ({ data }) => ({
        style: {
          opacity: data.ratio as number,
        },
      }),
    },
  },
}
~~~

La validation exige que `liveAction` désigne une `TweenAction` avec une fonction sur
le même perso. Les seuils définissent la fréquence des nouvelles valeurs ; ils
ne changent pas la règle enter / leave. Une mise à jour live ne passe ni par le
journal ni par listen ou les straps.

## Cycle de vie à retenir

- **Initialisation** : après la matérialisation HTML, le composant récupère son
  élément et branche ses sources. Les observers des descendants sont résolus à
  partir du graphe logique de la scène.
- **Lecture** : le scrollport échantillonne sa progression ; les observations
  appliquent les actions live et émettent les transitions autorisées.
- **Seek** : les captures sont annulées et les observations n’émettent rien
  pendant la reconstruction. La progression reprend ensuite.
- **Fin de séquence** : les sessions sont annulées, les observers déconnectés et
  les listeners DOM retirés.
- **Reset** : la position de l’axe configuré revient à zéro et la source est
  rattachée. Les règles once restent consommées.
- **Destruction** : toutes les ressources du composant et de l’adaptateur sont
  libérées ; aucun callback retardé ne peut encore publier un événement.

## Erreurs fréquentes

- Enregistrer le composant sans enregistrer son module, ou sans fournir
  `createScrollContainerSourceAdapter` au host HTML.
- Déclarer `observe` sur le scrollport lui-même au lieu de le porter par un perso
  enfant placé dans ce scrollport.
- Oublier `move.target`, ou choisir un `root` qui n’est pas un ancêtre logique.
- Attendre un `enter` immédiat sans ajouter `initial: 'enter'`.
- Attendre un événement avec `liveAction` : cette option ne produit qu’une mise à
  jour live.
- Croire que `values.progress` crée automatiquement un événement : une capture
  `emit.scroll` est nécessaire pour ouvrir une activité et fermer la session sur
  `scrollend`.

## Exports publics

Le point d’entrée `@codplay/component-v2` exporte :

- SCROLL_CONTAINER_COMPONENT_DEFINITION ;
- SCROLL_CONTAINER_MODULE_DEFINITION et
  SCROLL_CONTAINER_MODULE_SERVICE_ID ;
- ScrollContainerComponent ;
- ScrollContainerInitial, ScrollObservationDeclaration et ScrollProgressAxis ;
- createScrollContainerSourceAdapter ;
- validateScrollContainerInitial.

Les détails de validation, de compilation et de cycle de vie certifié sont
conservés dans la spécification CodPlay :
packages/codplay/specs/scroll-container-spec.md.
