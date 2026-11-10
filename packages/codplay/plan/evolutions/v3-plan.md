# Évolutions CodPlay V3

## Résultats asynchrones des straps

> Décision de report : V3. Conception et application non engagées.

L’invalidation et l’annulation des résultats asynchrones devenus obsolètes
sont reportées à V3. Le runtime V2 attend le résultat du strap appelé.

Avant réalisation, arrêter l’identité d’une opération, les frontières qui
rendent sa réponse obsolète et le traitement de cette réponse. Définir les
preuves d’ordre, de journalisation, de Seek/reset et de destruction à partir
du circuit existant. Aucun nouveau helper ou port n’est adopté ici.

Le contrat courant est dans la
[spécification des straps](../../specs/strap-execution-v2-spec.md).
