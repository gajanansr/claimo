import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { google } from "googleapis";
import * as cheerio from "cheerio";
import pdfParse from "pdf-parse";
import { haversineMeters } from "@/lib/haversine";

// Server-side geocoding helper (uses private API key)
async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key || !address || address === "Unknown Location") return null;
  try {
    const url = `https://addressvalidation.googleapis.com/v1:validateAddress?key=${key}`;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const res = await fetch(url, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Referer": appUrl,
      },
      body: JSON.stringify({
        address: { addressLines: [address] },
      }),
    });
    const data = await res.json();
    const location = data?.result?.geocode?.location;
    if (location?.latitude != null && location?.longitude != null) {
      return { lat: location.latitude, lng: location.longitude };
    }
  } catch (err) {
    console.error("geocodeAddress error:", err);
  }
  return null;
}

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
    // Accept optional fetchSince date from request body to limit how far back we fetch
    let fetchSince: string | null = null;
    try {
      const body = await request.json();
      if (body?.fetchSince) fetchSince = body.fetchSince;
    } catch {
      // No body or invalid JSON — fetch all
    }

    let query = "(from:noreply@uber.com OR from:partner@rapido.bike OR from:shoutout@rapido.bike) subject:(receipt OR ride OR trip OR invoice)";
    if (fetchSince) {
      // Gmail accepts after: in YYYY/MM/DD format
      const sinceDate = new Date(fetchSince);
      if (!isNaN(sinceDate.getTime())) {
        const yyyy = sinceDate.getFullYear();
        const mm = String(sinceDate.getMonth() + 1).padStart(2, "0");
        const dd = String(sinceDate.getDate()).padStart(2, "0");
        query += ` after:${yyyy}/${mm}/${dd}`;
      }
    }

    // Paginate through ALL matching messages (no maxResults cap)
    const messages: { id?: string | null; threadId?: string | null }[] = [];
    let nextPageToken: string | undefined = undefined;

    do {
      const searchRes = await gmail.users.messages.list({
        userId: "me",
        q: query,
        maxResults: 100, // fetch in batches of 100 (Gmail API max per page)
        pageToken: nextPageToken,
      });

      const batch = searchRes.data.messages || [];
      messages.push(...batch);
      nextPageToken = searchRes.data.nextPageToken ?? undefined;
    } while (nextPageToken);

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
      let receiptLink = "";

      let textData = "";
      let htmlData = "";
      const pdfAttachments: { attachmentId: string; filename: string }[] = [];

      // Recursive function to extract parts (text, html, and PDF attachments)
      const extractParts = (parts: Record<string, any>[]) => {
        for (const p of parts) {
          if (p.mimeType === "text/plain" && p.body?.data) {
            textData += Buffer.from(p.body.data, "base64").toString("utf-8") + "\n";
          } else if (p.mimeType === "text/html" && p.body?.data) {
            htmlData += Buffer.from(p.body.data, "base64").toString("utf-8") + "\n";
          } else if (p.mimeType === "application/pdf" && p.body?.attachmentId) {
            pdfAttachments.push({
              attachmentId: p.body.attachmentId,
              filename: p.filename || "receipt.pdf",
            });
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

        if (service === "uber") {
          const link = $("a").filter((i, el) => $(el).attr("href")?.includes("receipt") || $(el).text().toLowerCase().includes("download")).first();
          if (link.length) receiptLink = link.attr("href") || "";

          const fromLocMatch = $("[data-testid='address_point_0_address']").first().text().trim();
          if (fromLocMatch) fromLocation = fromLocMatch;

          const toLocMatch = $("[data-testid='address_point_1_address']").first().text().trim();
          if (toLocMatch) toLocation = toLocMatch;
        } else if (service === "rapido") {
          const rapidoFrom = $(".pickup-point .location").first().text().trim();
          if (rapidoFrom) fromLocation = rapidoFrom.replace(/\s+/g, ' ');

          const rapidoTo = $(".drop-point .location").first().text().trim();
          if (rapidoTo) toLocation = rapidoTo.replace(/\s+/g, ' ');
        }
      }

      // Fallback regex matching for Amount (₹ or Rs. or $)
      let amount = 0;
      const amountMatch = cleanText.match(/(?:₹|Rs\.?|\$)\s*([0-9,]+\.[0-9]{2})/i) || subject.match(/(?:₹|Rs\.?|\$)\s*([0-9,]+\.[0-9]{2})/i) || cleanText.match(/(?:₹|Rs\.?|\$)\s*([0-9]+)/i);
      
      if (amountMatch) {
        amount = parseFloat(amountMatch[1].replace(/,/g, ""));
      }

      // Fallback for missing locations so the UI doesn't look broken
      fromLocation = fromLocation || "Unknown Location";
      toLocation = toLocation || "Unknown Location";

      const tripDate = dateStr ? new Date(dateStr).toISOString() : new Date().toISOString();

      // Store the full HTML so the PDF service can render it as a receipt image via Playwright.
      // Limit to 500 KB to stay well within Supabase row limits (real emails are 20–100 KB).
      const MAX_HTML = 500_000;
      let storedSnippet = "";
      if (htmlData) {
        storedSnippet = htmlData.length > MAX_HTML ? htmlData.slice(0, MAX_HTML) : htmlData;
      } else if (receiptLink) {
        storedSnippet = receiptLink;
      } else {
        storedSnippet = fullMsg.data.snippet || "";
      }

      // ── Process Uber (HTML) or Rapido (PDFs) ──────────────────────
      
      if (pdfAttachments.length > 0 && service === "rapido") {
        // Handle Rapido multiple PDFs per email
        for (let i = 0; i < pdfAttachments.length; i++) {
          const att = pdfAttachments[i];
          
          try {
            const attachmentRes = await gmail.users.messages.attachments.get({
              userId: "me",
              messageId: msg.id!,
              id: att.attachmentId,
            });

            const pdfBase64 = attachmentRes.data.data;
            if (!pdfBase64) continue;

            const standardBase64 = pdfBase64.replace(/-/g, "+").replace(/_/g, "/");
            const pdfBuffer = Buffer.from(standardBase64, "base64");

            // Extract text from PDF to find exact amount and date
            const pdfData = await pdfParse(pdfBuffer);
            const pdfText = pdfData.text;

            // Regex for amount and date in PDF
            const amountMatch = pdfText.match(/(?:Total.*?|Amount.*?)(?:₹|Rs\.?|INR|\$)?\s*([0-9,]+\.[0-9]{2})/i) 
              || pdfText.match(/(?:₹|Rs\.?|\$)\s*([0-9,]+\.[0-9]{2})/i);
            
            let parsedAmount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, "")) : amount;

            const dateMatch = pdfText.match(/(\d{1,2}[\s\-./]+[A-Za-z]{3,9}[\s\-./]+[0-9]{2,4}|\d{2}[\/\-]\d{2}[\/\-]\d{4}|\d{4}[\/\-]\d{2}[\/\-]\d{2})/);
            let parsedDate = tripDate;
            if (dateMatch) {
              const d = new Date(dateMatch[1]);
              if (!isNaN(d.getTime())) parsedDate = d.toISOString();
            }

            // Deduplicate: check if this specific ride (by date + amount) already exists
            const { data: duplicate } = await supabase
              .from("receipts")
              .select("id")
              .eq("user_id", user.id)
              .eq("service", "rapido")
              .eq("amount", parsedAmount)
              .eq("trip_date", parsedDate)
              .single();

            if (duplicate) continue; // Skip this PDF, we already have it

            // Insert into DB
            // Add index to msg.id to keep it unique per attachment
            const uniqueMsgId = `${msg.id}-${i}`;
            
            const insertResult = await supabase.from("receipts").insert({
              user_id: user.id,
              service,
              amount: parsedAmount,
              currency: "INR",
              trip_date: parsedDate,
              status: parsedAmount > 0 ? "found" : "pending",
              gmail_message_id: uniqueMsgId,
              email_subject: subject,
              from_location: fromLocation,
              to_location: toLocation,
              raw_email_snippet: storedSnippet,
            }).select("id").single();

            if (!insertResult.error && insertResult.data?.id) {
              const receiptId = insertResult.data.id;
              
              // Upload PDF to Supabase Storage
              const storagePath = `${user.id}/${receiptId}.pdf`;
              const { error: uploadError } = await supabase.storage
                .from("receipts")
                .upload(storagePath, pdfBuffer, {
                  contentType: "application/pdf",
                  upsert: false,
                });

              if (!uploadError) {
                await supabase.from("receipts").update({ receipt_pdf_path: storagePath }).eq("id", receiptId);
              }
              
              // Increment count
              syncedCount++;
            }
          } catch (err) {
            console.error("PDF processing error:", err);
          }
        }
      } else {
        // Handle Uber (HTML) or fallback logic
        const { data: duplicate } = await supabase
          .from("receipts")
          .select("id")
          .eq("user_id", user.id)
          .eq("service", service)
          .eq("amount", amount)
          .eq("trip_date", tripDate)
          .single();

        if (duplicate) continue;

        const insertResult = await supabase.from("receipts").insert({
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
          raw_email_snippet: storedSnippet,
        }).select("id").single();

        if (!insertResult.error && insertResult.data?.id) {
          syncedCount++;
        }
      }

      // ── Location tagging ───────────────────────────────────────
      if (!insertResult.error && insertResult.data?.id) {
        const receiptId = insertResult.data.id;

        // Fetch saved user locations
        const { data: userLocations } = await supabase
          .from("user_locations")
          .select("*")
          .eq("user_id", user.id);

        if (userLocations && userLocations.length > 0) {
          // Geocode from and to addresses in parallel
          const [fromCoords, toCoords] = await Promise.all([
            geocodeAddress(fromLocation),
            geocodeAddress(toLocation),
          ]);

          let locationTag: string | null = null;
          let matchedFrom: { label: string } | null = null;
          let matchedTo: { label: string } | null = null;

          for (const loc of userLocations) {
            if (fromCoords) {
              const dist = haversineMeters(fromCoords.lat, fromCoords.lng, loc.lat, loc.lng);
              if (dist <= loc.radius_meters) matchedFrom = loc;
            }
            if (toCoords) {
              const dist = haversineMeters(toCoords.lat, toCoords.lng, loc.lat, loc.lng);
              if (dist <= loc.radius_meters) matchedTo = loc;
            }
          }

          if (matchedFrom && matchedTo) {
            locationTag = `${matchedFrom.label} → ${matchedTo.label}`;
          } else if (matchedFrom) {
            locationTag = `From ${matchedFrom.label}`;
          } else if (matchedTo) {
            locationTag = `To ${matchedTo.label}`;
          }

          // Update receipt with geocode results and location tag
          const updatePayload: Record<string, unknown> = {};
          if (fromCoords) { updatePayload.from_lat = fromCoords.lat; updatePayload.from_lng = fromCoords.lng; }
          if (toCoords) { updatePayload.to_lat = toCoords.lat; updatePayload.to_lng = toCoords.lng; }
          if (locationTag) updatePayload.location_tag = locationTag;

          if (Object.keys(updatePayload).length > 0) {
            await supabase.from("receipts").update(updatePayload).eq("id", receiptId);
          }
        }
      }

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
