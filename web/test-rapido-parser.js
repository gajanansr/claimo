// Offline test for the Rapido PDF parser.
// Runs the real parser over every saved receipt text in web/debug-output/
// (captured via /api/debug-rapido) and reports anything that fails to parse.
//
//   npx tsx test-rapido-parser.js
//
// Strategy:
//   1. A few hardcoded known-value assertions (TDD: must match exactly).
//   2. Bulk run over all saved PDFs, flagging null ride_id/date/pickup/drop
//      and checking that ride_ids are unique (the dedup invariant).

const fs = require("fs");
const path = require("path");
const { parseRapidoReceipt } = require("./src/lib/rapido-parser.ts");

const DIR = path.join(__dirname, "debug-output");

// ── 1. Known-value assertions ────────────────────────────────────────
const KNOWN = `

Gajanan Rathod
RD17824462113883087
Satyabratasahu
KA53JB4487
Jun 26th 2026, 9:33 AM
Booking History
Customer Name
Ride ID
Driver name
Vehicle Number
Time of Ride
Selected Price
₹ 40
Gas Plant, Rd Number 2, EPIP Zone, Whitefield, Bengaluru, Karnataka 560066, India
This document is issued on request by the passenger. Rapido does not collect any fee/commission from passengers and shall not issue tax
invoices to the passengers under this segment. The document may be used for all official / reimbursement purposes.
*Selected Price refers to the initial price decided between User and Drivers from the estimated price range
hospital, 2nd Main Rd, near MAHAVEER TRANQUIL, behind VYDEHI INSTITUTE OF
MEDICAL SCIENCES, Nallurhalli, Whitefield, Bengaluru, Karnataka 560066, India`;

let failures = 0;
const assert = (name, actual, expected) => {
  if (actual !== expected) {
    failures++;
    console.error(`  ✗ ${name}\n      expected: ${JSON.stringify(expected)}\n      actual:   ${JSON.stringify(actual)}`);
  } else {
    console.log(`  ✓ ${name}`);
  }
};

console.log("Known-value assertions:");
const k = parseRapidoReceipt(KNOWN);
assert("rideId", k.rideId, "RD17824462113883087");
assert("amount", k.amount, 40);
assert("date (calendar)", k.tripDateISO && k.tripDateISO.slice(0, 10), "2026-06-26");
assert("drop", k.drop, "Gas Plant, Rd Number 2, EPIP Zone, Whitefield, Bengaluru, Karnataka 560066, India");
assert(
  "pickup",
  k.pickup,
  "hospital, 2nd Main Rd, near MAHAVEER TRANQUIL, behind VYDEHI INSTITUTE OF MEDICAL SCIENCES, Nallurhalli, Whitefield, Bengaluru, Karnataka 560066, India"
);

// ── 2. Bulk run over saved PDFs ──────────────────────────────────────
const files = fs.existsSync(DIR)
  ? fs.readdirSync(DIR).filter((f) => /_pdf\d+\.txt$/.test(f))
  : [];

console.log(`\nBulk run over ${files.length} saved PDFs:\n`);

const seenRideIds = new Map();
let nullRideId = 0, nullDate = 0, nullPickup = 0, nullDrop = 0, zeroAmount = 0, dupRideId = 0;

for (const f of files) {
  const raw = fs.readFileSync(path.join(DIR, f), "utf-8");
  // Saved files start with "FILENAME: ...\nBYTES: ...\n\n<text>"
  const text = raw.replace(/^FILENAME:.*\nBYTES:.*\n\n/, "");
  const r = parseRapidoReceipt(text);

  const flags = [];
  if (!r.rideId) { nullRideId++; flags.push("NO_RIDE_ID"); }
  if (!r.tripDateISO) { nullDate++; flags.push("NO_DATE"); }
  if (!r.pickup) { nullPickup++; flags.push("NO_PICKUP"); }
  if (!r.drop) { nullDrop++; flags.push("NO_DROP"); }
  if (!r.amount) { zeroAmount++; flags.push("ZERO_AMOUNT"); }

  if (r.rideId) {
    if (seenRideIds.has(r.rideId)) { dupRideId++; flags.push("DUP_RIDE_ID(expected across emails)"); }
    seenRideIds.set(r.rideId, (seenRideIds.get(r.rideId) || 0) + 1);
  }

  const date = r.tripDateISO ? r.tripDateISO.slice(0, 16).replace("T", " ") : "????";
  const line = `${(r.rideId || "????").padEnd(20)} ${date}  ₹${String(r.amount).padEnd(5)} ${(r.pickup || "??").slice(0, 32).padEnd(34)} → ${(r.drop || "??").slice(0, 32)}`;
  console.log(`  ${flags.length ? "⚠ " : "  "}${line}${flags.length ? "   [" + flags.join(",") + "]" : ""}`);
}

console.log(`\nSummary:`);
console.log(`  PDFs parsed:        ${files.length}`);
console.log(`  Unique ride IDs:    ${seenRideIds.size}   <- this is your true ride count`);
console.log(`  Duplicate-in-files: ${dupRideId}   <- same ride across individual+bulk emails (dedup will collapse these)`);
console.log(`  Missing ride_id:    ${nullRideId}`);
console.log(`  Missing date:       ${nullDate}`);
console.log(`  Missing pickup:     ${nullPickup}`);
console.log(`  Missing drop:       ${nullDrop}`);
console.log(`  Zero amount:        ${zeroAmount}`);

if (failures > 0) {
  console.error(`\n✗ ${failures} known-value assertion(s) failed`);
  process.exit(1);
}
if (nullRideId || nullDate || nullPickup || nullDrop || zeroAmount) {
  console.error(`\n⚠ Some PDFs did not fully parse (see flags above)`);
  process.exit(1);
}
console.log(`\n✓ All assertions passed and all PDFs parsed cleanly`);
