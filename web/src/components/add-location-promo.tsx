"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { LocationPicker } from "@/components/location-picker";
import { useRouter } from "next/navigation";

export function AddLocationPromo() {
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const router = useRouter();

  const handleAdd = () => {
    // When a location is added, refresh the server component to hide the promo
    router.refresh();
  };

  return (
    <>
      <Card className="bg-emerald-950/20 border-emerald-900/40 rounded-xl shadow-sm relative overflow-hidden group order-3 sm:order-4 sm:col-span-3">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="shrink-0 whitespace-nowrap text-[10px] font-bold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                Pro Feature
              </span>
              <h3 className="text-[15px] font-bold text-zinc-100 leading-tight">Auto-tag Office Commutes</h3>
            </div>
            <p className="text-[13px] text-zinc-400 max-w-xl leading-relaxed mt-1">
              Tired of sorting rides? Add your Home and Office locations to automatically tag rides and filter them with one click during report generation.
            </p>
          </div>
          <button
            onClick={() => setShowLocationPicker(true)}
            className="w-full sm:w-auto mt-1 sm:mt-0 shrink-0 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[13px] h-9 px-4 rounded-lg flex items-center justify-center transition-colors shadow-sm shadow-emerald-900/20"
          >
            Add Locations
          </button>
        </CardContent>
      </Card>

      {showLocationPicker && (
        <LocationPicker
          onClose={() => setShowLocationPicker(false)}
          onAdd={handleAdd}
        />
      )}
    </>
  );
}
