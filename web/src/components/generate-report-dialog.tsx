"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FileText, Loader2, Plus, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ProPlanDialog } from "./pro-plan-dialog";
import { createClient } from "@/lib/supabase";

type Preset = "this_month" | "last_month" | "last_3_months" | "custom";

const PRESETS: { value: Preset; label: string }[] = [
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "last_3_months", label: "Last 3 months" },
  { value: "custom", label: "Custom range" },
];

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function GenerateReportDialog() {
  const [open, setOpen] = useState(false);
  const [generating, setGen] = useState(false);
  const [preset, setPreset] = useState<Preset>("this_month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [locations, setLocations] = useState<{ id: string; label: string }[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>("");
  const [mode, setMode] = useState<"full" | "receipts">("full");
  const [showProPlan, setShowProPlan] = useState(false);
  const [tripCount, setTripCount] = useState<number | null>(null);
  const router = useRouter();
  const supabase = createClient();

  // Resolve the selected preset to an inclusive [start, end] date range.
  const getRange = (): { start: string; end: string } | null => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    switch (preset) {
      case "this_month":
        return { start: ymd(new Date(y, m, 1)), end: ymd(new Date(y, m + 1, 0)) };
      case "last_month":
        return { start: ymd(new Date(y, m - 1, 1)), end: ymd(new Date(y, m, 0)) };
      case "last_3_months":
        return { start: ymd(new Date(y, m - 2, 1)), end: ymd(new Date(y, m + 1, 0)) };
      case "custom":
        return customStart && customEnd ? { start: customStart, end: customEnd } : null;
    }
  };
  const range = getRange();

  useEffect(() => {
    if (open) {
      fetch("/api/locations")
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) setLocations(data);
        })
        .catch(() => {});
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let isMounted = true;

    const fetchCount = async () => {
      const r = getRange();
      if (!r) {
        if (isMounted) setTripCount(null);
        return;
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let query = supabase
        .from("receipts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("trip_date", r.start)
        .lte("trip_date", r.end);

      if (selectedLocation) {
        query = query.ilike("location_tag", `%${selectedLocation}%`);
      }

      const { count } = await query;
      if (isMounted) setTripCount(count || 0);
    };

    fetchCount();
    return () => { isMounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, customStart, customEnd, selectedLocation, open, supabase]);

  const handleGenerate = async () => {
    if (!range) {
      toast.error("Please pick a start and end date.");
      return;
    }
    if (range.start > range.end) {
      toast.error("Start date must be before end date.");
      return;
    }
    setGen(true);
    try {
      const bodyData = {
        startDate: range.start,
        endDate: range.end,
        mode,
        ...(selectedLocation ? { locationTag: selectedLocation } : {}),
      };

      const res = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyData),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 403) {
          toast.error(data.error);
          setShowProPlan(true);
        } else {
          toast.error(data.error || "Failed to generate report.");
        }
        return;
      }

      toast.success("Report generated!");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Network error occurred.");
    } finally {
      setGen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex items-center gap-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-semibold rounded-lg shadow-sm text-[13px] h-8 px-3 transition-colors">
        <Plus className="h-3.5 w-3.5" />
        Report
      </DialogTrigger>

      <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100 rounded-xl shadow-2xl w-[calc(100vw-2rem)] max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-[17px] font-bold text-zinc-100">Generate Report</DialogTitle>
          <DialogDescription className="text-zinc-500 text-sm">
            Pick a date range to generate your reimbursement PDF.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Date range presets */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">Date Range</label>
            <div className="grid grid-cols-2 gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPreset(p.value)}
                  className={`px-2 py-1.5 rounded-md text-[12px] font-medium border transition-all
                    ${preset === p.value
                      ? "bg-zinc-100 text-zinc-950 border-zinc-200"
                      : "border-zinc-800 text-zinc-500 hover:text-zinc-200 hover:border-zinc-700"
                    }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {preset === "custom" ? (
              <div className="grid grid-cols-2 gap-1.5 pt-1">
                <div className="space-y-1">
                  <span className="text-[10px] text-zinc-600">From</span>
                  <input
                    type="date"
                    value={customStart}
                    max={customEnd || new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-md px-2 py-1.5 text-[12px] outline-none focus:border-emerald-500/50 transition-colors"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-zinc-600">To</span>
                  <input
                    type="date"
                    value={customEnd}
                    min={customStart || undefined}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-md px-2 py-1.5 text-[12px] outline-none focus:border-emerald-500/50 transition-colors"
                  />
                </div>
              </div>
            ) : (
              range && (
                <p className="text-[11px] text-zinc-600 pt-0.5">
                  {range.start} &rarr; {range.end}
                </p>
              )
            )}
          </div>

          {/* Location filter (optional) */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">Filter by Location</label>
            <div className="flex gap-1.5 flex-wrap">
              <button
                onClick={() => setSelectedLocation("")}
                className={`px-3 py-1.5 rounded-md text-[12px] font-medium border transition-all flex-1
                  ${selectedLocation === ""
                    ? "bg-zinc-100 text-zinc-950 border-zinc-200"
                    : "border-zinc-800 text-zinc-500 hover:text-zinc-200 hover:border-zinc-700"
                  }`}
              >
                All Trips
              </button>
              {locations.map((loc) => (
                <button
                  key={loc.id}
                  onClick={() => setSelectedLocation(loc.label)}
                  className={`px-3 py-1.5 rounded-md text-[12px] font-medium border transition-all flex-1
                    ${selectedLocation === loc.label
                      ? "bg-emerald-950/50 text-emerald-400 border-emerald-800/60"
                      : "border-zinc-800 text-zinc-500 hover:text-zinc-200 hover:border-zinc-700"
                    }`}
                >
                  {loc.label} Only
                </button>
              ))}
            </div>
          </div>

          {/* PDF contents toggle */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">PDF Contents</label>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => setMode("full")}
                className={`px-2 py-2 rounded-md text-[12px] font-medium border transition-all text-left
                  ${mode === "full"
                    ? "bg-zinc-100 text-zinc-950 border-zinc-200"
                    : "border-zinc-800 text-zinc-500 hover:text-zinc-200 hover:border-zinc-700"
                  }`}
              >
                Report + Receipts
                <span className="block text-[10px] font-normal mt-0.5 text-zinc-600">
                  Summary page, then receipts
                </span>
              </button>
              <button
                onClick={() => setMode("receipts")}
                className={`px-2 py-2 rounded-md text-[12px] font-medium border transition-all text-left
                  ${mode === "receipts"
                    ? "bg-zinc-100 text-zinc-950 border-zinc-200"
                    : "border-zinc-800 text-zinc-500 hover:text-zinc-200 hover:border-zinc-700"
                  }`}
              >
                Receipts only
                <span className="block text-[10px] font-normal mt-0.5 text-zinc-600">
                  No summary page
                </span>
              </button>
            </div>
          </div>

          {/* Trip count preview */}
          {tripCount !== null && (
            <div className="flex items-center justify-between px-3 py-2.5 bg-emerald-950/20 border border-emerald-900/40 rounded-lg">
              <span className="text-[12px] font-medium text-emerald-400">
                {tripCount} {tripCount === 1 ? "trip" : "trips"} found matching criteria
              </span>
              <Link
                href="/dashboard/rides"
                onClick={() => setOpen(false)}
                className="text-[11px] font-semibold text-emerald-300 hover:text-emerald-200 flex items-center gap-1 transition-colors"
              >
                Review <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          )}

          <Button
            onClick={handleGenerate}
            disabled={generating || !range}
            className="w-full bg-zinc-100 hover:bg-zinc-200 disabled:bg-zinc-800 text-zinc-950 disabled:text-zinc-500 font-semibold rounded-lg h-9 text-[13px] transition-all"
          >
            {generating ? (
              <>
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <FileText className="mr-2 h-3.5 w-3.5" />
                Generate Report
              </>
            )}
          </Button>
        </div>
      </DialogContent>
      <ProPlanDialog
        open={showProPlan}
        onClose={() => setShowProPlan(false)}
        onSuccess={() => {
          setShowProPlan(false);
          toast.success("Pro plan activated! You can now generate your report.");
        }}
      />
    </Dialog>
  );
}
