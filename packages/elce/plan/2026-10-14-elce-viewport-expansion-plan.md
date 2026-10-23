# Elcé — agrandissement dans le viewport

> **Statut : En cours.** Le host, `move`, les placements Image/Graphe et la navigation Carousel sont présents. Le clic réel sur une image ancrée Flux ouvre maintenant le viewport dans Brave après correction du ciblage du pointeur. Les autres placements, la navigation Carousel en navigateur et l’agrandissement vidéo restent à valider.

## Décisions retenues

- Périmètre : image, vidéo et Graphe. Le Graphe s’agrandit aussi bien directement que dans le Carousel. Les vues texte du Carousel sont ignorées ; ses vues image, vidéo et Graphe sont parcourues.
- Déplacer le contenu vers une cible `layout` `position: fixed`, dans la même scène ; `move` interpole entre la place d’origine et le viewport. L’image conserve son ratio. La cible couvre le viewport et les commandes Elcé sur un fond noir à 92 % d’opacité.
- **Propriété des styles et effets du contenu — décision utilisateur du 23 octobre 2026 :** tout style ou effet appliqué au contenu doit être porté par le perso/composant et le circuit de présentation CodPlay, sans exception. Les feuilles Elcé peuvent habiller l’interface de l’agrandissement (fond, cadre, commandes et verrou de défilement), mais ne doivent pas sélectionner ni styliser le média déplacé ou son contenu. L’apparition reste inchangée. À la fermeture, l’opacité du layout noir passe de `1` à `0` par une action de style CodPlay, sur une durée centralisée inférieure à celle du `move` du média. La visibilité différée CSS reste un mécanisme de cycle de vie qui attend la fin du retour du média ; elle ne pilote pas le fondu.
- Garder la réserve de la source dans le Flux, neutraliser le scroll pendant l’agrandissement et utiliser `move` pour l’aller-retour. Un nouveau clic retargete immédiatement le mouvement.
- Fermer au clic ou avec Échap ; rendre le focus au média qui a ouvert l’agrandissement après le retour.
- Dans un Carousel agrandi, flèches et swipe parcourent les vues image, vidéo et Graphe, conservent la sélection à la fermeture et s’arrêtent aux extrémités. Suspendre l’auto à l’ouverture ; le reprendre à la fermeture si aucun choix manuel n’a eu lieu.
- Vidéo : un bouton distinct « Agrandir » apparaît au survol, en haut à droite de la vidéo ; son clic ouvre l’agrandissement sans détourner les commandes natives. Conserver `media.sync: 'independent'` ; l’agrandissement ne change ni lecture/pause, ni position, ni son. À la sortie de page, `STOP` arrête la vidéo et la remet à zéro.
- Graphe : agrandir seulement la visualisation — SVG ou Tableau — sans le titre ni le commentaire ; préserver son contenu accessible.
- Propriété : l’agrandissement appartient au média affiché, indépendamment du BDC qui le contient. Il passe par le perso/composant CodPlay qui porte ce média ; la Carte est un cas d’usage, pas la cible architecturale. Aucun écouteur DOM direct n’est ajouté sur les balises natives `<img>` ou `<video>` ; l’événement emprunte le `Perso.emit` du composant média, puis le circuit story/listen/strap existant. Un Graphe conserve son perso visuel CodPlay et emprunte le même traitement, sans être requalifié en Carte. La vidéo garde son bouton distinct pour préserver ses commandes natives. Ne pas ajouter d’observer ni de circuit parallèle.
- Le routage du média vers le perso CodPlay et le chemin `emit` → événement → strap → `move` sont vérifiés pour une image ancrée dans Flux. Elcé garde la composition de l’interaction et ses événements ; CodPlay reste l’unique propriétaire de la présentation du contenu. La capacité de chaque média à exprimer intégralement son style par ses données/actions CodPlay doit être vérifiée avant de retirer les règles CSS correspondantes.
- Si un style du contenu ne peut pas être exprimé par les capacités CodPlay existantes, consigner le manque dans un plan CodPlay dédié avant toute modification du core. Une évolution core requiert l’autorisation explicite de l’utilisateur et un plan propriétaire accepté.
- Rive, Three.js et Lottie restent hors de cette tranche.

## Actions ordonnées

1. **Transférer les styles du contenu d’agrandissement dans CodPlay.** Auditer les règles de `viewport-expansion-style.ts` qui ciblent le contenu et les valeurs initiales/actions des persos image et Graphe. Les styles `width`/`height`/`object-fit`, `overflow`, `aspect-ratio`, `container-type`, `cursor`, `pointer-events` et `user-select` ne doivent plus dépendre de sélecteurs CSS Elcé. Réutiliser les services et actions CodPlay existants ; pour les éléments internes de l’image ou du Graphe, vérifier explicitement que le composant peut porter leurs styles. Si le markup graphe ne peut pas les exprimer via CodPlay, arrêter cette sous-partie et ouvrir un plan core dédié avant de coder. Acceptance : preview et export conservent le placement, les ratios, le tableau et les gestes d’ouverture/fermeture sans CSS Elcé ciblant le contenu.
2. **Intégrer les images Flux et Diapo** via leur story et la cible viewport — le host et le déplacement sont présents. Le clic réel sur l’image ancrée de la page Flux est vérifié dans Brave après correction du ciblage. Les tests couvrent aussi l’image directe, l’illustration Question et l’image de Carousel Diapo ; leur clic navigateur reste à valider.
3. **Étendre le Carousel** avec flèches, swipe, limites et suspension/reprise de l’auto — le parcours de navigation est couvert par les tests joueur. L’entrée en agrandissement reste à valider via le perso/composant du média actif ; la vue active doit continuer à déplacer son perso média existant.
4. **Valider le `move` fixed dans le navigateur.** Safari a montré le défaut initial : avec le slot à `(285, 137)`, la couche overlay restait à `(0, 0)` et le clone finissait à `(-285, -137)` avant que la cible le remplace à `(0, 0)`. Le présentateur CodPlay applique maintenant l’alignement racine→couche fixed ; la régression sur une racine static décalée et les tests host/montage/position passent (`45/45`). Brave DevTools, le 23 octobre, a ensuite observé le host à `z-index: 2147483647` au-dessus du média pendant les premières trames de `move` ; la couche temporaire CodPlay est à `z-index: 20`. Le host passe à `z-index: 19`, sous la présentation temporaire, sans toucher à `move`. La capture Brave après correction montre l’image visible au-dessus du fond pendant l’ouverture et son retour visible pendant la fermeture ; la vidéo et les autres placements restent à valider. Les échecs Seek CodPlay restent suivis dans le [plan CodPlay motion](../../codplay/plan/motion-live-discovery-invalidation-plan.md).
5. **Rétablir le ciblage du clic sur le média ancré.** La preview réelle montrait l’image, mais le centre de son cadre recevait le pointeur sur le `h2` suivant : sa boîte de 449 px recouvrait la réserve du slot, alors que son texte restait visuellement dessous. La racine absolue de la Carte ancrée avait `z-index: auto`. Le builder Flux donne maintenant `z-index: 1` aux racines Card et Graphe ancrées ; le slot garde le placement et la réserve, sans nouvel écouteur ni changement du circuit CodPlay. Brave MCP, le 23 octobre, confirme après rechargement une cible `IMG` au centre du média ; un clic réel ouvre le host et déplace l’image au viewport, puis un clic et Échap ferment l’agrandissement. Cette preuve valide une image ancrée dans Flux. Les suites ciblées Flux/Graphe passent (18 tests), la composition player passe (48 tests), ainsi que typecheck et build Elcé. Les clics réels des images directes, Question et Diapo, ainsi que le Graphe direct/ancré/Carousel, restent à valider.
6. **Étendre au média vidéo** avec le bouton « Agrandir » distinct en haut à droite au survol, dans le circuit du composant média CodPlay. Safari retargete les clics des commandes natives et de la surface vers `video` ; garder le bouton comme déclencheur afin de préserver les commandes natives. Préserver le nœud, les contrôles et l’état natifs ; vérifier leur usage en mode agrandi. Le `move` hors du root d’observation produit `leave`/`PAUSE`, puis `enter`/`START` au retour ; résoudre cet effet en gardant les pauses dues au scroll. Vérifier aussi `STOP` et le retour à zéro en sortie de page.
7. **Conserver l’agrandissement du Graphe** pour les placements direct, ancré et Carousel, en utilisant son perso visuel CodPlay et le traitement partagé, sans déplacer le titre/commentaire. Les trois placements passent dans le player, avec texte éditorial conservé et navigation Carousel Graphe↔image. La validation visuelle Safari reste à faire ; elle suivra l’acceptation du déclenchement média dans la preview.
8. **Après validation**, écrire la spécification Elcé avec le comportement vérifié et ses preuves, puis retirer ce plan et les notes préparatoires.

## Fondu de fermeture du layout noir — 23 octobre 2026

L’utilisateur demande de conserver l’apparition et le `move` du média. À la
fermeture, le layout noir doit atteindre `opacity: 0` plus vite que le média ne
revient à sa source. La règle doit être une action de style CodPlay sur le
perso `layout`, sans transition CSS parallèle. Le média reste présenté par la
couche temporaire de `move: { reparent: true }` pendant son trajet. Le délai de
visibilité CSS reste égal à la durée du `move` pour le cycle de focus et de
déverrouillage.

- [x] Centraliser durée et easing du fondu de fermeture dans
  `ELCE_EDITOR_SETTINGS.player.interactions.viewportExpansion` ; la durée doit
  rester inférieure à celle du `move`.
- [x] Initialiser et rétablir l’opacité du layout à `1` à l’ouverture ; faire
  passer son opacité de `1` à `0` à la fermeture par une action CodPlay.
- [x] Vérifier le builder, le player et la preview : le test de composition
  confirme le rétablissement à `1` lors d’une réouverture. Brave observe le
  layout à `0.198` après 50 ms puis à `0` après 130 ms ; l’action `move` du
  média reste à 320 ms `outCubic`. Le `move` n’a pas été modifié.

## Contrats à réutiliser

- Elcé : [ancre](../specs/anchor-spec.md), [Carousel](../specs/carousel-bdc-spec.md), [Graphe](../specs/statistical-graph-spec.md), [Flux](../specs/flux-scene-builder-spec.md), [Diapo](../specs/diapo-scene-builder-spec.md), [preview et STOP](../specs/player-preview-spec.md).
- CodPlay : [`img`](../../codplay/specs/image-component-v2-spec.md), [`media.sync`](../../codplay/specs/media-sync-v2-spec.md), [`Perso.emit`](../../codplay/specs/perso-emit-v2-spec.md), [`move`](../../codplay/specs/move-v2-spec.md), [`layout`](../../codplay/specs/layout-component-spec.md), [matérialisation](../../codplay/specs/component-materialization-v2-spec.md), [événements](../../codplay/specs/event-pipeline-v2-spec.md), [capture](../../codplay/specs/capture-v2-spec.md), [straps](../../codplay/specs/strap-execution-v2-spec.md).
- Raisonnement et preuves de l’enquête : [notes](../notes/2026-10-14-elce-viewport-expansion-enquete.md).
