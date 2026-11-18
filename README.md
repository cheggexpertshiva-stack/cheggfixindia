# ONLYUSLABS — Railway Website + Admin Workspace

This package contains the current premium ONLYUSLABS public website and its Supabase-powered administration workspace, prepared to run on Railway.

## What's included

- Premium multi-page public website, including healthcare and industry pages.
- Admin sign-in at `/admin/login.html` and workspace at `/admin/`.
- CRM enquiry management backed by Supabase.
- CMS sections for pages, services, industries, healthcare content, case studies, testimonials, FAQs and insights.
- Media library backed by Supabase Storage.
- Website settings, SEO settings, administrator access and activity log.
- Node.js static web server, Railway configuration and health endpoint.
- Supabase database setup SQL in `database/`.

## Important architecture note

Railway hosts the website files and Node.js web server. Supabase remains the authentication, PostgreSQL database and media-storage provider. **You do not need to add a Railway PostgreSQL database** for this package.

The browser uses only the Supabase project URL and publishable key in `public/assets/js/supabase-config.js`. These are public-client values. Never add a Supabase secret key or service-role key to the website, GitHub, or browser code.

## Run locally

Requires Node.js 20 or newer.

```bash
npm start
```

Open `http://localhost:3000`.

Health check: `http://localhost:3000/health`.

## Deploy on Railway

1. Extract this ZIP. The extracted project root must contain `package.json`, `server.js`, `railway.json` and the `public/` folder together.
2. Upload the extracted project to a new GitHub repository (do not upload only the `public/` folder).
3. In Railway, create a new project and choose **Deploy from GitHub Repo**. Connect that repository.
4. Railway detects `railway.json` and runs `npm start`. No environment variables are required for the static server; Railway supplies `PORT` automatically.
5. Wait for the deployment to become healthy. Open the generated Railway domain and test `/`, `/contact/`, `/admin/login.html` and `/health`.
6. In Railway project settings, generate a public domain if one has not been created.

## Connect your custom domain

After the Railway deployment works on its generated domain:

1. Add `onlyuslabs.in` and, if desired, `www.onlyuslabs.in` in Railway's domain settings.
2. Railway will display the exact DNS records required. Add those records at your domain registrar exactly as shown. Do not reuse old Netlify DNS targets.
3. Wait for DNS verification and Railway HTTPS provisioning before changing the live domain's DNS routing.

## Supabase setup

The current website is configured for the existing ONLYUSLABS Supabase project. The public URL and publishable key are in `public/assets/js/supabase-config.js`.

The SQL setup script is included at `database/ONLYUSLABS-SUPABASE-SETUP.sql`. It creates the CRM/CMS tables, row-level security policies, administrator allow-list, storage bucket and starter CMS records.

**You already ran this SQL successfully in the Supabase SQL Editor. Do not run it again just for the Railway deployment.**

Before admin sign-in:

1. In Supabase, open **Authentication → Users**.
2. Create the owner Auth user `cheggexpertshiva@gmail.com` and confirm the email (use Auto Confirm if available).
3. In **Table Editor → admin_users**, verify that the same email exists with role `owner` and `active = true`.
4. In **Authentication → URL Configuration**, set the Site URL to the deployed Railway URL, for example `https://YOUR-RAILWAY-DOMAIN.up.railway.app`.
5. Add redirect URLs for the Railway domain and your custom domains, for example:
   - `https://YOUR-RAILWAY-DOMAIN.up.railway.app/**`
   - `https://onlyuslabs.in/**`
   - `https://www.onlyuslabs.in/**`
   - `http://localhost:3000/**` (only if you need local testing)

Then open `/admin/login.html` on the deployed website and sign in with the Auth user's email and password. The password is created in Supabase Authentication; it is not stored in this ZIP.

## Update the Supabase public configuration

If the Supabase project or publishable key changes, update only these public-client values in `public/assets/js/supabase-config.js` and redeploy:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` (the `sb_publishable_...` key)

Do not use an `sb_secret_...` key here.

## Pre-launch checks

- Submit a test enquiry through `/contact/` and confirm it appears in the admin Enquiries view.
- Sign in to `/admin/login.html` and verify the Overview, Enquiries, CMS, Media, SEO/settings, Administrators and Activity views.
- Upload a non-sensitive test image to the media library.
- Test the website on mobile and desktop.
- Keep real patient information out of public forms and demo content.

## Folder layout

```text
.
├── package.json
├── server.js
├── railway.json
├── public/                 # public website + /admin application
│   ├── index.html
│   ├── admin/
│   └── assets/
├── database/
│   └── ONLYUSLABS-SUPABASE-SETUP.sql
└── docs/
    └── RAILWAY-DEPLOYMENT.md
```
