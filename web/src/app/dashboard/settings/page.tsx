"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bell, ChevronRight, LogOut, Mail, RefreshCw,
  Shield, Trash2, User, Wallet,
} from "lucide-react";
import type { User as SupaUser } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

// type Section = { label: string; items: SettingItem[] };
// type SettingItem = {
//   icon: React.ElementType;
//   label: string;
//   desc: string;
//   action?: "link" | "toggle" | "badge";
//   badge?: string;
//   badgeColor?: string;
//   danger?: boolean;
// };

export default function SettingsPage() {
  const supabase  = createClient();
  const router    = useRouter();
  const [user, setUser] = useState<SupaUser | null>(null);
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [notifications, setNotifications] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      if (data.user) {
        supabase.from("profiles").select("*").eq("id", data.user.id).single().then(({ data: pData }) => {
          setProfile(pData);
        });
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/auth");
  };

  const initials = user?.user_metadata?.full_name
    ? user.user_metadata.full_name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() ?? "??";

  return (
    <div className="max-w-xl mx-auto px-4 py-6 lg:py-8 space-y-6 animate-fade-in-up">

      {/* ── Page header ─────────────────────────────────────── */}
      <div>
        <h1 className="text-xl font-bold text-zinc-100 tracking-tight">Settings</h1>
        <p className="text-zinc-500 text-sm mt-0.5">Manage your account and preferences</p>
      </div>

      {/* ── Profile card ────────────────────────────────────── */}
      <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-4 flex items-center gap-4">
        <Avatar className="h-12 w-12 border border-zinc-800 shrink-0">
          <AvatarImage src={user?.user_metadata?.avatar_url} />
          <AvatarFallback className="text-sm bg-zinc-800 text-zinc-300">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-semibold text-zinc-100 truncate leading-tight">
            {user?.user_metadata?.full_name ?? "—"}
          </p>
          <p className="text-[12px] text-zinc-500 truncate mt-0.5">{user?.email ?? "—"}</p>
        </div>
        <Badge variant="outline" className="bg-emerald-950/20 border-emerald-900/50 text-emerald-400 text-[10px] font-normal px-2 py-0.5 rounded shrink-0">
          Active
        </Badge>
      </div>

      {/* ── Gmail connection ─────────────────────────────────── */}
      <SettingsGroup title="Integrations">
        <SettingsRow
          icon={Mail}
          label="Gmail"
          desc={profile?.gmail_connected ? "Connected · Read-only access" : "Not connected"}
          right={
            <div className="flex items-center gap-2">
              <span className={`h-1.5 w-1.5 rounded-full ${profile?.gmail_connected ? 'bg-emerald-500 animate-pulse-dot' : 'bg-amber-500'}`} />
              <span className={`text-[12px] font-medium ${profile?.gmail_connected ? 'text-emerald-400' : 'text-amber-400'}`}>
                {profile?.gmail_connected ? 'Connected' : 'Action Required'}
              </span>
            </div>
          }
        />
        <SettingsRow
          icon={RefreshCw}
          label="Sync frequency"
          desc="Gmail is scanned every 2 hours"
          right={
            <span className="text-[12px] text-zinc-500">Every 2h <ChevronRight className="inline h-3 w-3 mb-0.5" /></span>
          }
        />
      </SettingsGroup>

      {/* ── Preferences ──────────────────────────────────────── */}
      <SettingsGroup title="Preferences">
        <SettingsRow
          icon={Wallet}
          label="Default currency"
          desc="Used in reports and expense totals"
          right={<span className="text-[12px] text-zinc-400 font-medium">INR ₹ <ChevronRight className="inline h-3 w-3 mb-0.5" /></span>}
        />
        <SettingsRow
          icon={Bell}
          label="Email notifications"
          desc="Get notified when a report is ready"
          right={
            <button
              onClick={() => setNotifications(n => !n)}
              className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border transition-colors duration-200
                ${notifications ? "bg-zinc-100 border-zinc-200" : "bg-zinc-800 border-zinc-700"}`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-zinc-950 shadow-sm transition-transform duration-200
                  ${notifications ? "translate-x-4" : "translate-x-0.5"}`}
              />
            </button>
          }
        />
      </SettingsGroup>

      {/* ── Account ──────────────────────────────────────────── */}
      <SettingsGroup title="Account">
        <SettingsRow
          icon={Shield}
          label="Privacy"
          desc="Read-only Gmail access · No data sold"
          right={<ChevronRight className="h-4 w-4 text-zinc-700" />}
        />
        <SettingsRow
          icon={User}
          label="Account plan"
          desc="Free tier · Up to 50 rides / month"
          right={
            <Badge variant="outline" className="bg-zinc-900 border-zinc-700 text-zinc-400 text-[10px] font-normal px-2 py-0.5 rounded">
              Free
            </Badge>
          }
        />
      </SettingsGroup>

      {/* ── Danger zone ──────────────────────────────────────── */}
      <SettingsGroup title="Danger zone">
        <SettingsRow
          icon={Trash2}
          label="Delete all data"
          desc="Permanently remove all rides and reports"
          danger
          right={<ChevronRight className="h-4 w-4 text-zinc-700" />}
        />
      </SettingsGroup>

      {/* ── Sign out ─────────────────────────────────────────── */}
      <Button
        onClick={handleSignOut}
        variant="ghost"
        className="w-full h-11 border border-zinc-900 bg-zinc-950 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 rounded-xl text-[13px] font-medium gap-2"
      >
        <LogOut className="h-4 w-4" />
        Sign out
      </Button>

      <p className="text-center text-[10px] text-zinc-700 pb-2">
        claimo<span className="text-emerald-700">.</span> · v0.1.0
      </p>
    </div>
  );
}

/* ── Reusable sub-components ─────────────────────────────────── */
function SettingsGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 px-1 mb-2">{title}</p>
      <div className="bg-zinc-950 border border-zinc-900 rounded-xl divide-y divide-zinc-900/80">
        {children}
      </div>
    </div>
  );
}

function SettingsRow({
  icon: Icon, label, desc, right, danger = false,
}: {
  icon: React.ElementType;
  label: string;
  desc: string;
  right?: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3.5 ${danger ? "hover:bg-red-950/10" : "hover:bg-zinc-900/30"} transition-colors cursor-default rounded-xl`}>
      <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${danger ? "bg-red-950/20 border border-red-900/40" : "bg-zinc-900 border border-zinc-800"}`}>
        <Icon className={`h-3.5 w-3.5 ${danger ? "text-red-400" : "text-zinc-400"}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-[13px] font-medium leading-tight ${danger ? "text-red-400" : "text-zinc-200"}`}>{label}</p>
        <p className="text-[11px] text-zinc-600 mt-0.5 leading-tight">{desc}</p>
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}
