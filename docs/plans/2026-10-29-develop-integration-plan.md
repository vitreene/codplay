# Intégration des branches dans develop — 29 octobre 2026

## Statut et autorisation

En cours. L'utilisateur autorise les fusions dans l'ordre proposé :
`elce-remix`, puis `codplay-replace`, puis intégration du résultat dans
`develop`. Le correctif JSON du dossier temporaire est déjà dans `develop`.
Ce plan autorise la résolution des conflits de fusion en préservant les
contrats des deux branches ; il n'autorise pas de fonctionnalité nouvelle ou
de correction opportuniste du cœur.

## Références et invariants

- Départ `develop` : `f87de99b` ; `elce-remix` : `51e5dd45` ;
  `codplay-replace` : `3e3f93e6`.
- Préserver les imports JSON décrits dans la spécification Remix Elcé et les
  fonctions d'export/SCORM de `elce-remix`.
- Préserver les contrats replace de `codplay-replace` : spécifications slot,
  présentation, texte, média et presets ; conserver les exports publics des
  deux branches et le chemin runtime existant.
- Conserver explicitement la base SQLite de `elce-remix` (811008 octets),
  qui contient « Accueil pour le personnel intérimaire Nutrition & Santé ».
  Sauvegarder les données locales avant leur remplacement.
- Ne pas résoudre un conflit de contrat en choisissant arbitrairement une
  branche. Documenter le point ouvert et arrêter le travail dépendant si
  les spécifications ne permettent pas de trancher.

## Étapes et acceptation

1. En cours — sauvegarder les données et le pointeur `develop` ; travailler
   sur `integration/develop-2026-10-29`.
2. À faire — fusionner `elce-remix`, réunir les dépendances et les circuits
   JSON/assets existants ; conserver les deux suivis documentaires. Vérifier
   JSON, typecheck, tests et build Elcé.
3. À faire — fusionner `codplay-replace`, conserver la base choisie et réunir
   les exports publics sans modifier les contrats. Vérifier les conflits de
   spécification et les tests runtime, montage parent/enfant, reparent,
   Play/Seek/replay/resize/persistance/lifecycle des suites concernées.
4. À faire — lancer les typechecks CodPlay/Sighty/Elcé/démos, les tests des
   workspaces touchés et les builds applicables ; comparer tout échec aux
   branches de référence avant de l'attribuer à la fusion.
5. À faire — examiner la configuration MCP et l'inventaire exposé avant le
   contrôle navigateur réel (éditeur/popup Elcé et démos replace). Garder les
   validations indisponibles ou en échec explicitement ouvertes.
6. À faire — vérifier le document choisi et l'ascendance des trois commits,
   intégrer le résultat dans `develop`, mettre à jour les preuves dans les
   spécifications propriétaires et le présent suivi sans déclarer une
   acceptation fonctionnelle plus large que les contrôles réalisés.

## Preuves et points ouverts

Les simulations initiales annoncent quatre conflits pour la première fusion.
L'autre ordre réunirait neuf fichiers en conflit dans la seconde fusion.
L'ordre retenu sert à isoler les sujets, sans promettre moins de conflits.
