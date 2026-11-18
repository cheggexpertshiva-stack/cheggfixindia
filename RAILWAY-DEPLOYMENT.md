# ONLYUSLABS Railway deployment checklist

## Deploy the package

- Extract the ZIP.
- Confirm `package.json`, `server.js`, `railway.json` and `public/` are at the project root.
- Push the full extracted folder to GitHub.
- In Railway, create a project from the GitHub repository.
- Wait for the health check at `/health` to pass.

## Supabase

Supabase is the database/auth/storage backend. A Railway database is not required.

- Existing project URL: `https://jifyycqzulissjekigdy.supabase.co`
- Frontend config: `public/assets/js/supabase-config.js`
- SQL setup: `database/ONLYUSLABS-SUPABASE-SETUP.sql`
- Owner allow-list email: `cheggexpertshiva@gmail.com`

The SQL script was already executed successfully in the user's Supabase project. Do not re-run it solely for Railway.

Create the matching Auth user in Supabase Authentication → Users, then ensure `admin_users` contains that email with `role = owner` and `active = true`.

In Supabase Authentication → URL Configuration, set the Site URL to the Railway generated domain and add wildcard redirect URLs for the Railway domain and any custom domains.

## Routes to test

- `/`
- `/healthcare/`
- `/contact/`
- `/admin/login.html`
- `/admin/`
- `/health`

## Security

- Only the Supabase publishable key belongs in the browser configuration.
- Never put the Supabase secret/service-role key in this repository or a browser file.
- Keep administrator registration disabled; add administrators through the owner-only admin interface and create their Auth accounts separately.
- Use synthetic information for healthcare demonstrations.
