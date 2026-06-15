import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { google } from "googleapis";
import fs from 'fs';
import path from 'path';

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll() {},
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" });

    const { data: profile } = await supabase.from("profiles").select("google_access_token").eq("id", user.id).single();
    if (!profile?.google_access_token) return NextResponse.json({ error: "Gmail not connected" });

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: profile.google_access_token });
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    // Grab exclusively Uber receipts without relying on subject (which varies by region)
    const searchRes = await gmail.users.messages.list({ userId: "me", q: "from:uber.com", maxResults: 5 });
    
    let logs = "";

    for (const msg of searchRes.data.messages || []) {
      const fullMsg = await gmail.users.messages.get({ userId: "me", id: msg.id! });
      
      let htmlData = "";
      const extractParts = (parts: any[]) => {
        for (const p of parts) {
          if (p.mimeType === "text/html" && p.body?.data) {
            htmlData += Buffer.from(p.body.data, "base64").toString("utf-8");
          }
          if (p.parts) extractParts(p.parts);
        }
      };
      
      if (fullMsg.data.payload?.parts) {
        extractParts(fullMsg.data.payload.parts);
      } else if (fullMsg.data.payload?.body?.data && fullMsg.data.payload.mimeType === "text/html") {
        htmlData = Buffer.from(fullMsg.data.payload.body.data, "base64").toString("utf-8");
      }

      const filePath = path.join(process.cwd(), `debug_${msg.id}.html`);
      fs.writeFileSync(filePath, htmlData);
      logs += `Saved ${filePath}\n`;
    }

    return new NextResponse(logs);
  } catch (error: any) {
    return NextResponse.json({ error: error.message });
  }
}
