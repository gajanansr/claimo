"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2, Calendar, CheckCircle2, AlertCircle, Mail, FileText, Link2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const FETCH_OPTIONS = [
  { label: "All rides", value: "all" },
  { label: "Last 3 months", value: "3m" },
  { label: "Last 6 months", value: "6m" },
  { label: "Last 1 year", value: "1y" },
  { label: "Custom date", value: "custom" },
] as const;

function getDateFromOption(option: string): string | null {
  const now = new Date();
  switch (option) {
    case "all":
      return null;
    case "3m":
      return new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()).toISOString();
    case "6m":
      return new Date(now.getFullYear(), now.getMonth() - 6, now.getDate()).toISOString();
    case "1y":
      return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).toISOString();
    default:
      return null;
  }
}

type SyncProgress = {
  current: number;
  total: number;
  synced: number;
  skipped: number;
  service?: string;
  subject?: string;
};

export function SyncButton({ className, variant = "ghost", children, iconOnly = false }: { className?: string, variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | null | undefined, children?: React.ReactNode, iconOnly?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [showLocationWarning, setShowLocationWarning] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedOption, setSelectedOption] = useState("all");
  const [customDate, setCustomDate] = useState("");
  const [showSyncOverlay, setShowSyncOverlay] = useState(false);
  const [syncStatus, setSyncStatus] = useState("Connecting to Gmail...");
  const [syncPhase, setSyncPhase] = useState<"connecting" | "scanning" | "processing" | "done" | "error" | "expired">("connecting");
  const [syncProgress, setSyncProgress] = useState<SyncProgress>({ current: 0, total: 0, synced: 0, skipped: 0 });
  const [reconnecting, setReconnecting] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  // Gmail token expired → sign out and send the user back to reconnect.
  const handleReconnect = async () => {
    setReconnecting(true);
    await supabase.auth.signOut();
    router.push("/auth?reason=gmail_expired");
  };

  // The overlay must not be dismissable mid-sync; only allow closing once finished.
  const overlayDismissable = syncPhase === "done" || syncPhase === "error";

  const performSync = async (fetchSince: string | null) => {
    try {
      setLoading(true);
      setShowSyncOverlay(true);
      setSyncPhase("connecting");
      setSyncStatus("Connecting to Gmail...");
      setSyncProgress({ current: 0, total: 0, synced: 0, skipped: 0 });

      const body: Record<string, string> = {};
      if (fetchSince) body.fetchSince = fetchSince;

      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
      });

      if (!res.ok) {
        if (res.status === 401) {
          setSyncPhase("expired");
          setSyncStatus("Your Gmail connection expired. Please reconnect to continue.");
          return;
        }
        const data = await res.json().catch(() => ({ error: "Sync failed" }));
        setSyncPhase("error");
        setSyncStatus(data.error || "Sync failed");
        setTimeout(() => setShowSyncOverlay(false), 2500);
        return;
      }

      if (!res.body) {
        // Fallback for non-streaming response
        const data = await res.json();
        setSyncPhase("done");
        setSyncStatus(`Sync complete! Found ${data.syncedCount} new rides.`);
        setSyncProgress(p => ({ ...p, synced: data.syncedCount }));
        setTimeout(() => {
          setShowSyncOverlay(false);
          router.refresh();
        }, 2000);
        return;
      }

      // Read SSE stream
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const event = JSON.parse(jsonStr);

            switch (event.type) {
              case "scanning":
                setSyncPhase("scanning");
                setSyncStatus(`Scanning Gmail... found ${event.found} emails so far`);
                break;

              case "scan_complete":
                setSyncPhase("processing");
                setSyncStatus(`Found ${event.total} emails to process`);
                setSyncProgress(p => ({ ...p, total: event.total }));
                break;

              case "processing":
                setSyncPhase("processing");
                setSyncProgress(p => ({
                  ...p,
                  current: event.current,
                  total: event.total,
                  service: event.service,
                  subject: event.subject,
                }));
                setSyncStatus(`Processing ${event.current}/${event.total}: ${event.subject?.substring(0, 50) || "email"}...`);
                break;

              case "pdf_progress":
                setSyncStatus(`PDF ${event.pdfIndex}/${event.pdfTotal} from: ${event.subject?.substring(0, 40) || "email"}...`);
                break;

              case "synced":
                setSyncProgress(p => ({ ...p, synced: p.synced + 1 }));
                break;

              case "skipped":
                setSyncProgress(p => ({ ...p, skipped: p.skipped + 1 }));
                break;

              case "done":
                setSyncPhase("done");
                setSyncProgress(p => ({ ...p, synced: event.syncedCount, current: p.total }));
                setSyncStatus(`Sync complete! Found ${event.syncedCount} new rides.`);
                setTimeout(() => {
                  setShowSyncOverlay(false);
                  router.refresh();
                }, 2200);
                break;

              case "error":
                if (event.code === "auth_expired" || /expired|reconnect|sign in again/i.test(event.message || "")) {
                  setSyncPhase("expired");
                  setSyncStatus(event.message || "Your Gmail connection expired. Please reconnect.");
                } else {
                  setSyncPhase("error");
                  setSyncStatus(event.message || "An error occurred");
                  setTimeout(() => setShowSyncOverlay(false), 3000);
                }
                break;
            }
          } catch {
            // Ignore malformed JSON lines
          }
        }
      }
    } catch {
      setSyncPhase("error");
      setSyncStatus("Network error. Please try again.");
      setTimeout(() => setShowSyncOverlay(false), 2500);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncClick = async () => {
    setShowDatePicker(true);
  };

  const handleDateConfirm = async () => {
    setShowDatePicker(false);

    let fetchSince: string | null = null;
    if (selectedOption === "custom" && customDate) {
      fetchSince = new Date(customDate).toISOString();
    } else {
      fetchSince = getDateFromOption(selectedOption);
    }

    try {
      setLoading(true);
      // Check if user has locations before syncing
      const locRes = await fetch("/api/locations");
      const locations = await locRes.json();
      
      if (locations && locations.length === 0) {
        setLoading(false);
        // Store fetchSince to use after location warning
        (window as unknown as Record<string, unknown>).__pendingFetchSince = fetchSince;
        setShowLocationWarning(true);
        return;
      }
      
      // If locations exist, proceed with sync
      await performSync(fetchSince);
    } catch {
      toast.error("Network error checking locations.");
      setLoading(false);
    }
  };

  const progressPct = syncProgress.total > 0 ? Math.round((syncProgress.current / syncProgress.total) * 100) : 0;

  return (
    <>
      <Button
        variant={variant}
        size={iconOnly ? "icon" : "default"}
        onClick={handleSyncClick}
        disabled={loading}
        className={className}
        title="Sync now"
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" /> : <RefreshCw className="h-3.5 w-3.5 shrink-0" />}
        {children}
      </Button>

      {/* ── Sync Progress Overlay (shadcn Dialog) ─────────────── */}
      <Dialog
        open={showSyncOverlay}
        onOpenChange={(open) => {
          // Never dismissable mid-sync; only close once finished or failed.
          if (!open && overlayDismissable) setShowSyncOverlay(false);
        }}
        disablePointerDismissal
      >
        <DialogContent
          showCloseButton={overlayDismissable}
          className="max-w-md gap-0 overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-950 p-0 ring-zinc-800/80 max-h-[90dvh]"
        >
          {/* Header glow */}
          <div className={`h-1 w-full transition-all duration-500 ${
            syncPhase === "error" ? "bg-red-500" :
            syncPhase === "expired" ? "bg-amber-500" :
            syncPhase === "done" ? "bg-emerald-500" :
            "bg-gradient-to-r from-emerald-500 via-cyan-400 to-emerald-500 animate-gradient-x"
          }`} />

          <div className="p-6 space-y-5">
            {/* Icon + Status */}
            <div className="flex items-start gap-4">
              <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 transition-colors duration-300 ${
                syncPhase === "error" ? "bg-red-950/40 border border-red-900/50" :
                syncPhase === "expired" ? "bg-amber-950/40 border border-amber-900/50" :
                syncPhase === "done" ? "bg-emerald-950/40 border border-emerald-900/50" :
                "bg-zinc-900 border border-zinc-800"
              }`}>
                {syncPhase === "error" ? (
                  <AlertCircle className="h-5 w-5 text-red-400" />
                ) : syncPhase === "expired" ? (
                  <Link2 className="h-5 w-5 text-amber-400" />
                ) : syncPhase === "done" ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                ) : syncPhase === "scanning" ? (
                  <Mail className="h-5 w-5 text-cyan-400 animate-pulse" />
                ) : syncPhase === "processing" ? (
                  <FileText className="h-5 w-5 text-emerald-400 animate-pulse" />
                ) : (
                  <Loader2 className="h-5 w-5 text-zinc-400 animate-spin" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-[15px] font-semibold text-zinc-100 leading-tight">
                  {syncPhase === "done" ? "Sync Complete" :
                   syncPhase === "error" ? "Sync Failed" :
                   syncPhase === "expired" ? "Reconnect Gmail" :
                   "Syncing Receipts"}
                </DialogTitle>
                <DialogDescription className="text-[13px] text-zinc-400 mt-1 leading-snug">
                  {syncStatus}
                </DialogDescription>
              </div>
            </div>

            {/* Progress bar */}
            {syncPhase === "processing" && syncProgress.total > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-[11px]">
                  <span className="text-zinc-500">{syncProgress.current} of {syncProgress.total} emails</span>
                  <span className="text-zinc-400 font-medium">{progressPct}%</span>
                </div>
                <div className="h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            )}

            {/* Scanning animation */}
            {syncPhase === "scanning" && (
              <div className="space-y-2">
                <div className="h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                  <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-cyan-400 to-transparent rounded-full animate-shimmer" />
                </div>
              </div>
            )}

            {/* Counters */}
            {(syncProgress.synced > 0 || syncProgress.skipped > 0 || syncPhase === "done") && (
              <div className="flex gap-3">
                <div className="flex-1 bg-emerald-950/20 border border-emerald-900/40 rounded-lg p-3 text-center">
                  <p className="text-[20px] font-bold text-emerald-400 leading-none">{syncProgress.synced}</p>
                  <p className="text-[10px] text-emerald-500/70 uppercase tracking-wider mt-1 font-medium">New rides</p>
                </div>
                <div className="flex-1 bg-zinc-900/40 border border-zinc-800 rounded-lg p-3 text-center">
                  <p className="text-[20px] font-bold text-zinc-400 leading-none">{syncProgress.skipped}</p>
                  <p className="text-[10px] text-zinc-600 uppercase tracking-wider mt-1 font-medium">Already synced</p>
                </div>
              </div>
            )}

            {/* Connecting state */}
            {syncPhase === "connecting" && (
              <div className="flex items-center justify-center gap-2 py-2">
                <div className="flex gap-1">
                  <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            )}

            {/* Expired → reconnect action */}
            {syncPhase === "expired" && (
              <div className="flex flex-col gap-2">
                <Button
                  onClick={handleReconnect}
                  disabled={reconnecting}
                  className="w-full bg-amber-600 hover:bg-amber-500 text-white border-0 gap-2"
                >
                  {reconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                  {reconnecting ? "Redirecting…" : "Reconnect Gmail"}
                </Button>
                <button
                  onClick={() => setShowSyncOverlay(false)}
                  className="text-[12px] text-zinc-600 hover:text-zinc-400 transition-colors"
                >
                  Not now
                </button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Date range picker dialog */}
      <AlertDialog open={showDatePicker} onOpenChange={setShowDatePicker}>
        <AlertDialogContent className="bg-zinc-950 border-zinc-900 text-zinc-100 max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-zinc-100 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-emerald-400" />
              How far back should we fetch?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              Choose how many past ride receipts to sync from your Gmail.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="my-2 space-y-2">
            <div className="grid grid-cols-2 gap-1.5">
              {FETCH_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSelectedOption(opt.value)}
                  className={`relative px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all border text-left
                    ${opt.value === "all" ? "col-span-2" : ""}
                    ${selectedOption === opt.value
                      ? "bg-emerald-950/40 border-emerald-700/60 text-emerald-300"
                      : "border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                    }`}
                >
                  {opt.label}
                  {selectedOption === opt.value && (
                    <CheckCircle2 className="absolute top-2 right-2 h-3.5 w-3.5 text-emerald-400" />
                  )}
                </button>
              ))}
            </div>

            {selectedOption === "custom" && (
              <div className="space-y-1.5 pt-1">
                <label className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
                  Sync receipts since
                </label>
                <input
                  type="date"
                  value={customDate}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setCustomDate(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-lg px-3 py-2 text-[13px] outline-none focus:border-emerald-500/50 transition-colors"
                />
              </div>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent text-zinc-300 hover:text-zinc-100 border-zinc-800 hover:bg-zinc-900">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDateConfirm}
              disabled={selectedOption === "custom" && !customDate}
              className="bg-emerald-600 hover:bg-emerald-500 text-white border-0 transition-colors"
            >
              Start Sync
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Location warning dialog */}
      <AlertDialog open={showLocationWarning} onOpenChange={setShowLocationWarning}>
        <AlertDialogContent className="bg-zinc-950 border-zinc-900 text-zinc-100">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-zinc-100">Add Locations for Auto-Tagging</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              We noticed you haven&apos;t added any locations (like Home or Office) yet. If you add them before syncing, Claimo will automatically calculate your exact drop-off coordinates and categorize your rides perfectly for reimbursement!
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={() => {
                setShowLocationWarning(false);
                const pending = (window as unknown as Record<string, unknown>).__pendingFetchSince as string | null;
                performSync(pending ?? null);
              }}
              className="bg-transparent text-zinc-300 hover:text-zinc-100 border-zinc-800 hover:bg-zinc-900"
            >
              Sync Anyway
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                setShowLocationWarning(false);
                router.push("/dashboard/settings");
              }}
              className="bg-emerald-600 hover:bg-emerald-500 text-white border-0 transition-colors"
            >
              Add Locations
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
