import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function GET(req: NextRequest) {
  try {
    const reportId = req.nextUrl.searchParams.get("id");
    if (!reportId) {
      return NextResponse.json({ error: "Missing report ID" }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch the report to get the pdf_url (the file path in the bucket)
    const { data: report, error } = await supabase
      .from("reports")
      .select("pdf_url, start_date, end_date, month, year")
      .eq("id", reportId)
      .eq("user_id", session.user.id)
      .single();

    if (error || !report || !report.pdf_url) {
      return NextResponse.json({ error: "Report not found or PDF not ready" }, { status: 404 });
    }

    // Friendly download filename based on the report period.
    const period = report.start_date
      ? `${report.start_date}_to_${report.end_date}`
      : `${report.year}-${String(report.month).padStart(2, "0")}`;
    const filename = `claimo-report-${period}.pdf`;

    // Private bucket → signed URL (60s). The `download` option makes storage
    // serve `Content-Disposition: attachment`, so phones actually download the
    // file instead of opening it inline (or a blank tab).
    const { data: signedData, error: signError } = await supabase
      .storage
      .from("reports")
      .createSignedUrl(report.pdf_url, 60, { download: filename });

    if (signError || !signedData?.signedUrl) {
      throw signError || new Error("Failed to generate signed URL");
    }

    return NextResponse.redirect(signedData.signedUrl);
    
  } catch (err: any) {
    console.error("Download error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
