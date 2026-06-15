"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FileText, Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function GenerateReportDialog() {
  const [open, setOpen] = useState(false);
  const [generating, setGen] = useState(false);
  const [selectedMonth, setMon] = useState(months[new Date().getMonth()]);
  const [selectedYear, setYear] = useState(new Date().getFullYear().toString());
  const router = useRouter();

  const handleGenerate = async () => {
    setGen(true);
    try {
      const monthIndex = months.indexOf(selectedMonth) + 1;
      const res = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: monthIndex, year: parseInt(selectedYear) })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        toast.error(data.error || "Failed to generate report.");
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

      <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-100 rounded-xl shadow-2xl max-w-sm">
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
    </Dialog>
  );
}
