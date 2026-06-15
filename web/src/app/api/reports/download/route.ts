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

    // Fetch the report to get the pdf_url (which is the file path in the bucket)
    const { data: report, error } = await supabase
      .from("reports")
      .select("pdf_url")
      .eq("id", reportId)
      .eq("user_id", session.user.id)
      .single();

    if (error || !report || !report.pdf_url) {
      return NextResponse.json({ error: "Report not found or PDF not ready" }, { status: 404 });
    }

    // Since the bucket is private and secured by RLS, we generate a signed URL valid for 60 seconds
    const { data: signedData, error: signError } = await supabase
      .storage
      .from("reports")
      .createSignedUrl(report.pdf_url, 60);

    if (signError || !signedData?.signedUrl) {
      throw signError || new Error("Failed to generate signed URL");
    }

    // Redirect the user to the signed URL so their browser starts downloading the PDF
    return NextResponse.redirect(signedData.signedUrl);
    
  } catch (err: any) {
    console.error("Download error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
