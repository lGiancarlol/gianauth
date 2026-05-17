"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import api from "@/lib/api";
import { Loader2 } from "lucide-react";
import {
  IconLock,
  IconUser,
  IconArrowRight,
  IconBrandDiscord,
  IconBrandGithub,
  IconShieldLock,
} from "@tabler/icons-react";

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ username: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [pwFocused, setPwFocused] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", form);
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      toast.success(`Bienvenido, ${data.user.username}`);
      router.push("/dashboard");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-10"
      style={{ background: "#090b10" }}
    >
      {/* Card principal */}
      <div
        className="w-full flex flex-col md:flex-row overflow-hidden"
        style={{
          maxWidth: 1300,
          borderRadius: 28,
          border: "1px solid #1e2028",
          boxShadow: "0 32px 80px rgba(0,0,0,0.6)",
        }}
      >
        {/* ── COLUMNA IZQUIERDA ── */}
        <div
          className="relative flex flex-col items-center justify-center px-10 py-16 md:py-0"
          style={{ background: "#090b10", flex: "0 0 46%" }}
        >
          {/* SVG decorativo de fondo */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="xMidYMid slice"
          >
            {/* Círculos concéntricos */}
            <circle cx="50%" cy="50%" r="180" fill="none" stroke="#c0392b" strokeWidth="1" opacity="0.07" />
            <circle cx="50%" cy="50%" r="280" fill="none" stroke="#c0392b" strokeWidth="1" opacity="0.05" />
            <circle cx="50%" cy="50%" r="380" fill="none" stroke="#c0392b" strokeWidth="1" opacity="0.03" />
            {/* Glow rojo detrás del logo */}
            <circle cx="50%" cy="50%" r="100" fill="#c0392b" opacity="0.04" />
            {/* Partículas */}
            {[
              [12,18],[88,25],[22,72],[75,15],[60,80],[35,90],[90,60],[8,50],
              [50,8],[70,45],[15,40],[82,78],[45,65],[28,30],[65,20],
            ].map(([cx, cy], i) => (
              <circle
                key={i}
                cx={`${cx}%`}
                cy={`${cy}%`}
                r={i % 3 === 0 ? "1.5" : "1"}
                fill={i % 2 === 0 ? "#c0392b" : "#ffffff"}
                opacity={i % 2 === 0 ? "0.18" : "0.07"}
              />
            ))}
          </svg>

          {/* Contenido central */}
          <div className="relative z-10 flex flex-col items-center text-center gap-5">
            {/* Logo box */}
            <div
              className="flex items-center justify-center"
              style={{
                width: 90,
                height: 90,
                borderRadius: 22,
                background: "#c0392b",
                border: "1.5px solid #e74c3c",
                boxShadow: "0 0 40px rgba(192,57,43,0.35)",
              }}
            >
              <IconLock size={44} color="#fff" stroke={1.6} />
            </div>

            {/* Título */}
            <div>
              <h1
                className="font-bold tracking-tight"
                style={{ fontSize: 48, color: "#fff", lineHeight: 1.1 }}
              >
                GianAuth
              </h1>
              <p className="mt-1 text-sm" style={{ color: "#777" }}>
                License Management Platform
              </p>
            </div>

            {/* Descripción */}
            <p
              className="text-sm leading-relaxed max-w-xs"
              style={{ color: "#555" }}
            >
              Gestiona licencias y revendedores desde un único panel seguro.
            </p>

            {/* Badge */}
            <div
              className="flex items-center gap-2 px-5 py-2 rounded-full text-xs font-medium"
              style={{
                background: "rgba(192,57,43,0.08)",
                border: "1px solid rgba(192,57,43,0.25)",
                color: "#c0392b",
              }}
            >
              <span
                className="inline-block w-1.5 h-1.5 rounded-full"
                style={{ background: "#c0392b" }}
              />
              Plataforma privada · Solo invitados
            </div>
          </div>
        </div>

        {/* ── COLUMNA DERECHA ── */}
        <div
          className="flex flex-col justify-center px-8 md:px-14 py-14"
          style={{
            flex: "0 0 54%",
            background: "#0d0f14",
            borderLeft: "1px solid #16181f",
          }}
        >
          {/* Header */}
          <div className="mb-8">
            <div
              className="rounded-full mb-5"
              style={{ width: 6, height: 40, background: "#c0392b" }}
            />
            <h2
              className="font-bold"
              style={{ fontSize: 28, color: "#fff", lineHeight: 1.2 }}
            >
              Bienvenido de vuelta
            </h2>
            <p className="mt-1.5 text-sm" style={{ color: "#666" }}>
              Accede a tu panel de gestión
            </p>
          </div>

          {/* Formulario */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Usuario */}
            <div>
              <label
                className="block text-sm font-medium mb-2"
                style={{ color: "#888" }}
              >
                Usuario
              </label>
              <div className="relative">
                <span
                  className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ color: "#555" }}
                >
                  <IconUser size={18} stroke={1.6} />
                </span>
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  placeholder="admin"
                  required
                  className="w-full pl-11 pr-4 text-sm transition-all outline-none"
                  style={{
                    height: 56,
                    borderRadius: 12,
                    background: "#13151c",
                    border: "1px solid #1e2028",
                    color: "#fff",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "#c0392b";
                    e.currentTarget.style.background = "#150d0d";
                    e.currentTarget.style.boxShadow = "0 0 0 3px rgba(192,57,43,0.1)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "#1e2028";
                    e.currentTarget.style.background = "#13151c";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
              </div>
            </div>

            {/* Contraseña */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label
                  className="text-sm font-medium"
                  style={{ color: "#888" }}
                >
                  Contraseña
                </label>
                <button
                  type="button"
                  className="text-xs transition-colors"
                  style={{ color: "#c0392b" }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "#e74c3c")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "#c0392b")}
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
              <div className="relative">
                <span
                  className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none transition-colors"
                  style={{ color: pwFocused ? "#c0392b" : "#555" }}
                >
                  <IconLock size={18} stroke={1.6} />
                </span>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••"
                  required
                  className="w-full pl-11 pr-4 text-sm transition-all outline-none"
                  style={{
                    height: 56,
                    borderRadius: 12,
                    background: "#13151c",
                    border: "1px solid #1e2028",
                    color: "#fff",
                  }}
                  onFocus={(e) => {
                    setPwFocused(true);
                    e.currentTarget.style.borderColor = "#c0392b";
                    e.currentTarget.style.background = "#150d0d";
                    e.currentTarget.style.boxShadow = "0 0 0 3px rgba(192,57,43,0.1)";
                  }}
                  onBlur={(e) => {
                    setPwFocused(false);
                    e.currentTarget.style.borderColor = "#1e2028";
                    e.currentTarget.style.background = "#13151c";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
              </div>
            </div>

            {/* Recordarme */}
            <div className="flex items-center gap-2.5 pt-1">
              <input
                type="checkbox"
                id="remember"
                className="w-4 h-4 rounded cursor-pointer"
                style={{ accentColor: "#c0392b" }}
              />
              <label
                htmlFor="remember"
                className="text-sm cursor-pointer select-none"
                style={{ color: "#888" }}
              >
                Recordar sesión
              </label>
            </div>

            {/* Botón principal */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2.5 font-bold text-sm transition-all disabled:opacity-50"
              style={{
                height: 56,
                borderRadius: 12,
                background: "#c0392b",
                color: "#fff",
                border: "none",
                cursor: loading ? "not-allowed" : "pointer",
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.background = "#d44637";
                  e.currentTarget.style.boxShadow = "0 4px 20px rgba(192,57,43,0.35)";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#c0392b";
                e.currentTarget.style.boxShadow = "none";
              }}
              onMouseDown={(e) => {
                if (!loading) e.currentTarget.style.background = "#a93226";
              }}
              onMouseUp={(e) => {
                if (!loading) e.currentTarget.style.background = "#d44637";
              }}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  Ingresar
                  <IconArrowRight size={18} stroke={2} />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px" style={{ background: "#1e2028" }} />
            <span className="text-xs" style={{ color: "#555" }}>
              o usa
            </span>
            <div className="flex-1 h-px" style={{ background: "#1e2028" }} />
          </div>

          {/* Botones sociales */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              className="flex items-center justify-center gap-2.5 text-sm font-medium transition-colors"
              style={{
                height: 52,
                borderRadius: 12,
                background: "#13151c",
                border: "1px solid #1e2028",
                color: "#aaa",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#181b23")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#13151c")}
            >
              <IconBrandDiscord size={20} color="#5865F2" stroke={1.6} />
              Discord
            </button>
            <button
              type="button"
              className="flex items-center justify-center gap-2.5 text-sm font-medium transition-colors"
              style={{
                height: 52,
                borderRadius: 12,
                background: "#13151c",
                border: "1px solid #1e2028",
                color: "#aaa",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#181b23")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#13151c")}
            >
              <IconBrandGithub size={20} color="#ccc" stroke={1.6} />
              GitHub
            </button>
          </div>

          {/* Badge inferior */}
          <div
            className="flex items-center gap-3 mt-6 px-4 py-3 rounded-xl"
            style={{
              background: "#13151c",
              border: "1px solid #1e2028",
            }}
          >
            <IconShieldLock size={18} color="#c0392b" stroke={1.6} className="shrink-0" />
            <span className="text-xs" style={{ color: "#666" }}>
              Plataforma protegida · Acceso solo por invitación
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
