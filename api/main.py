from fastapi import FastAPI, BackgroundTasks
from pydantic import BaseModel
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Claimo API", description="Microservice for WeasyPrint & Gmail API")

class ReportRequest(BaseModel):
    user_id: str
    month: str
    year: int

@app.get("/")
def health_check():
    return {"status": "ok", "service": "Claimo API"}

@app.post("/generate-report")
def generate_report(request: ReportRequest, background_tasks: BackgroundTasks):
    """
    Endpoint to trigger WeasyPrint PDF generation.
    It simulates a background task for now.
    """
    logger.info(f"Report generation requested for User {request.user_id} - {request.month} {request.year}")
    # In reality, this would fetch receipts from Supabase, pass to WeasyPrint, and upload back to Supabase.
    return {"status": "processing", "message": "Report generation started."}

@app.post("/sync-receipts")
def sync_receipts(user_id: str):
    """
    Endpoint to trigger Gmail API scan for new ride receipts.
    """
    logger.info(f"Syncing receipts for user {user_id}")
    # Logic to authenticate via Gmail API and parse Uber/Lyft emails
    return {"status": "processing", "message": "Gmail sync started."}
