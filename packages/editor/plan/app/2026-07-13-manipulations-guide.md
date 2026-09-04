# Mode d'emploi — manipulations possibles dans ed2

**Document vivant, à tenir à jour à chaque geste ou raccourci ajouté/modifié/retiré.** Toute modification d'un `addEventListener` (pointer, click, dblclick, wheel, keydown) dans `packages/editor/src` doit se refléter ici dans le même chantier — pas après coup, pas « à l'occasion ». Organisé par région de l'app.

---

## Timeline (bas de l'écran)

### Règle temporelle (bande fine du haut, chiffres « 0.0 s / 1.0 s… »)

| Geste | Effet |
|---|---|
| Clic simple | Déplace la tête de lecture à cet instant |
| Glisser (sans modificateur) | Scrub continu — la tête de lecture suit le pointeur en temps réel |
| **Maj**+glisser | Trace un segment de lecture (clip range) entre le point de départ et le point relâché |

### Zone des pistes (lignes horizontales, une par item)

| Geste | Cible | Effet |
|---|---|---|
| Double-clic | Zone vide d'une ligne | Crée un keyframe à cet instant (ignoré si trop proche d'un keyframe existant — seuil `keyframeHandleSizePx`) |
| Double-clic | Losange creux (keyframe virtuel, calculé par la distribution) | Matérialise ce keyframe virtuel en keyframe réel, avec son nom calculé |
| Clic | Losange plein (keyframe réel) | Sélectionne le keyframe (si aucun glisser ne suit) |
| Glisser | Losange plein (keyframe réel) | Déplace le keyframe dans le temps |
| **Alt**+glisser | N'importe où sur la zone des pistes | Pan horizontal de la timeline |
| **Alt**+double-clic | Ligne de type capsule | Pose un clip (intro+outro) à cet instant |
| Glisser (>4px avant déclenchement) | Ligne de type capsule (hors Alt) | Trace un clip (intro/outro) par glisser continu |
| **Ctrl/Cmd**+molette | N'importe où sur la zone des pistes | Zoom horizontal, centré sur le pointeur |

### Étiquettes de piste (colonne de gauche)

| Geste | Cible | Effet |
|---|---|---|
| Clic | Nom de la piste | Sélectionne l'item (piste) |
| Clic | Icône œil | Bascule visible/masqué |
| Clic | Chevron (pistes capsule uniquement) | Replie/déplie les enfants |
| Clic | « + piste marqueur » | Demande un nom (prompt), crée une piste de marqueurs |
| Clic | Icône œil (piste marqueur) | Bascule visible/masqué de la piste de marqueurs |
| Clic | Bouton supprimer (piste marqueur) | Supprime la piste de marqueurs |

### Piste de marqueurs

| Geste | Effet |
|---|---|
| Double-clic sur la piste | Crée un marqueur à cet instant |
| Clic sur un marqueur | Le sélectionne |
| Glisser un marqueur | Le déplace (aimanté à la grille de snap) |

### Barre d'outils (au-dessus de la timeline)

| Contrôle | Effet |
|---|---|
| ▶ / ⏸ | Lance / met en pause la lecture |
| ■ | Stop (retour à l'état arrêté) |
| Curseur zoom | Zoom horizontal absolu |
| Bouton unité (s / ms) | Bascule l'unité d'affichage des temps |
| Bouton suivre (≫) | Active/désactive le mode paginé (scroll auto pour garder la tête de lecture visible) |
| ⊡ (apparaît si un segment existe) | Zoom sur le segment de lecture |
| × (apparaît si un segment existe) | Efface le segment de lecture |

### Clavier (portée globale, hors champ de saisie)

| Touche | Effet |
|---|---|
| Suppr / Retour arrière | Supprime le keyframe sélectionné, ou le marqueur sélectionné |

---

## Zone scène (haut, rendu réel du player)

| Geste | Effet |
|---|---|
| (sélection pilotée depuis la timeline — cliquer une étiquette de piste) | Un cadre de sélection avec poignées apparaît autour de l'item dans la scène |

Aucune interaction directe sur le contenu de la scène elle-même n'est câblée aujourd'hui (pas de déplacement/redimensionnement à la souris dans cette zone) — le cadre de sélection est visuel uniquement à ce stade.

### Overlay de mouvement (item sélectionné)

| Geste | Effet |
|---|---|
| Glisser dans la surface centrale du CS | Sur un KF réel, met à jour son décor au même `timeMs` ; entre deux KFs, crée un KF au playhead courant, puis le sélectionne |
| Glisser à nouveau sur le KF créé | Met à jour ce même KF, sans en créer un second |
| Clic sur un ghost réel visible | Sélectionne le KF correspondant et y amène le playhead |
| Clic sur un trajet | Active le trajet courant ; un seul trajet reste interactif |
| Glisser le point médian | Courbe le trajet entrant du KF cible ; double-clic sur le point = droite implicite |
| Échap avant le relâchement | Annule le tracé en cours sans écrire de KF, décor ou path |

Les ghosts et trajets non actifs restent visibles mais volontairement discrets :
opacité basse et couleur ambrée pâlie/désaturée, avec une variation légère
selon la distance dans la chaîne des KFs.

---

## Panneau décor (droite, dedit)

Actif seulement quand un item (ou un keyframe) est sélectionné dans la timeline.

| Type de champ | Geste | Effet |
|---|---|---|
| Onglet (Forme / Typo / Dimensions / Contenu / Custom / Presets) | Clic | Change le panneau actif |
| Couleur | Clic → sélecteur natif du système | Le picker émet en continu pendant le geste — chaque valeur est appliquée en direct |
| Nombre | Saisie + sortie du champ (blur/Tab/Entrée) | Valide au `change`, pas à chaque frappe |
| Curseur (slider, ex. taille de police) | Glisser | Appliqué en continu (`input`) |
| Case à cocher / bouton icône (B, I, alignement…) | Clic | Bascule la valeur |
| Menu déroulant (ex. police) | Sélection | Valide au `change` |
| Champ texte (ex. contenu) | Saisie + sortie du champ | Valide au `change`, pas à chaque frappe |
| Bouton « + » (Hériter) | Clic | Retire l'écart explicite sur ce champ (repli vers la valeur héritée) — masqué en multi-sélection |
| Bloc Custom | Saisie + sortie du champ | CSS libre, valide au `change` ; champ vide = retire l'écart |
| Presets | Clic sur un preset | Applique le patch du preset (jamais `position`/`zone`/`capsule`) |

---

## Menu (haut, temporaire — étape 2/6 du plan app, pas la vraie UI)

| Bouton | Effet |
|---|---|
| « Charger la scène de démo » | Ne charge rien depuis un stockage — **crée** un document vide en mémoire (0 item) et le pousse dans le contrôleur central. Se désactive une fois fait. |
| « Créer un item » | Crée un item texte dans une géométrie de test bornée, lui assigne contenu « Nouvel item » et deux keyframes (0s et durée totale de la scène), puis le sélectionne pour afficher le CS |

---

## Limites connues (vérifiées dans l'historique git — distinguer régression / jamais construit)

- **Bande de `transitionOut`** — existe et fonctionne (`render/track-row.ts`, bande ambre/bleue de largeur = durée), inchangée depuis son introduction. Invisible dans les tests actuels seulement parce que « Créer un item » (menu temporaire) ne pose aucun `transitionOut` explicite sur les keyframes qu'il crée — pas un défaut du rendu.
- **Bande de `transitionIn`** — n'a jamais existé, à aucune version de l'historique. Seul `transitionOut` a toujours été rendu.
- **Kf par défaut à la sélection** — vérifié sur le tout premier commit du grid-editor (`922c7fb`) : sélectionner une piste n'a jamais déplacé la tête de lecture, à aucune version. Une intention documentée par l'utilisateur (cf discussion), jamais construite.
- Un appel direct à `createItem` avec une géométrie vide reste un placement plein-cadre de la capsule `card` et ne fournit pas de cadre de sélection ; le bouton temporaire « Créer un item » fournit désormais une géométrie bornée.
- Le décor d'un keyframe (autre que le décor initial de l'item) est édité et persisté correctement, mais n'a aucun effet visuel au rendu — `buildSceneDoc()` ne consomme pas encore `Keyframe.decorId`.
