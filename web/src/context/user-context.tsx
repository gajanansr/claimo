"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { createClient } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

interface UserContextValue {
  user: User | null;
  lastSync: string | null;
}

const UserContext = createContext<UserContextValue>({
  user: null,
  lastSync: null,
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

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
              setLastSync(
                formatDistanceToNow(parseISO(rData.created_at), {
                  addSuffix: true,
                })
              );
            }
          });
      }
    });
    // Intentionally runs only once on mount — the provider lives for the
    // lifetime of the dashboard session, so we never need to re-fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <UserContext.Provider value={{ user, lastSync }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser(): UserContextValue {
  return useContext(UserContext);
}
