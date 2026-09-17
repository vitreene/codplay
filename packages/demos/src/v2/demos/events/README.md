# Démo Events

Cette démo montre comment un événement peut déclencher une ou plusieurs
actions dans CodPlay.

La scène représente une barrière d’accès :

- à gauche, une colonne de `65%` contient les textes et les flèches ;
- à droite, une colonne de `35%` contient le feu en haut et la barrière en bas ;
- cette grille empêche les flèches de passer sous les images ;
- les touches `←`, `→` et `Entrée` changent de cadre ;
- dans les cadres 3 et 4, les boutons `Lever` et `Baisser` produisent des
  événements.

Les messages restent directement posés dans la scène : ils n'ont ni cadre ni
ligne de séparation et commencent avec un espace de `4rem` en haut et à
gauche. Chaque ligne d'action aligne le message, la flèche puis l'espace de
l'illustration correspondante. La barrière met `1,5 s` à pivoter et utilise
une courbe progressive avec un léger rebond à l'arrivée.

## Les quatre cadres

Les cadres reprennent le même exemple en ajoutant une idée à chaque étape.

### 1. Un événement est émis

Le cadre démarre une petite séquence explicative :

```text
à 1 s     : l'événement « up » est émis
à 1,8 s   : le texte « event : up » apparaît
à 2,6 s   : le texte « action up : { rotate: 70deg } » et sa flèche apparaissent
à 3,4 s   : la barrière commence à pivoter
à 4,9 s   : la rotation de la barrière, d'une durée de 1,5 s, est terminée
```

L'événement est le déclencheur. L'action de la barrière est ce qui est exécuté
en réponse : sa rotation passe de `0°` à `70°` entre 3,4 s et 4,9 s. Chaque
message de cette explication arrive avec un pas de `0,8 s` et se révèle par
opacité pendant `0,3 s`.

### 2. Un événement se distribue

Le même événement `up` est maintenant utilisé par deux animations :

```text
up
├── feu      : rouge
└── barrière : rotate 70deg
```

Le feu commence par être vert. Lorsque `up` arrive, son image devient l'image
rouge. Les messages et les flèches suivent également un pas de `0,8 s` :

```text
à 1 s     : le message « event : up » apparaît
à 1,8 s   : l'action du perso feu et sa flèche apparaissent
à 2,6 s   : l'action du perso barrière et sa flèche apparaissent
à 3,4 s   : l'événement atteint les deux animations
```

Les deux actions portent le même nom `up`, mais appartiennent à des persos
différents : le perso feu choisit l'image rouge et le perso barrière anime la
rotation à `70°`.

Les deux flèches apparaissent en glissant de gauche à droite et permettent de
voir que l'événement distribue son effet à deux destinataires.

### 3. Les boutons émettent les événements

Les événements ne sont plus lancés automatiquement par le cadre. Les boutons
deviennent les sources d'événements :

```text
clic sur « Lever »  → up
clic sur « Baisser » → down
```

Les actions correspondantes sont :

```text
up   → barrière à 70° et feu rouge
down → barrière à 0°  et feu vert
```

Les libellés `Lever` et `Baisser` sont publics. Les noms utilisés par la scène
sont `up` et `down`.

### 4. Les événements peuvent être différés

Le bouton `Lever` déclenche d'abord la transition de la barrière et le passage
du feu au orange :

```text
up
├── immédiatement : barrière à 70°
└── immédiatement : feu orange
    après 1 s     : feu rouge
```

Le bouton `Baisser` ramène immédiatement la barrière fermée et le feu vert.
Le délai d'une seconde est décrit par le strap de la scène ; il n'y a pas de
minuteur créé dans la démo.

## Comment les événements sont reliés aux actions

Un événement ne contient pas directement une animation. Il porte un nom, par
exemple `up`. Chaque perso qui possède une action portant ce nom peut réagir à
cet événement.

Dans le troisième cadre, le bouton déclare par exemple une émission simple :

```ts
emit: {
  click: [{ event: { name: 'up', visibility: 'story' } }],
}
```

Le cadre écoute ensuite `up`. Son strap produit les événements propres aux
images qu'il possède :

```text
up → up3
```

Le perso de la barrière connaît alors l'action `up3`, tandis que le perso du
feu connaît lui aussi l'action `up3`, mais avec une image rouge comme résultat.

Dans le quatrième cadre, le strap produit deux étapes :

```text
up → changing4 immédiatement
up → up4 après 1 000 ms
```

`changing4` sélectionne l'image orange et `up4` sélectionne l'image rouge.
Les images du feu sont donc les trois états visuels d'un même feu : vert,
orange et rouge.

## Pourquoi les noms `up1`, `up2`, etc. ?

Chaque cadre possède son propre contexte d'animation : sa barrière, sa borne et
son feu. Une factory crée ces trois persos pour chacun des quatre cadres et
leur donne des noms d'événements distincts :

```text
cadre 1 : up1, down1, changing1
cadre 2 : up2, down2, changing2
cadre 3 : up3, down3, changing3
cadre 4 : up4, down4, changing4
```

Les événements publics des boutons restent `up` et `down`. Le strap du cadre
courant les traduit vers ses propres événements internes.

Cette séparation est importante lors d'un changement de vue rapide. Un délai
ou un événement du cadre précédent ne peut pas appeler par erreur l'action
`up3` du cadre courant : il ne possède pas le même nom ni le même contexte.
À chaque changement de vue, le cadre entrant est réinitialisé dans son état de
départ et le cadre sortant est quitté.

## Préchargement des images

Les sources utilisées par la scène sont déclarées avant le lancement du player :

- la borne (`borne.webp`) ;
- la barrière (`barriere.webp`) ;
- le feu vert (`feu-rouge-vert.webp`) ;
- le feu orange (`feu-rouge-orange.webp`) ;
- le feu rouge (`feu-rouge-rouge.webp`).

Le manifeste de preload est dérivé des `src` présents dans les persos image.
Le layout charge ce manifeste avant de créer l'instance de la scène. Ainsi,
quand l'événement change l'état du feu, le runtime change l'image prévue au
lieu de découvrir la ressource au dernier moment.
Les actions `down`, `changing` et `up` demandent aussi le preset partagé
`replace: 'fade-in'` pour présenter ce changement d'image : l'image précédente
reste opaque jusqu'à la fin, puis elle est retirée.

Les trois états du feu sont des images différentes, mais restent une seule
animation logique :

```text
down     → image verte
changing → image orange
up       → image rouge
```
