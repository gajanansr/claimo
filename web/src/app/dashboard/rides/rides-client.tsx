"use client";

import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SlidersHorizontal, Download } from "lucide-react";
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

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 tracking-tight">Rides</h1>
          <p className="text-zinc-500 text-sm mt-0.5">All synced receipts</p>
        </div>
        <Button onClick={handleExport} className="bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-semibold border-0 rounded-lg shadow-sm text-[13px] h-8 px-3">
          <Download className="mr-1.5 h-3.5 w-3.5" />
          Export CSV
        </Button>
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
              <TableHead className="text-zinc-600 font-semibold text-[10px] uppercase tracking-widest pl-5">Date</TableHead>
              <TableHead className="text-zinc-600 font-semibold text-[10px] uppercase tracking-widest">Service</TableHead>
              <TableHead className="text-zinc-600 font-semibold text-[10px] uppercase tracking-widest">Route</TableHead>
              <TableHead className="text-zinc-600 font-semibold text-[10px] uppercase tracking-widest">Amount</TableHead>
              <TableHead className="text-zinc-600 font-semibold text-[10px] uppercase tracking-widest">Status</TableHead>
              <TableHead className="text-zinc-600 font-semibold text-[10px] uppercase tracking-widest text-right pr-5">Reviewed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length > 0 ? filtered.map((ride) => {
              const status = String(ride.status);
              const sc = statusConfig[status as keyof typeof statusConfig] || statusConfig["pending"];
              return (
                <TableRow key={String(ride.id)} className="border-zinc-900/60 hover:bg-zinc-900/20 transition-colors cursor-default">
                  <TableCell className="text-zinc-400 text-[13px] pl-5 py-3">
                    {format(parseISO(String(ride.trip_date)), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="flex items-center gap-2">
                      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${serviceColor[String(ride.service)] ?? "bg-zinc-500"}`} />
                      <span className="text-zinc-200 text-[13px] font-medium capitalize">{String(ride.service)}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-3">
                    <span className="text-zinc-500 text-[12px] block max-w-[150px] truncate">
                      {String(ride.from_location || "Unknown")} <span className="text-zinc-700 mx-1">→</span> {String(ride.to_location || "Unknown")}
                    </span>
                  </TableCell>
                  <TableCell className="text-zinc-100 text-[13px] font-semibold py-3">
                    ₹{Number(ride.amount).toFixed(2)}
                  </TableCell>
                  <TableCell className="py-3">
                    <Badge variant="outline" className={`${sc.text} ${sc.border} ${sc.bg} font-normal text-[11px] px-2 py-0.5 rounded capitalize`}>
                      {status === 'found' ? 'Receipt Found' : status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right pr-5 py-3">
                    <button
                      className={`h-5 w-5 rounded border transition-all inline-flex items-center justify-center
                        ${Boolean(ride.reviewed)
                          ? "bg-emerald-500/10 border-emerald-700 text-emerald-500"
                          : "border-zinc-700 text-zinc-700 hover:border-zinc-500"
                        }`}
                      title={Boolean(ride.reviewed) ? "Reviewed" : "Mark as reviewed"}
                    >
                      {Boolean(ride.reviewed) && (
                        <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
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
    </div>
  );
}
