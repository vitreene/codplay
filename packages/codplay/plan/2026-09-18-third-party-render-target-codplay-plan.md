# Plan d'acceptation du pont CodPlay vers les cibles tierces

> Statut : **En cours**. Les contrats de relation compilée, de résolution
> player-local et de préparation des bibliothèques sont vérifiés et décrits par
> leurs spécifications. Le pont ne sera qualifié de générique qu'après
> validation des intégrations tierces prévues.

## Périmètre et autorité

Ce plan suit l'acceptation du pont CodPlay qui transmet une cible opaque à un
composant projeté. Il ne redéfinit pas les contrats déjà vérifiés :

- [relation `rel`](../specs/third-party-rel-spec.md) : donnée auteur, forme
  compilée, immutabilité et validation ;
- [pont runtime des cibles](../specs/third-party-target-bridge-spec.md) :
  registres distincts, publication, résolution et disponibilité player-locales ;
- [préparation des bibliothèques](../specs/third-party-library-spec.md) :
  propriété engine, déduplication, ordre de préparation et libération ;
- [spécifications Three.js](../specs/third-party-threejs-spec.md) et
  [Rive](../specs/third-party-rive-spec.md) : comportements d'intégration
  vérifiés à ce jour.

Les types de bibliothèques, leurs conventions natives, leur rendu et leurs
ressources restent possédés par leurs intégrations. Le matérialiseur global
CodPlay demeure HTML/DOM. Toute modification du cœur exige une lacune prouvée,
un plan accepté et l'autorisation explicite requise par les règles du dépôt.

## Décisions et validations restantes

1. **Valider la comparaison Three.js, Rive et Lottie.** Confirmer que les
   structures CodPlay décrites dans les specs couvrent leurs propriétaires de
   contexte, identités, cardinalités, temps, ressources et diagnostics. Toute
   lacune générique retourne ici comme décision ; une convention de bibliothèque
   reste dans le package qui la possède.
2. **Achever l'acceptation Three.js.** La préparation, les contributions
   pilotées au temps CodPlay et le commit de l'hôte ont des preuves ciblées.
   Compléter les contrôles de cycle de destruction et les parcours navigateur
   indiqués par le [plan des composants tiers](./2026-09-18-third-party-components-v2-plan.md).
3. **Achever l'acceptation Rive.** Les tests déterministes couvrent la state
   machine, le commit, les broadcasts, le Seek et le preload. Compléter les
   contrôles navigateur et de cycle de vie prévus par ce même plan ; ne pas
   déduire le comportement réel d'un fichier Rive à partir d'un artboard
   synthétique.
4. **Établir le cas Lottie.** Son intégration et les comportements qui
   démontrent l'emploi du pont restent à valider dans le plan des composants.
   Ne pas ajouter de champ, registre ou contrat core propre à Lottie.
5. **Valider les frontières communes avec des intégrations réelles.** Couvrir
   isolation engine/player, cible temporairement indisponible et remontée,
   plusieurs consommateurs d'une cible, préparation et échec de ressources,
   Seek avant/arrière, reset, replay, resize et destruction selon les capacités
   réellement exercées.
6. **Exécuter l'acceptation navigateur.** Tester les parcours concernés dans
   Safari et un second navigateur avec les vrais runners et intégrations. Une
   cible factice ou une suite isolée ne clôt pas cette gate.

## Critères de clôture

- La comparaison des familles confirme les frontières communes sans imposer
  leurs détails au core.
- Three.js, Rive et Lottie ont chacune une preuve fidèle de leur cycle réel ou
  leur périmètre est explicitement retiré de cette tranche.
- Les validations navigateur et de destruction applicables sont terminées.
- Toute lacune de contrat CodPlay est enregistrée comme décision et planifiée
  avant toute implémentation du cœur.
- Les specs ne reçoivent que des comportements intégrés et vérifiés. Une fois
  toutes les gates closes, retirer ce plan si ses spécifications couvrent la
  feature.
