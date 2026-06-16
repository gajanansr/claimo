import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <div className="p-6 lg:p-8 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-6 w-24 bg-zinc-900" />
        <Skeleton className="h-4 w-48 bg-zinc-900" />
      </div>

      {/* Profile card */}
      <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-5 flex items-center gap-4">
        <Skeleton className="h-14 w-14 rounded-full bg-zinc-900 shrink-0" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-5 w-40 bg-zinc-900" />
          <Skeleton className="h-3 w-52 bg-zinc-900" />
        </div>
        <Skeleton className="h-8 w-20 bg-zinc-900 rounded-lg" />
      </div>

      {/* Settings sections */}
      {[1, 2].map((section) => (
        <div key={section} className="bg-zinc-950 border border-zinc-900 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-zinc-900/80">
            <Skeleton className="h-3 w-20 bg-zinc-900" />
          </div>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between px-5 py-4 border-b border-zinc-900/60 last:border-0">
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-lg bg-zinc-900" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-28 bg-zinc-900" />
                  <Skeleton className="h-3 w-44 bg-zinc-900" />
                </div>
              </div>
              <Skeleton className="h-4 w-4 bg-zinc-900 rounded" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
