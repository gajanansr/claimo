import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDb() {
  const { data, error } = await supabase.from("receipts").select("id, service, raw_email_snippet").limit(10);
  if (error) {
    console.error("Error:", error);
    return;
  }
  if (data) {
    for (const r of data) {
      console.log(`ID: ${r.id}, Service: ${r.service}, HTML Length: ${r.raw_email_snippet?.length || 0}`);
    }
  }
}

checkDb();
