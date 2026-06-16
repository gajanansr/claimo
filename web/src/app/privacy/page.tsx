import Link from "next/link";
import { Car, ArrowLeft, Mail, Shield } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — claimo.",
  description: "How claimo collects, uses, and protects your personal data.",
};

const sections = [
  {
    id: "overview",
    title: "Overview",
    content: `claimo. ("we", "us", or "our") is a personal expense automation tool that reads ride receipts from your Gmail inbox to generate reimbursement reports. This Privacy Policy explains what data we access, how we use it, and your rights regarding that data.

We take your privacy seriously. We only request the minimum permissions required to deliver the service, and we never sell, share, or monetise your personal information.`,
  },
  {
    id: "data-collected",
    title: "What Data We Collect",
    items: [
      {
        label: "Google Account Information",
        desc: "Your name, email address, and profile picture — obtained when you sign in with Google. Used to identify your account.",
      },
      {
        label: "Gmail Read Access (Receipts Only)",
        desc: "We use the Gmail API with a restricted query to search for ride receipt emails from Uber and Rapido only. We read the email body to extract: trip date, amount, pickup/drop-off locations, and service name. We do not read, store, or access any other emails.",
      },
      {
        label: "Google OAuth Tokens",
        desc: "Access and refresh tokens are stored securely in our database to enable background syncing. These are encrypted at rest and are never shared with third parties.",
      },
      {
        label: "Receipt Data",
        desc: "Extracted ride data (date, amount, locations, service) is stored in your private account. Only you can see this data.",
      },
    ],
  },
  {
    id: "data-not-collected",
    title: "What We Do NOT Collect",
    items: [
      { label: "Other emails", desc: "We never read, index, or store emails outside of ride receipt queries." },
      { label: "Payment details", desc: "We do not collect or store credit card numbers, bank account details, or any payment credentials." },
      { label: "Location tracking", desc: "We do not track your real-time location. Location data comes only from receipt emails." },
      { label: "Behavioural analytics", desc: "We do not use third-party analytics trackers (e.g. Google Analytics, Meta Pixel) on the dashboard." },
    ],
  },
  {
    id: "how-we-use",
    title: "How We Use Your Data",
    items: [
      { label: "Service delivery", desc: "To sync your ride receipts, display your expense history, and generate PDF reimbursement reports." },
      { label: "Authentication", desc: "To verify your identity and keep your session secure." },
      { label: "Email sync", desc: "To periodically query your Gmail for new ride receipts using your stored OAuth token." },
    ],
  },
  {
    id: "data-storage",
    title: "Data Storage & Security",
    content: `Your data is stored on Supabase (PostgreSQL), hosted on AWS infrastructure. All data is encrypted at rest (AES-256) and in transit (TLS 1.3). Row-Level Security (RLS) policies ensure that you can only ever access your own data — even if there were a server-side bug.

OAuth tokens are stored server-side and are never exposed to the browser or third parties. Generated PDF reports are stored in a private, authenticated storage bucket accessible only to your account.`,
  },
  {
    id: "third-parties",
    title: "Third-Party Services",
    items: [
      { label: "Supabase", desc: "Database, authentication, and file storage. Supabase is SOC 2 Type II compliant." },
      { label: "Google APIs", desc: "Gmail API for reading receipts and OAuth 2.0 for authentication." },
      { label: "Google Cloud Run", desc: "Hosting our PDF generation microservice." },
      { label: "Vercel", desc: "Hosting the web application frontend." },
    ],
  },
  {
    id: "your-rights",
    title: "Your Rights",
    items: [
      { label: "Access", desc: "You can view all data we hold about you in the app dashboard." },
      { label: "Deletion", desc: "You can delete your account and all associated data at any time from Settings → Delete Account. All data is permanently erased within 30 days." },
      { label: "Revoke Access", desc: "You can revoke claimo's Gmail access at any time via your Google Account security settings (myaccount.google.com/permissions)." },
      { label: "Export", desc: "You can export your ride data as CSV at any time from the Rides page." },
    ],
  },
  {
    id: "changes",
    title: "Changes to This Policy",
    content: `We may update this Privacy Policy from time to time. We will notify you of significant changes by updating the "Last updated" date at the top of this page. Continued use of claimo after a change constitutes acceptance of the revised policy.`,
  },
  {
    id: "contact",
    title: "Contact",
    content: `If you have any questions, concerns, or requests regarding this Privacy Policy, please contact us at:`,
    contact: true,
  },
];

export default function PrivacyPage() {
  return (
    <div className="flex flex-col min-h-screen bg-black text-zinc-200 font-sans antialiased">

      {/* Nav */}
      <nav className="border-b border-zinc-900 h-14 flex items-center justify-between px-6 lg:px-12 shrink-0 sticky top-0 bg-black/90 backdrop-blur-sm z-10">
        <Link href="/" className="flex items-center gap-2">
          <Car className="h-4 w-4 text-zinc-300" />
          <span className="text-zinc-100 font-bold text-[15px] tracking-tight">
            claimo<span className="text-emerald-500">.</span>
          </span>
        </Link>
        <Link
          href="/"
          className="flex items-center gap-1.5 text-[12px] text-zinc-500 hover:text-zinc-200 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to home
        </Link>
      </nav>

      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-12 lg:py-16">

        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="h-5 w-5 text-emerald-500" />
            <Badge variant="outline" className="text-emerald-400 border-emerald-900/50 bg-emerald-950/20 text-[11px]">
              Legal
            </Badge>
          </div>
          <h1 className="text-3xl font-bold text-zinc-100 tracking-tight mb-3">Privacy Policy</h1>
          <p className="text-zinc-500 text-sm">Last updated: June 17, 2025</p>
        </div>

        <Separator className="bg-zinc-900 mb-10" />

        {/* Table of contents */}
        <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-5 mb-10">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 mb-3">Contents</p>
          <ol className="space-y-1.5">
            {sections.map((s, i) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="text-[13px] text-zinc-400 hover:text-emerald-400 transition-colors flex items-center gap-2"
                >
                  <span className="text-zinc-700 text-[11px] tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </div>

        {/* Sections */}
        <div className="space-y-12">
          {sections.map((section, i) => (
            <section key={section.id} id={section.id} className="scroll-mt-20">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-[11px] font-bold text-zinc-700 tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                <h2 className="text-lg font-bold text-zinc-100">{section.title}</h2>
              </div>

              {section.content && !section.contact && (
                <p className="text-zinc-400 text-[14px] leading-relaxed whitespace-pre-line">
                  {section.content}
                </p>
              )}

              {section.contact && (
                <div className="space-y-4">
                  <p className="text-zinc-400 text-[14px] leading-relaxed">{section.content}</p>
                  <a
                    href="mailto:gajanansr.work@gmail.com"
                    className="inline-flex items-center gap-2.5 bg-zinc-950 border border-zinc-800 hover:border-emerald-900/60 hover:bg-emerald-950/10 rounded-xl px-4 py-3 transition-all group"
                  >
                    <Mail className="h-4 w-4 text-emerald-500 shrink-0" />
                    <div>
                      <p className="text-[13px] font-semibold text-zinc-200 group-hover:text-emerald-400 transition-colors">
                        gajanansr.work@gmail.com
                      </p>
                      <p className="text-[11px] text-zinc-600">Privacy & data requests</p>
                    </div>
                  </a>
                </div>
              )}

              {section.items && (
                <div className="space-y-3">
                  {section.items.map((item) => (
                    <div key={item.label} className="bg-zinc-950 border border-zinc-900 rounded-lg p-4">
                      <p className="text-[13px] font-semibold text-zinc-200 mb-1">{item.label}</p>
                      <p className="text-[13px] text-zinc-500 leading-relaxed">{item.desc}</p>
                    </div>
                  ))}
                </div>
              )}

              {i < sections.length - 1 && <Separator className="bg-zinc-900 mt-12" />}
            </section>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 h-12 flex items-center justify-between px-6 lg:px-12 shrink-0 mt-8">
        <span className="text-[12px] text-zinc-700 font-medium">
          claimo<span className="text-emerald-600">.</span>
        </span>
        <div className="flex items-center gap-4">
          <Link href="/privacy" className="text-[11px] text-zinc-500 hover:text-zinc-400 transition-colors">Privacy</Link>
          <Link href="/terms" className="text-[11px] text-zinc-700 hover:text-zinc-400 transition-colors">Terms</Link>
        </div>
      </footer>
    </div>
  );
}
