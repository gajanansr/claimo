import gc
import io
import os
import tempfile
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

# A4 portrait content height in CSS px at 96 DPI (297mm), 0 print margins.
_A4_PAGE_HEIGHT_PX = 1122.5
_A4_PAGE_WIDTH_PX = 794
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

def _render_email_pages_to_pdfs(htmls: list[str], target_pages: int = 2) -> list[bytes]:
    """Render email-receipt HTML pages to PDFs using Chromium (Playwright).

    Chromium is the faithful renderer for these receipts (reimbursement docs
    must look pixel-identical), so we keep it here — but:
      * it's launched lazily, ONLY when there are HTML emails to render;
      * a SINGLE browser is reused for every page (no per-page relaunch);
      * each page is zoomed out (uniform print `scale`, no CSS changes) so a
        receipt that overflows fits within `target_pages` pages.

    Returns one PDF per input html (failed pages are skipped).
    """
    if not _PLAYWRIGHT_AVAILABLE or not htmls:
        return []

    out: list[bytes] = []
    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(
                args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"]
            )
            try:
                for html in htmls:
                    page = browser.new_page(
                        viewport={"width": _A4_PAGE_WIDTH_PX, "height": int(_A4_PAGE_HEIGHT_PX)}
                    )
                    try:
                        page.set_content(html, wait_until="networkidle")
                        # Emulate print media so measurement matches the printed output.
                        page.emulate_media(media="print")
                        content_px = page.evaluate("document.documentElement.scrollHeight") or 0

                        # Zoom out only if it would otherwise overflow target_pages.
                        # Uniform scale = print zoom; does NOT reflow or alter CSS.
                        scale = 1.0
                        if content_px > 0:
                            pages = content_px / _A4_PAGE_HEIGHT_PX
                            if pages > target_pages:
                                # Small safety margin so rounding doesn't spill to an extra page.
                                scale = (target_pages - 0.05) / pages
                                scale = max(0.5, min(1.0, scale))

                        pdf_bytes = page.pdf(format="A4", print_background=True, scale=scale)
                        out.append(pdf_bytes)
                    except Exception as exc:
                        print(f"[playwright] Failed to render email page: {exc}")
                    finally:
                        page.close()
            finally:
                browser.close()
    except Exception as exc:
        print(f"[playwright] Render session failed: {exc}")
    return out


def _merge_pdfs(base_pdf: bytes, extra_pdfs: list[bytes]) -> bytes:
    """Merge a list of PDF byte-strings into the base PDF using pypdf.

    Writes to a temp file (instead of an in-memory BytesIO) and frees every
    source reader as soon as the merge completes, to keep peak RSS low.
    Returns the merged PDF bytes, or base_pdf unchanged on any error.
    """
    if not _PYPDF_AVAILABLE or not extra_pdfs:
        return base_pdf

    writer = PdfWriter()
    readers: list = []
    try:
        # Base report pages
        base_reader = PdfReader(io.BytesIO(base_pdf))
        writer.append(base_reader)
        readers.append(base_reader)
        # Each appended receipt page
        for pdf in extra_pdfs:
            if pdf:
                reader = PdfReader(io.BytesIO(pdf))
                writer.append(reader)
                readers.append(reader)

        with tempfile.NamedTemporaryFile(suffix=".pdf") as tmp:
            writer.write(tmp)
            tmp.flush()
            tmp.seek(0)
            return tmp.read()
    except Exception as exc:
        print(f"[pypdf] Failed to merge PDFs: {exc}")
        return base_pdf
    finally:
        writer.close()
        for reader in readers:
            try:
                reader.close()
            except Exception:
                pass
        readers.clear()
        gc.collect()


def _download_storage_pdf(storage_path: str) -> bytes | None:
    """Download a receipt PDF from Supabase Storage.

    Returns the PDF bytes, or None on failure.
    """
    if not supabase or not storage_path:
        return None
    try:
        data = supabase.storage.from_("receipts").download(storage_path)
        if data and len(data) > 0:
            return data
    except Exception as exc:
        print(f"[storage] Failed to download receipt PDF '{storage_path}': {exc}")
    return None


# ── Background task (async report generation) ─────────────────────────────────

class ReportRequest(BaseModel):
    user_id: str
    report_id: str
    month: int
    year: int
    location_tag: str | None = None
    # Optional inclusive date range "YYYY-MM-DD". When provided, the report
    # covers start_date..end_date instead of the whole month/year.
    start_date: str | None = None
    end_date: str | None = None
    # "full"     -> summary report page + receipt pages (default)
    # "receipts" -> receipt pages only, no summary page
    mode: str = "full"


def _get_user_name(user_id: str) -> str:
    """Fetch the user's display name (falls back to email, then empty)."""
    if not supabase:
        return ""
    try:
        res = (
            supabase.table("profiles")
            .select("full_name, email")
            .eq("id", user_id)
            .single()
            .execute()
        )
        data = res.data or {}
        return data.get("full_name") or data.get("email") or ""
    except Exception as exc:
        print(f"[profile] Failed to fetch user name: {exc}")
        return ""


def _merge_all(pages: list[bytes]) -> bytes:
    """Merge a list of PDF byte-strings into one (no separate base page)."""
    if not pages:
        return b""
    return _merge_pdfs(pages[0], pages[1:])


def generate_pdf_task(req: ReportRequest):
    if not supabase:
        print("Error: Supabase credentials not set.")
        return

    try:
        month_names = [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December",
        ]

        query = (
            supabase.table("receipts")
            .select("*")
            .eq("user_id", req.user_id)
        )

        if req.start_date and req.end_date:
            # Arbitrary inclusive range.
            query = query.gte("trip_date", req.start_date).lte("trip_date", req.end_date)
            try:
                s = datetime.strptime(req.start_date, "%Y-%m-%d")
                e = datetime.strptime(req.end_date, "%Y-%m-%d")
                period_label = f"{s.strftime('%d %b %Y')} – {e.strftime('%d %b %Y')}"
            except ValueError:
                period_label = f"{req.start_date} – {req.end_date}"
        else:
            # Whole-month fallback (end exclusive = first of next month).
            start_date = f"{req.year}-{req.month:02d}-01"
            end_date = f"{req.year + 1}-01-01" if req.month == 12 else f"{req.year}-{req.month + 1:02d}-01"
            query = query.gte("trip_date", start_date).lt("trip_date", end_date)
            period_label = f"{month_names[req.month - 1]} {req.year}"

        if req.location_tag:
            query = query.ilike("location_tag", f"%{req.location_tag}%")

        res = query.execute()
        rides = res.data

        total_amount = sum(float(r.get("amount", 0)) for r in rides)
        formatted_rides = []
        email_html_pages: list[str] = []
        storage_pdf_pages: list[bytes] = []

        for r in rides:
            snippet = r.get("raw_email_snippet") or ""
            pdf_path = r.get("receipt_pdf_path") or ""
            service = (r.get("service") or "").lower()

            receipt_link = None
            has_pdf_attachment = False

            if pdf_path:
                # Receipt has a PDF attachment stored in Supabase Storage
                has_pdf_attachment = True
                pdf_data = _download_storage_pdf(pdf_path)
                if pdf_data:
                    storage_pdf_pages.append(pdf_data)
            elif snippet.startswith("<"):
                # Full HTML email body — queue for WeasyPrint rendering
                email_html_pages.append(snippet)
                if service == "uber":
                    try:
                        import re
                        match = re.search(
                            r'href=["\']([^"\' ]*(?:receipt|invoice)[^"\' ]*)["\']',
                            snippet, re.IGNORECASE
                        )
                        if match:
                            receipt_link = match.group(1)
                    except Exception:
                        pass
            elif snippet.startswith("http"):
                receipt_link = snippet

            formatted_rides.append({
                "date": r.get("trip_date"),
                "service": r.get("service"),
                "from_location": r.get("from_location") or "Unknown",
                "to_location": r.get("to_location") or "Unknown",
                "amount": f"{r.get('currency', 'INR')} {r.get('amount')}",
                "receipt_link": receipt_link,
                "email_subject": r.get("email_subject"),
                "has_pdf_attachment": has_pdf_attachment,
            })

        template = env.get_template("report.html")
        html_out = template.render(
            user_name=_get_user_name(req.user_id),
            period=period_label,
            generated_date=datetime.now().strftime("%B %d, %Y"),
            rides=formatted_rides,
            total_amount=f"INR {total_amount:.2f}",
            ride_count=len(rides),
        )

        summary_pdf = HTML(string=html_out).write_pdf()

        # ── Assemble the final PDF ──────────────────────────────────────
        # mode "receipts" -> receipt pages only (no summary); falls back to the
        # summary if there are no receipt pages to show.
        final_pdf = summary_pdf
        all_receipt_pages: list[bytes] = []
        try:
            # 1. Render HTML email bodies via Chromium (lazy; only if any exist)
            all_receipt_pages.extend(_render_email_pages_to_pdfs(email_html_pages))
            # 2. Add downloaded PDF attachments from Supabase Storage
            all_receipt_pages.extend(storage_pdf_pages)

            if _PYPDF_AVAILABLE and all_receipt_pages:
                if req.mode == "receipts":
                    final_pdf = _merge_all(all_receipt_pages)
                else:
                    final_pdf = _merge_pdfs(summary_pdf, all_receipt_pages)
                print(
                    f"[generate] mode={req.mode}: assembled {len(all_receipt_pages)} "
                    f"receipt page(s) for report {req.report_id}."
                )
        except Exception as exc:
            print(f"[generate] Receipt merge step failed (non-fatal): {exc}")
            final_pdf = summary_pdf
        finally:
            # Free the intermediate page buffers before the upload step.
            email_html_pages.clear()
            storage_pdf_pages.clear()
            all_receipt_pages.clear()
            gc.collect()

        file_path = f"{req.user_id}/{req.year}_{req.month}_{uuid.uuid4().hex[:8]}.pdf"

        supabase.storage.from_("reports").upload(
            file=final_pdf,
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
    storage_pdf_pages: list[bytes] = []

    for r in rides:
        snippet = r.get("raw_email_snippet") or ""
        pdf_path = r.get("receipt_pdf_path") or ""
        service = (r.get("service") or "").lower()

        receipt_link = None
        raw_email_html = None
        has_pdf_attachment = False

        if pdf_path:
            # Receipt has a PDF attachment stored in Supabase Storage
            has_pdf_attachment = True
            pdf_data = _download_storage_pdf(pdf_path)
            if pdf_data:
                storage_pdf_pages.append(pdf_data)
        elif snippet.startswith("<"):
            # Full HTML email — queue for WeasyPrint receipt rendering
            raw_email_html = snippet
            # For Uber: extract the receipt download link so the summary
            # table can still show a clickable "View Receipt" link
            if service == "uber":
                try:
                    import re
                    # Find an <a href> whose URL contains 'receipt' or 'invoice'
                    match = re.search(
                        r'href=["\']([^"\' ]*(?:receipt|invoice)[^"\' ]*)["\']',
                        snippet, re.IGNORECASE
                    )
                    if match:
                        receipt_link = match.group(1)
                except Exception:
                    pass
        elif snippet.startswith("http"):
            # Legacy rows stored before the HTML-storage fix
            receipt_link = snippet
        # else: short Gmail snippet — neither link nor HTML

        formatted_rides.append(
            {
                "date": r.get("trip_date"),
                "service": r.get("service"),
                "from_location": r.get("from_location") or "Unknown",
                "to_location": r.get("to_location") or "Unknown",
                "amount": f"{r.get('currency', 'INR')} {r.get('amount')}",
                "receipt_link": receipt_link,
                "email_subject": r.get("email_subject"),
                "has_pdf_attachment": has_pdf_attachment,
            }
        )

        if raw_email_html:
            email_html_pages.append(raw_email_html)

    template = env.get_template("report.html")
    html_out = template.render(
        user_name=_get_user_name(req.user_id),
        period="Selected receipts",
        generated_date=datetime.now().strftime("%B %d, %Y"),
        rides=formatted_rides,
        total_amount=f"INR {total_amount:.2f}",
        ride_count=len(rides),
    )

    # ── Generate the summary PDF ──────────────────────────────────────────────
    summary_pdf = HTML(string=html_out).write_pdf()

    # ── Merge all receipt pages (HTML-rendered + PDF attachments) ─────────────
    # This entire block is wrapped in try/except so any failure is non-fatal.
    final_pdf = summary_pdf
    all_receipt_pages: list[bytes] = []
    try:
        # 1. Render HTML email bodies via Chromium (lazy; only if any exist)
        all_receipt_pages.extend(_render_email_pages_to_pdfs(email_html_pages))

        # 2. Add downloaded PDF attachments from Supabase Storage
        all_receipt_pages.extend(storage_pdf_pages)

        if all_receipt_pages and _PYPDF_AVAILABLE:
            final_pdf = _merge_pdfs(summary_pdf, all_receipt_pages)
            print(
                f"[generate-direct] Appended {len(all_receipt_pages)} receipt "
                f"page(s) to the report."
            )
        elif not _PYPDF_AVAILABLE:
            print("[generate-direct] pypdf not available – skipping PDF merge.")
    except Exception as exc:
        # Non-fatal: return summary PDF even if merging fails
        print(f"[generate-direct] Receipt merge step failed (non-fatal): {exc}")
        final_pdf = summary_pdf
    finally:
        email_html_pages.clear()
        storage_pdf_pages.clear()
        all_receipt_pages.clear()
        gc.collect()

    return Response(content=final_pdf, media_type="application/pdf")


# ── Health check ──────────────────────────────────────────────────────────────

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "summary_renderer": "weasyprint",
        "receipt_renderer": "chromium" if _PLAYWRIGHT_AVAILABLE else "unavailable",
        "pypdf_available": _PYPDF_AVAILABLE,
    }
