"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FileText, Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ProPlanDialog } from "./pro-plan-dialog";

const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function GenerateReportDialog() {
  const [open, setOpen] = useState(false);
  const [generating, setGen] = useState(false);
  const [selectedMonth, setMon] = useState(months[new Date().getMonth()]);
  const [selectedYear, setYear] = useState(new Date().getFullYear().toString());
  const [locations, setLocations] = useState<{id: string, label: string}[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>("");
  const [showProPlan, setShowProPlan] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (open) {
      fetch("/api/locations")
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setLocations(data);
        })
        .catch(() => {});
    }
  }, [open]);

  const handleGenerate = async () => {
    setGen(true);
    try {
      const monthIndex = months.indexOf(selectedMonth) + 1;
      const bodyData: any = { month: monthIndex, year: parseInt(selectedYear) };
      if (selectedLocation) bodyData.locationTag = selectedLocation;

      const res = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyData)
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
      
      toast.success(`Report generation for ${selectedMonth} ${selectedYear} started! It will appear shortly.`);
      setOpen(false);
      router.refresh();
    } catch (err) {
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
            Choose a month and year to generate your reimbursement PDF.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Month picker */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">Month</label>
            <div className="grid grid-cols-3 gap-1.5">
              {months.map((m) => (
                <button
                  key={m}
                  onClick={() => setMon(m)}
                  className={`px-2 py-1.5 rounded-md text-[12px] font-medium border transition-all
                    ${selectedMonth === m
                      ? "bg-zinc-100 text-zinc-950 border-zinc-200"
                      : "border-zinc-800 text-zinc-500 hover:text-zinc-200 hover:border-zinc-700"
                    }`}
                >
                  {m.slice(0, 3)}
                </button>
              ))}
            </div>
          </div>

          {/* Year picker */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">Year</label>
            <div className="flex gap-1.5">
              {[(new Date().getFullYear() - 1).toString(), new Date().getFullYear().toString()].map((y) => (
                <button
                  key={y}
                  onClick={() => setYear(y)}
                  className={`flex-1 py-1.5 rounded-md text-[13px] font-medium border transition-all
                    ${selectedYear === y
                      ? "bg-zinc-100 text-zinc-950 border-zinc-200"
                      : "border-zinc-800 text-zinc-500 hover:text-zinc-200 hover:border-zinc-700"
                    }`}
                >
                  {y}
                </button>
              ))}
            </div>
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

          <Button
            onClick={handleGenerate}
            disabled={generating}
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
                Generate {selectedMonth.slice(0, 3)} {selectedYear}
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
