# Démo de diffusion Sighty — cours Demo 5

## Statut

**Vérifiée le 2026-10-21 dans Safari.** Cette page valide le paquet Sighty
autonome exporté depuis le scénario et les scènes de Demo 5, avec son loader,
les runtimes uniques et l’engine configuré.

## Rôle

`packages/demos/sighty-export/` est une fixture visuelle du contrat de
[diffusion Sighty](../../sighty/specs/authoring-library-spec.md#paquet-de-diffusion).
Elle réutilise le scénario, le catalogue de scènes, l'engine scroll, l'adaptateur
HTML, les styles de racine et les commandes de télécommande existants de Demo
5. Elle n'ajoute ni composition alternative, ni runtime, ni catalogue parallèle.

Le script `npm run sighty-export:build --workspace=@codplay/demos` appelle le
CLI Sighty en mode autonome avec la configuration d’engine de Demo 5. Le
dossier produit contient une seule copie de `codplay.js`, `sighty.js` et
`engine.js` sous `runtime/`, puis les quinze scènes directes connues. Chaque
scène reste un paquet CodPlay complet dans `scenes/scene-N/`. L’export ne
résout pas de source lazy.

La page importe `loadSightyPackage` depuis le `loader.mjs` livré. Le loader
utilise le player et l’engine du paquet, dont les deux imports pointent vers
l’unique `runtime/codplay.js`. Le manifeste Sighty, `scenario.mjs` et les
paquets scène fournissent les données auteur à l’exécution. La page importe
également les constantes d'événement et les commandes partagées de
présentation ; elle ne charge pas `scenario.ts` ni les modules TypeScript des
scènes. `messages.ts` reste un petit module de constantes utilisé par
l'intégration pour envoyer l'événement initial de présentation.

## Séparation préparation / initialisation

Au chargement, `loadSightyPackage({ root })` prépare le scénario et les quinze
paquets CodPlay. Le statut indique « aucune occurrence créée » et la page
vérifie que `scene-layout` n'a pas d'instance. Le bouton **Initialiser le
cours** appelle ensuite `runtime.initialize()`, démarre le layout, puis envoie
l'événement existant de rafraîchissement de présentation. L'export met donc
les ressources à disposition ; il ne lance pas cette étape d'initialisation.

## Recette Safari

Le 2026-10-21, sur `/sighty-export/` avec le paquet reconstruit proprement :

- le paquet affiche quinze scènes préparées sans occurrence ; l'initialisation
  affiche « Repérer les grandes formes » et son contenu, ses images, le menu et
  les commandes de navigation ;
- le scroll réel jusqu'au repère bas active **Suivant** ; ses clics traversent
  les pages 1 à 3 et atteignent le quiz du chapitre 1 ;
- sélectionner « La ligne d’horizon » et valider affiche « Bonne réponse ! Le
  chapitre 2 est maintenant accessible. » et active **Suivant** ;
- le reset ramène le paquet à quinze scènes préparées et aucune occurrence ;
  une nouvelle initialisation revient à la première page ;
- les modules `runtime/codplay.js`, `runtime/sighty.js` et
  `runtime/engine.js` répondent depuis le dossier du paquet ; les deux bundles
  importent le même fichier CodPlay. Le scrollport est matérialisé ;
- le réseau charge le loader, les trois runtimes, le scénario empaqueté et les
  manifestes, scènes, styles, fonctions et ressources locales des scènes
  directes. Il ne demande ni `scenario.ts` ni module auteur de scène ;
- après la reconstruction, Safari ne relève aucune erreur console ni requête
  HTTP en échec. La capture du quiz validé est conservée temporairement dans
  `/private/tmp/sighty-standalone-demo5-verified.png`.

Le diagnostic initial a révélé qu'un import `codplay/runtime/components`
embarquait une deuxième copie de `TagComponent` dans l'engine. La correction
réutilise l'entrée racine publique `codplay`, qui reste externe et résolue vers
le player unique. Le contrat d'identité est décrit dans la
[spécification de façade CodPlay](../../codplay/specs/facade-v2-spec.md#identité-des-hosts-html-tiers).

## Reproduire

```sh
npm run sighty-export:build --workspace=@codplay/demos
npm run dev --workspace=@codplay/demos
```

Ouvrir `/sighty-export/`. Les sorties de build sous `packages/demos/public/`
sont générées et ignorées par Git. L'ordre et les critères détaillés de la
recette restent suivis dans le
[plan de diffusion Sighty](../../sighty/plan/2026-10-20-sighty-export-diffusion-plan.md).
