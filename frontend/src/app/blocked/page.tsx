"use client";
import { useEffect } from "react";
import { ShieldOff } from "lucide-react";

// Standalone page — no layout, no sidebar, no API access.
// Clears all local auth state on mount so there's no stale session.
export default function BlockedPage() {
  useEffect(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-sm w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="p-4 rounded-full bg-destructive/10 border border-destructive/20">
            <ShieldOff className="w-8 h-8 text-red-400" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-foreground">Cuenta bloqueada</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Tu cuenta ha sido bloqueada por el administrador.
            Contacta al soporte si crees que esto es un error.
          </p>
        </div>

        <a
          href="/login"
          className="inline-block w-full bg-secondary hover:bg-accent text-foreground text-sm font-medium py-2.5 rounded-lg transition-colors"
        >
          Volver al inicio
        </a>
      </div>
    </div>
  );
}
