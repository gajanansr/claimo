"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SlidersHorizontal, Download, FileText } from "lucide-react";
import { format, parseISO } from "date-fns";

const serviceColor: Record<string, string> = {
  uber: "bg-zinc-200",
  rapido: "bg-yellow-400",
};

const statusConfig = {
  found: { text: "text-emerald-400", border: "border-emerald-900/50", bg: "bg-emerald-950/20" },
  pending: { text: "text-amber-400", border: "border-amber-900/50", bg: "bg-amber-950/20" },
  missing: { text: "text-red-400", border: "border-red-900/50", bg: "bg-red-950/20" },
};

export function RidesClient({ initialRides }: { initialRides: Record<string, unknown>[] }) {
  const [filterService, setFilterService] = useState<string>("All");
  const [filterPending, setFilterPending] = useState<boolean>(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [mounted, setMounted] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => setMounted(true), []);

  // Filter logic
  let filtered = initialRides;
  if (filterService !== "All") {
    filtered = filtered.filter(r => String(r.service).toLowerCase() === filterService.toLowerCase());
  }
  if (filterPending) {
    filtered = filtered.filter(r => r.status === "pending");
  }

  const total = filtered.length;
  const pending = filtered.filter(r => r.status === "pending").length;
  const rawAmount = filtered.reduce((acc, r) => acc + Number(r.amount || 0), 0);
  const formattedAmount = Intl.NumberFormat('en-IN', { notation: "compact", maximumFractionDigits: 1 }).format(rawAmount);

  const handleExport = () => {
    // Generate CSV string
    const headers = ["Date", "Service", "From", "To", "Amount", "Currency", "Status"];
    const rows = filtered.map(r => [
      format(parseISO(String(r.trip_date)), "yyyy-MM-dd"),
      r.service,
      `"${r.from_location || ""}"`,
      `"${r.to_location || ""}"`,
      r.amount,
      r.currency,
      r.status
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `claimo_rides_${format(new Date(), "MMM_yyyy")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch("/api/reports/custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receipt_ids: Array.from(selectedIds) })
      });
      if (!res.ok) throw new Error("Generation failed");
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `claimo_custom_report_${format(new Date(), 'MMM_yyyy')}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("Failed to generate report. Make sure the PDF microservice is running.");
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(r => String(r.id))));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 tracking-tight">Rides</h1>
          <p className="text-zinc-500 text-sm mt-0.5">All synced receipts</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={handleExport} className="bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-semibold border-0 rounded-lg shadow-sm text-[13px] h-8 px-3">
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* ── Summary strip ───────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total rides", value: total },
          { label: "Total amount", value: `₹${formattedAmount}` },
          { label: "Pending sync", value: pending, warn: true },
        ].map(({ label, value, warn }) => (
          <div key={label} className="bg-zinc-950 border border-zinc-900 rounded-xl px-5 py-4">
            <p className="text-[11px] uppercase tracking-widest text-zinc-500 font-semibold mb-1">{label}</p>
            <p className={`text-2xl font-bold tracking-tight ${warn && Number(value) > 0 ? "text-amber-400" : "text-zinc-100"}`}>
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* ── Filter row ──────────────────────────────────────────── */}
      <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap scrollbar-hide pb-1">
        <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 border border-zinc-800 rounded-md text-[12px] shrink-0">
          <SlidersHorizontal className="h-3 w-3" />
          Filter
        </Button>

        {(["All", "uber", "rapido"] as const).map((s) => (
          <Button
            key={s}
            onClick={() => setFilterService(s)}
            variant="ghost"
            size="sm"
            className={`h-7 px-3 text-[12px] rounded-md border transition-all capitalize shrink-0
              ${filterService === s
                ? "bg-zinc-900 border-zinc-700 text-zinc-200"
                : "border-zinc-800 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900"
              }`}
          >
            {s !== "All" && (
              <span className={`h-1.5 w-1.5 rounded-full mr-1.5 ${serviceColor[s]}`} />
            )}
            {s}
          </Button>
        ))}

        <Button
          onClick={() => setFilterPending(!filterPending)}
          variant="ghost"
          size="sm"
          className={`h-7 px-3 text-[12px] rounded-md border transition-all ml-auto shrink-0
            ${filterPending
              ? "bg-zinc-900 border-zinc-700 text-zinc-200"
              : "border-zinc-800 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900"
            }`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400 mr-1.5" />
          Pending only
        </Button>
      </div>

      {/* ── Ride table ──────────────────────────────────────────── */}
      <div className="bg-zinc-950 border border-zinc-900 rounded-xl overflow-hidden shadow-sm overflow-x-auto">
        <Table className="min-w-[600px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent border-zinc-900/80">
              <TableHead className="w-12 pl-5">
                <button
                  onClick={toggleSelectAll}
                  className={`h-4 w-4 rounded border transition-all inline-flex items-center justify-center
                    ${selectedIds.size === filtered.length && filtered.length > 0
                      ? "bg-emerald-500 border-emerald-500 text-zinc-950"
                      : "border-zinc-700 hover:border-zinc-500 text-transparent"
                    }`}
                >
                  <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </TableHead>
              <TableHead className="text-zinc-600 font-semibold text-[10px] uppercase tracking-widest">Date</TableHead>
              <TableHead className="text-zinc-600 font-semibold text-[10px] uppercase tracking-widest">Service</TableHead>
              <TableHead className="text-zinc-600 font-semibold text-[10px] uppercase tracking-widest">Route</TableHead>
              <TableHead className="text-zinc-600 font-semibold text-[10px] uppercase tracking-widest">Amount</TableHead>
              <TableHead className="text-zinc-600 font-semibold text-[10px] uppercase tracking-widest pr-5">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length > 0 ? filtered.map((ride) => {
              const status = String(ride.status);
              const sc = statusConfig[status as keyof typeof statusConfig] || statusConfig["pending"];
              return (
                <TableRow key={String(ride.id)} className="border-zinc-900/60 hover:bg-zinc-900/20 transition-colors cursor-default">
                  <TableCell className="pl-5 py-3">
                    <button
                      onClick={() => toggleSelect(String(ride.id))}
                      className={`h-4 w-4 rounded border transition-all inline-flex items-center justify-center
                        ${selectedIds.has(String(ride.id))
                          ? "bg-emerald-500 border-emerald-500 text-zinc-950"
                          : "border-zinc-700 hover:border-zinc-500 text-transparent"
                        }`}
                    >
                      <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </TableCell>
                  <TableCell className="text-zinc-400 text-[13px] py-3">
                    {format(parseISO(String(ride.trip_date)), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="flex items-center gap-2">
                      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${serviceColor[String(ride.service)] ?? "bg-zinc-500"}`} />
                      <span className="text-zinc-200 text-[13px] font-medium capitalize">{String(ride.service)}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="text-zinc-500 text-[12px] whitespace-nowrap overflow-x-auto block max-w-[150px] scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent pb-1">
                      {String(ride.from_location || "Unknown")} <span className="text-zinc-700 mx-1">→</span> {String(ride.to_location || "Unknown")}
                    </div>
                  </TableCell>
                  <TableCell className="text-zinc-100 text-[13px] font-semibold py-3">
                    ₹{Number(ride.amount).toFixed(2)}
                  </TableCell>
                  <TableCell className="pr-5 py-3">
                    <Badge variant="outline" className={`${sc.text} ${sc.border} ${sc.bg} font-normal text-[11px] px-2 py-0.5 rounded capitalize`}>
                      {status === 'found' ? 'Receipt Found' : status}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            }) : (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-zinc-500 text-sm">
                  No rides match your filter.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* Footer */}
        <div className="border-t border-zinc-900/80 px-5 py-3 flex items-center justify-between">
          <span className="text-[11px] text-zinc-600">{total} rides shown · ₹{formattedAmount} total</span>
          <div className="flex items-center gap-3">
            {[["Uber", "bg-zinc-200"], ["Rapido", "bg-yellow-400"]].map(([name, color]) => (
              <div key={name} className="flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
                <span className="text-[10px] text-zinc-600">{name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Floating Generate Report Button */}
      {mounted && selectedIds.size > 0 && createPortal(
        <div className="fixed bottom-20 md:bottom-8 right-4 md:right-8 z-[100] animate-in fade-in slide-in-from-bottom-4 duration-300">
          <Button 
            onClick={handleGenerateReport} 
            disabled={isGenerating}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold border-0 rounded-full shadow-lg shadow-emerald-900/20 px-4 h-9 text-[13px] flex items-center gap-1.5 transition-all"
          >
            {isGenerating ? (
              <svg className="animate-spin h-3.5 w-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            ) : (
              <FileText className="h-3.5 w-3.5" />
            )}
            <span>{isGenerating ? "Generating..." : `Generate Report (${selectedIds.size})`}</span>
          </Button>
        </div>,
        document.body
      )}
    </div>
  );
}
