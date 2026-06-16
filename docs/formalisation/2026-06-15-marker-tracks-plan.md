# Plan — Pistes de marqueurs nommées

Date : 2026-06-15
Statut : validé — prêt à implémenter

---

## Contexte

`EditorScene.markers: AuthorMarker[]` est aujourd'hui une liste plate, rendue comme un bandeau unique au-dessus des pistes d'éléments (`marker-row.ts`). L'auteur ne peut pas organiser ses marqueurs par catégorie.

Besoin : pouvoir ajouter/retirer des **pistes de marqueurs nommées** (ex. "Visèmes", "Gestes", "Expressions", "Sous-titres") pour structurer visuellement les repères temporels.

Précision du périmètre (réponse utilisateur) :
- Le "builder" qui regroupera ces pistes pour produire une scène CodPlay jouable est un **builder de l'éditeur, pas encore construit, distinct du builder codplay**. Hors scope ici — on ne modélise que le côté éditeur.
- Pas de schéma de payload structuré pour l'instant : le `label` texte porte le sens (ex. label="aa" pour un visème). Le regroupement par piste nommée est la seule structure ajoutée.

---

## Modèle

```typescript
export interface MarkerTrack {
  id: string
  label: string
  color?: string        // couleur par défaut des marqueurs de cette piste
  visible: boolean
  markers: AuthorMarker[]
}
```

`EditorScene.markers: AuthorMarker[]` → `EditorScene.markerTracks: MarkerTrack[]`.

`AuthorMarker` ne change pas (`{ id, timeMs, label, color? }`) — `color` reste une surcharge par marqueur, optionnelle.

---

## Events machine

- `MARKER_TRACK.ADD` `{ track: MarkerTrack }`
- `MARKER_TRACK.REMOVE` `{ markerTrackId }` — cascade : détache (`markerId = undefined`) tout kf accroché à un marqueur de cette piste, conserve leur `timeMs`
- `MARKER_TRACK.RENAME` `{ markerTrackId, label }`
- `MARKER_TRACK.TOGGLE_VISIBILITY` `{ markerTrackId }`
- `MARKER.ADD` gagne `markerTrackId` (obligatoire — comme `KEYFRAME.ADD` exige déjà un `trackId`)
- `MARKER.MOVE` / `MARKER.REMOVE` / `KEYFRAME.ATTACH_MARKER` / `KEYFRAME.DETACH_MARKER` inchangés en signature — recherche du marqueur par id à travers toutes les pistes (id globalement unique, comme aujourd'hui)

`computeSnapGrid` : itère `scene.markerTracks.flatMap(t => t.markers)` au lieu de `scene.markers` — comportement de visibilité identique aux pistes d'éléments (une piste masquée contribue quand même au snap, cf. comportement actuel des `TrackNode`).

---

## Rendu

- `marker-row.ts` → multi-piste : un conteneur `<div class="seq-marker-tracks">` contient un `<svg class="seq-markers">` par `MarkerTrack` (remplace le SVG unique). Pattern identique à `createTrackRowArea`/`renderTrackRows`.
- `track-label-list.ts` : les noms de pistes de marqueurs apparaissent comme lignes de label, **entre le spacer cues et le spacer waveform**, dans le même ordre que `timelineInner` (`cueRow → markerTrackRows → waveformRow → trackRows`). Toggle visibilité réutilise le pattern `seq-label-row__vis`.
- `main.ts` : remplace `createMarkerRow`/`renderMarkerRow` par `createMarkerTrackRows`/`renderMarkerTrackRows`. Ajoute une UI minimale (bouton "+ piste marqueur", bouton "✕" par ligne) — cohérent avec le niveau d'exposition actuel des pistes d'éléments (API contrôleur testée ; UI minimale pour validation visuelle dans le démo).

---

## Migration

- 4 fixtures avec `"markers": []` → `"markerTracks": []`
- `scene-nested-capsule.json` : son marqueur réel (`marker-01`) déplacé dans une piste `{ id: "mtrack-01", label: "Repères", markers: [marker-01] }`
- `controller.spec.ts` : `addMarker(timeMs, label)` → `addMarker(markerTrackId, timeMs, label)` ; tests `EMPTY` créent une piste via `addMarkerTrack` avant d'ajouter un marqueur
- Nouveaux tests : `MARKER_TRACK.ADD/REMOVE/RENAME/TOGGLE_VISIBILITY`, cascade de détachement au `MARKER_TRACK.REMOVE`

---

## Addendum — interactivité + UI gestion des pistes (suite à revue)

- **Ligne "+ piste marqueur"** : ajoutée dans la colonne labels (`track-label-list.ts`), prompt pour le nom → `ctrl.addMarkerTrack`. Un spacer dédié (`.seq-marker-track-add-spacer`, avec `border-bottom` assorti) prolonge la ligne de séparation côté timeline pour l'alignement vertical scroll-synced.
- **Bouton "✕"** par piste de marqueurs → `ctrl.removeMarkerTrack`, suppression directe sans confirmation — acceptable, la garantie de réversibilité est portée par le futur mécanisme undo/redo (pas encore implémenté), pas par un dialogue de confirmation.
- **Sélection de marker** : `MachineSelection` gagne `markerId: string | null` (mutuellement exclusif avec `trackId`/`keyframeId` — chaque action de sélection remplace l'objet en entier). Nouvel event `MARKER.SELECT`, méthode `ctrl.selectMarker(id)`. `MARKER.REMOVE` et `MARKER_TRACK.REMOVE` effacent la sélection si elle pointait vers le marker/la piste supprimée.
- **Marqueurs interactifs** (`render/marker-row.ts`) :
  - **Ajout** : double-clic sur une piste de marqueurs (zone vide) → `onAddMarker(markerTrackId, rawMs)`.
  - **Sélection** : clic sur un marqueur → `onSelectMarker(markerId)` ; rendu avec `.seq-marker__flag--selected`.
  - **Déplacement** : pointerdown sur un marqueur démarre un drag (overlay pointermove/pointerup dans `main.ts`, mirroring `startKeyframeDrag`) — appelle `ctrl.moveMarker` en continu, avec snap via `ctrl.snapToGrid` (méthode publique déjà existante, réutilisée telle quelle — pas de nouvel état XState `dragging-marker` créé, `MARKER.MOVE` committant déjà immédiatement à chaque appel).
  - **Suppression** : marqueur sélectionné + touche Suppr/Retour → `ctrl.removeMarker` (handler clavier existant étendu).

## Fichiers impactés

| Fichier | Changement |
|---|---|
| `types.ts` | `MarkerTrack`, `EditorScene.markerTracks` |
| `machine.ts` | events + handlers + `computeSnapGrid` |
| `controller.ts` | `addMarkerTrack/removeMarkerTrack/renameMarkerTrack/toggleMarkerTrackVisibility`, `addMarker` signature |
| `index.ts` | export `MarkerTrack` |
| `render/marker-row.ts` | rewrite multi-piste |
| `render/track-label-list.ts` | lignes de label pour pistes de marqueurs |
| `main.ts` | wiring + UI minimale |
| `sequence-editor.css` | `.seq-marker-tracks`, état masqué |
| `fixtures/*.json` | migration `markers` → `markerTracks` |
| `tests/controller.spec.ts` | mise à jour + nouveaux cas |
