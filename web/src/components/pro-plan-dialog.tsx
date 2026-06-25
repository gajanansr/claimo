"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Check, Loader2, Sparkles, Tag } from "lucide-react";
import { toast } from "sonner";
import Script from "next/script";

interface ProPlanDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ProPlanDialog({ open, onClose, onSuccess }: ProPlanDialogProps) {
  const [loading, setLoading] = useState(false);
  const [coupon, setCoupon] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(false);
  const [isFirstMonth, setIsFirstMonth] = useState(false);
  const [planType, setPlanType] = useState<"monthly" | "quarterly">("monthly");
  
  const finalPrice = planType === "quarterly" ? 299 : (isFirstMonth ? 1 : (appliedCoupon ? 99 : 149));

  const applyCoupon = () => {
    if (coupon.toUpperCase() === "FLAT50") {
      setAppliedCoupon(true);
      toast.success("Coupon applied! ₹50 discount added.");
    } else {
      toast.error("Invalid coupon code");
    }
  };

  const handlePayment = async () => {
    setLoading(true);
    try {
      // 1. Create Subscription on Backend
      const activeCoupon = isFirstMonth ? "FIRSTMONTH" : (appliedCoupon ? "FLAT50" : "");
      const orderRes = await fetch("/api/razorpay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ couponCode: activeCoupon, planType }),
      });
      
      const orderData = await orderRes.json();
      
      if (!orderRes.ok || !orderData.id) {
        throw new Error(orderData.error || "Failed to initiate payment");
      }

      // 2. Open Razorpay Checkout Modal
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        name: "Claimo Pro",
        description: "Pro Subscription",
        subscription_id: orderData.id,
        handler: async function (response: any) {
          try {
            // 3. Verify Payment Signature
            const verifyRes = await fetch("/api/razorpay/verify-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_subscription_id: response.razorpay_subscription_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });
            
            const verifyData = await verifyRes.json();
            
            if (verifyRes.ok && verifyData.success) {
              toast.success("Payment successful! You are now on the Pro plan.");
              onSuccess();
              onClose();
            } else {
              toast.error(verifyData.error || "Payment verification failed");
            }
          } catch (e) {
            toast.error("An error occurred while verifying payment");
          }
        },
        prefill: {
          name: "",
          email: "",
          contact: ""
        },
        theme: {
          color: "#10b981" // Emerald 500
        }
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on('payment.failed', function (response: any){
        toast.error(response.error.description || "Payment failed");
      });
      rzp.open();
      
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100 rounded-xl shadow-2xl w-[calc(100vw-2rem)] max-w-sm overflow-hidden p-0">
          <div className="bg-gradient-to-b from-emerald-900/20 to-transparent px-6 pt-8 pb-6 border-b border-zinc-900 text-center relative overflow-hidden">
            <div className="mx-auto h-12 w-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
              <Sparkles className="h-6 w-6 text-emerald-400" />
            </div>
            <DialogTitle className="text-xl font-bold text-zinc-100 tracking-tight">Claimo Pro</DialogTitle>
            <DialogDescription className="text-zinc-400 mt-2 text-[13px]">
              Unlock auto-sync, advanced analytics, and custom export formats.
            </DialogDescription>
          </div>

          <div className="p-6 space-y-6">
            <ul className="space-y-3 text-[13px] text-zinc-300">
              {["Background receipt auto-sync", "Unlimited manual syncs", "Email notifications", "Custom PDF formats"].map((feat, i) => (
                <li key={i} className="flex items-center gap-2.5">
                  <div className="h-4 w-4 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                    <Check className="h-2.5 w-2.5 text-emerald-400" strokeWidth={3} />
                  </div>
                  {feat}
                </li>
              ))}
            </ul>

            <div className="bg-zinc-900/50 rounded-lg p-3 border border-zinc-800 space-y-3">
              
              {/* Plan Toggle */}
              <div className="flex bg-zinc-950 p-1 rounded-md border border-zinc-800 mb-2">
                <button 
                  className={`flex-1 text-xs py-1.5 rounded transition-colors ${planType === "monthly" ? "bg-zinc-800 text-zinc-100 font-semibold" : "text-zinc-400 hover:text-zinc-300"}`}
                  onClick={() => setPlanType("monthly")}
                >
                  Monthly (₹149)
                </button>
                <button 
                  className={`flex-1 text-xs py-1.5 rounded transition-colors ${planType === "quarterly" ? "bg-zinc-800 text-zinc-100 font-semibold" : "text-zinc-400 hover:text-zinc-300"}`}
                  onClick={() => setPlanType("quarterly")}
                >
                  Quarterly (₹299) <span className="text-emerald-400 font-bold ml-1">SAVE 33%</span>
                </button>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-zinc-400 text-xs">{planType === "monthly" ? "Monthly Plan" : "Quarterly Plan"}</span>
                <span className="text-zinc-100 text-sm font-semibold">{planType === "monthly" ? "₹149" : "₹299"}</span>
              </div>
              
              {planType === "monthly" && isFirstMonth ? (
                <div className="flex items-center justify-between pt-1 border-t border-zinc-800">
                  <span className="text-emerald-400 text-xs flex items-center gap-1 font-semibold">
                    <Sparkles className="h-3 w-3" /> First Month Welcome (99% Off)
                  </span>
                  <span className="text-emerald-400 text-sm font-semibold">-₹148</span>
                </div>
              ) : !appliedCoupon ? (
                <div className="flex items-center gap-2 pt-1">
                  <div className="relative flex-1">
                    <Tag className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
                    <input 
                      type="text" 
                      placeholder="Coupon Code" 
                      value={coupon}
                      onChange={(e) => setCoupon(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded px-8 py-1.5 text-xs text-zinc-200 outline-none focus:border-emerald-500/50 uppercase disabled:opacity-50"
                      disabled={planType === "quarterly"}
                    />
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-8 text-xs px-3 border-zinc-700 bg-zinc-900 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-50"
                    onClick={applyCoupon}
                    disabled={!coupon || planType === "quarterly"}
                  >
                    Apply
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-between pt-1 border-t border-zinc-800">
                  <span className="text-emerald-400 text-xs flex items-center gap-1 font-semibold">
                    <Check className="h-3 w-3" /> {appliedCoupon ? "FLAT50" : ""} Applied
                  </span>
                  <span className="text-emerald-400 text-sm font-semibold">-₹50</span>
                </div>
              )}
              
              <div className="flex items-center justify-between pt-2 border-t border-zinc-800 mt-2">
                <span className="text-zinc-100 text-sm font-bold">Total</span>
                <span className="text-emerald-400 text-lg font-bold">
                  {planType === "quarterly" ? "₹299" : (isFirstMonth ? "₹1" : (appliedCoupon ? "₹99" : "₹149"))}
                </span>
              </div>
            </div>

            <Button 
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-lg shadow-emerald-900/20"
              onClick={handlePayment}
              disabled={loading}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {loading ? "Processing..." : `Pay ₹${finalPrice} Securely`}
            </Button>
            <p className="text-[10px] text-center text-zinc-600 mt-3 flex items-center justify-center gap-1.5">
              <span>Secured by</span>
              <strong className="font-semibold text-zinc-500">Razorpay</strong>
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
