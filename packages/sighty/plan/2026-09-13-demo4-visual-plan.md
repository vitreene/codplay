# Sighty — plan de corrections visuelles de la démo 4

## Statut

**En cours — correction de présentation demandée, limitée à la démo.**

Ce plan ne définit ni la navigation ni le cycle de vie de Sighty. Il décrit les
corrections visibles à apporter à la fixture Demo 4 avant de poursuivre la
preuve du runtime. Le plan principal de navigation est
[`2026-09-13-sighty-navigation-plan.md`](./2026-09-13-sighty-navigation-plan.md).

## 1. Référence visuelle

La référence porte uniquement sur la vue de démonstration et sa telco de
scène. Elle distingue deux niveaux qui ne doivent pas être confondus :

- le dispositif de montage de la vue, décrit par le scénario et raccordé par
  Sighty/CodPlay ;
- le layout de la démo, extérieur au scénario, qui organise visuellement la
  page autour de la vue montée.

La démo 4 conserve l'organisation visuelle éprouvée par la démo 2 :

```text
page
└── vue principale
    ├── menu, sans telco de scène
    └── chapitre
        ├── scène principale
        │   └── scène active
        └── telco de scène, sous la scène principale
```

Dans un chapitre, la scène active occupe l'espace principal. La telco de scène
est montée en-dessous et conserve ses contrôles graphiques propres. Elle est
absente lorsque le menu est affiché. Elle ne doit pas être confondue avec la
télécommande générale de la page.

La télécommande générale de Sighty appartient au layout partagé. Elle est
hors du scénario et hors de cette référence visuelle ; son emplacement et son
fonctionnement ne sont pas traités ici.

## 2. Corrections à traiter

### Présentation de la scène

- conserver une scène principale pleine hauteur et largeur disponibles ;
- maintenir la composition de la scène B centrée dans sa surface ;
- faire occuper à la scène C toute sa surface avec son fond et ses lettres ;
- conserver les points d'accès sans boîte lorsqu'ils ne portent pas une
  composition : les ancres commentées reçoivent directement les racines des
  slots ;
- supprimer les niveaux visuels ajoutés uniquement par la page lorsqu'ils ne
  servent ni la composition ni un point d'accès réel ;
- préserver les styles et l'aspect établis des scènes A et B.
- régler la durée du `replace` entre les scènes du chapitre à 1 seconde pour
  rendre la transition observable pendant la démonstration.

### Telco de scène

- conserver les boutons graphiques `previous` et `next` dans la telco située
  sous la scène ;
- utiliser un seul bouton graphique pour la lecture et la pause : son intention
  est un toggle et son icône/libellé reflète l'état de la scène ;
- conserver le bouton graphique de rembobinage séparé du toggle ;
- conserver le slider de progression dans cette telco ;
- projeter la progression de façon coalescée et différée afin que cette mise à
  jour secondaire ne retarde pas la commande de lecture/pause ;
- observer uniquement la scène actuellement sélectionnée et retirer ses
  abonnements lors de toute sortie de scène ;
- invalider les projections différées et les commandes de la sélection
  précédente dès que la vue active change ;
- monter la telco uniquement dans le chapitre ; elle est absente du menu, et
  non simplement désactivée ;
- conserver une apparence distincte de la télécommande générale ;
- ne pas ajouter de titre bavard pour expliquer la fonction des commandes.

## 3. Responsabilités et limites

Ces corrections appartiennent aux styles de la démo, à ses documents de scène
et à la page commune lorsque celle-ci est concernée. Elles ne doivent pas
modifier :

- la forme du graphe déclaratif ;
- la résolution des événements ou des routes ;
- la sélection active détenue par Sighty ;
- le préchargement, le montage, le démontage ou la libération des ressources ;
- les contrats du composant hôte CodPlay.

La télécommande générale de Sighty, le volet de logs et la responsivité du
layout partagé sont des éléments de page distincts. Ils ne servent pas de
référence pour le montage de la vue ni pour la telco de scène.

La telco, lorsqu'elle est présente dans le chapitre, peut observer la scène
sélectionnée et lui relayer son slider ; cette observation est une feature de
présentation. Elle ne doit pas devenir une seconde implémentation de navigation.

## 4. Étapes et preuve

| Étape | Action | Preuve |
| --- | --- | --- |
| 1. Inventaire | comparer Demo 4 avec l'aspect conservé de Demo 2 | écarts visuels listés, sans modification du runtime |
| 2. Scène principale | corriger la hauteur, le remplissage et le centrage | A, B, C visibles dans toute leur surface |
| 3. Telco de scène | restaurer sa position, ses boutons et son slider | telco visible sous la scène du chapitre, absente du menu et distincte |
| 4. Validation | parcourir menu, A, B et C | aucun changement de navigation introduit par la correction visuelle |

## 5. Critères d'acceptation

- Le menu et chaque scène occupent la surface prévue sans troncature.
- La scène B est centrée et la scène C remplit sa zone.
- Le `replace` entre deux scènes du chapitre dure 1 seconde.
- La telco de scène est sous la scène du chapitre et reste visuellement distincte.
- Les boutons `previous`/`next`, le toggle lecture/pause, le rembobinage et le
  slider ne sont présents que dans cette telco ; aucun de ces contrôles n'est
  rendu au menu.
- Un clic sur le toggle commande immédiatement la scène active ; une
  projection de progression en attente ne bloque pas cette commande.
- Une scène quittée ne conserve aucun abonnement de la feature de progression
  et de lecture de la telco.
- Une progression, un état de lecture ou un seek issu d'une vue précédente est
  ignoré dès qu'une autre scène est sélectionnée ; seule la sélection active
  peut mettre à jour la telco.
- Le layout de démo ne présente pas de niveaux visuels inutiles autour de la
  vue.
- L'item menu reçoit directement la racine de son slot ; l'item chapitre reçoit
  directement les racines de son slot scène et de son slot telco.
- Aucun fichier Sighty ou aucune API de navigation n'est modifié pour obtenir
  ces résultats.

## 6. Ordre de travail

Cette étape est réalisée en premier pour disposer d'une fixture lisible. Une
fois relue et validée, le travail principal reprend dans le plan de navigation
Sighty. Les observations de présentation ne pourront modifier ce plan que si
elles révèlent un défaut réel du contrat de montage ou du runtime ; elles ne
seront pas compensées par du code local à la démo.
