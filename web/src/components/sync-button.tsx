"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2 } from "lucide-react";
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

export function SyncButton({ className, variant = "ghost", children, iconOnly = false }: { className?: string, variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | null | undefined, children?: React.ReactNode, iconOnly?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [showLocationWarning, setShowLocationWarning] = useState(false);
  const router = useRouter();

  const performSync = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/sync", { method: "POST" });
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
    try {
      setLoading(true);
      // Check if user has locations before syncing
      const locRes = await fetch("/api/locations");
      const locations = await locRes.json();
      
      if (locations && locations.length === 0) {
        setLoading(false);
        setShowLocationWarning(true);
        return;
      }
      
      // If locations exist, proceed with sync
      await performSync();
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

      <AlertDialog open={showLocationWarning} onOpenChange={setShowLocationWarning}>
        <AlertDialogContent className="bg-zinc-950 border-zinc-900 text-zinc-100">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-zinc-100">Add Locations for Auto-Tagging</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              We noticed you haven't added any locations (like Home or Office) yet. If you add them before syncing, Claimo will automatically calculate your exact drop-off coordinates and categorize your rides perfectly for reimbursement!
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={() => {
                setShowLocationWarning(false);
                performSync();
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
