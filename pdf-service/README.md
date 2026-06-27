# Claimo PDF Generator Microservice

This is a lightweight FastAPI microservice responsible for converting ride data into beautifully formatted PDF reimbursement reports using WeasyPrint.

## Why a separate service?
WeasyPrint requires heavy C-level system libraries (`libcairo2`, `libpango`) which cannot be installed on a serverless edge environment like Vercel (which runs Next.js). By isolating PDF generation into a microservice, we keep the main Vercel app blazing fast.

## Environment Variables
Create a `.env` file with the following:
```
SUPABASE_URL=your_project_url
SUPABASE_SERVICE_KEY=your_service_role_key
```
*(Note: Use the `service_role` key, not the `anon` key, because this backend needs permission to upload files to the Storage bucket and bypass RLS).*

## Local Development
1. Install dependencies (Requires Python 3.11+ and system packages like `pango`, `cairo`):
```bash
pip install -r requirements.txt
```
2. Run the server:
```bash
uvicorn main:app --reload
```

## Deployment (Render, Fly.io, Railway)
The easiest way to deploy this is using the included `Dockerfile`.

**If using Render:**
1. Create a new "Web Service".
2. Connect your GitHub repo.
3. Set the Root Directory to `pdf-service`.
4. Render will automatically detect the `Dockerfile` and build it.
5. Add your Environment Variables.
6. Copy the resulting Render URL and save it as `NEXT_PUBLIC_PDF_SERVICE_URL` in your Next.js Vercel app.

## Deployment (Google Cloud Run)

PDF generation is memory-heavy (WeasyPrint + Cairo/Pango). To stay within a
small memory budget, **serialize requests per instance** so one report renders
at a time — otherwise Cloud Run's default concurrency (80) lets multiple heavy
renders pile up in a single container and OOM.

```bash
gcloud run deploy claimo-pdf \
  --source pdf-service \
  --region <REGION> \
  --concurrency=1 \          # one report per instance at a time (key for memory)
  --memory=1Gi \             # Chromium renders Uber HTML receipts; 1Gi is the safe floor
  --cpu=1 \
  --max-instances=5 \        # bound cost; raise for more parallel reports
  --no-cpu-throttling \      # keep CPU for /generate BackgroundTasks after the response
  --set-env-vars=MALLOC_ARENA_MAX=2 \
  --set-secrets=SUPABASE_URL=...,SUPABASE_SERVICE_KEY=...
```

Notes:
- **Chromium renders Uber HTML receipts** (reimbursement docs must be
  pixel-identical, and Chromium is the faithful renderer). It launches
  **lazily** — only when a report actually contains HTML email receipts — so
  Rapido-only reports (PDF attachments merged byte-for-byte) never spawn it and
  stay light. The summary page is rendered by WeasyPrint.
- **Memory:** 512Mi can work for Rapido-only reports, but reports containing
  Uber HTML receipts need Chromium, so **1Gi** is the safe floor.
- `--concurrency=1` only serializes *requests*. The `/generate` endpoint runs
  work in a `BackgroundTasks` thread that continues after the HTTP response, so
  a new request can still arrive while a prior report is finishing. For strict
  one-at-a-time behavior, prefer the synchronous `/generate-direct` endpoint or
  move generation to a queue/Cloud Tasks worker.
- `MALLOC_ARENA_MAX=2` is also baked into the `Dockerfile`; the deploy flag is
  belt-and-suspenders.
