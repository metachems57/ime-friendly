# Recette Fonctionnelle (2026-03-15)

## Tests automatiques exécutés

1. `node --check js/data-store.js js/auth.js js/index.js js/reseau.js js/blog.js js/outils.js js/detail-outil.js js/profil.js`
2. `node scripts/smoke-auth.js`
3. `xmllint --html --noout index.html reseau.html blog.html outils.html detail-outil.html profil.html`

Resultat actuel: tous les tests ci-dessus passent.

## Controle manuel recommande

1. Creer un premier compte: il doit etre admin valide automatiquement.
2. Creer un second compte: il doit etre "en attente de validation".
3. Se connecter en admin et valider le second compte via la modal admin.
4. Verifier connexion/deconnexion + bouton profil.
5. Verifier creation/suppression de posts et commentaires sur reseau/blog.
6. Verifier creation/suppression d'outils.
7. Verifier liens auteur -> profil depuis reseau et blog.
