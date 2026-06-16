"use client";

import { WifiOff } from "lucide-react";

export default function OfflinePage() {
  return (
    <main className="min-h-screen bg-black flex flex-col items-center justify-center px-6 text-center">
      {/* Logo */}
      <span className="text-3xl font-bold tracking-tight text-zinc-100 mb-8 select-none">
        claimo<span className="text-zinc-400">.</span>
      </span>

      {/* Icon */}
      <div className="mb-6 flex items-center justify-center w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800">
        <WifiOff className="w-8 h-8 text-zinc-400" strokeWidth={1.5} />
      </div>

      {/* Message */}
      <h1 className="text-xl font-semibold text-zinc-100 mb-2">
        You&apos;re offline
      </h1>
      <p className="text-sm text-zinc-500 max-w-xs leading-relaxed mb-8">
        Claimo needs a connection to sync your receipts.
      </p>

      {/* Retry button */}
      <button
        onClick={() => window.location.reload()}
        className="px-5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-200 text-sm font-medium hover:bg-zinc-800 hover:border-zinc-700 transition-colors duration-150 active:scale-95"
      >
        Try again
      </button>
    </main>
  );
}
