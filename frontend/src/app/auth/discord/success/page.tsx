"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, XCircle } from "lucide-react";
import { IconBrandDiscord } from "@tabler/icons-react";

const ERROR_MESSAGES: Record<string, string> = {
  discord_denied:  "Cancelaste la autorización con Discord.",
  invalid_state:   "Sesión de OAuth inválida. Intenta de nuevo.",
  no_code:         "No se recibió el código de autorización.",
  token_exchange:  "Error al comunicarse con Discord. Intenta de nuevo.",
  discord_user:    "No se pudo obtener tu perfil de Discord.",
  blocked:         "Tu cuenta está bloqueada. Contacta al administrador.",
  server:          "Error interno del servidor. Intenta más tarde.",
};

function DiscordCallback() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus]     = useState<"loading" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const token = searchParams.get("token");
    const error = searchParams.get("error");

    if (error) {
      setErrorMsg(ERROR_MESSAGES[error] || "Error desconocido al iniciar sesión con Discord.");
      setStatus("error");
      return;
    }

    if (!token) {
      setErrorMsg("No se recibió el token de sesión.");
      setStatus("error");
      return;
    }

    fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api"}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((user) => {
        localStorage.setItem("token", token);
        localStorage.setItem("user", JSON.stringify(user));
        router.replace("/dashboard");
      })
      .catch(() => {
        setErrorMsg("Token inválido. Intenta iniciar sesión de nuevo.");
        setStatus("error");
      });
  }, []);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: "#090b10" }}>
        <div className="flex items-center justify-center w-14 h-14 rounded-2xl"
          style={{ background: "rgba(88,101,242,0.15)", border: "1px solid rgba(88,101,242,0.3)" }}>
          <IconBrandDiscord size={28} color="#5865F2" stroke={1.6} />
        </div>
        <div className="flex items-center gap-2 text-sm" style={{ color: "#888" }}>
          <Loader2 className="w-4 h-4 animate-spin" style={{ color: "#5865F2" }} />
          Iniciando sesión con Discord...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-5 px-4" style={{ background: "#090b10" }}>
      <div className="flex items-center justify-center w-14 h-14 rounded-2xl"
        style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
        <XCircle className="w-7 h-7 text-red-400" />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium" style={{ color: "#fff" }}>Error al iniciar sesión</p>
        <p className="text-xs mt-1.5 max-w-xs" style={{ color: "#666" }}>{errorMsg}</p>
      </div>
      <button onClick={() => router.replace("/login")}
        className="px-5 py-2 rounded-lg text-sm font-medium transition-all duration-150 active:scale-[0.98]"
        style={{ background: "#13151c", border: "1px solid #1e2028", color: "#aaa" }}>
        Volver al login
      </button>
    </div>
  );
}

export default function DiscordSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#090b10" }}>
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: "#5865F2" }} />
      </div>
    }>
      <DiscordCallback />
    </Suspense>
  );
}
