# Étude des raccords Sommaire et profil

## Résultats de l’enquête

Cette note d’étude conserve les raisons des choix d’intégration ; ce n’est pas
le plan de travail. Le comportement implémenté et ses preuves sont décrits dans la
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

L’état de test est stocké côté serveur dans un enregistrement distinct du
document. Une preview peut lire cet état à son ouverture, mais ses interactions
restent dans sa session et ne sont jamais enregistrées sur le serveur. La
révision dédiée et le compare-and-swap protègent les clients API qui effectuent
des écritures ; l’origine réseau de preview peut lire l’état, mais son prévol
`PUT` reçoit `403`, comme les mutations du document et des médias.

La restitution concerne aussi l’interface des Questions et des Évaluations :
recharger seulement le contexte aurait laissé des contrôles vierges alors que
le scénario croyait les réponses acquises. Les réponses sont donc réadoptées
dans les machines concernées, et une reconfiguration invalide uniquement ce
qui n’est plus compatible.

### Cache preview et état de consultation

**Décision Fixe, appliquée et vérifiée le 27 octobre 2026.** Les composants et
leur configuration appartiennent au contenu édité. Tout l’état de consultation,
navigation comprise, reste dans la session du lecteur, séparément du contenu,
des sources de scène et du cache des ressources. Une variation de cet état à
document inchangé réutilise les ressources et restitue l’état courant. La
preview ne l’enregistre pas sur le serveur.

Le cache conserve des productions réutilisables ; l’état de consultation varie
au cours de la lecture. Capturer cet état dans une source conservée faisait
réapparaître une ancienne réponse ou empêchait de restituer une nouvelle valeur.
L’[audit Learning](../mods/notes/2026-10-27-learning-independence-audit.md#défaut-reproduit--réponses-question-et-cache-de-scènes)
documente les observations avant correction. Les tests d’intégration actuels
couvrent aussi reset et synchronisation dans la popup réelle ; leurs preuves
sont dans les spécifications Preview, Question et Sommaire/profils.

Les composants édités et l’état de consultation ont des cycles distincts. Le
lecteur présente l’état courant dans les composants sans l’inclure dans les
scènes conservées par le cache des ressources. La [note d’étude sur la
responsabilité de l’état de lecture](../mods/notes/2026-10-16-reading-state-ownership-study.md#contenu-édité-et-état-de-consultation)
examine séparément la question plus large du pilotage Sighty.

Les sources de scène sont neutres ; le circuit de rafraîchissement Sighty
restitue la réponse du contexte courant sans republier l’événement de
validation. La popup conserve la page active de Sighty lors d’une reconstruction,
tandis que « Synchroniser » utilise la page choisie dans l’éditeur. Les slots
et directions précédente/suivante sont dérivés du graphe ; aucun historique de
navigation distinct n’est sérialisé. Les spécifications liées décrivent ces
contrats et leurs preuves.

## Références actuelles

- [Inventaire des composants et circuits étudiés](2026-10-14-sommaire-profils-inventaire-technique.md)
- [Plan d’intégration et validations restantes](../plan/2026-10-14-elce-sommaire-profils-plan.md)
- [Contrat vérifié et preuves](../specs/summary-profile-spec.md)

La vérification réseau de preview en navigateur est passée ; la confirmation
sur téléphone et la validation visuelle du Sommaire restent ouvertes dans le
plan. Les qualifications, variantes grammaticales et ACL ne font pas partie
de cette réalisation.
