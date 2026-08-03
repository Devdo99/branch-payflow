import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ShieldCheck, Sparkles } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Masuk — PayFlow Premium" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/dashboard", replace: true });
  }, [loading, session, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) {
      toast.error("Gagal masuk", { description: error.message });
      return;
    }
    toast.success("Berhasil masuk ke PayFlow");
    navigate({ to: "/dashboard", replace: true });
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center bg-slate-950 overflow-hidden px-4 font-sans">
      {/* Decorative Gradient Background Glows */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-emerald-900/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-blue-900/20 blur-[120px] pointer-events-none" />

      {/* Subtle Pattern overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-30" />

      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* Brand Logo & Title */}
        <div className="text-center space-y-2 animate-fade-in-down duration-700">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 p-0.5 shadow-lg shadow-emerald-500/20">
            <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-slate-950">
              <ShieldCheck className="h-6 w-6 text-emerald-400" />
            </div>
          </div>
          <div className="space-y-1">
            <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center justify-center gap-2">
              Pay
              <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
                Flow
              </span>
              <Sparkles className="h-4 w-4 text-emerald-400 animate-pulse" />
            </h1>
            <p className="text-sm text-slate-400">Sistem Penggajian Karyawan Multi-Cabang</p>
          </div>
        </div>

        {/* Login Form Card */}
        <div className="bg-slate-900/70 border border-slate-800/80 backdrop-blur-xl p-8 rounded-2xl shadow-2xl relative overflow-hidden group">
          {/* Top highlight line */}
          <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />

          <div className="mb-6">
            <h2 className="text-lg font-semibold text-slate-100">Selamat Datang Kembali</h2>
            <p className="text-xs text-slate-400 mt-1">
              Silakan masuk menggunakan kredensial administrator Anda.
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label
                htmlFor="email"
                className="text-xs font-semibold uppercase tracking-wider text-slate-300"
              >
                Email
              </Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="nama@email.com"
                className="bg-slate-950/60 border-slate-800 text-slate-200 placeholder-slate-500 focus:border-emerald-500/50 focus:ring-emerald-500/20 h-11"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="password"
                  className="text-xs font-semibold uppercase tracking-wider text-slate-300"
                >
                  Password
                </Label>
              </div>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
                className="bg-slate-950/60 border-slate-800 text-slate-200 placeholder-slate-500 focus:border-emerald-500/50 focus:ring-emerald-500/20 h-11"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-11 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all duration-300 transform active:scale-[0.99] border-none mt-2"
              disabled={submitting}
            >
              {submitting ? (
                <span className="flex items-center gap-2 justify-center">
                  <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Memverifikasi...
                </span>
              ) : (
                "Masuk ke Dashboard"
              )}
            </Button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-800/60 text-center">
            <span className="text-[11px] text-slate-500">
              Hak Cipta &copy; {new Date().getFullYear()} PayFlow Premium. Seluruh hak cipta
              dilindungi.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
