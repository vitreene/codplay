# Phase 5 — Tests visuels

Accès : `npm run dev:editor` → http://localhost:5174

---

## V1 — TimeRuler

**Ce que c'est**
Bande SVG en haut de la zone temporelle. Elle affiche des graduations (traits + labels) proportionnellement espacées selon le zoom courant. L'intervalle s'adapte automatiquement pour ne jamais avoir moins de 48 px entre deux traits.

**Ce qu'on doit voir**
- Graduations régulières, labels alignés à gauche du trait
- À zoom 80 px/s (défaut) : graduation à 1 s (100 px entre chaque)
- Slider à gauche (≤ 30 px/s) : graduation bascule sur 5 s ou 10 s (moins de traits)
- Slider à droite (≥ 200 px/s) : graduation bascule sur 500 ms ou 100 ms (plus de traits)
- Bouton `s` / `ms` : labels affichent « 1.0 s » ou « 1000 ms »

**Comment tester**
1. Vérifier les labels de graduation à zoom défaut (« 0.0 s », « 1.0 s », « 2.0 s »…)
2. Déplacer le slider zoom tout à gauche → les labels doivent s'espacer (ex. « 0 s », « 5 s », « 10 s »)
3. Déplacer le slider tout à droite → labels resserrés (ex. « 0.0 s », « 0.1 s », « 0.2 s »)
4. Cliquer `s` → relire les labels (toujours cohérents, unité changée)
5. Cliquer dans la règle → la tête de lecture (ligne rouge) se positionne au point cliqué

---

## V2 — TrackLabelList

**Ce que c'est**
Colonne gauche fixe. Liste plate des tracks (éléments + capsules). Synchronisée pixel-à-pixel en hauteur avec les lignes de la zone temporelle.

**Ce qu'on doit voir**
- Chaque ligne affiche le nom du track et un bouton de visibilité (● / ○)
- Les tracks de type `capsule` affichent un tag compact (ex. `liste`)
- Cliquer une ligne : elle devient sélectionnée (fond ambre), la barre d'info en bas affiche `track: … (kind) kf: N`
- Les tracks enfants d'une capsule ont une indentation légèrement décalée

**Comment tester**
1. Charger `Eddy scène 02` (défaut) → vérifier les 6 labels attendus :
   - root (container), capsule01, img-0, img-1, img-2, lot-1 (lottie), vid-1
2. Cliquer `capsule01` → fond ambre, infobar = `track: capsule01 (capsule) kf: 1`
3. Cliquer ailleurs puis cliquer `img-0` → sélection déplacée
4. Charger `Capsule imbriquée` → vérifier les 5 lignes (fond + capsule + item 1 + item 2 + CTA)

---

## V3 — TrackRow + KeyframeHandle

**Ce que c'est**
Zone temporelle principale. Pour chaque track : une barre de segment entre keyframes adjacents, des bandes colorées pour les transitions, et un losange SVG (◆) pour chaque keyframe.

**Ce qu'on doit voir**
- Losanges blancs positionnés à l'instant exact du keyframe
- Les keyframes nommés (`name: intro/outro`) ont un losange ambré
- Bandes de transition :
  - **Ambre translucide** : transition nommée (`kind: named` — fade, swipe…)
  - **Bleu translucide** : transition interpolée (`kind: interpolated`)
- Double-clic sur fond d'une ligne → crée un keyframe à cet instant (losange apparaît, infobar affiche son id)
- Clic sur un losange → sélection (losange passe en jaune, infobar affiche `kf: … décor: …`)
- Keyframe sélectionné + keyframe de la colonne gauche = même ligne → alignement visuel correct

**Comment tester**
1. Charger `Un élément texte` (3 keyframes à 0, 600, 9000 ms) :
   - Vérifier 3 losanges, les 2 extrêmes en ambre (nommés intro/outro), le central blanc
   - Vérifier une bande ambre courte à t=0 (fade 600ms), une bande bleue à t=600ms (interpolated 400ms), une bande ambre à t=9000ms
2. Double-cliquer au milieu de la ligne → un 4e losange apparaît (arrondi à 100ms le plus proche)
3. Cliquer le losange à t=600ms → infobar = `kf: 0.6 s  décor: decor-02`
4. Charger `Eddy scène 02` → vérifier la densité de keyframes correspondant aux 7 eventtimes (0/1/1.5/2/3/4/5s)
5. Zoom max → les losanges s'écartent, les bandes de transition s'élargissent proportionnellement
6. Zoom min → les losanges se rapprochent jusqu'à se superposer (c'est normal en v1)

---

## V4 — PlayheadLine

**Ce que c'est**
Ligne verticale rouge + petite tête de flèche en haut, en overlay SVG sur toute la zone temporelle. Se déplace en temps réel pendant la lecture et au clic dans la règle.

**Ce qu'on doit voir**
- Une ligne rouge plein-hauteur à t=0 au démarrage
- Clic dans la règle → la ligne saute à la position cliquée
- Drag dans la règle → la ligne suit le pointeur en temps réel
- Bouton ▶ → la ligne avance en continu (lecture RAF)
- Bouton ■ → la ligne s'arrête, reste à sa position courante
- La tête de lecture (triangle rouge) reste visible au-dessus de la bande cues

**Comment tester**
1. Cliquer à 2 s dans la règle → ligne rouge à 2 s, infobar affiche `2.0 s`
2. Glisser lentement dans la règle de gauche à droite → ligne suit le pointeur
3. Cliquer ▶ → ligne avance. Attendre 2 s, cliquer ⏸ → ligne figée à la bonne position (vérifier infobar)
4. Cliquer ■ → ligne revient à 0 — **non** : `stop()` remet à 0 uniquement dans la machine (observer l'infobar `0.0 s`)
5. Zoomer × 2 → la ligne rouge reste à la même position dans le temps (elle suit le viewport)

---

## V5 — CueRow

**Ce que c'est**
Petite bande SVG sous la règle. Affiche les cues (repères textuels) de la scène sous forme de traits violets avec label.

**Ce qu'on doit voir**
- Traits verticaux violets aux instants des cues
- Labels courts au-dessus de chaque trait
- Proportionnels au zoom : en zoom avant les cues s'écartent

**Comment tester**
1. Charger `Eddy scène 02` → 7 cues visibles à 0/1/1.5/2/3/4/5 s
2. Zoomer → les 7 traits s'écartent (à zoom max ils peuvent sortir du viewport)
3. Charger `Un élément texte` → 0 trait (pas de cues)
4. Charger `Capsule imbriquée` → 2 cues (`Entrée liste` à 1s, `CTA` à 5s)

---

## V6 — MarkerRow

**Ce que c'est**
Bande SVG après les cues. Affiche les markers (repères auteur) sous forme de petits drapeaux colorés avec label.

**Ce qu'on doit voir**
- Drapeaux polygonaux à la couleur du marker
- Label à droite du drapeau
- Proportionnels au zoom

**Comment tester**
1. Charger `Capsule imbriquée` → 1 marker ambre `Milieu` à 3.5 s
2. Zoomer → le drapeau se déplace proportionnellement
3. Charger `Eddy scène 02` → 0 marker (section vide)

---

## Vérifications transversales

| Point | Attendu |
|---|---|
| Scroll horizontal | Le scroll natif sur `.seq-timeline` décale le contenu, **mais pas** la règle ni les labels → **le viewport n'est pas encore synchronisé au scroll DOM** (c'est la Phase 6) |
| Fixture switch | Changer la fixture dans le `<select>` recharge proprement sans résidu visuel |
| Unité temps | Bouton `s`/`ms` change tous les labels (règle + infobar) |
| Taille fenêtre | Redimensionner la fenêtre → la zone temporelle s'adapte (ResizeObserver) |
| Zoom slider | La valeur du slider pilote directement `ctrl.zoom()` |
