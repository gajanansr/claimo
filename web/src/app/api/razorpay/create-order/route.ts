import { NextRequest, NextResponse } from "next/server";
import Razorpay from "razorpay";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let couponCode = "";
    let planType = "monthly";
    try {
      const body = await req.json();
      couponCode = body.couponCode;
      planType = body.planType || "monthly";
    } catch (e) {
      // ignore JSON parse error if body is empty
    }

    if (!process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return NextResponse.json({ error: "Razorpay credentials not configured" }, { status: 500 });
    }

    const planId = planType === "quarterly" ? process.env.RAZORPAY_PLAN_ID_QUARTERLY : process.env.RAZORPAY_PLAN_ID_MONTHLY;

    if (!planId) {
      return NextResponse.json({ error: `Razorpay Plan ID not configured for ${planType} plan in .env.local` }, { status: 500 });
    }

    const razorpay = new Razorpay({
      key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    // Subscriptions use a Plan ID instead of a dynamic amount
    const options: any = {
      plan_id: planId,
      customer_notify: 1,
      total_count: planType === "quarterly" ? 12 : 12, // 12 cycles (3 years for quarterly, 1 year for monthly)
    };

    // If it's the first month welcome offer, apply the Razorpay Offer ID
    if (couponCode === "FIRSTMONTH" && process.env.RAZORPAY_OFFER_ID_FIRST_MONTH) {
      options.offer_id = process.env.RAZORPAY_OFFER_ID_FIRST_MONTH;
    }

    const subscription = await razorpay.subscriptions.create(options);

    return NextResponse.json(subscription);
  } catch (err: any) {
    console.error("Razorpay order creation error:", err);
    const errorMessage = err instanceof Error ? err.message : JSON.stringify(err);
    return NextResponse.json({ error: "Failed to create order", details: errorMessage }, { status: 500 });
  }
}
