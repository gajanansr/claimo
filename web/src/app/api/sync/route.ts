import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { google } from "googleapis";
import * as cheerio from "cheerio";

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {
            // Read-only in API routes
          },
        },
      }
    );

    // 1. Get authenticated user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Fetch user's Google tokens from profiles
    const { data: profile } = await supabase
      .from("profiles")
      .select("google_access_token")
      .eq("id", user.id)
      .single();

    if (!profile?.google_access_token) {
      return NextResponse.json({ error: "Gmail not connected" }, { status: 400 });
    }

    // 3. Setup Gmail API client
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: profile.google_access_token });
    
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    // 4. Search for Uber and Rapido receipts
    // Limiting to 10 for performance in this initial version
    const searchRes = await gmail.users.messages.list({
      userId: "me",
      q: "(from:uber.com OR from:rapido.bike) subject:(receipt OR ride OR trip OR invoice)",
      maxResults: 20,
    });

    const messages = searchRes.data.messages || [];
    let syncedCount = 0;

    // 5. Parse each message
    for (const msg of messages) {
      if (!msg.id) continue;
      
      // Check if we already have this receipt to avoid duplicate work
      const { data: existing } = await supabase
        .from("receipts")
        .select("id")
        .eq("gmail_message_id", msg.id)
        .single();
        
      if (existing) continue;

      const fullMsg = await gmail.users.messages.get({
        userId: "me",
        id: msg.id,
      });

      const payload = fullMsg.data.payload;
      const headers = payload?.headers || [];
      const subject = headers.find((h) => h.name?.toLowerCase() === "subject")?.value || "";
      const from = headers.find((h) => h.name?.toLowerCase() === "from")?.value || "";
      const dateStr = headers.find((h) => h.name?.toLowerCase() === "date")?.value || "";

      let service = "other";
      if (from.toLowerCase().includes("uber")) service = "uber";
      if (from.toLowerCase().includes("rapido")) service = "rapido";

      // Check for PDF attachments (Rapido) or Links (Uber)
      // The FastAPI PDF generator will use the gmail_message_id to download these later.
      let receiptLink = "";

      let textData = "";
      let htmlData = "";

      // Recursive function to extract parts
      const extractParts = (parts: Record<string, any>[]) => {
        for (const p of parts) {
          if (p.mimeType === "text/plain" && p.body?.data) {
            textData += Buffer.from(p.body.data, "base64").toString("utf-8") + "\n";
          } else if (p.mimeType === "text/html" && p.body?.data) {
            htmlData += Buffer.from(p.body.data, "base64").toString("utf-8") + "\n";
          }
          if (p.parts) extractParts(p.parts);
        }
      };

      if (payload?.parts) {
        extractParts(payload.parts);
      } else if (payload?.body?.data) {
        if (payload.mimeType === "text/html") {
          htmlData = Buffer.from(payload.body.data, "base64").toString("utf-8");
        } else {
          textData = Buffer.from(payload.body.data, "base64").toString("utf-8");
        }
      }

      let cleanText = textData;
      let fromLocation = "";
      let toLocation = "";

      if (htmlData) {
        const $ = cheerio.load(htmlData);
        cleanText += " " + $.text().replace(/\s+/g, " ");

        // Extract Uber receipt link if present
        if (service === "uber") {
          const link = $("a").filter((i, el) => $(el).attr("href")?.includes("receipt") || $(el).text().toLowerCase().includes("download")).first();
          if (link.length) receiptLink = link.attr("href") || "";
        }
      }

      // Fallback regex matching for Amount (₹ or Rs. or $)
      let amount = 0;
      const amountMatch = cleanText.match(/(?:₹|Rs\.?|\$)\s*([0-9,]+\.[0-9]{2})/i) || subject.match(/(?:₹|Rs\.?|\$)\s*([0-9,]+\.[0-9]{2})/i) || cleanText.match(/(?:₹|Rs\.?|\$)\s*([0-9]+)/i);
      
      if (amountMatch) {
        amount = parseFloat(amountMatch[1].replace(/,/g, ""));
      }

      // Attempt to guess locations for UI
      if (service === "rapido") {
        fromLocation = "Pickup Location"; // Simplified for MVP
        toLocation = "Drop Location";
      }

      // If we couldn't parse an amount, we'll mark it as pending manual review
      const tripDate = dateStr ? new Date(dateStr).toISOString() : new Date().toISOString();

      await supabase.from("receipts").insert({
        user_id: user.id,
        service,
        amount,
        currency: "INR",
        trip_date: tripDate,
        status: amount > 0 ? "found" : "pending",
        gmail_message_id: msg.id,
        email_subject: subject,
        from_location: fromLocation,
        to_location: toLocation,
        raw_email_snippet: receiptLink || fullMsg.data.snippet || "",
      });

      syncedCount++;
    }

    return NextResponse.json({ success: true, syncedCount });
  } catch (error: unknown) {
    console.error("Sync error:", error);
    if (error && typeof error === 'object' && 'code' in error && error.code === 401) {
      return NextResponse.json({ error: "Google token expired. Please sign in again." }, { status: 401 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Internal Error" }, { status: 500 });
  }
}
