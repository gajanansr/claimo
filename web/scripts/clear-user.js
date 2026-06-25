require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function clearUserData(email) {
  console.log(`Looking up user with email: ${email}`);
  
  // 1. Get user ID from auth.users (requires service_role key)
  const { data: { users }, error: userError } = await supabase.auth.admin.listUsers();
  
  if (userError) {
    console.error("Error fetching users:", userError.message);
    process.exit(1);
  }

  const user = users.find(u => u.email === email);
  if (!user) {
    console.error(`User with email ${email} not found.`);
    process.exit(1);
  }

  const userId = user.id;
  console.log(`Found user: ${userId}`);

  // 2. Clear Database Tables (Order doesn't strictly matter if there are no strict foreign key constraints between them, but profiles cascades to them usually. However, to reset data WITHOUT deleting the account, we delete from tables manually)
  console.log("Clearing receipts...");
  await supabase.from("receipts").delete().eq("user_id", userId);

  console.log("Clearing reports...");
  await supabase.from("reports").delete().eq("user_id", userId);

  console.log("Clearing user_locations...");
  await supabase.from("user_locations").delete().eq("user_id", userId);

  // 3. Clear Storage Buckets
  console.log("Clearing storage bucket: receipts...");
  const { data: receiptFiles } = await supabase.storage.from("receipts").list(userId);
  if (receiptFiles && receiptFiles.length > 0) {
    const filePaths = receiptFiles.map(f => `${userId}/${f.name}`);
    await supabase.storage.from("receipts").remove(filePaths);
    console.log(`Deleted ${filePaths.length} files from receipts bucket.`);
  } else {
    console.log("No receipt files found.");
  }

  console.log("Clearing storage bucket: reports...");
  const { data: reportFiles } = await supabase.storage.from("reports").list(userId);
  if (reportFiles && reportFiles.length > 0) {
    const filePaths = reportFiles.map(f => `${userId}/${f.name}`);
    await supabase.storage.from("reports").remove(filePaths);
    console.log(`Deleted ${filePaths.length} files from reports bucket.`);
  } else {
    console.log("No report files found.");
  }

  console.log("✅ All data (receipts, reports, locations, files) cleared successfully for " + email);
  console.log("Note: The user account and their profile still exist. To delete the user completely, uncomment the last line of this script.");

  // Uncomment to delete the user completely:
  // await supabase.auth.admin.deleteUser(userId);
}

const emailArgs = process.argv.slice(2);
if (emailArgs.length === 0) {
  console.error("Usage: node scripts/clear-user.js <user-email>");
  process.exit(1);
}

clearUserData(emailArgs[0]);
