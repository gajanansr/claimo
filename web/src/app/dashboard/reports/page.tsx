import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { GenerateReportDialog } from "@/components/generate-report-dialog";
import { format, parseISO } from "date-fns";

const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default async function ReportsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch real reports
  const { data: rawReports } = await supabase
    .from("reports")
    .select("*")
    .eq("user_id", user?.id)
    .order("year", { ascending: false })
    .order("month", { ascending: false });

  const reports = rawReports || [];
  const totalAmount = reports.reduce((a, r) => a + Number(r.total_amount || 0), 0).toFixed(2);

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6 animate-fade-in-up">

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 tracking-tight">Reports</h1>
          <p className="text-zinc-500 text-sm mt-0.5">Generate and download reimbursement PDFs for any date range</p>
        </div>
        <GenerateReportDialog />
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
              {reports.length > 0 ? reports.map((report) => (
                <TableRow key={report.id} className="border-zinc-900/60 hover:bg-zinc-900/20 transition-colors">
                  <TableCell className="font-semibold text-zinc-200 text-[13px] pl-5 py-3.5">
                    {report.start_date && report.end_date
                      ? `${format(parseISO(report.start_date), "MMM d")} – ${format(parseISO(report.end_date), "MMM d, yyyy")}`
                      : `${months[report.month - 1]} ${report.year}`}
                  </TableCell>
                  <TableCell className="text-zinc-400 text-[13px] py-3.5">{report.ride_count}</TableCell>
                  <TableCell className="text-zinc-100 font-semibold text-[13px] py-3.5">₹{Number(report.total_amount).toFixed(2)}</TableCell>
                  <TableCell className="text-zinc-500 text-[12px] py-3.5 hidden sm:table-cell">
                    {report.created_at ? format(parseISO(report.created_at), "MMM d, yyyy") : "—"}
                  </TableCell>
                  <TableCell className="py-3.5">
                    <Badge variant="outline" className={`font-normal text-[11px] px-2 py-0.5 rounded capitalize ${
                      report.status === "ready" 
                        ? "bg-emerald-950/20 border-emerald-900/50 text-emerald-400"
                        : report.status === "failed"
                        ? "bg-red-950/20 border-red-900/50 text-red-400"
                        : "bg-amber-950/20 border-amber-900/50 text-amber-400"
                    }`}>
                      {report.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right pr-5 py-3.5">
                    {report.status === "ready" && report.pdf_url ? (
                      <a
                        href={`/api/reports/download?id=${report.id}`}
                        className="inline-flex items-center justify-center whitespace-nowrap h-7 px-2.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 border border-zinc-800 rounded-md transition-all text-xs font-medium"
                      >
                        <Download className="mr-1.5 h-3.5 w-3.5" />
                        Download PDF
                      </a>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled
                        className="h-7 px-2.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 border border-zinc-800 rounded-md transition-all text-xs font-medium"
                      >
                        <Download className="mr-1.5 h-3.5 w-3.5" />
                        Download PDF
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-zinc-500 text-sm">
                    No reports generated yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <div className="border-t border-zinc-900/80 px-5 py-3 flex items-center justify-between">
            <span className="text-[11px] text-zinc-600">{reports.length} reports generated</span>
            <span className="text-[11px] text-zinc-600">
              Total processed: ₹{totalAmount}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
