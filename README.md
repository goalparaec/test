# APDCL RMS → Supabase Excel Downloader

This is a Next.js application that:

1. Accepts a report date.
2. Logs into APDCL RMS server-side using Playwright.
3. Opens the Daily Performance Report page.
4. Selects the requested date.
5. Finds/clicks the Excel option.
6. Captures the generated Excel download.
7. Uploads the Excel file to Supabase Storage.
8. Stores file metadata in a Supabase PostgreSQL table.
9. Displays downloaded reports in the web app.
10. Creates a temporary signed URL when "Open Excel" is clicked.

## Important

This project does NOT contain your APDCL username or password.

Put credentials in Vercel Environment Variables:

- `APDCL_USERNAME`
- `APDCL_PASSWORD`
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET` = `apdcl-reports`

Never put `SUPABASE_SERVICE_ROLE_KEY` in client-side code.

## 1. Create the Supabase table

Open Supabase → SQL Editor and run:

`supabase/schema.sql`

The app uses a private Storage bucket named `apdcl-reports`.

## 2. Create the project locally (optional)

```bash
npm install
npm run dev
```

Create `.env.local` from `.env.example` and fill in the variables.

## 3. GitHub

Create a new GitHub repository and push this folder.

Do NOT commit `.env.local`.

## 4. Vercel

Import the GitHub repository into Vercel.

In:

Project → Settings → Environment Variables

add:

```text
APDCL_USERNAME=...
APDCL_PASSWORD=...
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_STORAGE_BUCKET=apdcl-reports
```

Then redeploy.

## 5. Test

Open the deployed website.

Select a date.

Click:

`Download Excel`

The server will attempt:

APDCL login
→ Daily Performance Report
→ date
→ Excel
→ download
→ Supabase Storage
→ PostgreSQL metadata
→ display in the app

## If APDCL controls are different

The APDCL login/report pages may change their HTML selectors.

The automation intentionally tries common selectors, but the exact report page controls are not publicly inspectable without an authenticated session.

If the test says:

`Could not find the date input`

or:

`Could not find the Excel button`

then only `lib/apdcl.js` needs to be adjusted with the exact selectors from the authenticated report page.

No password needs to be put into the code.

## Vercel note

Browser automation is heavier than a normal Next.js API route. This project is intended as a first working test. If the APDCL report takes a long time to generate or Vercel's function/runtime limits become a problem, keep the Next.js UI on Vercel and move the Playwright worker to a small VPS/container. The Supabase Storage and database design can remain unchanged.

## Security

- APDCL credentials are server-side only.
- Supabase service-role key is server-side only.
- Excel files are stored in a private bucket.
- The app creates short-lived signed URLs instead of making the bucket public.
- Do not expose the APDCL password to the browser.
- Do not commit `.env.local` or production secrets to GitHub.
