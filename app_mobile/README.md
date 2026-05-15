# Pack mobile app (base Penpot)

Ce dossier contient une base de travail pour redesigner IME-Friendly en version app mobile.

## Contenu

- `design_tokens.json` : couleurs, typo, espacements, rayons.
- `screen_map.md` : liste d'ecrans et priorites.
- `wireframes/app_mobile_wireframes.svg` : wireframes mobiles 390x844 a importer dans Penpot.
- `wireframes/ui_kit.svg` : composants UI de base (boutons, champs, cards, nav).

## Comment utiliser dans Penpot

1. Ouvre Penpot et cree un nouveau projet.
2. Importe `wireframes/app_mobile_wireframes.svg`.
3. Importe `wireframes/ui_kit.svg`.
4. Cree une page `V1-UX` pour les wireframes et une page `V2-UI` pour le design final.
5. Applique les styles depuis `design_tokens.json`.
6. Prototype les parcours: Auth -> Accueil -> Reseau/Blog/Outils -> Profil/Messagerie.

## Regles de base recommandees

- Taille d'ecran cible: `390 x 844`.
- Grille: 4 colonnes, marges 16px, gouttiere 12px.
- Zones tactiles: min 44px.
- Espacement vertical standard: 8 / 12 / 16 / 24.

## Prochaine etape

Quand tu as une premiere version (meme brouillon), partage le lien Penpot et on passe a la conversion en vraie app Android (Capacitor + Play Store).

