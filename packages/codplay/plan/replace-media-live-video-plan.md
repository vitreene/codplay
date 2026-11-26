# `replace-media` : vidéo entrante et capture H-i-C

> Statut : En cours. Décisions fixées sur demande utilisateur.

## Décisions fixées

- Le nœud vidéo persistant reste possédé et lu par `media-sync`. Pendant un
  remplacement entier hors H-i-C, son snapshot entrant reprend sa frame
  courante à chaque échantillon player ; le snapshot sortant reste fixe. Aucun
  lecteur n'est créé.
- `burn` suit le modèle H-i-C de la démo de référence : wrappers `drawable`
  contenant des slots d'état et textures DOM mises à jour sur `paint`.
  Les médias natifs restent enfants directs de la racine persistante. Le
  sortant est protégé par le marqueur transitoire existant ; aucun état DOM
  n'est cloné sur le chemin H-i-C. CodPlay continue à fournir la
  progression ; le renderer ne crée pas sa propre horloge.
- Les ressources H-i-C/WebGL2 appartiennent uniquement à la transition active :
  aucun renderer, texture ou historique de frames n'est conservé entre deux
  transitions. Fin, annulation et teardown libèrent les ressources GPU et le
  contexte, retirent les listeners et les références de session. À
  l'interruption, seule la composition nécessaire à la transition suivante est
  transférée ; elle est libérée avec cette transition. Une perte de contexte
  révèle la racine entrante et nettoie la présentation.
- Le parcours `replace-carousel` garde son vrai chemin `replace-media` avec
  deux effets séparés : aller à 1 500 ms, fin à 2 400 ms, retour à 4 000 ms.
  Les 1 600 ms de pause permettent d'observer chaque effet. L'interruption
  reste un cas d'acceptation distinct du scénario visuel courant.

## Actions et acceptation restante

- **Fixe — alignement DOM/amorce/H-i-C** : la grille ne change pas de
  rectangle sur le parcours observé. Le média mesure 232,296875 × 212,046875
  CSS px à DPR 2 ; le canvas est 465 × 425. L'amorçage calcule un fit dans cette
  taille arrondie, puis `gl.viewport` tronque ses valeurs fractionnaires.
  H-i-C fournit une hauteur utile de 425,0000305, allouée à 426 texels et
  échantillonnée sur toute sa hauteur. Le recalage amorce/premier paint à
  progression ≈0,004 estime un déplacement vertical de 0,5–0,75 pixel physique.
  L'absence de frame vide ne certifie donc pas la stabilité du cadrage.
  Correction autorisée par l’utilisateur : un rectangle CSS fractionnaire commun ; viewport plein canvas ;
  fit porté par les coordonnées flottantes ; UV limités à la zone utile des
  textures. Vérifier aussi les différences de filtrage entre la source native
  et sa rasterisation DOM. Implémentation en cours dans `burn-renderer.ts` et
  son mapping de textures. Aligner aussi les bords du support canvas sur les
  pixels physiques et conserver la vue CSS fractionnaire à l’intérieur, pour
  supprimer le rééchantillonnage du support par le compositeur. Régression numérique et recalage navigateur avant
  acceptation, puis enregistrement sans readback et contrôle de nettoyage.

- Appliqué et vérifié dans `burn-session.ts`, `burn-renderer.ts` et le calcul de
  fit média partagé : sortie native maintenue pendant la préparation de l'entrée,
  taille fixée avant paint/upload, textures amorcées depuis le média natif sortant
  avant affichage du canvas. Le premier dessin du canvas ne dépend plus d'un
  `paint` ultérieur. Les paints H-i-C continuent ensuite sur les slots vivants.
  Aucun clone, canvas 2D d'amorçage, chargeur ou ressource conservée entre effets.
- Acceptation effectuée : 293 tests ciblés, typechecks CodPlay/démos, build démos.
  Deux parcours enregistrés du compositeur sans readback GPU dans les frames
  observées : aucune frame de fond dans les zones image/vidéo avant les effets.
  Le rejeu libère les quatre contextes et conserve un seul média courant.
  Aller 1 500–2 400 ms, retour 4 000–4 900 ms ; pause inchangée de 1 600 ms.
- La perte de contexte, le Seek simple, le resize et la capture après paint
  disposent de leur acceptation navigateur ; l'initialisation des médias natifs
  et les fits `cover`/`contain`/`fill` sont couverts par les régressions de session.
- **A relire — reconstruction avant premier paint** : un Seek qui traverse
  plusieurs remplacements peut demander une capture avant que la première
  session ait reçu `paint`. Les textures d'amorçage ne portent alors que la
  sortie native, sans la composition intermédiaire des deux états DOM. Ce résultat ne satisfait pas encore
  l'acceptation Seek de l'interruption. Définir l'articulation avec l'attente de
  peinture avant toute implémentation dépendante ; ne pas ajouter de clonage ni
  d'historique de frames pour la contourner.
- Restant : automatisation navigateur H-i-C et certification des relations
  foreign/parent-enfant imbriquées, y compris reparent et teardown en transition.
  Le POC image/vidéo ne vaut pas certification de ces usages.

## Critères d’acceptation

- La vidéo entrante visible progresse pendant la transition entière au même
  rythme que son nœud natif ; le média `media-sync` reste l'unique lecteur.
- H-i-C échantillonne deux contenus distincts ; la vidéo entrante reste vivante
  dans son slot et l'interruption repart de la composition H-i-C visible.
- Fin, annulation, Seek, perte de contexte et teardown retirent les couches et
  restaurent la racine sans fond noir ni avertissement de dépassement de
  contextes. Aucune ressource de transition n'est gardée pour un usage futur.
