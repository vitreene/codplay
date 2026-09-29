# CodPlay V2 — expressions Avatar

## Rôle

`avatar-mood` est le seul perso auteur des expressions et de leur comportement
spontané TalkingHead. Il reçoit les événements ordinaires `avatar:mood:<nom>`
et fournit au coordonnateur Avatar les baselines, les boucles `animMoods` et la
pose initiale. `idle` est un état interne des templates de mood ; aucun perso
`avatar-idle` distinct n'est requis ou enregistré. Le composant ne connaît ni
le modèle Three, ni ses meshes, ni l'horloge de rendu. Le composant central
`avatar` présente ces contributions dans le flux Avatar commun.

L'initial du perso accepte `mood: 'happy'` pour choisir l'expression de départ.
Il peut aussi préciser `moods: { happy: { mouthSmile: 0.5 } }`. Cette table
facultative remplace, pour chaque mood et chaque canal nommé, la valeur de la
baseline TalkingHead correspondante. Les autres canaux et expressions gardent
leurs valeurs natives. Les valeurs de morph sont absolues et finies ; les noms
de mood doivent appartenir au catalogue Avatar. La table appartient au perso
qui la déclare et ne modifie pas le catalogue partagé.

Le perso `avatar-mood` porte la configuration initiale de repos : pose,
clignement, respiration, mouvement spontané de tête, changements de pose,
mains parlantes et graine déterministe. La pose initiale est visible dès
`t = 0`, y compris après Seek et rechargement, sans frame en pose T.
Chaque changement spontané est daté comme une occurrence distincte, même si
son nom égale la pose précédente. Au Seek, les transitions de pose sont
rejouées depuis la pose initiale dans l'ordre absolu afin de conserver la même
pose source que pendant Play.

## Transition temporelle

Le nom de l'action désigne l'expression ; `durationMs` est une donnée
optionnelle de l'occurrence. Le composant part de son expression initiale et
reconstruit les occurrences reçues par ordre de date. À chaque nouvelle
occurrence, il échantillonne la transition précédente à `startAt` et utilise
cette valeur comme origine. Une action arrivée pendant une transition ne
fait donc pas sauter l'expression vers le pic de l'action précédente.

Pour une durée positive, chaque morph de l'union des baselines source et cible
suit l'easing TalkingHead sur le temps absolu CodPlay. Le choix de cette courbe
est explicite pour V2. Sans durée, le changement est immédiat. Un morph absent
de la nouvelle expression revient à zéro. En Play, le composant conserve la
transition courante et ne traite que les nouvelles occurrences reçues. Un Seek
reconstruit cette transition depuis les occurrences reçues jusqu'à la date
demandée. Une même date donne les mêmes valeurs en Play, Seek et replay, sans
file de transitions mutable ni lecture des instructions futures.

Chaque mood sélectionne aussi ses templates TalkingHead de respiration, pose,
tête, regard, clignement, bouche et micro-mouvements du visage. Leurs boucles
commencent à la date de l'occurrence qui sélectionne le mood ; le mood initial
commence à `t = 0`. En Play, le sampler conserve le cycle courant et le tirage
aléatoire de chaque boucle ; un Seek reconstruit ces mêmes cycles depuis
l'origine de l'occurrence. Il utilise la même baseline résolue que la
transition de mood, y compris après Seek et pour les tâches qui traversent un
changement de mood. Les branches `idle` et parole sont des états
internes, pilotés par la même contribution auteur. Le changement de mood ne
réutilise pas une phase calculée comme si la nouvelle expression était active
depuis le début de la scène.

Le clignement utilise la même origine d'occurrence. Son moteur reçoit le temps
absolu CodPlay en Play comme au Seek ; une nouvelle configuration ne remet pas
implicitement l'horloge de la scène à zéro.

Lorsqu'une occurrence remplace les boucles `animMoods`, chaque nouveau template
démarre depuis la valeur spontanée effectivement présentée à cette date, puis
suit ses délais, ses cibles et ses durées TalkingHead. Le marqueur `headMove`
de la boucle des yeux crée une tâche autonome à sa date native, avec son propre
délai. Son regard rejoint le centre pendant la phase de déplacement et ne
revient à la boucle des yeux qu'après la libération de ses canaux. Une tâche
déjà déclenchée peut traverser un changement de mood ; si une nouvelle tâche
prend les mêmes canaux, elle part des valeurs alors affichées et les reprend.
La libération des yeux d'une tâche est datée dès sa création ; la source d'une
tâche suivante dépend de cette date, jamais de la date d'évaluation de la
frame. Cela évite de modifier rétroactivement un hochement lorsque la tâche
précédente se termine.
Le même historique d'occurrences reconstruit ces raccords en Play et en Seek.

## Composition

Le coordonnateur est le seul propriétaire de la couche mood du moteur Avatar.
Il applique directement chaque baseline échantillonnée, sans ajouter l'easing
du `MorphEngine` à celui de la timeline. Les valeurs fixes de parole et de
geste et les contraintes système gardent leur priorité sur cette baseline.
Quand un geste libère un morph, sa valeur affichée rejoint progressivement la
valeur spontanée courante ; les nouveaux échantillons de mood ne coupent pas
cette sortie en cours. Une contrainte système inchangée ne coupe pas non plus
ce retour ; une nouvelle contrainte garde sa prise d'effet immédiate.
Quand un Seek retire une ancienne expression, le coordonnateur remet à zéro
les morphs qu'elle avait introduits ; le reset du moteur ne perd pas cette
information. Le lip-sync garde sa propre timeline et sa propre intensité.
Un visème, y compris nul, ne sélectionne aucune branche du comportement de
`avatar-mood`. Ainsi, `happy` conserve son sourire quand la bouche se ferme.

## Validation

Les tests autonomes couvrent l'entrée, le milieu, l'interruption par un second
mood, le retour temporel, le retrait d'un morph et la priorité des autres
couches. Ils couvrent aussi les boucles propres au mood, leur départ à chaque
occurrence et la pose initiale. La démo Avatar vérifie sur le vrai modèle les
actions de mood perceptibles sans autre perso spécialisé, leur coexistence
avec le lip-sync, l'audio, le Seek et le replay dans Safari TP.
