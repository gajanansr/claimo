"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LogOut, Mail, Plus, RefreshCw, Shield, Trash2, User, Wallet, Bell, ChevronRight, Building2, Home, Construction, MapPin, Star, Target, FileText } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { User as SupaUser } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LocationPicker } from "@/components/location-picker";
import { ProPlanDialog } from "@/components/pro-plan-dialog";
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

const ICON_MAP: Record<string, LucideIcon> = {
  building: Building2,
  home:     Home,
  site:     Construction,
  pin:      MapPin,
  star:     Star,
  target:   Target,
};

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

type UserLocation = {
  id: string;
  label: string;
  emoji: string;
  color: string;
  radius_meters: number;
  lat: number;
  lng: number;
};

export default function SettingsPage() {
  const supabase  = createClient();
  const router    = useRouter();
  const [user, setUser] = useState<SupaUser | null>(null);
  const [currency, setCurrency] = useState("INR");
  const [autoSync, setAutoSync] = useState(false);
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [locations, setLocations] = useState<UserLocation[]>([]);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showProPlan, setShowProPlan] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: "",
    description: "",
    actionLabel: "Continue",
    onConfirm: () => {},
  });

  const fetchLocations = useCallback(async () => {
    const res = await fetch("/api/locations");
    if (res.ok) {
      const data = await res.json();
      setLocations(data);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      if (data.user) {
        supabase.from("profiles").select("*").eq("id", data.user.id).single().then(({ data: pData }) => {
          setProfile(pData);
        });
      }
    });
    fetchLocations();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const executeDeleteLocation = async (loc: UserLocation) => {
    setDeletingId(loc.id);
    try {
      const res = await fetch(`/api/locations?id=${loc.id}`, { method: "DELETE" });
      if (res.ok) {
        setLocations(prev => prev.filter(l => l.id !== loc.id));
        toast.success(`"${loc.label}" removed`);
      } else {
        toast.error("Failed to delete location");
      }
    } catch {
      toast.error("Failed to delete location");
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteLocation = (loc: UserLocation) => {
    setConfirmDialog({
      open: true,
      title: "Remove Location",
      description: `Are you sure you want to delete "${loc.emoji} ${loc.label}"? This cannot be undone.`,
      actionLabel: "Remove",
      onConfirm: () => executeDeleteLocation(loc),
    });
  };

  const executeDeleteAllData = async () => {
    if (!user) return;
    const toastId = toast.loading("Deleting all your data...");
    try {
      const { error: rError } = await supabase.from("receipts").delete().eq("user_id", user.id);
      const { error: pError } = await supabase.from("reports").delete().eq("user_id", user.id);
      const { error: lError } = await supabase.from("user_locations").delete().eq("user_id", user.id);
      
      if (rError || pError || lError) {
        toast.error("Failed to delete some data.", { id: toastId });
      } else {
        toast.success("All your data has been permanently deleted.", { id: toastId });
        fetchLocations();
        router.refresh();
      }
    } catch (err) {
      toast.error("An unexpected error occurred.", { id: toastId });
    }
  };

  const handleDeleteAllData = () => {
    setConfirmDialog({
      open: true,
      title: "Delete All Data",
      description: "Are you sure? This will permanently delete all your receipts, custom locations, and generated reports. This cannot be undone.",
      actionLabel: "Delete Everything",
      onConfirm: () => executeDeleteAllData(),
    });
  };

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
          onClick={() => toast.info("To disconnect, please revoke access from your Google Account settings.")}
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
          label="Auto-sync receipts"
          desc={
            <span className="flex items-center gap-1.5">
              Background sync without opening the app
              <Badge variant="outline" className="bg-emerald-950/20 border-emerald-900/50 text-emerald-400 text-[9px] uppercase tracking-widest px-1.5 py-0 h-4 leading-none rounded">
                Pro
              </Badge>
            </span>
          }
          onClick={() => {
            if (!profile?.is_pro) {
              setShowProPlan(true);
            } else {
              setAutoSync(n => !n);
            }
          }}
          right={
            <button
              className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border transition-colors duration-200
                ${autoSync ? "bg-emerald-500 border-emerald-400" : "bg-zinc-800 border-zinc-700"}`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200
                  ${autoSync ? "translate-x-4" : "translate-x-0.5"}`}
              />
            </button>
          }
        />
      </SettingsGroup>

      {/* ── Preferences ──────────────────────────────────────── */}
      <SettingsGroup title="Preferences">
        <SettingsRow
          icon={Wallet}
          label="Default currency"
          desc="Used in reports and expense totals"
          right={
            <div onClick={(e) => e.stopPropagation()}>
              <Select
                value={currency}
                onValueChange={(val) => {
                  if (val) {
                    setCurrency(val);
                    toast.success(`Currency updated to ${val}`);
                  }
                }}
              >
                <SelectTrigger className="w-[100px] h-7 bg-zinc-900 border-zinc-800 text-zinc-200 text-[12px] focus:ring-0 focus:ring-offset-0 focus:border-emerald-800">
                  <SelectValue placeholder="Currency" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-950 border-zinc-800 text-zinc-200 text-[12px]">
                  <SelectItem value="INR">INR ₹</SelectItem>
                  <SelectItem value="USD">USD $</SelectItem>
                  <SelectItem value="EUR">EUR €</SelectItem>
                  <SelectItem value="GBP">GBP £</SelectItem>
                </SelectContent>
              </Select>
            </div>
          }
        />
        <SettingsRow
          icon={Bell}
          label="Email notifications"
          desc={
            <span className="flex items-center gap-1.5 text-zinc-500">
              Get notified when a report is ready
              <Badge variant="outline" className="bg-zinc-900 border-zinc-800 text-zinc-400 text-[9px] uppercase tracking-widest px-1.5 py-0 h-4 leading-none rounded">
                Coming Soon
              </Badge>
            </span>
          }
          right={
            <button
              disabled
              className="relative inline-flex h-5 w-9 shrink-0 rounded-full border transition-colors duration-200 bg-zinc-800 border-zinc-700 opacity-50 cursor-not-allowed"
            >
              <span className="absolute top-0.5 h-4 w-4 rounded-full bg-zinc-900 shadow-sm translate-x-0.5" />
            </button>
          }
        />
      </SettingsGroup>

      {/* ── Locations ────────────────────────────────────────── */}
      <SettingsGroup title="Locations">
        {locations.length === 0 ? (
          <div className="px-4 py-5 text-center">
            <p className="text-[12px] text-zinc-500">No locations saved yet.</p>
            <p className="text-[11px] text-zinc-600 mt-0.5">Add locations to auto-tag your rides.</p>
          </div>
        ) : (
          locations.map(loc => (
            <div
              key={loc.id}
              className="flex items-center gap-3 px-4 py-3.5 hover:bg-zinc-900/30 transition-colors cursor-pointer rounded-xl group"
              onClick={() => handleDeleteLocation(loc)}
            >
              <div
                className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 border"
                style={{ backgroundColor: loc.color + "22", borderColor: loc.color + "55" }}
              >
                {(() => {
                  const Icon = ICON_MAP[loc.emoji] ?? MapPin;
                  return <Icon className="h-4 w-4" style={{ color: loc.color }} />;
                })()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-[13px] font-medium text-zinc-200 leading-tight">{loc.label}</p>
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: loc.color }}
                  />
                </div>
                <p className="text-[11px] text-zinc-600 mt-0.5 leading-tight">
                  {loc.radius_meters}m radius · {loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}
                </p>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                <Badge variant="outline" className="bg-zinc-900 border-zinc-800 text-zinc-500 text-[10px] font-normal px-2 py-0.5 rounded">
                  {loc.radius_meters}m
                </Badge>
                {deletingId === loc.id ? (
                  <span className="text-[11px] text-red-400">Deleting…</span>
                ) : (
                  <Trash2 className="h-3.5 w-3.5 text-zinc-700 group-hover:text-red-400 transition-colors" />
                )}
              </div>
            </div>
          ))
        )}
        <div
          className="flex items-center gap-3 px-4 py-3.5 hover:bg-zinc-900/30 transition-colors cursor-pointer rounded-xl border-t border-zinc-900/80"
          onClick={() => setShowLocationPicker(true)}
        >
          <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 bg-emerald-950/20 border border-emerald-900/30">
            <Plus className="h-3.5 w-3.5 text-emerald-500" />
          </div>
          <p className="text-[13px] font-medium text-emerald-400">Add Location</p>
        </div>
      </SettingsGroup>

      {/* ── Dialogs ────────────────────────────────────────────── */}
      <LocationPicker
        open={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        onSaved={() => {
          fetchLocations();
          toast.success("Location saved!");
        }}
      />

      <ProPlanDialog
        open={showProPlan}
        onClose={() => setShowProPlan(false)}
        onSuccess={() => {
          setProfile(prev => prev ? { ...prev, is_pro: true } : { is_pro: true });
          setShowProPlan(false);
          router.refresh();
        }}
      />

      {/* ── Account ──────────────────────────────────────────── */}
      <SettingsGroup title="Account">
        <SettingsRow
          icon={Shield}
          label="Privacy Policy"
          desc="Read-only Gmail access · No data sold"
          onClick={() => router.push("/privacy")}
          right={<ChevronRight className="h-4 w-4 text-zinc-700" />}
        />
        <SettingsRow
          icon={FileText}
          label="Terms of Service"
          desc="Read our terms and conditions"
          onClick={() => router.push("/terms")}
          right={<ChevronRight className="h-4 w-4 text-zinc-700" />}
        />
        <SettingsRow
          icon={User}
          label="Account plan"
          desc={profile?.is_pro ? "Pro tier · Unlimited rides" : "Free tier · Up to 50 rides / month"}
          onClick={() => {
            if (!profile?.is_pro) setShowProPlan(true);
          }}
          right={
            <Badge variant="outline" className={`border-zinc-700 text-[10px] font-normal px-2 py-0.5 rounded ${profile?.is_pro ? "bg-emerald-950/30 text-emerald-400 border-emerald-900/50" : "bg-zinc-900 text-zinc-400"}`}>
              {profile?.is_pro ? "Pro" : "Free"}
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
          onClick={handleDeleteAllData}
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
      <AlertDialog open={confirmDialog.open} onOpenChange={(isOpen) => setConfirmDialog(prev => ({ ...prev, open: isOpen }))}>
        <AlertDialogContent className="bg-zinc-950 border-zinc-900 text-zinc-100">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-zinc-100">{confirmDialog.title}</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              {confirmDialog.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent text-zinc-300 hover:text-zinc-100 border-zinc-800 hover:bg-zinc-900">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDialog.onConfirm}
              className="bg-red-950/40 text-red-400 hover:bg-red-900/60 border border-red-900/50 transition-colors"
            >
              {confirmDialog.actionLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
  icon: Icon, label, desc, right, danger = false, onClick
}: {
  icon: React.ElementType;
  label: string;
  desc: React.ReactNode;
  right?: React.ReactNode;
  danger?: boolean;
  onClick?: () => void;
}) {
  return (
    <div 
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3.5 ${danger ? "hover:bg-red-950/10" : "hover:bg-zinc-900/30"} transition-colors ${onClick ? 'cursor-pointer' : 'cursor-default'} rounded-xl`}
    >
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
