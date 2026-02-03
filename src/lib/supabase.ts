"use client";

import { createBrowserClient } from "@supabase/supabase-js";

// createBrowserClient creates a singleton — only one instance exists even if
// this file is imported many times. Safe to call anywhere on the frontend.
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
