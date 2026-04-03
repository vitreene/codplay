# Session context - 2026-04-03

## Etat de la session

Travail en mode formalisation (pas de production de code runtime demandee).

Point de cloture:

- la partie `ModuleRegistry` est consideree terminee en V1
- on arrete la session ici pour reprise ulterieure

## Decisions validees

### Registry modules

- la table fournie par l'hote complete la table interne
- override autorise par meme nom de type
- un seul module retenu par type apres init
- registry fige pendant la scene
- type perso absent du registry:
  - perso ignore
  - warning console
- modules integres toujours montes
- en debug: afficher types detectes, module choisi par type, persos ignores

### Actions custom perso

- ordre de traitement fixe:
  1. commande module (`cmd`)
  2. resolution cible
  3. patch standard (`style/className/attr/move`)
- si `cmd` echoue: la partie visuelle standard continue
- en mode `root-only`, `targetId` non autorise: ignore + warning
- `targetId=root` resolu directement par le player
- cibles exposees dynamiques: resolution a chaque action
- severite retenue pour ce flux: `warn`

## Documents formalisation crees/mis a jour

- `evolution/formalisation-modele/09-perso-custom-actions-v1.md`
- `evolution/formalisation-modele/10-api-host-v1.md`
- `evolution/formalisation-modele/11-runtime-context-mapping-v1.md`
- `evolution/formalisation-modele/README.md`
- `evolution/formalisation-modele/plan-consolide.md`

## Restant a traiter (plan global)

1. format commun des diagnostics (compilation + execution)
2. contrat scene I/O avec orchestrateur parent
3. extension modules custom au-dela du V1
4. format des exports builder (player package, legacy report, checklist debug -> diffusion)
5. cote produit: telco websocket (V2)

## Regle de reprise

Reprendre au point 1 de la liste "Restant a traiter".
