"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface User {
  id: number;
  username: string;
  role: "owner" | "reseller";
  isBlocked?: boolean;
  displayName?: string;
  panelName?: string;
  accentColor?: string;
  avatarUrl?: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const stored = localStorage.getItem("user");
    const token  = localStorage.getItem("token");

    if (!stored || !token) {
      setLoading(false);
      return;
    }

    // Optimistically set from cache so UI renders immediately
    try {
      const cached = JSON.parse(stored) as User;
      // If cached state already shows blocked, redirect immediately
      if (cached.isBlocked) {
        router.replace("/blocked");
        setLoading(false);
        return;
      }
      setUser(cached);
    } catch {}

    // Refresh from server — always trust DB value over cache
    fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api"}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (r.status === 401) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          setUser(null);
          return null;
        }
        if (r.status === 403) {
          // Account blocked — hard redirect
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          router.replace("/blocked");
          return null;
        }
        return r.json();
      })
      .then((fresh) => {
        if (!fresh) return;
        if (fresh.isBlocked) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          router.replace("/blocked");
          return;
        }
        setUser(fresh);
        localStorage.setItem("user", JSON.stringify(fresh));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/login");
  }

  return { user, loading, logout };
}
