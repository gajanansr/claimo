import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { google } from "googleapis";
import fs from "fs";
import path from "path";

// Debug endpoint: dumps the EXACT Gmail API response shape for Rapido emails
// so we can see how locations/amounts/dates are actually delivered.
//
// Usage (while logged in, in the browser):
//   /api/debug-rapido            -> 3 most recent Rapido emails
//   /api/debug-rapido?count=8    -> 8 emails
//   /api/debug-rapido?q=from:rapido.bike subject:receipt
//
// Returns JSON (structure + PDF text inline) and also writes full
// artifacts to web/debug-output/ so nothing is truncated.

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const count = Math.min(parseInt(url.searchParams.get("count") || "3", 10) || 3, 20);
    const q =
      url.searchParams.get("q") ||
      "from:rapido.bike OR from:rapido.com";

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {},
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" });

    const { data: profile } = await supabase
      .from("profiles")
      .select("google_access_token")
      .eq("id", user.id)
      .single();
    if (!profile?.google_access_token)
      return NextResponse.json({ error: "Gmail not connected" });

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: profile.google_access_token });
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    const outDir = path.join(process.cwd(), "debug-output");
    fs.mkdirSync(outDir, { recursive: true });

    const searchRes = await gmail.users.messages.list({
      userId: "me",
      q,
      maxResults: count,
    });

    const messages = searchRes.data.messages || [];

    // Recursively describe the MIME tree without dumping huge base64 blobs.
    type PartNode = {
      mimeType?: string | null;
      filename?: string | null;
      hasInlineData: boolean;
      inlineBytes: number;
      attachmentId?: string | null;
      headers?: Record<string, string>;
      parts?: PartNode[];
    };

    const describePart = (p: any): PartNode => {
      const node: PartNode = {
        mimeType: p.mimeType,
        filename: p.filename || null,
        hasInlineData: !!p.body?.data,
        inlineBytes: p.body?.size ?? (p.body?.data ? p.body.data.length : 0),
        attachmentId: p.body?.attachmentId || null,
      };
      if (p.parts) node.parts = p.parts.map(describePart);
      return node;
    };

    const results: any[] = [];

    for (const m of messages) {
      const fullMsg = await gmail.users.messages.get({
        userId: "me",
        id: m.id!,
        format: "full",
      });

      const payload: any = fullMsg.data.payload;
      const headers = payload?.headers || [];
      const h = (name: string) =>
        headers.find((x: any) => x.name?.toLowerCase() === name)?.value || "";

      const subject = h("subject");
      const from = h("from");
      const date = h("date");

      // Walk every part: collect html, plain text, and PDF attachments.
      let html = "";
      let plain = "";
      const pdfParts: { filename: string; attachmentId?: string; inlineData?: string }[] = [];

      const walk = (parts: any[]) => {
        for (const p of parts) {
          if (p.mimeType === "text/html" && p.body?.data) {
            html += Buffer.from(p.body.data, "base64").toString("utf-8") + "\n";
          } else if (p.mimeType === "text/plain" && p.body?.data) {
            plain += Buffer.from(p.body.data, "base64").toString("utf-8") + "\n";
          } else if (
            p.mimeType === "application/pdf" ||
            (p.filename && p.filename.toLowerCase().endsWith(".pdf"))
          ) {
            pdfParts.push({
              filename: p.filename || "receipt.pdf",
              attachmentId: p.body?.attachmentId,
              inlineData: p.body?.data,
            });
          }
          if (p.parts) walk(p.parts);
        }
      };

      if (payload?.parts) walk(payload.parts);
      else if (payload?.body?.data) {
        if (payload.mimeType === "text/html")
          html = Buffer.from(payload.body.data, "base64").toString("utf-8");
        else plain = Buffer.from(payload.body.data, "base64").toString("utf-8");
      }

      // Extract text from each PDF attachment.
      const pdfTexts: { filename: string; bytes: number; text: string }[] = [];
      for (const pp of pdfParts) {
        try {
          let b64 = pp.inlineData || "";
          if (!b64 && pp.attachmentId) {
            const att = await gmail.users.messages.attachments.get({
              userId: "me",
              messageId: m.id!,
              id: pp.attachmentId,
            });
            b64 = att.data.data || "";
          }
          if (!b64) {
            pdfTexts.push({ filename: pp.filename, bytes: 0, text: "(no data)" });
            continue;
          }
          const std = b64.replace(/-/g, "+").replace(/_/g, "/");
          const buf = Buffer.from(std, "base64");
          const pdfParse = require("pdf-parse/lib/pdf-parse.js");
          const parsed = await pdfParse(buf);
          pdfTexts.push({ filename: pp.filename, bytes: buf.length, text: parsed.text });
        } catch (e: any) {
          pdfTexts.push({
            filename: pp.filename,
            bytes: 0,
            text: `(parse error: ${e?.message})`,
          });
        }
      }

      // Persist full artifacts to disk (untruncated).
      const safeId = String(m.id);
      if (html) fs.writeFileSync(path.join(outDir, `rapido_${safeId}.html`), html);
      if (plain) fs.writeFileSync(path.join(outDir, `rapido_${safeId}.txt`), plain);
      pdfTexts.forEach((pt, i) =>
        fs.writeFileSync(
          path.join(outDir, `rapido_${safeId}_pdf${i}.txt`),
          `FILENAME: ${pt.filename}\nBYTES: ${pt.bytes}\n\n${pt.text}`
        )
      );
      fs.writeFileSync(
        path.join(outDir, `rapido_${safeId}_structure.json`),
        JSON.stringify(
          { id: m.id, subject, from, date, structure: payload?.parts?.map(describePart) ?? describePart(payload) },
          null,
          2
        )
      );

      results.push({
        id: m.id,
        subject,
        from,
        date,
        mimeStructure: payload?.parts?.map(describePart) ?? [describePart(payload)],
        htmlLength: html.length,
        plainLength: plain.length,
        pdfCount: pdfTexts.length,
        // Inline the most useful bits so they show up directly in the response.
        plainPreview: plain.slice(0, 4000),
        pdfTexts: pdfTexts.map((pt) => ({
          filename: pt.filename,
          bytes: pt.bytes,
          text: pt.text, // full extracted text — this is what we need
        })),
      });
    }

    return NextResponse.json(
      {
        query: q,
        emailsFound: messages.length,
        savedTo: outDir,
        note:
          "Full HTML/PDF/structure written to web/debug-output/. PDF text is inlined below.",
        results,
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message, stack: error.stack });
  }
}
