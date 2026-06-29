// Backfill the `address` column on user_locations for a single user.
// Saved locations created before the address column existed only have
// lat/lng — this reverse-geocodes them to a full address.
//
// Usage (from the web/ directory):
//   node scripts/backfill-location-address.js you@example.com
//   node scripts/backfill-location-address.js you@example.com --all   # overwrite existing addresses too
//
// Requires in .env.local:
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY   (service role — needed to bypass RLS on update)
//   GOOGLE_MAPS_API_KEY         (must have the Geocoding API enabled)

require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const mapsKey = process.env.GOOGLE_MAPS_API_KEY;

const email = process.argv[2];
const overwrite = process.argv.includes("--all");

if (!email) {
  console.error("Usage: node scripts/backfill-location-address.js <email> [--all]");
  process.exit(1);
}
if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}
if (!mapsKey) {
  console.error("Missing GOOGLE_MAPS_API_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function reverseGeocode(lat, lng) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${mapsKey}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.status === "OK" && data.results && data.results.length > 0) {
    return data.results[0].formatted_address;
  }
  throw new Error(`Geocode failed: ${data.status}${data.error_message ? " — " + data.error_message : ""}`);
}

async function main() {
  // 1. Resolve user id from email (service_role can list auth users)
  const { data: { users }, error: userErr } = await supabase.auth.admin.listUsers();
  if (userErr) {
    console.error("Error listing users:", userErr.message);
    process.exit(1);
  }
  const user = users.find((u) => u.email === email);
  if (!user) {
    console.error(`User with email ${email} not found.`);
    process.exit(1);
  }
  console.log(`User: ${email} (${user.id})`);

  // 2. Fetch this user's saved locations
  const { data: locations, error: locErr } = await supabase
    .from("user_locations")
    .select("id, label, lat, lng, address")
    .eq("user_id", user.id);

  if (locErr) {
    console.error("Error fetching locations:", locErr.message);
    process.exit(1);
  }
  if (!locations || locations.length === 0) {
    console.log("No saved locations for this user.");
    return;
  }

  const targets = locations.filter((l) => overwrite || !l.address);
  console.log(`${locations.length} location(s); ${targets.length} to update${overwrite ? " (overwrite)" : ""}.\n`);

  let updated = 0;
  let failed = 0;
  for (const loc of targets) {
    try {
      const address = await reverseGeocode(loc.lat, loc.lng);
      const { error: updErr } = await supabase
        .from("user_locations")
        .update({ address })
        .eq("id", loc.id);
      if (updErr) throw new Error(updErr.message);
      console.log(`✓ ${loc.label.padEnd(12)} → ${address}`);
      updated++;
    } catch (e) {
      console.error(`✗ ${loc.label.padEnd(12)} → ${e.message}`);
      failed++;
    }
    await sleep(150); // be gentle with the Geocoding API
  }

  console.log(`\nDone. Updated ${updated}, failed ${failed}, skipped ${locations.length - targets.length}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
