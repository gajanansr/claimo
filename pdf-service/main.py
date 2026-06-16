import io
import os
import uuid
from datetime import datetime
from fastapi import FastAPI, BackgroundTasks
from fastapi.responses import Response
from pydantic import BaseModel
from typing import List
from supabase import create_client, Client
from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML
from dotenv import load_dotenv

# ── Optional dependencies (graceful degradation) ─────────────────────────────
try:
    from pypdf import PdfWriter, PdfReader
    _PYPDF_AVAILABLE = True
except ImportError:
    _PYPDF_AVAILABLE = False

try:
    from playwright.sync_api import sync_playwright
    _PLAYWRIGHT_AVAILABLE = True
except ImportError:
    _PLAYWRIGHT_AVAILABLE = False

# ─────────────────────────────────────────────────────────────────────────────

load_dotenv()

app = FastAPI(title="Claimo PDF Service")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if SUPABASE_URL and SUPABASE_SERVICE_KEY:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
else:
    supabase = None

env = Environment(loader=FileSystemLoader("templates"))


# ── Helpers ───────────────────────────────────────────────────────────────────

def _render_html_to_pdf_page(html: str) -> bytes | None:
    """Render an HTML string to a single-page PDF using Playwright.

    Returns the PDF bytes, or None if rendering fails.
    """
    if not _PLAYWRIGHT_AVAILABLE:
        return None
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch()
            page = browser.new_page()
            page.set_content(html, wait_until="networkidle")
            pdf_bytes = page.pdf(format="A4", print_background=True)
            browser.close()
            return pdf_bytes
    except Exception as exc:
        print(f"[playwright] Failed to render HTML to PDF: {exc}")
        return None


def _merge_pdfs(base_pdf: bytes, extra_pdfs: list[bytes]) -> bytes:
    """Merge a list of PDF byte-strings into the base PDF using pypdf.

    Returns the merged PDF bytes, or base_pdf unchanged on any error.
    """
    if not _PYPDF_AVAILABLE or not extra_pdfs:
        return base_pdf
    try:
        writer = PdfWriter()
        # Add all pages from the base report
        writer.append(PdfReader(io.BytesIO(base_pdf)))
        # Append each rendered email page
        for pdf in extra_pdfs:
            if pdf:
                writer.append(PdfReader(io.BytesIO(pdf)))
        out = io.BytesIO()
        writer.write(out)
        return out.getvalue()
    except Exception as exc:
        print(f"[pypdf] Failed to merge PDFs: {exc}")
        return base_pdf


# ── Background task (async report generation) ─────────────────────────────────

class ReportRequest(BaseModel):
    user_id: str
    report_id: str
    month: int
    year: int


def generate_pdf_task(req: ReportRequest):
    if not supabase:
        print("Error: Supabase credentials not set.")
        return

    try:
        start_date = f"{req.year}-{req.month:02d}-01"
        if req.month == 12:
            end_date = f"{req.year + 1}-01-01"
        else:
            end_date = f"{req.year}-{req.month + 1:02d}-01"

        res = (
            supabase.table("receipts")
            .select("*")
            .eq("user_id", req.user_id)
            .gte("trip_date", start_date)
            .lt("trip_date", end_date)
            .execute()
        )
        rides = res.data

        total_amount = sum(float(r.get("amount", 0)) for r in rides)
        formatted_rides = []
        for r in rides:
            snippet = r.get("raw_email_snippet") or ""
            receipt_link = snippet if snippet.startswith("http") else None
            formatted_rides.append({
                "date": r.get("trip_date"),
                "service": r.get("service"),
                "from_location": r.get("from_location") or "Unknown",
                "to_location": r.get("to_location") or "Unknown",
                "amount": f"{r.get('currency', 'INR')} {r.get('amount')}",
                "receipt_link": receipt_link,
                "email_subject": r.get("email_subject"),
            })

        template = env.get_template("report.html")
        html_out = template.render(
            month=req.month,
            year=req.year,
            generated_date=datetime.now().strftime("%B %d, %Y"),
            rides=formatted_rides,
            total_amount=f"INR {total_amount:.2f}",
            ride_count=len(rides),
        )

        pdf_bytes = HTML(string=html_out).write_pdf()

        file_path = f"{req.user_id}/{req.year}_{req.month}_{uuid.uuid4().hex[:8]}.pdf"

        supabase.storage.from_("reports").upload(
            file=pdf_bytes,
            path=file_path,
            file_options={"content-type": "application/pdf"},
        )

        supabase.table("reports").update(
            {
                "status": "ready",
                "pdf_url": file_path,
                "total_amount": total_amount,
                "ride_count": len(rides),
            }
        ).eq("id", req.report_id).execute()

        print(f"Successfully generated report {req.report_id}")

    except Exception as e:
        print(f"Failed to generate report {req.report_id}: {str(e)}")
        supabase.table("reports").update({"status": "failed"}).eq(
            "id", req.report_id
        ).execute()


@app.post("/generate")
async def generate_report(req: ReportRequest, background_tasks: BackgroundTasks):
    background_tasks.add_task(generate_pdf_task, req)
    return {"status": "processing", "report_id": req.report_id}


# ── Direct (synchronous) report generation ───────────────────────────────────

class DirectReportRequest(BaseModel):
    user_id: str
    receipt_ids: List[str]


@app.post("/generate-direct")
def generate_direct(req: DirectReportRequest):
    if not supabase:
        return Response(content="Supabase not configured", status_code=500)

    res = (
        supabase.table("receipts")
        .select("*")
        .in_("id", req.receipt_ids)
        .eq("user_id", req.user_id)
        .execute()
    )
    rides = res.data

    total_amount = sum(float(r.get("amount", 0)) for r in rides)
    formatted_rides = []
    email_html_pages: list[str] = []

    for r in rides:
        snippet = r.get("raw_email_snippet") or ""

        # Detect if the snippet is a URL, HTML, or a plain subject string
        if snippet.startswith("http"):
            receipt_link = snippet
            raw_email_html = None
        elif snippet.startswith("<"):
            # It's raw HTML – use it for the email-to-image step
            receipt_link = None
            raw_email_html = snippet
        else:
            receipt_link = None
            raw_email_html = None

        formatted_rides.append(
            {
                "date": r.get("trip_date"),
                "service": r.get("service"),
                "from_location": r.get("from_location") or "Unknown",
                "to_location": r.get("to_location") or "Unknown",
                "amount": f"{r.get('currency', 'INR')} {r.get('amount')}",
                "receipt_link": receipt_link,
                "email_subject": r.get("email_subject"),
            }
        )

        if raw_email_html:
            email_html_pages.append(raw_email_html)

    template = env.get_template("report.html")
    html_out = template.render(
        month=datetime.now().month,
        year=datetime.now().year,
        generated_date=datetime.now().strftime("%B %d, %Y"),
        rides=formatted_rides,
        total_amount=f"INR {total_amount:.2f}",
        ride_count=len(rides),
    )

    # ── Generate the summary PDF ──────────────────────────────────────────────
    summary_pdf = HTML(string=html_out).write_pdf()

    # ── Email-to-image: render each raw HTML email as a PDF page ─────────────
    # This entire block is wrapped in try/except so any failure is non-fatal.
    final_pdf = summary_pdf
    try:
        if email_html_pages and _PLAYWRIGHT_AVAILABLE and _PYPDF_AVAILABLE:
            rendered_pages: list[bytes] = []
            for html_email in email_html_pages:
                page_pdf = _render_html_to_pdf_page(html_email)
                if page_pdf:
                    rendered_pages.append(page_pdf)

            if rendered_pages:
                final_pdf = _merge_pdfs(summary_pdf, rendered_pages)
                print(
                    f"[generate-direct] Appended {len(rendered_pages)} email "
                    f"receipt page(s) to the report."
                )
        else:
            if not _PLAYWRIGHT_AVAILABLE:
                print("[generate-direct] Playwright not available – skipping email rendering.")
            if not _PYPDF_AVAILABLE:
                print("[generate-direct] pypdf not available – skipping PDF merge.")
    except Exception as exc:
        # Non-fatal: return summary PDF even if email rendering fails
        print(f"[generate-direct] Email-to-image step failed (non-fatal): {exc}")
        final_pdf = summary_pdf

    return Response(content=final_pdf, media_type="application/pdf")


# ── Health check ──────────────────────────────────────────────────────────────

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "playwright_available": _PLAYWRIGHT_AVAILABLE,
        "pypdf_available": _PYPDF_AVAILABLE,
    }
