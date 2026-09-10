# Sighty — première implémentation par une composition simple

## Statut

Statut : En cours — cadrage de la première démo.  
Périmètre du scénario : demandé par l'auteur le 2026-09-10.  
Tranche de montage interscènes : A relire, avant toute implémentation dépendante.  
Implémentation : non commencée.

## Sources à relire

- [Modèle déclaratif Sighty et premier cas concret](../notes/2026-08-17-modele-fichier-declaratif.md),
  notamment les §4, §8 et §9. Les formes proposées restent non normatives.
- [Composition et avancement](../notes/2026-08-01-composition-et-avancement-evenementiel.md).
- [Façade CodPlay](../../codplay/plan/facade-engine-instance-plan.md).
- [Mode hôte](../../codplay/plan/notes/2026-07-28-decoupage-engine-instances-pilotage.md#5-le-mode-hôte--une-instance-jouée-dans-une-autre).
- [Opérations de scène foreign dans le layout](../../codplay/plan/replace-foreign-plan.md).
- [Ressources d'une occurrence de scène](../../codplay/plan/notes/2026-08-30-sighty-scene-resource-lifecycle.md).
- [État de référence CodPlay V2](../../codplay/plan/notes/2026-08-26-decouverte-etat-codplay-v2.md).

## Résultat demandé

Préparer trois fichiers de scènes déclaratives, un pour A, un pour B et un pour
le layout, puis un fichier Sighty déclaratif qui les compose. Les fichiers
auteur ne contiennent aucune fonction de construction intermédiaire.

A porte l'image et le titre centré avec leurs apparitions successives en fondu.
B porte le pavé coloré et l'enchaînement de 1 à 10, chaque seconde. Le layout
porte le découpage visuel. Sighty monte et pilote des instances autonomes à
partir de la composition déclarée.

Le nombre de zones est en clarification : la demande dit dix parties ; la
question posée distingue deux zones A/B et dix zones avec répétition de A/B.
Aucune répartition n'est considérée comme validée sans réponse.

## Étapes et gates

| Étape | Statut | Action et condition de passage |
| --- | --- | --- |
| 0. Reprise | Effectuée | Relire les quatre notes Sighty, identifier les contrats CodPlay concernés et confronter le montage prévu à la façade publique. |
| 1. Scénario précis | En cours | Confirmer le découpage du layout ; préciser les bornes des fondus et le maintien ou la sortie de chaque scène en fin de lecture. |
| 2. Montage interscènes | A relire | Définir et faire accepter la tranche de contrat minimale décrite ci-dessous, ainsi que l'autorisation explicite de modifier le core concerné. |
| 3. Fichiers auteur | À engager après les décisions | Arrêter la représentation des ressources de scène et écrire les trois scènes et le fichier Sighty sans fonctions intermédiaires. |
| 4. Exécution Sighty | À engager après les décisions | Construire le chargement, la validation et l'entrée dans cette composition fixe ; utiliser la façade CodPlay et son preload. |
| 5. Accueil navigateur | À engager après les décisions | Raccorder un hôte de validation pour Sighty ; conserver dans le layout commun les services partagés si le parcours utilise `packages/demos/src/v2`. |
| 6. Validation et documentation | À effectuer | Exécuter le parcours réel, consigner les preuves et documenter uniquement les contrats effectivement acceptés et implémentés. |

## Tranche de montage proposée à la discussion

La capacité manquante est le montage d'une instance de scène dans un slot
déclaré d'une autre instance. La façade actuelle requiert une racine HTML ; elle
ne propose pas de cible de montage interscènes. Le plan `replace-foreign`
décrit les opérations visées mais n'en fournit pas encore l'implémentation.

Avant de coder, arrêter :

1. La relation entre le nom de slot du fichier Sighty et la cible publiée par
   la scène layout, notamment sa portée lorsqu'une scène contient plusieurs
   persos layout.
2. La commande publique et son raccord au pipeline réel pour monter et
   démonter une scène enfant. Les noms d'API et d'events restent à décider ;
   aucune nouvelle syntaxe n'est créée par ce plan.
3. Le moment où la surface hôte est disponible, l'ordre de préparation du
   parent et des enfants, puis leur démarrage.
4. L'identité d'une occurrence, son slot CSS, les ressources qu'elle possède
   et l'ordre du démontage, y compris après un échec partiel.
5. Le comportement de la composition à la fin de A et B : une fin temporelle
   ne doit pas être assimilée implicitement à une demande de démontage.

Cette tranche vise une composition fixe. Elle n'introduit pas de remplacement
animé entre scènes ; elle ne vaut pas validation de toute la capacité
`replace-foreign`. Une éventuelle réduction de son contrat pour le montage
initial doit être explicitement acceptée, pas réalisée comme un contournement.

Le choix entre documents JSON et modules TypeScript exportant directement de
la donnée, leur résolution depuis `resources.scenes`, ainsi que le raccord à
l'hôte de validation seront arrêtés avant les étapes 3 à 5. Le contrat actuel
des démos V2 retourne une seule `SceneDoc` : une composition Sighty nécessite un
raccord explicite, sans fusion des scènes ni nouvelle page cachée dans un
module de démo.

## Invariants à préserver

- Les scènes restent autonomes ; A et B ne connaissent ni le layout ni Sighty.
- Le visuel et le temps des animations sont produits par CodPlay. Sighty
  n'ajoute ni horloge ni mise à jour impérative des nombres ou de l'opacité.
- La composition auteur nomme des ressources et des slots ; elle ne manipule
  pas de nœuds HTML.
- L'exécution utilise le catalogue, le preload, les instances et le circuit
  d'événements CodPlay existants.
- Une lacune de contrat est discutée avant son implémentation. Une lacune du
  runtime n'est pas remplacée par un mécanisme local à la démo.
- Les fonctions nécessaires à la bibliothèque ne doivent pas masquer la
  description des scènes ou de leur composition dans les fichiers auteur.

## Acceptation à prouver

- Compiler chaque scène séparément et la jouer seule, puis monter les mêmes
  documents dans la composition Sighty.
- Observer les deux fondus successifs de A par le player réel, aux bornes et
  pendant l'interpolation.
- Observer les dix nombres de B et les neuf changements espacés de 1 seconde ;
  vérifier les instants de part et d'autre de chaque changement.
- Vérifier le montage dans les slots, la taille des enfants au resize et
  l'indépendance de leurs temps de lecture. Si dix zones sont confirmées,
  vérifier l'identité et l'isolation des occurrences répétées.
- Vérifier Play, pause/reprise, Seek local et replay par les surfaces publiques.
  Un seek d'une scène ne devient pas implicitement un seek de tout Sighty.
- Vérifier le montage, le démontage, le remontage, la libération des CSS et des
  ressources, et l'absence d'effet sur une occurrence sœur encore présente.
- Pour les frontières core modifiées, couvrir les régressions parent/enfant et
  les cas de reparent concernés. Toute catégorie non affectée doit être
  écartée par une analyse explicite.
- Exécuter les tests ciblés, typechecks et builds concernés, puis le parcours
  navigateur réel, dont Safari. Définir la vérification de persistance affectée
  par les faits de montage sans inventer une sauvegarde globale Sighty.

## Suivi de validation

Aucune scène ni exécution Sighty n'a été créée à ce stade. Aucun test runtime
ou navigateur n'a été exécuté. Le constat de montage absent est fondé sur la
lecture des contrats, des types publics et du composant layout ; il ne s'agit
pas d'une panne déjà reproduite dans une démo.

Après validation des décisions et implémentation, créer la spécification
ciblée des capacités réellement prises en charge et un guide utilisateur avec
un exemple concret. Conserver ici les limites de preuve et le suivi des étapes.
