# Usage - scenarios narratifs V1

Ce dossier decrit des scenarios d'usage cibles du moteur.

But:

- expliquer le comportement attendu sans code runtime
- fournir des references pour les tests d'acceptance
- garder une base lisible pour l'editeur et le player final

Scenarios:

- `01-changement-story-sur-click.md`
- `02-click-sans-transition.md`
- `03-concurrence-events-story-user.md`
- `04-story-attente-event-only.md`
- `05-form-submit-backend-via-strap.md`

Convention:

- chaque scenario decrit: preconditions, sequence, traces attendues, points de vigilance
- les events utilisateur sont emis via `event.emitUser`
- les transitions restent deterministes (priorite + ordre de declaration)
