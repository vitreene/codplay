# sequence-editor — représentation et chantiers propres

Ce qui concerne **exclusivement le sequence-editor** (le module timeline vanilla) : sa représentation visuelle des pistes, ses chantiers d'affichage et d'édition audio. Isolé du modèle de données (`2026-07-11-ed2-document-model.md`), qui décrit *ce que le document contient* ; ici on décrit *comment le sequence-editor le montre et l'édite*. Non normatif.

Rappel : le sequence-editor est un **îlot vanilla** piloté par intentions (il ne possède pas le document). Ces sujets touchent sa surface d'affichage/geste, pas la structure de données.

---

## Chantier « mini-éditeur audio » — commencé, PAS fait

Une tâche avait été amorcée pour intégrer au sequence-editor un **mini-éditeur audio** :
- **plusieurs sons** à la suite ou ensemble (série / parallèle) ;
- **gestion du volume** ;
- **clip son** (borner la portion jouée).

**État (vérifié 2026-07-11)** : rien de cela n'existe. `EditorScene.audio?` est un `AudioTrack` **unique** ; aucune notion de volume/gain ni de clip son dans le modèle (le seul `drawing-clip` du code concerne les **clips de transition d'items**, pas l'audio). **Chantier à part, non réalisé.**

Dépendances : `durationSource: 'audio-primary'` (récupérer la durée du son master) et le passage à **plusieurs sons** attendent ce chantier. D'ici là, le modèle son se limite à un son master + sa piste de cues.

---

## Représentation des pistes — questions ouvertes (rien de tranché)

Subtilités visuelles à reprendre **au moment du multipiste**, pas maintenant. Elles concernent l'affichage du sequence-editor, pas le modèle.

### Accompagnement audio au multipiste

Un son d'**accompagnement** (média simple, sans cues — cf. modèle, « deux natures ») pourra **rejoindre visuellement les autres sons** dans la zone multipiste audio, plutôt que d'apparaître comme un item.
- Cohérent car un son n'a **pas de rendu visuel** (son DOM n'est jamais visible), contrairement à un item posé.
- Simple **regroupement d'affichage**, à faire quand le multipiste existe. N'affecte pas le modèle (l'accompagnement reste un item média simple ; seule sa représentation change).

### Vidéo master — placement et pistes solidaires

Cas limite : une vidéo **master** est **à la fois** une image posée **visible** (item) **et** une **piste son master** (sa bande son cale le rythme) — elle froisse la séparation item-accompagnement / master-audio.

**Direction pré-multipiste (proposition, pas tranchée)** :
- **Une vidéo master a vocation à s'afficher tout le temps de la scène** → son placement n'est plus arbitraire, elle occupe le plein temps (comme un fond). Le placement devient déterminé.
- **Séparer visuellement ses deux pistes** : une **piste vidéo** et une **piste son master**, **distantes** dans le sequence-editor mais **solidaires** logiquement (même source). Évite l'objet hybride « des deux côtés » : deux pistes liées, pas un item qui serait aussi un master.
- **Question ouverte** : *où* placer la piste vidéo (la piste son master a sa piste dédiée ; la piste vidéo solidaire, où ?). À trancher.

**Statut** : direction pour la période **pré-multipiste** ; non implémenté. À reconsidérer au multipiste avec le regroupement ci-dessus.

---

## Rappel — ce qui relève du modèle, pas d'ici

Pour mémoire, ne pas rapatrier ici : la structure des cues (repères ponctuels aimantés), le rattachement des cues au son master, la distinction son master / média d'accompagnement — ce sont des faits du **modèle de données** (`2026-07-11-ed2-document-model.md`). Ce document ne traite que leur **représentation et leur édition** dans le sequence-editor.
