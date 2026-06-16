import { Skeleton } from "@/components/ui/skeleton";

export default function RidesLoading() {
  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-6 w-20 bg-zinc-900" />
          <Skeleton className="h-4 w-40 bg-zinc-900" />
        </div>
        <Skeleton className="h-8 w-28 bg-zinc-900 rounded-lg" />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-zinc-950 border border-zinc-900 rounded-xl px-5 py-4 space-y-2">
            <Skeleton className="h-3 w-20 bg-zinc-900" />
            <Skeleton className="h-7 w-16 bg-zinc-900" />
          </div>
        ))}
      </div>

      {/* Filter row */}
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-7 w-20 bg-zinc-900 rounded-md" />
        ))}
        <Skeleton className="h-7 w-28 bg-zinc-900 rounded-md ml-auto" />
      </div>

      {/* Table */}
      <div className="bg-zinc-950 border border-zinc-900 rounded-xl overflow-hidden">
        {/* Header row */}
        <div className="flex items-center gap-4 px-5 py-3 border-b border-zinc-900/80">
          <Skeleton className="h-3 w-4 bg-zinc-900" />
          <Skeleton className="h-3 w-16 bg-zinc-900" />
          <Skeleton className="h-3 w-16 bg-zinc-900" />
          <Skeleton className="h-3 w-32 bg-zinc-900" />
          <Skeleton className="h-3 w-16 bg-zinc-900 ml-auto" />
          <Skeleton className="h-3 w-16 bg-zinc-900" />
        </div>
        {/* Data rows */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-3.5 border-b border-zinc-900/60">
            <Skeleton className="h-4 w-4 rounded bg-zinc-900" />
            <Skeleton className="h-4 w-24 bg-zinc-900" />
            <Skeleton className="h-5 w-16 rounded-full bg-zinc-900" />
            <Skeleton className="h-4 w-36 bg-zinc-900" />
            <Skeleton className="h-4 w-16 bg-zinc-900 ml-auto" />
            <Skeleton className="h-5 w-24 rounded bg-zinc-900" />
          </div>
        ))}
        {/* Footer */}
        <div className="px-5 py-3 border-t border-zinc-900/80 flex items-center justify-between">
          <Skeleton className="h-3 w-40 bg-zinc-900" />
          <div className="flex gap-3">
            <Skeleton className="h-3 w-10 bg-zinc-900" />
            <Skeleton className="h-3 w-14 bg-zinc-900" />
          </div>
        </div>
      </div>
    </div>
  );
}
