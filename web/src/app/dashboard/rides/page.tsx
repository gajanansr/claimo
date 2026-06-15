import { createServerSupabaseClient } from "@/lib/supabase-server";
import { RidesClient } from "./rides-client";

export default async function RidesPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch real receipts
  const { data: rawReceipts } = await supabase
    .from("receipts")
    .select("*")
    .eq("user_id", user?.id)
    .order("trip_date", { ascending: false });

  const allRides = rawReceipts || [];

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto animate-fade-in-up">
      <RidesClient initialRides={allRides} />
    </div>
  );
}
