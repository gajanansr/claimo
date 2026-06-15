import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { receipt_ids } = await req.json();

    const pdfServiceUrl = process.env.PDF_SERVICE_URL;
    if (!pdfServiceUrl) {
       return NextResponse.json({ error: "PDF service not configured" }, { status: 500 });
    }

    const res = await fetch(`${pdfServiceUrl}/generate-direct`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: session.user.id,
        receipt_ids: receipt_ids
      })
    });

    if (!res.ok) {
       return NextResponse.json({ error: "PDF generation failed" }, { status: res.status });
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="claimo_custom_report_${Date.now()}.pdf"`
      }
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server Error" }, { status: 500 });
  }
}
