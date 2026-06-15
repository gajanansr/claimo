import { NextRequest, NextResponse } from "next/server";
import { getServerSupabaseClient } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const supabase = getServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { month, year } = await req.json();

    // 1. Create a placeholder report record in Supabase
    const { data: report, error } = await supabase.from("reports").insert({
      user_id: session.user.id,
      month: month,
      year: year,
      status: "processing"
    }).select().single();

    if (error) {
      if (error.code === '23505') { // unique violation
        return NextResponse.json({ error: "Report for this month already exists" }, { status: 400 });
      }
      throw error;
    }

    // 2. Trigger external FastAPI service (non-blocking if possible, but we just await the quick request)
    const pdfServiceUrl = process.env.PDF_SERVICE_URL;
    
    if (pdfServiceUrl) {
      try {
        await fetch(`${pdfServiceUrl}/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: session.user.id,
            report_id: report.id,
            month,
            year
          })
        });
      } catch (err) {
        console.error("Failed to trigger PDF service:", err);
      }
    } else {
      console.warn("PDF_SERVICE_URL not set. Skipping external generation.");
      // Just mark it ready for MVP if no backend
      await supabase.from("reports").update({ status: "ready", pdf_url: "#", total_amount: 0, ride_count: 0 }).eq("id", report.id);
    }

    return NextResponse.json({ success: true, report_id: report.id });
    
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message || "Server Error" }, { status: 500 });
  }
}
