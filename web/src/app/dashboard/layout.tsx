"use client";

import { useEffect, useState } from "react";
import { CarFront, FileText, Home, LogOut, Settings, Car } from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import { SyncButton } from "@/components/sync-button";

const navItems = [
  { href: "/dashboard",         label: "Overview", icon: Home     },
  { href: "/dashboard/rides",   label: "Rides",    icon: Car      },
  { href: "/dashboard/reports", label: "Reports",  icon: FileText },
  { href: "/dashboard/settings",label: "Settings", icon: Settings },
];

function isActive(href: string, pathname: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname.startsWith(href);
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      if (data.user) {
        supabase
          .from("receipts")
          .select("created_at")
          .eq("user_id", data.user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single()
          .then(({ data: rData }) => {
            if (rData?.created_at) {
              setLastSync(formatDistanceToNow(parseISO(rData.created_at), { addSuffix: true }));
            }
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

  const displayName  = user?.user_metadata?.full_name ?? user?.email ?? "—";
  const displayEmail = user?.email ?? "";

  return (
    <div className="min-h-screen bg-black flex font-sans antialiased text-zinc-200">

      {/* ── Desktop Sidebar ───────────────────────────────── md+ only */}
      <aside className="w-56 shrink-0 border-r border-zinc-900 bg-[#050505] hidden md:flex flex-col">

        {/* Wordmark */}
        <div className="h-14 flex items-center px-5 border-b border-zinc-900">
          <CarFront className="text-zinc-300 h-4 w-4 mr-2 shrink-0" />
          <span className="text-zinc-100 font-bold text-[15px] tracking-tight leading-none">
            claimo<span className="text-emerald-500">.</span>
          </span>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = isActive(href, pathname);
            return (
              <Link
                key={href}
                href={href}
                className={`relative flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-all duration-150 group
                  ${active
                    ? "text-zinc-100 bg-zinc-900"
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50"
                  }`}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-zinc-100 rounded-full" />
                )}
                <Icon className={`h-4 w-4 shrink-0 ${active ? "text-zinc-200" : "text-zinc-600 group-hover:text-zinc-400"}`} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* User card */}
        <div className="p-3 border-t border-zinc-900">
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-md bg-zinc-900/40 border border-zinc-900">
            <Avatar className="h-7 w-7 shrink-0 border border-zinc-800">
              <AvatarImage src={user?.user_metadata?.avatar_url} />
              <AvatarFallback className="text-[10px] bg-zinc-800 text-zinc-300">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-zinc-200 truncate leading-tight">{displayName}</p>
              <p className="text-[10px] text-zinc-500 truncate leading-tight">{displayEmail}</p>
            </div>
            <Button
              variant="ghost" size="icon"
              onClick={handleSignOut}
              title="Sign out"
              className="h-6 w-6 shrink-0 text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 rounded"
            >
              <LogOut className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </aside>

      {/* ── Main column ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Top header */}
        <header className="h-14 shrink-0 border-b border-zinc-900 bg-black/80 backdrop-blur-sm flex items-center justify-between px-4 md:px-6">
          {/* Mobile wordmark (hidden on desktop) */}
          <div className="flex items-center gap-1.5 md:hidden">
            <CarFront className="text-zinc-300 h-4 w-4" />
            <span className="text-zinc-100 font-bold text-[15px] tracking-tight">
              claimo<span className="text-emerald-500">.</span>
            </span>
          </div>

          {/* Desktop: current page label */}
          <span className="hidden md:block text-sm font-medium text-zinc-400">
            {navItems.find(n => isActive(n.href, pathname))?.label ?? "Dashboard"}
          </span>

          {/* Right side: sync status + mobile avatar */}
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-zinc-500">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse-dot" />
              <span>{lastSync ? `Synced ${lastSync}` : "Not synced"}</span>
            </div>
            <SyncButton
              iconOnly
              className="h-7 w-7 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 rounded-md"
            />

            {/* Mobile: avatar + sign-out (visible only on mobile) */}
            <div className="flex items-center gap-2 md:hidden">
              <Avatar className="h-7 w-7 border border-zinc-800">
                <AvatarImage src={user?.user_metadata?.avatar_url} />
                <AvatarFallback className="text-[10px] bg-zinc-800 text-zinc-300">{initials}</AvatarFallback>
              </Avatar>
              <Button
                variant="ghost" size="icon"
                onClick={handleSignOut}
                title="Sign out"
                className="h-7 w-7 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 rounded-md"
              >
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </header>

        {/* Page content — extra bottom padding on mobile to clear the tab bar */}
        <main className="flex-1 overflow-y-auto bg-zinc-950 pb-20 md:pb-0">
          {children}
        </main>
      </div>

      {/* ── Mobile bottom tab bar ────────────────── visible below md only */}
      <nav
        className="
          md:hidden fixed bottom-0 left-0 right-0 z-50
          bg-black/90 backdrop-blur-md
          border-t border-zinc-900
          flex items-stretch
          safe-bottom
        "
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = isActive(href, pathname);
          return (
            <Link
              key={href}
              href={href}
              className={`
                flex-1 flex flex-col items-center justify-center gap-1
                pt-3 pb-2 min-h-[56px]
                text-[10px] font-semibold tracking-wide
                transition-colors duration-150
                ${active ? "text-zinc-100" : "text-zinc-600 active:text-zinc-300"}
              `}
            >
              <span className="relative">
                <Icon
                  className={`h-5 w-5 transition-all duration-150 ${active ? "text-zinc-100" : "text-zinc-600"}`}
                  strokeWidth={active ? 2.2 : 1.8}
                />
                {/* Active indicator dot */}
                {active && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-0.5 w-4 rounded-full bg-zinc-100" />
                )}
              </span>
              <span className={active ? "text-zinc-200" : "text-zinc-600"}>{label}</span>
            </Link>
          );
        })}
      </nav>

    </div>
  );
}
