"use client";

// SPA wrapper — loaded client-side only via dynamic import
// This renders the full React Router SPA within Next.js

import { RouterProvider } from "react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { del } from "idb-keyval";
import { router } from "./routes";
import { queryClient } from "../lib/queryClient";
import { initializeSupabaseAuthStorageSync, supabase } from "../lib/supabaseClient";

// Clean up stale IndexedDB caches from old app versions
const STALE_IDB_NAMES = ["crm_chat_cache_v1", "crm_pipeline_cache_v1"];
if (typeof indexedDB !== "undefined") {
  STALE_IDB_NAMES.forEach((name) => {
    try { indexedDB.deleteDatabase(name); } catch { /* silent */ }
  });
}

export default function AppSPA() {
  useEffect(() => {
    const isProtectedPath = (pathname: string) => pathname.startsWith("/app-ui") || pathname === "/pending-activation";

    const redirectToLogin = async () => {
      try {
        localStorage.removeItem("mrm_token");
        localStorage.removeItem("mrm_user");
        localStorage.removeItem("mrm_permissions");
        localStorage.removeItem("mrm_selected_context");
        localStorage.removeItem("mrm_active_field_id");
        localStorage.removeItem("mrm_active_field_name");
        await del("secretaria-cache").catch(() => undefined);
      } catch {
        // ignore storage errors during forced sign-out
      }

      if (isProtectedPath(window.location.pathname)) {
        window.location.replace("/auth/login");
      }
    };

    void initializeSupabaseAuthStorageSync().then(async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        await redirectToLogin();
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session || event === 'SIGNED_OUT') {
        void redirectToLogin();
      }
    });

    // Suppress unhandled AuthApiError from invalid/expired refresh tokens by
    // catching them at the window level and redirecting to login
    const handleAuthError = (e: PromiseRejectionEvent) => {
      const msg: string = e?.reason?.message ?? '';
      if (msg.toLowerCase().includes('refresh token')) {
        e.preventDefault();
        void supabase.auth.signOut().finally(() => redirectToLogin());
      }
    };
    window.addEventListener('unhandledrejection', handleAuthError);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('unhandledrejection', handleAuthError);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
