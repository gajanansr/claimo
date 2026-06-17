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

  const finalPrice = appliedCoupon ? 99 : 149;

  const handleApplyCoupon = () => {
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
      // 1. Create Order on Backend
      const orderRes = await fetch("/api/razorpay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ couponCode: appliedCoupon ? "FLAT50" : "" }),
      });
      
      const orderData = await orderRes.json();
      
      if (!orderRes.ok || !orderData.id) {
        throw new Error(orderData.error || "Failed to initiate payment");
      }

      // 2. Open Razorpay Checkout Modal
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "Claimo Pro",
        description: "1 Month Pro Subscription",
        order_id: orderData.id,
        handler: async function (response: any) {
          try {
            // 3. Verify Payment Signature
            const verifyRes = await fetch("/api/razorpay/verify-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
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
              <div className="flex items-center justify-between">
                <span className="text-zinc-400 text-xs">Monthly Plan</span>
                <span className="text-zinc-100 text-sm font-semibold">₹149</span>
              </div>
              
              {!appliedCoupon && (
                <div className="flex items-center gap-2 pt-1">
                  <div className="relative flex-1">
                    <Tag className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
                    <input 
                      type="text" 
                      placeholder="Coupon Code" 
                      value={coupon}
                      onChange={(e) => setCoupon(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded px-8 py-1.5 text-xs text-zinc-200 outline-none focus:border-emerald-500/50 uppercase"
                    />
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleApplyCoupon}
                    className="h-[30px] px-3 text-xs bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-800"
                  >
                    Apply
                  </Button>
                </div>
              )}

              {appliedCoupon && (
                <div className="flex items-center justify-between pt-1 border-t border-zinc-800">
                  <span className="text-emerald-400 text-xs flex items-center gap-1">
                    <Tag className="h-3 w-3" /> FLAT50 Applied
                  </span>
                  <span className="text-emerald-400 text-sm font-semibold">-₹50</span>
                </div>
              )}
              
              <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
                <span className="text-zinc-200 text-sm font-medium">Total due</span>
                <span className="text-emerald-400 text-lg font-bold">₹{finalPrice}</span>
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
