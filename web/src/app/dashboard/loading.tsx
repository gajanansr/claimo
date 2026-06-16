import { Skeleton } from "@/components/ui/skeleton";

export default function OverviewLoading() {
  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-6 w-32 bg-zinc-900" />
          <Skeleton className="h-4 w-52 bg-zinc-900" />
        </div>
        <Skeleton className="h-8 w-24 bg-zinc-900 rounded-lg" />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-zinc-950 border border-zinc-900 rounded-xl px-5 py-4 space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-20 bg-zinc-900" />
              <Skeleton className="h-4 w-4 rounded bg-zinc-900" />
            </div>
            <Skeleton className="h-7 w-20 bg-zinc-900" />
            <Skeleton className="h-3 w-24 bg-zinc-900" />
          </div>
        ))}
      </div>

      {/* Recent rides table */}
      <div className="bg-zinc-950 border border-zinc-900 rounded-xl overflow-hidden">
        <div className="border-b border-zinc-900/80 px-5 pt-5 pb-4 flex items-center justify-between">
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-28 bg-zinc-900" />
            <Skeleton className="h-3 w-48 bg-zinc-900" />
          </div>
          <Skeleton className="h-7 w-20 bg-zinc-900 rounded-md" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-3.5 border-b border-zinc-900/60">
            <Skeleton className="h-5 w-16 rounded-full bg-zinc-900" />
            <Skeleton className="h-4 w-20 bg-zinc-900" />
            <Skeleton className="h-4 w-40 bg-zinc-900" />
            <Skeleton className="h-4 w-14 bg-zinc-900 ml-auto" />
            <Skeleton className="h-5 w-20 rounded bg-zinc-900" />
          </div>
        ))}
      </div>
    </div>
  );
}
