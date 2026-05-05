# Edge Function: admin-reset-password

Cette fonction permet à un administrateur validé de réinitialiser le mot de passe d'un utilisateur depuis le site.

## Prérequis
- Supabase CLI installé
- Projet lié (`supabase link --project-ref <PROJECT_REF>`)
- Être connecté (`supabase login`)

## Déploiement
Depuis la racine du projet :

```bash
supabase functions deploy admin-reset-password
```

Si besoin de définir explicitement la clé service role (souvent déjà injectée par Supabase Hosted) :

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="<SERVICE_ROLE_KEY>"
```

## Test rapide
1. Connecte-toi sur le site avec un compte admin validé.
2. Va dans `Gestion administrateur` puis `Réinitialiser un mot de passe`.
3. Entre un email existant + un mot de passe temporaire (>= 8 caractères).

## Réponses attendues côté front
- `ok: true` => reset effectué
- `reason: not_found` => email introuvable
- `reason: forbidden` => compte non admin / non validé
- `reason: weak_password` => mot de passe trop court
- `reason: backend_required` => fonction non déployée
