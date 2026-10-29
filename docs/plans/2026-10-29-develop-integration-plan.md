# Intégration des branches dans develop — 29 octobre 2026

## Statut et autorisation

En cours — intégration prête ; acceptation globale CodPlay ouverte sur cinq
échecs FLIP préexistants. L'utilisateur autorise les fusions dans l'ordre proposé :
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

1. Fait — sauvegarder les données et le pointeur `develop` ; travailler
   sur `integration/develop-2026-10-29`.
2. Fait — fusionner `elce-remix`, réunir les dépendances et les circuits
   JSON/assets existants ; conserver les deux suivis documentaires. Vérifier
   JSON, typecheck, tests et build Elcé.
3. Résolu et vérifié — fusionner `codplay-replace`, conserver la base choisie et réunir
   les exports publics sans modifier les contrats. Vérifier les conflits de
   spécification et les tests runtime, montage parent/enfant, reparent,
   Play/Seek/replay/resize/persistance/lifecycle des suites concernées.
4. Fait — lancer les typechecks CodPlay/Sighty/Elcé/démos, les tests des
   workspaces touchés et les builds applicables ; comparer tout échec aux
   branches de référence avant de l'attribuer à la fusion.
5. Fait pour les parcours ciblés — examiner la configuration MCP et l'inventaire exposé avant le
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

Première fusion : les quatre conflits sont des ajouts complémentaires.
Les dépendances JSON et SCORM sont réunies, la liste d'accès partagée inclut
`exclusive-sync` et le serveur conserve le loader JSON ainsi que les fontes.
Typecheck et build Elcé passent. Suite Elcé : 517 succès et un échec `EPERM`
sur l'écoute HTTP en environnement restreint ; les 16 tests SQLite et les
16 tests JSON passent ensuite avec accès aux ports locaux (32/32).
Sauvegarde des données et copie SQLite cohérente :
`/var/folders/zn/1p16lqb960q77_y8cn3m851r0000gn/T/codplay-before-develop-merges-pn1ni5k_`.
Point de retour : `backup/develop-before-integration-2026-10-29`.

Décision acceptée pendant l'intégration : les deux déclarations vidéo
`master: false` des démos `replace-carousel/main.ts` et
`sighty/replace-slot/scenario.ts` deviennent `sync: 'auto'`, selon la
spécification media-sync existante. Cette correction appartient aux scénarios
auteur : le runtime refuse correctement l'ancien champ et garde son chemin
réel de validation, lecture native, remplacement et synchronisation.
Elle n'ajoute ni API ni compatibilité au cœur.

## Restauration du contenu — correction autorisée

L'utilisateur constate les pages sans contenu et les images absentes, puis
demande explicitement de récupérer l'intégralité du contenu et de fixer le
souci, en laissant le choix interne à l'implémentation. Statut : En cours.

- Cause du rendu : `TagComponent` transmet désormais `null` lorsqu'aucun
  contenu texte n'est défini ; `html-content-service.ts` écrit alors
  `textContent = ''`, ce qui retire aussi les enfants du materializer. La
  composition Elcé passe 49/49 sur `elce-remix`, contre 39/49 après fusion.
- Étendre le circuit propriétaire existant `html-content-service.ts` : suivre
  par nœud le contenu réellement écrit et retirer uniquement celui-ci lors
  d'un effacement. Préserver les enfants ajoutés par le materializer, le texte
  inchangé, le remplacement explicite et le Seek des transitions texte.
  Aucune correction locale des builders ou démos pour masquer ce défaut.
- Vérifier le service, une scène autonome parent/enfants avec Play, Seek,
  reparent, replay, resize et destruction, toutes les transitions replace,
  le montage interinstances et les 49 tests de composition Elcé ; compléter
  par l'éditeur/popup et les démos réelles dans Brave.
- Cause des images : les 63 références de la base choisie pointent sur des
  fichiers absents. La sauvegarde antérieure aux fusions ne contient déjà
  qu'un ancien média d'un autre document. Les 59 sources Nutrition sont
  retrouvées avec SHA-256 identique. Restaurer les octets sous leurs clés
  existantes via FileStorage, sans réécrire le document ni la base ; chercher
  aussi les quatre sources Demo5 et vérifier les réponses HTTP et les images
  décodées. Les données de contrôle navigateur restent isolées.
- Les cinq assertions FLIP génériques échouent aussi sur `elce-remix`
  inchangée ; ne pas les corriger opportunistement dans cette intégration.

## Acceptation après correction

- Elcé : 75 fichiers, 518 tests réussis, dont les 49 tests de composition.
- CodPlay : 1008 tests réussis, un échec attendu et cinq échecs FLIP identiques
  à la référence `elce-remix` (23 succès/5 échecs sur les deux fichiers de
  référence). Les tests replace, parent/enfants, reparent, montage foreign,
  Seek/replay/resize/lifecycle et exports passent. La correction du contenu
  ne stabilise pas les cinq cas du
  [suivi motion](../../packages/codplay/plan/runner-flip-integration-study.md).
- Sighty : 61/61 ; component-v2 : 56/56 ; SCORM : 52/52 ; exclusive-sync : 6/6.
- Typecheck CodPlay, Sighty, Elcé, démos V2, SCORM et exclusive-sync : succès.
  Builds player CodPlay, Sighty, Elcé et démos : succès. Les builds Vite
  gardent leur avertissement de taille de bundle.
- Médias locaux : 63/63 restaurés via FileStorage, taille et SHA-256 identiques
  aux références SQLite ; 63/63 réponses HTTP Range `206` sur les APIs isolée
  5296 et habituelle 5181. Le fichier SQLite courant est exactement celui de
  `elce-remix` (`574702d0f11821e11eb43387656943b234886fc6`). Aucun lien documentaire
  n'est réécrit ; les octets sont dans le stockage local ignoré par Git.
- Brave configuré et exposé ; Firefox désactivé et sans outils exposés.
  Éditeur réel Nutrition ouvert et synchronisé ; prévisualisation avec
  paragraphes et image native 1680 px ; replace-carousel joué, Seek à 1800 ms
  et resize avec 14 vues transitoires, images décodées et vidéos prêtes ;
  Sighty replace-slot navigue de A à B via sa télécommande existante.
- Les échecs initiaux de délai disparaissent à la relance isolée ; aucun
  timeout ni test n'a été modifié pour les masquer. Les avertissements
  d'espacement de six fichiers importés proviennent de `codplay-replace` et
  ne sont pas corrigés hors périmètre.
