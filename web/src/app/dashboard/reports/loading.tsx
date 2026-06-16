import { Skeleton } from "@/components/ui/skeleton";

export default function ReportsLoading() {
  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-6 w-24 bg-zinc-900" />
          <Skeleton className="h-4 w-64 bg-zinc-900" />
        </div>
        <Skeleton className="h-8 w-36 bg-zinc-900 rounded-lg" />
      </div>

      {/* Reports table card */}
      <div className="bg-zinc-950 border border-zinc-900 rounded-xl overflow-hidden">
        {/* Card header */}
        <div className="border-b border-zinc-900/80 px-5 pt-5 pb-4 space-y-1.5">
          <Skeleton className="h-4 w-28 bg-zinc-900" />
          <Skeleton className="h-3 w-72 bg-zinc-900" />
        </div>

        {/* Table header */}
        <div className="flex items-center gap-6 px-5 py-3 border-b border-zinc-900/80">
          {[80, 40, 60, 80, 60, 60].map((w, i) => (
            <Skeleton key={i} className={`h-3 w-${w === 40 ? '[40px]' : w === 60 ? '[60px]' : w === 80 ? '[80px]' : '[60px]'} bg-zinc-900`} style={{ width: w }} />
          ))}
        </div>

        {/* Table rows */}
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-6 px-5 py-3.5 border-b border-zinc-900/60">
            <Skeleton className="h-4 w-24 bg-zinc-900" />
            <Skeleton className="h-4 w-8 bg-zinc-900" />
            <Skeleton className="h-4 w-20 bg-zinc-900" />
            <Skeleton className="h-4 w-24 bg-zinc-900" />
            <Skeleton className="h-5 w-16 rounded bg-zinc-900" />
            <Skeleton className="h-7 w-24 rounded-md bg-zinc-900 ml-auto" />
          </div>
        ))}

        {/* Footer */}
        <div className="px-5 py-3 border-t border-zinc-900/80 flex items-center justify-between">
          <Skeleton className="h-3 w-28 bg-zinc-900" />
          <Skeleton className="h-3 w-32 bg-zinc-900" />
        </div>
      </div>
    </div>
  );
}
