# Étude des raccords Sommaire et profil

## Résultats de l’enquête

Cette note conserve les raisons des choix d’intégration. Le comportement
implémenté et ses preuves sont décrits dans la
[spécification Sommaire et profils](../specs/summary-profile-spec.md) ; l’ordre
et le suivi de la validation restante sont dans le
[plan dédié](../plan/2026-10-14-elce-sommaire-profils-plan.md). Les formats
internes employés pour avancer sont exposés dans ce plan pour relecture.

### Document et consultation

Le document auteur reste détenu par XState et ses commandes. Le profil, la
progression et les réponses sont un état de consultation séparé : les ranger
dans l’historique documentaire aurait mélangé les modifications du projet et
les essais du lecteur. Une projection unique du document et du profil alimente
le menu, les routes, les scènes et l’Évaluation ; les calculer séparément aurait
pu produire des listes et des parcours contradictoires.

Le filtrage des BDC ancrés s’appuie sur la projection existante du Flux, afin
qu’un contenu masqué perde aussi son emplacement dans le texte présenté. Le
cache de scène dépend du contenu et des valeurs réellement projetés ; une scène
construite pour un autre profil ne peut pas être réutilisée sans vérifier ces
dépendances.

### Scènes enfant et navigation

Sighty reste propriétaire des gardes et des routes. Le Sommaire et le
Formulaire sont des scènes CodPlay enfants montées dans les slots Sighty. Le
Formulaire est séparé du BDC Question : il valide une collecte multi-champs
sans correction ni score. Le Sommaire transmet une intention de sélection au
scénario ; il ne porte ni catalogue parallèle ni règle d’accès.

Les routes doivent désigner la scène à l’intérieur du slot contenu. Viser la
vue qui déclare le slot ne rend pas la scène enfant active. Les événements de
champs restent adressés à la story du Formulaire ; seuls les événements de
profil prévus remontent au scénario. Cette frontière maintient les commandes
de saisie locales et le passage de page dans l’admission Sighty.

### État de test auteur

L’état de test est stocké côté serveur, dans un enregistrement distinct du
document. L’éditeur, sa popup et la preview réseau doivent retrouver le même
état. Une révision dédiée évite qu’une fenêtre plus ancienne écrase une
modification récente ; la route de preview autorise l’état de test tout en
laissant les modifications du document et des médias interdites.

La restitution concerne aussi l’interface des Questions et des Évaluations :
recharger seulement le contexte aurait laissé des contrôles vierges alors que
le scénario croyait les réponses acquises. Les réponses sont donc réadoptées
dans les machines concernées, et une reconfiguration invalide uniquement ce
qui n’est plus compatible.

## Références actuelles

- [Inventaire des composants et circuits étudiés](2026-10-14-sommaire-profils-inventaire-technique.md)
- [Plan d’intégration et validations restantes](../plan/2026-10-14-elce-sommaire-profils-plan.md)
- [Contrat vérifié et preuves](../specs/summary-profile-spec.md)

La validation visuelle du Sommaire et la vérification de la preview réseau sur
navigateur et téléphone restent ouvertes dans le plan. Les qualifications,
variantes grammaticales et ACL ne font pas partie de cette réalisation.
