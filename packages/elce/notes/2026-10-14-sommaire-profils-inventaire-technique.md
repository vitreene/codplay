# Inventaire technique Sommaire et profils

## Objet

Repères relevés pendant l’enquête pour identifier les propriétaires existants
et éviter un second circuit. Les choix internes de données adoptés pour
l’intégration sont consignés dans le
[plan actif](../plan/2026-10-14-elce-sommaire-profils-plan.md) ; les contrats
vérifiés sont dans la
[spécification](../specs/summary-profile-spec.md).

## Propriétaires retenus

| Besoin | Circuit Elcé réutilisé | Raccord réalisé |
| --- | --- | --- |
| Configuration éditoriale | `ElceDocument`, commandes, historique XState | Sommaire, propriétés, champs et contraintes restent dans le document auteur. |
| Projection du parcours | Builders scénario, gardes Sighty et projection des ancres Flux | Une projection filtrée alimente le menu, les scènes, les routes et l’Évaluation. |
| Liste du Sommaire | Scènes enfant CodPlay et slots Sighty | La scène reçoit les entrées retenues et transmet les intentions de navigation à Sighty. |
| Collecte du profil | `input`, `Perso.emit` et story CodPlay | Un Formulaire enfant valide tous les champs, puis transmet les valeurs au contexte lecteur. |
| Valeurs et étiquettes | Contexte Sighty, contenu Tiptap et service HTML | Des références stables sont résolues lors de la projection de lecture ; le document auteur reste inchangé. |
| Progression et réponses de test | Player Elcé, machines Question et Évaluation | L’état de test est distinct du document et restauré dans les contrôles concernés. |
| Persistance et preview | API projets, routeur HTTP, SQLite et popup | Une route et une ligne serveur distinctes portent l’état test ; la preview lit l’état initial et garde ses changements en session, sans écriture serveur. |

## Repères de code et contrats

- Le document et ses commandes sont décrits dans
  [document-model-spec](../specs/document-model-spec.md).
- Le montage de scènes enfant et les routes sont décrits dans
  [summary-profile-spec](../specs/summary-profile-spec.md) ; les frontières
  CodPlay et Sighty applicables restent dans leurs propres spécifications.
- La projection Flux existante est
  [`flux-anchor-player-markup.ts`](../src/builders/flux/flux-anchor-player-markup.ts).
- Le scénario et ses gardes sont construits dans
  [`scenario-builder.ts`](../src/builders/scenario/scenario-builder.ts).
- Le Formulaire et la projection de lecture sont indexés dans la spécification
  dédiée avec leurs tests de composition.
- L’API projet et la persistance SQLite restent documentées dans
  [project-api-spec](../specs/project-api-spec.md), avec la route de test
  auteur décrite par la spécification Sommaire et profils.

La séparation retenue répond à deux frontières repérées pendant l’enquête :
les commandes du document ne doivent pas enregistrer les réponses de lecture,
et Sighty doit rester l’unique propriétaire de l’admission des routes.

## Hors périmètre de cette tranche

Les qualifications issues de résultats, le dévoilement progressif, les
variantes grammaticales, les ACL et les comptes de lecteurs restent différés.
La validation visuelle du lecteur et de la preview réseau est suivie dans le
plan actif.
