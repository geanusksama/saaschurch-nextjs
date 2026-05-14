// SPA wrapper — loaded client-side only via dynamic import
// This renders the full React Router SPA within Next.js

import { RouterProvider } from "react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { router } from "./routes";
import { queryClient } from "../lib/queryClient";

// Clean up stale IndexedDB caches from old app versions
const STALE_IDB_NAMES = ["crm_chat_cache_v1", "crm_pipeline_cache_v1"];
if (typeof indexedDB !== "undefined") {
  STALE_IDB_NAMES.forEach((name) => {
    try { indexedDB.deleteDatabase(name); } catch { /* silent */ }
  });
}

export default function AppSPA() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
