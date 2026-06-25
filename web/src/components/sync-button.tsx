"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2, Calendar } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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

export function SyncButton({ className, variant = "ghost", children, iconOnly = false }: { className?: string, variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | null | undefined, children?: React.ReactNode, iconOnly?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [showLocationWarning, setShowLocationWarning] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedOption, setSelectedOption] = useState("all");
  const [customDate, setCustomDate] = useState("");
  const router = useRouter();

  const performSync = async (fetchSince: string | null) => {
    try {
      setLoading(true);
      const body: Record<string, string> = {};
      if (fetchSince) body.fetchSince = fetchSince;

      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
      
      if (!res.ok) {
        toast.error(data.error || "Failed to sync");
        return;
      }
      
      toast.success(`Sync complete! Found ${data.syncedCount} new rides.`);
      router.refresh(); // Refresh Server Components to show new data
    } catch {
      toast.error("An unexpected error occurred.");
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

          <div className="flex flex-col gap-2 my-2">
            {FETCH_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSelectedOption(opt.value)}
                className={`w-full text-left px-4 py-2.5 rounded-lg text-[13px] font-medium transition-all border
                  ${selectedOption === opt.value
                    ? "bg-emerald-950/40 border-emerald-700/60 text-emerald-300"
                    : "border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                  }`}
              >
                {opt.label}
              </button>
            ))}
            {selectedOption === "custom" && (
              <input
                type="date"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className="mt-1 w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-lg px-3 py-2 text-[13px] outline-none focus:border-emerald-500/50 transition-colors"
              />
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
