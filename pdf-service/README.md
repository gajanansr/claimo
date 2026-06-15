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
