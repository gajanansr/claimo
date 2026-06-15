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

load_dotenv()

app = FastAPI(title="Claimo PDF Service")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if SUPABASE_URL and SUPABASE_SERVICE_KEY:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
else:
    supabase = None

env = Environment(loader=FileSystemLoader("templates"))

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
            end_date = f"{req.year+1}-01-01"
        else:
            end_date = f"{req.year}-{req.month+1:02d}-01"
            
        res = supabase.table("receipts").select("*").eq("user_id", req.user_id).gte("trip_date", start_date).lt("trip_date", end_date).execute()
        rides = res.data
        
        total_amount = sum(float(r.get("amount", 0)) for r in rides)
        formatted_rides = []
        for r in rides:
            formatted_rides.append({
                "date": r.get("trip_date"),
                "service": r.get("service"),
                "from_location": r.get("from_location") or "Unknown",
                "to_location": r.get("to_location") or "Unknown",
                "amount": f"{r.get('currency', 'INR')} {r.get('amount')}"
            })
            
        template = env.get_template("report.html")
        html_out = template.render(
            month=req.month,
            year=req.year,
            generated_date=datetime.now().strftime("%B %d, %Y"),
            rides=formatted_rides,
            total_amount=f"INR {total_amount:.2f}"
        )
        
        pdf_bytes = HTML(string=html_out).write_pdf()
        
        file_path = f"{req.user_id}/{req.year}_{req.month}_{uuid.uuid4().hex[:8]}.pdf"
        
        supabase.storage.from_("reports").upload(
            file=pdf_bytes,
            path=file_path,
            file_options={"content-type": "application/pdf"}
        )
        
        supabase.table("reports").update({
            "status": "ready",
            "pdf_url": file_path,
            "total_amount": total_amount,
            "ride_count": len(rides)
        }).eq("id", req.report_id).execute()
        
        print(f"Successfully generated report {req.report_id}")
        
    except Exception as e:
        print(f"Failed to generate report {req.report_id}: {str(e)}")
        supabase.table("reports").update({
            "status": "failed"
        }).eq("id", req.report_id).execute()


@app.post("/generate")
async def generate_report(req: ReportRequest, background_tasks: BackgroundTasks):
    background_tasks.add_task(generate_pdf_task, req)
    return {"status": "processing", "report_id": req.report_id}

class DirectReportRequest(BaseModel):
    user_id: str
    receipt_ids: List[str]

@app.post("/generate-direct")
def generate_direct(req: DirectReportRequest):
    if not supabase:
        return Response(content="Supabase not configured", status_code=500)
    
    res = supabase.table("receipts").select("*").in_("id", req.receipt_ids).eq("user_id", req.user_id).execute()
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
            "receipt_link": receipt_link
        })
        
    template = env.get_template("report.html")
    html_out = template.render(
        month=datetime.now().month,
        year=datetime.now().year,
        generated_date=datetime.now().strftime("%B %d, %Y"),
        rides=formatted_rides,
        total_amount=f"INR {total_amount:.2f}"
    )
    
    pdf_bytes = HTML(string=html_out).write_pdf()
    
    return Response(content=pdf_bytes, media_type="application/pdf")

@app.get("/health")
def health_check():
    return {"status": "healthy"}
