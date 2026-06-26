import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { google } from "googleapis";
import * as cheerio from "cheerio";
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
  // Parse request body before streaming begins (can only read body once)
  let fetchSince: string | null = null;
  try {
    const body = await request.json();
    if (body?.fetchSince) fetchSince = body.fetchSince;
  } catch {
    // No body or invalid JSON — fetch all
  }

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
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 2. Fetch user's Google tokens from profiles
  const { data: profile } = await supabase
    .from("profiles")
    .select("google_access_token")
    .eq("id", user.id)
    .single();

  if (!profile?.google_access_token) {
    return new Response(JSON.stringify({ error: "Gmail not connected" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 3. Setup Gmail API client
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: profile.google_access_token });
  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  // 4. Build the SSE stream
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // Stream may have been closed by client
        }
      };

      try {
        // ── Search for emails ────────────────────────────────────
        let query = "(from:uber.com OR from:rapido.bike) (subject:receipt OR subject:ride OR subject:trip OR subject:invoice OR filename:pdf)";
        if (fetchSince) {
          const sinceDate = new Date(fetchSince);
          if (!isNaN(sinceDate.getTime())) {
            const yyyy = sinceDate.getFullYear();
            const mm = String(sinceDate.getMonth() + 1).padStart(2, "0");
            const dd = String(sinceDate.getDate()).padStart(2, "0");
            query += ` after:${yyyy}/${mm}/${dd}`;
          }
        }

        const messages: { id?: string | null; threadId?: string | null }[] = [];
        let nextPageToken: string | undefined = undefined;

        do {
          const searchRes: any = await gmail.users.messages.list({
            userId: "me",
            q: query,
            maxResults: 100,
            pageToken: nextPageToken,
          });

          const batch = searchRes.data.messages || [];
          messages.push(...batch);
          nextPageToken = searchRes.data.nextPageToken ?? undefined;

          send({ type: "scanning", found: messages.length });
        } while (nextPageToken);

        send({ type: "scan_complete", total: messages.length });

        let syncedCount = 0;
        let skippedCount = 0;

        // ── Parse each message ───────────────────────────────────
        for (let msgIdx = 0; msgIdx < messages.length; msgIdx++) {
          const msg = messages[msgIdx];
          if (!msg.id) continue;

          // Check if we already have this receipt (exact id for single-attachment emails)
          const { data: existingExact } = await supabase
            .from("receipts")
            .select("id")
            .eq("gmail_message_id", msg.id)
            .single();

          if (existingExact) {
            skippedCount++;
            send({ type: "skipped" });
            send({ type: "processing", current: msgIdx + 1, total: messages.length, subject: "(already synced)", service: "" });
            continue;
          }

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

          send({ type: "processing", current: msgIdx + 1, total: messages.length, subject, service });

          let receiptLink = "";
          let textData = "";
          let htmlData = "";
          const pdfAttachments: { attachmentId?: string; data?: string; filename: string }[] = [];

          const extractParts = (parts: Record<string, any>[]) => {
            for (const p of parts) {
              if (p.mimeType === "text/plain" && p.body?.data) {
                textData += Buffer.from(p.body.data, "base64").toString("utf-8") + "\n";
              } else if (p.mimeType === "text/html" && p.body?.data) {
                htmlData += Buffer.from(p.body.data, "base64").toString("utf-8") + "\n";
              } else if (p.mimeType === "application/pdf" || (p.filename && p.filename.toLowerCase().endsWith(".pdf"))) {
                if (p.body?.attachmentId) {
                  pdfAttachments.push({
                    attachmentId: p.body.attachmentId,
                    filename: p.filename || "receipt.pdf",
                  });
                } else if (p.body?.data) {
                  pdfAttachments.push({
                    data: p.body.data,
                    filename: p.filename || "receipt.pdf",
                  });
                }
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
          let amount = 0;
          let tripDate = dateStr ? new Date(dateStr).toISOString() : new Date().toISOString();

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

              const costText = $(".ride-cost").first().text().trim();
              const costMatch = costText.match(/(?:₹|Rs\.?|INR|\$)\s*([0-9,]+\.[0-9]{2}|[0-9,]+)/i);
              if (costMatch) amount = parseFloat(costMatch[1].replace(/,/g, ""));

              $(".ride-value").each((i, el) => {
                  if ($(el).text().trim() === "Time of Ride") {
                      const dateText = $(el).next(".ride-value.align-right").text().trim();
                      const cleanedDateText = dateText.replace(/(\d{1,2})(st|nd|rd|th)/, "$1");
                      const d = new Date(cleanedDateText);
                      if (!isNaN(d.getTime())) {
                           tripDate = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
                      }
                  }
              });
            }
          }

          if (amount === 0) {
            const amountMatch = cleanText.match(/(?:₹|Rs\.?|INR|\$)\s*([0-9,]+\.[0-9]{2})/i)
              || subject.match(/(?:₹|Rs\.?|INR|\$)\s*([0-9,]+\.[0-9]{2})/i)
              || cleanText.match(/(?:₹|Rs\.?|INR|\$)\s*([0-9]+)/i)
              || cleanText.match(/(?:Total|Amount)[\s\S]{1,20}?([0-9,]+\.[0-9]{2})/i);

            if (amountMatch) {
              amount = parseFloat(amountMatch[1].replace(/,/g, ""));
            }
          }

          fromLocation = fromLocation || "Unknown Location";
          toLocation = toLocation || "Unknown Location";

          const MAX_HTML = 500_000;
          let storedSnippet = "";
          if (htmlData) {
            storedSnippet = htmlData.length > MAX_HTML ? htmlData.slice(0, MAX_HTML) : htmlData;
          } else if (receiptLink) {
            storedSnippet = receiptLink;
          } else {
            storedSnippet = fullMsg.data.snippet || "";
          }

          const insertedReceiptIds: string[] = [];

          console.log(`\n--- Processing Email: ${subject} ---`);
          console.log(`Service: ${service}, Attachments: ${pdfAttachments.length}`);

          if (pdfAttachments.length > 0 && service === "rapido") {
            console.log(`-> Processing ${pdfAttachments.length} Rapido PDF(s)`);

            const { data: alreadyStored } = await supabase
              .from("receipts")
              .select("gmail_message_id")
              .like("gmail_message_id", `${msg.id}-%`);

            const storedIndices = new Set(
              (alreadyStored || []).map((r) => {
                const parts = String(r.gmail_message_id).split("-");
                return parseInt(parts[parts.length - 1], 10);
              }).filter((n) => !isNaN(n))
            );

            console.log(`-> Already stored ${storedIndices.size} PDF(s) from this email`);

            for (let i = 0; i < pdfAttachments.length; i++) {
              const att = pdfAttachments[i];

              send({ type: "pdf_progress", pdfIndex: i + 1, pdfTotal: pdfAttachments.length, subject });

              if (storedIndices.has(i)) {
                console.log(`-> PDF [${i}/${pdfAttachments.length}] "${att.filename}" — already stored, skipping`);
                skippedCount++;
                send({ type: "skipped" });
                continue;
              }

              try {
                let pdfBase64 = "";
                if (att.attachmentId) {
                  const attachmentRes = await gmail.users.messages.attachments.get({
                    userId: "me",
                    messageId: msg.id!,
                    id: att.attachmentId,
                  });
                  pdfBase64 = attachmentRes.data.data || "";
                } else if (att.data) {
                  pdfBase64 = att.data;
                }

                if (!pdfBase64) {
                  console.log(`-> PDF [${i}/${pdfAttachments.length}] "${att.filename}" — no data, skipping`);
                  continue;
                }

                const standardBase64 = pdfBase64.replace(/-/g, "+").replace(/_/g, "/");
                const pdfBuffer = Buffer.from(standardBase64, "base64");

                console.log(`-> PDF [${i}/${pdfAttachments.length}] "${att.filename}" — ${pdfBuffer.length} bytes`);

                const pdfParse = require("pdf-parse/lib/pdf-parse.js");
                const pdfData = await pdfParse(pdfBuffer);
                const pdfText = pdfData.text;

                console.log(`-> PDF [${i}] Extracted text (first 200 chars): ${pdfText.substring(0, 200).replace(/\n/g, " ")}`);

                const pdfAmountMatch = pdfText.match(/(?:Total\s*(?:Fare|Amount|Bill|Charges)?)[:\s]*(?:₹|Rs\.?|INR)?\s*([0-9,]+(?:\.[0-9]{2})?)/i)
                  || pdfText.match(/(?:Grand Total)[:\s]*(?:₹|Rs\.?|INR)?\s*([0-9,]+(?:\.[0-9]{2})?)/i)
                  || pdfText.match(/(?:₹|Rs\.?|INR)\s*([0-9,]+\.[0-9]{2})/i)
                  || pdfText.match(/(?:₹|Rs\.?|INR)\s*([0-9,]+)/i)
                  || pdfText.match(/(?:Amount|Total|Fare)[:\s\S]{1,30}?([0-9,]+\.[0-9]{2})/i);

                let parsedAmount = pdfAmountMatch ? parseFloat(pdfAmountMatch[1].replace(/,/g, "")) : 0;

                if (parsedAmount === 0 && pdfAttachments.length === 1) {
                  parsedAmount = amount;
                }

                console.log(`-> PDF [${i}] Amount: ₹${parsedAmount} (match: ${pdfAmountMatch ? pdfAmountMatch[0].trim() : 'none'})`);

                if (parsedAmount === 0) {
                  console.log(`-> PDF [${i}] Skipped — zero amount`);
                  continue;
                }

                // ── Extract date from PDF text ──
                // Try multiple date formats common in Indian ride receipts
                const dateMatch = pdfText.match(/(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})/i)          // "16 Jun 2026"
                  || pdfText.match(/(\d{1,2}[\s\-./]+[A-Za-z]{3,9}[\s\-./]+\d{4})/i)            // "16-Jun-2026"
                  || pdfText.match(/([A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})/i)                      // "Jun 16, 2026"
                  || pdfText.match(/(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i)                             // "16/06/2026" or "16-06-2026"
                  || pdfText.match(/(\d{4}[\/\-]\d{2}[\/\-]\d{2})/i);                            // "2026-06-16"

                let parsedDate = tripDate;
                if (dateMatch) {
                  const d = new Date(dateMatch[1]);
                  if (!isNaN(d.getTime())) {
                    // Normalize to date-only (YYYY-MM-DDT00:00:00.000Z) for reliable dedup
                    parsedDate = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
                  }
                }
                console.log(`-> PDF [${i}] Date: ${parsedDate} (raw match: ${dateMatch ? dateMatch[1] : 'none — using email date'})`);
                console.log(`-> PDF [${i}] Full text for debug: ${pdfText.substring(0, 500).replace(/\n/g, " | ")}`);

                // ── Extract locations from PDF text ──
                // For Rapido, the PDF is completely unstructured so locations might not have 'Pickup' labels.
                // If it's a single receipt email, we inherit the precise locations from the parsed HTML body!
                let pdfFrom = pdfAttachments.length === 1 && fromLocation !== "Unknown Location" ? fromLocation : "Unknown Location";
                let pdfTo = pdfAttachments.length === 1 && toLocation !== "Unknown Location" ? toLocation : "Unknown Location";

                const pickupMatch = pdfText.match(/(?:Pickup|Pick[\s-]?up|Pickup Location|Boarding Point)[:\s]+([^\n]{5,120})/i);
                const dropMatch = pdfText.match(/(?:Drop|Drop[\s-]?off|Drop Location|Alighting Point|Destination)[:\s]+([^\n]{5,120})/i);
                if (pickupMatch) pdfFrom = pickupMatch[1].replace(/\s+/g, " ").trim().substring(0, 120);
                if (dropMatch) pdfTo = dropMatch[1].replace(/\s+/g, " ").trim().substring(0, 120);

                // ── Deduplicate ──
                // Compare by amount + calendar date only (strip time), so the same ride
                // from an individual email and a bulk receipt email is caught as a dupe.
                const dedupDate = parsedDate.substring(0, 10); // "YYYY-MM-DD"
                const { data: duplicates } = await supabase
                  .from("receipts")
                  .select("id")
                  .eq("user_id", user.id)
                  .eq("service", "rapido")
                  .eq("amount", parsedAmount)
                  .gte("trip_date", `${dedupDate}T00:00:00.000Z`)
                  .lt("trip_date", `${dedupDate}T23:59:59.999Z`);

                if (duplicates && duplicates.length > 0) {
                  console.log(`-> PDF [${i}] Skipped — duplicate ride (₹${parsedAmount} on ${dedupDate})`);
                  skippedCount++;
                  send({ type: "skipped" });
                  continue;
                }

                const uniqueMsgId = `${msg.id}-${i}`;

                const insertResult = await supabase.from("receipts").insert({
                  user_id: user.id,
                  service,
                  amount: parsedAmount,
                  currency: "INR",
                  trip_date: parsedDate,
                  status: "found",
                  gmail_message_id: uniqueMsgId,
                  email_subject: subject,
                  from_location: pdfFrom,
                  to_location: pdfTo,
                  raw_email_snippet: storedSnippet,
                }).select("id").single();

                if (insertResult.error) {
                  console.error(`-> PDF [${i}] Insert error:`, insertResult.error.message);
                  continue;
                }

                if (insertResult.data?.id) {
                  const receiptId = insertResult.data.id;
                  console.log(`-> PDF [${i}] Inserted receipt: ${receiptId}`);

                  const storagePath = `${user.id}/${receiptId}.pdf`;
                  const { error: uploadError } = await supabase.storage
                    .from("receipts")
                    .upload(storagePath, pdfBuffer, {
                      contentType: "application/pdf",
                      upsert: false,
                    });

                  if (!uploadError) {
                    await supabase.from("receipts").update({ receipt_pdf_path: storagePath }).eq("id", receiptId);
                  } else {
                    console.error(`-> PDF [${i}] Storage upload error:`, uploadError.message);
                  }

                  insertedReceiptIds.push(receiptId);
                  syncedCount++;
                  send({ type: "synced" });
                }
              } catch (err) {
                console.error(`PDF [${i}] processing error:`, err);
              }
            }

            console.log(`-> Email done: synced ${insertedReceiptIds.length}/${pdfAttachments.length} PDFs`);
          } else {
            console.log("-> Processing as HTML Fallback");

            if (amount === 0 && service === "rapido") {
              console.log("-> Skipped! Rapido HTML has 0 amount. Deemed as promo/junk.");
              skippedCount++;
              send({ type: "skipped" });
              continue;
            }

            const { data: duplicate } = await supabase
              .from("receipts")
              .select("id")
              .eq("user_id", user.id)
              .eq("service", service)
              .eq("amount", amount)
              .eq("trip_date", tripDate)
              .single();

            if (duplicate) {
              skippedCount++;
              send({ type: "skipped" });
              continue;
            }

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
              insertedReceiptIds.push(insertResult.data.id);
              syncedCount++;
              send({ type: "synced" });
            }
          }

          // ── Location tagging ───────────────────────────────────────
          if (insertedReceiptIds.length > 0) {
            const { data: userLocations } = await supabase
              .from("user_locations")
              .select("*")
              .eq("user_id", user.id);

            if (userLocations && userLocations.length > 0) {
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

              const updatePayload: Record<string, unknown> = {};
              if (fromCoords) { updatePayload.from_lat = fromCoords.lat; updatePayload.from_lng = fromCoords.lng; }
              if (toCoords) { updatePayload.to_lat = toCoords.lat; updatePayload.to_lng = toCoords.lng; }
              if (locationTag) updatePayload.location_tag = locationTag;

              if (Object.keys(updatePayload).length > 0) {
                await supabase.from("receipts").update(updatePayload).in("id", insertedReceiptIds);
              }
            }
          }
        }

        send({ type: "done", syncedCount, skippedCount });
        controller.close();
      } catch (error: unknown) {
        console.error("Sync error:", error);
        if (error && typeof error === 'object' && 'code' in error && error.code === 401) {
          send({ type: "error", message: "Google token expired. Please sign in again." });
        } else {
          send({ type: "error", message: error instanceof Error ? error.message : "Internal Error" });
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
