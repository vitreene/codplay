# Démo polygon

> Statut : En cours
> Version CodPlay : V2 foundation

Cette démo transpose la scène polygon de V1 dans le runtime V2. Elle permet de
modifier les côtés, les rayons intérieur et extérieur, l'inflexion et le
diamètre d'un polygone SVG. Cliquer sur le nom d'un paramètre restaure sa valeur
initiale. Le petit polygone violet lance également le test de morphing.
Il fonctionne comme un toggle : un second clic anime le retour à la forme
initiale.

Les valeurs sont transmises par les événements natifs `input` et `click` de
`Perso.emit`. Le composant `polygon` reçoit directement ses propriétés
spécialisées, les interprète et adapte son rendu SVG ; les contrôles affichent
la valeur courante de chaque propriété.

La scène ne fixe pas de durée artificielle. Sans média ni piste bornée, la
lecture reste ouverte et son horizon suit la tête de lecture ainsi que les
événements enregistrés.

La démo est accessible avec :

```text
http://localhost:5173/v2.html?demo=polygon
```
