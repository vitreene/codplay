# Checklist de verrouillage V1

Etat de suivi (mise a jour au fil des decisions).

1. Types fondamentaux (refs, identity event, Result/error): **VALIDE**
2. ScenarioGraph minimal V1: **VALIDE** (graphe declaratif + transitions priorisees + wait flow)
3. Catalogue d'events techniques + payloads obligatoires: **VALIDE** (`09-catalogue-events-techniques-v1.md`)
4. Tables de transitions player/story/playable + reasons: **VALIDE** (`10-table-transitions-v1.md`)
5. Resolution de conflits au meme tick: **VALIDE** (`11-resolution-conflits-tick-v1.md`)
6. Contrat plugin list (I/O exacts): **VALIDE** (`12-contrat-plugin-list-v1.md`)
7. Contrat trace/debug (schema + filtres): **VALIDE** (`13-contrat-trace-debug-v1.md`)
8. Alignement convertisseur legacy avec points 1-7: **VALIDE** (`07-compat-legacy-convertisseur-v1.md`)
9. Tests d'acceptance (DoD) finalises: **VALIDE** (`14-tests-acceptance-v1.md`)

Point transversal: registre d'erreurs V1 redige (`15-registre-erreurs-v1.md`).

Etat global: **SPEC V1 COMPLETE (phase conception)**.

## Note de methode

- progresser strictement dans l'ordre 1 -> 9
- ne pas figer un point n+1 tant que n n'est pas valide
