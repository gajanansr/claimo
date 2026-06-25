import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { razorpay_subscription_id, razorpay_payment_id, razorpay_signature } = await req.json();

    if (!razorpay_subscription_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json({ error: "Missing Razorpay parameters" }, { status: 400 });
    }

    if (!process.env.RAZORPAY_KEY_SECRET) {
      return NextResponse.json({ error: "Razorpay secret not configured" }, { status: 500 });
    }

    // Verify signature
    // The signature for a subscription is: hmac_sha256(razorpay_payment_id + "|" + razorpay_subscription_id, secret)
    const body = razorpay_payment_id + "|" + razorpay_subscription_id;
    
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return NextResponse.json({ error: "Invalid payment signature" }, { status: 400 });
    }

    // Update user profile to mark them as a pro user
    // (This requires an is_pro boolean column on the profiles table)
    const { error } = await supabase
      .from("profiles")
      .update({ is_pro: true })
      .eq("id", session.user.id);

    if (error) {
      console.error("Error updating profile to pro:", error);
      // Could still return success since payment is verified, but maybe we want to log it well
    }

    return NextResponse.json({ success: true, message: "Payment verified successfully" });
  } catch (err: any) {
    console.error("Razorpay verification error:", err);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
