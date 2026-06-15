"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

export function SyncButton({ className, variant = "ghost", children, iconOnly = false }: { className?: string, variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | null | undefined, children?: React.ReactNode, iconOnly?: boolean }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSync = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/sync", { method: "POST" });
      const data = await res.json();
      
      if (!res.ok) {
        alert(data.error || "Failed to sync");
        return;
      }
      
      alert(`Sync complete! Found ${data.syncedCount} new rides.`);
      router.refresh(); // Refresh Server Components to show new data
    } catch {
      alert("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={iconOnly ? "icon" : "default"}
      onClick={handleSync}
      disabled={loading}
      className={className}
      title="Sync now"
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" /> : <RefreshCw className="h-3.5 w-3.5 shrink-0" />}
      {children}
    </Button>
  );
}
