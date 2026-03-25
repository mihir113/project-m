"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        router.replace("/");
      }
    })();
  }, [router]);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "github",
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) {
        setError(error.message || "Login failed");
        return;
      }
    } catch {
      setError("Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-primary p-6">
      <div className="card w-full max-w-sm p-6">
        <h1 className="text-xl font-semibold text-primary mb-2">Project M Login</h1>
        <p className="text-sm text-muted mb-4">Sign in with GitHub.</p>
        {error && <p className="text-xs mb-3" style={{ color: "#f87171" }}>{error}</p>}
        <button className="btn-primary w-full" onClick={handleLogin} disabled={loading}>
          {loading ? "Redirecting..." : "Continue with GitHub"}
        </button>
      </div>
    </div>
  );
}
