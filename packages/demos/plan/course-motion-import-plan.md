# Plan — conversion de séquences XML vers CodPlay

## Objectif et statut

> **En cours** — convertir les pages XML du cours en `SceneDoc`, avec la page
> `p02` de `02_acces.xml` comme premier exemple multi-séquence.

Le comportement converti et vérifié est décrit dans
[`../specs/course-motion-import-spec.md`](../specs/course-motion-import-spec.md).

## Décisions acceptées

- La fixture active est `<page id="p02">` dans le `02_acces.xml` fourni par
  l'ancien projet SAMERA. La page contient quatre séquences et leurs médias.
- Le mapping cible est une page XML vers un `SceneDoc` et chaque élément
  `<sequency>` vers une `StoryDoc` de cette scène.
- Les séquences se jouent dans leur ordre source, chacune après la durée de son
  audio, et leur média `master` conduit l'horloge CodPlay afin que la transition
  suive la lecture effective du son. Un perso sans `duration` reçoit
  `display: none` 500 ms après la frontière d'une story intermédiaire, pour
  laisser son image de fond chevaucher l'entrée de la story suivante; l'état
  visuel de la dernière story est conservé à la fin de la scène. Un perso avec
  `duration` se masque à sa propre échéance.
- La démo visible reste `?demo=course-motion`. Elle utilise les contrôles, le
  cycle d’instance et le player V2 partagés; aucun service local de playback.
- Les longueurs rapportent le canevas source `1600 × 788` à `cqw`. `scale`
  devient une dimension de boîte pour `img`; aucune transformation CSS `scale`
  n’est ajoutée à l’image.
- Les conteneurs imbriqués conservent leur position source dans le canevas.
  Le conteneur `is-flex-list is-vertical` reste un `layout` avec son style de
  flux; le contrat du composant `list` porte sur l’ordre structurel, pas sur ce
  rendu flex.
- Décision ouverte — identifier les icônes à réduire et leur dimension cible;
  le XML donne actuellement 200 px aux croix SVG et un facteur `scale` aux
  images météo.
- Les classes `message is-link`, `message-body` et `bullet` suivent les styles
  Bulma/SAMERA du projet source; les textes héritent du bloc, puis les valeurs
  explicites de couleur, taille et graisse priment.
- Les images et SVG sans `id` reprennent la convention calculée par le player
  source. Les identifiants source dupliqués sont refusés; une collision entre
  identifiants calculés est suffixée de façon déterministe. La détection des
  collisions entre stories reste ouverte.
- Le panneau `message is-link` suit la palette Bulma source (`#eff1fa`,
  `#485fc7`, `#3850b7`); le texte hérite Futura et du poids déclaré par ses
  classes source.
- Les tests possèdent leurs propres fragments simple, enchaîné et avec pause.
  Ils ne chargent pas la scène de démo. Aucun cas d’essai supplémentaire n’a de
  route visible.
- Aucun changement du core CodPlay.

## Actions

1. **Objet simple — validé.** Le convertisseur image accepte un `<img>` avec
   des `<tween>` directs; les tests vérifient dimensions, id source, Seek et
   Play par le player V2.
2. **Trajectoires enchaînées — validé par test.** Les segments contigus et la
   variante avec pause restent dans le test de façade. Le XML réel de
   `circu02` a un seul tween.
3. **Séquence motion de référence — validée.** Le convertisseur existant et le
   player V2 couvrent une image avec tween et une séquence avec panneaux,
   images et audio.
4. **Page `p02` — En cours.** Une page devient une `SceneDoc`; ses quatre
   `<sequency>` deviennent des `StoryDoc` ordonnées sur les durées audio,
  conduites par l'horloge de leur média `master`, avec images, SVG, conteneurs,
   sous-titres, tweens ciblés et masquage des éléments sans durée 500 ms après
  les frontières intermédiaires afin que l'image entrante soit visible avant
  le retrait du stage sortant. Le dernier stage et ses éléments sans durée
  restent visibles quand la scène atteint son terme. Les coordonnées, classes
  flex et styles texte/blocs source sont rétablis et vérifiés; comparer les
  positions, tailles et chevauchements des icônes à la scène V1.
5. **Quiz — à faire.** Définir le mapping vers les compositions existantes de
   `quiz-series` et `components`; valider la réponse et le score par le runtime
   réel.
6. **Chapitre puis projet — à faire.** Agréger les pages puis les chapitres,
   sans modifier les XML source.
7. **Responsive — à concevoir séparément.** Définir le reflow selon le ratio
   d’écran, puis vérifier resize et interaction sans échelle uniforme.

## Critères d’acceptation de la page `p02`

- Le XML intégré est exactement la page `p02`; ses quatre stories gardent leur
  ordre, leurs délais, leurs ressources, leurs textes et leurs tweens source.
- Chaque audio master conduit l'horloge de sa séquence; le début de la story
  suivante et `sequence:end` suivent la fin effective de la piste, sans avance
  de l'horloge liée au démarrage du média.
- À la fin du son, la story suivante commence et son image d'entrée est visible
  pendant son fondu de 500 ms avant que le stage précédent et ses éléments
  sans `duration` soient masqués; cela évite un frame de page vide. Le stage et
  les éléments sans durée de la dernière story conservent leur état visible à
  `sequence:end`. Les persos avec durée se masquent à leur propre échéance.
- La scène est acceptée par le builder et les ressources locales référencées
  existent.
- La validation utilise le player et le cycle de vie V2 partagés, avec Seek,
  Play, contrôle des transitions audio/visuelles et console navigateur.
- La spécification décrit seulement le mapping et le comportement effectivement
  exercés sur `p02`.
- Le panneau de la première story apparaît à la position source (`x=900`,
  `y=100`); textes et blocs restituent les couleurs, tailles, graisses, classes,
  marqueurs et styles hérités du thème source.
- Les icônes gardent leurs écarts visuels source et ne se chevauchent pas quand
  les illustrations ne se chevauchent pas dans la scène d’origine.

## Validation

- [x] Typecheck V2 des démos.
- [x] Build de production des démos.
- [x] Tests de façade de l’import, incluant le build des sept persos et le
      player sur une image et deux segments.
- [x] Test du player sur les styles continus x/y :
      `packages/codplay/tests/runtime/runner-html/player-runner.spec.ts`
      (19 tests réussis).
- [x] Brave : scène source chargée; Seek à `1,5 s`, `3 s` et `5,25 s`; la pose
      de `circu02` progresse; Play atteint la durée native de `8,626508 s`.
      Les trois images et l’audio répondent; aucune erreur console d’exécution n’est relevée.
- [x] Palette observée avec les valeurs de repli du thème source; la sortie
      n’emploie pas de transformation `scale` sur les images.
- [x] Spécification alignée sur le XML source et les sept persos convertis de
      la première fixture motion.
- [x] Page p02 intégrée et compilée; le test façade couvre les quatre stories,
      leurs offsets audio, les frontières de masquage, le tween ciblé et le
      contenu traduit.
- [x] Browser Brave : Play, Seek aux transitions des stories 2 et 3, alpha
      tween cible, masquage des éléments sans durée après le fondu aux frontières
      intermédiaires, retour au début et rechargement de scène.
- [x] Ressources locales de p02 chargées; aucune erreur d’exécution dans la
      console. Le seul 404 observé concerne `/favicon.ico`.
- [x] Browser Brave après correction : panneau à `x=56.25cqw`, `y=6.25cqw`
      (`x=900`, `y=100` source); `is-flex-list` vertical, `bullet` flex et
      marqueurs rendus à 14 s dans le player partagé.
- [x] Typecheck et build après le portage des styles; Brave confirme Futura,
      poids 400, taille `h4`, couleurs héritées, fond/liseré Bulma et marqueurs
      dans les stories 1 et 2.
- [x] Typecheck et build après synchronisation master : Brave à ×1 confirme
      l'alignement horloge/audio, la transition sans frame vide (stages 1 et 2
      chevauchés pendant l'entrée de 500 ms), puis `sequence:end` à 74 710 ms
      avec le stage 4 et sa dernière image visibles. À ×2, la story 2 suit
      l'audio à 2× sans dérive.
- [ ] Comparer l’espacement et le chevauchement des icônes à l’affichage source;
      les styles calculés des textes et panneaux sont vérifiés sur le thème V1.

