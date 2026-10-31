# Sequence Editor V2 — cues et marqueurs

## Rôle

La timeline V2 projette les repères temporels du document dans son snap grid.
Elle garde chaque repère sous son propriétaire documentaire et utilise un
circuit unique pour l’aimantation des KFs.

## Contrat

- Un `Cue` appartient à `Content`, car son instant vient de la source média.
  Sa date ne se déplace pas dans la timeline Editor. Un KF peut s’aimanter à
  son instant pendant un drag ; la commande de déplacement conserve uniquement
  le `timeMs` obtenu et ne crée pas de lien durable vers la cue.
- Un `Marker` appartient à un `MarkerTrack` auteur et peut être déplacé.
  `Keyframe.markerId` peut le référencer ; déplacer ce marqueur déplace les KFs
  qui lui sont attachés. Le retirer détache ces KFs en conservant leur instant.
- Les cues et les marqueurs alimentent le même snap grid de la machine de
  timeline. La cue reste fixe quand un marqueur ou un KF est déplacé.
- La création d’un KF au pointeur suit ses règles de quantification propres ;
  ce contrat d’aimantation vise le déplacement d’un KF existant.
- Aucun registre ou calcul parallèle de repères n’est ajouté. SQLite conserve
  les cues dans leur `Content` et les `MarkerTrack` dans le document de scène.

## Invariants

- La séquence reste l’unique propriétaire de l’interaction de drag et du snap.
- Les changements auteur continuent d’être émis par les commandes existantes ;
  la machine de timeline ne mute pas localement le document.
- Le format du document et son stockage ne fusionnent pas les deux types de
  repère.

## Preuves

- [`tests/sequence-editor/machine.spec.ts`](../tests/sequence-editor/machine.spec.ts)
  vérifie la projection des deux types dans le snap grid, le drag d’un KF vers
  une cue fixe et l’absence de `markerId` après ce snap.
- [`tests/sequence-editor/commands.spec.ts`](../tests/sequence-editor/commands.spec.ts)
  vérifie que déplacer un marqueur propage le temps aux KFs attachés et laisse
  les cues de la source inchangées.
- [`tests/app/persistence/sqlite-editor-scene-persistence.spec.ts`](../tests/app/persistence/sqlite-editor-scene-persistence.spec.ts)
  vérifie le round-trip des cues et des pistes de marqueurs dans leurs champs
  documentaires existants.
