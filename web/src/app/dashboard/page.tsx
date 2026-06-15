import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowUpRight, Car, DollarSign, FileText, Mail, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { format, parseISO } from "date-fns";
import { SyncButton } from "@/components/sync-button";

const serviceColor: Record<string, string> = {
  uber:   "bg-zinc-200",
  rapido: "bg-yellow-400",
};

const SparkLine = () => (
  <svg viewBox="0 0 80 28" className="w-full h-7" preserveAspectRatio="none">
    <defs>
      <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stopColor="#10b981" stopOpacity="0.3" />
        <stop offset="100%" stopColor="#10b981" stopOpacity="0"   />
      </linearGradient>
    </defs>
    <path d="M0,22 L13,18 L27,10 L40,14 L53,6 L67,9 L80,4 L80,28 L0,28 Z" fill="url(#sg)" />
    <path
      d="M0,22 L13,18 L27,10 L40,14 L53,6 L67,9 L80,4"
      fill="none" stroke="#10b981" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round"
    />
  </svg>
);

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch real receipts
  const { data: rawReceipts } = await supabase
    .from("receipts")
    .select("*")
    .eq("user_id", user?.id)
    .order("trip_date", { ascending: false });
    
  // Fetch profile to check Gmail status
  const { data: profile } = await supabase
    .from("profiles")
    .select("gmail_connected")
    .eq("id", user?.id)
    .single();

  const receipts = rawReceipts || [];
  const hasRides = receipts.length > 0;
  
  // Calculate totals
  const totalAmount = receipts.reduce((acc, r) => acc + Number(r.amount || 0), 0);
  const pendingCount = receipts.filter(r => r.status === 'pending').length;
  const verifiedCount = receipts.length - pendingCount;

  // Breakdown
  const uberCount = receipts.filter(r => r.service === 'uber').length;
  const rapidoCount = receipts.filter(r => r.service === 'rapido').length;
  const totalCount = receipts.length || 1; // prevent div by zero
  const uberPct = Math.round((uberCount / totalCount) * 100);
  const rapidoPct = 100 - uberPct;
  const isConnected = profile?.gmail_connected ?? false;

  // Calculate month-over-month
  const now = new Date();
  const currentMonthRides = receipts.filter(r => {
    const d = new Date(r.trip_date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const lastMonthRides = receipts.filter(r => {
    const d = new Date(r.trip_date);
    const lastMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    return d.getMonth() === lastMonth && d.getFullYear() === year;
  });

  const currentMonthTotal = currentMonthRides.reduce((acc, r) => acc + Number(r.amount || 0), 0);
  const lastMonthTotal = lastMonthRides.reduce((acc, r) => acc + Number(r.amount || 0), 0);
  
  let growth = 0;
  if (lastMonthTotal > 0) {
    growth = Math.round(((currentMonthTotal - lastMonthTotal) / lastMonthTotal) * 100);
  }

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6 animate-fade-in-up">

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 tracking-tight">Overview</h1>
          <p className="text-zinc-500 text-sm mt-0.5">Your ride expenses for this month</p>
        </div>
        <Link
          href="/dashboard/reports"
          className="inline-flex items-center gap-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-semibold rounded-lg shadow-sm text-[13px] h-8 px-3 transition-colors"
        >
          <FileText className="h-3.5 w-3.5" />
          + Report
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">

        <Card className="bg-zinc-950 border-zinc-900 rounded-xl shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-5 px-5">
            <CardTitle className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
              Total Expenses
            </CardTitle>
            <DollarSign className="h-3.5 w-3.5 text-zinc-600" />
          </CardHeader>
          <CardContent className="px-5 pb-3">
            <div className="text-[28px] font-bold text-zinc-100 tracking-tight leading-none">
              ₹{totalAmount.toFixed(2)}
            </div>
            <div className="flex items-center gap-1 mt-1 mb-3">
              {growth >= 0 ? (
                <>
                  <TrendingUp className="h-3 w-3 text-emerald-500" />
                  <p className="text-[11px] text-emerald-500">+{growth}% from last month</p>
                </>
              ) : (
                <>
                  <TrendingUp className="h-3 w-3 text-amber-500 rotate-180" />
                  <p className="text-[11px] text-amber-500">{growth}% from last month</p>
                </>
              )}
            </div>
            <SparkLine />
          </CardContent>
        </Card>

        <Card className="bg-zinc-950 border-zinc-900 rounded-xl shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-5 px-5">
            <CardTitle className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
              Rides Tracked
            </CardTitle>
            <Car className="h-3.5 w-3.5 text-zinc-600" />
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="text-[28px] font-bold text-zinc-100 tracking-tight leading-none mt-1">{receipts.length}</div>
            <p className="text-[11px] text-zinc-500 mt-1.5">
              <span className="text-amber-500 font-medium">{pendingCount} pending</span> · {verifiedCount} verified
            </p>
            <div className="flex gap-0.5 mt-4 h-1 rounded-full overflow-hidden bg-zinc-900">
              <div className="bg-zinc-300 rounded-full" style={{ width: `${uberPct}%` }} title="Uber" />
              <div className="bg-yellow-400 rounded-full" style={{ width: `${rapidoPct}%` }} title="Rapido" />
            </div>
            <div className="flex gap-4 mt-2">
              {[["Uber", "bg-zinc-300", uberCount], ["Rapido", "bg-yellow-400", rapidoCount]].map(([name, color, count]) => (
                <div key={name as string} className="flex items-center gap-1">
                  <span className={`h-1.5 w-1.5 rounded-full ${color}`} />
                  <span className="text-[10px] text-zinc-500">{name} {count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-950 border-zinc-900 rounded-xl shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-5 px-5">
            <CardTitle className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
              Gmail Sync
            </CardTitle>
            <ArrowUpRight className="h-3.5 w-3.5 text-zinc-600" />
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="flex items-center gap-2 mt-1">
              <span className={`h-2 w-2 rounded-full shrink-0 ${isConnected ? "bg-emerald-500 animate-pulse-dot" : "bg-amber-500"}`} />
              <span className="text-[28px] font-bold text-zinc-100 tracking-tight leading-none">
                {isConnected ? "Active" : "Paused"}
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 mt-1.5">
              {isConnected ? "Waiting for sync" : "Not connected"}
            </p>
            <SyncButton className="mt-4 h-7 px-2.5 text-[11px] text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 border border-zinc-800 rounded-md w-full justify-center gap-1.5">
              Sync now
            </SyncButton>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-zinc-950 border-zinc-900 rounded-xl shadow-sm">
        <CardHeader className="border-b border-zinc-900/80 pb-4 pt-5 px-5 flex flex-row items-center justify-between">
          <CardTitle className="text-[15px] font-bold text-zinc-100">Recent Rides</CardTitle>
          <Link
            href="/dashboard/rides"
            className="inline-flex items-center h-7 px-2.5 text-[11px] text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 rounded-md transition-colors"
          >
            View all →
          </Link>
        </CardHeader>
        <CardContent className="px-0 pt-0 pb-0">
          {hasRides ? (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-zinc-900/80">
                  <TableHead className="text-zinc-600 font-semibold text-[10px] uppercase tracking-widest pl-5">Date</TableHead>
                  <TableHead className="text-zinc-600 font-semibold text-[10px] uppercase tracking-widest">Service</TableHead>
                  <TableHead className="text-zinc-600 font-semibold text-[10px] uppercase tracking-widest">Amount</TableHead>
                  <TableHead className="text-zinc-600 font-semibold text-[10px] uppercase tracking-widest text-right pr-5">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receipts.slice(0, 5).map((ride) => (
                  <TableRow key={ride.id} className="border-zinc-900/60 hover:bg-zinc-900/20 transition-colors cursor-default">
                    <TableCell className="text-zinc-400 text-[13px] pl-5 py-3">
                      {format(parseISO(ride.trip_date), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="flex items-center gap-2">
                        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${serviceColor[ride.service] ?? "bg-zinc-500"}`} />
                        <span className="text-zinc-200 text-[13px] font-medium capitalize">{ride.service}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-zinc-200 text-[13px] font-semibold py-3">
                      ₹{Number(ride.amount).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right pr-5 py-3">
                      <Badge
                        variant="outline"
                        className={
                          ride.status === "pending"
                            ? "bg-amber-950/20 border-amber-900/50 text-amber-400 font-normal text-[11px] px-2 py-0.5 rounded"
                            : "bg-emerald-950/20 border-emerald-900/50 text-emerald-400 font-normal text-[11px] px-2 py-0.5 rounded capitalize"
                        }
                      >
                        {ride.status === 'found' ? 'Receipt Found' : ride.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="h-12 w-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4">
                <Mail className="h-5 w-5 text-zinc-600" />
              </div>
              <h3 className="text-sm font-semibold text-zinc-300 mb-1">No rides synced yet</h3>
              <p className="text-xs text-zinc-600 max-w-[22rem] leading-relaxed mb-5">
                Connect your Gmail account and Claimo will automatically find your Uber and Rapido ride receipts.
              </p>
              <SyncButton className="bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-semibold text-[13px] h-8 px-4 rounded-lg flex items-center justify-center gap-1.5">
                Sync now
              </SyncButton>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
