"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Download, FileText, Loader2, Plus } from "lucide-react";

const pastReports = [
  { id: "1", month: "September 2026", generatedAt: "Oct 1, 2026",  rides: 18, status: "Ready",      amount: "$380.00" },
  { id: "2", month: "August 2026",    generatedAt: "Sep 2, 2026",  rides: 21, status: "Ready",      amount: "$412.50" },
  { id: "3", month: "July 2026",      generatedAt: "Aug 1, 2026",  rides: 14, status: "Ready",      amount: "$295.00" },
  { id: "4", month: "June 2026",      generatedAt: "Jul 3, 2026",  rides: 9,  status: "Ready",      amount: "$188.20" },
];

const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function ReportsPage() {
  const [open, setOpen]         = useState(false);
  const [generating, setGen]    = useState(false);
  const [selectedMonth, setMon] = useState("October");
  const [selectedYear, setYear] = useState("2026");

  const handleGenerate = () => {
    setGen(true);
    setTimeout(() => {
      setGen(false);
      setOpen(false);
    }, 2200);
  };

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6 animate-fade-in-up">

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 tracking-tight">Reports</h1>
          <p className="text-zinc-500 text-sm mt-0.5">Generate and download monthly reimbursement PDFs</p>
        </div>

        {/* T21: Generate dialog trigger */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-semibold border-0 rounded-lg shadow-sm text-[13px] h-8 px-3">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              New Report
            </Button>
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
                  {["2025", "2026"].map((y) => (
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
      </div>

      {/* ── Reports table ───────────────────────────────────────── */}
      <Card className="bg-zinc-950 border-zinc-900 rounded-xl shadow-sm">
        <CardHeader className="border-b border-zinc-900/80 pb-4 pt-5 px-5">
          <CardTitle className="text-[15px] font-bold text-zinc-100">Past Reports</CardTitle>
          <CardDescription className="text-zinc-500 text-[12px] mt-0.5">
            Each PDF contains a monthly summary with all ride receipts attached.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 pt-0 pb-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-zinc-900/80">
                <TableHead className="text-zinc-600 font-semibold text-[10px] uppercase tracking-widest pl-5">Period</TableHead>
                <TableHead className="text-zinc-600 font-semibold text-[10px] uppercase tracking-widest">Rides</TableHead>
                <TableHead className="text-zinc-600 font-semibold text-[10px] uppercase tracking-widest">Total</TableHead>
                <TableHead className="text-zinc-600 font-semibold text-[10px] uppercase tracking-widest hidden sm:table-cell">Generated</TableHead>
                <TableHead className="text-zinc-600 font-semibold text-[10px] uppercase tracking-widest">Status</TableHead>
                <TableHead className="text-right text-zinc-600 font-semibold text-[10px] uppercase tracking-widest pr-5">PDF</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pastReports.map((report) => (
                <TableRow key={report.id} className="border-zinc-900/60 hover:bg-zinc-900/20 transition-colors">
                  <TableCell className="font-semibold text-zinc-200 text-[13px] pl-5 py-3.5">{report.month}</TableCell>
                  <TableCell className="text-zinc-400 text-[13px] py-3.5">{report.rides}</TableCell>
                  <TableCell className="text-zinc-100 font-semibold text-[13px] py-3.5">{report.amount}</TableCell>
                  <TableCell className="text-zinc-500 text-[12px] py-3.5 hidden sm:table-cell">{report.generatedAt}</TableCell>
                  <TableCell className="py-3.5">
                    <Badge variant="outline" className="bg-emerald-950/20 border-emerald-900/50 text-emerald-400 font-normal text-[11px] px-2 py-0.5 rounded">
                      {report.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right pr-5 py-3.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 border border-zinc-800 text-[11px] rounded-md gap-1.5"
                    >
                      <Download className="h-3 w-3" />
                      PDF
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="border-t border-zinc-900/80 px-5 py-3 flex items-center justify-between">
            <span className="text-[11px] text-zinc-600">{pastReports.length} reports generated</span>
            <span className="text-[11px] text-zinc-600">
              Total: ${pastReports.reduce((a, r) => a + parseFloat(r.amount.replace("$", "")), 0).toFixed(2)}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
