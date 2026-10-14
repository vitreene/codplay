# Elcé — agrandissement dans le viewport

> **Statut : A relire.** Cadrage accepté ; décisions 1 à 5 ouvertes. Aucune implémentation engagée.

## Cadrage accepté

- Image : interpoler sa représentation depuis sa position et sa taille d’origine vers le centre du viewport, à la plus grande taille qui y tient sans déformer son ratio. Second clic : retour interpolé. Le navigateur reste visible.
- Cible et contenu restent dans la même scène. La projection `position: fixed` de la cible occupe le viewport ; elle est distincte de l’ancre qui réserve la place du BDC dans le Flux.
- Ordre : image, vidéo, Graphe. Dans le Carousel agrandi, flèches et swipe parcourent ces vues seulement (Cartes texte ignorées) ; garder la sélection à la fermeture.
- Entrée : perso régulier `layout` + `move` + événements existants. Capacité externe seulement si un manque est prouvé.
- Vidéo : préserver `media.sync: 'independent'` et `STOP` à la sortie de page. Le replay Elcé n’est pas un critère.

## Décisions ouvertes — dans l’ordre

1. **Élément déplacé** — perso `img` ou cadre contenant avec l’image à `width: 100%` ; conserver le résultat visuel défini ci-dessus.
2. **Place source** — choisir comment conserver l’emplacement d’origine pendant le déplacement, pour les contenus directs et ancrés. Le Flux reste stable ; le scroll de page est neutralisé jusqu’à la fermeture.
3. **Second clic en cours d’animation** — retarget depuis la frame courante ou attendre la fin.
4. **Carousel** — identifier la vue affichée en modes manuel/automatique ; choisir arrêt ou boucle aux extrémités et si l’auto continue pendant l’agrandissement.
5. **Interactions** — fixer swipe horizontal et suppression du clic synthétisé, Échap et focus ; préserver les contrôles natifs de la vidéo.

**Gate :** relire et accepter ces décisions avant le code fonctionnel. Si le test d’accrochage révèle un manque CodPlay, arrêter la tranche ; toute évolution core exige son plan propriétaire accepté et une autorisation explicite.

## Étapes

1. **Prouver l’accrochage** dans le lecteur réel : cible fixe dans la même scène que la source, couvrant le viewport et mesurable aux bornes du mouvement. Tester image directe et ancrée avec les commandes Elcé.
2. **Implémenter et accepter l’image** avec les circuits existants (`événement → dispatcher → strap/action → move → matérialisation`). Vérifier centrage, ratio, ouverture/fermeture, Flux stable, scroll neutralisé puis réactivé, navigation Carousel et sélection conservée.
3. **Ajouter la vidéo** : vérifier nœud, temps courant, lecture, son et contrôles natifs ; à la sortie, vérifier que `STOP` arrête et remet à zéro, sans commande supplémentaire au retour.
4. **Ajouter le Graphe** : décider alors si l’agrandissement contient le rendu seul ou aussi titre/commentaire ; vérifier SVG et Tableau.
5. **Valider et documenter** dans Sighty/CodPlay : frontières affectées (parent/enfant/reparent, Play/Seek, resize, persistance, cycle de vie), tests, typecheck, build et navigateur. À la fin, écrire la spec du comportement vérifié ; ajouter éventuellement un README d’usage avec exemple. Retirer le plan quand aucune décision ni validation ne reste.

## Contrats à réutiliser

- Elcé : [ancre](../specs/anchor-spec.md), [Carousel](../specs/carousel-bdc-spec.md), [Graphe](../specs/statistical-graph-spec.md), [preview et STOP](../specs/player-preview-spec.md).
- CodPlay : [`img`](../../codplay/specs/image-component-v2-spec.md), [`move`](../../codplay/specs/move-v2-spec.md), [`layout`](../../codplay/specs/layout-component-spec.md), [motion](../../codplay/specs/motion-frame-v2-spec.md), [`media.sync`](../../codplay/specs/media-sync-v2-spec.md).
- [Notes d’enquête](../notes/2026-10-14-elce-viewport-expansion-enquete.md) — raisonnement et preuves de l’enquête.
