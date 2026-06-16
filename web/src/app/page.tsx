import Link from "next/link";
import { ArrowRight, Car, Mail, FileText, Shield } from "lucide-react";

const steps = [
  {
    icon: Mail,
    title: "Connect Gmail",
    desc: "Securely link your Google account. Claimo scans for Uber and Rapido receipts — nothing else.",
  },
  {
    icon: Car,
    title: "Rides sync automatically",
    desc: "Every new ride receipt is parsed, categorised, and stored. No copy-pasting, no spreadsheets.",
  },
  {
    icon: FileText,
    title: "Download your PDF",
    desc: "At month-end, generate a ready-to-submit PDF report with one click.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-black text-zinc-200 font-sans antialiased">

      {/* ── Nav ─────────────────────────────────────────────────── */}
      <nav className="border-b border-zinc-900 h-14 flex items-center justify-between px-6 lg:px-12 shrink-0">
        <div className="flex items-center gap-2">
          <Car className="h-4 w-4 text-zinc-300" />
          <span className="text-zinc-100 font-bold text-[15px] tracking-tight">
            claimo<span className="text-emerald-500">.</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/auth"
            className="text-[13px] text-zinc-400 hover:text-zinc-100 transition-colors px-3 py-1.5"
          >
            Sign in
          </Link>
          <Link
            href="/auth"
            className="text-[13px] font-semibold bg-zinc-100 hover:bg-zinc-200 text-zinc-950 px-3 py-1.5 rounded-lg transition-colors"
          >
            Get started
          </Link>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────── */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 pt-24 pb-20 relative">
        {/* Subtle radial glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(16,185,129,0.07) 0%, transparent 70%)",
          }}
        />

        {/* Eyebrow label */}
        <div className="inline-flex items-center gap-1.5 border border-emerald-900/60 bg-emerald-950/20 text-emerald-400 text-[11px] font-semibold px-3 py-1 rounded-full mb-6 tracking-wider uppercase">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse-dot" />
          Expense automation
        </div>

        <h1 className="text-5xl sm:text-6xl font-bold text-zinc-100 tracking-tight leading-[1.06] max-w-2xl">
          Stop chasing<br />
          <span className="text-zinc-400">ride receipts.</span>
        </h1>

        <p className="mt-5 text-zinc-500 text-[16px] leading-relaxed max-w-md">
          Claimo connects to your Gmail, finds every Uber and Rapido receipt, and generates reimbursement reports automatically.
        </p>

        <div className="flex items-center gap-3 mt-8">
          <Link
            href="/auth"
            className="inline-flex items-center gap-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-semibold text-[14px] px-5 py-2.5 rounded-lg transition-all shadow-sm"
          >
            Get started free
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-zinc-500 hover:text-zinc-300 text-[14px] px-4 py-2.5 transition-colors"
          >
            View demo
          </Link>
        </div>

        {/* Trust line */}
        <p className="mt-6 text-[11px] text-zinc-700 flex items-center gap-1.5">
          <Shield className="h-3 w-3" />
          Read-only Gmail access · No data sold · Open source
        </p>
      </section>

      {/* ── How it works ────────────────────────────────────────── */}
      <section className="border-t border-zinc-900 px-6 lg:px-12 py-20">
        <div className="max-w-3xl mx-auto">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-600 text-center mb-10">
            How it works
          </p>
          <div className="grid sm:grid-cols-3 gap-8">
            {steps.map(({ icon: Icon, title, desc }, i) => (
              <div key={title} className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4 text-zinc-400" />
                  </div>
                  <span className="text-[11px] font-semibold text-zinc-700 tracking-widest">0{i + 1}</span>
                </div>
                <h3 className="text-[15px] font-semibold text-zinc-200">{title}</h3>
                <p className="text-[13px] text-zinc-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA banner ──────────────────────────────────────────── */}
      <section className="border-t border-zinc-900 px-6 lg:px-12 py-16 text-center">
        <h2 className="text-2xl font-bold text-zinc-100 tracking-tight mb-3">
          Ready to automate your expenses?
        </h2>
        <p className="text-zinc-500 text-[14px] mb-6">Set up takes less than 2 minutes.</p>
        <Link
          href="/auth"
          className="inline-flex items-center gap-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-950 font-semibold text-[14px] px-5 py-2.5 rounded-lg transition-all shadow-sm"
        >
          Connect Gmail and start
          <ArrowRight className="h-4 w-4" />
        </Link>
      </section>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer className="border-t border-zinc-900 h-12 flex items-center justify-between px-6 lg:px-12 shrink-0">
        <span className="text-[12px] text-zinc-700 font-medium">
          claimo<span className="text-emerald-600">.</span>
        </span>
        <div className="flex items-center gap-4">
          <Link href="/privacy" className="text-[11px] text-zinc-700 hover:text-zinc-400 transition-colors">Privacy</Link>
          <Link href="/terms" className="text-[11px] text-zinc-700 hover:text-zinc-400 transition-colors">Terms</Link>
          <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-[11px] text-zinc-700 hover:text-zinc-400 transition-colors">GitHub</a>
        </div>
      </footer>
    </div>
  );
}
