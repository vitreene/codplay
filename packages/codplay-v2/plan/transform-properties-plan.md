# CodPlay V2 - contrat des proprietes de transformation

## Statut

> Status: En cours
> CodPlay version: V2 foundation
> Review: required before transform defaults

Cette partie est prioritaire sur la couverture complete des autres proprietes des
scenes S1-S4. Elle precede le catalogue des defaults par propriete, car un default
de transformation n'a de sens qu'apres la definition de la representation interne
et de son ordre de composition.

## References

AnimeJS 4.5 est consulte comme source d'observation et de comparaison, sans devenir
une dependance ni une source normative du contrat V2 :

- `x`, `y` et `z` sont des aliases de `translateX`, `translateY` et `translateZ`;
- les canaux reconnus incluent `translateX/Y/Z`, `rotate`, `rotateX/Y/Z`,
  `scale`, `scaleX/Y/Z`, `skew`, `skewX/Y` et `perspective`;
- les canaux transform sont traites comme une famille distincte des proprietes CSS;
- l'interpreteur maintient les canaux separement avant de produire une representation
  composee.

Anime compose ses canaux dans cet ordre : `perspective`, `translateX/Y/Z`, `rotate`,
`rotateX/Y/Z`, `scale`, `scaleX/Y/Z`, `skew`, `skewX/Y`, puis les matrices
preservees. `rotate3d` est preserve entre les rotations et le scale. Les formes
`translate(...)`, `translate3d(...)`, `scale(...)` et `scale3d(...)` sont decoupees
en canaux lorsqu'elles sont lues depuis une transform inline. Une matrix n'est pas
decomposee en canaux : elle reste une operation distincte en fin de composition.

Ces observations ne signifient pas que V2 reutilise le runtime AnimeJS, son code ou
ses decisions de projection. Elles servent uniquement a comparer les formes et les
cas limites avant de definir un contrat V2 independant.

## Frontieres

Le travail est separe en trois etages :

1. entree auteur : aliases et formes acceptees;
2. contrat interne V2 : canaux, unites, valeurs et ordre;
3. projection : composition vers le substrat du composant.

Les proprietes CSS directes `translate`, `rotate` et `scale`, la chaine auteur
`transform: ...` et `matrix(...)` ne doivent pas etre melangees implicitement avec
les canaux internes. Chaque forme devra etre acceptee, normalisee en sequence, ou
refusee avec un diagnostic explicite.

L'astuce d'editeur consistant a poser une matrix pour conserver une transform
originelle est hors runtime V2. Elle ne doit pas devenir une source de valeurs ni un
fallback de compilation.

## Invariants a fixer

- L'ordre des operations est preserve; `translate` puis `rotate` n'est pas equivalent
  a `rotate` puis `translate`.
- Un alias ne cree pas un nouveau canal : `x` et `translateX` visent la meme valeur
  interne.
- Les defaults d'identite sont attaches aux canaux, pas aux textes CSS : translation
  nulle, rotation nulle, scale unitaire, skew nul lorsque ces canaux sont declares.
- Une identite de translation est polymorphe par unite : `0` ne doit pas etre envoye
  directement a ACE face a `50%`. Sa materialisation doit produire une borne de meme
  unite que l'intervalle, sans convertir la valeur vers le substrat.
- Une matrix n'est jamais inventee a partir d'une valeur absente.
- ACE recoit une representation interne complete et un `from` deterministe; il ne
  lit ni DOM, ni style calcule, ni transform precedente du substrat.
- Une composition partielle ne doit pas effacer les autres canaux deja resolus.
- L'ordre de composition est une donnee du contrat, pas un detail du renderer.

## Familles AnimeJS observees pour le style CSS

Pour cette tranche, l'observation porte uniquement sur les proprietes de style CSS
pertinentes. Les familles de cible runtime suivantes ne deviennent pas des contrats
de compilation V2 :

- `TRANSFORM` pour les canaux de transformation;
- les proprietes CSS ordinaires;
- les variables CSS lorsqu'elles sont explicitement declarees par un service.

Les attributs SVG, les proprietes d'objets et les adapters runtime sont hors de la
tranche compilee. Ils pourront avoir leurs propres contrats plus tard, mais ne
doivent pas influencer les defaults CSS actuels.

La classification des valeurs reste independante : AnimeJS distingue `NUMBER`,
`UNIT`, `COLOR` et `COMPLEX`. V2 peut consulter cette decomposition lorsqu'elle est
portable, avec la regle specifique des unites documentee dans
[`unit-values-plan.md`](./unit-values-plan.md).

Les valeurs relatives (`+=`, `-=`, `*=`), les fonctions et les adapters sont des
etapes de preparation supplementaires; ce ne sont pas des defaults de propriete.

## Etapes

1. Comparer les aliases et les formes AnimeJS avec les formes effectivement utiles a CodPlay.
2. Definir la representation interne ordonnee et les unites auteur.
3. Implementer la normalisation pure et ses diagnostics. La premiere tranche
   normalise les noms et l'ordre; elle ne parse pas les valeurs ni les unites.
4. Declarer les defaults d'identite et la resolution de `from`, y compris la
   materialisation d'une identite dans l'unite deja portee par l'intervalle.
5. Tester les aliases, les ordres differents, les compositions partielles, les
   matrices explicites et les formes refusees.
6. Relier seulement ensuite cette representation aux services et composants.

Le catalogue des autres defaults reste hors de cette partie tant que cette frontiere
n'est pas relue.

La premiere integration ACE est limitee aux tweens scalaires de canaux transform.
Pour ACE, la resolution de `from` est volontairement binaire : borne resolue, ou
preparation differee demandee a l'etat logique/runtime. Le builder peut conserver
la provenance plus fine (auteur ou identite) pour appliquer la hierarchie des
defaults et produire ses diagnostics, mais cette provenance ne fait pas partie de
l'API ACE. ACE ne prepare jamais une transition differee tant que la borne n'est
pas fournie; il ne lit ni le DOM ni une valeur implicite du substrat.

## Integration runner realisee

La tranche HTML runner relie maintenant les aliases auteur `style.x` et `style.y`
aux canaux ACE `translateX` et `translateY`. La resolution logique produit une
valeur scalaire a chaque instant; le service DOM du runner compose ces deux canaux
en une seule valeur `transform: translate(x, y)`. Il ajoute `px` aux nombres et
conserve les unites auteur portees par les chaines.

Cette integration ne generalise pas encore la composition aux rotations, scales,
perspective, matrices ou aux proprietes CSS `translate`/`transform` brutes. Ces
formes restent soumises a la tranche de contrat dediee et ne doivent pas etre
introduites par une demo.
