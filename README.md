# Claimo

Claimo turns ride receipts into reimbursement-ready expense reports. Connect the Gmail inbox used by your Uber or Rapido account, sync receipts into a private Supabase database, review the rides in the dashboard, and generate a PDF for a selected month or date range.

The repository contains the web application, the database migrations, and a dedicated PDF rendering service. It is designed for deployment as a Next.js application plus a small Python service that has the native libraries needed by WeasyPrint and Chromium.

## Features

- Google OAuth with read-only Gmail access, or email magic-link sign-in
- Receipt discovery and parsing for Uber and Rapido messages
- Duplicate protection using Gmail message IDs and ride IDs
- Ride history with service, date, amount, route, status, and location filters
- Saved locations and optional Google address validation/geocoding
- Monthly or custom date-range reimbursement reports
- Full reports with a summary page and receipt pages, or receipt-only PDFs
- Private Supabase Storage for generated reports and receipt PDF attachments
- Optional Pro subscriptions through Razorpay
- Responsive dashboard with offline support through the Next.js PWA setup

## Architecture

```text
Browser
	|
	v
Next.js web app (web/)
	|-- Supabase Auth, Postgres, and Storage
	|-- Gmail API for receipt sync
	|-- Google Maps Address Validation API (optional)
	|-- Razorpay subscriptions (optional)
	|
	`--> PDF service (pdf-service/)
				 |-- WeasyPrint renders the summary
				 |-- Playwright/Chromium renders HTML receipt emails
				 `-- pypdf merges receipt PDFs and uploads the result to Supabase
```

The `api/` directory is an earlier FastAPI scaffold. Its endpoints currently return simulated processing responses and are not used by the Next.js report or sync routes. The active report renderer is `pdf-service/`.

## Repository layout

| Path | Purpose |
| --- | --- |
| `web/` | Next.js 16 application, dashboard, auth, sync, reports, billing, and API routes |
| `pdf-service/` | FastAPI service for rendering and merging report PDFs |
| `api/` | Legacy/placeholder FastAPI service |
| `supabase/migrations/` | Database, RLS, and Storage migrations |
| `supabase/config.toml` | Local Supabase configuration |

## Prerequisites

- Node.js 20 or newer and npm
- Python 3.11 or newer for `pdf-service/`
- Docker, or the native WeasyPrint dependencies, when running the PDF service locally
- A Supabase project
- A Google Cloud project with Gmail API enabled for Gmail sync

## Configuration

### Web application

Create `web/.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Required for location address validation and map features
GOOGLE_MAPS_API_KEY=YOUR_SERVER_SIDE_MAPS_KEY
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=YOUR_BROWSER_MAPS_KEY

# Required for report generation
PDF_SERVICE_URL=http://localhost:8000

# Optional: enable Pro subscription checkout
NEXT_PUBLIC_RAZORPAY_KEY_ID=YOUR_RAZORPAY_KEY_ID
RAZORPAY_KEY_SECRET=YOUR_RAZORPAY_KEY_SECRET
RAZORPAY_PLAN_ID_MONTHLY=YOUR_MONTHLY_PLAN_ID
RAZORPAY_PLAN_ID_QUARTERLY=YOUR_QUARTERLY_PLAN_ID
RAZORPAY_OFFER_ID_FIRST_MONTH=YOUR_OPTIONAL_OFFER_ID
```

`GOOGLE_MAPS_API_KEY`, `RAZORPAY_KEY_SECRET`, and the PDF service credentials must remain server-side. Never expose Supabase service-role credentials in the web app or commit any `.env` file.

### PDF service

Create `pdf-service/.env`:

```dotenv
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
```

The PDF service needs the service-role key because it reads receipt data and writes generated files to private Supabase Storage. Treat this key like a database administrator credential.

### Google and Supabase OAuth setup

1. Enable the Gmail API in Google Cloud and configure an OAuth consent screen.
2. Add the Supabase Auth callback URL to the Google OAuth client. For a hosted project, it is typically `https://<project-ref>.supabase.co/auth/v1/callback`.
3. In Supabase Dashboard, enable the Google provider with the Google client ID and secret.
4. Add the local and production app URLs to Supabase Auth redirect URLs, including `/auth/callback`.
5. Run the app and sign in with the same Google account that receives the Uber or Rapido receipts. Claimo requests the `gmail.readonly` scope and searches only for matching ride receipt messages.

## Local development

### 1. Apply the database migrations

For a hosted Supabase project, link the CLI to the project and push the migrations:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

For a local Supabase stack:

```bash
supabase start
supabase db reset
```

Use the local Supabase URL and anon key in `web/.env.local` when developing against the local stack. Supabase Studio is available at `http://127.0.0.1:54323` with the checked-in configuration.

### 2. Start the web app

```bash
cd web
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Available web scripts:

```bash
npm run dev     # Start Next.js development server
npm run lint    # Run ESLint
npm run build   # Create a production build
npm start       # Serve the production build
```

### 3. Start the PDF service

The Docker image is the most reproducible option because WeasyPrint and Playwright require system dependencies:

```bash
cd pdf-service
docker build -t claimo-pdf .
docker run --rm -p 8000:8000 --env-file .env claimo-pdf
```

Or install the Python requirements on a machine with Cairo, Pango, and the other WeasyPrint libraries available:

```bash
cd pdf-service
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m playwright install chromium
uvicorn main:app --reload --port 8000
```

Check the service with:

```bash
curl http://localhost:8000/health
```

Set `PDF_SERVICE_URL` to the reachable URL of this service before generating reports.

## User flow

1. Sign in with Google or request an email magic link.
2. Connect the Gmail account that receives the ride receipts.
3. Use **Sync now** to scan for new Uber and Rapido receipts. Existing messages are skipped.
4. Review and filter rides in the dashboard. Add saved locations when route classification is useful.
5. Generate a report for a month or custom inclusive date range.
6. Download the ready report from the Reports section.

Free accounts are limited by the current application rules to two reports and five rides per report. Pro billing can be enabled with the Razorpay variables above.

## Service endpoints

The Next.js app exposes the user-facing API routes under `web/src/app/api/`, including:

- `POST /api/sync` for Gmail receipt synchronization
- `POST /api/reports/generate` for month or date-range reports
- `POST /api/reports/custom` for custom report generation
- `GET /api/reports/download/...` for authenticated report downloads
- `POST /api/geocode` for address validation
- `POST /api/razorpay/create-order` and `/api/razorpay/verify-payment` for Pro subscriptions

The PDF service exposes:

- `GET /health` for renderer and dependency status
- `POST /generate` for a report backed by a Supabase report row
- `POST /generate-direct` for a selected set of receipt IDs, returning a PDF directly

## Deployment

Deploy `web/` to a Next.js-compatible host such as Vercel and configure its production environment variables. Deploy `pdf-service/` separately using its Dockerfile on Cloud Run, Render, Railway, or Fly.io. The PDF service should have enough memory for Chromium-backed Uber HTML receipts; 1 GiB is a practical starting point, and Cloud Run should use `--concurrency=1` for heavy report workloads.

The PDF service documentation contains the detailed Cloud Run example in [pdf-service/README.md](pdf-service/README.md). Update `PDF_SERVICE_URL` in the web deployment to the deployed service URL and add the production callback URL to Supabase Auth before testing sign-in.

## Testing and maintenance

Web checks:

```bash
cd web
npm run lint
npm run build
node test-rapido-parser.js
node test-pdf.js
node test_cheerio.js
```

Useful database and maintenance scripts live in `web/check_db.ts` and `web/scripts/`. Review the migration files in order when changing the schema; Row Level Security is enabled for user profiles, receipts, reports, and report Storage objects.

## Privacy and security

Claimo is built around least-privilege Gmail access: the OAuth flow requests read-only access and the sync query targets Uber and Rapido receipt messages. Receipt and report data is scoped to the authenticated user through Supabase Row Level Security. Read [web/src/app/privacy/page.tsx](web/src/app/privacy/page.tsx) and [web/src/app/terms/page.tsx](web/src/app/terms/page.tsx) for the application's current user-facing policies.

Keep OAuth, Supabase, Google Maps, Razorpay, and service-role credentials out of source control. For production, use the host's encrypted environment-variable or secret-management facility and restrict Google API keys by API and application where possible.

## License

See [LICENSE](LICENSE).