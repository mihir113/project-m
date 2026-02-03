"use client";

import { createBrowserClient } from "@supabase/ssr";

// createBrowserClient is specifically designed for Next.js Client Components.
// It automatically handles cookie sync and auth state.
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);