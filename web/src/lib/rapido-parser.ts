// Pure parser for Rapido receipt PDFs (the text produced by pdf-parse).
//
// Real-world structure (verified against many receipts), in text order:
//
//   <Customer Name value>
//   RD<digits>                       <- Ride ID (also in the PDF filename)
//   <Driver name value>
//   <Vehicle number value>
//   [<Mode of Vehicle value>]        <- present only for Auto/Car, absent for bike
//   <Mon DDth YYYY, H:MM AM/PM>      <- Time of Ride
//   Booking History
//   Customer Name / Ride ID / ...    <- field LABELS come after the values
//   Selected Price
//   ₹ <amount>                       <- no "Total", usually no decimals
//   <DROP address>                   <- destination, between price and disclaimer
//   This document is issued on request ...        <- disclaimer line 1
//   *Selected Price refers to ... estimated price range   <- disclaimer line 2
//   <PICKUP address>                 <- origin, the trailing block
//
// There are NO "Pickup:" / "Drop:" labels — addresses are positional.

export interface RapidoReceipt {
  rideId: string | null; // e.g. "RD17824462113883087" — globally unique, use for dedup
  amount: number; // 0 if not found
  /** ISO timestamp of the ride, or null if the date couldn't be parsed */
  tripDateISO: string | null;
  /** Calendar date "YYYY-MM-DD" (timezone-stable), or null. Use this for the `date` column. */
  tripDate: string | null;
  pickup: string | null; // origin
  drop: string | null; // destination
}

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

const ANCHOR_DISCLAIMER = "This document is issued";
const ANCHOR_PRICE_NOTE = "estimated price range";

/** Collapse internal whitespace/newlines and trim. */
function clean(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/**
 * "Jun 26th 2026, 9:33 AM" -> Date (built as UTC from the wall-clock components,
 * so the calendar date is timezone-stable regardless of where this runs).
 * Handles ordinal suffixes and the missing comma before the year.
 */
export function parseRapidoDate(raw: string): Date | null {
  const m = raw.match(
    /\b([A-Za-z]{3,9})\s+(\d{1,2})(?:st|nd|rd|th)?\s+(\d{4}),?\s+(\d{1,2}):(\d{2})\s*(AM|PM)?/i
  );
  if (!m) return null;
  const month = MONTHS[m[1].slice(0, 3).toLowerCase()];
  if (month === undefined) return null;
  const day = parseInt(m[2], 10);
  const year = parseInt(m[3], 10);
  let hour = parseInt(m[4], 10);
  const minute = parseInt(m[5], 10);
  const ampm = m[6]?.toUpperCase();
  if (ampm === "PM" && hour < 12) hour += 12;
  if (ampm === "AM" && hour === 12) hour = 0;
  return new Date(Date.UTC(year, month, day, hour, minute));
}

export function parseRapidoReceipt(text: string): RapidoReceipt {
  const result: RapidoReceipt = {
    rideId: null,
    amount: 0,
    tripDateISO: null,
    tripDate: null,
    pickup: null,
    drop: null,
  };

  if (!text) return result;

  // ── Ride ID (the dedup key) ──
  const rideIdMatch = text.match(/\bRD\d{6,}\b/);
  if (rideIdMatch) result.rideId = rideIdMatch[0];

  // ── Amount ── "₹ 40" / "₹ 1,234.50"
  const amountMatch = text.match(/₹\s*([\d,]+(?:\.\d+)?)/);
  if (amountMatch) result.amount = parseFloat(amountMatch[1].replace(/,/g, ""));

  // ── Date/time ── "Jun 26th 2026, 9:33 AM"
  const dateMatch = text.match(
    /\b([A-Za-z]{3,9}\s+\d{1,2}(?:st|nd|rd|th)?\s+\d{4},?\s+\d{1,2}:\d{2}\s*(?:AM|PM))/i
  );
  if (dateMatch) {
    const d = parseRapidoDate(dateMatch[1]);
    if (d) {
      result.tripDateISO = d.toISOString();
      result.tripDate = d.toISOString().slice(0, 10); // "YYYY-MM-DD"
    }
  }

  // ── Locations (positional) ──
  // DROP: everything between the amount line and the disclaimer.
  if (amountMatch) {
    const afterAmount = text.slice((amountMatch.index ?? 0) + amountMatch[0].length);
    const discIdx = afterAmount.indexOf(ANCHOR_DISCLAIMER);
    if (discIdx > 0) {
      const drop = clean(afterAmount.slice(0, discIdx));
      if (drop) result.drop = drop;
    }
  }

  // PICKUP: the trailing block after the "...estimated price range" note.
  const noteIdx = text.indexOf(ANCHOR_PRICE_NOTE);
  if (noteIdx >= 0) {
    const pickup = clean(text.slice(noteIdx + ANCHOR_PRICE_NOTE.length));
    if (pickup) result.pickup = pickup;
  }

  return result;
}
