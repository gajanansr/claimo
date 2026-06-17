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
    try {
      const body = await req.json();
      couponCode = body.couponCode;
    } catch (e) {
      // ignore JSON parse error if body is empty
    }

    let amount = 14900; // 149 INR in paise
    if (couponCode && couponCode.toUpperCase() === "FLAT50") {
      amount = 9900; // 99 INR in paise
    }

    if (!process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return NextResponse.json({ error: "Razorpay credentials not configured" }, { status: 500 });
    }

    const razorpay = new Razorpay({
      key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const options = {
      amount,
      currency: "INR",
      receipt: `rcpt_${session.user.id.substring(0, 8)}_${Date.now()}`
    };

    const order = await razorpay.orders.create(options);

    return NextResponse.json(order);
  } catch (err: any) {
    console.error("Razorpay order creation error:", err);
    const errorMessage = err instanceof Error ? err.message : JSON.stringify(err);
    return NextResponse.json({ error: "Failed to create order", details: errorMessage }, { status: 500 });
  }
}
