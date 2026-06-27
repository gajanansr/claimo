import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { locationTag, mode } = body;
    // "full" = summary report + receipts; "receipts" = receipts only.
    const reportMode = mode === "receipts" ? "receipts" : "full";

    // Resolve the date range. Prefer an explicit start/end (inclusive); fall
    // back to a whole-month range derived from month/year for legacy callers.
    const pad = (n: number) => String(n).padStart(2, "0");
    let startDate: string | undefined = body.startDate;
    let endDate: string | undefined = body.endDate;
    let month: number = body.month;
    let year: number = body.year;

    if (startDate && endDate) {
      // Derive month/year from start for the reports row + listing display.
      year = parseInt(startDate.slice(0, 4), 10);
      month = parseInt(startDate.slice(5, 7), 10);
    } else if (month && year) {
      startDate = `${year}-${pad(month)}-01`;
      const lastDay = new Date(year, month, 0).getDate(); // last day of month
      endDate = `${year}-${pad(month)}-${pad(lastDay)}`;
    } else {
      return NextResponse.json({ error: "Provide a date range or month/year" }, { status: 400 });
    }

    // Fetch user tier
    const { data: profile } = await supabase.from("profiles").select("is_pro").eq("id", session.user.id).single();
    const isPro = profile?.is_pro || false;

    if (!isPro) {
      // 1. Check total reports limit (Free: max 2 reports)
      const { count: reportCount } = await supabase
        .from("reports")
        .select("*", { count: "exact", head: true })
        .eq("user_id", session.user.id);
        
      if (reportCount !== null && reportCount >= 2) {
        return NextResponse.json({ error: "Free plan limit reached (max 2 reports). Please upgrade to Pro." }, { status: 403 });
      }

      // 2. Check ride count limit for this range (Free: max 5 rides per report)
      let query = supabase
        .from("receipts")
        .select("*", { count: "exact", head: true })
        .eq("user_id", session.user.id)
        .gte("trip_date", startDate)
        .lte("trip_date", endDate);

      if (locationTag) {
        query = query.ilike("location_tag", `%${locationTag}%`);
      }

      const { count: rideCount, error: countError } = await query;
      
      if (countError) {
        console.error("Error counting rides:", countError);
      }

      if (rideCount !== null && rideCount > 5) {
        return NextResponse.json({ 
          error: `Free plan is limited to 5 rides per report (you have ${rideCount}). Please upgrade to Pro for unlimited rides.` 
        }, { status: 403 });
      }
    }

    // 1. Create a placeholder report record in Supabase
    // We pass location_tag so it can be displayed in UI later if desired
    const { data: report, error } = await supabase.from("reports").insert({
      user_id: session.user.id,
      month: month,
      year: year,
      start_date: startDate,
      end_date: endDate,
      status: "processing",
      location_tag: locationTag || null
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
            year,
            start_date: startDate,
            end_date: endDate,
            location_tag: locationTag || null,
            mode: reportMode
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
