# Notes — délibération modèle d'Item

## `TrackNode.contentType` vs `ItemType` — analyse complète ayant mené à la fusion

Question posée : `contentType` (sequence-editor) est-il une pure info méta redondante avec `ItemType` (dedit), ou désigne-t-il autre chose (le composant Codplay réel) ?

Recherche menée : `contentType?: 'text' | 'image' | 'media' | 'video'` (sequence-editor-grid-spec §2.2) n'a aucune élaboration écrite au-delà de sa déclaration de type — aucune prose ne l'explique dans la spec, et le code (audit du 2026-07-08) confirme qu'il n'est lu par aucune logique nulle part (ni render, ni machine, ni controller). Seule preuve disponible pour trancher : son vocabulaire.

- `contentType` utilise `'image'` et `'video'` — pas le vocabulaire des composants Codplay réels (`img`, pas `image` ; pas de `'video'` du tout, la vidéo passe par le composant générique `media`).
- Son vocabulaire est un sous-ensemble exact d'`ItemType` (`text|image|media|video|capsule`, moins `capsule` géré à part par `kind`).

Conclusion retenue : `contentType`, tel qu'il existait, était une information méta de même nature qu'`ItemType`, pas une désignation du composant Codplay réel — donc redondant. D'où la décision de fusion (`TrackNode.itemType: ItemType` remplace `contentType`).

## Pourquoi le type de composant Codplay n'est jamais stocké séparément

Discuté : si un jour un item a besoin d'un composant de rendu différent du défaut de son `itemType` (dérogation), un nouveau champ explicitement nommé pour ça (ex. `componentOverride`) serait la bonne réponse — pas une résurrection de `contentType`, qui désignerait alors une chose différente de ce qu'il désignait à l'origine (voir le même type d'erreur évité pour capsule §12.5/§12.6 de la spec capsule).
