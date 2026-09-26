# Plan — entrée AuthorApi V1 de selection-frame

> Statut : **En cours**. Les comportements vérifiés de l’entrée racine sont
> consignés dans la [spécification V1](../specs/selection-frame-v1-spec.md).
> Le périmètre de support et son acceptation intégrée restent à décider.

## Décisions ouvertes

| Sujet | État constaté | Décision et parcours d’acceptation |
|---|---|---|
| Support de l’entrée racine | `createSelectionFrame()`, `createMultiSelectionFrame()` et leurs adaptateurs dépendent d’`AuthorApi` V1. Le code source de l’éditeur utilise `/v2` ; aucun appel applicatif à l’entrée racine n’a été trouvé. | Décider si l’entrée racine reste une surface V1 maintenue, devient une surface explicitement dépréciée, ou est retirée après migration de ses consommateurs. L’inventaire des imports et la documentation de la version supportée doivent refléter le choix. |
| Acceptation intégrée de l’entrée racine | Le plan initial prévoyait une scène de démonstration. Aucune démo V1 de SelectionFrame n’est présente ; les tests actuels exercent surtout les modules et adaptateurs dans leur environnement de test. | Si l’entrée reste maintenue, choisir une fixture navigateur et vérifier un vrai parcours `Player V1 → AuthorApi → SelectionFrame → adaptateur`, dont déplacement, resize, rotation, échelle, les règles de poignées (ancre, ratio et Shift), seek/remontage, annulation, perte de capture et destruction. Si elle est dépréciée ou retirée, valider à la place la migration et l’absence de consommateur restant. |
| Sélection multiple | L’implémentation et les tests couvrent le déplacement partagé et la présence partielle ; le plan initial décrivait aussi le redimensionnement de la sélection multiple et la géométrie de son cadre, qui ne sont pas certifiés ensemble. | Décider si le redimensionnement multiple reste requis. S’il est maintenu, vérifier les poignées, les deltas transmis à tous les items connectés, l’union géométrique et la règle de rotation commune ; sinon, retirer ces attentes de la surface V1 documentée. |
| Présentation et cible en contexte grille | Les tests isolent la géométrie et `GridPlacementAdapter`, mais n’exercent pas ensemble le gabarit, l’aperçu du clone, la détection de la cellule et le commit du drop depuis un vrai cadre. | Si le contexte grille reste supporté par l’entrée V1, une fixture navigateur vérifie que la cellule prévisualisée et celle appliquée coïncident sur pistes irrégulières, gaps, spans et éléments transformés, y compris au relâchement. Le raccord des zones nommées et des attaches d’items reste au plan zone-editor. |
| Resynchronisation et seuil d’affichage | Le cadre expose `sync()` et son code installe un `ResizeObserver`; le contrat de scroll/redimensionnement côté hôte et le seuil `minSizePx` ne sont pas couverts par les tests. | Décider quels changements d’environnement le propriétaire hôte doit relayer à `sync()`, puis vérifier leur effet dans la fixture retenue. Vérifier aussi le masquage sous `minSizePx` avant de certifier cette option. |
| Fin de session de pointeur | Les tests vérifient `pointercancel`, l’interruption à la disparition d’un nœud et l’application sur `lostpointercapture` via le cadre multiple. La garde bouton primaire et le cas `pointermove` avec `buttons === 0` n’ont pas de preuve dédiée. | Couvrir ces deux cas aux limites avec le parcours navigateur ou un test ciblé avant de les publier comme contrat vérifié. |

## Frontières établies

- Le mode création relève de la [spécification création](../specs/creation-mode-spec.md).
- Le modèle et l’éditeur de zones relèvent de la
  [spécification zone-editor](../specs/zone-editor-spec.md) ; son intégration au
  drop et à l’éditeur hôte reste dans le
  [plan zone-editor](./zone-editor-plan.md).
- L’entrée `/v2` et le bridge dedit sont une surface distincte ; leur
  intégration ne certifie pas l’entrée racine AuthorApi V1.

## Ordre de traitement

1. Trancher le maintien de l’entrée racine V1 et des adaptateurs associés.
2. Appliquer ce choix aux exports et aux références documentaires.
3. Suivre le parcours d’acceptation correspondant au choix, puis aligner le
   statut de la spécification sur les preuves obtenues.
